import { useRef, useState, type FormEvent } from 'react';
import { todayIso } from '../lib/dates';
import { LIMITS, validateEventDetails, type FieldErrors } from '../lib/validation';
import {
  AGE_GROUPS,
  DIETS,
  EVENT_TYPES,
  PRIORITIES,
  VENUE_TYPES,
  type AgeGroup,
  type Diet,
  type EventDetails,
  type EventType,
  type Priority,
  type VenueType,
} from '../types';

const EVENT_LABELS: Record<EventType, { label: string; hint: string }> = {
  wedding: { label: 'Wedding', hint: 'Ceremonies, reception and family functions' },
  birthday: { label: 'Birthday', hint: 'Kids’ parties to milestone birthdays' },
  community: { label: 'Community event', hint: 'Society fests, fundraisers, cultural nights' },
};

const PRIORITY_LABELS: Record<Priority, string> = {
  food: 'Food',
  decor: 'Decor',
  photography: 'Photos & video',
  entertainment: 'Entertainment',
  venue: 'Venue',
};

const VENUE_LABELS: Record<VenueType, string> = {
  undecided: 'Not decided yet',
  banquet: 'Banquet hall / hotel',
  outdoor: 'Outdoor / lawn',
  home: 'At home',
  'community-hall': 'Community hall / society',
  temple: 'Temple / religious venue',
};

const AGE_LABELS: Record<AgeGroup, string> = {
  mixed: 'All ages',
  kids: 'Mostly kids',
  teens: 'Mostly teens',
  adults: 'Mostly adults',
  seniors: 'Mostly seniors',
};

const DIET_LABELS: Record<Diet, string> = {
  vegetarian: 'Vegetarian',
  'non-vegetarian': 'Non-vegetarian',
  jain: 'Jain',
  vegan: 'Vegan',
  'gluten-free': 'Gluten-free',
};

const FIELD_ORDER: (keyof EventDetails)[] = ['eventType', 'date', 'city', 'guests', 'budget'];

interface Props {
  initial?: EventDetails;
  onSubmit: (details: EventDetails) => void;
  onCancel?: () => void;
}

