import { Download, Plus, Star, Trash2, UsersRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { filterGuests, guestsCsv, guestTotals, heads, type GuestFilter } from '../lib/guests';
import {
  GUEST_SIDES,
  RSVP_STATUSES,
  type EventType,
  type GuestEntry,
  type GuestSide,
  type RsvpStatus,
} from '../types';

const SIDE_LABELS: Record<GuestSide, string> = {
  bride: 'Bride’s side',
  groom: 'Groom’s side',
  family: 'Family',
  friends: 'Friends',
  work: 'Work',
  neighbours: 'Neighbours',
  other: 'Other',
};

const RSVP_LABELS: Record<RsvpStatus, string> = {
  'not-asked': 'Not asked yet',
  maybe: 'Maybe',
  likely: 'Likely',
  confirmed: 'Confirmed',
  declined: 'Can’t come',
};

const FILTERS: { id: GuestFilter; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'vip', label: 'Important' },
  { id: 'not-sent', label: 'Invite not sent' },
  { id: 'awaiting', label: 'Awaiting reply' },
  { id: 'confirmed', label: 'Confirmed' },
];

const sidesFor = (eventType: EventType): GuestSide[] =>
  eventType === 'wedding'
    ? ['bride', 'groom', 'friends', 'work', 'neighbours', 'other']
    : GUEST_SIDES.filter((s) => s !== 'bride' && s !== 'groom');

interface Props {
  eventType: EventType;
  plannedGuests: number;
  entries: GuestEntry[];
  onAdd: (entry: Omit<GuestEntry, 'id'>) => void;
  onUpdate: (id: string, patch: Partial<Omit<GuestEntry, 'id'>>) => void;
  onRemove: (id: string) => void;
  onPlanFor: (count: number) => void;
}

