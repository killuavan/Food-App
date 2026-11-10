<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="consumption-page">
        <header class="consumption-hero">
          <div>
            <h1>Food consumption</h1>
          </div>
          <ion-button class="add-button" :disabled="!user" @click="openCreate">
            <ion-icon slot="start" :icon="addOutline" />
            Log food
          </ion-button>
          <ion-button fill="outline" :disabled="!user" @click="barcodeModalOpen = true">
            <ion-icon slot="start" :icon="barcodeOutline" />
            Scan barcode
          </ion-button>
          <ion-button fill="clear" router-link="/daily-nutrition">
            <ion-icon slot="start" :icon="restaurantOutline" />
            Calorie summary
          </ion-button>
        </header>

        <ion-progress-bar v-if="loading" type="indeterminate" aria-label="Loading food consumption" />
        <ion-card v-if="errorMessage" class="error-card">
          <ion-card-content role="alert">{{ errorMessage }}</ion-card-content>
        </ion-card>

        <section v-if="!user && !loading" class="auth-prompt">
          <div aria-hidden="true">🔒</div>
          <h2>Sign in to record your meals</h2>
          <ion-button router-link="/sign-in">Continue to sign in</ion-button>
        </section>

        <template v-else-if="user">
          <section class="daily-section" aria-labelledby="daily-heading">
            <div class="section-heading">
              <div>
                <h2 id="daily-heading">{{ dailyHeading }}</h2>
              </div>
              <ion-item class="date-picker">
                <ion-input
                  v-model="summaryDate"
                  type="date"
                  label="View date"
                  label-placement="stacked"
                  aria-label="Choose consumption summary date"
                />
              </ion-item>
            </div>

            <div class="summary-grid">
              <ion-card class="summary-card total-card">
                <ion-card-content>
                  <span class="summary-icon"><ion-icon :icon="restaurantOutline" /></span>
                  <div><p>Total food entries</p><strong>{{ selectedDayRecords.length }}</strong></div>
                </ion-card-content>
              </ion-card>
              <ion-card v-for="meal in mealSummary" :key="meal.name" class="summary-card">
                <ion-card-content>
                  <span class="summary-icon" :class="meal.className"><ion-icon :icon="meal.icon" /></span>
                  <div><p>{{ meal.name }}</p><strong>{{ meal.count }}</strong></div>
                </ion-card-content>
              </ion-card>
            </div>

            <div class="meal-grid">
              <ion-card v-for="meal in mealCards" :key="meal.name" class="meal-card">
                <ion-card-content>
                  <div class="meal-title">
                    <span class="meal-icon" :class="meal.className"><ion-icon :icon="meal.icon" /></span>
                    <div>
                      <h3>{{ meal.name }}</h3>
                      <span>{{ meal.records.length }} {{ meal.records.length === 1 ? 'entry' : 'entries' }}</span>
                    </div>
                  </div>
                  <ion-list v-if="meal.records.length" lines="none">
                    <ion-item v-for="record in meal.records" :key="record.id">
                      <ion-label>
                        <h4>{{ record.foodName }}</h4>
                        <p>{{ formatQuantity(record.quantityConsumed) }} {{ record.measurementUnit }} · {{ record.consumptionTime }}</p>
                      </ion-label>
                    </ion-item>
                  </ion-list>
                  <p v-else class="meal-empty">No {{ meal.name.toLocaleLowerCase() }} entries for this date.</p>
                </ion-card-content>
              </ion-card>
            </div>
          </section>

          <section class="history-section" aria-labelledby="history-heading">
            <div class="section-heading history-heading">
              <div>
                <h2 id="history-heading">Recent consumption history</h2>
              </div>
              <span class="record-count">{{ filteredRecords.length }} {{ filteredRecords.length === 1 ? 'record' : 'records' }}</span>
            </div>

            <div class="filter-panel">
              <ion-searchbar
                v-model="search"
                placeholder="Search food by name"
                aria-label="Search consumption by food name"
                :debounce="150"
              />
              <ion-item class="filter-item">
                <ion-input
                  v-model="historyDate"
                  type="date"
                  label="Date"
                  label-placement="stacked"
                  aria-label="Filter consumption history by date"
                />
              </ion-item>
              <ion-item class="filter-item">
                <ion-select v-model="mealFilter" label="Meal" interface="popover">
                  <ion-select-option value="all">All meals</ion-select-option>
                  <ion-select-option v-for="meal in mealCategories" :key="meal" :value="meal">{{ meal }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-button fill="clear" class="clear-button" @click="clearFilters">Clear filters</ion-button>
            </div>

            <ion-card v-if="filteredRecords.length" class="history-card">
              <ion-list lines="none">
                <ion-item v-for="record in filteredRecords" :key="record.id" class="history-item">
                  <span class="food-mark" slot="start" aria-hidden="true">{{ categoryIcon(record.foodCategory) }}</span>
                  <ion-label>
                    <h3>{{ record.foodName }}</h3>
                    <p>{{ formatDate(record.consumptionDate) }} · {{ record.consumptionTime }}</p>
                    <p v-if="record.notes" class="record-notes">{{ record.notes }}</p>
                    <p v-if="record.inventoryItemId.startsWith('off:')" class="historical-note">
                      Logged from barcode scan · not linked to inventory
                    </p>
                    <p v-else-if="!inventory.some((item) => item.id === record.inventoryItemId)" class="historical-note">
                      Original inventory item is no longer available
                    </p>
                  </ion-label>
                  <div class="record-detail">
                    <ion-badge :color="mealColor(record.mealCategory)">{{ record.mealCategory }}</ion-badge>
                    <strong>{{ formatQuantity(record.quantityConsumed) }} {{ record.measurementUnit }}</strong>
                  </div>
                  <div class="record-actions">
                    <ion-button fill="clear" size="small" :aria-label="`Edit ${record.foodName} record`" @click="openEdit(record)">
                      <ion-icon slot="icon-only" :icon="createOutline" />
                    </ion-button>
                    <ion-button fill="clear" size="small" color="danger" :aria-label="`Delete ${record.foodName} record`" @click="askDelete(record)">
                      <ion-icon slot="icon-only" :icon="trashOutline" />
                    </ion-button>
                  </div>
                </ion-item>
              </ion-list>
            </ion-card>
            <div v-else-if="!loading" class="empty-history">
              <span aria-hidden="true">🥣</span>
              <h3>{{ records.length ? 'No records match these filters' : 'No food consumption records yet' }}</h3>
              <p>{{ records.length ? 'Try another date or clear the current filters.' : 'Log a meal to start building your food journal.' }}</p>
              <ion-button v-if="!records.length" fill="outline" @click="openCreate">Log your first meal</ion-button>
              <ion-button v-else fill="clear" @click="clearFilters">Clear filters</ion-button>
            </div>
          </section>
        </template>

        <ion-modal :is-open="formOpen" @didDismiss="closeForm">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ editingRecord ? 'Edit consumption' : 'Log food consumption' }}</ion-title>
              <ion-button slot="end" fill="clear" @click="closeForm">Close</ion-button>
            </ion-toolbar>
          </ion-header>
          <ion-content class="form-content">
            <form class="consumption-form" @submit.prevent="saveRecord">
              <p v-if="!inventory.length" class="form-notice">
                Add a food item to your inventory before logging consumption. Logging will not change inventory quantities.
              </p>
              <ion-item v-if="!directScannedProduct">
                <ion-select
                  v-model="draft.inventoryItemId"
                  label="Food from inventory"
                  placeholder="Select food"
                  interface="popover"
                  :disabled="saving"
                  @ionChange="selectInventoryItem"
                >
                  <ion-select-option
                    v-for="item in inventory"
                    :key="item.id"
                    :value="item.id"
                  >
                    {{ item.foodName }} · {{ formatQuantity(item.quantity) }} {{ item.unit }} available
                  </ion-select-option>
                  <ion-select-option
                    v-if="editingRecord && !inventory.some((item) => item.id === editingRecord?.inventoryItemId)"
                    :value="editingRecord.inventoryItemId"
                  >
                    {{ editingRecord.foodName }} · deleted inventory item (historical)
                  </ion-select-option>
                </ion-select>
              </ion-item>
              <ion-card v-else class="selected-food-card">
                <ion-card-content>
                  <strong>{{ draft.foodName }}</strong>
                  <p>{{ directScannedProduct.brand || 'Packaged food' }} · Barcode {{ directScannedProduct.barcode }}</p>
                  <ion-button fill="clear" @click="barcodeModalOpen = true">Scan a different product</ion-button>
                </ion-card-content>
              </ion-card>
              <p v-if="formErrors.inventoryItemId" class="field-error">{{ formErrors.inventoryItemId }}</p>

              <ion-card v-if="selectedItemInfo" class="selected-food-card">
                <ion-card-content>
                  <div class="selected-food-top">
                    <span class="food-mark" aria-hidden="true">{{ categoryIcon(selectedItemInfo.category) }}</span>
                    <div><strong>{{ selectedItemInfo.foodName }}</strong><span>{{ selectedItemInfo.category }}</span></div>
                  </div>
                  <p v-if="selectedInventoryItem">
                    Available quantity: <strong>{{ formatQuantity(selectedInventoryItem.quantity) }} {{ selectedInventoryItem.unit }}</strong>
                  </p>
                  <p v-else>Historical record retained; the original inventory item was deleted.</p>
                </ion-card-content>
              </ion-card>

              <ion-item>
                <ion-select v-model="draft.mealCategory" label="Meal category" interface="popover" :disabled="saving">
                  <ion-select-option v-for="meal in mealCategories" :key="meal" :value="meal">{{ meal }}</ion-select-option>
                </ion-select>
              </ion-item>
              <p v-if="formErrors.mealCategory" class="field-error">{{ formErrors.mealCategory }}</p>

              <div class="quantity-row">
                <ion-item>
                  <ion-input
                    v-model.number="draft.quantityConsumed"
                    type="number"
                    min="0"
                    step="any"
                    inputmode="decimal"
                    label="Quantity consumed"
                    label-placement="stacked"
                    :disabled="saving"
                  />
                </ion-item>
                <ion-item>
                  <ion-select v-model="draft.measurementUnit" label="Unit" interface="popover" :disabled="saving">
                    <ion-select-option v-for="unit in consumptionUnits" :key="unit" :value="unit">{{ unit }}</ion-select-option>
                  </ion-select>
                </ion-item>
              </div>
              <p v-if="formErrors.quantityConsumed" class="field-error">{{ formErrors.quantityConsumed }}</p>
              <p v-if="formErrors.measurementUnit" class="field-error">{{ formErrors.measurementUnit }}</p>
              <p v-if="availableComparison" class="available-comparison">{{ availableComparison }}</p>
              <ion-item
                v-if="draft.nutritionSnapshot?.portions.length"
                class="portion-select"
              >
                <ion-select
                  v-model.number="selectedPortionGramWeight"
                  label="USDA portion (optional)"
                  interface="popover"
                  :disabled="saving"
                >
                  <ion-select-option :value="null">No portion selected</ion-select-option>
                  <ion-select-option
                    v-for="portion in draft.nutritionSnapshot.portions"
                    :key="`${portion.description}-${portion.gramWeight}`"
                    :value="portion.gramWeight"
                  >
                    {{ portion.description }} · {{ formatQuantity(portion.gramWeight) }} g
                  </ion-select-option>
                </ion-select>
              </ion-item>
              <ion-card v-if="draft.nutritionSnapshot" class="nutrition-preview">
                <ion-card-content>
                  <p class="nutrition-caption">
                    Nutrition estimate · {{ draft.nutritionSnapshot.source }}
                    {{ draft.nutritionSnapshot.fdcId === null
                      ? draft.nutritionSnapshot.sourceProductId
                      : `FDC ${draft.nutritionSnapshot.fdcId}` }}
                  </p>
                  <p v-if="nutritionGrams === null && nutritionMilliliters === null" class="nutrition-basis-warning">
                    Enter a matching mass or volume unit, or select a USDA portion with a gram weight, to calculate this preview.
                  </p>
                  <p v-else class="nutrition-caption">
                    Calculated for {{ nutritionAmountLabel }}. Values are estimates from the selected source.
                  </p>
                  <div class="nutrition-preview-grid">
                    <div v-for="nutrient in previewNutrients" :key="nutrient.id">
                      <span>{{ nutrient.label }}</span>
                      <strong>{{ previewNutrientValue(nutrient.id) }}</strong>
                    </div>
                  </div>
                  <p v-if="draft.nutritionSnapshot.basisGrams === null && draft.nutritionSnapshot.basisMilliliters == null" class="nutrition-basis-warning">
                    No matching mass or volume basis is available for this entry; values are not scaled.
                  </p>
                </ion-card-content>
              </ion-card>

              <div class="date-time-row">
                <ion-item>
                  <ion-input
                    v-model="draft.consumptionDate"
                    type="date"
                    label="Consumption date"
                    label-placement="stacked"
                    :disabled="saving"
                  />
                </ion-item>
                <ion-item>
                  <ion-input
                    v-model="draft.consumptionTime"
                    type="time"
                    label="Consumption time"
                    label-placement="stacked"
                    :disabled="saving"
                  />
                </ion-item>
              </div>
              <p v-if="formErrors.consumptionDate" class="field-error">{{ formErrors.consumptionDate }}</p>
              <p v-if="formErrors.consumptionTime" class="field-error">{{ formErrors.consumptionTime }}</p>

              <ion-item>
                <ion-textarea
                  v-model="draft.notes"
                  label="Notes (optional)"
                  label-placement="stacked"
                  :rows="3"
                  :disabled="saving"
                />
              </ion-item>
              <ion-card v-if="formError" class="error-card">
                <ion-card-content role="alert">{{ formError }}</ion-card-content>
              </ion-card>
              <ion-button class="save-button" expand="block" type="submit" :disabled="saving || (!inventory.length && !editingRecord && !directScannedProduct)">
                <ion-spinner v-if="saving" name="crescent" />
                <span>{{ saving ? 'Saving…' : editingRecord ? 'Save changes' : 'Save consumption' }}</span>
              </ion-button>
              <p v-if="directScannedProduct && !selectedInventoryItem" class="available-comparison">
                This scanned product is not linked to inventory, so no stock will be deducted.
              </p>
            </form>
          </ion-content>
        </ion-modal>

        <BarcodeProductModal
          :is-open="barcodeModalOpen"
          @close="barcodeModalOpen = false"
          @action="handleBarcodeAction"
        />

        <ion-alert
          :is-open="deleteAlertOpen"
          header="Delete consumption record?"
          :message="deleteTarget ? `Remove the ${deleteTarget.foodName} entry from your history?` : ''"
          :buttons="deleteAlertButtons"
          @didDismiss="deleteAlertOpen = false"
        />
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
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { AuthenticatedUser as User } from '../services/authService';
import { useRoute, useRouter } from 'vue-router';
import { App as CapacitorApp } from '@capacitor/app';
import AppNavigation from '../components/AppNavigation.vue';
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonProgressBar,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/vue';
import {
  addOutline,
  barcodeOutline,
  cafeOutline,
  createOutline,
  fastFoodOutline,
  leafOutline,
  restaurantOutline,
  trashOutline,
} from 'ionicons/icons';
import { observeAuth } from '../services/authService';
import { listFoodItems } from '../services/foodInventoryService';
import {
  createFoodConsumption,
  deleteFoodConsumption,
  listFoodConsumptions,
  updateFoodConsumption,
} from '../services/foodConsumptionService';
import {
  consumptionUnits,
  countMealsForDate,
  convertCompatibleQuantity,
  filterConsumptions,
  getLocalDate,
  getLocalTime,
  mealCategories,
  validateFoodConsumptionDraft,
  type FoodConsumption,
  type FoodConsumptionDraft,
  type FoodConsumptionErrors,
  type MealCategory,
} from '../utils/foodConsumption';
import { getStockStatus, type FoodItem, type FoodCategory } from '../utils/foodInventory';
import { scaleNutritionForGrams, scaleNutritionForMilliliters } from '../utils/usdaNutrition';
import { quantityInInventoryUnit } from '../utils/inventoryDeduction';
import BarcodeProductModal from '../components/BarcodeProductModal.vue';
import type { ScannedFoodProduct } from '../services/openFoodFactsService';

