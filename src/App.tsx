import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlannerForm } from './components/PlannerForm';
import { usePersistentState } from './hooks/usePersistentState';
import { fetchIdeas } from './lib/api';
import { todayIso } from './lib/dates';
import { parseIdeas } from './lib/ideas';
import { buildPlan } from './lib/plan';
import { isBoolean, isNumber, isRecordOf } from './lib/storage';
import { validateEventDetails } from './lib/validation';
import type { EventDetails, Ideas } from './types';

const PlanView = lazy(() => import('./components/PlanView'));

const isDetails = (v: unknown): v is EventDetails | null => {
  if (v === null) return true;
  const date = (v as { date?: unknown })?.date;
  // Stored plans may be in the past, so validate relative to their own date.
  return typeof date === 'string' && validateEventDetails(v, date).ok;
};
const isStoredIdeas = (v: unknown): v is Ideas | null =>
  v === null || (parseIdeas(v) !== null && ['gemini', 'fallback'].includes((v as Ideas).source));

export default function App() {
  const [details, setDetails] = usePersistentState<EventDetails | null>('details', null, isDetails);
  const [ideas, setIdeas] = usePersistentState<Ideas | null>('ideas', null, isStoredIdeas);
  const [done, setDone] = usePersistentState<Record<string, boolean>>('done', {}, isRecordOf(isBoolean));
  const [spent, setSpent] = usePersistentState<Record<string, number>>('spent', {}, isRecordOf(isNumber));
  const [editing, setEditing] = useState(false);
  // A plan restored from storage without ideas starts in the loading state.
  const [ideasLoading, setIdeasLoading] = useState(() => details !== null && ideas === null);
  const [ideasNotice, setIdeasNotice] = useState<string>();
  const [status, setStatus] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const plan = useMemo(() => (details ? buildPlan(details, todayIso()) : null), [details]);

  /** Fetches ideas; only updates state after the request settles. */
  const requestIdeas = useCallback(
    async (d: EventDetails) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const result = await fetchIdeas(d, controller.signal);
        setIdeas(result.ideas);
        setIdeasNotice(result.notice);
        setStatus('Ideas are ready.');
      } catch {
        // Aborted because a newer request started.
      } finally {
        if (abortRef.current === controller) setIdeasLoading(false);
      }
    },
    [setIdeas],
  );

  const regenerateIdeas = (d: EventDetails) => {
    setIdeasLoading(true);
    setIdeasNotice(undefined);
    void requestIdeas(d);
  };

  // Any plan without ideas (new, edited or restored from storage) fetches them.
  useEffect(() => {
    if (!details || ideas !== null) return;
    const timer = setTimeout(() => void requestIdeas(details), 0);
    return () => clearTimeout(timer);
  }, [details, ideas, requestIdeas]);

  const handleSubmit = (next: EventDetails) => {
    const typeChanged = details?.eventType !== next.eventType;
    setDetails(next);
    setEditing(false);
    if (typeChanged) {
      setDone({});
      setSpent({});
    }
    setIdeas(null);
    setIdeasLoading(true);
    setIdeasNotice(undefined);
    setStatus('Your plan is ready. Personalised ideas are loading.');
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setIdeasLoading(false);
    setDetails(null);
    setIdeas(null);
    setDone({});
    setSpent({});
    setIdeasNotice(undefined);
    setStatus('Started a new plan.');
  };

  const showForm = !plan || editing;

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className="site-header">
        <div className="container">
          <p className="logo" aria-label="UtsavAI">
            <span aria-hidden="true">✿</span> Utsav<span>AI</span>
          </p>
          <p className="tagline">Your AI planner for weddings, birthdays and community events</p>
        </div>
      </header>
      <main id="main" className="container">
        <h1 ref={headingRef} tabIndex={-1} className="sr-only">
          {showForm ? 'Plan your event' : 'Your event plan'}
        </h1>
        <p className="sr-only" role="status" aria-live="polite">
          {status}
        </p>
        {showForm ? (
          <>
            {!plan && (
              <section className="hero" aria-label="Introduction">
                <h2>Plan your celebration in minutes</h2>
                <p>
                  Get a budget split that adds up to the rupee, a timeline that works back from your date,
                  vendor checklists and ideas personalised by Google Gemini.
                </p>
              </section>
            )}
            <PlannerForm
              initial={details ?? undefined}
              onSubmit={handleSubmit}
              onCancel={plan ? () => setEditing(false) : undefined}
            />
          </>
        ) : (
          <Suspense fallback={<p className="muted">Loading your plan…</p>}>
            <PlanView
              plan={plan}
              ideas={ideas}
              ideasLoading={ideasLoading}
              ideasNotice={ideasNotice}
              onRegenerateIdeas={() => regenerateIdeas(plan.details)}
              done={done}
              onToggleTask={(id) => setDone((d) => ({ ...d, [id]: !d[id] }))}
              spent={spent}
              onSpentChange={(id, amount) => setSpent((s) => ({ ...s, [id]: amount }))}
              onEdit={() => setEditing(true)}
              onReset={handleReset}
            />
          </Suspense>
        )}
      </main>
      <footer className="site-footer">
        <div className="container">
          <p>
            Built for PromptWars Virtual · Ideas by Google Gemini · Your plan is saved only in this browser.
          </p>
        </div>
      </footer>
    </>
  );
}
