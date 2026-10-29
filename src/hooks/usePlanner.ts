import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { askPlanner, fetchIdeas, fetchLogistics, type RefineOptions } from '../lib/api';
import type { TradeOffAction } from '../lib/budget';
import { describeChanges, type PlanChange } from '../lib/changes';
import { todayIso } from '../lib/dates';
import { isArrayOf, isChatTurn, isCustomTask, isLogistics, isVendorEntry } from '../lib/guards';
import { parseIdeas } from '../lib/ideas';
import { buildPlan } from '../lib/plan';
import { isBoolean, isNumber, isRecordOf } from '../lib/storage';
import { validateEventDetails } from '../lib/validation';
import type { ChatTurn, CustomTask, EventDetails, Ideas, Logistics, VendorEntry } from '../types';
import { usePersistentState } from './usePersistentState';

const isDetails = (v: unknown): v is EventDetails | null => {
  if (v === null) return true;
  const date = (v as { date?: unknown })?.date;
  // Stored plans may be in the past, so validate relative to their own date.
  return typeof date === 'string' && validateEventDetails(v, date).ok;
};
const isStoredIdeas = (v: unknown): v is Ideas | null =>
  v === null || (parseIdeas(v) !== null && ['gemini', 'fallback'].includes((v as Ideas).source));
const isStoredLogistics = (v: unknown): v is Logistics | null => v === null || isLogistics(v);

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
  const [details, setDetails] = usePersistentState<EventDetails | null>('details', null, isDetails);
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
  const [chat, setChat] = usePersistentState<ChatTurn[]>('chat', [], isArrayOf(isChatTurn));
  const [asking, setAsking] = useState(false);
  const [change, setChange] = useState<PlanChange | null>(null);

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
      if (!initial.ideas) startIdeas((signal) => fetchIdeas(d, signal));
      if (!initial.logistics) startLogistics((signal) => fetchLogistics(d, signal));
    }, 0);
    return () => clearTimeout(timer);
  }, [startIdeas, startLogistics]);

  const loadAi = (d: EventDetails) => {
    ideas.start((signal) => fetchIdeas(d, signal));
    logistics.start((signal) => fetchLogistics(d, signal));
  };

  const submit = (next: EventDetails) => {
    if (plan) {
      const nextPlan = buildPlan(next, today, {
        overrides,
        customTasks,
        vendorAdvice: logistics.value?.vendors,
      });
      const summary = describeChanges(plan, nextPlan, today);
      setChange(summary);
      if (summary.reset) {
        setDone({});
        setSpent({});
        setOverrides({});
        setVendors([]);
        setTimelineDone({});
      }
      setDetails(next);
      if (summary.refreshAi) loadAi(next);
      return;
    }
    setChange(null);
    setDetails(next);
    loadAi(next);
  };

  const applyTradeOff = (action: TradeOffAction) => {
    if (!details) return;
    if (action.kind === 'overrides') setOverrides(action.overrides);
    else submit({ ...details, ...action.patch });
  };

  const regenerateIdeas = () => {
    if (details) ideas.start((signal) => fetchIdeas(details, signal));
  };

  const refineIdeas = (request: string) => {
    if (!details) return;
    const refine: RefineOptions = { request, previousThemes: ideas.value?.themes.map((t) => t.name) ?? [] };
    ideas.start((signal) => fetchIdeas(details, signal, refine));
  };

  const ask = async (question: string) => {
    if (!details) return;
    setAsking(true);
    const answer = await askPlanner(details, question, chat);
    setChat((c) => [...c, { question, answer }].slice(-20));
    setAsking(false);
  };

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
    setChat([]);
    setChange(null);
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
    ideas: { ...ideas, regenerate: regenerateIdeas, refine: refineIdeas },
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
    chat: { turns: chat, asking, ask, clear: () => setChat([]) },
  };
}

export type Planner = ReturnType<typeof usePlanner>;
