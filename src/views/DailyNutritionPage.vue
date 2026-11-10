<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="calorie-page">
        <header class="calorie-hero">
          <div>
            <h1>Daily calorie summary</h1>
          </div>
          <ion-button router-link="/consumption" fill="outline">
            <ion-icon slot="start" :icon="restaurantOutline" />
            Food journal
          </ion-button>
          <ion-button router-link="/macronutrients" fill="clear">
            Macronutrients
          </ion-button>
        </header>

        <ion-progress-bar v-if="loading" type="indeterminate" aria-label="Loading nutrition history" />
        <ion-card v-if="errorMessage" class="message-card error-card">
          <ion-card-content role="alert">
            {{ errorMessage }}
            <ion-button fill="clear" @click="loadDashboard">Retry</ion-button>
          </ion-card-content>
        </ion-card>
        <ion-card v-if="healthError" class="message-card">
          <ion-card-content>{{ healthError }} Calorie summaries are still available.</ion-card-content>
        </ion-card>

        <section v-if="!user && !loading" class="auth-prompt">
          <span aria-hidden="true">🔒</span>
          <h2>Sign in to view your nutrition summary</h2>
          <ion-button router-link="/sign-in">Continue to sign in</ion-button>
        </section>

        <template v-else-if="user && !errorMessage">
          <section class="date-row" aria-label="Select summary date">
            <ion-item class="date-picker">
              <ion-input
                v-model="selectedDate"
                type="date"
                label="Selected date"
                label-placement="stacked"
                :max="today"
              />
            </ion-item>
          </section>

          <section class="summary-grid" aria-label="Daily calorie overview">
            <ion-card class="total-card">
              <ion-card-content>
                <span class="summary-label">Calories with available data</span>
                <strong>{{ calorieLabel(summary.caloriesKcal) }}</strong>
                <span class="summary-foot">{{ summary.entryCount }} logged {{ summary.entryCount === 1 ? 'food' : 'foods' }}</span>
              </ion-card-content>
            </ion-card>
            <ion-card class="status-card">
              <ion-card-content>
                <span class="summary-label">Nutrition data status</span>
                <strong :class="`status-${summary.status}`">{{ statusLabel(summary.status) }}</strong>
                <span class="summary-foot">{{ statusDescription }}</span>
              </ion-card-content>
            </ion-card>
          </section>

          <ion-card class="meal-card">
            <ion-card-content>
              <div class="section-heading">
                <div>
                  <p class="eyebrow">MEAL BREAKDOWN</p>
                  <h2>Calories by meal</h2>
                </div>
                <span>{{ summary.entriesWithCalories }} with data · {{ summary.entriesMissingCalories }} unavailable</span>
              </div>
              <ion-list lines="none">
                <ion-item v-for="meal in mealRows" :key="meal.category">
                  <ion-icon slot="start" :icon="meal.icon" />
                  <ion-label>
                    <h3>{{ meal.category }}</h3>
                    <p>{{ meal.entryCount }} {{ meal.entryCount === 1 ? 'entry' : 'entries' }}
                      <span v-if="meal.entriesMissingCalories"> · {{ meal.entriesMissingCalories }} without calorie data</span>
                    </p>
                  </ion-label>
                  <strong class="meal-calories">{{ calorieLabel(meal.caloriesKcal) }}</strong>
                </ion-item>
              </ion-list>
              <p v-if="summary.status === 'incomplete'" class="incomplete-note">
                Partial total: some foods have missing calorie or portion data.
              </p>
              <p v-else-if="summary.status === 'no-records'" class="incomplete-note">
                No food logs today; this does not confirm zero intake.
              </p>
            </ion-card-content>
          </ion-card>

          <ion-card class="weekly-card">
            <ion-card-content>
              <div class="section-heading">
                <div>
                  <p class="eyebrow">SEVEN-DAY VIEW</p>
                  <h2>Logged calorie trend</h2>
                </div>
                <span>Ending {{ formatDate(selectedDate) }}</span>
              </div>
              <p class="chart-note">No logs are shown as gaps, not zero intake.</p>
              <div class="week-chart" role="img" :aria-label="weeklyChartDescription">
                <div v-for="day in weeklyDays" :key="day.date" class="chart-day">
                  <span class="chart-value">
                    {{ day.caloriesKcal === null ? (day.status === 'no-records' ? '—' : 'Partial') : `${Math.round(day.caloriesKcal)} kcal` }}
                  </span>
                  <div class="bar-track">
                    <div
                      v-if="day.caloriesKcal !== null"
                      class="calorie-bar"
                      :class="{ 'bar-incomplete': day.status === 'incomplete' }"
                      :style="{ height: `${barHeight(day.caloriesKcal)}%` }"
                    />
                    <span v-else class="no-data-mark">{{ day.status === 'no-records' ? 'No log' : 'No kcal' }}</span>
                  </div>
                  <strong>{{ day.weekday }}</strong>
                  <span class="chart-date">{{ shortDate(day.date) }}</span>
                  <span class="chart-status" :class="`status-${day.status}`">{{ compactStatus(day.status) }}</span>
                </div>
              </div>
              <div class="chart-legend">
                <span><i class="legend-complete" /> Complete log nutrition</span>
                <span><i class="legend-incomplete" /> Partial / missing nutrition</span>
                <span>No log ≠ zero intake</span>
              </div>
            </ion-card-content>
          </ion-card>

          <ion-card v-if="healthProfile" class="profile-card">
            <ion-card-content>
              <p class="eyebrow">OPTIONAL PROFILE CONTEXT</p>
              <h2>Health profile</h2>
              <div class="profile-facts">
                <span v-if="ageLabel">Age: {{ ageLabel }}</span>
                <span v-if="healthProfile.heightCm !== null">Height: {{ healthProfile.heightCm }} cm</span>
                <span v-if="healthProfile.weightKg !== null">Weight: {{ healthProfile.weightKg }} kg</span>
                <span v-if="healthProfile.bmiValue !== null">BMI screening value: {{ healthProfile.bmiValue }}</span>
                <span v-if="healthProfile.activityLevel">Activity: {{ healthProfile.activityLevel }}</span>
                <span v-if="healthProfile.dietaryPreferences">Dietary preferences: {{ healthProfile.dietaryPreferences }}</span>
              </div>
              <p class="profile-note">Profile details are for context only, not calorie targets.</p>
              <ion-button router-link="/health-profile" fill="clear">Edit profile</ion-button>
            </ion-card-content>
          </ion-card>
          <p v-else-if="!healthError" class="profile-link">
            Health profile is optional. <ion-button router-link="/health-profile" fill="clear">Add profile context</ion-button>
          </p>
        </template>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { AuthenticatedUser as User } from '../services/authService';