const user = ref<User | null>(null);
const barcodeModalOpen = ref(false);
const directScannedProduct = ref<ScannedFoodProduct | null>(null);
const route = useRoute();
const router = useRouter();
const inventory = ref<FoodItem[]>([]);
const records = ref<FoodConsumption[]>([]);
const loading = ref(true);
const saving = ref(false);
const formOpen = ref(false);
const editingRecord = ref<FoodConsumption | null>(null);
const deleteTarget = ref<FoodConsumption | null>(null);
const deleteAlertOpen = ref(false);
const formError = ref('');
const formErrors = ref<FoodConsumptionErrors>({});
const errorMessage = ref('');
const today = getLocalDate();
const summaryDate = ref(today);
const historyDate = ref('');
const search = ref('');
const mealFilter = ref<MealCategory | 'all'>('all');
const toastOpen = ref(false);
const toastMessage = ref('');
const toastColor = ref<'success' | 'danger'>('success');
const selectedPortionGramWeight = ref<number | null>(null);
let unsubscribeAuth: (() => void) | undefined;
let foregroundListener: { remove: () => Promise<void> } | undefined;
let loadSequence = 0;
let saveInProgress = false;

const draft = ref<FoodConsumptionDraft>(emptyDraft());
const selectedInventoryItem = computed(() => inventory.value.find((item) => item.id === draft.value.inventoryItemId) ?? null);
const selectedItemInfo = computed(() => {
  if (directScannedProduct.value) {
    return {
      foodName: directScannedProduct.value.name,
      category: directScannedProduct.value.category,
    };
  }
  if (selectedInventoryItem.value) {
    return {
      foodName: selectedInventoryItem.value.foodName,
      category: selectedInventoryItem.value.category,
    };
  }
  if (editingRecord.value?.inventoryItemId === draft.value.inventoryItemId) {
    return {
      foodName: editingRecord.value.foodName,
      category: editingRecord.value.foodCategory,
    };
  }
  return null;
});
const selectedDayRecords = computed(() => records.value.filter((record) => record.consumptionDate === summaryDate.value));
const dailyCounts = computed(() => countMealsForDate(records.value, summaryDate.value));
const dailyHeading = computed(() => summaryDate.value === today ? "Today's food consumption" : `Food consumption · ${formatDate(summaryDate.value)}`);
const mealSummary = computed(() => [
  { name: 'Breakfast', count: dailyCounts.value.Breakfast, icon: cafeOutline, className: 'breakfast-icon' },
  { name: 'Lunch', count: dailyCounts.value.Lunch, icon: restaurantOutline, className: 'lunch-icon' },
  { name: 'Dinner', count: dailyCounts.value.Dinner, icon: fastFoodOutline, className: 'dinner-icon' },
  { name: 'Snacks', count: dailyCounts.value.Snacks, icon: leafOutline, className: 'snack-icon' },
]);
const mealCards = computed(() => mealSummary.value.map((meal) => ({
  ...meal,
  records: selectedDayRecords.value.filter((record) => record.mealCategory === meal.name),
})));
const filteredRecords = computed(() => filterConsumptions(records.value, {
  search: search.value,
  date: historyDate.value,
  mealCategory: mealFilter.value,
}));
const availableComparison = computed(() => {
  const item = selectedInventoryItem.value;
  if (!item) return '';
  try {
    const consumed = quantityInInventoryUnit(draft.value.quantityConsumed, draft.value.measurementUnit, item.unit);
    const oldDeduction = editingRecord.value?.inventoryDeduction;
    const restore = oldDeduction?.inventoryItemId === item.id
      ? convertCompatibleQuantity(oldDeduction.quantity, oldDeduction.unit, item.unit) ?? 0
      : 0;
    const available = item.quantity + restore;
    const remaining = available - consumed;
    if (remaining < 0) {
      return `Insufficient inventory. Only ${formatQuantity(available)} ${item.unit} is available.`;
    }
    const status = getStockStatus(remaining, item.lowStockThreshold);
    const statusLabel = status === 'out' ? 'Out of stock' : status === 'low' ? 'Low stock' : 'In stock';
    return `Available: ${formatQuantity(available)} ${item.unit} · Estimated remaining: ${formatQuantity(remaining)} ${item.unit} (${statusLabel})`;
  } catch {
    return `Inventory uses ${item.unit}; choose a compatible consumption unit.`;
  }
});
const nutritionGrams = computed(() => {
  if (draft.value.measurementUnit === 'g' || draft.value.measurementUnit === 'kg') {
    const grams = convertCompatibleQuantity(draft.value.quantityConsumed, draft.value.measurementUnit, 'g');
    return grams !== null && grams > 0 ? grams : null;
  }
  if (selectedPortionGramWeight.value && draft.value.quantityConsumed > 0) {
    return draft.value.quantityConsumed * selectedPortionGramWeight.value;
  }
  return null;
});
const nutritionMilliliters = computed(() => {
  if (draft.value.measurementUnit === 'mL' || draft.value.measurementUnit === 'L') {
    const milliliters = convertCompatibleQuantity(draft.value.quantityConsumed, draft.value.measurementUnit, 'mL');
    return milliliters !== null && milliliters > 0 ? milliliters : null;
  }
  return null;
});
const nutritionAmountLabel = computed(() => {
  if (nutritionGrams.value !== null) return `${formatQuantity(nutritionGrams.value)} g`;
  if (nutritionMilliliters.value !== null) return `${formatQuantity(nutritionMilliliters.value)} mL`;
  return '';
});
const scaledNutrition = computed(() => {
  const profile = draft.value.nutritionSnapshot;
  if (!profile) return null;
  if (nutritionGrams.value !== null) return scaleNutritionForGrams(profile, nutritionGrams.value);
  if (nutritionMilliliters.value !== null) return scaleNutritionForMilliliters(profile, nutritionMilliliters.value);
  return null;
});
const previewNutrients = [
  { id: '208', label: 'Energy (kcal)' },
  { id: '203', label: 'Protein' },
  { id: '205', label: 'Carbohydrates' },
  { id: '204', label: 'Total fat' },
  { id: '291', label: 'Dietary fiber' },
  { id: '301', label: 'Calcium' },
  { id: '303', label: 'Iron' },
  { id: '306', label: 'Potassium' },
  { id: '307', label: 'Sodium' },
  { id: '320', label: 'Vitamin A' },
  { id: '401', label: 'Vitamin C' },
  { id: '324', label: 'Vitamin D' },
];
const deleteAlertButtons = [
  { text: 'Cancel', role: 'cancel' },
  { text: 'Delete', role: 'destructive', handler: () => { void confirmDelete(); } },
];

