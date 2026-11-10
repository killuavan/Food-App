import { describe, expect, test } from 'vitest';
import type { FoodConsumption } from '../../src/utils/foodConsumption';
import {
  estimateRecordCalories,
  estimateRecordMacronutrient,
  getMacronutrientsForDateRange,
  getSevenDayCalories,
  summarizeDailyCalories,
  summarizeDailyMacronutrients,
} from '../../src/utils/dailyNutrition';
import type { NutritionProfile } from '../../src/utils/usdaNutrition';

function nutritionProfile(options: {
  calories?: number;
  unit?: string;
  basisGrams?: number | null;
  basisMilliliters?: number | null;
  servingSize?: number | null;
  servingSizeUnit?: string;
  source?: NutritionProfile['source'];
  macros?: Partial<Record<'protein' | 'carbohydrates' | 'totalFat', number>>;
} = {}): NutritionProfile {
  const macroIds = { protein: '203', carbohydrates: '205', totalFat: '204' } as const;
  const macroNutrients = Object.fromEntries(
    Object.entries(options.macros ?? {}).map(([name, amount]) => [
      macroIds[name as keyof typeof macroIds],
      { amount, unit: 'g', name },
    ]),
  );
  return {
    fdcId: options.source === 'Open Food Facts' ? null : 123,
    description: 'Test food',
    dataType: 'Foundation',
    foodCategory: '',
    brandOwner: '',
    householdServing: '',
    servingSize: options.servingSize ?? null,
    servingSizeUnit: options.servingSizeUnit ?? '',
    basisGrams: options.basisGrams === undefined ? 100 : options.basisGrams,
    basisMilliliters: options.basisMilliliters ?? null,
    basisDescription: 'test basis',
    nutrients: {
      ...macroNutrients,
      ...(options.calories === undefined ? {} : {
        [options.unit === 'kJ' ? '268' : '208']: {
          amount: options.calories,
          unit: options.unit ?? 'kcal',
          name: 'Energy',
        },
      }),
    },
    portions: [],
    source: options.source ?? 'USDA FoodData Central',
    ...(options.source === 'Open Food Facts' ? { sourceProductId: '1234567890123' } : {}),
  };
}

