import { Bot, UserPlus, UserX } from 'lucide-react';
import { useState } from 'react';
import { formatInr } from '../lib/plan';
import {
  GUEST_RULES,
  fewerGuests,
  moreGuests,
  type FewerGuests,
  type MoreGuests,
  type Outcome,
} from '../lib/whatif';
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
type Row = [label: string, value: string | number];

const QUICK_PERCENTS = [10, 25, 50];
const MAX_EXTRA_GUESTS = 5000;

const signed = (n: number) => `${n < 0 ? '−' : '+'}${formatInr(Math.abs(n))}`;

const Steps = ({ steps }: { steps: string[] }) => (
  <>
    <h5 className="col-title">How to handle it</h5>
    <ol className="steps">
      {steps.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ol>
  </>
);

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'bad' | 'good' }) {
  return (
    <div className={tone ? `tile ${tone}` : 'tile'}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** A two-column table: what is needed or what happens, and its value. */
function ShiftTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="table-wrap">
      <table className="order-table shift-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, ...cells]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {cells.map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The two ways of handling no-shows, side by side: tell the caterer in time, or not. */
function OutcomeTable({ told, notTold }: { told: Outcome; notTold: Outcome }) {
  const lines: [string, (o: Outcome) => string][] = [
    ['Plates you pay for', (o) => String(o.paidPlates)],
    ['Plates cooked, not eaten', (o) => String(o.wastedPlates)],
    ['Food left over', (o) => `${o.wastedKg} kg`],
    ['Money lost on food', (o) => formatInr(o.foodLoss)],
    ['Food money you keep', (o) => formatInr(o.foodKept)],
    ['Budget left over (with contingency)', (o) => formatInr(o.leftOver)],
  ];
  if (told.net !== undefined) lines.push(['Net result', (o) => signed(o.net ?? 0)]);
  return (
    <ShiftTable
      caption="Cost of the no-shows if the caterer is told in time or not"
      head={['What happens', 'You tell the caterer in time', 'You don’t']}
      rows={lines.map(([label, fn]) => [label, fn(told), fn(notTold)])}
    />
  );
}

function FewerResult({ fewer }: { fewer: FewerGuests }) {
  const { attending, ifTold, ifNotTold } = fewer;
  return (
    <>
      <div
        className="plate-bar"
        role="img"
        aria-label={`${attending} plates eaten and ${ifNotTold.wastedPlates} plates cooked but not eaten if the caterer is not told`}
      >
        <span className="eaten" style={{ flexGrow: attending }} />
        <span className="wasted" style={{ flexGrow: ifNotTold.wastedPlates }} />
      </div>
      <p className="hint">
        {attending} eat · {ifNotTold.wastedPlates} plates wasted if nobody tells the caterer
      </p>
      <dl className="stats shift-tiles">
        <Tile label="Lost if you don’t tell" value={formatInr(ifNotTold.foodLoss)} tone="bad" />
        <Tile label="Lost if you tell in time" value={formatInr(ifTold.foodLoss)} />
        <Tile label="You keep by telling" value={formatInr(fewer.savedByTelling)} tone="good" />
        <Tile label="Food left over" value={`${ifNotTold.wastedKg} kg`} />
      </dl>
      <OutcomeTable told={ifTold} notTold={ifNotTold} />
      <Steps steps={fewer.steps} />
    </>
  );
}

function MoreResult({ more }: { more: MoreGuests }) {
  const short = more.shortfall > 0;
  const rows: Row[] = [
    [`Food (${more.platesToOrder} plates)`, formatInr(more.foodCost)],
    ...more.otherCosts.map((o): Row => [o.label, formatInr(o.amount)]),
    ['Servers', more.people.servers],
    ['Kitchen helpers', more.people.helpers],
    ['Chairs · tables', `${more.people.chairs} · ${more.people.tables}`],
  ];
  if (more.net !== undefined) rows.push(['Net result', signed(more.net)]);

  return (
    <>
      <dl className="stats shift-tiles">
        <Tile
          label="Extra plates to order"
          value={`${more.platesToOrder} (${more.extra} + ${more.bufferPlates})`}
        />
        <Tile label="Extra food" value={`~${more.foodKg} kg`} />
        <Tile label="Extra cost" value={formatInr(more.cost)} tone={short ? 'bad' : 'good'} />
        <Tile
          label={short ? 'Short after contingency' : 'Contingency covers it'}
          value={formatInr(short ? more.shortfall : more.contingency)}
          tone={short ? 'bad' : 'good'}
        />
      </dl>
      <ShiftTable
        caption={`What changes for ${more.extra} more guests`}
        head={['What you need', 'Extra']}
        rows={rows}
      />
      {short && more.trims.length > 0 && (
        <p className="impact">
          To cover {formatInr(more.shortfall)}:{' '}
          {more.trims.map((t) => `${t.label} −${formatInr(t.amount)}`).join(' · ')}
          {more.remaining > 0 ? ` · still ${formatInr(more.remaining)} short` : ''}
        </p>
      )}
      <Steps steps={more.steps} />
    </>
  );
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const options: [Mode, string, typeof UserX][] = [
    ['fewer', 'Fewer come', UserX],
    ['more', 'More come', UserPlus],
  ];
  return (
    <div className="segmented" role="group" aria-label="What changes">
      {options.map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          className={`segment${mode === value ? ' active' : ''}`}
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
        >
          <Icon size={16} aria-hidden="true" /> {label}
        </button>
      ))}
    </div>
  );
}