/** Collects event details with inline, accessible validation. */
export function PlannerForm({ initial, onSubmit, onCancel }: Props) {
  const today = todayIso();
  const [eventType, setEventType] = useState<EventType | ''>(initial?.eventType ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [guests, setGuests] = useState(initial ? String(initial.guests) : '');
  const [budget, setBudget] = useState(initial ? String(initial.budget) : '');
  const [preferences, setPreferences] = useState(initial?.preferences ?? '');
  const [priorities, setPriorities] = useState<Priority[]>(initial?.priorities ?? []);
  const [venueType, setVenueType] = useState<VenueType>(initial?.venueType ?? 'undecided');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(initial?.ageGroup ?? 'mixed');
  const [diets, setDiets] = useState<Diet[]>(initial?.diets ?? []);
  const [colors, setColors] = useState(initial?.colors ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const summaryRef = useRef<HTMLDivElement>(null);

  const togglePriority = (p: Priority) =>
    setPriorities((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].slice(-2)));

  const toggleDiet = (d: Diet) =>
    setDiets((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateEventDetails(
      {
        eventType,
        title,
        date,
        city,
        guests,
        budget,
        preferences,
        priorities,
        venueType,
        ageGroup,
        diets,
        colors,
      },
      today,
    );
    if (!result.ok) {
      setErrors(result.errors);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setErrors({});
    onSubmit(result.value);
  };

  const errorList = FIELD_ORDER.filter((f) => errors[f]);
  const describedBy = (field: keyof EventDetails, hint?: string) =>
    [hint, errors[field] ? `${field}-error` : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate aria-labelledby="form-title">
      <h2 id="form-title">Tell us about your celebration</h2>
      <p className="muted">Fields marked * are required. We never store your data on our servers.</p>

      {errorList.length > 0 && (
        <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
          <h3>Please fix {errorList.length === 1 ? 'this field' : `these ${errorList.length} fields`}:</h3>
          <ul>
            {errorList.map((f) => (
              <li key={f}>
                <a href={`#${f}`}>{errors[f]}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <fieldset className="event-types" aria-describedby={errors.eventType ? 'eventType-error' : undefined}>
        <legend>What are you planning? *</legend>
        {EVENT_TYPES.map((type, i) => (
          <label key={type} className={`choice ${eventType === type ? 'selected' : ''}`}>
            <input
              type="radio"
              name="eventType"
              id={i === 0 ? 'eventType' : undefined}
              value={type}
              checked={eventType === type}
              onChange={() => setEventType(type)}
            />
            <span className="choice-title">{EVENT_LABELS[type].label}</span>
            <span className="choice-hint">{EVENT_LABELS[type].hint}</span>
          </label>
        ))}
        {errors.eventType && (
          <p id="eventType-error" className="field-error">
            {errors.eventType}
          </p>
        )}
      </fieldset>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="title">Event name</label>
          <input
            id="title"
            value={title}
            maxLength={LIMITS.titleMax}
            placeholder="e.g. Aarav’s 5th birthday"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="date">Event date *</label>
          <input
            id="date"
            type="date"
            min={today}
            value={date}
            required
            aria-invalid={Boolean(errors.date)}
            aria-describedby={describedBy('date')}
            onChange={(e) => setDate(e.target.value)}
          />
          {errors.date && (
            <p id="date-error" className="field-error">
              {errors.date}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="city">City or town *</label>
          <input
            id="city"
            value={city}
            maxLength={LIMITS.cityMax}
            autoComplete="address-level2"
            required
            aria-invalid={Boolean(errors.city)}
            aria-describedby={describedBy('city')}
            onChange={(e) => setCity(e.target.value)}
          />
          {errors.city && (
            <p id="city-error" className="field-error">
              {errors.city}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="guests">Number of guests *</label>
          <input
            id="guests"
            type="number"
            inputMode="numeric"
            min={LIMITS.guestsMin}
            max={LIMITS.guestsMax}
            value={guests}
            required
            aria-invalid={Boolean(errors.guests)}
            aria-describedby={describedBy('guests')}
            onChange={(e) => setGuests(e.target.value)}
          />
          {errors.guests && (
            <p id="guests-error" className="field-error">
              {errors.guests}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="budget">Total budget (₹) *</label>
          <input
            id="budget"
            type="number"
            inputMode="numeric"
            min={LIMITS.budgetMin}
            step={1000}
            value={budget}
            required
            aria-invalid={Boolean(errors.budget)}
            aria-describedby={describedBy('budget', 'budget-hint')}
            onChange={(e) => setBudget(e.target.value)}
          />
          <p id="budget-hint" className="hint">
            Include everything — venue, food, decor and contingency.
          </p>
          {errors.budget && (
            <p id="budget-error" className="field-error">
              {errors.budget}
            </p>
          )}
        </div>
      </div>

      <fieldset className="priorities">
        <legend>What matters most? (pick up to 2)</legend>
        <div className="chips">
          {PRIORITIES.map((p) => (
            <label key={p} className={`chip ${priorities.includes(p) ? 'selected' : ''}`}>
              <input type="checkbox" checked={priorities.includes(p)} onChange={() => togglePriority(p)} />
              {PRIORITY_LABELS[p]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="venueType">Venue type</label>
          <select
            id="venueType"
            value={venueType}
            onChange={(e) => setVenueType(e.target.value as VenueType)}
          >
            {VENUE_TYPES.map((v) => (
              <option key={v} value={v}>
                {VENUE_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ageGroup">Who are the guests?</label>
          <select id="ageGroup" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}>
            {AGE_GROUPS.map((a) => (
              <option key={a} value={a}>
                {AGE_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="colors">Colour palette</label>
          <input
            id="colors"
            value={colors}
            maxLength={LIMITS.colorsMax}
            placeholder="e.g. marigold and maroon"
            onChange={(e) => setColors(e.target.value)}
          />
        </div>
      </div>

      <fieldset className="priorities">
        <legend>Dietary needs to cater for</legend>
        <div className="chips">
          {DIETS.map((d) => (
            <label key={d} className={`chip ${diets.includes(d) ? 'selected' : ''}`}>
              <input type="checkbox" checked={diets.includes(d)} onChange={() => toggleDiet(d)} />
              {DIET_LABELS[d]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="preferences">Style, traditions and special needs</label>
        <textarea
          id="preferences"
          rows={3}
          maxLength={LIMITS.preferencesMax}
          value={preferences}
          placeholder="e.g. South Indian traditions, eco-friendly, wheelchair access for grandparents"
          aria-describedby="preferences-count"
          onChange={(e) => setPreferences(e.target.value)}
        />
        <p id="preferences-count" className="hint">
          {preferences.length}/{LIMITS.preferencesMax} characters
        </p>
      </div>

      <div className="actions">
        <button type="submit" className="btn primary">
          {initial ? 'Update my plan' : 'Create my plan'}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
