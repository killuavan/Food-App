import { describe, expect, test } from 'vitest';
import type { FoodConsumption } from '../../src/utils/foodConsumption';
import type { FoodItem } from '../../src/utils/foodInventory';
import type { HealthProfile } from '../../src/utils/healthProfile';
import type { NutritionProfile } from '../../src/utils/usdaNutrition';
import {
  availableAlternatives,
  generateWeeklyMealPlan,
  getInventoryFingerprint,
  getMondayDate,
  isMealFullyAvailable,
  mealNutrients,
  recommendationDays,
  recipeCatalog,
  refreshMealRecommendation,
  replaceRecommendedMeal,
} from '../../src/utils/weeklyMealRecommendations';

function nutritionProfile(fdcId = 123, description = 'Bananas, raw'): NutritionProfile {
  const amounts: Record<string, number> = {
    '208': 89,
    '203': 1.1,
    '205': 22.8,
    '204': 0.3,
    '291': 2.6,
    '320': 3,
    '401': 8.7,
    '301': 5,
    '303': 0.26,
    '306': 358,
    '307': 1,
    '324': 0,
  };
  const units: Record<string, string> = {
    '208': 'kcal',
    '203': 'g',
    '205': 'g',
    '204': 'g',
    '291': 'g',
    '320': 'µg',
    '401': 'mg',
    '301': 'mg',
    '303': 'mg',
    '306': 'mg',
    '307': 'mg',
    '324': 'µg',
  };
  return {
    fdcId,
    description,
    dataType: 'Foundation',
    foodCategory: 'Fruit',
    brandOwner: '',
    householdServing: '',
    servingSize: null,
    servingSizeUnit: '',
    basisGrams: 100,
    basisDescription: 'per 100 g',
    nutrients: Object.fromEntries(Object.entries(amounts).map(([id, amount]) => [
      id,
      { amount, unit: units[id], name: mealNutrients.find((entry) => entry.id === id)?.label ?? id },
    ])),
    portions: [],
    source: 'USDA FoodData Central',
  };
}

function food(name: string, quantity = 10000, options: {
  category?: FoodItem['category'];
  unit?: FoodItem['unit'];
  weightState?: FoodItem['weightState'];
  pieceWeightGrams?: number | null;
  nutrition?: boolean;
  profileDescription?: string;
  notes?: string;
} = {}): FoodItem {
  return {
    id: name.toLocaleLowerCase().replaceAll(' ', '-'),
    foodName: name,
    category: options.category ?? 'Others',
    quantity,
    unit: options.unit ?? 'g',
    weightState: options.weightState ?? null,
    pieceWeightGrams: options.pieceWeightGrams ?? null,
    lowStockThreshold: 0,
    purchaseDate: '',
    expirationDate: '',
    storageLocation: '',
    notes: options.notes ?? '',
    nutritionProfile: options.nutrition ? nutritionProfile(123, options.profileDescription) : null,
    createdAt: '',
    updatedAt: '',
  };
}

function fullInventory(): FoodItem[] {
  return [
    food('Dry rolled oats'),
    food('Banana', 1000, { nutrition: true, category: 'Fruits' }),
    food('Raw egg'),
    food('Whole grain bread'),
    food('Yogurt'),
    food('Apple', 1000, { category: 'Fruits' }),
    food('Cooked rice', 10000, { category: 'Grains' }),
    food('Raw chicken'),
    food('Raw vegetables', 10000, { category: 'Vegetables' }),
    food('Raw fish', 1000, { category: 'Seafood' }),
    food('Tofu'),
    food('Cooked beans'),
  ];
}