function record(overrides: Partial<FoodConsumption> = {}): FoodConsumption {
  return {
    id: 'record-1',
    inventoryItemId: 'item-1',
    foodName: 'Test food',
    foodCategory: 'Grains',
    inventoryUnit: 'g',
    mealCategory: 'Breakfast',
    quantityConsumed: 50,
    measurementUnit: 'g',
    consumptionDate: '2026-11-03',
    consumptionTime: '08:00',
    notes: '',
    nutritionSnapshot: nutritionProfile({ calories: 200 }),
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('daily calorie tracking', () => {
  test('calculates USDA calories per 100g and per 100mL for consumed amount', () => {
    expect(estimateRecordCalories(record()).caloriesKcal).toBe(100);
    expect(estimateRecordCalories(record({
      quantityConsumed: 250,
      measurementUnit: 'mL',
      nutritionSnapshot: nutritionProfile({
        calories: 42,
        basisGrams: null,
        basisMilliliters: 100,
        source: 'Open Food Facts',
      }),
    })).caloriesKcal).toBe(105);
  });

  test('calculates valid serving conversions and converts kJ to kcal', () => {
    expect(estimateRecordCalories(record({
      quantityConsumed: 2,
      measurementUnit: 'servings',
      nutritionSnapshot: nutritionProfile({
        calories: 150,
        servingSize: 30,
        servingSizeUnit: 'g',
      }),
    })).caloriesKcal).toBe(90);
    expect(estimateRecordCalories(record({
      quantityConsumed: 100,
      nutritionSnapshot: nutritionProfile({ calories: 418.4, unit: 'kJ' }),
    })).caloriesKcal).toBe(100);
  });

  test('uses the normalized 100g basis for branded USDA servings', () => {
    expect(estimateRecordCalories(record({
      quantityConsumed: 50,
      nutritionSnapshot: nutritionProfile({
        calories: 200,
        basisGrams: 30,
        servingSize: 30,
        servingSizeUnit: 'g',
      }),
    })).caloriesKcal).toBe(100);
  });

  test('marks missing calories and unsupported portion units unavailable, not zero', () => {
    expect(estimateRecordCalories(record({ nutritionSnapshot: null }))).toMatchObject({
      caloriesKcal: null,
      reason: 'missing-nutrition',
    });
    expect(estimateRecordCalories(record({
      quantityConsumed: 1,
      measurementUnit: 'pcs',
    })).reason).toBe('unsupported-unit');
    expect(estimateRecordCalories(record({
      nutritionSnapshot: nutritionProfile(),
    })).reason).toBe('missing-calories');
    expect(estimateRecordCalories(record({ quantityConsumed: Number.NaN })).reason).toBe('invalid-quantity');
  });

  test('summarizes meal and day totals once per saved record and distinguishes partial data', () => {
    const records = [
      record({ id: 'breakfast', mealCategory: 'Breakfast' }),
      record({ id: 'lunch', mealCategory: 'Lunch', quantityConsumed: 100 }),
      record({ id: 'snack', mealCategory: 'Snacks', nutritionSnapshot: null }),
      record({ id: 'other-day', consumptionDate: '2026-11-02' }),
    ];
    const summary = summarizeDailyCalories(records, '2026-11-03');
    expect(summary).toMatchObject({
      entryCount: 3,
      entriesWithCalories: 2,
      entriesMissingCalories: 1,
      caloriesKcal: 300,
      status: 'incomplete',
    });
    expect(summary.meals.Breakfast.caloriesKcal).toBe(100);
    expect(summary.meals.Lunch.caloriesKcal).toBe(200);
    expect(summary.meals.Snacks.caloriesKcal).toBeNull();
    expect(
      Object.values(summary.meals).reduce((sum, meal) => sum + (meal.caloriesKcal ?? 0), 0),
    ).toBe(summary.caloriesKcal);
  });

  test('distinguishes no records from records without calories', () => {
    expect(summarizeDailyCalories([], '2026-11-03')).toMatchObject({
      entryCount: 0,
      caloriesKcal: null,
      status: 'no-records',
    });
    expect(summarizeDailyCalories([
      record({ nutritionSnapshot: null }),
    ], '2026-11-03')).toMatchObject({
      entryCount: 1,
      caloriesKcal: null,
      status: 'incomplete',
    });
  });

  test('builds a seven-day view from persisted records and labels empty days', () => {
    const days = getSevenDayCalories([
      record({ id: 'logged', consumptionDate: '2026-11-03' }),
      record({ id: 'incomplete', consumptionDate: '2026-11-02', nutritionSnapshot: null }),
    ], '2026-11-03', 'en-US');
    expect(days).toHaveLength(7);
    expect(days[5]).toMatchObject({ date: '2026-11-02', status: 'incomplete' });
    expect(days[6]).toMatchObject({ date: '2026-11-03', status: 'complete', caloriesKcal: 100 });
    expect(days[0].status).toBe('no-records');
    expect(getSevenDayCalories([], 'not-a-date')).toEqual([]);
  });

  test('calculates protein, carbohydrates, and fat from normalized quantities', () => {
    const logged = record({
      quantityConsumed: 150,
      nutritionSnapshot: nutritionProfile({
        macros: { protein: 10, carbohydrates: 20, totalFat: 5 },
      }),
    });
    expect(estimateRecordMacronutrient(logged, 'protein').amountG).toBe(15);
    expect(estimateRecordMacronutrient(logged, 'carbohydrates').amountG).toBe(30);
    expect(estimateRecordMacronutrient(logged, 'totalFat').amountG).toBe(7.5);
  });

  test('supports volume and valid serving conversions for macro estimates', () => {
    const volumeRecord = record({
      quantityConsumed: 250,
      measurementUnit: 'mL',
      nutritionSnapshot: nutritionProfile({
        basisGrams: null,
        basisMilliliters: 100,
        macros: { protein: 2 },
        source: 'Open Food Facts',
      }),
    });
    expect(estimateRecordMacronutrient(volumeRecord, 'protein').amountG).toBe(5);

    const servingRecord = record({
      quantityConsumed: 2,
      measurementUnit: 'servings',
      nutritionSnapshot: nutritionProfile({
        servingSize: 30,
        servingSizeUnit: 'g',
        macros: { protein: 8 },
      }),
    });
    expect(estimateRecordMacronutrient(servingRecord, 'protein').amountG).toBe(4.8);
  });

  test('keeps missing macro nutrients unavailable and counts incomplete fields', () => {
    expect(estimateRecordMacronutrient(record({ nutritionSnapshot: null }), 'protein'))
      .toMatchObject({ amountG: null, reason: 'missing-nutrition' });
    expect(estimateRecordMacronutrient(record({
      nutritionSnapshot: nutritionProfile({ macros: { protein: 3 } }),
    }), 'totalFat')).toMatchObject({ amountG: null, reason: 'missing-nutrient' });
    expect(estimateRecordMacronutrient(record({
      quantityConsumed: 1,
      measurementUnit: 'pcs',
      nutritionSnapshot: nutritionProfile({ macros: { protein: 3 } }),
    }), 'protein')).toMatchObject({ amountG: null, reason: 'unsupported-unit' });

    const summary = summarizeDailyMacronutrients([
      record({ id: 'one', nutritionSnapshot: nutritionProfile({ macros: { protein: 10, carbohydrates: 20, totalFat: 5 } }) }),
      record({ id: 'two', mealCategory: 'Lunch', nutritionSnapshot: nutritionProfile({ macros: { protein: 3 } }) }),
    ], '2026-11-03');
    expect(summary).toMatchObject({
      proteinG: 6.5,
      carbohydratesG: 10,
      totalFatG: 2.5,
      status: 'incomplete',
      distributionComplete: false,
      entriesMissingData: { protein: 0, carbohydrates: 1, totalFat: 1 },
    });
    expect(summary.meals.Lunch.proteinG).toBe(1.5);
    expect(summary.distributionPercent.protein).toBeGreaterThan(0);
    expect(summary.distributionPercent.protein! + summary.distributionPercent.carbohydrates! + summary.distributionPercent.totalFat!)
      .toBeCloseTo(100, 1);
  });

  test('date range analytics distinguish no logs from missing nutrients and deduplicate IDs', () => {
    const days = getMacronutrientsForDateRange([
      record({ id: 'logged', consumptionDate: '2026-11-02', nutritionSnapshot: nutritionProfile({ macros: { protein: 12, carbohydrates: 24, totalFat: 6 } }) }),
      record({ id: 'logged', consumptionDate: '2026-11-02', quantityConsumed: 300, nutritionSnapshot: nutritionProfile({ macros: { protein: 12, carbohydrates: 24, totalFat: 6 } }) }),
      record({ id: 'missing', consumptionDate: '2026-11-03', nutritionSnapshot: null }),
    ], '2026-11-01', '2026-11-03');
    expect(days).toHaveLength(3);
    expect(days[0].status).toBe('no-records');
    expect(days[1]).toMatchObject({ entryCount: 1, proteinG: 6, carbohydratesG: 12, totalFatG: 3 });
    expect(days[2]).toMatchObject({ entryCount: 1, status: 'incomplete', proteinG: null });
    expect(getMacronutrientsForDateRange([], '2026-11-04', '2026-11-03')).toEqual([]);
  });

  test('recalculates daily macro totals from added, edited, dated, and deleted record sets', () => {
    const first = record({
      id: 'one',
      nutritionSnapshot: nutritionProfile({ macros: { protein: 10, carbohydrates: 20, totalFat: 5 } }),
    });
    const second = record({
      id: 'two',
      mealCategory: 'Dinner',
      nutritionSnapshot: nutritionProfile({ macros: { protein: 4, carbohydrates: 8, totalFat: 2 } }),
    });
    expect(summarizeDailyMacronutrients([first], '2026-11-03').proteinG).toBe(5);
    expect(summarizeDailyMacronutrients([first, second], '2026-11-03').proteinG).toBe(7);

    const edited = { ...second, quantityConsumed: 100, consumptionDate: '2026-11-02' };
    expect(summarizeDailyMacronutrients([first, edited], '2026-11-03').proteinG).toBe(5);
    expect(summarizeDailyMacronutrients([first, edited], '2026-11-02').proteinG).toBe(4);
    expect(summarizeDailyMacronutrients([first], '2026-11-03').proteinG).toBe(5);
  });
});
