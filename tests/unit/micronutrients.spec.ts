import { describe, expect, test } from 'vitest';
import type { FoodConsumption } from '../../src/utils/foodConsumption';
import {
  estimateRecordMicronutrient,
  getMicronutrientTrend,
  summarizeDailyMicronutrients,
} from '../../src/utils/micronutrients';
import {
  mapOpenFoodFactsNutrition,
  mapUsdaFoodDetails,
  type NutritionProfile,
} from '../../src/utils/usdaNutrition';

function profile(
  nutrients: NutritionProfile['nutrients'],
  options: Partial<Pick<NutritionProfile, 'basisGrams' | 'basisMilliliters' | 'servingSize' | 'servingSizeUnit' | 'source'>> = {},
): NutritionProfile {
  return {
    fdcId: 123,
    description: 'Test food',
    dataType: 'Foundation',
    foodCategory: '',
    brandOwner: '',
    householdServing: '',
    servingSize: options.servingSize ?? null,
    servingSizeUnit: options.servingSizeUnit ?? '',
    basisGrams: options.basisGrams === undefined ? 100 : options.basisGrams,
    basisMilliliters: options.basisMilliliters ?? null,
    basisDescription: 'per 100 g',
    nutrients,
    portions: [],
    source: options.source ?? 'USDA FoodData Central',
  };
}

