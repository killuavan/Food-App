<template>
  <ion-modal :is-open="isOpen" @didDismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>Scan food barcode</ion-title>
        <ion-button slot="end" fill="clear" :disabled="loading || scanning" @click="emit('close')">Close</ion-button>
      </ion-toolbar>
    </ion-header>
    <ion-content class="barcode-content">
      <section class="barcode-panel">
        <ion-button v-if="isNative" expand="block" :disabled="loading || scanning" @click="scanWithCamera">
          <ion-spinner v-if="scanning" name="crescent" />
          <ion-icon v-else slot="start" :icon="barcodeOutline" />
          {{ scanning ? 'Opening camera…' : 'Scan with camera' }}
        </ion-button>

        <ion-item>
          <ion-input
            :value="barcode"
            inputmode="text"
            autocomplete="off"
            label="Barcode"
            label-placement="stacked"
            placeholder="Enter barcode"
            :disabled="loading || scanning"
            @ionInput="handleBarcodeInput($event.detail.value ?? '')"
          />
        </ion-item>
        <p v-if="loading" class="lookup-status" role="status">Looking up…</p>
        <ion-card v-if="errorMessage" color="danger">
          <ion-card-content role="alert">{{ errorMessage }}</ion-card-content>
        </ion-card>
        <ion-card v-if="scanNotice" class="not-found">
          <ion-card-content>
            <strong>{{ scanNotice.format }} scanned</strong>
            <p class="scanned-value">{{ scanNotice.value }}</p>
            <p>Food product lookup is available for EAN/UPC barcodes only. You can add this product manually.</p>
            <div class="action-row">
              <ion-button @click="emitManualInventory">Add product manually</ion-button>
              <ion-button fill="outline" @click="resetLookup">Scan again</ion-button>
            </div>
          </ion-card-content>
        </ion-card>
        <ion-card v-if="notFound" class="not-found">
          <ion-card-content>
            <strong>Product not found in the food database.</strong>
            <p>Try another barcode, add details manually, or search by name.</p>
            <div class="action-row">
              <ion-button fill="outline" @click="resetLookup">Scan again</ion-button>
              <ion-button @click="emitManualInventory">Add product manually</ion-button>
              <ion-button fill="clear" @click="emit('action', { action: 'search-name' })">Search food by name</ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card v-if="product" class="product-card">
          <ion-card-content>
            <img v-if="product.imageUrl" :src="product.imageUrl" :alt="product.name" referrerpolicy="no-referrer">
            <h3>{{ product.name }}</h3>
            <p v-if="product.brand">{{ product.brand }}</p>
            <dl>
              <div><dt>Barcode</dt><dd>{{ product.barcode }}</dd></div>
              <div v-if="product.packageDescription"><dt>Package</dt><dd>{{ product.packageDescription }}</dd></div>
              <div v-if="product.servingSize"><dt>Serving size</dt><dd>{{ product.servingSize }}</dd></div>
              <div v-if="product.allergens"><dt>Allergens</dt><dd>{{ product.allergens }}</dd></div>
              <div v-if="product.traces"><dt>May contain traces</dt><dd>{{ product.traces }}</dd></div>
            </dl>
            <div class="nutrient-grid">
              <div v-for="nutrient in displayedNutrients" :key="nutrient.id">
                <span>{{ nutrient.name }}</span>
                <strong>{{ nutrientValue(nutrient.id, nutrient.unit) }}</strong>
              </div>
            </div>
            <p v-if="product.ingredients" class="ingredients"><strong>Ingredients:</strong> {{ product.ingredients }}</p>
            <p v-if="!product.nutritionProfile" class="nutrition-note">
              Nutrition values are not available for this barcode. You can still save the product to inventory.
            </p>
            <p v-if="product.nutritionProfile && !product.nutritionProfile.basisGrams && product.nutritionProfile.basisMilliliters == null" class="nutrition-note">
              Nutrition data may be incomplete or per 100 mL. Values are not scaled without a matching unit basis.
            </p>
            <div class="action-row">
              <ion-button @click="emit('action', { action: 'add-inventory', product })">Save to inventory</ion-button>
              <ion-button fill="outline" @click="emit('action', { action: 'log-consumption', product })">Log consumption</ion-button>
              <ion-button fill="clear" @click="resetLookup">Scan again</ion-button>
            </div>
          </ion-card-content>
        </ion-card>
      </section>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { Capacitor } from '@capacitor/core';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { barcodeOutline } from 'ionicons/icons';
