<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="micro-page">
        <header class="micro-hero">
          <div>
            <h1>Micronutrient tracking</h1>
          </div>
          <div class="hero-actions">
            <ion-button router-link="/macronutrients" fill="outline">
              <ion-icon slot="start" :icon="leafOutline" />
              Macronutrients
            </ion-button>
            <ion-button router-link="/consumption" fill="clear">
              <ion-icon slot="start" :icon="restaurantOutline" />
              Food journal
            </ion-button>
          </div>
        </header>

        <ion-progress-bar v-if="loading" type="indeterminate" aria-label="Loading micronutrient history" />
        <section v-if="loading" class="loading-state" aria-live="polite">
          <ion-spinner name="crescent" />
          <span>Loading your saved food logs…</span>
        </section>

        <ion-card v-if="errorMessage" class="error-card">
          <ion-card-content role="alert">
            {{ errorMessage }}
            <ion-button fill="clear" @click="loadData">Retry</ion-button>
          </ion-card-content>
        </ion-card>

        <section v-if="!user && !loading" class="auth-prompt">
          <h2>Sign in to view micronutrient analytics</h2>
          <ion-button router-link="/sign-in">Continue to sign in</ion-button>
        </section>

        <template v-else-if="user && !errorMessage">
          <section class="date-panel">
            <ion-button fill="outline" @click="isDatePickerOpen = true">
              <ion-icon slot="start" :icon="calendarOutline" />
              {{ selectedDate }}
            </ion-button>
            <div class="day-summary">
              <strong>{{ summary.entryCount }} {{ summary.entryCount === 1 ? 'food entry' : 'food entries' }}</strong>
              <ion-badge :color="summary.status === 'complete' ? 'success' : summary.status === 'partial' ? 'warning' : 'medium'">
                {{ overallStatus }}
              </ion-badge>
            </div>
          </section>
          <ion-modal :is-open="isDatePickerOpen" @didDismiss="isDatePickerOpen = false">
            <ion-datetime
              :value="selectedDate"
              presentation="date"
              :max="today"
              @ionChange="selectDate"
            />
            <ion-button expand="block" @click="isDatePickerOpen = false">Done</ion-button>
          </ion-modal>

          <ion-card class="nutrient-card">
            <ion-card-content>
              <div class="section-heading">
                <div>
                  <h2>Recorded nutrients</h2>
                </div>
              </div>
              <ion-segment v-model="selectedGroup" aria-label="Nutrient category">
                <ion-segment-button value="vitamins">Vitamins</ion-segment-button>
                <ion-segment-button value="minerals">Minerals</ion-segment-button>
                <ion-segment-button value="fiber">Fiber</ion-segment-button>
              </ion-segment>

              <ion-list lines="none" class="nutrient-list">
                <ion-item
                  v-for="value in visibleNutrients"
                  :key="value.nutrient.id"
                  button
                  detail
                  :class="{ 'selected-nutrient': selectedNutrient === value.nutrient.id }"
                  @click="selectedNutrient = value.nutrient.id"
                >
                  <ion-label>
                    <h3>{{ value.nutrient.label }}</h3>
                    <p>{{ nutrientStatus(value) }}</p>
                  </ion-label>
                  <strong class="nutrient-amount">{{ formatTotals(value.totals) }}</strong>
                </ion-item>
              </ion-list>
              <p v-if="summary.status === 'no-records'" class="notice">
                No food logs for this day; this does not confirm zero intake.
              </p>
              <p v-else class="notice incomplete-notice">
                Partial totals include foods with available data. Missing nutrients are not counted as zero.
              </p>
            </ion-card-content>
          </ion-card>

          <ion-card class="detail-card">
            <ion-card-content>
              <div class="section-heading">
                <div>
                  <h2>{{ selectedValue.nutrient.label }}</h2>
                </div>
                <ion-badge :color="selectedValue.status === 'available' ? 'success' : selectedValue.status === 'partial' ? 'warning' : 'medium'">
                  {{ nutrientStatus(selectedValue) }}
                </ion-badge>
              </div>
              <p class="total-amount">{{ formatTotals(selectedValue.totals) }}</p>
              <p v-if="selectedValue.totals.some((total) => !total.comparable)" class="notice">
                Some values use units that cannot be converted to {{ selectedValue.nutrient.unit }} and are shown separately.
              </p>
              <p v-if="selectedValue.entriesMissingData > 0" class="notice incomplete-notice">
                {{ selectedValue.entriesMissingData }} {{ selectedValue.entriesMissingData === 1 ? 'food lacks' : 'foods lack' }} {{ selectedValue.nutrient.label }} data. Totals are partial.
              </p>

              <h3 class="subheading">Food sources</h3>
              <ion-list v-if="availableSources.length" lines="inset">
                <ion-item v-for="source in availableSources" :key="source.recordId">
                  <ion-label>
                    <h3>{{ source.foodName }}</h3>
                    <p>{{ source.mealCategory }} · {{ source.comparable ? 'Comparable unit' : 'Reported unit; not directly comparable' }}</p>
                  </ion-label>
                  <span>{{ formatAmount(source.amount, source.unit) }}</span>
                </ion-item>
              </ion-list>
              <p v-else class="empty-detail">No compatible data for this nutrient today.</p>

              <h3 class="subheading">Contribution by meal</h3>
              <ion-list lines="inset">
                <ion-item v-for="meal in mealRows" :key="meal.name">
                  <ion-label>{{ meal.name }}</ion-label>
                  <span>{{ formatTotals(meal.totals) }}</span>
                </ion-item>
              </ion-list>

              <h3 class="subheading">Seven-day history</h3>
              <ion-list lines="inset">
                <ion-item v-for="day in trendDays" :key="day.date">
                  <ion-label>
                    <h3>{{ day.date }}</h3>
                    <p>{{ trendStatus(day.status) }}</p>
                  </ion-label>
                  <span>{{ day.amount === null ? 'Not Available' : formatAmount(day.amount, day.unit) }}</span>
                </ion-item>
              </ion-list>

              <MicronutrientTrendChart :days="trendDays" :nutrient-label="selectedValue.nutrient.label" />
            </ion-card-content>
          </ion-card>
        </template>
      </main>
      <ion-toast
        :is-open="Boolean(errorMessage)"
        :message="errorMessage"
        color="danger"
        :duration="4000"
        position="bottom"
        @didDismiss="errorMessage = ''"
      />
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
  IonSpinner,
  IonToast,
} from '@ionic/vue';
import { App as CapacitorApp } from '@capacitor/app';
import { calendarOutline, leafOutline, restaurantOutline } from 'ionicons/icons';
import AppNavigation from '../components/AppNavigation.vue';
import MicronutrientTrendChart from '../components/MicronutrientTrendChart.vue';
import { observeAuth } from '../services/authService';
import {
  foodConsumptionUpdatedEventName,
  listFoodConsumptions,
} from '../services/foodConsumptionService';
import { getLocalDate, type MealCategory } from '../utils/foodConsumption';
import {
  getMicronutrientTrend,
  micronutrientDefinitions,
  summarizeDailyMicronutrients,
  type MicronutrientGroup,
  type MicronutrientName,
  type MicronutrientStatus,
} from '../utils/micronutrients';

