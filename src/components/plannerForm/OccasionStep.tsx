import { TRADITIONS, TRADITION_DATA, type TraditionId } from '../../lib/culture';
import { LIMITS } from '../../lib/validation';
import { EVENT_TYPES } from '../../types';
import { CheckboxChips, FieldError, SelectField, describedBy } from './fields';
import { EVENT_LABELS, toggle, type StepProps } from './formState';

function EventTypeChoice({ form, update, errors }: StepProps) {
  return (
    <fieldset className="event-types" aria-describedby={errors.eventType ? 'eventType-error' : undefined}>
      <legend>What are you planning? *</legend>
      {EVENT_TYPES.map((type, i) => {
        const { label, hint, icon: Icon, tone } = EVENT_LABELS[type];
        return (
          <label key={type} className={`choice ${form.eventType === type ? 'selected' : ''}`}>
            <input
              type="radio"
              name="eventType"
              id={i === 0 ? 'eventType' : undefined}
              value={type}
              checked={form.eventType === type}
              onChange={() => update('eventType', type)}
            />
            <span className={`icon-badge ${tone}`} aria-hidden="true">
              <Icon size={22} />
            </span>
            <span className="choice-title">{label}</span>
            <span className="choice-hint">{hint}</span>
          </label>
        );
      })}
      <FieldError errors={errors} field="eventType" />
    </fieldset>
  );
}

/** Each tradition has its own functions; changing it resets them to that tradition's usual set. */
function TraditionFields({ form, update }: StepProps) {
  const chooseTradition = (tradition: TraditionId) => {
    update('tradition', tradition);
    update('ceremonies', TRADITION_DATA[tradition].defaultCeremonies);
  };
  const ceremonies = TRADITION_DATA[form.tradition].ceremonies;
  const ceremonyName = (id: string) => ceremonies.find((c) => c.id === id)?.name ?? id;

  return (
    <>
      <div className="field">
        <SelectField
          id="tradition"
          label="Tradition"
          value={form.tradition}
          options={TRADITIONS}
          labels={(t) => TRADITION_DATA[t].label}
          onChange={chooseTradition}
          hintId="tradition-hint"
        />
        <p id="tradition-hint" className="hint">
          Shapes the ceremonies, the menu and how food is served (for example, a Bengali biye dinner is served
          seated, never as a buffet).
        </p>
      </div>
      {form.eventType === 'wedding' && (
        <fieldset>
          <legend>Which functions are you planning?</legend>
          <CheckboxChips
            options={ceremonies.map((c) => c.id)}
            selected={form.ceremonies}
            labels={ceremonyName}
            onToggle={(id) => update('ceremonies', toggle(form.ceremonies, id))}
          />
          <p className="hint">Planning only the reception? Untick the rest.</p>
        </fieldset>
      )}
    </>
  );
}

function WhenAndWhere({ form, update, errors, today }: StepProps & { today: string }) {
  return (
    <div className="grid-2">
      <div className="field">
        <label htmlFor="title">Event name</label>
        <input
          id="title"
          value={form.title}
          maxLength={LIMITS.titleMax}
          placeholder="e.g. Aarav’s 5th birthday"
          onChange={(e) => update('title', e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="date">Event date *</label>
        <input
          id="date"
          type="date"
          min={today}
          value={form.date}
          required
          aria-invalid={Boolean(errors.date)}
          aria-describedby={describedBy(errors, 'date')}
          onChange={(e) => update('date', e.target.value)}
        />
        <FieldError errors={errors} field="date" />
      </div>
      <div className="field">
        <label htmlFor="city">City or town *</label>
        <input
          id="city"
          value={form.city}
          maxLength={LIMITS.cityMax}
          autoComplete="address-level2"
          required
          aria-invalid={Boolean(errors.city)}
          aria-describedby={describedBy(errors, 'city')}
          onChange={(e) => update('city', e.target.value)}
        />
        <FieldError errors={errors} field="city" />
      </div>
    </div>
  );
}

/** Step 1: what, which tradition, when and where. */
export function OccasionStep(props: StepProps & { today: string }) {
  return (
    <>
      <EventTypeChoice {...props} />
      <TraditionFields {...props} />
      <WhenAndWhere {...props} />
    </>
  );
}
