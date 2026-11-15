import type { FoodConsumption } from './foodConsumption';
import type { FoodItem, FoodWeightState } from './foodInventory';
import type { HealthProfile } from './healthProfile';
import { scaleNutritionForGrams, type NutritionValue } from './usdaNutrition';

export const recommendationDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type RecommendationDay = (typeof recommendationDays)[number];
export type RecommendedMealCategory = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';
export type NutritionWeightState = FoodWeightState;
export type MealNutrientId = '208' | '203' | '205' | '204' | '291' | '301' | '303' | '306' | '307' | '320' | '401' | '324';

export interface RecipeIngredient {
  foodName: string;
  aliases: string[];
  amountGrams: number;
  pieceWeightGrams?: number;
  amountPieces?: number;
  amountPacks?: number;
  weightState?: NutritionWeightState;
  preparedFrom?: { amountGrams: number; weightState: NutritionWeightState };
  excludedInventoryCategories?: FoodItem['category'][];
}

export interface MealRecipe {
  id: string;
  name: string;
  category: RecommendedMealCategory;
  instructions: string;
  ingredients: RecipeIngredient[];
}

export interface RecommendedIngredient extends RecipeIngredient {
  inventoryItemId: string | null;
  inventoryFoodName: string | null;
  inventoryPackageWeightGrams?: number | null;
  inventoryPieceWeightGrams?: number | null;
  inventoryWeightState?: NutritionWeightState;
  amountToLog: number;
  unitToLog: 'g' | 'pcs' | 'packs';
  availableQuantity: number | null;
  availableUnit: 'g' | 'pcs' | 'packs' | null;
  availability: 'available' | 'unavailable' | 'unverified';
  verificationIssue: 'weight-unit' | 'weight-state' | null;
  availableGrams: number | null;
  nutrients: Partial<Record<MealNutrientId, NutritionValue>>;
}

export interface MealNutritionEstimate {
  values: Partial<Record<MealNutrientId, NutritionValue>>;
  complete: boolean;
}

export interface MealRecommendation {
  id: string;
  recipeId: string;
  recipeName: string;
  day: RecommendationDay;
  category: RecommendedMealCategory;
  instructions: string;
  ingredients: RecommendedIngredient[];
  missingIngredients: string[];
  nutrition: MealNutritionEstimate;
  savedAsFavorite: boolean;
}

export interface WeeklyMealPlan {
  id: string;
  weekStartDate: string;
  meals: MealRecommendation[];
  inventoryFingerprint?: string;
  createdAt: string;
  updatedAt: string;
}

const recommendationVersion = 16;

export function getInventoryFingerprint(
  inventory: FoodItem[],
  profile: HealthProfile | null = null,
): string {
  return JSON.stringify({
    recommendationVersion,
    dietaryPreferences: normalize(profile?.dietaryPreferences ?? ''),
    foodAllergies: normalize(profile?.foodAllergies ?? ''),
    inventory: [...inventory]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((item) => ({
        id: item.id,
        foodName: item.foodName,
        quantity: item.quantity,
        unit: item.unit,
        weightState: item.weightState,
        pieceWeightGrams: item.pieceWeightGrams,
        notes: item.notes,
        nutritionId: item.nutritionProfile?.fdcId ?? item.nutritionProfile?.sourceProductId ?? null,
        nutritionDescription: item.nutritionProfile?.description ?? null,
        updatedAt: item.updatedAt,
      })),
  });
}

export function isMealFullyAvailable(meal: MealRecommendation): boolean {
  return meal.ingredients.length > 0
    && meal.ingredients.every((ingredient) => ingredient.availability === 'available');
}

export const mealNutrients: Array<{ id: MealNutrientId; label: string }> = [
  { id: '208', label: 'Calories' },
  { id: '203', label: 'Protein' },
  { id: '205', label: 'Carbohydrates' },
  { id: '204', label: 'Total fat' },
  { id: '291', label: 'Fiber' },
  { id: '320', label: 'Vitamin A' },
  { id: '401', label: 'Vitamin C' },
  { id: '301', label: 'Calcium' },
  { id: '303', label: 'Iron' },
  { id: '306', label: 'Potassium' },
  { id: '307', label: 'Sodium' },
  { id: '324', label: 'Vitamin D' },
];

