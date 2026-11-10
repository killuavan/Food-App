import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Transaction,
} from './supabaseDataCompat';
import { getSupabaseClient, getSupabaseServices } from './supabaseClient';
import { getSupabaseErrorMessage } from './supabaseErrors';
import {
  validateFoodConsumptionDraft,
  type FoodConsumption,
  type FoodConsumptionDraft,
} from '../utils/foodConsumption';
import { foodCategories, measurementUnits, type MeasurementUnit } from '../utils/foodInventory';
import { calculateInventoryAfterMovement, quantityInInventoryUnit } from '../utils/inventoryDeduction';

export const foodConsumptionUpdatedEventName = 'food-consumption-updated';
export const inventoryMovementUpdatedEventName = 'inventory-movement-updated';

export type MovementType =
  | 'CONSUMPTION'
  | 'CONSUMPTION_ADJUSTMENT'
  | 'CONSUMPTION_REVERSAL'
  | 'MANUAL_RESTOCK';

export interface InventoryMovement {
  id: string;
  inventoryItemId: string;
  consumptionLogId?: string | null;
  groceryItemId?: string | null;
  movementType: MovementType;
  quantity: number;
  unit: MeasurementUnit;
  quantityBefore: number | null;
  quantityAfter: number | null;
  inventoryItemMissing?: boolean;
  createdAt: string;
}

interface DeductionMarker {
  inventoryItemId: string;
  quantity: number;
  unit: MeasurementUnit;
  revision: number;
}

function notifyUserDataChanged(userId: string): void {
  window.dispatchEvent(new CustomEvent(foodConsumptionUpdatedEventName, { detail: { userId } }));
  window.dispatchEvent(new CustomEvent('food-inventory-updated', { detail: { userId } }));
  window.dispatchEvent(new CustomEvent(inventoryMovementUpdatedEventName, { detail: { userId } }));
}

function getUserCollection(userId: string, collectionName: string) {
  return collection(getSupabaseServices().db, 'users', userId, collectionName);
}

function assertAuthenticatedUser(userId: string): void {
  if (!userId || getSupabaseServices().auth.currentUser?.uid !== userId) {
    throw new Error('Sign in again before changing your food logs or inventory.');
  }
}

