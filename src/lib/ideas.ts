import type { EventDetails, EventType, Ideas, Theme } from '../types.js';
import { cleanList, cleanObjects, toObject } from './aiOutput.js';
import { cleanText } from './validation.js';

const LABELS: Record<EventType, string> = {
  wedding: 'wedding',
  birthday: 'birthday party',
  community: 'community event',
};

/** JSON schema for Gemini structured output (OpenAPI subset). */
export const IDEAS_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    themes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: { type: 'STRING' }, description: { type: 'STRING' } },
        required: ['name', 'description'],
      },
    },
    decor: { type: 'ARRAY', items: { type: 'STRING' } },
    food: { type: 'ARRAY', items: { type: 'STRING' } },
    activities: { type: 'ARRAY', items: { type: 'STRING' } },
    budgetTips: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['summary', 'themes', 'decor', 'food', 'activities', 'budgetTips'],
} as const;

const ITEM_MAX = 220;
const LIST_MAX = 6;

const pickTheme = (o: Record<string, unknown>): Theme | null => {
  const theme = { name: cleanText(o.name, 60), description: cleanText(o.description, ITEM_MAX) };
  return theme.name && theme.description ? theme : null;
};

/**
 * Validates model output. LLM output is untrusted: every field is type-checked,
 * length-capped and stripped of markup. Returns null if it is unusable.
 */
export function parseIdeas(raw: unknown): Ideas | null {
  const obj = toObject(raw);
  if (!obj) return null;
  const ideas: Ideas = {
    summary: cleanText(obj.summary, 400),
    themes: cleanObjects(obj.themes, 4, pickTheme),
    decor: cleanList(obj.decor, LIST_MAX, ITEM_MAX),
    food: cleanList(obj.food, LIST_MAX, ITEM_MAX),
    activities: cleanList(obj.activities, LIST_MAX, ITEM_MAX),
    budgetTips: cleanList(obj.budgetTips, LIST_MAX, ITEM_MAX),
    source: 'gemini',
  };
  const hasContent = ideas.themes.length > 0 && (ideas.decor.length > 0 || ideas.food.length > 0);
  return hasContent ? ideas : null;
}

const FALLBACK: Record<EventType, Omit<Ideas, 'summary' | 'source'>> = {
  wedding: {
    themes: [
      {
        name: 'Marigold Mela',
        description:
          'Bright genda-phool garlands, brass urlis and folk music for a festive, budget-friendly feel.',
      },
      {
        name: 'Pastel Garden',
        description: 'Soft pinks and greens, fairy lights and potted plants guests can take home.',
      },
      {
        name: 'Royal Heritage',
        description: 'Jewel tones, block-print fabrics and lanterns inspired by palace courtyards.',
      },
    ],
    decor: [
      'Reuse mandap flowers for the reception backdrop',
      'Use diyas and fairy lights instead of large floral walls',
      'Rent fabric drapes rather than buying',
      'Add a photo corner with a family-history wall',
    ],
    food: [
      'Live chaat and dosa counters',
      'One regional speciality from each family',
      'Clearly labelled Jain and vegan options',
      'Kulfi cart for dessert',
    ],
    activities: [
      'Sangeet with family dance performances',
      'Guest wishes recorded on a video booth',
      'Couple quiz during dinner',
      'Mehendi with live dholak',
    ],
    budgetTips: [
      'Choose an off-season or weekday date',
      'Cap the guest list early — food scales per head',
      'Bundle decor and catering with one vendor',
      'Send digital invitations',
    ],
  },
  birthday: {
    themes: [
      {
        name: 'Retro Bollywood',
        description: 'Vintage posters, filmi playlist and a best-dressed-star award.',
      },
      {
        name: 'Picnic in the Park',
        description: 'Mats, fairy lights and finger food for a relaxed outdoor celebration.',
      },
      {
        name: 'Space Explorers',
        description: 'Glow-in-the-dark stars, planet balloons and a “mission” treasure hunt.',
      },
    ],
    decor: [
      'Balloon arch in two theme colours',
      'DIY photo backdrop with fabric and lights',
      'Personalised name banner',
      'Table confetti made from recycled paper',
    ],
    food: [
      'Mini pav bhaji sliders',
      'Build-your-own sundae bar',
      'Fruit skewers for a healthy option',
      'Eggless cake to include everyone',
    ],
    activities: [
      'Treasure hunt with theme clues',
      'Memory jar where guests write wishes',
      'Karaoke or dance-off',
      'Polaroid guestbook',
    ],
    budgetTips: [
      'Host at home or a society clubhouse',
      'Buy decor in reusable colours',
      'Make return gifts plantable seed packets',
      'Pick a lunch slot — smaller menus',
    ],
  },
  community: {
    themes: [
      {
        name: 'Neighbourhood Utsav',
        description: 'Local food stalls, folk performances and a talent stage for residents.',
      },
      { name: 'Green Fair', description: 'Zero-waste stalls, plant swap and upcycling workshops.' },
      { name: 'Culture Walk', description: 'Stations showcasing different regions’ food, dance and crafts.' },
    ],
    decor: [
      'Bunting made from old sarees and fabric scraps',
      'Clear wayfinding signs with large text',
      'Lantern lighting along paths',
      'A community wish tree',
    ],
    food: [
      'Stalls run by local home cooks',
      'Water refill stations instead of bottles',
      'Millet-based snacks',
      'Steel plates on rent to cut waste',
    ],
    activities: [
      'Kids’ drawing competition',
      'Open-mic talent stage',
      'Health check-up camp',
      'Volunteer-led cleanup drive',
    ],
    budgetTips: [
      'Get local businesses to sponsor stalls',
      'Borrow stage and chairs from the RWA or school',
      'Use free social media promotion',
      'Charge a small stall fee to cover costs',
    ],
  },
};

/** Deterministic ideas used when Gemini is unavailable, so the app always works. */
export function fallbackIdeas(details: EventDetails): Ideas {
  const base = FALLBACK[details.eventType];
  const who = details.title || `your ${LABELS[details.eventType]}`;
  return {
    ...base,
    summary: `Here are ideas for ${who} in ${details.city} for ${details.guests} guests. Mix and match the themes and add your own personal touches.`,
    source: 'fallback',
  };
}
