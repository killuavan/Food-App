<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="macro-page">
        <header class="macro-hero">
          <div>
            <h1>Macronutrient tracking</h1>
          </div>
          <div class="hero-actions">
            <ion-button router-link="/daily-nutrition" fill="outline">
              <ion-icon slot="start" :icon="flameOutline" />
              Calorie summary
            </ion-button>
            <ion-button router-link="/consumption" fill="clear">
              <ion-icon slot="start" :icon="restaurantOutline" />
              Food journal
            </ion-button>
          </div>
        </header>

        <ion-progress-bar v-if="loading" type="indeterminate" aria-label="Loading macronutrient history" />
        <ion-card v-if="errorMessage" class="message-card error-card">
          <ion-card-content role="alert">
            {{ errorMessage }}
            <ion-button fill="clear" @click="loadData">Retry</ion-button>
          </ion-card-content>
        </ion-card>

        <section v-if="!user && !loading" class="auth-prompt">
          <h2>Sign in to view macronutrient analytics</h2>
          <ion-button router-link="/sign-in">Continue to sign in</ion-button>
        </section>

        <template v-else-if="user && !errorMessage">
          <section class="date-panel">
            <ion-item>
              <ion-input v-model="selectedDate" type="date" label="Selected day" label-placement="stacked" :max="today" />
            </ion-item>
          </section>

          <section class="macro-totals" aria-label="Daily macronutrient totals">
            <ion-card v-for="macro in macroCards" :key="macro.name" :class="`macro-card ${macro.className}`">
              <ion-card-content>
                <span class="macro-label">{{ macro.label }}</span>
                <strong>{{ formatMacro(summary[macro.field], macro.name) }}</strong>
                <span class="macro-foot">
                  {{ summary.entriesWithData[macro.name] }}/{{ summary.entryCount }} logs with data
                </span>
                <span v-if="summary.entriesMissingData[macro.name]" class="macro-warning">
                  Incomplete: {{ summary.entriesMissingData[macro.name] }} missing
                </span>
              </ion-card-content>
            </ion-card>
          </section>

          <ion-card class="breakdown-card">
            <ion-card-content>
              <div class="section-heading">
                <div>
                  <h2>Macronutrients by meal</h2>
                </div>
                <ion-badge :color="summary.status === 'complete' ? 'success' : summary.status === 'incomplete' ? 'warning' : 'medium'">
                  {{ statusLabel(summary.status) }}
                </ion-badge>
              </div>
              <ion-list lines="none">
                <ion-item v-for="meal in mealRows" :key="meal.mealCategory">
                  <ion-icon slot="start" :icon="meal.icon" />
                  <ion-label>
                    <h3>{{ meal.mealCategory }}</h3>
                    <p>{{ meal.entryCount }} {{ meal.entryCount === 1 ? 'entry' : 'entries' }}</p>
                  </ion-label>
                  <div class="meal-macros">
                    <span>Protein <strong>{{ formatMacro(meal.proteinG, 'protein', meal.entriesMissingData.protein > 0) }}</strong></span>
                    <span>Carbs <strong>{{ formatMacro(meal.carbohydratesG, 'carbohydrates', meal.entriesMissingData.carbohydrates > 0) }}</strong></span>
                    <span>Fat <strong>{{ formatMacro(meal.totalFatG, 'totalFat', meal.entriesMissingData.totalFat > 0) }}</strong></span>
                  </div>
                </ion-item>
              </ion-list>
              <p v-if="summary.status === 'incomplete'" class="notice incomplete-notice">
                Incomplete totals include only foods with available data.
              </p>
              <p v-else-if="summary.status === 'no-records'" class="notice">
                No food logs for this day; this does not confirm zero intake.
              </p>
            </ion-card-content>
          </ion-card>

          <ion-card class="chart-card">
            <ion-card-content>
              <div class="section-heading">
                <div>
                  <h2>Distribution and trend</h2>
                </div>
              </div>
              <div class="range-row">
                <ion-item>
                  <ion-input v-model="rangeStart" type="date" label="From" label-placement="stacked" :max="rangeEnd" />
                </ion-item>
                <ion-item>
                  <ion-input v-model="rangeEnd" type="date" label="Through" label-placement="stacked" :max="today" :min="rangeStart" />
                </ion-item>
              </div>
              <p v-if="rangeError" class="range-error" role="alert">{{ rangeError }}</p>
              <MacronutrientCharts
                v-else
                :summary="summary"
                :days="rangeDays"
              />
              <p class="chart-note">
                Energy split: protein × 4, carbohydrates × 4, fat × 9 kcal/g. Percentages use available data and may differ from food labels.
              </p>
            </ion-card-content>
          </ion-card>
        </template>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { AuthenticatedUser as User } from '../services/authService';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonProgressBar,
} from '@ionic/vue';
import { App as CapacitorApp } from '@capacitor/app';
import { cafeOutline, fastFoodOutline, flameOutline, leafOutline, restaurantOutline } from 'ionicons/icons';
import AppNavigation from '../components/AppNavigation.vue';
import MacronutrientCharts from '../components/MacronutrientCharts.vue';
import { observeAuth } from '../services/authService';
import {
  foodConsumptionUpdatedEventName,
  listFoodConsumptions,
} from '../services/foodConsumptionService';
import { getLocalDate, type MealCategory } from '../utils/foodConsumption';
import {
  getMacronutrientsForDateRange,
  summarizeDailyMacronutrients,
  type MacronutrientName,
} from '../utils/dailyNutrition';