export const recipeCatalog: MealRecipe[] = [
  {
    id: 'egg-banana-breakfast',
    name: 'Egg and banana',
    category: 'Breakfast',
    instructions: 'Boil the egg until fully set, peel it, and serve with the banana.',
    ingredients: [
      { foodName: 'Egg', aliases: ['egg'], amountGrams: 50, pieceWeightGrams: 50, weightState: 'raw' },
      { foodName: 'Banana', aliases: ['banana'], amountGrams: 118, pieceWeightGrams: 118, weightState: 'raw' },
    ],
  },
  {
    id: 'oatmeal-banana',
    name: 'Oatmeal with banana',
    category: 'Breakfast',
    instructions: 'Cook the oats according to the package directions. Slice the banana and serve it over the oats.',
    ingredients: [
      { foodName: 'Oats', aliases: ['oat', 'rolled oats', 'oatmeal'], amountGrams: 50, weightState: 'dry' },
      { foodName: 'Banana', aliases: ['banana'], amountGrams: 80, pieceWeightGrams: 118, weightState: 'raw' },
    ],
  },
  {
    id: 'egg-wholegrain-toast',
    name: 'Eggs with whole-grain toast',
    category: 'Breakfast',
    instructions: 'Cook the egg thoroughly. Serve with toasted whole-grain bread.',
    ingredients: [
      { foodName: 'Egg', aliases: ['egg'], amountGrams: 50, pieceWeightGrams: 50, weightState: 'raw' },
      { foodName: 'Whole-grain bread', aliases: ['whole grain bread', 'whole-grain bread', 'wholemeal bread'], amountGrams: 40 },
    ],
  },
  {
    id: 'boiled-egg-breakfast',
    name: 'Boiled egg',
    category: 'Breakfast',
    instructions: 'Boil the egg until fully set, peel it, and serve.',
    ingredients: [{ foodName: 'Egg', aliases: ['egg'], amountGrams: 50, pieceWeightGrams: 50, weightState: 'raw' }],
  },
  {
    id: 'yogurt-fruit-bowl',
    name: 'Yogurt with fruit',
    category: 'Breakfast',
    instructions: 'Serve the yogurt with washed, prepared fruit.',
    ingredients: [
      { foodName: 'Yogurt', aliases: ['yogurt', 'yoghurt'], amountGrams: 150 },
      { foodName: 'Apple', aliases: ['apple'], amountGrams: 80, pieceWeightGrams: 150, weightState: 'raw' },
    ],
  },
  {
    id: 'rice-egg-vegetables',
    name: 'Rice with egg and vegetables',
    category: 'Breakfast',
    instructions: 'Cook the rice and vegetables fully. Cook the egg thoroughly and serve together.',
    ingredients: [
      { foodName: 'Rice', aliases: ['rice', 'kanin'], amountGrams: 150, weightState: 'cooked', preparedFrom: { amountGrams: 50, weightState: 'dry' } },
      { foodName: 'Egg', aliases: ['egg'], amountGrams: 50, pieceWeightGrams: 50, weightState: 'raw' },
      { foodName: 'Vegetables', aliases: ['vegetable'], amountGrams: 100, amountPieces: 1, weightState: 'raw' },
    ],
  },
  {
    id: 'chicken-rice-vegetables',
    name: 'Chicken with rice and vegetables',
    category: 'Lunch',
    instructions: 'Cook chicken thoroughly and cook the rice and vegetables. Serve together.',
    ingredients: [
      { foodName: 'Chicken', aliases: ['chicken'], amountGrams: 120, weightState: 'raw' },
      { foodName: 'Rice', aliases: ['rice', 'kanin'], amountGrams: 150, weightState: 'cooked', preparedFrom: { amountGrams: 50, weightState: 'dry' } },
      { foodName: 'Vegetables', aliases: ['vegetable'], amountGrams: 100, amountPieces: 1, weightState: 'raw' },
    ],
  },
  {
    id: 'fish-rice',
    name: 'Fish with rice',
    category: 'Lunch',
    instructions: 'Cook fish thoroughly and serve with cooked rice.',
    ingredients: [
      { foodName: 'Fish', aliases: ['fish', 'salmon', 'tuna', 'cod', 'tilapia'], amountGrams: 120, weightState: 'raw' },
      { foodName: 'Rice', aliases: ['rice', 'kanin'], amountGrams: 150, weightState: 'cooked', preparedFrom: { amountGrams: 50, weightState: 'dry' } },
    ],
  },
  {
    id: 'tuna-rice-bowl',
    name: 'Tuna rice bowl',
    category: 'Lunch',
    instructions: 'Serve the tuna according to its package directions with cooked rice.',
    ingredients: [
      { foodName: 'Tuna', aliases: ['tuna'], amountGrams: 120, amountPacks: 1, weightState: 'as-sold' },
      { foodName: 'Rice', aliases: ['rice', 'kanin'], amountGrams: 150, weightState: 'cooked', preparedFrom: { amountGrams: 50, weightState: 'dry' } },
    ],
  },
  {
    id: 'tuna-bigas-bowl',
    name: 'Tuna with rice',
    category: 'Lunch',
    instructions: 'Cook the dry rice according to its package directions, then serve with tuna.',
    ingredients: [
      { foodName: 'Tuna', aliases: ['tuna'], amountGrams: 120, amountPacks: 1, weightState: 'as-sold' },
      { foodName: 'Rice', aliases: ['rice', 'bigas'], amountGrams: 50, weightState: 'dry' },
    ],
  },
  {
    id: 'tuna-sandwich',
    name: 'Tuna sandwich',
    category: 'Lunch',
    instructions: 'Prepare the tuna according to its package directions and serve with bread.',
    ingredients: [
      { foodName: 'Tuna', aliases: ['tuna'], amountGrams: 100, amountPacks: 1, weightState: 'as-sold' },
      { foodName: 'Bread', aliases: ['bread'], amountGrams: 60 },
    ],
  },
  {
    id: 'tuna-egg-lunch',
    name: 'Tuna and egg',
    category: 'Lunch',
    instructions: 'Serve the tuna with a fully cooked egg.',
    ingredients: [
      { foodName: 'Tuna', aliases: ['tuna'], amountGrams: 120, amountPacks: 1, weightState: 'as-sold' },
      { foodName: 'Egg', aliases: ['egg'], amountGrams: 50, pieceWeightGrams: 50, weightState: 'raw' },
    ],
  },
  {
    id: 'tofu-vegetables',
    name: 'Tofu with vegetables',
    category: 'Lunch',
    instructions: 'Cook tofu and vegetables until heated through and serve together.',
    ingredients: [
      { foodName: 'Tofu', aliases: ['tofu'], amountGrams: 120 },
      { foodName: 'Vegetables', aliases: ['vegetable'], amountGrams: 150, amountPieces: 1, weightState: 'raw' },
    ],
  },
  {
    id: 'beans-vegetables',
    name: 'Vegetable and bean bowl',
    category: 'Lunch',
    instructions: 'Heat the beans thoroughly and serve with cooked vegetables.',
    ingredients: [
      { foodName: 'Beans', aliases: ['bean', 'beans', 'lentil', 'lentils', 'chickpea', 'chickpeas'], amountGrams: 120, weightState: 'cooked' },
      { foodName: 'Vegetables', aliases: ['vegetable'], amountGrams: 150, amountPieces: 1, weightState: 'raw' },
    ],
  },
  {
    id: 'fish-vegetables',
    name: 'Fish with vegetables',
    category: 'Dinner',
    instructions: 'Cook fish thoroughly and serve with cooked vegetables.',
    ingredients: [
      {
        foodName: 'Fish',
        aliases: ['fish', 'salmon', 'tuna', 'cod', 'tilapia'],
        amountGrams: 120,
        weightState: 'raw',
        excludedInventoryCategories: ['Canned Goods'],
      },
      { foodName: 'Vegetables', aliases: ['vegetable'], amountGrams: 180, amountPieces: 1, weightState: 'raw' },
    ],
  },
  {
    id: 'tuna-egg-omelette',
    name: 'Tuna omelette',
    category: 'Dinner',
    instructions: 'Mix tuna with beaten egg and cook until the egg is fully set.',
    ingredients: [
      { foodName: 'Tuna', aliases: ['tuna'], amountGrams: 120, amountPacks: 1, weightState: 'as-sold' },
      { foodName: 'Egg', aliases: ['egg'], amountGrams: 50, pieceWeightGrams: 50, weightState: 'raw' },
    ],
  },
  {
    id: 'chicken-vegetable-soup',
    name: 'Chicken and vegetable soup',
    category: 'Dinner',
    instructions: 'Simmer chicken and vegetables in water or broth until the chicken is thoroughly cooked.',
    ingredients: [
      { foodName: 'Chicken', aliases: ['chicken'], amountGrams: 120, weightState: 'raw' },
      { foodName: 'Vegetables', aliases: ['vegetable'], amountGrams: 180, amountPieces: 1, weightState: 'raw' },
    ],
  },
  {
    id: 'tofu-rice',
    name: 'Tofu with rice',
    category: 'Dinner',
    instructions: 'Cook the rice and heat the tofu thoroughly. Serve together.',
    ingredients: [
      { foodName: 'Tofu', aliases: ['tofu'], amountGrams: 120 },
      { foodName: 'Rice', aliases: ['rice', 'kanin'], amountGrams: 150, weightState: 'cooked', preparedFrom: { amountGrams: 50, weightState: 'dry' } },
    ],
  },
  {
    id: 'vegetable-rice',
    name: 'Vegetable rice bowl',
    category: 'Dinner',
    instructions: 'Cook the rice and vegetables fully and serve together.',
    ingredients: [
      { foodName: 'Rice', aliases: ['rice', 'kanin'], amountGrams: 150, weightState: 'cooked', preparedFrom: { amountGrams: 50, weightState: 'dry' } },
      { foodName: 'Vegetables', aliases: ['vegetable'], amountGrams: 180, amountPieces: 1, weightState: 'raw' },
    ],
  },
  {
    id: 'banana-snack',
    name: 'Banana',
    category: 'Snacks',
    instructions: 'Wash, peel, and serve the banana.',
    ingredients: [{ foodName: 'Banana', aliases: ['banana'], amountGrams: 118, pieceWeightGrams: 118, weightState: 'raw' }],
  },
  {
    id: 'egg-snack',
    name: 'Boiled egg',
    category: 'Snacks',
    instructions: 'Boil the egg until fully set, then peel and serve.',
    ingredients: [{ foodName: 'Egg', aliases: ['egg'], amountGrams: 50, pieceWeightGrams: 50, weightState: 'raw' }],
  },
  {
    id: 'apple-snack',
    name: 'Apple',
    category: 'Snacks',
    instructions: 'Wash and serve the apple.',
    ingredients: [{ foodName: 'Apple', aliases: ['apple'], amountGrams: 150, pieceWeightGrams: 150, weightState: 'raw' }],
  },
  {
    id: 'yogurt-snack',
    name: 'Yogurt',
    category: 'Snacks',
    instructions: 'Serve the yogurt chilled.',
    ingredients: [{ foodName: 'Yogurt', aliases: ['yogurt', 'yoghurt'], amountGrams: 150 }],
  },
];

