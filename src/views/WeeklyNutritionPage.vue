<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="weekly-page">
        <header class="weekly-hero">
          <div>
            <h1>Weekly nutrition</h1>
          </div>
          <ion-button :disabled="loading || generating || saving" @click="confirmGenerate = true">
            <ion-icon slot="start" :icon="refreshOutline" />
            Generate new week
          </ion-button>
        </header>

        <ion-progress-bar v-if="loading || generating || saving" type="indeterminate" />
        <ion-card v-if="errorMessage" class="error-card">
          <ion-card-content role="alert">{{ errorMessage }}</ion-card-content>
        </ion-card>

        <section v-if="!user && !loading" class="empty-plan auth-prompt">
          <h2>Sign in to create a personal weekly plan</h2>
          <ion-button router-link="/sign-in">Continue to sign in</ion-button>
        </section>

        <template v-if="user && !loading">
          <ion-card class="context-card">
            <ion-card-content>
              <div>
                <strong>Plan context</strong>
                <p>Check food labels for allergens.</p>
              </div>
              <p v-if="profile?.dietaryPreferences" class="context-chip">Preferences: {{ profile.dietaryPreferences }}</p>
              <p v-if="profile?.foodAllergies" class="context-chip allergy-chip">Allergies excluded: {{ profile.foodAllergies }}</p>
            </ion-card-content>
          </ion-card>

          <section class="plan-controls" aria-label="Saved weekly meal plans">
            <div>
              <h2>{{ currentPlan ? `Week of ${formatDate(currentPlan.weekStartDate)}` : 'No plan selected' }}</h2>
            </div>
            <ion-item v-if="plans.length" class="plan-select">
              <ion-select
                :value="currentPlan?.id"
                label="Plan history"
                interface="popover"
                @ionChange="selectPlan"
              >
                <ion-select-option v-for="plan in plans" :key="plan.id" :value="plan.id">
                  Week of {{ formatDate(plan.weekStartDate) }} · {{ formatDateTime(plan.createdAt) }}
                </ion-select-option>
              </ion-select>
            </ion-item>
            <ion-button
              v-if="currentPlan"
              fill="clear"
              color="danger"
              size="small"
              :disabled="saving"
              @click="deletePlanTarget = currentPlan"
            >
              Delete selected plan
            </ion-button>
          </section>

          <ion-card v-if="!currentPlan" class="empty-plan">
            <ion-card-content>
              <h2>Start with your pantry</h2>
              <p>Add pantry items to get meal ideas based on foods you have.</p>
              <ion-button router-link="/inventory" fill="outline">Open food inventory</ion-button>
              <ion-button :disabled="generating" @click="generatePlan">Generate a week</ion-button>
            </ion-card-content>
          </ion-card>

          <template v-else>
            <ion-segment :value="selectedDay" scrollable @ionChange="selectDay">
              <ion-segment-button v-for="day in recommendationDays" :key="day" :value="day">
                <ion-label>{{ day.slice(0, 3) }}</ion-label>
              </ion-segment-button>
            </ion-segment>
            <p class="day-date">{{ selectedDay }} · {{ formatDate(dateForDay(selectedDay)) }}</p>

            <section class="meal-grid" :aria-label="`${selectedDay} meal suggestions`">
              <ion-card v-for="category in mealCategories" :key="category" class="meal-card">
                <ion-card-content>
                  <template v-if="mealForCategory(category)">
                    <div class="meal-heading">
                      <div>
                        <p class="meal-category">{{ category }}</p>
                        <h2>{{ mealForCategory(category)?.recipeName }}</h2>
                      </div>
                      <ion-badge v-if="mealForCategory(category)?.savedAsFavorite" color="success">Favorite</ion-badge>
                    </div>

                    <div class="meal-ingredients">
                      <span
                        v-for="ingredient in mealForCategory(category)?.ingredients"
                        :key="`${ingredient.foodName}-${ingredient.amountGrams}`"
                        class="ingredient-chip"
                        :class="`ingredient-${ingredient.availability}`"
                      >
                        {{ ingredient.foodName }} · {{ ingredient.amountGrams }} g ({{ ingredient.weightState || 'as sold' }})
                      </span>
                    </div>
                    <div class="ingredient-links">
                      <ion-button
                        v-for="ingredient in mealForCategory(category)?.ingredients.filter((entry) => entry.inventoryItemId)"
                        :key="`nutrition-${ingredient.inventoryItemId}`"
                        :router-link="{ path: '/nutrition', query: { inventoryId: ingredient.inventoryItemId, search: ingredient.inventoryFoodName } }"
                        fill="clear"
                        size="small"
                      >
                        Search USDA for {{ ingredient.inventoryFoodName }}
                      </ion-button>
                    </div>
                    <p v-if="mealForCategory(category)?.missingIngredients.length" class="missing-note">
                      Missing or unverified: {{ mealForCategory(category)?.missingIngredients.join('; ') }}.
                      <span>Check inventory quantities and units.</span>
                      <ion-button router-link="/inventory" fill="clear" size="small">Review inventory</ion-button>
                    </p>
                    <div class="nutrition-summary">
                      <div v-for="nutrient in featuredNutrients" :key="nutrient.id">
                        <span>{{ nutrient.label }}</span>
                        <strong>{{ formatNutrient(mealForCategory(category)!, nutrient.id) }}</strong>
                      </div>
                    </div>
                    <p v-if="!mealForCategory(category)?.nutrition.complete" class="unavailable-note">
                      Partial totals include only foods with linked nutrition.
                      <ion-button router-link="/nutrition" fill="clear" size="small">Link USDA nutrition</ion-button>
                    </p>
                    <div class="meal-actions">
                      <ion-button fill="outline" size="small" @click="openDetails(mealForCategory(category)!)">
                        <ion-icon slot="start" :icon="informationCircleOutline" />
                        View details
                      </ion-button>
                      <ion-button fill="clear" size="small" @click="openReplacement(mealForCategory(category)!)">
                        <ion-icon slot="start" :icon="swapHorizontalOutline" />
                        Replace meal
                      </ion-button>
                      <ion-button
                        fill="clear"
                        size="small"
                        :aria-label="mealForCategory(category)?.savedAsFavorite ? 'Remove meal from favorites' : 'Save preferred meal'"
                        @click="toggleFavorite(mealForCategory(category)!)"
                      >
                        <ion-icon slot="start" :icon="mealForCategory(category)?.savedAsFavorite ? heart : heartOutline" />
                        {{ mealForCategory(category)?.savedAsFavorite ? 'Saved' : 'Save favorite' }}
                      </ion-button>
                    </div>
                  </template>
                  <div v-else class="no-meal">
                    <p class="meal-category">{{ category }}</p>
                    <h2>No suggestion for this slot</h2>
                    <p>No catalog meal matched the current inventory and restrictions. Add suitable items or adjust preferences.</p>
                  </div>
                </ion-card-content>
              </ion-card>
            </section>
          </template>
          <p class="safety-note">Meal ideas are informational, not medical advice. Nutrition may be incomplete. Inventory is not deducted.</p>
        </template>

        <ion-modal :is-open="Boolean(detailMeal)" @didDismiss="detailMeal = null">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ detailMeal?.recipeName ?? 'Meal details' }}</ion-title>
              <ion-button slot="end" fill="clear" @click="detailMeal = null">Close</ion-button>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <section v-if="detailMeal" class="modal-content">
              <p class="eyebrow">{{ detailMeal.day }} · {{ detailMeal.category }}</p>
              <h2>{{ detailMeal.recipeName }}</h2>
              <h3>Ingredients</h3>
              <ion-list lines="none">
                <ion-item v-for="ingredient in detailMeal.ingredients" :key="ingredient.foodName">
                  <ion-label>
                    <h4>{{ ingredient.foodName }} · {{ ingredient.amountGrams }} g ({{ ingredient.weightState || 'as sold' }})</h4>
                    <p v-if="ingredient.availability === 'available'">Inventory: {{ ingredient.inventoryFoodName }} · {{ ingredient.availableGrams }} g recorded</p>
                    <p v-else-if="ingredient.availability === 'unverified'">Inventory has {{ ingredient.inventoryFoodName }}, but its unit cannot be verified against this gram amount.</p>
                    <p v-else-if="ingredient.availableGrams !== null">Need {{ ingredient.amountGrams }} g; {{ ingredient.availableGrams }} g recorded in inventory.</p>
                    <p v-else>Not identified in available inventory.</p>
                  </ion-label>
                </ion-item>
              </ion-list>
              <p v-if="detailMeal.missingIngredients.length" class="missing-note">
                Missing or unverified: {{ detailMeal.missingIngredients.join('; ') }}.
              </p>
              <h3>Preparation</h3>
              <p class="instructions">{{ detailMeal.instructions }}</p>
              <h3>Estimated nutrition</h3>
              <div class="nutrition-summary detail-nutrition">
                <div v-for="nutrient in mealNutrients" :key="nutrient.id">
                  <span>{{ nutrient.label }}</span>
                  <strong>{{ formatNutrient(detailMeal, nutrient.id) }}</strong>
                </div>
              </div>
              <p class="unavailable-note">Only linked USDA values are included. Missing values are not counted as zero.</p>
              <ion-button router-link="/nutrition" fill="outline" size="small">Link USDA nutrition</ion-button>
              <ion-button router-link="/inventory" fill="clear" size="small">Review inventory units</ion-button>
            </section>
          </ion-content>
        </ion-modal>

        <ion-modal :is-open="Boolean(replacementMeal)" @didDismiss="replacementMeal = null">
          <ion-header>
            <ion-toolbar>
              <ion-title>Replace {{ replacementMeal?.category ?? 'meal' }}</ion-title>
              <ion-button slot="end" fill="clear" @click="replacementMeal = null">Close</ion-button>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <section class="modal-content">
              <p v-if="replacementMeal" class="section-help">
                Alternatives keep {{ replacementMeal.day }} {{ replacementMeal.category }} and are checked against the saved restrictions and current inventory.
              </p>
              <ion-card v-for="alternative in replacementAlternatives" :key="alternative.recipeId" class="alternative-card">
                <ion-card-content>
                  <h3>{{ alternative.recipeName }}</h3>
                  <p>{{ alternative.ingredients.map((ingredient) => `${ingredient.foodName} ${ingredient.amountGrams} g`).join(' · ') }}</p>
                  <p v-if="alternative.missingIngredients.length" class="missing-note">Missing/unverified: {{ alternative.missingIngredients.join('; ') }}</p>
                  <ion-button size="small" @click="confirmReplacement(alternative)">Use this alternative</ion-button>
                </ion-card-content>
              </ion-card>
              <p v-if="!replacementAlternatives.length" class="no-meal">No other compatible catalog meal currently matches your inventory.</p>
            </section>
          </ion-content>
        </ion-modal>

        <ion-alert
          :is-open="confirmGenerate"
          header="Generate another weekly plan?"
          message="A new plan will be saved separately. Existing saved plans will not be overwritten."
          :buttons="generateButtons"
          @didDismiss="confirmGenerate = false"
        />
        <ion-alert
          :is-open="Boolean(pendingReplacement)"
          header="Replace this meal?"
          message="The selected alternative will update this saved plan. This change cannot be undone."
          :buttons="replaceButtons"
          @didDismiss="cancelReplacement"
        />
        <ion-alert
          :is-open="Boolean(deletePlanTarget)"
          header="Delete saved plan?"
          message="This removes the selected weekly plan from your account."
          :buttons="deleteButtons"
          @didDismiss="deletePlanTarget = null"
        />
        <ion-toast
          :is-open="Boolean(toastMessage)"
          :message="toastMessage"
          :color="toastColor"
          :duration="3200"
          position="bottom"
          @didDismiss="toastMessage = ''"
        />
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { AuthenticatedUser as User } from '../services/authService';
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
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonProgressBar,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/vue';
import {
  deleteWeeklyMealFavorite,
  deleteWeeklyMealPlan,
  listWeeklyMealFavorites,
  listWeeklyMealPlans,
  saveWeeklyMealFavorite,
  saveWeeklyMealPlan,
  updateWeeklyMealPlan,
} from '../services/weeklyMealPlanService';
import {
  availableAlternatives,
  generateWeeklyMealPlan,
  getMondayDate,
  mealNutrients,
  recommendationDays,
  refreshMealRecommendation,
  replaceRecommendedMeal,
  type MealNutrientId,
  type MealRecommendation,
  type RecommendedMealCategory,
  type WeeklyMealPlan,
} from '../utils/weeklyMealRecommendations';
import { sortConsumptionsNewestFirst, type FoodConsumption } from '../utils/foodConsumption';
import type { FoodItem } from '../utils/foodInventory';
import type { HealthProfile } from '../utils/healthProfile';
import { observeAuth } from '../services/authService';
import { listFoodConsumptions } from '../services/foodConsumptionService';
import { listFoodItems } from '../services/foodInventoryService';
import { getHealthProfile } from '../services/healthProfileService';
import {
  heart,
  heartOutline,
  informationCircleOutline,
  refreshOutline,
  swapHorizontalOutline,
} from 'ionicons/icons';

