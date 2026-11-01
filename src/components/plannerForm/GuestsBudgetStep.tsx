import { parseInr } from '../../lib/money';
import { formatInr } from '../../lib/plan';
import { LIMITS } from '../../lib/validation';
import { LANGUAGES, PRIORITIES } from '../../types';
import { CheckboxChips, FieldError, SelectField, describedBy } from './fields';
import { LANGUAGE_LABELS, PRIORITY_LABELS, type StepProps } from './formState';

const QUICK_BUDGETS = [50_000, 200_000, 500_000, 1_500_000, 2_500_000];
const MAX_PRIORITIES = 2;

const lakh = (n: number) => (n >= 100_000 ? `₹${n / 100_000}L` : `₹${n / 1000}k`);

function BudgetField({ form, update, errors }: StepProps) {
  const budgetValue = parseInr(form.budget);
  // Show the parsed amount only when the user typed words or units ("20 lakh", "1.5cr").
  const showParsed = budgetValue !== null && /[^\d]/.test(form.budget.trim());
  return (
    <div className="field">
      <label htmlFor="budget">Total budget (₹) *</label>
      <input
        id="budget"
        type="text"
        autoComplete="off"
        value={form.budget}
        required
        aria-invalid={Boolean(errors.budget)}
        aria-describedby={describedBy(errors, 'budget', 'budget-hint')}
        onChange={(e) => update('budget', e.target.value)}
      />
      <p id="budget-hint" className="hint">
        Type it your way — 20 lakh, 20L, 1.5 crore or 20,00,000. Include everything: venue, food, décor and
        contingency.
        {showParsed && <strong className="parsed-amount"> = {formatInr(budgetValue)}</strong>}
      </p>
      <div className="chips quick-amounts" role="group" aria-label="Quick budget amounts">
        {QUICK_BUDGETS.map((amount) => (
          <button
            key={amount}
            type="button"
            className="chip"
            onClick={() => update('budget', String(amount))}
          >
            {lakh(amount)}
          </button>
        ))}
      </div>
      <FieldError errors={errors} field="budget" />
    </div>
  );
}

/** Step 2: how many people, how much money, and what matters most. */
export function GuestsBudgetStep(props: StepProps) {
  const { form, update, errors } = props;
  // Picking a third priority drops the oldest one.
  const togglePriority = (p: (typeof PRIORITIES)[number]) =>
    update(
      'priorities',
      form.priorities.includes(p)
        ? form.priorities.filter((x) => x !== p)
        : [...form.priorities, p].slice(-MAX_PRIORITIES),
    );

  return (
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
            value={form.guests}
            required
            aria-invalid={Boolean(errors.guests)}
            aria-describedby={describedBy(errors, 'guests')}
            onChange={(e) => update('guests', e.target.value)}
          />
          <FieldError errors={errors} field="guests" />
        </div>
        <BudgetField {...props} />
      </div>
      <fieldset>
        <legend>What matters most? (pick up to 2)</legend>
        <CheckboxChips
          options={PRIORITIES}
          selected={form.priorities}
          labels={(p) => PRIORITY_LABELS[p]}
          onToggle={togglePriority}
        />
      </fieldset>
      <div className="field">
        <SelectField
          id="language"
          label="Language for AI suggestions"
          value={form.language}
          options={LANGUAGES}
          labels={(l) => LANGUAGE_LABELS[l]}
          onChange={(l) => update('language', l)}
        />
      </div>
    </>
  );
}
