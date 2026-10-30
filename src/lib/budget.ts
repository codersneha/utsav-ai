import type { BudgetLine, BudgetPlan, EventType, Priority } from '../types.js';

interface CategorySpec {
  id: string;
  label: string;
  /** Base weight in percent. Weights for one event type sum to 100. */
  weight: number;
  /** Which user priority (if any) boosts this category. */
  boostedBy?: Priority;
  /** Contingency is never reduced to fund priorities. */
  fixed?: boolean;
  /** Cost grows roughly linearly with the number of guests. */
  perGuest?: boolean;
}

/** Industry-typical splits for Indian events, tuned for mid-range budgets. */
export const BUDGET_TEMPLATES: Record<EventType, CategorySpec[]> = {
  wedding: [
    { id: 'venue', label: 'Venue & stay', weight: 25, boostedBy: 'venue' },
    { id: 'catering', label: 'Catering', weight: 28, boostedBy: 'food', perGuest: true },
    { id: 'decor', label: 'Decor & flowers', weight: 12, boostedBy: 'decor' },
    { id: 'photo', label: 'Photo & video', weight: 10, boostedBy: 'photography' },
    { id: 'attire', label: 'Attire, jewellery & beauty', weight: 10 },
    { id: 'entertainment', label: 'Music & entertainment', weight: 5, boostedBy: 'entertainment' },
    { id: 'invites', label: 'Invitations & gifts', weight: 3, perGuest: true },
    { id: 'transport', label: 'Transport & logistics', weight: 2, perGuest: true },
    { id: 'contingency', label: 'Contingency', weight: 5, fixed: true },
  ],
  birthday: [
    { id: 'venue', label: 'Venue', weight: 20, boostedBy: 'venue' },
    { id: 'catering', label: 'Food & cake', weight: 35, boostedBy: 'food', perGuest: true },
    { id: 'decor', label: 'Decor & balloons', weight: 15, boostedBy: 'decor' },
    { id: 'entertainment', label: 'Games & entertainment', weight: 12, boostedBy: 'entertainment' },
    { id: 'photo', label: 'Photos', weight: 5, boostedBy: 'photography' },
    { id: 'gifts', label: 'Return gifts', weight: 5, perGuest: true },
    { id: 'invites', label: 'Invitations', weight: 3, perGuest: true },
    { id: 'contingency', label: 'Contingency', weight: 5, fixed: true },
  ],
  community: [
    { id: 'venue', label: 'Venue & permits', weight: 22, boostedBy: 'venue' },
    { id: 'catering', label: 'Food & refreshments', weight: 25, boostedBy: 'food', perGuest: true },
    { id: 'stage', label: 'Stage, sound & lighting', weight: 15, boostedBy: 'entertainment' },
    { id: 'decor', label: 'Decor & signage', weight: 8, boostedBy: 'decor' },
    { id: 'promotion', label: 'Promotion & outreach', weight: 7 },
    { id: 'supplies', label: 'Supplies & rentals', weight: 8, perGuest: true },
    { id: 'photo', label: 'Photo & media', weight: 3, boostedBy: 'photography' },
    { id: 'safety', label: 'Safety, first aid & cleanup', weight: 7 },
    { id: 'contingency', label: 'Contingency', weight: 5, fixed: true },
  ],
  corporate: [
    { id: 'venue', label: 'Venue & stay', weight: 25, boostedBy: 'venue' },
    { id: 'catering', label: 'Food & beverages', weight: 28, boostedBy: 'food', perGuest: true },
    { id: 'stage', label: 'AV, stage & production', weight: 14, boostedBy: 'entertainment' },
    { id: 'decor', label: 'Branding & decor', weight: 8, boostedBy: 'decor' },
    { id: 'gifts', label: 'Kits, swag & awards', weight: 8, perGuest: true },
    { id: 'transport', label: 'Travel & logistics', weight: 7, perGuest: true },
    { id: 'photo', label: 'Photo & video', weight: 5, boostedBy: 'photography' },
    { id: 'contingency', label: 'Contingency', weight: 5, fixed: true },
  ],
};

/** Percentage points added to each prioritised category. */
export const PRIORITY_BOOST = 5;

