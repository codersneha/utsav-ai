import { describe, expect, it } from 'vitest';
import { TIMELINE_TEMPLATES, buildTimeline, tasksNeedingAttention, timelineProgress } from './timeline.js';

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

describe('priorities, dependencies and custom tasks', () => {
  it('gives every template task a priority and only valid dependency ids', () => {
    for (const specs of Object.values(TIMELINE_TEMPLATES)) {
      const ids = new Set(specs.map((s) => s.id));
      for (const s of specs) {
        expect(['High', 'Medium', 'Low']).toContain(s.priority);
        (s.dependsOn ?? []).forEach((d) => expect(ids.has(d)).toBe(true));
      }
    }
  });

  it('merges user tasks and sorts everything by due date', () => {
    const t = buildTimeline('birthday', '2026-12-20', '2026-10-29', [
      { id: 'task-1', task: 'Buy candles', due: '2026-12-10', priority: 'Low' },
    ]);
    const custom = t.milestones.find((m) => m.id === 'task-1')!;
    expect(custom.custom).toBe(true);
    expect(custom.daysBefore).toBe(10);
    const dues = t.milestones.map((m) => m.due);
    expect([...dues].sort()).toEqual(dues);
  });
});

describe('tasksNeedingAttention', () => {
  const today = '2026-10-29';
  // Uncompressed wedding plan: venue is due 2026-12-23, after its dependency 'budget'.
  const t = buildTimeline('wedding', '2027-06-01', '2026-01-01');

  it('flags overdue tasks and the unfinished tasks that depend on them', () => {
    expect(tasksNeedingAttention(t, {}, today)).toEqual({ overdue: [], affected: [] });
    const later = buildTimeline('wedding', '2027-06-01', '2026-01-01');
    const result = tasksNeedingAttention(later, { budget: true, photo: true }, '2026-12-24');
    expect(result.overdue.map((m) => m.id)).toEqual(['venue']);
    expect(result.affected.map((m) => m.id)).toEqual(
      expect.arrayContaining(['catering', 'decor', 'invites']),
    );
  });

  it('ignores completed and post-event tasks', () => {
    const done = Object.fromEntries(t.milestones.map((m) => [m.id, true]));
    expect(tasksNeedingAttention(t, done, '2027-07-01')).toEqual({ overdue: [], affected: [] });
    const result = tasksNeedingAttention(t, {}, '2027-12-31');
    expect(result.overdue.some((m) => m.id === 'thanks')).toBe(false);
  });

  it('computes completion progress', () => {
    expect(timelineProgress(t, {})).toBe(0);
    expect(timelineProgress(t, { venue: true })).toBe(Math.round(100 / t.milestones.length));
    expect(timelineProgress({ milestones: [], compressed: false, leadDays: 0 }, {})).toBe(0);
  });
});
