import { describe, expect, it } from 'vitest';
import { TODAY, weddingDetails } from '../test/fixtures.js';
import { describeChanges } from './changes.js';
import { buildPlan } from './plan.js';

const plan = (d = weddingDetails) => buildPlan(d, TODAY);

describe('describeChanges', () => {
  it('explains the "50 more guests, smaller budget, two weeks earlier" change', () => {
    const next = { ...weddingDetails, guests: 350, budget: 2_200_000, date: '2027-04-06' };
    const change = describeChanges(plan(), plan(next), TODAY);
    const text = change.lines.join('\n');
    expect(text).toContain('Guests: 300 → 350 (+50)');
    expect(text).toMatch(/food is now about ₹[\d,]+ per guest/);
    expect(text).toContain('Budget: ₹25,00,000 → ₹22,00,000 (−₹3,00,000)');
    expect(text).toContain('Date moved 14 days earlier');
    expect(text).toContain('tasks are now due sooner');
    expect(text).toContain('Kept: your budget edits');
    expect(change.refreshAi).toBe(true);
    expect(change.reset).toBe(false);
  });

  it('reports a reset when the event type changes', () => {
    const change = describeChanges(plan(), plan({ ...weddingDetails, eventType: 'birthday' }), TODAY);
    expect(change.reset).toBe(true);
    expect(change.lines[0]).toContain('Event type changed to birthday');
    expect(change.lines.join(' ')).not.toContain('Kept:');
  });

  it('notes a later date, a new city, past-due tasks and preference-only edits', () => {
    const later = describeChanges(
      plan(),
      plan({ ...weddingDetails, date: '2027-05-01', city: 'Udaipur' }),
      TODAY,
    );
    expect(later.lines.join(' ')).toContain('11 days later');
    expect(later.lines.join(' ')).toContain('City changed to Udaipur');

    const soon = describeChanges(plan(), plan({ ...weddingDetails, date: '2026-11-15' }), '2026-11-14');
    expect(soon.lines.join(' ')).toContain('past due');

    const prefs = describeChanges(plan(), plan({ ...weddingDetails, colors: 'gold' }), TODAY);
    expect(prefs.lines[0]).toBe('Preferences updated.');
    expect(prefs.refreshAi).toBe(true);

    const none = describeChanges(plan(), plan({ ...weddingDetails, title: 'New name' }), TODAY);
    expect(none.lines[0]).toBe('No changes to the plan.');
    expect(none.refreshAi).toBe(false);
  });
});