const user = ref<User | null>(null);
const loading = ref(true);
const errorMessage = ref('');
const today = getLocalDate();
const selectedDate = ref(today);
const rangeEnd = ref(today);
const rangeStart = ref(shiftDate(today, -6));
const records = ref<Awaited<ReturnType<typeof listFoodConsumptions>>>([]);
let unsubscribe: (() => void) | undefined;
let foregroundListener: { remove: () => Promise<void> } | undefined;
let requestSequence = 0;

const summary = computed(() => summarizeDailyMacronutrients(records.value, selectedDate.value));
const rangeDays = computed(() => getMacronutrientsForDateRange(records.value, rangeStart.value, rangeEnd.value));
const rangeError = computed(() => {
  if (!rangeDays.value.length) return 'Choose a valid date range of up to 366 days, with the start date on or before the end date.';
  return '';
});
const macroCards = [
  { name: 'protein', label: 'Protein', field: 'proteinG', className: 'protein-card' },
  { name: 'carbohydrates', label: 'Carbohydrates', field: 'carbohydratesG', className: 'carb-card' },
  { name: 'totalFat', label: 'Total fat', field: 'totalFatG', className: 'fat-card' },
] as const;
const mealMetadata: Record<MealCategory, { icon: string }> = {
  Breakfast: { icon: cafeOutline },
  Lunch: { icon: restaurantOutline },
  Dinner: { icon: fastFoodOutline },
  Snacks: { icon: leafOutline },
};
const mealRows = computed(() => (['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const)
  .map((mealCategory) => ({ ...summary.value.meals[mealCategory], icon: mealMetadata[mealCategory].icon })));

watch(selectedDate, (date) => {
  if (!isValidDate(date) || date > today) return;
  rangeEnd.value = date;
  rangeStart.value = shiftDate(date, -6);
});

onMounted(() => {
  unsubscribe = observeAuth((authenticatedUser) => {
    user.value = authenticatedUser;
    records.value = [];
    errorMessage.value = '';
    if (authenticatedUser) void loadData();
    else loading.value = false;
  }, (error) => {
    loading.value = false;
    errorMessage.value = error.message;
  });
  window.addEventListener(foodConsumptionUpdatedEventName, handleConsumptionUpdated);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive && user.value) void loadData();
  }).then((listener) => {
    foregroundListener = listener;
  }).catch((error: unknown) => {
    errorMessage.value = `Unable to monitor refresh state: ${error instanceof Error ? error.message : String(error)}`;
  });
});

onUnmounted(() => {
  unsubscribe?.();
  window.removeEventListener(foodConsumptionUpdatedEventName, handleConsumptionUpdated);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  void foregroundListener?.remove();
});

async function loadData(): Promise<void> {
  const authenticatedUser = user.value;
  if (!authenticatedUser) return;
  const sequence = ++requestSequence;
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await listFoodConsumptions(authenticatedUser.uid);
    if (sequence !== requestSequence || user.value?.uid !== authenticatedUser.uid) return;
    records.value = result;
  } catch (error) {
    if (sequence === requestSequence) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
}

function handleConsumptionUpdated(event: Event): void {
  const detail = (event as CustomEvent<{ userId?: string }>).detail;
  if (detail?.userId && detail.userId === user.value?.uid) void loadData();
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible' && user.value) void loadData();
}

