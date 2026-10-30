import type { EventPlan, VenueType } from '../types.js';

/** Roughly what one extra guest costs: food per plate plus the per-guest share of other costs. */
export function costPerExtraGuest(plan: EventPlan, foodPerPlate: number): number {
  const { budget, details } = plan;
  const otherPerGuest = budget.lines
    .filter((l) => l.scalesWithGuests && l.id !== 'catering')
    .reduce((sum, l) => sum + l.amount / Math.max(1, details.guests), 0);
  return Math.round(foodPerPlate + otherPerGuest);
}

const contingencyOf = (plan: EventPlan) => plan.budget.lines.find((l) => l.id === 'contingency')?.amount ?? 0;

export interface MoreGuests {
  extra: number;
  cost: number;
  contingency: number;
  /** Extra cost not covered by the contingency (0 if covered). */
  shortfall: number;
  steps: string[];
}

/** What happens if `extra` more people turn up than planned. */
export function moreGuests(
  plan: EventPlan,
  extra: number,
  foodPerPlate: number,
  served: boolean,
): MoreGuests {
  const cost = extra * costPerExtraGuest(plan, foodPerPlate);
  const contingency = contingencyOf(plan);
  const steps = [
    'Agree the price of extra plates in the caterer’s contract now, and ask them to cook a 5–10% buffer.',
    'Keep a quick standby menu (dal, rice, a paneer or chicken curry) the caterer can make within an hour.',
    served
      ? 'Plan an extra seated batch: elders and VIPs first, with a family member managing each batch.'
      : 'Add a second buffet line so queues stay short.',
    'Ask the venue for spare chairs and tables on standby, and check its maximum capacity.',
    'Order 10% extra return gifts, sweets boxes and water.',
  ];
  return { extra, cost, contingency, shortfall: Math.max(0, cost - contingency), steps };
}

export interface FewerGuests {
  missing: number;
  /** Food paid for but not eaten, if the caterer is not told in time. */
  wasted: number;
  /** What is saved if the caterer is told before the final-headcount deadline. */
  saved: number;
  steps: string[];
}

const OUTDOOR_TYPES: VenueType[] = ['outdoor', 'undecided', 'home'];

/** What happens if `missing` guests cannot come (rain, strike, illness). */
export function fewerGuests(plan: EventPlan, missing: number, foodPerPlate: number): FewerGuests {
  const outdoor = OUTDOOR_TYPES.includes(plan.details.venueType);
  const steps = [
    'Fix the caterer’s minimum guaranteed headcount at about 90% of the expected guests, not 100%.',
    'Confirm the final headcount 48–72 hours before — use the Guests tab to see who has replied.',
    'Arrange takeaway boxes so leftover food goes home with family and staff.',
    'Line up a food-rescue group or local NGO to collect surplus cooked food safely the same night.',
  ];
  if (outdoor) {
    steps.push(
      'Book a waterproof shamiana or German hanger, or keep an indoor hall on standby, and check the forecast 5 days before.',
      'Cover walkways, add non-slip mats, keep a generator and lift electricals off the ground.',
    );
  }
  steps.push('Message guests on WhatsApp early about any change of venue or timing.');
  const cost = missing * foodPerPlate;
  return { missing, wasted: cost, saved: cost, steps };
}

export interface BudgetCut {
  percent: number;
  newTotal: number;
  /** Lines that shrink (contingency is protected). */
  cuts: { label: string; from: number; to: number }[];
  steps: string[];
}

/** A smaller budget: every flexible category shrinks in proportion, contingency stays. */
export function budgetCut(plan: EventPlan, percent: number): BudgetCut {
  const cut = Math.round((plan.budget.total * percent) / 100);
  const flexible = plan.budget.lines.filter((l) => l.id !== 'contingency');
  const flexTotal = flexible.reduce((s, l) => s + l.amount, 0) || 1;
  const cuts = flexible
    .map((l) => ({ label: l.label, from: l.amount, to: Math.round(l.amount - (cut * l.amount) / flexTotal) }))
    .sort((a, b) => b.from - b.to - (a.from - a.to));
  return {
    percent,
    newTotal: plan.budget.total - cut,
    cuts,
    steps: [
      'Trim the guest list first — food and per-guest costs fall fastest.',
      'Keep the must-have dishes and drop one course or a live counter.',
      'Reuse décor between functions and choose seasonal flowers.',
      'Send digital invitations and limit printed cards to elders.',
    ],
  };
}

export const VENDOR_BACKUP_STEPS = [
  'Keep at least one backup contact for the caterer, decorator and photographer in the Vendors tab.',
  'Make sure every contract says what happens to the advance if the vendor cancels.',
  'Share the vendor list with two family members so anyone can make the call on the day.',
  'Keep 5% of the budget as contingency — last-minute replacements cost more.',
];
