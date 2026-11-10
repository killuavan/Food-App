import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from './supabaseDataCompat';
import { getSupabaseServices } from './supabaseClient';
import { getSupabaseErrorMessage } from './supabaseErrors';
import type { FoodItem, FoodItemDraft } from '../utils/foodInventory';

export const foodInventoryUpdatedEventName = 'food-inventory-updated';
export const inventoryMovementUpdatedEventName = 'inventory-movement-updated';

function notifyInventoryChanged(userId: string): void {
  window.dispatchEvent(new CustomEvent(foodInventoryUpdatedEventName, { detail: { userId } }));
  window.dispatchEvent(new CustomEvent(inventoryMovementUpdatedEventName, { detail: { userId } }));
}

export class DuplicateFoodItemError extends Error {
  constructor(foodName: string) {
    super(`An inventory item named "${foodName}" already exists. Edit the existing item instead.`);
    this.name = 'DuplicateFoodItemError';
  }
}

function getInventoryCollection(userId: string) {
  const { db } = getSupabaseServices();
  return collection(db, 'users', userId, 'inventoryItems');
}

function normalizeFoodName(foodName: string): string {
  return foodName.trim().toLocaleLowerCase();
}

function describeFirestoreError(action: string, error: unknown): Error {
  const detail = getSupabaseErrorMessage(error);
  const code = error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : '';
  if (
    code === '42501'
    || code === 'permission-denied'
    || detail.includes('permission-denied')
    || detail.toLocaleLowerCase().includes('missing or insufficient permissions')
    || detail.toLocaleLowerCase().includes('row-level security')
  ) {
    const projectId = getSupabaseServices().app.options.projectId ?? 'unknown';
    return new Error(
      `Supabase denied access while trying to ${action} in project "${projectId}". `
      + 'Check that the Supabase SQL migration is applied and Row Level Security is enabled for your signed-in user.',
    );
  }
  return new Error(`Unable to ${action}: ${detail}`);
}

export async function listFoodItems(userId: string): Promise<FoodItem[]> {
  try {
    const snapshot = await getDocs(getInventoryCollection(userId));
    return snapshot.docs.map((entry) => {
      const data = entry.data();
      const createdAt = typeof data.createdAt === 'string' ? data.createdAt : data.createdAt?.toDate?.().toISOString() ?? '';
      const updatedAt = typeof data.updatedAt === 'string' ? data.updatedAt : data.updatedAt?.toDate?.().toISOString() ?? '';
      return {
        id: entry.id,
        foodName: data.foodName,
        category: data.category,
        quantity: data.quantity,
        unit: data.unit,
        lowStockThreshold: data.lowStockThreshold,
        purchaseDate: data.purchaseDate ?? '',
        expirationDate: typeof data.expirationDate === 'string' ? data.expirationDate : '',
        storageLocation: data.storageLocation ?? '',
        notes: data.notes ?? '',
        nutritionProfile: data.nutritionProfile ?? null,
        barcode: typeof data.barcode === 'string' ? data.barcode : '',
        brand: typeof data.brand === 'string' ? data.brand : '',
        productImageUrl: typeof data.productImageUrl === 'string' ? data.productImageUrl : '',
        createdAt,
        updatedAt,
      } satisfies FoodItem;
    });
  } catch (error) {
    throw describeFirestoreError('load your food inventory', error);
  }
}

async function ensureUniqueName(userId: string, foodName: string, exceptId?: string): Promise<void> {
  const normalizedName = normalizeFoodName(foodName);
  const matches = await getDocs(query(
    getInventoryCollection(userId),
    where('normalizedName', '==', normalizedName),
  ));
  if (matches.docs.some((entry) => entry.id !== exceptId)) throw new DuplicateFoodItemError(foodName.trim());
}

export async function createFoodItem(userId: string, draft: FoodItemDraft): Promise<void> {
  try {
    await ensureUniqueName(userId, draft.foodName);
    const { nutritionProfile, ...foodFields } = draft;
    await addDoc(getInventoryCollection(userId), {
      ...foodFields,
      foodName: draft.foodName.trim(),
      normalizedName: normalizeFoodName(draft.foodName),
      ...(draft.barcode ? { barcode: draft.barcode } : {}),
      ...(draft.brand ? { brand: draft.brand } : {}),
      ...(draft.productImageUrl ? { productImageUrl: draft.productImageUrl } : {}),
      ...(nutritionProfile ? { nutritionProfile } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    notifyInventoryChanged(userId);
  } catch (error) {
    if (error instanceof DuplicateFoodItemError) throw error;
    throw describeFirestoreError('save the food item', error);
  }
}

export async function updateFoodItem(
  userId: string,
  id: string,
  draft: FoodItemDraft,
): Promise<void> {
  try {
    await ensureUniqueName(userId, draft.foodName, id);
    const { nutritionProfile, ...foodFields } = draft;
    const { db } = getSupabaseServices();
    const inventoryReference = doc(db, 'users', userId, 'inventoryItems', id);
    const movementReference = doc(collection(db, 'users', userId, 'inventoryMovements'));
    await runTransaction(db, async (transaction) => {
      const current = await transaction.get(inventoryReference);
      if (!current.exists()) throw new Error('This inventory item no longer exists. Refresh and try again.');
      const currentData = current.data();
      const shouldRecordRestock = currentData.unit === draft.unit
        && typeof currentData.quantity === 'number'
        && draft.quantity > currentData.quantity;

      transaction.update(inventoryReference, {
        ...foodFields,
        foodName: draft.foodName.trim(),
        normalizedName: normalizeFoodName(draft.foodName),
        barcode: draft.barcode || deleteField(),
        brand: draft.brand || deleteField(),
        productImageUrl: draft.productImageUrl || deleteField(),
        nutritionProfile: nutritionProfile ?? deleteField(),
        updatedAt: serverTimestamp(),
      });

      if (shouldRecordRestock) {
        transaction.set(movementReference, {
          inventoryItemId: id,
          movementType: 'MANUAL_RESTOCK',
          quantity: draft.quantity - currentData.quantity,
          unit: draft.unit,
          quantityBefore: currentData.quantity,
          quantityAfter: draft.quantity,
          createdAt: serverTimestamp(),
        });
      }
    });
    notifyInventoryChanged(userId);
  } catch (error) {
    if (error instanceof DuplicateFoodItemError) throw error;
    throw describeFirestoreError('update the food item', error);
  }
}

export async function linkNutritionProfile(
  userId: string,
  id: string,
  nutritionProfile: NonNullable<FoodItem['nutritionProfile']>,
): Promise<void> {
  try {
    await updateDoc(doc(getSupabaseServices().db, 'users', userId, 'inventoryItems', id), {
      nutritionProfile,
      updatedAt: serverTimestamp(),
    });
    notifyInventoryChanged(userId);
  } catch (error) {
    throw describeFirestoreError('link USDA nutrition to the food item', error);
  }
}

export async function deleteFoodItem(userId: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(getSupabaseServices().db, 'users', userId, 'inventoryItems', id));
    notifyInventoryChanged(userId);
  } catch (error) {
    throw describeFirestoreError('delete the food item', error);
  }
}