import {
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
import { cafeOutline, fastFoodOutline, leafOutline, restaurantOutline } from 'ionicons/icons';
import AppNavigation from '../components/AppNavigation.vue';
import { observeAuth } from '../services/authService';
import { getHealthProfile } from '../services/healthProfileService';
import {
  foodConsumptionUpdatedEventName,
  listFoodConsumptions,
} from '../services/foodConsumptionService';
import { getLocalDate, type FoodConsumption, type MealCategory } from '../utils/foodConsumption';
import {
  getSevenDayCalories,
  summarizeDailyCalories,
  type CalorieDataStatus,
  type MealCalorieSummary,
} from '../utils/dailyNutrition';
import { calculateAge, type HealthProfile } from '../utils/healthProfile';

const user = ref<User | null>(null);
const records = ref<FoodConsumption[]>([]);
const healthProfile = ref<HealthProfile | null>(null);
const loading = ref(true);
const errorMessage = ref('');
const healthError = ref('');
const today = getLocalDate();
const selectedDate = ref(today);
let unsubscribe: (() => void) | undefined;
let foregroundListener: { remove: () => Promise<void> } | undefined;
let loadSequence = 0;

const summary = computed(() => summarizeDailyCalories(records.value, selectedDate.value));
const weeklyDays = computed(() => getSevenDayCalories(records.value, selectedDate.value));
const mealMetadata: Record<MealCategory, { icon: string }> = {
  Breakfast: { icon: cafeOutline },
  Lunch: { icon: restaurantOutline },
  Dinner: { icon: fastFoodOutline },
  Snacks: { icon: leafOutline },
};
const mealRows = computed(() => (['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const)
  .map((category) => ({
    ...summary.value.meals[category],
    category,
    icon: mealMetadata[category].icon,
  } satisfies MealCalorieSummary & { category: MealCategory; icon: string })));
const maximumCalories = computed(() => Math.max(
  1,
  ...weeklyDays.value.map((day) => day.caloriesKcal ?? 0),
));
const weeklyChartDescription = computed(() => weeklyDays.value.map((day) => (
  `${day.weekday}: ${day.status === 'no-records'
    ? 'no food records'
    : `${day.caloriesKcal ?? 'no available'} calories${day.status === 'incomplete' ? ', incomplete nutrition data' : ''}`}`
)).join('; '));
const statusDescription = computed(() => {
  if (summary.value.status === 'no-records') return 'No records for this date; intake is unknown.';
  if (summary.value.status === 'incomplete') return `${summary.value.entriesMissingCalories} logged entries need better nutrition or portion data.`;
  return 'Every saved food entry has a usable calorie estimate.';
});
const ageLabel = computed(() => {
  if (!healthProfile.value) return '';
  const age = healthProfile.value.dateOfBirth
    ? calculateAge(healthProfile.value.dateOfBirth)
    : healthProfile.value.age;
  if (age === null) return '';
  return age < 20 ? `${age} (BMI-for-age not calculated)` : `${age} years`;
});

onMounted(() => {
  unsubscribe = observeAuth((authenticatedUser) => {
    user.value = authenticatedUser;
    records.value = [];
    healthProfile.value = null;
    errorMessage.value = '';
    healthError.value = '';
    if (authenticatedUser) void loadDashboard();
    else loading.value = false;
  }, (error) => {
    loading.value = false;
    errorMessage.value = error.message;
  });
  window.addEventListener(foodConsumptionUpdatedEventName, handleConsumptionUpdated);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive && user.value) void loadDashboard();
  }).then((listener) => {
    foregroundListener = listener;
  }).catch((error: unknown) => {
    healthError.value = `Unable to monitor app refresh state: ${error instanceof Error ? error.message : String(error)}`;
  });
});

