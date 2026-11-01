import { Check, Lock, LockOpen, MinusCircle } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import {
  allocateRemainder,
  describeShift,
  guestImpact,
  rebalance,
  releaseCategory,
  suggestTradeOffs,
  summariseSpend,
  type TradeOff,
  type TradeOffAction,
} from '../lib/budget';
import { parseInr } from '../lib/money';
import { formatCompactInr, formatInr } from '../lib/plan';
import type { BudgetLine, BudgetPlan, EventType } from '../types';
import { CHART_COLORS } from './Charts';

interface Props {
  budget: BudgetPlan;
  eventType: EventType;
  guests: number;
  overrides: Record<string, number>;
  spent: Record<string, number>;
  locks: string[];
  onSetAmounts: (amounts: Record<string, number>) => void;
  onToggleLock: (id: string) => void;
  onSpentChange: (id: string, amount: number) => void;
  onApplyTradeOff: (action: TradeOffAction) => void;
}

const toAmount = (value: string) => Math.max(0, Math.round(Number(value) || 0));

function BudgetStats({ budget, spent }: { budget: BudgetPlan; spent: number }) {
  const stats: [string, number, string?][] = [
    ['Total budget', budget.total],
    ['Per guest', budget.perGuest],
    ['Unallocated', budget.unallocated, budget.unallocated < 0 ? 'negative' : undefined],
    ['Spent so far', spent],
  ];
  return (
    <dl className="stats">
      {stats.map(([label, amount, tone]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className={tone}>{formatInr(amount)}</dd>
        </div>
      ))}
    </dl>
  );
}

function splitStatus(budget: BudgetPlan): ReactNode {
  if (budget.unallocated === 0) {
    return (
      <>
        <Check size={16} aria-hidden="true" /> Balanced — everything adds up to {formatInr(budget.total)}.
      </>
    );
  }
  return budget.unallocated > 0
    ? `${formatInr(budget.unallocated)} is unallocated — place it below.`
    : `Categories are ${formatInr(-budget.unallocated)} over the total budget.`;
}

/** One coloured bar for the whole split, with any unallocated money shown as a gap. */
function SplitBar({ budget }: { budget: BudgetPlan }) {
  return (
    <div className="card split-card">
      <div className="split-bar" aria-hidden="true">
        {budget.lines.map((l, i) =>
          l.amount > 0 ? (
            <span
              key={l.id}
              style={{ flexGrow: l.amount, background: CHART_COLORS[i % CHART_COLORS.length] }}
              title={`${l.label} ${l.percent}%`}
            />
          ) : null,
        )}
        {budget.unallocated > 0 && <span className="unallocated" style={{ flexGrow: budget.unallocated }} />}
      </div>
      <p className={`split-status${budget.unallocated === 0 ? ' ok' : ''}`} role="status">
        {splitStatus(budget)}
      </p>
    </div>
  );
}

