import type { FoodConsumption, MealCategory } from './foodConsumption';
import type { NutritionProfile, NutritionValue } from './usdaNutrition';

export type MicronutrientName =
  | 'vitaminA'
  | 'vitaminC'
  | 'vitaminD'
  | 'vitaminE'
  | 'vitaminB6'
  | 'vitaminB12'
  | 'folate'
  | 'calcium'
  | 'iron'
  | 'potassium'
  | 'magnesium'
  | 'zinc'
  | 'sodium'
  | 'fiber';

export type MicronutrientGroup = 'vitamins' | 'minerals' | 'fiber';
export type MicronutrientStatus = 'no-records' | 'available' | 'partial' | 'unavailable';

export interface MicronutrientDefinition {
  id: MicronutrientName;
  label: string;
  group: MicronutrientGroup;
  unit: string;
  nutrientIds: readonly string[];
}

export interface MicronutrientEstimate {
  amount: number | null;
  unit: string | null;
  comparable: boolean;
  reason: 'available' | 'missing-nutrition' | 'missing-nutrient' | 'unsupported-unit' | 'invalid-quantity';
}

export interface MicronutrientContribution {
  recordId: string;
  foodName: string;
  mealCategory: MealCategory;
  amount: number | null;
  unit: string | null;
  comparable: boolean;
}

export interface MicronutrientTotal {
  amount: number;
  unit: string;
  comparable: boolean;
}

export interface DailyMicronutrientValue {
  nutrient: MicronutrientDefinition;
  status: MicronutrientStatus;
  totals: MicronutrientTotal[];
  entriesWithData: number;
  entriesMissingData: number;
  contributions: MicronutrientContribution[];
  meals: Record<MealCategory, MicronutrientTotal[]>;
}

export interface DailyMicronutrientSummary {
  date: string;
  entryCount: number;
  status: 'no-records' | 'complete' | 'partial';
  values: Record<MicronutrientName, DailyMicronutrientValue>;
}

export interface MicronutrientTrendDay {
  date: string;
  weekday: string;
  entryCount: number;
  amount: number | null;
  unit: string | null;
  comparable: boolean;
  status: MicronutrientStatus;
}

export const micronutrientDefinitions: readonly MicronutrientDefinition[] = [
  { id: 'vitaminA', label: 'Vitamin A', group: 'vitamins', unit: 'µg RAE', nutrientIds: ['320', '318'] },
  { id: 'vitaminC', label: 'Vitamin C', group: 'vitamins', unit: 'mg', nutrientIds: ['401'] },
  { id: 'vitaminD', label: 'Vitamin D', group: 'vitamins', unit: 'µg', nutrientIds: ['328', '324'] },
  { id: 'vitaminE', label: 'Vitamin E', group: 'vitamins', unit: 'mg', nutrientIds: ['323'] },
  { id: 'vitaminB6', label: 'Vitamin B6', group: 'vitamins', unit: 'mg', nutrientIds: ['415'] },
  { id: 'vitaminB12', label: 'Vitamin B12', group: 'vitamins', unit: 'µg', nutrientIds: ['418'] },
  { id: 'folate', label: 'Folate', group: 'vitamins', unit: 'µg DFE', nutrientIds: ['435', '417'] },
  { id: 'calcium', label: 'Calcium', group: 'minerals', unit: 'mg', nutrientIds: ['301'] },
  { id: 'iron', label: 'Iron', group: 'minerals', unit: 'mg', nutrientIds: ['303'] },
  { id: 'potassium', label: 'Potassium', group: 'minerals', unit: 'mg', nutrientIds: ['306'] },
  { id: 'magnesium', label: 'Magnesium', group: 'minerals', unit: 'mg', nutrientIds: ['304'] },
  { id: 'zinc', label: 'Zinc', group: 'minerals', unit: 'mg', nutrientIds: ['309'] },
  { id: 'sodium', label: 'Sodium', group: 'minerals', unit: 'mg', nutrientIds: ['307'] },
  { id: 'fiber', label: 'Dietary fiber', group: 'fiber', unit: 'g', nutrientIds: ['291'] },
];