/** Optional numbers most families can leave alone: the caterer's guarantee and money coming in. */
function ShiftOptions({
  mode,
  guarantee,
  revenue,
  onGuarantee,
  onRevenue,
}: {
  mode: Mode;
  guarantee: number;
  revenue: number;
  onGuarantee: (n: number) => void;
  onRevenue: (n: number) => void;
}) {
  return (
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
            onChange={onGuarantee}
          />
        )}
        <NumberField
          id="shift-revenue"
          label="Money in per guest (₹)"
          value={revenue}
          min={0}
          max={100000}
          hint="Entry fee, contribution or sponsor share — leave 0 for a family event."
          onChange={onRevenue}
        />
      </div>
    </details>
  );
}

function RulesHint({ served }: { served: boolean }) {
  return (
    <p className="hint">
      Rules of thumb: {GUEST_RULES.foodKgPerGuest} kg of food a guest, a server for every{' '}
      {served ? GUEST_RULES.guestsPerServerSeated : GUEST_RULES.guestsPerServerBuffet} guests (
      {served ? 'seated' : 'buffet'}), a kitchen helper for every {GUEST_RULES.guestsPerKitchenHelper}, a
      table for every {GUEST_RULES.guestsPerTable}. Your caterer’s numbers are what count.
    </p>
  );
}

/** No-shows the guest list predicts (planned minus expected), when a list is kept. */
function shortfallFromList(planned: number, expected?: number): number | undefined {
  return expected !== undefined && planned - expected > 0 ? planned - expected : undefined;
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

  const fewerMode = mode === 'fewer';
  const limit = fewerMode ? Math.max(1, details.guests - 1) : MAX_EXTRA_GUESTS;
  const n = Math.min(count, limit);
  const opts = { revenuePerGuest: revenue };
  const fewer = fewerGuests(plan, n, guarantee, opts);
  const more = moreGuests(plan, n, served, opts);
  const fromList = shortfallFromList(details.guests, expectedFromList);
  const total = fewerMode ? fewer.attending : more.newTotal;
  const question = fewerMode
    ? `What if ${fewer.missing} of my ${details.guests} guests don’t come? How do I avoid wasting food and money?`
    : `What if ${more.extra} more guests than the ${details.guests} I planned turn up? How do I handle the food, staff and extra cost?`;

  /** A preset replaces the typed number, so the field is re-mounted with the new value. */
  const choose = (value: number) => {
    setCount(Math.max(1, Math.min(value, limit)));
    setFieldKey((k) => k + 1);
  };
  const pct = (p: number) => Math.max(1, Math.round((details.guests * p) / 100));

  return (
    <section className="card guest-shift" aria-labelledby="shift-heading">
      <h4 id="shift-heading" className="card-title">
        <span className="icon-badge" aria-hidden="true">
          {fewerMode ? <UserX size={18} /> : <UserPlus size={18} />}
        </span>
        If your guest count changes
      </h4>
      <p className="muted small">
        You planned for {details.guests} guests at {formatInr(Math.round(plan.budget.total))}. Enter a number
        to see the food, people and money that change — and what to do about it.
      </p>

      <ModeSwitch mode={mode} onChange={setMode} />

      <div className="shift-inputs">
        <NumberField
          key={`${mode}-${fieldKey}`}
          id="shift-count"
          label={fewerMode ? 'Guests who don’t come' : 'Extra guests who come'}
          value={n}
          max={limit}
          onChange={setCount}
        />
        <div className="chips" role="group" aria-label="Quick amounts">
          {QUICK_PERCENTS.map((p) => (
            <button key={p} type="button" className="chip" onClick={() => choose(pct(p))}>
              {fewerMode ? '−' : '+'}
              {p}% ({pct(p)})
            </button>
          ))}
          {fewerMode && fromList !== undefined && (
            <button type="button" className="chip" onClick={() => choose(fromList)}>
              From my guest list ({fromList})
            </button>
          )}
        </div>
      </div>

      <ShiftOptions
        mode={mode}
        guarantee={guarantee}
        revenue={revenue}
        onGuarantee={setGuarantee}
        onRevenue={setRevenue}
      />

      <div aria-live="polite" className="shift-result">
        {fewerMode ? <FewerResult fewer={fewer} /> : <MoreResult more={more} />}
      </div>

      <div className="actions">
        <button type="button" className="btn small primary" onClick={() => onPlanFor(total)}>
          Plan for {total} guests
        </button>
        <button type="button" className="btn small" onClick={() => onAsk(question)}>
          <Bot size={16} aria-hidden="true" /> Ask the planner how to handle this
        </button>
      </div>
      <RulesHint served={served} />
    </section>
  );
}
