import { ArrowLeft, ArrowRight, Briefcase, Cake, Heart, PartyPopper, Sparkles } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { daysBetween, formatDate, todayIso } from '../lib/dates';
import { TRADITIONS, TRADITION_DATA, type TraditionId } from '../lib/culture';
import { formatInr } from '../lib/plan';
import { parseInr } from '../lib/money';
import { LIMITS, validateEventDetails, type FieldErrors } from '../lib/validation';
import {
  AGE_GROUPS,
  DIETS,
  EVENT_TYPES,
  LANGUAGES,
  PRIORITIES,
  VENUE_TYPES,
  type AgeGroup,
  type Diet,
  type EventDetails,
  type EventType,
  type Language,
  type Priority,
  type VenueType,
} from '../types';

const EVENT_LABELS: Record<EventType, { label: string; hint: string; icon: typeof Heart; tone: string }> = {
  wedding: { label: 'Wedding', hint: 'Ceremonies, reception and family functions', icon: Heart, tone: '' },
  birthday: { label: 'Birthday', hint: 'Kids’ parties to milestone birthdays', icon: Cake, tone: 'teal' },
  community: {
    label: 'Community event',
    hint: 'Society fests, fundraisers, cultural nights',
    icon: PartyPopper,
    tone: 'gold',
  },
  corporate: {
    label: 'Corporate event',
    hint: 'Offsites, annual days, launches, team dinners',
    icon: Briefcase,
    tone: 'teal',
  },
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
  restaurant: 'Restaurant',
  cafe: 'Café',
  hotel: 'Hotel / resort',
  office: 'Office / conference room',
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

const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  hi: 'हिंदी (Hindi)',
  hinglish: 'Hinglish',
};

const QUICK_BUDGETS = [50_000, 200_000, 500_000, 1_500_000, 2_500_000];

const STEPS: { title: string; fields: (keyof EventDetails)[] }[] = [
  { title: 'The occasion', fields: ['eventType', 'date', 'city'] },
  { title: 'Guests & budget', fields: ['guests', 'budget'] },
  { title: 'Make it yours', fields: [] },
];

interface Props {
  /** Values to start from: a saved plan (edit) or fields the AI extracted (create). */
  initial?: Partial<EventDetails>;
  isEdit?: boolean;
  /** Shown above the form, e.g. "AI filled 6 fields — please check them". */
  intro?: string;
  onSubmit: (details: EventDetails) => void;
  onCancel?: () => void;
}

const lakh = (n: number) => (n >= 100_000 ? `₹${n / 100_000}L` : `₹${n / 1000}k`);

