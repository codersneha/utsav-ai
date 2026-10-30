import type { CeremonyIdea, DecorLook, EventDetails, EventType, Ideas, IdeasSection } from '../types.js';
import { cleanList, cleanObjects, toObject } from './aiOutput.js';
import { ceremoniesFor, defaultMenu, traditionOf, validateMenu } from './culture/index.js';
import { cleanText } from './validation.js';

const LABELS: Record<EventType, string> = {
  wedding: 'wedding',
  birthday: 'birthday party',
  community: 'community event',
  corporate: 'corporate event',
};

const CEREMONIES_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      id: { type: 'STRING' },
      theme: { type: 'STRING' },
      palette: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { name: { type: 'STRING' }, hex: { type: 'STRING', description: '#rrggbb' } },
          required: ['name', 'hex'],
        },
      },
      decor: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['id', 'theme', 'palette', 'decor'],
  },
} as const;

const LOOKS_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      name: { type: 'STRING' },
      palette: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { name: { type: 'STRING' }, hex: { type: 'STRING', description: '#rrggbb' } },
          required: ['name', 'hex'],
        },
      },
      decor: { type: 'ARRAY', items: { type: 'STRING' } },
      why: { type: 'STRING' },
    },
    required: ['name', 'palette', 'decor', 'why'],
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
      looks: LOOKS_SCHEMA,
      menu: MENU_SCHEMA,
      activities: LIST,
      budgetTips: LIST,
    },
    required: ['summary', 'ceremonies', 'menu', 'activities', 'budgetTips'],
  },
  decor: {
    type: 'OBJECT',
    properties: { ceremonies: CEREMONIES_SCHEMA, looks: LOOKS_SCHEMA },
    required: ['ceremonies'],
  },
  menu: { type: 'OBJECT', properties: { menu: MENU_SCHEMA }, required: ['menu'] },
  extras: {
    type: 'OBJECT',
    properties: { summary: { type: 'STRING' }, activities: LIST, budgetTips: LIST },
    required: ['summary', 'activities', 'budgetTips'],
  },
};

const ITEM_MAX = 200;
const HEX = /^#[0-9a-f]{6}$/i;

/** Colour names with valid hex codes only (so swatches are always real colours). */
function cleanPalette(value: unknown) {
  return cleanObjects(value, 4, (p) => {
    const name = cleanText(p.name, 30);
    const hex = typeof p.hex === 'string' ? p.hex.trim().toLowerCase() : '';
    return name && HEX.test(hex) ? { name, hex } : null;
  });
}

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
      palette: cleanPalette(o.palette),
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
    if (details.eventType !== 'wedding') {
      // Always three distinct looks; any the model missed come from the trend list.
      const looks = cleanObjects(obj.looks, 3, (o) => {
        const look = {
          name: cleanText(o.name, 50),
          palette: cleanPalette(o.palette),
          decor: cleanList(o.decor, 4, ITEM_MAX),
          why: cleanText(o.why, 160),
        };
        return look.name && look.palette.length > 0 && look.decor.length > 0 ? look : null;
      });
      // Without looks from the model, its own décor idea leads, then the trends.
      const own = out.ceremonies[0];
      if (looks.length === 0 && own && own.palette.length > 0 && own.decor.length > 0)
        looks.push({ name: own.theme, palette: own.palette, decor: own.decor, why: 'Made for your event.' });
      const extra = fallbackLooks(details).filter((f) => !looks.some((l) => l.name === f.name));
      out.looks = [...looks, ...extra].slice(0, 3);
    }
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
  corporate: {
    activities: [
      'A short team quiz or trivia round',
      'Recognition awards with a one-line story for each winner',
      'A photo wall with the company branding',
      'An open mic or band performance by colleagues',
    ],
    budgetTips: [
      'Pick a weekday or off-season date for better venue rates',
      'Choose a venue with in-house AV to avoid rental charges',
      'Use digital badges and agendas instead of print',
      'Lock the headcount a week before for accurate catering',
    ],
  },
};