function formatMacro(value: number | null, _name: MacronutrientName, incomplete = false): string {
  if (value === null) return 'Not Available';
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} g${incomplete ? ' · incomplete' : ''}`;
}

function statusLabel(status: 'no-records' | 'complete' | 'incomplete'): string {
  if (status === 'no-records') return 'No food records';
  return status === 'complete' ? 'Complete logged nutrition' : 'Nutrition data incomplete';
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function shiftDate(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
</script>

<style scoped>
.macro-page { width: min(1120px, 100%); margin: 0 auto; padding: 26px 18px 56px; }
.macro-hero { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; padding: 27px; border-radius: 20px; background: linear-gradient(90deg, rgb(20 62 47 / 96%) 0%, rgb(25 91 56 / 90%) 58%, rgb(25 91 56 / 34%) 100%), url('/images/food-banner.svg') center / cover no-repeat; box-shadow: 0 14px 32px rgb(25 80 61 / 13%); color: #fff; }
.macro-hero .eyebrow { color: #bcebd0; }
.macro-hero h1 { margin: 7px 0; font-size: clamp(1.7rem, 4vw, 2.35rem); }
.macro-hero p:last-child { max-width: 650px; margin: 0; color: rgb(255 255 255 / 84%); line-height: 1.5; }
.hero-actions { display: flex; flex-wrap: wrap; flex-shrink: 0; }
.hero-actions ion-button { --color: #fff; --border-color: rgb(255 255 255 / 55%); }
.date-panel { display: flex; align-items: center; gap: 14px; margin: 14px 0; }
.date-panel ion-item, .range-row ion-item { min-width: 190px; --background: #fff; --border-radius: 10px; }
.date-panel > p, .chart-note { color: #6d7d72; font-size: .8rem; line-height: 1.5; }
.macro-totals { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 13px; margin-bottom: 14px; }
.macro-card, .breakdown-card, .chart-card { margin: 0 0 14px; border: 1px solid #e4ece6; border-radius: 15px; box-shadow: 0 5px 16px rgb(28 65 48 / 4%); }
.macro-card ion-card-content { display: grid; min-height: 136px; align-content: center; gap: 6px; padding: 18px; }
.protein-card { background: #f0f8f2; }
.carb-card { background: #f4f8ef; }
.fat-card { background: #fff8ed; }
.macro-label { color: #65756a; font-size: .82rem; font-weight: 650; }
.macro-card strong { color: #244737; font-size: clamp(1.45rem, 4vw, 1.9rem); }
.macro-foot { color: #77857c; font-size: .72rem; }
.macro-warning { color: #98631d; font-size: .73rem; }
.breakdown-card ion-card-content, .chart-card ion-card-content { display: grid; gap: 12px; padding: 18px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.eyebrow { margin: 0; color: #2f8568; font-size: .69rem; font-weight: 750; letter-spacing: .1em; }
.section-heading h2 { margin: 4px 0 0; color: #244737; font-size: 1.12rem; }
.breakdown-card ion-item { --padding-start: 4px; --inner-padding-end: 4px; }
.breakdown-card ion-item > ion-icon { color: #348263; }
.breakdown-card ion-label p { color: #77857c; }
.meal-macros { display: flex; flex-direction: column; gap: 3px; text-align: right; }
.meal-macros span { color: #6d7d72; font-size: .68rem; white-space: nowrap; }
.meal-macros strong { color: #284a39; font-size: .74rem; }
.notice { margin: 0; padding: 11px; border-radius: 9px; background: #f2f6f2; color: #65756a; font-size: .79rem; line-height: 1.5; }
.incomplete-notice { background: #fff7eb; color: #805821; }
.range-row { display: flex; flex-wrap: wrap; gap: 10px; }
.range-error { color: var(--ion-color-danger); font-size: .8rem; }
.chart-note { margin: 0; }
.auth-prompt { padding: 35px 20px; text-align: center; }
.message-card { margin: 10px 0; }
@media (max-width: 720px) {
  .macro-hero { align-items: flex-start; flex-direction: column; padding: 22px; }
  .date-panel { align-items: stretch; flex-direction: column; gap: 4px; }
  .date-panel ion-item { width: 100%; }
  .macro-totals { grid-template-columns: 1fr; gap: 8px; }
  .macro-card { margin: 0; }
  .macro-card ion-card-content { min-height: 110px; }
  .meal-macros { gap: 5px; }
}
</style>
