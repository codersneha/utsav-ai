import type { CustomTask, EventType, Milestone, TaskPriority, Timeline } from '../types.js';
import { addDays, daysBetween } from './dates.js';

interface MilestoneSpec {
  id: string;
  task: string;
  /** Ideal number of days before the event. Negative means after the event. */
  daysBefore: number;
  priority: TaskPriority;
  dependsOn?: string[];
}

export const TIMELINE_TEMPLATES: Record<EventType, MilestoneSpec[]> = {
  wedding: [
    {
      id: 'budget',
      task: 'Agree on budget, guest list and wedding style with family',
      daysBefore: 180,
      priority: 'High',
    },
    {
      id: 'venue',
      task: 'Shortlist and book the venue',
      daysBefore: 160,
      priority: 'High',
      dependsOn: ['budget'],
    },
    {
      id: 'photo',
      task: 'Book photographer and videographer',
      daysBefore: 140,
      priority: 'Medium',
      dependsOn: ['budget'],
    },
    {
      id: 'catering',
      task: 'Taste menus and book the caterer',
      daysBefore: 120,
      priority: 'High',
      dependsOn: ['venue'],
    },
    {
      id: 'decor',
      task: 'Finalise decorator and mandap / stage design',
      daysBefore: 90,
      priority: 'Medium',
      dependsOn: ['venue'],
    },
    { id: 'attire', task: 'Order outfits and book makeup artist', daysBefore: 75, priority: 'Medium' },
    {
      id: 'invites',
      task: 'Send save-the-dates and invitations',
      daysBefore: 60,
      priority: 'High',
      dependsOn: ['venue'],
    },
    {
      id: 'stay',
      task: 'Block rooms and arrange guest transport',
      daysBefore: 45,
      priority: 'Medium',
      dependsOn: ['venue', 'invites'],
    },
    {
      id: 'confirm',
      task: 'Confirm all vendors and share the run-of-show',
      daysBefore: 21,
      priority: 'High',
      dependsOn: ['catering', 'decor', 'photo'],
    },
    {
      id: 'headcount',
      task: 'Lock final headcount with caterer',
      daysBefore: 10,
      priority: 'High',
      dependsOn: ['invites', 'catering'],
    },
    {
      id: 'payments',
      task: 'Pack emergency kit and prepare vendor payments',
      daysBefore: 3,
      priority: 'Medium',
      dependsOn: ['confirm'],
    },
    { id: 'event', task: 'Wedding day — follow the run-of-show', daysBefore: 0, priority: 'High' },
    { id: 'thanks', task: 'Settle balances and send thank-you notes', daysBefore: -7, priority: 'Low' },
  ],
  birthday: [
    { id: 'plan', task: 'Fix budget, guest list and theme', daysBefore: 30, priority: 'High' },
    {
      id: 'venue',
      task: 'Book venue or plan the home setup',
      daysBefore: 25,
      priority: 'High',
      dependsOn: ['plan'],
    },
    { id: 'invites', task: 'Send invitations', daysBefore: 21, priority: 'High', dependsOn: ['venue'] },
    {
      id: 'cake',
      task: 'Order the cake and finalise the menu',
      daysBefore: 14,
      priority: 'High',
      dependsOn: ['plan'],
    },
    {
      id: 'entertainment',
      task: 'Book entertainer, games or playlist',
      daysBefore: 12,
      priority: 'Medium',
      dependsOn: ['venue'],
    },
    {
      id: 'decor',
      task: 'Buy decorations and return gifts',
      daysBefore: 7,
      priority: 'Medium',
      dependsOn: ['plan'],
    },
    {
      id: 'rsvp',
      task: 'Follow up on RSVPs and confirm food quantities',
      daysBefore: 4,
      priority: 'High',
      dependsOn: ['invites', 'cake'],
    },
    {
      id: 'setup',
      task: 'Set up decor and charge cameras',
      daysBefore: 1,
      priority: 'Medium',
      dependsOn: ['decor'],
    },
    { id: 'event', task: 'Party day — enjoy!', daysBefore: 0, priority: 'High' },
    { id: 'thanks', task: 'Share photos and thank guests', daysBefore: -2, priority: 'Low' },
  ],
  community: [
    {
      id: 'goals',
      task: 'Define goals, audience and form the organising team',
      daysBefore: 60,
      priority: 'High',
    },
    {
      id: 'venue',
      task: 'Book the venue and apply for local permissions',
      daysBefore: 50,
      priority: 'High',
      dependsOn: ['goals'],
    },
    {
      id: 'sponsors',
      task: 'Reach out to sponsors and local partners',
      daysBefore: 45,
      priority: 'Medium',
      dependsOn: ['goals'],
    },
    {
      id: 'vendors',
      task: 'Book sound, stage, food stalls and rentals',
      daysBefore: 35,
      priority: 'High',
      dependsOn: ['venue'],
    },
    {
      id: 'promote',
      task: 'Launch promotion on social media and notice boards',
      daysBefore: 28,
      priority: 'Medium',
      dependsOn: ['venue'],
    },
    {
      id: 'volunteers',
      task: 'Recruit and brief volunteers',
      daysBefore: 21,
      priority: 'Medium',
      dependsOn: ['goals'],
    },
    {
      id: 'safety',
      task: 'Arrange first aid, fire safety and waste management',
      daysBefore: 14,
      priority: 'High',
      dependsOn: ['venue'],
    },
    {
      id: 'schedule',
      task: 'Publish the event schedule and confirm vendors',
      daysBefore: 7,
      priority: 'High',
      dependsOn: ['vendors'],
    },
    {
      id: 'walkthrough',
      task: 'Walk through the venue and set up',
      daysBefore: 1,
      priority: 'Medium',
      dependsOn: ['venue', 'vendors'],
    },
    {
      id: 'event',
      task: 'Event day — run the schedule and track attendance',
      daysBefore: 0,
      priority: 'High',
    },
    {
      id: 'report',
      task: 'Clean up, settle accounts and share a thank-you post',
      daysBefore: -3,
      priority: 'Low',
    },
  ],
  corporate: [
    {
      id: 'goals',
      task: 'Agree the goals, audience, agenda and budget owner',
      daysBefore: 60,
      priority: 'High',
    },
    {
      id: 'venue',
      task: 'Book the venue and room layout',
      daysBefore: 45,
      priority: 'High',
      dependsOn: ['goals'],
    },
    {
      id: 'speakers',
      task: 'Confirm speakers, hosts and performers',
      daysBefore: 35,
      priority: 'High',
      dependsOn: ['goals'],
    },
    {
      id: 'vendors',
      task: 'Book AV, catering, branding and travel',
      daysBefore: 30,
      priority: 'High',
      dependsOn: ['venue'],
    },
    {
      id: 'invites',
      task: 'Send invitations and open registration',
      daysBefore: 21,
      priority: 'Medium',
      dependsOn: ['venue'],
    },
    {
      id: 'content',
      task: 'Collect presentations and finalise the run-of-show',
      daysBefore: 7,
      priority: 'High',
      dependsOn: ['speakers'],
    },
    {
      id: 'rehearsal',
      task: 'Tech rehearsal and venue walkthrough',
      daysBefore: 1,
      priority: 'High',
      dependsOn: ['vendors', 'content'],
    },
    {
      id: 'event',
      task: 'Event day — run the agenda and track attendance',
      daysBefore: 0,
      priority: 'High',
    },
    {
      id: 'report',
      task: 'Send thank-you notes, feedback form and settle invoices',
      daysBefore: -3,
      priority: 'Low',
    },
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
 * proportionally into the time that remains, keeping their order. The
 * user's own tasks are merged in and everything is sorted by due date.
 */
export function buildTimeline(
  eventType: EventType,
  eventDate: string,
  today: string,
  customTasks: CustomTask[] = [],
): Timeline {
  const specs = TIMELINE_TEMPLATES[eventType];
  const leadDays = Math.max(0, daysBetween(today, eventDate));
  const longest = Math.max(...specs.map((s) => s.daysBefore));
  const compressed = leadDays < longest;
  const scale = compressed && longest > 0 ? leadDays / longest : 1;

  const fromTemplate: Milestone[] = specs.map((spec) => {
    const daysBefore = spec.daysBefore > 0 ? Math.floor(spec.daysBefore * scale) : spec.daysBefore;
    return {
      id: spec.id,
      task: spec.task,
      daysBefore,
      due: addDays(eventDate, -daysBefore),
      phase: phaseFor(daysBefore, spec.daysBefore),
      priority: spec.priority,
      dependsOn: spec.dependsOn ?? [],
      custom: false,
    };
  });

  const fromUser: Milestone[] = customTasks.map((t) => {
    const daysBefore = daysBetween(t.due, eventDate);
    return {
      id: t.id,
      task: t.task,
      daysBefore,
      due: t.due,
      phase: phaseFor(daysBefore, daysBefore),
      priority: t.priority,
      dependsOn: [],
      custom: true,
    };
  });

  // Stable sort keeps template order for tasks due on the same day.
  const milestones = [...fromTemplate, ...fromUser].sort((a, b) => a.due.localeCompare(b.due));
  return { milestones, compressed, leadDays };
}

export interface Attention {
  /** Unfinished tasks whose due date has passed. */
  overdue: Milestone[];
  /** Unfinished tasks that depend on an overdue task. */
  affected: Milestone[];
}

/**
 * Finds what needs attention when something slips — e.g. if venue booking
 * is late, catering, decor and invitations that depend on it are flagged.
 */
export function tasksNeedingAttention(
  timeline: Timeline,
  done: Record<string, boolean>,
  today: string,
): Attention {
  const overdue = timeline.milestones.filter((m) => !done[m.id] && m.due < today && m.daysBefore >= 0);
  const late = new Set(overdue.map((m) => m.id));
  const affected = timeline.milestones.filter(
    (m) => !done[m.id] && !late.has(m.id) && m.dependsOn.some((d) => late.has(d)),
  );
  return { overdue, affected };
}

export function timelineProgress(timeline: Timeline, done: Record<string, boolean>): number {
  const total = timeline.milestones.length;
  return total === 0 ? 0 : Math.round((timeline.milestones.filter((m) => done[m.id]).length / total) * 100);
}
