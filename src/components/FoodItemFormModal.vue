<template>
  <ion-modal :is-open="isOpen" @didDismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ item ? 'Edit food item' : 'Add food item' }}</ion-title>
        <ion-button slot="end" fill="clear" :disabled="saving" @click="emit('close')">Cancel</ion-button>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <form class="food-form" @submit.prevent="submit">
        <ion-item>
          <ion-input
            v-model="draft.foodName"
            label="Food name *"
            label-placement="stacked"
            placeholder="e.g. Brown rice"
            :maxlength="100"
            :class="{ 'ion-invalid': errors.foodName }"
            @ionInput="clearError('foodName')"
          />
        </ion-item>
        <ion-item v-if="draft.brand">
          <ion-input v-model="draft.brand" label="Brand" label-placement="stacked" :maxlength="120" />
        </ion-item>
        <ion-item v-if="draft.barcode">
          <ion-input v-model="draft.barcode" label="Barcode" label-placement="stacked" readonly />
        </ion-item>
        <ion-note v-if="errors.foodName" color="danger">{{ errors.foodName }}</ion-note>

        <ion-item>
          <ion-select
            :value="draft.category"
            label="Category *"
            interface="popover"
            @ionChange="changeCategory"
          >
            <ion-select-option v-for="category in foodCategories" :key="category" :value="category">
              {{ category }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-note v-if="errors.category" color="danger">{{ errors.category }}</ion-note>

        <div class="form-row">
          <div>
            <ion-item>
              <ion-input
                :value="Number.isFinite(draft.quantity) ? draft.quantity : undefined"
                type="number"
                inputmode="decimal"
                min="0"
                step="any"
                label="Quantity *"
                label-placement="stacked"
                placeholder="0"
                :class="{ 'ion-invalid': errors.quantity }"
                @ionInput="updateNumericField('quantity', $event)"
              />
            </ion-item>
            <ion-note v-if="errors.quantity" color="danger">{{ errors.quantity }}</ion-note>
          </div>
          <ion-item>
            <ion-select
              :value="draft.unit"
              label="Unit *"
              interface="popover"
              @ionChange="changeUnit"
            >
              <ion-select-option v-for="unit in measurementUnits" :key="unit" :value="unit">
                {{ unitLabel(unit) }}
              </ion-select-option>
            </ion-select>
          </ion-item>
        </div>

        <ion-item>
          <ion-input
            :value="Number.isFinite(draft.lowStockThreshold) ? draft.lowStockThreshold : undefined"
            type="number"
            inputmode="decimal"
            min="0"
            step="any"
            label="Low-stock threshold *"
            label-placement="stacked"
            @ionInput="updateNumericField('lowStockThreshold', $event)"
          />
        </ion-item>
        <ion-note v-if="errors.lowStockThreshold" color="danger">{{ errors.lowStockThreshold }}</ion-note>
        <ion-note class="field-help">Uses the selected unit ({{ draft.unit }}). Stock status updates automatically.</ion-note>

        <div class="form-row">
          <ion-item>
            <ion-input v-model="draft.purchaseDate" type="date" label="Purchase date" label-placement="stacked" />
          </ion-item>
          <ion-item>
            <ion-input v-model="draft.expirationDate" type="date" label="Expiration date" label-placement="stacked" />
          </ion-item>
        </div>
        <ion-note v-if="errors.purchaseDate" color="danger">{{ errors.purchaseDate }}</ion-note>
        <ion-note v-if="errors.expirationDate" color="danger">{{ errors.expirationDate }}</ion-note>

        <ion-item>
          <ion-input
            v-model="draft.storageLocation"
            label="Storage location"
            label-placement="stacked"
            placeholder="e.g. Pantry, fridge shelf"
            :maxlength="100"
          />
        </ion-item>
        <ion-item>
          <ion-textarea
            v-model="draft.notes"
            label="Notes"
            label-placement="stacked"
            placeholder="Optional details"
            auto-grow
            :maxlength="500"
          />
        </ion-item>

        <details class="nutrition-section">
          <summary>Link USDA nutrition (optional)</summary>
          <p class="nutrition-help">Adds nutrition without changing inventory details.</p>
          <ion-card v-if="draft.nutritionProfile" class="linked-nutrition">
            <ion-card-content>
              <strong>{{ draft.nutritionProfile.description }}</strong>
              <span>
                {{ draft.nutritionProfile.fdcId === null
                  ? `${draft.nutritionProfile.source} · ${draft.nutritionProfile.sourceProductId ?? ''}`
                  : `FDC ID: ${draft.nutritionProfile.fdcId} · ${draft.nutritionProfile.dataType}` }}
              </span>
              <ion-button fill="clear" size="small" color="danger" @click="draft.nutritionProfile = null">
                Remove nutrition link
              </ion-button>
            </ion-card-content>
          </ion-card>
          <NutritionSearchPanel
            :initial-profile="draft.nutritionProfile"
            @selected="draft.nutritionProfile = $event"
          />
        </details>

        <ion-button class="submit-button" type="submit" expand="block" :disabled="saving">
          {{ saving ? 'Saving…' : item ? 'Save changes' : 'Add food item' }}
        </ion-button>
      </form>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import NutritionSearchPanel from './NutritionSearchPanel.vue';
import {
  convertThreshold,
  emptyFoodItemDraft,
  foodCategories,
  measurementUnits,
  validateFoodItemDraft,
  type FoodCategory,
  type FoodItem,
  type FoodItemDraft,
  type FoodItemFormErrors,
  type MeasurementUnit,
} from '../utils/foodInventory';

const props = defineProps<{
  isOpen: boolean;
  item: FoodItem | null;
  initialDraft?: FoodItemDraft | null;
  saving: boolean;
}>();

const emit = defineEmits<{
  close: [];
  submit: [draft: FoodItemDraft];
}>();

const draft = reactive<FoodItemDraft>(emptyFoodItemDraft());
const errors = reactive<FoodItemFormErrors>({});

watch(
  () => [props.isOpen, props.item, props.initialDraft] as const,
  ([isOpen, item, initialDraft]) => {
    if (!isOpen) return;
    Object.assign(draft, item ? {
      foodName: item.foodName,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      lowStockThreshold: item.lowStockThreshold,
      purchaseDate: item.purchaseDate,
      expirationDate: item.expirationDate,
      storageLocation: item.storageLocation,
      notes: item.notes,
      nutritionProfile: item.nutritionProfile ?? null,
      barcode: item.barcode ?? '',
      brand: item.brand ?? '',
      productImageUrl: item.productImageUrl ?? '',
    } : initialDraft ?? emptyFoodItemDraft());
    clearErrors();
  },
  { immediate: true },
);

function changeCategory(event: CustomEvent<{ value: FoodCategory }>): void {
  draft.category = event.detail.value;
  delete errors.category;
}

function changeUnit(event: CustomEvent<{ value: MeasurementUnit }>): void {
  const nextUnit = event.detail.value;
  draft.lowStockThreshold = convertThreshold(draft.lowStockThreshold, draft.unit, nextUnit);
  draft.unit = nextUnit;
  delete errors.unit;
}

function unitLabel(unit: MeasurementUnit): string {
  const labels: Record<MeasurementUnit, string> = {
    g: 'Grams (g)',
    kg: 'Kilograms (kg)',
    mL: 'Milliliters (mL)',
    L: 'Liters (L)',
    pcs: 'Pieces (pcs)',
    packs: 'Packs',
  };
  return labels[unit];
}

function clearError(field: keyof FoodItemFormErrors): void {
  delete errors[field];
}

function updateNumericField(
  field: 'quantity' | 'lowStockThreshold',
  event: CustomEvent<{ value?: string | null }>,
): void {
  const value = event.detail.value;
  draft[field] = value == null || value.trim() === '' ? Number.NaN : Number(value);
  clearError(field);
}

function clearErrors(): void {
  Object.keys(errors).forEach((key) => delete errors[key as keyof FoodItemFormErrors]);
}

function submit(): void {
  clearErrors();
  Object.assign(errors, validateFoodItemDraft(draft));
  if (Object.keys(errors).length) return;
  emit('submit', { ...draft, foodName: draft.foodName.trim() });
}
</script>

<style scoped>
.food-form {
  display: grid;
  gap: 10px;
  max-width: 680px;
  margin: 0 auto;
  padding: 18px 16px 32px;
}

.food-form ion-item {
  --background: #fff;
  --border-color: #e4ebe6;
  --border-radius: 12px;
  --padding-start: 13px;
  border: 1px solid #e4ebe6;
  border-radius: 12px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.form-row > div,
.form-row > ion-item {
  min-width: 0;
}

ion-note {
  display: block;
  padding: 0 12px;
  font-size: 0.78rem;
}

.field-help {
  color: var(--ion-color-medium);
}

.nutrition-section {
  display: grid;
  gap: 10px;
  padding: 13px;
  border: 1px solid #e3ece5;
  border-radius: 13px;
  background: #fbfdfb;
}

.nutrition-section summary {
  color: #276c50;
  cursor: pointer;
  font-size: 0.86rem;
  font-weight: 700;
}

.nutrition-help {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.76rem;
  line-height: 1.45;
}

.linked-nutrition {
  margin: 0;
  border: 1px solid #e0ebe3;
  border-radius: 11px;
  box-shadow: none;
}

.linked-nutrition ion-card-content {
  display: grid;
  gap: 4px;
  padding: 11px;
}

.linked-nutrition strong { color: #284a39; font-size: 0.84rem; }
.linked-nutrition span { color: #79877e; font-size: 0.74rem; }
.linked-nutrition ion-button { justify-self: start; margin: 0; font-size: 0.74rem; text-transform: none; }

.submit-button {
  margin-top: 12px;
  --border-radius: 12px;
}

@media (max-width: 520px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
