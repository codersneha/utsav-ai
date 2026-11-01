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

/** The two versions of a plan being compared. */
interface Diff {
  before: EventPlan;
  after: EventPlan;
  a: EventDetails;
  b: EventDetails;
  today: string;
}

type Describer = (d: Diff) => string | null;

const eventTypeLine: Describer = ({ a, b }) =>
  a.eventType !== b.eventType
    ? `Event type changed to ${b.eventType}: budget, timeline and vendor checklist were rebuilt.`
    : null;

const guestsLine: Describer = ({ a, b, after }) => {
  if (a.guests === b.guests) return null;
  const food = after.budget.lines.find((l) => l.id === 'catering');
  const perGuest =
    food && b.guests > 0
      ? `; food is now about ${formatInr(Math.round(food.amount / b.guests))} per guest`
      : '';
  return `Guests: ${a.guests} → ${b.guests} (${signed(b.guests - a.guests)})${perGuest}.`;
};

const budgetLine: Describer = ({ a, b }) =>
  a.budget !== b.budget
    ? `Budget: ${formatInr(a.budget)} → ${formatInr(b.budget)} (${signed(b.budget - a.budget, formatInr)}).`
    : null;

/** How a new date affects the timeline: tasks pulled earlier and tasks already past due. */
function dateImpact({ before, after, today }: Diff): string {
  const sooner = after.timeline.milestones.filter((m) => {
    const old = before.timeline.milestones.find((o) => o.id === m.id);
    return old !== undefined && m.due < old.due;
  }).length;
  const overdue = after.timeline.milestones.filter((m) => m.due < today && m.daysBefore > 0).length;
  const parts = [
    sooner > 0 ? ` ${sooner} tasks are now due sooner.` : '',
    overdue > 0 ? ` ${overdue} are already past due — check the Timeline tab.` : '',
  ];
  return parts.join('');
}

const dateLine: Describer = (d) => {
  const { a, b } = d;
  if (a.date === b.date) return null;
  const shift = daysBetween(a.date, b.date);
  const when = shift < 0 ? `${Math.abs(shift)} days earlier` : `${shift} days later`;
  return `Date moved ${when} (${formatDate(a.date)} → ${formatDate(b.date)}).${dateImpact(d)}`;
};

const cityLine: Describer = ({ a, b }) =>
  a.city !== b.city ? `City changed to ${b.city}: vendor search links were updated.` : null;

const servedByVenueLine: Describer = ({ a, b }) =>
  a.venueType !== b.venueType && (b.venueType === 'restaurant' || b.venueType === 'cafe')
    ? `The venue is a ${b.venueType === 'cafe' ? 'café' : 'restaurant'}, so it serves the food — no separate caterer needed.`
    : null;

const venuePreferenceLine: Describer = ({ a, b }) =>
  a.venuePreference !== b.venuePreference && b.venuePreference
    ? `Venue preference: ${b.venuePreference}.`
    : null;

const decorLine: Describer = ({ a, b }) => {
  if (a.wantsDecor === b.wantsDecor) return null;
  return b.wantsDecor
    ? 'Décor is back on: money is set aside for it and decorators are on your checklist.'
    : 'Décor is off: its money went to the other categories and decorators left your checklist. Décor ideas stay in the Ideas tab if you change your mind.';
};

const venueLine: Describer = ({ a, b }) => {
  if (a.venueName === b.venueName) return null;
  return b.venueName ? `Venue set to ${b.venueName}.` : 'Venue cleared.';
};

/** Each kind of change, in the order the report lists them. */
const DESCRIBERS: Describer[] = [
  eventTypeLine,
  guestsLine,
  budgetLine,
  dateLine,
  cityLine,
  servedByVenueLine,
  venuePreferenceLine,
  decorLine,
  venueLine,
];

/**
 * Explains how an edit (e.g. "50 more guests, smaller budget, two weeks
 * earlier") changes the plan, so users revise instead of starting over.
 */
export function describeChanges(before: EventPlan, after: EventPlan, today: string): PlanChange {
  const diff: Diff = { before, after, a: before.details, b: after.details, today };
  const lines = DESCRIBERS.map((describe) => describe(diff)).filter((line): line is string => line !== null);
  const reset = diff.a.eventType !== diff.b.eventType;
  const refreshAi = AI_FIELDS.some((f) => JSON.stringify(diff.a[f]) !== JSON.stringify(diff.b[f]));

  if (lines.length === 0) lines.push(refreshAi ? 'Preferences updated.' : 'No changes to the plan.');
  if (!reset) lines.push('Kept: your budget edits, completed tasks, vendor records and spending.');
  if (refreshAi) lines.push('Ideas and the day-of schedule are being refreshed for the new details.');
  return { lines, refreshAi, reset };
}
