import { describe, expect, test } from 'vitest';
import type { FoodItem } from '../../src/utils/foodInventory';
import {
  addGroceryQuantities,
  filterAndSortGroceryItems,
  findMatchingPendingGrocery,
  getRestockSuggestion,
  getWeeklyMealGrocerySuggestions,
  inventoryCategoryForGrocery,
  validateGroceryDraft,
  type GroceryItem,
  type GroceryItemDraft,
} from '../../src/utils/groceryList';
import type { MealRecommendation, WeeklyMealPlan } from '../../src/utils/weeklyMealRecommendations';

const draft: GroceryItemDraft = {
  shoppingListId: 'default',
  inventoryItemId: 'rice-id',
  name: 'Rice',
  category: 'Grains',
  quantity: 500,
  unit: 'g',
  source: 'MANUAL',
  notes: '',
};

function grocery(overrides: Partial<GroceryItem> = {}): GroceryItem {
  return {
    id: 'grocery-1',
    ...draft,
    status: 'PENDING',
    createdAt: '2026-11-05T00:00:00.000Z',
    purchasedAt: null,
    restockedAt: null,
    restockedInventoryItemId: null,
    restockedQuantity: null,
    restockedUnit: null,
    ...overrides,
  };
}

function food(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'food-1',
    foodName: 'Rice',
    category: 'Grains',
    quantity: 0.2,
    unit: 'kg',
    lowStockThreshold: 0.5,
    purchaseDate: '',
    expirationDate: '',
    storageLocation: '',
    notes: '',
    nutritionProfile: null,
    barcode: '',
    brand: '',
    productImageUrl: '',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function meal(day: MealRecommendation['day']): MealRecommendation {
  return {
    id: `meal-${day}`,
    recipeId: 'chicken-rice-vegetables',
    recipeName: 'Chicken with rice and vegetables',
    day,
    category: 'Lunch',
    instructions: '',
    ingredients: [],
    missingIngredients: [],
    nutrition: { values: {}, complete: false },
    savedAsFavorite: false,
  };
}

describe('grocery list helpers', () => {
  test('validates names and positive quantities', () => {
    expect(validateGroceryDraft(draft)).toEqual({});
    expect(validateGroceryDraft({ ...draft, name: '', quantity: 0 }).name).toMatch(/item name/);
    expect(validateGroceryDraft({ ...draft, quantity: 0 }).quantity).toMatch(/greater than zero/);
  });

  test('finds only fully matching pending grocery entries', () => {
    expect(findMatchingPendingGrocery([grocery()], draft)?.id).toBe('grocery-1');
    expect(findMatchingPendingGrocery([grocery({ status: 'PURCHASED' })], draft)).toBeNull();
    expect(findMatchingPendingGrocery([grocery({ unit: 'kg' })], draft)).toBeNull();
    expect(findMatchingPendingGrocery([grocery({ inventoryItemId: null })], draft)).toBeNull();
  });

  test('searches and filters by category and status, then sorts by name or date', () => {
    const items = [
      grocery({ id: 'rice', name: 'Rice', createdAt: '2026-11-05T00:00:00.000Z' }),
      grocery({
        id: 'beans',
        name: 'Beans',
        category: 'Canned Goods',
        status: 'PURCHASED',
        createdAt: '2026-11-04T00:00:00.000Z',
      }),
    ];
    expect(filterAndSortGroceryItems(items, {
      search: '',
      category: 'all',
      status: 'all',
      sort: 'name',
    }).map((item) => item.name)).toEqual(['Beans', 'Rice']);
    expect(filterAndSortGroceryItems(items, {
      search: '',
      category: 'all',
      status: 'all',
      sort: 'date',
    }).map((item) => item.name)).toEqual(['Rice', 'Beans']);
    expect(filterAndSortGroceryItems(items, {
      search: 'rice',
      category: 'Grains',
      status: 'PENDING',
      sort: 'name',
    }).map((item) => item.id)).toEqual(['rice']);
  });

  test('adds quantities only after the caller has confirmed a compatible unit', () => {
    expect(addGroceryQuantities(0.5, 0.25)).toBe(0.75);
    expect(() => addGroceryQuantities(0, 0.25)).toThrow(/greater than zero/);
  });

  test('suggests threshold-based restock amounts and labels the out-of-stock default', () => {
    expect(getRestockSuggestion(food())?.quantity).toBe(0.3);
    expect(getRestockSuggestion(food({ quantity: 0, lowStockThreshold: 0 }))).toMatchObject({
      quantity: 1,
      isDefault: true,
    });
    expect(getRestockSuggestion(food({ quantity: 0.8, lowStockThreshold: 0.5 }))).toBeNull();
  });

  test('does not claim unknown inventory units are missing a verified amount', () => {
    const plannedMeal = {
      ...meal('Monday'),
      recipeId: 'recipe-no-longer-in-catalog',
      ingredients: [{
        foodName: 'Egg',
        aliases: ['egg'],
        amountGrams: 50,
        weightState: 'raw' as const,
        inventoryItemId: 'eggs',
        inventoryFoodName: 'Eggs',
        availability: 'unverified' as const,
        availableGrams: null,
        nutrients: {},
      }],
    };
    const plan: WeeklyMealPlan = {
      id: 'week-1',
      weekStartDate: '2026-11-02',
      meals: [plannedMeal],
      createdAt: '',
      updatedAt: '',
    };

    expect(getWeeklyMealGrocerySuggestions([plan], [
      food({ id: 'eggs', foodName: 'Eggs', category: 'Dairy', quantity: 6, unit: 'pcs' }),
    ])).toEqual([]);
  });

  test('maps grocery-only categories to supported inventory categories', () => {
    expect(inventoryCategoryForGrocery('Meat and Poultry')).toBe('Meat');
    expect(inventoryCategoryForGrocery('Pantry Essentials')).toBe('Canned Goods');
    expect(inventoryCategoryForGrocery('Snacks')).toBe('Snacks');
  });

  test('sums meal-plan requirements and subtracts available compatible stock', () => {
    const plan: WeeklyMealPlan = {
      id: 'week-1',
      weekStartDate: '2026-11-02',
      meals: [meal('Monday'), meal('Tuesday')],
      createdAt: '',
      updatedAt: '',
    };
    const inventory = [
      food({ id: 'raw-chicken', foodName: 'Raw Chicken', category: 'Meat', quantity: 0.12, unit: 'kg' }),
      food({ id: 'cooked-rice', foodName: 'Cooked Rice', quantity: 200, unit: 'g' }),
      food({ id: 'fresh-vegetables', foodName: 'Fresh Vegetables', category: 'Vegetables', quantity: 50, unit: 'g' }),
    ];

    expect(getWeeklyMealGrocerySuggestions([plan], inventory)).toEqual([
      expect.objectContaining({ name: 'Chicken', quantity: 120, unit: 'g', inventoryItemId: 'raw-chicken' }),
      expect.objectContaining({ name: 'Rice', quantity: 100, unit: 'g', inventoryItemId: 'cooked-rice' }),
      expect.objectContaining({ name: 'Vegetables', quantity: 150, unit: 'g', inventoryItemId: 'fresh-vegetables' }),
    ]);
  });
});
