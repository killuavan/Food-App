import { describe, expect, test } from 'vitest';
import {
  buildConsumptionAnalytics,
  buildInventoryAnalytics,
  buildMealPlanAnalytics,
  getReportDateBoundary,
  getReportDateInTimeZone,
  listReportDates,
  resolveReportDateRange,
} from '../../src/utils/analyticsReports';
import type { FoodConsumption } from '../../src/utils/foodConsumption';
import type { FoodItem } from '../../src/utils/foodInventory';
import type { InventoryMovement } from '../../src/services/foodConsumptionService';
import type { WeeklyMealPlan } from '../../src/utils/weeklyMealRecommendations';
import {
  createCsvReport,
  createPdfReport,
  escapeCsvValue,
} from '../../src/services/reportExportService';

function makeRecord(overrides: Partial<FoodConsumption> = {}): FoodConsumption {
  return {
    id: 'log-1',
    inventoryItemId: 'item-1',
    foodName: 'Apple',
    foodCategory: 'Fruits',
    inventoryUnit: 'pcs',
    mealCategory: 'Breakfast',
    quantityConsumed: 100,
    measurementUnit: 'g',
    consumptionDate: '2026-11-09',
    consumptionTime: '08:00',
    notes: '',
    nutritionSnapshot: {
      fdcId: 1,
      description: 'Apple',
      dataType: 'Foundation',
      foodCategory: 'Fruits',
      brandOwner: '',
      householdServing: '',
      servingSize: null,
      servingSizeUnit: '',
      basisGrams: 100,
      basisDescription: 'per 100 g',
      nutrients: {
        '208': { amount: 52, unit: 'kcal', name: 'Energy' },
        '203': { amount: 1, unit: 'g', name: 'Protein' },
        '205': { amount: 14, unit: 'g', name: 'Carbohydrates' },
        '204': { amount: 0.2, unit: 'g', name: 'Total fat' },
        '401': { amount: 4.6, unit: 'mg', name: 'Vitamin C' },
      },
      portions: [],
      source: 'USDA FoodData Central',
    },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function makeInventoryItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'item-1',
    foodName: 'Apple',
    category: 'Fruits',
    quantity: 3,
    unit: 'pcs',
    lowStockThreshold: 3,
    purchaseDate: '',
    expirationDate: '2026-11-11',
    storageLocation: '',
    notes: '',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('analytics report ranges and aggregation', () => {
  test('resolves period choices and rejects invalid custom ranges', () => {
    expect(resolveReportDateRange('today', '', '', '2026-11-10')).toEqual({
      startDate: '2026-11-10',
      endDate: '2026-11-10',
    });
    expect(resolveReportDateRange('last7', '', '', '2026-11-10').startDate).toBe('2026-11-04');
    expect(resolveReportDateRange('last30', '', '', '2026-11-10').startDate).toBe('2026-10-12');
    expect(resolveReportDateRange('month', '', '', '2026-11-10').startDate).toBe('2026-11-01');
    expect(() => resolveReportDateRange('custom', '2026-02-31', '2026-03-01')).toThrow('valid');
    expect(() => resolveReportDateRange('custom', '2026-11-11', '2026-11-10')).toThrow('on or before');
  });

  test('lists date-only ranges without losing days across daylight-saving changes', () => {
    expect(listReportDates({ startDate: '2026-03-07', endDate: '2026-03-09' })).toEqual([
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
    ]);
  });

  test('uses the selected IANA timezone for date boundaries and timestamps', () => {
    const start = getReportDateBoundary('2026-03-08', 'America/Los_Angeles');
    const end = getReportDateBoundary('2026-03-09', 'America/Los_Angeles');
    expect(start.toISOString()).toBe('2026-03-08T08:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-09T07:00:00.000Z');
    expect(getReportDateInTimeZone(new Date('2026-03-08T07:30:00.000Z'), 'America/Los_Angeles')).toBe('2026-03-07');
  });

  test('aggregates unique food logs and keeps unavailable nutrients blank', () => {
    const first = makeRecord();
    const second = makeRecord({
      id: 'log-2',
      foodName: 'Apple',
      mealCategory: 'Lunch',
      nutritionSnapshot: null,
    });
    const analytics = buildConsumptionAnalytics(
      [first, first, second, makeRecord({ id: 'future', consumptionDate: '2026-11-10' })],
      { startDate: '2026-11-09', endDate: '2026-11-09' },
    );

    expect(analytics.totalFoodLogs).toBe(2);
    expect(analytics.daysWithLoggedFoods).toBe(1);
    expect(analytics.totalRecordedCaloriesKcal).toBe(52);
    expect(analytics.nutritionCompletenessPercent).toBe(50);
    expect(analytics.macros.protein).toBe(1);
    expect(analytics.mealDistribution.find((meal) => meal.meal === 'Breakfast')?.count).toBe(1);
    expect(analytics.frequentFoods[0]).toMatchObject({ foodName: 'Apple', count: 2 });
    expect(analytics.micronutrients.find((row) => row.nutrientId === 'vitaminC')?.amount).toBe(4.6);
    expect(analytics.micronutrients.find((row) => row.nutrientId === 'vitaminD')?.amount).toBeNull();
  });

  test('keeps micronutrient totals in incompatible reported units separate', () => {
    const baseProfile = makeRecord().nutritionSnapshot!;
    const microgram = makeRecord({
      nutritionSnapshot: {
        ...baseProfile,
        nutrients: {
          ...baseProfile.nutrients,
          '328': { amount: 1.2, unit: 'µg', name: 'Vitamin D' },
        },
      },
    });
    const internationalUnit = makeRecord({
      id: 'log-iu',
      nutritionSnapshot: {
        ...makeRecord().nutritionSnapshot!,
        nutrients: { '324': { amount: 400, unit: 'IU', name: 'Vitamin D' } },
      },
    });
    const analytics = buildConsumptionAnalytics(
      [microgram, internationalUnit],
      { startDate: '2026-11-09', endDate: '2026-11-09' },
    );
    const vitaminD = analytics.micronutrients.filter((row) => row.nutrientId === 'vitaminD' && row.amount !== null);
    expect(vitaminD.map((row) => row.unit)).toEqual(expect.arrayContaining(['µg', 'IU']));
    expect(vitaminD).toHaveLength(2);
  });

  test('does not turn a day with no food logs into zero calorie intake', () => {
    const analytics = buildConsumptionAnalytics([], { startDate: '2026-11-09', endDate: '2026-11-10' });
    expect(analytics.totalRecordedCaloriesKcal).toBeNull();
    expect(analytics.days.map((day) => day.caloriesKcal)).toEqual([null, null]);
    expect(analytics.nutritionCompletenessPercent).toBeNull();
  });

  test('uses stock thresholds, preserves units, and distinguishes expiry from disposal', () => {
    const movements: InventoryMovement[] = [{
      id: 'move-1',
      inventoryItemId: 'item-1',
      movementType: 'CONSUMPTION',
      quantity: 1,
      unit: 'pcs',
      quantityBefore: 4,
      quantityAfter: 3,
      createdAt: '2026-11-09T12:00:00.000Z',
    }];
    const analytics = buildInventoryAnalytics([
      makeInventoryItem(),
      makeInventoryItem({ id: 'item-2', foodName: 'Milk', quantity: 0, unit: 'L', expirationDate: '2026-11-09' }),
      makeInventoryItem({ id: 'item-3', foodName: 'Bread', quantity: 2, unit: 'packs', expirationDate: '2026-11-09' }),
    ], movements, { startDate: '2026-11-09', endDate: '2026-11-10' }, new Date('2026-11-10T12:00:00'), 7);

    expect(analytics.totalItems).toBe(3);
    expect(analytics.lowStockItems).toBe(2);
    expect(analytics.outOfStockItems).toBe(1);
    expect(analytics.expiringSoonItems.map((item) => item.foodName)).toContain('Apple');
    expect(analytics.expiredItems.map((item) => item.foodName)).toContain('Bread');
    expect(analytics.quantityByUnit).toEqual(expect.arrayContaining([
      { unit: 'pcs', quantity: 3 },
      { unit: 'L', quantity: 0 },
      { unit: 'packs', quantity: 2 },
    ]));
    expect(analytics.movements).toHaveLength(1);
    expect(analytics.movementDailyQuantities).toEqual([{
      date: '2026-11-09',
      movementType: 'CONSUMPTION',
      unit: 'pcs',
      quantity: 1,
    }]);
  });

  test('summarizes saved plan availability without matching logs to recommendations', () => {
    const plan: WeeklyMealPlan = {
      id: 'plan-1',
      weekStartDate: '2026-11-09',
      createdAt: '2026-11-09T09:00:00.000Z',
      updatedAt: '2026-11-09T09:00:00.000Z',
      meals: [{
        id: 'meal-1',
        recipeId: 'recipe-1',
        recipeName: 'Breakfast bowl',
        day: 'Monday',
        category: 'Breakfast',
        instructions: '',
        ingredients: [
          { foodName: 'Oats', aliases: [], amountGrams: 50, inventoryItemId: 'item-1', inventoryFoodName: 'Oats', availability: 'available', availableGrams: 100, nutrients: {} },
          { foodName: 'Milk', aliases: [], amountGrams: 100, inventoryItemId: null, inventoryFoodName: null, availability: 'unavailable', availableGrams: null, nutrients: {} },
          { foodName: 'Fruit', aliases: [], amountGrams: 50, inventoryItemId: null, inventoryFoodName: null, availability: 'unverified', availableGrams: null, nutrients: {} },
        ],
        missingIngredients: ['Milk'],
        nutrition: { values: {}, complete: false },
        savedAsFavorite: false,
      }],
    };
    const report = buildMealPlanAnalytics([plan], { startDate: '2026-11-10', endDate: '2026-11-15' });
    expect(report.plannedMeals).toBe(1);
    expect(report.mealsWithMissingIngredients).toBe(1);
    expect(report.availableIngredients).toBe(1);
    expect(report.missingIngredients).toBe(1);
    expect(report.unverifiedIngredients).toBe(1);
  });
});

describe('report exports', () => {
  const report = {
    title: 'Food report',
    range: { startDate: '2026-11-09', endDate: '2026-11-10' },
    columns: ['Food', 'Value'],
    rows: [{ Food: '=1+1', Value: 12 }],
    summary: ['Export test'],
    generatedAt: new Date('2026-11-10T00:00:00.000Z'),
  };

  test('quotes CSV content and neutralizes spreadsheet formulas', () => {
    expect(escapeCsvValue(' =HYPERLINK("https://example.com")')).toBe(`"' =HYPERLINK(""https://example.com"")"`);
    const csv = createCsvReport(report);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Food report"');
    expect(csv).toContain(`"'=1+1"`);
    expect(csv).toContain('"Export test"');
  });

  test('creates a downloadable PDF blob', () => {
    const pdf = createPdfReport(report);
    expect(pdf).toBeInstanceOf(Blob);
    expect(pdf.type).toBe('application/pdf');
    expect(pdf.size).toBeGreaterThan(0);
  });
});
