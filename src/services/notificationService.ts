import { getSupabaseClient } from './supabaseClient';

export const notificationTypes = [
  'FOOD_EXPIRING',
  'FOOD_EXPIRED',
  'LOW_STOCK',
  'OUT_OF_STOCK',
  'GROCERY_REMINDER',
] as const;

export type NotificationType = (typeof notificationTypes)[number];
export type GroceryReminderFrequency = 'DAILY' | 'WEEKLY';

export interface NotificationPreferences {
  email_enabled: boolean;
  food_expiring_enabled: boolean;
  food_expired_enabled: boolean;
  low_stock_enabled: boolean;
  out_of_stock_enabled: boolean;
  grocery_reminder_enabled: boolean;
  expiration_days: number;
  grocery_frequency: GroceryReminderFrequency;
  time_zone: string;
}

export interface NotificationHistoryEntry {
  id: string;
  notification_type: NotificationType;
  title: string;
  summary: string;
  created_at: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
}

export const defaultNotificationPreferences = (): NotificationPreferences => ({
  email_enabled: false,
  food_expiring_enabled: true,
  food_expired_enabled: true,
  low_stock_enabled: true,
  out_of_stock_enabled: true,
  grocery_reminder_enabled: true,
  expiration_days: 3,
  grocery_frequency: 'WEEKLY',
  time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
});

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await getSupabaseClient()
    .from('notification_preferences')
    .select('email_enabled,food_expiring_enabled,food_expired_enabled,low_stock_enabled,out_of_stock_enabled,grocery_reminder_enabled,expiration_days,grocery_frequency,time_zone')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...defaultNotificationPreferences(), ...data } : defaultNotificationPreferences();
}

export async function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('notification_preferences')
    .upsert({ user_id: userId, ...preferences, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function listNotificationHistory(
  userId: string,
  filters: { type: NotificationType | 'ALL'; fromDate: string; toDate: string },
): Promise<NotificationHistoryEntry[]> {
  let request = getSupabaseClient()
    .from('notification_history')
    .select('id,notification_type,title,summary,created_at,status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (filters.type !== 'ALL') request = request.eq('notification_type', filters.type);
  if (filters.fromDate) request = request.gte('created_at', localDateBoundary(filters.fromDate));
  if (filters.toDate) request = request.lt('created_at', localDateBoundary(filters.toDate, 1));
  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []) as NotificationHistoryEntry[];
}

function localDateBoundary(value: string, daysToAdd = 0): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString();
}
