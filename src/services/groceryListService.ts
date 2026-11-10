import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from './supabaseDataCompat';
import { getSupabaseServices } from './supabaseClient';
import { getSupabaseErrorMessage } from './supabaseErrors';
import { foodInventoryUpdatedEventName } from './foodInventoryService';
import { inventoryMovementUpdatedEventName } from './foodConsumptionService';
import {
  groceryCategories,
  inventoryCategoryForGrocery,
  isGroceryMeasurementUnit,
  validateGroceryDraft,
  type GroceryItem,
  type GroceryItemDraft,
  type GroceryStatus,
} from '../utils/groceryList';
import {
  measurementUnits,
  type MeasurementUnit,
} from '../utils/foodInventory';
import { quantityInInventoryUnit } from '../utils/inventoryDeduction';

export const groceryListUpdatedEventName = 'grocery-list-updated';

export interface GroceryRestockDraft {
  quantity: number;
  unit: MeasurementUnit;
  purchaseDate: string;
  expirationDate: string;
  storageLocation: string;
  inventoryItemId: string | null;
}

function userCollection(userId: string) {
  return collection(getSupabaseServices().db, 'users', userId, 'groceryItems');
}

function assertAuthenticatedUser(userId: string): void {
  if (!userId || getSupabaseServices().auth.currentUser?.uid !== userId) {
    throw new Error('Sign in again before changing your grocery list.');
  }
}

function notifyGroceryListChanged(userId: string): void {
  window.dispatchEvent(new CustomEvent(groceryListUpdatedEventName, { detail: { userId } }));
}

function notifyInventoryRestocked(userId: string): void {
  notifyGroceryListChanged(userId);
  window.dispatchEvent(new CustomEvent(foodInventoryUpdatedEventName, { detail: { userId } }));
  window.dispatchEvent(new CustomEvent(inventoryMovementUpdatedEventName, { detail: { userId } }));
}

