<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="analytics-page">
        <header class="analytics-header">
          <div class="header-copy">
            <h1>Nutrition overview</h1>
          </div>
          <ion-button class="date-button" fill="outline" @click="datePickerOpen = true">
            <ion-icon slot="start" :icon="calendarOutline" />
            {{ formatDate(selectedDate) }}
          </ion-button>
        </header>

        <ion-modal :is-open="datePickerOpen" @didDismiss="datePickerOpen = false">
          <ion-datetime :value="selectedDate" presentation="date" :max="today" @ionChange="selectDate" />
          <ion-button expand="block" @click="datePickerOpen = false">Done</ion-button>
        </ion-modal>

        <ion-progress-bar v-if="loading" type="indeterminate" aria-label="Loading nutrition history" />
        <ion-card v-if="errorMessage" class="message-card error-card">
          <ion-card-content role="alert">
            {{ errorMessage }}
            <ion-button fill="clear" @click="loadData">Retry</ion-button>
          </ion-card-content>
        </ion-card>

        <section v-if="!user && !loading" class="auth-prompt">
          <ion-icon :icon="lockClosedOutline" />
          <h2>Sign in to view your nutrition</h2>
          <ion-button router-link="/sign-in">Continue to sign in</ion-button>
        </section>

        <template v-else-if="user && !errorMessage">
          <ion-segment v-model="selectedTab" class="analytics-tabs" aria-label="Nutrition category">
            <ion-segment-button value="calories">
              <ion-icon :icon="flameOutline" />
              <ion-label>Calories</ion-label>
            </ion-segment-button>
            <ion-segment-button value="macros">
              <ion-icon :icon="leafOutline" />
              <ion-label>Macros</ion-label>
            </ion-segment-button>
            <ion-segment-button value="micros">
              <ion-icon :icon="nutritionOutline" />
              <ion-label>Micros</ion-label>
            </ion-segment-button>
          </ion-segment>

          <section v-if="selectedTab === 'calories'" class="tab-content">
            <section class="summary-heading">
              <div>
                <p class="eyebrow">CALORIES · {{ formatDate(selectedDate) }}</p>
                <h2>Recorded intake</h2>
              </div>
              <ion-badge :color="calories.status === 'complete' ? 'success' : calories.status === 'incomplete' ? 'warning' : 'medium'">
                {{ calorieStatus }}
              </ion-badge>
            </section>

            <section class="calorie-overview">
              <ion-card class="calorie-total-card">
                <ion-card-content>
                  <span class="card-label">Calories with available data</span>
                  <strong>{{ formatCalories(calories.caloriesKcal) }}</strong>
                  <span>{{ calories.entryCount }} logged {{ calories.entryCount === 1 ? 'food' : 'foods' }}</span>
                </ion-card-content>
              </ion-card>
              <div class="meal-grid">
                <ion-card v-for="meal in calorieMeals" :key="meal.mealCategory" class="meal-card">
                  <ion-card-content>
                    <span>{{ meal.mealCategory }}</span>
                    <strong>{{ formatCalories(meal.caloriesKcal) }}</strong>
                    <small>{{ meal.entryCount }} {{ meal.entryCount === 1 ? 'entry' : 'entries' }}</small>
                  </ion-card-content>
                </ion-card>
              </div>
            </section>

            <ion-card class="surface-card">
              <ion-card-content>
                <div class="section-title">
                  <div>
                    <h2>Logged calorie trend</h2>
                  </div>
                  <ion-button fill="clear" router-link="/daily-nutrition">View analytics</ion-button>
                </div>
                <div class="calorie-chart" role="img" :aria-label="calorieChartDescription">
                  <div v-for="day in calorieDays" :key="day.date" class="calorie-day">
                    <span class="chart-value">
                      {{ day.caloriesKcal === null ? (day.status === 'no-records' ? '—' : 'Partial') : `${Math.round(day.caloriesKcal)}` }}
                    </span>
                    <div class="bar-track">
                      <span
                        v-if="day.caloriesKcal !== null"
                        class="calorie-bar"
                        :class="{ 'bar-partial': day.status === 'incomplete' }"
                        :style="{ height: `${barHeight(day.caloriesKcal)}%` }"
                      />
                      <span v-else class="empty-bar-label">{{ day.status === 'no-records' ? 'No log' : 'No kcal' }}</span>
                    </div>
                    <strong>{{ day.weekday }}</strong>
                    <small>{{ day.date.slice(5) }}</small>
                  </div>
                </div>
                <div class="legend">
                  <span><i class="legend-calories" /> Recorded kcal</span>
                  <span><i class="legend-partial" /> Incomplete data</span>
                </div>
                <p v-if="calories.status === 'incomplete'" class="notice notice-warn">
                  Partial total: some foods have missing nutrition or portion data.
                </p>
                <p v-else-if="calories.status === 'no-records'" class="notice">
                  No food logs today; this does not confirm zero intake.
                </p>
              </ion-card-content>
            </ion-card>
          </section>

          <section v-else-if="selectedTab === 'macros'" class="tab-content">
            <section class="summary-heading">
              <div>
                <p class="eyebrow">MACRONUTRIENTS · {{ formatDate(selectedDate) }}</p>
                <h2>Protein, carbohydrates &amp; fat</h2>
              </div>
              <ion-badge :color="macros.status === 'complete' ? 'success' : macros.status === 'incomplete' ? 'warning' : 'medium'">
                {{ macroStatus }}
              </ion-badge>
            </section>

            <section class="macro-grid" aria-label="Daily macronutrient values">
              <ion-card v-for="macro in macroCards" :key="macro.name" :class="`macro-card ${macro.className}`">
                <ion-card-content>
                  <span>{{ macro.label }}</span>
                  <strong>{{ formatMacro(macros[macro.field]) }}</strong>
                  <small>{{ macros.entriesWithData[macro.name] }} of {{ macros.entryCount }} foods with data</small>
                  <small v-if="macros.entriesMissingData[macro.name] > 0" class="warning-copy">
                    {{ macros.entriesMissingData[macro.name] }} unavailable
                  </small>
                </ion-card-content>
              </ion-card>
            </section>
            <ion-card class="surface-card">
              <ion-card-content>
                <MacronutrientCharts :summary="macros" :days="macroDays" />
                <p class="supporting-text">
                  Macro energy may differ from reported calories due to fiber, rounding, and source data.
                </p>
              </ion-card-content>
            </ion-card>
            <ion-card class="surface-card meal-breakdown">
              <ion-card-content>
                <div class="section-title">
                  <div><h2>Macros by meal</h2></div>
                </div>
                <ion-list lines="none">
                  <ion-item v-for="meal in macroMeals" :key="meal.mealCategory">
                    <ion-label>
                      <h3>{{ meal.mealCategory }}</h3>
                      <p>{{ meal.entryCount }} logged foods</p>
                    </ion-label>
                    <div class="meal-macro-values">
                      <span>Protein <strong>{{ formatMacro(meal.proteinG) }}</strong></span>
                      <span>Carbs <strong>{{ formatMacro(meal.carbohydratesG) }}</strong></span>
                      <span>Fat <strong>{{ formatMacro(meal.totalFatG) }}</strong></span>
                    </div>
                  </ion-item>
                </ion-list>
                <p v-if="macros.status === 'no-records'" class="notice">No food logs today; intake is unknown.</p>
                <p v-else-if="macros.status === 'incomplete'" class="notice notice-warn">Partial totals include available data only.</p>
              </ion-card-content>
            </ion-card>
          </section>

          <section v-else class="tab-content">
            <section class="summary-heading">
              <div>
                <p class="eyebrow">MICRONUTRIENTS · {{ formatDate(selectedDate) }}</p>
                <h2>Vitamins, minerals &amp; fiber</h2>
              </div>
              <span class="record-count">{{ micros.entryCount }} logged {{ micros.entryCount === 1 ? 'food' : 'foods' }}</span>
            </section>
            <ion-segment v-model="selectedMicroGroup" class="micro-tabs" aria-label="Micronutrient group">
              <ion-segment-button value="vitamins">Vitamins</ion-segment-button>
              <ion-segment-button value="minerals">Minerals</ion-segment-button>
              <ion-segment-button value="fiber">Fiber</ion-segment-button>
            </ion-segment>
            <ion-card class="surface-card">
              <ion-card-content>
                <ion-list lines="none" class="micro-list">
                  <ion-item
                    v-for="value in visibleMicros"
                    :key="value.nutrient.id"
                    button
                    detail
                    :class="{ 'micro-selected': value.nutrient.id === selectedMicro }"
                    @click="selectedMicro = value.nutrient.id"
                  >
                    <ion-label>
                      <h3>{{ value.nutrient.label }}</h3>
                      <p>{{ microStatus(value.status, value.entriesWithData, value.entriesMissingData) }}</p>
                    </ion-label>
                    <strong>{{ formatMicroTotals(value.totals) }}</strong>
                  </ion-item>
                </ion-list>
              </ion-card-content>
            </ion-card>

            <ion-card class="surface-card">
              <ion-card-content>
                <div class="section-title">
                  <div><h2>{{ selectedMicroValue.nutrient.label }}</h2></div>
                  <span class="selected-total">{{ formatMicroTotals(selectedMicroValue.totals) }}</span>
                </div>
                <p v-if="selectedMicroValue.entriesMissingData" class="notice notice-warn">
                  Partial recorded total: {{ selectedMicroValue.entriesMissingData }} logged foods do not have compatible data.
                </p>
                <h3 class="subheading">Food sources</h3>
                <ion-list v-if="selectedMicroSources.length" lines="inset">
                  <ion-item v-for="source in selectedMicroSources" :key="source.recordId">
                    <ion-label>
                      <h3>{{ source.foodName }}</h3>
                      <p>{{ source.mealCategory }} · {{ source.comparable ? 'Comparable unit' : 'Reported unit' }}</p>
                    </ion-label>
                    <span>{{ formatAmount(source.amount, source.unit) }}</span>
                  </ion-item>
                </ion-list>
                <p v-else class="supporting-text">No saved foods have available data for this nutrient on this day.</p>
                <h3 class="subheading">Contribution by meal</h3>
                <ion-list lines="inset">
                  <ion-item v-for="meal in microMeals" :key="meal.name">
                    <ion-label>{{ meal.name }}</ion-label>
                    <span>{{ formatMicroTotals(meal.totals) }}</span>
                  </ion-item>
                </ion-list>
                <MicronutrientTrendChart :days="microDays" :nutrient-label="selectedMicroValue.nutrient.label" />
              </ion-card-content>
            </ion-card>
          </section>

          <div class="page-actions">
            <ion-button fill="outline" router-link="/reports">Analytics &amp; reports</ion-button>
            <ion-button router-link="/consumption">
              <ion-icon slot="start" :icon="restaurantOutline" />
              Log food
            </ion-button>
            <ion-button fill="outline" router-link="/micronutrients">Open micronutrient details</ion-button>
          </div>
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
  IonDatetime,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonProgressBar,
  IonSegment,
  IonSegmentButton,
} from '@ionic/vue';
import { App as CapacitorApp } from '@capacitor/app';
import { calendarOutline, flameOutline, leafOutline, lockClosedOutline, nutritionOutline, restaurantOutline } from 'ionicons/icons';
import AppNavigation from '../components/AppNavigation.vue';
import MacronutrientCharts from '../components/MacronutrientCharts.vue';
import MicronutrientTrendChart from '../components/MicronutrientTrendChart.vue';
import { observeAuth } from '../services/authService';
import { foodConsumptionUpdatedEventName, listFoodConsumptions } from '../services/foodConsumptionService';
import { getLocalDate, type FoodConsumption, type MealCategory } from '../utils/foodConsumption';
import {
  getMacronutrientsForDateRange,
  getSevenDayCalories,
  summarizeDailyCalories,
  summarizeDailyMacronutrients,
} from '../utils/dailyNutrition';
import {
  getMicronutrientTrend,
  micronutrientDefinitions,
  summarizeDailyMicronutrients,
  type MicronutrientGroup,
  type MicronutrientName,
  type MicronutrientStatus,
} from '../utils/micronutrients';

