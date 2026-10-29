import {
  AGE_GROUPS,
  DIETS,
  EVENT_TYPES,
  LANGUAGES,
  PRIORITIES,
  VENUE_TYPES,
  type AgeGroup,
  type Diet,
  type EventDetails,
  type EventType,
  type Language,
  type Priority,
  type VenueType,
} from '../types.js';
import { TRADITIONS, TRADITION_DATA, type TraditionId } from './culture/traditions.js';
import { daysBetween, parseIsoDate } from './dates.js';

export const LIMITS = {
  titleMax: 80,
  cityMax: 60,
  preferencesMax: 400,
  colorsMax: 60,
  questionMax: 300,
  refinementMax: 200,
  venueMax: 100,
  describeMin: 10,
  describeMax: 600,
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

export function toInt(value: unknown): number {
  const n = typeof value === 'string' ? Number(value.replace(/[,\s₹]/g, '')) : Number(value);
  return Number.isFinite(n) ? Math.round(n) : Number.NaN;
}

export const isEventType = (v: unknown): v is EventType => EVENT_TYPES.includes(v as EventType);
export const isPriority = (v: unknown): v is Priority => PRIORITIES.includes(v as Priority);
export const isDiet = (v: unknown): v is Diet => DIETS.includes(v as Diet);
export const isVenueType = (v: unknown): v is VenueType => VENUE_TYPES.includes(v as VenueType);
export const isAgeGroup = (v: unknown): v is AgeGroup => AGE_GROUPS.includes(v as AgeGroup);
export const isTradition = (v: unknown): v is TraditionId => TRADITIONS.includes(v as TraditionId);
export const isLanguage = (v: unknown): v is Language => LANGUAGES.includes(v as Language);

/** Keeps only allowed values from an untrusted array, without duplicates. */
export function pickAllowed<T>(value: unknown, isAllowed: (v: unknown) => v is T, max: number): T[] {
  return Array.isArray(value) ? [...new Set(value.filter(isAllowed))].slice(0, max) : [];
}

/** Keeps ceremony ids that exist for the chosen tradition (weddings only). */
function validCeremonies(raw: Record<string, unknown>, eventType: EventType): string[] {
  if (eventType !== 'wedding' || !Array.isArray(raw.ceremonies)) return [];
  const tradition = isTradition(raw.tradition) ? raw.tradition : 'modern';
  const known = new Set(TRADITION_DATA[tradition].ceremonies.map((c) => c.id));
  return [...new Set(raw.ceremonies.filter((c): c is string => typeof c === 'string' && known.has(c)))];
}

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
      priorities: pickAllowed(raw.priorities, isPriority, 2),
      // Optional fields fall back to neutral defaults, so older saved plans still load.
      venueType: isVenueType(raw.venueType) ? raw.venueType : 'undecided',
      diets: pickAllowed(raw.diets, isDiet, DIETS.length),
      ageGroup: isAgeGroup(raw.ageGroup) ? raw.ageGroup : 'mixed',
      colors: cleanText(raw.colors, LIMITS.colorsMax),
      language: isLanguage(raw.language) ? raw.language : 'en',
      tradition: isTradition(raw.tradition) ? raw.tradition : 'modern',
      ceremonies: validCeremonies(raw, eventType as EventType),
      venueName: cleanText(raw.venueName, LIMITS.venueMax),
    },
  };
}
