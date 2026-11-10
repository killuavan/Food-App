import type { FoodConsumption } from './foodConsumption';
import type { FoodItem } from './foodInventory';
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
export type NutritionWeightState = 'raw' | 'cooked' | 'dry' | 'as-sold';
export type MealNutrientId = '208' | '203' | '205' | '204' | '291' | '301' | '303' | '306' | '307' | '320' | '401' | '324';

export interface RecipeIngredient {
  foodName: string;
  aliases: string[];
  amountGrams: number;
  weightState?: NutritionWeightState;
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
  availability: 'available' | 'unavailable' | 'unverified';
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
  createdAt: string;
  updatedAt: string;
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
    id: 'oatmeal-banana',
    name: 'Oatmeal with banana',
    category: 'Breakfast',
    instructions: 'Cook the oats according to the package directions. Slice the banana and serve it over the oats.',
    ingredients: [
      { foodName: 'Oats', aliases: ['oat', 'rolled oats', 'oatmeal'], amountGrams: 50, weightState: 'dry' },
      { foodName: 'Banana', aliases: ['banana'], amountGrams: 80, weightState: 'raw' },
    ],
  },
  {
    id: 'egg-wholegrain-toast',
    name: 'Eggs with whole-grain toast',
    category: 'Breakfast',
    instructions: 'Cook the egg thoroughly. Serve with toasted whole-grain bread.',
    ingredients: [
      { foodName: 'Egg', aliases: ['egg'], amountGrams: 50, weightState: 'raw' },
      { foodName: 'Whole-grain bread', aliases: ['whole grain bread', 'whole-grain bread', 'wholemeal bread'], amountGrams: 40 },
    ],
  },
  {
    id: 'yogurt-fruit-bowl',
    name: 'Yogurt with fruit',
    category: 'Breakfast',
    instructions: 'Serve the yogurt with washed, prepared fruit.',
    ingredients: [
      { foodName: 'Yogurt', aliases: ['yogurt', 'yoghurt'], amountGrams: 150 },
      { foodName: 'Apple', aliases: ['apple'], amountGrams: 80, weightState: 'raw' },
    ],
  },
  {
    id: 'rice-egg-vegetables',
    name: 'Rice with egg and vegetables',
    category: 'Breakfast',
    instructions: 'Cook the rice and vegetables fully. Cook the egg thoroughly and serve together.',
    ingredients: [
      { foodName: 'Rice', aliases: ['rice'], amountGrams: 150, weightState: 'cooked' },
      { foodName: 'Egg', aliases: ['egg'], amountGrams: 50, weightState: 'raw' },
      { foodName: 'Vegetables', aliases: ['vegetable'], amountGrams: 100, weightState: 'raw' },
    ],
  },
  {
    id: 'chicken-rice-vegetables',
    name: 'Chicken with rice and vegetables',
    category: 'Lunch',
    instructions: 'Cook chicken thoroughly and cook the rice and vegetables. Serve together.',
    ingredients: [
      { foodName: 'Chicken', aliases: ['chicken'], amountGrams: 120, weightState: 'raw' },
      { foodName: 'Rice', aliases: ['rice'], amountGrams: 150, weightState: 'cooked' },
      { foodName: 'Vegetables', aliases: ['vegetable'], amountGrams: 100, weightState: 'raw' },
    ],
  },
  {
    id: 'fish-rice',
    name: 'Fish with rice',
    category: 'Lunch',
    instructions: 'Cook fish thoroughly and serve with cooked rice.',
    ingredients: [
      { foodName: 'Fish', aliases: ['fish', 'salmon', 'tuna', 'cod', 'tilapia'], amountGrams: 120, weightState: 'raw' },
      { foodName: 'Rice', aliases: ['rice'], amountGrams: 150, weightState: 'cooked' },
    ],
  },
  {
    id: 'tofu-vegetables',
    name: 'Tofu with vegetables',
    category: 'Lunch',
    instructions: 'Cook tofu and vegetables until heated through and serve together.',
    ingredients: [
      { foodName: 'Tofu', aliases: ['tofu'], amountGrams: 120 },
      { foodName: 'Vegetables', aliases: ['vegetable'], amountGrams: 150, weightState: 'raw' },
    ],
  },
  {
    id: 'beans-vegetables',
    name: 'Vegetable and bean bowl',
    category: 'Lunch',
    instructions: 'Heat the beans thoroughly and serve with cooked vegetables.',
    ingredients: [
      { foodName: 'Beans', aliases: ['bean', 'beans', 'lentil', 'lentils', 'chickpea', 'chickpeas'], amountGrams: 120, weightState: 'cooked' },
      { foodName: 'Vegetables', aliases: ['vegetable'], amountGrams: 150, weightState: 'raw' },
    ],
  },
  {
    id: 'fish-vegetables',
    name: 'Fish with vegetables',
    category: 'Dinner',
    instructions: 'Cook fish thoroughly and serve with cooked vegetables.',
    ingredients: [
      { foodName: 'Fish', aliases: ['fish', 'salmon', 'tuna', 'cod', 'tilapia'], amountGrams: 120, weightState: 'raw' },
      { foodName: 'Vegetables', aliases: ['vegetable'], amountGrams: 180, weightState: 'raw' },
    ],
  },
  {
    id: 'chicken-vegetable-soup',
    name: 'Chicken and vegetable soup',
    category: 'Dinner',
    instructions: 'Simmer chicken and vegetables in water or broth until the chicken is thoroughly cooked.',
    ingredients: [
      { foodName: 'Chicken', aliases: ['chicken'], amountGrams: 120, weightState: 'raw' },
      { foodName: 'Vegetables', aliases: ['vegetable'], amountGrams: 180, weightState: 'raw' },
    ],
  },
  {
    id: 'tofu-rice',
    name: 'Tofu with rice',
    category: 'Dinner',
    instructions: 'Cook the rice and heat the tofu thoroughly. Serve together.',
    ingredients: [
      { foodName: 'Tofu', aliases: ['tofu'], amountGrams: 120 },
      { foodName: 'Rice', aliases: ['rice'], amountGrams: 150, weightState: 'cooked' },
    ],
  },
  {
    id: 'vegetable-rice',
    name: 'Vegetable rice bowl',
    category: 'Dinner',
    instructions: 'Cook the rice and vegetables fully and serve together.',
    ingredients: [
      { foodName: 'Rice', aliases: ['rice'], amountGrams: 150, weightState: 'cooked' },
      { foodName: 'Vegetables', aliases: ['vegetable'], amountGrams: 180, weightState: 'raw' },
    ],
  },
  {
    id: 'banana-snack',
    name: 'Banana',
    category: 'Snacks',
    instructions: 'Wash, peel, and serve the banana.',
    ingredients: [{ foodName: 'Banana', aliases: ['banana'], amountGrams: 80, weightState: 'raw' }],
  },
  {
    id: 'apple-snack',
    name: 'Apple',
    category: 'Snacks',
    instructions: 'Wash and serve the apple.',
    ingredients: [{ foodName: 'Apple', aliases: ['apple'], amountGrams: 150, weightState: 'raw' }],
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

function stateMatches(text: string, expected: NutritionWeightState | undefined): boolean {
  if (!expected || expected === 'as-sold') return true;
  const normalized = normalize(text);
  const isCooked = ['cooked', 'boiled', 'steamed', 'baked', 'roasted', 'grilled', 'fried']
    .some((word) => hasWord(normalized, word));
  if (expected === 'cooked') return isCooked;
  if (isCooked) return false;
  if (expected === 'dry') return hasWord(normalized, 'dry') || hasWord(normalized, 'dried');
  return hasWord(normalized, 'raw') || hasWord(normalized, 'fresh');
}

function ingredientsFor(recipe: MealRecipe, inventory: FoodItem[]): RecommendedIngredient[] {
  return recipe.ingredients.map((ingredient) => {
    const matches = inventory.filter((item) => item.quantity > 0 && ingredient.aliases.some((alias) => (
      hasWord(item.foodName, alias)
      || (alias === 'vegetable' && item.category === 'Vegetables')
    )));
    const stateMatchesInventory = matches.filter((item) => stateMatches(
      `${item.foodName} ${item.nutritionProfile?.description ?? ''}`,
      ingredient.weightState,
    ));
    const massMatches = stateMatchesInventory.filter((item) => item.unit === 'g' || item.unit === 'kg');
    const availableGrams = massMatches.reduce((sum, item) => (
      sum + item.quantity * (item.unit === 'kg' ? 1000 : 1)
    ), 0);
    const nutritionItem = matches.find((item) => item.nutritionProfile
      && stateMatches(item.nutritionProfile.description, ingredient.weightState)) ?? null;
    const hasMassMatch = massMatches.length > 0;
    const availability: RecommendedIngredient['availability'] = !matches.length
      ? 'unavailable'
      : !hasMassMatch
        ? 'unverified'
        : availableGrams < ingredient.amountGrams
          ? 'unavailable'
          : stateMatchesInventory.length === 0
            ? 'unverified'
            : 'available';
    const scaled = nutritionItem?.nutritionProfile
      ? scaleNutritionForGrams(nutritionItem.nutritionProfile, ingredient.amountGrams)
      : null;
    return {
      ...ingredient,
      inventoryItemId: nutritionItem?.id ?? matches[0]?.id ?? null,
      inventoryFoodName: nutritionItem?.foodName ?? matches[0]?.foodName ?? null,
      availability,
      availableGrams: hasMassMatch ? Number(availableGrams.toFixed(2)) : null,
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
      .filter((item) => ingredient.aliases.some((alias) => (
        hasWord(item.foodName, alias) || (alias === 'vegetable' && item.category === 'Vegetables')
      )))
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
      if (ingredient.availability === 'unverified') {
        const state = ingredient.weightState && ingredient.weightState !== 'as-sold'
          ? `; expected ${ingredient.weightState} weight`
          : '';
        return `${ingredient.foodName} (${ingredient.amountGrams} g needed; inventory unit or weight state cannot be verified${state})`;
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
  const availableCount = meal.ingredients.filter((ingredient) => ingredient.availability === 'available').length;
  const verifiedCount = meal.ingredients.filter((ingredient) => ingredient.availability !== 'unverified').length;
  const coverage = verifiedCount ? availableCount / verifiedCount : 0;
  const repetition = meal.ingredients.reduce((score, ingredient) => (
    score + (recentFoodNames.has(normalize(ingredient.foodName)) ? 5 : 0)
      + ((usedIngredients.get(normalize(ingredient.foodName)) ?? 0) * 4)
  ), 0);
  return (coverage * 100) - repetition - (usedRecipes.has(meal.recipeId) ? 80 : 0) + (meal.savedAsFavorite ? 2 : 0);
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
    .filter((meal) => meal.ingredients.some((ingredient) => ingredient.availability === 'available' || ingredient.availability === 'unverified'))
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
  if (!replacement.ingredients.some((ingredient) => ingredient.availability === 'available' || ingredient.availability === 'unverified')) {
    throw new Error('That alternative has no ingredients currently identified in your inventory.');
  }
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
    .map((recipe) => makeMeal(recipe, meal.day, inventory, favorites))
    .filter((candidate) => candidate.ingredients.some((ingredient) => (
      ingredient.availability === 'available' || ingredient.availability === 'unverified'
    )));
}

export function isMealNutrientId(value: string): value is MealNutrientId {
  return mealNutrients.some((nutrient) => nutrient.id === value);
}
