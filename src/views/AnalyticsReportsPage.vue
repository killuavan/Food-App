<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="reports-page">
        <header class="reports-hero">
          <div>
            <h1>Analytics &amp; reports</h1>
          </div>
          <ion-item class="period-select">
            <ion-select v-model="period" label="Reporting period" interface="popover">
              <ion-select-option value="today">Today</ion-select-option>
              <ion-select-option value="last7">Last 7 days</ion-select-option>
              <ion-select-option value="last30">Last 30 days</ion-select-option>
              <ion-select-option value="month">Current month</ion-select-option>
              <ion-select-option value="custom">Custom range</ion-select-option>
            </ion-select>
          </ion-item>
        </header>

        <section v-if="period === 'custom'" class="date-range">
          <ion-item>
            <ion-input v-model="customStart" type="date" label="From" label-placement="stacked" />
          </ion-item>
          <ion-item>
            <ion-input v-model="customEnd" type="date" label="To" label-placement="stacked" />
          </ion-item>
        </section>
        <p v-if="range" class="range-caption">{{ range.startDate }} – {{ range.endDate }} · {{ timeZone }}</p>

        <ion-progress-bar v-if="loading" type="indeterminate" aria-label="Loading analytics" />
        <ion-card v-if="errorMessage" class="error-card">
          <ion-card-content role="alert">
            {{ errorMessage }}
            <ion-button fill="clear" :disabled="loading" @click="loadData">Retry</ion-button>
          </ion-card-content>
        </ion-card>

        <ion-segment v-model="activeSection" scrollable class="report-tabs" aria-label="Analytics sections">
          <ion-segment-button value="overview">Overview</ion-segment-button>
          <ion-segment-button value="foods">Food logs</ion-segment-button>
          <ion-segment-button value="inventory">Inventory</ion-segment-button>
          <ion-segment-button value="expiration">Expiration</ion-segment-button>
          <ion-segment-button value="plans">Meal plans</ion-segment-button>
          <ion-segment-button value="waste">Waste</ion-segment-button>
          <ion-segment-button value="export">Export</ion-segment-button>
        </ion-segment>

        <section v-if="!user && !loading" class="empty-card">
          <h2>Sign in to view your reports</h2>
          <ion-button router-link="/sign-in">Sign in</ion-button>
        </section>

        <template v-else-if="user && !loading && !errorMessage">
          <section v-if="activeSection === 'overview'" class="section-stack">
            <div class="summary-grid">
              <ion-card class="summary-card">
                <ion-card-content><span>Recorded calories</span><strong>{{ formatValue(consumption?.totalRecordedCaloriesKcal) }} <small>kcal</small></strong></ion-card-content>
              </ion-card>
              <ion-card class="summary-card">
                <ion-card-content><span>Food logs</span><strong>{{ consumption?.totalFoodLogs ?? 0 }}</strong></ion-card-content>
              </ion-card>
              <ion-card class="summary-card">
                <ion-card-content><span>Days with logs</span><strong>{{ consumption?.daysWithLoggedFoods ?? 0 }}</strong></ion-card-content>
              </ion-card>
              <ion-card class="summary-card">
                <ion-card-content><span>Calorie data coverage</span><strong>{{ formatPercent(consumption?.nutritionCompletenessPercent) }}</strong></ion-card-content>
              </ion-card>
            </div>

            <ion-card class="report-card">
              <ion-card-content>
                <h2>Daily recorded calories</h2>
                <ReportChart v-if="consumption?.totalFoodLogs"
                  type="line"
                  label="Daily recorded calorie trend"
                  :labels="dayLabels"
                  :datasets="[{ label: 'Recorded calories (kcal)', data: calorieValues, color: '#398567' }]"
                  axis-title="kcal"
                />
                <p v-else class="empty-copy">No food logs in this period.</p>
                <p class="data-note">Missing food logs are not treated as zero intake. Partial data includes only saved nutrition snapshots with usable amounts.</p>
              </ion-card-content>
            </ion-card>

            <div class="summary-grid">
              <ion-card v-for="macro in macroCards" :key="macro.name" class="summary-card">
                <ion-card-content><span>{{ macro.label }}</span><strong>{{ formatValue(consumption?.macros[macro.name]) }} <small>g</small></strong><small>{{ consumption?.macroEntriesWithData[macro.name] ?? 0 }} logs with data</small></ion-card-content>
              </ion-card>
            </div>
            <ion-card class="report-card">
              <ion-card-content>
                <h2>Macronutrient trends</h2>
                <ReportChart v-if="hasMacroData"
                  type="bar"
                  label="Daily macronutrient trends"
                  :labels="dayLabels"
                  :datasets="macroDatasets"
                  axis-title="g"
                />
                <p v-else class="empty-copy">No macro data is available in this period.</p>
                <p class="data-note">Macro energy distribution uses available saved nutrients only (4/4/9 kcal per gram); it may be partial and may not equal reported food calories.</p>
                <h3 class="subheading">Macro energy distribution</h3>
                <ReportChart
                  v-if="macroDistributionValues.length"
                  type="doughnut"
                  label="Macronutrient energy distribution"
                  :labels="macroDistributionLabels"
                  :datasets="[{ label: 'Macro energy (kcal)', data: macroDistributionValues, color: '#398567' }]"
                />
                <p v-else class="empty-copy">No comparable macronutrient data in this period.</p>
              </ion-card-content>
            </ion-card>

            <ion-card class="report-card">
              <ion-card-content>
                <h2>Micronutrient trend</h2>
                <ion-item class="nutrient-picker">
                  <ion-select v-model="selectedNutrient" label="Nutrient" interface="popover">
                    <ion-select-option v-for="definition in micronutrientDefinitions" :key="definition.id" :value="definition.id">
                      {{ definition.label }}
                    </ion-select-option>
                  </ion-select>
                </ion-item>
                <ReportChart
                  v-if="microGroup"
                  type="line"
                  :label="`${selectedNutrientDefinition.label} recorded trend`"
                  :labels="dayLabels"
                  :datasets="microDatasets"
                  :axis-title="microUnit"
                />
                <p v-else class="empty-copy">No consistent nutrient unit is available to plot this range.</p>
                <p class="data-note">
                  {{ microGroup ? `Unavailable nutrients are left blank · ${microGroup.comparable ? 'comparable' : 'reported'} unit: ${microUnit}.` : '' }}
                  Food logs do not diagnose nutrient deficiencies.
                </p>
                <h3 class="subheading">Food sources</h3>
                <ion-list v-if="microSources.length" lines="none">
                  <ion-item v-for="source in microSources" :key="`${source.foodName}:${source.unit}`">
                    <ion-label>{{ source.foodName }}</ion-label>
                    <span>{{ formatValue(source.amount) }} {{ source.unit }}</span>
                  </ion-item>
                </ion-list>
                <p v-else class="empty-copy">No saved foods have available data for this nutrient.</p>
              </ion-card-content>
            </ion-card>
          </section>

          <section v-else-if="activeSection === 'foods'" class="section-stack">
            <div class="summary-grid">
              <ion-card v-for="meal in consumption?.mealDistribution ?? []" :key="meal.meal" class="summary-card">
                <ion-card-content><span>{{ meal.meal }}</span><strong>{{ meal.count }}</strong><small>{{ formatValue(meal.caloriesKcal) }} kcal recorded</small></ion-card-content>
              </ion-card>
            </div>
            <ion-card class="report-card">
              <ion-card-content>
                <h2>Daily food logging activity</h2>
                <ReportChart
                  v-if="consumption?.totalFoodLogs"
                  type="bar"
                  label="Food logs recorded each day"
                  :labels="dayLabels"
                  :datasets="[{ label: 'Food logs', data: consumption.days.map((day) => day.entryCount), color: '#398567' }]"
                  axis-title="Logs"
                />
                <p v-else class="empty-copy">No food logs in this period.</p>
              </ion-card-content>
            </ion-card>
            <ion-card class="report-card">
              <ion-card-content>
                <h2>Macronutrients by meal</h2>
                <ion-list v-if="loggedMeals.length" lines="none">
                  <ion-item v-for="meal in loggedMeals" :key="`macro-${meal.meal}`">
                    <ion-label><h3>{{ meal.meal }}</h3><p>{{ meal.count }} logged foods</p></ion-label>
                    <span class="macro-meal-values">
                      Protein {{ formatValue(meal.macros.protein) }} g ·
                      Carbs {{ formatValue(meal.macros.carbohydrates) }} g ·
                      Fat {{ formatValue(meal.macros.totalFat) }} g
                    </span>
                  </ion-item>
                </ion-list>
                <p v-else class="empty-copy">No food logs in this period.</p>
              </ion-card-content>
            </ion-card>
            <ion-card class="report-card">
              <ion-card-content>
                <h2>Most logged foods</h2>
                <p class="data-note">Logging frequency only; it is not a measure of dietary quality.</p>
                <ReportChart v-if="topFoods.length"
                  type="bar"
                  label="Most frequently logged foods"
                  :labels="topFoods.map((food) => food.foodName)"
                  :datasets="[{ label: 'Food logs', data: topFoods.map((food) => food.count), color: '#398567' }]"
                  axis-title="Logs"
                  horizontal
                />
                <p v-else class="empty-copy">No food logs in this period.</p>
              </ion-card-content>
            </ion-card>
            <ion-card class="report-card">
              <ion-card-content>
                <h2>Food categories</h2>
                <ion-list v-if="consumption?.foodCategories.length" lines="none">
                  <ion-item v-for="category in consumption.foodCategories" :key="category.category">
                    <ion-label>{{ category.category }}</ion-label>
                    <ion-badge color="success">{{ category.count }}</ion-badge>
                  </ion-item>
                </ion-list>
                <p v-else class="empty-copy">No food logs in this period.</p>
              </ion-card-content>
            </ion-card>
            <ion-card class="report-card">
              <ion-card-content>
                <h2>Recorded macros by food</h2>
                <ion-list v-if="consumption?.frequentFoods.length" lines="none">
                  <ion-item v-for="food in topFoods" :key="`food-macro-${food.foodName}`">
                    <ion-label><h3>{{ food.foodName }}</h3><p>{{ food.count }} logs</p></ion-label>
                    <span class="macro-meal-values">
                      P {{ formatValue(food.macros.protein) }} g ·
                      C {{ formatValue(food.macros.carbohydrates) }} g ·
                      F {{ formatValue(food.macros.totalFat) }} g
                    </span>
                  </ion-item>
                </ion-list>
                <p v-else class="empty-copy">No food logs in this period.</p>
              </ion-card-content>
            </ion-card>
          </section>

          <section v-else-if="activeSection === 'inventory'" class="section-stack">
            <div class="summary-grid">
              <ion-card class="summary-card"><ion-card-content><span>Inventory items</span><strong>{{ inventoryReport?.totalItems ?? 0 }}</strong></ion-card-content></ion-card>
              <ion-card class="summary-card"><ion-card-content><span>In stock</span><strong>{{ inventoryReport?.inStockItems ?? 0 }}</strong></ion-card-content></ion-card>
              <ion-card class="summary-card"><ion-card-content><span>Low stock</span><strong>{{ inventoryReport?.lowStockItems ?? 0 }}</strong></ion-card-content></ion-card>
              <ion-card class="summary-card"><ion-card-content><span>Out of stock</span><strong>{{ inventoryReport?.outOfStockItems ?? 0 }}</strong></ion-card-content></ion-card>
            </div>
            <ion-card class="report-card">
              <ion-card-content>
                <h2>Current inventory status</h2>
                <ReportChart
                  v-if="inventoryReport?.totalItems"
                  type="doughnut"
                  label="Current inventory status"
                  :labels="['In stock', 'Low stock', 'Out of stock']"
                  :datasets="[{ label: 'Items', data: [inventoryReport?.inStockItems ?? 0, inventoryReport?.lowStockItems ?? 0, inventoryReport?.outOfStockItems ?? 0], color: '#398567' }]"
                />
                <p v-else class="empty-copy">No inventory records.</p>
                <p class="data-note">Quantities are grouped by their saved units and are not combined across incompatible units.</p>
                <p v-for="quantity in inventoryReport?.quantityByUnit ?? []" :key="quantity.unit" class="unit-total">
                  {{ formatValue(quantity.quantity) }} {{ quantity.unit }} total
                </p>
              </ion-card-content>
            </ion-card>
            <ion-card class="report-card">
              <ion-card-content>
                <h2>Inventory movements · selected period</h2>
                <ReportChart
                  v-if="inventoryReport?.movements.length"
                  type="line"
                  label="Daily inventory movement count"
                  :labels="dayLabels"
                  :datasets="[{ label: 'Recorded movements', data: inventoryReport.movementDailyCounts.map((day) => day.count), color: '#398567' }]"
                  axis-title="Records"
                />
                <h3 v-if="movementUnits.length" class="subheading">Quantity moved per day</h3>
                <ion-item v-if="movementUnits.length" class="nutrient-picker">
                  <ion-select v-model="selectedMovementUnit" label="Unit" interface="popover">
                    <ion-select-option v-for="unit in movementUnits" :key="unit" :value="unit">{{ unit }}</ion-select-option>
                  </ion-select>
                </ion-item>
                <ReportChart
                  v-if="movementUnits.length"
                  type="bar"
                  label="Daily inventory movement quantity"
                  :labels="dayLabels"
                  :datasets="movementQuantityDatasets"
                  :axis-title="selectedMovementUnit"
                />
                <p class="data-note">Movement quantity is not total stock. Units and movement types are kept separate.</p>
                <ion-list v-if="inventoryReport?.movementTotals.length" lines="none">
                  <ion-item v-for="movement in inventoryReport.movementTotals" :key="`${movement.movementType}-${movement.unit}`">
                    <ion-label>{{ movement.movementType.replaceAll('_', ' ') }} · {{ movement.unit }}</ion-label>
                    <span>{{ formatValue(movement.quantity) }} {{ movement.unit }} · {{ movement.count }} records</span>
                  </ion-item>
                </ion-list>
                <p v-else class="empty-copy">No recorded inventory movements in this period.</p>
              </ion-card-content>
            </ion-card>
          </section>

          <section v-else-if="activeSection === 'expiration'" class="section-stack">
            <p class="data-note">Current inventory snapshot. Expired items are not assumed to be discarded.</p>
            <div class="summary-grid">
              <ion-card class="summary-card"><ion-card-content><span>Expiring soon</span><strong>{{ inventoryReport?.expiringSoonItems.length ?? 0 }}</strong></ion-card-content></ion-card>
              <ion-card class="summary-card"><ion-card-content><span>Expired in stock</span><strong>{{ inventoryReport?.expiredItems.length ?? 0 }}</strong></ion-card-content></ion-card>
            </div>
            <ion-card class="report-card">
              <ion-card-content>
                <h2>Expiring soon</h2>
                <ion-list v-if="inventoryReport?.expiringSoonItems.length" lines="none">
                  <ion-item v-for="item in inventoryReport.expiringSoonItems" :key="item.id">
                    <ion-label>{{ item.foodName }} · {{ item.expirationDate }}</ion-label>
                    <span>{{ formatValue(item.quantity) }} {{ item.unit }}</span>
                  </ion-item>
                </ion-list>
                <p v-else class="empty-copy">No in-stock items are within the 7-day warning period.</p>
              </ion-card-content>
            </ion-card>
            <ion-card class="report-card">
              <ion-card-content>
                <h2>Expired items still in stock</h2>
                <ion-list v-if="inventoryReport?.expiredItems.length" lines="none">
                  <ion-item v-for="item in inventoryReport.expiredItems" :key="item.id">
                    <ion-label>{{ item.foodName }} · {{ item.expirationDate }}</ion-label>
                    <span>{{ formatValue(item.quantity) }} {{ item.unit }}</span>
                  </ion-item>
                </ion-list>
                <p v-else class="empty-copy">No expired items with stock on hand.</p>
              </ion-card-content>
            </ion-card>
            <ion-card class="report-card">
              <ion-card-content><h2>Recorded food waste</h2><p>Food waste data is not yet available.</p></ion-card-content>
            </ion-card>
          </section>

          <section v-else-if="activeSection === 'plans'" class="section-stack">
            <div class="summary-grid">
              <ion-card class="summary-card"><ion-card-content><span>Planned meals</span><strong>{{ mealPlanReport?.plannedMeals ?? 0 }}</strong></ion-card-content></ion-card>
              <ion-card class="summary-card"><ion-card-content><span>Logged meals</span><strong>{{ consumption?.totalFoodLogs ?? 0 }}</strong></ion-card-content></ion-card>
              <ion-card class="summary-card"><ion-card-content><span>Ingredients available when planned</span><strong>{{ mealPlanReport?.availableIngredients ?? 0 }}</strong></ion-card-content></ion-card>
              <ion-card class="summary-card"><ion-card-content><span>Ingredients missing when planned</span><strong>{{ mealPlanReport?.missingIngredients ?? 0 }}</strong></ion-card-content></ion-card>
              <ion-card class="summary-card"><ion-card-content><span>Unverified ingredients</span><strong>{{ mealPlanReport?.unverifiedIngredients ?? 0 }}</strong></ion-card-content></ion-card>
            </div>
            <p class="data-note">Saved availability is from the meal plan record. Food logs are not matched to plans because they do not store a reliable plan-meal reference.</p>
            <ion-card class="report-card">
              <ion-card-content>
                <h2>Meal plan history</h2>
                <ion-list v-if="mealPlanReport?.plans.length" lines="none">
                  <ion-item v-for="plan in mealPlanReport.plans" :key="plan.id">
                    <ion-label><h3>Week of {{ plan.weekStartDate }}</h3><p>{{ plan.meals.length }} planned meals · saved {{ formatDate(plan.createdAt) }}</p></ion-label>
                  </ion-item>
                </ion-list>
                <p v-else class="empty-copy">No saved plans overlap this period.</p>
              </ion-card-content>
            </ion-card>
          </section>

          <section v-else-if="activeSection === 'waste'" class="empty-card">
            <h2>Food waste data is not yet available.</h2>
            <p>Expired food is not counted as discarded without an explicit disposal record.</p>
          </section>

          <section v-else class="section-stack export-panel">
            <ion-card class="report-card">
              <ion-card-content>
                <h2>Export report</h2>
                <ion-item>
                  <ion-select v-model="exportKind" label="Report type" interface="popover">
                    <ion-select-option value="consumption">Food consumption</ion-select-option>
                    <ion-select-option value="calories">Daily calories</ion-select-option>
                    <ion-select-option value="macros">Macronutrients</ion-select-option>
                    <ion-select-option value="micros">Micronutrients</ion-select-option>
                    <ion-select-option value="inventory">Inventory status</ion-select-option>
                    <ion-select-option value="expiration">Expiration report</ion-select-option>
                    <ion-select-option value="waste">Recorded food waste</ion-select-option>
                    <ion-select-option value="plans">Meal plan history</ion-select-option>
                  </ion-select>
                </ion-item>
                <p class="data-note">Date range: {{ range?.startDate }} to {{ range?.endDate }} · {{ timeZone }}</p>
                <div class="export-actions">
                  <ion-button :disabled="exporting" @click="exportReport('csv')">Export CSV</ion-button>
                  <ion-button fill="outline" :disabled="exporting" @click="exportReport('pdf')">Export PDF</ion-button>
                </div>
                <p v-if="exportMessage" class="data-note" role="status">{{ exportMessage }}</p>
              </ion-card-content>
            </ion-card>
          </section>
        </template>
      </main>
    </ion-content>
    <ion-toast
      :is-open="Boolean(toastMessage)"
      :message="toastMessage"
      :color="toastColor"
      :duration="4500"
      position="bottom"
      @didDismiss="toastMessage = ''"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonProgressBar,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonToast,
} from '@ionic/vue';
import AppNavigation from '../components/AppNavigation.vue';
import ReportChart from '../components/ReportChart.vue';
import {
  authStateError,
  observeAuth,
  type AuthenticatedUser,
} from '../services/authService';
import {
  listFoodConsumptionsInRange,
  listInventoryMovementsInRange,
} from '../services/foodConsumptionService';
import { listFoodItems } from '../services/foodInventoryService';
import { listWeeklyMealPlansInRange } from '../services/weeklyMealPlanService';
import { getNotificationPreferences } from '../services/notificationService';
import {
  buildConsumptionAnalytics,
  buildInventoryAnalytics,
  buildMealPlanAnalytics,
  getReportDateBoundary,
  getReportDateInTimeZone,
  listReportDates,
  resolveReportDateRange,
  type DateRange,
  type ReportPeriod,
} from '../utils/analyticsReports';
import { getLocalDate, type FoodConsumption } from '../utils/foodConsumption';
import { getStockStatus } from '../utils/foodInventory';
import { getExpirationResult } from '../utils/foodExpiration';
import {
  estimateRecordMicronutrient,
  micronutrientDefinitions,
  type MicronutrientName,
} from '../utils/micronutrients';
import { estimateRecordCalories, type MacronutrientName } from '../utils/dailyNutrition';
import type { FoodItem } from '../utils/foodInventory';
import type { InventoryMovement } from '../services/foodConsumptionService';
import type { WeeklyMealPlan } from '../utils/weeklyMealRecommendations';
import {
  createCsvReport,
  createPdfReport,
  exportReportFile,
  type ExportRow,
  type ReportFileData,
} from '../services/reportExportService';

