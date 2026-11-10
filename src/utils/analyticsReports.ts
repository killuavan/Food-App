import type { FoodConsumption, MealCategory } from './foodConsumption';
import { getLocalDate } from './foodConsumption';
import { getStockStatus, type FoodItem, type MeasurementUnit } from './foodInventory';
import { getExpirationResult } from './foodExpiration';
import {
  estimateRecordCalories,
  estimateRecordMacronutrient,
  type MacronutrientName,
} from './dailyNutrition';
import { micronutrientDefinitions, summarizeDailyMicronutrients } from './micronutrients';
import type { InventoryMovement } from '../services/foodConsumptionService';
import type { WeeklyMealPlan } from './weeklyMealRecommendations';

export type ReportPeriod = 'today' | 'last7' | 'last30' | 'month' | 'custom';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface DailyReportRow {
  date: string;
  entryCount: number;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbohydratesG: number | null;
  totalFatG: number | null;
  calorieEntriesWithData: number;
  macroEntriesWithData: Record<MacronutrientName, number>;
}

export interface MicronutrientReportRow {
  date: string;
  nutrientId: string;
  nutrient: string;
  amount: number | null;
  unit: string | null;
  entriesWithData: number;
  entriesMissingData: number;
  comparable: boolean | null;
}

export interface ConsumptionAnalytics {
  records: FoodConsumption[];
  days: DailyReportRow[];
  micronutrients: MicronutrientReportRow[];
  totalFoodLogs: number;
  daysWithLoggedFoods: number;
  totalRecordedCaloriesKcal: number | null;
  calorieEntriesWithData: number;
  nutritionCompletenessPercent: number | null;
  macros: Record<MacronutrientName, number | null>;
  macroEntriesWithData: Record<MacronutrientName, number>;
  mealDistribution: Array<{
    meal: MealCategory;
    count: number;
    caloriesKcal: number | null;
    macros: Record<MacronutrientName, number | null>;
  }>;
  foodCategories: Array<{ category: string; count: number }>;
  frequentFoods: Array<{
    foodName: string;
    count: number;
    macros: Record<MacronutrientName, number | null>;
  }>;
}

export interface InventoryAnalytics {
  items: FoodItem[];
  totalItems: number;
  inStockItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  quantityByUnit: Array<{ unit: MeasurementUnit; quantity: number }>;
  movements: InventoryMovement[];
  movementTotals: Array<{ movementType: string; unit: MeasurementUnit; quantity: number; count: number }>;
  movementDailyCounts: Array<{ date: string; count: number }>;
  movementDailyQuantities: Array<{ date: string; movementType: string; unit: MeasurementUnit; quantity: number }>;
  expiringSoonItems: FoodItem[];
  expiredItems: FoodItem[];
}

export interface MealPlanAnalytics {
  plans: WeeklyMealPlan[];
  plannedMeals: number;
  mealsWithMissingIngredients: number;
  availableIngredients: number;
  missingIngredients: number;
  unverifiedIngredients: number;
}

const macroNames: MacronutrientName[] = ['protein', 'carbohydrates', 'totalFat'];
const mealCategories: MealCategory[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export function isValidReportDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day;
}

export function getReportDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getReportDateBoundary(dateKey: string, timeZone: string): Date {
  if (!isValidReportDate(dateKey)) throw new Error('Enter a valid date.');
  const [year, month, day] = dateKey.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  let timestamp = target;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp))
      .map((part) => [part.type, part.value]));
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const difference = target - represented;
    timestamp += difference;
    if (difference === 0) break;
  }
  return new Date(timestamp);
}

function dateOffset(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return getLocalDate(date);
}

export function resolveReportDateRange(
  period: ReportPeriod,
  customStart: string,
  customEnd: string,
  today = getLocalDate(),
): DateRange {
  if (!isValidReportDate(today)) throw new Error('The current date is invalid.');
  if (period === 'custom') {
    if (!isValidReportDate(customStart) || !isValidReportDate(customEnd)) {
      throw new Error('Enter a valid start and end date.');
    }
    if (customStart > customEnd) throw new Error('Start date must be on or before end date.');
    if (dateOffset(customStart, 366) < customEnd) throw new Error('Choose a range of 367 days or less.');
    return { startDate: customStart, endDate: customEnd };
  }
  if (period === 'today') return { startDate: today, endDate: today };
  if (period === 'last7') return { startDate: dateOffset(today, -6), endDate: today };
  if (period === 'last30') return { startDate: dateOffset(today, -29), endDate: today };
  const [year, month] = today.split('-').map(Number);
  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: today,
  };
}

