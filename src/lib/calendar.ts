import type { EventDetails, Milestone } from '../types.js';
import { addDays } from './dates.js';

/** Escapes text per RFC 5545 §3.3.11. */
export function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

const compact = (iso: string) => iso.replace(/-/g, '');

/** Builds an .ics calendar with one all-day entry (plus a reminder) per milestone. */
export function buildIcs(details: EventDetails, milestones: Milestone[], stamp: Date = new Date()): string {
  const dtstamp = stamp
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const name = details.title || `${details.eventType} plan`;
  const events = milestones.flatMap((m) => [
    'BEGIN:VEVENT',
    `UID:${m.id}-${compact(m.due)}@utsav-ai`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${compact(m.due)}`,
    `DTEND;VALUE=DATE:${compact(addDays(m.due, 1))}`,
    `SUMMARY:${escapeIcs(`${name}: ${m.task}`)}`,
    // Reminder the day before each task is due.
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(`Reminder: ${m.task}`)}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
  ]);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UtsavAI//Event Planner//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

/** "Add to Google Calendar" link for the event day itself. */
export function googleCalendarUrl(details: EventDetails): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: details.title || `My ${details.eventType}`,
    dates: `${compact(details.date)}/${compact(addDays(details.date, 1))}`,
    details: 'Planned with UtsavAI',
    location: details.city,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
