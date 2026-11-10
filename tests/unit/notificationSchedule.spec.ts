import { describe, expect, it } from 'vitest';
import { daysBetweenCalendarDates, localDateForTimezone } from '../../src/utils/notificationSchedule';

describe('notification scheduling dates', () => {
  it('uses the account time zone when the UTC date differs', () => {
    expect(localDateForTimezone(new Date('2026-01-01T02:00:00.000Z'), 'America/Los_Angeles'))
      .toBe('2025-12-31');
  });

  it('falls back to UTC for an invalid time zone', () => {
    expect(localDateForTimezone(new Date('2026-01-01T02:00:00.000Z'), 'Not/A_Timezone'))
      .toBe('2026-01-01');
  });

  it('computes calendar days across month and leap-day boundaries', () => {
    expect(daysBetweenCalendarDates('2024-02-28', '2024-03-01')).toBe(2);
    expect(daysBetweenCalendarDates('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetweenCalendarDates('2026-02-30', '2026-03-01')).toBeNull();
  });
});
