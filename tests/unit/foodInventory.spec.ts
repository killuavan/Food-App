import { describe, expect, test } from 'vitest';
import {
  convertThreshold,
  filterAndSortInventory,
  getStockStatus,
  validateFoodItemDraft,
  type FoodItem,
  type FoodItemDraft,
} from '@/utils/foodInventory';

const validDraft: FoodItemDraft = {
  foodName: 'Brown rice',
  category: 'Grains',
  quantity: 2,
  unit: 'kg',
  lowStockThreshold: 500,
  purchaseDate: '2026-10-01',
  expirationDate: '2027-01-01',
  storageLocation: 'Pantry',
  notes: '',
};

function item(overrides: Partial<FoodItem>): FoodItem {
  return {
    id: 'item',
    foodName: 'Brown rice',
    category: 'Grains',
    quantity: 2,
    unit: 'kg',
    lowStockThreshold: 0.5,
    purchaseDate: '',
    expirationDate: '',
    storageLocation: '',
    notes: '',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('food inventory domain rules', () => {
  test('accepts valid food and rejects required, negative, and inconsistent values', () => {
    expect(validateFoodItemDraft(validDraft)).toEqual({});
    expect(validateFoodItemDraft({
      ...validDraft,
      foodName: ' ',
      quantity: -1,
      expirationDate: '2026-09-30',
    })).toMatchObject({
      foodName: expect.any(String),
      quantity: expect.any(String),
      expirationDate: expect.any(String),
    });
  });

  test('calculates stock status from quantity and same-unit threshold', () => {
    expect(getStockStatus(3, 2)).toBe('good');
    expect(getStockStatus(2, 2)).toBe('low');
    expect(getStockStatus(0.1, 2)).toBe('low');
    expect(getStockStatus(0, 2)).toBe('out');
  });

  test('converts compatible stock thresholds but not unrelated units', () => {
    expect(convertThreshold(0.5, 'kg', 'g')).toBe(500);
    expect(convertThreshold(750, 'mL', 'L')).toBe(0.75);
    expect(convertThreshold(2, 'packs', 'pcs')).toBe(2);
    expect(convertThreshold(2, 'kg', 'L')).toBe(2);
  });

  test('searches, filters by category and stock, and sorts inventory', () => {
    const inventory = [
      item({ id: 'rice', foodName: 'Brown rice', category: 'Grains', quantity: 2, expirationDate: '2027-01-01' }),
      item({ id: 'milk', foodName: 'Milk', category: 'Dairy', quantity: 0, expirationDate: '2026-11-01' }),
      item({ id: 'apple', foodName: 'Apple', category: 'Fruits', quantity: 1, expirationDate: '' }),
    ];

    expect(filterAndSortInventory(inventory, {
      search: 'MIL',
      category: 'all',
      status: 'all',
      sort: 'name',
    }).map((entry) => entry.id)).toEqual(['milk']);
    expect(filterAndSortInventory(inventory, {
      search: '',
      category: 'all',
      status: 'out',
      sort: 'expirationDate',
    }).map((entry) => entry.id)).toEqual(['milk']);
    expect(filterAndSortInventory(inventory, {
      search: '',
      category: 'all',
      status: 'all',
      sort: 'quantity',
    }).map((entry) => entry.id)).toEqual(['milk', 'apple', 'rice']);
  });
});