onMounted(() => {
  unsubscribeAuth = observeAuth((authenticatedUser) => {
    user.value = authenticatedUser;
    errorMessage.value = '';
    if (authenticatedUser) void loadData(authenticatedUser.uid);
    else {
      inventory.value = [];
      records.value = [];
      loading.value = false;
    }
  }, (error) => {
    loading.value = false;
    errorMessage.value = error.message;
  });

  window.addEventListener('food-inventory-updated', handleInventoryUpdated);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive && user.value) void loadData(user.value.uid);
  }).then((listener) => {
    foregroundListener = listener;
  }).catch((error: unknown) => {
    errorMessage.value = `Unable to monitor app foreground state: ${error instanceof Error ? error.message : String(error)}`;
  });
});

onUnmounted(() => {
  unsubscribeAuth?.();
  window.removeEventListener('food-inventory-updated', handleInventoryUpdated);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  void foregroundListener?.remove();
});

async function loadData(userId: string): Promise<void> {
  const sequence = ++loadSequence;
  loading.value = true;
  try {
    const [inventoryResult, recordsResult] = await Promise.allSettled([
      listFoodItems(userId),
      listFoodConsumptions(userId),
    ]);
    if (user.value?.uid !== userId || sequence !== loadSequence) return;
    const errors: string[] = [];
    if (inventoryResult.status === 'fulfilled') inventory.value = inventoryResult.value;
    else errors.push(inventoryResult.reason instanceof Error ? inventoryResult.reason.message : String(inventoryResult.reason));
    if (recordsResult.status === 'fulfilled') records.value = recordsResult.value;
    else errors.push(recordsResult.reason instanceof Error ? recordsResult.reason.message : String(recordsResult.reason));
    errorMessage.value = errors.join(' ');

    openPendingScannedProduct(userId);
    const requestedItemId = route.query.inventoryItemId;
    if (inventoryResult.status === 'fulfilled'
      && typeof requestedItemId === 'string'
      && inventory.value.some((item) => item.id === requestedItemId)) {
      openCreate(requestedItemId);
      void router.replace({
        path: route.path,
        query: { ...route.query, inventoryItemId: undefined },
      });
    }
  } catch (error) {
    if (sequence === loadSequence) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (sequence === loadSequence) {
      loading.value = false;
    }
  }
}

