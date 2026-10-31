import { MessageCircleHeart, PhoneOff, TrendingDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { formatInr } from '../lib/plan';
import { VENDOR_BACKUP_STEPS, budgetCut } from '../lib/whatif';
import { GuestShift } from './GuestShift';
import { NumberField } from './NumberField';
import type { EventPlan } from '../types';

interface Props {
  plan: EventPlan;
  /** True when the meal is seated and served (e.g. Bengali, Tamil), not a buffet. */
  served: boolean;
  /** Guests the guest list expects to actually turn up, when a list has been kept. */
  expectedFromList?: number;
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

const Steps = ({ steps }: { steps: string[] }) => (
  <ol className="steps">
    {steps.map((s) => (
      <li key={s}>{s}</li>
    ))}
  </ol>
);

/** "What if…" — the plan's own numbers for common surprises, and how to handle each one. */
export function WhatIfPanel({ plan, served, expectedFromList, onPlanFor, onAsk }: Props) {
  const [cut, setCut] = useState(10);
  const smaller = budgetCut(plan, cut);

  return (
    <section aria-labelledby="whatif-heading" className="whatif">
      <div className="card">
        <h3 id="whatif-heading">What if…</h3>
        <p className="muted">
          Plans change. Enter a number and see what each surprise would cost with your own plan — food, people
          and money — and what to do about it now, before the day.
        </p>
      </div>

      <GuestShift
        plan={plan}
        served={served}
        expectedFromList={expectedFromList}
        onPlanFor={onPlanFor}
        onAsk={onAsk}
      />

      <div className="scenario-grid">
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
