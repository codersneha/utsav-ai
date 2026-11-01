import type { EventPlan, VenueType } from '../types.js';
import { formatInr } from './plan.js';

/** Rules of thumb behind the guest-change numbers. They are shown to the user, who can check them with the caterer. */
export const GUEST_RULES = {
  /** Cooked food eaten per guest at an Indian celebration meal. */
  foodKgPerGuest: 0.45,
  guestsPerServerSeated: 25,
  guestsPerServerBuffet: 40,
  guestsPerKitchenHelper: 60,
  guestsPerTable: 10,
  /** Extra plates caterers are asked to cook on top of the new guests. */
  extraPlatesBufferPct: 10,
  /** Share of the expected headcount a caterer usually insists on being paid for. */
  guaranteePct: 90,
} as const;

/** Categories that can give up a little money to pay for extra guests. */
const TRIMMABLE = new Set(['decor', 'entertainment', 'photo', 'stage', 'promotion', 'attire']);
/** The most that is asked of any one category. */
const MAX_TRIM = 0.2;

const kg = (plates: number) => Math.round(plates * GUEST_RULES.foodKgPerGuest * 10) / 10;

/** Food per plate (from the plan's food budget) and what each guest adds to other lines (gifts, invitations…). */
export function guestCosts(plan: EventPlan) {
  const { budget, details } = plan;
  const guests = Math.max(1, details.guests);
  const foodPerPlate = Math.round((budget.lines.find((l) => l.id === 'catering')?.amount ?? 0) / guests);
  const extras = budget.lines
    .filter((l) => l.scalesWithGuests && l.id !== 'catering' && l.amount > 0)
    .map((l) => ({ label: l.label, perGuest: Math.round(l.amount / guests) }));
  const extrasPerGuest = extras.reduce((sum, e) => sum + e.perGuest, 0);
  return { foodPerPlate, extras, extrasPerGuest };
}

const contingencyOf = (plan: EventPlan) => plan.budget.lines.find((l) => l.id === 'contingency')?.amount ?? 0;

export interface ShiftOptions {
  /** Money coming in per guest who attends (entry fee, contribution, sponsor share). 0 for a family event. */
  revenuePerGuest?: number;
}

export interface MoreGuests {
  extra: number;
  newTotal: number;
  /** Extra plates to order: the new guests plus a small buffer. */
  platesToOrder: number;
  bufferPlates: number;
  foodKg: number;
  foodCost: number;
  /** Other lines that grow with guests (gifts, invitations…), each for the extra guests. */
  otherCosts: { label: string; amount: number }[];
  cost: number;
  people: { servers: number; helpers: number; chairs: number; tables: number };
  contingency: number;
  /** Extra cost not covered by the contingency (0 if covered). */
  shortfall: number;
  /** Where the rest could come from: a little off categories that can give. */
  trims: { label: string; amount: number }[];
  /** What is still missing after the trims. */
  remaining: number;
  /** Money in minus total cost, when the event brings in money per guest. */
  net?: number;
  steps: string[];
}

type People = MoreGuests['people'];
type Cover = Pick<MoreGuests, 'contingency' | 'shortfall' | 'trims' | 'remaining'>;

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Extra servers, kitchen helpers, chairs and tables for the bigger crowd. */
function extraPeople(planned: number, extra: number, served: boolean): People {
  const total = planned + extra;
  const more = (per: number) => Math.ceil(total / per) - Math.ceil(planned / per);
  return {
    servers: more(served ? GUEST_RULES.guestsPerServerSeated : GUEST_RULES.guestsPerServerBuffet),
    helpers: more(GUEST_RULES.guestsPerKitchenHelper),
    chairs: extra,
    tables: more(GUEST_RULES.guestsPerTable),
  };
}

/** Contingency pays first; each flexible category then gives a share, never more than a fifth of what it holds. */
function coverCost(plan: EventPlan, cost: number): Cover {
  const contingency = contingencyOf(plan);
  const shortfall = Math.max(0, cost - contingency);
  const givers = plan.budget.lines.filter((l) => TRIMMABLE.has(l.id) && l.amount > 0);
  const room = givers.reduce((sum, l) => sum + l.amount * MAX_TRIM, 0);
  const take = Math.min(shortfall, room);
  const trims =
    take > 0
      ? givers
          .map((l) => ({ label: l.label, amount: Math.round((take * l.amount * MAX_TRIM) / room) }))
          .filter((t) => t.amount > 0)
      : [];
  const remaining = Math.max(0, shortfall - trims.reduce((sum, t) => sum + t.amount, 0));
  return { contingency, shortfall, trims, remaining };
}