import {
  getOpenFoodFactsProduct,
  isSupportedFoodBarcode,
  normalizeFoodBarcode,
  type ScannedFoodProduct,
} from '../services/openFoodFactsService';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{
  close: [];
  action: [payload: {
    action: 'add-inventory' | 'log-consumption' | 'manual-inventory' | 'search-name';
    product?: ScannedFoodProduct;
    barcode?: string;
  }];
}>();

const isNative = Capacitor.isNativePlatform();
const barcode = ref('');
const product = ref<ScannedFoodProduct | null>(null);
const loading = ref(false);
const scanning = ref(false);
const notFound = ref(false);
const errorMessage = ref('');
const scanNotice = ref<{ format: string; value: string } | null>(null);
let lookupTimer: ReturnType<typeof setTimeout> | null = null;
let lookupSequence = 0;
const minimumLookupDelayMs = 450;
const primaryNutrients = [
  { id: '208', name: 'Energy', unit: 'kcal' },
  { id: '268', name: 'Energy', unit: 'kJ' },
  { id: '203', name: 'Protein', unit: 'g' },
  { id: '205', name: 'Carbohydrates', unit: 'g' },
  { id: '204', name: 'Fat', unit: 'g' },
  { id: '291', name: 'Fiber', unit: 'g' },
  { id: '307', name: 'Sodium', unit: 'mg' },
  { id: '301', name: 'Calcium', unit: 'mg' },
  { id: '303', name: 'Iron', unit: 'mg' },
  { id: '306', name: 'Potassium', unit: 'mg' },
  { id: '320', name: 'Vitamin A', unit: 'µg' },
  { id: '401', name: 'Vitamin C', unit: 'mg' },
  { id: '324', name: 'Vitamin D', unit: 'µg' },
] as const;
const nutrition = computed(() => product.value?.nutritionProfile ?? null);
const displayedNutrients = computed(() => {
  const primaryIds = new Set<string>(primaryNutrients.map(({ id }) => id));
  const additional = Object.entries(nutrition.value?.nutrients ?? {})
    .filter(([id]) => !primaryIds.has(id))
    .map(([id, value]) => ({ id, name: value.name, unit: value.unit }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...primaryNutrients, ...additional];
});

watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) {
    clearLookupTimer();
    lookupSequence += 1;
    loading.value = false;
    scanning.value = false;
    return;
  }
  resetLookup();
}, { immediate: true });

onUnmounted(() => {
  clearLookupTimer();
  lookupSequence += 1;
});

function clearLookupTimer(): void {
  if (lookupTimer) clearTimeout(lookupTimer);
  lookupTimer = null;
}

function handleBarcodeInput(value: string): void {
  barcode.value = value;
  product.value = null;
  notFound.value = false;
  scanNotice.value = null;
  errorMessage.value = '';
  clearLookupTimer();
  lookupSequence += 1;
  const normalized = normalizeFoodBarcode(value);
  if (!isSupportedFoodBarcode(normalized)) {
    loading.value = false;
    return;
  }
  lookupTimer = setTimeout(() => {
    lookupTimer = null;
    void lookupBarcode(normalized);
  }, minimumLookupDelayMs);
}