function servingBasis(profile: NutritionProfile, servings: number): { amount: number; unit: 'g' | 'mL' } | null {
  if (!Number.isFinite(servings) || servings <= 0 || !Number.isFinite(profile.servingSize) || !profile.servingSize) {
    return null;
  }
  const unit = profile.servingSizeUnit.trim().toLocaleLowerCase();
  if (['g', 'gr', 'gram', 'grams'].includes(unit)) return { amount: profile.servingSize * servings, unit: 'g' };
  if (['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'].includes(unit)) {
    return { amount: profile.servingSize * servings, unit: 'mL' };
  }
  return null;
}

function consumedBasis(record: FoodConsumption, profile: NutritionProfile): { amount: number; unit: 'g' | 'mL' } | null {
  if (!Number.isFinite(record.quantityConsumed) || record.quantityConsumed <= 0) return null;
  if (record.measurementUnit === 'g' && profile.basisGrams) return { amount: record.quantityConsumed, unit: 'g' };
  if (record.measurementUnit === 'kg' && profile.basisGrams) return { amount: record.quantityConsumed * 1000, unit: 'g' };
  if (record.measurementUnit === 'mL' && profile.basisMilliliters) return { amount: record.quantityConsumed, unit: 'mL' };
  if (record.measurementUnit === 'L' && profile.basisMilliliters) return { amount: record.quantityConsumed * 1000, unit: 'mL' };
  if (record.measurementUnit !== 'servings') return null;
  const portion = servingBasis(profile, record.quantityConsumed);
  if (!portion) return null;
  if (portion.unit === 'g' && profile.basisGrams) return portion;
  if (portion.unit === 'mL' && profile.basisMilliliters) return portion;
  return null;
}

function canonicalize(
  definition: MicronutrientDefinition,
  nutrientId: string,
  value: NutritionValue,
  source: NutritionProfile['source'],
): { amount: number; unit: string; comparable: boolean } | null {
  if (!value.unit.trim()) return null;
  const unit = value.unit.trim().toLocaleLowerCase().replace('μ', 'µ');
  if (value.comparable === false) return { amount: value.amount, unit: value.unit, comparable: false };

  if (definition.id === 'vitaminA') {
    if (nutrientId === '320' && source === 'USDA FoodData Central' && ['µg', 'µg rae'].includes(unit)) {
      return { amount: value.amount, unit: 'µg RAE', comparable: true };
    }
    return { amount: value.amount, unit: value.unit || 'IU', comparable: false };
  }
  if (definition.id === 'vitaminD' && nutrientId === '324') {
    return { amount: value.amount, unit: value.unit || 'IU', comparable: false };
  }
  if (definition.id === 'folate' && nutrientId !== '435') {
    return { amount: value.amount, unit: value.unit || 'µg', comparable: false };
  }
  if (definition.id === 'vitaminD' && nutrientId === '328') {
    if (['µg', 'mcg', 'ug'].includes(unit)) return { amount: value.amount, unit: 'µg', comparable: true };
    return null;
  }
  if (definition.id === 'folate' && nutrientId === '435') {
    if (['µg', 'mcg', 'ug', 'µg dfe'].includes(unit)) return { amount: value.amount, unit: 'µg DFE', comparable: true };
    return null;
  }

  const target = definition.unit;
  const targetBase = target.toLocaleLowerCase();
  if (target === 'g') {
    if (['g', 'gr', 'gram', 'grams'].includes(unit)) return { amount: value.amount, unit: target, comparable: true };
    if (['mg', 'milligram', 'milligrams'].includes(unit)) return { amount: value.amount / 1000, unit: target, comparable: true };
    return null;
  }
  if (target === 'mg') {
    if (['mg', 'milligram', 'milligrams'].includes(unit)) return { amount: value.amount, unit: target, comparable: true };
    if (['g', 'gr', 'gram', 'grams'].includes(unit)) return { amount: value.amount * 1000, unit: target, comparable: true };
    if (['µg', 'mcg', 'ug'].includes(unit)) return { amount: value.amount / 1000, unit: target, comparable: true };
    return null;
  }
  if (target === 'µg') {
    if (['µg', 'mcg', 'ug'].includes(unit)) return { amount: value.amount, unit: target, comparable: true };
    if (['mg', 'milligram', 'milligrams'].includes(unit)) return { amount: value.amount * 1000, unit: target, comparable: true };
    if (['g', 'gr', 'gram', 'grams'].includes(unit)) return { amount: value.amount * 1_000_000, unit: target, comparable: true };
    return null;
  }
  if (targetBase === 'µg rae' || targetBase === 'µg dfe') return null;
  return null;
}

