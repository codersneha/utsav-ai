import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { askPlanner, fetchIdeas, fetchLogistics, type RefineOptions } from '../lib/api';
import type { TradeOffAction } from '../lib/budget';
import { describeChanges, type PlanChange } from '../lib/changes';
import { todayIso } from '../lib/dates';
import {
  isArrayOf,
  isChatTurn,
  isCustomTask,
  isGuestEntry,
  isIdeas,
  isLogistics,
  isVendorEntry,
} from '../lib/guards';
import { fallbackIdeas, mergeIdeas } from '../lib/ideas';
import { buildPlan } from '../lib/plan';
import { readSharedPlan } from '../lib/share';
import { isBoolean, isNumber, isRecordOf } from '../lib/storage';
import { validateEventDetails } from '../lib/validation';
import type {
  ChatTurn,
  CustomTask,
  EventDetails,
  GuestEntry,
  Ideas,
  IdeasSection,
  Logistics,
  VendorEntry,
} from '../types';
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
const isStoredIdeas = (v: unknown): v is Ideas | null => v === null || isIdeas(v);

/** A whole-plan ideas request: always resolves to complete ideas. */
const wholeIdeas = (d: EventDetails, refine?: RefineOptions) => (signal: AbortSignal) =>
  fetchIdeas(d, signal, { refine }).then((r) => ({
    value: isIdeas(r.value) ? r.value : fallbackIdeas(d),
    notice: r.notice,
  }));
const isStoredLogistics = (v: unknown): v is Logistics | null => v === null || isLogistics(v);

/** Everything the user can change, captured before an edit so it can be undone. */
interface Snapshot {
  details: EventDetails;
  overrides: Record<string, number>;
  done: Record<string, boolean>;
  spent: Record<string, number>;
  vendors: VendorEntry[];
  timelineDone: Record<string, boolean>;
}

