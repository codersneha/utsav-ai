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
} from '../types';

const STATUS_LABELS: Record<VendorStatus, string> = {
  shortlisted: 'Shortlisted',
  contacted: 'Contacted',
  quoted: 'Quote received',
  pending: 'Booking pending',
  confirmed: 'Booking confirmed',
};

interface Props {
  groups: VendorGroup[];
  city: string;
  venueName: string;
  onChooseVenue: (name: string) => void;
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

/** Vendor checklists, AI questions to ask, and the user's own vendor and quote records. */
export function ChecklistPanel(props: Props) {
  const progress = checklistProgress(props.groups, props.done);
  return (
    <section aria-labelledby="checklist-heading">
      <h3 id="checklist-heading">Vendors</h3>
      <div className="progress-row">
        <label htmlFor="checklist-progress">Checklist: {progress}% complete</label>
        <progress id="checklist-progress" max={100} value={progress}>
          {progress}%
        </progress>
      </div>
      <p className="hint">
        <span className="badge ai">✨ AI</span> items are suggestions from Google Gemini — verify them with
        the vendor. Vendor names, contacts and quotes are only what you enter; UtsavAI never lists businesses
        or claims availability.
      </p>
      <VenuePanel city={props.city} venueName={props.venueName} onChoose={props.onChooseVenue} />
      <div className="vendor-grid">
        {props.groups.map((group) => (
          <VendorCard key={group.id} group={group} {...props} />
        ))}
      </div>
    </section>
  );
}

function VendorCard({ group, ...props }: Props & { group: VendorGroup }) {
  const planned = props.budget.lines.find((l) => l.id === group.budgetId);
  const quotes = summariseQuotes(props.entries, group.id);
  const mine = props.entries.filter((e) => e.groupId === group.id);
  const questions = props.logistics?.vendors[group.id]?.questions ?? [];
  const fromAi = props.logistics?.source === 'gemini';
  const headingId = `vendor-${group.id}`;

  return (
    <article className="vendor card" aria-labelledby={headingId}>
      <h4 id={headingId}>{group.vendor}</h4>
      {planned && (
        <p className="hint">
          Budget estimate: {formatInr(planned.amount)}
          {quotes.lowest > 0 && (
            <>
              {' '}
              · lowest quote {formatInr(quotes.lowest)}
              {quotes.lowest > planned.amount ? (
                <strong className="negative"> (over estimate)</strong>
              ) : (
                ' (within estimate)'
              )}
            </>
          )}
        </p>
      )}

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
        <details className="questions">
          <summary>Questions to ask {fromAi && <span className="badge ai">✨ AI</span>}</summary>
          <ul>
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </details>
      )}
      {props.logisticsLoading && <p className="muted">Gemini is preparing questions for this vendor…</p>}

      <h5>Your vendors</h5>
      {mine.length === 0 && <p className="muted">None added yet.</p>}
      <ul className="plain entries">
        {mine.map((entry) => (
          <li key={entry.id} className="entry">
            <div>
              <strong>{entry.name}</strong>
              {entry.contact && <span className="muted"> · {entry.contact}</span>}
              {entry.quote > 0 && <span> · {formatInr(entry.quote)}</span>}
            </div>
            <div className="entry-actions">
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
              <button
                type="button"
                className="link-btn"
                aria-label={`Remove ${entry.name}`}
                onClick={() => props.onRemoveVendor(entry.id)}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <AddVendorForm groupId={group.id} vendor={group.vendor} onAdd={props.onAddVendor} />

      <a
        className="maps-link"
        href={mapsSearchUrl(group.searchTerm, props.city)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Find {group.vendor.toLowerCase()} near {props.city} on Google Maps
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </article>
  );
}

function AddVendorForm({
  groupId,
  vendor,
  onAdd,
}: {
  groupId: string;
  vendor: string;
  onAdd: (entry: Omit<VendorEntry, 'id'>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [quote, setQuote] = useState('');
  const [error, setError] = useState('');
  const id = (field: string) => `add-${groupId}-${field}`;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Enter the vendor’s name.');
    onAdd({
      groupId,
      name: name.trim().slice(0, 80),
      contact: contact.trim().slice(0, 80),
      quote: Math.max(0, Math.round(Number(quote) || 0)),
      status: Number(quote) > 0 ? 'quoted' : 'shortlisted',
    });
    setName('');
    setContact('');
    setQuote('');
    setError('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" className="btn small" onClick={() => setOpen(true)}>
        + Add {vendor.toLowerCase()}
      </button>
    );
  }
  return (
    <form className="add-vendor" onSubmit={submit} noValidate aria-label={`Add ${vendor}`}>
      <label htmlFor={id('name')}>Name</label>
      <input id={id('name')} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      <label htmlFor={id('contact')}>Phone or email</label>
      <input id={id('contact')} value={contact} maxLength={80} onChange={(e) => setContact(e.target.value)} />
      <label htmlFor={id('quote')}>Quote (₹, optional)</label>
      <input
        id={id('quote')}
        type="number"
        inputMode="numeric"
        min={0}
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
      />
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
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
