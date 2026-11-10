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
        <p class="eyebrow">PACKAGED FOOD LOOKUP</p>
        <h2>Identify a food product</h2>
        <p>Scan or enter a barcode to find product details.</p>

        <ion-button v-if="isNative" expand="block" :disabled="loading || scanning" @click="scanWithCamera">
          <ion-spinner v-if="scanning" name="crescent" />
          <ion-icon v-else slot="start" :icon="barcodeOutline" />
          {{ scanning ? 'Opening camera…' : 'Scan with camera' }}
        </ion-button>
        <ion-note v-else>Camera scanning is available in the Android or iOS app. Use manual entry in the browser.</ion-note>

        <ion-item>
          <ion-input
            :value="barcode"
            inputmode="numeric"
            autocomplete="off"
            label="Barcode"
            label-placement="stacked"
            placeholder="8, 12, or 13 digits"
            :disabled="loading || scanning"
            @ionInput="barcode = $event.detail.value ?? ''"
          />
        </ion-item>
        <ion-button expand="block" fill="outline" :disabled="loading || scanning" @click="lookupBarcode">
          <ion-spinner v-if="loading" name="crescent" />
          {{ loading ? 'Looking up product…' : 'Look up barcode' }}
        </ion-button>
        <ion-card v-if="errorMessage" color="danger">
          <ion-card-content role="alert">{{ errorMessage }}</ion-card-content>
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
              <div v-if="product.categories"><dt>Categories</dt><dd>{{ product.categories }}</dd></div>
            </dl>
            <div class="nutrient-grid">
              <div v-for="nutrient in displayedNutrients" :key="nutrient.id">
                <span>{{ nutrient.name }}</span>
                <strong>{{ nutrientValue(nutrient.id, nutrient.unit) }}</strong>
              </div>
            </div>
            <p v-if="product.ingredients" class="ingredients"><strong>Ingredients:</strong> {{ product.ingredients }}</p>
            <p v-if="!product.nutritionProfile?.basisGrams && product.nutritionProfile?.basisMilliliters == null" class="nutrition-note">
              Nutrition data may be incomplete or per 100 mL. Values are not scaled without a matching unit basis.
            </p>
            <div class="action-row">
              <ion-button @click="emit('action', { action: 'add-inventory', product })">Add to inventory</ion-button>
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
import { computed, ref } from 'vue';
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
  IonNote,
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

defineProps<{ isOpen: boolean }>();
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

async function scanWithCamera(): Promise<void> {
  if (!isNative || scanning.value || loading.value) return;
  scanning.value = true;
  errorMessage.value = '';
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
      formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE],
    });
    const value = result.barcodes[0]?.rawValue;
    if (value) {
      barcode.value = value;
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

async function lookupBarcode(value = barcode.value): Promise<void> {
  if (loading.value || scanning.value) return;
  const normalized = normalizeFoodBarcode(value);
  if (!isSupportedFoodBarcode(normalized)) {
    errorMessage.value = 'Enter a valid EAN-8, EAN-13, UPC-A, or UPC-E barcode.';
    return;
  }
  barcode.value = normalized;
  loading.value = true;
  errorMessage.value = '';
  notFound.value = false;
  product.value = null;
  try {
    product.value = await getOpenFoodFactsProduct(normalized);
    notFound.value = product.value === null;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}

function nutrientValue(id: string, unit: string): string {
  const value = nutrition.value?.nutrients[id];
  if (!value) return 'Not Available';
  return `${Number(value.amount.toFixed(2))} ${value.unit || unit}`;
}

function resetLookup(): void {
  product.value = null;
  notFound.value = false;
  errorMessage.value = '';
  barcode.value = '';
}

function emitManualInventory(): void {
  emit('action', { action: 'manual-inventory', barcode: normalizeFoodBarcode(barcode.value) });
}
</script>

<style scoped>
.barcode-content { --background: #f7faf7; }
.barcode-panel { width: min(680px, 100%); margin: 0 auto; padding: 20px 16px 38px; }
.eyebrow { color: #2f8568; font-size: .7rem; font-weight: 750; letter-spacing: .1em; }
.barcode-panel h2 { margin: 6px 0; color: #244737; }
.barcode-panel > p { color: #6d7d72; line-height: 1.5; }
.product-card, .not-found { margin: 14px 0; }
.product-card ion-card-content { display: grid; gap: 9px; }
.product-card img { width: 140px; max-height: 160px; object-fit: contain; margin: auto; }
.product-card h3, .product-card p { margin: 0; }
.product-card dl { display: grid; gap: 5px; margin: 0; }
.product-card dl div { display: grid; grid-template-columns: 110px 1fr; gap: 8px; }
.product-card dt, .nutrient-grid span { color: #6d7d72; font-size: .78rem; }
.product-card dd { margin: 0; overflow-wrap: anywhere; font-size: .82rem; }
.nutrient-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.nutrient-grid div { display: grid; gap: 3px; padding: 8px; border-radius: 9px; background: #f3f8f3; }
.nutrient-grid strong { font-size: .84rem; }
.ingredients, .nutrition-note { color: #65756a; font-size: .78rem; line-height: 1.45; }
.action-row { display: flex; flex-wrap: wrap; gap: 5px; }
@media (max-width: 460px) { .nutrient-grid { grid-template-columns: 1fr 1fr; } }
</style>
