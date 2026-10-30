import {
  Building2,
  Cake,
  Camera,
  ChevronDown,
  Flower2,
  Gift,
  type LucideIcon,
  MapPin,
  MessageCircleQuestion,
  Mic2,
  Music,
  Paintbrush,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  Tent,
  Trash2,
  Utensils,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { checklistProgress, mapsSearchUrl, summariseQuotes } from '../lib/checklist';
import { formatInr } from '../lib/plan';
import { VenuePanel } from './VenuePanel';
import {
  VENDOR_STATUSES,
  type BudgetPlan,
  type Logistics,
  type VendorEntry,
  type VendorGroup,
  type VendorStatus,
  type Venue,
  type VenueType,
} from '../types';

const STATUS_LABELS: Record<VendorStatus, string> = {
  shortlisted: 'Shortlisted',
  contacted: 'Contacted',
  quoted: 'Quote received',
  pending: 'Booking pending',
  confirmed: 'Booked',
};

const ICONS: Record<string, LucideIcon> = {
  venue: Building2,
  caterer: Utensils,
  decor: Flower2,
  decorator: Flower2,
  photographer: Camera,
  makeup: Paintbrush,
  music: Music,
  entertainment: Music,
  bakery: Cake,
  gifts: Gift,
  sound: Mic2,
  av: Mic2,
  rentals: Tent,
  safety: ShieldCheck,
  branding: Paintbrush,
};

type Stage = 'not-started' | 'in-progress' | 'shortlisting' | 'quoted' | 'chosen' | 'booked';

const STAGE_LABELS: Record<Stage, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  shortlisting: 'Shortlisting',
  quoted: 'Quotes in',
  chosen: 'Chosen',
  booked: 'Booked',
};

/** Where a vendor category stands, from the user's own records and ticks. */
export function vendorStage(entries: VendorEntry[], tasksDone: number): Stage {
  if (entries.some((e) => e.status === 'confirmed')) return 'booked';
  if (entries.some((e) => e.status === 'pending')) return 'chosen';
  if (entries.some((e) => e.quote > 0)) return 'quoted';
  if (entries.length > 0) return 'shortlisting';
  return tasksDone > 0 ? 'in-progress' : 'not-started';
}

interface Props {
  groups: VendorGroup[];
  city: string;
  venueName: string;
  venueType: VenueType;
  venuePreference: string;
  onChooseVenue: (venue: Venue) => void;
  chosenVenue: Venue | null;
  venueLinkError?: string;
  budget: BudgetPlan;
  done: Record<string, boolean>;
  onToggle: (id: string) => void;
  logistics: Logistics | null;
  logisticsLoading: boolean;
  entries: VendorEntry[];
  onAddVendor: (entry: Omit<VendorEntry, 'id'>) => void;
  onUpdateVendor: (id: string, patch: Partial<Omit<VendorEntry, 'id' | 'groupId'>>) => void;
  onRemoveVendor: (id: string) => void;
}

/** Vendors as a calm, scannable list: status at a glance, details and contacts one tap away. */
export function ChecklistPanel(props: Props) {
  const progress = checklistProgress(props.groups, props.done);
  const booked = props.groups.filter((g) =>
    props.entries.some((e) => e.groupId === g.id && e.status === 'confirmed'),
  ).length;
  const quoted = props.entries.filter((e) => e.status === 'confirmed').reduce((s, e) => s + e.quote, 0);

  return (
    <section aria-labelledby="checklist-heading" className="vendors">
      <div className="card vendors-summary">
        <div>
          <h3 id="checklist-heading">Vendors</h3>
          <p className="muted small">
            Your contacts, quotes and to-dos for every vendor — kept in this browser, never shared.
          </p>
        </div>
        <dl className="stat-row">
          <div>
            <dt>Booked</dt>
            <dd>
              {booked} of {props.groups.length}
            </dd>
          </div>
          <div>
            <dt>Booked spend</dt>
            <dd>{formatInr(quoted)}</dd>
          </div>
          <div>
            <dt>Checklist</dt>
            <dd>
              <label htmlFor="checklist-progress" className="sr-only">
                Checklist progress
              </label>
              <progress id="checklist-progress" max={100} value={progress}>
                {progress}%
              </progress>
              <span className="small">Checklist: {progress}% complete</span>
            </dd>
          </div>
        </dl>
      </div>

      <VenuePanel
        city={props.city}
        venueName={props.venueName}
        venueType={props.venueType}
        preference={props.venuePreference}
        onChoose={props.onChooseVenue}
        chosen={props.chosenVenue}
        resolveError={props.venueLinkError}
      />

      <ul className="vendor-list" aria-label="Vendor categories">
        {props.groups.map((group) => (
          <VendorRow key={group.id} group={group} {...props} />
        ))}
      </ul>
      <p className="hint">
        <span className="badge ai">✨ AI</span> items are suggestions from Google Gemini — check them with the
        vendor. UtsavAI never lists businesses or claims availability.
      </p>
    </section>
  );
}

