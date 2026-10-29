import { describe, expect, it } from 'vitest';
import { TIMELINE_TEMPLATES, buildTimeline } from './timeline.js';

describe('buildTimeline', () => {
  it('schedules milestones backwards from the event with ideal lead time', () => {
    const t = buildTimeline('wedding', '2027-06-01', '2026-10-29');
    expect(t.compressed).toBe(false);
    const venue = t.milestones.find((m) => m.id === 'venue')!;
    expect(venue.daysBefore).toBe(160);
    expect(venue.due).toBe('2026-12-23');
    expect(t.milestones.find((m) => m.id === 'event')?.due).toBe('2027-06-01');
    expect(t.milestones.find((m) => m.id === 'thanks')?.phase).toBe('Wrap-up');
  });

  it('compresses tasks when lead time is short, keeping order and no past dates', () => {
    const today = '2026-10-29';
    const t = buildTimeline('wedding', '2026-12-28', today);
    expect(t.compressed).toBe(true);
    expect(t.leadDays).toBe(60);
    const pre = t.milestones.filter((m) => m.daysBefore > 0);
    pre.forEach((m) => expect(m.due >= today).toBe(true));
    for (let i = 1; i < pre.length; i++) expect(pre[i].daysBefore).toBeLessThanOrEqual(pre[i - 1].daysBefore);
  });

  it('handles an event happening today', () => {
    const t = buildTimeline('birthday', '2026-10-29', '2026-10-29');
    expect(t.leadDays).toBe(0);
    expect(t.milestones.every((m) => m.daysBefore <= 0)).toBe(true);
  });

  it('assigns a phase to every milestone in every template', () => {
    for (const type of Object.keys(TIMELINE_TEMPLATES) as (keyof typeof TIMELINE_TEMPLATES)[]) {
      const t = buildTimeline(type, '2027-10-29', '2026-10-29');
      expect(t.milestones.length).toBe(TIMELINE_TEMPLATES[type].length);
      t.milestones.forEach((m) => expect(m.phase).toBeTruthy());
    }
  });
});