/** Places unallocated money, or pulls an over-budget split back within the total. */
function UnallocatedCard({
  budget,
  locks,
  onApply,
}: {
  budget: BudgetPlan;
  locks: string[];
  onApply: (amounts: Record<string, number>) => void;
}) {
  const [target, setTarget] = useState('spread');
  if (budget.unallocated === 0) return null;
  if (budget.unallocated < 0) {
    return (
      <div className="card unallocated-card">
        <div className="ask-row">
          <p>Bring the categories back within the total, in proportion (locked ones stay as they are).</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => onApply(allocateRemainder(budget, 'spread', locks))}
          >
            Fit to budget
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="card unallocated-card">
      <label htmlFor="allocate-target">Put the unallocated {formatInr(budget.unallocated)} into</label>
      <div className="ask-row">
        <select id="allocate-target" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="spread">All categories, in proportion</option>
          {budget.lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn primary"
          onClick={() => onApply(allocateRemainder(budget, target, locks))}
        >
          Allocate
        </button>
      </div>
    </div>
  );
}

function TradeOffs({ options, onApply }: { options: TradeOff[]; onApply: (action: TradeOffAction) => void }) {
  if (options.length === 0) return null;
  return (
    <section className="card tradeoffs" aria-labelledby="tradeoffs-heading">
      <h4 id="tradeoffs-heading">Your options — you choose</h4>
      <ul>
        {options.map((t) => (
          <li key={t.id}>
            <div>
              <strong>{t.title}</strong>
              <p className="hint">{t.detail}</p>
            </div>
            <button
              type="button"
              className="btn"
              aria-label={`Apply: ${t.title}`}
              onClick={() => onApply(t.action)}
            >
              Apply
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Planned against actual spend, one editable row per category. */
function SpendTable({
  budget,
  spent,
  onChange,
}: {
  budget: BudgetPlan;
  spent: Record<string, number>;
  onChange: (id: string, amount: number) => void;
}) {
  return (
    <section aria-labelledby="spend-heading" className="spend">
      <h4 id="spend-heading">Track spending</h4>
      <div className="table-scroll">
        <table className="budget-table">
          <caption className="sr-only">Planned and actual spend by category</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Planned</th>
              <th scope="col">Spent (₹)</th>
            </tr>
          </thead>
          <tbody>
            {budget.lines.map((line) => {
              const value = spent[line.id] ?? 0;
              return (
                <tr key={line.id} className={value > line.amount ? 'over' : undefined}>
                  <th scope="row">{line.label}</th>
                  <td>{formatInr(line.amount)}</td>
                  <td>
                    <label className="sr-only" htmlFor={`spent-${line.id}`}>
                      Amount spent on {line.label}
                    </label>
                    <input
                      id={`spent-${line.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={500}
                      className="spent-input"
                      value={value || ''}
                      placeholder="0"
                      onChange={(e) => onChange(line.id, toAmount(e.target.value))}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Budget split that stays balanced: sliders rebalance, locks protect, removed money waits as unallocated. */
export function BudgetPanel(props: Props) {
  const { budget, eventType, guests, overrides, spent, locks } = props;
  const [shift, setShift] = useState('');
  const summary = useMemo(() => summariseSpend(budget, spent), [budget, spent]);
  const tradeOffs = useMemo(
    () => suggestTradeOffs(eventType, budget, guests, overrides),
    [eventType, budget, guests, overrides],
  );
  const extra10 = guestImpact(budget, guests, 10);

  const apply = (next: Record<string, number>) => {
    setShift(describeShift(budget, next));
    props.onSetAmounts(next);
  };
  const resetSplit = () => {
    setShift('Back to the suggested split.');
    props.onApplyTradeOff({ kind: 'overrides', overrides: {} });
  };

  return (
    <section aria-labelledby="budget-heading" className="budget">
      <h3 id="budget-heading">Budget breakdown</h3>
      <BudgetStats budget={budget} spent={summary.spent} />
      <SplitBar budget={budget} />
      <UnallocatedCard budget={budget} locks={locks} onApply={apply} />

      <div className="split-head">
        <div>
          <h4>Where the money goes</h4>
          <p className="hint">
            Move one slider and the others adjust to keep the total the same. Lock a category to protect it,
            or remove its money to place it elsewhere.
          </p>
        </div>
        {Object.keys(overrides).length > 0 && (
          <button type="button" className="btn small" onClick={resetSplit}>
            Reset to suggested split
          </button>
        )}
      </div>

      <ul className="split-list">
        {budget.lines.map((line, i) => (
          <SplitRow
            key={line.id}
            line={line}
            color={CHART_COLORS[i % CHART_COLORS.length]}
            budget={budget}
            locked={locks.includes(line.id)}
            locks={locks}
            onApply={apply}
            onToggleLock={() => props.onToggleLock(line.id)}
          />
        ))}
      </ul>

      <div aria-live="polite" className="shift-toast-wrap">
        {shift && (
          <p className="shift-toast">
            <span>{shift}</span>
            <button type="button" className="link-btn" onClick={() => setShift('')}>
              Dismiss
            </button>
          </p>
        )}
      </div>

      <p className="notice">
        <strong>These are estimates, not quotes.</strong> Typical splits for Indian {eventType} budgets,
        calculated in code (never by AI) so they add up to the rupee.
      </p>
      {extra10 > 0 && (
        <p className="hint">
          Guest-count impact: every 10 extra guests adds roughly {formatInr(extra10)} to food, invitations and
          other per-guest costs.
        </p>
      )}

      <div aria-live="polite">
        {budget.warnings.map((w) => (
          <p key={w} className="notice warning">
            {w}
          </p>
        ))}
        {summary.overBudget.length > 0 && (
          <p className="notice warning">Spending is over plan in: {summary.overBudget.join(', ')}.</p>
        )}
      </div>

      <TradeOffs options={tradeOffs} onApply={props.onApplyTradeOff} />
      <SpendTable budget={budget} spent={spent} onChange={props.onSpentChange} />
    </section>
  );
}

function SplitRow({
  line,
  color,
  budget,
  locked,
  locks,
  onApply,
  onToggleLock,
}: {
  line: BudgetLine;
  color: string;
  budget: BudgetPlan;
  locked: boolean;
  locks: string[];
  onApply: (next: Record<string, number>) => void;
  onToggleLock: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const room = budget.lines
    .filter((l) => l.id !== line.id && !locks.includes(l.id))
    .reduce((s, l) => s + l.amount, 0);
  const max = line.amount + room;
  const step = Math.max(500, Math.round(budget.total / 400 / 500) * 500);
  const kindId = `plan-${line.id}-kind`;

  const commit = () => {
    if (draft === null) return;
    const amount = parseInr(draft);
    setDraft(null);
    if (amount !== null && amount !== line.amount) onApply(rebalance(budget, line.id, amount, locks));
  };

  return (
    <li className={`split-row${locked ? ' locked' : ''}`}>
      <div className="split-label">
        <span className="dot" style={{ background: color }} aria-hidden="true" />
        <strong>{line.label}</strong>
        <span className="muted small">
          {line.percent}% · {formatCompactInr(line.amount)}
        </span>
        <span id={kindId} className="tag">
          {line.overridden ? 'Your amount' : 'Estimate'}
        </span>
        {line.priority && <span className="badge">Priority</span>}
        {line.scalesWithGuests && <span className="badge subtle">per guest</span>}
      </div>
      <input
        type="range"
        className="split-slider"
        min={0}
        max={Math.max(max, 1)}
        step={step}
        value={line.amount}
        disabled={locked || max === 0}
        aria-label={`${line.label} amount`}
        aria-valuetext={formatInr(line.amount)}
        style={{ accentColor: color }}
        onChange={(e) => onApply(rebalance(budget, line.id, Number(e.target.value), locks))}
      />
      <div className="split-controls">
        <button
          type="button"
          className={`btn small${locked ? ' primary' : ''}`}
          aria-pressed={locked}
          aria-label={`Lock ${line.label}`}
          onClick={onToggleLock}
        >
          {locked ? <Lock size={15} aria-hidden="true" /> : <LockOpen size={15} aria-hidden="true" />}
          Lock
        </button>
        <label className="sr-only" htmlFor={`plan-${line.id}`}>
          Planned amount for {line.label}
        </label>
        <input
          id={`plan-${line.id}`}
          className="amount-input"
          inputMode="text"
          autoComplete="off"
          value={draft ?? String(line.amount)}
          disabled={locked}
          aria-describedby={kindId}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
        />
        <button
          type="button"
          className="icon-btn"
          disabled={locked || line.amount === 0}
          aria-label={`Remove the money from ${line.label}`}
          title="Remove — the money goes to unallocated"
          onClick={() => onApply(releaseCategory(budget, line.id))}
        >
          <MinusCircle size={18} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
