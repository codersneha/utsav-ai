import { useEffect, useRef, useState } from 'react';
import type { Planner } from '../hooks/usePlanner';
import { buildIcs, googleCalendarUrl } from '../lib/calendar';
import { daysBetween, formatDate } from '../lib/dates';
import { formatInr } from '../lib/plan';
import type { EventPlan } from '../types';
import { AskPanel } from './AskPanel';
import { BudgetPanel } from './BudgetPanel';
import { ChecklistPanel } from './ChecklistPanel';
import { IdeasPanel } from './IdeasPanel';
import { Tabs } from './Tabs';
import { TimelinePanel } from './TimelinePanel';

const TYPE_LABEL = { wedding: 'Wedding', birthday: 'Birthday', community: 'Community event' } as const;

export interface PlanViewProps {
  planner: Planner;
  plan: EventPlan;
  onEdit: () => void;
}

function downloadIcs(plan: EventPlan) {
  const blob = new Blob([buildIcs(plan.details, plan.timeline.milestones)], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'utsav-ai-plan.ics';
  a.click();
  URL.revokeObjectURL(url);
}

/** The generated plan: summary, change report, export actions and tabbed sections. */
export default function PlanView({ planner, plan, onEdit }: PlanViewProps) {
  const { details } = plan;
  const [tab, setTab] = useState('ideas');
  const daysToGo = daysBetween(planner.today, details.date);
  const changeRef = useRef<HTMLDivElement>(null);

  // Move focus to the change report so keyboard and screen-reader users hear what changed.
  useEffect(() => {
    if (planner.change) changeRef.current?.focus();
  }, [planner.change]);

  const tabs = [
    {
      id: 'ideas',
      label: 'Ideas',
      content: (
        <IdeasPanel
          ideas={planner.ideas.value}
          loading={planner.ideas.loading}
          notice={planner.ideas.notice}
          onRegenerate={planner.ideas.regenerate}
          onRefine={planner.ideas.refine}
        />
      ),
    },
    {
      id: 'budget',
      label: 'Budget',
      content: (
        <BudgetPanel
          budget={plan.budget}
          eventType={details.eventType}
          guests={details.guests}
          overrides={planner.budget.overrides}
          spent={planner.budget.spent}
          onOverride={planner.budget.setOverride}
          onSpentChange={planner.budget.setSpent}
          onApplyTradeOff={planner.budget.applyTradeOff}
        />
      ),
    },
    {
      id: 'timeline',
      label: 'Timeline',
      content: (
        <TimelinePanel
          timeline={plan.timeline}
          today={planner.today}
          eventDate={details.date}
          done={planner.timeline.done}
          onToggle={planner.timeline.toggle}
          onAddTask={planner.timeline.addTask}
          onRemoveTask={planner.timeline.removeTask}
          logistics={planner.logistics.value}
          logisticsLoading={planner.logistics.loading}
          logisticsNotice={planner.logistics.notice}
        />
      ),
    },
    {
      id: 'checklist',
      label: 'Vendors',
      content: (
        <ChecklistPanel
          groups={plan.checklist}
          city={details.city}
          budget={plan.budget}
          done={planner.checklist.done}
          onToggle={planner.checklist.toggle}
          logistics={planner.logistics.value}
          logisticsLoading={planner.logistics.loading}
          entries={planner.vendors.entries}
          onAddVendor={planner.vendors.add}
          onUpdateVendor={planner.vendors.update}
          onRemoveVendor={planner.vendors.remove}
        />
      ),
    },
    {
      id: 'ask',
      label: 'Ask AI',
      content: (
        <AskPanel
          turns={planner.chat.turns}
          asking={planner.chat.asking}
          onAsk={(q) => void planner.chat.ask(q)}
          onClear={planner.chat.clear}
        />
      ),
    },
  ];

  return (
    <div className="plan">
      <section className="card summary" aria-labelledby="plan-title">
        <p className="eyebrow">{TYPE_LABEL[details.eventType]}</p>
        <h2 id="plan-title">{details.title || `Your ${TYPE_LABEL[details.eventType].toLowerCase()}`}</h2>
        <p className="meta">
          <time dateTime={details.date}>{formatDate(details.date)}</time> · {details.city} · {details.guests}{' '}
          guests · {formatInr(details.budget)}
        </p>
        <p className="countdown">
          {daysToGo > 0 ? `${daysToGo} days to go` : daysToGo === 0 ? 'It’s today!' : 'Event completed'}
        </p>
        <div className="actions no-print">
          <button type="button" className="btn primary" onClick={onEdit}>
            Change details
          </button>
          <button type="button" className="btn" onClick={() => downloadIcs(plan)}>
            Download timeline (.ics)
          </button>
          <a className="btn" href={googleCalendarUrl(details)} target="_blank" rel="noopener noreferrer">
            Add to Google Calendar<span className="sr-only"> (opens in a new tab)</span>
          </a>
          <button type="button" className="btn" onClick={() => window.print()}>
            Print / save PDF
          </button>
          <button type="button" className="btn ghost" onClick={planner.reset}>
            Start a new plan
          </button>
        </div>
      </section>

      {planner.change && (
        <div
          className="card change"
          ref={changeRef}
          tabIndex={-1}
          role="region"
          aria-labelledby="change-heading"
        >
          <div className="panel-head">
            <h3 id="change-heading">Plan updated — here’s what changed</h3>
            <button type="button" className="link-btn" onClick={planner.dismissChange}>
              Dismiss
            </button>
          </div>
          <ul>
            {planner.change.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} label="Plan sections" />
    </div>
  );
}
