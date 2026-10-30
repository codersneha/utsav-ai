import { describe, expect, it } from 'vitest';
import { TODAY, weddingDetails } from '../test/fixtures.js';
import { buildPlan } from './plan.js';
import { budgetCut, costPerExtraGuest, fewerGuests, moreGuests } from './whatif.js';

const plan = buildPlan(weddingDetails, TODAY);
const perPlate = 2000;

describe('what-if scenarios', () => {
  it('prices extra guests from food and other per-guest costs, against the contingency', () => {
    const each = costPerExtraGuest(plan, perPlate);
    expect(each).toBeGreaterThan(perPlate);
    const more = moreGuests(plan, 50, perPlate, true);
    expect(more.cost).toBe(50 * each);
    expect(more.shortfall).toBe(Math.max(0, more.cost - more.contingency));
    expect(more.steps.join(' ')).toMatch(/seated batch/);
    expect(moreGuests(plan, 50, perPlate, false).steps.join(' ')).toMatch(/buffet line/);
  });

  it('shows the food at risk when guests cannot come, with a rain plan for outdoor venues', () => {
    const fewer = fewerGuests(plan, 100, perPlate);
    expect(fewer.wasted).toBe(200_000);
    expect(fewer.steps.join(' ')).toMatch(/shamiana|German hanger/);
    const indoor = buildPlan({ ...weddingDetails, venueType: 'banquet' }, TODAY);
    expect(fewerGuests(indoor, 100, perPlate).steps.join(' ')).not.toMatch(/shamiana/);
  });

  it('cuts every flexible category in proportion and protects the contingency', () => {
    const cut = budgetCut(plan, 10);
    expect(cut.newTotal).toBe(plan.budget.total * 0.9);
    expect(cut.cuts.some((c) => c.label === 'Contingency')).toBe(false);
    const saved = cut.cuts.reduce((s, c) => s + (c.from - c.to), 0);
    expect(Math.abs(saved - plan.budget.total * 0.1)).toBeLessThan(10);
  });
});
