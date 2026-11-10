export interface NutritionValue {
  amount: number;
  unit: string;
  name: string;
  comparable?: boolean;
}

export interface FoodPortion {
  description: string;
  gramWeight: number;
  amount: number | null;
  unit: string;
}

export interface NutritionProfile {
  fdcId: number | null;
  description: string;
  dataType: string;
  foodCategory: string;
  brandOwner: string;
  householdServing: string;
  servingSize: number | null;
  servingSizeUnit: string;
  basisGrams: number | null;
  basisMilliliters?: number | null;
  basisDescription: string;
  nutrients: Record<string, NutritionValue>;
  portions: FoodPortion[];
  source: 'USDA FoodData Central' | 'Open Food Facts';
  sourceProductId?: string;
}

export function mapOpenFoodFactsNutrition(raw: unknown): NutritionProfile {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Open Food Facts returned an invalid product response.');
  }
  const product = raw as {
    code?: string;
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    categories?: string;
    quantity?: string;
    serving_size?: string;
    nutriments?: Record<string, unknown>;
  };
  const description = product.product_name?.trim() || product.product_name_en?.trim();
  if (!description || !product.code) {
    throw new Error('Open Food Facts product details are incomplete.');
  }

  const nutriments = product.nutriments ?? {};
  const nutrients: Record<string, NutritionValue> = {};
  const per100Grams = Object.keys(nutriments).some((key) => key.endsWith('_100g'));
  const per100Ml = !per100Grams && Object.keys(nutriments).some((key) => key.endsWith('_100ml'));
  const basisSuffix = per100Grams ? '_100g' : per100Ml ? '_100ml' : '';
  const mappings: Array<{ id: string; key: string; unit: string; name: string; comparable?: boolean }> = [
    { id: '208', key: 'energy-kcal', unit: 'kcal', name: 'Energy' },
    { id: '268', key: 'energy-kj', unit: 'kJ', name: 'Energy' },
    { id: '203', key: 'proteins', unit: 'g', name: 'Protein' },
    { id: '205', key: 'carbohydrates', unit: 'g', name: 'Carbohydrates' },
    { id: '204', key: 'fat', unit: 'g', name: 'Total fat' },
    { id: '291', key: 'fiber', unit: 'g', name: 'Dietary fiber' },
    { id: '307', key: 'sodium', unit: 'mg', name: 'Sodium' },
    { id: '301', key: 'calcium', unit: 'mg', name: 'Calcium' },
    { id: '303', key: 'iron', unit: 'mg', name: 'Iron' },
    { id: '306', key: 'potassium', unit: 'mg', name: 'Potassium' },
    { id: '304', key: 'magnesium', unit: 'mg', name: 'Magnesium' },
    { id: '309', key: 'zinc', unit: 'mg', name: 'Zinc' },
    { id: '305', key: 'phosphorus', unit: 'mg', name: 'Phosphorus' },
    { id: '320', key: 'vitamin-a', unit: 'µg', name: 'Vitamin A', comparable: false },
    { id: '401', key: 'vitamin-c', unit: 'mg', name: 'Vitamin C' },
    { id: '323', key: 'vitamin-e', unit: 'mg', name: 'Vitamin E' },
    { id: '404', key: 'vitamin-b1', unit: 'mg', name: 'Thiamin (B1)' },
    { id: '405', key: 'vitamin-b2', unit: 'mg', name: 'Riboflavin (B2)' },
    { id: '406', key: 'vitamin-b3', unit: 'mg', name: 'Niacin (B3)' },
    { id: '415', key: 'vitamin-b6', unit: 'mg', name: 'Vitamin B6' },
    { id: '417', key: 'vitamin-b9', unit: 'µg', name: 'Folate (B9)', comparable: false },
    { id: '418', key: 'vitamin-b12', unit: 'µg', name: 'Vitamin B12' },
    { id: '328', key: 'vitamin-d', unit: 'µg', name: 'Vitamin D' },
  ];
  for (const mapping of mappings) {
    const rawValue = nutriments[`${mapping.key}${basisSuffix}`];
    const amount = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (rawValue === undefined || rawValue === null || rawValue === '' || !Number.isFinite(amount)) continue;
    const convertedAmount = mapping.id === '307'
      ? amount * 1000
      : amount;
    nutrients[mapping.id] = {
      amount: Number(convertedAmount.toFixed(4)),
      unit: mapping.unit,
      name: mapping.name,
      ...(mapping.comparable === undefined ? {} : { comparable: mapping.comparable }),
    };
  }

  const servingSize = product.serving_size?.trim() ?? '';
  const basis = per100Grams ? 100 : null;
  return {
    fdcId: null,
    description,
    dataType: 'Packaged product',
    foodCategory: product.categories ?? '',
    brandOwner: product.brands ?? '',
    householdServing: servingSize,
    servingSize: null,
    servingSizeUnit: '',
    basisGrams: basis,
    basisMilliliters: per100Ml ? 100 : null,
    basisDescription: basis === 100
      ? 'per 100 g (Open Food Facts)'
      : per100Ml ? 'per 100 mL; gram conversion unavailable' : 'serving basis unavailable',
    nutrients,
    portions: [],
    source: 'Open Food Facts',
    sourceProductId: product.code,
  };
}

