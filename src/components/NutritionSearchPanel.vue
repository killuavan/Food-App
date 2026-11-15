<template>
  <section class="nutrition-search-panel">
    <ion-searchbar
      v-if="!autoSelectMatch"
      v-model="searchText"
      placeholder="Search foods in USDA FoodData Central"
      aria-label="Search USDA foods"
      :debounce="350"
      @ionInput="search"
    />

    <p v-if="errorMessage" class="api-error" role="alert">{{ errorMessage }}</p>
    <p v-else-if="autoSelectMatch && loadingSearch" class="search-hint">
      Looking up USDA nutrition for “{{ searchText }}”…
    </p>
    <ion-progress-bar v-if="loadingSearch" type="indeterminate" aria-label="Searching USDA foods" />

    <div v-if="!autoSelectMatch && !loadingSearch && searchPage?.foods.length" class="result-list">
      <ion-card v-for="food in searchPage.foods" :key="food.fdcId" class="result-card">
        <ion-card-content>
          <div class="result-copy">
            <h3>{{ food.description }}</h3>
            <p>{{ food.dataType }}<span v-if="food.foodCategory"> · {{ food.foodCategory }}</span></p>
            <p v-if="food.brandOwner">{{ food.brandOwner }}</p>
            <p>FDC ID: {{ food.fdcId }}<span v-if="servingDescription(food)"> · {{ servingDescription(food) }}</span></p>
          </div>
          <ion-button size="small" fill="outline" :disabled="loadingDetails" @click="selectFood(food)">
            <ion-spinner v-if="loadingDetails && selectedFdcId === food.fdcId" name="crescent" />
            <span>{{ selectedFdcId === food.fdcId && loadingDetails ? 'Loading' : 'View nutrients' }}</span>
          </ion-button>
        </ion-card-content>
      </ion-card>
      <div class="pagination">
        <span>{{ searchPage.totalHits.toLocaleString() }} matches · Page {{ searchPage.currentPage }} of {{ searchPage.totalPages.toLocaleString() }}</span>
        <div>
          <ion-button fill="clear" size="small" :disabled="loadingSearch || searchPage.currentPage <= 1" @click="loadPage(searchPage.currentPage - 1)">Previous</ion-button>
          <ion-button fill="clear" size="small" :disabled="loadingSearch || searchPage.currentPage >= searchPage.totalPages" @click="loadPage(searchPage.currentPage + 1)">Next</ion-button>
        </div>
      </div>
    </div>

    <p v-else-if="autoSelectMatch && hasSearched && !loadingSearch && !profile && !errorMessage" class="empty-results">
      Nutrition was not found automatically for “{{ searchText }}”. Try a more specific food name.
    </p>
    <p v-else-if="!autoSelectMatch && hasSearched && !loadingSearch && !errorMessage" class="empty-results">
      No USDA foods matched this search.
    </p>
    <p v-else-if="!hasSearched && !profile" class="search-hint">
      {{ autoSelectMatch
        ? 'Nutrition will appear here automatically when you enter a food name.'
        : 'Search the USDA database for verified food descriptions and nutrient data.' }}
    </p>

    <ion-card v-if="profile" class="nutrition-card">
      <ion-card-content>
        <div class="selected-heading">
          <div>
            <p class="eyebrow">{{ profile.source }}</p>
            <h2>{{ profile.description }}</h2>
            <p>{{ profile.dataType }}<span v-if="profile.foodCategory"> · {{ profile.foodCategory }}</span></p>
            <p>FDC ID: {{ profile.fdcId }}<span v-if="profile.brandOwner"> · {{ profile.brandOwner }}</span></p>
          </div>
          <ion-note v-if="autoLinked" class="auto-linked-note" color="success">
            <ion-icon :icon="checkmarkCircleOutline" />
            Automatically linked · verify this match
          </ion-note>
          <ion-button v-else fill="clear" size="small" @click="emit('selected', profile)">
            <ion-icon slot="start" :icon="checkmarkCircleOutline" />
            {{ linkToInventory ? 'Link this food' : 'Use this food' }}
          </ion-button>
        </div>

        <p class="basis-note">
          Nutrients {{ profile.basisGrams === null ? profile.basisDescription : 'normalized to per 100 g' }}.
          <span v-if="profile.householdServing">Serving: {{ profile.householdServing }}.</span>
        </p>
        <p v-if="linkToInventory" class="basis-note">
          Verify that the selected food matches the inventory item before linking it.
        </p>
        <div v-if="profile.portions.length" class="portion-list">
          <span>USDA portions with gram weights:</span>
          <ion-badge v-for="portion in profile.portions.slice(0, 4)" :key="`${portion.description}-${portion.gramWeight}`" color="light">
            {{ portion.description }} = {{ formatNumber(portion.gramWeight) }} g
          </ion-badge>
        </div>

        <div class="nutrient-grid">
          <div v-for="nutrient in primaryNutrients" :key="nutrient.id" class="nutrient-item">
            <span>{{ nutrient.label }}</span>
            <strong>{{ formatNutrient(profile, nutrient.id) }}</strong>
          </div>
        </div>
        <details v-if="additionalNutrients.length" class="additional-nutrients">
          <summary>Additional nutrients available ({{ additionalNutrients.length }})</summary>
          <div class="nutrient-grid extra-grid">
            <div v-for="[id, nutrient] in additionalNutrients" :key="id" class="nutrient-item">
              <span>{{ nutrient.name }}</span>
              <strong>{{ formatNumber(nutrient.amount) }} {{ nutrient.unit || '' }}</strong>
            </div>
          </div>
        </details>
      </ion-card-content>
    </ion-card>
  </section>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonNote,
  IonProgressBar,
  IonSearchbar,
  IonSpinner,
} from '@ionic/vue';
import { checkmarkCircleOutline } from 'ionicons/icons';
import { getUsdaFoodDetails, searchUsdaFoods } from '../services/usdaFoodDataService';
import { isConfidentFoodMatch } from '../utils/usdaFoodMatching';
import { getAdditionalNutrients, type NutritionProfile, type UsdaFoodSearchResult, type UsdaSearchPage } from '../utils/usdaNutrition';

