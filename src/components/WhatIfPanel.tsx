import { MessageCircleHeart, PhoneOff, TrendingDown, UserPlus, UserX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { formatInr } from '../lib/plan';
import { VENDOR_BACKUP_STEPS, budgetCut, fewerGuests, moreGuests } from '../lib/whatif';
import type { EventPlan } from '../types';

interface Props {
  plan: EventPlan;
  /** True when the meal is seated and served (e.g. Bengali, Tamil), not a buffet. */
  served: boolean;
  onPlanFor: (guests: number) => void;
  onAsk: (question: string) => void;
}

function Scenario({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="card scenario" aria-labelledby={`${id}-heading`}>
      <h4 id={`${id}-heading`} className="card-title">
        <span className="icon-badge" aria-hidden="true">
          {icon}
        </span>
        {title}
      </h4>
      {children}
    </section>
  );
}

function NumberField({
  id,
  label,
  value,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  // Keep what the user types (even an empty box) and only commit valid numbers.
  const [text, setText] = useState(String(value));
  return (
    <div className="field inline-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={1}
        max={max}
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Math.round(Number(e.target.value));
          if (e.target.value !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(1, n)));
        }}
        onBlur={() => setText(String(value))}
      />
    </div>
  );
}

const Steps = ({ steps }: { steps: string[] }) => (
  <ol className="steps">
    {steps.map((s) => (
      <li key={s}>{s}</li>
    ))}
  </ol>
);

/** "What if…" — the plan's own numbers for common surprises, and how to handle each one. */
export function WhatIfPanel({ plan, served, onPlanFor, onAsk }: Props) {
  const { details } = plan;
  const catering = plan.budget.lines.find((l) => l.id === 'catering')?.amount ?? 0;
  const perPlate = Math.round(catering / Math.max(1, details.guests));
  const [extra, setExtra] = useState(Math.max(10, Math.round(details.guests * 0.15)));
  const [missing, setMissing] = useState(Math.max(10, Math.round(details.guests * 0.3)));
  const [cut, setCut] = useState(10);
  const more = moreGuests(plan, extra, perPlate, served);
  const fewer = fewerGuests(plan, missing, perPlate);
  const smaller = budgetCut(plan, cut);

  return (
    <section aria-labelledby="whatif-heading" className="whatif">
      <div className="card">
        <h3 id="whatif-heading">What if…</h3>
        <p className="muted">
          Plans change. See what each surprise would cost with your own numbers, and what to do about it now —
          before the day.
        </p>
      </div>

      <div className="scenario-grid">
        <Scenario id="more" icon={<UserPlus size={18} />} title="More guests turn up">
          <NumberField id="whatif-extra" label="Extra guests" value={extra} max={5000} onChange={setExtra} />
          <p className="impact">
            About <strong>{formatInr(more.cost)}</strong> more ({formatInr(Math.round(more.cost / extra))} per
            guest).{' '}
            {more.shortfall > 0 ? (
              <span className="negative">
                Your contingency of {formatInr(more.contingency)} falls short by {formatInr(more.shortfall)}.
              </span>
            ) : (
              <span className="positive">Your contingency of {formatInr(more.contingency)} covers it.</span>
            )}
          </p>
          <Steps steps={more.steps} />
          <div className="actions">
            <button type="button" className="btn small" onClick={() => onPlanFor(details.guests + extra)}>
              Plan for {details.guests + extra} guests
            </button>
          </div>
        </Scenario>

        <Scenario id="fewer" icon={<UserX size={18} />} title="Fewer guests come (rain, strike, illness)">
          <NumberField
            id="whatif-missing"
            label="Guests who can’t come"
            value={missing}
            max={Math.max(1, details.guests - 1)}
            onChange={setMissing}
          />
          <p className="impact">
            Up to <strong>{formatInr(fewer.wasted)}</strong> of food could go to waste — or be saved if you
            tell the caterer before the final-headcount deadline.
          </p>
          <Steps steps={fewer.steps} />
          <div className="actions">
            <button
              type="button"
              className="btn small"
              onClick={() => onPlanFor(Math.max(1, details.guests - missing))}
            >
              Plan for {Math.max(1, details.guests - missing)} guests
            </button>
          </div>
        </Scenario>

        <Scenario id="cut" icon={<TrendingDown size={18} />} title="The budget is cut">
          <NumberField id="whatif-cut" label="Cut by (%)" value={cut} max={60} onChange={setCut} />
          <p className="impact">
            New budget <strong>{formatInr(smaller.newTotal)}</strong>. Contingency stays protected; the
            biggest cuts:
          </p>
          <ul className="cuts">
            {smaller.cuts.slice(0, 3).map((c) => (
              <li key={c.label}>
                {c.label}: {formatInr(c.from)} → {formatInr(c.to)}
              </li>
            ))}
          </ul>
          <Steps steps={smaller.steps} />
        </Scenario>

        <Scenario id="vendor" icon={<PhoneOff size={18} />} title="A vendor cancels at the last minute">
          <Steps steps={VENDOR_BACKUP_STEPS} />
        </Scenario>
      </div>

      <div className="card ask-whatif">
        <p>Something else on your mind?</p>
        <div className="chips" role="group" aria-label="Ask the planner">
          {[
            'What if it rains on the day?',
            'What if the venue cancels a month before?',
            'What if the date moves two weeks earlier?',
          ].map((q) => (
            <button key={q} type="button" className="chip" onClick={() => onAsk(q)}>
              <MessageCircleHeart size={14} aria-hidden="true" /> {q}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
