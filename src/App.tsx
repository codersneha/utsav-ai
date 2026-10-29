import { Suspense, lazy, useRef, useState } from 'react';
import { PlannerForm } from './components/PlannerForm';
import { usePlanner } from './hooks/usePlanner';
import type { EventDetails } from './types';

const PlanView = lazy(() => import('./components/PlanView'));

export default function App() {
  const planner = usePlanner();
  const { plan, details } = planner;
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);

  const handleSubmit = (next: EventDetails) => {
    const isEdit = plan !== null;
    planner.submit(next);
    setEditing(false);
    setStatus(
      isEdit
        ? 'Plan updated. A summary of the changes is shown.'
        : 'Your plan is ready. AI suggestions are loading.',
    );
    if (!isEdit) requestAnimationFrame(() => headingRef.current?.focus());
  };

  const handleReset = () => {
    planner.reset();
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
                  Answer a few questions and get an editable plan: a budget that adds up to the rupee, a
                  timeline with a day-of schedule, vendor checklists with questions to ask, and ideas
                  personalised by Google Gemini. Change anything later — the plan adapts instead of starting
                  over.
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
              planner={{ ...planner, reset: handleReset }}
              plan={plan}
              onEdit={() => setEditing(true)}
            />
          </Suspense>
        )}
      </main>
      <footer className="site-footer">
        <div className="container">
          <p>
            Built for PromptWars Virtual · AI by Google Gemini · Estimates are not quotes · Your plan is saved
            only in this browser.
          </p>
        </div>
      </footer>
    </>
  );
}
