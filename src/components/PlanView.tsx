import {
  CalendarDays,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  MapPin,
  MessageCircleHeart,
  Pencil,
  RotateCcw,
  Store,
  Shuffle,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Planner } from '../hooks/usePlanner';
import { buildIcs, googleCalendarUrl } from '../lib/calendar';
import { describeChanges } from '../lib/changes';
import { daysBetween, formatDate } from '../lib/dates';
import { buildPlan, formatInr } from '../lib/plan';
import type { ChangeProposal, EventPlan } from '../types';
import { AskPanel } from './AskPanel';
import { BudgetPanel } from './BudgetPanel';
import { ChecklistPanel } from './ChecklistPanel';
import { GuestsPanel } from './GuestsPanel';
import { PlanActions } from './PlanToolbar';
import { PrintSummary, usePrinting } from './PrintSummary';
import { IdeasPanel } from './IdeasPanel';
import { Overview } from './Overview';
import { Tabs } from './Tabs';
import { TimelinePanel } from './TimelinePanel';
import { WhatIfPanel } from './WhatIfPanel';
import { menuFor } from '../lib/culture';
import { guestTotals } from '../lib/guests';

const TYPE_LABEL = {
  wedding: 'Wedding',
  birthday: 'Birthday',
  community: 'Community event',
  corporate: 'Corporate event',
} as const;

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

/** What every tab needs to render its section. */
interface TabContext {
  planner: Planner;
  plan: EventPlan;
  goTo: (tab: string) => void;
}

/** What applying an assistant proposal would change, shown before the user agrees. */
function previewProposal({ planner, plan }: TabContext, p: ChangeProposal): string[] {
  const next = {
    ...plan.details,
    ...(p.guests ? { guests: p.guests } : {}),
    ...(p.budget ? { budget: p.budget } : {}),
    ...(p.date ? { date: p.date } : {}),
  };
  const nextPlan = buildPlan(next, planner.today, { overrides: planner.budget.overrides });
  return describeChanges(plan, nextPlan, planner.today).lines.filter(
    (l) => !l.startsWith('Kept:') && !l.startsWith('Ideas and'),
  );
}

const amountFor = (plan: EventPlan, id: string) => plan.budget.lines.find((l) => l.id === id)?.amount;