/** Colours written as "Name #rrggbb" (e.g. from an inspiration photo), if there are at least two. */
export function coloursFromText(text: string): { name: string; hex: string }[] {
  const found = [...text.matchAll(/([A-Za-z][A-Za-z ]{0,28}?)\s*(#[0-9a-fA-F]{6})/g)].map((m) => ({
    name: m[1].trim(),
    hex: m[2].toLowerCase(),
  }));
  return found.length >= 2 ? found.slice(0, 4) : [];
}

type LookSeed = [name: string, palette: [string, string][], decor: string[], why: string];

const look = ([name, palette, decor, why]: LookSeed): DecorLook => ({
  name,
  palette: palette.map(([n, hex]) => ({ name: n, hex })),
  decor,
  why,
});

/** Popular looks right now, by kind of event and venue — used when the user gives no style. */
const TREND_LOOKS: Record<string, LookSeed[]> = {
  kids: [
    [
      'Pastel balloon garland',
      [
        ['Blush pink', '#f4c2c2'],
        ['Mint', '#b8e0d2'],
        ['Lilac', '#c8b6e2'],
      ],
      [
        'An organic balloon garland over the cake table',
        'Pastel paper fans on the backdrop',
        'A name sign in soft lettering',
      ],
      'The most-booked look for kids’ parties this year — soft, photogenic and easy to set up.',
    ],
    [
      'Jungle safari',
      [
        ['Leaf green', '#4f7a28'],
        ['Sand', '#e4c99b'],
        ['Sunny yellow', '#f2c94c'],
      ],
      [
        'Palm-leaf backdrop with animal cut-outs',
        'Safari hats and binocular favours',
        'Green and gold balloon cluster',
      ],
      'A playful theme kids love, with props that double as games.',
    ],
    [
      'Space explorer',
      [
        ['Midnight navy', '#1e2a4a'],
        ['Silver', '#c0c6cf'],
        ['Rocket orange', '#f08a24'],
      ],
      ['Planet balloons hung at different heights', 'Star-print table runner', 'A rocket photo frame'],
      'Big with curious kids — glow-in-the-dark stars make the evening magical.',
    ],
  ],
  young: [
    [
      'Neon glow night',
      [
        ['Neon pink', '#ff3ea5'],
        ['Electric blue', '#2d7ff9'],
        ['Black', '#111111'],
      ],
      [
        'A neon sign with the name or an inside joke',
        'UV-reactive balloons',
        'Glow sticks and LED table lights',
      ],
      'Popular with teens and twenty-somethings for evening parties.',
    ],
    [
      'Boho sunset',
      [
        ['Terracotta', '#c8643c'],
        ['Sand', '#e4c99b'],
        ['Sage', '#9caf88'],
      ],
      ['Pampas grass in clay vases', 'Macramé backdrop with fairy lights', 'Low floor seating with cushions'],
      'A warm, Instagram-friendly look that suits cafés and terraces.',
    ],
    [
      'Minimal monochrome',
      [
        ['Black', '#111111'],
        ['White', '#ffffff'],
        ['Gold', '#c9a227'],
      ],
      ['Marquee number lights', 'Black-and-white balloon cluster with gold confetti', 'A simple photo wall'],
      'Clean and modern — looks expensive on a modest budget.',
    ],
  ],
  venue: [
    [
      'Table-top florals',
      [
        ['Blush pink', '#e8b4b8'],
        ['Ivory', '#f6efe2'],
        ['Sage', '#9caf88'],
      ],
      [
        'Fresh blooms in bud vases along the table',
        'Name cards at each seat',
        'A small floral ring behind the cake',
      ],
      'Light touches that suit a café or restaurant without fighting its own look.',
    ],
    [
      'Balloon corner',
      [
        ['Champagne', '#e8d5b5'],
        ['Dusty rose', '#c48b9f'],
        ['White', '#ffffff'],
      ],
      [
        'One balloon cluster in a corner for photos',
        'A cake-topper and candles set',
        'A small “Happy Birthday” sign',
      ],
      'Quick to set up and remove — most cafés allow it.',
    ],
    [
      'Fairy lights & polaroids',
      [
        ['Warm white', '#fff4d6'],
        ['Kraft brown', '#b08968'],
        ['Black', '#111111'],
      ],
      [
        'A string of fairy lights with clipped photos',
        'An instant camera for a guest photo wall',
        'Tea-light candles on the tables',
      ],
      'A cosy, personal look that works in any dine-in space.',
    ],
  ],
  community: [
    [
      'Festive marigold & bunting',
      [
        ['Marigold', '#f2a900'],
        ['Vermilion', '#c1121f'],
        ['Leaf green', '#4f7a28'],
      ],
      [
        'Marigold strings at the entrance and stage',
        'Colourful paper bunting over the stalls',
        'Rangoli at the gate',
      ],
      'The classic, joyful look everyone recognises.',
    ],
    [
      'Eco-friendly earthy',
      [
        ['Bamboo', '#c2b280'],
        ['Jute', '#a68a64'],
        ['Clay', '#b5651d'],
      ],
      ['Bamboo and jute stall frames', 'Earthen diyas and potted plants', 'Reusable cloth banners'],
      'Growing in popularity — low waste and lower cost.',
    ],
    [
      'Lantern lane',
      [
        ['Lantern red', '#b3261e'],
        ['Warm gold', '#e0a526'],
        ['Night blue', '#1f3a5f'],
      ],
      ['Paper lanterns along the walkways', 'Fairy-light canopies over seating', 'A lit stage arch'],
      'Makes an evening event glow and feel special.',
    ],
  ],
  corporate: [
    [
      'Brand-colour minimal',
      [
        ['Navy', '#1e3a5f'],
        ['White', '#ffffff'],
        ['Brand accent', '#0ea5e9'],
      ],
      [
        'Branded stage backdrop and standees',
        'Clean signage for halls and registration',
        'Simple centrepieces in brand colours',
      ],
      'Professional and on-brand — the safest choice for most corporate events.',
    ],
    [
      'Green & wood',
      [
        ['Forest green', '#2f5d50'],
        ['Oak', '#c19a6b'],
        ['Off-white', '#f4efe1'],
      ],
      ['Potted plants instead of cut flowers', 'Wooden signage and name stands', 'Recycled-paper badges'],
      'Sustainable events are a rising trend in Indian corporates.',
    ],
    [
      'Gala night',
      [
        ['Black', '#111111'],
        ['Gold', '#c9a227'],
        ['Deep plum', '#4a1942'],
      ],
      ['Warm uplighting on the walls', 'Gold-accented tables with candles', 'A red-carpet photo wall'],
      'For awards nights and annual days that should feel special.',
    ],
  ],
};

