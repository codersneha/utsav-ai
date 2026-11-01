import { useEffect, useMemo, useRef, useState } from 'react';
import { askPlanner, fetchIdeas, fetchLogistics, venueFromMapsLink, type RefineOptions } from '../lib/api';
import { ownAmounts, withOverride, type TradeOffAction } from '../lib/budget';
import { describeChanges, type PlanChange } from '../lib/changes';
import { venueTypeOf } from '../lib/checklist';
import { todayIso } from '../lib/dates';
import { entryActions, newId, toggleIn, withChosenVenue } from '../lib/entries';
import { isIdeas, isLogistics } from '../lib/guards';
import { fallbackIdeas, mergeIdeas } from '../lib/ideas';
import { buildPlan } from '../lib/plan';
import { readSharedPlan } from '../lib/share';
import { validateEventDetails } from '../lib/validation';
import type {
  CustomTask,
  EventDetails,
  GuestEntry,
  Ideas,
  IdeasSection,
  Logistics,
  VendorEntry,
  Venue,
} from '../types';
import { useAiResource, type AiRequest } from './useAiResource';
import { usePlanStore } from './usePlanStore';

const isStoredIdeas = (v: unknown): v is Ideas | null => v === null || isIdeas(v);
const isStoredLogistics = (v: unknown): v is Logistics | null => v === null || isLogistics(v);

/** A whole-plan ideas request: always resolves to complete ideas. */
const wholeIdeas =
  (d: EventDetails, refine?: RefineOptions): AiRequest<Ideas> =>
  (signal) =>
    fetchIdeas(d, signal, { refine }).then((r) => ({
      value: isIdeas(r.value) ? r.value : fallbackIdeas(d),
      notice: r.notice,
    }));

/** Everything the user can change, captured before an edit so it can be undone. */
interface Snapshot {
  details: EventDetails;
  overrides: Record<string, number>;
  done: Record<string, boolean>;
  spent: Record<string, number>;
  vendors: VendorEntry[];
  timelineDone: Record<string, boolean>;
}

const MAX_UNDO = 10;
const MAX_CHAT = 20;
const isLink = (text: string) => /^https?:\/\//i.test(text);
const flip = (record: Record<string, boolean>, id: string) => ({ ...record, [id]: !record[id] });
/** Replaces any earlier photo or look note in the preferences rather than piling them up. */
const withLookNote = (preferences: string, note: string) =>
  `${preferences.replace(/(Inspired by a photo|Chosen décor look):[^.]*\.?/g, '').trim()} ${note}.`.trim();

/** A Google Maps link typed as the venue (e.g. in the form) is read automatically. */
function useVenueLink(
  details: EventDetails | null,
  chooseVenue: (venue: Venue) => void,
  onError: (message: string) => void,
) {
  // The reader needs the latest callbacks without re-running.
  const callbacks = useRef({ chooseVenue, onError });
  useEffect(() => {
    callbacks.current = { chooseVenue, onError };
  });

  const venueLink = details && isLink(details.venueName) ? details.venueName : '';
  useEffect(() => {
    if (!venueLink) return;
    let active = true;
    void venueFromMapsLink(venueLink).then((r) => {
      if (!active) return;
      const venue = r.venues[0];
      if (venue) callbacks.current.chooseVenue(venue);
      else callbacks.current.onError(r.error ?? 'We couldn’t read that Google Maps link.');
    });
    return () => {
      active = false;
    };
  }, [venueLink]);
}

