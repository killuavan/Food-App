import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from './supabaseDataCompat';
import { getSupabaseServices } from './supabaseClient';
import { getSupabaseErrorMessage } from './supabaseErrors';
import {
  calculateAge,
  calculateBmi,
  isHealthProfileComplete,
  validateHealthProfileDraft,
  type HealthProfile,
  type HealthProfileDraft,
} from '../utils/healthProfile';

const profileDocumentId = 'current';

function getProfileDocument(userId: string) {
  return doc(getSupabaseServices().db, 'users', userId, 'healthProfile', profileDocumentId);
}

function describeFirestoreError(action: string, error: unknown): Error {
  const detail = getSupabaseErrorMessage(error);
  const normalizedDetail = detail.toLocaleLowerCase();
  const projectId = getSupabaseServices().app.options.projectId ?? 'unknown';
  if (
    normalizedDetail.includes('42501')
    || normalizedDetail.includes('permission-denied')
    || normalizedDetail.includes('missing or insufficient permissions')
    || normalizedDetail.includes('row-level security')
  ) {
    return new Error(
      `Unable to ${action} because Supabase denied access in project "${projectId}". Apply the SQL migration and verify that the signed-in user has access under the RLS policies.`,
    );
  }
  return new Error(`Unable to ${action}: ${detail}`);
}

function toHealthProfile(id: string, data: Record<string, unknown>): HealthProfile {
  const toIso = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'toDate' in value) {
      const timestamp = value as { toDate: () => Date };
      return timestamp.toDate().toISOString();
    }
    return '';
  };

  return {
    id,
    dateOfBirth: typeof data.dateOfBirth === 'string' ? data.dateOfBirth : '',
    age: typeof data.age === 'number' ? data.age : null,
    heightCm: typeof data.heightCm === 'number' ? data.heightCm : null,
    weightKg: typeof data.weightKg === 'number' ? data.weightKg : null,
    activityLevel: typeof data.activityLevel === 'string' ? data.activityLevel as HealthProfile['activityLevel'] : '',
    dietaryPreferences: typeof data.dietaryPreferences === 'string' ? data.dietaryPreferences : '',
    foodAllergies: typeof data.foodAllergies === 'string' ? data.foodAllergies : '',
    fitnessGoal: typeof data.fitnessGoal === 'string' ? data.fitnessGoal : '',
    bmiValue: typeof data.bmiValue === 'number' ? data.bmiValue : null,
    bmiCalculatedAt: toIso(data.bmiCalculatedAt),
    profileCompleted: data.profileCompleted === true,
    onboardingCompleted: data.onboardingCompleted === true,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export async function getHealthProfile(userId: string): Promise<HealthProfile | null> {
  try {
    const snapshot = await getDoc(getProfileDocument(userId));
    return snapshot.exists() ? toHealthProfile(snapshot.id, snapshot.data()) : null;
  } catch (error) {
    throw describeFirestoreError('load your health profile', error);
  }
}

export async function hasCompletedHealthOnboarding(userId: string): Promise<boolean> {
  const profile = await getHealthProfile(userId);
  return profile?.onboardingCompleted === true;
}

export async function saveHealthProfile(
  userId: string,
  draft: HealthProfileDraft,
): Promise<void> {
  const errors = validateHealthProfileDraft(draft);
  const firstError = Object.values(errors)[0];
  if (firstError) throw new Error(firstError);

  const ageForBmi = draft.dateOfBirth ? calculateAge(draft.dateOfBirth) : draft.age;
  const bmi = calculateBmi(draft.heightCm, draft.weightKg, ageForBmi);
  try {
    const reference = getProfileDocument(userId);
    const previous = await getDoc(reference);
    await setDoc(reference, {
      ...draft,
      age: draft.dateOfBirth ? null : draft.age,
      bmiValue: bmi?.value ?? null,
      bmiCalculatedAt: bmi ? serverTimestamp() : null,
      profileCompleted: isHealthProfileComplete(draft),
      onboardingCompleted: true,
      ...(previous.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    throw describeFirestoreError('save your health profile', error);
  }
}

export async function skipHealthOnboarding(userId: string): Promise<void> {
  try {
    const reference = getProfileDocument(userId);
    const previous = await getDoc(reference);
    await setDoc(reference, {
      onboardingCompleted: true,
      ...(previous.exists() ? {} : {
        profileCompleted: false,
        createdAt: serverTimestamp(),
      }),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    throw describeFirestoreError('save your onboarding preference', error);
  }
}

export async function deleteHealthProfile(userId: string): Promise<void> {
  try {
    await deleteDoc(getProfileDocument(userId));
  } catch (error) {
    throw describeFirestoreError('delete your health profile', error);
  }
}