function handleInventoryUpdated(event: Event): void {
  const detail = (event as CustomEvent<{ userId?: string }>).detail;
  if (detail?.userId && detail.userId === user.value?.uid) void loadData(detail.userId);
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible' && user.value) void loadData(user.value.uid);
}

function emptyDraft(): FoodConsumptionDraft {
  const now = new Date();
  return {
    inventoryItemId: '',
    foodName: '',
    foodCategory: 'Others',
    inventoryUnit: 'pcs',
    mealCategory: 'Breakfast',
    quantityConsumed: 1,
    measurementUnit: 'pcs',
    consumptionDate: getLocalDate(now),
    consumptionTime: getLocalTime(now),
    notes: '',
    nutritionSnapshot: null,
  };
}

function openCreate(inventoryItemId?: string): void {
  editingRecord.value = null;
  directScannedProduct.value = null;
  draft.value = emptyDraft();
  const initialItem = inventory.value.find((item) => item.id === inventoryItemId) ?? inventory.value[0];
  draft.value.inventoryItemId = initialItem?.id ?? '';
  if (initialItem) {
    draft.value.foodName = initialItem.foodName;
    draft.value.foodCategory = initialItem.category;
    draft.value.inventoryUnit = initialItem.unit;
    draft.value.measurementUnit = initialItem.unit;
    draft.value.nutritionSnapshot = initialItem.nutritionProfile ?? null;
  }
  selectedPortionGramWeight.value = null;
  formErrors.value = {};
  formError.value = '';
  formOpen.value = true;
}

