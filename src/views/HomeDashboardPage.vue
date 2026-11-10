<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="home-page">
        <header class="greeting-row">
          <div class="greeting-copy">
            <p class="eyebrow">{{ todayLabel }}</p>
            <h1>{{ greeting }}, {{ userName }}</h1>
          </div>
        </header>

        <section class="food-banner" aria-label="Eat, track, manage, improve">
          <div class="banner-copy">
            <span class="banner-kicker">PANTRY &amp; PLATE</span>
            <h2>Eat · Track · Manage · Improve</h2>
            <ion-button router-link="/consumption" color="light">
              Log a meal
              <ion-icon slot="end" :icon="arrowForwardOutline" />
            </ion-button>
          </div>
        </section>

        <ion-progress-bar v-if="loading" type="indeterminate" aria-label="Loading your dashboard" />
        <ion-card v-if="errorMessage" class="message-card error-card">
          <ion-card-content role="alert">
            {{ errorMessage }}
            <ion-button fill="clear" @click="loadDashboard">Retry</ion-button>
          </ion-card-content>
        </ion-card>
        <ion-card v-if="healthError" class="message-card">
          <ion-card-content>{{ healthError }} Other dashboard information is still available.</ion-card-content>
        </ion-card>

        <section class="profile-section" aria-labelledby="profile-title">
          <div class="section-heading">
            <div>
              <h2 id="profile-title">Health profile</h2>
            </div>
            <ion-button fill="clear" router-link="/health-profile">
              {{ healthProfile ? 'Edit profile' : 'Set up' }}
            </ion-button>
          </div>
          <ion-card class="profile-card">
            <ion-card-content v-if="healthProfile">
              <span class="profile-icon"><ion-icon :icon="personOutline" /></span>
              <div class="profile-main">
                <strong>My health profile</strong>
                <p v-if="profileFacts.length">{{ profileFacts.join(' · ') }}</p>
                <p v-else>Your profile is saved. Add details anytime if you choose.</p>
              </div>
              <ion-button fill="outline" router-link="/health-profile">View</ion-button>
            </ion-card-content>
            <ion-card-content v-else>
              <span class="profile-icon"><ion-icon :icon="personOutline" /></span>
              <div class="profile-main">
                <strong>Complete your health profile</strong>
                <p>This information is optional and stays private to your account.</p>
              </div>
              <ion-button router-link="/health-profile">Get started</ion-button>
            </ion-card-content>
          </ion-card>
        </section>

        <section class="quick-section" aria-labelledby="quick-title">
          <div class="section-heading">
            <div>
              <h2 id="quick-title">Quick actions</h2>
            </div>
          </div>
          <div class="quick-grid">
            <router-link
              v-for="action in quickActions"
              :key="action.title"
              :to="action.route"
              class="quick-card"
              :class="action.className"
            >
              <span class="quick-icon"><ion-icon :icon="action.icon" /></span>
              <span class="quick-copy">
                <strong>{{ action.title }}</strong>
              </span>
              <ion-icon class="quick-arrow" :icon="arrowForwardOutline" />
            </router-link>
          </div>
        </section>

        <section class="nutrition-section" aria-labelledby="nutrition-title">
          <div class="section-heading">
            <div>
              <h2 id="nutrition-title">Nutrition summary</h2>
            </div>
            <ion-button fill="clear" router-link="/daily-nutrition">
              View analytics
              <ion-icon slot="end" :icon="arrowForwardOutline" />
            </ion-button>
          </div>
          <ion-card class="nutrition-card">
            <ion-card-content>
              <div class="calorie-summary">
                <span class="nutrition-icon"><ion-icon :icon="flameOutline" /></span>
                <div>
                  <small>Calories with available data</small>
                  <strong>{{ formatCalories(calorieSummary.caloriesKcal) }}</strong>
                  <span>{{ calorieSummary.entryCount }} logged {{ calorieSummary.entryCount === 1 ? 'food' : 'foods' }} · {{ calorieStatus }}</span>
                </div>
              </div>
              <div class="macro-summary">
                <div v-for="metric in macroMetrics" :key="metric.name" :class="`macro-value ${metric.color}`">
                  <span>{{ metric.label }}</span>
                  <strong>{{ formatGrams(macroSummary[metric.field]) }}</strong>
                </div>
              </div>
              <p v-if="calorieSummary.status === 'incomplete'" class="notice notice-warn">
                Calorie and nutrient totals include only available data; some logged foods have missing nutrition or portion information.
              </p>
              <p v-else-if="calorieSummary.status === 'no-records'" class="notice">
                No food records were logged today. This does not mean no food was consumed.
              </p>
            </ion-card-content>
          </ion-card>
        </section>

        <section class="trends-section" aria-labelledby="trends-title">
          <div class="section-heading">
            <div>
              <p class="eyebrow">LAST 7 DAYS</p>
              <h2 id="trends-title">Nutrition trends</h2>
            </div>
            <ion-button fill="clear" router-link="/daily-nutrition">
              View analytics
              <ion-icon slot="end" :icon="arrowForwardOutline" />
            </ion-button>
          </div>
          <ion-card class="trend-card">
            <ion-card-content>
              <div v-if="loading" class="loading-state"><ion-spinner name="crescent" /> Loading saved food logs…</div>
              <div v-else-if="!records.length && !errorMessage" class="empty-state">
                <ion-icon :icon="analyticsOutline" />
                <strong>No food logs yet</strong>
                <span>Log a meal to start seeing recorded nutrition trends.</span>
                <ion-button fill="outline" router-link="/consumption">Log food</ion-button>
              </div>
              <template v-else>
                <div class="trend-chart" role="img" :aria-label="trendDescription">
                  <div v-for="day in weeklyDays" :key="day.date" class="trend-day">
                    <span class="trend-value">
                      {{ day.caloriesKcal === null ? (day.status === 'no-records' ? '—' : 'Partial') : `${Math.round(day.caloriesKcal)}` }}
                    </span>
                    <div class="trend-track">
                      <span
                        v-if="day.caloriesKcal !== null"
                        class="trend-bar"
                        :class="{ 'trend-bar-partial': day.status === 'incomplete' }"
                        :style="{ height: `${barHeight(day.caloriesKcal)}%` }"
                      />
                      <span v-else class="trend-empty">{{ day.status === 'no-records' ? 'No log' : 'No kcal' }}</span>
                    </div>
                    <strong>{{ day.weekday }}</strong>
                    <small>{{ day.date.slice(5) }}</small>
                  </div>
                </div>
                <div class="trend-legend">
                  <span><i class="legend-recorded" /> Available recorded calories</span>
                  <span><i class="legend-incomplete" /> Partial data</span>
                  <span>No logs ≠ zero intake</span>
                </div>
              </template>
            </ion-card-content>
          </ion-card>
        </section>

        <section class="movement-section" aria-labelledby="movement-title">
          <div class="section-heading">
            <div>
              <h2 id="movement-title">Movement &amp; meal planning</h2>
            </div>
          </div>
          <ion-card class="activity-card">
            <ion-card-content>
              <span class="activity-icon"><ion-icon :icon="fitnessOutline" /></span>
              <div>
                <strong>Today's movement</strong>
                <p>{{ exerciseMinutes === null ? '—' : `${exerciseMinutes} min` }} · {{ exerciseSessions === null ? '—' : exerciseSessions }} completed {{ exerciseSessions === 1 ? 'session' : 'sessions' }} · {{ exerciseCalories === null ? '—' : `${exerciseCalories} kcal estimated` }}</p>
              </div>
              <ion-button fill="clear" router-link="/exercise">View</ion-button>
            </ion-card-content>
          </ion-card>
          <div class="other-tools">
            <router-link to="/exercise" class="tool-link">
              <ion-icon :icon="fitnessOutline" />
              <span><strong>Exercise &amp; movement</strong><small>Workouts and activity history</small></span>
              <ion-icon :icon="arrowForwardOutline" />
            </router-link>
            <router-link to="/weekly-nutrition" class="tool-link">
              <ion-icon :icon="calendarOutline" />
              <span><strong>Weekly meal plan</strong><small>Explore pantry-aware suggestions</small></span>
              <ion-icon :icon="arrowForwardOutline" />
            </router-link>
          </div>
        </section>
      </main>
      <ion-toast
        :is-open="Boolean(activityError)"
        :message="activityError"
        color="warning"
        :duration="3500"
        position="bottom"
        @didDismiss="activityError = ''"
      />
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
  IonPage,
  IonProgressBar,
  IonSpinner,
  IonToast,
} from '@ionic/vue';
import { App as CapacitorApp } from '@capacitor/app';
import {
  analyticsOutline,
  arrowForwardOutline,
  basketOutline,
  calendarOutline,
  cartOutline,
  flameOutline,
  fitnessOutline,
  leafOutline,
  personOutline,
  restaurantOutline,
  scanOutline,
} from 'ionicons/icons';
import AppNavigation from '../components/AppNavigation.vue';
import { observeAuth } from '../services/authService';
import { getHealthProfile } from '../services/healthProfileService';
import { foodConsumptionUpdatedEventName, listFoodConsumptions } from '../services/foodConsumptionService';
import { getWorkoutHistory } from '../services/exerciseService';
import { calculateAge, type HealthProfile } from '../utils/healthProfile';
import { getLocalDate, type FoodConsumption } from '../utils/foodConsumption';
import {
  getSevenDayCalories,
  summarizeDailyCalories,
  summarizeDailyMacronutrients,
} from '../utils/dailyNutrition';