export interface UsdaFoodSearchResult {
  fdcId: number;
  description: string;
  dataType: string;
  foodCategory: string;
  brandOwner: string;
  householdServing: string;
  servingSize: number | null;
  servingSizeUnit: string;
}

export interface UsdaSearchPage {
  foods: UsdaFoodSearchResult[];
  totalHits: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}

interface RawNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  value?: number | null;
  amount?: number | null;
  nutrient?: {
    id?: number;
    number?: string;
    name?: string;
    unitName?: string;
  };
}

interface RawFood {
  fdcId?: number;
  description?: string;
  dataType?: string;
  foodCategory?: string | { description?: string };
  brandOwner?: string;
  householdServingFullText?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: RawNutrient[];
  foodPortions?: Array<{
    gramWeight?: number;
    amount?: number;
    modifier?: string;
    measureUnit?: { name?: string; abbreviation?: string };
  }>;
}

const nutrientIdToNumber: Record<number, string> = {
  1003: '203',
  1004: '204',
  1005: '205',
  1008: '208',
  1018: '268',
  1079: '291',
  1087: '301',
  1089: '303',
  1092: '306',
  1090: '304',
  1095: '309',
  1093: '307',
  1106: '320',
  1162: '401',
  1109: '323',
  1175: '415',
  1178: '418',
  1177: '435',
  1187: '417',
  1091: '305',
  1110: '324',
  1114: '328',
};

const nutrientNames: Record<string, string> = {
  '203': 'Protein',
  '204': 'Total fat',
  '205': 'Carbohydrates',
  '208': 'Energy',
  '268': 'Energy',
  '291': 'Dietary fiber',
  '301': 'Calcium',
  '303': 'Iron',
  '306': 'Potassium',
  '307': 'Sodium',
  '318': 'Vitamin A',
  '320': 'Vitamin A (RAE)',
  '401': 'Vitamin C',
  '328': 'Vitamin D',
  '324': 'Vitamin D (IU)',
  '323': 'Vitamin E (alpha-tocopherol)',
  '415': 'Vitamin B6',
  '418': 'Vitamin B12',
  '435': 'Folate (DFE)',
  '417': 'Folate',
  '304': 'Magnesium',
  '309': 'Zinc',
  '305': 'Phosphorus',
};

const nutrientPriorities: Record<string, number> = {
  '203': 10,
  '204': 10,
  '205': 10,
  '208': 10,
  '268': 10,
  '291': 10,
  '301': 10,
  '303': 10,
  '306': 10,
  '307': 10,
  '318': 1,
  '320': 10,
  '401': 10,
  '324': 5,
  '328': 10,
  '323': 10,
  '415': 10,
  '418': 10,
  '435': 10,
  '417': 5,
  '304': 10,
  '309': 10,
  '305': 10,
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizedUnit(value: string): string {
  const unit = value.trim();
  const normalized = unit.toLowerCase();
  if (normalized === 'kcal' || normalized === 'kilocalorie' || normalized === 'kilocalories') return 'kcal';
  if (normalized === 'kj' || normalized === 'kilojoule' || normalized === 'kilojoules') return 'kJ';
  if (normalized === 'g' || normalized === 'grm' || normalized === 'gram' || normalized === 'grams') return 'g';
  if (normalized === 'mg' || normalized === 'milligram' || normalized === 'milligrams') return 'mg';
  if (normalized === 'µg' || normalized === 'μg' || normalized === 'mcg' || normalized === 'ug') return 'µg';
  if (normalized === 'iu') return 'IU';
  if (normalized === 'µg rae' || normalized === 'μg rae' || normalized === 'mcg rae') return 'µg RAE';
  if (normalized === 'µg dfe' || normalized === 'μg dfe' || normalized === 'mcg dfe') return 'µg DFE';
  return unit;
}

function getFoodCategory(food: RawFood): string {
  return typeof food.foodCategory === 'string'
    ? food.foodCategory
    : asText(food.foodCategory?.description);
}

function getBasis(food: RawFood): { grams: number | null; description: string } {
  const dataType = asText(food.dataType).toLocaleLowerCase();
  if (dataType !== 'branded') return { grams: 100, description: 'per 100 g' };

  const unit = normalizedUnit(asText(food.servingSizeUnit));
  if (unit === 'g' && Number.isFinite(food.servingSize) && Number(food.servingSize) > 0) {
    return { grams: Number(food.servingSize), description: `per 100 g (normalized from ${food.servingSize} g serving)` };
  }
  return { grams: null, description: 'per serving; gram weight unavailable' };
}

function extractNutrients(food: RawFood, basisGrams: number | null): Record<string, NutritionValue> {
  const entries = new Map<string, { nutrient: NutritionValue; priority: number }>();
  for (const raw of food.foodNutrients ?? []) {
    const sourceNumber = raw.nutrientNumber
      ?? raw.nutrient?.number
      ?? (raw.nutrientId ? nutrientIdToNumber[raw.nutrientId] : undefined)
      ?? (raw.nutrient?.id ? nutrientIdToNumber[raw.nutrient.id] : undefined);
    const rawAmount = raw.amount ?? raw.value;
    if (!sourceNumber || rawAmount == null || !Number.isFinite(rawAmount)) continue;
    const number = nutrientIdToNumber[Number(sourceNumber)] ?? sourceNumber;

    const unit = normalizedUnit(raw.unitName ?? raw.nutrient?.unitName ?? '');
    if (number === '208' && unit !== 'kcal') continue;
    if (number === '268' && unit !== 'kJ') continue;

    const amount = basisGrams === null ? rawAmount : (rawAmount * 100) / basisGrams;
    const nutrient: NutritionValue = {
      amount: Number(amount.toFixed(4)),
      unit,
      name: nutrientNames[number] ?? raw.nutrientName ?? raw.nutrient?.name ?? `Nutrient ${number}`,
    };
    const current = entries.get(number);
    const priority = nutrientPriorities[number] ?? 5;
    if (!current || priority > current.priority) entries.set(number, { nutrient, priority });
  }

  if (entries.has('320')) entries.delete('318');
  if (entries.has('435')) entries.delete('417');
  if (entries.has('328')) entries.delete('324');
  return Object.fromEntries([...entries.entries()].map(([number, entry]) => [number, entry.nutrient]));
}

function extractPortions(food: RawFood): FoodPortion[] {
  return (food.foodPortions ?? [])
    .filter((portion) => Number.isFinite(portion.gramWeight) && Number(portion.gramWeight) > 0)
    .map((portion) => ({
      description: [portion.amount, portion.measureUnit?.name ?? portion.measureUnit?.abbreviation, portion.modifier]
        .filter(Boolean)
        .join(' ')
        || 'USDA portion',
      gramWeight: Number(portion.gramWeight),
      amount: Number.isFinite(portion.amount) ? Number(portion.amount) : null,
      unit: asText(portion.measureUnit?.name ?? portion.measureUnit?.abbreviation),
    }));
}

export function mapUsdaSearchFood(raw: unknown): UsdaFoodSearchResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const food = raw as RawFood;
  if (!Number.isInteger(food.fdcId) || !food.description) return null;
  return {
    fdcId: Number(food.fdcId),
    description: asText(food.description),
    dataType: asText(food.dataType),
    foodCategory: getFoodCategory(food),
    brandOwner: asText(food.brandOwner),
    householdServing: asText(food.householdServingFullText),
    servingSize: Number.isFinite(food.servingSize) ? Number(food.servingSize) : null,
    servingSizeUnit: asText(food.servingSizeUnit),
  };
}