const knownAllergens: Record<string, string[]> = {
  peanut: ['peanut'],
  peanuts: ['peanut'],
  'tree nut': ['almond', 'cashew', 'hazelnut', 'pecan', 'pistachio', 'walnut'],
  'tree nuts': ['almond', 'cashew', 'hazelnut', 'pecan', 'pistachio', 'walnut'],
  milk: ['milk', 'yogurt', 'yoghurt', 'cheese', 'butter', 'cream'],
  dairy: ['milk', 'yogurt', 'yoghurt', 'cheese', 'butter', 'cream'],
  egg: ['egg'],
  eggs: ['egg'],
  wheat: ['wheat', 'bread'],
  gluten: ['wheat', 'bread', 'barley', 'rye'],
  soy: ['soy', 'tofu'],
  fish: ['fish', 'salmon', 'tuna', 'cod', 'tilapia'],
  seafood: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'shrimp', 'crab', 'lobster'],
  shellfish: ['shrimp', 'crab', 'lobster', 'shellfish'],
  sesame: ['sesame'],
};

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function hasWord(text: string, word: string): boolean {
  const normalizedText = normalize(text);
  const normalizedWord = normalize(word);
  const plural = normalizedWord.endsWith('s') ? normalizedWord.slice(0, -1) : `${normalizedWord}s`;
  return ` ${normalizedText} `.includes(` ${normalizedWord} `)
    || ` ${normalizedText} `.includes(` ${plural} `);
}