const user = ref<User | null>(null);
const loading = ref(true);
const errorMessage = ref('');
const today = getLocalDate();
const selectedDate = ref(today);
const selectedGroup = ref<MicronutrientGroup>('vitamins');
const selectedNutrient = ref<MicronutrientName>('vitaminC');
const isDatePickerOpen = ref(false);
const records = ref<Awaited<ReturnType<typeof listFoodConsumptions>>>([]);
let unsubscribe: (() => void) | undefined;
let foregroundListener: { remove: () => Promise<void> } | undefined;
let requestSequence = 0;

const summary = computed(() => summarizeDailyMicronutrients(records.value, selectedDate.value));
const visibleNutrients = computed(() => Object.values(summary.value.values)
  .filter((value) => value.nutrient.group === selectedGroup.value));
const selectedValue = computed(() => summary.value.values[selectedNutrient.value]);
const availableSources = computed(() => selectedValue.value.contributions
  .filter((contribution) => contribution.amount !== null));
const trendDays = computed(() => getMicronutrientTrend(records.value, selectedNutrient.value, selectedDate.value));
const overallStatus = computed(() => {
  if (summary.value.status === 'no-records') return 'No food records';
  return summary.value.status === 'complete' ? 'Available' : 'Partially available';
});
const mealRows = computed(() => (['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const)
  .map((name: MealCategory) => ({ name, totals: selectedValue.value.meals[name] })));

watch(selectedGroup, (group) => {
  const firstInGroup = micronutrientDefinitions.find((nutrient) => nutrient.group === group);
  if (firstInGroup) selectedNutrient.value = firstInGroup.id;
});
watch(selectedNutrient, (nutrient) => {
  const definition = micronutrientDefinitions.find((item) => item.id === nutrient);
  if (definition) selectedGroup.value = definition.group;
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

function nutrientStatus(value: { status: MicronutrientStatus; entriesWithData: number; entriesMissingData: number }): string {
  if (value.status === 'no-records') return 'No food records';
  if (value.status === 'unavailable') return 'Unavailable in saved food data';
  if (value.status === 'partial') return `Partially available · ${value.entriesWithData} of ${value.entriesWithData + value.entriesMissingData} foods`;
  return 'Available for all logged foods';
}

function formatTotals(totals: Array<{ amount: number; unit: string; comparable: boolean }>): string {
  if (!totals.length) return 'Not Available';
  return totals.map((total) => formatAmount(total.amount, total.unit)).join(' · ');
}

function formatAmount(amount: number | null, unit: string | null): string {
  if (amount === null || unit === null) return 'Not Available';
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount)} ${unit}`;
}

function trendStatus(status: MicronutrientStatus): string {
  if (status === 'no-records') return 'No food records; intake unknown';
  if (status === 'unavailable') return 'Foods logged; nutrient unavailable';
  if (status === 'partial') return 'Partial total or unit basis not comparable';
  return 'Available';
}

function selectDate(event: CustomEvent<{ value?: string | string[] | null }>): void {
  const value = event.detail.value;
  if (typeof value === 'string' && isValidDate(value) && value <= today) selectedDate.value = value;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}
</script>

<style scoped>
.micro-page { width: min(1120px, 100%); margin: 0 auto; padding: 26px 18px 56px; }
.micro-hero { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; padding: 27px; border-radius: 20px; background: linear-gradient(90deg, rgb(20 62 47 / 96%) 0%, rgb(25 91 56 / 90%) 58%, rgb(25 91 56 / 34%) 100%), url('/images/food-banner.svg') center / cover no-repeat; box-shadow: 0 14px 32px rgb(25 80 61 / 13%); color: #fff; }
.micro-hero .eyebrow { color: #bcebd0; }
.micro-hero h1 { margin: 7px 0; font-size: clamp(1.7rem, 4vw, 2.35rem); }
.micro-hero p:last-child { max-width: 680px; margin: 0; color: rgb(255 255 255 / 84%); line-height: 1.5; }
.hero-actions { display: flex; flex-wrap: wrap; flex-shrink: 0; }
.hero-actions ion-button { --color: #fff; --border-color: rgb(255 255 255 / 55%); }
.date-panel { display: flex; align-items: center; gap: 14px; margin: 14px 0; }
.date-panel ion-item { min-width: 190px; --background: #fff; --border-radius: 10px; }
.day-summary { display: grid; grid-template-columns: auto auto; align-items: center; gap: 5px 10px; color: #294c3a; }
.day-summary p { grid-column: 1 / -1; margin: 0; color: #6d7d72; font-size: .8rem; }
.nutrient-card, .detail-card { margin: 0 0 14px; border: 1px solid #e4ece6; border-radius: 15px; box-shadow: 0 5px 16px rgb(28 65 48 / 4%); }
.nutrient-card ion-card-content, .detail-card ion-card-content { display: grid; gap: 13px; padding: 18px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.eyebrow { margin: 0; color: #2f8568; font-size: .69rem; font-weight: 750; letter-spacing: .1em; }
.section-heading h2 { margin: 4px 0 0; color: #244737; font-size: 1.12rem; }
.nutrient-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; background: transparent; }
.nutrient-list ion-item { --background: #f7faf7; --border-radius: 9px; --inner-padding-end: 10px; }
.nutrient-list ion-item.selected-nutrient { --background: #eaf5ee; }
.nutrient-list ion-label h3, .detail-card ion-item h3 { color: #294c3a; font-weight: 650; }
.nutrient-list ion-label p, .detail-card ion-item p { color: #77857c; font-size: .72rem; }
.nutrient-amount { margin-left: 8px; color: #284a39; font-size: .8rem; text-align: right; }
.total-amount { margin: 0; color: #244737; font-size: 1.65rem; font-weight: 750; }
.subheading { margin: 5px 0 -7px; color: #315a46; font-size: .9rem; }
.detail-card ion-item { --padding-start: 4px; --inner-padding-end: 4px; }
.detail-card ion-item > span { color: #284a39; font-size: .8rem; text-align: right; }
.notice { margin: 0; padding: 11px; border-radius: 9px; background: #f2f6f2; color: #65756a; font-size: .79rem; line-height: 1.5; }
.incomplete-notice { background: #fff7eb; color: #805821; }
.empty-detail { color: #77857c; font-size: .82rem; }
.loading-state { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 28px; color: #65756a; }
.auth-prompt { padding: 35px 20px; text-align: center; }
.error-card { margin: 10px 0; }
@media (max-width: 720px) {
  .micro-hero { align-items: flex-start; flex-direction: column; padding: 22px; }
  .date-panel { align-items: stretch; flex-direction: column; gap: 8px; }
  .nutrient-list { grid-template-columns: 1fr; }
}
</style>