function profile(overrides: Partial<HealthProfile> = {}): HealthProfile {
  return {
    id: 'current',
    dateOfBirth: '',
    age: null,
    heightCm: null,
    weightKg: null,
    activityLevel: '',
    dietaryPreferences: '',
    foodAllergies: '',
    fitnessGoal: '',
    bmiValue: null,
    bmiCalculatedAt: '',
    profileCompleted: false,
    onboardingCompleted: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const noConsumption: FoodConsumption[] = [];

function excludeAllBut(recipeId: string): Set<string> {
  return new Set(recipeCatalog.filter((recipe) => recipe.id !== recipeId).map((recipe) => recipe.id));
}

describe('weekly meal recommendation rules', () => {
  test('changes the inventory fingerprint when pantry stock or foods change', () => {
    const apple = food('Apple', 1000, { category: 'Fruits' });
    const sameInventory = food('Apple', 1000, { category: 'Fruits' });
    const updatedApple = food('Apple', 900, { category: 'Fruits' });
    const updatedPackage = food('Greek Yogurt', 10, { unit: 'pcs', notes: 'Package: 32 OZ' });
    const cabbage = food('Cabbage', 1, { unit: 'pcs', category: 'Vegetables', pieceWeightGrams: 250 });
    const egg = food('Egg', 9, { unit: 'pcs' });

    expect(getInventoryFingerprint([apple])).toBe(getInventoryFingerprint([sameInventory]));
    expect(getInventoryFingerprint([apple])).not.toBe(getInventoryFingerprint([updatedApple]));
    expect(getInventoryFingerprint([food('Greek Yogurt', 10, { unit: 'pcs' })]))
      .not.toBe(getInventoryFingerprint([updatedPackage]));
    expect(getInventoryFingerprint([food('Cabbage', 1, { unit: 'pcs', category: 'Vegetables' })]))
      .not.toBe(getInventoryFingerprint([cabbage]));
    expect(getInventoryFingerprint([apple])).not.toBe(getInventoryFingerprint([apple, egg]));
    expect(getInventoryFingerprint([apple], profile({ foodAllergies: 'egg' })))
      .not.toBe(getInventoryFingerprint([apple], profile()));
  });

  test('converts yogurt recipe grams to a fraction of a package using its labeled net weight', () => {
    const yogurt = food('Greek Yogurt Nonfat Plain', 10, {
      unit: 'pcs',
      nutrition: true,
      profileDescription: 'Greek yogurt, plain',
      notes: 'Package: 32 OZ\nServing size: 1 serving (170 g)',
    });
    const plan = generateWeeklyMealPlan({
      inventory: [yogurt, food('Apple', 1000, { category: 'Fruits' })],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('yogurt-fruit-bowl'),
    });
    const yogurtIngredient = plan.meals[0]?.ingredients.find((ingredient) => ingredient.foodName === 'Yogurt');

    expect(yogurtIngredient).toMatchObject({
      inventoryFoodName: 'Greek Yogurt Nonfat Plain',
      amountGrams: 150,
      amountToLog: 0.165347,
      unitToLog: 'pcs',
      inventoryPackageWeightGrams: 907.18474,
      availableGrams: 9071.85,
      availability: 'available',
      nutrients: expect.objectContaining({ '208': expect.objectContaining({ amount: 133.5 }) }),
    });
  });

  test('marks yogurt unavailable when the package mass is below the recipe amount', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('Greek Yogurt Nonfat Plain', 0.1, {
          unit: 'pcs',
          notes: 'Package: 32 OZ\nServing size: 1 serving (170 g)',
        }),
        food('Apple', 1000, { category: 'Fruits' }),
      ],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('yogurt-fruit-bowl'),
    });

    expect(plan.meals[0]?.ingredients.find((ingredient) => ingredient.foodName === 'Yogurt'))
      .toMatchObject({ availability: 'unavailable', amountToLog: 0.165347, unitToLog: 'pcs' });
  });

  test('generates all seven days with breakfast, lunch, and dinner slots', () => {
    const plan = generateWeeklyMealPlan({
      inventory: fullInventory(),
      profile: null,
      consumption: noConsumption,
      weekStartDate: '2026-11-02',
    });

    expect(plan.weekStartDate).toBe('2026-11-02');
    expect(new Set(plan.meals.map((meal) => meal.day))).toEqual(new Set(recommendationDays));
    for (const day of recommendationDays) {
      expect(plan.meals.some((meal) => meal.day === day && meal.category === 'Breakfast')).toBe(true);
      expect(plan.meals.some((meal) => meal.day === day && meal.category === 'Lunch')).toBe(true);
      expect(plan.meals.some((meal) => meal.day === day && meal.category === 'Dinner')).toBe(true);
    }
  });

  test('generates the same full meal plan regardless of inventory and marks absent ingredients', () => {
    const inventory = [
      food('Apple', 1000, { unit: 'g', weightState: 'raw', nutrition: true, category: 'Fruits' }),
      food('Egg', 9, { unit: 'pcs', nutrition: true, profileDescription: 'Egg, whole, raw' }),
    ];
    const plan = generateWeeklyMealPlan({
      inventory,
      profile: null,
      consumption: noConsumption,
    });
    const emptyInventoryPlan = generateWeeklyMealPlan({
      inventory: [],
      profile: null,
      consumption: noConsumption,
    });

    expect(plan.meals.map((meal) => meal.recipeId)).toEqual(emptyInventoryPlan.meals.map((meal) => meal.recipeId));
    expect(plan.meals).toHaveLength(25);
    expect(plan.meals.some((meal) => meal.ingredients.some((ingredient) => ingredient.foodName === 'Chicken'))).toBe(true);
    expect(plan.meals.some((meal) => meal.recipeId === 'apple-snack')).toBe(true);
    expect(plan.meals.some((meal) => meal.recipeId === 'egg-snack')).toBe(true);
    expect(plan.meals.find((meal) => meal.recipeId === 'egg-snack')?.ingredients[0])
      .toMatchObject({ amountToLog: 1, unitToLog: 'pcs', availability: 'available' });
    const chickenMeal = plan.meals.find((meal) => meal.ingredients.some((ingredient) => ingredient.foodName === 'Chicken'));
    expect(chickenMeal).toBeDefined();
    expect(isMealFullyAvailable(chickenMeal!)).toBe(false);
    expect(chickenMeal?.missingIngredients).toContain('Chicken');
  });

  test('uses Filipino inventory names and suggests tuna with dry bigas and egg for breakfast', () => {
    const inventory = [
      food('Century Tuna', 420, { unit: 'g', weightState: 'as-sold', category: 'Canned Goods' }),
      food('Bigas', 25, { unit: 'kg', category: 'Grains' }),
      food('Egg', 10, { unit: 'pcs', weightState: 'raw' }),
    ];
    const plan = generateWeeklyMealPlan({
      inventory,
      profile: null,
      consumption: noConsumption,
    });

    expect(plan.meals.find((meal) => meal.recipeId === 'tuna-bigas-bowl')?.ingredients)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          foodName: 'Tuna',
          inventoryFoodName: 'Century Tuna',
          availability: 'available',
        }),
        expect.objectContaining({
          foodName: 'Rice',
          inventoryFoodName: 'Bigas',
          availability: 'available',
          amountToLog: 50,
          unitToLog: 'g',
        }),
      ]));
    expect(plan.meals.some((meal) => (
      meal.category === 'Breakfast'
      && meal.ingredients.some((ingredient) => ingredient.inventoryFoodName === 'Egg')
    ))).toBe(true);
  });

  test('suggests a tuna omelette for dinner when tuna is stocked by weight and eggs by piece', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('Tuna flakes in oil', 420, {
          unit: 'g',
          weightState: 'as-sold',
          category: 'Others',
        }),
        food('Egg', 10, { unit: 'pcs', weightState: 'raw' }),
      ],
      profile: null,
      consumption: noConsumption,
    });

    expect(plan.meals.find((meal) => meal.recipeId === 'tuna-egg-omelette')?.ingredients)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          foodName: 'Tuna',
          inventoryFoodName: 'Tuna flakes in oil',
          availability: 'available',
          amountToLog: 120,
          unitToLog: 'g',
        }),
        expect.objectContaining({
          foodName: 'Egg',
          inventoryFoodName: 'Egg',
          availability: 'available',
          amountToLog: 1,
          unitToLog: 'pcs',
        }),
      ]));
  });

  test('suggests tuna and egg for lunch without requiring rice or bread', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('chicken', 5, { unit: 'kg', category: 'Meat' }),
        food('egg', 10, { unit: 'pcs', weightState: 'raw' }),
        food('Rice', 25, { unit: 'kg', category: 'Grains' }),
        food('Tuna flakes in oil', 420, { unit: 'g', category: 'Others' }),
      ],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('tuna-egg-lunch'),
    });

    const lunch = plan.meals.find((meal) => meal.category === 'Lunch');
    expect(lunch?.recipeId).toBe('tuna-egg-lunch');
    expect(lunch?.ingredients.every((ingredient) => ingredient.availability === 'available')).toBe(true);
  });

  test('suggests a complete breakfast from piece-counted eggs and bananas', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('Egg', 9, {
          unit: 'pcs',
          weightState: 'raw',
          nutrition: true,
          profileDescription: 'Egg, whole, raw',
        }),
        food('Banana', 10, {
          unit: 'pcs',
          weightState: 'raw',
          nutrition: true,
          category: 'Fruits',
          profileDescription: 'Bananas, raw',
        }),
      ],
      profile: null,
      consumption: noConsumption,
    });

    const ingredients = plan.meals.find((meal) => meal.recipeId === 'egg-banana-breakfast')?.ingredients;
    expect(ingredients).toEqual(expect.arrayContaining([
      expect.objectContaining({
        foodName: 'Egg',
        amountToLog: 1,
        unitToLog: 'pcs',
        nutritionAmountGrams: 50,
        nutrients: expect.objectContaining({ '208': expect.objectContaining({ amount: 44.5 }) }),
      }),
      expect.objectContaining({
        foodName: 'Banana',
        amountToLog: 1,
        unitToLog: 'pcs',
        nutritionAmountGrams: 118,
        nutrients: expect.objectContaining({ '208': expect.objectContaining({ amount: 105.02 }) }),
      }),
    ]));
  });

  test('recommends canned Century Tuna by pack with cooked rice without guessing can weight', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('Century Tuna', 2, {
          category: 'Canned Goods',
          unit: 'packs',
          weightState: 'as-sold',
          nutrition: true,
        }),
        food('Cooked rice', 1000, { category: 'Grains', weightState: 'cooked' }),
      ],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('tuna-rice-bowl'),
    });

    const tunaMeal = plan.meals.find((meal) => meal.recipeId === 'tuna-rice-bowl');
    expect(tunaMeal?.ingredients.find((ingredient) => ingredient.foodName === 'Tuna')).toMatchObject({
      inventoryFoodName: 'Century Tuna',
      amountToLog: 1,
      unitToLog: 'packs',
      availableQuantity: 2,
      availableUnit: 'packs',
      availability: 'available',
      nutrients: {},
    });
    expect(tunaMeal?.nutrition.values).toEqual({});

    expect(plan.meals.some((meal) => meal.category === 'Snacks'
      && meal.ingredients.some((ingredient) => ingredient.inventoryFoodName === 'Century Tuna'))).toBe(false);

    const insufficientPlan = generateWeeklyMealPlan({
      inventory: [
        food('Century Tuna', 0.5, { category: 'Canned Goods', unit: 'packs', weightState: 'as-sold' }),
        food('Cooked rice', 1000, { category: 'Grains', weightState: 'cooked' }),
      ],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('tuna-rice-bowl'),
    });
    const insufficientTunaMeal = insufficientPlan.meals.find((meal) => meal.recipeId === 'tuna-rice-bowl');
    expect(insufficientTunaMeal).toBeDefined();
    expect(insufficientTunaMeal?.ingredients.find((ingredient) => ingredient.foodName === 'Tuna')?.availability)
      .toBe('unavailable');
  });

  test('matches dry rice as an ingredient that will be cooked before serving', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('Rice', 50, {
          category: 'Grains',
          weightState: 'dry',
          nutrition: true,
          profileDescription: 'Rice, dry',
        }),
        food('Tofu', 500),
      ],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('tofu-rice'),
    });
    const rice = plan.meals[0]?.ingredients.find((ingredient) => ingredient.foodName === 'Rice');

    expect(rice).toMatchObject({
      amountGrams: 150,
      amountToLog: 50,
      unitToLog: 'g',
      weightState: 'cooked',
      inventoryWeightState: 'dry',
      inventoryFoodName: 'Rice',
      availability: 'available',
      nutrients: expect.objectContaining({ '208': expect.objectContaining({ amount: 44.5 }) }),
    });
    expect(plan.meals[0]?.missingIngredients.some((ingredient) => ingredient.startsWith('Rice'))).toBe(false);
  });

  test('matches unmarked fresh meat inventory as raw for recipes that cook it', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('chicken', 5, { unit: 'kg', category: 'Meat' }),
        food('Rice', 50, { category: 'Grains', weightState: 'dry' }),
        food('Vegetables', 500, { category: 'Vegetables', weightState: 'raw' }),
      ],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('chicken-rice-vegetables'),
    });
    const chicken = plan.meals[0]?.ingredients.find((ingredient) => ingredient.foodName === 'Chicken');

    expect(chicken).toMatchObject({
      inventoryFoodName: 'chicken',
      amountToLog: 120,
      unitToLog: 'g',
      inventoryWeightState: 'raw',
      availability: 'available',
    });
    expect(plan.meals[0]?.missingIngredients.some((ingredient) => ingredient.startsWith('Chicken'))).toBe(false);
  });

  test('uses linked nutrition for unmarked meat when the profile does not specify another state', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('chicken', 5, {
          unit: 'kg',
          category: 'Meat',
          nutrition: true,
          profileDescription: 'Chicken breast, meat only',
        }),
        food('Rice', 50, { category: 'Grains', weightState: 'dry' }),
      ],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('chicken-rice-vegetables'),
    });
    const meal = plan.meals[0]!;
    const chicken = meal.ingredients.find((ingredient) => ingredient.foodName === 'Chicken');

    expect(chicken?.nutrients['208']).toMatchObject({ amount: 106.8, unit: 'kcal' });
    expect(meal.nutrition.values['208']).toBeDefined();
  });

  test('uses piece-counted cabbage in cooked meal suggestions without guessing its weight', () => {
    const cabbage = food('Cabbage', 1, {
      unit: 'pcs',
      category: 'Vegetables',
    });
    const plan = generateWeeklyMealPlan({
      inventory: [
        cabbage,
        food('chicken', 5, { unit: 'kg', category: 'Meat' }),
        food('Rice', 50, { category: 'Grains', weightState: 'dry' }),
      ],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('chicken-rice-vegetables'),
    });
    const meal = plan.meals[0]!;
    const vegetables = meal.ingredients.find((ingredient) => ingredient.foodName === 'Vegetables');

    expect(vegetables).toMatchObject({
      inventoryFoodName: 'Cabbage',
      amountToLog: 1,
      unitToLog: 'pcs',
      inventoryWeightState: 'raw',
      availability: 'available',
      nutrients: {},
    });
    expect(meal.instructions.toLocaleLowerCase()).toContain('cook the rice and vegetables');
    expect(meal.missingIngredients.some((ingredient) => ingredient.startsWith('Vegetables'))).toBe(false);
  });

  test('scales linked cabbage nutrition using the recorded weight per piece', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('Cabbage', 1, {
          unit: 'pcs',
          category: 'Vegetables',
          weightState: 'raw',
          pieceWeightGrams: 250,
          nutrition: true,
          profileDescription: 'Cabbage, raw',
        }),
        food('chicken', 5, { unit: 'kg', category: 'Meat' }),
        food('Rice', 50, { category: 'Grains', weightState: 'dry' }),
      ],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('chicken-rice-vegetables'),
    });
    const meal = plan.meals[0]!;
    const vegetables = meal.ingredients.find((ingredient) => ingredient.foodName === 'Vegetables');

    expect(vegetables).toMatchObject({
      amountToLog: 1,
      unitToLog: 'pcs',
      inventoryPieceWeightGrams: 250,
      nutrients: expect.objectContaining({ '208': expect.objectContaining({ amount: 222.5 }) }),
    });
    expect(meal.nutrition.values['208']).toBeDefined();
  });

  test('reports insufficient cabbage pieces for a cooked meal', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('Cabbage', 0.5, { unit: 'pcs', category: 'Vegetables' }),
        food('chicken', 5, { unit: 'kg', category: 'Meat' }),
        food('Rice', 50, { category: 'Grains', weightState: 'dry' }),
      ],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('chicken-rice-vegetables'),
    });

    expect(plan.meals[0]?.ingredients.find((ingredient) => ingredient.foodName === 'Vegetables')?.availability)
      .toBe('unavailable');
    expect(plan.meals[0]?.missingIngredients).toContain('Vegetables (need 1 pcs; have 0.5 pcs)');
  });

  test('does not use garlic as the vegetable ingredient in a meal suggestion', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('Garlic', 3, { unit: 'pcs', category: 'Vegetables' }),
        food('chicken', 5, { unit: 'kg', category: 'Meat' }),
        food('Rice', 50, { category: 'Grains', weightState: 'dry' }),
      ],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('chicken-rice-vegetables'),
    });

    expect(plan.meals[0]?.ingredients.find((ingredient) => ingredient.foodName === 'Vegetables'))
      .toMatchObject({ inventoryItemId: null, inventoryFoodName: null, availability: 'unavailable' });
  });

  test('does not match inventory explicitly marked cooked chicken to a raw chicken recipe', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('chicken', 5, { unit: 'kg', category: 'Meat', weightState: 'cooked' }),
        food('Rice', 50, { category: 'Grains', weightState: 'dry' }),
        food('Vegetables', 500, { category: 'Vegetables', weightState: 'raw' }),
      ],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('chicken-rice-vegetables'),
    });
    const chicken = plan.meals[0]?.ingredients.find((ingredient) => ingredient.foodName === 'Chicken');

    expect(chicken?.availability).toBe('unverified');
    expect(plan.meals[0]?.missingIngredients.some((ingredient) => ingredient.startsWith('Chicken'))).toBe(true);
  });

  test('matches generic rice as dry stock to cook, while keeping cooked rice portions unchanged', () => {
    const rawRicePlan = generateWeeklyMealPlan({
      inventory: [food('Rice', 50, { category: 'Grains' }), food('Tofu', 500)],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('tofu-rice'),
    });
    expect(rawRicePlan.meals[0]?.ingredients.find((ingredient) => ingredient.foodName === 'Rice'))
      .toMatchObject({ amountToLog: 50, inventoryWeightState: 'dry', availability: 'available' });

    const cookedRicePlan = generateWeeklyMealPlan({
      inventory: [
        food('Cooked rice', 150, { category: 'Grains', weightState: 'cooked' }),
        food('Tofu', 500),
      ],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('tofu-rice'),
    });
    expect(cookedRicePlan.meals[0]?.ingredients.find((ingredient) => ingredient.foodName === 'Rice'))
      .toMatchObject({ amountToLog: 150, inventoryWeightState: 'cooked', availability: 'available' });
  });

  test('uses canned Century Tuna as one can and does not treat it as raw fish', () => {
    const cannedTuna = food('Century Tuna', 3, {
      category: 'Canned Goods',
      unit: 'pcs',
      weightState: 'as-sold',
    });
    const egg = food('Egg', 6, { unit: 'pcs', weightState: 'raw' });

    const tunaAndEggPlan = generateWeeklyMealPlan({
      inventory: [cannedTuna, egg],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('tuna-egg-lunch'),
    });
    const tunaIngredient = tunaAndEggPlan.meals[0]?.ingredients.find((ingredient) => ingredient.foodName === 'Tuna');
    expect(tunaIngredient).toMatchObject({
      inventoryFoodName: 'Century Tuna',
      amountToLog: 1,
      unitToLog: 'pcs',
      availability: 'available',
    });

    const fishMealPlan = generateWeeklyMealPlan({
      inventory: [cannedTuna, food('Vegetables', 1000, { weightState: 'raw', category: 'Vegetables' })],
      profile: null,
      consumption: noConsumption,
      excludeRecipes: excludeAllBut('fish-vegetables'),
    });
    const fishIngredient = fishMealPlan.meals[0]?.ingredients.find((ingredient) => ingredient.foodName === 'Fish');
    expect(fishIngredient?.inventoryItemId).toBeNull();
    expect(fishIngredient?.availability).toBe('unavailable');
  });

  test('filters declared egg allergies and vegetarian preferences', () => {
    const inventory = fullInventory();
    for (const foodAllergies of ['egg', 'Eggs']) {
      const allergyPlan = generateWeeklyMealPlan({
        inventory,
        profile: profile({ foodAllergies }),
        consumption: noConsumption,
      });
      expect(allergyPlan.meals.flatMap((meal) => meal.ingredients).some((entry) => entry.foodName === 'Egg')).toBe(false);
    }

    const vegetarianPlan = generateWeeklyMealPlan({
      inventory,
      profile: profile({ dietaryPreferences: 'Vegetarian' }),
      consumption: noConsumption,
    });
    expect(vegetarianPlan.meals.flatMap((meal) => meal.ingredients)
      .some((entry) => ['Chicken', 'Fish'].includes(entry.foodName))).toBe(false);
  });

  test('filters allergens named in linked USDA food descriptions and avoids state-mismatched nutrition', () => {
    const inventory = [
      food('Rolled oats'),
      food('Banana', 500, { nutrition: true, category: 'Fruits' }),
      food('Vegetables', 1000, { category: 'Vegetables', nutrition: true }),
    ];
    const allergenProfile = profile({ foodAllergies: 'Peanuts' });
    const peanutDescription = inventory.map((item) => item.foodName === 'Vegetables'
      ? { ...item, nutritionProfile: nutritionProfile(321, 'Vegetable mix with peanut sauce') }
      : item);
    const allergenPlan = generateWeeklyMealPlan({
      inventory: peanutDescription,
      profile: allergenProfile,
      consumption: noConsumption,
    });
    expect(allergenPlan.meals.flatMap((meal) => meal.ingredients)
      .some((ingredient) => ingredient.foodName === 'Vegetables')).toBe(false);

    const savedBanana = generateWeeklyMealPlan({
      inventory: fullInventory(),
      profile: null,
      consumption: noConsumption,
    }).meals.find((meal) => meal.recipeId === 'banana-snack')!;
    const wrongState = refreshMealRecommendation(savedBanana, [food('Banana', 500, {
        nutrition: true,
        category: 'Fruits',
        profileDescription: 'Bananas, cooked',
        weightState: 'raw',
      })]);
    expect(wrongState?.nutrition.values['208']).toBeUndefined();
  });

  test('uses only linked USDA nutrient values and reports missing nutrient coverage', () => {
    const inventory = [food('Banana', 500, { nutrition: true, category: 'Fruits' })];
    const plan = generateWeeklyMealPlan({ inventory, profile: null, consumption: noConsumption });
    const bananaSnack = plan.meals.find((meal) => meal.recipeId === 'banana-snack');

    expect(bananaSnack?.nutrition.values['208']).toMatchObject({ amount: 105.02, unit: 'kcal' });
    expect(bananaSnack?.nutrition.values['203']).toMatchObject({ amount: 1.3, unit: 'g' });

    const withoutNutrition = generateWeeklyMealPlan({
      inventory: [food('Banana')],
      profile: null,
      consumption: noConsumption,
    }).meals.find((meal) => meal.recipeId === 'banana-snack');
    expect(withoutNutrition?.nutrition.values['208']).toBeUndefined();
  });

  test('accepts explicit raw inventory state and scales linked apple nutrition', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('Apple', 1, {
          unit: 'kg',
          weightState: 'raw',
          category: 'Fruits',
          nutrition: true,
          profileDescription: 'Apples, raw, with skin',
        }),
      ],
      profile: null,
      consumption: noConsumption,
    });
    const appleSnack = plan.meals.find((meal) => meal.recipeId === 'apple-snack');
    const apple = appleSnack?.ingredients[0];

    expect(apple?.availability).toBe('available');
    expect(appleSnack?.missingIngredients).toEqual([]);
    expect(appleSnack?.nutrition.values['208']).toMatchObject({ amount: 133.5, unit: 'kcal' });
  });

  test('explains that a gram-compatible apple still needs its recipe state verified', () => {
    const savedApple = generateWeeklyMealPlan({
      inventory: [food('Apple', 1000, { category: 'Fruits', weightState: 'raw' })],
      profile: null,
      consumption: noConsumption,
    }).meals.find((meal) => meal.recipeId === 'apple-snack')!;
    const appleSnack = refreshMealRecommendation(
      savedApple,
      [food('Apple', 1, { unit: 'kg', category: 'Fruits' })],
    );

    expect(appleSnack?.ingredients[0]).toMatchObject({
      availability: 'unverified',
      verificationIssue: 'weight-state',
      availableGrams: 1000,
    });
    expect(appleSnack?.missingIngredients).toContain(
      'Apple (150 g needed; mark inventory state as raw)',
    );
  });

  test('does not use linked nutrition that explicitly describes a different food state', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [food('Apple', 1, {
        unit: 'kg',
        weightState: 'raw',
        category: 'Fruits',
        nutrition: true,
        profileDescription: 'Apples, cooked',
      })],
      profile: null,
      consumption: noConsumption,
    });
    const appleSnack = plan.meals.find((meal) => meal.recipeId === 'apple-snack');

    expect(appleSnack?.ingredients[0].availability).toBe('available');
    expect(appleSnack?.nutrition.values['208']).toBeUndefined();
  });

  test('shows a partial nutrition total when only some ingredients have verified nutrient data', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('Raw egg', 500, {
          nutrition: true,
          profileDescription: 'Egg, whole, raw, fresh',
        }),
        food('Whole grain bread', 500),
      ],
      profile: null,
      consumption: noConsumption,
    });
    const eggToast = plan.meals.find((meal) => meal.recipeId === 'egg-wholegrain-toast');

    expect(eggToast?.nutrition.values['208']).toMatchObject({ amount: 44.5, unit: 'kcal' });
    expect(eggToast?.nutrition.values['203']).toMatchObject({ amount: 0.55, unit: 'g' });
    expect(eggToast?.nutrition.complete).toBe(false);
  });

  test('uses linked nutrition and logs eggs by piece when the recipe defines a piece weight', () => {
    const fullPlan = generateWeeklyMealPlan({
      inventory: fullInventory(),
      profile: null,
      consumption: noConsumption,
    });
    const savedMeal = fullPlan.meals.find((meal) => meal.recipeId === 'egg-wholegrain-toast')!;
    const refreshed = refreshMealRecommendation(savedMeal, [
      food('Egg', 9, {
        unit: 'pcs',
        nutrition: true,
        profileDescription: 'Egg, whole, raw',
      }),
      food('Whole grain bread', 500),
    ]);
    const egg = refreshed.ingredients.find((ingredient) => ingredient.foodName === 'Egg');

    expect(egg).toMatchObject({
      availability: 'available',
      amountToLog: 1,
      unitToLog: 'pcs',
      availableQuantity: 9,
      availableUnit: 'pcs',
      nutrients: { '208': { amount: 44.5, unit: 'kcal' } },
    });
    expect(refreshed.nutrition.values['208']).toMatchObject({ amount: 44.5, unit: 'kcal' });
    expect(refreshed.nutrition.complete).toBe(false);
  });

  test('logs an apple snack as one piece when inventory is counted in pieces', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [food('Apple', 2, {
        unit: 'pcs',
        weightState: 'raw',
        category: 'Fruits',
        nutrition: true,
        profileDescription: 'Apples, raw, with skin',
      })],
      profile: null,
      consumption: noConsumption,
    });
    const appleSnack = plan.meals.find((meal) => meal.recipeId === 'apple-snack');

    expect(appleSnack?.ingredients[0]).toMatchObject({
      availability: 'available',
      amountToLog: 1,
      unitToLog: 'pcs',
      availableQuantity: 2,
      availableUnit: 'pcs',
    });
  });

  test('recommends bananas from piece-counted inventory as one piece snacks', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [food('Banana', 10, {
        unit: 'pcs',
        weightState: 'raw',
        category: 'Fruits',
        nutrition: true,
        profileDescription: 'Bananas, raw',
      })],
      profile: null,
      consumption: noConsumption,
    });
    const bananaSnack = plan.meals.find((meal) => meal.recipeId === 'banana-snack');

    expect(bananaSnack?.ingredients[0]).toMatchObject({
      availability: 'available',
      amountToLog: 1,
      unitToLog: 'pcs',
      availableQuantity: 10,
      availableUnit: 'pcs',
    });
  });

  test('still recommends meals when pantry units cannot be verified', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('Egg', 9, { unit: 'pcs' }),
        food('Whole grain bread', 500, { unit: 'pcs' }),
      ],
      profile: null,
      consumption: noConsumption,
    });
    expect(plan.meals.length).toBeGreaterThan(0);
    expect(plan.meals.some((meal) => meal.ingredients.some((ingredient) => (
      ingredient.foodName === 'Chicken'
    )))).toBe(true);
  });

  test('refreshes nutrition for an already-saved meal from currently linked inventory data', () => {
    const savedWithoutNutrition = generateWeeklyMealPlan({
      inventory: [food('Banana', 500, { category: 'Fruits', weightState: 'raw' })],
      profile: null,
      consumption: noConsumption,
    }).meals.find((meal) => meal.recipeId === 'banana-snack')!;
    const refreshed = refreshMealRecommendation(savedWithoutNutrition, [
      food('Banana', 500, { nutrition: true, category: 'Fruits', weightState: 'raw' }),
    ]);

    expect(savedWithoutNutrition.nutrition.values['208']).toBeUndefined();
    expect(refreshed.nutrition.values['208']).toMatchObject({ amount: 105.02, unit: 'kcal' });
    expect(refreshed.nutrition.values['203']).toMatchObject({ amount: 1.3, unit: 'g' });
  });

  test('identifies absent and insufficient gram quantities without deducting inventory', () => {
    const fullPlan = generateWeeklyMealPlan({
      inventory: fullInventory(),
      profile: null,
      consumption: noConsumption,
    });
    const savedMeal = fullPlan.meals.find((meal) => meal.recipeId === 'chicken-rice-vegetables')!;
    const refreshed = refreshMealRecommendation(savedMeal, [
      food('Cooked rice', 75, { category: 'Grains' }),
      food('Raw chicken', 130),
    ]);
    expect(refreshed.missingIngredients).toContain('Rice (need 150 g; have 75 g)');
    expect(refreshed.missingIngredients).toContain('Vegetables');
  });

  test('replaces only the chosen day/category and offers compatible alternatives', () => {
    const planData = generateWeeklyMealPlan({
      inventory: fullInventory(),
      profile: profile({ dietaryPreferences: 'Dairy-free' }),
      consumption: noConsumption,
    });
    const plan = { ...planData, id: 'plan-id', createdAt: '', updatedAt: '' };
    const selected = plan.meals.find((meal) => meal.category === 'Breakfast')!;
    const alternatives = availableAlternatives(selected, fullInventory(), profile({ dietaryPreferences: 'Dairy-free' }));
    expect(alternatives.some((meal) => meal.recipeId === 'yogurt-fruit-bowl')).toBe(false);
    const replacement = alternatives.find((meal) => meal.recipeId !== selected.recipeId);
    expect(replacement).toBeDefined();
    const updated = replaceRecommendedMeal(
      plan,
      selected.id,
      replacement!.recipeId,
      fullInventory(),
      profile({ dietaryPreferences: 'Dairy-free' }),
    );
    const after = updated.meals.find((meal) => meal.id === selected.id);
    expect(after?.day).toBe(selected.day);
    expect(after?.category).toBe(selected.category);
    expect(updated.meals).toHaveLength(plan.meals.length);
  });

  test('allows replacing a meal with a dietary-compatible recipe even when its ingredients are not in inventory', () => {
    const planData = generateWeeklyMealPlan({
      inventory: [],
      profile: null,
      consumption: noConsumption,
    });
    const plan = { ...planData, id: 'plan-id', createdAt: '', updatedAt: '' };
    const selected = plan.meals.find((meal) => meal.category === 'Dinner')!;
    const alternatives = availableAlternatives(selected, [], null);
    const replacement = alternatives.find((meal) => (
      meal.ingredients.some((ingredient) => ingredient.foodName === 'Chicken')
    ));

    expect(replacement).toBeDefined();
    expect(isMealFullyAvailable(replacement!)).toBe(false);
    const updated = replaceRecommendedMeal(
      plan,
      selected.id,
      replacement!.recipeId,
      [],
      null,
    );
    expect(updated.meals.find((meal) => meal.id === selected.id)?.recipeId).toBe(replacement?.recipeId);
  });

  test('returns the Monday date for any date in the week', () => {
    expect(getMondayDate(new Date(2026, 10, 4))).toBe('2026-11-02');
  });
});