/** How the extra cost is met, in one sentence. */
function moneyStep(cost: number, { contingency, shortfall, trims, remaining }: Cover): string {
  if (shortfall === 0) {
    return `Your contingency of ${formatInr(contingency)} covers the ${formatInr(cost)}. Keep the rest for surprises.`;
  }
  const covered = `Contingency covers ${formatInr(Math.min(cost, contingency))}.`;
  if (trims.length === 0) {
    return `${covered} Find the other ${formatInr(shortfall)} from the family, or trim the guest list.`;
  }
  const cuts = trims.map((t) => `${t.label} ${formatInr(t.amount)}`).join(', ');
  const rest = remaining > 0 ? `, and find ${formatInr(remaining)} more` : '';
  return `${covered} Cover the other ${formatInr(shortfall)} by trimming ${cuts}${rest}.`;
}

function staffStep(people: People): string {
  const staff = [
    people.servers > 0 && `${people.servers} more server${people.servers > 1 ? 's' : ''}`,
    people.helpers > 0 && plural(people.helpers, 'kitchen helper'),
    `${people.chairs} chairs`,
    people.tables > 0 && plural(people.tables, 'table'),
  ].filter((x): x is string => Boolean(x));
  return `Arrange ${staff.join(', ')}. Service staff is usually in the per-plate price — confirm it.`;
}

/** What happens if `extra` more people turn up than planned: plates, people, money and where it comes from. */
export function moreGuests(
  plan: EventPlan,
  extra: number,
  served: boolean,
  opts: ShiftOptions = {},
): MoreGuests {
  const { details, budget } = plan;
  const { foodPerPlate, extras } = guestCosts(plan);
  const newTotal = details.guests + extra;
  const bufferPlates = Math.ceil((extra * GUEST_RULES.extraPlatesBufferPct) / 100);
  const platesToOrder = extra + bufferPlates;
  const foodCost = platesToOrder * foodPerPlate;
  const otherCosts = extras.map((e) => ({ label: e.label, amount: e.perGuest * extra }));
  const cost = foodCost + otherCosts.reduce((sum, o) => sum + o.amount, 0);
  const people = extraPeople(details.guests, extra, served);
  const cover = coverCost(plan, cost);
  const revenue = opts.revenuePerGuest ?? 0;
  const net = revenue > 0 ? newTotal * revenue - (budget.total + cost) : undefined;

  const steps = [
    `Tell the caterer now: ${platesToOrder} extra plates (${extra} guests + ${bufferPlates} buffer, about ${kg(platesToOrder)} kg of food). Get the extra-plate price in writing.`,
    staffStep(people),
    served
      ? 'Plan an extra seated batch: elders and VIPs first, with a family member managing each batch.'
      : 'Add a second buffet line so queues stay short.',
    moneyStep(cost, cover),
    `Ask the venue for its maximum capacity and fire-safety limit for ${newTotal} people, and keep spare chairs on standby.`,
    'Keep a quick standby menu (dal, rice, one curry) the caterer can make within an hour, and order 10% extra return gifts and water.',
  ];
  return {
    extra,
    newTotal,
    platesToOrder,
    bufferPlates,
    foodKg: kg(platesToOrder),
    foodCost,
    otherCosts,
    cost,
    people,
    ...cover,
    ...(net !== undefined ? { net } : {}),
    steps,
  };
}

/** What one way of handling the no-shows costs and leaves over. */
export interface Outcome {
  /** Plates the caterer is paid for. */
  paidPlates: number;
  /** Paid for but not eaten. */
  wastedPlates: number;
  wastedKg: number;
  /** Money paid for food nobody eats. */
  foodLoss: number;
  /** Food money you keep because the caterer was told in time. */
  foodKept: number;
  /** Everything still unspent: the kept food money plus the untouched contingency. */
  leftOver: number;
  /** Money in minus total cost, when the event brings in money per guest. */
  net?: number;
}