type AnalyticsTab = 'calories' | 'macros' | 'micros';
const user = ref<User | null>(null);
const records = ref<FoodConsumption[]>([]);
const loading = ref(true);
const errorMessage = ref('');
const datePickerOpen = ref(false);
const selectedTab = ref<AnalyticsTab>('calories');
const selectedDate = ref(getLocalDate());
const today = getLocalDate();
const selectedMicroGroup = ref<MicronutrientGroup>('vitamins');
const selectedMicro = ref<MicronutrientName>('vitaminC');
let unsubscribe: (() => void) | undefined;
let foregroundListener: { remove: () => Promise<void> } | undefined;
let requestSequence = 0;

const calories = computed(() => summarizeDailyCalories(records.value, selectedDate.value));
const calorieDays = computed(() => getSevenDayCalories(records.value, selectedDate.value));
const macros = computed(() => summarizeDailyMacronutrients(records.value, selectedDate.value));
const macroDays = computed(() => getMacronutrientsForDateRange(
  records.value,
  shiftDate(selectedDate.value, -6),
  selectedDate.value,
));
const micros = computed(() => summarizeDailyMicronutrients(records.value, selectedDate.value));
const visibleMicros = computed(() => Object.values(micros.value.values)
  .filter((value) => value.nutrient.group === selectedMicroGroup.value));