/** The plan's sections, in tab order. Each one only wires planner state to a presentational panel. */
const TABS: { id: string; label: string; icon: typeof Pencil; render: (ctx: TabContext) => ReactNode }[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    render: ({ planner, plan, goTo }) => (
      <Overview
        plan={plan}
        today={planner.today}
        ideas={planner.ideas.value}
        timelineDone={planner.timeline.done}
        checklistDone={planner.checklist.done}
        vendors={planner.vendors.entries}
        guests={planner.guests.entries}
        onNavigate={goTo}
      />
    ),
  },
  {
    id: 'ideas',
    label: 'Ideas',
    icon: Lightbulb,
    render: ({ planner, plan }) => (
      <IdeasPanel
        details={plan.details}
        ideas={planner.ideas.value}
        loading={planner.ideas.loading}
        busySection={planner.ideas.busySection}
        notice={planner.ideas.notice}
        onRegenerate={planner.ideas.regenerate}
        onRefine={planner.ideas.refine}
        onRefreshSection={planner.ideas.refreshSection}
        onUseInspiration={planner.applyLook}
        onToggleDecor={planner.setDecor}
        catering={amountFor(plan, 'catering')}
        decor={amountFor(plan, 'decor')}
      />
    ),
  },
  {
    id: 'budget',
    label: 'Budget',
    icon: Wallet,
    render: ({ planner, plan }) => (
      <BudgetPanel
        budget={plan.budget}
        eventType={plan.details.eventType}
        guests={plan.details.guests}
        overrides={planner.budget.overrides}
        spent={planner.budget.spent}
        onSetAmounts={planner.budget.setAmounts}
        locks={planner.budget.locks}
        onToggleLock={planner.budget.toggleLock}
        onSpentChange={planner.budget.setSpent}
        onApplyTradeOff={planner.budget.applyTradeOff}
      />
    ),
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: ListChecks,
    render: ({ planner, plan }) => (
      <TimelinePanel
        timeline={plan.timeline}
        today={planner.today}
        eventDate={plan.details.date}
        done={planner.timeline.done}
        onToggle={planner.timeline.toggle}
        onDownloadIcs={() => downloadIcs(plan)}
        calendarUrl={googleCalendarUrl(plan.details)}
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
    icon: Store,
    render: ({ planner, plan }) => (
      <ChecklistPanel
        groups={plan.checklist}
        city={plan.details.city}
        venueName={plan.details.venueName}
        venueType={plan.details.venueType}
        venuePreference={plan.details.venuePreference}
        onChooseVenue={planner.chooseVenue}
        chosenVenue={planner.chosenVenue}
        venueLinkError={planner.venueLinkError}
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
    id: 'guests',
    label: 'Guests',
    icon: UsersRound,
    render: ({ planner, plan }) => (
      <GuestsPanel
        eventType={plan.details.eventType}
        plannedGuests={plan.details.guests}
        entries={planner.guests.entries}
        onAdd={planner.guests.add}
        onUpdate={planner.guests.update}
        onRemove={planner.guests.remove}
        onPlanFor={(n) => void planner.setGuestCount(n)}
      />
    ),
  },
  {
    id: 'whatif',
    label: 'What if',
    icon: Shuffle,
    render: ({ planner, plan, goTo }) => (
      <WhatIfPanel
        plan={plan}
        served={/seated/i.test(menuFor(plan.details).service)}
        expectedFromList={
          planner.guests.entries.length > 0 ? guestTotals(planner.guests.entries).expected : undefined
        }
        onPlanFor={(n) => void planner.setGuestCount(n)}
        onAsk={(q) => {
          goTo('ask');
          void planner.chat.ask(q);
        }}
      />
    ),
  },
  {
    id: 'ask',
    label: 'Ask AI',
    icon: MessageCircleHeart,
    render: (ctx) => (
      <AskPanel
        turns={ctx.planner.chat.turns}
        asking={ctx.planner.chat.asking}
        onAsk={(q) => void ctx.planner.chat.ask(q)}
        onClear={ctx.planner.chat.clear}
        onApply={ctx.planner.chat.applyProposal}
        onDismiss={ctx.planner.chat.dismissProposal}
        preview={(p) => previewProposal(ctx, p)}
      />
    ),
  },
];

function Countdown({ days }: { days: number }) {
  return (
    <p className="countdown-badge">
      {days > 0 ? (
        <>
          <strong>{days}</strong>
          <span>days to go</span>
        </>
      ) : (
        <strong>{days === 0 ? 'Today!' : 'Done'}</strong>
      )}
    </p>
  );
}

/** The festive header: what, when, where, how many and how much. */
function EventHero({ planner, plan, onEdit }: PlanViewProps) {
  const { details } = plan;
  const label = TYPE_LABEL[details.eventType];
  return (
    <section className={`event-hero ${details.eventType}`} aria-labelledby="plan-title">
      <div className="event-hero-top">
        <div>
          <p className="eyebrow">{label}</p>
          <h2 id="plan-title">{details.title || `Your ${label.toLowerCase()}`}</h2>
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
        <Countdown days={daysBetween(planner.today, details.date)} />
      </div>
      <PlanActions plan={plan} onEdit={onEdit} onReset={planner.reset} />
    </section>
  );
}

/** What the last edit changed, with undo. Focused when it appears so screen readers announce it. */
function ChangeReport({ planner }: { planner: Planner }) {
  const ref = useRef<HTMLDivElement>(null);
  const { change } = planner;
  useEffect(() => {
    if (change) ref.current?.focus();
  }, [change]);
  if (!change) return null;
  return (
    <div className="card change" ref={ref} tabIndex={-1} role="region" aria-labelledby="change-heading">
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
        {change.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

/** The generated plan: festive header, change report, and tabbed sections. */
export default function PlanView({ planner, plan, onEdit }: PlanViewProps) {
  const [tab, setTab] = useState('overview');
  const printing = usePrinting();
  const ctx: TabContext = { planner, plan, goTo: setTab };
  const tabs = TABS.map(({ id, label, icon: Icon, render }) => ({
    id,
    label,
    icon: <Icon size={18} aria-hidden="true" />,
    content: render(ctx),
  }));

  return (
    <div className="plan">
      {printing && (
        <PrintSummary
          plan={plan}
          ideas={planner.ideas.value}
          logistics={planner.logistics.value}
          timelineDone={planner.timeline.done}
          vendors={planner.vendors.entries}
          guests={planner.guests.entries}
        />
      )}
      <EventHero planner={planner} plan={plan} onEdit={onEdit} />
      <ChangeReport planner={planner} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} label="Plan sections" />
    </div>
  );
}
