import { describe, expect, test } from 'vitest';
import type { FoodConsumption } from '../../src/utils/foodConsumption';
import type { FoodItem } from '../../src/utils/foodInventory';
import type { HealthProfile } from '../../src/utils/healthProfile';
import type { NutritionProfile } from '../../src/utils/usdaNutrition';
import {
  availableAlternatives,
  generateWeeklyMealPlan,
  getMondayDate,
  mealNutrients,
  recommendationDays,
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
  nutrition?: boolean;
  profileDescription?: string;
} = {}): FoodItem {
  return {
    id: name.toLocaleLowerCase().replaceAll(' ', '-'),
    foodName: name,
    category: options.category ?? 'Others',
    quantity,
    unit: options.unit ?? 'g',
    lowStockThreshold: 0,
    purchaseDate: '',
    expirationDate: '',
    storageLocation: '',
    notes: '',
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

describe('weekly meal recommendation rules', () => {
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

  test('filters declared egg allergies and vegetarian preferences', () => {
    const inventory = fullInventory();
    const allergyPlan = generateWeeklyMealPlan({
      inventory,
      profile: profile({ foodAllergies: 'Eggs' }),
      consumption: noConsumption,
    });
    expect(allergyPlan.meals.flatMap((meal) => meal.ingredients).some((entry) => entry.foodName === 'Egg')).toBe(false);

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

    const wrongState = generateWeeklyMealPlan({
      inventory: [food('Banana', 500, {
        nutrition: true,
        category: 'Fruits',
        profileDescription: 'Bananas, cooked',
      })],
      profile: null,
      consumption: noConsumption,
    }).meals.find((meal) => meal.recipeId === 'banana-snack');
    expect(wrongState?.nutrition.values['208']).toBeUndefined();
  });

  test('uses only linked USDA nutrient values and reports missing nutrient coverage', () => {
    const inventory = [food('Banana', 500, { nutrition: true, category: 'Fruits' })];
    const plan = generateWeeklyMealPlan({ inventory, profile: null, consumption: noConsumption });
    const bananaSnack = plan.meals.find((meal) => meal.recipeId === 'banana-snack');

    expect(bananaSnack?.nutrition.values['208']).toMatchObject({ amount: 71.2, unit: 'kcal' });
    expect(bananaSnack?.nutrition.values['203']).toMatchObject({ amount: 0.88, unit: 'g' });

    const withoutNutrition = generateWeeklyMealPlan({
      inventory: [food('Banana')],
      profile: null,
      consumption: noConsumption,
    }).meals.find((meal) => meal.recipeId === 'banana-snack');
    expect(withoutNutrition?.nutrition.values['208']).toBeUndefined();
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

  test('refreshes nutrition for an already-saved meal from currently linked inventory data', () => {
    const savedWithoutNutrition = generateWeeklyMealPlan({
      inventory: [food('Banana', 500, { category: 'Fruits' })],
      profile: null,
      consumption: noConsumption,
    }).meals.find((meal) => meal.recipeId === 'banana-snack')!;
    const refreshed = refreshMealRecommendation(savedWithoutNutrition, [
      food('Banana', 500, { nutrition: true, category: 'Fruits' }),
    ]);

    expect(savedWithoutNutrition.nutrition.values['208']).toBeUndefined();
    expect(refreshed.nutrition.values['208']).toMatchObject({ amount: 71.2, unit: 'kcal' });
    expect(refreshed.nutrition.values['203']).toMatchObject({ amount: 0.88, unit: 'g' });
  });

  test('identifies absent and insufficient gram quantities without deducting inventory', () => {
    const plan = generateWeeklyMealPlan({
      inventory: [
        food('Cooked rice', 75, { category: 'Grains' }),
        food('Raw chicken', 130),
      ],
      profile: null,
      consumption: noConsumption,
    });
    const chickenMeal = plan.meals.find((meal) => meal.recipeId === 'chicken-rice-vegetables');
    expect(chickenMeal?.missingIngredients).toContain('Rice (need 150 g; have 75 g)');
    expect(chickenMeal?.missingIngredients).toContain('Vegetables');
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

  test('returns the Monday date for any date in the week', () => {
    expect(getMondayDate(new Date(2026, 10, 4))).toBe('2026-11-02');
  });
});
