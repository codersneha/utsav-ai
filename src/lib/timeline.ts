import type { EventType, Milestone, Timeline } from '../types.js';
import { addDays, daysBetween } from './dates.js';

interface MilestoneSpec {
  id: string;
  task: string;
  /** Ideal number of days before the event. Negative means after the event. */
  daysBefore: number;
}

export const TIMELINE_TEMPLATES: Record<EventType, MilestoneSpec[]> = {
  wedding: [
    { id: 'budget', task: 'Agree on budget, guest list and wedding style with family', daysBefore: 180 },
    { id: 'venue', task: 'Shortlist and book the venue', daysBefore: 160 },
    { id: 'photo', task: 'Book photographer and videographer', daysBefore: 140 },
    { id: 'catering', task: 'Taste menus and book the caterer', daysBefore: 120 },
    { id: 'decor', task: 'Finalise decorator and mandap / stage design', daysBefore: 90 },
    { id: 'attire', task: 'Order outfits and book makeup artist', daysBefore: 75 },
    { id: 'invites', task: 'Send save-the-dates and invitations', daysBefore: 60 },
    { id: 'stay', task: 'Block rooms and arrange guest transport', daysBefore: 45 },
    { id: 'confirm', task: 'Confirm all vendors and share the run-of-show', daysBefore: 21 },
    { id: 'headcount', task: 'Lock final headcount with caterer', daysBefore: 10 },
    { id: 'payments', task: 'Pack emergency kit and prepare vendor payments', daysBefore: 3 },
    { id: 'event', task: 'Wedding day — follow the run-of-show', daysBefore: 0 },
    { id: 'thanks', task: 'Settle balances and send thank-you notes', daysBefore: -7 },
  ],
  birthday: [
    { id: 'plan', task: 'Fix budget, guest list and theme', daysBefore: 30 },
    { id: 'venue', task: 'Book venue or plan the home setup', daysBefore: 25 },
    { id: 'invites', task: 'Send invitations', daysBefore: 21 },
    { id: 'cake', task: 'Order the cake and finalise the menu', daysBefore: 14 },
    { id: 'entertainment', task: 'Book entertainer, games or playlist', daysBefore: 12 },
    { id: 'decor', task: 'Buy decorations and return gifts', daysBefore: 7 },
    { id: 'rsvp', task: 'Follow up on RSVPs and confirm food quantities', daysBefore: 4 },
    { id: 'setup', task: 'Set up decor and charge cameras', daysBefore: 1 },
    { id: 'event', task: 'Party day — enjoy!', daysBefore: 0 },
    { id: 'thanks', task: 'Share photos and thank guests', daysBefore: -2 },
  ],
  community: [
    { id: 'goals', task: 'Define goals, audience and form the organising team', daysBefore: 60 },
    { id: 'venue', task: 'Book the venue and apply for local permissions', daysBefore: 50 },
    { id: 'sponsors', task: 'Reach out to sponsors and local partners', daysBefore: 45 },
    { id: 'vendors', task: 'Book sound, stage, food stalls and rentals', daysBefore: 35 },
    { id: 'promote', task: 'Launch promotion on social media and notice boards', daysBefore: 28 },
    { id: 'volunteers', task: 'Recruit and brief volunteers', daysBefore: 21 },
    { id: 'safety', task: 'Arrange first aid, fire safety and waste management', daysBefore: 14 },
    { id: 'schedule', task: 'Publish the event schedule and confirm vendors', daysBefore: 7 },
    { id: 'walkthrough', task: 'Walk through the venue and set up', daysBefore: 1 },
    { id: 'event', task: 'Event day — run the schedule and track attendance', daysBefore: 0 },
    { id: 'report', task: 'Clean up, settle accounts and share a thank-you post', daysBefore: -3 },
  ],
};

function phaseFor(daysBefore: number, idealDaysBefore: number): Milestone['phase'] {
  if (idealDaysBefore < 0) return 'Wrap-up';
  if (idealDaysBefore === 0) return 'Event day';
  if (daysBefore <= 7) return 'Final week';
  if (idealDaysBefore >= 120 || daysBefore >= 90) return 'Plan';
  if (idealDaysBefore >= 21) return 'Book';
  return 'Prepare';
}

/**
 * Schedules milestones backwards from the event date. If there is less lead
 * time than the template expects, pre-event tasks are compressed
 * proportionally into the time that remains, keeping their order.
 */
export function buildTimeline(eventType: EventType, eventDate: string, today: string): Timeline {
  const specs = TIMELINE_TEMPLATES[eventType];
  const leadDays = Math.max(0, daysBetween(today, eventDate));
  const longest = Math.max(...specs.map((s) => s.daysBefore));
  const compressed = leadDays < longest;
  const scale = compressed && longest > 0 ? leadDays / longest : 1;

  const milestones: Milestone[] = specs.map((spec) => {
    const daysBefore = spec.daysBefore > 0 ? Math.floor(spec.daysBefore * scale) : spec.daysBefore;
    return {
      id: spec.id,
      task: spec.task,
      daysBefore,
      due: addDays(eventDate, -daysBefore),
      phase: phaseFor(daysBefore, spec.daysBefore),
    };
  });

  return { milestones, compressed, leadDays };
}
