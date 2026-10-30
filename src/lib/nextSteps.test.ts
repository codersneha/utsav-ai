import { describe, expect, it } from 'vitest';
import { TODAY, weddingDetails } from '../test/fixtures.js';
import type { GuestEntry } from '../types.js';
import { fallbackIdeas } from './ideas.js';
import { nextSteps } from './nextSteps.js';
import { buildPlan } from './plan.js';

const base = {
  plan: buildPlan(weddingDetails, TODAY),
  today: TODAY,
  timelineDone: {},
  vendors: [],
  guests: [] as GuestEntry[],
  ideas: null,
};

describe('nextSteps', () => {
  it('suggests a venue and a guest list for a fresh plan, each pointing to its tab', () => {
    const steps = nextSteps(base, 10);
    expect(steps.find((s) => s.id === 'venue')?.tab).toBe('vendors');
    expect(steps.find((s) => s.id === 'guests')?.tab).toBe('guests');
  });

  it('puts overdue tasks first and drops the venue step once one is chosen', () => {
    // Planned in July for a November wedding, checked today: early tasks are now overdue.
    const late = buildPlan({ ...weddingDetails, date: '2026-11-20', venueName: 'Rajbari' }, '2026-07-01');
    const steps = nextSteps({ ...base, plan: late }, 10);
    expect(steps[0].urgent).toBe(true);
    expect(steps.some((s) => s.id === 'venue')).toBe(false);
    expect(steps.some((s) => s.id === 'plan-b')).toBe(true);
  });

  it('flags a menu that is over the food budget', () => {
    const tight = buildPlan({ ...weddingDetails, budget: 300_000 }, TODAY);
    const ideas = fallbackIdeas({ ...weddingDetails, budget: 300_000 });
    const steps = nextSteps({ ...base, plan: tight, ideas }, 10);
    expect(steps.find((s) => s.id === 'menu')?.tab).toBe('ideas');
  });

  it('nudges unsent invitations', () => {
    const guests: GuestEntry[] = [
      {
        id: '1',
        name: 'A',
        relation: '',
        side: 'bride',
        adults: 2,
        children: 0,
        vip: false,
        invited: false,
        rsvp: 'not-asked',
      },
    ];
    expect(nextSteps({ ...base, guests }, 10).find((s) => s.id === 'invites')?.text).toMatch(
      /Send 1 invitation/,
    );
  });
});