const selectedMicroValue = computed(() => micros.value.values[selectedMicro.value]);
const selectedMicroSources = computed(() => selectedMicroValue.value.contributions
  .filter((contribution) => contribution.amount !== null));
const microDays = computed(() => getMicronutrientTrend(records.value, selectedMicro.value, selectedDate.value));
const calorieMeals = computed(() => (['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const)
  .map((meal) => calories.value.meals[meal]));
const macroMeals = computed(() => (['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const)
  .map((meal) => macros.value.meals[meal]));
const microMeals = computed(() => (['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const)
  .map((name: MealCategory) => ({ name, totals: selectedMicroValue.value.meals[name] })));
const macroCards = [
  { name: 'protein', label: 'Protein', field: 'proteinG', className: 'protein-card' },
  { name: 'carbohydrates', label: 'Carbohydrates', field: 'carbohydratesG', className: 'carbohydrate-card' },
  { name: 'totalFat', label: 'Fats', field: 'totalFatG', className: 'fat-card' },
] as const;
const calorieStatus = computed(() => calories.value.status === 'no-records'
  ? 'No food records'
  : calories.value.status === 'incomplete' ? 'Partial data' : 'Available');
const macroStatus = computed(() => macros.value.status === 'no-records'
  ? 'No food records'
  : macros.value.status === 'incomplete' ? 'Partial data' : 'Available');
const maximumCalories = computed(() => Math.max(1, ...calorieDays.value.map((day) => day.caloriesKcal ?? 0)));
const calorieChartDescription = computed(() => calorieDays.value.map((day) => (
  `${day.weekday}: ${day.status === 'no-records' ? 'no food records; intake unknown' : `${day.caloriesKcal ?? 'no available'} kcal${day.status === 'incomplete' ? ', partial nutrition data' : ''}`}`
)).join('; '));

watch(selectedMicroGroup, (group) => {
  const first = micronutrientDefinitions.find((nutrient) => nutrient.group === group);
  if (first) selectedMicro.value = first.id;
});
watch(selectedMicro, (id) => {
  const definition = micronutrientDefinitions.find((nutrient) => nutrient.id === id);
  if (definition) selectedMicroGroup.value = definition.group;
});
watch(selectedDate, (date) => {
  if (!isValidDate(date) || date > today) selectedDate.value = today;
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
    if (sequence === requestSequence) errorMessage.value = error instanceof Error ? error.message : String(error);
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

function selectDate(event: CustomEvent<{ value?: string | string[] | null }>): void {
  const value = event.detail.value;
  if (typeof value === 'string' && isValidDate(value) && value <= today) selectedDate.value = value;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(year, month - 1, day));
}

function formatCalories(value: number | null): string {
  return value === null ? 'Not available' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} kcal`;
}

function formatMacro(value: number | null): string {
  return value === null ? 'Not Available' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} g`;
}

function formatMicroTotals(totals: Array<{ amount: number; unit: string }>): string {
  return totals.length
    ? totals.map((total) => formatAmount(total.amount, total.unit)).join(' · ')
    : 'Not Available';
}

function formatAmount(amount: number | null, unit: string | null): string {
  return amount === null || unit === null
    ? 'Not Available'
    : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount)} ${unit}`;
}

function microStatus(status: MicronutrientStatus, available: number, missing: number): string {
  if (status === 'no-records') return 'No food records';
  if (status === 'unavailable') return 'Not available in saved food data';
  if (status === 'partial') return `Partial · ${available} available, ${missing} missing`;
  return 'Available for logged foods';
}

function barHeight(value: number): number {
  if (value <= 0) return 2;
  return Math.max(4, (value / maximumCalories.value) * 100);
}

function shiftDate(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}
</script>

<style scoped>
.analytics-page { width: min(1120px, 100%); margin: 0 auto; padding: 28px 20px 52px; }
.analytics-header { display: flex; min-height: 155px; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 20px; padding: 27px 32px; border-radius: 22px; background: linear-gradient(90deg, rgb(20 62 47 / 96%) 0%, rgb(25 91 56 / 90%) 58%, rgb(25 91 56 / 34%) 100%), url('/images/food-banner.svg') center / cover no-repeat; box-shadow: 0 14px 32px rgb(25 80 61 / 13%); color: #fff; }
.header-copy h1 { margin: 5px 0; color: #fff; font-size: clamp(1.7rem, 4vw, 2.2rem); letter-spacing: -.035em; }
.header-copy > p:last-child { margin: 0; color: rgb(255 255 255 / 84%); }
.eyebrow { margin: 0; color: var(--app-green); font-size: .68rem; font-weight: 750; letter-spacing: .11em; }
.analytics-header .eyebrow { color: #bcebd0; }
.date-button { --border-radius: 12px; --border-color: rgb(255 255 255 / 55%); --color: #fff; --background: rgb(255 255 255 / 10%); min-height: 46px; }
.analytics-tabs { margin: 14px 0 20px; padding: 5px; border: 1px solid var(--app-border); border-radius: 15px; background: var(--app-card); }
.analytics-tabs ion-segment-button { min-height: 54px; --border-radius: 11px; --indicator-color: var(--app-green); --color-checked: #fff; text-transform: none; }
.analytics-tabs ion-icon { margin-bottom: 2px; font-size: 1.15rem; }
.tab-content { display: grid; gap: 15px; }
.summary-heading, .section-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.summary-heading h2, .section-title h2 { margin: 4px 0 0; color: var(--app-text); font-size: 1.16rem; }
.calorie-overview { display: grid; grid-template-columns: minmax(210px, .75fr) 1.5fr; gap: 14px; }
.calorie-total-card, .meal-card, .surface-card, .macro-card { margin: 0; border: 1px solid var(--app-border); border-radius: 16px; background: var(--app-card); box-shadow: 0 5px 18px rgb(22 55 43 / 5%); }
.calorie-total-card { background: linear-gradient(140deg, #e8f5e9, #fff); }
.calorie-total-card ion-card-content { display: grid; min-height: 150px; align-content: center; gap: 8px; padding: 20px; }
.card-label, .meal-card span, .macro-card span { color: var(--app-muted); font-size: .8rem; }
.calorie-total-card strong { color: var(--app-green-dark); font-size: clamp(1.7rem, 4vw, 2.2rem); }
.calorie-total-card ion-card-content > span:last-child, .meal-card small { color: var(--app-muted); font-size: .74rem; }
.meal-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.meal-card ion-card-content { display: grid; gap: 7px; padding: 15px; }
.meal-card strong { color: var(--app-text); font-size: 1.04rem; }
.surface-card ion-card-content { display: grid; gap: 13px; padding: 19px; }
.supporting-text { margin: 0; color: var(--app-muted); font-size: .78rem; line-height: 1.5; }
.calorie-chart { display: grid; min-height: 220px; grid-template-columns: repeat(7, minmax(0, 1fr)); align-items: end; gap: 8px; padding: 12px 0 0; }
.calorie-day { display: grid; min-width: 0; grid-template-rows: 24px 132px auto auto; justify-items: center; gap: 5px; color: var(--app-muted); font-size: .68rem; }
.chart-value { max-width: 100%; overflow: hidden; color: var(--app-text); font-size: .64rem; text-overflow: ellipsis; white-space: nowrap; }
.bar-track { position: relative; display: flex; width: min(34px, 70%); height: 100%; align-items: flex-end; justify-content: center; overflow: hidden; border-radius: 9px; background: #f0f4f1; }
.calorie-bar { width: 100%; min-height: 3px; border-radius: 8px 8px 0 0; background: #2e7d32; }
.calorie-bar.bar-partial { background: #e4a449; }
.empty-bar-label { position: absolute; top: 50%; left: 50%; width: max-content; color: #78827b; font-size: .57rem; transform: translate(-50%, -50%) rotate(-90deg); }
.calorie-day strong { color: var(--app-text); }
.calorie-day small { font-size: .62rem; }
.legend { display: flex; flex-wrap: wrap; gap: 14px; color: var(--app-muted); font-size: .7rem; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 9px; height: 9px; border-radius: 50%; }
.legend-calories { background: #2e7d32; }
.legend-partial { background: #e4a449; }
.notice { margin: 0; padding: 11px; border-radius: 10px; background: #f1f5f2; color: #627068; font-size: .78rem; line-height: 1.5; }
.notice-warn { background: #fff7e9; color: #805821; }
.macro-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.macro-card ion-card-content { display: grid; min-height: 130px; align-content: center; gap: 7px; padding: 18px; }
.macro-card strong { color: var(--app-text); font-size: clamp(1.25rem, 3vw, 1.8rem); }
.macro-card small { color: var(--app-muted); font-size: .7rem; }
.protein-card { background: #edf7ee; }
.carbohydrate-card { background: #eef5ff; }
.fat-card { background: #fff5e8; }
.protein-card strong { color: #388e3c; }
.carbohydrate-card strong { color: #1976d2; }
.fat-card strong { color: #ef8f00; }
.warning-copy { color: #9a641d !important; }
.meal-breakdown ion-item { --padding-start: 4px; --inner-padding-end: 4px; }
.meal-breakdown ion-label h3 { color: var(--app-text); font-weight: 650; }
.meal-breakdown ion-label p { color: var(--app-muted); font-size: .72rem; }
.meal-macro-values { display: grid; gap: 3px; text-align: right; }
.meal-macro-values span { color: var(--app-muted); font-size: .67rem; white-space: nowrap; }
.meal-macro-values strong { color: var(--app-text); }
.micro-tabs { --background: var(--app-card); border: 1px solid var(--app-border); border-radius: 12px; }
.micro-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; background: transparent; }
.micro-list ion-item { --background: #f7f9f7; --border-radius: 10px; --inner-padding-end: 10px; }
.micro-list ion-item.micro-selected { --background: #e8f5e9; }
.micro-list ion-label h3 { color: var(--app-text); font-size: .88rem; font-weight: 650; }
.micro-list ion-label p { color: var(--app-muted); font-size: .68rem; }
.micro-list ion-item > strong { max-width: 45%; color: var(--app-green-dark); font-size: .78rem; text-align: right; }
.selected-total { color: var(--app-green-dark); font-size: 1.1rem; font-weight: 750; text-align: right; }
.subheading { margin: 3px 0 -7px; color: var(--app-text); font-size: .9rem; }
.surface-card ion-item { --padding-start: 4px; --inner-padding-end: 4px; }
.surface-card ion-item h3 { color: var(--app-text); }
.surface-card ion-item p { color: var(--app-muted); font-size: .71rem; }
.surface-card ion-item > span { color: var(--app-text); font-size: .78rem; text-align: right; }
.page-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
.page-actions ion-button { --border-radius: 12px; text-transform: none; }
.auth-prompt { padding: 48px 20px; color: var(--app-muted); text-align: center; }
.auth-prompt ion-icon { color: var(--app-green); font-size: 2rem; }
.auth-prompt h2 { color: var(--app-text); }
.message-card { margin: 12px 0; border-radius: 14px; }
@media (max-width: 720px) {
  .analytics-page { padding: 20px 15px 34px; }
  .analytics-header { min-height: 0; align-items: flex-start; flex-direction: column; gap: 12px; padding: 22px; }
  .calorie-overview { grid-template-columns: 1fr; }
  .macro-grid { grid-template-columns: 1fr; gap: 8px; }
  .macro-card { margin: 0; }
  .macro-card ion-card-content { min-height: 105px; }
}
@media (max-width: 480px) {
  .micro-list { grid-template-columns: 1fr; }
  .calorie-chart { gap: 4px; }
  .calorie-day { grid-template-rows: 22px 112px auto auto; gap: 4px; font-size: .61rem; }
  .calorie-day .chart-value { font-size: .55rem; }
  .meal-card ion-card-content { padding: 12px; }
  .meal-card strong { font-size: .88rem; }
  .meal-macro-values { gap: 5px; }
}
</style>