export function estimateRecordMicronutrient(
  record: FoodConsumption,
  nutrientId: MicronutrientName,
): MicronutrientEstimate {
  if (!Number.isFinite(record.quantityConsumed) || record.quantityConsumed <= 0) {
    return { amount: null, unit: null, comparable: false, reason: 'invalid-quantity' };
  }
  const profile = record.nutritionSnapshot;
  if (!profile) return { amount: null, unit: null, comparable: false, reason: 'missing-nutrition' };
  const basis = consumedBasis(record, profile);
  if (!basis) return { amount: null, unit: null, comparable: false, reason: 'unsupported-unit' };
  const definition = micronutrientDefinitions.find((entry) => entry.id === nutrientId);
  if (!definition) return { amount: null, unit: null, comparable: false, reason: 'missing-nutrient' };

  let selected: { id: string; value: NutritionValue; converted: ReturnType<typeof canonicalize> } | null = null;
  for (const id of definition.nutrientIds) {
    const value = profile.nutrients[id];
    if (!value || !Number.isFinite(value.amount) || value.amount < 0) continue;
    const converted = canonicalize(definition, id, value, profile.source);
    if (converted) {
      selected = { id, value, converted };
      break;
    }
  }
  if (!selected || !selected.converted) {
    const hasNutrient = definition.nutrientIds.some((id) => Boolean(profile.nutrients[id]));
    return {
      amount: null,
      unit: null,
      comparable: false,
      reason: hasNutrient ? 'unsupported-unit' : 'missing-nutrient',
    };
  }

  const amount = (selected.converted.amount * basis.amount) / 100;
  return {
    amount: Number(amount.toFixed(4)),
    unit: selected.converted.unit,
    comparable: selected.converted.comparable,
    reason: 'available',
  };
}

function emptyMeals(): Record<MealCategory, MicronutrientTotal[]> {
  return { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] };
}

function addTotal(
  totals: MicronutrientTotal[],
  contribution: Pick<MicronutrientEstimate, 'amount' | 'unit' | 'comparable'>,
): void {
  if (contribution.amount === null || contribution.unit === null) return;
  const existing = totals.find((item) => item.unit === contribution.unit && item.comparable === contribution.comparable);
  if (existing) existing.amount += contribution.amount;
  else totals.push({ amount: contribution.amount, unit: contribution.unit, comparable: contribution.comparable });
}

