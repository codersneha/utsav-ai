import type { CeremonyIdea, EventDetails, EventType, Ideas, IdeasSection } from '../types.js';
import { cleanList, cleanObjects, toObject } from './aiOutput.js';
import { ceremoniesFor, defaultMenu, traditionOf, validateMenu } from './culture/index.js';
import { cleanText } from './validation.js';

const LABELS: Record<EventType, string> = {
  wedding: 'wedding',
  birthday: 'birthday party',
  community: 'community event',
};

const CEREMONIES_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      id: { type: 'STRING' },
      theme: { type: 'STRING' },
      palette: { type: 'ARRAY', items: { type: 'STRING' } },
      decor: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['id', 'theme', 'palette', 'decor'],
  },
} as const;

const MENU_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: { course: { type: 'STRING' }, dishes: { type: 'ARRAY', items: { type: 'STRING' } } },
    required: ['course', 'dishes'],
  },
} as const;

const LIST = { type: 'ARRAY', items: { type: 'STRING' } } as const;

/** Gemini structured-output schema for each part of the ideas. */
export const IDEAS_SCHEMAS: Record<IdeasSection | 'all', object> = {
  all: {
    type: 'OBJECT',
    properties: {
      summary: { type: 'STRING' },
      ceremonies: CEREMONIES_SCHEMA,
      menu: MENU_SCHEMA,
      activities: LIST,
      budgetTips: LIST,
    },
    required: ['summary', 'ceremonies', 'menu', 'activities', 'budgetTips'],
  },
  decor: { type: 'OBJECT', properties: { ceremonies: CEREMONIES_SCHEMA }, required: ['ceremonies'] },
  menu: { type: 'OBJECT', properties: { menu: MENU_SCHEMA }, required: ['menu'] },
  extras: {
    type: 'OBJECT',
    properties: { summary: { type: 'STRING' }, activities: LIST, budgetTips: LIST },
    required: ['summary', 'activities', 'budgetTips'],
  },
};

const ITEM_MAX = 200;

/** Decor ideas are kept only for ceremonies actually being planned. */
function parseCeremonies(value: unknown, details: EventDetails): CeremonyIdea[] {
  const allowed = new Set(ceremoniesFor(details).map((c) => c.id));
  const seen = new Set<string>();
  return cleanObjects(value, 8, (o) => {
    const id = typeof o.id === 'string' ? o.id : '';
    if (!allowed.has(id) || seen.has(id)) return null;
    seen.add(id);
    const idea = {
      ceremonyId: id,
      theme: cleanText(o.theme, 60),
      palette: cleanList(o.palette, 4, 30),
      decor: cleanList(o.decor, 4, ITEM_MAX),
    };
    return idea.theme && idea.decor.length > 0 ? idea : null;
  });
}

function parseMenu(value: unknown, details: EventDetails) {
  const raw = cleanObjects(value, 20, (o) => ({
    courseId: typeof o.course === 'string' ? o.course : '',
    dishes: cleanList(o.dishes, 8, 120),
  }));
  return validateMenu(raw, details);
}

/**
 * Validates model output against the knowledge base. Ceremony ids must exist,
 * every dish must be a real dish from the tradition's menu, and all text is
 * cleaned. Returns the parts requested, or null if they are unusable.
 */
export function parseIdeas(
  raw: unknown,
  details: EventDetails,
  section?: IdeasSection,
): Partial<Ideas> | null {
  const obj = toObject(raw);
  if (!obj) return null;
  const out: Partial<Ideas> = {};
  if (!section || section === 'decor') {
    out.ceremonies = parseCeremonies(obj.ceremonies, details);
    if (out.ceremonies.length === 0) return null;
  }
  if (!section || section === 'menu') {
    if (!Array.isArray(obj.menu)) return null;
    out.menu = parseMenu(obj.menu, details);
  }
  if (!section || section === 'extras') {
    out.summary = cleanText(obj.summary, 400);
    out.activities = cleanList(obj.activities, 6, ITEM_MAX);
    out.budgetTips = cleanList(obj.budgetTips, 6, ITEM_MAX);
    if (out.activities.length === 0 && out.budgetTips.length === 0) return null;
  }
  return out;
}

/** Combines a section update with the existing ideas (so changing food never touches decor). */
export function mergeIdeas(base: Ideas, update: Partial<Ideas>): Ideas {
  return { ...base, ...update, source: 'gemini' };
}

const EXTRAS: Record<EventType, Pick<Ideas, 'activities' | 'budgetTips'>> = {
  wedding: {
    activities: [
      'A family photo corner with old wedding pictures of parents and grandparents',
      'A short introduction of both families during dinner',
      'Guest wishes recorded on a video booth',
      'Traditional songs led by the elders at the pre-wedding functions',
    ],
    budgetTips: [
      'Choose an off-season or weekday date',
      'Fix the guest list early — food costs scale per head',
      'Reuse the main-function flowers for the reception backdrop',
      'Send digital invitations to most guests',
    ],
  },
  birthday: {
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

/** Deterministic ideas straight from the knowledge base, used when Gemini is unavailable. */
export function fallbackIdeas(details: EventDetails): Ideas {
  const who = details.title || `your ${LABELS[details.eventType]}`;
  const tradition = traditionOf(details);
  const ceremonies = ceremoniesFor(details).map((c) => ({
    ceremonyId: c.id,
    theme: c.name,
    palette: c.palette.map((p) => p.name),
    decor: c.decor,
  }));
  const style = details.eventType === 'wedding' ? `${tradition.label} ` : '';
  return {
    summary: `A ${style}plan for ${who} in ${details.city} for ${details.guests} guests, built from traditional décor and menus. Change any part to make it yours.`,
    ceremonies,
    menu: defaultMenu(details),
    ...EXTRAS[details.eventType],
    source: 'fallback',
  };
}
