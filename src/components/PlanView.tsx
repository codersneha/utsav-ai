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
import { GuestsPanel } from './GuestsPanel';
import { PlanActions } from './PlanToolbar';
import { PrintSummary, usePrinting } from './PrintSummary';
import { IdeasPanel } from './IdeasPanel';
import { Overview } from './Overview';
import { Tabs } from './Tabs';
import { TimelinePanel } from './TimelinePanel';
import { WhatIfPanel } from './WhatIfPanel';
import { menuFor } from '../lib/culture';

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

const icon = (Icon: typeof Pencil) => <Icon size={18} aria-hidden="true" />;

/** The generated plan: festive header, change report, and tabbed sections. */
export default function PlanView({ planner, plan, onEdit }: PlanViewProps) {
  const { details } = plan;
  const [tab, setTab] = useState('overview');
  const printing = usePrinting();
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
          guests={planner.guests.entries}
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
          onToggleDecor={planner.setDecor}
          catering={plan.budget.lines.find((l) => l.id === 'catering')?.amount}
          decor={plan.budget.lines.find((l) => l.id === 'decor')?.amount}
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
      icon: icon(ListChecks),
      content: (
        <TimelinePanel
          timeline={plan.timeline}
          today={planner.today}
          eventDate={details.date}
          done={planner.timeline.done}
          onToggle={planner.timeline.toggle}
          onDownloadIcs={() => downloadIcs(plan)}
          calendarUrl={googleCalendarUrl(details)}
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
          venueType={details.venueType}
          venuePreference={details.venuePreference}
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
      icon: icon(UsersRound),
      content: (
        <GuestsPanel
          eventType={details.eventType}
          plannedGuests={details.guests}
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
      icon: icon(Shuffle),
      content: (
        <WhatIfPanel
          plan={plan}
          served={/seated/i.test(menuFor(details).service)}
          onPlanFor={(n) => void planner.setGuestCount(n)}
          onAsk={(q) => {
            setTab('ask');
            void planner.chat.ask(q);
          }}
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
        <PlanActions plan={plan} onEdit={onEdit} onReset={planner.reset} />
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
