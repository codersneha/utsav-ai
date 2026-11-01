import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useRef, useState, type FormEvent, type RefObject } from 'react';
import { todayIso } from '../lib/dates';
import { parseInr } from '../lib/money';
import { validateEventDetails, type FieldErrors } from '../lib/validation';
import type { EventDetails } from '../types';
import { GuestsBudgetStep } from './plannerForm/GuestsBudgetStep';
import { LivePreview } from './plannerForm/LivePreview';
import { OccasionStep } from './plannerForm/OccasionStep';
import { PersonaliseStep } from './plannerForm/PersonaliseStep';
import { STEPS, initialFormState, type FormState, type UpdateField } from './plannerForm/formState';

interface Props {
  /** Values to start from: a saved plan (edit) or fields the AI extracted (create). */
  initial?: Partial<EventDetails>;
  isEdit?: boolean;
  /** Shown above the form, e.g. "AI filled 6 fields — please check them". */
  intro?: string;
  onSubmit: (details: EventDetails) => void;
  onCancel?: () => void;
}

/** The form values in the shape validation expects (budget words like "20 lakh" become a number). */
const toValues = (form: FormState) => ({ ...form, budget: parseInr(form.budget) ?? form.budget });

/** Only the errors for fields on the given step, so "Next" never complains about later steps. */
function stepErrors(errors: FieldErrors, step: number): FieldErrors {
  const out: FieldErrors = {};
  for (const f of STEPS[step].fields) if (errors[f]) out[f] = errors[f];
  return out;
}

function StepList({ step, isEdit, goTo }: { step: number; isEdit: boolean; goTo: (i: number) => void }) {
  return (
    <ol className="steps" aria-label="Form steps">
      {STEPS.map((s, i) => {
        const reachable = i < step || isEdit;
        return (
          <li key={s.title}>
            <button
              type="button"
              className={`step-btn${i < step ? ' complete' : ''}`}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => (reachable ? goTo(i) : undefined)}
              aria-disabled={!reachable && i !== step}
            >
              <span className="step-label">
                {i + 1}. {s.title}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function ErrorSummary({
  errors,
  summaryRef,
}: {
  errors: FieldErrors;
  summaryRef: RefObject<HTMLDivElement | null>;
}) {
  const errorList = STEPS.flatMap((s) => s.fields).filter((f) => errors[f]);
  if (errorList.length === 0) return null;
  return (
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
  );
}

interface NavProps {
  step: number;
  isEdit: boolean;
  onBack: () => void;
  onNext: () => void;
  onCancel?: () => void;
}

function WizardNav({ step, isEdit, onBack, onNext, onCancel }: NavProps) {
  const isLast = step === STEPS.length - 1;
  // Guests and budget are enough for a plan; the last step is optional.
  const canFinishEarly = isEdit || step >= 1;
  return (
    <div className="wizard-nav">
      <div className="actions">
        {step > 0 && (
          <button type="button" className="btn" onClick={onBack}>
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
          <button type="button" className={`btn${canFinishEarly ? '' : ' primary'}`} onClick={onNext}>
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
  );
}

/** A three-step, accessible wizard with a live preview of the plan being described. */
export function PlannerForm({ initial, isEdit = false, intro, onSubmit, onCancel }: Props) {
  const today = todayIso();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => initialFormState(initial));
  const [errors, setErrors] = useState<FieldErrors>({});
  const summaryRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const update: UpdateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

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
    const result = validateEventDetails(toValues(form), today);
    const errs = result.ok ? {} : stepErrors(result.errors, step);
    if (Object.keys(errs).length > 0) return showErrors(errs);
    goTo(step + 1);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateEventDetails(toValues(form), today);
    if (!result.ok) {
      const firstBad = STEPS.findIndex((s) => s.fields.some((f) => result.errors[f]));
      if (firstBad >= 0 && firstBad !== step) setStep(firstBad);
      return showErrors(result.errors);
    }
    setErrors({});
    onSubmit(result.value);
  };

  const stepProps = { form, update, errors };

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

        <StepList step={step} isEdit={isEdit} goTo={goTo} />
        <h3 ref={headingRef} tabIndex={-1}>
          {STEPS[step].title}
        </h3>
        <ErrorSummary errors={errors} summaryRef={summaryRef} />

        {step === 0 && <OccasionStep {...stepProps} today={today} />}
        {step === 1 && <GuestsBudgetStep {...stepProps} />}
        {step === 2 && <PersonaliseStep {...stepProps} />}

        <WizardNav
          step={step}
          isEdit={isEdit}
          onBack={() => goTo(step - 1)}
          onNext={next}
          onCancel={onCancel}
        />
      </form>

      <LivePreview form={form} today={today} />
    </div>
  );
}
