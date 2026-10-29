import { EVENT_TYPES, PRIORITIES, type EventDetails, type EventType, type Priority } from '../types.js';
import { daysBetween, parseIsoDate } from './dates.js';

export const LIMITS = {
  titleMax: 80,
  cityMax: 60,
  preferencesMax: 400,
  questionMax: 300,
  guestsMin: 1,
  guestsMax: 5000,
  budgetMin: 1000,
  budgetMax: 100_000_000,
  maxDaysAhead: 730,
} as const;

export type FieldErrors = Partial<Record<keyof EventDetails, string>>;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

/**
 * Normalises free text: strips control characters and angle brackets,
 * collapses whitespace and enforces a maximum length.
 */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function toInt(value: unknown): number {
  const n = typeof value === 'string' ? Number(value.replace(/[,\s₹]/g, '')) : Number(value);
  return Number.isFinite(n) ? Math.round(n) : Number.NaN;
}

const isEventType = (v: unknown): v is EventType => EVENT_TYPES.includes(v as EventType);
const isPriority = (v: unknown): v is Priority => PRIORITIES.includes(v as Priority);

/**
 * Validates untrusted event input. The same function guards the form in the
 * browser and the API on the server, so both enforce identical rules.
 */
export function validateEventDetails(input: unknown, today: string): ValidationResult<EventDetails> {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const errors: FieldErrors = {};

  const eventType = raw.eventType;
  if (!isEventType(eventType)) errors.eventType = 'Choose an event type.';

  const title = cleanText(raw.title, LIMITS.titleMax);

  const date = typeof raw.date === 'string' ? raw.date : '';
  if (Number.isNaN(parseIsoDate(date))) {
    errors.date = 'Enter a valid date.';
  } else {
    const ahead = daysBetween(today, date);
    if (ahead < 0) errors.date = 'The event date must be today or later.';
    else if (ahead > LIMITS.maxDaysAhead) errors.date = 'Pick a date within the next two years.';
  }

  const city = cleanText(raw.city, LIMITS.cityMax);
  if (city.length < 2) errors.city = 'Enter the city or town.';

  const guests = toInt(raw.guests);
  if (Number.isNaN(guests) || guests < LIMITS.guestsMin || guests > LIMITS.guestsMax) {
    errors.guests = `Guests must be between ${LIMITS.guestsMin} and ${LIMITS.guestsMax}.`;
  }

  const budget = toInt(raw.budget);
  if (Number.isNaN(budget) || budget < LIMITS.budgetMin || budget > LIMITS.budgetMax) {
    errors.budget = `Budget must be between ₹${LIMITS.budgetMin.toLocaleString('en-IN')} and ₹${LIMITS.budgetMax.toLocaleString('en-IN')}.`;
  }

  const priorities = Array.isArray(raw.priorities)
    ? [...new Set(raw.priorities.filter(isPriority))].slice(0, 2)
    : [];

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      eventType: eventType as EventType,
      title,
      date,
      city,
      guests,
      budget,
      preferences: cleanText(raw.preferences, LIMITS.preferencesMax),
      priorities,
    },
  };
}
