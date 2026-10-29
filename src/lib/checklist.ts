import type { EventType, VendorAdvice, VendorEntry, VendorGroup } from '../types.js';

interface GroupSpec {
  id: string;
  vendor: string;
  searchTerm: string;
  budgetId: string;
  tasks: string[];
  /** Curated questions used when AI advice is unavailable. */
  questions: string[];
}

const COMMON_CATERER: GroupSpec = {
  id: 'caterer',
  vendor: 'Caterer',
  searchTerm: 'caterers',
  budgetId: 'catering',
  tasks: [
    'Shortlist 3 caterers and compare per-plate quotes',
    'Do a tasting session',
    'Confirm veg / Jain / allergy-friendly options',
    'Sign contract and pay the advance',
  ],
  questions: [
    'What is the per-plate price, and what is the minimum guaranteed headcount?',
    'Are serving staff, crockery and taxes included in the quote?',
    'How late can we change the final headcount?',
  ],
};

const CHECKLIST_TEMPLATES: Record<EventType, GroupSpec[]> = {
  wedding: [
    {
      id: 'venue',
      vendor: 'Venue',
      searchTerm: 'wedding venues',
      budgetId: 'venue',
      tasks: [
        'Visit at least 3 venues',
        'Check capacity, parking and power backup',
        'Confirm decor and noise restrictions',
        'Sign the booking agreement',
      ],
      questions: [
        'Is the date confirmed in writing, and what is the cancellation policy?',
        'Are outside caterers and decorators allowed?',
        'What time do we get access for setup, and when must we leave?',
      ],
    },
    COMMON_CATERER,
    {
      id: 'decorator',
      vendor: 'Decorator',
      searchTerm: 'wedding decorators',
      budgetId: 'decor',
      tasks: ['Share mood board', 'Approve mandap / stage design', 'Confirm flowers and lighting'],
      questions: [
        'Can we see photos of a setup at our venue?',
        'Which flowers are in season and which are imported?',
        'Is dismantling included?',
      ],
    },
    {
      id: 'photographer',
      vendor: 'Photographer & videographer',
      searchTerm: 'wedding photographers',
      budgetId: 'photo',
      tasks: [
        'Review full albums, not highlights',
        'Agree on deliverables and timelines',
        'Share the shot list',
      ],
      questions: [
        'How many photographers cover each function?',
        'When will we get edited photos and the film?',
        'Are raw files and travel costs included?',
      ],
    },
    {
      id: 'makeup',
      vendor: 'Makeup artist',
      searchTerm: 'bridal makeup artists',
      budgetId: 'attire',
      tasks: ['Book a trial session', 'Confirm the schedule for all functions'],
      questions: ['Which products do you use for long wear?', 'Is a trial included in the price?'],
    },
    {
      id: 'music',
      vendor: 'DJ / band / mehendi artist',
      searchTerm: 'wedding DJ',
      budgetId: 'entertainment',
      tasks: ['Book DJ or band', 'Book mehendi artist', 'Share the song list'],
      questions: ['Is sound equipment included?', 'What happens if we need to extend the timing?'],
    },
  ],
  birthday: [
    {
      id: 'venue',
      vendor: 'Venue',
      searchTerm: 'party halls',
      budgetId: 'venue',
      tasks: ['Compare 2–3 party venues or plan the home layout', 'Confirm timings and setup access'],
      questions: ['How many hours are included?', 'Can we bring our own cake and decorations?'],
    },
    {
      id: 'bakery',
      vendor: 'Bakery',
      searchTerm: 'custom cake bakery',
      budgetId: 'catering',
      tasks: ['Choose cake design and flavour', 'Confirm eggless / allergy needs', 'Schedule delivery time'],
      questions: ['What size feeds our guest count?', 'Is delivery included, and at what time?'],
    },
    COMMON_CATERER,
    {
      id: 'decor',
      vendor: 'Decor & balloons',
      searchTerm: 'birthday decoration services',
      budgetId: 'decor',
      tasks: ['Pick a colour palette', 'Order balloons, banner and backdrop'],
      questions: ['How long does setup take?', 'Are the materials reusable or recyclable?'],
    },
    {
      id: 'entertainment',
      vendor: 'Entertainer',
      searchTerm: 'birthday party entertainers',
      budgetId: 'entertainment',
      tasks: ['Book magician, games host or DJ', 'Plan 3 age-appropriate games'],
      questions: ['What age group is your act best for?', 'How long is the performance?'],
    },
  ],
  community: [
    {
      id: 'venue',
      vendor: 'Venue & permissions',
      searchTerm: 'community halls',
      budgetId: 'venue',
      tasks: [
        'Book venue or park space',
        'Get police / municipal permission if required',
        'Confirm toilets, water and accessibility',
      ],
      questions: [
        'Which permissions do we need, and who applies?',
        'Is there wheelchair access and parking?',
      ],
    },
    {
      id: 'sound',
      vendor: 'Sound & stage',
      searchTerm: 'sound and stage rental',
      budgetId: 'stage',
      tasks: ['Book PA system and stage', 'Plan a sound check slot', 'Arrange generator backup'],
      questions: ['Is an operator included for the whole event?', 'What are the noise-limit rules here?'],
    },
    { ...COMMON_CATERER, vendor: 'Food stalls / caterer', searchTerm: 'event caterers' },
    {
      id: 'rentals',
      vendor: 'Tents, chairs & rentals',
      searchTerm: 'tent house',
      budgetId: 'supplies',
      tasks: ['Order chairs, tables and shade', 'Arrange ramps and seating for elders'],
      questions: ['Are delivery, setup and pickup included?', 'What is charged for damage?'],
    },
    {
      id: 'safety',
      vendor: 'Safety & cleanup',
      searchTerm: 'first aid services',
      budgetId: 'safety',
      tasks: [
        'Arrange first-aid volunteer and kit',
        'Place dustbins and segregate waste',
        'Share emergency contacts',
      ],
      questions: ['Who handles waste segregation and pickup?', 'Is a trained first-aider on site?'],
    },
  ],
};

