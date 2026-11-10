<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="nutrition-page">
        <header class="nutrition-hero">
          <div>
            <h1>Food nutrition search</h1>
          </div>
        </header>

        <ion-progress-bar v-if="loadingInventory" type="indeterminate" aria-label="Loading inventory choices" />
        <ion-card v-if="errorMessage" class="error-card">
          <ion-card-content role="alert">{{ errorMessage }}</ion-card-content>
        </ion-card>
        <div>
          <section class="search-section" aria-labelledby="search-heading">
            <div class="section-heading">
              <div>
                <h2 id="search-heading">Find a USDA food</h2>
              </div>
            </div>
            <NutritionSearchPanel
              :initial-search="typeof route.query.search === 'string' ? route.query.search : ''"
              @selected="selectProfile"
            />
          </section>

          <section v-if="profile" class="quantity-section" aria-labelledby="quantity-heading">
            <div class="section-heading">
              <div>
                <h2 id="quantity-heading">Calculate for an amount</h2>
              </div>
            </div>
            <ion-card class="quantity-card">
              <ion-card-content>
                <p v-if="profile.basisGrams === null" class="basis-warning">
                  This USDA branded entry does not give a usable gram basis, so no nutrient estimate can be calculated. Choose a USDA entry with a gram serving; the app will not guess a conversion.
                </p>
                <ion-item v-if="profile.portions.length" class="portion-control">
                  <ion-select
                    :value="selectedPortionGramWeight"
                    label="USDA portion (optional)"
                    interface="popover"
                    :disabled="profile.basisGrams === null"
                    @ionChange="selectPortion"
                  >
                    <ion-select-option :value="null">Custom gram amount</ion-select-option>
                    <ion-select-option
                      v-for="portion in profile.portions"
                      :key="`${portion.description}-${portion.gramWeight}`"
                      :value="portion.gramWeight"
                    >
                      {{ portion.description }} · {{ formatNumber(portion.gramWeight) }} g
                    </ion-select-option>
                  </ion-select>
                </ion-item>
                <div class="grams-control">
                  <ion-item>
                    <ion-input
                      v-model.number="grams"
                      type="number"
                      inputmode="decimal"
                      min="0.01"
                      step="any"
                      label="Food amount (grams)"
                      label-placement="stacked"
                      :disabled="profile.basisGrams === null"
                      @ionInput="selectedPortionGramWeight = null"
                    />
                  </ion-item>
                  <p>Source basis: {{ profile.basisDescription }}</p>
                </div>
                <div class="scaled-grid">
                  <div v-for="nutrient in nutrientRows" :key="nutrient.id" class="scaled-nutrient">
                    <span>{{ nutrient.label }}</span>
                    <strong>{{ scaledValue(nutrient.id) }}</strong>
                  </div>
                </div>
                <p class="source-note">
                  Nutrient values are scaled only when USDA provides a valid gram basis. Missing source nutrients remain “Not Available”.
                </p>
              </ion-card-content>
            </ion-card>
          </section>

          <section v-if="profile" class="link-section" aria-labelledby="link-heading">
            <div class="section-heading">
              <div>
                <h2 id="link-heading">Link this nutrition to inventory</h2>
              </div>
            </div>
            <section v-if="!user" class="auth-prompt">
              <span aria-hidden="true">🔒</span>
              <h3>Sign in to link nutrition to your pantry</h3>
              <ion-button router-link="/sign-in">Continue to sign in</ion-button>
            </section>
            <ion-card v-else class="link-card">
              <ion-card-content>
                <p v-if="profile" class="link-instructions">
                  Confirm the USDA food above, select “Use this food”, then choose the matching pantry item here and link it.
                </p>
                <ion-item>
                  <ion-select
                    v-model="selectedInventoryId"
                    label="Inventory item"
                    placeholder="Choose a food item"
                    interface="popover"
                  >
                    <ion-select-option v-for="item in inventory" :key="item.id" :value="item.id">
                      {{ item.foodName }} · {{ item.quantity }} {{ item.unit }}
                    </ion-select-option>
                  </ion-select>
                </ion-item>
                <p v-if="selectedInventoryItem?.nutritionProfile" class="linked-status">
                  This item already has nutrition linked (FDC ID {{ selectedInventoryItem.nutritionProfile.fdcId }}). Linking will replace that nutrition profile only.
                </p>
                <p v-if="!inventory.length" class="linked-status">
                  There are no saved inventory items yet. Add one from Food Inventory, then return here to link its USDA nutrition.
                </p>
                <div class="link-actions">
                  <ion-button :disabled="saving || !selectedInventoryItem" @click="saveLink">
                    <ion-spinner v-if="saving" name="crescent" />
                    <span>{{ saving ? 'Saving…' : 'Link to inventory' }}</span>
                  </ion-button>
                  <ion-button
                    fill="outline"
                    :disabled="saving || !selectedInventoryItem"
                    @click="saveLinkAndOpenConsumption"
                  >
                    Use in food log
                  </ion-button>
                </div>
              </ion-card-content>
            </ion-card>
          </section>
        </div>

        <ion-toast
          :is-open="toastOpen"
          :message="toastMessage"
          :color="toastColor"
          :duration="3000"
          position="bottom"
          @didDismiss="toastOpen = false"
        />
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { AuthenticatedUser as User } from '../services/authService';
import { useRoute, useRouter } from 'vue-router';
import AppNavigation from '../components/AppNavigation.vue';
import NutritionSearchPanel from '../components/NutritionSearchPanel.vue';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonInput,
  IonItem,
  IonPage,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonToast,
} from '@ionic/vue';
import { observeAuth } from '../services/authService';
import { linkNutritionProfile, listFoodItems } from '../services/foodInventoryService';
import { scaleNutritionForGrams, type NutritionProfile } from '../utils/usdaNutrition';
import type { FoodItem } from '../utils/foodInventory';

