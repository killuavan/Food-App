import type { FoodItem, FoodCategory, MeasurementUnit } from './foodInventory';
import { getStockStatus } from './foodInventory';
import type { WeeklyMealPlan } from './weeklyMealRecommendations';
import { refreshMealRecommendation } from './weeklyMealRecommendations';

export const groceryCategories = [
  'Fruits',
  'Vegetables',
  'Grains',
  'Meat and Poultry',
  'Fish and Seafood',
  'Dairy',
  'Meat',
  'Seafood',
  'Snacks',
  'Canned Goods',
  'Eggs',
  'Beverages',
  'Pantry Essentials',
  'Others',
] as const;

export type GroceryCategory = (typeof groceryCategories)[number];
export type GroceryStatus = 'PENDING' | 'PURCHASED' | 'CANCELLED';
export type GrocerySource = 'MANUAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'WEEKLY_MEAL_PLAN';
export type GrocerySort = 'name' | 'date';

export interface GroceryItem {
  id: string;
  shoppingListId: string;
  inventoryItemId: string | null;
  name: string;
  category: GroceryCategory;
  quantity: number;
  unit: MeasurementUnit;
  status: GroceryStatus;
  source: GrocerySource;
  notes: string;
  createdAt: string;
  purchasedAt: string | null;
  restockedAt: string | null;
  restockedInventoryItemId: string | null;
  restockedQuantity: number | null;
  restockedUnit: MeasurementUnit | null;
}

export type GroceryItemDraft = Pick<
  GroceryItem,
  'shoppingListId' | 'inventoryItemId' | 'name' | 'category' | 'quantity' | 'unit' | 'source' | 'notes'
>;

export interface GroceryErrors {
  name?: string;
  quantity?: string;
  category?: string;
  unit?: string;
  source?: string;
}

export interface RestockSuggestion {
  inventoryItem: FoodItem;
  quantity: number;
  unit: MeasurementUnit;
  isDefault: boolean;
}

export interface MealPlanGrocerySuggestion {
  name: string;
  quantity: number;
  unit: 'g';
  category: GroceryCategory;
  inventoryItemId: string | null;
  mealNames: string[];
}

export function validateGroceryDraft(draft: GroceryItemDraft): GroceryErrors {
  const errors: GroceryErrors = {};
  if (!draft.name.trim()) errors.name = 'Enter an item name.';
  if (!Number.isFinite(draft.quantity) || draft.quantity <= 0) {
    errors.quantity = 'Quantity must be greater than zero.';
  }
  if (!groceryCategories.includes(draft.category)) errors.category = 'Choose a valid category.';
  if (!['g', 'kg', 'mL', 'L', 'pcs', 'packs'].includes(draft.unit)) errors.unit = 'Choose a valid unit.';
  if (!['MANUAL', 'LOW_STOCK', 'OUT_OF_STOCK', 'WEEKLY_MEAL_PLAN'].includes(draft.source)) {
    errors.source = 'Choose a valid item source.';
  }
  return errors;
}

