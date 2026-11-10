import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from './supabaseDataCompat';
import { getSupabaseClient, getSupabaseServices } from './supabaseClient';
import { getSupabaseErrorMessage } from './supabaseErrors';
import type { WeeklyMealPlan, MealRecommendation } from '../utils/weeklyMealRecommendations';

function plansCollection(userId: string) {
  return collection(getSupabaseServices().db, 'users', userId, 'weeklyMealPlans');
}

function favoritesCollection(userId: string) {
  return collection(getSupabaseServices().db, 'users', userId, 'weeklyMealFavorites');
}

function describeFirestoreError(action: string, error: unknown): Error {
  const detail = getSupabaseErrorMessage(error);
  if (detail.includes('42501') || detail.includes('permission-denied') || detail.toLocaleLowerCase().includes('row-level security')) {
    return new Error(`You do not have permission to ${action}. Check that the Supabase migration and RLS policies are applied.`);
  }
  return new Error(`Unable to ${action}: ${detail}`);
}

function timestampToIso(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === 'string' ? value : '';
}

function parsePlan(id: string, value: Record<string, unknown>): WeeklyMealPlan {
  return {
    id,
    weekStartDate: String(value.weekStartDate ?? ''),
    meals: Array.isArray(value.meals) ? value.meals as MealRecommendation[] : [],
    createdAt: timestampToIso(value.createdAt),
    updatedAt: timestampToIso(value.updatedAt),
  };
}

export async function listWeeklyMealPlans(userId: string): Promise<WeeklyMealPlan[]> {
  try {
    const snapshot = await getDocs(query(plansCollection(userId), orderBy('createdAt', 'desc')));
    return snapshot.docs.map((entry) => parsePlan(entry.id, entry.data())).slice(0, 20);
  } catch (error) {
    throw describeFirestoreError('load your saved weekly plans', error);
  }
}

export async function listWeeklyMealPlansInRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<WeeklyMealPlan[]> {
  const earliestWeekStart = new Date(`${startDate}T00:00:00.000Z`);
  earliestWeekStart.setUTCDate(earliestWeekStart.getUTCDate() - 6);
  const pageSize = 500;
  const plans: WeeklyMealPlan[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await getSupabaseClient()
      .from('user_data')
      .select('record_id,payload')
      .eq('user_id', userId)
      .eq('collection_name', 'weeklyMealPlans')
      .gte('payload->>weekStartDate', earliestWeekStart.toISOString().slice(0, 10))
      .lte('payload->>weekStartDate', endDate)
      .order('record_id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw describeFirestoreError('load your meal plan reports', error);
    const page = data ?? [];
    plans.push(...page.map((row) => parsePlan(row.record_id, row.payload as Record<string, unknown>)));
    if (page.length < pageSize) break;
  }
  return plans;
}

export async function saveWeeklyMealPlan(
  userId: string,
  plan: Omit<WeeklyMealPlan, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<WeeklyMealPlan> {
  try {
    const created = await addDoc(plansCollection(userId), {
      weekStartDate: plan.weekStartDate,
      meals: plan.meals,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const now = new Date().toISOString();
    return { ...plan, id: created.id, createdAt: now, updatedAt: now };
  } catch (error) {
    throw describeFirestoreError('save the weekly plan', error);
  }
}

export async function updateWeeklyMealPlan(
  userId: string,
  plan: WeeklyMealPlan,
): Promise<void> {
  try {
    await updateDoc(doc(getSupabaseServices().db, 'users', userId, 'weeklyMealPlans', plan.id), {
      weekStartDate: plan.weekStartDate,
      meals: plan.meals,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw describeFirestoreError('update the weekly plan', error);
  }
}

export async function deleteWeeklyMealPlan(userId: string, planId: string): Promise<void> {
  try {
    await deleteDoc(doc(getSupabaseServices().db, 'users', userId, 'weeklyMealPlans', planId));
  } catch (error) {
    throw describeFirestoreError('delete the weekly plan', error);
  }
}

export async function listWeeklyMealFavorites(userId: string): Promise<Set<string>> {
  try {
    const snapshot = await getDocs(favoritesCollection(userId));
    return new Set(snapshot.docs.map((entry) => entry.id));
  } catch (error) {
    throw describeFirestoreError('load your saved meal favorites', error);
  }
}

export async function saveWeeklyMealFavorite(
  userId: string,
  favorite: { recipeId: string; recipeName: string },
): Promise<void> {
  try {
    const reference = doc(getSupabaseServices().db, 'users', userId, 'weeklyMealFavorites', favorite.recipeId);
    const previous = await getDoc(reference);
    await setDoc(reference, {
      recipeId: favorite.recipeId,
      recipeName: favorite.recipeName,
      ...(!previous.exists() ? { createdAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    throw describeFirestoreError('save the meal favorite', error);
  }
}

export async function deleteWeeklyMealFavorite(userId: string, recipeId: string): Promise<void> {
  try {
    await deleteDoc(doc(getSupabaseServices().db, 'users', userId, 'weeklyMealFavorites', recipeId));
  } catch (error) {
    throw describeFirestoreError('remove the meal favorite', error);
  }
}
