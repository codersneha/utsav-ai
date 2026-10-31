import { Bot, UserPlus, UserX } from 'lucide-react';
import { useState } from 'react';
import { formatInr } from '../lib/plan';
import { GUEST_RULES, fewerGuests, moreGuests, type Outcome } from '../lib/whatif';
import type { EventPlan } from '../types';
import { NumberField } from './NumberField';

interface Props {
  plan: EventPlan;
  /** True when the meal is seated and served (e.g. Bengali, Tamil), not a buffet. */
  served: boolean;
  /** Guests the guest list expects to actually turn up, when a list has been kept. */
  expectedFromList?: number;
  onPlanFor: (guests: number) => void;
  onAsk: (question: string) => void;
}

type Mode = 'fewer' | 'more';

const Steps = ({ steps }: { steps: string[] }) => (
  <ol className="steps">
    {steps.map((s) => (
      <li key={s}>{s}</li>
    ))}
  </ol>
);

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'bad' | 'good' }) {
  return (
    <div className={tone ? `tile ${tone}` : 'tile'}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

const signed = (n: number) => `${n < 0 ? '−' : '+'}${formatInr(Math.abs(n))}`;

/** The two ways of handling no-shows, side by side: tell the caterer in time, or not. */
function OutcomeTable({ told, notTold, hasNet }: { told: Outcome; notTold: Outcome; hasNet: boolean }) {
  const rows: [string, (o: Outcome) => string][] = [
    ['Plates you pay for', (o) => String(o.paidPlates)],
    ['Plates cooked, not eaten', (o) => String(o.wastedPlates)],
    ['Food left over', (o) => `${o.wastedKg} kg`],
    ['Money lost on food', (o) => formatInr(o.foodLoss)],
    ['Food money you keep', (o) => formatInr(o.foodKept)],
    ['Budget left over (with contingency)', (o) => formatInr(o.leftOver)],
    ...(hasNet ? ([['Net result', (o) => signed(o.net ?? 0)]] as [string, (o: Outcome) => string][]) : []),
  ];
  return (
    <div className="table-wrap">
      <table className="order-table shift-table">
        <caption className="sr-only">Cost of the no-shows if the caterer is told in time or not</caption>
        <thead>
          <tr>
            <th scope="col">What happens</th>
            <th scope="col">You tell the caterer in time</th>
            <th scope="col">You don’t</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, fn]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{fn(told)}</td>
              <td>{fn(notTold)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * "What if 30 don't come?" / "What if 50 more come?" — the user enters a number and gets the
 * plates, food, people and money that change, what is lost or left over, and how to handle it.
 */
export function GuestShift({ plan, served, expectedFromList, onPlanFor, onAsk }: Props) {
  const { details } = plan;
  const [mode, setMode] = useState<Mode>('fewer');
  const [count, setCount] = useState(Math.max(5, Math.round(details.guests * 0.2)));
  const [fieldKey, setFieldKey] = useState(0);
  const [guarantee, setGuarantee] = useState<number>(GUEST_RULES.guaranteePct);
  const [revenue, setRevenue] = useState(0);
  const opts = { revenuePerGuest: revenue };
  const limit = mode === 'fewer' ? Math.max(1, details.guests - 1) : 5000;
  const n = Math.min(count, limit);
  const fewer = fewerGuests(plan, n, guarantee, opts);
  const more = moreGuests(plan, n, served, opts);

  const set = (value: number) => {
    setCount(Math.max(1, Math.min(value, limit)));
    setFieldKey((k) => k + 1);
  };
  const pct = (p: number) => Math.max(1, Math.round((details.guests * p) / 100));
  const fromList =
    expectedFromList !== undefined && details.guests - expectedFromList > 0
      ? details.guests - expectedFromList
      : undefined;

  const question =
    mode === 'fewer'
      ? `What if ${fewer.missing} of my ${details.guests} guests don’t come? How do I avoid wasting food and money?`
      : `What if ${more.extra} more guests than the ${details.guests} I planned turn up? How do I handle the food, staff and extra cost?`;
  const total = mode === 'fewer' ? fewer.attending : more.newTotal;

  return (
    <section className="card guest-shift" aria-labelledby="shift-heading">
      <h4 id="shift-heading" className="card-title">
        <span className="icon-badge" aria-hidden="true">
          {mode === 'fewer' ? <UserX size={18} /> : <UserPlus size={18} />}
        </span>
        If your guest count changes
      </h4>
      <p className="muted small">
        You planned for {details.guests} guests at {formatInr(Math.round(plan.budget.total))}. Enter a number
        to see the food, people and money that change — and what to do about it.
      </p>

      <div className="segmented" role="group" aria-label="What changes">
        <button
          type="button"
          className={`segment${mode === 'fewer' ? ' active' : ''}`}
          aria-pressed={mode === 'fewer'}
          onClick={() => setMode('fewer')}
        >
          <UserX size={16} aria-hidden="true" /> Fewer come
        </button>
        <button
          type="button"
          className={`segment${mode === 'more' ? ' active' : ''}`}
          aria-pressed={mode === 'more'}
          onClick={() => setMode('more')}
        >
          <UserPlus size={16} aria-hidden="true" /> More come
        </button>
      </div>

      <div className="shift-inputs">
        <NumberField
          key={`${mode}-${fieldKey}`}
          id="shift-count"
          label={mode === 'fewer' ? 'Guests who don’t come' : 'Extra guests who come'}
          value={n}
          max={limit}
          onChange={setCount}
        />
        <div className="chips" role="group" aria-label="Quick amounts">
          {[10, 25, 50].map((p) => (
            <button key={p} type="button" className="chip" onClick={() => set(pct(p))}>
              {mode === 'fewer' ? '−' : '+'}
              {p}% ({pct(p)})
            </button>
          ))}
          {mode === 'fewer' && fromList !== undefined && (
            <button type="button" className="chip" onClick={() => set(fromList)}>
              From my guest list ({fromList})
            </button>
          )}
        </div>
      </div>

      <details className="shift-more">
        <summary>Caterer’s terms and money coming in (optional)</summary>
        <div className="shift-inputs">
          {mode === 'fewer' && (
            <NumberField
              id="shift-guarantee"
              label="Caterer’s guaranteed headcount (%)"
              value={guarantee}
              min={50}
              max={100}
              hint="The share of the headcount you pay for even if fewer come."
              onChange={setGuarantee}
            />
          )}
          <NumberField
            id="shift-revenue"
            label="Money in per guest (₹)"
            value={revenue}
            min={0}
            max={100000}
            hint="Entry fee, contribution or sponsor share — leave 0 for a family event."
            onChange={setRevenue}
          />
        </div>
      </details>

      <div aria-live="polite" className="shift-result">
        {mode === 'fewer' ? (
          <>
            <div
              className="plate-bar"
              role="img"
              aria-label={`${fewer.attending} plates eaten and ${fewer.ifNotTold.wastedPlates} plates cooked but not eaten if the caterer is not told`}
            >
              <span className="eaten" style={{ flexGrow: fewer.attending }} />
              <span className="wasted" style={{ flexGrow: fewer.ifNotTold.wastedPlates }} />
            </div>
            <p className="hint">
              {fewer.attending} eat · {fewer.ifNotTold.wastedPlates} plates wasted if nobody tells the caterer
            </p>
            <dl className="stats shift-tiles">
              <Tile label="Lost if you don’t tell" value={formatInr(fewer.ifNotTold.foodLoss)} tone="bad" />
              <Tile label="Lost if you tell in time" value={formatInr(fewer.ifTold.foodLoss)} />
              <Tile label="You keep by telling" value={formatInr(fewer.savedByTelling)} tone="good" />
              <Tile label="Food left over" value={`${fewer.ifNotTold.wastedKg} kg`} />
            </dl>
            <OutcomeTable
              told={fewer.ifTold}
              notTold={fewer.ifNotTold}
              hasNet={fewer.ifTold.net !== undefined}
            />
            <h5 className="col-title">How to handle it</h5>
            <Steps steps={fewer.steps} />
          </>
        ) : (
          <>
            <dl className="stats shift-tiles">
              <Tile
                label="Extra plates to order"
                value={`${more.platesToOrder} (${more.extra} + ${more.bufferPlates})`}
              />
              <Tile label="Extra food" value={`~${more.foodKg} kg`} />
              <Tile
                label="Extra cost"
                value={formatInr(more.cost)}
                tone={more.shortfall > 0 ? 'bad' : 'good'}
              />
              <Tile
                label={more.shortfall > 0 ? 'Short after contingency' : 'Contingency covers it'}
                value={more.shortfall > 0 ? formatInr(more.shortfall) : formatInr(more.contingency)}
                tone={more.shortfall > 0 ? 'bad' : 'good'}
              />
            </dl>
            <div className="table-wrap">
              <table className="order-table shift-table">
                <caption className="sr-only">What changes for {more.extra} more guests</caption>
                <thead>
                  <tr>
                    <th scope="col">What you need</th>
                    <th scope="col">Extra</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Food ({more.platesToOrder} plates)</th>
                    <td>{formatInr(more.foodCost)}</td>
                  </tr>
                  {more.otherCosts.map((o) => (
                    <tr key={o.label}>
                      <th scope="row">{o.label}</th>
                      <td>{formatInr(o.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Servers</th>
                    <td>{more.people.servers}</td>
                  </tr>
                  <tr>
                    <th scope="row">Kitchen helpers</th>
                    <td>{more.people.helpers}</td>
                  </tr>
                  <tr>
                    <th scope="row">Chairs · tables</th>
                    <td>
                      {more.people.chairs} · {more.people.tables}
                    </td>
                  </tr>
                  {more.net !== undefined && (
                    <tr>
                      <th scope="row">Net result</th>
                      <td>{signed(more.net)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {more.shortfall > 0 && more.trims.length > 0 && (
              <p className="impact">
                To cover {formatInr(more.shortfall)}:{' '}
                {more.trims.map((t) => `${t.label} −${formatInr(t.amount)}`).join(' · ')}
                {more.remaining > 0 ? ` · still ${formatInr(more.remaining)} short` : ''}
              </p>
            )}
            <h5 className="col-title">How to handle it</h5>
            <Steps steps={more.steps} />
          </>
        )}
      </div>

      <div className="actions">
        <button type="button" className="btn small primary" onClick={() => onPlanFor(total)}>
          Plan for {total} guests
        </button>
        <button type="button" className="btn small" onClick={() => onAsk(question)}>
          <Bot size={16} aria-hidden="true" /> Ask the planner how to handle this
        </button>
      </div>
      <p className="hint">
        Rules of thumb: {GUEST_RULES.foodKgPerGuest} kg of food a guest, a server for every{' '}
        {served ? GUEST_RULES.guestsPerServerSeated : GUEST_RULES.guestsPerServerBuffet} guests (
        {served ? 'seated' : 'buffet'}), a kitchen helper for every {GUEST_RULES.guestsPerKitchenHelper}, a
        table for every {GUEST_RULES.guestsPerTable}. Your caterer’s numbers are what count.
      </p>
    </section>
  );
}
