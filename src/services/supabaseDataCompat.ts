import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';

export type DocumentData = Record<string, any>;

interface CollectionReference {
  userId: string;
  collectionName: string;
}

export interface DocumentReference extends CollectionReference {
  id: string;
}

interface StoredDocument {
  id: string;
  payload: DocumentData;
}

interface QueryFilter {
  field: string;
  value: unknown;
}

interface QueryOrder {
  field: string;
  direction: 'asc' | 'desc';
}

interface QueryReference extends CollectionReference {
  filters: QueryFilter[];
  orders: QueryOrder[];
}

interface PendingChange {
  collection_name: string;
  record_id: string;
  operation: 'upsert' | 'delete';
  payload?: DocumentData;
}

interface ExpectedRecord {
  collection_name: string;
  record_id: string;
  exists: boolean;
  payload?: DocumentData;
}

const deleteFieldToken = Symbol('delete-field');
const equalityToken = Symbol('equality-filter');

export function serverTimestamp(): string {
  return new Date().toISOString();
}

export function deleteField(): typeof deleteFieldToken {
  return deleteFieldToken;
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function collectionFromPath(path: unknown[]): CollectionReference {
  const parts = path.slice(1).map(String);
  if (parts.length !== 3 || parts[0] !== 'users') {
    throw new Error('Unsupported Supabase data path.');
  }
  return { userId: parts[1], collectionName: parts[2] };
}

function documentFromPath(path: unknown[]): DocumentReference {
  const parts = path.slice(1).map(String);
  if (parts.length !== 4 || parts[0] !== 'users') {
    throw new Error('Unsupported Supabase document path.');
  }
  return { userId: parts[1], collectionName: parts[2], id: parts[3] };
}

export function collection(_client: SupabaseClient, ...path: string[]): CollectionReference {
  return collectionFromPath([_client, ...path]);
}

export function doc(
  parent: SupabaseClient | CollectionReference,
  ...path: string[]
): DocumentReference {
  if ('userId' in parent) {
    if (path.length > 1) throw new Error('Unsupported Supabase document path.');
    return { ...parent, id: path[0] ?? makeId() };
  }
  return documentFromPath([parent, ...path]);
}

export function where(field: string, operation: string, value: unknown) {
  if (operation !== '==') throw new Error('Only equality filters are supported.');
  return { type: equalityToken, field, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'order' as const, field, direction };
}

export function query(
  source: CollectionReference | QueryReference,
  ...constraints: Array<ReturnType<typeof where> | ReturnType<typeof orderBy>>
): QueryReference {
  const filters = 'filters' in source ? [...source.filters] : [];
  const orders = 'orders' in source ? [...source.orders] : [];
  for (const constraint of constraints) {
    if ('value' in constraint) {
      filters.push({ field: constraint.field, value: constraint.value });
    } else {
      orders.push({ field: constraint.field, direction: constraint.direction });
    }
  }
  return { userId: source.userId, collectionName: source.collectionName, filters, orders };
}

export class DocumentSnapshot<T extends DocumentData = DocumentData> {
  constructor(
    private readonly record: StoredDocument | null,
    private readonly fallbackId = '',
  ) {}

  get id(): string {
    return this.record?.id ?? this.fallbackId;
  }

  exists(): boolean {
    return this.record !== null;
  }

  data(): T {
    return (this.record ? structuredClone(this.record.payload) : {}) as T;
  }
}

class SupabaseQuerySnapshot {
  constructor(readonly docs: DocumentSnapshot[]) {}
}

async function fetchRecords(reference: CollectionReference): Promise<StoredDocument[]> {
  const { data, error } = await getSupabaseClient()
    .from('user_data')
    .select('record_id,payload')
    .eq('user_id', reference.userId)
    .eq('collection_name', reference.collectionName);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.record_id as string,
    payload: row.payload as DocumentData,
  }));
}

async function fetchRecord(reference: DocumentReference): Promise<StoredDocument | null> {
  const { data, error } = await getSupabaseClient()
    .from('user_data')
    .select('record_id,payload')
    .eq('user_id', reference.userId)
    .eq('collection_name', reference.collectionName)
    .eq('record_id', reference.id)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.record_id, payload: data.payload as DocumentData } : null;
}

function applyPatch(previous: DocumentData, patch: DocumentData): DocumentData {
  const next = { ...previous };
  for (const [key, value] of Object.entries(patch)) {
    if (value === deleteFieldToken) delete next[key];
    else next[key] = value;
  }
  return next;
}

async function commitChanges(
  changes: PendingChange[],
  expectations: ExpectedRecord[] = [],
): Promise<void> {
  if (changes.length === 0) return;
  const { error } = await getSupabaseClient().rpc('apply_user_data_changes', {
    p_changes: changes,
    p_expectations: expectations,
  });
  if (error) {
    if (error.code === '40001') {
      throw new Error('Your data changed in another request. Refresh and try again.');
    }
    throw error;
  }
}

