import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  getDeviceNotificationPermission,
  requestDeviceNotificationPermission,
} from '../../src/services/deviceNotificationPermissionService';

class MockNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = vi.fn<() => Promise<NotificationPermission>>();
}

describe('device notification permission', () => {
  beforeEach(() => {
    MockNotification.requestPermission.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('reports browser permission as not enabled before prompting', async () => {
    MockNotification.permission = 'default';
    vi.stubGlobal('Notification', MockNotification);

    await expect(getDeviceNotificationPermission()).resolves.toBe('prompt');
  });

  test('requests browser permission only when explicitly invoked', async () => {
    MockNotification.permission = 'default';
    MockNotification.requestPermission.mockResolvedValue('granted');
    vi.stubGlobal('Notification', MockNotification);

    await expect(requestDeviceNotificationPermission()).resolves.toBe('granted');
    expect(MockNotification.requestPermission).toHaveBeenCalledOnce();
  });

  test('does not request permission again when the browser has already blocked it', async () => {
    MockNotification.permission = 'denied';
    MockNotification.requestPermission.mockResolvedValue('granted');
    vi.stubGlobal('Notification', MockNotification);

    await expect(requestDeviceNotificationPermission()).resolves.toBe('denied');
    expect(MockNotification.requestPermission).not.toHaveBeenCalled();
  });
});
