/** Lightweight, accessible SVG charts (no chart library). */

export const CHART_COLORS = [
  '#a3195b',
  '#e8a33d',
  '#1f7a68',
  '#d9467d',
  '#6c4ab6',
  '#2b7bb9',
  '#9a5a0c',
  '#8c767d',
];

interface RingProps {
  value: number;
  label: string;
  size?: number;
  color?: string;
}

/** A progress ring; screen readers get the label and percentage. */
export function Ring({ value, label, size = 96, color = 'var(--primary)' }: RingProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label}: ${pct}%`}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle
          className="value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size / 4.4}>
          {pct}%
        </text>
      </svg>
      <span aria-hidden="true">{label}</span>
    </div>
  );
}

export interface Slice {
  label: string;
  value: number;
}

interface DonutProps {
  slices: Slice[];
  centerLabel: string;
  centerValue: string;
  size?: number;
  title: string;
}

/** A donut chart. The legend (rendered by the caller) carries the same data as text. */
export function Donut({ slices, centerLabel, centerValue, size = 170, title }: DonutProps) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg
      className="donut"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={title}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="22" />
      {total > 0 &&
        slices.map((s, i) => {
          const len = (Math.max(0, s.value) / total) * c;
          const el = (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth="22"
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += len;
          return el;
        })}
      <text x="50%" y="46%" textAnchor="middle" fontSize="20" fontWeight="700">
        {centerValue}
      </text>
      <text x="50%" y="60%" textAnchor="middle" fontSize="11" fill="var(--muted)">
        {centerLabel}
      </text>
    </svg>
  );
}