type ReportSection = 'overview' | 'foods' | 'inventory' | 'expiration' | 'plans' | 'waste' | 'export';
type ExportKind = 'consumption' | 'calories' | 'macros' | 'micros' | 'inventory' | 'expiration' | 'waste' | 'plans';
type ExportFormat = 'csv' | 'pdf';

const timeZone = ref(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
const today = getLocalDate();
const defaultRange = resolveReportDateRange('last7', '', '', today);
const user = ref<AuthenticatedUser | null>(null);
const period = ref<ReportPeriod>('last7');
const customStart = ref(defaultRange.startDate);
const customEnd = ref(defaultRange.endDate);
const range = ref<DateRange | null>(defaultRange);
const activeSection = ref<ReportSection>('overview');
const exportKind = ref<ExportKind>('consumption');
const selectedNutrient = ref<MicronutrientName>('vitaminC');
const selectedMovementUnit = ref('');
const loading = ref(false);
const exporting = ref(false);
const errorMessage = ref('');
const toastMessage = ref('');
const toastColor = ref<'success' | 'danger' | 'medium'>('success');
const exportMessage = ref('');
const consumptions = ref<FoodConsumption[]>([]);
const inventoryItems = ref<FoodItem[]>([]);
const inventoryMovements = ref<InventoryMovement[]>([]);
const weeklyPlans = ref<WeeklyMealPlan[]>([]);
let unsubscribe: (() => void) | undefined;
let requestId = 0;
let timeZoneUserId = '';

const consumption = computed(() => range.value
  ? buildConsumptionAnalytics(consumptions.value, range.value)
  : null);
const inventoryReport = computed(() => range.value
  ? buildInventoryAnalytics(inventoryItems.value, inventoryMovements.value, range.value, new Date(), 7, timeZone.value)
  : null);
const mealPlanReport = computed(() => range.value
  ? buildMealPlanAnalytics(weeklyPlans.value, range.value)
  : null);
const dates = computed(() => range.value ? listReportDates(range.value) : []);
const dayLabels = computed(() => dates.value.map((date) => date.slice(5)));
const calorieValues = computed(() => consumption.value?.days.map((day) => day.caloriesKcal) ?? []);
const macroCards: Array<{ name: MacronutrientName; label: string }> = [
  { name: 'protein', label: 'Protein' },
  { name: 'carbohydrates', label: 'Carbohydrates' },
  { name: 'totalFat', label: 'Total fat' },
];
const macroDatasets = computed(() => [
  { label: 'Protein (g)', data: consumption.value?.days.map((day) => day.proteinG) ?? [], color: '#398567' },
  { label: 'Carbohydrates (g)', data: consumption.value?.days.map((day) => day.carbohydratesG) ?? [], color: '#84a95b' },
  { label: 'Fat (g)', data: consumption.value?.days.map((day) => day.totalFatG) ?? [], color: '#d9983f' },
]);
const hasMacroData = computed(() => macroCards.some((macro) => (
  (consumption.value?.macroEntriesWithData[macro.name] ?? 0) > 0
)));
const macroDistribution = computed(() => {
  const macros = consumption.value?.macros;
  if (!macros) return [];
  return [
    { label: 'Protein', energy: macros.protein === null ? null : macros.protein * 4 },
    { label: 'Carbohydrates', energy: macros.carbohydrates === null ? null : macros.carbohydrates * 4 },
    { label: 'Fat', energy: macros.totalFat === null ? null : macros.totalFat * 9 },
  ].filter((entry): entry is { label: string; energy: number } => entry.energy !== null && entry.energy > 0);
});
const macroDistributionLabels = computed(() => macroDistribution.value.map((entry) => entry.label));
const macroDistributionValues = computed(() => macroDistribution.value.map((entry) => entry.energy));
const selectedNutrientDefinition = computed(() => (
  micronutrientDefinitions.find((definition) => definition.id === selectedNutrient.value)!
));
const selectedNutrientRows = computed(() => consumption.value?.micronutrients.filter((row) => (
  row.nutrientId === selectedNutrient.value
)) ?? []);
const microGroup = computed(() => {
  const groups = new Map<string, { unit: string; comparable: boolean | null }>();
  for (const row of selectedNutrientRows.value) {
    if (row.amount === null || row.unit === null) continue;
    groups.set(`${row.unit}:${row.comparable}`, { unit: row.unit, comparable: row.comparable });
  }
  const values = [...groups.values()];
  return values.find((group) => group.comparable === true)
    ?? (values.length === 1 ? values[0] : null);
});
const microUnit = computed(() => microGroup.value?.unit ?? selectedNutrientDefinition.value.unit);
const microDatasets = computed(() => [{
  label: `${selectedNutrientDefinition.value.label} (${microUnit.value})`,
  data: dates.value.map((date) => {
    if (!microGroup.value) return null;
    const sameDate = selectedNutrientRows.value.filter((row) => row.date === date
      && row.unit === microGroup.value?.unit
      && row.comparable === microGroup.value.comparable);
    return sameDate.length ? sameDate.reduce((total, row) => total + (row.amount ?? 0), 0) : null;
  }),
  color: '#398567',
}]);
const microSources = computed(() => {
  const grouped = new Map<string, { foodName: string; unit: string; comparable: boolean; amount: number }>();
  for (const record of consumption.value?.records ?? []) {
    const estimate = estimateRecordMicronutrient(record, selectedNutrient.value);
    if (estimate.amount === null || estimate.unit === null) continue;
    const key = `${record.foodName.trim().toLocaleLowerCase()}:${estimate.unit}:${estimate.comparable}`;
    const source = grouped.get(key) ?? {
      foodName: record.foodName,
      unit: estimate.unit,
      comparable: estimate.comparable,
      amount: 0,
    };
    source.amount += estimate.amount;
    grouped.set(key, source);
  }
  return [...grouped.values()]
    .filter((source) => !microGroup.value
      || (source.unit === microGroup.value.unit && source.comparable === microGroup.value.comparable))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
});
const topFoods = computed(() => (consumption.value?.frequentFoods ?? []).slice(0, 10));
const loggedMeals = computed(() => (consumption.value?.mealDistribution ?? [])
  .filter((meal) => meal.count > 0));
const movementUnits = computed(() => [...new Set((inventoryReport.value?.movements ?? [])
  .map((movement) => movement.unit))]);
const movementQuantityDatasets = computed(() => {
  const report = inventoryReport.value;
  const unit = movementUnits.value.find((candidate) => candidate === selectedMovementUnit.value)
    ?? movementUnits.value[0];
  if (!report || !unit) return [];
  const types = [...new Set(report.movementDailyQuantities
    .filter((movement) => movement.unit === unit)
    .map((movement) => movement.movementType))];
  return types.map((type, index) => ({
    label: type.replaceAll('_', ' '),
    color: ['#398567', '#84a95b', '#d9983f', '#8092b0'][index % 4],
    data: dates.value.map((date) => report.movementDailyQuantities
      .filter((movement) => movement.date === date
        && movement.unit === unit
        && movement.movementType === type)
      .reduce((total, movement) => total + movement.quantity, 0)),
  }));
});

onMounted(() => {
  unsubscribe = observeAuth((authenticatedUser) => {
    user.value = authenticatedUser;
    if (!authenticatedUser) clearData();
  }, (error) => {
    errorMessage.value = error.message || authStateError.value;
  });
});
onUnmounted(() => unsubscribe?.());
watch([() => user.value?.id, period, customStart, customEnd], () => {
  if (user.value) void loadData();
}, { immediate: true });

async function loadData(): Promise<void> {
  if (!user.value) return;
  const loadId = ++requestId;
  loading.value = true;
  errorMessage.value = '';
  exportMessage.value = '';
  try {
    if (timeZoneUserId !== user.value.id) {
      const preferences = await getNotificationPreferences(user.value.id);
      timeZone.value = preferences.time_zone;
      timeZoneUserId = user.value.id;
    }
    const zonedToday = getReportDateInTimeZone(new Date(), timeZone.value);
    const selectedRange = resolveReportDateRange(period.value, customStart.value, customEnd.value, zonedToday);
    range.value = selectedRange;
    const endExclusiveDate = new Date(`${selectedRange.endDate}T00:00:00.000Z`);
    endExclusiveDate.setUTCDate(endExclusiveDate.getUTCDate() + 1);
    const start = getReportDateBoundary(selectedRange.startDate, timeZone.value);
    const endExclusive = getReportDateBoundary(endExclusiveDate.toISOString().slice(0, 10), timeZone.value);
    const [foodLogs, items, movements, plans] = await Promise.all([
      listFoodConsumptionsInRange(user.value.id, selectedRange.startDate, selectedRange.endDate),
      listFoodItems(user.value.id),
      listInventoryMovementsInRange(user.value.id, start, endExclusive),
      listWeeklyMealPlansInRange(user.value.id, selectedRange.startDate, selectedRange.endDate),
    ]);
    if (loadId !== requestId) return;
    consumptions.value = foodLogs;
    inventoryItems.value = items;
    inventoryMovements.value = movements;
    weeklyPlans.value = plans;
  } catch (error) {
    if (loadId === requestId) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (loadId === requestId) loading.value = false;
  }
}

function clearData(): void {
  requestId += 1;
  consumptions.value = [];
  inventoryItems.value = [];
  inventoryMovements.value = [];
  weeklyPlans.value = [];
  range.value = null;
  timeZoneUserId = '';
  loading.value = false;
}

function formatValue(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Not available' : new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Not available' : `${value}%`;
}

function formatDate(value: string): string {
  if (!value) return 'date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function getExportData(kind: ExportKind): ReportFileData {
  if (!range.value || !consumption.value || !inventoryReport.value || !mealPlanReport.value) {
    throw new Error('Wait for report data to finish loading.');
  }
  const rows: ExportRow[] = [];
  let title = '';
  let columns: string[] = [];
  const summary: string[] = [];
  const records = consumption.value.records;
  const datesInRange = consumption.value.days;
  const reportToday = new Date(`${getReportDateInTimeZone(new Date(), timeZone.value)}T12:00:00`);
  if (kind === 'consumption') {
    title = 'Food Consumption Report';
    columns = ['Date', 'Time', 'Meal', 'Food', 'Category', 'Quantity', 'Unit', 'Recorded calories (kcal)'];
    for (const record of records) rows.push({
      Date: record.consumptionDate,
      Time: record.consumptionTime,
      Meal: record.mealCategory,
      Food: record.foodName,
      Category: record.foodCategory,
      Quantity: record.quantityConsumed,
      Unit: record.measurementUnit,
      'Recorded calories (kcal)': estimateRecordCalories(record).caloriesKcal,
    });
    summary.push(`Food logs: ${consumption.value.totalFoodLogs}`);
    summary.push(`Recorded calories with available data: ${formatValue(consumption.value.totalRecordedCaloriesKcal)} kcal`);
  } else if (kind === 'calories') {
    title = 'Daily Calorie Report';
    columns = ['Date', 'Food logs', 'Recorded calories (kcal)', 'Entries with calorie data'];
    for (const day of datesInRange) rows.push({
      'Food logs': day.entryCount,
      'Recorded calories (kcal)': day.caloriesKcal,
      'Entries with calorie data': day.calorieEntriesWithData,
    });
    summary.push('Missing food logs do not mean zero food intake.');
    summary.push(`Nutrition completeness: ${formatPercent(consumption.value.nutritionCompletenessPercent)}`);
  } else if (kind === 'macros') {
    title = 'Macronutrient Report';
    columns = ['Row type', 'Date or range', 'Meal or food', 'Food logs', 'Protein (g)', 'Protein entries with data', 'Carbohydrates (g)', 'Carbohydrate entries with data', 'Total fat (g)', 'Fat entries with data'];
    for (const day of datesInRange) rows.push({
      'Row type': 'Daily',
      'Date or range': day.date,
      'Meal or food': '',
      Date: day.date,
      'Food logs': day.entryCount,
      'Protein (g)': day.proteinG,
      'Protein entries with data': day.macroEntriesWithData.protein,
      'Carbohydrates (g)': day.carbohydratesG,
      'Carbohydrate entries with data': day.macroEntriesWithData.carbohydrates,
      'Total fat (g)': day.totalFatG,
      'Fat entries with data': day.macroEntriesWithData.totalFat,
    });
    for (const meal of consumption.value.mealDistribution) rows.push({
      'Row type': 'Meal',
      'Date or range': `${range.value.startDate} to ${range.value.endDate}`,
      'Meal or food': meal.meal,
      'Food logs': meal.count,
      'Protein (g)': meal.macros.protein,
      'Protein entries with data': '',
      'Carbohydrates (g)': meal.macros.carbohydrates,
      'Carbohydrate entries with data': '',
      'Total fat (g)': meal.macros.totalFat,
      'Fat entries with data': '',
    });
    for (const food of consumption.value.frequentFoods) rows.push({
      'Row type': 'Food',
      'Date or range': `${range.value.startDate} to ${range.value.endDate}`,
      'Meal or food': food.foodName,
      'Food logs': food.count,
      'Protein (g)': food.macros.protein,
      'Protein entries with data': '',
      'Carbohydrates (g)': food.macros.carbohydrates,
      'Carbohydrate entries with data': '',
      'Total fat (g)': food.macros.totalFat,
      'Fat entries with data': '',
    });
    summary.push('Macro values are based on saved nutrition snapshots and compatible consumed amounts.');
  } else if (kind === 'micros') {
    title = 'Micronutrient Report';
    columns = ['Nutrient', 'Unit', 'Recorded amount', 'Days with data', 'Days missing data', 'Comparable', 'Food sources'];
    const grouped = new Map<string, {
      nutrient: string;
      unit: string | null;
      amount: number;
      withData: number;
      missing: number;
      hasValue: boolean;
      comparable: boolean | null;
      sources: Set<string>;
    }>();
    for (const row of consumption.value.micronutrients) {
      const key = `${row.nutrientId}:${row.unit ?? 'unavailable'}:${row.comparable ?? 'na'}`;
      const item = grouped.get(key) ?? {
        nutrient: row.nutrient,
        unit: row.unit,
        amount: 0,
        withData: 0,
        missing: 0,
        hasValue: false,
        comparable: row.comparable,
        sources: new Set<string>(),
      };
      item.amount += row.amount ?? 0;
      if (!grouped.has(key) || row.date > range.value.startDate) {
        item.withData += row.entriesWithData > 0 ? 1 : 0;
        item.missing += row.entriesMissingData > 0 ? 1 : 0;
      }
      item.hasValue ||= row.amount !== null;
      grouped.set(key, item);
    }
    for (const record of records) {
      for (const definition of micronutrientDefinitions) {
        const estimate = estimateRecordMicronutrient(record, definition.id);
        if (estimate.amount === null || estimate.unit === null) continue;
        const key = `${definition.id}:${estimate.unit}:${estimate.comparable}`;
        grouped.get(key)?.sources.add(record.foodName);
      }
    }
    for (const row of grouped.values()) rows.push({
      Nutrient: row.nutrient,
      Unit: row.unit,
      'Recorded amount': row.hasValue ? Number(row.amount.toFixed(4)) : null,
      'Days with data': row.withData,
      'Days missing data': row.missing,
      Comparable: row.comparable,
      'Food sources': [...row.sources].join('; '),
    });
    summary.push('Unavailable values are not treated as zero. Food logs do not diagnose deficiencies.');
  } else if (kind === 'inventory') {
    title = 'Inventory Status Report';
    columns = ['Food', 'Category', 'Quantity', 'Unit', 'Low-stock threshold', 'Stock status', 'Expiration date'];
    for (const item of inventoryReport.value.items) rows.push({
      Food: item.foodName,
      Category: item.category,
      Quantity: item.quantity,
      Unit: item.unit,
      'Low-stock threshold': item.lowStockThreshold,
      'Stock status': getStockStatus(item.quantity, item.lowStockThreshold),
      'Expiration date': item.expirationDate || 'Not recorded',
    });
    summary.push('Current inventory snapshot; quantity totals are grouped by unit.');
    summary.push(`Movements in selected period: ${inventoryReport.value.movements.length}`);
  } else if (kind === 'expiration') {
    title = 'Expiration Report';
    columns = ['Food', 'Quantity', 'Unit', 'Expiration date', 'Status'];
    for (const item of inventoryReport.value.items) rows.push({
      Food: item.foodName,
      Quantity: item.quantity,
      Unit: item.unit,
      'Expiration date': item.expirationDate || 'Not recorded',
      Status: item.quantity > 0 ? getExpirationResult(item.expirationDate, 7, reportToday).label : 'No stock',
    });
    summary.push('Current inventory snapshot. Expired food is not assumed to be discarded.');
    summary.push('Food waste data is not yet available.');
  } else if (kind === 'plans') {
    title = 'Weekly Meal Plan Report';
    columns = ['Week starting', 'Plan saved', 'Meal', 'Day', 'Category', 'Missing ingredients'];
    for (const plan of mealPlanReport.value.plans) {
      for (const meal of plan.meals) rows.push({
        'Week starting': plan.weekStartDate,
        'Plan saved': plan.createdAt,
        Meal: meal.recipeName,
        Day: meal.day,
        Category: meal.category,
        'Missing ingredients': meal.missingIngredients.join('; '),
      });
    }
    summary.push(`${mealPlanReport.value.plannedMeals} planned meals. Planned meals are not matched to consumption logs.`);
  } else {
    title = 'Recorded Food Waste Report';
    columns = ['Status'];
    summary.push('Food waste data is not yet available.');
    summary.push('No disposal records exist in the current data model; expired inventory is not counted as waste.');
  }
  if (!rows.length && kind !== 'waste') summary.push('No records are available for this report.');
  return { title, range: range.value, columns, rows, summary };
}

async function exportReport(format: ExportFormat): Promise<void> {
  if (exporting.value) return;
  exporting.value = true;
  exportMessage.value = '';
  try {
    const report = getExportData(exportKind.value);
    const blob = format === 'csv'
      ? new Blob([createCsvReport(report)], { type: 'text/csv;charset=utf-8' })
      : createPdfReport(report);
    const suffix = format === 'csv' ? 'csv' : 'pdf';
    const safeTitle = exportKind.value.replace(/[^a-z0-9-]/gi, '-');
    const filename = `pantry-plate-${safeTitle}-${range.value?.startDate}-${range.value?.endDate}.${suffix}`;
    const result = await exportReportFile(blob, filename, report.title);
    exportMessage.value = result === 'shared' ? 'Report shared.' : 'Report downloaded.';
    toastColor.value = 'success';
    toastMessage.value = exportMessage.value;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      exportMessage.value = 'Sharing cancelled.';
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    exportMessage.value = `Unable to export report: ${message}`;
    toastColor.value = 'danger';
    toastMessage.value = exportMessage.value;
  } finally {
    exporting.value = false;
  }
}
</script>

<style scoped>
.reports-page { width: min(1120px, 100%); margin: 0 auto; padding: 18px 16px 76px; color: var(--app-text); }
.reports-hero { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 12px; }
.reports-hero h1 { margin: 0; font-size: clamp(1.45rem, 4vw, 2rem); }
.period-select { width: min(260px, 52vw); --background: var(--app-card); --border-radius: 12px; }
.date-range { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.date-range ion-item { --background: var(--app-card); --border-radius: 12px; }
.range-caption { margin: 5px 2px 12px; color: var(--app-muted); font-size: .75rem; }
.report-tabs { margin: 14px 0; border: 1px solid var(--app-border); border-radius: 13px; background: var(--app-card); }
.report-tabs ion-segment-button { min-width: max-content; min-height: 42px; font-size: .75rem; text-transform: none; }
.section-stack { display: grid; gap: 14px; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.summary-card, .report-card, .empty-card { margin: 0; border: 1px solid var(--app-border); border-radius: 15px; background: var(--app-card); box-shadow: 0 5px 16px rgb(28 65 48 / 4%); }
.summary-card ion-card-content { display: grid; min-height: 94px; align-content: center; gap: 5px; padding: 14px; }
.summary-card span, .summary-card small { color: var(--app-muted); font-size: .74rem; }
.summary-card strong { color: #245c3d; font-size: 1.24rem; overflow-wrap: anywhere; }
.summary-card strong small { font-size: .75rem; font-weight: 500; }
.report-card ion-card-content { padding: 18px; }
.report-card h2, .empty-card h2 { margin: 0 0 12px; color: var(--app-text); font-size: 1rem; }
.data-note, .empty-copy { color: var(--app-muted); font-size: .78rem; line-height: 1.45; }
.unit-total { margin: 5px 0; color: #365b47; font-size: .82rem; }
.report-card ion-list { margin-top: 6px; }
.nutrient-picker { margin-bottom: 12px; --background: #f7faf7; }
.empty-card { display: grid; justify-items: center; gap: 10px; padding: 28px 18px; text-align: center; }
.empty-card h2, .empty-card p { margin: 0; }
.empty-card p { color: var(--app-muted); }
.export-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.error-card { border: 1px solid #f1d3cd; color: #943e33; }
@media (max-width: 700px) {
  .reports-page { padding: 14px 11px 70px; }
  .reports-hero { align-items: stretch; flex-direction: column; }
  .period-select { width: 100%; }
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .summary-card ion-card-content { min-height: 82px; padding: 11px; }
}
</style>