function downloadCsv(entries: GuestEntry[]) {
  const blob = new Blob([guestsCsv(entries)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'guest-list.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/** An invitation ledger that counts itself: families, heads, replies and important guests. */
export function GuestsPanel(props: Props) {
  const [filter, setFilter] = useState<GuestFilter>('all');
  const [query, setQuery] = useState('');
  const totals = guestTotals(props.entries);
  const shown = filterGuests(props.entries, filter, query);
  const gap = totals.expected - props.plannedGuests;
  // Suggest re-planning only once the list looks mostly complete, or already exceeds the plan.
  const suggest =
    (totals.invited >= props.plannedGuests * 0.6 || gap > 0) &&
    Math.abs(gap) >= Math.max(5, props.plannedGuests * 0.05);

  return (
    <section aria-labelledby="guests-heading" className="guests">
      <div className="card">
        <div className="panel-head">
          <h3 id="guests-heading" className="card-title">
            <span className="icon-badge teal" aria-hidden="true">
              <UsersRound size={20} />
            </span>
            Guest list
          </h3>
          {props.entries.length > 0 && (
            <button type="button" className="btn small" onClick={() => downloadCsv(props.entries)}>
              <Download size={16} aria-hidden="true" /> Export CSV
            </button>
          )}
        </div>
        <p className="muted small">
          Add each family once with how many adults and children are coming. Everything is counted for you.
        </p>
        <dl className="guest-stats">
          <div>
            <dt>Invited</dt>
            <dd>{totals.invited}</dd>
            <dd className="small muted">
              {totals.families} families · {totals.adults} adults · {totals.children} children
            </dd>
          </div>
          <div>
            <dt>Expected</dt>
            <dd>{totals.expected}</dd>
            <dd className="small muted">weighted by replies</dd>
          </div>
          <div>
            <dt>Confirmed</dt>
            <dd>{totals.confirmed}</dd>
            <dd className="small muted">{totals.declined} can’t come</dd>
          </div>
          <div>
            <dt>To follow up</dt>
            <dd>{totals.notSent + totals.awaiting}</dd>
            <dd className="small muted">
              {totals.notSent} invites unsent · {totals.awaiting} awaiting reply
            </dd>
          </div>
          <div>
            <dt>Important</dt>
            <dd>{totals.vips}</dd>
            <dd className="small muted">marked with a star</dd>
          </div>
        </dl>
        {suggest && (
          <div className="notice guest-gap" role="status">
            <p>
              Your plan is for <strong>{props.plannedGuests}</strong> guests, but the list suggests about{' '}
              <strong>{totals.expected}</strong> will come.
            </p>
            <button
              type="button"
              className="btn small primary"
              onClick={() => props.onPlanFor(totals.expected)}
            >
              Plan for {totals.expected} guests
            </button>
          </div>
        )}
      </div>

      <AddGuestForm eventType={props.eventType} onAdd={props.onAdd} />

      {props.entries.length > 0 && (
        <div className="card">
          <div className="guest-tools">
            <div className="chips" role="group" aria-label="Show">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="chip"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="guest-search">
              Search guests
            </label>
            <input
              id="guest-search"
              type="search"
              placeholder="Search by name or relation"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="table-wrap">
            <table className="guest-table">
              <caption className="sr-only">Guest ledger ({shown.length} shown)</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Important</span>
                  </th>
                  <th scope="col">Family / guest</th>
                  <th scope="col">Side</th>
                  <th scope="col">Adults</th>
                  <th scope="col">Children</th>
                  <th scope="col">Invite sent</th>
                  <th scope="col">Reply</th>
                  <th scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((g) => (
                  <GuestRow key={g.id} guest={g} {...props} />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  <th scope="row">Total shown</th>
                  <td />
                  <td>{shown.reduce((s, g) => s + g.adults, 0)}</td>
                  <td>{shown.reduce((s, g) => s + g.children, 0)}</td>
                  <td>
                    {shown.filter((g) => g.invited).length}/{shown.length}
                  </td>
                  <td>{shown.reduce((s, g) => s + heads(g), 0)} people</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function GuestRow({ guest: g, ...props }: Props & { guest: GuestEntry }) {
  const count = (field: 'adults' | 'children') => (
    <input
      type="number"
      min={0}
      max={500}
      inputMode="numeric"
      className="count"
      aria-label={`${field === 'adults' ? 'Adults' : 'Children'} in ${g.name}`}
      value={g[field]}
      onChange={(e) =>
        props.onUpdate(g.id, { [field]: Math.min(500, Math.max(0, Math.round(Number(e.target.value) || 0))) })
      }
    />
  );
  return (
    <tr className={g.vip ? 'vip' : undefined}>
      <td>
        <button
          type="button"
          className={`star${g.vip ? ' on' : ''}`}
          aria-pressed={g.vip}
          aria-label={`Mark ${g.name} as important`}
          onClick={() => props.onUpdate(g.id, { vip: !g.vip })}
        >
          <Star size={18} aria-hidden="true" fill={g.vip ? 'currentColor' : 'none'} />
        </button>
      </td>
      <th scope="row">
        <span className="guest-name">{g.name}</span>
        {g.relation && <span className="muted small">{g.relation}</span>}
      </th>
      <td>{SIDE_LABELS[g.side]}</td>
      <td>{count('adults')}</td>
      <td>{count('children')}</td>
      <td>
        <input
          type="checkbox"
          aria-label={`Invitation sent to ${g.name}`}
          checked={g.invited}
          onChange={() => props.onUpdate(g.id, { invited: !g.invited })}
        />
      </td>
      <td>
        <select
          aria-label={`Reply from ${g.name}`}
          className={`rsvp rsvp-${g.rsvp}`}
          value={g.rsvp}
          onChange={(e) => props.onUpdate(g.id, { rsvp: e.target.value as RsvpStatus })}
        >
          {RSVP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {RSVP_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <button
          type="button"
          className="link-btn danger"
          aria-label={`Remove ${g.name}`}
          onClick={() => props.onRemove(g.id)}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}

function AddGuestForm({ eventType, onAdd }: { eventType: EventType; onAdd: Props['onAdd'] }) {
  const sides = sidesFor(eventType);
  const empty = { name: '', relation: '', side: sides[0], adults: '2', children: '0', vip: false };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError('Enter a family or guest name.');
    const adults = Math.min(500, Math.max(0, Math.round(Number(form.adults) || 0)));
    const children = Math.min(500, Math.max(0, Math.round(Number(form.children) || 0)));
    if (adults + children === 0) return setError('Add at least one adult or child.');
    onAdd({
      name: form.name.trim().slice(0, 80),
      relation: form.relation.trim().slice(0, 80),
      side: form.side,
      adults,
      children,
      vip: form.vip,
      invited: false,
      rsvp: 'not-asked',
    });
    setForm({ ...empty, side: form.side });
    setError('');
  };

  return (
    <form className="card add-guest" onSubmit={submit} noValidate aria-label="Add a family or guest">
      <h4 className="col-title">Add a family or guest</h4>
      <div className="add-guest-grid">
        <div className="field">
          <label htmlFor="guest-name">Family or guest name</label>
          <input
            id="guest-name"
            value={form.name}
            maxLength={80}
            placeholder="e.g. Sharma family"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? 'guest-error' : undefined}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="guest-relation">Relation</label>
          <input
            id="guest-relation"
            value={form.relation}
            maxLength={80}
            placeholder="e.g. Mama’s family"
            onChange={(e) => setForm({ ...form, relation: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="guest-side">Side</label>
          <select
            id="guest-side"
            value={form.side}
            onChange={(e) => setForm({ ...form, side: e.target.value as GuestSide })}
          >
            {sides.map((s) => (
              <option key={s} value={s}>
                {SIDE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field small-field">
          <label htmlFor="guest-adults">Adults</label>
          <input
            id="guest-adults"
            type="number"
            min={0}
            max={500}
            inputMode="numeric"
            value={form.adults}
            onChange={(e) => setForm({ ...form, adults: e.target.value })}
          />
        </div>
        <div className="field small-field">
          <label htmlFor="guest-children">Children</label>
          <input
            id="guest-children"
            type="number"
            min={0}
            max={500}
            inputMode="numeric"
            value={form.children}
            onChange={(e) => setForm({ ...form, children: e.target.value })}
          />
        </div>
        <label className="check vip-check">
          <input type="checkbox" checked={form.vip} onChange={() => setForm({ ...form, vip: !form.vip })} />
          <span>Important guest</span>
        </label>
        <button type="submit" className="btn primary">
          <Plus size={16} aria-hidden="true" /> Add to list
        </button>
      </div>
      {error && (
        <p id="guest-error" className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
