import { describe, expect, it } from 'vitest';
import type { FoodItem } from '../../src/utils/foodInventory';
import {
  buildFoodExpirationNotificationPlans,
  expirationNotificationId,
} from '../../src/utils/foodExpirationNotificationSchedule';

function makeItem(id: string, foodName: string, expirationDate: string, quantity = 1): FoodItem {
  return {
    id,
    foodName,
    category: 'Others',
    quantity,
    unit: 'pcs',
    lowStockThreshold: 1,
    purchaseDate: '',
    expirationDate,
    storageLocation: '',
    notes: '',
    createdAt: '',
    updatedAt: '',
  };
}

describe('food expiration notification scheduling', () => {
  it('groups foods with the same warning date into one scheduled reminder', () => {
    const now = new Date(2026, 0, 1, 8);
    const plans = buildFoodExpirationNotificationPlans([
      makeItem('milk', 'Milk', '2026-01-05'),
      makeItem('bread', 'Bread', '2026-01-05'),
    ], 3, now);

    expect(plans).toHaveLength(1);
    expect(plans[0].triggerDate).toBe('2026-01-02');
    expect(plans[0].scheduledAt).toEqual(new Date(2026, 0, 2, 9));
    expect(plans[0].body).toContain('Bread (2026-01-05)');
    expect(plans[0].body).toContain('Milk (2026-01-05)');
  });

  it('schedules a catch-up reminder shortly when foods are already within the warning period', () => {
    const now = new Date(2026, 0, 1, 10);
    const plans = buildFoodExpirationNotificationPlans([
      makeItem('milk', 'Milk', '2026-01-03'),
    ], 3, now);

    expect(plans).toHaveLength(1);
    expect(plans[0].triggerDate).toBe('2026-01-01');
    expect(plans[0].scheduledAt).toEqual(new Date(2026, 0, 1, 10, 0, 5));
  });

  it('ignores expired, invalid, and out-of-stock items', () => {
    const plans = buildFoodExpirationNotificationPlans([
      makeItem('expired', 'Expired food', '2025-12-31'),
      makeItem('invalid', 'Invalid date', '2026-02-30'),
      makeItem('empty', 'Empty stock', '2026-01-05', 0),
    ], 3, new Date(2026, 0, 1, 8));

    expect(plans).toEqual([]);
  });

  it('limits reminders to the nearest upcoming notification dates', () => {
    const plans = buildFoodExpirationNotificationPlans([
      makeItem('later', 'Later', '2026-01-10'),
      makeItem('sooner', 'Sooner', '2026-01-05'),
    ], 1, new Date(2026, 0, 1, 8), 1);

    expect(plans).toHaveLength(1);
    expect(plans[0].triggerDate).toBe('2026-01-04');
  });

  it('generates distinct valid native identifiers when hashes collide', () => {
    const usedIds = new Set<number>();
    const first = expirationNotificationId('a', usedIds);
    const second = expirationNotificationId('a', usedIds);

    expect(second).not.toBe(first);
    expect(first).toBeGreaterThanOrEqual(1_000_000_000);
    expect(second).toBeLessThanOrEqual(1_999_999_999);
  });
});