/** Vendor group ids and names for an event type (used to steer the AI). */
export function vendorGroupsFor(eventType: EventType): { id: string; vendor: string }[] {
  return CHECKLIST_TEMPLATES[eventType].map(({ id, vendor }) => ({ id, vendor }));
}

/** Curated advice per vendor group, used when Gemini is unavailable. */
export function fallbackVendorAdvice(eventType: EventType): Record<string, VendorAdvice> {
  return Object.fromEntries(
    CHECKLIST_TEMPLATES[eventType].map((g) => [g.id, { questions: g.questions, tasks: [] }]),
  );
}

/**
 * Builds the vendor checklist with stable ids so progress can be persisted.
 * AI-suggested tasks (if any) are appended and marked so users can tell them apart.
 */
export function buildChecklist(
  eventType: EventType,
  advice: Record<string, VendorAdvice> = {},
): VendorGroup[] {
  return CHECKLIST_TEMPLATES[eventType].map(({ tasks, questions: _questions, ...group }) => ({
    ...group,
    items: [
      ...tasks.map((task, i) => ({ id: `${group.id}-${i}`, task })),
      ...(advice[group.id]?.tasks ?? []).map((task, i) => ({ id: `${group.id}-ai-${i}`, task, ai: true })),
    ],
  }));
}

/** Google Maps search link for finding vendors near the event city. */
export function mapsSearchUrl(searchTerm: string, city: string): string {
  const query = encodeURIComponent(`${searchTerm} in ${city}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function checklistProgress(groups: VendorGroup[], done: Record<string, boolean>): number {
  const ids = groups.flatMap((g) => g.items.map((i) => i.id));
  if (ids.length === 0) return 0;
  return Math.round((ids.filter((id) => done[id]).length / ids.length) * 100);
}

export interface QuoteSummary {
  count: number;
  /** Lowest non-zero quote, or 0 when nothing has been quoted. */
  lowest: number;
  confirmed?: VendorEntry;
}

/** Summarises the user's vendor records for one group, to compare against the budget. */
export function summariseQuotes(entries: VendorEntry[], groupId: string): QuoteSummary {
  const mine = entries.filter((e) => e.groupId === groupId);
  const quotes = mine.map((e) => e.quote).filter((q) => q > 0);
  return {
    count: mine.length,
    lowest: quotes.length > 0 ? Math.min(...quotes) : 0,
    confirmed: mine.find((e) => e.status === 'confirmed'),
  };
}