function openEdit(record: FoodConsumption): void {
  editingRecord.value = record;
  directScannedProduct.value = record.inventoryItemId.startsWith('off:')
    ? {
      barcode: record.nutritionSnapshot?.sourceProductId ?? record.inventoryItemId.slice(3),
      name: record.foodName,
      brand: '',
      imageUrl: '',
      packageDescription: '',
      servingSize: '',
      categories: '',
      ingredients: '',
      category: record.foodCategory,
      packageAmount: null,
      packageUnit: null,
      nutritionProfile: record.nutritionSnapshot ?? null,
    }
    : null;
  draft.value = {
    inventoryItemId: record.inventoryItemId,
    foodName: record.foodName,
    foodCategory: record.foodCategory,
    inventoryUnit: record.inventoryUnit,
    mealCategory: record.mealCategory,
    quantityConsumed: record.quantityConsumed,
    measurementUnit: record.measurementUnit,
    consumptionDate: record.consumptionDate,
    consumptionTime: record.consumptionTime,
    notes: record.notes,
    nutritionSnapshot: record.nutritionSnapshot ?? null,
  };
  selectedPortionGramWeight.value = null;
  formErrors.value = {};
  formError.value = '';
  formOpen.value = true;
}

function selectInventoryItem(event: CustomEvent<{ value?: string }>): void {
  const item = inventory.value.find((entry) => entry.id === event.detail.value);
  if (!item) return;
  draft.value.foodName = item.foodName;
  draft.value.foodCategory = item.category;
  draft.value.inventoryUnit = item.unit;
  draft.value.measurementUnit = item.unit;
  draft.value.nutritionSnapshot = item.nutritionProfile ?? null;
  selectedPortionGramWeight.value = null;
  formErrors.value = {};
}

