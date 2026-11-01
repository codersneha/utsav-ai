import type { FieldErrors } from '../../lib/validation';
import type { EventDetails } from '../../types';

type Field = keyof EventDetails;

/** The ids a field is described by: its hint and, when invalid, its error. */
export function describedBy(errors: FieldErrors, field: Field, hint?: string): string | undefined {
  return [hint, errors[field] ? `${field}-error` : undefined].filter(Boolean).join(' ') || undefined;
}

export function FieldError({ errors, field }: { errors: FieldErrors; field: Field }) {
  if (!errors[field]) return null;
  return (
    <p id={`${field}-error`} className="field-error">
      {errors[field]}
    </p>
  );
}

interface SelectProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  labels: (option: T) => string;
  onChange: (value: T) => void;
  hintId?: string;
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  labels,
  onChange,
  hintId,
}: SelectProps<T>) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} aria-describedby={hintId} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels(option)}
          </option>
        ))}
      </select>
    </>
  );
}

interface ChipsProps<T extends string> {
  options: readonly T[];
  selected: readonly T[];
  labels: (option: T) => string;
  onToggle: (option: T) => void;
}

/** A row of checkbox chips for picking several options. */
export function CheckboxChips<T extends string>({ options, selected, labels, onToggle }: ChipsProps<T>) {
  return (
    <div className="chips">
      {options.map((option) => (
        <label key={option} className={`chip ${selected.includes(option) ? 'selected' : ''}`}>
          <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} />
          {labels(option)}
        </label>
      ))}
    </div>
  );
}
