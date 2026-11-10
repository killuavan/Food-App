export const activityLevels = [
  'Sedentary',
  'Lightly Active',
  'Moderately Active',
  'Very Active',
] as const;

export type ActivityLevel = (typeof activityLevels)[number];

export interface HealthProfile {
  id: string;
  dateOfBirth: string;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | '';
  dietaryPreferences: string;
  foodAllergies: string;
  fitnessGoal: string;
  bmiValue: number | null;
  bmiCalculatedAt: string;
  profileCompleted: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type HealthProfileDraft = Omit<
  HealthProfile,
  'id' | 'bmiValue' | 'bmiCalculatedAt' | 'profileCompleted' | 'onboardingCompleted' | 'createdAt' | 'updatedAt'
>;

export interface BmiResult {
  value: number;
  category: string | null;
  explanation: string;
}

export function calculateAge(dateOfBirth: string, today = new Date()): number | null {
  if (!isValidDate(dateOfBirth)) return null;
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  let age = today.getFullYear() - year;
  if (
    today.getMonth() < month - 1
    || (today.getMonth() === month - 1 && today.getDate() < day)
  ) age -= 1;
  return age >= 0 ? age : null;
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

export function calculateBmi(
  heightCm: number | null,
  weightKg: number | null,
  age: number | null,
): BmiResult | null {
  if (
    heightCm === null
    || weightKg === null
    || !Number.isFinite(heightCm)
    || !Number.isFinite(weightKg)
    || heightCm < 30
    || heightCm > 250
    || weightKg <= 0
    || weightKg > 500
  ) return null;

  const value = Number((weightKg / ((heightCm / 100) ** 2)).toFixed(2));
  if (age === null || age < 20) {
    return {
      value,
      category: null,
      explanation: age === null
        ? 'Age is needed to interpret BMI categories. For people under 20, BMI-for-age requires age- and sex-specific validated reference data.'
        : 'For people under 20, BMI-for-age requires age- and sex-specific validated reference data. No adult category is applied.',
    };
  }
  if (age > 120) {
    return {
      value,
      category: null,
      explanation: 'Age is outside the adult screening reference range used here. BMI is a screening tool, not a diagnosis.',
    };
  }
  const category = value < 18.5
    ? 'Underweight'
    : value < 25
      ? 'Healthy weight range'
      : value < 30
        ? 'Overweight'
        : 'Obesity';
  return {
    value,
    category,
    explanation: 'Adult BMI categories are screening ranges, not a diagnosis or a complete measure of health.',
  };
}

export function emptyHealthProfileDraft(): HealthProfileDraft {
  return {
    dateOfBirth: '',
    age: null,
    heightCm: null,
    weightKg: null,
    activityLevel: '',
    dietaryPreferences: '',
    foodAllergies: '',
    fitnessGoal: '',
  };
}

export function validateHealthProfileDraft(
  draft: HealthProfileDraft,
  today = new Date(),
): Partial<Record<keyof HealthProfileDraft, string>> {
  const errors: Partial<Record<keyof HealthProfileDraft, string>> = {};
  const hasDateOfBirth = Boolean(draft.dateOfBirth);
  const hasAge = draft.age !== null;

  if (hasDateOfBirth && !isValidDate(draft.dateOfBirth)) {
    errors.dateOfBirth = 'Enter a valid date of birth.';
  } else if (hasDateOfBirth) {
    const age = calculateAge(draft.dateOfBirth, today);
    if (age === null) errors.dateOfBirth = 'Date of birth cannot be in the future.';
    else if (age > 120) errors.dateOfBirth = 'Check the date of birth entered.';
  }
  if (hasDateOfBirth && hasAge) errors.age = 'Enter either date of birth or age, not both.';
  if (hasAge && (!Number.isInteger(draft.age) || Number(draft.age) < 0 || Number(draft.age) > 120)) {
    errors.age = 'Age must be a whole number between 0 and 120.';
  }
  if (draft.heightCm !== null && (!Number.isFinite(draft.heightCm) || draft.heightCm < 30 || draft.heightCm > 250)) {
    errors.heightCm = 'Height must be between 30 and 250 cm.';
  }
  if (draft.weightKg !== null && (!Number.isFinite(draft.weightKg) || draft.weightKg <= 0 || draft.weightKg > 500)) {
    errors.weightKg = 'Weight must be greater than 0 and no more than 500 kg.';
  }
  if (draft.activityLevel && !activityLevels.includes(draft.activityLevel)) {
    errors.activityLevel = 'Choose a valid activity level.';
  }
  if (draft.dietaryPreferences.length > 300) errors.dietaryPreferences = 'Use 300 characters or fewer.';
  if (draft.foodAllergies.length > 300) errors.foodAllergies = 'Use 300 characters or fewer.';
  if (draft.fitnessGoal.length > 300) errors.fitnessGoal = 'Use 300 characters or fewer.';
  return errors;
}

export function isHealthProfileComplete(draft: HealthProfileDraft): boolean {
  return (Boolean(draft.dateOfBirth) || draft.age !== null)
    && draft.heightCm !== null
    && draft.weightKg !== null
    && Boolean(draft.activityLevel);
}
