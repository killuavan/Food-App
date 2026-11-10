import { beforeEach, describe, expect, test } from 'vitest';
import {
  filterAndSortExpiringItems,
  getCurrentExpirationWarnings,
  getExpirationResult,
  type ExpirationResult,
} from '@/utils/foodExpiration';
import {
  getExpirationWarningDays,
  hasShownExpirationAlertToday,
  markExpirationAlertShownToday,
  saveExpirationWarningDays,
} from '@/services/foodExpirationService';
import type { FoodItem } from '@/utils/foodInventory';

const today = new Date(2026, 10, 5, 15);

function item(id: string, foodName: string, expirationDate: string): FoodItem {
  return {
    id,
    foodName,
    category: 'Dairy',
    quantity: 1,
    unit: 'pcs',
    lowStockThreshold: 0,
    purchaseDate: '',
    expirationDate,
    storageLocation: '',
    notes: '',
    createdAt: '',
    updatedAt: '',
  };
}

describe('food expiration dates', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('classifies fresh, warning-window, today, expired, missing, and invalid dates', () => {
    expect(getExpirationResult('2026-11-13', 7, today)).toMatchObject({
      status: 'fresh',
      remainingDays: 8,
    } satisfies Partial<ExpirationResult>);
    expect(getExpirationResult('2026-11-08', 7, today)).toMatchObject({
      status: 'soon',
      remainingDays: 3,
      countdown: 'Expires in 3 days',
    });
    expect(getExpirationResult('2026-11-05', 7, today)).toMatchObject({
      status: 'soon',
      remainingDays: 0,
      countdown: 'Expires today',
    });
    expect(getExpirationResult('2026-11-03', 7, today)).toMatchObject({
      status: 'expired',
      remainingDays: -2,
      countdown: 'Expired 2 days ago',
    });
    expect(getExpirationResult('', 7, today)).toMatchObject({
      status: 'none',
      countdown: 'No expiration date recorded',
    });
    expect(getExpirationResult('2026-02-30', 7, today).status).toBe('invalid');
  });

  test('uses local calendar day differences across date boundaries', () => {
    const lateToday = new Date(2026, 10, 5, 23, 59);
    expect(getExpirationResult('2026-11-06', 7, lateToday).remainingDays).toBe(1);
  });

  test('sorts dated foods first and filters expiration status and search', () => {
    const items = [
      item('none', 'Oats', ''),
      item('expired', 'Old milk', '2026-11-03'),
      item('soon', 'Fresh milk', '2026-11-08'),
      item('fresh', 'Cheese', '2026-12-01'),
    ];

    expect(filterAndSortExpiringItems(items, {
      search: '',
      status: 'all',
      warningDays: 7,
      today,
    }).map((entry) => entry.id)).toEqual(['expired', 'soon', 'fresh', 'none']);
    expect(filterAndSortExpiringItems(items, {
      search: 'milk',
      status: 'soon',
      warningDays: 7,
      today,
    }).map((entry) => entry.id)).toEqual(['soon']);
  });

  test('produces current warnings and reflects the configurable warning period', () => {
    const foods = [
      item('soon', 'Milk', '2026-11-08'),
      item('fresh', 'Cheese', '2026-11-13'),
    ];
    expect(getCurrentExpirationWarnings(foods, 7, today).map(({ item: food }) => food.id)).toEqual(['soon']);
    expect(getCurrentExpirationWarnings(foods, 10, today).map(({ item: food }) => food.id)).toEqual(['soon', 'fresh']);
  });

  test('persists warning settings and a per-user once-daily alert marker', () => {
    const userId = 'user-123';
    expect(getExpirationWarningDays(userId)).toBe(7);
    saveExpirationWarningDays(userId, 14);
    expect(getExpirationWarningDays(userId)).toBe(14);
    expect(hasShownExpirationAlertToday(userId, today)).toBe(false);
    markExpirationAlertShownToday(userId, today);
    expect(hasShownExpirationAlertToday(userId, today)).toBe(true);
    expect(hasShownExpirationAlertToday(userId, new Date(2026, 10, 6))).toBe(false);
  });
});
