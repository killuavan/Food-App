import { beforeEach, describe, expect, it, vi } from 'vitest';

const plugin = vi.hoisted(() => ({
  native: true,
  platform: 'android',
  permission: 'granted',
  pending: [] as Array<Record<string, unknown>>,
  getPending: vi.fn(),
  checkPermissions: vi.fn(),
  createChannel: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => plugin.native,
    getPlatform: () => plugin.platform,
  },
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    getPending: plugin.getPending,
    checkPermissions: plugin.checkPermissions,
    createChannel: plugin.createChannel,
    schedule: plugin.schedule,
    cancel: plugin.cancel,
  },
}));

import {
  clearFoodExpirationNotifications,
  sendTestDeviceNotification,
  syncFoodExpirationNotifications,
} from '../../src/services/foodExpirationNotificationService';
import type { FoodItem } from '../../src/utils/foodInventory';

const milk: FoodItem = {
  id: 'milk',
  foodName: 'Milk',
  category: 'Dairy',
  quantity: 1,
  unit: 'pcs',
  lowStockThreshold: 1,
  purchaseDate: '',
  expirationDate: '2026-01-05',
  storageLocation: '',
  notes: '',
  createdAt: '',
  updatedAt: '',
};

describe('food expiration notification service', () => {
  beforeEach(() => {
    localStorage.clear();
    plugin.native = true;
    plugin.platform = 'android';
    plugin.permission = 'granted';
    plugin.pending = [];
    vi.clearAllMocks();
    plugin.getPending.mockImplementation(async () => ({ notifications: plugin.pending }));
    plugin.checkPermissions.mockImplementation(async () => ({ display: plugin.permission }));
    plugin.schedule.mockImplementation(async ({ notifications }: { notifications: Array<Record<string, unknown>> }) => {
      plugin.pending.push(...notifications);
      return { notifications: notifications.map(({ id }) => ({ id })) };
    });
    plugin.cancel.mockImplementation(async ({ notifications }: { notifications: Array<{ id: number }> }) => {
      const ids = new Set(notifications.map(({ id }) => id));
      plugin.pending = plugin.pending.filter((notification) => !ids.has(notification.id as number));
    });
  });

  it('schedules a native reminder for the start of the expiration window', async () => {
    await syncFoodExpirationNotifications('user-1', [milk], 3, new Date(2026, 0, 1, 8));

    expect(plugin.createChannel).toHaveBeenCalledOnce();
    expect(plugin.schedule).toHaveBeenCalledOnce();
    const [{ schedule }] = plugin.schedule.mock.calls[0][0].notifications;
    expect(schedule.at).toEqual(new Date(2026, 0, 2, 9));
    expect(schedule.allowWhileIdle).toBe(true);
  });

  it('does not duplicate a pending reminder when inventory is rechecked', async () => {
    await syncFoodExpirationNotifications('user-1', [milk], 3, new Date(2026, 0, 1, 8));
    await syncFoodExpirationNotifications('user-1', [milk], 3, new Date(2026, 0, 1, 8, 1));

    expect(plugin.schedule).toHaveBeenCalledOnce();
  });

  it('cancels reminders for removed inventory items', async () => {
    await syncFoodExpirationNotifications('user-1', [milk], 3, new Date(2026, 0, 1, 8));
    await syncFoodExpirationNotifications('user-1', [], 3, new Date(2026, 0, 1, 8, 1));

    expect(plugin.cancel).toHaveBeenCalledOnce();
    expect(plugin.pending).toHaveLength(0);
  });

  it('clears only the signed-out user’s pending reminders', async () => {
    plugin.pending = [
      { id: 1, extra: { source: 'pantry-plate-food-expiration', userId: 'user-1' } },
      { id: 2, extra: { source: 'pantry-plate-food-expiration', userId: 'user-2' } },
    ];

    await clearFoodExpirationNotifications('user-1');

    expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }] });
    expect(plugin.pending).toHaveLength(1);
    expect(plugin.pending[0].id).toBe(2);
  });

  it('sends an explicit test notification when native permission is granted', async () => {
    await sendTestDeviceNotification();

    expect(plugin.createChannel).toHaveBeenCalledOnce();
    expect(plugin.schedule).toHaveBeenCalledOnce();
    expect(plugin.schedule.mock.calls[0][0].notifications[0].body)
      .toBe('Notifications are working on this device.');
  });

  it('reports when native permission is not granted instead of silently succeeding', async () => {
    plugin.permission = 'denied';

    await expect(sendTestDeviceNotification()).rejects.toThrow(
      'Allow notifications in device settings before sending a test.',
    );
    expect(plugin.schedule).not.toHaveBeenCalled();
  });
});
