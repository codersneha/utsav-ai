import {
  VENDOR_STATUSES,
  type ChatTurn,
  type CustomTask,
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
  typeof v.quote === 'number' &&
  Number.isFinite(v.quote) &&
  VENDOR_STATUSES.includes(v.status as VendorEntry['status']);

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
