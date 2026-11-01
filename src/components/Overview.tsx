import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  Copy,
  LayoutDashboard,
  Lightbulb,
  MessageCircle,
  PartyPopper,
  PieChart,
  Share2,
  Sparkles,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { checklistProgress } from '../lib/checklist';
import { daysBetween } from '../lib/dates';
import { formatCompactInr, formatInr } from '../lib/plan';
import { familyUpdate, shareUrl, whatsappUrl } from '../lib/share';
import { tasksNeedingAttention, timelineProgress } from '../lib/timeline';
import { nextSteps, type NextStep } from '../lib/nextSteps';
import type { BudgetLine, BudgetPlan, EventPlan, GuestEntry, Ideas, VendorEntry } from '../types';
import { CHART_COLORS, Donut, Ring } from './Charts';

interface Props {
  plan: EventPlan;
  today: string;
  ideas: Ideas | null;
  timelineDone: Record<string, boolean>;
  checklistDone: Record<string, boolean>;
  vendors: VendorEntry[];
  guests: GuestEntry[];
  onNavigate: (tab: string) => void;
}

const STEP_ACTIONS: Record<string, string> = {
  timeline: 'Open timeline',
  budget: 'Open budget',
  ideas: 'Open menu',
  vendors: 'Open vendors',
  guests: 'Open guests',
  whatif: 'Plan B',
};

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return {
    day: d.getUTCDate(),
    month: d.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' }),
  };
};

/** A card heading with its coloured icon badge. */
function CardTitle({
  id,
  icon,
  tone,
  children,
}: {
  id: string;
  icon: ReactNode;
  tone?: string;
  children: ReactNode;
}) {
  return (
    <h4 id={id} className="card-title">
      <span className={tone ? `icon-badge ${tone}` : 'icon-badge'} aria-hidden="true">
        {icon}
      </span>
      {children}
    </h4>
  );
}

const OpenButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button type="button" className="btn small" onClick={onClick}>
    {label} <ArrowRight size={16} aria-hidden="true" />
  </button>
);

