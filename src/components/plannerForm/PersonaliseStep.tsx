import { LIMITS } from '../../lib/validation';
import { AGE_GROUPS, DIETS, VENUE_TYPES, type VenueType } from '../../types';
import { CheckboxChips, SelectField } from './fields';
import { AGE_LABELS, DIET_LABELS, VENUE_LABELS, toggle, type StepProps } from './formState';

function VenueFields({ form, update }: StepProps) {
  const chooseVenueType = (next: VenueType) => {
    update('venueType', next);
    // Cafés and restaurants have their own look; décor stays the user's choice.
    if (next === 'restaurant' || next === 'cafe') update('wantsDecor', false);
  };
  return (
    <>
      <div className="grid-2 form-row">
        <div className="field">
          <SelectField
            id="venueType"
            label="Venue type"
            value={form.venueType}
            options={VENUE_TYPES}
            labels={(v) => VENUE_LABELS[v]}
            onChange={chooseVenueType}
          />
        </div>
        <div className="field">
          <SelectField
            id="ageGroup"
            label="Guests are mostly"
            value={form.ageGroup}
            options={AGE_GROUPS}
            labels={(a) => AGE_LABELS[a]}
            onChange={(a) => update('ageGroup', a)}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="venueName">Venue, if booked</label>
        <input
          id="venueName"
          value={form.venueName}
          maxLength={LIMITS.venueLinkMax}
          placeholder="Paste its Google Maps link, or type its name"
          onChange={(e) => update('venueName', e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="venuePreference">Kind of venue you’d like</label>
        <input
          id="venuePreference"
          value={form.venuePreference}
          maxLength={LIMITS.venueMax}
          placeholder="e.g. rooftop with dine-in, garden with a banquet hall"
          aria-describedby="venuePreference-hint"
          onChange={(e) => update('venuePreference', e.target.value)}
        />
        <p id="venuePreference-hint" className="hint">
          We open Google Maps with this search, so you can pick the place.
        </p>
      </div>
    </>
  );
}

function StyleFields({ form, update }: StepProps) {
  return (
    <div className="grid-2 form-row">
      <div className="field">
        <label htmlFor="colors">Colour palette</label>
        <input
          id="colors"
          value={form.colors}
          maxLength={LIMITS.colorsMax}
          placeholder="e.g. marigold and maroon"
          onChange={(e) => update('colors', e.target.value)}
        />
      </div>
      <div className="field">
        <span className="field-label" id="decor-label">
          Décor
        </span>
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            aria-labelledby="decor-label"
            aria-describedby="decor-hint"
            checked={form.wantsDecor}
            onChange={() => update('wantsDecor', !form.wantsDecor)}
          />
          <span className="switch-track" aria-hidden="true" />
          <span>{form.wantsDecor ? 'Plan décor' : 'No décor needed'}</span>
        </label>
        <p id="decor-hint" className="hint">
          Cafés and restaurants often need none — you’ll still see ideas.
        </p>
      </div>
    </div>
  );
}

/** Step 3: venue, style, diets and anything else that makes the plan theirs. */
export function PersonaliseStep(props: StepProps) {
  const { form, update } = props;
  return (
    <>
      <VenueFields {...props} />
      <StyleFields {...props} />
      <fieldset>
        <legend>Dietary needs to cater for</legend>
        <CheckboxChips
          options={DIETS}
          selected={form.diets}
          labels={(d) => DIET_LABELS[d]}
          onToggle={(d) => update('diets', toggle(form.diets, d))}
        />
      </fieldset>
      <div className="field">
        <label htmlFor="preferences">Style, traditions and special needs</label>
        <textarea
          id="preferences"
          rows={3}
          maxLength={LIMITS.preferencesMax}
          value={form.preferences}
          placeholder="e.g. South Indian traditions, eco-friendly, wheelchair access for grandparents"
          aria-describedby="preferences-count"
          onChange={(e) => update('preferences', e.target.value)}
        />
        <p id="preferences-count" className="hint">
          {form.preferences.length}/{LIMITS.preferencesMax} characters
        </p>
      </div>
    </>
  );
}