const user = ref<User | null>(null);
const inventory = ref<FoodItem[]>([]);
const consumption = ref<FoodConsumption[]>([]);
const profile = ref<HealthProfile | null>(null);
const plans = ref<WeeklyMealPlan[]>([]);
const favorites = ref<Set<string>>(new Set());
const currentPlanId = ref('');
const selectedDay = ref<(typeof recommendationDays)[number]>('Monday');
const detailMeal = ref<MealRecommendation | null>(null);
const replacementMeal = ref<MealRecommendation | null>(null);
const pendingReplacement = ref<MealRecommendation | null>(null);
const pendingReplacementRecipeId = ref('');
const deletePlanTarget = ref<WeeklyMealPlan | null>(null);
const loading = ref(true);
const generating = ref(false);
const saving = ref(false);
const errorMessage = ref('');
const toastMessage = ref('');
const toastColor = ref<'success' | 'danger'>('success');
const confirmGenerate = ref(false);
let unsubscribe: (() => void) | undefined;
let loadSequence = 0;

const currentPlan = computed(() => plans.value.find((plan) => plan.id === currentPlanId.value) ?? null);
const mealCategories: RecommendedMealCategory[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const featuredNutrients = mealNutrients.slice(0, 5);
const selectedDayMeals = computed(() => currentPlan.value?.meals.filter((meal) => meal.day === selectedDay.value) ?? []);
const replacementAlternatives = computed(() => (
  replacementMeal.value && currentPlan.value
    ? availableAlternatives(replacementMeal.value, inventory.value, profile.value, favorites.value)
    : []
));
const generateButtons = [
  { text: 'Cancel', role: 'cancel' },
  { text: 'Generate new plan', handler: () => { void generatePlan(); } },
];
const replaceButtons = [
  { text: 'Cancel', role: 'cancel' },
  { text: 'Replace meal', role: 'destructive', handler: () => { void applyReplacement(); } },
];
const deleteButtons = [
  { text: 'Cancel', role: 'cancel' },
  { text: 'Delete plan', role: 'destructive', handler: () => { void removePlan(); } },
];

function mealForCategory(category: RecommendedMealCategory): MealRecommendation | undefined {
  return selectedDayMeals.value.find((meal) => meal.category === category);
}

onMounted(() => {
  unsubscribe = observeAuth((authenticatedUser) => {
    loadSequence += 1;
    user.value = authenticatedUser;
    inventory.value = [];
    consumption.value = [];
    profile.value = null;
    plans.value = [];
    favorites.value = new Set();
    currentPlanId.value = '';
    errorMessage.value = '';
    if (authenticatedUser) void loadData(authenticatedUser.uid);
    else {
      loading.value = false;
    }
  }, (error) => {
    loading.value = false;
    errorMessage.value = error.message;
  });
  window.addEventListener('food-inventory-updated', handleInventoryUpdated);
});

onUnmounted(() => {
  unsubscribe?.();
  window.removeEventListener('food-inventory-updated', handleInventoryUpdated);
});

function handleInventoryUpdated(event: Event): void {
  const detail = (event as CustomEvent<{ userId?: string }>).detail;
  if (user.value && detail?.userId === user.value.uid) void loadData(user.value.uid);
}

async function loadData(userId: string): Promise<void> {
  const sequence = ++loadSequence;
  loading.value = true;
  errorMessage.value = '';
  const results = await Promise.allSettled([
    listFoodItems(userId),
    listFoodConsumptions(userId),
    getHealthProfile(userId),
    listWeeklyMealPlans(userId),
    listWeeklyMealFavorites(userId),
  ]);
  if (sequence !== loadSequence || user.value?.uid !== userId) return;

  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
  if (results[0].status === 'fulfilled') inventory.value = results[0].value;
  if (results[1].status === 'fulfilled') consumption.value = results[1].value;
  if (results[2].status === 'fulfilled') profile.value = results[2].value;
  if (results[4].status === 'fulfilled') favorites.value = results[4].value;
  if (results[3].status === 'fulfilled') {
    plans.value = results[3].value.map((plan) => ({
      ...plan,
      meals: plan.meals.map((meal) => refreshMealRecommendation(meal, inventory.value, favorites.value)),
    }));
    currentPlanId.value = plans.value[0]?.id ?? '';
  }
  errorMessage.value = errors.join(' ');
  loading.value = false;
}

function selectDay(event: CustomEvent<{ value?: string | number | undefined }>): void {
  const value = event.detail.value;
  if (typeof value === 'string' && recommendationDays.includes(value as (typeof recommendationDays)[number])) {
    selectedDay.value = value as (typeof recommendationDays)[number];
  }
}

function selectPlan(event: CustomEvent<{ value?: string }>): void {
  if (event.detail.value && plans.value.some((plan) => plan.id === event.detail.value)) {
    currentPlanId.value = event.detail.value;
  }
}

async function generatePlan(): Promise<void> {
  const authenticatedUser = user.value;
  if (!authenticatedUser || generating.value) return;
  confirmGenerate.value = false;
  generating.value = true;
  errorMessage.value = '';
  try {
    const generated = generateWeeklyMealPlan({
      inventory: inventory.value,
      profile: profile.value,
      consumption: sortConsumptionsNewestFirst(consumption.value),
      favorites: favorites.value,
    });
    const saved = await saveWeeklyMealPlan(authenticatedUser.uid, generated);
    plans.value = [saved, ...plans.value];
    currentPlanId.value = saved.id;
    selectedDay.value = 'Monday';
    notify('New weekly plan saved.', 'success');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    generating.value = false;
  }
}

function openDetails(meal: MealRecommendation): void {
  detailMeal.value = meal;
}

function openReplacement(meal: MealRecommendation): void {
  replacementMeal.value = meal;
}

function confirmReplacement(alternative: MealRecommendation): void {
  if (!replacementMeal.value) return;
  pendingReplacement.value = replacementMeal.value;
  pendingReplacementRecipeId.value = alternative.recipeId;
  replacementMeal.value = null;
}

function cancelReplacement(): void {
  pendingReplacement.value = null;
  pendingReplacementRecipeId.value = '';
}

async function applyReplacement(): Promise<void> {
  const authenticatedUser = user.value;
  const plan = currentPlan.value;
  const meal = pendingReplacement.value;
  const recipeId = pendingReplacementRecipeId.value;
  if (!authenticatedUser || !plan || !meal || !recipeId || saving.value) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    const updated = replaceRecommendedMeal(
      plan,
      meal.id,
      recipeId,
      inventory.value,
      profile.value,
      favorites.value,
    );
    await updateWeeklyMealPlan(authenticatedUser.uid, updated);
    plans.value = plans.value.map((entry) => entry.id === updated.id ? updated : entry);
    notify('Meal replaced in the saved plan.', 'success');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    saving.value = false;
    cancelReplacement();
  }
}

