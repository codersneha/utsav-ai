import type { EventDetails, EventPlan } from '../types.js';
import { daysBetween, formatDate } from './dates.js';
import { formatInr } from './plan.js';

export interface PlanChange {
  /** Human-readable lines describing what changed and its impact. */
  lines: string[];
  /** Whether AI ideas and logistics should be regenerated. */
  refreshAi: boolean;
  /** Whether checklist progress, vendors and spending were reset (event type changed). */
  reset: boolean;
}

const signed = (n: number, format: (v: number) => string = String) =>
  `${n > 0 ? '+' : '−'}${format(Math.abs(n))}`;

/** Fields whose change makes the AI suggestions stale. */
const AI_FIELDS: (keyof EventDetails)[] = [
  'eventType',
  'city',
  'guests',
  'budget',
  'date',
  'preferences',
  'priorities',
  'venueType',
  'diets',
  'ageGroup',
  'colors',
  'language',
  'tradition',
  'ceremonies',
];

/**
 * Explains how an edit (e.g. "50 more guests, smaller budget, two weeks
 * earlier") changes the plan, so users revise instead of starting over.
 */
export function describeChanges(before: EventPlan, after: EventPlan, today: string): PlanChange {
  const a = before.details;
  const b = after.details;
  const lines: string[] = [];
  const reset = a.eventType !== b.eventType;

  if (reset)
    lines.push(`Event type changed to ${b.eventType}: budget, timeline and vendor checklist were rebuilt.`);

  if (a.guests !== b.guests) {
    const food = after.budget.lines.find((l) => l.id === 'catering');
    const perGuest =
      food && b.guests > 0
        ? `; food is now about ${formatInr(Math.round(food.amount / b.guests))} per guest`
        : '';
    lines.push(`Guests: ${a.guests} → ${b.guests} (${signed(b.guests - a.guests)})${perGuest}.`);
  }

  if (a.budget !== b.budget) {
    lines.push(
      `Budget: ${formatInr(a.budget)} → ${formatInr(b.budget)} (${signed(b.budget - a.budget, formatInr)}).`,
    );
  }

  if (a.date !== b.date) {
    const shift = daysBetween(a.date, b.date);
    const when = shift < 0 ? `${Math.abs(shift)} days earlier` : `${shift} days later`;
    const sooner = after.timeline.milestones.filter((m) => {
      const old = before.timeline.milestones.find((o) => o.id === m.id);
      return old !== undefined && m.due < old.due;
    }).length;
    const overdue = after.timeline.milestones.filter((m) => m.due < today && m.daysBefore > 0).length;
    let impact = sooner > 0 ? ` ${sooner} tasks are now due sooner.` : '';
    if (overdue > 0) impact += ` ${overdue} are already past due — check the Timeline tab.`;
    lines.push(`Date moved ${when} (${formatDate(a.date)} → ${formatDate(b.date)}).${impact}`);
  }

  if (a.city !== b.city) lines.push(`City changed to ${b.city}: vendor search links were updated.`);
  if (a.venueType !== b.venueType && (b.venueType === 'restaurant' || b.venueType === 'cafe')) {
    lines.push(
      `The venue is a ${b.venueType === 'cafe' ? 'café' : 'restaurant'}, so it serves the food — no separate caterer needed.`,
    );
  }
  if (a.venuePreference !== b.venuePreference && b.venuePreference) {
    lines.push(`Venue preference: ${b.venuePreference}.`);
  }
  if (a.venueName !== b.venueName) {
    lines.push(b.venueName ? `Venue set to ${b.venueName}.` : 'Venue cleared.');
  }

  const refreshAi = AI_FIELDS.some((f) => JSON.stringify(a[f]) !== JSON.stringify(b[f]));
  if (lines.length === 0) lines.push(refreshAi ? 'Preferences updated.' : 'No changes to the plan.');
  if (!reset) lines.push('Kept: your budget edits, completed tasks, vendor records and spending.');
  if (refreshAi) lines.push('Ideas and the day-of schedule are being refreshed for the new details.');
  return { lines, refreshAi, reset };
}
