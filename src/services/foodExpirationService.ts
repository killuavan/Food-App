import { defaultExpirationWarningDays, localDateKey } from '../utils/foodExpiration';

function warningPreferenceKey(userId: string): string {
  return `food-inventory.expiration-warning-days.${userId}`;
}

function alertShownKey(userId: string): string {
  return `food-inventory.expiration-alert-shown.${userId}`;
}

export function getExpirationWarningDays(userId: string): number {
  let saved: string | null;
  try {
    saved = window.localStorage.getItem(warningPreferenceKey(userId));
  } catch (error) {
    throw new Error(`Unable to read expiration alert settings: ${String(error)}`);
  }
  if (!saved) return defaultExpirationWarningDays;
  const value = Number(saved);
  return Number.isInteger(value) && value >= 1 && value <= 30
    ? value
    : defaultExpirationWarningDays;
}

export function saveExpirationWarningDays(userId: string, warningDays: number): void {
  if (!Number.isInteger(warningDays) || warningDays < 1 || warningDays > 30) {
    throw new Error('Expiration warning period must be from 1 to 30 days.');
  }
  try {
    window.localStorage.setItem(warningPreferenceKey(userId), String(warningDays));
  } catch (error) {
    throw new Error(`Unable to save expiration alert settings: ${String(error)}`);
  }
}

export function hasShownExpirationAlertToday(userId: string, today = new Date()): boolean {
  try {
    return window.localStorage.getItem(alertShownKey(userId)) === localDateKey(today);
  } catch (error) {
    throw new Error(`Unable to check expiration alert history: ${String(error)}`);
  }
}

export function markExpirationAlertShownToday(userId: string, today = new Date()): void {
  try {
    window.localStorage.setItem(alertShownKey(userId), localDateKey(today));
  } catch (error) {
    throw new Error(`Unable to save expiration alert history: ${String(error)}`);
  }
}
