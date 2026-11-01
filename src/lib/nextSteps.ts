import type { EventPlan, GuestEntry, Ideas, VendorEntry } from '../types.js';
import { menuCost, menuFor } from './culture/index.js';
import { isRestaurantVenue } from './checklist.js';
import { daysBetween } from './dates.js';
import { formatInr } from './plan.js';
import { guestTotals } from './guests.js';
import { tasksNeedingAttention } from './timeline.js';

export interface NextStep {
  id: string;
  text: string;
  /** The tab that helps with this step. */
  tab: 'timeline' | 'budget' | 'ideas' | 'vendors' | 'guests' | 'whatif';
  urgent?: boolean;
}

interface State {
  plan: EventPlan;
  today: string;
  timelineDone: Record<string, boolean>;
  vendors: VendorEntry[];
  guests: GuestEntry[];
  ideas: Ideas | null;
}

/** The state every step rule reads, plus the days left until the event. */
interface Context extends State {
  daysToGo: number;
}

type StepRule = (c: Context) => NextStep[];

const MENU_OVER_BUDGET_SHARE = 0.05;
const CATERER_LEAD_DAYS = 120;
const RSVP_CHASE_DAYS = 21;
const PLAN_B_DAYS = 30;

const booked = (vendors: VendorEntry[], groupId: string) =>
  vendors.some((v) => v.groupId === groupId && v.status === 'confirmed');

const overdueTasks: StepRule = ({ plan, timelineDone, today }) =>
  tasksNeedingAttention(plan.timeline, timelineDone, today)
    .overdue.slice(0, 2)
    .map((m) => ({ id: `overdue-${m.id}`, text: `Overdue: ${m.task}`, tab: 'timeline', urgent: true }));

const budgetWarning: StepRule = ({ plan }) =>
  plan.budget.warnings.slice(0, 1).map((w) => ({ id: 'budget', text: w, tab: 'budget', urgent: true }));

/** The suggested menu costs clearly more per plate than the food budget allows. */
const menuOverBudget: StepRule = ({ plan, ideas }) => {
  const { details, budget } = plan;
  // At a restaurant or café the venue's own menu is used, not the suggested one.
  if (!ideas || isRestaurantVenue(details.venueType)) return [];
  const menu = menuFor(details, budget.lines.find((l) => l.id === 'catering')?.amount);
  const over = menuCost(ideas.menu, menu) - menu.perPlate;
  if (over <= menu.perPlate * MENU_OVER_BUDGET_SHARE) return [];
  return [
    {
      id: 'menu',
      text: `The menu is about ${formatInr(over)} per plate over your food budget — trim a dish or move money to catering.`,
      tab: 'ideas',
      urgent: true,
    },
  ];
};

const bookings: StepRule = ({ plan, vendors, daysToGo }) => {
  const { details } = plan;
  const steps: NextStep[] = [];
  if (!details.venueName && !booked(vendors, 'venue')) {
    steps.push({ id: 'venue', text: 'Pick a venue on Google Maps and paste its link.', tab: 'vendors' });
  }
  if (!isRestaurantVenue(details.venueType) && !booked(vendors, 'caterer') && daysToGo <= CATERER_LEAD_DAYS) {
    steps.push({ id: 'caterer', text: 'Shortlist caterers and compare per-plate quotes.', tab: 'vendors' });
  }
  return steps;
};

/** One guest-list step: start the list, send invitations, or chase replies. */
const guestList: StepRule = ({ guests, daysToGo }) => {
  if (guests.length === 0) {
    return [
      {
        id: 'guests',
        text: 'Start your guest list — it counts adults, children and replies for you.',
        tab: 'guests',
      },
    ];
  }
  const { notSent, awaiting } = guestTotals(guests);
  if (notSent > 0) {
    return [
      {
        id: 'invites',
        text: `Send ${notSent} invitation${notSent > 1 ? 's' : ''} still pending.`,
        tab: 'guests',
      },
    ];
  }
  if (awaiting > 0 && daysToGo <= RSVP_CHASE_DAYS) {
    return [{ id: 'rsvp', text: `Follow up with ${awaiting} families who haven’t replied.`, tab: 'guests' }];
  }
  return [];
};

const nextOnTimeline: StepRule = ({ plan, timelineDone, today }) => {
  const upcoming = plan.timeline.milestones.find(
    (m) => !timelineDone[m.id] && m.daysBefore >= 0 && m.due >= today,
  );
  return upcoming
    ? [{ id: `next-${upcoming.id}`, text: `Next on the timeline: ${upcoming.task}`, tab: 'timeline' }]
    : [];
};

const planB: StepRule = ({ daysToGo }) =>
  daysToGo <= PLAN_B_DAYS
    ? [
        {
          id: 'plan-b',
          text: 'Check your plan B for rain, extra guests or a vendor cancelling.',
          tab: 'whatif',
        },
      ]
    : [];

/** Most urgent first. */
const RULES: StepRule[] = [
  overdueTasks,
  budgetWarning,
  menuOverBudget,
  bookings,
  guestList,
  nextOnTimeline,
  planB,
];

/**
 * The few things worth doing next, most urgent first — the plan's own
 * "planning assistant". Deterministic, so it never invents a task.
 */
export function nextSteps(state: State, max = 4): NextStep[] {
  const context: Context = { ...state, daysToGo: daysBetween(state.today, state.plan.details.date) };
  return RULES.flatMap((rule) => rule(context)).slice(0, max);
}