function matchesIngredientAlias(item: FoodItem, alias: string): boolean {
  if (alias !== 'vegetable' || item.category !== 'Vegetables') {
    return hasWord(item.foodName, alias);
  }
  const name = normalize(item.foodName);
  const seasoningVegetables = ['garlic', 'onion', 'shallot', 'scallion', 'spring onion', 'green onion', 'chive', 'ginger'];
  return !seasoningVegetables.some((seasoning) => hasWord(name, seasoning));
}

function stateMatches(text: string, expected: NutritionWeightState | undefined): boolean {
  if (!expected || expected === 'as-sold') return true;
  const normalized = normalize(text);
  if (expected === 'dry' && hasWord(normalized, 'bigas')) return true;
  if (expected === 'cooked' && hasWord(normalized, 'kanin')) return true;
  const isCooked = ['cooked', 'boiled', 'steamed', 'baked', 'roasted', 'grilled', 'fried']
    .some((word) => hasWord(normalized, word));
  if (expected === 'cooked') return isCooked;
  if (isCooked) return false;
  if (expected === 'dry') return hasWord(normalized, 'dry') || hasWord(normalized, 'dried');
  return hasWord(normalized, 'raw') || hasWord(normalized, 'fresh');
}

function inventoryStateMatches(item: FoodItem, expected: NutritionWeightState | undefined): boolean {
  if (!expected || expected === 'as-sold') return true;
  if (item.weightState) return item.weightState === expected;
  const description = `${item.foodName} ${item.nutritionProfile?.description ?? ''}`;
  if (stateMatches(description, expected)) return true;
  if (expected === 'raw' && item.category === 'Meat') {
    return !stateMatches(description, 'cooked') && !stateMatches(description, 'dry');
  }
  if (expected === 'raw' && item.category === 'Vegetables') {
    return !stateMatches(description, 'cooked') && !stateMatches(description, 'dry');
  }
  return false;
}

function inventoryMatchesPreparedSource(
  item: FoodItem,
  ingredient: RecipeIngredient,
): boolean {
  const source = ingredient.preparedFrom;
  if (!source) return false;
  if (item.weightState) return item.weightState === source.weightState;
  const description = `${item.foodName} ${item.nutritionProfile?.description ?? ''}`;
  if (stateMatches(description, source.weightState)) return true;
  return source.weightState === 'dry'
    && ingredient.aliases.includes('rice')
    && !stateMatches(description, 'cooked');
}

function nutritionStateMatches(item: FoodItem, expected: NutritionWeightState | undefined): boolean {
  const description = item.nutritionProfile?.description ?? '';
  if (!expected || expected === 'as-sold' || stateMatches(description, expected)) return true;
  const descriptionNamesAnotherState = (['raw', 'cooked', 'dry'] as const).some((state) => (
    state !== expected && stateMatches(description, state)
  ));
  return inventoryStateMatches(item, expected) && !descriptionNamesAnotherState;
}