export function listReportDates(range: DateRange): string[] {
  if (
    !isValidReportDate(range.startDate)
    || !isValidReportDate(range.endDate)
    || range.startDate > range.endDate
  ) throw new Error('Select a valid date range.');
  const [startYear, startMonth, startDay] = range.startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = range.endDate.split('-').map(Number);
  const count = Math.floor(
    (Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay))
      / 86_400_000,
  ) + 1;
  if (count > 367) throw new Error('Choose a range of 367 days or less.');
  return Array.from({ length: count }, (_, index) => dateOffset(range.startDate, index));
}

export function buildConsumptionAnalytics(
  sourceRecords: readonly FoodConsumption[],
  range: DateRange,
): ConsumptionAnalytics {
  const records = [...new Map(sourceRecords
    .filter((record) => record.consumptionDate >= range.startDate && record.consumptionDate <= range.endDate)
    .map((record) => [record.id, record])).values()];
  const recordsByDay = new Map<string, FoodConsumption[]>();
  for (const record of records) {
    const day = recordsByDay.get(record.consumptionDate) ?? [];
    day.push(record);
    recordsByDay.set(record.consumptionDate, day);
  }
  const macroTotals: Record<MacronutrientName, number> = {
    protein: 0,
    carbohydrates: 0,
    totalFat: 0,
  };
  const macroEntriesWithData: Record<MacronutrientName, number> = {
    protein: 0,
    carbohydrates: 0,
    totalFat: 0,
  };
  let calorieTotal = 0;
  let calorieEntriesWithData = 0;
  const meals = new Map<MealCategory, {
    count: number;
    calories: number;
    calorieCount: number;
    macros: Record<MacronutrientName, number>;
    macroCounts: Record<MacronutrientName, number>;
  }>(
    mealCategories.map((meal) => [meal, {
      count: 0,
      calories: 0,
      calorieCount: 0,
      macros: { protein: 0, carbohydrates: 0, totalFat: 0 },
      macroCounts: { protein: 0, carbohydrates: 0, totalFat: 0 },
    }]),
  );
  const categoryCounts = new Map<string, number>();
  const foodCounts = new Map<string, {
    foodName: string;
    count: number;
    macros: Record<MacronutrientName, number>;
    macroCounts: Record<MacronutrientName, number>;
  }>();
  const days = listReportDates(range).map((date): DailyReportRow => {
    const dayRecords = recordsByDay.get(date) ?? [];
    let dailyCalories = 0;
    let dailyCaloriesWithData = 0;
    const dailyMacros = { protein: 0, carbohydrates: 0, totalFat: 0 };
    const dailyMacroCounts = { protein: 0, carbohydrates: 0, totalFat: 0 };
    for (const record of dayRecords) {
      const calorieEstimate = estimateRecordCalories(record);
      if (calorieEstimate.caloriesKcal !== null) {
        dailyCalories += calorieEstimate.caloriesKcal;
        dailyCaloriesWithData += 1;
        calorieTotal += calorieEstimate.caloriesKcal;
        calorieEntriesWithData += 1;
      }
      const meal = meals.get(record.mealCategory);
      if (meal) {
        meal.count += 1;
        if (calorieEstimate.caloriesKcal !== null) {
          meal.calories += calorieEstimate.caloriesKcal;
          meal.calorieCount += 1;
        }
      }
      categoryCounts.set(record.foodCategory, (categoryCounts.get(record.foodCategory) ?? 0) + 1);
      const foodKey = record.foodName.trim().toLocaleLowerCase();
      const foodEntry = foodCounts.get(foodKey) ?? {
        foodName: record.foodName,
        count: 0,
        macros: { protein: 0, carbohydrates: 0, totalFat: 0 },
        macroCounts: { protein: 0, carbohydrates: 0, totalFat: 0 },
      };
      foodEntry.count += 1;
      foodCounts.set(foodKey, foodEntry);
      for (const macro of macroNames) {
        const estimate = estimateRecordMacronutrient(record, macro);
        if (estimate.amountG === null) continue;
        dailyMacros[macro] += estimate.amountG;
        dailyMacroCounts[macro] += 1;
        macroTotals[macro] += estimate.amountG;
        macroEntriesWithData[macro] += 1;
        if (meal) {
          meal.macros[macro] += estimate.amountG;
          meal.macroCounts[macro] += 1;
        }
        foodEntry.macros[macro] += estimate.amountG;
        foodEntry.macroCounts[macro] += 1;
      }
      foodCounts.set(foodKey, foodEntry);
    }
    return {
      date,
      entryCount: dayRecords.length,
      caloriesKcal: dailyCaloriesWithData ? Number(dailyCalories.toFixed(2)) : null,
      proteinG: dailyMacroCounts.protein ? Number(dailyMacros.protein.toFixed(2)) : null,
      carbohydratesG: dailyMacroCounts.carbohydrates ? Number(dailyMacros.carbohydrates.toFixed(2)) : null,
      totalFatG: dailyMacroCounts.totalFat ? Number(dailyMacros.totalFat.toFixed(2)) : null,
      calorieEntriesWithData: dailyCaloriesWithData,
      macroEntriesWithData: dailyMacroCounts,
    };
  });
  const totalFoodLogs = records.length;
  const micronutrients = days.flatMap<MicronutrientReportRow>((day) => {
    const summary = summarizeDailyMicronutrients(recordsByDay.get(day.date) ?? [], day.date);
    return micronutrientDefinitions.flatMap<MicronutrientReportRow>((definition) => {
      const nutrient = summary.values[definition.id];
      if (!nutrient.totals.length) {
        return [{
          date: day.date,
          nutrientId: definition.id,
          nutrient: definition.label,
          amount: null,
          unit: null,
          entriesWithData: nutrient.entriesWithData,
          entriesMissingData: nutrient.entriesMissingData,
          comparable: null,
        }];
      }
      return nutrient.totals.map((total) => ({
        date: day.date,
        nutrientId: definition.id,
        nutrient: definition.label,
        amount: total.amount,
        unit: total.unit,
        entriesWithData: nutrient.entriesWithData,
        entriesMissingData: nutrient.entriesMissingData,
        comparable: total.comparable,
      }));
    });
  });
  return {
    records,
    days,
    micronutrients,
    totalFoodLogs,
    daysWithLoggedFoods: days.filter((day) => day.entryCount > 0).length,
    totalRecordedCaloriesKcal: calorieEntriesWithData ? Number(calorieTotal.toFixed(2)) : null,
    calorieEntriesWithData,
    nutritionCompletenessPercent: totalFoodLogs
      ? Number(((calorieEntriesWithData / totalFoodLogs) * 100).toFixed(1))
      : null,
    macros: Object.fromEntries(macroNames.map((name) => [
      name,
      macroEntriesWithData[name] ? Number(macroTotals[name].toFixed(2)) : null,
    ])) as Record<MacronutrientName, number | null>,
    macroEntriesWithData,
    mealDistribution: mealCategories.map((meal) => {
      const summary = meals.get(meal)!;
      return {
        meal,
        count: summary.count,
        caloriesKcal: summary.calorieCount ? Number(summary.calories.toFixed(2)) : null,
        macros: Object.fromEntries(macroNames.map((name) => [
          name,
          summary.macroCounts[name] ? Number(summary.macros[name].toFixed(2)) : null,
        ])) as Record<MacronutrientName, number | null>,
      };
    }),
    foodCategories: [...categoryCounts].map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    frequentFoods: [...foodCounts.values()]
      .map((food) => ({
        foodName: food.foodName,
        count: food.count,
        macros: Object.fromEntries(macroNames.map((name) => [
          name,
          food.macroCounts[name] ? Number(food.macros[name].toFixed(2)) : null,
        ])) as Record<MacronutrientName, number | null>,
      }))
      .sort((a, b) => b.count - a.count || a.foodName.localeCompare(b.foodName)),
  };
}

