import { Link2, Pencil, Printer, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { shareUrl } from '../lib/share';
import type { EventPlan, VendorEntry } from '../types';

/** The plan's readiness at a glance, for the navigation bar. */
export function PlanReadiness({
  plan,
  timelineDone,
  vendors,
}: {
  plan: EventPlan;
  timelineDone: Record<string, boolean>;
  vendors: VendorEntry[];
}) {
  const tasksTotal = plan.timeline.milestones.length;
  const tasksDone = plan.timeline.milestones.filter((m) => timelineDone[m.id]).length;
  const groups = plan.checklist.length;
  const booked = plan.checklist.filter((g) =>
    vendors.some((v) => v.groupId === g.id && v.status === 'confirmed'),
  ).length;
  const total = tasksTotal + groups;
  const readiness = total === 0 ? 0 : Math.round(((tasksDone + booked) / total) * 100);

  return (
    <div className="readiness no-print">
      <div className="readiness-text">
        <span className="readiness-label">Plan readiness {readiness}%</span>
        <span className="muted small">
          {tasksDone}/{tasksTotal} tasks · {booked}/{groups} vendors
        </span>
      </div>
      <div
        className="readiness-bar"
        role="progressbar"
        aria-label="Plan readiness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={readiness}
      >
        <span style={{ width: `${Math.max(readiness, 2)}%` }} />
      </div>
    </div>
  );
}

/** Change, share, print and start over — shown on the plan's banner. */
export function PlanActions({
  plan,
  onEdit,
  onReset,
}: {
  plan: EventPlan;
  onEdit: () => void;
  onReset: () => void;
}) {
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const share = async () => {
    const url = shareUrl(plan.details, `${window.location.origin}${window.location.pathname}`);
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="plan-actions no-print">
      <div className="actions">
        <button type="button" className="btn on-dark" onClick={onEdit}>
          <Pencil size={18} aria-hidden="true" /> Change details
        </button>
        <button type="button" className="btn on-dark" onClick={() => void share()}>
          <Link2 size={18} aria-hidden="true" /> Share link
        </button>
        <button type="button" className="btn on-dark" onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" /> Print summary
        </button>
        <button type="button" className="btn on-dark" onClick={() => setConfirmReset(true)}>
          <RotateCcw size={18} aria-hidden="true" /> Reset
        </button>
      </div>
      <div aria-live="polite">
        {link && (
          <div className="share-field">
            <label htmlFor="share-link">
              {copied ? 'Link copied — anyone with it can open a copy of this plan' : 'Copy this link'}
            </label>
            <div className="ask-row">
              <input id="share-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn on-dark" onClick={() => setLink('')}>
                Done
              </button>
            </div>
          </div>
        )}
        {confirmReset && (
          <div className="reset-confirm" role="group" aria-label="Confirm reset">
            <span>Start over? This clears this plan from your browser.</span>
            <button
              type="button"
              className="btn small danger"
              onClick={() => {
                setConfirmReset(false);
                setLink('');
                onReset();
              }}
            >
              Yes, start over
            </button>
            <button type="button" className="btn small" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