const router = useRouter();
const route = useRoute();
const user = ref<User | null>(null);
const inventory = ref<FoodItem[]>([]);
const profile = ref<NutritionProfile | null>(null);
const selectedInventoryId = ref('');
const selectedPortionGramWeight = ref<number | null>(null);
const grams = ref(100);
const loadingInventory = ref(true);
const saving = ref(false);
const errorMessage = ref('');
const toastOpen = ref(false);
const toastMessage = ref('');
const toastColor = ref<'success' | 'danger'>('success');
let unsubscribeAuth: (() => void) | undefined;

watch(() => route.query.inventoryId, selectInventoryFromRoute);

const selectedInventoryItem = computed(() => inventory.value.find((item) => item.id === selectedInventoryId.value) ?? null);
const scaledNutrients = computed(() => {
  if (!profile.value) return null;
  return scaleNutritionForGrams(profile.value, grams.value);
});
const nutrientRows = [
  { id: '208', label: 'Energy (kcal)' },
  { id: '203', label: 'Protein (g)' },
  { id: '205', label: 'Carbohydrates (g)' },
  { id: '204', label: 'Total fat (g)' },
  { id: '291', label: 'Dietary fiber (g)' },
  { id: '301', label: 'Calcium (mg)' },
  { id: '303', label: 'Iron (mg)' },
  { id: '306', label: 'Potassium (mg)' },
  { id: '307', label: 'Sodium (mg)' },
  { id: '320', label: 'Vitamin A' },
  { id: '401', label: 'Vitamin C (mg)' },
  { id: '324', label: 'Vitamin D (µg)' },
];

onMounted(() => {
  unsubscribeAuth = observeAuth((authenticatedUser) => {
    user.value = authenticatedUser;
    if (authenticatedUser) void loadInventory(authenticatedUser.uid);
    else {
      inventory.value = [];
      loadingInventory.value = false;
    }
  }, (error) => {
    loadingInventory.value = false;
    errorMessage.value = error.message;
  });
});

onUnmounted(() => unsubscribeAuth?.());

async function loadInventory(userId: string): Promise<void> {
  loadingInventory.value = true;
  try {
    inventory.value = await listFoodItems(userId);
    selectInventoryFromRoute(route.query.inventoryId);
    errorMessage.value = '';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    loadingInventory.value = false;
  }
}

function selectInventoryFromRoute(value: unknown): void {
  const inventoryId = typeof value === 'string' ? value : '';
  if (inventoryId && inventory.value.some((item) => item.id === inventoryId)) {
    selectedInventoryId.value = inventoryId;
  }
}

function selectProfile(selected: NutritionProfile): void {
  profile.value = selected;
}

function scaledValue(id: string): string {
  const value = scaledNutrients.value?.[id] ?? (id === '320' ? scaledNutrients.value?.['318'] : undefined);
  if (value) return `${formatNumber(value.amount)} ${value.unit}`;
  const source = profile.value?.nutrients[id] ?? (id === '320' ? profile.value?.nutrients['318'] : undefined);
  if (source && (profile.value?.basisGrams === null || !Number.isFinite(grams.value) || grams.value <= 0)) return 'Not calculated';
  return 'Not Available';
}

