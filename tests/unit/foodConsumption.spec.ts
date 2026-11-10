import { describe, expect, test } from 'vitest';
import {
  convertCompatibleQuantity,
  countMealsForDate,
  filterConsumptions,
  getLocalDate,
  getLocalTime,
  isValidLocalDate,
  isValidLocalTime,
  validateFoodConsumptionDraft,
  type FoodConsumption,
  type FoodConsumptionDraft,
} from '../../src/utils/foodConsumption';

const draft: FoodConsumptionDraft = {
  inventoryItemId: 'rice-1',
  foodName: 'Rice',
  foodCategory: 'Grains',
  inventoryUnit: 'kg',
  mealCategory: 'Lunch',
  quantityConsumed: 200,
  measurementUnit: 'g',
  consumptionDate: '2026-10-22',
  consumptionTime: '12:30',
  notes: '',
};

function record(overrides: Partial<FoodConsumption> = {}): FoodConsumption {
  return {
    ...draft,
    id: overrides.id ?? 'record-1',
    createdAt: '2026-10-22T12:30:00.000Z',
    updatedAt: '2026-10-22T12:30:00.000Z',
    ...overrides,
  };
}

describe('food consumption helpers', () => {
  test('formats local date and time without UTC conversion', () => {
    const localDate = new Date(2026, 9, 22, 9, 7);
    expect(getLocalDate(localDate)).toBe('2026-10-22');
    expect(getLocalTime(localDate)).toBe('09:07');
  });

  test('validates real calendar dates, times, and positive amounts', () => {
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2026-10-22')).toBe(true);
    expect(isValidLocalTime('24:00')).toBe(false);
    expect(isValidLocalTime('09:30')).toBe(true);
    expect(validateFoodConsumptionDraft(draft)).toEqual({});
    expect(validateFoodConsumptionDraft({ ...draft, quantityConsumed: 0 }).quantityConsumed)
      .toMatch(/greater than zero/);
    expect(validateFoodConsumptionDraft({ ...draft, inventoryItemId: '' }).inventoryItemId)
      .toMatch(/Select a food item/);
  });

  test('converts only compatible units', () => {
    expect(convertCompatibleQuantity(2, 'kg', 'g')).toBe(2000);
    expect(convertCompatibleQuantity(1.5, 'L', 'mL')).toBe(1500);
    expect(convertCompatibleQuantity(2, 'pcs', 'pcs')).toBe(2);
    expect(convertCompatibleQuantity(1, 'servings', 'g')).toBeNull();
    expect(convertCompatibleQuantity(1, 'packs', 'pcs')).toBeNull();
  });

  test('filters by food, selected date, and meal; defaults to newest first', () => {
    const records = [
      record({ id: 'older', foodName: 'Rice', consumptionDate: '2026-10-21', consumptionTime: '18:00' }),
      record({ id: 'newer', foodName: 'Chicken', consumptionDate: '2026-10-22', consumptionTime: '13:00' }),
      record({ id: 'breakfast', foodName: 'Bread', mealCategory: 'Breakfast', consumptionDate: '2026-10-22', consumptionTime: '08:00' }),
    ];
    expect(filterConsumptions(records, { search: '', date: '', mealCategory: 'all' }).map((item) => item.id))
      .toEqual(['newer', 'breakfast', 'older']);
    expect(filterConsumptions(records, { search: 'bread', date: '2026-10-22', mealCategory: 'Breakfast' }))
      .toHaveLength(1);
  });

  test('counts selected-day meal entries', () => {
    const records = [
      record({ mealCategory: 'Lunch' }),
      record({ id: 'breakfast', mealCategory: 'Breakfast' }),
      record({ id: 'old-day', consumptionDate: '2026-10-21' }),
    ];
    expect(countMealsForDate(records, '2026-10-22')).toEqual({
      Breakfast: 1,
      Lunch: 1,
      Dinner: 0,
      Snacks: 0,
    });
  });
});
