import { Check, MessageCircleHeart, Send, Sparkles, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { LIMITS } from '../lib/validation';
import type { ChangeProposal, ChatTurn } from '../types';

const SUGGESTIONS = [
  'What is the most stressful part to plan first?',
  'How can I cut costs without guests noticing?',
  'How do I plan for rain?',
  'We now have 50 more guests',
];

interface Props {
  turns: ChatTurn[];
  asking: boolean;
  onAsk: (question: string) => void;
  onClear: () => void;
  onApply: (index: number) => void;
  onDismiss: (index: number) => void;
  /** Lines describing what a proposal would change, shown before the user agrees. */
  preview: (proposal: ChangeProposal) => string[];
}

/**
 * A planning chat with memory. When you describe a change ("50 more guests"),
 * the assistant proposes it; nothing changes until you press Apply.
 */
export function AskPanel({ turns, asking, onAsk, onClear, onApply, onDismiss, preview }: Props) {
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
      <p className="hint">
        Ask anything about your event — or tell it what changed. It remembers the conversation, and it only
        changes your plan when you press Apply.
      </p>

      <div className="chat" aria-live="polite" aria-busy={asking}>
        {turns.length === 0 && !asking && (
          <p className="empty-state">
            <MessageCircleHeart size={32} aria-hidden="true" />
            Try one of the suggestions below, or ask in Hindi or Hinglish.
          </p>
        )}
        {turns.map((t, i) => (
          <article key={`${i}-${t.question}`} className="chat-turn" aria-label={`Question ${i + 1}`}>
            <div className="bubble user">
              <h4>{t.question}</h4>
            </div>
            <div className="bubble assistant">
              <p>{t.answer}</p>
              {t.proposal && (
                <div className="proposal">
                  <strong>
                    <Sparkles size={16} aria-hidden="true" /> Suggested change: {t.proposal.summary}
                  </strong>
                  {!t.proposalState && (
                    <>
                      <ul>
                        {preview(t.proposal).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      <div className="actions">
                        <button type="button" className="btn small primary" onClick={() => onApply(i)}>
                          <Check size={16} aria-hidden="true" /> Apply change
                        </button>
                        <button type="button" className="btn small" onClick={() => onDismiss(i)}>
                          <X size={16} aria-hidden="true" /> No thanks
                        </button>
                      </div>
                    </>
                  )}
                  {t.proposalState === 'applied' && (
                    <p className="hint">✓ Applied — you can undo it above.</p>
                  )}
                  {t.proposalState === 'dismissed' && <p className="hint">Not applied.</p>}
                </div>
              )}
            </div>
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
            placeholder="e.g. Budget thoda kam ho gaya hai, 2 lakh less — what should we cut?"
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button type="submit" className="btn primary" disabled={asking || question.trim().length < 3}>
            <Send size={16} aria-hidden="true" />
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
