import { Share2 } from 'lucide-react';
import { Suspense, lazy, useRef, useState } from 'react';
import { MarigoldMark, Toran } from './components/Brand';
import { Landing } from './components/Landing';
import { PlannerForm } from './components/PlannerForm';
import { usePlanner } from './hooks/usePlanner';
import type { EventDetails } from './types';

const PlanView = lazy(() => import('./components/PlanView'));

export default function App() {
  const planner = usePlanner();
  const { plan, details } = planner;
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState('');
  const [draft, setDraft] = useState<{ fields: Partial<EventDetails>; intro: string; key: number }>({
    fields: {},
    intro: '',
    key: 0,
  });
  const headingRef = useRef<HTMLHeadingElement>(null);

  const focusPlan = () => requestAnimationFrame(() => headingRef.current?.focus());

  const handleSubmit = (next: EventDetails) => {
    const isEdit = plan !== null;
    planner.submit(next);
    setEditing(false);
    setStatus(
      isEdit
        ? 'Plan updated. A summary of the changes is shown.'
        : 'Your plan is ready. AI suggestions are loading.',
    );
    if (!isEdit) focusPlan();
  };

  const handleSample = (sample: EventDetails) => {
    planner.submit(sample);
    setStatus(`Opened the sample plan “${sample.title}”.`);
    focusPlan();
  };

  const handleExtracted = (fields: Partial<EventDetails>) => {
    const count = Object.keys(fields).length;
    setDraft((d) => ({
      fields,
      intro: `AI filled ${count} detail${count === 1 ? '' : 's'} from your description — please check them, then continue.`,
      key: d.key + 1,
    }));
    requestAnimationFrame(() => {
      document.getElementById('plan-form')?.scrollIntoView?.({ block: 'start' });
      document.getElementById('form-title')?.focus();
    });
  };

  const handleReset = () => {
    planner.reset();
    setDraft((d) => ({ fields: {}, intro: '', key: d.key + 1 }));
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
          <p className="logo">
            <MarigoldMark />
            <span>
              Utsav<em>AI</em>
            </span>
          </p>
          <p className="tagline">Weddings · birthdays · community celebrations</p>
        </div>
        <Toran />
      </header>
      <main id="main" className="container">
        {plan && (
          <h1 ref={headingRef} tabIndex={-1} className="sr-only">
            {showForm ? 'Change your event details' : 'Your event plan'}
          </h1>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {status}
        </p>

        {planner.shared.details && (
          <div className="card banner-card" role="region" aria-label="Shared plan">
            <p>
              <Share2 size={18} aria-hidden="true" /> Someone shared a plan with you:{' '}
              <strong>{planner.shared.details.title || planner.shared.details.eventType}</strong> in{' '}
              {planner.shared.details.city}.{plan ? ' Opening it replaces your current plan.' : ''}
            </p>
            <div className="actions">
              <button type="button" className="btn primary" onClick={planner.shared.open}>
                Open shared plan
              </button>
              <button type="button" className="btn" onClick={planner.shared.dismiss}>
                Not now
              </button>
            </div>
          </div>
        )}

        {showForm ? (
          <>
            {!plan && <Landing onSample={handleSample} onExtracted={handleExtracted} />}
            <PlannerForm
              key={plan ? 'edit' : `new-${draft.key}`}
              initial={plan ? (details ?? undefined) : draft.fields}
              isEdit={Boolean(plan)}
              intro={plan ? undefined : draft.intro}
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
            UtsavAI · Built for PromptWars Virtual · AI by Google Gemini · Amounts are estimates, not quotes ·
            Your plan stays in this browser.
          </p>
        </div>
      </footer>
    </>
  );
}
