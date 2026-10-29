import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, formatDate, parseIsoDate, todayIso } from './dates';

describe('dates', () => {
  it('parses valid ISO dates and rejects invalid ones', () => {
    expect(parseIsoDate('2026-10-29')).toBe(Date.UTC(2026, 9, 29));
    expect(parseIsoDate('2026-02-31')).toBeNaN();
    expect(parseIsoDate('29/10/2026')).toBeNaN();
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-10-29', '2026-11-08')).toBe(10);
    expect(daysBetween('2026-11-08', '2026-10-29')).toBe(-10);
  });

  it('formats dates for India and returns local today', () => {
    expect(formatDate('2026-10-29')).toBe('29 Oct 2026');
    expect(todayIso(new Date(2026, 9, 29, 23, 30))).toBe('2026-10-29');
  });
});