export function mapUsdaFoodDetails(raw: unknown): NutritionProfile {
  if (!raw || typeof raw !== 'object') throw new Error('USDA returned an invalid food details response.');
  const food = raw as RawFood;
  if (!Number.isInteger(food.fdcId) || !food.description) {
    throw new Error('USDA food details did not include a valid food ID and description.');
  }
  const basis = getBasis(food);
  return {
    fdcId: Number(food.fdcId),
    description: asText(food.description),
    dataType: asText(food.dataType) || 'Unknown',
    foodCategory: getFoodCategory(food),
    brandOwner: asText(food.brandOwner),
    householdServing: asText(food.householdServingFullText),
    servingSize: Number.isFinite(food.servingSize) ? Number(food.servingSize) : null,
    servingSizeUnit: asText(food.servingSizeUnit),
    basisGrams: basis.grams,
    basisMilliliters: null,
    basisDescription: basis.description,
    nutrients: extractNutrients(food, basis.grams),
    portions: extractPortions(food),
    source: 'USDA FoodData Central',
  };
}

export function scaleNutritionForGrams(
  profile: NutritionProfile,
  grams: number,
): Record<string, NutritionValue> | null {
  if (!Number.isFinite(grams) || grams <= 0 || profile.basisGrams === null || profile.basisGrams <= 0) return null;
  return Object.fromEntries(Object.entries(profile.nutrients).map(([id, value]) => [
    id,
    { ...value, amount: Number(((value.amount * grams) / 100).toFixed(4)) },
  ]));
}

export function scaleNutritionForMilliliters(
  profile: NutritionProfile,
  milliliters: number,
): Record<string, NutritionValue> | null {
  const basis = profile.basisMilliliters;
  if (!Number.isFinite(milliliters) || milliliters <= 0 || basis == null || basis <= 0) return null;
  return Object.fromEntries(Object.entries(profile.nutrients).map(([id, value]) => [
    id,
    { ...value, amount: Number(((value.amount * milliliters) / basis).toFixed(4)) },
  ]));
}

export function getAdditionalNutrients(
  profile: NutritionProfile,
  primaryNutrientIds: readonly string[],
): Array<[string, NutritionValue]> {
  const displayedIds = new Set(primaryNutrientIds);
  displayedIds.add('318');
  if (profile.nutrients['208']) displayedIds.add('268');

  return Object.entries(profile.nutrients)
    .filter(([id]) => !displayedIds.has(id))
    .sort(([, a], [, b]) => a.name.localeCompare(b.name));
}