export function normalizeGroceryName(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function filterAndSortGroceryItems(
  items: GroceryItem[],
  options: {
    search: string;
    category: GroceryCategory | 'all';
    status: GroceryStatus | 'all';
    sort: GrocerySort;
  },
): GroceryItem[] {
  const search = options.search.trim().toLocaleLowerCase();
  return items
    .filter((item) => (!search || `${item.name} ${item.notes}`.toLocaleLowerCase().includes(search)))
    .filter((item) => options.category === 'all' || item.category === options.category)
    .filter((item) => options.status === 'all' || item.status === options.status)
    .sort((a, b) => options.sort === 'name'
      ? a.name.localeCompare(b.name)
      : b.createdAt.localeCompare(a.createdAt));
}

export function findMatchingPendingGrocery(
  existingItems: GroceryItem[],
  candidate: GroceryItemDraft,
): GroceryItem | null {
  const normalizedName = normalizeGroceryName(candidate.name);
  return existingItems.find((item) => item.status === 'PENDING'
    && item.shoppingListId === candidate.shoppingListId
    && normalizeGroceryName(item.name) === normalizedName
    && item.inventoryItemId === candidate.inventoryItemId
    && item.category === candidate.category
    && item.unit === candidate.unit) ?? null;
}

export function addGroceryQuantities(
  existingQuantity: number,
  addedQuantity: number,
): number {
  if (!Number.isFinite(existingQuantity) || existingQuantity <= 0
    || !Number.isFinite(addedQuantity) || addedQuantity <= 0) {
    throw new Error('Both grocery quantities must be greater than zero.');
  }
  return Number((existingQuantity + addedQuantity).toFixed(9));
}

export function getRestockSuggestion(item: FoodItem): RestockSuggestion | null {
  const status = getStockStatus(item.quantity, item.lowStockThreshold);
  if (status === 'good') return null;
  if (status === 'low') {
    const quantity = Number((item.lowStockThreshold - item.quantity).toFixed(9));
    return quantity > 0
      ? { inventoryItem: item, quantity, unit: item.unit, isDefault: false }
      : null;
  }
  const usesDefault = item.lowStockThreshold <= 0;
  return {
    inventoryItem: item,
    quantity: usesDefault ? 1 : item.lowStockThreshold,
    unit: item.unit,
    isDefault: usesDefault,
  };
}

function categoryForIngredient(name: string, inventoryItem: FoodItem | undefined): GroceryCategory {
  if (inventoryItem) return inventoryItem.category;
  const normalized = name.toLocaleLowerCase();
  if (/\b(egg|eggs)\b/.test(normalized)) return 'Eggs';
  if (/\b(chicken|beef|pork|turkey|meat)\b/.test(normalized)) return 'Meat and Poultry';
  if (/\b(fish|salmon|tuna|shrimp|seafood)\b/.test(normalized)) return 'Fish and Seafood';
  if (/\b(milk|yogurt|yoghurt|cheese|dairy)\b/.test(normalized)) return 'Dairy';
  if (/\b(apple|banana|orange|fruit|berries)\b/.test(normalized)) return 'Fruits';
  if (/\b(vegetable|spinach|carrot|broccoli|lettuce|tomato)\b/.test(normalized)) return 'Vegetables';
  if (/\b(rice|bread|oats|grain|pasta)\b/.test(normalized)) return 'Grains';
  return 'Others';
}

export function getWeeklyMealGrocerySuggestions(
  plans: WeeklyMealPlan[],
  inventory: FoodItem[],
): MealPlanGrocerySuggestion[] {
  const plan = [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt)
    || b.weekStartDate.localeCompare(a.weekStartDate))[0];
  if (!plan) return [];

  const requirements = new Map<string, {
    name: string;
    requiredGrams: number;
    availableGrams: number | null;
    inventoryItemId: string | null;
    mealNames: Set<string>;
    hasUnverifiedInventory: boolean;
  }>();

  for (const meal of plan.meals) {
    const refreshed = refreshMealRecommendation(meal, inventory);
    for (const ingredient of refreshed.ingredients) {
      if (!Number.isFinite(ingredient.amountGrams) || ingredient.amountGrams <= 0) continue;
      const key = normalizeGroceryName(ingredient.foodName);
      const current = requirements.get(key);
      if (current) {
        current.requiredGrams += ingredient.amountGrams;
        if (current.availableGrams === null && ingredient.availableGrams !== null) {
          current.availableGrams = ingredient.availableGrams;
        }
        if (!current.inventoryItemId) current.inventoryItemId = ingredient.inventoryItemId;
        current.hasUnverifiedInventory ||= ingredient.availability === 'unverified';
        current.mealNames.add(`${meal.day} ${meal.category}`);
      } else {
        requirements.set(key, {
          name: ingredient.foodName,
          requiredGrams: ingredient.amountGrams,
          availableGrams: ingredient.availableGrams,
          inventoryItemId: ingredient.inventoryItemId,
          mealNames: new Set([`${meal.day} ${meal.category}`]),
          hasUnverifiedInventory: ingredient.availability === 'unverified',
        });
      }
    }
  }

  return [...requirements.values()].flatMap((requirement) => {
    if (requirement.availableGrams === null && requirement.hasUnverifiedInventory) return [];
    const missing = requirement.availableGrams === null
      ? requirement.requiredGrams
      : Math.max(0, requirement.requiredGrams - requirement.availableGrams);
    if (missing <= 0) return [];
    const linkedItem = inventory.find((item) => item.id === requirement.inventoryItemId);
    return [{
      name: requirement.name,
      quantity: Number(missing.toFixed(2)),
      unit: 'g' as const,
      category: categoryForIngredient(requirement.name, linkedItem),
      inventoryItemId: requirement.inventoryItemId,
      mealNames: [...requirement.mealNames],
    }];
  });
}

export function inventoryCategoryForGrocery(category: GroceryCategory): FoodCategory {
  if (category === 'Meat and Poultry') return 'Meat';
  if (category === 'Fish and Seafood') return 'Seafood';
  if (category === 'Eggs') return 'Dairy';
  if (category === 'Pantry Essentials') return 'Canned Goods';
  if (category === 'Fruits' || category === 'Vegetables' || category === 'Grains'
    || category === 'Beverages' || category === 'Dairy' || category === 'Meat'
    || category === 'Seafood' || category === 'Snacks' || category === 'Canned Goods'
    || category === 'Others') {
    return category;
  }
  return 'Others';
}

export function isGroceryMeasurementUnit(value: string): value is MeasurementUnit {
  return ['g', 'kg', 'mL', 'L', 'pcs', 'packs'].includes(value);
}