function closeForm(): void {
  formOpen.value = false;
  if (!editingRecord.value) directScannedProduct.value = null;
  formError.value = '';
  formErrors.value = {};
}

async function saveRecord(): Promise<void> {
  if (saveInProgress || saving.value) return;
  if (!user.value) {
    formError.value = 'Sign in again before saving consumption records.';
    return;
  }

  if (selectedInventoryItem.value) {
    draft.value.foodName = selectedInventoryItem.value.foodName;
    draft.value.foodCategory = selectedInventoryItem.value.category;
    draft.value.inventoryUnit = selectedInventoryItem.value.unit;
    if (!editingRecord.value || editingRecord.value.inventoryItemId !== selectedInventoryItem.value.id) {
      draft.value.nutritionSnapshot = selectedInventoryItem.value.nutritionProfile ?? null;
    }
  } else if (directScannedProduct.value && draft.value.inventoryItemId.startsWith('off:')) {
    draft.value.foodName = directScannedProduct.value.name;
    draft.value.foodCategory = directScannedProduct.value.category;
    draft.value.inventoryUnit = directScannedProduct.value.packageUnit ?? 'pcs';
    draft.value.nutritionSnapshot = directScannedProduct.value.nutritionProfile;
  } else if (editingRecord.value?.inventoryItemId !== draft.value.inventoryItemId) {
    formErrors.value = { inventoryItemId: 'The selected inventory item is no longer available.' };
    return;
  }

  formErrors.value = validateFoodConsumptionDraft(draft.value);
  if (Object.keys(formErrors.value).length) return;

  saveInProgress = true;
  saving.value = true;
  formError.value = '';
  try {
    const userId = user.value.uid;
    if (editingRecord.value) {
      await updateFoodConsumption(userId, editingRecord.value.id, draft.value);
      records.value = records.value.map((record) => record.id === editingRecord.value?.id
        ? { ...record, ...draft.value, updatedAt: new Date().toISOString() }
        : record);
      showToast('Consumption record updated. Inventory adjusted.', 'success');
    } else {
      const createdAt = new Date().toISOString();
      const createdId = await createFoodConsumption(userId, draft.value);
      records.value.unshift({
        ...draft.value,
        id: createdId,
        createdAt,
        updatedAt: createdAt,
      });
      showToast(draft.value.inventoryItemId.startsWith('off:')
        ? 'Food logged successfully.'
        : 'Food logged successfully. Inventory updated.', 'success');
    }

    closeForm();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
  } finally {
    saving.value = false;
    saveInProgress = false;
  }
}

function handleBarcodeAction(payload: {
  action: 'add-inventory' | 'log-consumption' | 'manual-inventory' | 'search-name';
  product?: ScannedFoodProduct;
  barcode?: string;
}): void {
  barcodeModalOpen.value = false;
  if (payload.action === 'search-name') {
    void router.push({ path: '/nutrition', query: { search: '' } });
    return;
  }
  if (payload.action === 'manual-inventory') {
    if (!user.value) return;
    sessionStorage.setItem(`pending-manual-barcode:${user.value.uid}`, payload.barcode ?? '');
    void router.push('/inventory');
    return;
  }
  const product = payload.product;
  if (!product || !user.value) return;
  if (payload.action === 'add-inventory') {
    sessionStorage.setItem(`pending-scanned-product:${user.value.uid}`, JSON.stringify(product));
    void router.push('/inventory');
    return;
  }
  const matchingItem = inventory.value.find((item) => item.barcode === product.barcode);
  if (matchingItem) {
    openCreate(matchingItem.id);
    return;
  }
  editingRecord.value = null;
  directScannedProduct.value = product;
  draft.value = emptyDraft();
  draft.value.inventoryItemId = `off:${product.barcode}`;
  draft.value.foodName = product.name;
  draft.value.foodCategory = product.category;
  draft.value.inventoryUnit = product.packageUnit ?? 'pcs';
  draft.value.measurementUnit = product.packageUnit ?? 'pcs';
  draft.value.quantityConsumed = 1;
  draft.value.nutritionSnapshot = product.nutritionProfile;
  formErrors.value = {};
  formError.value = '';
  selectedPortionGramWeight.value = null;
  formOpen.value = true;
}

