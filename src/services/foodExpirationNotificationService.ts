import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import type { FoodItem } from '../utils/foodInventory';
import {
  buildFoodExpirationNotificationPlans,
  expirationNotificationId,
  localExpirationNotificationDateKey,
  notificationMarkerKey,
  notificationReminderDateTime,
} from '../utils/foodExpirationNotificationSchedule';

const notificationSource = 'pantry-plate-food-expiration';
const notificationChannelId = 'food-expiration-reminders';
const scheduledMarkerStorageKey = 'pantry-plate.scheduled-expiration-reminders';
const maxScheduledNotifications = 60;

interface ScheduledMarker {
  scheduledAt: number;
}

type ScheduledMarkers = Record<string, ScheduledMarker>;

interface ManagedNotification extends LocalNotificationSchema {
  extra?: {
    source?: string;
    userId?: string;
    reminderKey?: string;
  };
}

export async function syncFoodExpirationNotifications(
  userId: string,
  items: FoodItem[],
  warningDays: number,
  now = new Date(),
): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;

  const pending = (await LocalNotifications.getPending()).notifications as ManagedNotification[];
  const managed = pending.filter((notification) => (
    notification.extra?.source === notificationSource
    && notification.extra.userId === userId
  ));
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') {
    if (managed.length) {
      await LocalNotifications.cancel({ notifications: managed.map(({ id }) => ({ id })) });
    }
    return 0;
  }

  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: notificationChannelId,
      name: 'Food expiration reminders',
      description: 'Reminders for food approaching its expiration date',
      importance: 4,
    });
  }

  const plans = buildFoodExpirationNotificationPlans(items, warningDays, now, maxScheduledNotifications);
  const allPlans = buildFoodExpirationNotificationPlans(items, warningDays, now, Number.MAX_SAFE_INTEGER);
  const skippedCount = allPlans.length - plans.length;
  const markers = readMarkers();
  const usedIds = new Set<number>();
  const desired = plans.map((plan) => ({
    plan,
    id: expirationNotificationId(`${userId}:${plan.triggerDate}`, usedIds),
    reminderKey: notificationMarkerKey(userId, plan.triggerDate),
  }));
  const desiredIds = new Set(desired.map(({ id }) => id));
  const stale = managed.filter((notification) => !desiredIds.has(notification.id));
  if (stale.length) {
    await LocalNotifications.cancel({ notifications: stale.map(({ id }) => ({ id })) });
  }

  const pendingById = new Map(
    managed
      .filter((notification) => desiredIds.has(notification.id))
      .map((notification) => [notification.id, notification]),
  );
  const toSchedule: LocalNotificationSchema[] = [];

  for (const { plan, id, reminderKey } of desired) {
    const pendingNotification = pendingById.get(id);
    if (pendingNotification?.extra?.reminderKey === plan.key) continue;
    if (pendingNotification) {
      await LocalNotifications.cancel({ notifications: [{ id }] });
    }

    const intendedTime = notificationReminderDateTime(plan.triggerDate);
    const scheduledAt = plan.scheduledAt.getTime();
    const marker = markers[reminderKey];
    if (scheduledAt <= now.getTime() + 5_000 && marker && marker.scheduledAt <= now.getTime()) {
      continue;
    }

    toSchedule.push({
      id,
      title: plan.title,
      body: plan.body,
      channelId: notificationChannelId,
      isExactNotification: false,
      schedule: {
        at: plan.scheduledAt,
        allowWhileIdle: true,
      },
      extra: {
        source: notificationSource,
        userId,
        reminderKey: plan.key,
      },
    });
    markers[reminderKey] = { scheduledAt: intendedTime };
  }

  if (toSchedule.length) {
    await LocalNotifications.schedule({ notifications: toSchedule });
    writeMarkers(markers);
  }
  return skippedCount;
}

export async function clearFoodExpirationNotifications(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const pending = (await LocalNotifications.getPending()).notifications as ManagedNotification[];
  const managed = pending.filter((notification) => (
    notification.extra?.source === notificationSource
    && notification.extra.userId === userId
  ));
  if (managed.length) {
    await LocalNotifications.cancel({ notifications: managed.map(({ id }) => ({ id })) });
  }
}

export async function sendTestDeviceNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support device notifications.');
    }
    if (Notification.permission !== 'granted') {
      throw new Error('Allow notifications in your browser settings before sending a test.');
    }
    showBrowserExpirationNotification('Notifications are working on this device.');
    return;
  }

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') {
    throw new Error('Allow notifications in device settings before sending a test.');
  }
  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: notificationChannelId,
      name: 'Food expiration reminders',
      description: 'Reminders for food approaching its expiration date',
      importance: 4,
    });
  }

  const pending = (await LocalNotifications.getPending()).notifications;
  const usedIds = new Set(pending.map(({ id }) => id));
  const id = expirationNotificationId(`test:${Date.now()}`, usedIds);
  await LocalNotifications.schedule({
    notifications: [{
      id,
      title: 'Pantry & Plate',
      body: 'Notifications are working on this device.',
      channelId: notificationChannelId,
      isExactNotification: false,
      schedule: { at: new Date(Date.now() + 1_000), allowWhileIdle: true },
    }],
  });
}

export function showBrowserExpirationNotification(body: string): void {
  if (Capacitor.isNativePlatform() || !('Notification' in window) || Notification.permission !== 'granted') return;
  const notification = new Notification('Food expiration reminder', { body, tag: `food-expiration-${localExpirationNotificationDateKey()}` });
  notification.onclick = () => window.focus();
}

function readMarkers(): ScheduledMarkers {
  try {
    const value = window.localStorage.getItem(scheduledMarkerStorageKey);
    if (!value) return {};
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, ScheduledMarker] => {
        const marker = entry[1];
        return Boolean(
          marker
          && typeof marker === 'object'
          && 'scheduledAt' in marker
          && typeof marker.scheduledAt === 'number'
          && Number.isFinite(marker.scheduledAt),
        );
      }),
    );
  } catch (error) {
    throw new Error(`Unable to read scheduled food reminders: ${String(error)}`);
  }
}

function writeMarkers(markers: ScheduledMarkers): void {
  try {
    window.localStorage.setItem(scheduledMarkerStorageKey, JSON.stringify(markers));
  } catch (error) {
    throw new Error(`Unable to save scheduled food reminders: ${String(error)}`);
  }
}