/** A three-step, accessible wizard with a live preview of the plan being described. */
export function PlannerForm({ initial, isEdit = false, intro, onSubmit, onCancel }: Props) {
  const today = todayIso();
  const [step, setStep] = useState(0);
  const [eventType, setEventType] = useState<EventType | ''>(initial?.eventType ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [guests, setGuests] = useState(initial?.guests ? String(initial.guests) : '');
  const [budget, setBudget] = useState(initial?.budget ? String(initial.budget) : '');
  const [preferences, setPreferences] = useState(initial?.preferences ?? '');
  const [priorities, setPriorities] = useState<Priority[]>(initial?.priorities ?? []);
  const [venueType, setVenueType] = useState<VenueType>(initial?.venueType ?? 'undecided');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(initial?.ageGroup ?? 'mixed');
  const [diets, setDiets] = useState<Diet[]>(initial?.diets ?? []);
  const [colors, setColors] = useState(initial?.colors ?? '');
  const [language, setLanguage] = useState<Language>(initial?.language ?? 'en');
  const [tradition, setTradition] = useState<TraditionId>(initial?.tradition ?? 'modern');
  const [ceremonies, setCeremonies] = useState<string[]>(
    initial?.ceremonies?.length
      ? initial.ceremonies
      : TRADITION_DATA[initial?.tradition ?? 'modern'].defaultCeremonies,
  );
  const [venueName, setVenueName] = useState(initial?.venueName ?? '');
  const [venuePreference, setVenuePreference] = useState(initial?.venuePreference ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const summaryRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const budgetValue = parseInr(budget);
  const values = {
    eventType,
    title,
    date,
    city,
    guests,
    budget: budgetValue ?? budget,
    preferences,
    priorities,
    venueType,
    ageGroup,
    diets,
    colors,
    language,
    tradition,
    ceremonies,
    venueName,
    venuePreference,
  };

  const chooseTradition = (t: TraditionId) => {
    setTradition(t);
    setCeremonies(TRADITION_DATA[t].defaultCeremonies);
  };
  const toggleCeremony = (id: string) =>
    setCeremonies((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const togglePriority = (p: Priority) =>
    setPriorities((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].slice(-2)));
  const toggleDiet = (d: Diet) =>
    setDiets((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const showErrors = (errs: FieldErrors) => {
    setErrors(errs);
    requestAnimationFrame(() => summaryRef.current?.focus());
  };

  const goTo = (next: number) => {
    setErrors({});
    setStep(next);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  /** Validates only the current step's fields before moving on. */
  const next = () => {
    const result = validateEventDetails(values, today);
    const stepErrors: FieldErrors = {};
    if (!result.ok) {
      for (const f of STEPS[step].fields) if (result.errors[f]) stepErrors[f] = result.errors[f];
    }
    if (Object.keys(stepErrors).length > 0) return showErrors(stepErrors);
    goTo(step + 1);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateEventDetails(values, today);
    if (!result.ok) {
      const firstBad = STEPS.findIndex((s) => s.fields.some((f) => result.errors[f]));
      if (firstBad >= 0 && firstBad !== step) setStep(firstBad);
      return showErrors(result.errors);
    }
    setErrors({});
    onSubmit(result.value);
  };

  const errorList = STEPS.flatMap((s) => s.fields).filter((f) => errors[f]);
  const describedBy = (field: keyof EventDetails, hint?: string) =>
    [hint, errors[field] ? `${field}-error` : undefined].filter(Boolean).join(' ') || undefined;
  const fieldError = (field: keyof EventDetails) =>
    errors[field] ? (
      <p id={`${field}-error`} className="field-error">
        {errors[field]}
      </p>
    ) : null;

  const isLast = step === STEPS.length - 1;
  const canFinishEarly = isEdit || step >= 1;
  const daysAway = date && !Number.isNaN(Date.parse(date)) ? daysBetween(today, date) : null;

  return (
    <div className="planner-layout" id="plan-form">
      <form className="card form" onSubmit={handleSubmit} noValidate aria-labelledby="form-title">
        <div>
          <p className="eyebrow">{isEdit ? 'Change details' : 'Step 2 · Check the details'}</p>
          <h2 id="form-title" className="section-title" tabIndex={-1}>
            {isEdit ? 'Update your celebration' : 'Tell us about your celebration'}
          </h2>
          {intro && (
            <p className="notice success" role="status">
              <Sparkles size={18} aria-hidden="true" /> {intro}
            </p>
          )}
        </div>

        <ol className="steps" aria-label="Form steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                className={`step-btn${i < step ? ' complete' : ''}`}
                aria-current={i === step ? 'step' : undefined}
                onClick={() => (i < step || isEdit ? goTo(i) : undefined)}
                aria-disabled={!(i < step || isEdit) && i !== step}
              >
                <span className="step-label">
                  {i + 1}. {s.title}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <h3 ref={headingRef} tabIndex={-1}>
          {STEPS[step].title}
        </h3>

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

        {step === 0 && (
          <>
            <fieldset
              className="event-types"
              aria-describedby={errors.eventType ? 'eventType-error' : undefined}
            >
              <legend>What are you planning? *</legend>
              {EVENT_TYPES.map((type, i) => {
                const { label, hint, icon: Icon, tone } = EVENT_LABELS[type];
                return (
                  <label key={type} className={`choice ${eventType === type ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="eventType"
                      id={i === 0 ? 'eventType' : undefined}
                      value={type}
                      checked={eventType === type}
                      onChange={() => setEventType(type)}
                    />
                    <span className={`icon-badge ${tone}`} aria-hidden="true">
                      <Icon size={22} />
                    </span>
                    <span className="choice-title">{label}</span>
                    <span className="choice-hint">{hint}</span>
                  </label>
                );
              })}
              {fieldError('eventType')}
            </fieldset>
            <div className="field">
              <label htmlFor="tradition">Tradition</label>
              <select
                id="tradition"
                value={tradition}
                aria-describedby="tradition-hint"
                onChange={(e) => chooseTradition(e.target.value as TraditionId)}
              >
                {TRADITIONS.map((t) => (
                  <option key={t} value={t}>
                    {TRADITION_DATA[t].label}
                  </option>
                ))}
              </select>
              <p id="tradition-hint" className="hint">
                Shapes the ceremonies, the menu and how food is served (for example, a Bengali biye dinner is
                served seated, never as a buffet).
              </p>
            </div>
            {eventType === 'wedding' && (
              <fieldset>
                <legend>Which functions are you planning?</legend>
                <div className="chips">
                  {TRADITION_DATA[tradition].ceremonies.map((c) => (
                    <label key={c.id} className={`chip ${ceremonies.includes(c.id) ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={ceremonies.includes(c.id)}
                        onChange={() => toggleCeremony(c.id)}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
                <p className="hint">Planning only the reception? Untick the rest.</p>
              </fieldset>
            )}
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
                {fieldError('date')}
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
                {fieldError('city')}
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="grid-2">
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
                {fieldError('guests')}
              </div>
              <div className="field">
                <label htmlFor="budget">Total budget (₹) *</label>
                <input
                  id="budget"
                  type="text"
                  autoComplete="off"
                  value={budget}
                  required
                  aria-invalid={Boolean(errors.budget)}
                  aria-describedby={describedBy('budget', 'budget-hint')}
                  onChange={(e) => setBudget(e.target.value)}
                />
                <p id="budget-hint" className="hint">
                  Type it your way — 20 lakh, 20L, 1.5 crore or 20,00,000. Include everything: venue, food,
                  décor and contingency.
                  {budgetValue !== null && /[^\d]/.test(budget.trim()) && (
                    <strong className="parsed-amount"> = {formatInr(budgetValue)}</strong>
                  )}
                </p>
                <div className="chips quick-amounts" role="group" aria-label="Quick budget amounts">
                  {QUICK_BUDGETS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className="chip"
                      onClick={() => setBudget(String(amount))}
                    >
                      {lakh(amount)}
                    </button>
                  ))}
                </div>
                {fieldError('budget')}
              </div>
            </div>
            <fieldset>
              <legend>What matters most? (pick up to 2)</legend>
              <div className="chips">
                {PRIORITIES.map((p) => (
                  <label key={p} className={`chip ${priorities.includes(p) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={priorities.includes(p)}
                      onChange={() => togglePriority(p)}
                    />
                    {PRIORITY_LABELS[p]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="language">Language for AI suggestions</label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_LABELS[l]}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {step === 2 && (
          <>
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
                <select
                  id="ageGroup"
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}
                >
                  {AGE_GROUPS.map((a) => (
                    <option key={a} value={a}>
                      {AGE_LABELS[a]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="venuePreference">What kind of venue would you like?</label>
                <input
                  id="venuePreference"
                  value={venuePreference}
                  maxLength={LIMITS.venueMax}
                  placeholder="e.g. rooftop with dine-in, garden with a banquet hall"
                  aria-describedby="venuePreference-hint"
                  onChange={(e) => setVenuePreference(e.target.value)}
                />
                <p id="venuePreference-hint" className="hint">
                  We use this to find the closest matches near you.
                </p>
              </div>
              <div className="field">
                <label htmlFor="venueName">Venue name or Google Maps link, if booked</label>
                <input
                  id="venueName"
                  value={venueName}
                  maxLength={LIMITS.venueLinkMax}
                  placeholder="e.g. Shibaloy Garden, or paste its maps.app.goo.gl link"
                  onChange={(e) => setVenueName(e.target.value)}
                />
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
            <fieldset>
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
          </>
        )}

        <div className="wizard-nav">
          <div className="actions">
            {step > 0 && (
              <button type="button" className="btn" onClick={() => goTo(step - 1)}>
                <ArrowLeft size={18} aria-hidden="true" /> Back
              </button>
            )}
            {onCancel && (
              <button type="button" className="btn ghost" onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
          <div className="actions">
            {!isLast && (
              <button type="button" className={`btn${canFinishEarly ? '' : ' primary'}`} onClick={next}>
                Next <ArrowRight size={18} aria-hidden="true" />
              </button>
            )}
            {(isLast || canFinishEarly) && (
              <button type="submit" className="btn primary">
                <Sparkles size={18} aria-hidden="true" /> {isEdit ? 'Update my plan' : 'Create my plan'}
              </button>
            )}
          </div>
        </div>
      </form>

      <aside className="card live-preview" aria-label="Plan preview">
        <div className={`banner ${eventType}`}>
          <span className="eyebrow">{eventType ? EVENT_LABELS[eventType].label : 'Your celebration'}</span>
          <strong>{title || 'Untitled event'}</strong>
          <span>{city || 'City'}</span>
        </div>
        <dl>
          <div>
            <dt>Date</dt>
            <dd>{daysAway !== null && daysAway >= 0 ? `${formatDate(date)} · ${daysAway} days` : '—'}</dd>
          </div>
          <div>
            <dt>Guests</dt>
            <dd>{Number(guests) > 0 ? guests : '—'}</dd>
          </div>
          <div>
            <dt>Budget</dt>
            <dd>{budgetValue ? formatInr(budgetValue) : '—'}</dd>
          </div>
          <div>
            <dt>Per guest</dt>
            <dd>{Number(guests) > 0 && budgetValue ? formatInr(budgetValue / Number(guests)) : '—'}</dd>
          </div>
          <div>
            <dt>Tradition</dt>
            <dd>{TRADITION_DATA[tradition].label}</dd>
          </div>
          <div>
            <dt>Diet</dt>
            <dd>{diets.length > 0 ? diets.map((d) => DIET_LABELS[d]).join(', ') : '—'}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
