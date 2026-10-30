import {
  GUEST_SIDES,
  RSVP_STATUSES,
  VENDOR_STATUSES,
  type GuestEntry,
  type ChatTurn,
  type CustomTask,
  type Ideas,
  type IdeasSection,
  type Inspiration,
  type Venue,
  type Logistics,
  type VendorEntry,
} from '../types.js';
import { parseIsoDate } from './dates.js';

/** Type guards for data restored from localStorage (it may be stale or tampered with). */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isString = (v: unknown): v is string => typeof v === 'string';

export const isArrayOf =
  <T>(check: (v: unknown) => v is T) =>
  (value: unknown): value is T[] =>
    Array.isArray(value) && value.every(check);

export const isCustomTask = (v: unknown): v is CustomTask =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.task) &&
  isString(v.due) &&
  !Number.isNaN(parseIsoDate(v.due)) &&
  (v.priority === 'High' || v.priority === 'Medium' || v.priority === 'Low');

export const isVendorEntry = (v: unknown): v is VendorEntry =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.groupId) &&
  isString(v.name) &&
  isString(v.contact) &&
  (v.address === undefined || isString(v.address)) &&
  (v.notes === undefined || isString(v.notes)) &&
  typeof v.quote === 'number' &&
  Number.isFinite(v.quote) &&
  VENDOR_STATUSES.includes(v.status as VendorEntry['status']);

const isCount = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 500;

export const isGuestEntry = (v: unknown): v is GuestEntry =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.name) &&
  isString(v.relation) &&
  GUEST_SIDES.includes(v.side as GuestEntry['side']) &&
  isCount(v.adults) &&
  isCount(v.children) &&
  typeof v.vip === 'boolean' &&
  typeof v.invited === 'boolean' &&
  RSVP_STATUSES.includes(v.rsvp as GuestEntry['rsvp']);

const isProposal = (v: unknown) =>
  isObject(v) &&
  isString(v.summary) &&
  (v.guests === undefined || typeof v.guests === 'number') &&
  (v.budget === undefined || typeof v.budget === 'number') &&
  (v.date === undefined || isString(v.date));

export const isChatTurn = (v: unknown): v is ChatTurn =>
  isObject(v) &&
  isString(v.question) &&
  isString(v.answer) &&
  (v.proposal === undefined || isProposal(v.proposal)) &&
  (v.proposalState === undefined || v.proposalState === 'applied' || v.proposalState === 'dismissed');

export const isLogistics = (v: unknown): v is Logistics =>
  isObject(v) &&
  (v.source === 'gemini' || v.source === 'fallback') &&
  Array.isArray(v.daySchedule) &&
  v.daySchedule.every((s) => isObject(s) && isString(s.time) && isString(s.activity)) &&
  isObject(v.vendors) &&
  Object.values(v.vendors).every(
    (a) => isObject(a) && isArrayOf(isString)(a.questions) && isArrayOf(isString)(a.tasks),
  );

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);

const isCeremonyIdeas = (v: unknown) =>
  Array.isArray(v) &&
  v.every(
    (c) =>
      isObject(c) &&
      isString(c.ceremonyId) &&
      isString(c.theme) &&
      isStrings(c.palette) &&
      isStrings(c.decor) &&
      (c.photoMatches === undefined || typeof c.photoMatches === 'boolean'),
  );

const isMenu = (v: unknown) =>
  Array.isArray(v) && v.every((m) => isObject(m) && isString(m.courseId) && isStrings(m.dishes));

/** Full ideas, as stored in the browser or returned for a whole-plan request. */
export const isIdeas = (v: unknown): v is Ideas =>
  isObject(v) &&
  (v.source === 'gemini' || v.source === 'fallback') &&
  isString(v.summary) &&
  isCeremonyIdeas(v.ceremonies) &&
  isMenu(v.menu) &&
  isStrings(v.activities) &&
  isStrings(v.budgetTips);

/** Checks the part of the ideas a section request returns. */
export function isIdeasPart(v: unknown, section: IdeasSection): v is Partial<Ideas> {
  if (!isObject(v)) return false;
  if (section === 'decor') return isCeremonyIdeas(v.ceremonies);
  if (section === 'menu') return isMenu(v.menu);
  return isString(v.summary) && isStrings(v.activities) && isStrings(v.budgetTips);
}

export const isInspiration = (v: unknown): v is Inspiration =>
  isObject(v) &&
  isString(v.theme) &&
  isString(v.mood) &&
  Array.isArray(v.palette) &&
  v.palette.every(
    (p) => isObject(p) && isString(p.name) && isString(p.hex) && /^#[0-9a-f]{6}$/i.test(p.hex),
  ) &&
  isStrings(v.elements);

export const isVenue = (v: unknown): v is Venue =>
  isObject(v) &&
  isString(v.name) &&
  isString(v.kind) &&
  isString(v.address) &&
  typeof v.lat === 'number' &&
  typeof v.lon === 'number' &&
  isString(v.mapsUrl) &&
  v.mapsUrl.startsWith('https://www.google.com/maps/') &&
  isString(v.osmUrl) &&
  v.osmUrl.startsWith('https://www.openstreetmap.org/');