let nextId = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(nextId++).toString(36)}`;

/** One AI-backed resource (ideas or logistics) with its loading state. */
function useAiResource<T>(key: string, isValid: (v: unknown) => v is T | null) {
  const [value, setValue] = usePersistentState<T | null>(key, null, isValid);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);

  /** Starts a request; state only changes after it settles (safe to call from effects). */
  const run = useCallback(
    async (request: (signal: AbortSignal) => Promise<{ value: T; notice?: string }>) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const result = await request(controller.signal);
        setValue(result.value);
        setNotice(result.notice);
      } catch {
        // Aborted because a newer request started.
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    },
    [setValue],
  );

  const start = useCallback(
    (request: (signal: AbortSignal) => Promise<{ value: T; notice?: string }>) => {
      setLoading(true);
      setNotice(undefined);
      void run(request);
    },
    [run],
  );

  const clear = () => {
    abortRef.current?.abort();
    setValue(null);
    setLoading(false);
    setNotice(undefined);
  };

  return { value, loading, notice, start, clear };
}

/** All planner state and actions. Components stay presentational. */
export function usePlanner() {
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
  const [chat, setChat] = usePersistentState<ChatTurn[]>('chat', [], isArrayOf(isChatTurn));
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

  const plan = useMemo(
    () =>
      details
        ? buildPlan(details, today, { overrides, customTasks, vendorAdvice: logistics.value?.vendors })
        : null,
    [details, today, overrides, customTasks, logistics.value],
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

  const snapshot = (): Snapshot | null =>
    details ? { details, overrides, done, spent, vendors, timelineDone } : null;

  /** Shows what changed between two versions of the plan and refreshes AI content if needed. */
  const revise = (
    next: EventDetails,
    nextOverrides: Record<string, number>,
    prefix?: string,
    refreshAi: (d: EventDetails) => void = loadAi,
  ) => {
    if (!plan) return;
    const nextPlan = buildPlan(next, today, {
      overrides: nextOverrides,
      customTasks,
      vendorAdvice: logistics.value?.vendors,
    });
    const summary = describeChanges(plan, nextPlan, today);
    setChange(prefix ? { ...summary, lines: [prefix, ...summary.lines] } : summary);
    setDetails(next);
    if (summary.refreshAi) refreshAi(next);
    return summary;
  };

  const submit = (next: EventDetails) => {
    const before = snapshot();
    if (before && plan) {
      setHistory((h) => [...h, before].slice(-10));
      const summary = revise(next, overrides);
      if (summary?.reset) {
        setDone({});
        setSpent({});
        setOverrides({});
        setVendors([]);
        setTimelineDone({});
      }
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
    setDone(last.done);
    setSpent(last.spent);
    setVendors(last.vendors);
    setTimelineDone(last.timelineDone);
    revise(last.details, last.overrides, 'Undone — the plan is back to how it was.');
  };

  /** Applies the look read from an inspiration photo: new colours, and fresh décor only. */
  const applyLook = (look: { colors: string; note: string }) => {
    const before = snapshot();
    if (!details || !before) return;
    const result = validateEventDetails(
      { ...details, colors: look.colors, preferences: `${details.preferences} ${look.note}`.trim() },
      details.date < today ? details.date : today,
    );
    if (!result.ok) return;
    setHistory((h) => [...h, before].slice(-10));
    revise(result.value, overrides, 'New colours from your photo — refreshing the décor only.', (d) =>
      refreshSection('decor', undefined, d),
    );
  };

  /** Opens a plan someone shared by link, replacing the current one. */
  const openShared = () => {
    if (!shared) return;
    reset();
    setDetails(shared);
    loadAi(shared);
    setShared(null);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const dismissShared = () => {
    setShared(null);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const applyTradeOff = (action: TradeOffAction) => {
    if (!details) return;
    if (action.kind === 'overrides') setOverrides(action.overrides);
    else submit({ ...details, ...action.patch });
  };

  const regenerateIdeas = () => {
    if (details) ideas.start(wholeIdeas(details));
  };

  const previousThemes = () => ideas.value?.ceremonies.map((c) => c.theme) ?? [];

  /** Re-plans the whole set of ideas from the user's feedback. */
  const refineIdeas = (request: string) => {
    if (!details) return;
    ideas.start(wholeIdeas(details, { request, previousThemes: previousThemes() }));
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

  const ask = async (question: string) => {
    if (!details) return;
    setAsking(true);
    const { answer, proposal } = await askPlanner(details, question, chat);
    setChat((c) => [...c, proposal ? { question, answer, proposal } : { question, answer }].slice(-20));
    setAsking(false);
  };

  /** Applies a change the assistant proposed — only after the user clicks Apply. */
  const applyProposal = (index: number) => {
    const turn = chat[index];
    if (!details || !turn?.proposal || turn.proposalState) return;
    const { guests, budget, date } = turn.proposal;
    const candidate = {
      ...details,
      ...(guests ? { guests } : {}),
      ...(budget ? { budget } : {}),
      ...(date ? { date } : {}),
    };
    // Re-validate: stored proposals could be stale or edited.
    const result = validateEventDetails(candidate, today);
    if (!result.ok) return;
    submit(result.value);
    setChat((c) => c.map((t, i) => (i === index ? { ...t, proposalState: 'applied' } : t)));
  };

  const dismissProposal = (index: number) =>
    setChat((c) => c.map((t, i) => (i === index ? { ...t, proposalState: 'dismissed' } : t)));

  const reset = () => {
    ideas.clear();
    logistics.clear();
    setDetails(null);
    setDone({});
    setTimelineDone({});
    setSpent({});
    setOverrides({});
    setCustomTasks([]);
    setVendors([]);
    setGuests([]);
    setChat([]);
    setChange(null);
    setHistory([]);
  };

  const toggle = (setter: typeof setDone) => (id: string) => setter((d) => ({ ...d, [id]: !d[id] }));

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
    shared: { details: shared, open: openShared, dismiss: dismissShared },
    applyLook,
    chooseVenue: (venueName: string) => details && submit({ ...details, venueName }),
    ideas: { ...ideas, regenerate: regenerateIdeas, refine: refineIdeas, refreshSection, busySection },
    logistics,
    budget: {
      overrides,
      spent,
      setOverride: (id: string, amount: number | null) =>
        setOverrides((o) => {
          const next = { ...o };
          if (amount === null) delete next[id];
          else next[id] = amount;
          return next;
        }),
      setSpent: (id: string, amount: number) => setSpent((s) => ({ ...s, [id]: amount })),
      applyTradeOff,
    },
    timeline: {
      done: timelineDone,
      toggle: toggle(setTimelineDone),
      addTask: (task: Omit<CustomTask, 'id'>) =>
        setCustomTasks((t) => [...t, { ...task, id: newId('task') }]),
      removeTask: (id: string) => setCustomTasks((t) => t.filter((x) => x.id !== id)),
    },
    checklist: { done, toggle: toggle(setDone) },
    vendors: {
      entries: vendors,
      add: (entry: Omit<VendorEntry, 'id'>) => setVendors((v) => [...v, { ...entry, id: newId('vendor') }]),
      update: (id: string, patch: Partial<Omit<VendorEntry, 'id' | 'groupId'>>) =>
        setVendors((v) => v.map((e) => (e.id === id ? { ...e, ...patch } : e))),
      remove: (id: string) => setVendors((v) => v.filter((e) => e.id !== id)),
    },
    guests: {
      entries: guests,
      add: (entry: Omit<GuestEntry, 'id'>) => setGuests((g) => [...g, { ...entry, id: newId('guest') }]),
      update: (id: string, patch: Partial<Omit<GuestEntry, 'id'>>) =>
        setGuests((g) => g.map((e) => (e.id === id ? { ...e, ...patch } : e))),
      remove: (id: string) => setGuests((g) => g.filter((e) => e.id !== id)),
    },
    /** Re-plans for a new guest count (with the change report and undo). */
    setGuestCount: (count: number) => details && submit({ ...details, guests: count }),
    chat: { turns: chat, asking, ask, clear: () => setChat([]), applyProposal, dismissProposal },
  };
}

export type Planner = ReturnType<typeof usePlanner>;
