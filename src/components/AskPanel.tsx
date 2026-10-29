import { useState, type FormEvent } from 'react';
import { LIMITS } from '../lib/validation';
import type { ChatTurn } from '../types';

const SUGGESTIONS = [
  'What is the most stressful part to plan first?',
  'How can I cut costs without guests noticing?',
  'How do I plan for rain?',
];

interface Props {
  turns: ChatTurn[];
  asking: boolean;
  onAsk: (question: string) => void;
  onClear: () => void;
}

/** Multi-turn planning chat: Gemini sees the event, budget estimates and recent turns. */
export function AskPanel({ turns, asking, onAsk, onClear }: Props) {
  const [question, setQuestion] = useState('');

  const ask = (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 3 || asking) return;
    onAsk(trimmed);
    setQuestion('');
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(question);
  };

  return (
    <section aria-labelledby="ask-heading">
      <div className="panel-head">
        <h3 id="ask-heading">Ask the planner</h3>
        {turns.length > 0 && (
          <button type="button" className="link-btn" onClick={onClear}>
            Clear conversation
          </button>
        )}
      </div>
      <p className="hint">The planner remembers your recent questions, so you can ask follow-ups.</p>
      <div className="answers" aria-live="polite" aria-busy={asking}>
        {turns.map((t, i) => (
          <article key={`${i}-${t.question}`} className="card answer">
            <h4>{t.question}</h4>
            <p>{t.answer}</p>
          </article>
        ))}
        {asking && <p className="muted">Thinking…</p>}
      </div>
      <form className="ask-form" onSubmit={onSubmit}>
        <label htmlFor="question">Your question</label>
        <div className="ask-row">
          <input
            id="question"
            value={question}
            maxLength={LIMITS.questionMax}
            placeholder="e.g. What should I check before paying the caterer?"
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button type="submit" className="btn primary" disabled={asking || question.trim().length < 3}>
            {asking ? 'Thinking…' : 'Ask'}
          </button>
        </div>
      </form>
      <div className="chips" aria-label="Suggested questions" role="group">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chip" disabled={asking} onClick={() => ask(s)}>
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}
