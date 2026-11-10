import type { FoodConsumption, MealCategory } from './foodConsumption';
import type { NutritionProfile } from './usdaNutrition';

export type CalorieDataStatus = 'no-records' | 'complete' | 'incomplete';

export interface CalorieEstimate {
  caloriesKcal: number | null;
  reason: 'available' | 'missing-nutrition' | 'missing-calories' | 'unsupported-unit' | 'invalid-quantity';
}

export interface MealCalorieSummary {
  mealCategory: MealCategory;
  entryCount: number;
  caloriesKcal: number | null;
  entriesWithCalories: number;
  entriesMissingCalories: number;
}

export interface DailyCalorieSummary {
  date: string;
  entryCount: number;
  entriesWithCalories: number;
  entriesMissingCalories: number;
  caloriesKcal: number | null;
  status: CalorieDataStatus;
  meals: Record<MealCategory, MealCalorieSummary>;
}

export interface WeeklyCalorieDay extends DailyCalorieSummary {
  weekday: string;
}

export type MacronutrientId = '203' | '205' | '204';
export type MacronutrientName = 'protein' | 'carbohydrates' | 'totalFat';
export type NutrientEstimateReason = CalorieEstimate['reason'];

export interface MacronutrientEstimate {
  amountG: number | null;
  reason: MacronutrientEstimateReason;
}
export type MacronutrientEstimateReason =
  | 'available'
  | 'missing-nutrition'
  | 'missing-nutrient'
  | 'unsupported-unit'
  | 'invalid-quantity';

export interface MealMacronutrientSummary {
  mealCategory: MealCategory;
  entryCount: number;
  proteinG: number | null;
  carbohydratesG: number | null;
  totalFatG: number | null;
  entriesWithData: Record<MacronutrientName, number>;
  entriesMissingData: Record<MacronutrientName, number>;
}

export interface DailyMacronutrientSummary {
  date: string;
  entryCount: number;
  status: CalorieDataStatus;
  proteinG: number | null;
  carbohydratesG: number | null;
  totalFatG: number | null;
  entriesWithData: Record<MacronutrientName, number>;
  entriesMissingData: Record<MacronutrientName, number>;
  meals: Record<MealCategory, MealMacronutrientSummary>;
  distributionPercent: Record<MacronutrientName, number | null>;
  distributionComplete: boolean;
}

export interface WeeklyMacronutrientDay extends DailyMacronutrientSummary {
  weekday: string;
}

