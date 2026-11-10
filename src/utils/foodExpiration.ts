import type { FoodItem } from './foodInventory';

export type ExpirationStatus = 'fresh' | 'soon' | 'expired' | 'none' | 'invalid';
export type ExpirationFilter = ExpirationStatus | 'all';

export interface ExpirationResult {
  status: ExpirationStatus;
  remainingDays: number | null;
  countdown: string;
  label: string;
}

export const defaultExpirationWarningDays = 7;
export const expirationWarningOptions = [3, 5, 7, 10, 14, 30] as const;

export function isValidLocalDate(value: string): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

function localDateOrdinal(value: string): number | null {
  if (!isValidLocalDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getExpirationResult(
  expirationDate: string,
  warningDays = defaultExpirationWarningDays,
  today = new Date(),
): ExpirationResult {
  if (!expirationDate) {
    return {
      status: 'none',
      remainingDays: null,
      countdown: 'No expiration date recorded',
      label: 'No expiration date',
    };
  }

  const expirationOrdinal = localDateOrdinal(expirationDate);
  const todayOrdinal = localDateOrdinal(localDateKey(today));
  if (expirationOrdinal === null || todayOrdinal === null) {
    return {
      status: 'invalid',
      remainingDays: null,
      countdown: 'Invalid expiration date',
      label: 'Invalid date',
    };
  }

  const remainingDays = expirationOrdinal - todayOrdinal;
  if (remainingDays < 0) {
    const daysAgo = Math.abs(remainingDays);
    return {
      status: 'expired',
      remainingDays,
      countdown: `Expired ${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`,
      label: 'Expired',
    };
  }
  if (remainingDays <= warningDays) {
    return {
      status: 'soon',
      remainingDays,
      countdown: remainingDays === 0
        ? 'Expires today'
        : `Expires in ${remainingDays} ${remainingDays === 1 ? 'day' : 'days'}`,
      label: 'Expiring soon',
    };
  }
  return {
    status: 'fresh',
    remainingDays,
    countdown: `Expires in ${remainingDays} ${remainingDays === 1 ? 'day' : 'days'}`,
    label: 'Fresh',
  };
}

export function getExpirationResultForItem(
  item: FoodItem,
  warningDays = defaultExpirationWarningDays,
  today = new Date(),
): ExpirationResult {
  return getExpirationResult(item.expirationDate, warningDays, today);
}

export function filterAndSortExpiringItems(
  items: FoodItem[],
  options: {
    search: string;
    status: ExpirationFilter;
    warningDays: number;
    today?: Date;
  },
): FoodItem[] {
  const search = options.search.trim().toLocaleLowerCase();
  return items
    .filter((item) => !search || item.foodName.toLocaleLowerCase().includes(search))
    .filter((item) => (
      options.status === 'all'
      || getExpirationResultForItem(item, options.warningDays, options.today).status === options.status
    ))
    .sort((a, b) => {
      const aDate = isValidLocalDate(a.expirationDate) ? a.expirationDate : a.expirationDate ? '9999-12-30' : '9999-12-31';
      const bDate = isValidLocalDate(b.expirationDate) ? b.expirationDate : b.expirationDate ? '9999-12-30' : '9999-12-31';
      return aDate.localeCompare(bDate) || a.foodName.localeCompare(b.foodName);
    });
}

export function getCurrentExpirationWarnings(
  items: FoodItem[],
  warningDays: number,
  today = new Date(),
): Array<{ item: FoodItem; result: ExpirationResult }> {
  return filterAndSortExpiringItems(items, {
    search: '',
    status: 'all',
    warningDays,
    today,
  })
    .map((item) => ({ item, result: getExpirationResultForItem(item, warningDays, today) }))
    .filter(({ result }) => result.status === 'soon' || result.status === 'expired');
}