/** Three looks for a single-function event, from the user's colours or current trends. */
export function fallbackLooks(details: EventDetails): DecorLook[] {
  const own = coloursFromText(details.colors);
  const key =
    details.venueType === 'cafe' || details.venueType === 'restaurant'
      ? 'venue'
      : details.eventType === 'birthday'
        ? details.ageGroup === 'kids'
          ? 'kids'
          : 'young'
        : details.eventType === 'corporate'
          ? 'corporate'
          : 'community';
  return TREND_LOOKS[key].map((seed, i) => {
    const base = look(seed);
    // The user's own colours lead the first look.
    return i === 0 && own.length > 0
      ? { ...base, palette: own, why: 'Built around the colours you chose.' }
      : base;
  });
}

/** Deterministic ideas straight from the knowledge base, used when Gemini is unavailable. */
export function fallbackIdeas(details: EventDetails): Ideas {
  const who = details.title || `your ${LABELS[details.eventType]}`;
  const tradition = traditionOf(details);
  const own = coloursFromText(details.colors);
  const ceremonies = ceremoniesFor(details).map((c) => ({
    ceremonyId: c.id,
    theme: c.name,
    palette: own.length > 0 ? own : c.palette,
    decor: c.decor,
  }));
  const style = details.eventType === 'wedding' ? `${tradition.label} ` : '';
  return {
    summary: `A ${style}plan for ${who} in ${details.city} for ${details.guests} guests, built from traditional décor and menus. Change any part to make it yours.`,
    ceremonies,
    menu: defaultMenu(details),
    ...(details.eventType === 'wedding' ? {} : { looks: fallbackLooks(details) }),
    ...EXTRAS[details.eventType],
    source: 'fallback',
  };
}