const mealCategories: readonly MealCategory[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const nutrientFields: Record<MacronutrientName, { id: MacronutrientId; unit: string }> = {
  protein: { id: '203', unit: 'g' },
  carbohydrates: { id: '205', unit: 'g' },
  totalFat: { id: '204', unit: 'g' },
};

function getServingBasis(
  profile: NutritionProfile,
  servings: number,
): { amount: number; unit: 'g' | 'mL' } | null {
  if (!Number.isFinite(servings) || servings <= 0 || !Number.isFinite(profile.servingSize) || !profile.servingSize) {
    return null;
  }
  const unit = profile.servingSizeUnit.trim().toLocaleLowerCase();
  if (['g', 'gr', 'gram', 'grams'].includes(unit)) {
    return { amount: profile.servingSize * servings, unit: 'g' };
  }
  if (['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'].includes(unit)) {
    return { amount: profile.servingSize * servings, unit: 'mL' };
  }
  return null;
}

function amountInNutritionBasis(
  record: FoodConsumption,
  profile: NutritionProfile,
): number | null {
  const { quantityConsumed, measurementUnit } = record;
  if (!Number.isFinite(quantityConsumed) || quantityConsumed <= 0) return null;

  if (measurementUnit === 'g') return profile.basisGrams ? quantityConsumed : null;
  if (measurementUnit === 'kg') return profile.basisGrams ? quantityConsumed * 1000 : null;
  if (measurementUnit === 'mL') return profile.basisMilliliters ? quantityConsumed : null;
  if (measurementUnit === 'L') return profile.basisMilliliters ? quantityConsumed * 1000 : null;
  if (measurementUnit === 'servings') {
    const serving = getServingBasis(profile, quantityConsumed);
    if (!serving) return null;
    if (serving.unit === 'g' && profile.basisGrams) return serving.amount;
    if (serving.unit === 'mL' && profile.basisMilliliters) return serving.amount;
  }
  return null;
}

export function estimateRecordMacronutrient(
  record: FoodConsumption,
  nutrientName: MacronutrientName,
): MacronutrientEstimate {
  if (!Number.isFinite(record.quantityConsumed) || record.quantityConsumed <= 0) {
    return { amountG: null, reason: 'invalid-quantity' };
  }
  const profile = record.nutritionSnapshot;
  if (!profile) return { amountG: null, reason: 'missing-nutrition' };
  const { id, unit } = nutrientFields[nutrientName];
  const nutrient = profile.nutrients[id];
  if (!nutrient || !Number.isFinite(nutrient.amount) || nutrient.amount < 0) {
    return { amountG: null, reason: 'missing-nutrient' };
  }
  if (nutrient.unit.trim().toLocaleLowerCase() !== unit) {
    return { amountG: null, reason: 'unsupported-unit' };
  }
  const amount = amountInNutritionBasis(record, profile);
  if (amount === null) return { amountG: null, reason: 'unsupported-unit' };
  const massBased = record.measurementUnit === 'g'
    || record.measurementUnit === 'kg'
    || (record.measurementUnit === 'servings' && getServingBasis(profile, record.quantityConsumed)?.unit === 'g');
  const hasBasis = massBased ? profile.basisGrams != null : profile.basisMilliliters != null;
  if (!hasBasis) return { amountG: null, reason: 'unsupported-unit' };
  return {
    amountG: Number(((nutrient.amount * amount) / 100).toFixed(4)),
    reason: 'available',
  };
}

function emptyMacroCounts(): Record<MacronutrientName, number> {
  return { protein: 0, carbohydrates: 0, totalFat: 0 };
}

function emptyMealMacronutrients(mealCategory: MealCategory): MealMacronutrientSummary {
  return {
    mealCategory,
    entryCount: 0,
    proteinG: null,
    carbohydratesG: null,
    totalFatG: null,
    entriesWithData: emptyMacroCounts(),
    entriesMissingData: emptyMacroCounts(),
  };
}

export function summarizeDailyMacronutrients(
  records: readonly FoodConsumption[],
  date: string,
): DailyMacronutrientSummary {
  const seenIds = new Set<string>();
  const dailyRecords = records.filter((record) => {
    if (record.consumptionDate !== date || seenIds.has(record.id)) return false;
    seenIds.add(record.id);
    return true;
  });
  const meals = Object.fromEntries(
    mealCategories.map((meal) => [meal, emptyMealMacronutrients(meal)]),
  ) as Record<MealCategory, MealMacronutrientSummary>;
  const totals = emptyMacroCounts();
  const availableTotals = emptyMacroCounts();

  for (const record of dailyRecords) {
    const meal = meals[record.mealCategory];
    if (!meal) continue;
    meal.entryCount += 1;
    for (const nutrientName of Object.keys(nutrientFields) as MacronutrientName[]) {
      const estimate = estimateRecordMacronutrient(record, nutrientName);
      if (estimate.amountG === null) {
        meal.entriesMissingData[nutrientName] += 1;
        continue;
      }
      meal.entriesWithData[nutrientName] += 1;
      totals[nutrientName] += estimate.amountG;
      availableTotals[nutrientName] += 1;
      const field = nutrientName === 'protein'
        ? 'proteinG'
        : nutrientName === 'carbohydrates' ? 'carbohydratesG' : 'totalFatG';
      meal[field] = (meal[field] ?? 0) + estimate.amountG;
    }
  }

  for (const mealCategory of mealCategories) {
    const meal = meals[mealCategory];
    for (const nutrientName of Object.keys(nutrientFields) as MacronutrientName[]) {
      const field = nutrientName === 'protein'
        ? 'proteinG'
        : nutrientName === 'carbohydrates' ? 'carbohydratesG' : 'totalFatG';
      const entriesWithData = meal.entriesWithData[nutrientName];
      meal[field] = entriesWithData ? Number((meal[field] ?? 0).toFixed(2)) : null;
    }
  }

  const proteinEnergy = availableTotals.protein ? totals.protein * 4 : null;
  const carbohydrateEnergy = availableTotals.carbohydrates ? totals.carbohydrates * 4 : null;
  const fatEnergy = availableTotals.totalFat ? totals.totalFat * 9 : null;
  const knownEnergy = (proteinEnergy ?? 0) + (carbohydrateEnergy ?? 0) + (fatEnergy ?? 0);
  const distributionPercent: Record<MacronutrientName, number | null> = {
    protein: proteinEnergy === null || knownEnergy === 0 ? null : Number(((proteinEnergy / knownEnergy) * 100).toFixed(1)),
    carbohydrates: carbohydrateEnergy === null || knownEnergy === 0 ? null : Number(((carbohydrateEnergy / knownEnergy) * 100).toFixed(1)),
    totalFat: fatEnergy === null || knownEnergy === 0 ? null : Number(((fatEnergy / knownEnergy) * 100).toFixed(1)),
  };
  const status: CalorieDataStatus = dailyRecords.length === 0
    ? 'no-records'
    : Object.values(availableTotals).every((count) => count === dailyRecords.length)
      ? 'complete'
      : 'incomplete';
  return {
    date,
    entryCount: dailyRecords.length,
    status,
    proteinG: availableTotals.protein ? Number(totals.protein.toFixed(2)) : null,
    carbohydratesG: availableTotals.carbohydrates ? Number(totals.carbohydrates.toFixed(2)) : null,
    totalFatG: availableTotals.totalFat ? Number(totals.totalFat.toFixed(2)) : null,
    entriesWithData: availableTotals,
    entriesMissingData: {
      protein: dailyRecords.length - availableTotals.protein,
      carbohydrates: dailyRecords.length - availableTotals.carbohydrates,
      totalFat: dailyRecords.length - availableTotals.totalFat,
    },
    meals,
    distributionPercent,
    distributionComplete: Object.values(availableTotals).every((count) => count === dailyRecords.length)
      && dailyRecords.length > 0,
  };
}

export function getMacronutrientsForDateRange(
  records: readonly FoodConsumption[],
  startDate: string,
  endDate: string,
  locale?: string,
): WeeklyMacronutrientDay[] {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
  const validDate = (value: string, date: Date, year: number, month: number, day: number) => (
    /^\d{4}-\d{2}-\d{2}$/.test(value)
    && date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
  if (
    !validDate(startDate, start, startYear, startMonth, startDay)
    || !validDate(endDate, end, endYear, endMonth, endDay)
    || start > end
  ) return [];

  const numberOfDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (numberOfDays > 366) return [];
  return Array.from({ length: numberOfDays }, (_, index) => {
    const current = new Date(Date.UTC(startYear, startMonth - 1, startDay + index));
    const date = current.toISOString().slice(0, 10);
    const localDate = new Date(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate());
    return {
      ...summarizeDailyMacronutrients(records, date),
      weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(localDate),
    };
  });
}

export function estimateRecordCalories(record: FoodConsumption): CalorieEstimate {
  if (!Number.isFinite(record.quantityConsumed) || record.quantityConsumed <= 0) {
    return { caloriesKcal: null, reason: 'invalid-quantity' };
  }
  const profile = record.nutritionSnapshot;
  if (!profile) return { caloriesKcal: null, reason: 'missing-nutrition' };

  const energyKcal = profile.nutrients['208'];
  const energyKj = profile.nutrients['268'];
  const calories = energyKcal?.unit.trim().toLocaleLowerCase() === 'kcal'
    ? energyKcal.amount
    : energyKj?.unit.trim().toLocaleLowerCase() === 'kj'
      ? energyKj.amount / 4.184
      : null;
  if (calories === null || !Number.isFinite(calories) || calories < 0) {
    return { caloriesKcal: null, reason: 'missing-calories' };
  }

  const basisAmount = amountInNutritionBasis(record, profile);
  if (basisAmount === null) return { caloriesKcal: null, reason: 'unsupported-unit' };
  const isMass = record.measurementUnit === 'g'
    || record.measurementUnit === 'kg'
    || (record.measurementUnit === 'servings' && getServingBasis(profile, record.quantityConsumed)?.unit === 'g');
  const hasNutritionBasis = isMass ? profile.basisGrams != null : profile.basisMilliliters != null;
  if (!hasNutritionBasis) {
    return { caloriesKcal: null, reason: 'unsupported-unit' };
  }
  // USDA and Open Food Facts profiles normalize nutrient amounts to a 100 g or 100 mL basis.
  const basis = 100;
  return {
    caloriesKcal: Number(((calories * basisAmount) / basis).toFixed(2)),
    reason: 'available',
  };
}

export function summarizeDailyCalories(
  records: readonly FoodConsumption[],
  date: string,
): DailyCalorieSummary {
  const seenRecordIds = new Set<string>();
  const dailyRecords = records.filter((record) => {
    if (record.consumptionDate !== date || seenRecordIds.has(record.id)) return false;
    seenRecordIds.add(record.id);
    return true;
  });
  const meals = Object.fromEntries(mealCategories.map((mealCategory) => [mealCategory, {
    mealCategory,
    entryCount: 0,
    caloriesKcal: null,
    entriesWithCalories: 0,
    entriesMissingCalories: 0,
  }])) as Record<MealCategory, MealCalorieSummary>;
  const mealSums: Record<MealCategory, number> = {
    Breakfast: 0,
    Lunch: 0,
    Dinner: 0,
    Snacks: 0,
  };
  const dayCalories = new Set<string>();

  for (const record of dailyRecords) {
    if (dayCalories.has(record.id)) continue;
    dayCalories.add(record.id);
    const meal = meals[record.mealCategory];
    if (!meal) continue;
    meal.entryCount += 1;
    const estimate = estimateRecordCalories(record);
    if (estimate.caloriesKcal === null) {
      meal.entriesMissingCalories += 1;
      continue;
    }
    meal.entriesWithCalories += 1;
    mealSums[record.mealCategory] += estimate.caloriesKcal;
  }

  for (const mealCategory of mealCategories) {
    const meal = meals[mealCategory];
    meal.caloriesKcal = meal.entriesWithCalories
      ? Number(mealSums[mealCategory].toFixed(2))
      : null;
  }

  const entriesWithCalories = mealCategories.reduce(
    (total, category) => total + meals[category].entriesWithCalories,
    0,
  );
  const entriesMissingCalories = dailyRecords.length - entriesWithCalories;
  const caloriesKcal = entriesWithCalories
    ? Number(mealCategories.reduce((total, category) => total + (meals[category].caloriesKcal ?? 0), 0).toFixed(2))
    : null;
  return {
    date,
    entryCount: dailyRecords.length,
    entriesWithCalories,
    entriesMissingCalories,
    caloriesKcal,
    status: dailyRecords.length === 0
      ? 'no-records'
      : entriesMissingCalories > 0 ? 'incomplete' : 'complete',
    meals,
  };
}

export function getSevenDayCalories(
  records: readonly FoodConsumption[],
  endingDate: string,
  locale?: string,
): WeeklyCalorieDay[] {
  const [year, month, day] = endingDate.split('-').map(Number);
  const end = new Date(year, month - 1, day);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(endingDate)
    || end.getFullYear() !== year
    || end.getMonth() !== month - 1
    || end.getDate() !== day
  ) return [];

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(year, month - 1, day - (6 - index));
    const date = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    return {
      ...summarizeDailyCalories(records, date),
      weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(current),
    };
  });
}