const props = defineProps<{
  initialProfile?: NutritionProfile | null;
  initialSearch?: string;
  linkToInventory?: boolean;
  autoSelectMatch?: boolean;
}>();

const emit = defineEmits<{
  selected: [profile: NutritionProfile];
}>();

const primaryNutrients = [
  { id: '208', label: 'Energy' },
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
] as const;

const searchText = ref('');
const searchPage = ref<UsdaSearchPage | null>(null);
const profile = ref<NutritionProfile | null>(props.initialProfile ?? null);
watch(() => props.initialProfile, (value) => {
  profile.value = value ?? null;
});
const loadingSearch = ref(false);
const loadingDetails = ref(false);
const hasSearched = ref(false);
const autoLinked = ref(false);
const errorMessage = ref('');
const selectedFdcId = ref<number | null>(null);
let searchSequence = 0;
let detailsSequence = 0;
let initialSearchTimer: ReturnType<typeof setTimeout> | null = null;

const additionalNutrients = computed(() => profile.value
  ? getAdditionalNutrients(profile.value, primaryNutrients.map((nutrient) => nutrient.id))
  : []);

watch(() => props.initialSearch, (value, previousValue) => {
  const query = value?.trim() ?? '';
  if (initialSearchTimer) clearTimeout(initialSearchTimer);
  if (!query) {
    if (props.autoSelectMatch && previousValue?.trim()) {
      searchText.value = '';
      void searchFoods('', false);
    }
    return;
  }
  if (query === searchText.value.trim()) return;
  searchText.value = query;
  if (!props.autoSelectMatch) {
    void searchFoods(query, false);
    return;
  }
  initialSearchTimer = setTimeout(() => {
    void searchFoods(query, true);
    initialSearchTimer = null;
  }, 650);
}, { immediate: true });

onUnmounted(() => {
  searchSequence += 1;
  detailsSequence += 1;
  if (initialSearchTimer) clearTimeout(initialSearchTimer);
});

async function search(event: CustomEvent<{ value?: string | null }>): Promise<void> {
  searchText.value = event.detail.value ?? searchText.value;
  await searchFoods(searchText.value.trim(), false);
}

async function searchFoods(query: string, autoSelectMatch: boolean): Promise<void> {
  const sequence = ++searchSequence;
  detailsSequence += 1;
  autoLinked.value = false;
  loadingDetails.value = false;
  selectedFdcId.value = null;
  searchPage.value = null;
  profile.value = null;
  errorMessage.value = '';
  hasSearched.value = Boolean(query);
  if (!query) return;

  loadingSearch.value = true;
  try {
    let result = await searchUsdaFoods(query, 1, autoSelectMatch ? 25 : 10);
    let match = autoSelectMatch ? findAutoMatch(query, result.foods) : undefined;
    if (autoSelectMatch && !match && !/\b(raw|cooked|dry|dried|as sold)\b/i.test(query)) {
      result = await searchUsdaFoods(`${query} raw`, 1, 25);
      match = findAutoMatch(query, result.foods);
    }
    if (sequence === searchSequence) {
      searchPage.value = result;
      if (match) await selectFood(match, true);
    }
  } catch (error) {
    if (sequence === searchSequence) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (sequence === searchSequence) loadingSearch.value = false;
  }
}

async function loadPage(pageNumber: number): Promise<void> {
  const query = searchText.value.trim();
  if (!query) return;
  const sequence = ++searchSequence;
  loadingSearch.value = true;
  errorMessage.value = '';
  try {
    const result = await searchUsdaFoods(query, pageNumber);
    if (sequence === searchSequence) searchPage.value = result;
  } catch (error) {
    if (sequence === searchSequence) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (sequence === searchSequence) loadingSearch.value = false;
  }
}