function describeFirestoreError(action: string, error: unknown): Error {
  if (error instanceof Error && (
    error.message.startsWith('Insufficient inventory.')
    || error.message.startsWith('Cannot deduct ')
    || error.message.startsWith('Inventory item ')
    || error.message.startsWith('The selected inventory')
    || error.message.startsWith('This item expired')
    || error.message.startsWith('Consumed quantity ')
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

function validateRecord(draft: FoodConsumptionDraft): void {
  const errors = validateFoodConsumptionDraft(draft);
  const invalidField = Object.values(errors)[0];
  if (invalidField) throw new Error(invalidField);
  if (!foodCategories.includes(draft.foodCategory)) throw new Error('The selected food category is invalid.');
  if (!measurementUnits.includes(draft.inventoryUnit)) throw new Error('The inventory measurement unit is invalid.');
}

function toFoodConsumption(id: string, data: Record<string, unknown>): FoodConsumption {
  const toIso = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'toDate' in value) {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    return '';
  };
  const createdAt = toIso(data.createdAt);
  const updatedAt = toIso(data.updatedAt);
  const marker = data.inventoryDeduction as DeductionMarker | null | undefined;
  return {
    id,
    inventoryItemId: String(data.inventoryItemId ?? ''),
    foodName: String(data.foodName ?? ''),
    foodCategory: data.foodCategory as FoodConsumption['foodCategory'],
    inventoryUnit: data.inventoryUnit as FoodConsumption['inventoryUnit'],
    mealCategory: data.mealCategory as FoodConsumption['mealCategory'],
    quantityConsumed: Number(data.quantityConsumed),
    measurementUnit: data.measurementUnit as FoodConsumption['measurementUnit'],
    consumptionDate: String(data.consumptionDate ?? ''),
    consumptionTime: String(data.consumptionTime ?? ''),
    notes: String(data.notes ?? ''),
    nutritionSnapshot: (data.nutritionSnapshot as FoodConsumption['nutritionSnapshot']) ?? null,
    inventoryDeduction: marker ?? null,
    createdAt,
    updatedAt,
  };
}

export async function listFoodConsumptions(userId: string): Promise<FoodConsumption[]> {
  try {
    const snapshot = await getDocs(getUserCollection(userId, 'consumptionLogs'));
    return snapshot.docs.map((entry) => toFoodConsumption(entry.id, entry.data()));
  } catch (error) {
    throw describeFirestoreError('load your food consumption history', error);
  }
}

export async function listFoodConsumptionsInRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<FoodConsumption[]> {
  const pageSize = 500;
  const records: FoodConsumption[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await getSupabaseClient()
      .from('user_data')
      .select('record_id,payload')
      .eq('user_id', userId)
      .eq('collection_name', 'consumptionLogs')
      .gte('payload->>consumptionDate', startDate)
      .lte('payload->>consumptionDate', endDate)
      .order('record_id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw describeFirestoreError('load food consumption reports', error);
    const page = data ?? [];
    records.push(...page.map((row) => toFoodConsumption(row.record_id, row.payload as Record<string, unknown>)));
    if (page.length < pageSize) break;
  }
  return records;
}

export async function listInventoryMovements(userId: string, inventoryItemId: string): Promise<InventoryMovement[]> {
  try {
    const snapshot = await getDocs(query(
      getUserCollection(userId, 'inventoryMovements'),
      where('inventoryItemId', '==', inventoryItemId),
    ));
    return snapshot.docs.map((entry) => {
      const data = entry.data();
      return parseInventoryMovement(entry.id, data);
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    throw describeFirestoreError('load inventory movement history', error);
  }
}

export async function listInventoryMovementsInRange(
  userId: string,
  start: Date,
  endExclusive: Date,
): Promise<InventoryMovement[]> {
  const pageSize = 500;
  const records: InventoryMovement[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await getSupabaseClient()
      .from('user_data')
      .select('record_id,payload')
      .eq('user_id', userId)
      .eq('collection_name', 'inventoryMovements')
      .gte('payload->>createdAt', start.toISOString())
      .lt('payload->>createdAt', endExclusive.toISOString())
      .order('record_id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw describeFirestoreError('load inventory movement reports', error);
    const page = data ?? [];
    records.push(...page.map((row) => parseInventoryMovement(row.record_id, row.payload as Record<string, unknown>)));
    if (page.length < pageSize) break;
  }
  return records;
}

export async function listAllInventoryMovements(userId: string): Promise<InventoryMovement[]> {
  try {
    const snapshot = await getDocs(getUserCollection(userId, 'inventoryMovements'));
    return snapshot.docs.map((entry) => parseInventoryMovement(entry.id, entry.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    throw describeFirestoreError('load inventory movement history', error);
  }
}

function parseInventoryMovement(id: string, data: Record<string, unknown>): InventoryMovement {
  const timestamp = data.createdAt;
  const createdAt = typeof timestamp === 'string'
    ? timestamp
    : (timestamp as { toDate?: () => Date } | undefined)?.toDate?.().toISOString() ?? '';
  return {
    id,
    inventoryItemId: String(data.inventoryItemId),
    consumptionLogId: typeof data.consumptionLogId === 'string' ? data.consumptionLogId : null,
    groceryItemId: typeof data.groceryItemId === 'string' ? data.groceryItemId : null,
    movementType: data.movementType as MovementType,
    quantity: Number(data.quantity),
    unit: data.unit as MeasurementUnit,
    quantityBefore: typeof data.quantityBefore === 'number' ? data.quantityBefore : null,
    quantityAfter: typeof data.quantityAfter === 'number' ? data.quantityAfter : null,
    inventoryItemMissing: data.inventoryItemMissing === true,
    createdAt,
  };
}

function makeMovement(
  transaction: Transaction,
  userId: string,
  id: string,
  value: Omit<InventoryMovement, 'id' | 'createdAt'>,
): void {
  const reference = doc(getUserCollection(userId, 'inventoryMovements'), id);
  transaction.set(reference, { ...value, createdAt: serverTimestamp() });
}

function ensureEligibleItem(data: DocumentData, consumptionDate: string): void {
  if (typeof data.quantity !== 'number' || !Number.isFinite(data.quantity) || data.quantity < 0) {
    throw new Error('Inventory item has an invalid stock quantity.');
  }
  if (typeof data.expirationDate === 'string' && data.expirationDate && data.expirationDate < consumptionDate) {
    throw new Error('This item expired before the consumption date. Select a non-expired inventory item.');
  }
}

function toCurrentUnit(
  quantity: number,
  fromUnit: MeasurementUnit,
  toUnit: MeasurementUnit,
): number {
  return quantityInInventoryUnit(quantity, fromUnit, toUnit);
}

export async function createFoodConsumption(userId: string, draft: FoodConsumptionDraft): Promise<string> {
  validateRecord(draft);
  assertAuthenticatedUser(userId);
  try {
    const services = getSupabaseServices();

    if (draft.inventoryItemId.startsWith('off:')) {
      const created = await addDoc(getUserCollection(userId, 'consumptionLogs'), {
        ...draft,
        foodName: draft.foodName.trim(),
        notes: draft.notes.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      notifyUserDataChanged(userId);
      return created.id;
    }

    const logReference = doc(getUserCollection(userId, 'consumptionLogs'));
    const inventoryReference = doc(getUserCollection(userId, 'inventoryItems'), draft.inventoryItemId);
    await runTransaction(services.db, async (transaction) => {
      const inventorySnapshot = await transaction.get(inventoryReference);
      if (!inventorySnapshot.exists()) throw new Error('Inventory item was not found. Refresh inventory and try again.');
      const inventoryData = inventorySnapshot.data();
      ensureEligibleItem(inventoryData, draft.consumptionDate);
      const itemUnit = inventoryData.unit as MeasurementUnit;
      const consumedQuantity = quantityInInventoryUnit(draft.quantityConsumed, draft.measurementUnit, itemUnit);
      const quantityAfter = calculateInventoryAfterMovement(inventoryData.quantity, consumedQuantity, 0, itemUnit);
      const marker: DeductionMarker = {
        inventoryItemId: draft.inventoryItemId,
        quantity: consumedQuantity,
        unit: itemUnit,
        revision: 1,
      };

      transaction.update(inventoryReference, { quantity: quantityAfter, updatedAt: serverTimestamp() });
      transaction.set(logReference, {
        ...draft,
        foodName: String(inventoryData.foodName),
        foodCategory: inventoryData.category,
        inventoryUnit: itemUnit,
        nutritionSnapshot: inventoryData.nutritionProfile ?? null,
        inventoryDeduction: marker,
        notes: draft.notes.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      makeMovement(transaction, userId, `consumption-${logReference.id}`, {
        inventoryItemId: draft.inventoryItemId,
        consumptionLogId: logReference.id,
        movementType: 'CONSUMPTION',
        quantity: consumedQuantity,
        unit: itemUnit,
        quantityBefore: inventoryData.quantity,
        quantityAfter,
      });
    });
    notifyUserDataChanged(userId);
    return logReference.id;
  } catch (error) {
    throw describeFirestoreError('save the food consumption record and update inventory', error);
  }
}

export async function updateFoodConsumption(
  userId: string,
  id: string,
  draft: FoodConsumptionDraft,
): Promise<void> {
  validateRecord(draft);
  assertAuthenticatedUser(userId);
  try {
    const services = getSupabaseServices();
    const logReference = doc(getUserCollection(userId, 'consumptionLogs'), id);
    const targetIsLinked = !draft.inventoryItemId.startsWith('off:');
    const targetReference = targetIsLinked
      ? doc(getUserCollection(userId, 'inventoryItems'), draft.inventoryItemId)
      : null;

    await runTransaction(services.db, async (transaction) => {
      const logSnapshot = await transaction.get(logReference);
      if (!logSnapshot.exists()) throw new Error('The selected food consumption record no longer exists.');
      const oldData = logSnapshot.data();
      const oldMarker = oldData.inventoryDeduction as DeductionMarker | null | undefined;
      const oldItemId = oldMarker?.inventoryItemId ?? null;
      const oldItemReference = oldItemId
        ? doc(getUserCollection(userId, 'inventoryItems'), oldItemId)
        : null;
      const referenceMap = new Map<string, DocumentReference>(
        [oldItemReference, targetReference].filter((reference): reference is DocumentReference => reference !== null)
          .map((reference) => [reference.id, reference]),
      );
      const itemSnapshots = new Map<string, DocumentSnapshot<DocumentData>>();
      for (const [itemId, reference] of referenceMap) {
        itemSnapshots.set(itemId, await transaction.get(reference));
      }

      const oldItemSnapshot = oldItemId ? itemSnapshots.get(oldItemId) : undefined;
      const targetSnapshot = targetReference ? itemSnapshots.get(draft.inventoryItemId) : undefined;
      if (targetReference && !targetSnapshot?.exists()) {
        throw new Error('The selected inventory item was not found. Refresh inventory and try again.');
      }

      const currentOldData = oldItemSnapshot?.exists() ? oldItemSnapshot.data() : null;
      const targetData = targetSnapshot?.exists() ? targetSnapshot.data() : null;
      if (targetData) ensureEligibleItem(targetData, draft.consumptionDate);

      const targetUnit = targetData?.unit as MeasurementUnit | undefined;
      const newConsumedQuantity = targetUnit
        ? quantityInInventoryUnit(draft.quantityConsumed, draft.measurementUnit, targetUnit)
        : null;
      const sameItem = Boolean(oldItemId && targetReference && oldItemId === draft.inventoryItemId);
      const oldRestoreQuantity = oldMarker && currentOldData
        ? toCurrentUnit(oldMarker.quantity, oldMarker.unit, currentOldData.unit as MeasurementUnit)
        : 0;
      const oldQuantityBefore = typeof currentOldData?.quantity === 'number' ? currentOldData.quantity : null;
      let nextMarker: DeductionMarker | null = null;
      const nextRevision = (oldMarker?.revision ?? 0) + 1;
      const operationChanged = oldMarker !== null && oldMarker !== undefined
        && (oldMarker.inventoryItemId !== draft.inventoryItemId
          || oldMarker.quantity !== newConsumedQuantity
          || oldMarker.unit !== targetUnit);

      if (targetData && targetUnit && newConsumedQuantity !== null) {
        const quantityAfter = calculateInventoryAfterMovement(
          targetData.quantity,
          newConsumedQuantity,
          sameItem ? oldRestoreQuantity : 0,
          targetUnit,
        );
        if (sameItem) {
          transaction.update(targetReference!, { quantity: quantityAfter, updatedAt: serverTimestamp() });
          if (operationChanged) {
            const delta = Math.abs(newConsumedQuantity - oldRestoreQuantity);
            if (delta > 0) {
              makeMovement(transaction, userId, `adjustment-${id}-${nextRevision}`, {
                inventoryItemId: draft.inventoryItemId,
                consumptionLogId: id,
                movementType: 'CONSUMPTION_ADJUSTMENT',
                quantity: delta,
                unit: targetUnit,
                quantityBefore: targetData.quantity,
                quantityAfter,
              });
            }
          }
        } else {
          transaction.update(targetReference!, { quantity: quantityAfter, updatedAt: serverTimestamp() });
          if (newConsumedQuantity > 0) {
            makeMovement(transaction, userId, `adjustment-${id}-${nextRevision}-deduct`, {
              inventoryItemId: draft.inventoryItemId,
              consumptionLogId: id,
              movementType: 'CONSUMPTION_ADJUSTMENT',
              quantity: newConsumedQuantity,
              unit: targetUnit,
              quantityBefore: targetData.quantity,
              quantityAfter,
            });
          }
        }
        nextMarker = {
          inventoryItemId: draft.inventoryItemId,
          quantity: newConsumedQuantity,
          unit: targetUnit,
          revision: oldMarker ? (operationChanged ? nextRevision : oldMarker.revision) : 1,
        };
      }

      if (oldMarker && !sameItem) {
        if (currentOldData && oldItemReference && oldRestoreQuantity > 0) {
          const restored = currentOldData.quantity + oldRestoreQuantity;
          transaction.update(oldItemReference, { quantity: restored, updatedAt: serverTimestamp() });
          makeMovement(transaction, userId, `adjustment-${id}-${nextRevision}-restore`, {
            inventoryItemId: oldMarker.inventoryItemId,
            consumptionLogId: id,
            movementType: 'CONSUMPTION_ADJUSTMENT',
            quantity: oldRestoreQuantity,
            unit: currentOldData.unit as MeasurementUnit,
            quantityBefore: oldQuantityBefore,
            quantityAfter: restored,
          });
        } else if (!currentOldData) {
          makeMovement(transaction, userId, `adjustment-${id}-${nextRevision}-missing`, {
            inventoryItemId: oldMarker.inventoryItemId,
            consumptionLogId: id,
            movementType: 'CONSUMPTION_REVERSAL',
            quantity: oldMarker.quantity,
            unit: oldMarker.unit,
            quantityBefore: null,
            quantityAfter: null,
            inventoryItemMissing: true,
          });
        }
      }

      const savedItemData = targetData ?? null;
      transaction.update(logReference, {
        ...draft,
        foodName: savedItemData ? String(savedItemData.foodName) : draft.foodName.trim(),
        foodCategory: savedItemData?.category ?? draft.foodCategory,
        inventoryUnit: targetUnit ?? draft.inventoryUnit,
        nutritionSnapshot: savedItemData
          ? oldData.inventoryItemId === draft.inventoryItemId
            ? oldData.nutritionSnapshot ?? null
            : savedItemData.nutritionProfile ?? null
          : draft.nutritionSnapshot ?? null,
        inventoryDeduction: nextMarker,
        notes: draft.notes.trim(),
        updatedAt: serverTimestamp(),
      });
    });
    notifyUserDataChanged(userId);
  } catch (error) {
    throw describeFirestoreError('update the food consumption record and inventory', error);
  }
}

export async function deleteFoodConsumption(userId: string, id: string): Promise<void> {
  assertAuthenticatedUser(userId);
  try {
    const services = getSupabaseServices();
    const logReference = doc(getUserCollection(userId, 'consumptionLogs'), id);
    await runTransaction(services.db, async (transaction) => {
      const logSnapshot = await transaction.get(logReference);
      if (!logSnapshot.exists()) return;
      const oldData = logSnapshot.data();
      const marker = oldData.inventoryDeduction as DeductionMarker | null | undefined;
      const inventoryReference = marker
        ? doc(getUserCollection(userId, 'inventoryItems'), marker.inventoryItemId)
        : null;
      const inventorySnapshot = inventoryReference ? await transaction.get(inventoryReference) : null;

      if (marker && inventoryReference) {
        if (inventorySnapshot?.exists()) {
          const inventoryData = inventorySnapshot.data();
          const restoreQuantity = toCurrentUnit(
            marker.quantity,
            marker.unit,
            inventoryData.unit as MeasurementUnit,
          );
          const quantityAfter = calculateInventoryAfterMovement(inventoryData.quantity, 0, restoreQuantity, inventoryData.unit as string);
          transaction.update(inventoryReference, { quantity: quantityAfter, updatedAt: serverTimestamp() });
          makeMovement(transaction, userId, `reversal-${id}`, {
            inventoryItemId: marker.inventoryItemId,
            consumptionLogId: id,
            movementType: 'CONSUMPTION_REVERSAL',
            quantity: restoreQuantity,
            unit: inventoryData.unit as MeasurementUnit,
            quantityBefore: inventoryData.quantity,
            quantityAfter,
          });
        } else {
          makeMovement(transaction, userId, `reversal-${id}`, {
            inventoryItemId: marker.inventoryItemId,
            consumptionLogId: id,
            movementType: 'CONSUMPTION_REVERSAL',
            quantity: marker.quantity,
            unit: marker.unit,
            quantityBefore: null,
            quantityAfter: null,
            inventoryItemMissing: true,
          });
        }
      }
      transaction.delete(logReference);
    });
    notifyUserDataChanged(userId);
  } catch (error) {
    throw describeFirestoreError('delete the food consumption record and restore inventory', error);
  }
}