async function toggleFavorite(meal: MealRecommendation): Promise<void> {
  const authenticatedUser = user.value;
  if (!authenticatedUser || saving.value) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    const nextFavorites = new Set(favorites.value);
    if (nextFavorites.has(meal.recipeId)) {
      await deleteWeeklyMealFavorite(authenticatedUser.uid, meal.recipeId);
      nextFavorites.delete(meal.recipeId);
    } else {
      await saveWeeklyMealFavorite(authenticatedUser.uid, {
        recipeId: meal.recipeId,
        recipeName: meal.recipeName,
      });
      nextFavorites.add(meal.recipeId);
    }
    favorites.value = nextFavorites;
    plans.value = plans.value.map((plan) => ({
      ...plan,
      meals: plan.meals.map((entry) => entry.recipeId === meal.recipeId
        ? { ...entry, savedAsFavorite: nextFavorites.has(meal.recipeId) }
        : entry),
    }));
    notify(nextFavorites.has(meal.recipeId) ? 'Meal saved to favorites.' : 'Meal removed from favorites.', 'success');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    saving.value = false;
  }
}

async function removePlan(): Promise<void> {
  const authenticatedUser = user.value;
  const plan = deletePlanTarget.value;
  if (!authenticatedUser || !plan) return;
  saving.value = true;
  try {
    await deleteWeeklyMealPlan(authenticatedUser.uid, plan.id);
    plans.value = plans.value.filter((entry) => entry.id !== plan.id);
    currentPlanId.value = plans.value[0]?.id ?? '';
    notify('Weekly plan deleted.', 'success');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    saving.value = false;
    deletePlanTarget.value = null;
  }
}