export async function getDoc(reference: DocumentReference): Promise<DocumentSnapshot> {
  return new DocumentSnapshot(await fetchRecord(reference), reference.id);
}

export async function getDocs(
  source: CollectionReference | QueryReference,
): Promise<SupabaseQuerySnapshot> {
  const records = await fetchRecords(source);
  const filters = 'filters' in source ? source.filters : [];
  const orders = 'orders' in source ? source.orders : [];
  const matching = records.filter((record) => filters.every(({ field, value }) =>
    record.payload[field] === value));
  matching.sort((left, right) => {
    for (const order of orders) {
      const a = left.payload[order.field];
      const b = right.payload[order.field];
      const compared = String(a ?? '').localeCompare(String(b ?? ''));
      if (compared) return order.direction === 'desc' ? -compared : compared;
    }
    return 0;
  });
  return new SupabaseQuerySnapshot(matching.map((record) => new DocumentSnapshot(record)));
}

export async function addDoc(
  reference: CollectionReference,
  payload: DocumentData,
): Promise<DocumentReference> {
  const document = { ...reference, id: makeId() };
  await commitChanges([{
    collection_name: document.collectionName,
    record_id: document.id,
    operation: 'upsert',
    payload,
  }]);
  return document;
}

export async function setDoc(
  reference: DocumentReference,
  payload: DocumentData,
  options?: { merge?: boolean },
): Promise<void> {
  if (!options?.merge) {
    await commitChanges([{
      collection_name: reference.collectionName,
      record_id: reference.id,
      operation: 'upsert',
      payload,
    }]);
    return;
  }
  const existing = await fetchRecord(reference);
  await commitChanges([{
    collection_name: reference.collectionName,
    record_id: reference.id,
    operation: 'upsert',
    payload: applyPatch(existing?.payload ?? {}, payload),
  }], [{
    collection_name: reference.collectionName,
    record_id: reference.id,
    exists: Boolean(existing),
    ...(existing ? { payload: existing.payload } : {}),
  }]);
}

export async function updateDoc(reference: DocumentReference, patch: DocumentData): Promise<void> {
  const existing = await fetchRecord(reference);
  if (!existing) throw new Error('The selected record no longer exists. Refresh and try again.');
  await commitChanges([{
    collection_name: reference.collectionName,
    record_id: reference.id,
    operation: 'upsert',
    payload: applyPatch(existing.payload, patch),
  }], [{
    collection_name: reference.collectionName,
    record_id: reference.id,
    exists: true,
    payload: existing.payload,
  }]);
}

export async function deleteDoc(reference: DocumentReference): Promise<void> {
  const existing = await fetchRecord(reference);
  await commitChanges([{
    collection_name: reference.collectionName,
    record_id: reference.id,
    operation: 'delete',
  }], [{
    collection_name: reference.collectionName,
    record_id: reference.id,
    exists: Boolean(existing),
    ...(existing ? { payload: existing.payload } : {}),
  }]);
}

export interface Transaction {
  get(reference: DocumentReference): Promise<DocumentSnapshot>;
  set(reference: DocumentReference, payload: DocumentData): void;
  update(reference: DocumentReference, patch: DocumentData): void;
  delete(reference: DocumentReference): void;
}

export async function runTransaction<T>(
  _client: SupabaseClient,
  callback: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  const changes = new Map<string, PendingChange>();
  const snapshots = new Map<string, StoredDocument | null>();
  const keyFor = (reference: DocumentReference) =>
    `${reference.collectionName}\u0000${reference.id}`;
  const transaction: Transaction = {
    async get(reference) {
      const key = keyFor(reference);
      if (!snapshots.has(key)) snapshots.set(key, await fetchRecord(reference));
      return new DocumentSnapshot(snapshots.get(key) ?? null, reference.id);
    },
    set(reference, payload) {
      changes.set(keyFor(reference), {
        collection_name: reference.collectionName,
        record_id: reference.id,
        operation: 'upsert',
        payload,
      });
    },
    update(reference, patch) {
      const key = keyFor(reference);
      const existing = snapshots.get(key);
      if (!existing) throw new Error('A transaction must read a record before updating it.');
      changes.set(key, {
        collection_name: reference.collectionName,
        record_id: reference.id,
        operation: 'upsert',
        payload: applyPatch(existing.payload, patch),
      });
    },
    delete(reference) {
      changes.set(keyFor(reference), {
        collection_name: reference.collectionName,
        record_id: reference.id,
        operation: 'delete',
      });
    },
  };
  const result = await callback(transaction);
  const expectations: ExpectedRecord[] = [];
  for (const [key, record] of snapshots) {
    const [collectionName, recordId] = key.split('\u0000');
    expectations.push({
      collection_name: collectionName,
      record_id: recordId,
      exists: Boolean(record),
      ...(record ? { payload: record.payload } : {}),
    });
  }
  await commitChanges([...changes.values()], expectations);
  return result;
}
