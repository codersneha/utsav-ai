import { fallbackIdeas } from '../lib/ideas.js';
import type { EventDetails, Ideas, IdeasSection } from '../types.js';

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
  tradition: 'marwari',
  ceremonies: ['mehendi', 'haldi', 'wedding', 'reception'],
  venueName: '',
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
  tradition: 'modern',
  ceremonies: [],
  venueName: '',
};

/** Raw model output for `weddingDetails` (Marwari), as Gemini returns it. */
export const geminiIdeas = {
  summary: 'A colourful Rajasthani celebration.',
  ceremonies: [
    {
      id: 'mehendi',
      theme: 'Marigold',
      palette: ['Marigold', 'Leaf green', 'Pink'],
      decor: ['Floor cushions under a pink canopy', 'Bandhani drapes'],
    },
    { id: 'wedding', theme: 'Haveli Nights', palette: ['Red', 'Gold'], decor: ['Jharokha-style mandap'] },
  ],
  menu: [
    { course: 'starters', dishes: ['Moong dal kachori', 'Kanji vada'] },
    { course: 'mains', dishes: ['Dal baati churma', 'Gatte ki sabzi', 'Ker sangri'] },
    { course: 'desserts', dishes: ['Ghevar', 'Moong dal halwa'] },
  ],
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

export const sampleVenue = {
  name: 'Rajbari Banquet',
  kind: 'events venue',
  address: 'Salt Lake, Kolkata',
  lat: 22.58,
  lon: 88.41,
  distanceKm: 3.2,
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Rajbari%20Banquet%2C%20Kolkata',
  osmUrl: 'https://www.openstreetmap.org/node/1',
};

export const sampleInspiration = {
  theme: 'Garden marigold',
  mood: 'Sunny and relaxed',
  palette: [
    { name: 'Marigold', hex: '#f2a900' },
    { name: 'Leaf green', hex: '#3a7d44' },
  ],
  elements: ['Marigold umbrellas', 'Low floor seating'],
};

/** A fetch mock that answers each API mode exactly like the real endpoint. */
export function apiResponder(answer = 'Book the venue first.') {
  return async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    let payload: unknown;
    if (body.mode === 'extract') {
      payload = { extracted: { eventType: 'wedding', city: 'Lucknow', guests: 250, budget: 1_800_000 } };
    } else if (body.mode === 'venues') {
      payload = { venues: body.action === 'search' ? [sampleVenue] : [] };
    } else if (body.mode === 'vision') {
      payload = { inspiration: sampleInspiration };
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
      payload = { ideas: apiIdeas(body.details, body.section, body.refinement) };
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

const SECTION_KEYS: Record<IdeasSection, (keyof Ideas)[]> = {
  decor: ['ceremonies'],
  menu: ['menu'],
  extras: ['summary', 'activities', 'budgetTips'],
};

/**
 * What the API returns for an ideas request: already validated against the
 * knowledge base, so built from it. The first ceremony is themed "Marigold".
 */
export function apiIdeas(details: EventDetails, section?: IdeasSection, refinement?: string) {
  const base = fallbackIdeas(details);
  const ideas: Partial<Ideas> = {
    ...base,
    source: undefined,
    summary: refinement ? `Refined: ${refinement}` : 'A colourful celebration.',
    ceremonies: base.ceremonies.map((c, i) => (i === 0 ? { ...c, theme: 'Marigold' } : c)),
  };
  if (!section) return ideas;
  return Object.fromEntries(SECTION_KEYS[section].map((k) => [k, ideas[k]]));
}