function VendorRow({ group, ...props }: Props & { group: VendorGroup }) {
  const planned = props.budget.lines.find((l) => l.id === group.budgetId);
  // A line shared with an earlier vendor (e.g. the cake comes out of catering) isn't this vendor's alone.
  const sharedWith = props.groups.find((g) => g.budgetId === group.budgetId && g.id !== group.id);
  const shared = sharedWith && props.groups.indexOf(sharedWith) < props.groups.indexOf(group);
  const quotes = summariseQuotes(props.entries, group.id);
  const mine = props.entries.filter((e) => e.groupId === group.id);
  const questions = props.logistics?.vendors[group.id]?.questions ?? [];
  const fromAi = props.logistics?.source === 'gemini';
  const tasksDone = group.items.filter((i) => props.done[i.id]).length;
  const stage = vendorStage(mine, tasksDone);
  const Icon = ICONS[group.id] ?? Sparkles;
  const percent = group.items.length === 0 ? 0 : Math.round((tasksDone / group.items.length) * 100);

  return (
    <li>
      <details className="vendor-row card" aria-labelledby={`vendor-${group.id}`}>
        <summary>
          <span className="icon-badge" aria-hidden="true">
            <Icon size={18} />
          </span>
          <span className="vendor-row-title">
            <strong id={`vendor-${group.id}`}>{group.vendor}</strong>
            <span className="muted small">
              {!planned
                ? 'No budget line'
                : shared
                  ? `Part of the ${planned.label.toLowerCase()} budget`
                  : `Budget ~${formatInr(planned.amount)}`}
              {quotes.lowest > 0 && ` · best quote ${formatInr(quotes.lowest)}`}
              {mine.length > 0 && ` · ${mine.length} contact${mine.length > 1 ? 's' : ''}`}
            </span>
          </span>
          <span className="vendor-row-progress" aria-hidden="true">
            <span className="bar">
              <span style={{ width: `${percent}%` }} />
            </span>
            <span className="small">
              {tasksDone}/{group.items.length}
            </span>
          </span>
          <span className={`stage stage-${stage}`}>{STAGE_LABELS[stage]}</span>
          <ChevronDown className="chev" size={18} aria-hidden="true" />
        </summary>

        <div className="vendor-body">
          <div className="vendor-col">
            <h4 className="col-title">To do</h4>
            <fieldset>
              <legend className="sr-only">{group.vendor} checklist</legend>
              <ul className="plain">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={Boolean(props.done[item.id])}
                        onChange={() => props.onToggle(item.id)}
                      />
                      <span>
                        {item.task}
                        {item.ai && <span className="badge ai">✨ AI</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            {questions.length > 0 && (
              <div className="questions">
                <h4 className="col-title">
                  <MessageCircleQuestion size={16} aria-hidden="true" /> Questions to ask{' '}
                  {fromAi && <span className="badge ai">✨ AI</span>}
                </h4>
                <ul>
                  {questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
            {props.logisticsLoading && <p className="muted small">Gemini is preparing questions…</p>}
          </div>

          <div className="vendor-col">
            <h4 className="col-title">Your contacts</h4>
            {planned && quotes.lowest > 0 && (
              <p className={`small ${quotes.lowest > planned.amount ? 'negative' : 'positive'}`}>
                Best quote {formatInr(quotes.lowest)} is {quotes.lowest > planned.amount ? 'over' : 'within'}{' '}
                the {formatInr(planned.amount)} estimate.
              </p>
            )}
            {mine.length === 0 && (
              <p className="muted small">No contacts yet — add the vendors you talk to.</p>
            )}
            <ul className="plain contacts">
              {mine.map((entry) => (
                <ContactCard key={entry.id} entry={entry} {...props} />
              ))}
            </ul>
            <AddContactForm groupId={group.id} vendor={group.vendor} onAdd={props.onAddVendor} />
            <a
              className="maps-link small"
              href={mapsSearchUrl(group.searchTerm, props.city)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin size={14} aria-hidden="true" /> Find {group.vendor.toLowerCase()} near {props.city} on
              Google Maps
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      </details>
    </li>
  );
}

const telHref = (contact: string) => {
  const digits = contact.replace(/[^\d+]/g, '');
  return digits.length >= 8 ? `tel:${digits}` : undefined;
};

function ContactCard({ entry, ...props }: Props & { entry: VendorEntry }) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(entry.notes ?? '');
  const tel = telHref(entry.contact);
  return (
    <li className="contact">
      <div className="contact-head">
        <strong>{entry.name}</strong>
        {entry.quote > 0 && <span className="quote">{formatInr(entry.quote)}</span>}
      </div>
      {entry.contact && (
        <p className="small">
          <Phone size={13} aria-hidden="true" />{' '}
          {tel ? (
            <a href={tel} aria-label={`Call ${entry.name} on ${entry.contact}`}>
              {entry.contact}
            </a>
          ) : (
            entry.contact
          )}
        </p>
      )}
      {entry.address && (
        <p className="small">
          <MapPin size={13} aria-hidden="true" />{' '}
          <a
            href={
              entry.mapsUrl ??
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.address)}`
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            {entry.address}
            <span className="sr-only"> (map, opens in a new tab)</span>
          </a>
        </p>
      )}
      {entry.mapsUrl && !entry.address && (
        <p className="small">
          <MapPin size={13} aria-hidden="true" />{' '}
          <a href={entry.mapsUrl} target="_blank" rel="noopener noreferrer">
            Open in Google Maps<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      )}
      {editingNotes ? (
        <form
          className="notes-form"
          onSubmit={(e) => {
            e.preventDefault();
            props.onUpdateVendor(entry.id, { notes: notes.trim().slice(0, 400) });
            setEditingNotes(false);
          }}
        >
          <label htmlFor={`notes-${entry.id}`} className="sr-only">
            Notes about {entry.name}
          </label>
          <textarea
            id={`notes-${entry.id}`}
            rows={2}
            maxLength={400}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button type="submit" className="btn small primary">
            Save notes
          </button>
        </form>
      ) : (
        entry.notes && <p className="contact-notes small">{entry.notes}</p>
      )}
      <div className="contact-actions">
        <label className="sr-only" htmlFor={`status-${entry.id}`}>
          Status of {entry.name}
        </label>
        <select
          id={`status-${entry.id}`}
          value={entry.status}
          onChange={(e) => props.onUpdateVendor(entry.id, { status: e.target.value as VendorStatus })}
        >
          {VENDOR_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {!editingNotes && (
          <button
            type="button"
            className="link-btn"
            aria-label={`${entry.notes ? 'Edit' : 'Add'} notes for ${entry.name}`}
            onClick={() => setEditingNotes(true)}
          >
            {entry.notes ? 'Edit notes' : 'Add notes'}
          </button>
        )}
        <button
          type="button"
          className="link-btn danger"
          aria-label={`Remove ${entry.name}`}
          onClick={() => props.onRemoveVendor(entry.id)}
        >
          <Trash2 size={14} aria-hidden="true" /> Remove
        </button>
      </div>
    </li>
  );
}

function AddContactForm({
  groupId,
  vendor,
  onAdd,
}: {
  groupId: string;
  vendor: string;
  onAdd: (entry: Omit<VendorEntry, 'id'>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState({ name: '', contact: '', address: '', quote: '', notes: '' });
  const [error, setError] = useState('');
  const id = (field: string) => `add-${groupId}-${field}`;
  const set = (field: keyof typeof fields) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [field]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (fields.name.trim().length < 2) return setError('Enter the vendor’s name.');
    const quote = Math.max(0, Math.round(Number(fields.quote) || 0));
    onAdd({
      groupId,
      name: fields.name.trim().slice(0, 80),
      contact: fields.contact.trim().slice(0, 80),
      address: fields.address.trim().slice(0, 160),
      notes: fields.notes.trim().slice(0, 400),
      quote,
      status: quote > 0 ? 'quoted' : 'shortlisted',
    });
    setFields({ name: '', contact: '', address: '', quote: '', notes: '' });
    setError('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" className="btn small" onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden="true" /> Add {vendor.toLowerCase()}
      </button>
    );
  }
  return (
    <form className="add-vendor" onSubmit={submit} noValidate aria-label={`Add ${vendor}`}>
      <div className="field">
        <label htmlFor={id('name')}>Name</label>
        <input id={id('name')} value={fields.name} maxLength={80} onChange={set('name')} />
      </div>
      <div className="field">
        <label htmlFor={id('contact')}>Phone or email</label>
        <input
          id={id('contact')}
          value={fields.contact}
          maxLength={80}
          inputMode="tel"
          autoComplete="off"
          onChange={set('contact')}
        />
      </div>
      <div className="field span-2">
        <label htmlFor={id('address')}>Address</label>
        <input id={id('address')} value={fields.address} maxLength={160} onChange={set('address')} />
      </div>
      <div className="field">
        <label htmlFor={id('quote')}>Quote (₹, optional)</label>
        <input
          id={id('quote')}
          type="number"
          inputMode="numeric"
          min={0}
          value={fields.quote}
          onChange={set('quote')}
        />
      </div>
      <div className="field span-2">
        <label htmlFor={id('notes')}>Notes</label>
        <textarea
          id={id('notes')}
          rows={2}
          maxLength={400}
          value={fields.notes}
          placeholder="e.g. includes 2 tastings, advance 30%, ask about late-night charges"
          onChange={set('notes')}
        />
      </div>
      {error && (
        <p className="field-error span-2" role="alert">
          {error}
        </p>
      )}
      <div className="actions span-2">
        <button type="submit" className="btn small primary">
          Save vendor
        </button>
        <button type="button" className="btn small" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
