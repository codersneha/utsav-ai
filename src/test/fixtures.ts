import type { EventDetails } from '../types.js';

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
  venueType: 'outdoor',
  diets: ['vegetarian', 'jain'],
  ageGroup: 'mixed',
  colors: 'pastel pink and mint',
  language: 'en',
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
  venueType: 'undecided',
  diets: [],
  ageGroup: 'kids',
  colors: '',
  language: 'en',
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

export const geminiLogistics = {
  daySchedule: [
    { time: '18:00', activity: 'Guests arrive' },
    { time: '16:00', activity: 'Decor setup' },
    { time: '19:00', activity: 'Cake cutting' },
  ],
  vendors: [
    {
      id: 'caterer',
      questions: ['Is Jain food cooked separately?'],
      tasks: ['Confirm a separate Jain counter'],
    },
  ],
};

/** What the API returns for `geminiLogistics` (already validated server-side). */
export const apiLogistics = {
  daySchedule: [
    { time: '16:00', activity: 'Decor setup' },
    { time: '18:00', activity: 'Guests arrive' },
    { time: '19:00', activity: 'Cake cutting' },
  ],
  vendors: {
    caterer: { questions: ['Is Jain food cooked separately?'], tasks: ['Confirm a separate Jain counter'] },
  },
  source: 'gemini',
};

/** A fetch mock that answers each API mode exactly like the real endpoint. */
export function apiResponder(answer = 'Book the venue first.') {
  return async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    let payload: unknown;
    if (body.mode === 'extract') {
      payload = { extracted: { eventType: 'wedding', city: 'Lucknow', guests: 250, budget: 1_800_000 } };
    } else if (body.mode === 'logistics') {
      payload = { logistics: apiLogistics };
    } else if (body.mode === 'ask') {
      payload = /more guests/i.test(body.question)
        ? {
            answer: 'Here is what changes.',
            proposal: { guests: body.details.guests + 50, summary: '50 more guests' },
          }
        : { answer };
    } else {
      payload = {
        ideas: body.refinement ? { ...geminiIdeas, summary: `Refined: ${body.refinement}` } : geminiIdeas,
      };
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
