import { TRADITION_DATA } from '../../lib/culture';
import { daysBetween, formatDate } from '../../lib/dates';
import { parseInr } from '../../lib/money';
import { formatInr } from '../../lib/plan';
import { DIET_LABELS, EVENT_LABELS, type FormState } from './formState';

/** A summary card that fills in as the user types. */
export function LivePreview({ form, today }: { form: FormState; today: string }) {
  const budget = parseInr(form.budget);
  const guests = Number(form.guests);
  const daysAway = form.date && !Number.isNaN(Date.parse(form.date)) ? daysBetween(today, form.date) : null;

  const rows: [string, string][] = [
    ['Date', daysAway !== null && daysAway >= 0 ? `${formatDate(form.date)} · ${daysAway} days` : '—'],
    ['Guests', guests > 0 ? form.guests : '—'],
    ['Budget', budget ? formatInr(budget) : '—'],
    ['Per guest', guests > 0 && budget ? formatInr(budget / guests) : '—'],
    ['Tradition', TRADITION_DATA[form.tradition].label],
    ['Diet', form.diets.length > 0 ? form.diets.map((d) => DIET_LABELS[d]).join(', ') : '—'],
  ];

  return (
    <aside className="card live-preview" aria-label="Plan preview">
      <div className={`banner ${form.eventType}`}>
        <span className="eyebrow">
          {form.eventType ? EVENT_LABELS[form.eventType].label : 'Your celebration'}
        </span>
        <strong>{form.title || 'Untitled event'}</strong>
        <span>{form.city || 'City'}</span>
      </div>
      <dl>
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