/** All planner state and actions. Components stay presentational. */
export function usePlanner() {
  const store = usePlanStore();
  const { details, setDetails, overrides, setOverrides, chat, setChat } = store;
  const [venueLinkError, setVenueLinkError] = useState('');
  const [asking, setAsking] = useState(false);
  const [busySection, setBusySection] = useState<IdeasSection | null>(null);
  const [change, setChange] = useState<PlanChange | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [shared, setShared] = useState<EventDetails | null>(() =>
    typeof window === 'undefined' ? null : readSharedPlan(window.location.hash),
  );

  const ideas = useAiResource<Ideas>('ideas', isStoredIdeas);
  const logistics = useAiResource<Logistics>('logistics', isStoredLogistics);
  const today = todayIso();

  const { customTasks } = store;
  const vendorAdvice = logistics.value?.vendors;
  const plan = useMemo(
    () => (details ? buildPlan(details, today, { overrides, customTasks, vendorAdvice }) : null),
    [details, today, overrides, customTasks, vendorAdvice],
  );

  // A plan restored from storage fetches whatever AI content it is missing (once, on load).
  const restored = useRef({ details, ideas: ideas.value, logistics: logistics.value });
  const { start: startIdeas } = ideas;
  const { start: startLogistics } = logistics;
  useEffect(() => {
    const initial = restored.current;
    if (!initial.details) return;
    const d = initial.details;
    const timer = setTimeout(() => {
      if (!initial.ideas) startIdeas(wholeIdeas(d));
      if (!initial.logistics) startLogistics((signal) => fetchLogistics(d, signal));
    }, 0);
    return () => clearTimeout(timer);
  }, [startIdeas, startLogistics]);

  const loadAi = (d: EventDetails) => {
    ideas.start(wholeIdeas(d));
    logistics.start((signal) => fetchLogistics(d, signal));
  };

  /** Saves the current state so the next change can be undone; false when there is no plan yet. */
  const remember = (): boolean => {
    if (!details) return false;
    const { done, spent, vendors, timelineDone } = store;
    setHistory((h) => [...h, { details, overrides, done, spent, vendors, timelineDone }].slice(-MAX_UNDO));
    return true;
  };

  /** Shows what changed between two versions of the plan and refreshes AI content if needed. */
  const revise = (
    next: EventDetails,
    nextOverrides: Record<string, number>,
    prefix?: string,
    refreshAi: (d: EventDetails) => void = loadAi,
  ) => {
    if (!plan) return;
    const nextPlan = buildPlan(next, today, { overrides: nextOverrides, customTasks, vendorAdvice });
    const summary = describeChanges(plan, nextPlan, today);
    setChange(prefix ? { ...summary, lines: [prefix, ...summary.lines] } : summary);
    setDetails(next);
    if (summary.refreshAi) refreshAi(next);
    return summary;
  };

  const submit = (next: EventDetails) => {
    if (plan && remember()) {
      if (revise(next, overrides)?.reset) store.clearProgress();
      return;
    }
    setChange(null);
    setHistory([]);
    setDetails(next);
    loadAi(next);
  };

  /** Restores the plan as it was before the last change (details, edits and progress). */
  const undo = () => {
    const last = history.at(-1);
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setOverrides(last.overrides);
    store.setDone(last.done);
    store.setSpent(last.spent);
    store.setVendors(last.vendors);
    store.setTimelineDone(last.timelineDone);
    revise(last.details, last.overrides, 'Undone — the plan is back to how it was.');
  };

  /** Turns décor planning on or off: the décor budget and decorator tasks follow, the ideas stay. */
  const setDecor = (on: boolean) => {
    if (!details || details.wantsDecor === on || !remember()) return;
    // Money the user put into décor goes back into the split when décor is turned off.
    const nextOverrides = on ? overrides : withOverride(overrides, 'decor', null);
    setOverrides(nextOverrides);
    revise({ ...details, wantsDecor: on }, nextOverrides);
  };

  /** Regenerates one section (décor, menu or extras) and keeps everything else as it is. */
  const refreshSection = (section: IdeasSection, request?: string, d: EventDetails | null = details) => {
    if (!d) return;
    const base = ideas.value ?? fallbackIdeas(d);
    const refine = request ? { request, previousThemes: previousThemes() } : undefined;
    setBusySection(section);
    ideas.start((signal) =>
      fetchIdeas(d, signal, { section, refine })
        .then((r) => ({
          value: Object.keys(r.value).length > 0 ? mergeIdeas(base, r.value) : base,
          notice: r.notice,
        }))
        .finally(() => setBusySection(null)),
    );
  };

  /** Applies a look (from an inspiration photo or a suggested look): new colours, and fresh décor only. */
  const applyLook = (look: { colors: string; note: string; message?: string }) => {
    if (!details) return;
    const result = validateEventDetails(
      { ...details, colors: look.colors, preferences: withLookNote(details.preferences, look.note) },
      details.date < today ? details.date : today,
    );
    if (!result.ok || !remember()) return;
    revise(
      result.value,
      overrides,
      look.message ?? 'New colours from your photo — refreshing the décor only.',
      (d) => refreshSection('decor', undefined, d),
    );
  };

  const reset = () => {
    ideas.clear();
    logistics.clear();
    store.clearAll();
    setChange(null);
    setHistory([]);
  };

  const closeSharedLink = () => {
    setShared(null);
    window.history.replaceState(null, '', window.location.pathname);
  };

  /** Opens a plan someone shared by link, replacing the current one. */
  const openShared = () => {
    if (!shared) return;
    reset();
    setDetails(shared);
    loadAi(shared);
    closeSharedLink();
  };

  const applyTradeOff = (action: TradeOffAction) => {
    if (!details) return;
    if (action.kind === 'overrides') setOverrides(action.overrides);
    else submit({ ...details, ...action.patch });
  };

  const previousThemes = () => ideas.value?.ceremonies.map((c) => c.theme) ?? [];

  const ask = async (question: string) => {
    if (!details) return;
    setAsking(true);
    const { answer, proposal } = await askPlanner(details, question, chat);
    setChat((c) => [...c, proposal ? { question, answer, proposal } : { question, answer }].slice(-MAX_CHAT));
    setAsking(false);
  };

  const markProposal = (index: number, proposalState: 'applied' | 'dismissed') =>
    setChat((c) => c.map((t, i) => (i === index ? { ...t, proposalState } : t)));

  /** Applies a change the assistant proposed — only after the user clicks Apply. */
  const applyProposal = (index: number) => {
    const turn = chat[index];
    if (!details || !turn?.proposal || turn.proposalState) return;
    const { guests, budget, date } = turn.proposal;
    // Re-validate: stored proposals could be stale or edited.
    const result = validateEventDetails(
      { ...details, ...(guests ? { guests } : {}), ...(budget ? { budget } : {}), ...(date ? { date } : {}) },
      today,
    );
    if (!result.ok) return;
    submit(result.value);
    markProposal(index, 'applied');
  };

  /** Makes a venue the plan's venue and records it in the Venue vendor row. */
  const chooseVenue = (venue: Venue) => {
    if (!details) return;
    store.setChosenVenue(venue);
    setVenueLinkError('');
    store.setVendors((list) => withChosenVenue(list, venue));
    submit({
      ...details,
      venueName: venue.name,
      venueType: venueTypeOf(venue.kind, venue.name) ?? details.venueType,
    });
  };
  useVenueLink(details, chooseVenue, setVenueLinkError);

  return {
    details,
    plan,
    today,
    change,
    dismissChange: () => setChange(null),
    submit,
    reset,
    canUndo: history.length > 0,
    undo,
    shared: { details: shared, open: openShared, dismiss: closeSharedLink },
    applyLook,
    setDecor,
    chooseVenue,
    chosenVenue: store.chosenVenue,
    venueLinkError,
    ideas: {
      ...ideas,
      regenerate: () => details && ideas.start(wholeIdeas(details)),
      /** Re-plans the whole set of ideas from the user's feedback. */
      refine: (request: string) =>
        details && ideas.start(wholeIdeas(details, { request, previousThemes: previousThemes() })),
      refreshSection,
      busySection,
    },
    logistics,
    budget: {
      overrides,
      spent: store.spent,
      setOverride: (id: string, amount: number | null) => setOverrides((o) => withOverride(o, id, amount)),
      setSpent: (id: string, amount: number) => store.setSpent((s) => ({ ...s, [id]: amount })),
      /** Saves a whole new split; only amounts that differ from the suggestion count as the user's own. */
      setAmounts: (amounts: Record<string, number>) => details && setOverrides(ownAmounts(details, amounts)),
      locks: store.budgetLocks,
      toggleLock: (id: string) => store.setBudgetLocks((l) => toggleIn(l, id)),
      applyTradeOff,
    },
    timeline: {
      done: store.timelineDone,
      toggle: (id: string) => store.setTimelineDone((d) => flip(d, id)),
      addTask: (task: Omit<CustomTask, 'id'>) =>
        store.setCustomTasks((t) => [...t, { ...task, id: newId('task') }]),
      removeTask: (id: string) => store.setCustomTasks((t) => t.filter((x) => x.id !== id)),
    },
    checklist: { done: store.done, toggle: (id: string) => store.setDone((d) => flip(d, id)) },
    vendors: { entries: store.vendors, ...entryActions<VendorEntry, 'groupId'>(store.setVendors, 'vendor') },
    guests: { entries: store.guests, ...entryActions<GuestEntry>(store.setGuests, 'guest') },
    /** Re-plans for a new guest count (with the change report and undo). */
    setGuestCount: (count: number) => details && submit({ ...details, guests: count }),
    chat: {
      turns: chat,
      asking,
      ask,
      clear: () => setChat([]),
      applyProposal,
      dismissProposal: (index: number) => markProposal(index, 'dismissed'),
    },
  };
}

export type Planner = ReturnType<typeof usePlanner>;