const user = ref<User | null>(null);
const records = ref<FoodConsumption[]>([]);
const healthProfile = ref<HealthProfile | null>(null);
const loading = ref(true);
const errorMessage = ref('');
const healthError = ref('');
const activityError = ref('');
const today = getLocalDate();
let unsubscribe: (() => void) | undefined;
let foregroundListener: { remove: () => Promise<void> } | undefined;
let requestSequence = 0;

const todayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
const greeting = computed(() => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
});
const userName = computed(() => {
  const name = user.value?.displayName?.trim();
  return name ? name.split(/\s+/)[0] : 'there';
});
const calorieSummary = computed(() => summarizeDailyCalories(records.value, today));
const macroSummary = computed(() => summarizeDailyMacronutrients(records.value, today));
const weeklyDays = computed(() => getSevenDayCalories(records.value, today));
const maximumCalories = computed(() => Math.max(1, ...weeklyDays.value.map((day) => day.caloriesKcal ?? 0)));
const calorieStatus = computed(() => calorieSummary.value.status === 'no-records'
  ? 'No food records'
  : calorieSummary.value.status === 'incomplete' ? 'Partial data' : 'Complete logged data');
const trendDescription = computed(() => weeklyDays.value.map((day) => (
  `${day.weekday}: ${day.status === 'no-records'
    ? 'no food records; intake unknown'
    : `${day.caloriesKcal ?? 'no available'} calories${day.status === 'incomplete' ? ', incomplete nutrition data' : ''}`}`
)).join('; '));
const macroMetrics = [
  { name: 'protein', label: 'Protein', field: 'proteinG', color: 'green' },
  { name: 'carbohydrates', label: 'Carbs', field: 'carbohydratesG', color: 'blue' },
  { name: 'totalFat', label: 'Fats', field: 'totalFatG', color: 'orange' },
] as const;
const quickActions = [
  { title: 'Log food', route: '/consumption', icon: restaurantOutline, className: 'action-meals' },
  { title: 'Food inventory', route: '/inventory', icon: basketOutline, className: 'action-inventory' },
  { title: 'Grocery list', route: '/grocery-list', icon: cartOutline, className: 'action-plan' },
  { title: 'Scan barcode', route: '/inventory', icon: scanOutline, className: 'action-scan' },
  { title: 'Nutrition analytics', route: '/daily-nutrition', icon: analyticsOutline, className: 'action-analytics' },
  { title: 'Weekly meal plan', route: '/weekly-nutrition', icon: leafOutline, className: 'action-plan' },
] as const;
const profileFacts = computed(() => {
  if (!healthProfile.value) return [];
  const profile = healthProfile.value;
  const age = profile.dateOfBirth ? calculateAge(profile.dateOfBirth) : profile.age;
  const facts = [];
  if (profile.bmiValue !== null) facts.push(`BMI ${profile.bmiValue} · screening only`);
  if (profile.activityLevel) facts.push(profile.activityLevel);
  if (age !== null) facts.push(`${age} years`);
  return facts;
});
const exerciseMinutes = ref<number | null>(null);
const exerciseSessions = ref<number | null>(null);
const exerciseCalories = ref<number | null>(null);

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
  try {
    const workoutHistory = getWorkoutHistory();
    const todaysWorkouts = workoutHistory.filter((workout) => workout.workoutDate.slice(0, 10) === today);
    exerciseMinutes.value = todaysWorkouts.reduce((sum, workout) => sum + workout.durationMinutes, 0);
    exerciseSessions.value = todaysWorkouts.length;
    exerciseCalories.value = todaysWorkouts.reduce((sum, workout) => sum + workout.estimatedCalories, 0);
  } catch (error) {
    activityError.value = `Unable to load activity history: ${error instanceof Error ? error.message : String(error)}`;
  }
  void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive && user.value) void loadDashboard();
  }).then((listener) => {
    foregroundListener = listener;
  }).catch((error: unknown) => {
    activityError.value = `Unable to monitor refresh state: ${error instanceof Error ? error.message : String(error)}`;
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
  const sequence = ++requestSequence;
  loading.value = true;
  errorMessage.value = '';
  healthError.value = '';
  const [consumptionResult, profileResult] = await Promise.allSettled([
    listFoodConsumptions(authenticatedUser.uid),
    getHealthProfile(authenticatedUser.uid),
  ]);
  if (sequence !== requestSequence || user.value?.uid !== authenticatedUser.uid) return;
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

function formatCalories(value: number | null): string {
  return value === null
    ? 'Not available'
    : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} kcal`;
}

function formatGrams(value: number | null): string {
  return value === null
    ? 'Not available'
    : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} g`;
}

function barHeight(value: number): number {
  return value <= 0 ? 2 : Math.max(4, (value / maximumCalories.value) * 100);
}
</script>

<style scoped>
.home-page { width: min(1120px, 100%); margin: 0 auto; padding: 22px 20px 52px; }
.greeting-row, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.greeting-row { margin-bottom: 20px; }
.greeting-copy h1 { margin: 5px 0; color: var(--app-text); font-size: clamp(1.6rem, 4vw, 2rem); letter-spacing: -.035em; }
.greeting-copy > p:last-child { margin: 0; color: var(--app-muted); font-size: .86rem; }
.eyebrow { margin: 0; color: var(--app-green); font-size: .68rem; font-weight: 750; letter-spacing: .11em; }
.alert-button { width: 44px; height: 44px; --border-radius: 50%; --background: var(--app-card); --color: var(--app-green); box-shadow: 0 3px 12px rgb(22 55 43 / 8%); }
.food-banner { position: relative; display: flex; min-height: 220px; align-items: center; overflow: hidden; margin-bottom: 25px; padding: 28px clamp(22px, 5vw, 48px); border-radius: 23px; background: #1b5e20 url('/images/food-banner.svg') center / cover no-repeat; box-shadow: 0 12px 28px rgb(27 94 32 / 16%); }
.banner-copy { position: relative; z-index: 1; width: min(520px, 74%); color: #fff; }
.banner-kicker { color: #d7edca; font-size: .67rem; font-weight: 750; letter-spacing: .13em; }
.banner-copy h2 { margin: 7px 0; font-size: clamp(1.45rem, 4vw, 2rem); line-height: 1.18; }
.banner-copy p { margin: 0 0 14px; color: rgb(255 255 255 / 84%); font-size: .82rem; }
.banner-copy ion-button { --border-radius: 11px; --color: #1b5e20; text-transform: none; }
.message-card { margin: 0 0 16px; border: 1px solid var(--app-border); border-radius: 14px; }
.error-card { border-color: #e6aaa3; }
.profile-section, .quick-section, .nutrition-section, .trends-section, .movement-section { margin-top: 25px; }
.section-heading { margin-bottom: 12px; }
.section-heading h2 { margin: 4px 0 0; color: var(--app-text); font-size: 1.13rem; }
.section-heading > ion-button { --color: var(--app-green); font-size: .77rem; text-transform: none; }
.profile-card, .nutrition-card, .trend-card { margin: 0; border: 1px solid var(--app-border); border-radius: 16px; background: var(--app-card); box-shadow: 0 5px 18px rgb(22 55 43 / 5%); }
.profile-card ion-card-content { display: flex; align-items: center; gap: 13px; padding: 16px; }
.profile-icon, .nutrition-icon { display: grid; width: 43px; height: 43px; flex: 0 0 43px; place-items: center; border-radius: 14px; background: #e8f5e9; color: #2e7d32; font-size: 1.2rem; }
.profile-main { flex: 1; min-width: 0; }
.profile-main strong { color: var(--app-text); font-size: .9rem; }
.profile-main p { margin: 4px 0 0; color: var(--app-muted); font-size: .73rem; line-height: 1.45; }
.profile-card ion-button { flex: 0 0 auto; --border-radius: 10px; text-transform: none; }
.quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.quick-card { display: flex; min-width: 0; min-height: 80px; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--app-border); border-radius: 15px; background: var(--app-card); color: inherit; text-decoration: none; box-shadow: 0 3px 12px rgb(22 55 43 / 4%); transition: transform .16s ease, box-shadow .16s ease; }
.quick-card:active { transform: scale(.98); box-shadow: 0 1px 5px rgb(22 55 43 / 8%); }
.quick-icon { display: grid; width: 40px; height: 40px; flex: 0 0 40px; place-items: center; border-radius: 13px; font-size: 1.1rem; }
.action-meals .quick-icon { background: #e8f5e9; color: #2e7d32; }
.action-inventory .quick-icon { background: #f0eafe; color: #805ad5; }
.action-scan .quick-icon { background: #fce8f1; color: #d44787; }
.action-analytics .quick-icon { background: #e5f4fb; color: #1687ae; }
.action-plan .quick-icon { background: #fff4dc; color: #c58314; }
.quick-copy { display: grid; flex: 1; min-width: 0; gap: 3px; }
.quick-copy strong { overflow: hidden; color: var(--app-text); font-size: .78rem; text-overflow: ellipsis; white-space: nowrap; }
.quick-copy small { color: var(--app-muted); font-size: .65rem; line-height: 1.3; }
.quick-arrow { flex: 0 0 auto; color: #8b9690; font-size: .85rem; }
.unavailable-card { background: #f8f9f8; opacity: .8; }
.unavailable-card .quick-icon { background: #fff4dc; color: #c58314; }
.unavailable-card ion-badge { font-size: .59rem; }
.nutrition-card ion-card-content { display: grid; gap: 15px; padding: 17px; }
.calorie-summary { display: flex; align-items: center; gap: 12px; }
.calorie-summary > div { display: grid; gap: 4px; }
.calorie-summary small { color: var(--app-muted); font-size: .72rem; }
.calorie-summary strong { color: var(--app-green-dark); font-size: 1.45rem; }
.calorie-summary span:last-child { color: var(--app-muted); font-size: .66rem; }
.nutrition-icon { background: #fff1df; color: #e68a17; }
.macro-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.macro-value { display: grid; gap: 5px; padding: 10px; border-radius: 11px; background: #f3f7f3; }
.macro-value span { color: var(--app-muted); font-size: .68rem; }
.macro-value strong { color: var(--app-text); font-size: .87rem; }
.macro-value.green { background: #eaf5e9; }
.macro-value.green strong { color: #388e3c; }
.macro-value.blue { background: #eaf3ff; }
.macro-value.blue strong { color: #1976d2; }
.macro-value.orange { background: #fff4e5; }
.macro-value.orange strong { color: #ef8f00; }
.notice { margin: 0; padding: 10px; border-radius: 9px; background: #f1f5f2; color: #627068; font-size: .72rem; line-height: 1.45; }
.notice-warn { background: #fff7e9; color: #805821; }
.trend-card ion-card-content { padding: 16px; }
.trend-chart { display: grid; min-height: 210px; grid-template-columns: repeat(7, minmax(0, 1fr)); align-items: end; gap: 7px; }
.trend-day { display: grid; min-width: 0; grid-template-rows: 22px 130px auto auto; justify-items: center; gap: 4px; color: var(--app-muted); font-size: .68rem; }
.trend-value { max-width: 100%; overflow: hidden; color: var(--app-text); font-size: .6rem; text-overflow: ellipsis; white-space: nowrap; }
.trend-track { position: relative; display: flex; width: min(30px, 72%); height: 100%; align-items: flex-end; justify-content: center; overflow: hidden; border-radius: 8px; background: #f0f4f1; }
.trend-bar { width: 100%; min-height: 3px; border-radius: 8px 8px 0 0; background: #2e7d32; }
.trend-bar-partial { background: #e4a449; }
.trend-empty { position: absolute; top: 50%; left: 50%; width: max-content; color: #7d8881; font-size: .55rem; transform: translate(-50%, -50%) rotate(-90deg); }
.trend-day strong { color: var(--app-text); }
.trend-day small { font-size: .6rem; }
.trend-legend { display: flex; flex-wrap: wrap; gap: 11px; margin-top: 10px; color: var(--app-muted); font-size: .65rem; }
.trend-legend span { display: inline-flex; align-items: center; gap: 5px; }
.trend-legend i { width: 8px; height: 8px; border-radius: 50%; background: #2e7d32; }
.trend-legend .legend-incomplete { background: #e4a449; }
.empty-state, .loading-state { display: grid; min-height: 170px; justify-items: center; align-content: center; gap: 8px; color: var(--app-muted); font-size: .78rem; text-align: center; }
.empty-state ion-icon { color: var(--app-green); font-size: 1.8rem; }
.empty-state strong { color: var(--app-text); }
.other-tools { display: grid; gap: 8px; }
.activity-card { margin: 0 0 9px; border: 1px solid var(--app-border); border-radius: 14px; background: var(--app-card); }
.activity-card ion-card-content { display: flex; align-items: center; gap: 11px; padding: 13px; }
.activity-icon { display: grid; width: 38px; height: 38px; flex: 0 0 38px; place-items: center; border-radius: 12px; background: #eaf3ff; color: #5573b4; font-size: 1.1rem; }
.activity-card > ion-card-content > div { flex: 1; min-width: 0; }
.activity-card strong { color: var(--app-text); font-size: .79rem; }
.activity-card p { margin: 4px 0 0; color: var(--app-muted); font-size: .68rem; line-height: 1.4; }
.activity-card ion-button { --color: var(--app-green); font-size: .73rem; text-transform: none; }
.tool-link { display: flex; align-items: center; gap: 12px; padding: 13px; border: 1px solid var(--app-border); border-radius: 13px; background: var(--app-card); color: inherit; text-decoration: none; }
.tool-link > ion-icon:first-child { color: var(--app-green); font-size: 1.2rem; }
.tool-link > ion-icon:last-child { margin-left: auto; color: #8b9690; font-size: .9rem; }
.tool-link span { display: grid; gap: 3px; }
.tool-link strong { color: var(--app-text); font-size: .79rem; }
.tool-link small { color: var(--app-muted); font-size: .68rem; }
@media (min-width: 760px) {
  .home-page { padding-top: 28px; }
  .food-banner { min-height: 250px; }
  .quick-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 13px; }
  .other-tools { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 420px) {
  .home-page { padding-right: 13px; padding-left: 13px; }
  .quick-grid { gap: 7px; }
  .quick-card { min-height: 72px; gap: 7px; padding: 9px; }
  .quick-icon { width: 35px; height: 35px; flex-basis: 35px; }
  .quick-copy strong { font-size: .7rem; }
  .quick-copy small { font-size: .6rem; }
  .calorie-summary strong { font-size: 1.25rem; }
  .trend-chart { gap: 3px; }
}
</style>
