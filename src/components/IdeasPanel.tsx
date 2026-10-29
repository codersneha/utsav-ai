import { useState, type FormEvent } from 'react';
import { LIMITS } from '../lib/validation';
import type { Ideas } from '../types';

interface Props {
  ideas: Ideas | null;
  loading: boolean;
  notice?: string;
  onRegenerate: () => void;
  onRefine: (request: string) => void;
}

const LISTS: { key: keyof Pick<Ideas, 'decor' | 'food' | 'activities' | 'budgetTips'>; title: string }[] = [
  { key: 'decor', title: 'Decor' },
  { key: 'food', title: 'Food & menu' },
  { key: 'activities', title: 'Activities' },
  { key: 'budgetTips', title: 'Ways to save' },
];

const QUICK_REFINEMENTS = [
  'More eco-friendly',
  'Cheaper options',
  'More traditional',
  'Better for elders and kids',
];

/** Personalised themes and suggestions from Gemini, refinable without starting over. */
export function IdeasPanel({ ideas, loading, notice, onRegenerate, onRefine }: Props) {
  const [request, setRequest] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (request.trim().length < 3) return;
    onRefine(request.trim());
    setRequest('');
  };

  return (
    <section aria-labelledby="ideas-heading" aria-busy={loading}>
      <div className="panel-head">
        <h3 id="ideas-heading">Personalised ideas</h3>
        <button type="button" className="btn" onClick={onRegenerate} disabled={loading}>
          {loading ? 'Generating…' : 'Generate new ideas'}
        </button>
      </div>

      <form className="refine" onSubmit={submit} aria-label="Refine ideas">
        <label htmlFor="refine-input">Not quite right? Tell the AI what to change</label>
        <div className="ask-row">
          <input
            id="refine-input"
            value={request}
            maxLength={LIMITS.refinementMax}
            placeholder="e.g. our venue is a small terrace, and grandparents need seating"
            onChange={(e) => setRequest(e.target.value)}
          />
          <button type="submit" className="btn primary" disabled={loading || request.trim().length < 3}>
            Refine
          </button>
        </div>
        <div className="chips" role="group" aria-label="Quick refinements">
          {QUICK_REFINEMENTS.map((r) => (
            <button key={r} type="button" className="chip" disabled={loading} onClick={() => onRefine(r)}>
              {r}
            </button>
          ))}
        </div>
      </form>

      <div aria-live="polite">
        {loading && <p className="muted">Gemini is crafting ideas for your event…</p>}
        {!loading && notice && <p className="notice">{notice}</p>}
      </div>
      {ideas && !loading && (
        <>
          <p className="lead">{ideas.summary}</p>
          <p className="source-tag">
            {ideas.source === 'gemini'
              ? '✨ Generated with Google Gemini — suggestions, not bookings'
              : 'Curated ideas'}
          </p>
          <ul className="themes">
            {ideas.themes.map((t) => (
              <li key={t.name} className="card theme">
                <h4>{t.name}</h4>
                <p>{t.description}</p>
              </li>
            ))}
          </ul>
          <div className="idea-lists">
            {LISTS.map(({ key, title }) =>
              ideas[key].length > 0 ? (
                <div key={key} className="card">
                  <h4>{title}</h4>
                  <ul>
                    {ideas[key].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        </>
      )}
    </section>
  );
}
