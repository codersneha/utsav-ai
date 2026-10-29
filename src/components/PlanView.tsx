import {
  CalendarDays,
  CalendarPlus,
  Download,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  MapPin,
  MessageCircleHeart,
  Pencil,
  Printer,
  RotateCcw,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Planner } from '../hooks/usePlanner';
import { buildIcs, googleCalendarUrl } from '../lib/calendar';
import { describeChanges } from '../lib/changes';
import { daysBetween, formatDate } from '../lib/dates';
import { buildPlan, formatInr } from '../lib/plan';
import type { ChangeProposal, EventPlan } from '../types';
import { AskPanel } from './AskPanel';
import { BudgetPanel } from './BudgetPanel';
import { ChecklistPanel } from './ChecklistPanel';
import { IdeasPanel } from './IdeasPanel';
import { Overview } from './Overview';
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

const icon = (Icon: typeof Pencil) => <Icon size={18} aria-hidden="true" />;

/** The generated plan: festive header, change report, and tabbed sections. */
export default function PlanView({ planner, plan, onEdit }: PlanViewProps) {
  const { details } = plan;
  const [tab, setTab] = useState('overview');
  const daysToGo = daysBetween(planner.today, details.date);
  const changeRef = useRef<HTMLDivElement>(null);

  // Move focus to the change report so keyboard and screen-reader users hear what changed.
  useEffect(() => {
    if (planner.change) changeRef.current?.focus();
  }, [planner.change]);

  /** What applying an assistant proposal would change, shown before the user agrees. */
  const previewProposal = (p: ChangeProposal) => {
    const next = {
      ...details,
      ...(p.guests ? { guests: p.guests } : {}),
      ...(p.budget ? { budget: p.budget } : {}),
      ...(p.date ? { date: p.date } : {}),
    };
    const nextPlan = buildPlan(next, planner.today, { overrides: planner.budget.overrides });
    return describeChanges(plan, nextPlan, planner.today).lines.filter(
      (l) => !l.startsWith('Kept:') && !l.startsWith('Ideas and'),
    );
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: icon(LayoutDashboard),
      content: (
        <Overview
          plan={plan}
          today={planner.today}
          ideas={planner.ideas.value}
          timelineDone={planner.timeline.done}
          checklistDone={planner.checklist.done}
          vendors={planner.vendors.entries}
          onNavigate={setTab}
        />
      ),
    },
    {
      id: 'ideas',
      label: 'Ideas',
      icon: icon(Lightbulb),
      content: (
        <IdeasPanel
          details={details}
          ideas={planner.ideas.value}
          loading={planner.ideas.loading}
          busySection={planner.ideas.busySection}
          notice={planner.ideas.notice}
          onRegenerate={planner.ideas.regenerate}
          onRefine={planner.ideas.refine}
          onRefreshSection={planner.ideas.refreshSection}
          onUseInspiration={planner.applyLook}
        />
      ),
    },
    {
      id: 'budget',
      label: 'Budget',
      icon: icon(Wallet),
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
      icon: icon(ListChecks),
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
      icon: icon(Store),
      content: (
        <ChecklistPanel
          groups={plan.checklist}
          city={details.city}
          venueName={details.venueName}
          onChooseVenue={(name) => void planner.chooseVenue(name)}
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
      icon: icon(MessageCircleHeart),
      content: (
        <AskPanel
          turns={planner.chat.turns}
          asking={planner.chat.asking}
          onAsk={(q) => void planner.chat.ask(q)}
          onClear={planner.chat.clear}
          onApply={planner.chat.applyProposal}
          onDismiss={planner.chat.dismissProposal}
          preview={previewProposal}
        />
      ),
    },
  ];

  return (
    <div className="plan">
      <section className={`event-hero ${details.eventType}`} aria-labelledby="plan-title">
        <div className="event-hero-top">
          <div>
            <p className="eyebrow">{TYPE_LABEL[details.eventType]}</p>
            <h2 id="plan-title">{details.title || `Your ${TYPE_LABEL[details.eventType].toLowerCase()}`}</h2>
            <ul className="event-meta" aria-label="Event details">
              <li>
                <CalendarDays size={16} aria-hidden="true" />
                <time dateTime={details.date}>{formatDate(details.date)}</time>
              </li>
              <li>
                <MapPin size={16} aria-hidden="true" /> {details.city}
              </li>
              <li>
                <Users size={16} aria-hidden="true" /> {details.guests} guests
              </li>
              <li>
                <Wallet size={16} aria-hidden="true" /> {formatInr(details.budget)}
              </li>
            </ul>
          </div>
          <p className="countdown-badge">
            {daysToGo > 0 ? (
              <>
                <strong>{daysToGo}</strong>
                <span>days to go</span>
              </>
            ) : (
              <strong>{daysToGo === 0 ? 'Today!' : 'Done'}</strong>
            )}
          </p>
        </div>
        <div className="actions no-print">
          <button type="button" className="btn on-dark" onClick={onEdit}>
            {icon(Pencil)} Change details
          </button>
          <button type="button" className="btn on-dark" onClick={() => downloadIcs(plan)}>
            {icon(Download)} Download timeline (.ics)
          </button>
          <a
            className="btn on-dark"
            href={googleCalendarUrl(details)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {icon(CalendarPlus)} Add to Google Calendar<span className="sr-only"> (opens in a new tab)</span>
          </a>
          <button type="button" className="btn on-dark" onClick={() => window.print()}>
            {icon(Printer)} Print / save PDF
          </button>
          <button type="button" className="btn on-dark" onClick={planner.reset}>
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
            <div className="actions">
              {planner.canUndo && (
                <button type="button" className="btn small" onClick={planner.undo}>
                  <RotateCcw size={16} aria-hidden="true" /> Undo
                </button>
              )}
              <button type="button" className="link-btn" onClick={planner.dismissChange}>
                Dismiss
              </button>
            </div>
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
