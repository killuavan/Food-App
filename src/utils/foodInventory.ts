import type { NutritionProfile } from './usdaNutrition';

export const foodCategories = [
  'Fruits',
  'Vegetables',
  'Meat',
  'Seafood',
  'Dairy',
  'Grains',
  'Beverages',
  'Snacks',
  'Canned Goods',
  'Others',
] as const;

export const measurementUnits = ['g', 'kg', 'mL', 'L', 'pcs', 'packs'] as const;
export type FoodCategory = (typeof foodCategories)[number];
export type MeasurementUnit = (typeof measurementUnits)[number];
export type StockStatus = 'good' | 'low' | 'out';
export type InventorySort = 'name' | 'expirationDate' | 'quantity';

export interface FoodItem {
  id: string;
  foodName: string;
  category: FoodCategory;
  quantity: number;
  unit: MeasurementUnit;
  lowStockThreshold: number;
  purchaseDate: string;
  expirationDate: string;
  storageLocation: string;
  notes: string;
  nutritionProfile?: NutritionProfile | null;
  barcode?: string;
  brand?: string;
  productImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type FoodItemDraft = Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt'>;

export interface FoodItemFormErrors {
  foodName?: string;
  category?: string;
  quantity?: string;
  unit?: string;
  lowStockThreshold?: string;
  expirationDate?: string;
  purchaseDate?: string;
}

export function emptyFoodItemDraft(): FoodItemDraft {
  return {
    foodName: '',
    category: 'Others',
    quantity: 0,
    unit: 'pcs',
    lowStockThreshold: 1,
    purchaseDate: '',
    expirationDate: '',
    storageLocation: '',
    notes: '',
    nutritionProfile: null,
    barcode: '',
    brand: '',
    productImageUrl: '',
  };
}

export function validateFoodItemDraft(draft: FoodItemDraft): FoodItemFormErrors {
  const errors: FoodItemFormErrors = {};
  if (!draft.foodName.trim()) errors.foodName = 'Food name is required.';
  if (!foodCategories.includes(draft.category)) errors.category = 'Choose a valid category.';
  if (!Number.isFinite(draft.quantity) || draft.quantity < 0) {
    errors.quantity = 'Quantity must be a number greater than or equal to zero.';
  }
  if (!measurementUnits.includes(draft.unit)) errors.unit = 'Choose a valid measurement unit.';
  if (!Number.isFinite(draft.lowStockThreshold) || draft.lowStockThreshold < 0) {
    errors.lowStockThreshold = 'Low-stock threshold must be zero or greater.';
  }
  if (draft.purchaseDate && !isValidDate(draft.purchaseDate)) {
    errors.purchaseDate = 'Enter a valid purchase date.';
  }
  if (draft.expirationDate && !isValidDate(draft.expirationDate)) {
    errors.expirationDate = 'Enter a valid expiration date.';
  }
  if (
    draft.purchaseDate
    && draft.expirationDate
    && isValidDate(draft.purchaseDate)
    && isValidDate(draft.expirationDate)
    && draft.expirationDate < draft.purchaseDate
  ) {
    errors.expirationDate = 'Expiration date cannot be before purchase date.';
  }
  return errors;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

export function getStockStatus(quantity: number, lowStockThreshold: number): StockStatus {
  if (quantity === 0) return 'out';
  return quantity <= lowStockThreshold ? 'low' : 'good';
}

const unitDimension: Record<MeasurementUnit, 'mass' | 'volume' | 'piece' | 'pack'> = {
  g: 'mass',
  kg: 'mass',
  mL: 'volume',
  L: 'volume',
  pcs: 'piece',
  packs: 'pack',
};

const unitFactor: Record<MeasurementUnit, number> = {
  g: 1,
  kg: 1000,
  mL: 1,
  L: 1000,
  pcs: 1,
  packs: 1,
};

export function convertThreshold(
  threshold: number,
  fromUnit: MeasurementUnit,
  toUnit: MeasurementUnit,
): number {
  if (unitDimension[fromUnit] !== unitDimension[toUnit]) return threshold;
  return Number(((threshold * unitFactor[fromUnit]) / unitFactor[toUnit]).toFixed(3));
}

export function filterAndSortInventory(
  items: FoodItem[],
  options: {
    search: string;
    category: FoodCategory | 'all';
    status: StockStatus | 'all';
    sort: InventorySort;
  },
): FoodItem[] {
  const search = options.search.trim().toLocaleLowerCase();
  return items
    .filter((item) => !search || item.foodName.toLocaleLowerCase().includes(search))
    .filter((item) => options.category === 'all' || item.category === options.category)
    .filter((item) => options.status === 'all' || getStockStatus(item.quantity, item.lowStockThreshold) === options.status)
    .sort((a, b) => {
      if (options.sort === 'quantity') return a.quantity - b.quantity || a.foodName.localeCompare(b.foodName);
      if (options.sort === 'expirationDate') {
        if (!a.expirationDate && !b.expirationDate) return a.foodName.localeCompare(b.foodName);
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        return a.expirationDate.localeCompare(b.expirationDate) || a.foodName.localeCompare(b.foodName);
      }
      return a.foodName.localeCompare(b.foodName);
    });
}
