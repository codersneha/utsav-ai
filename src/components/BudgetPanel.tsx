import { useMemo } from 'react';
import { guestImpact, suggestTradeOffs, summariseSpend, type TradeOffAction } from '../lib/budget';
import { formatInr } from '../lib/plan';
import type { BudgetPlan, EventType } from '../types';

interface Props {
  budget: BudgetPlan;
  eventType: EventType;
  guests: number;
  overrides: Record<string, number>;
  spent: Record<string, number>;
  onOverride: (id: string, amount: number | null) => void;
  onSpentChange: (id: string, amount: number) => void;
  onApplyTradeOff: (action: TradeOffAction) => void;
}

const toAmount = (value: string) => Math.max(0, Math.round(Number(value) || 0));

/** Editable category plan, trade-off options and an expense tracker. */
export function BudgetPanel(props: Props) {
  const { budget, eventType, guests, overrides, spent } = props;
  const summary = useMemo(() => summariseSpend(budget, spent), [budget, spent]);
  const tradeOffs = useMemo(
    () => suggestTradeOffs(eventType, budget, guests, overrides),
    [eventType, budget, guests, overrides],
  );
  const extra10 = guestImpact(budget, guests, 10);

  return (
    <section aria-labelledby="budget-heading">
      <h3 id="budget-heading">Budget breakdown</h3>
      <dl className="stats">
        <div>
          <dt>Total budget</dt>
          <dd>{formatInr(budget.total)}</dd>
        </div>
        <div>
          <dt>Per guest</dt>
          <dd>{formatInr(budget.perGuest)}</dd>
        </div>
        <div>
          <dt>Unallocated</dt>
          <dd className={budget.unallocated < 0 ? 'negative' : undefined}>{formatInr(budget.unallocated)}</dd>
        </div>
        <div>
          <dt>Spent so far</dt>
          <dd>{formatInr(summary.spent)}</dd>
        </div>
        <div>
          <dt>Remaining</dt>
          <dd className={summary.remaining < 0 ? 'negative' : undefined}>{formatInr(summary.remaining)}</dd>
        </div>
      </dl>

      <p className="notice">
        <strong>These are estimates, not quotes.</strong> Typical splits for Indian {eventType} budgets,
        calculated in code (never by AI) so they add up to the rupee. Replace any planned amount with your own
        figure or a real quote.
      </p>
      {extra10 > 0 && (
        <p className="hint">
          Guest-count impact: every 10 extra guests adds roughly {formatInr(extra10)} to food, invitations and
          other per-guest costs (marked “per guest” below).
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

      {tradeOffs.length > 0 && (
        <section className="card tradeoffs" aria-labelledby="tradeoffs-heading">
          <h4 id="tradeoffs-heading">Your options — you choose</h4>
          <ul>
            {tradeOffs.map((t) => (
              <li key={t.id}>
                <div>
                  <strong>{t.title}</strong>
                  <p className="hint">{t.detail}</p>
                </div>
                <button
                  type="button"
                  className="btn"
                  aria-label={`Apply: ${t.title}`}
                  onClick={() => props.onApplyTradeOff(t.action)}
                >
                  Apply
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="table-scroll">
        <table className="budget-table">
          <caption className="sr-only">Planned and actual spend by category</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Share</th>
              <th scope="col">Planned (₹)</th>
              <th scope="col">Spent (₹)</th>
            </tr>
          </thead>
          <tbody>
            {budget.lines.map((line) => {
              const value = spent[line.id] ?? 0;
              return (
                <tr key={line.id} className={value > line.amount ? 'over' : undefined}>
                  <th scope="row">
                    {line.label}
                    {line.priority && <span className="badge">Priority</span>}
                    {line.scalesWithGuests && <span className="badge subtle">per guest</span>}
                  </th>
                  <td>
                    <span className="bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, line.percent * 2)}%` }} />
                    </span>
                    {line.percent}%
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={`plan-${line.id}`}>
                      Planned amount for {line.label}
                    </label>
                    <input
                      id={`plan-${line.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1000}
                      className="spent-input"
                      value={line.amount}
                      aria-describedby={`plan-${line.id}-kind`}
                      onChange={(e) => props.onOverride(line.id, toAmount(e.target.value))}
                    />
                    <span id={`plan-${line.id}-kind`} className="tag">
                      {line.overridden ? 'Your amount' : 'Estimate'}
                    </span>
                    {line.overridden && (
                      <button
                        type="button"
                        className="link-btn"
                        aria-label={`Reset ${line.label} to the estimate`}
                        onClick={() => props.onOverride(line.id, null)}
                      >
                        Reset
                      </button>
                    )}
                  </td>
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
                      onChange={(e) => props.onSpentChange(line.id, toAmount(e.target.value))}
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