export function summarizeDailyMicronutrients(
  records: readonly FoodConsumption[],
  date: string,
): DailyMicronutrientSummary {
  const uniqueRecords = new Map<string, FoodConsumption>();
  for (const record of records) {
    if (record.consumptionDate === date && !uniqueRecords.has(record.id)) uniqueRecords.set(record.id, record);
  }
  const dailyRecords = [...uniqueRecords.values()];
  const values = Object.fromEntries(micronutrientDefinitions.map((nutrient) => {
    const contributions = dailyRecords.map((record) => {
      const estimate = estimateRecordMicronutrient(record, nutrient.id);
      return {
        recordId: record.id,
        foodName: record.foodName,
        mealCategory: record.mealCategory,
        amount: estimate.amount,
        unit: estimate.unit,
        comparable: estimate.comparable,
      };
    });
    const totals: MicronutrientTotal[] = [];
    const meals = emptyMeals();
    for (const contribution of contributions) {
      addTotal(totals, contribution);
      if (contribution.amount !== null && contribution.unit !== null) {
        addTotal(meals[contribution.mealCategory], {
          amount: contribution.amount,
          unit: contribution.unit,
          comparable: contribution.comparable,
        });
      }
    }
    const entriesWithData = contributions.filter((entry) => entry.amount !== null).length;
    const entriesMissingData = dailyRecords.length - entriesWithData;
    const status: MicronutrientStatus = dailyRecords.length === 0
      ? 'no-records'
      : entriesWithData === 0 ? 'unavailable' : entriesMissingData > 0 ? 'partial' : 'available';
    return [nutrient.id, {
      nutrient,
      status,
      totals: totals.map((total) => ({ ...total, amount: Number(total.amount.toFixed(4)) })),
      entriesWithData,
      entriesMissingData,
      contributions,
      meals: Object.fromEntries(Object.entries(meals).map(([meal, items]) => [
        meal,
        items.map((item) => ({ ...item, amount: Number(item.amount.toFixed(4)) })),
      ])),
    }];
  })) as Record<MicronutrientName, DailyMicronutrientValue>;
  const status = dailyRecords.length === 0
    ? 'no-records'
    : Object.values(values).every((value) => value.status === 'available') ? 'complete' : 'partial';
  return { date, entryCount: dailyRecords.length, status, values };
}

export function getMicronutrientTrend(
  records: readonly FoodConsumption[],
  nutrientId: MicronutrientName,
  endDate: string,
  locale?: string,
): MicronutrientTrendDay[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return [];
  const [year, month, day] = endDate.split('-').map(Number);
  const end = new Date(Date.UTC(year, month - 1, day));
  if (end.getUTCFullYear() !== year || end.getUTCMonth() !== month - 1 || end.getUTCDate() !== day) return [];
  const definition = micronutrientDefinitions.find((item) => item.id === nutrientId);
  if (!definition) return [];

  const days: MicronutrientTrendDay[] = Array.from({ length: 7 }, (_, index) => {
    const dateValue = new Date(Date.UTC(year, month - 1, day - 6 + index));
    const date = dateValue.toISOString().slice(0, 10);
    const summary = summarizeDailyMicronutrients(records, date);
    const nutrient = summary.values[nutrientId];
    const total = nutrient.totals.length === 1 ? nutrient.totals[0] : null;
    return {
      date,
      weekday: new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        timeZone: 'UTC',
      }).format(dateValue),
      entryCount: summary.entryCount,
      amount: total?.amount ?? null,
      unit: total?.unit ?? null,
      comparable: total?.comparable ?? false,
      status: nutrient.totals.length > 1 && nutrient.status === 'available' ? 'partial' : nutrient.status,
    };
  });
  const unitGroups = new Map<string, { unit: string; comparable: boolean }>();
  for (const trendDay of days) {
    if (trendDay.amount !== null && trendDay.unit !== null) {
      unitGroups.set(`${trendDay.unit}:${trendDay.comparable}`, {
        unit: trendDay.unit,
        comparable: trendDay.comparable,
      });
    }
  }
  const groups = [...unitGroups.values()];
  const selectedGroup = groups.find((group) => group.comparable) ?? (groups.length === 1 ? groups[0] : null);
  return days.map((trendDay) => {
    if (trendDay.amount === null || (selectedGroup
      && trendDay.unit === selectedGroup.unit
      && trendDay.comparable === selectedGroup.comparable)) return trendDay;
    return {
      ...trendDay,
      amount: null,
      status: trendDay.status === 'no-records' || trendDay.status === 'unavailable' ? trendDay.status : 'partial',
    };
  });
}
