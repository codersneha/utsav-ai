import { describe, expect, it } from 'vitest';
import { weddingDetails } from '../test/fixtures.js';
import { buildIcs, escapeIcs, googleCalendarUrl } from './calendar.js';
import { buildTimeline } from './timeline.js';

describe('calendar export', () => {
  it('escapes special characters', () => {
    expect(escapeIcs('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('creates a valid VCALENDAR with one event per milestone', () => {
    const { milestones } = buildTimeline('wedding', weddingDetails.date, '2026-10-29');
    const ics = buildIcs(weddingDetails, milestones, new Date('2026-10-29T10:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(milestones.length);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270420');
    expect(ics).toContain('DTSTAMP:20261029T100000Z');
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(milestones.length);
    expect(ics).toContain('TRIGGER:-P1D');
  });

  it('builds a Google Calendar template link', () => {
    const url = new URL(googleCalendarUrl(weddingDetails));
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20270420/20270421');
    expect(url.searchParams.get('location')).toBe('Jaipur');
  });
});
