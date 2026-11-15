import type { FoodItem } from './foodInventory';
import { getExpirationResultForItem, isValidLocalDate, localDateKey } from './foodExpiration';

export interface FoodExpirationNotificationPlan {
  key: string;
  triggerDate: string;
  title: string;
  body: string;
  scheduledAt: Date;
}

interface NotificationEntry {
  item: FoodItem;
  triggerDate: string;
}

export function buildFoodExpirationNotificationPlans(
  items: FoodItem[],
  warningDays: number,
  now = new Date(),
  limit = 60,
): FoodExpirationNotificationPlan[] {
  const today = localDateKey(now);
  const groups = new Map<string, NotificationEntry[]>();

  for (const item of items) {
    if (!item.expirationDate || !isValidLocalDate(item.expirationDate) || item.quantity <= 0) continue;

    const result = getExpirationResultForItem(item, warningDays, now);
    if (result.status === 'expired' || result.status === 'invalid' || result.remainingDays === null) continue;

    const warningStart = addCalendarDays(item.expirationDate, -warningDays);
    const triggerDate = warningStart <= today ? today : warningStart;
    const group = groups.get(triggerDate) ?? [];
    group.push({ item, triggerDate });
    groups.set(triggerDate, group);
  }

  return [...groups.entries()]
    .map(([triggerDate, entries]) => makePlan(triggerDate, entries, now))
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    .slice(0, limit);
}

function makePlan(
  triggerDate: string,
  entries: NotificationEntry[],
  now: Date,
): FoodExpirationNotificationPlan {
  const sortedEntries = [...entries].sort((a, b) => (
    a.item.expirationDate.localeCompare(b.item.expirationDate)
    || a.item.foodName.localeCompare(b.item.foodName)
    || a.item.id.localeCompare(b.item.id)
  ));
  const names = sortedEntries.slice(0, 3).map(({ item }) => `${item.foodName} (${item.expirationDate})`);
  const moreCount = sortedEntries.length - names.length;
  if (moreCount > 0) names.push(`and ${moreCount} more`);

  const scheduledAt = localDateAtNine(triggerDate);
  if (scheduledAt.getTime() <= now.getTime()) {
    scheduledAt.setTime(now.getTime() + 5_000);
  }

  return {
    key: `${triggerDate}:${sortedEntries.map(({ item }) => `${item.id}@${item.expirationDate}`).join(',')}`,
    triggerDate,
    title: 'Food expiration reminder',
    body: `Use soon: ${names.join(', ')}`,
    scheduledAt,
  };
}

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(year, month - 1, day + days);
  return localDateKey(result);
}

function localDateAtNine(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 9);
}

export function expirationNotificationId(value: string, usedIds: Set<number>): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  let id = 1_000_000_000 + ((hash >>> 0) % 1_000_000_000);
  while (usedIds.has(id)) {
    id = id === 1_999_999_999 ? 1_000_000_000 : id + 1;
  }
  usedIds.add(id);
  return id;
}

export function localExpirationNotificationDateKey(now = new Date()): string {
  return localDateKey(now);
}

export function notificationReminderDateTime(date: string): number {
  return localDateAtNine(date).getTime();
}

export function notificationMarkerKey(userId: string, triggerDate: string): string {
  return `${userId}:${triggerDate}`;
}