function openPendingScannedProduct(userId: string): void {
  const key = `pending-scanned-product:${userId}`;
  const serialized = sessionStorage.getItem(key);
  if (!serialized) return;
  sessionStorage.removeItem(key);
  try {
    const product = JSON.parse(serialized) as ScannedFoodProduct;
    if (typeof product.barcode !== 'string' || typeof product.name !== 'string') {
      throw new Error('The scanned product information is incomplete.');
    }
    handleBarcodeAction({ action: 'log-consumption', product });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  }
}

function previewNutrientValue(id: string): string {
  const profile = draft.value.nutritionSnapshot;
  const current = scaledNutrition.value?.[id] ?? (id === '320' ? scaledNutrition.value?.['318'] : undefined);
  if (current) return `${formatQuantity(current.amount)} ${current.unit}`;
  const source = profile?.nutrients[id] ?? (id === '320' ? profile?.nutrients['318'] : undefined);
  if (!source) return 'Not Available';
  if (nutritionGrams.value === null || profile?.basisGrams === null) return 'Not calculated';
  return 'Not Available';
}

function askDelete(record: FoodConsumption): void {
  deleteTarget.value = record;
  deleteAlertOpen.value = true;
}

async function confirmDelete(): Promise<void> {
  const record = deleteTarget.value;
  const authenticatedUser = user.value;
  deleteAlertOpen.value = false;
  if (!record || !authenticatedUser) return;
  try {
    await deleteFoodConsumption(authenticatedUser.uid, record.id);
    records.value = records.value.filter((entry) => entry.id !== record.id);
    showToast('Consumption record deleted.', 'success');
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    deleteTarget.value = null;
  }
}

function clearFilters(): void {
  search.value = '';
  historyDate.value = '';
  mealFilter.value = 'all';
}

function showToast(message: string, color: 'success' | 'danger'): void {
  toastMessage.value = message;
  toastColor.value = color;
  toastOpen.value = true;
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function categoryIcon(category: FoodCategory): string {
  const icons: Record<FoodCategory, string> = {
    Fruits: '🍎',
    Vegetables: '🥬',
    Meat: '🥩',
    Seafood: '🐟',
    Dairy: '🥛',
    Grains: '🌾',
    Beverages: '🥤',
    Snacks: '🍪',
    'Canned Goods': '🥫',
    Others: '🍽️',
  };
  return icons[category];
}

function mealColor(meal: MealCategory): 'primary' | 'success' | 'tertiary' | 'warning' {
  if (meal === 'Breakfast') return 'warning';
  if (meal === 'Lunch') return 'success';
  if (meal === 'Dinner') return 'primary';
  return 'tertiary';
}
</script>

<style scoped>
.consumption-page {
  width: min(1160px, 100%);
  margin: 0 auto;
  padding: 28px 24px 60px;
}

.consumption-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 28px;
  padding: 28px 32px;
  border-radius: 22px;
  background:
    linear-gradient(90deg, rgb(20 62 47 / 96%) 0%, rgb(25 91 56 / 90%) 58%, rgb(25 91 56 / 34%) 100%),
    url('/images/food-banner.svg') center / cover no-repeat;
  box-shadow: 0 14px 32px rgb(25 80 61 / 13%);
  color: #fff;
}

.eyebrow {
  margin: 0;
  color: #398670;
  font-size: 0.7rem;
  font-weight: 750;
  letter-spacing: 0.11em;
}