async function scanWithCamera(): Promise<void> {
  if (!isNative || scanning.value || loading.value) return;
  scanning.value = true;
  errorMessage.value = '';
  scanNotice.value = null;
  product.value = null;
  notFound.value = false;
  try {
    const support = await BarcodeScanner.isSupported();
    if (!support.supported) throw new Error('Barcode scanning is not supported on this device.');

    const permission = await BarcodeScanner.requestPermissions();
    if (permission.camera !== 'granted') {
      throw new Error('Camera permission was not granted. Allow camera access in device settings, or enter the barcode manually.');
    }

    if (Capacitor.getPlatform() === 'android') {
      const module = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!module.available) await BarcodeScanner.installGoogleBarcodeScannerModule();
    }
    const result = await BarcodeScanner.scan({
      formats: [
        BarcodeFormat.Aztec,
        BarcodeFormat.Codabar,
        BarcodeFormat.Code39,
        BarcodeFormat.Code93,
        BarcodeFormat.Code128,
        BarcodeFormat.DataMatrix,
        BarcodeFormat.Ean8,
        BarcodeFormat.Ean13,
        BarcodeFormat.Itf,
        BarcodeFormat.Pdf417,
        BarcodeFormat.QrCode,
        BarcodeFormat.UpcA,
        BarcodeFormat.UpcE,
      ],
    });
    const scannedBarcode = result.barcodes[0];
    const value = scannedBarcode?.rawValue;
    if (value && scannedBarcode) {
      barcode.value = value;
      if (!isFoodBarcodeFormat(scannedBarcode.format)) {
        product.value = null;
        notFound.value = false;
        scanNotice.value = {
          format: scannedBarcode.format.replaceAll('_', ' '),
          value,
        };
        return;
      }
      scanNotice.value = null;
      await lookupBarcode(value);
    }
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : `Unable to scan barcode: ${String(error)}`;
  } finally {
    scanning.value = false;
  }
}

function isFoodBarcodeFormat(format: BarcodeFormat): boolean {
  return [
    BarcodeFormat.Ean8,
    BarcodeFormat.Ean13,
    BarcodeFormat.UpcA,
    BarcodeFormat.UpcE,
  ].includes(format);
}

async function lookupBarcode(value = barcode.value): Promise<void> {
  const normalized = normalizeFoodBarcode(value);
  if (!isSupportedFoodBarcode(normalized)) {
    errorMessage.value = 'Enter a valid EAN-8, EAN-13, UPC-A, or UPC-E barcode.';
    return;
  }
  barcode.value = normalized;
  const sequence = ++lookupSequence;
  loading.value = true;
  errorMessage.value = '';
  notFound.value = false;
  scanNotice.value = null;
  product.value = null;
  try {
    const result = await getOpenFoodFactsProduct(normalized);
    if (sequence !== lookupSequence) return;
    product.value = result;
    notFound.value = result === null;
  } catch (error) {
    if (sequence === lookupSequence) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (sequence === lookupSequence) loading.value = false;
  }
}

function nutrientValue(id: string, unit: string): string {
  const value = nutrition.value?.nutrients[id];
  if (!value) return 'Not Available';
  return `${Number(value.amount.toFixed(2))} ${value.unit || unit}`;
}

function resetLookup(): void {
  clearLookupTimer();
  lookupSequence += 1;
  product.value = null;
  notFound.value = false;
  scanNotice.value = null;
  errorMessage.value = '';
  barcode.value = '';
  loading.value = false;
}

function emitManualInventory(): void {
  emit('action', { action: 'manual-inventory', barcode: normalizeFoodBarcode(barcode.value) });
}
</script>

<style scoped>
.barcode-content { --background: #f7faf7; }
.barcode-panel { width: min(680px, 100%); margin: 0 auto; padding: 20px 16px 38px; }
.lookup-status { margin: 0; color: #39765b; font-size: .82rem; }
.product-card, .not-found { margin: 14px 0; }
.product-card ion-card-content { display: grid; gap: 9px; }
.product-card img { width: 140px; max-height: 160px; object-fit: contain; margin: auto; }
.product-card h3, .product-card p { margin: 0; }
.product-card dl { display: grid; gap: 5px; margin: 0; }
.product-card dl div { display: grid; grid-template-columns: 110px 1fr; gap: 8px; }
.product-card dt, .nutrient-grid span { color: #6d7d72; font-size: .78rem; }
.product-card dd { margin: 0; overflow-wrap: anywhere; font-size: .82rem; }
.scanned-value { overflow-wrap: anywhere; }
.nutrient-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.nutrient-grid div { display: grid; gap: 3px; padding: 8px; border-radius: 9px; background: #f3f8f3; }
.nutrient-grid strong { font-size: .84rem; }
.ingredients, .nutrition-note { color: #65756a; font-size: .78rem; line-height: 1.45; }
.action-row { display: flex; flex-wrap: wrap; gap: 5px; }
@media (max-width: 460px) { .nutrient-grid { grid-template-columns: 1fr 1fr; } }
</style>
