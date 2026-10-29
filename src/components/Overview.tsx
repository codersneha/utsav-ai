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
} from 'lucide-react';
import { useState } from 'react';
import { checklistProgress } from '../lib/checklist';
import { daysBetween } from '../lib/dates';
import { formatCompactInr, formatInr } from '../lib/plan';
import { familyUpdate, shareUrl, whatsappUrl } from '../lib/share';
import { tasksNeedingAttention, timelineProgress } from '../lib/timeline';
import type { EventPlan, Ideas, VendorEntry } from '../types';
import { CHART_COLORS, Donut, Ring } from './Charts';

interface Props {
  plan: EventPlan;
  today: string;
  ideas: Ideas | null;
  timelineDone: Record<string, boolean>;
  checklistDone: Record<string, boolean>;
  vendors: VendorEntry[];
  onNavigate: (tab: string) => void;
}

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return {
    day: d.getUTCDate(),
    month: d.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' }),
  };
};

/** The at-a-glance dashboard: budget, progress, what's next and sharing. */
export function Overview({ plan, today, ideas, timelineDone, checklistDone, vendors, onNavigate }: Props) {
  const { budget, timeline, checklist, details } = plan;
  const [copied, setCopied] = useState('');

  const tasksPct = timelineProgress(timeline, timelineDone);
  const vendorPct = checklistProgress(checklist, checklistDone);
  const confirmed = new Set(vendors.filter((v) => v.status === 'confirmed').map((v) => v.groupId)).size;
  const attention = tasksNeedingAttention(timeline, timelineDone, today);
  const upNext = timeline.milestones.filter((m) => !timelineDone[m.id] && m.daysBefore >= 0).slice(0, 4);

  const sorted = [...budget.lines].sort((a, b) => b.amount - a.amount);
  const slices = [
    ...sorted.slice(0, 5).map((l) => ({ label: l.label, value: l.amount })),
    { label: 'Everything else', value: sorted.slice(5).reduce((s, l) => s + l.amount, 0) },
  ].filter((s) => s.value > 0);

  const base = typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`;
  const update = familyUpdate(plan, timelineDone, today);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`${what} copied`);
    } catch {
      setCopied('Copy failed — select and copy the text manually');
    }
  };

  return (
    <section aria-labelledby="overview-heading">
      <h3 id="overview-heading" className="sr-only">
        Overview
      </h3>
      <div className="dashboard">
        <article className="card span-4" aria-labelledby="progress-title">
          <h4 id="progress-title" className="card-title">
            <span className="icon-badge teal" aria-hidden="true">
              <LayoutDashboard size={20} />
            </span>
            Progress
          </h4>
          <div className="rings">
            <Ring value={tasksPct} label="Tasks done" />
            <Ring value={vendorPct} label="Vendor checklist" color="var(--teal)" />
          </div>
          <p className="hint">
            {confirmed} of {checklist.length} vendor types confirmed
          </p>
        </article>

        <article className="card span-8" aria-labelledby="budget-glance-title">
          <h4 id="budget-glance-title" className="card-title">
            <span className="icon-badge gold" aria-hidden="true">
              <PieChart size={20} />
            </span>
            Budget at a glance
          </h4>
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

        <article className="card" aria-labelledby="next-title">
          <h4 id="next-title" className="card-title">
            <span className="icon-badge" aria-hidden="true">
              <CalendarCheck size={20} />
            </span>
            Up next
          </h4>
          {upNext.length === 0 ? (
            <p className="empty-state">
              <PartyPopper size={28} aria-hidden="true" /> Every planning task is done. Enjoy the celebration!
            </p>
          ) : (
            <ul className="up-next">
              {upNext.map((m) => {
                const { day, month } = shortDate(m.due);
                const days = daysBetween(today, m.due);
                return (
                  <li key={m.id}>
                    <span className="date-chip" aria-hidden="true">
                      <strong>{day}</strong>
                      {month}
                    </span>
                    <span>
                      {m.task}
                      <span className="badge subtle">
                        {days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" className="btn small" onClick={() => onNavigate('timeline')}>
            Open timeline <ArrowRight size={16} aria-hidden="true" />
          </button>
        </article>

        <article className="card" aria-labelledby="attention-title">
          <h4 id="attention-title" className="card-title">
            <span className="icon-badge" aria-hidden="true">
              <AlertTriangle size={20} />
            </span>
            Needs attention
          </h4>
          {attention.overdue.length === 0 && budget.warnings.length === 0 ? (
            <p className="notice success">All on track — nothing is overdue and the budget adds up.</p>
          ) : (
            <ul className="plain">
              {attention.overdue.map((m) => (
                <li key={m.id} className="notice warning">
                  Overdue: {m.task}
                </li>
              ))}
              {attention.affected.length > 0 && (
                <li className="hint">
                  May slip as a result: {attention.affected.map((m) => m.task).join('; ')}
                </li>
              )}
              {budget.warnings.map((w) => (
                <li key={w} className="notice warning">
                  {w}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card spotlight" aria-labelledby="theme-title">
          <h4 id="theme-title" className="card-title">
            <span className="icon-badge gold" aria-hidden="true">
              <Lightbulb size={20} />
            </span>
            Your theme
          </h4>
          {ideas?.ceremonies[0] ? (
            <>
              <h4>{ideas.ceremonies[0].theme}</h4>
              <p>{ideas.ceremonies[0].decor.slice(0, 2).join(' · ')}</p>
            </>
          ) : (
            <p className="muted">Gemini is preparing theme ideas for you…</p>
          )}
          <button type="button" className="btn small" onClick={() => onNavigate('ideas')}>
            See all ideas <ArrowRight size={16} aria-hidden="true" />
          </button>
        </article>

        <article className="card" aria-labelledby="share-title">
          <h4 id="share-title" className="card-title">
            <span className="icon-badge teal" aria-hidden="true">
              <Share2 size={20} />
            </span>
            Share with family
          </h4>
          <p>
            Send a quick update to the family group, or a link that opens this plan for{' '}
            {details.title || 'your event'} on their phone.
          </p>
          <div className="share-actions">
            <a
              className="btn small primary"
              href={whatsappUrl(update)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={16} aria-hidden="true" /> Share update on WhatsApp
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <button
              type="button"
              className="btn small"
              onClick={() => void copy(shareUrl(details, base), 'Link')}
            >
              <Copy size={16} aria-hidden="true" /> Copy plan link
            </button>
          </div>
          <p className="hint" role="status">
            {copied}
          </p>
        </article>
      </div>
    </section>
  );
}
