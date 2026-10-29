import type { EventDetails } from '../types';

export const TODAY = '2026-10-29';

export const weddingDetails: EventDetails = {
  eventType: 'wedding',
  title: 'Priya & Arjun',
  date: '2027-04-20',
  city: 'Jaipur',
  guests: 300,
  budget: 2_500_000,
  preferences: 'Rajasthani folk, pastel colours',
  priorities: ['food'],
};

export const birthdayDetails: EventDetails = {
  eventType: 'birthday',
  title: '',
  date: '2026-11-20',
  city: 'Pune',
  guests: 40,
  budget: 60_000,
  preferences: '',
  priorities: [],
};

export const geminiIdeas = {
  summary: 'A colourful Rajasthani celebration.',
  themes: [{ name: 'Marigold', description: 'Bright marigold garlands.' }],
  decor: ['Lanterns'],
  food: ['Dal baati churma'],
  activities: ['Ghoomar'],
  budgetTips: ['Weekday date'],
};

/** Builds a fake Gemini REST response that returns `text`. */
export function geminiResponse(text: string, status = 200): Response {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