function selectPortion(event: CustomEvent<{ value?: number | null }>): void {
  const gramWeight = event.detail.value;
  selectedPortionGramWeight.value = typeof gramWeight === 'number' ? gramWeight : null;
  if (selectedPortionGramWeight.value !== null) grams.value = selectedPortionGramWeight.value;
}

async function saveLink(): Promise<boolean> {
  const authenticatedUser = user.value;
  const item = selectedInventoryItem.value;
  if (!authenticatedUser || !item || !profile.value || saving.value) return false;

  saving.value = true;
  try {
    await linkNutritionProfile(authenticatedUser.uid, item.id, profile.value);
    inventory.value = inventory.value.map((entry) => entry.id === item.id
      ? { ...entry, nutritionProfile: profile.value }
      : entry);
    showToast(`USDA nutrition linked to ${item.foodName}.`, 'success');
    return true;
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), 'danger');
    return false;
  } finally {
    saving.value = false;
  }
}

async function saveLinkAndOpenConsumption(): Promise<void> {
  const item = selectedInventoryItem.value;
  if (!item) return;
  if (await saveLink()) {
    await router.push({ path: '/consumption', query: { inventoryItemId: item.id } });
  }
}

function showToast(message: string, color: 'success' | 'danger'): void {
  toastMessage.value = message;
  toastColor.value = color;
  toastOpen.value = true;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}
</script>

<style scoped>
.nutrition-page { width: min(1080px, 100%); margin: 0 auto; padding: 28px 24px 58px; }
.nutrition-hero { margin-bottom: 25px; padding: 28px 32px; border-radius: 22px; background: linear-gradient(90deg, rgb(20 62 47 / 96%) 0%, rgb(25 91 56 / 90%) 58%, rgb(25 91 56 / 34%) 100%), url('/images/food-banner.svg') center / cover no-repeat; color: #fff; box-shadow: 0 14px 32px rgb(25 80 61 / 13%); }
.eyebrow { margin: 0; color: #398670; font-size: 0.7rem; font-weight: 750; letter-spacing: 0.11em; }
.nutrition-hero .eyebrow { color: #bcebd0; }
.nutrition-hero h1 { margin: 7px 0; font-size: clamp(1.85rem, 4vw, 2.4rem); letter-spacing: -0.04em; }
.nutrition-hero p:last-child { margin: 0; color: rgb(255 255 255 / 82%); line-height: 1.5; }
.section-heading { margin: 27px 0 13px; }
.section-heading h2 { margin: 5px 0 0; color: #20352d; font-size: 1.3rem; }
.quantity-card, .link-card { margin: 0; border: 1px solid #e5ece7; border-radius: 15px; box-shadow: 0 5px 16px rgb(28 65 48 / 4%); }
.quantity-card ion-card-content, .link-card ion-card-content { padding: 18px; }
.grams-control { display: flex; align-items: center; gap: 12px; }
.portion-control { margin-bottom: 10px; --background: #f7f9f7; --border-radius: 10px; }
.grams-control ion-item { width: min(300px, 100%); --background: #f7f9f7; --border-radius: 10px; }
.grams-control p { color: #78867d; font-size: 0.78rem; }
.basis-warning { margin: 0 0 14px; padding: 11px; border-radius: 10px; background: #fff5e5; color: #8b6027; font-size: 0.8rem; line-height: 1.45; }
.scaled-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; margin-top: 15px; }
.scaled-nutrient { display: grid; gap: 5px; min-height: 64px; align-content: start; padding: 11px; border-radius: 10px; background: #f5f8f5; }
.scaled-nutrient span { color: #78867e; font-size: 0.7rem; }
.scaled-nutrient strong { color: #284a39; font-size: 0.83rem; }
.source-note, .link-card p { color: #77857c; font-size: 0.78rem; line-height: 1.5; }
.link-card ion-item { --background: #f7f9f7; --border-radius: 10px; }
.linked-status { color: #8c642c !important; }
.link-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 13px; }
.link-actions ion-button { --border-radius: 10px; text-transform: none; }
.error-card { border: 1px solid #f1d3cd; border-radius: 12px; box-shadow: none; color: #943e33; }
.auth-prompt { padding: 36px 18px; border: 1px dashed #d9e5dc; border-radius: 16px; background: #fff; text-align: center; }
.auth-prompt span { font-size: 2rem; }
.auth-prompt h2 { color: #294638; }

@media (max-width: 700px) {
  .nutrition-page { padding: 18px 14px 42px; }
  .nutrition-hero { padding: 22px; }
  .scaled-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grams-control { align-items: flex-start; flex-direction: column; }
}
</style>