export interface FewerGuests {
  missing: number;
  planned: number;
  attending: number;
  /** The headcount the caterer will insist on being paid for. */
  guaranteed: number;
  ifTold: Outcome;
  ifNotTold: Outcome;
  /** How much more you keep by telling the caterer in time. */
  savedByTelling: number;
  /** Gifts, invitations and similar items bought for guests who do not come — can often be returned or reused. */
  reusableExtras: number;
  steps: string[];
}

const OUTDOOR_TYPES: VenueType[] = ['outdoor', 'undecided', 'home'];

/** What happens if `missing` guests cannot come (rain, strike, illness): waste, loss, what is left and how to tackle it. */
export function fewerGuests(
  plan: EventPlan,
  missing: number,
  guaranteePct: number = GUEST_RULES.guaranteePct,
  opts: ShiftOptions = {},
): FewerGuests {
  const { details, budget } = plan;
  const { foodPerPlate, extrasPerGuest } = guestCosts(plan);
  const planned = details.guests;
  const gone = Math.min(Math.max(0, Math.round(missing)), Math.max(0, planned - 1));
  const attending = planned - gone;
  const guaranteed = Math.min(planned, Math.ceil((planned * guaranteePct) / 100));
  const contingency = contingencyOf(plan);
  const revenue = opts.revenuePerGuest && opts.revenuePerGuest > 0 ? opts.revenuePerGuest : 0;

  const outcome = (told: boolean): Outcome => {
    const paidPlates = told ? Math.max(attending, guaranteed) : planned;
    const wastedPlates = paidPlates - attending;
    const foodKept = (planned - paidPlates) * foodPerPlate;
    return {
      paidPlates,
      wastedPlates,
      wastedKg: kg(wastedPlates),
      foodLoss: wastedPlates * foodPerPlate,
      foodKept,
      leftOver: foodKept + contingency,
      ...(revenue > 0 ? { net: attending * revenue - (budget.total - foodKept) } : {}),
    };
  };
  const ifTold = outcome(true);
  const ifNotTold = outcome(false);
  const savedByTelling = ifTold.foodKept - ifNotTold.foodKept;
  const priority = details.priorities[0];

  const steps = [
    `Tell the caterer by 3 days before that about ${attending} will come. Their minimum is about ${guaranteed} plates, so you pay for ${ifTold.paidPlates}, not ${planned} — you keep ${formatInr(savedByTelling)}.`,
    ifTold.wastedPlates > 0
      ? `About ${ifTold.wastedPlates} plates (${ifTold.wastedKg} kg) will still be cooked and not eaten: pack takeaway boxes for family and staff, and call a food-rescue group or NGO to collect the rest that night.`
      : 'Nothing is left over once the caterer cooks only for the people who come.',
    `Check the contract: if it guarantees 100% of the headcount, ask to lower it to about ${guaranteePct}% — that is what limits this kind of loss.`,
    ifTold.foodKept > 0
      ? `Use the ${formatInr(ifTold.foodKept)} you keep where it counts${priority ? ` — your priority was ${priority}` : ''} — or leave it in the contingency.`
      : 'Keep the contingency untouched for other surprises.',
    extrasPerGuest > 0
      ? `Return or reuse the gifts and printed items bought for the ${gone} who won’t come (about ${formatInr(gone * extrasPerGuest)}).`
      : 'Confirm the final headcount 48–72 hours before — use the Guests tab to see who has replied.',
  ];
  if (OUTDOOR_TYPES.includes(details.venueType)) {
    steps.push(
      'Book a waterproof shamiana or German hanger, or keep an indoor hall on standby, and check the forecast 5 days before.',
      'Cover walkways, add non-slip mats, keep a generator and lift electricals off the ground.',
    );
  }
  steps.push('Message guests on WhatsApp early about any change of venue or timing.');

  return {
    missing: gone,
    planned,
    attending,
    guaranteed,
    ifTold,
    ifNotTold,
    savedByTelling,
    reusableExtras: gone * extrasPerGuest,
    steps,
  };
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