const dueLabel = (days: number) => (days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d`);

/** The five biggest budget lines, and everything else together, for the donut. */
function budgetSlices(lines: BudgetLine[]) {
  const sorted = [...lines].sort((a, b) => b.amount - a.amount);
  return [
    ...sorted.slice(0, 5).map((l) => ({ label: l.label, value: l.amount })),
    { label: 'Everything else', value: sorted.slice(5).reduce((s, l) => s + l.amount, 0) },
  ].filter((s) => s.value > 0);
}

function NextStepsCard({ steps, onNavigate }: { steps: NextStep[]; onNavigate: (tab: string) => void }) {
  return (
    <article className="card span-12 next-steps" aria-labelledby="steps-title">
      <CardTitle id="steps-title" tone="gold" icon={<Sparkles size={20} />}>
        Your next steps
      </CardTitle>
      <ol className="next-steps-list">
        {steps.map((step) => (
          <li key={step.id} className={step.urgent ? 'urgent' : undefined}>
            <span>{step.text}</span>
            <button
              type="button"
              className="btn small"
              onClick={() => onNavigate(step.tab)}
              aria-label={`${STEP_ACTIONS[step.tab]}: ${step.text}`}
            >
              {STEP_ACTIONS[step.tab]} <ArrowRight size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
    </article>
  );
}

function ProgressCard({ plan, timelineDone, checklistDone, vendors }: Props) {
  const confirmed = new Set(vendors.filter((v) => v.status === 'confirmed').map((v) => v.groupId)).size;
  return (
    <article className="card span-4" aria-labelledby="progress-title">
      <CardTitle id="progress-title" tone="teal" icon={<LayoutDashboard size={20} />}>
        Progress
      </CardTitle>
      <div className="rings">
        <Ring value={timelineProgress(plan.timeline, timelineDone)} label="Tasks done" />
        <Ring
          value={checklistProgress(plan.checklist, checklistDone)}
          label="Vendor checklist"
          color="var(--teal)"
        />
      </div>
      <p className="hint">
        {confirmed} of {plan.checklist.length} vendor types confirmed
      </p>
    </article>
  );
}

function BudgetGlanceCard({ budget, onNavigate }: { budget: BudgetPlan; onNavigate: (tab: string) => void }) {
  const slices = budgetSlices(budget.lines);
  return (
    <article className="card span-8" aria-labelledby="budget-glance-title">
      <CardTitle id="budget-glance-title" tone="gold" icon={<PieChart size={20} />}>
        Budget at a glance
      </CardTitle>
      <div className="donut-wrap">
        <Donut
          slices={slices}
          centerValue={formatCompactInr(budget.total)}
          centerLabel="total budget"
          title={`Budget of ${formatInr(budget.total)} split across categories`}
        />
        <div>
          <ul className="legend">
            {slices.map((s, i) => (
              <li key={s.label}>
                <span className="swatch" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span>{s.label}</span>
                <strong>{formatInr(s.value)}</strong>
              </li>
            ))}
          </ul>
          <p className="hint">
            {formatInr(budget.perGuest)} per guest · estimates, not quotes ·{' '}
            <button type="button" className="link-btn" onClick={() => onNavigate('budget')}>
              Edit budget
            </button>
          </p>
        </div>
      </div>
    </article>
  );
}

function UpNextCard({ plan, today, timelineDone, onNavigate }: Props) {
  const upNext = plan.timeline.milestones.filter((m) => !timelineDone[m.id] && m.daysBefore >= 0).slice(0, 4);
  return (
    <article className="card" aria-labelledby="next-title">
      <CardTitle id="next-title" icon={<CalendarCheck size={20} />}>
        Up next
      </CardTitle>
      {upNext.length === 0 ? (
        <p className="empty-state">
          <PartyPopper size={28} aria-hidden="true" /> Every planning task is done. Enjoy the celebration!
        </p>
      ) : (
        <ul className="up-next">
          {upNext.map((m) => {
            const { day, month } = shortDate(m.due);
            return (
              <li key={m.id}>
                <span className="date-chip" aria-hidden="true">
                  <strong>{day}</strong>
                  {month}
                </span>
                <span>
                  {m.task}
                  <span className="badge subtle">{dueLabel(daysBetween(today, m.due))}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <OpenButton label="Open timeline" onClick={() => onNavigate('timeline')} />
    </article>
  );
}

function AttentionCard({ plan, today, timelineDone }: Props) {
  const { overdue, affected } = tasksNeedingAttention(plan.timeline, timelineDone, today);
  const { warnings } = plan.budget;
  return (
    <article className="card" aria-labelledby="attention-title">
      <CardTitle id="attention-title" icon={<AlertTriangle size={20} />}>
        Needs attention
      </CardTitle>
      {overdue.length === 0 && warnings.length === 0 ? (
        <p className="notice success">All on track — nothing is overdue and the budget adds up.</p>
      ) : (
        <ul className="plain">
          {overdue.map((m) => (
            <li key={m.id} className="notice warning">
              Overdue: {m.task}
            </li>
          ))}
          {affected.length > 0 && (
            <li className="hint">May slip as a result: {affected.map((m) => m.task).join('; ')}</li>
          )}
          {warnings.map((w) => (
            <li key={w} className="notice warning">
              {w}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function ThemeCard({ ideas, onNavigate }: Props) {
  const first = ideas?.ceremonies[0];
  return (
    <article className="card spotlight" aria-labelledby="theme-title">
      <CardTitle id="theme-title" tone="gold" icon={<Lightbulb size={20} />}>
        Your theme
      </CardTitle>
      {first ? (
        <>
          <h4>{first.theme}</h4>
          <p>{first.decor.slice(0, 2).join(' · ')}</p>
        </>
      ) : (
        <p className="muted">Gemini is preparing theme ideas for you…</p>
      )}
      <OpenButton label="See all ideas" onClick={() => onNavigate('ideas')} />
    </article>
  );
}

/** A WhatsApp update for the family group and a link that opens the plan on another phone. */
function ShareCard({ plan, today, timelineDone }: Props) {
  const { details } = plan;
  const [copied, setCopied] = useState('');
  const base = typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(details, base));
      setCopied('Link copied');
    } catch {
      setCopied('Copy failed — select and copy the text manually');
    }
  };

  return (
    <article className="card" aria-labelledby="share-title">
      <CardTitle id="share-title" tone="teal" icon={<Share2 size={20} />}>
        Share with family
      </CardTitle>
      <p>
        Send a quick update to the family group, or a link that opens this plan for{' '}
        {details.title || 'your event'} on their phone.
      </p>
      <div className="share-actions">
        <a
          className="btn small primary"
          href={whatsappUrl(familyUpdate(plan, timelineDone, today))}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={16} aria-hidden="true" /> Share update on WhatsApp
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <button type="button" className="btn small" onClick={() => void copyLink()}>
          <Copy size={16} aria-hidden="true" /> Copy plan link
        </button>
      </div>
      <p className="hint" role="status">
        {copied}
      </p>
    </article>
  );
}

/** The at-a-glance dashboard: budget, progress, what's next and sharing. */
export function Overview(props: Props) {
  const { plan, today, ideas, timelineDone, vendors, guests, onNavigate } = props;
  const steps = nextSteps({ plan, today, timelineDone, vendors, guests, ideas });

  return (
    <section aria-labelledby="overview-heading">
      <h3 id="overview-heading" className="sr-only">
        Overview
      </h3>
      <div className="dashboard">
        {steps.length > 0 && <NextStepsCard steps={steps} onNavigate={onNavigate} />}
        <ProgressCard {...props} />
        <BudgetGlanceCard budget={plan.budget} onNavigate={onNavigate} />
        <UpNextCard {...props} />
        <AttentionCard {...props} />
        <ThemeCard {...props} />
        <ShareCard {...props} />
      </div>
    </section>
  );
}
