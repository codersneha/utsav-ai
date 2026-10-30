import { describe, expect, it } from 'vitest';
import {
  allocateRemainder,
  applyPriorities,
  BUDGET_TEMPLATES,
  buildBudget,
  describeShift,
  guestImpact,
  PRIORITY_BOOST,
  rebalance,
  releaseCategory,
  splitExact,
  suggestTradeOffs,
  summariseSpend,
} from './budget.js';

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

describe('user overrides', () => {
  it('uses the user amount, flags it and reports unallocated money', () => {
    const plan = buildBudget('birthday', 60_000, 40, [], { venue: 5000 });
    const venue = plan.lines.find((l) => l.id === 'venue')!;
    expect(venue.amount).toBe(5000);
    expect(venue.overridden).toBe(true);
    expect(plan.allocated).toBe(plan.lines.reduce((s, l) => s + l.amount, 0));
    expect(plan.unallocated).toBe(60_000 - plan.allocated);
    expect(plan.unallocated).toBeGreaterThan(0);
  });

  it('warns when categories exceed the total and ignores invalid overrides', () => {
    const plan = buildBudget('birthday', 60_000, 40, [], { venue: 100_000, decor: -5, gifts: Number.NaN });
    expect(plan.unallocated).toBeLessThan(0);
    expect(plan.warnings.some((w) => w.includes('over the total'))).toBe(true);
    expect(plan.lines.find((l) => l.id === 'decor')?.overridden).toBe(false);
    expect(plan.lines.find((l) => l.id === 'gifts')?.overridden).toBe(false);
  });

  it('marks guest-scaled categories', () => {
    const plan = buildBudget('wedding', 1_000_000, 100, []);
    expect(plan.lines.filter((l) => l.scalesWithGuests).map((l) => l.id)).toEqual([
      'catering',
      'invites',
      'transport',
    ]);
  });
});

describe('guestImpact', () => {
  it('estimates the cost of extra guests from per-guest categories only', () => {
    const plan = buildBudget('wedding', 1_000_000, 100, []);
    const perGuest = plan.lines.filter((l) => l.scalesWithGuests).reduce((s, l) => s + l.amount / 100, 0);
    expect(guestImpact(plan, 100, 10)).toBe(Math.round(perGuest * 10));
    expect(guestImpact(plan, 0, 10)).toBe(0);
  });
});

describe('suggestTradeOffs', () => {
  it('offers nothing for a healthy budget', () => {
    const plan = buildBudget('wedding', 2_500_000, 300, []);
    expect(suggestTradeOffs('wedding', plan, 300, {})).toEqual([]);
  });

  it('offers fewer guests, a bigger budget and a shift to food when food is underfunded', () => {
    const plan = buildBudget('wedding', 500_000, 400, []);
    const options = suggestTradeOffs('wedding', plan, 400, {});
    expect(options.map((o) => o.id)).toEqual(['guests', 'budget', 'shift']);

    const guests = options[0].action;
    expect(guests.kind === 'details' && guests.patch.guests).toBeLessThan(400);

    const budget = options[1].action;
    const newBudget = budget.kind === 'details' ? budget.patch.budget! : 0;
    const raised = buildBudget('wedding', newBudget, 400, []);
    expect(raised.lines.find((l) => l.id === 'catering')!.amount / 400).toBeGreaterThanOrEqual(600);

    const shift = options[2].action;
    expect(shift.kind).toBe('overrides');
    if (shift.kind === 'overrides') {
      const shifted = buildBudget('wedding', 500_000, 400, [], shift.overrides);
      expect(shifted.allocated).toBe(500_000);
      expect(shifted.lines.find((l) => l.id === 'catering')!.amount).toBe(600 * 400);
      expect(shifted.warnings).toHaveLength(0);
    }
  });

  it('offers to reset user amounts when they exceed the total', () => {
    const overrides = { venue: 10_000_000 };
    const plan = buildBudget('wedding', 2_500_000, 300, [], overrides);
    const options = suggestTradeOffs('wedding', plan, 300, overrides);
    expect(options[0]).toMatchObject({ id: 'reset', action: { kind: 'overrides', overrides: {} } });
  });
});

describe('rebalancing the split', () => {
  const plan = buildBudget('wedding', 1_000_000, 200, []);
  const sum = (a: Record<string, number>) => Object.values(a).reduce((s, n) => s + n, 0);

  it('moves one category and keeps the total exact, sharing the change in proportion', () => {
    const next = rebalance(plan, 'decor', 200_000);
    expect(next.decor).toBe(200_000);
    expect(sum(next)).toBe(1_000_000);
    const venue = plan.lines.find((l) => l.id === 'venue')!.amount;
    expect(next.venue).toBeLessThan(venue);
  });

  it('never touches locked categories and caps at what the others can give', () => {
    const locked = plan.lines.filter((l) => l.id !== 'decor' && l.id !== 'photo').map((l) => l.id);
    const next = rebalance(plan, 'decor', 5_000_000, locked);
    for (const id of locked) expect(next[id]).toBe(plan.lines.find((l) => l.id === id)!.amount);
    expect(next.photo).toBe(0);
    expect(sum(next)).toBe(1_000_000);
  });

  it('removes money to unallocated, then places it in one category or spreads it', () => {
    const released = buildBudget('wedding', 1_000_000, 200, [], releaseCategory(plan, 'entertainment'));
    const freed = plan.lines.find((l) => l.id === 'entertainment')!.amount;
    expect(released.unallocated).toBe(freed);

    const intoFood = allocateRemainder(released, 'catering');
    expect(intoFood.catering).toBe(released.lines.find((l) => l.id === 'catering')!.amount + freed);
    expect(sum(intoFood)).toBe(1_000_000);

    const spread = allocateRemainder(released, 'spread', ['venue']);
    expect(sum(spread)).toBe(1_000_000);
    expect(spread.entertainment).toBe(0);
    expect(spread.venue).toBe(plan.lines.find((l) => l.id === 'venue')!.amount);
  });

  it('pulls an over-allocated split back within the total', () => {
    const over = buildBudget('wedding', 1_000_000, 200, [], { venue: 600_000 });
    expect(over.unallocated).toBeLessThan(0);
    expect(sum(allocateRemainder(over, 'spread'))).toBe(1_000_000);
  });

  it('summarises what moved', () => {
    const text = describeShift(plan, releaseCategory(plan, 'entertainment'));
    expect(text).toMatch(/^Music & entertainment −₹[\d,]+ · Unallocated \+₹[\d,]+$/);
  });
});