function formatNutrient(meal: MealRecommendation, id: MealNutrientId): string {
  const value = meal.nutrition.values[id];
  if (!value) return 'Nutrition Data Unavailable';
  const isPartial = meal.ingredients.some((ingredient) => {
    const contribution = ingredient.nutrients[id];
    return !contribution || !Number.isFinite(contribution.amount) || contribution.unit !== value.unit;
  });
  return `${formatNumber(value.amount)} ${value.unit}${isPartial ? ' · partial' : ''}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function dateForDay(day: (typeof recommendationDays)[number]): string {
  const start = currentPlan.value?.weekStartDate ?? getMondayDate();
  const date = new Date(`${start}T12:00:00`);
  date.setDate(date.getDate() + recommendationDays.indexOf(day));
  return localDate(date);
}

function localDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string): string {
  if (!value) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string): string {
  if (!value) return 'saved';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function notify(message: string, color: 'success' | 'danger'): void {
  toastMessage.value = message;
  toastColor.value = color;
}
</script>

<style scoped>
.weekly-page { width: min(1120px, 100%); margin: 0 auto; padding: 24px 18px 56px; }
.weekly-hero { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; padding: 25px; border-radius: 20px; background: linear-gradient(90deg, rgb(20 62 47 / 96%) 0%, rgb(25 91 56 / 90%) 58%, rgb(25 91 56 / 34%) 100%), url('/images/food-banner.svg') center / cover no-repeat; box-shadow: 0 14px 32px rgb(25 80 61 / 13%); color: #fff; }
.weekly-hero .eyebrow { color: #bcebd0; }
.weekly-hero h1 { margin: 7px 0; font-size: clamp(1.7rem, 5vw, 2.2rem); }
.weekly-hero p:last-child { margin: 0; color: rgb(255 255 255 / 84%); }
.weekly-hero ion-button { flex-shrink: 0; --border-radius: 11px; }
.eyebrow { margin: 0; color: #2f8568; font-size: 0.68rem; font-weight: 750; letter-spacing: 0.1em; }
.context-card, .meal-card, .empty-plan, .alternative-card { margin: 0; border: 1px solid #e4ece6; border-radius: 14px; box-shadow: 0 5px 16px rgb(28 65 48 / 4%); }
.context-card { margin-bottom: 20px; }
.context-card ion-card-content { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 17px; }
.context-card strong { color: #284a39; }
.context-card p { margin: 4px 0 0; color: #77857c; font-size: 0.78rem; line-height: 1.45; }
.context-chip { padding: 7px 10px; border-radius: 999px; background: #eef6f0; }
.context-card .allergy-chip { background: #fff0ed; color: #94483d; }
.plan-controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 22px 0 12px; }
.plan-controls h2 { margin: 4px 0; color: #254536; font-size: 1.2rem; }
.plan-select { min-width: min(360px, 100%); --background: #f7f9f7; --border-radius: 10px; }
.empty-plan ion-card-content { padding: 24px; }
.empty-plan h2 { color: #284a39; }
.empty-plan p, .section-help { color: #74837a; font-size: 0.83rem; line-height: 1.5; }
ion-segment { margin-top: 10px; --background: #f0f5f1; border-radius: 12px; }
ion-segment-button { min-width: 62px; --indicator-color: #28785f; --color-checked: #fff; }
.day-date { margin: 12px 0; color: #6f7f74; font-size: 0.82rem; font-weight: 600; }
.meal-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.meal-card ion-card-content { display: grid; gap: 12px; padding: 16px; }
.meal-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.meal-category { margin: 0 0 4px; color: #43856a; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; }
.meal-heading h2, .no-meal h2 { margin: 0; color: #284a39; font-size: 1.05rem; }
.meal-ingredients { display: flex; flex-wrap: wrap; gap: 6px; }
.ingredient-links { display: flex; flex-wrap: wrap; gap: 2px; margin: 4px 0; }
.ingredient-chip { padding: 6px 8px; border-radius: 999px; background: #eff5f0; color: #42604c; font-size: 0.7rem; }
.ingredient-unavailable { background: #fff0ed; color: #99493e; }
.ingredient-unverified { background: #fff5df; color: #836328; }
.missing-note, .unavailable-note { margin: 0; color: #8c572d; font-size: 0.75rem; line-height: 1.45; }
.missing-note span { display: block; color: #7d827b; }
.nutrition-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.nutrition-summary > div { display: grid; gap: 4px; padding: 8px; border-radius: 9px; background: #f6f8f6; }
.nutrition-summary span { color: #7a877f; font-size: 0.67rem; }
.nutrition-summary strong { color: #284a39; font-size: 0.76rem; overflow-wrap: anywhere; }
.meal-actions { display: flex; flex-wrap: wrap; gap: 2px; }
.meal-actions ion-button { font-size: 0.7rem; text-transform: none; }
.no-meal { padding: 8px 0; }
.no-meal p:last-child { color: #77857c; font-size: 0.8rem; line-height: 1.45; }
.safety-note { margin: 18px 0 0; padding: 12px; border: 1px solid #e5ece6; border-radius: 10px; color: #6c7b71; font-size: 0.75rem; line-height: 1.5; }
.modal-content { max-width: 760px; margin: 0 auto; padding: 20px 16px 38px; }
.modal-content h2 { margin: 5px 0 18px; color: #254536; }
.modal-content h3 { margin: 18px 0 8px; color: #284a39; font-size: 0.95rem; }
.modal-content ion-item { --background: #f7f9f7; --border-radius: 10px; margin-bottom: 5px; }
.modal-content ion-item p, .instructions { color: #728078; font-size: 0.8rem; line-height: 1.45; }
.detail-nutrition { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.alternative-card { margin-bottom: 10px; }
.alternative-card h3 { margin: 0 0 6px; color: #284a39; }
.alternative-card p { color: #728078; font-size: 0.78rem; line-height: 1.45; }
.error-card { border: 1px solid #f1d3cd; border-radius: 12px; box-shadow: none; color: #943e33; }

@media (max-width: 700px) {
  .weekly-page { padding: 16px 12px 38px; }
  .weekly-hero { align-items: flex-start; flex-direction: column; padding: 20px; }
  .plan-controls { align-items: stretch; flex-direction: column; }
  .plan-select { width: 100%; }
  .meal-grid { grid-template-columns: 1fr; }
}
</style>