function describeError(action: string, error: unknown): Error {
  if (error instanceof Error && (
    error.message.startsWith('Insufficient inventory.')
    || error.message.startsWith('Cannot deduct ')
    || error.message.startsWith('Grocery item ')
    || error.message.startsWith('Only purchased')
    || error.message.startsWith('This purchase')
    || error.message.startsWith('The selected inventory')
    || error.message.startsWith('Purchased quantity ')
  )) return error;

  const detail = getSupabaseErrorMessage(error);
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (
    code === '42501'
    || code === 'permission-denied'
    || detail.toLocaleLowerCase().includes('missing or insufficient permissions')
    || detail.toLocaleLowerCase().includes('row-level security')
  ) {
    const projectId = getSupabaseServices().app.options.projectId ?? 'unknown';
    return new Error(
      `Supabase denied access to ${action} in project "${projectId}". Check that the SQL migration and RLS policies are applied.`,
    );
  }
  return new Error(`Unable to ${action}: ${detail}`);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

function parseTimestamp(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value
    && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === 'string' ? value : null;
}

function parseGroceryItem(id: string, data: Record<string, unknown>): GroceryItem {
  const unitValue = typeof data.unit === 'string' ? data.unit : '';
  const restockedUnitValue = typeof data.restockedUnit === 'string' ? data.restockedUnit : '';
  const unit: MeasurementUnit = isGroceryMeasurementUnit(unitValue) ? unitValue : 'pcs';
  const restockedUnit: MeasurementUnit | null = isGroceryMeasurementUnit(restockedUnitValue)
    ? restockedUnitValue
    : null;
  return {
    id,
    shoppingListId: String(data.shoppingListId ?? 'default'),
    inventoryItemId: typeof data.inventoryItemId === 'string' ? data.inventoryItemId : null,
    name: String(data.name ?? ''),
    category: groceryCategories.includes(data.category as GroceryItem['category'])
      ? data.category as GroceryItem['category']
      : 'Others',
    quantity: Number(data.quantity ?? 0),
    unit,
    status: ['PENDING', 'PURCHASED', 'CANCELLED'].includes(String(data.status))
      ? data.status as GroceryStatus
      : 'PENDING',
    source: ['MANUAL', 'LOW_STOCK', 'OUT_OF_STOCK', 'WEEKLY_MEAL_PLAN'].includes(String(data.source))
      ? data.source as GroceryItem['source']
      : 'MANUAL',
    notes: String(data.notes ?? ''),
    createdAt: parseTimestamp(data.createdAt) ?? '',
    purchasedAt: parseTimestamp(data.purchasedAt),
    restockedAt: parseTimestamp(data.restockedAt),
    restockedInventoryItemId: typeof data.restockedInventoryItemId === 'string'
      ? data.restockedInventoryItemId
      : null,
    restockedQuantity: typeof data.restockedQuantity === 'number' ? data.restockedQuantity : null,
    restockedUnit,
  };
}

function validateDraft(draft: GroceryItemDraft): void {
  const errors = validateGroceryDraft(draft);
  const firstError = Object.values(errors)[0];
  if (firstError) throw new Error(firstError);
  if (draft.shoppingListId !== 'default') throw new Error('The shopping list is invalid.');
  if (draft.inventoryItemId !== null && !draft.inventoryItemId.trim()) {
    throw new Error('Choose a valid inventory item or leave it unlinked.');
  }
}

export async function listGroceryItems(userId: string): Promise<GroceryItem[]> {
  assertAuthenticatedUser(userId);
  try {
    const snapshot = await getDocs(userCollection(userId));
    return snapshot.docs.map((entry) => parseGroceryItem(entry.id, entry.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    throw describeError('load your grocery list', error);
  }
}

export async function createGroceryItem(userId: string, draft: GroceryItemDraft): Promise<string> {
  assertAuthenticatedUser(userId);
  validateDraft(draft);
  try {
    const created = await addDoc(userCollection(userId), {
      ...draft,
      name: draft.name.trim(),
      status: 'PENDING',
      purchasedAt: null,
      restockedAt: null,
      restockedInventoryItemId: null,
      restockedQuantity: null,
      restockedUnit: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    notifyGroceryListChanged(userId);
    return created.id;
  } catch (error) {
    throw describeError('add the grocery item', error);
  }
}

export async function updateGroceryItem(
  userId: string,
  id: string,
  draft: GroceryItemDraft,
): Promise<void> {
  assertAuthenticatedUser(userId);
  validateDraft(draft);
  try {
    await updateDoc(doc(getSupabaseServices().db, 'users', userId, 'groceryItems', id), {
      ...draft,
      name: draft.name.trim(),
      updatedAt: serverTimestamp(),
    });
    notifyGroceryListChanged(userId);
  } catch (error) {
    throw describeError('update the grocery item', error);
  }
}

export async function setGroceryStatus(
  userId: string,
  id: string,
  status: GroceryStatus,
): Promise<void> {
  assertAuthenticatedUser(userId);
  if (!['PENDING', 'PURCHASED', 'CANCELLED'].includes(status)) {
    throw new Error('Choose a valid shopping status.');
  }
  try {
    const reference = doc(getSupabaseServices().db, 'users', userId, 'groceryItems', id);
    const timestamp = status === 'PURCHASED' ? serverTimestamp() : null;
    await updateDoc(reference, {
      status,
      purchasedAt: timestamp,
      updatedAt: serverTimestamp(),
    });
    notifyGroceryListChanged(userId);
  } catch (error) {
    throw describeError('update the grocery status', error);
  }
}

export async function deleteGroceryItem(userId: string, id: string): Promise<void> {
  assertAuthenticatedUser(userId);
  try {
    await deleteDoc(doc(getSupabaseServices().db, 'users', userId, 'groceryItems', id));
    notifyGroceryListChanged(userId);
  } catch (error) {
    throw describeError('delete the grocery item', error);
  }
}

export async function restockPurchasedGroceryItem(
  userId: string,
  groceryItemId: string,
  draft: GroceryRestockDraft,
): Promise<string> {
  assertAuthenticatedUser(userId);
  if (!Number.isFinite(draft.quantity) || draft.quantity <= 0) {
    throw new Error('Purchased quantity must be greater than zero.');
  }
  if (!measurementUnits.includes(draft.unit)) throw new Error('Choose a supported inventory unit.');
  if (!isValidDate(draft.purchaseDate)) {
    throw new Error('Enter a valid purchase date.');
  }
  if (draft.expirationDate && !isValidDate(draft.expirationDate)) {
    throw new Error('Enter a valid expiration date.');
  }
  if (draft.purchaseDate && draft.expirationDate && draft.expirationDate < draft.purchaseDate) {
    throw new Error('Expiration date cannot be before purchase date.');
  }
  if (draft.storageLocation.trim().length > 100) {
    throw new Error('Storage location must be 100 characters or fewer.');
  }

  const { db } = getSupabaseServices();
  const groceryReference = doc(db, 'users', userId, 'groceryItems', groceryItemId);
  const newInventoryReference = draft.inventoryItemId
    ? null
    : doc(collection(db, 'users', userId, 'inventoryItems'));
  const movementReference = doc(db, 'users', userId, 'inventoryMovements', `restock-${groceryItemId}`);

  try {
    const inventoryItemId = await runTransaction(db, async (transaction) => {
      const grocerySnapshot = await transaction.get(groceryReference);
      if (!grocerySnapshot.exists()) throw new Error('Grocery item was not found. Refresh and try again.');
      const groceryData = grocerySnapshot.data();
      if (groceryData.status !== 'PURCHASED') throw new Error('Only purchased grocery items can be restocked.');
      if (groceryData.restockedAt) throw new Error('This purchase has already been added to inventory.');

      const existingInventoryReference = draft.inventoryItemId
        ? doc(db, 'users', userId, 'inventoryItems', draft.inventoryItemId)
        : null;
      const inventoryReference = existingInventoryReference ?? newInventoryReference;
      if (!inventoryReference) throw new Error('Choose an inventory destination.');

      if (existingInventoryReference) {
        const inventorySnapshot = await transaction.get(existingInventoryReference);
        if (!inventorySnapshot.exists()) {
          throw new Error('The selected inventory item was not found. Refresh and try again.');
        }
        const current = inventorySnapshot.data();
        const quantityToAdd = quantityInInventoryUnit(draft.quantity, draft.unit, current.unit as MeasurementUnit);
        if (typeof current.quantity !== 'number' || !Number.isFinite(current.quantity) || current.quantity < 0) {
          throw new Error('The selected inventory item has an invalid stock quantity.');
        }
        const quantityAfter = Number((current.quantity + quantityToAdd).toFixed(9));
        if (!Number.isFinite(quantityAfter)) {
          throw new Error('Purchased quantity is too large to add to inventory.');
        }
        transaction.update(existingInventoryReference, {
          quantity: quantityAfter,
          updatedAt: serverTimestamp(),
        });
        transaction.set(movementReference, {
          inventoryItemId: existingInventoryReference.id,
          groceryItemId: groceryItemId,
          movementType: 'MANUAL_RESTOCK',
          quantity: quantityToAdd,
          unit: current.unit,
          quantityBefore: current.quantity,
          quantityAfter,
          createdAt: serverTimestamp(),
        });
        transaction.update(groceryReference, {
          restockedAt: serverTimestamp(),
          restockedInventoryItemId: existingInventoryReference.id,
          restockedQuantity: draft.quantity,
          restockedUnit: draft.unit,
          purchaseDate: draft.purchaseDate,
          updatedAt: serverTimestamp(),
        });
        return existingInventoryReference.id;
      }

      const category = inventoryCategoryForGrocery(groceryData.category);
      transaction.set(inventoryReference, {
        foodName: String(groceryData.name).trim(),
        normalizedName: String(groceryData.name).trim().toLocaleLowerCase(),
        category,
        quantity: draft.quantity,
        unit: draft.unit,
        lowStockThreshold: 0,
        purchaseDate: draft.purchaseDate,
        expirationDate: draft.expirationDate,
        storageLocation: draft.storageLocation.trim(),
        notes: String(groceryData.notes ?? ''),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.set(movementReference, {
        inventoryItemId: inventoryReference.id,
        groceryItemId,
        movementType: 'MANUAL_RESTOCK',
        quantity: draft.quantity,
        unit: draft.unit,
        quantityBefore: 0,
        quantityAfter: draft.quantity,
        createdAt: serverTimestamp(),
      });
      transaction.update(groceryReference, {
        restockedAt: serverTimestamp(),
        restockedInventoryItemId: inventoryReference.id,
        restockedQuantity: draft.quantity,
        restockedUnit: draft.unit,
        purchaseDate: draft.purchaseDate,
        updatedAt: serverTimestamp(),
      });
      return inventoryReference.id;
    });
    notifyInventoryRestocked(userId);
    return inventoryItemId;
  } catch (error) {
    throw describeError('restock inventory from this purchase', error);
  }
}