function record(overrides: Partial<FoodConsumption> = {}): FoodConsumption {
  return {
    id: 'entry-1',
    inventoryItemId: 'item-1',
    foodName: 'Orange',
    foodCategory: 'Fruit',
    inventoryUnit: 'g',
    mealCategory: 'Breakfast',
    quantityConsumed: 150,
    measurementUnit: 'g',
    consumptionDate: '2026-11-03',
    consumptionTime: '08:00',
    notes: '',
    nutritionSnapshot: profile({
      '401': { amount: 50, unit: 'mg', name: 'Vitamin C' },
      '291': { amount: 2, unit: 'g', name: 'Dietary fiber' },
    }),
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('micronutrient tracking', () => {
  test('scales vitamin, mineral, and fiber values for consumed grams', () => {
    const logged = record({
      nutritionSnapshot: profile({
        '401': { amount: 50, unit: 'mg', name: 'Vitamin C' },
        '301': { amount: 250, unit: 'mg', name: 'Calcium' },
        '291': { amount: 3, unit: 'g', name: 'Dietary fiber' },
      }),
    });
    expect(estimateRecordMicronutrient(logged, 'vitaminC')).toMatchObject({ amount: 75, unit: 'mg', comparable: true });
    expect(estimateRecordMicronutrient(logged, 'calcium')).toMatchObject({ amount: 375, unit: 'mg', comparable: true });
    expect(estimateRecordMicronutrient(logged, 'fiber')).toMatchObject({ amount: 4.5, unit: 'g', comparable: true });
  });

  test('converts compatible units and scales by a valid serving weight', () => {
    const logged = record({
      quantityConsumed: 2,
      measurementUnit: 'servings',
      nutritionSnapshot: profile({
        '418': { amount: 0.002, unit: 'mg', name: 'Vitamin B12' },
      }, { servingSize: 25, servingSizeUnit: 'g' }),
    });
    expect(estimateRecordMicronutrient(logged, 'vitaminB12'))
      .toMatchObject({ amount: 1, unit: 'µg', comparable: true });
  });

  test('preserves incomparable vitamin A and folate forms without false conversions', () => {
    const rae = record({
      quantityConsumed: 100,
      nutritionSnapshot: profile({ '320': { amount: 400, unit: 'µg', name: 'Vitamin A (RAE)' } }),
    });
    expect(estimateRecordMicronutrient(rae, 'vitaminA'))
      .toMatchObject({ amount: 400, unit: 'µg RAE', comparable: true });

    const iu = record({
      quantityConsumed: 100,
      nutritionSnapshot: profile({ '318': { amount: 500, unit: 'IU', name: 'Vitamin A' } }),
    });
    expect(estimateRecordMicronutrient(iu, 'vitaminA'))
      .toMatchObject({ amount: 500, unit: 'IU', comparable: false });

    const folate = record({
      quantityConsumed: 100,
      nutritionSnapshot: profile({ '417': { amount: 100, unit: 'µg', name: 'Folate' } }),
    });
    expect(estimateRecordMicronutrient(folate, 'folate'))
      .toMatchObject({ amount: 100, unit: 'µg', comparable: false });
  });

  test('handles volume basis, missing data, invalid quantity, and unsupported pieces', () => {
    const volumeRecord = record({
      quantityConsumed: 200,
      measurementUnit: 'mL',
      nutritionSnapshot: profile({
        '307': { amount: 120, unit: 'mg', name: 'Sodium' },
      }, { basisGrams: null, basisMilliliters: 100, source: 'Open Food Facts' }),
    });
    expect(estimateRecordMicronutrient(volumeRecord, 'sodium').amount).toBe(240);
    expect(estimateRecordMicronutrient(record({ nutritionSnapshot: null }), 'vitaminC').reason)
      .toBe('missing-nutrition');
    expect(estimateRecordMicronutrient(record({ quantityConsumed: 0 }), 'vitaminC').reason)
      .toBe('invalid-quantity');
    expect(estimateRecordMicronutrient(record({
      quantityConsumed: 1,
      measurementUnit: 'pcs',
    }), 'vitaminC').reason).toBe('unsupported-unit');
    expect(estimateRecordMicronutrient(record(), 'vitaminD').reason).toBe('missing-nutrient');
  });

  test('summarizes meals, deduplicates entries, and labels partial or unavailable totals', () => {
    const breakfast = record({ id: 'one' });
    const lunch = record({
      id: 'two',
      mealCategory: 'Lunch',
      nutritionSnapshot: profile({ '401': { amount: 20, unit: 'mg', name: 'Vitamin C' } }),
    });
    const summary = summarizeDailyMicronutrients([breakfast, breakfast, lunch], '2026-11-03');
    expect(summary.entryCount).toBe(2);
    expect(summary.values.vitaminC).toMatchObject({
      status: 'available',
      entriesWithData: 2,
      entriesMissingData: 0,
      totals: [{ amount: 105, unit: 'mg', comparable: true }],
    });
    expect(summary.values.vitaminC.meals.Breakfast[0].amount).toBe(75);
    expect(summary.values.vitaminC.meals.Lunch[0].amount).toBe(30);
    expect(summary.values.calcium.status).toBe('unavailable');

    const incomplete = summarizeDailyMicronutrients([
      breakfast,
      record({ id: 'unknown', nutritionSnapshot: null }),
    ], '2026-11-03');
    expect(incomplete.status).toBe('partial');
    expect(incomplete.values.vitaminC).toMatchObject({ status: 'partial', entriesWithData: 1, entriesMissingData: 1 });
    expect(summarizeDailyMicronutrients([], '2026-11-03').status).toBe('no-records');
  });

  test('builds weekly trend with distinct empty and missing-data days', () => {
    const days = getMicronutrientTrend([
      record({ id: 'logged', consumptionDate: '2026-11-03' }),
      record({ id: 'missing', consumptionDate: '2026-11-02', nutritionSnapshot: null }),
    ], 'vitaminC', '2026-11-03', 'en-US');
    expect(days).toHaveLength(7);
    expect(days[5]).toMatchObject({ date: '2026-11-02', amount: null, status: 'unavailable' });
    expect(days[6]).toMatchObject({ date: '2026-11-03', amount: 75, status: 'available' });
    expect(days[0].status).toBe('no-records');
  });

  test('does not combine incomparable special-unit values in a weekly trend', () => {
    const days = getMicronutrientTrend([
      record({
        id: 'rae',
        quantityConsumed: 100,
        nutritionSnapshot: profile({ '320': { amount: 300, unit: 'µg', name: 'Vitamin A (RAE)' } }),
      }),
      record({
        id: 'iu',
        quantityConsumed: 100,
        nutritionSnapshot: profile({ '318': { amount: 900, unit: 'IU', name: 'Vitamin A' } }),
      }),
    ], 'vitaminA', '2026-11-03');
    expect(days[6]).toMatchObject({ amount: null, status: 'partial' });

    const separateDays = getMicronutrientTrend([
      record({
        id: 'rae-day',
        quantityConsumed: 100,
        consumptionDate: '2026-11-02',
        nutritionSnapshot: profile({ '320': { amount: 300, unit: 'µg', name: 'Vitamin A (RAE)' } }),
      }),
      record({
        id: 'iu-day',
        quantityConsumed: 100,
        nutritionSnapshot: profile({ '318': { amount: 900, unit: 'IU', name: 'Vitamin A' } }),
      }),
    ], 'vitaminA', '2026-11-03');
    expect(separateDays[5]).toMatchObject({ amount: 300, unit: 'µg RAE', status: 'available' });
    expect(separateDays[6]).toMatchObject({ amount: null, status: 'partial' });
  });

  test('maps USDA nutrient IDs and Open Food Facts vitamin and mineral fields', () => {
    const usda = mapUsdaFoodDetails({
      fdcId: 123,
      description: 'Food',
      dataType: 'Foundation',
      foodNutrients: [
        { nutrientId: 1106, amount: 300, unitName: 'µg' },
        { nutrientId: 1177, amount: 50, unitName: 'µg' },
        { nutrientId: 1090, amount: 10, unitName: 'mg' },
        { nutrientId: 1095, amount: 2, unitName: 'mg' },
      ],
    });
    expect(usda.nutrients).toMatchObject({
      '320': { amount: 300, name: 'Vitamin A (RAE)' },
      '435': { amount: 50, name: 'Folate (DFE)' },
      '304': { amount: 10, name: 'Magnesium' },
      '309': { amount: 2, name: 'Zinc' },
    });

    const off = mapOpenFoodFactsNutrition({
      code: '1234567890123',
      product_name: 'Packaged food',
      nutriments: {
        'vitamin-b12_100g': 0.5,
        'magnesium_100g': 20,
        'zinc_100g': 1,
        'vitamin-a_100g': 100,
        'vitamin-b9_100g': 40,
      },
    });
    expect(off.nutrients).toMatchObject({
      '418': { amount: 0.5, unit: 'µg' },
      '304': { amount: 20, unit: 'mg' },
      '309': { amount: 1, unit: 'mg' },
      '320': { amount: 100, comparable: false },
      '417': { amount: 40, comparable: false },
    });
  });
});
