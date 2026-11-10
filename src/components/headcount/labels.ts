import type { Closeness, Distance, GuestGroup, Occasion, Reply } from '../../lib/headcount';

export const OCCASION_LABELS: Record<Occasion, string> = {
  wedding: 'Wedding',
  'family-function': 'Family function (annaprashan, upanayan, housewarming…)',
  birthday: 'Birthday or anniversary',
  community: 'Community event (puja, society, club)',
  corporate: 'Office or corporate event',
};

/** How the occasion reads inside a sentence. */
export const OCCASION_WORDS: Record<Occasion, string> = {
  wedding: 'wedding',
  'family-function': 'family function',
  birthday: 'celebration',
  community: 'community event',
  corporate: 'office event',
};

export const CLOSENESS_LABELS: Record<Closeness, string> = {
  family: 'Immediate family',
  close: 'Close relatives and friends',
  extended: 'Extended relatives',
  colleague: 'Colleagues and neighbours',
  acquaintance: 'Acquaintances',
};

export const DISTANCE_LABELS: Record<Distance, string> = {
  local: 'Same city',
  nearby: 'A few hours away',
  far: 'Another city or abroad',
};

export const REPLY_LABELS: Record<Reply, string> = {
  'not-asked': 'Not asked yet',
  yes: 'Said yes',
  maybe: 'Said maybe',
  no: 'Said no',
};

type Draft = Omit<GuestGroup, 'id'>;

/** A realistic list to try the forecast with before typing your own. */
export const EXAMPLE_GROUPS: Draft[] = [
  { name: 'Our own household', people: 6, closeness: 'family', distance: 'local', reply: 'yes' },
  { name: 'Mama’s family', people: 5, closeness: 'close', distance: 'local', reply: 'yes' },
  { name: 'Pishi’s family, Siliguri', people: 4, closeness: 'close', distance: 'nearby', reply: 'maybe' },
  { name: 'Cousins in Bengaluru', people: 6, closeness: 'close', distance: 'far', reply: 'not-asked' },
  { name: 'Other relatives', people: 90, closeness: 'extended', distance: 'local', reply: 'not-asked' },
  { name: 'Para neighbours', people: 60, closeness: 'colleague', distance: 'local', reply: 'not-asked' },
  { name: 'Baba’s office', people: 40, closeness: 'colleague', distance: 'local', reply: 'not-asked' },
  { name: 'Friends from college', people: 25, closeness: 'close', distance: 'local', reply: 'not-asked' },
  {
    name: 'Old family friends',
    people: 14,
    closeness: 'acquaintance',
    distance: 'nearby',
    reply: 'not-asked',
  },
];
