import { useState } from 'react';

interface Props {
  id: string;
  label: string;
  value: number;
  min?: number;
  max: number;
  onChange: (n: number) => void;
  hint?: string;
}

/** A number box that keeps what is typed (even an empty box) and only reports valid numbers. */
export function NumberField({ id, label, value, min = 1, max, onChange, hint }: Props) {
  const [text, setText] = useState(String(value));
  return (
    <div className="field inline-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        inputMode="numeric"
        value={text}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => {
          setText(e.target.value);
          const n = Math.round(Number(e.target.value));
          if (e.target.value !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        onBlur={() => setText(String(value))}
      />
      {hint && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
    </div>
  );
}