function inventoryPackageWeightGrams(item: FoodItem): number | null {
  if (item.unit !== 'pcs') return null;
  const packageDescription = item.notes.match(/(?:^|\n)\s*Package:\s*(\d+(?:[.,]\d+)?)\s*(kg|g|oz|lb)\b/i);
  if (!packageDescription) return null;
  const amount = Number(packageDescription[1].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = packageDescription[2].toLocaleLowerCase();
  const gramsPerUnit: Record<string, number> = {
    g: 1,
    kg: 1000,
    oz: 28.349523125,
    lb: 453.59237,
  };
  return amount * gramsPerUnit[unit];
}

function ingredientsFor(recipe: MealRecipe, inventory: FoodItem[]): RecommendedIngredient[] {
  return recipe.ingredients.map((ingredient) => {
    const matches = inventory.filter((item) => (
      item.quantity > 0
      && !ingredient.excludedInventoryCategories?.includes(item.category)
      && ingredient.aliases.some((alias) => matchesIngredientAlias(item, alias))
    ));
    const massMatches = matches.filter((item) => item.unit === 'g' || item.unit === 'kg');
    const stateMatchesInventory = massMatches.filter((item) => inventoryStateMatches(item, ingredient.weightState));
    const preparedSourceMatches = massMatches.filter((item) => inventoryMatchesPreparedSource(item, ingredient));
    const availableGrams = massMatches.reduce((sum, item) => (
      sum + item.quantity * (item.unit === 'kg' ? 1000 : 1)
    ), 0);
    const pieceMatches = ingredient.pieceWeightGrams !== undefined || ingredient.amountPieces !== undefined
      ? matches.filter((item) => item.unit === 'pcs' && inventoryStateMatches(item, ingredient.weightState))
      : [];
    const packageMatches = ingredient.amountPacks !== undefined
      ? matches.filter((item) => (
        (item.unit === 'packs' || item.unit === 'pcs')
        && inventoryStateMatches(item, ingredient.weightState)
      ))
      : [];
    const packageMassMatches = ingredient.pieceWeightGrams === undefined
      && ingredient.amountPieces === undefined
      && ingredient.amountPacks === undefined
      ? matches.filter((item) => (
        item.unit === 'pcs'
        && inventoryPackageWeightGrams(item) !== null
        && inventoryStateMatches(item, ingredient.weightState)
      ))
      : [];
    const enoughMassItems = stateMatchesInventory.filter((item) => (
      item.quantity * (item.unit === 'kg' ? 1000 : 1) >= ingredient.amountGrams
    ));
    const enoughPreparedSourceItems = ingredient.preparedFrom
      ? preparedSourceMatches.filter((item) => (
        item.quantity * (item.unit === 'kg' ? 1000 : 1) >= ingredient.preparedFrom!.amountGrams
      ))
      : [];
    const pieceAmount = ingredient.amountPieces !== undefined
      ? ingredient.amountPieces
      : ingredient.pieceWeightGrams
        ? Number((ingredient.amountGrams / ingredient.pieceWeightGrams).toFixed(2))
        : null;
    const enoughPieceItems = pieceMatches.filter((item) => item.quantity >= (pieceAmount ?? Number.POSITIVE_INFINITY));
    const enoughPackageItems = packageMatches.filter((item) => item.quantity >= (ingredient.amountPacks ?? Number.POSITIVE_INFINITY));
    const enoughPackageMassItems = packageMassMatches.filter((item) => (
      item.quantity * (inventoryPackageWeightGrams(item) ?? 0) >= ingredient.amountGrams
    ));
    const withNutrition = (items: FoodItem[]) => (
      items.find((item) => item.nutritionProfile && nutritionStateMatches(item, ingredient.weightState))
      ?? items[0]
      ?? null
    );
    const enoughMassItem = withNutrition(enoughMassItems);
    const enoughPieceItem = withNutrition(enoughPieceItems);
    const enoughPackageItem = withNutrition(enoughPackageItems);
    const enoughPackageMassItem = withNutrition(enoughPackageMassItems);
    const enoughPreparedSourceItem = withNutrition(enoughPreparedSourceItems);
    const selectedItem = enoughMassItem ?? enoughPreparedSourceItem ?? enoughPieceItem ?? enoughPackageItem ?? enoughPackageMassItem
      ?? stateMatchesInventory[0] ?? preparedSourceMatches[0] ?? pieceMatches[0] ?? packageMatches[0]
      ?? packageMassMatches[0] ?? massMatches[0] ?? matches[0] ?? null;
    const selectedIsPreparedSource = Boolean(selectedItem && ingredient.preparedFrom
      && inventoryMatchesPreparedSource(selectedItem, ingredient));
    const hasMassMatch = massMatches.length > 0;
    const availablePackageGrams = packageMassMatches.reduce((sum, item) => (
      sum + item.quantity * (inventoryPackageWeightGrams(item) ?? 0)
    ), 0);
    const hasPieceUnitMatch = matches.some((item) => item.unit === 'pcs');
    const hasStateMatch = stateMatchesInventory.length > 0 || preparedSourceMatches.length > 0 || pieceMatches.length > 0
      || packageMatches.length > 0 || packageMassMatches.length > 0;
    const hasEnoughQuantity = Boolean(enoughMassItem || enoughPreparedSourceItem || enoughPieceItem
      || enoughPackageItem || enoughPackageMassItem);
    const availability: RecommendedIngredient['availability'] = !matches.length
      ? 'unavailable'
      : !hasStateMatch
        ? 'unverified'
        : !hasEnoughQuantity
          ? 'unavailable'
          : 'available';
    const verificationIssue: RecommendedIngredient['verificationIssue'] = availability !== 'unverified'
      ? null
      : hasMassMatch || (hasPieceUnitMatch && Boolean(ingredient.pieceWeightGrams))
        || (hasPieceUnitMatch && ingredient.amountPieces !== undefined)
          ? 'weight-state'
          : 'weight-unit';
    const selectedIsPackage = Boolean(ingredient.amountPacks !== undefined && selectedItem
      && (selectedItem.unit === 'packs' || selectedItem.unit === 'pcs'));
    const selectedPackageWeightGrams = selectedItem ? inventoryPackageWeightGrams(selectedItem) : null;
    const selectedIsMeasuredPackage = selectedPackageWeightGrams !== null
      && ingredient.pieceWeightGrams === undefined
      && ingredient.amountPieces === undefined
      && ingredient.amountPacks === undefined;
    const selectedIsPiece = selectedItem?.unit === 'pcs'
      && (ingredient.pieceWeightGrams !== undefined || ingredient.amountPieces !== undefined);
    const nutritionWeightState = selectedIsPreparedSource ? ingredient.preparedFrom?.weightState : ingredient.weightState;
    const nutritionAmountGrams = selectedIsPreparedSource
      ? ingredient.preparedFrom?.amountGrams ?? ingredient.amountGrams
      : selectedIsPiece && ingredient.amountPieces !== undefined && selectedItem.pieceWeightGrams
        ? ingredient.amountPieces * selectedItem.pieceWeightGrams
        : ingredient.amountGrams;
    const scaled = selectedItem?.nutritionProfile && !selectedIsPackage
      && (!selectedIsPiece || ingredient.pieceWeightGrams !== undefined
        || (ingredient.amountPieces !== undefined && Boolean(selectedItem.pieceWeightGrams)))
      && nutritionStateMatches(selectedItem, nutritionWeightState)
      ? scaleNutritionForGrams(selectedItem.nutritionProfile, nutritionAmountGrams)
      : null;
    const selectedIsPack = selectedItem?.unit === 'packs' && selectedIsPackage;
    return {
      ...ingredient,
      inventoryItemId: selectedItem?.id ?? null,
      inventoryFoodName: selectedItem?.foodName ?? null,
      inventoryPackageWeightGrams: selectedIsMeasuredPackage ? selectedPackageWeightGrams : null,
      inventoryPieceWeightGrams: selectedItem?.pieceWeightGrams ?? null,
      inventoryWeightState: selectedIsPreparedSource
        ? ingredient.preparedFrom?.weightState
        : ingredient.weightState,
      amountToLog: selectedIsPackage
        ? (ingredient.amountPacks ?? 1)
        : selectedIsPiece
          ? (pieceAmount ?? ingredient.amountGrams)
          : selectedIsMeasuredPackage
            ? Number((ingredient.amountGrams / selectedPackageWeightGrams).toFixed(6))
            : selectedIsPreparedSource
              ? ingredient.preparedFrom?.amountGrams ?? ingredient.amountGrams
              : ingredient.amountGrams,
      unitToLog: selectedIsPack ? 'packs' : selectedIsPiece || selectedIsMeasuredPackage
        || (selectedIsPackage && selectedItem?.unit === 'pcs') ? 'pcs' : 'g',
      availableQuantity: selectedItem
        ? Number((selectedItem.quantity * (selectedItem.unit === 'kg' ? 1000 : 1)).toFixed(2))
        : null,
      availableUnit: selectedItem?.unit === 'pcs' || selectedItem?.unit === 'packs'
        ? selectedItem.unit
        : selectedItem ? 'g' : null,
      availability,
      verificationIssue,
      availableGrams: hasMassMatch || availablePackageGrams > 0
        ? Number((availableGrams + availablePackageGrams).toFixed(2))
        : null,
      nutrients: (scaled ?? {}) as Partial<Record<MealNutrientId, NutritionValue>>,
    };
  });
}

function isExcludedByProfile(
  recipe: MealRecipe,
  profile: HealthProfile | null,
  inventory: FoodItem[],
): boolean {
  if (!profile) return false;
  const recipeIngredients = recipe.ingredients.map((ingredient) => {
    const inventoryNames = inventory
      .filter((item) => (
        !ingredient.excludedInventoryCategories?.includes(item.category)
        && ingredient.aliases.some((alias) => matchesIngredientAlias(item, alias))
      ))
      .map((item) => `${item.foodName} ${item.nutritionProfile?.description ?? ''}`);
    return `${ingredient.foodName} ${ingredient.aliases.join(' ')} ${inventoryNames.join(' ')}`;
  }).join(' ');
  const ingredientText = normalize(recipeIngredients);
  const allergyText = normalize(profile.foodAllergies);
  const recognizedAllergens = Object.entries(knownAllergens)
    .filter(([term]) => hasWord(allergyText, term))
    .flatMap(([, aliases]) => aliases);
  const knownAllergyWords = Object.keys(knownAllergens).flatMap((term) => term.split(' '));
  const customAllergens = allergyText.split(' ').filter((term) => (
    term.length > 2
    && !['allergy', 'allergies', 'allergic', 'food', 'foods', 'to', 'and'].includes(term)
    && !knownAllergyWords.includes(term)
  ));
  for (const allergen of [...recognizedAllergens, ...customAllergens]) {
    if (hasWord(ingredientText, allergen)) return true;
  }

  const preferences = normalize(profile.dietaryPreferences);
  const contains = (...terms: string[]) => terms.some((term) => hasWord(preferences, term));
  const aliases = recipe.ingredients.flatMap((ingredient) => ingredient.aliases);
  const hasAnimalIngredient = aliases.some((alias) => (
    ['egg', 'milk', 'yogurt', 'yoghurt', 'cheese', 'chicken', 'fish', 'salmon', 'tuna', 'cod', 'tilapia'].includes(alias)
  ));
  const hasMeat = aliases.includes('chicken');
  const hasFish = aliases.some((alias) => ['fish', 'salmon', 'tuna', 'cod', 'tilapia'].includes(alias));
  const hasDairy = aliases.some((alias) => ['milk', 'yogurt', 'yoghurt', 'cheese'].includes(alias));
  const hasEgg = aliases.includes('egg');
  const hasGlutenSource = aliases.some((alias) => ['wheat', 'bread', 'whole grain bread', 'whole-grain bread', 'wholemeal bread'].includes(alias));
  if (contains('vegan') && hasAnimalIngredient) return true;
  if ((contains('vegetarian') || contains('meat free') || contains('no meat')) && (hasMeat || hasFish)) return true;
  if (contains('pescatarian') && hasMeat) return true;
  if ((contains('dairy free') || contains('lactose free')) && hasDairy) return true;
  if (contains('gluten free') && hasGlutenSource) return true;
  if (contains('egg free') && hasEgg) return true;
  return false;
}

function makeMeal(
  recipe: MealRecipe,
  day: RecommendationDay,
  inventory: FoodItem[],
  favorites: ReadonlySet<string>,
): MealRecommendation {
  const ingredients = ingredientsFor(recipe, inventory);
  const missingIngredients = ingredients
    .filter((ingredient) => ingredient.availability !== 'available')
    .map((ingredient) => {
      if (ingredient.verificationIssue === 'weight-unit') {
        return `${ingredient.foodName} (${ingredient.amountGrams} g needed; set inventory quantity in g or kg)`;
      }
      if (ingredient.verificationIssue === 'weight-state') {
        if (ingredient.amountPieces !== undefined && ingredient.availableUnit === 'pcs') {
          return `${ingredient.foodName} (${ingredient.amountPieces} pcs needed; mark inventory state as ${ingredient.weightState})`;
        }
        return `${ingredient.foodName} (${ingredient.amountGrams} g needed; mark inventory state as ${ingredient.weightState})`;
      }
      if (ingredient.preparedFrom && ingredient.inventoryWeightState === ingredient.preparedFrom.weightState
        && ingredient.availableUnit === 'g') {
        return `${ingredient.foodName} (${ingredient.amountToLog} g ${ingredient.inventoryWeightState} needed; have ${ingredient.availableQuantity ?? 0} g)`;
      }
      if (ingredient.amountPacks !== undefined && ingredient.availableUnit) {
        return `${ingredient.foodName} (need ${ingredient.amountPacks} ${ingredient.availableUnit}; have ${ingredient.availableQuantity ?? 0} ${ingredient.availableUnit})`;
      }
      if (ingredient.amountPieces !== undefined && ingredient.availableUnit === 'pcs') {
        return `${ingredient.foodName} (need ${ingredient.amountPieces} pcs; have ${ingredient.availableQuantity ?? 0} pcs)`;
      }
      if (ingredient.availableGrams !== null && ingredient.availableGrams > 0) {
        return `${ingredient.foodName} (need ${ingredient.amountGrams} g; have ${ingredient.availableGrams} g)`;
      }
      return ingredient.foodName;
    });

  const nutrition = calculateMealNutrition(ingredients);

  return {
    id: `${day.toLocaleLowerCase()}-${recipe.id}`,
    recipeId: recipe.id,
    recipeName: recipe.name,
    day,
    category: recipe.category,
    instructions: recipe.instructions,
    ingredients,
    missingIngredients,
    nutrition,
    savedAsFavorite: favorites.has(recipe.id),
  };
}

export function calculateMealNutrition(ingredients: RecommendedIngredient[]): MealNutritionEstimate {
  const values: Partial<Record<MealNutrientId, NutritionValue>> = {};
  for (const nutrient of mealNutrients) {
    const contributions = ingredients.map((ingredient) => ingredient.nutrients[nutrient.id]);
    const available = contributions.filter((value): value is NutritionValue => (
      value !== undefined && Number.isFinite(value.amount) && Boolean(value.unit)
    ));
    const unit = available[0]?.unit;
    if (unit && available.every((value) => value.unit === unit)) {
      values[nutrient.id] = {
        amount: Number(available.reduce((sum, value) => sum + value.amount, 0).toFixed(2)),
        unit,
        name: available[0]?.name ?? nutrient.label,
      };
    }
  }

  const complete = mealNutrients.every(({ id }) => (
    ingredients.length > 0
    && ingredients.every((ingredient) => {
      const value = ingredient.nutrients[id];
      return value !== undefined
        && Number.isFinite(value.amount)
        && Boolean(value.unit)
        && value.unit === values[id]?.unit;
    })
  ));
  return { values, complete };
}

export function refreshMealRecommendation(
  meal: MealRecommendation,
  inventory: FoodItem[],
  favorites: ReadonlySet<string> = new Set(),
): MealRecommendation {
  const recipe = recipeCatalog.find((entry) => entry.id === meal.recipeId);
  if (!recipe) {
    return {
      ...meal,
      nutrition: calculateMealNutrition(meal.ingredients),
      savedAsFavorite: favorites.has(meal.recipeId),
    };
  }

  return {
    ...makeMeal(recipe, meal.day, inventory, favorites),
    id: meal.id,
  };
}

function recipeScore(
  meal: MealRecommendation,
  recentFoodNames: Set<string>,
  usedRecipes: Set<string>,
  usedIngredients: Map<string, number>,
): number {
  const repetition = meal.ingredients.reduce((score, ingredient) => (
    score + (recentFoodNames.has(normalize(ingredient.foodName)) ? 5 : 0)
      + ((usedIngredients.get(normalize(ingredient.foodName)) ?? 0) * 4)
  ), 0);
  return -repetition - (usedRecipes.has(meal.recipeId) ? 80 : 0) + (meal.savedAsFavorite ? 2 : 0);
}

function findBestMeal(
  day: RecommendationDay,
  category: RecommendedMealCategory,
  inventory: FoodItem[],
  profile: HealthProfile | null,
  favorites: ReadonlySet<string>,
  recentFoodNames: Set<string>,
  usedRecipes: Set<string>,
  usedIngredients: Map<string, number>,
  excludedRecipeIds: Set<string>,
): MealRecommendation | null {
  const candidates = recipeCatalog
    .filter((recipe) => recipe.category === category)
    .filter((recipe) => !excludedRecipeIds.has(recipe.id))
    .filter((recipe) => !isExcludedByProfile(recipe, profile, inventory))
    .map((recipe) => makeMeal(recipe, day, inventory, favorites))
    .sort((a, b) => recipeScore(b, recentFoodNames, usedRecipes, usedIngredients)
      - recipeScore(a, recentFoodNames, usedRecipes, usedIngredients));
  return candidates[0] ?? null;
}

export function getMondayDate(date = new Date()): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

export function generateWeeklyMealPlan(options: {
  inventory: FoodItem[];
  profile: HealthProfile | null;
  consumption: FoodConsumption[];
  favorites?: ReadonlySet<string>;
  weekStartDate?: string;
  excludeRecipes?: Set<string>;
}): Omit<WeeklyMealPlan, 'id' | 'createdAt' | 'updatedAt'> {
  const { inventory, profile, consumption } = options;
  const favorites = options.favorites ?? new Set<string>();
  const weekStartDate = options.weekStartDate ?? getMondayDate();
  const recentFoodNames = new Set(consumption.slice(0, 40).map((record) => normalize(record.foodName)));
  const usedRecipes = new Set<string>();
  const usedIngredients = new Map<string, number>();
  const meals: MealRecommendation[] = [];

  for (const day of recommendationDays) {
    for (const category of ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const) {
      if (category === 'Snacks' && day !== 'Monday' && day !== 'Wednesday' && day !== 'Friday' && day !== 'Sunday') continue;
      const meal = findBestMeal(
        day,
        category,
        inventory,
        profile,
        favorites,
        recentFoodNames,
        usedRecipes,
        usedIngredients,
        options.excludeRecipes ?? new Set(),
      );
      if (!meal) continue;
      meals.push(meal);
      usedRecipes.add(meal.recipeId);
      for (const ingredient of meal.ingredients) {
        const key = normalize(ingredient.foodName);
        usedIngredients.set(key, (usedIngredients.get(key) ?? 0) + 1);
      }
    }
  }
  return { weekStartDate, meals };
}

export function replaceRecommendedMeal(
  plan: WeeklyMealPlan,
  mealId: string,
  recipeId: string,
  inventory: FoodItem[],
  profile: HealthProfile | null,
  favorites: ReadonlySet<string> = new Set(),
): WeeklyMealPlan {
  const selected = plan.meals.find((meal) => meal.id === mealId);
  const recipe = recipeCatalog.find((entry) => entry.id === recipeId);
  if (!selected || !recipe || recipe.category !== selected.category || isExcludedByProfile(recipe, profile, inventory)) {
    throw new Error('That alternative is not valid for this meal or conflicts with the saved dietary restrictions.');
  }

  const replacement = makeMeal(recipe, selected.day, inventory, favorites);
  return {
    ...plan,
    meals: plan.meals.map((meal) => meal.id === mealId
      ? { ...replacement, id: selected.id }
      : meal),
    updatedAt: new Date().toISOString(),
  };
}

export function availableAlternatives(
  meal: MealRecommendation,
  inventory: FoodItem[],
  profile: HealthProfile | null,
  favorites: ReadonlySet<string> = new Set(),
): MealRecommendation[] {
  return recipeCatalog
    .filter((recipe) => recipe.category === meal.category && recipe.id !== meal.recipeId)
    .filter((recipe) => !isExcludedByProfile(recipe, profile, inventory))
    .map((recipe) => makeMeal(recipe, meal.day, inventory, favorites));
}

export function isMealNutrientId(value: string): value is MealNutrientId {
  return mealNutrients.some((nutrient) => nutrient.id === value);
}
