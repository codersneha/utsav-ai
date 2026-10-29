import type { EventType, Logistics, ScheduleItem, VendorAdvice } from '../types.js';
import { cleanList, cleanObjects, toObject } from './aiOutput.js';
import { fallbackVendorAdvice, vendorGroupsFor } from './checklist.js';
import { cleanText } from './validation.js';

/** JSON schema for the logistics request (Gemini structured output). */
export const LOGISTICS_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    daySchedule: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { time: { type: 'STRING' }, activity: { type: 'STRING' } },
        required: ['time', 'activity'],
      },
    },
    vendors: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          questions: { type: 'ARRAY', items: { type: 'STRING' } },
          tasks: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['id', 'questions', 'tasks'],
      },
    },
  },
  required: ['daySchedule', 'vendors'],
} as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const pickScheduleItem = (o: Record<string, unknown>): ScheduleItem | null => {
  const time = typeof o.time === 'string' ? o.time.trim() : '';
  const activity = cleanText(o.activity, 160);
  return TIME.test(time) && activity ? { time, activity } : null;
};

/**
 * Validates logistics output for a given event type. Vendor ids the model
 * invents are dropped, times must be HH:MM, and the schedule is sorted.
 */
export function parseLogistics(raw: unknown, eventType: EventType): Logistics | null {
  const obj = toObject(raw);
  if (!obj) return null;

  const daySchedule = cleanObjects(obj.daySchedule, 14, pickScheduleItem).sort((a, b) =>
    a.time.localeCompare(b.time),
  );
  const allowed = new Set(vendorGroupsFor(eventType).map((g) => g.id));
  const vendors: Record<string, VendorAdvice> = {};
  for (const entry of cleanObjects(obj.vendors, 12, (o) => o)) {
    const id = typeof entry.id === 'string' ? entry.id : '';
    if (!allowed.has(id) || vendors[id]) continue;
    vendors[id] = { questions: cleanList(entry.questions, 3, 200), tasks: cleanList(entry.tasks, 2, 140) };
  }
  if (daySchedule.length < 3 || Object.keys(vendors).length === 0) return null;
  return { daySchedule, vendors, source: 'gemini' };
}

const FALLBACK_SCHEDULES: Record<EventType, ScheduleItem[]> = {
  wedding: [
    { time: '08:00', activity: 'Vendors arrive; decor and sound setup begins' },
    { time: '10:00', activity: 'Bride and groom getting ready; photographer starts candid shots' },
    { time: '16:00', activity: 'Guests arrive; welcome drinks and seating' },
    { time: '17:00', activity: 'Baraat / entry procession' },
    { time: '18:30', activity: 'Main ceremony' },
    { time: '20:30', activity: 'Dinner service opens' },
    { time: '21:30', activity: 'Family photos and music' },
    { time: '23:30', activity: 'Vidaai / send-off; vendor pack-up' },
  ],
  birthday: [
    { time: '15:00', activity: 'Decor and table setup' },
    { time: '16:30', activity: 'Guests arrive; welcome activity' },
    { time: '17:00', activity: 'Games and entertainment' },
    { time: '18:00', activity: 'Cake cutting and photos' },
    { time: '18:30', activity: 'Food served' },
    { time: '19:30', activity: 'Return gifts and goodbyes' },
  ],
  community: [
    { time: '07:00', activity: 'Volunteers report; stalls and stage setup' },
    { time: '09:00', activity: 'Sound check and safety walkthrough' },
    { time: '10:00', activity: 'Gates open; registration desk live' },
    { time: '11:00', activity: 'Opening address and first performances' },
    { time: '13:00', activity: 'Food stalls busiest — extra volunteers at queues' },
    { time: '16:00', activity: 'Competitions and prize distribution' },
    { time: '18:00', activity: 'Closing; waste segregation and cleanup' },
  ],
};

/** Curated logistics used when Gemini is unavailable. */
export function fallbackLogistics(eventType: EventType): Logistics {
  return {
    daySchedule: FALLBACK_SCHEDULES[eventType],
    vendors: fallbackVendorAdvice(eventType),
    source: 'fallback',
  };
}
