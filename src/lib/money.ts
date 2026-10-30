const MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  l: 1e5,
  lac: 1e5,
  lacs: 1e5,
  lakh: 1e5,
  lakhs: 1e5,
  cr: 1e7,
  crore: 1e7,
  crores: 1e7,
};

/**
 * Reads an amount the way Indians say it: "20 lakh", "20L", "1.5 crore",
 * "8,00,000" or "₹ 60k". Returns whole rupees, or null if it is not an amount.
 */
export function parseInr(input: string): number | null {
  const text = input
    .toLowerCase()
    .replace(/₹|rs\.?|inr|rupees?/g, '')
    .replace(/[,\s]/g, '');
  const match = /^(\d+(?:\.\d+)?)([a-z]*)$/.exec(text);
  if (!match) return null;
  const unit = match[2];
  const multiplier = unit === '' ? 1 : MULTIPLIERS[unit];
  if (!multiplier) return null;
  return Math.round(Number(match[1]) * multiplier);
}
