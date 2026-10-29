import { useState } from 'react';
import { buildIcs, googleCalendarUrl } from '../lib/calendar';
import { daysBetween, formatDate, todayIso } from '../lib/dates';
import { formatInr } from '../lib/plan';
import type { EventPlan, Ideas } from '../types';
import { AskPanel } from './AskPanel';
import { BudgetPanel } from './BudgetPanel';
import { ChecklistPanel } from './ChecklistPanel';
import { IdeasPanel } from './IdeasPanel';
import { Tabs } from './Tabs';
import { TimelinePanel } from './TimelinePanel';

const TYPE_LABEL = { wedding: 'Wedding', birthday: 'Birthday', community: 'Community event' } as const;

export interface PlanViewProps {
  plan: EventPlan;
  ideas: Ideas | null;
  ideasLoading: boolean;
  ideasNotice?: string;
  onRegenerateIdeas: () => void;
  done: Record<string, boolean>;
  onToggleTask: (id: string) => void;
  spent: Record<string, number>;
  onSpentChange: (id: string, amount: number) => void;
  onEdit: () => void;
  onReset: () => void;
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

/** The generated plan: summary, export actions and tabbed sections. */
export default function PlanView(props: PlanViewProps) {
  const { plan } = props;
  const { details } = plan;
  const [tab, setTab] = useState('ideas');
  const daysToGo = daysBetween(todayIso(), details.date);

  const tabs = [
    {
      id: 'ideas',
      label: 'Ideas',
      content: (
        <IdeasPanel
          ideas={props.ideas}
          loading={props.ideasLoading}
          notice={props.ideasNotice}
          onRegenerate={props.onRegenerateIdeas}
        />
      ),
    },
    {
      id: 'budget',
      label: 'Budget',
      content: <BudgetPanel budget={plan.budget} spent={props.spent} onSpentChange={props.onSpentChange} />,
    },
    { id: 'timeline', label: 'Timeline', content: <TimelinePanel timeline={plan.timeline} /> },
    {
      id: 'checklist',
      label: 'Vendors',
      content: (
        <ChecklistPanel
          groups={plan.checklist}
          city={details.city}
          done={props.done}
          onToggle={props.onToggleTask}
        />
      ),
    },
    { id: 'ask', label: 'Ask AI', content: <AskPanel details={details} /> },
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
          <button type="button" className="btn" onClick={() => downloadIcs(plan)}>
            Download timeline (.ics)
          </button>
          <a className="btn" href={googleCalendarUrl(details)} target="_blank" rel="noopener noreferrer">
            Add to Google Calendar<span className="sr-only"> (opens in a new tab)</span>
          </a>
          <button type="button" className="btn" onClick={() => window.print()}>
            Print / save PDF
          </button>
          <button type="button" className="btn" onClick={props.onEdit}>
            Edit details
          </button>
          <button type="button" className="btn ghost" onClick={props.onReset}>
            Start a new plan
          </button>
        </div>
      </section>
      <Tabs tabs={tabs} active={tab} onChange={setTab} label="Plan sections" />
    </div>
  );
}
