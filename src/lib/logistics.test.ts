import { describe, expect, it } from 'vitest';
import { geminiLogistics } from '../test/fixtures.js';
import { fallbackLogistics, parseLogistics } from './logistics.js';

describe('parseLogistics', () => {
  it('sorts the schedule and keeps only known vendor ids', () => {
    const parsed = parseLogistics(
      JSON.stringify({
        ...geminiLogistics,
        vendors: [...geminiLogistics.vendors, { id: 'fake-vendor', questions: ['x'], tasks: [] }],
      }),
      'birthday',
    );
    expect(parsed?.daySchedule.map((s) => s.time)).toEqual(['16:00', '18:00', '19:00']);
    expect(Object.keys(parsed!.vendors)).toEqual(['caterer']);
    expect(parsed?.source).toBe('gemini');
  });

  it('drops invalid times, sanitises text and caps list sizes', () => {
    const parsed = parseLogistics(
      {
        daySchedule: [
          { time: '25:00', activity: 'Impossible' },
          { time: '7pm', activity: 'Bad format' },
          { time: '10:00', activity: '<b>Setup</b>' },
          { time: '11:00', activity: 'Doors open' },
          { time: '12:00', activity: 'Lunch' },
        ],
        vendors: [{ id: 'venue', questions: ['a', 'b', 'c', 'd', 'e'], tasks: ['1', '2', '3'] }],
      },
      'birthday',
    );
    expect(parsed?.daySchedule).toHaveLength(3);
    expect(parsed?.daySchedule[0].activity).not.toContain('<');
    expect(parsed?.vendors.venue.questions).toHaveLength(3);
    expect(parsed?.vendors.venue.tasks).toHaveLength(2);
  });

  it('returns null for unusable output', () => {
    expect(parseLogistics('not json', 'wedding')).toBeNull();
    expect(parseLogistics({ daySchedule: [], vendors: [] }, 'wedding')).toBeNull();
    expect(parseLogistics({ ...geminiLogistics, vendors: [] }, 'birthday')).toBeNull();
  });
});

describe('fallbackLogistics', () => {
  it('provides a sorted schedule and questions for every event type', () => {
    for (const type of ['wedding', 'birthday', 'community'] as const) {
      const f = fallbackLogistics(type);
      expect(f.source).toBe('fallback');
      const times = f.daySchedule.map((s) => s.time);
      expect([...times].sort()).toEqual(times);
      expect(Object.keys(f.vendors).length).toBeGreaterThan(0);
      expect(
        parseLogistics(
          { daySchedule: f.daySchedule, vendors: Object.entries(f.vendors).map(([id, v]) => ({ id, ...v })) },
          type,
        ),
      ).not.toBeNull();
    }
  });
});