/** Below this catering spend per guest (INR) the plan is likely unrealistic. */
export const MIN_CATERING_PER_GUEST: Record<EventType, number> = {
  wedding: 600,
  birthday: 250,
  community: 120,
  corporate: 700,
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

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Builds a deterministic, explainable budget plan. Numbers never come from
 * the LLM. `overrides` are the user's own amounts for specific categories.
 */
export function buildBudget(
  eventType: EventType,
  total: number,
  guests: number,
  priorities: Priority[],
  overrides: Record<string, number> = {},
): BudgetPlan {
  const specs = BUDGET_TEMPLATES[eventType];
  const suggested = splitExact(total, applyPriorities(specs, priorities));

  const lines: BudgetLine[] = specs.map((spec, i) => {
    const own = overrides[spec.id];
    const overridden = typeof own === 'number' && Number.isFinite(own) && own >= 0;
    const amount = overridden ? Math.round(own) : suggested[i];
    return {
      id: spec.id,
      label: spec.label,
      amount,
      percent: total > 0 ? round1((amount / total) * 100) : 0,
      priority: Boolean(spec.boostedBy && priorities.includes(spec.boostedBy)),
      scalesWithGuests: Boolean(spec.perGuest),
      overridden,
    };
  });

  const allocated = lines.reduce((s, l) => s + l.amount, 0);
  const unallocated = total - allocated;
  const perGuest = guests > 0 ? Math.round(total / guests) : 0;
  const warnings: string[] = [];

  const catering = lines.find((l) => l.id === 'catering');
  const minPerGuest = MIN_CATERING_PER_GUEST[eventType];
  if (catering && guests > 0 && catering.amount / guests < minPerGuest) {
    warnings.push(
      `Food works out to about ₹${Math.round(catering.amount / guests)} per guest, below the typical ₹${minPerGuest}. See the options below.`,
    );
  }
  if (unallocated < 0) {
    warnings.push(
      `Your category amounts are ₹${Math.abs(unallocated).toLocaleString('en-IN')} over the total budget.`,
    );
  }
  return { total, perGuest, lines, allocated, unallocated, warnings };
}

/** Estimated extra cost of `extraGuests` more guests, from guest-scaled categories. */
export function guestImpact(plan: BudgetPlan, guests: number, extraGuests: number): number {
  if (guests <= 0) return 0;
  const perGuestCost = plan.lines
    .filter((l) => l.scalesWithGuests)
    .reduce((sum, l) => sum + l.amount / guests, 0);
  return Math.round(perGuestCost * extraGuests);
}

export type TradeOffAction =
  | { kind: 'details'; patch: { guests?: number; budget?: number } }
  | { kind: 'overrides'; overrides: Record<string, number> };

export interface TradeOff {
  id: string;
  title: string;
  detail: string;
  action: TradeOffAction;
}

const roundUp = (n: number, step: number) => Math.ceil(n / step) * step;

/**
 * Options to fix an unrealistic or over-allocated budget. Nothing is applied
 * automatically: the user chooses, so they stay in control.
 */
export function suggestTradeOffs(
  eventType: EventType,
  plan: BudgetPlan,
  guests: number,
  overrides: Record<string, number>,
): TradeOff[] {
  const options: TradeOff[] = [];

  if (plan.unallocated < 0 && Object.keys(overrides).length > 0) {
    options.push({
      id: 'reset',
      title: 'Go back to the suggested split',
      detail: 'Clears your own category amounts so everything fits the total again.',
      action: { kind: 'overrides', overrides: {} },
    });
  }

  const catering = plan.lines.find((l) => l.id === 'catering');
  const min = MIN_CATERING_PER_GUEST[eventType];
  if (!catering || guests <= 0 || catering.amount / guests >= min) return options;

  const needed = min * guests - catering.amount;
  const maxGuests = Math.max(1, Math.floor(catering.amount / min));
  options.push({
    id: 'guests',
    title: `Invite up to ${maxGuests} guests`,
    detail: `Keeps food at about ₹${min} per guest without changing the budget.`,
    action: { kind: 'details', patch: { guests: maxGuests } },
  });

  const share = plan.total > 0 ? catering.amount / plan.total : 0;
  if (share > 0) {
    const newBudget = roundUp((min * guests) / share, 1000);
    options.push({
      id: 'budget',
      title: `Raise the budget to ₹${newBudget.toLocaleString('en-IN')}`,
      detail: 'Keeps your guest list and the same split between categories.',
      action: { kind: 'details', patch: { budget: newBudget } },
    });
  }

  const donors = plan.lines.filter(
    (l) => !l.priority && !l.scalesWithGuests && l.id !== 'contingency' && l.id !== 'venue',
  );
  const available = donors.reduce((s, l) => s + l.amount, 0);
  if (available > needed) {
    const shifted: Record<string, number> = { ...overrides, catering: catering.amount + needed };
    let moved = 0;
    donors.forEach((d, i) => {
      // The last donor absorbs rounding so exactly `needed` rupees move.
      const take = i === donors.length - 1 ? needed - moved : Math.round((d.amount / available) * needed);
      moved += take;
      shifted[d.id] = d.amount - take;
    });
    const names = donors.map((d) => d.label.toLowerCase()).join(', ');
    options.push({
      id: 'shift',
      title: `Move ₹${needed.toLocaleString('en-IN')} to food`,
      detail: `Taken proportionally from ${names}.`,
      action: { kind: 'overrides', overrides: shifted },
    });
  }
  return options;
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
  return { planned: plan.total, spent: totalSpent, remaining: plan.total - totalSpent, overBudget };
}