onUnmounted(() => {
  unsubscribe?.();
  window.removeEventListener(foodConsumptionUpdatedEventName, handleConsumptionUpdated);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  void foregroundListener?.remove();
});

async function loadDashboard(): Promise<void> {
  const authenticatedUser = user.value;
  if (!authenticatedUser) return;
  const sequence = ++loadSequence;
  loading.value = true;
  errorMessage.value = '';
  healthError.value = '';
  const [consumptionResult, profileResult] = await Promise.allSettled([
    listFoodConsumptions(authenticatedUser.uid),
    getHealthProfile(authenticatedUser.uid),
  ]);
  if (sequence !== loadSequence || user.value?.uid !== authenticatedUser.uid) return;
  if (consumptionResult.status === 'fulfilled') records.value = consumptionResult.value;
  else errorMessage.value = consumptionResult.reason instanceof Error
    ? consumptionResult.reason.message
    : String(consumptionResult.reason);
  if (profileResult.status === 'fulfilled') healthProfile.value = profileResult.value;
  else healthError.value = profileResult.reason instanceof Error
    ? profileResult.reason.message
    : String(profileResult.reason);
  loading.value = false;
}

function handleConsumptionUpdated(event: Event): void {
  const detail = (event as CustomEvent<{ userId?: string }>).detail;
  if (detail?.userId && detail.userId === user.value?.uid) void loadDashboard();
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible' && user.value) void loadDashboard();
}

