const MS_PER_DAY = 86_400_000;

/** Parses YYYY-MM-DD as a UTC midnight timestamp, or NaN if invalid. */
export function parseIsoDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.NaN;
  const ms = Date.parse(`${value}T00:00:00Z`);
  // Reject roll-overs such as 2026-02-31.
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== value) return Number.NaN;
  return ms;
}

function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIsoDate(parseIsoDate(iso) + days * MS_PER_DAY);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to) - parseIsoDate(from)) / MS_PER_DAY);
}

/** Today's date in the user's local calendar, as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseIsoDate(iso));
}
