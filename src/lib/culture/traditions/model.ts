import type { EventType } from '../../../types.js';

/**
 * Curated cultural knowledge: how each community actually celebrates — the
 * functions in order, their décor, the courses in the order they are served
 * and how the meal is served. The AI personalises *within* these facts (it
 * may pick which Bengali fish dishes to serve) but can never replace them (it
 * cannot turn a seated Bengali biye dinner into a buffet). Every menu the
 * user sees is validated against these lists.
 *
 * Dish costs are rough per-plate estimates for a mid-range metro caterer
 * (INR, 2026). They exist only to fit the menu to the food budget and are
 * always shown as estimates.
 */

export const TRADITIONS = [
  'bengali',
  'punjabi',
  'marwari',
  'gujarati',
  'marathi',
  'tamil',
  'kerala',
  'telugu',
  'muslim',
  'christian',
  'modern',
] as const;
export type TraditionId = (typeof TRADITIONS)[number];

export type DishDiet = 'veg' | 'nonveg';

export interface Dish {
  name: string;
  diet: DishDiet;
  /** Estimated cost per plate in INR. */
  cost: number;
  /** Safe for Jain guests: no onion, garlic or root vegetables. */
  jain?: boolean;
  /** A must-have of this tradition: always served, never swapped out for a pricier dish. */
  signature?: boolean;
}

export interface Course {
  id: string;
  name: string;
  /** How many dishes are usually served from this course: [min, max]. */
  pick: [number, number];
  dishes: Dish[];
  note?: string;
  /** Also served at birthdays, community and corporate events. */
  party?: boolean;
  /** Only for these event types (e.g. the cake at a birthday). */
  onlyFor?: EventType[];
  /** Only added when vegetarian or Jain guests need alternatives. */
  vegAlternative?: boolean;
}

export interface Swatch {
  name: string;
  hex: string;
}

export interface Ceremony {
  id: string;
  name: string;
  /** When it usually happens. */
  when: string;
  about: string;
  palette: Swatch[];
  decor: string[];
  /** What is typically eaten at this function. */
  food: string;
}

export interface Tradition {
  id: TraditionId;
  label: string;
  /** How the wedding meal is served — e.g. "seated, never a buffet". */
  service: string;
  /** Courses in the order they are served. */
  courses: Course[];
  /** Functions in the order they happen. */
  ceremonies: Ceremony[];
  defaultCeremonies: string[];
}

export const v = (name: string, cost: number, jain = false): Dish => ({ name, diet: 'veg', cost, jain });
export const nv = (name: string, cost: number): Dish => ({ name, diet: 'nonveg', cost });
/** Marks a must-have dish. */
export const must = (dish: Dish): Dish => ({ ...dish, signature: true });

export const GOLD: Swatch = { name: 'Gold', hex: '#c9a227' };
export const IVORY: Swatch = { name: 'Ivory', hex: '#f6efe2' };
export const MARIGOLD: Swatch = { name: 'Marigold', hex: '#f2a900' };
export const TURMERIC: Swatch = { name: 'Turmeric yellow', hex: '#e3b505' };
export const LEAF: Swatch = { name: 'Leaf green', hex: '#4f7a28' };
export const VERMILION: Swatch = { name: 'Vermilion red', hex: '#c1121f' };
const BLUSH: Swatch = { name: 'Blush pink', hex: '#e8b4b8' };
const HENNA: Swatch = { name: 'Henna green', hex: '#5f7a2a' };
export const RANI: Swatch = { name: 'Rani pink', hex: '#c2185b' };
export const MAROON: Swatch = { name: 'Maroon', hex: '#7b1e3a' };
export const ORANGE: Swatch = { name: 'Saffron orange', hex: '#f08a24' };
export const TEAL: Swatch = { name: 'Peacock teal', hex: '#0f766e' };
export const WHITE: Swatch = { name: 'White', hex: '#ffffff' };
export const JASMINE: Swatch = { name: 'Jasmine white', hex: '#fbf8ef' };
export const KUMKUM: Swatch = { name: 'Kumkum red', hex: '#a4161a' };
export const EMERALD: Swatch = { name: 'Emerald green', hex: '#1b6b4a' };

export const mehendi = (
  about = 'Henna is applied to the bride’s hands and feet while family sing and dance.',
): Ceremony => ({
  id: 'mehendi',
  name: 'Mehendi',
  when: '1–2 days before the wedding',
  about,
  palette: [HENNA, RANI, MARIGOLD],
  decor: [
    'Floor seating with bolsters and low tables',
    'Mirror-work umbrellas and marigold curtains',
    'A swing (jhoola) or photo nook for the bride',
  ],
  food: 'Chaat counters, kulfi and chilled sherbets — easy to eat with henna on.',
});

export const haldi = (
  name: string,
  about: string,
  id = 'haldi',
  when = 'Morning of or the day before the wedding',
): Ceremony => ({
  id,
  name,
  when,
  about,
  palette: [TURMERIC, MARIGOLD, LEAF],
  decor: [
    'Marigold strings and yellow drapes',
    'Brass urlis with floating flowers',
    'A low seat (patla) with a turmeric bowl set-up',
  ],
  food: 'A light, homely brunch — the heavy feast is saved for the wedding.',
});

export const sangeet = (): Ceremony => ({
  id: 'sangeet',
  name: 'Sangeet',
  when: 'Evening, 1–2 days before',
  about: 'An evening of music and choreographed family performances.',
  palette: [RANI, ORANGE, GOLD],
  decor: [
    'A stage with a dance floor and LED backdrop',
    'Fairy-light canopies',
    'Lounge seating for elders near the stage',
  ],
  food: 'Live counters and finger food that guests can eat between performances.',
});

export const reception = (
  name = 'Reception',
  about = 'The couple greets guests as newly-weds; photos, dinner and music.',
  id = 'reception',
): Ceremony => ({
  id,
  name,
  when: 'After the wedding',
  about,
  palette: [IVORY, GOLD, BLUSH],
  decor: [
    'An elegant stage with a floral backdrop',
    'Tuberose and rose garlands',
    'Warm fairy lights and a photo corner',
  ],
  food: 'The reception dinner — see the menu.',
});

export const engagement = (name: string, about: string, id = 'engagement'): Ceremony => ({
  id,
  name,
  when: 'Weeks or months before the wedding',
  about,
  palette: [RANI, GOLD, IVORY],
  decor: [
    'A flower-decked seat for the couple',
    'Brass thalis with sweets, fruit and gifts',
    'Marigold and mango-leaf toran at the entrance',
  ],
  food: 'Sweets, snacks and a family lunch or dinner.',
});

export const MOCKTAILS = (cost = 90) => v('Mocktail counter', cost, true);