.consumption-hero .eyebrow { color: #bcebd0; }
.consumption-hero h1 { margin: 7px 0; font-size: clamp(1.9rem, 4vw, 2.45rem); letter-spacing: -0.04em; }
.consumption-hero p:last-child { margin: 0; color: rgb(255 255 255 / 82%); line-height: 1.5; }

.add-button {
  flex-shrink: 0;
  --background: #fff;
  --color: #20644d;
  --border-radius: 11px;
  font-weight: 700;
  text-transform: none;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin: 28px 0 14px;
}

.section-heading h2 { margin: 5px 0 0; color: #20352d; font-size: 1.35rem; letter-spacing: -0.025em; }
.date-picker { width: min(210px, 48%); --background: #fff; --border-radius: 12px; }

.summary-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card, .meal-card, .history-card {
  margin: 0;
  border: 1px solid #e7eee9;
  border-radius: 15px;
  box-shadow: 0 5px 16px rgb(28 65 48 / 4%);
}

.summary-card ion-card-content { display: flex; align-items: center; gap: 11px; padding: 15px; }
.summary-icon, .meal-icon, .food-mark {
  display: grid;
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 12px;
  background: #eaf4ed;
  color: #2c7a5e;
  font-size: 1.15rem;
}
.summary-card p { margin: 0 0 4px; color: #77857c; font-size: 0.72rem; }
.summary-card strong { color: #1f4638; font-size: 1.28rem; }
.breakfast-icon { background: #fff4df; color: #ad7619; }
.lunch-icon { background: #e7f5ec; color: #31805e; }
.dinner-icon { background: #edf0ff; color: #626cb1; }
.snack-icon { background: #f4eafa; color: #8555a0; }

.meal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.meal-card ion-card-content { padding: 16px; }
.meal-title { display: flex; align-items: center; gap: 11px; }
.meal-title h3 { margin: 0 0 3px; color: #243b31; font-size: 1rem; }
.meal-title span:not(.meal-icon) { color: #859188; font-size: 0.75rem; }
.meal-card ion-list { margin-top: 10px; }
.meal-card ion-item { --min-height: 49px; --padding-start: 0; --inner-padding-end: 0; }
.meal-card ion-label h4 { margin: 0; color: #31483d; font-size: 0.89rem; font-weight: 650; }
.meal-card ion-label p { margin: 3px 0 0; color: #7a8980; font-size: 0.75rem; }
.meal-empty { margin: 16px 0 2px; color: #87938c; font-size: 0.8rem; }

.history-section { margin-top: 34px; }
.history-heading { margin-bottom: 14px; }
.record-count { color: #748279; font-size: 0.78rem; }
.filter-panel {
  display: grid;
  grid-template-columns: minmax(220px, 1.4fr) minmax(150px, 0.7fr) minmax(150px, 0.7fr) auto;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px;
  border: 1px solid #e7eee9;
  border-radius: 15px;
  background: #fff;
}
.filter-panel ion-searchbar { --background: #f4f7f5; --border-radius: 10px; --box-shadow: none; padding: 0; }
.filter-item { --background: #f7f9f7; --border-radius: 10px; --min-height: 48px; }
.clear-button { --color: #34775d; font-size: 0.8rem; text-transform: none; }
.history-card ion-item { --padding-start: 15px; --inner-padding-end: 12px; --min-height: 86px; }
.food-mark { width: 42px; height: 42px; margin-right: 8px; font-size: 1.2rem; }
.history-item ion-label { min-width: 0; }
.history-item ion-label h3 { margin: 0 0 4px; color: #273d33; font-size: 0.93rem; font-weight: 700; }
.history-item ion-label p { margin: 2px 0; color: #7c8981; font-size: 0.76rem; }
.history-item ion-label .historical-note { color: #a56c22; }
.history-item ion-label .record-notes { overflow: hidden; max-width: 400px; text-overflow: ellipsis; white-space: nowrap; }
.record-detail { display: grid; justify-items: end; gap: 6px; min-width: 90px; }
.record-detail ion-badge { font-size: 0.65rem; }
.record-detail strong { color: #365144; font-size: 0.82rem; white-space: nowrap; }
.record-actions { display: flex; margin-left: 8px; }
.record-actions ion-button { --padding-start: 5px; --padding-end: 5px; }
.empty-history, .auth-prompt {
  padding: 36px 18px;
  border: 1px dashed #d9e5dc;
  border-radius: 16px;
  background: #fff;
  text-align: center;
}
.empty-history > span, .auth-prompt > div { font-size: 2.2rem; }
.empty-history h3, .auth-prompt h2 { margin: 10px 0 6px; color: #294638; }
.empty-history p, .auth-prompt p { color: #7b8980; font-size: 0.87rem; }
.empty-history ion-button, .auth-prompt ion-button { --border-radius: 10px; text-transform: none; }
.error-card { border: 1px solid #f1d3cd; border-radius: 12px; box-shadow: none; color: #943e33; }
.form-content { --background: #f6f8f6; }
.consumption-form { width: min(640px, 100%); margin: 0 auto; padding: 18px 18px 30px; }
.consumption-form > ion-item { --background: #fff; --border-radius: 11px; margin-top: 10px; }
.field-error { margin: 5px 4px 0; color: #bd463d; font-size: 0.76rem; }
.form-notice { color: #728078; font-size: 0.82rem; line-height: 1.5; }
.selected-food-card { margin: 12px 0; border: 1px solid #e3ece5; border-radius: 13px; box-shadow: none; }
.selected-food-card ion-card-content { padding: 13px; }
.selected-food-top { display: flex; align-items: center; gap: 10px; }
.selected-food-top > div { display: grid; gap: 3px; }
.selected-food-top strong { color: #284638; }
.selected-food-top span:not(.food-mark) { color: #7c8981; font-size: 0.77rem; }
.selected-food-card p { margin: 10px 0 0; color: #68786e; font-size: 0.8rem; }
.quantity-row, .date-time-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
.quantity-row ion-item, .date-time-row ion-item { --background: #fff; --border-radius: 11px; }
.available-comparison { margin: 6px 4px 0; color: #718078; font-size: 0.75rem; }
.save-button { margin-top: 20px; --border-radius: 11px; text-transform: none; }

@media (max-width: 850px) {
  .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .filter-panel { grid-template-columns: 1fr 1fr; }
  .filter-panel ion-searchbar { grid-column: 1 / -1; }
}

@media (max-width: 600px) {
  .consumption-page { padding: 18px 14px 42px; }
  .consumption-hero { align-items: flex-start; flex-direction: column; padding: 22px; }
  .add-button { width: 100%; margin: 0; }
  .section-heading { align-items: flex-start; flex-direction: column; }
  .date-picker { width: 100%; }
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
  .summary-card ion-card-content { padding: 12px; }
  .summary-icon { width: 34px; height: 34px; }
  .meal-grid { grid-template-columns: 1fr; gap: 10px; }
  .filter-panel { grid-template-columns: 1fr; }
  .filter-panel ion-searchbar { grid-column: auto; }
  .clear-button { justify-self: start; }
  .history-card ion-item { --padding-start: 9px; --inner-padding-end: 7px; }
  .food-mark { width: 34px; height: 34px; margin-right: 4px; }
  .record-detail { min-width: 70px; }
  .record-actions { margin-left: 3px; }
}
</style>
