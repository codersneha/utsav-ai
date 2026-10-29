/** Brand marks: the marigold logo and the festive toran (door garland) border. */

export function MarigoldMark({ size = 30 }: { size?: number }) {
  const petals = Array.from({ length: 10 }, (_, i) => i * 36);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g transform="translate(32 32)">
        {petals.map((deg) => (
          <ellipse key={deg} rx="7.5" ry="15" fill="#e8a33d" transform={`rotate(${deg}) translate(0 -13)`} />
        ))}
        {petals.map((deg) => (
          <ellipse
            key={`in-${deg}`}
            rx="5"
            ry="10"
            fill="#f2c065"
            transform={`rotate(${deg + 18}) translate(0 -9)`}
          />
        ))}
        <circle r="8" fill="#a3195b" />
        <circle r="3.5" fill="#f9d98f" />
      </g>
    </svg>
  );
}

/** A row of alternating marigold, mango-leaf and pink flags, like a toran over a doorway. */
export function Toran() {
  const flags = Array.from({ length: 48 }, (_, i) => i);
  const colors = ['#e8a33d', '#2f8f63', '#a3195b', '#f2c065'];
  return (
    <svg
      className="toran"
      viewBox="0 0 960 14"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="0" y1="1" x2="960" y2="1" stroke="#c9a46a" strokeWidth="2" />
      {flags.map((i) => (
        <path
          key={i}
          d={`M${i * 20} 1 L${i * 20 + 20} 1 L${i * 20 + 10} 13 Z`}
          fill={colors[i % colors.length]}
        />
      ))}
    </svg>
  );
}
