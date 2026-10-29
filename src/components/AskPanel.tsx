import { useState, type FormEvent } from 'react';
import { askPlanner } from '../lib/api';
import { LIMITS } from '../lib/validation';
import type { EventDetails } from '../types';

const SUGGESTIONS = [
  'How can I cut costs without guests noticing?',
  'What should the day-of schedule look like?',
  'How do I plan for rain?',
];

interface QA {
  question: string;
  answer: string;
}

/** Free-form follow-up questions answered by Gemini with the event as context. */
export function AskPanel({ details }: { details: EventDetails }) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<QA[]>([]);
  const [loading, setLoading] = useState(false);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 3 || loading) return;
    setLoading(true);
    const answer = await askPlanner(details, trimmed);
    setHistory((h) => [{ question: trimmed, answer }, ...h].slice(0, 10));
    setQuestion('');
    setLoading(false);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(question);
  };

  return (
    <section aria-labelledby="ask-heading">
      <h3 id="ask-heading">Ask the planner</h3>
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
          <button type="submit" className="btn primary" disabled={loading || question.trim().length < 3}>
            {loading ? 'Thinking…' : 'Ask'}
          </button>
        </div>
      </form>
      <div className="chips" aria-label="Suggested questions" role="group">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chip" disabled={loading} onClick={() => void ask(s)}>
            {s}
          </button>
        ))}
      </div>
      <div aria-live="polite" aria-busy={loading} className="answers">
        {history.map((qa, i) => (
          <article key={`${i}-${qa.question}`} className="card answer">
            <h4>{qa.question}</h4>
            <p>{qa.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
