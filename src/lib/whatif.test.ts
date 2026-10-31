import { describe, expect, it } from 'vitest';
import { TODAY, weddingDetails } from '../test/fixtures.js';
import { buildPlan } from './plan.js';
import { GUEST_RULES, budgetCut, fewerGuests, guestCosts, moreGuests } from './whatif.js';

const plan = buildPlan(weddingDetails, TODAY);
const { foodPerPlate, extrasPerGuest } = guestCosts(plan);
const guests = plan.details.guests;
const contingency = plan.budget.lines.find((l) => l.id === 'contingency')?.amount ?? 0;

describe('if guests don’t come', () => {
  it('compares telling the caterer in time with not telling, in plates, kilos and rupees', () => {
    const missing = Math.round(guests * 0.4);
    const f = fewerGuests(plan, missing);
    expect(f.attending).toBe(guests - missing);
    // Not told: every planned plate is paid for, so every missing guest's plate is wasted.
    expect(f.ifNotTold).toMatchObject({ paidPlates: guests, wastedPlates: missing, foodKept: 0 });
    expect(f.ifNotTold.foodLoss).toBe(missing * foodPerPlate);
    expect(f.ifNotTold.wastedKg).toBe(Math.round(missing * GUEST_RULES.foodKgPerGuest * 10) / 10);
    // Told in time: the caterer still insists on the guaranteed headcount, no more.
    expect(f.guaranteed).toBe(Math.ceil((guests * GUEST_RULES.guaranteePct) / 100));
    expect(f.ifTold.paidPlates).toBe(Math.max(f.attending, f.guaranteed));
    expect(f.savedByTelling).toBe((guests - f.ifTold.paidPlates) * foodPerPlate);
    expect(f.savedByTelling).toBeGreaterThan(0);
    expect(f.ifTold.foodLoss).toBeLessThan(f.ifNotTold.foodLoss);
    // Unspent money is what is kept on food plus the untouched contingency.
    expect(f.ifTold.leftOver).toBe(f.ifTold.foodKept + contingency);
    expect(f.reusableExtras).toBe(missing * extrasPerGuest);
  });

  it('wastes nothing when only a few miss and the caterer is told, and caps absurd numbers', () => {
    const few = fewerGuests(plan, 3);
    expect(few.ifTold.paidPlates).toBe(guests - 3);
    expect(few.ifTold.wastedPlates).toBe(0);
    expect(few.steps.join(' ')).toMatch(/Nothing is left over/);
    expect(fewerGuests(plan, 10 * guests).missing).toBe(guests - 1);
    expect(fewerGuests(plan, -5).missing).toBe(0);
  });

  it('follows the caterer’s own guaranteed headcount', () => {
    const missing = Math.round(guests * 0.3);
    const strict = fewerGuests(plan, missing, 100);
    expect(strict.ifTold.paidPlates).toBe(guests);
    expect(strict.savedByTelling).toBe(0);
    const flexible = fewerGuests(plan, missing, 60);
    expect(flexible.savedByTelling).toBeGreaterThan(fewerGuests(plan, missing, 90).savedByTelling);
  });

  it('works out profit or loss when the event brings money in per guest', () => {
    const missing = Math.round(guests * 0.2);
    const withMoney = fewerGuests(plan, missing, 90, { revenuePerGuest: 2000 });
    expect(withMoney.ifTold.net).toBe(
      (guests - missing) * 2000 - (plan.budget.total - withMoney.ifTold.foodKept),
    );
    expect(withMoney.ifTold.net).toBeGreaterThan(withMoney.ifNotTold.net as number);
    expect(fewerGuests(plan, missing).ifTold.net).toBeUndefined();
  });

  it('adds a rain plan for outdoor venues only', () => {
    expect(fewerGuests(plan, 50).steps.join(' ')).toMatch(/shamiana|German hanger/);
    const indoor = buildPlan({ ...weddingDetails, venueType: 'banquet' }, TODAY);
    expect(fewerGuests(indoor, 50).steps.join(' ')).not.toMatch(/shamiana/);
  });
});

describe('if more guests come', () => {
  it('works out plates with a buffer, food, other costs and the people needed', () => {
    const m = moreGuests(plan, 50, true);
    expect(m.newTotal).toBe(guests + 50);
    expect(m.bufferPlates).toBe(5);
    expect(m.platesToOrder).toBe(55);
    expect(m.foodCost).toBe(55 * foodPerPlate);
    expect(m.cost).toBe(m.foodCost + m.otherCosts.reduce((sum, o) => sum + o.amount, 0));
    expect(m.otherCosts.reduce((sum, o) => sum + o.amount, 0)).toBe(50 * extrasPerGuest);
    expect(m.people.servers).toBe(
      Math.ceil((guests + 50) / GUEST_RULES.guestsPerServerSeated) -
        Math.ceil(guests / GUEST_RULES.guestsPerServerSeated),
    );
    expect(m.people.chairs).toBe(50);
    expect(m.steps.join(' ')).toMatch(/seated batch/);
    expect(moreGuests(plan, 50, false).steps.join(' ')).toMatch(/buffet line/);
    // A buffet needs fewer servers than a seated, served meal.
    expect(moreGuests(plan, 50, false).people.servers).toBeLessThanOrEqual(m.people.servers);
  });

  it('covers the gap from the contingency first, then trims flexible categories — never more than a fifth', () => {
    const small = moreGuests(plan, 2, true);
    expect(small.shortfall).toBe(0);
    expect(small.trims).toEqual([]);
    expect(small.steps.join(' ')).toMatch(/contingency of .* covers/i);

    const big = moreGuests(plan, 200, true);
    expect(big.shortfall).toBe(big.cost - contingency);
    const trimmed = big.trims.reduce((sum, t) => sum + t.amount, 0);
    expect(trimmed + big.remaining).toBeGreaterThanOrEqual(big.shortfall - big.trims.length);
    for (const t of big.trims) {
      const line = plan.budget.lines.find((l) => l.label === t.label);
      expect(t.amount).toBeLessThanOrEqual(Math.round((line?.amount ?? 0) * 0.2) + 1);
    }
    expect(big.steps.join(' ')).toMatch(/trimming|Find the other/);
  });

  it('works out net result when the event brings money in per guest', () => {
    const m = moreGuests(plan, 40, true, { revenuePerGuest: 1500 });
    expect(m.net).toBe((guests + 40) * 1500 - (plan.budget.total + m.cost));
    expect(moreGuests(plan, 40, true).net).toBeUndefined();
  });
});

describe('other scenarios', () => {
  it('cuts every flexible category in proportion and protects the contingency', () => {
    const cut = budgetCut(plan, 10);
    expect(cut.newTotal).toBe(plan.budget.total * 0.9);
    expect(cut.cuts.some((c) => c.label === 'Contingency')).toBe(false);
    const saved = cut.cuts.reduce((s, c) => s + (c.from - c.to), 0);
    expect(Math.abs(saved - plan.budget.total * 0.1)).toBeLessThan(10);
  });
});
