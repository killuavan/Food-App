import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export type DeviceNotificationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';
export const deviceNotificationPermissionChangedEventName = 'device-notification-permission-changed';

export function notifyDeviceNotificationPermissionChanged(): void {
  window.dispatchEvent(new Event(deviceNotificationPermissionChangedEventName));
}

export async function getDeviceNotificationPermission(): Promise<DeviceNotificationPermission> {
  if (Capacitor.isNativePlatform()) {
    const status = await LocalNotifications.checkPermissions();
    return normalizeNativePermission(status.display);
  }
  if (!('Notification' in window)) return 'unsupported';
  return normalizeBrowserPermission(Notification.permission);
}

export async function requestDeviceNotificationPermission(): Promise<DeviceNotificationPermission> {
  if (Capacitor.isNativePlatform()) {
    const status = await LocalNotifications.requestPermissions();
    return normalizeNativePermission(status.display);
  }
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') {
    return normalizeBrowserPermission(await Notification.requestPermission());
  }
  return normalizeBrowserPermission(Notification.permission);
}

function normalizeBrowserPermission(permission: NotificationPermission): DeviceNotificationPermission {
  if (permission === 'granted' || permission === 'denied') return permission;
  return 'prompt';
}

function normalizeNativePermission(permission: string): DeviceNotificationPermission {
  if (permission === 'granted' || permission === 'denied') return permission;
  return 'prompt';
}
