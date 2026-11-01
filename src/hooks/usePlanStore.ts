import { isArrayOf, isChatTurn, isCustomTask, isGuestEntry, isVendorEntry, isVenue } from '../lib/guards';
import { isBoolean, isNumber, isRecordOf, isString } from '../lib/storage';
import { validateEventDetails } from '../lib/validation';
import type { ChatTurn, CustomTask, EventDetails, GuestEntry, VendorEntry, Venue } from '../types';
import { usePersistentState } from './usePersistentState';

/** Validates stored details relative to their own date (saved plans may be in the past). */
const storedDetails = (v: unknown) => {
  const date = (v as { date?: unknown } | null)?.date;
  const result = typeof date === 'string' ? validateEventDetails(v, date) : null;
  return result?.ok ? result.value : null;
};
const isDetails = (v: unknown): v is EventDetails | null => v === null || storedDetails(v) !== null;
/** Upgrades plans saved by older versions (fills defaults for newer fields). */
const normalizeDetails = (v: EventDetails | null) => (v === null ? null : storedDetails(v));
const isStoredVenue = (v: unknown): v is Venue | null => v === null || isVenue(v);

/** Everything about the plan that is saved in this browser, each value checked when it is read back. */
export function usePlanStore() {
  const [details, setDetails] = usePersistentState<EventDetails | null>(
    'details',
    null,
    isDetails,
    normalizeDetails,
  );
  const [done, setDone] = usePersistentState<Record<string, boolean>>('done', {}, isRecordOf(isBoolean));
  const [timelineDone, setTimelineDone] = usePersistentState<Record<string, boolean>>(
    'timelineDone',
    {},
    isRecordOf(isBoolean),
  );
  const [spent, setSpent] = usePersistentState<Record<string, number>>('spent', {}, isRecordOf(isNumber));
  const [overrides, setOverrides] = usePersistentState<Record<string, number>>(
    'overrides',
    {},
    isRecordOf(isNumber),
  );
  const [customTasks, setCustomTasks] = usePersistentState<CustomTask[]>(
    'customTasks',
    [],
    isArrayOf(isCustomTask),
  );
  const [vendors, setVendors] = usePersistentState<VendorEntry[]>('vendors', [], isArrayOf(isVendorEntry));
  const [guests, setGuests] = usePersistentState<GuestEntry[]>('guests', [], isArrayOf(isGuestEntry));
  const [budgetLocks, setBudgetLocks] = usePersistentState<string[]>('budgetLocks', [], isArrayOf(isString));
  const [chosenVenue, setChosenVenue] = usePersistentState<Venue | null>('venueLink', null, isStoredVenue);
  const [chat, setChat] = usePersistentState<ChatTurn[]>('chat', [], isArrayOf(isChatTurn));

  /** Clears progress that belongs to the old plan (kept: guests, tasks, locks, venue and chat). */
  const clearProgress = () => {
    setDone({});
    setSpent({});
    setOverrides({});
    setVendors([]);
    setTimelineDone({});
  };

  /** Forgets the whole plan. */
  const clearAll = () => {
    clearProgress();
    setDetails(null);
    setCustomTasks([]);
    setGuests([]);
    setBudgetLocks([]);
    setChosenVenue(null);
    setChat([]);
  };

  return {
    details,
    setDetails,
    done,
    setDone,
    timelineDone,
    setTimelineDone,
    spent,
    setSpent,
    overrides,
    setOverrides,
    customTasks,
    setCustomTasks,
    vendors,
    setVendors,
    guests,
    setGuests,
    budgetLocks,
    setBudgetLocks,
    chosenVenue,
    setChosenVenue,
    chat,
    setChat,
    clearProgress,
    clearAll,
  };
}
