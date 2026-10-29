import { describe, expect, it } from 'vitest';
import {
  BUDGET_TEMPLATES,
  PRIORITY_BOOST,
  applyPriorities,
  buildBudget,
  splitExact,
  summariseSpend,
} from './budget';

describe('budget templates', () => {
  it.each(Object.entries(BUDGET_TEMPLATES))('%s weights sum to 100', (_type, specs) => {
    expect(specs.reduce((s, c) => s + c.weight, 0)).toBe(100);
  });
});

describe('splitExact', () => {
  it('always sums to the exact total', () => {
    for (const total of [1000, 99_999, 1_234_567, 2_500_001]) {
      const parts = splitExact(total, [33.3, 33.3, 33.4]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      parts.forEach((p) => expect(Number.isInteger(p)).toBe(true));
    }
  });
});

describe('applyPriorities', () => {
  const specs = BUDGET_TEMPLATES.wedding;

  it('returns base weights without priorities', () => {
    expect(applyPriorities(specs, [])).toEqual(specs.map((s) => s.weight));
  });

  it('boosts prioritised categories and keeps total at 100', () => {
    const weights = applyPriorities(specs, ['food', 'decor']);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    const catering = specs.findIndex((s) => s.id === 'catering');
    expect(weights[catering]).toBe(specs[catering].weight + PRIORITY_BOOST);
  });

  it('never reduces contingency', () => {
    const weights = applyPriorities(specs, ['food', 'decor']);
    const i = specs.findIndex((s) => s.id === 'contingency');
    expect(weights[i]).toBe(5);
  });

  it('keeps base split when there is nothing to donate', () => {
    const all = [
      { id: 'a', label: 'A', weight: 50, boostedBy: 'food' as const },
      { id: 'b', label: 'B', weight: 50, fixed: true },
    ];
    expect(applyPriorities(all, ['food'])).toEqual([50, 50]);
  });
});

describe('buildBudget', () => {
  it('allocates the full budget and marks priorities', () => {
    const plan = buildBudget('wedding', 2_500_000, 300, ['food']);
    expect(plan.lines.reduce((s, l) => s + l.amount, 0)).toBe(2_500_000);
    expect(plan.perGuest).toBe(8333);
    expect(plan.lines.find((l) => l.id === 'catering')?.priority).toBe(true);
    expect(plan.warnings).toHaveLength(0);
  });

  it('warns when food per guest is unrealistic', () => {
    const plan = buildBudget('wedding', 100_000, 500, []);
    expect(plan.warnings[0]).toMatch(/per guest/);
  });

  it('handles zero guests safely', () => {
    expect(buildBudget('community', 50_000, 0, []).perGuest).toBe(0);
  });
});

describe('summariseSpend', () => {
  it('tracks remaining budget and over-spent categories', () => {
    const plan = buildBudget('birthday', 60_000, 40, []);
    const venue = plan.lines.find((l) => l.id === 'venue')!;
    const summary = summariseSpend(plan, { venue: venue.amount + 1, catering: 5000, decor: -50 });
    expect(summary.spent).toBe(venue.amount + 1 + 5000);
    expect(summary.remaining).toBe(60_000 - summary.spent);
    expect(summary.overBudget).toEqual(['Venue']);
  });
});