async function selectFood(food: UsdaFoodSearchResult, autoLink = false): Promise<void> {
  const sequence = ++detailsSequence;
  selectedFdcId.value = food.fdcId;
  loadingDetails.value = true;
  autoLinked.value = false;
  profile.value = null;
  errorMessage.value = '';
  try {
    const result = await getUsdaFoodDetails(food.fdcId);
    if (sequence === detailsSequence) {
      profile.value = result;
      autoLinked.value = autoLink;
      if (autoLink) emit('selected', result);
    }
  } catch (error) {
    if (sequence === detailsSequence) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (sequence === detailsSequence) loadingDetails.value = false;
  }
}

function formatNutrient(nutrition: NutritionProfile, id: string): string {
  const nutrient = nutrition.nutrients[id] ?? (id === '320' ? nutrition.nutrients['318'] : undefined);
  return nutrient ? `${formatNumber(nutrient.amount)} ${nutrient.unit}` : 'Not Available';
}

function findAutoMatch(query: string, foods: UsdaFoodSearchResult[]): UsdaFoodSearchResult | undefined {
  return foods
    .filter((food) => isConfidentFoodMatch(query, food.description))
    .sort((a, b) => autoMatchScore(query, b) - autoMatchScore(query, a))[0];
}

function autoMatchScore(query: string, food: UsdaFoodSearchResult): number {
  const queryWords = query.toLocaleLowerCase().match(/[a-z0-9]+/g) ?? [];
  const descriptionWords = new Set(food.description.toLocaleLowerCase().match(/[a-z0-9]+/g) ?? []);
  const exactWordMatches = queryWords.filter((word) => descriptionWords.has(word)).length;
  const exactDescription = queryWords.join(' ') === [...descriptionWords].join(' ');
  const dataTypeScore = /foundation/i.test(food.dataType)
    ? 40
    : /sr legacy/i.test(food.dataType)
      ? 30
      : /survey \(fndds\)/i.test(food.dataType)
        ? 10
        : /branded/i.test(food.dataType) ? 0 : 20;
  return dataTypeScore + (exactDescription ? 100 : 0) + exactWordMatches;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function servingDescription(food: UsdaFoodSearchResult): string {
  const amount = food.servingSize;
  const unit = food.servingSizeUnit;
  return amount !== null && unit ? `Serving ${formatNumber(amount)} ${unit}${food.householdServing ? ` (${food.householdServing})` : ''}` : food.householdServing;
}
</script>

<style scoped>
.nutrition-search-panel { display: grid; gap: 12px; }
.nutrition-search-panel > ion-searchbar { --background: #f4f7f5; --border-radius: 12px; --box-shadow: none; padding: 0; }
.result-list { display: grid; gap: 8px; }
.result-card, .nutrition-card { margin: 0; border: 1px solid #e5ece7; border-radius: 14px; box-shadow: 0 4px 14px rgb(28 65 48 / 4%); }
.result-card ion-card-content { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 15px; }
.result-copy { min-width: 0; }
.result-copy h3 { margin: 0 0 5px; color: #254536; font-size: 0.92rem; }
.result-copy p { margin: 3px 0; color: #77857c; font-size: 0.75rem; }
.result-card ion-button { flex-shrink: 0; --border-radius: 9px; font-size: 0.74rem; text-transform: none; }
.pagination { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #7a8980; font-size: 0.76rem; }
.pagination ion-button { --color: #2d795a; text-transform: none; }
.api-error { margin: 0; padding: 11px 13px; border-radius: 10px; background: #fff0ed; color: #a34439; font-size: 0.82rem; }
.empty-results, .search-hint { margin: 0; padding: 16px; border: 1px dashed #dce7df; border-radius: 12px; color: #77857c; font-size: 0.82rem; }
.nutrition-card ion-card-content { padding: 18px; }
.selected-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.eyebrow { margin: 0 0 4px; color: #398670; font-size: 0.65rem; font-weight: 750; letter-spacing: 0.1em; }
.selected-heading h2 { margin: 0 0 5px; color: #203f32; font-size: 1.15rem; }
.selected-heading p:not(.eyebrow) { margin: 3px 0; color: #77857c; font-size: 0.76rem; }
.selected-heading ion-button { flex-shrink: 0; --color: #267352; font-size: 0.76rem; text-transform: none; }
.auto-linked-note { display: flex; align-items: center; gap: 5px; flex-shrink: 0; font-size: 0.72rem; }
.basis-note { margin: 14px 0 8px; color: #77857c; font-size: 0.75rem; }
.portion-list { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 12px; color: #728078; font-size: 0.73rem; }
.portion-list ion-badge { font-weight: 500; }
.nutrient-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.nutrient-item { display: grid; align-content: start; gap: 5px; min-height: 62px; padding: 10px; border-radius: 10px; background: #f5f8f5; }
.nutrient-item span { color: #78867e; font-size: 0.7rem; }
.nutrient-item strong { color: #284a39; font-size: 0.82rem; }
.additional-nutrients { margin-top: 13px; color: #2f7255; font-size: 0.8rem; }
.additional-nutrients summary { cursor: pointer; font-weight: 650; }
.extra-grid { margin-top: 10px; }

@media (max-width: 700px) {
  .nutrient-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .result-card ion-card-content { align-items: flex-start; flex-direction: column; }
  .pagination { align-items: flex-start; flex-direction: column; }
}
</style>
