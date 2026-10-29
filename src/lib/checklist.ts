import type { EventType, VendorGroup } from '../types.js';

type GroupSpec = Omit<VendorGroup, 'items'> & { tasks: string[] };

const COMMON_CATERER: GroupSpec = {
  id: 'caterer',
  vendor: 'Caterer',
  searchTerm: 'caterers',
  tasks: [
    'Shortlist 3 caterers and compare per-plate quotes',
    'Do a tasting session',
    'Confirm veg / Jain / allergy-friendly options',
    'Sign contract and pay the advance',
  ],
};

const CHECKLIST_TEMPLATES: Record<EventType, GroupSpec[]> = {
  wedding: [
    {
      id: 'venue',
      vendor: 'Venue',
      searchTerm: 'wedding venues',
      tasks: [
        'Visit at least 3 venues',
        'Check capacity, parking and power backup',
        'Confirm decor and noise restrictions',
        'Sign the booking agreement',
      ],
    },
    COMMON_CATERER,
    {
      id: 'decorator',
      vendor: 'Decorator',
      searchTerm: 'wedding decorators',
      tasks: ['Share mood board', 'Approve mandap / stage design', 'Confirm flowers and lighting'],
    },
    {
      id: 'photographer',
      vendor: 'Photographer & videographer',
      searchTerm: 'wedding photographers',
      tasks: [
        'Review full albums, not highlights',
        'Agree on deliverables and timelines',
        'Share the shot list',
      ],
    },
    {
      id: 'makeup',
      vendor: 'Makeup artist',
      searchTerm: 'bridal makeup artists',
      tasks: ['Book a trial session', 'Confirm the schedule for all functions'],
    },
    {
      id: 'music',
      vendor: 'DJ / band / mehendi artist',
      searchTerm: 'wedding DJ',
      tasks: ['Book DJ or band', 'Book mehendi artist', 'Share the song list'],
    },
  ],
  birthday: [
    {
      id: 'venue',
      vendor: 'Venue',
      searchTerm: 'party halls',
      tasks: ['Compare 2–3 party venues or plan the home layout', 'Confirm timings and setup access'],
    },
    {
      id: 'bakery',
      vendor: 'Bakery',
      searchTerm: 'custom cake bakery',
      tasks: ['Choose cake design and flavour', 'Confirm eggless / allergy needs', 'Schedule delivery time'],
    },
    COMMON_CATERER,
    {
      id: 'decor',
      vendor: 'Decor & balloons',
      searchTerm: 'birthday decoration services',
      tasks: ['Pick a colour palette', 'Order balloons, banner and backdrop'],
    },
    {
      id: 'entertainment',
      vendor: 'Entertainer',
      searchTerm: 'birthday party entertainers',
      tasks: ['Book magician, games host or DJ', 'Plan 3 age-appropriate games'],
    },
  ],
  community: [
    {
      id: 'venue',
      vendor: 'Venue & permissions',
      searchTerm: 'community halls',
      tasks: [
        'Book venue or park space',
        'Get police / municipal permission if required',
        'Confirm toilets, water and accessibility',
      ],
    },
    {
      id: 'sound',
      vendor: 'Sound & stage',
      searchTerm: 'sound and stage rental',
      tasks: ['Book PA system and stage', 'Plan a sound check slot', 'Arrange generator backup'],
    },
    { ...COMMON_CATERER, vendor: 'Food stalls / caterer', searchTerm: 'event caterers' },
    {
      id: 'rentals',
      vendor: 'Tents, chairs & rentals',
      searchTerm: 'tent house',
      tasks: ['Order chairs, tables and shade', 'Arrange ramps and seating for elders'],
    },
    {
      id: 'safety',
      vendor: 'Safety & cleanup',
      searchTerm: 'first aid services',
      tasks: [
        'Arrange first-aid volunteer and kit',
        'Place dustbins and segregate waste',
        'Share emergency contacts',
      ],
    },
  ],
};

/** Builds the vendor checklist with stable ids so progress can be persisted. */
export function buildChecklist(eventType: EventType): VendorGroup[] {
  return CHECKLIST_TEMPLATES[eventType].map(({ tasks, ...group }) => ({
    ...group,
    items: tasks.map((task, i) => ({ id: `${group.id}-${i}`, task })),
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
