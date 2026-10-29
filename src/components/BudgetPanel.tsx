import { useMemo } from 'react';
import { summariseSpend } from '../lib/budget';
import { formatInr } from '../lib/plan';
import type { BudgetPlan } from '../types';

interface Props {
  budget: BudgetPlan;
  spent: Record<string, number>;
  onSpentChange: (id: string, amount: number) => void;
}

/** Planned split per category plus an expense tracker. */
export function BudgetPanel({ budget, spent, onSpentChange }: Props) {
  const summary = useMemo(() => summariseSpend(budget, spent), [budget, spent]);

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
          <dt>Spent so far</dt>
          <dd>{formatInr(summary.spent)}</dd>
        </div>
        <div>
          <dt>Remaining</dt>
          <dd className={summary.remaining < 0 ? 'negative' : undefined}>{formatInr(summary.remaining)}</dd>
        </div>
      </dl>

      {budget.warnings.map((w) => (
        <p key={w} className="notice warning">
          {w}
        </p>
      ))}
      <div aria-live="polite">
        {summary.overBudget.length > 0 && (
          <p className="notice warning">Over budget in: {summary.overBudget.join(', ')}.</p>
        )}
      </div>

      <div className="table-scroll">
        <table className="budget-table">
          <caption className="sr-only">Planned and actual spend by category</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Share</th>
              <th scope="col">Planned</th>
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
                  </th>
                  <td>
                    <span className="bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, line.percent * 2)}%` }} />
                    </span>
                    {line.percent}%
                  </td>
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
                      onChange={(e) => onSpentChange(line.id, Math.max(0, Number(e.target.value) || 0))}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">
        Amounts are calculated in code (not by AI) so they always add up to your exact budget. Your priorities
        get a 5% boost, funded proportionally from other categories; contingency is never reduced.
      </p>
    </section>
  );
}
