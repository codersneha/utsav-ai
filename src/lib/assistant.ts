import {
  AGE_GROUPS,
  DIETS,
  EVENT_TYPES,
  PRIORITIES,
  VENUE_TYPES,
  type ChangeProposal,
  type EventDetails,
} from '../types.js';
import { toObject } from './aiOutput.js';
import { daysBetween, parseIsoDate } from './dates.js';
import {
  LIMITS,
  cleanText,
  isAgeGroup,
  isDiet,
  isEventType,
  isPriority,
  isVenueType,
  pickAllowed,
  toInt,
  validateEventDetails,
} from './validation.js';

/** Gemini schema for turning a free-text description into form fields. */
export const EXTRACT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    eventType: { type: 'STRING', enum: [...EVENT_TYPES] },
    title: { type: 'STRING' },
    date: { type: 'STRING', description: 'YYYY-MM-DD' },
    city: { type: 'STRING' },
    guests: { type: 'INTEGER' },
    budget: { type: 'INTEGER', description: 'Total budget in INR' },
    preferences: { type: 'STRING' },
    priorities: { type: 'ARRAY', items: { type: 'STRING', enum: [...PRIORITIES] } },
    venueType: { type: 'STRING', enum: [...VENUE_TYPES] },
    diets: { type: 'ARRAY', items: { type: 'STRING', enum: [...DIETS] } },
    ageGroup: { type: 'STRING', enum: [...AGE_GROUPS] },
    colors: { type: 'STRING' },
  },
} as const;

/**
 * Validates extracted fields one by one. Anything doubtful is dropped, so the
 * user only ever sees values they can check in the form before planning.
 */
export function parseExtracted(raw: unknown, today: string): Partial<EventDetails> | null {
  const obj = toObject(raw);
  if (!obj) return null;
  const out: Partial<EventDetails> = {};

  if (isEventType(obj.eventType)) out.eventType = obj.eventType;
  const title = cleanText(obj.title, LIMITS.titleMax);
  if (title) out.title = title;
  if (typeof obj.date === 'string' && !Number.isNaN(parseIsoDate(obj.date))) {
    const ahead = daysBetween(today, obj.date);
    if (ahead >= 0 && ahead <= LIMITS.maxDaysAhead) out.date = obj.date;
  }
  const city = cleanText(obj.city, LIMITS.cityMax);
  if (city.length >= 2) out.city = city;
  const guests = toInt(obj.guests);
  if (guests >= LIMITS.guestsMin && guests <= LIMITS.guestsMax) out.guests = guests;
  const budget = toInt(obj.budget);
  if (budget >= LIMITS.budgetMin && budget <= LIMITS.budgetMax) out.budget = budget;
  const preferences = cleanText(obj.preferences, LIMITS.preferencesMax);
  if (preferences) out.preferences = preferences;
  const priorities = pickAllowed(obj.priorities, isPriority, 2);
  if (priorities.length > 0) out.priorities = priorities;
  if (isVenueType(obj.venueType) && obj.venueType !== 'undecided') out.venueType = obj.venueType;
  const diets = pickAllowed(obj.diets, isDiet, DIETS.length);
  if (diets.length > 0) out.diets = diets;
  if (isAgeGroup(obj.ageGroup) && obj.ageGroup !== 'mixed') out.ageGroup = obj.ageGroup;
  const colors = cleanText(obj.colors, LIMITS.colorsMax);
  if (colors) out.colors = colors;

  return Object.keys(out).length > 0 ? out : null;
}

/** Gemini schema for assistant answers, with an optional change proposal. */
export const ASK_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING' },
    proposal: {
      type: 'OBJECT',
      properties: {
        guests: { type: 'INTEGER' },
        budget: { type: 'INTEGER' },
        date: { type: 'STRING', description: 'YYYY-MM-DD' },
        summary: { type: 'STRING' },
      },
      required: ['summary'],
    },
  },
  required: ['answer'],
} as const;

/**
 * Validates a proposed change against the current event: values must form a
 * valid plan and actually differ, otherwise the proposal is dropped.
 */
export function parseProposal(
  raw: unknown,
  details: EventDetails,
  today: string,
): ChangeProposal | undefined {
  const obj = toObject(raw);
  if (!obj) return undefined;
  const patch: Partial<Pick<EventDetails, 'guests' | 'budget' | 'date'>> = {};
  if (obj.guests !== undefined && toInt(obj.guests) !== details.guests) patch.guests = toInt(obj.guests);
  if (obj.budget !== undefined && toInt(obj.budget) !== details.budget) patch.budget = toInt(obj.budget);
  if (typeof obj.date === 'string' && obj.date !== details.date) patch.date = obj.date;
  if (Object.keys(patch).length === 0) return undefined;
  if (!validateEventDetails({ ...details, ...patch }, today).ok) return undefined;
  const summary = cleanText(obj.summary, 160) || 'Update the plan';
  return { ...patch, summary };
}