export function buildInventoryAnalytics(
  items: readonly FoodItem[],
  sourceMovements: readonly InventoryMovement[],
  range: DateRange,
  today = new Date(),
  warningDays = 7,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
): InventoryAnalytics {
  const movements = sourceMovements.filter((movement) => {
    if (!movement.createdAt) return false;
    const movementDate = getReportDateInTimeZone(new Date(movement.createdAt), timeZone);
    return movementDate >= range.startDate && movementDate <= range.endDate;
  });
  const quantityByUnit = new Map<MeasurementUnit, number>();
  const movementTotals = new Map<string, { movementType: string; unit: MeasurementUnit; quantity: number; count: number }>();
  const dailyMovementCounts = new Map<string, number>();
  const dailyMovementQuantities = new Map<string, {
    date: string;
    movementType: string;
    unit: MeasurementUnit;
    quantity: number;
  }>();
  for (const item of items) {
    quantityByUnit.set(item.unit, (quantityByUnit.get(item.unit) ?? 0) + item.quantity);
  }
  for (const movement of movements) {
    const key = `${movement.movementType}:${movement.unit}`;
    const total = movementTotals.get(key) ?? {
      movementType: movement.movementType,
      unit: movement.unit,
      quantity: 0,
      count: 0,
    };
    total.quantity += movement.quantity;
    total.count += 1;
    movementTotals.set(key, total);
    const dateKey = getReportDateInTimeZone(new Date(movement.createdAt), timeZone);
    dailyMovementCounts.set(dateKey, (dailyMovementCounts.get(dateKey) ?? 0) + 1);
    const dailyKey = `${dateKey}:${movement.movementType}:${movement.unit}`;
    const dailyQuantity = dailyMovementQuantities.get(dailyKey) ?? {
      date: dateKey,
      movementType: movement.movementType,
      unit: movement.unit,
      quantity: 0,
    };
    dailyQuantity.quantity += movement.quantity;
    dailyMovementQuantities.set(dailyKey, dailyQuantity);
  }
  const reportToday = new Date(`${getReportDateInTimeZone(today, timeZone)}T12:00:00`);
  const liveItems = items.filter((item) => item.quantity > 0);
  return {
    items: [...items],
    totalItems: items.length,
    inStockItems: items.filter((item) => getStockStatus(item.quantity, item.lowStockThreshold) === 'good').length,
    lowStockItems: items.filter((item) => getStockStatus(item.quantity, item.lowStockThreshold) === 'low').length,
    outOfStockItems: items.filter((item) => getStockStatus(item.quantity, item.lowStockThreshold) === 'out').length,
    quantityByUnit: [...quantityByUnit].map(([unit, quantity]) => ({ unit, quantity })),
    movements,
    movementTotals: [...movementTotals.values()],
    movementDailyCounts: listReportDates(range).map((date) => ({
      date,
      count: dailyMovementCounts.get(date) ?? 0,
    })),
    movementDailyQuantities: [...dailyMovementQuantities.values()],
    expiringSoonItems: liveItems.filter((item) => getExpirationResult(item.expirationDate, warningDays, reportToday).status === 'soon'),
    expiredItems: liveItems.filter((item) => getExpirationResult(item.expirationDate, warningDays, reportToday).status === 'expired'),
  };
}

export function buildMealPlanAnalytics(
  plans: readonly WeeklyMealPlan[],
  range: DateRange,
): MealPlanAnalytics {
  const selectedPlans = plans.filter((plan) => {
    const planEndDate = dateOffset(plan.weekStartDate, 6);
    return plan.weekStartDate <= range.endDate && planEndDate >= range.startDate;
  });
  const meals = selectedPlans.flatMap((plan) => plan.meals);
  return {
    plans: selectedPlans,
    plannedMeals: meals.length,
    mealsWithMissingIngredients: meals.filter((meal) => meal.missingIngredients.length > 0
      || meal.ingredients.some((ingredient) => ingredient.availability === 'unavailable')).length,
    availableIngredients: meals.reduce((total, meal) => total
      + meal.ingredients.filter((ingredient) => ingredient.availability === 'available').length, 0),
    missingIngredients: meals.reduce((total, meal) => total
      + meal.ingredients.filter((ingredient) => ingredient.availability === 'unavailable').length, 0),
    unverifiedIngredients: meals.reduce((total, meal) => total
      + meal.ingredients.filter((ingredient) => ingredient.availability === 'unverified').length, 0),
  };
}
