import type { BudgetLine, BudgetPlan, EventType, Priority } from '../types';

interface CategorySpec {
  id: string;
  label: string;
  /** Base weight in percent. Weights for one event type sum to 100. */
  weight: number;
  /** Which user priority (if any) boosts this category. */
  boostedBy?: Priority;
  /** Contingency is never reduced to fund priorities. */
  fixed?: boolean;
}

/** Industry-typical splits for Indian events, tuned for mid-range budgets. */
export const BUDGET_TEMPLATES: Record<EventType, CategorySpec[]> = {
  wedding: [
    { id: 'venue', label: 'Venue & stay', weight: 25, boostedBy: 'venue' },
    { id: 'catering', label: 'Catering', weight: 28, boostedBy: 'food' },
    { id: 'decor', label: 'Decor & flowers', weight: 12, boostedBy: 'decor' },
    { id: 'photo', label: 'Photo & video', weight: 10, boostedBy: 'photography' },
    { id: 'attire', label: 'Attire, jewellery & beauty', weight: 10 },
    { id: 'entertainment', label: 'Music & entertainment', weight: 5, boostedBy: 'entertainment' },
    { id: 'invites', label: 'Invitations & gifts', weight: 3 },
    { id: 'transport', label: 'Transport & logistics', weight: 2 },
    { id: 'contingency', label: 'Contingency', weight: 5, fixed: true },
  ],
  birthday: [
    { id: 'venue', label: 'Venue', weight: 20, boostedBy: 'venue' },
    { id: 'catering', label: 'Food & cake', weight: 35, boostedBy: 'food' },
    { id: 'decor', label: 'Decor & balloons', weight: 15, boostedBy: 'decor' },
    { id: 'entertainment', label: 'Games & entertainment', weight: 12, boostedBy: 'entertainment' },
    { id: 'photo', label: 'Photos', weight: 5, boostedBy: 'photography' },
    { id: 'gifts', label: 'Return gifts', weight: 5 },
    { id: 'invites', label: 'Invitations', weight: 3 },
    { id: 'contingency', label: 'Contingency', weight: 5, fixed: true },
  ],
  community: [
    { id: 'venue', label: 'Venue & permits', weight: 22, boostedBy: 'venue' },
    { id: 'catering', label: 'Food & refreshments', weight: 25, boostedBy: 'food' },
    { id: 'stage', label: 'Stage, sound & lighting', weight: 15, boostedBy: 'entertainment' },
    { id: 'decor', label: 'Decor & signage', weight: 8, boostedBy: 'decor' },
    { id: 'promotion', label: 'Promotion & outreach', weight: 7 },
    { id: 'supplies', label: 'Supplies & rentals', weight: 8 },
    { id: 'photo', label: 'Photo & media', weight: 3, boostedBy: 'photography' },
    { id: 'safety', label: 'Safety, first aid & cleanup', weight: 7 },
    { id: 'contingency', label: 'Contingency', weight: 5, fixed: true },
  ],
};

/** Percentage points added to each prioritised category. */
export const PRIORITY_BOOST = 5;

/** Below this catering spend per guest (INR) the plan is likely unrealistic. */
const MIN_CATERING_PER_GUEST: Record<EventType, number> = {
  wedding: 600,
  birthday: 250,
  community: 120,
};

/**
 * Re-weights a template so prioritised categories get a boost, funded
 * proportionally by the other non-fixed categories. Weights still sum to 100.
 */
export function applyPriorities(specs: CategorySpec[], priorities: Priority[]): number[] {
  const boosted = specs.map((s) => Boolean(s.boostedBy && priorities.includes(s.boostedBy)));
  const totalBoost = boosted.filter(Boolean).length * PRIORITY_BOOST;
  if (totalBoost === 0) return specs.map((s) => s.weight);

  const donorWeight = specs.reduce((sum, s, i) => (boosted[i] || s.fixed ? sum : sum + s.weight), 0);
  // If nothing can donate (every category boosted), keep the base split.
  if (donorWeight <= totalBoost) return specs.map((s) => s.weight);

  return specs.map((s, i) => {
    if (boosted[i]) return s.weight + PRIORITY_BOOST;
    if (s.fixed) return s.weight;
    return s.weight - (s.weight / donorWeight) * totalBoost;
  });
}

/**
 * Splits `total` into whole-rupee amounts that sum exactly to `total`
 * (largest-remainder method), so the numbers shown never drift.
 */
export function splitExact(total: number, weights: number[]): number[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (total * w) / weightSum);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  return floors;
}

/** Builds a deterministic, explainable budget plan. Numbers never come from the LLM. */
export function buildBudget(
  eventType: EventType,
  total: number,
  guests: number,
  priorities: Priority[],
): BudgetPlan {
  const specs = BUDGET_TEMPLATES[eventType];
  const weights = applyPriorities(specs, priorities);
  const amounts = splitExact(total, weights);

  const lines: BudgetLine[] = specs.map((spec, i) => ({
    id: spec.id,
    label: spec.label,
    amount: amounts[i],
    percent: Math.round(weights[i] * 10) / 10,
    priority: Boolean(spec.boostedBy && priorities.includes(spec.boostedBy)),
  }));

  const perGuest = guests > 0 ? Math.round(total / guests) : 0;
  const warnings: string[] = [];
  const catering = lines.find((l) => l.id === 'catering');
  const minPerGuest = MIN_CATERING_PER_GUEST[eventType];
  if (catering && guests > 0 && catering.amount / guests < minPerGuest) {
    warnings.push(
      `Food works out to about ₹${Math.round(catering.amount / guests)} per guest, below the typical ₹${minPerGuest}. Consider trimming the guest list or raising the budget.`,
    );
  }
  return { total, perGuest, lines, warnings };
}

export interface SpendSummary {
  planned: number;
  spent: number;
  remaining: number;
  overBudget: string[];
}

/** Compares actual spend (by category id) with the plan. */
export function summariseSpend(plan: BudgetPlan, spent: Record<string, number>): SpendSummary {
  let totalSpent = 0;
  const overBudget: string[] = [];
  for (const line of plan.lines) {
    const value = Math.max(0, spent[line.id] ?? 0);
    totalSpent += value;
    if (value > line.amount) overBudget.push(line.label);
  }
  return {
    planned: plan.total,
    spent: totalSpent,
    remaining: plan.total - totalSpent,
    overBudget,
  };
}
