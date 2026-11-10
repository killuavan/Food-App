import type { FoodCategory, MeasurementUnit } from './foodInventory';
import type { NutritionProfile } from './usdaNutrition';

export const mealCategories = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const;
export type MealCategory = (typeof mealCategories)[number];

export const consumptionUnits = ['g', 'kg', 'mL', 'L', 'pcs', 'packs', 'servings'] as const;
export type ConsumptionUnit = (typeof consumptionUnits)[number];

export interface FoodConsumption {
  id: string;
  inventoryItemId: string;
  foodName: string;
  foodCategory: FoodCategory;
  inventoryUnit: MeasurementUnit;
  mealCategory: MealCategory;
  quantityConsumed: number;
  measurementUnit: ConsumptionUnit;
  consumptionDate: string;
  consumptionTime: string;
  notes: string;
  nutritionSnapshot?: NutritionProfile | null;
  inventoryDeduction?: {
    inventoryItemId: string;
    quantity: number;
    unit: MeasurementUnit;
    revision: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export type FoodConsumptionDraft = Omit<FoodConsumption, 'id' | 'createdAt' | 'updatedAt'>;

export interface FoodConsumptionErrors {
  inventoryItemId?: string;
  mealCategory?: string;
  quantityConsumed?: string;
  measurementUnit?: string;
  consumptionDate?: string;
  consumptionTime?: string;
}

export function getLocalDate(value = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalTime(value = new Date()): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

export function isValidLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

export function isValidLocalTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function validateFoodConsumptionDraft(draft: FoodConsumptionDraft): FoodConsumptionErrors {
  const errors: FoodConsumptionErrors = {};
  if (!draft.inventoryItemId.trim()) errors.inventoryItemId = 'Select a food item from your inventory.';
  if (!mealCategories.includes(draft.mealCategory)) errors.mealCategory = 'Choose a valid meal category.';
  if (!Number.isFinite(draft.quantityConsumed) || draft.quantityConsumed <= 0) {
    errors.quantityConsumed = 'Quantity consumed must be greater than zero.';
  }
  if (!consumptionUnits.includes(draft.measurementUnit)) errors.measurementUnit = 'Choose a valid measurement unit.';
  if (!isValidLocalDate(draft.consumptionDate)) errors.consumptionDate = 'Enter a valid consumption date.';
  if (!isValidLocalTime(draft.consumptionTime)) errors.consumptionTime = 'Enter a valid consumption time.';
  return errors;
}

type UnitDimension = 'mass' | 'volume' | 'piece' | 'pack' | 'serving';

const unitDimension: Record<ConsumptionUnit, UnitDimension> = {
  g: 'mass',
  kg: 'mass',
  mL: 'volume',
  L: 'volume',
  pcs: 'piece',
  packs: 'pack',
  servings: 'serving',
};

const unitFactor: Record<ConsumptionUnit, number> = {
  g: 1,
  kg: 1000,
  mL: 1,
  L: 1000,
  pcs: 1,
  packs: 1,
  servings: 1,
};

export function convertCompatibleQuantity(
  quantity: number,
  fromUnit: ConsumptionUnit | MeasurementUnit,
  toUnit: ConsumptionUnit | MeasurementUnit,
): number | null {
  if (unitDimension[fromUnit] !== unitDimension[toUnit]) return null;
  return Number(((quantity * unitFactor[fromUnit]) / unitFactor[toUnit]).toFixed(9));
}

export function sortConsumptionsNewestFirst(records: FoodConsumption[]): FoodConsumption[] {
  return [...records].sort((a, b) => {
    const dateTimeComparison = `${b.consumptionDate}T${b.consumptionTime}`
      .localeCompare(`${a.consumptionDate}T${a.consumptionTime}`);
    return dateTimeComparison || b.createdAt.localeCompare(a.createdAt);
  });
}

export function filterConsumptions(
  records: FoodConsumption[],
  options: { search: string; date: string; mealCategory: MealCategory | 'all' },
): FoodConsumption[] {
  const search = options.search.trim().toLocaleLowerCase();
  return sortConsumptionsNewestFirst(records).filter((record) => (
    (!search || record.foodName.toLocaleLowerCase().includes(search))
    && (!options.date || record.consumptionDate === options.date)
    && (options.mealCategory === 'all' || record.mealCategory === options.mealCategory)
  ));
}

export function countMealsForDate(
  records: FoodConsumption[],
  date: string,
): Record<MealCategory, number> {
  const counts: Record<MealCategory, number> = {
    Breakfast: 0,
    Lunch: 0,
    Dinner: 0,
    Snacks: 0,
  };
  for (const record of records) {
    if (record.consumptionDate === date) counts[record.mealCategory] += 1;
  }
  return counts;
}