function calorieLabel(value: number | null): string {
  return value === null ? 'Not available' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} kcal`;
}

function statusLabel(status: CalorieDataStatus): string {
  if (status === 'no-records') return 'No food records';
  return status === 'complete' ? 'Complete logged data' : 'Incomplete nutrition data';
}

function compactStatus(status: CalorieDataStatus): string {
  return status === 'no-records' ? 'No log' : status === 'complete' ? 'Complete' : 'Partial';
}

function barHeight(value: number): number {
  if (value <= 0) return 2;
  return Math.max(4, (value / maximumCalories.value) * 100);
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(year, month - 1, day));
}

function shortDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric' }).format(new Date(year, month - 1, day));
}
</script>

<style scoped>
.calorie-page { width: min(1050px, 100%); margin: 0 auto; padding: 26px 18px 56px; }
.calorie-hero { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 18px; padding: 27px; border-radius: 20px; background: linear-gradient(115deg, #123f35, #28785f); color: #fff; }
.calorie-hero .eyebrow { color: #bcebd0; }
.calorie-hero h1 { margin: 7px 0; font-size: clamp(1.7rem, 4vw, 2.35rem); }
.calorie-hero p:last-child { max-width: 650px; margin: 0; color: rgb(255 255 255 / 84%); line-height: 1.5; }
.calorie-hero ion-button { flex-shrink: 0; --color: #fff; --border-color: rgb(255 255 255 / 55%); }
.date-row { display: flex; align-items: center; gap: 14px; margin: 14px 0; }
.date-row > p, .chart-note, .profile-note { color: #6d7d72; font-size: .82rem; line-height: 1.5; }
.date-picker { min-width: 220px; --background: #fff; --border-radius: 10px; }
.summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
.summary-grid ion-card, .meal-card, .weekly-card, .profile-card { margin: 0 0 14px; border: 1px solid #e4ece6; border-radius: 15px; box-shadow: 0 5px 16px rgb(28 65 48 / 4%); }
.summary-grid ion-card-content { display: grid; min-height: 125px; align-content: center; gap: 5px; padding: 18px; }
.total-card { background: #f0f8f2; }
.summary-label, .summary-foot { color: #708077; font-size: .78rem; }
.total-card strong { color: #205c43; font-size: clamp(1.5rem, 4vw, 2rem); }
.status-card strong { font-size: 1.2rem; }
.status-complete { color: #24784d; }
.status-incomplete { color: #a66a1e; }
.status-no-records { color: #6d7d72; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.section-heading h2, .profile-card h2 { margin: 4px 0 0; color: #244737; font-size: 1.12rem; }
.section-heading > span { color: #748178; font-size: .75rem; text-align: right; }
.meal-card ion-card-content, .weekly-card ion-card-content, .profile-card ion-card-content { display: grid; gap: 10px; padding: 18px; }
.meal-card ion-item { --padding-start: 4px; --inner-padding-end: 4px; }
.meal-card ion-icon { color: #348263; }
.meal-card ion-label p { color: #7a867d; }
.meal-calories { color: #255f47; white-space: nowrap; font-size: .85rem; }
.incomplete-note { margin: 0; padding: 11px; border-radius: 9px; background: #fff7eb; color: #805821; font-size: .8rem; line-height: 1.45; }
.week-chart { display: grid; height: 245px; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; padding-top: 20px; border-bottom: 1px solid #dfe8e1; }
.chart-day { display: grid; min-width: 0; grid-template-rows: 22px 1fr 18px 17px 18px; justify-items: center; gap: 3px; }
.chart-value { overflow: hidden; max-width: 100%; color: #5e7065; font-size: .62rem; text-overflow: ellipsis; white-space: nowrap; }
.bar-track { position: relative; display: flex; width: min(33px, 70%); height: 100%; align-items: end; justify-content: center; overflow: hidden; border-radius: 7px 7px 2px 2px; background: #f0f4f0; }
.calorie-bar { width: 100%; min-height: 4px; border-radius: 6px 6px 0 0; background: linear-gradient(#52a37b, #287453); }
.calorie-bar.bar-incomplete { background: repeating-linear-gradient(135deg, #d29a4f 0 5px, #f1d7ad 5px 10px); }
.no-data-mark { position: absolute; top: 42%; color: #87938a; font-size: .55rem; writing-mode: vertical-rl; }
.chart-day > strong { color: #314d3d; font-size: .72rem; }
.chart-date { color: #7a867d; font-size: .63rem; }
.chart-status { overflow: hidden; max-width: 100%; font-size: .55rem; text-overflow: ellipsis; white-space: nowrap; }
.chart-legend { display: flex; flex-wrap: wrap; gap: 12px; color: #6d7d72; font-size: .7rem; }
.chart-legend span { display: inline-flex; align-items: center; gap: 5px; }
.chart-legend i { width: 12px; height: 12px; border-radius: 3px; }
.legend-complete { background: #348263; }
.legend-incomplete { background: repeating-linear-gradient(135deg, #d29a4f 0 3px, #f1d7ad 3px 6px); }
.profile-facts { display: flex; flex-wrap: wrap; gap: 8px; }
.profile-facts span { padding: 7px 10px; border-radius: 20px; background: #f1f7f2; color: #365845; font-size: .76rem; }
.profile-note { margin: 0; }
.profile-link { color: #6d7d72; }
.auth-prompt { padding: 35px 20px; text-align: center; }
.message-card { margin: 10px 0; }
@media (max-width: 600px) {
  .calorie-hero { align-items: flex-start; flex-direction: column; padding: 22px; }
  .date-row { align-items: stretch; flex-direction: column; gap: 3px; }
  .date-picker { width: 100%; }
  .summary-grid { grid-template-columns: 1fr; gap: 8px; }
  .summary-grid ion-card { margin: 0; }
  .week-chart { gap: 3px; }
  .chart-value { font-size: .54rem; }
  .chart-status { font-size: .48rem; }
}
</style>
