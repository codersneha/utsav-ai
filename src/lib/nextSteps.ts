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

/**
 * The few things worth doing next, most urgent first — the plan's own
 * "planning assistant". Deterministic, so it never invents a task.
 */
export function nextSteps({ plan, today, timelineDone, vendors, guests, ideas }: State, max = 4): NextStep[] {
  const { details, timeline, budget } = plan;
  const steps: NextStep[] = [];
  const daysToGo = daysBetween(today, details.date);
  const booked = (groupId: string) => vendors.some((v) => v.groupId === groupId && v.status === 'confirmed');

  for (const m of tasksNeedingAttention(timeline, timelineDone, today).overdue.slice(0, 2)) {
    steps.push({ id: `overdue-${m.id}`, text: `Overdue: ${m.task}`, tab: 'timeline', urgent: true });
  }
  for (const w of budget.warnings.slice(0, 1))
    steps.push({ id: 'budget', text: w, tab: 'budget', urgent: true });

  // At a restaurant or café the venue's own menu is used, not the suggested one.
  if (ideas && !isRestaurantVenue(details.venueType)) {
    const catering = budget.lines.find((l) => l.id === 'catering')?.amount;
    const menu = menuFor(details, catering);
    const over = menuCost(ideas.menu, menu) - menu.perPlate;
    if (over > menu.perPlate * 0.05) {
      steps.push({
        id: 'menu',
        text: `The menu is about ${formatInr(over)} per plate over your food budget — trim a dish or move money to catering.`,
        tab: 'ideas',
        urgent: true,
      });
    }
  }

  if (!details.venueName && !booked('venue')) {
    steps.push({ id: 'venue', text: 'Pick a venue on Google Maps and paste its link.', tab: 'vendors' });
  }
  if (!isRestaurantVenue(details.venueType) && !booked('caterer') && daysToGo <= 120) {
    steps.push({ id: 'caterer', text: 'Shortlist caterers and compare per-plate quotes.', tab: 'vendors' });
  }

  const totals = guestTotals(guests);
  if (guests.length === 0) {
    steps.push({
      id: 'guests',
      text: 'Start your guest list — it counts adults, children and replies for you.',
      tab: 'guests',
    });
  } else if (totals.notSent > 0) {
    steps.push({
      id: 'invites',
      text: `Send ${totals.notSent} invitation${totals.notSent > 1 ? 's' : ''} still pending.`,
      tab: 'guests',
    });
  } else if (totals.awaiting > 0 && daysToGo <= 21) {
    steps.push({
      id: 'rsvp',
      text: `Follow up with ${totals.awaiting} families who haven’t replied.`,
      tab: 'guests',
    });
  }

  const upcoming = timeline.milestones.find(
    (m) => !timelineDone[m.id] && m.daysBefore >= 0 && m.due >= today,
  );
  if (upcoming) {
    steps.push({
      id: `next-${upcoming.id}`,
      text: `Next on the timeline: ${upcoming.task}`,
      tab: 'timeline',
    });
  }
  if (daysToGo <= 30) {
    steps.push({
      id: 'plan-b',
      text: 'Check your plan B for rain, extra guests or a vendor cancelling.',
      tab: 'whatif',
    });
  }
  return steps.slice(0, max);
}
