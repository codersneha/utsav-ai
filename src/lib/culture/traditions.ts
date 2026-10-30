import type { EventType } from '../../types.js';
import type { PhotoKey } from './photos.js';

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
  /** A décor photo of this kind of function, shown only when it fits the plan. */
  photo?: PhotoKey;
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

const v = (name: string, cost: number, jain = false): Dish => ({ name, diet: 'veg', cost, jain });
const nv = (name: string, cost: number): Dish => ({ name, diet: 'nonveg', cost });
/** Marks a must-have dish. */
const must = (dish: Dish): Dish => ({ ...dish, signature: true });

const GOLD: Swatch = { name: 'Gold', hex: '#c9a227' };
const IVORY: Swatch = { name: 'Ivory', hex: '#f6efe2' };
const MARIGOLD: Swatch = { name: 'Marigold', hex: '#f2a900' };
const TURMERIC: Swatch = { name: 'Turmeric yellow', hex: '#e3b505' };
const LEAF: Swatch = { name: 'Leaf green', hex: '#4f7a28' };
const VERMILION: Swatch = { name: 'Vermilion red', hex: '#c1121f' };
const BLUSH: Swatch = { name: 'Blush pink', hex: '#e8b4b8' };
const HENNA: Swatch = { name: 'Henna green', hex: '#5f7a2a' };
const RANI: Swatch = { name: 'Rani pink', hex: '#c2185b' };
const MAROON: Swatch = { name: 'Maroon', hex: '#7b1e3a' };
const ORANGE: Swatch = { name: 'Saffron orange', hex: '#f08a24' };
const TEAL: Swatch = { name: 'Peacock teal', hex: '#0f766e' };
const WHITE: Swatch = { name: 'White', hex: '#ffffff' };
const JASMINE: Swatch = { name: 'Jasmine white', hex: '#fbf8ef' };
const KUMKUM: Swatch = { name: 'Kumkum red', hex: '#a4161a' };
const EMERALD: Swatch = { name: 'Emerald green', hex: '#1b6b4a' };

const mehendi = (
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

const haldi = (
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
  photo: 'haldi',
});

const sangeet = (): Ceremony => ({
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

const reception = (
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
  photo: 'reception',
});

const engagement = (name: string, about: string, id = 'engagement'): Ceremony => ({
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

const MOCKTAILS = (cost = 90) => v('Mocktail counter', cost, true);

export const TRADITION_DATA: Record<TraditionId, Tradition> = {
  bengali: {
    id: 'bengali',
    label: 'Bengali',
    service:
      'Seated and served course by course — guests are served at the table, often on banana-leaf plates, as a mark of respect. Never a buffet. Starters are served from street-food stalls before dinner.',
    courses: [
      {
        id: 'starters',
        name: 'Street-food stalls',
        pick: [2, 4],
        note: 'Served from stalls while guests arrive',
        party: true,
        dishes: [
          must(v('Phuchka', 40)),
          must(nv('Fish fry', 140)),
          v('Papri chaat', 50),
          v('Ghugni', 35, true),
          v('Mochar chop', 45),
          v('Vegetable chop', 40),
          nv('Fish kabiraji', 160),
        ],
      },
      {
        id: 'first',
        name: 'First course',
        pick: [1, 1],
        dishes: [
          v('Luchi with aloor dom', 70),
          v('Radhaballabhi with chholar dal', 80, true),
          v('Kochuri with chholar dal', 75, true),
          v('Kochuri with aloor dom', 75),
        ],
      },
      {
        id: 'rice',
        name: 'Rice & dal',
        pick: [1, 1],
        dishes: [
          nv('Rice with muri ghonto', 90),
          v('Rice with moong dal and jhuri aloo bhaja', 60),
          v('Rice with sona moong dal', 55, true),
        ],
      },
      {
        id: 'mains',
        name: 'Fish & meat',
        pick: [2, 3],
        note: 'Two is usual; grand weddings serve three',
        party: true,
        dishes: [
          nv('Katla kalia', 140),
          nv('Chicken kosha', 140),
          nv('Doi katla', 150),
          nv('Bhetki macher paturi', 220),
          nv('Mutton kosha', 260),
          nv('Chingri macher malai curry', 300),
          nv('Shorshe ilish', 450),
        ],
      },
      {
        id: 'veg-mains',
        name: 'Vegetarian mains',
        pick: [1, 2],
        vegAlternative: true,
        party: true,
        dishes: [
          v('Mochar ghonto', 80),
          v('Dhokar dalna', 90),
          v('Echor dalna', 100),
          v('Potoler dolma', 100, true),
          v('Chhanar dalna', 110),
        ],
      },
      {
        id: 'polao',
        name: 'Polao',
        pick: [1, 1],
        dishes: [v('Ghee bhaat', 55, true), v('Basanti polao', 70, true)],
      },
      {
        id: 'chutney',
        name: 'Chutney & papad',
        pick: [1, 1],
        dishes: [
          v('Aamer chutney', 20, true),
          v('Tomato-khejur chutney', 20, true),
          v('Khejur-aamshotto chutney', 25, true),
          v('Plastic chutney (raw papaya)', 25, true),
        ],
      },
      {
        id: 'doi',
        name: 'Doi',
        pick: [1, 1],
        dishes: [must(v('Mishti doi', 35, true)), v('Tok-mishti doi', 35, true)],
      },
      {
        id: 'mishti',
        name: 'Mishti',
        pick: [1, 2],
        party: true,
        dishes: [
          must(v('Rosogolla (white or baked)', 40, true)),
          v('Langcha', 40, true),
          v('Sandesh (makha or kancha golla)', 45, true),
          v('Nolen gur ice cream (winter special)', 70, true),
          v('Baked mihidana with rabri', 70, true),
        ],
      },
      { id: 'finish', name: 'To finish', pick: [1, 1], dishes: [v('Mishti paan', 25, true)] },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 2],
        note: 'Bengali-themed drinks, or a mocktail counter for a contemporary feel',
        party: true,
        dishes: [
          v('Aam pora shorbot', 35, true),
          v('Gondhoraj ghol', 35, true),
          v('Daab (tender coconut) shorbot', 60, true),
          MOCKTAILS(),
        ],
      },
    ],
    ceremonies: [
      {
        id: 'aiburobhat',
        name: 'Aiburobhat',
        when: 'A few days before the wedding',
        about: 'The family’s feast for the bride or groom — their last meal as unmarried, served with love.',
        palette: [{ name: 'Alta red', hex: '#b3001b' }, { name: 'Bell-metal gold', hex: '#b8892c' }, LEAF],
        decor: [
          'Kansa (bell-metal) thala and bati for the meal',
          'Alpana drawn around a decorated low seat (pidi)',
          'Hand-held palm fans and a fresh banana-leaf setting',
        ],
        food: 'A grand home-style meal: rice, fish-head dal, five fries, fish and payesh.',
        photo: 'aiburobhat',
      },
      {
        id: 'gaye-holud',
        name: 'Gaye Holud',
        when: 'Morning of the wedding',
        about:
          'Turmeric is applied first at the groom’s home, then the same turmeric is carried to the bride with the tattva (gifts).',
        palette: [TURMERIC, MARIGOLD, LEAF],
        decor: [
          'Marigold and rajanigandha strings',
          'Terracotta pots, a brass ghot and alpana on the floor',
          'Kula (winnowing trays) holding turmeric and the tattva gifts',
        ],
        food: 'Light: luchi with chholar dal or aloor dom and sweets (after the dodhi-mongol with curd and chira at dawn).',
      },
      {
        id: 'biye',
        name: 'Biye (wedding night)',
        when: 'Evening, at the auspicious lagna',
        about: 'Shubho Drishti, Saat Paak, Mala Bodol, Sampradan and Sindoor Daan under the chhadnatola.',
        palette: [VERMILION, IVORY, GOLD],
        decor: [
          'Chhadnatola with banana plants at the four corners',
          'White shola-pith topor, mukut and decorations',
          'Red-and-white alpana, mango leaves and terracotta prodip lamps',
        ],
        food: 'The full seated wedding dinner — see the menu.',
      },
      reception(
        'Bou Bhaat (reception)',
        'At the groom’s home the new bride serves rice to the family; the reception for guests follows.',
        'bou-bhaat',
      ),
      mehendi('Not a traditional Bengali ritual, but many families now add a mehendi evening.'),
    ],
    defaultCeremonies: ['aiburobhat', 'gaye-holud', 'biye', 'bou-bhaat'],
  },

  punjabi: {
    id: 'punjabi',
    label: 'Punjabi',
    service:
      'A lavish buffet with live counters — tandoor, chaat and dessert counters are expected. After a Sikh Anand Karaj in the morning, guests are served breakfast or a langar-style lunch.',
    courses: [
      {
        id: 'chaat',
        name: 'Chaat counter',
        pick: [1, 2],
        party: true,
        dishes: [
          must(v('Golgappe', 40)),
          v('Papdi chaat', 45),
          v('Dahi bhalla', 45, true),
          v('Aloo tikki chaat', 50),
        ],
      },
      {
        id: 'starters',
        name: 'Tandoor starters',
        pick: [2, 4],
        party: true,
        dishes: [
          v('Hara bhara kebab', 70),
          v('Tandoori soya chaap', 90),
          v('Paneer tikka', 110),
          nv('Chicken tikka', 150),
          nv('Amritsari fish', 180),
          nv('Mutton seekh kebab', 200),
        ],
      },
      {
        id: 'mains',
        name: 'Mains',
        pick: [3, 5],
        party: true,
        dishes: [
          v('Amritsari chole', 60),
          must(v('Dal makhani', 70)),
          v('Sarson da saag with makki di roti (winter)', 90),
          v('Malai kofta', 100),
          v('Kadhai paneer', 110),
          nv('Butter chicken', 170),
          nv('Rara mutton', 260),
        ],
      },
      {
        id: 'breads',
        name: 'Breads',
        pick: [2, 3],
        dishes: [
          v('Tandoori roti', 20),
          v('Butter naan', 30),
          v('Lachha paratha', 35),
          v('Amritsari kulcha', 45),
        ],
      },
      {
        id: 'rice',
        name: 'Rice',
        pick: [1, 1],
        dishes: [v('Jeera rice', 35), v('Veg pulao', 45), nv('Mutton biryani', 220)],
      },
      {
        id: 'desserts',
        name: 'Desserts',
        pick: [2, 3],
        party: true,
        dishes: [
          v('Gulab jamun', 35),
          v('Phirni', 45),
          v('Gajar ka halwa (winter)', 60),
          v('Jalebi with rabri', 60),
          v('Moong dal halwa', 65),
          v('Kulfi falooda', 70),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 2],
        party: true,
        dishes: [v('Shikanji', 30), v('Masala chaas', 30), v('Patiala lassi', 50), MOCKTAILS()],
      },
    ],
    ceremonies: [
      engagement(
        'Roka',
        'The families formally accept the match with gifts, sweets and a small prayer.',
        'roka',
      ),
      {
        id: 'chunni',
        name: 'Chunni Chadana',
        when: 'Before the wedding, often with the engagement',
        about: 'The groom’s family drapes a red chunni over the bride’s head and gifts her jewellery.',
        palette: [MAROON, GOLD, RANI],
        decor: [
          'A phulkari-draped seat for the bride',
          'Trays of gifts on embroidered cloth',
          'Red and gold accents with marigold strings',
        ],
        food: 'Sweets and a family meal.',
      },
      mehendi(),
      sangeet(),
      {
        id: 'jaggo',
        name: 'Jaggo',
        when: 'The night before the wedding',
        about:
          'Relatives carry a decorated brass pot (jaggo) of lit diyas on the head, dancing through the neighbourhood singing boliyan.',
        palette: [ORANGE, RANI, GOLD],
        decor: [
          'A brass gaagar topped with clay diyas',
          'Phulkari dupattas as drapes',
          'A dhol corner and string lights along the route',
        ],
        food: 'Late-night snacks, chai and pakoras.',
      },
      haldi(
        'Maiyan (vatna)',
        'Married women apply vatna — turmeric, flour and mustard oil — while singing, a day or two before the wedding.',
        'maiyan',
      ),
      {
        id: 'choora',
        name: 'Choora & Kaleere',
        when: 'Morning of the wedding',
        about:
          'The bride’s maternal uncle gives her red-and-ivory choora bangles; friends tie on golden kaleere.',
        palette: [MAROON, IVORY, GOLD],
        decor: [
          'A low seat with a phulkari spread',
          'A thali with the choora soaked in milk',
          'A hanging kaleere backdrop for photos',
        ],
        food: 'Breakfast — puri, chole and sweets.',
      },
      {
        id: 'wedding',
        name: 'Anand Karaj or Pheras',
        when: 'Morning (Anand Karaj) or evening (pheras)',
        about:
          'Sikh couples walk four laavan around the Guru Granth Sahib in the morning; Hindu Punjabi weddings take seven pheras around the fire, usually at night.',
        palette: [RANI, GOLD, IVORY],
        decor: [
          'A floral canopy over the palki sahib or the mandap',
          'A rose-petal path for the baraat entry',
          'Marigold and rose strings at the entrance',
        ],
        food: 'The wedding feast — after an Anand Karaj, breakfast or a langar-style lunch.',
        photo: 'pheras',
      },
      reception(),
    ],
    defaultCeremonies: ['mehendi', 'sangeet', 'maiyan', 'choora', 'wedding', 'reception'],
  },

  marwari: {
    id: 'marwari',
    label: 'Marwari / Rajasthani',
    service:
      'A grand buffet, or a seated pangat served on thalis for traditional families. Largely vegetarian, and many guests need Jain food — no onion, garlic or root vegetables.',
    courses: [
      {
        id: 'starters',
        name: 'Starters',
        pick: [2, 3],
        party: true,
        dishes: [
          v('Kanji vada', 30, true),
          v('Mirchi vada', 35),
          v('Pyaaz kachori', 40),
          v('Moong dal kachori', 40, true),
          v('Dal pakwan', 45, true),
        ],
      },
      {
        id: 'mains',
        name: 'Mains',
        pick: [3, 5],
        party: true,
        dishes: [
          v('Rajasthani kadhi', 40, true),
          v('Panchmel dal', 50, true),
          v('Papad ki sabzi', 50, true),
          v('Gatte ki sabzi', 70, true),
          v('Ker sangri', 90, true),
          must(v('Dal baati churma', 90, true)),
          v('Paneer tikka masala', 110),
        ],
      },
      {
        id: 'breads',
        name: 'Breads',
        pick: [1, 2],
        dishes: [v('Puri', 25, true), v('Missi roti', 25, true), v('Bajre ki roti', 25, true)],
      },
      {
        id: 'rice',
        name: 'Rice',
        pick: [0, 1],
        dishes: [v('Jeera rice', 35, true), v('Rajasthani pulao', 45, true)],
      },
      {
        id: 'desserts',
        name: 'Sweets',
        pick: [2, 3],
        party: true,
        dishes: [
          v('Balushahi', 35, true),
          v('Churma ladoo', 40, true),
          v('Moong dal halwa', 65, true),
          v('Malpua with rabri', 70, true),
          v('Ghevar', 80, true),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 2],
        party: true,
        dishes: [v('Chaas', 25, true), v('Kesar thandai', 55, true), MOCKTAILS()],
      },
    ],
    ceremonies: [
      engagement(
        'Tilak',
        'Men of the bride’s family visit the groom’s home to apply tilak and give gifts.',
        'tilak',
      ),
      haldi(
        'Pithi Dastoor',
        'Women apply pithi — turmeric and sandalwood paste. After it, the bride or groom stays at home until the wedding.',
        'pithi',
        'Two or three days before the wedding',
      ),
      mehendi(),
      {
        id: 'mayra',
        name: 'Mayra (Bhaat)',
        when: 'A day or two before the wedding',
        about:
          'The maternal family (nanihal) arrives with clothes, jewellery and gifts and is welcomed with songs.',
        palette: [ORANGE, MAROON, GOLD],
        decor: [
          'A welcome arch with bandhani drapes and marigolds',
          'Display tables for the mayra gifts',
          'Seating for the nanihal family',
        ],
        food: 'A family lunch — dal baati churma is a favourite.',
      },
      {
        id: 'mahira',
        name: 'Mahira Dastoor',
        when: 'A day before',
        about: 'The maternal uncle brings gifts for the family; a joyful family ritual.',
        palette: [ORANGE, MAROON, GOLD],
        decor: ['Bandhani drapes', 'Brass thalis for the gifts', 'Rajasthani puppets and lanterns'],
        food: 'Rajasthani snacks and sweets.',
      },
      sangeet(),
      {
        id: 'nikasi',
        name: 'Nikasi (baraat)',
        when: 'Evening of the wedding',
        about: 'After the sehra-bandi, the groom rides a decorated mare (ghodi) with the baraat.',
        palette: [ORANGE, RANI, GOLD],
        decor: [
          'A decorated ghodi and a band',
          'A safa (turban) station for the baraatis',
          'Mashaal lights along the procession route',
        ],
        food: 'Welcome drinks and snacks for the baraat.',
      },
      {
        id: 'wedding',
        name: 'Phere',
        when: 'Late evening or night, at the muhurat',
        about: 'Varmala, kanyadaan and seven pheras around the sacred fire in a decorated mandap.',
        palette: [RANI, ORANGE, GOLD],
        decor: [
          'A mandap with Rajasthani jharokha arches',
          'A marigold and rose canopy',
          'Brass lamps and rangoli',
        ],
        food: 'The wedding feast — see the menu.',
        photo: 'mandap',
      },
      reception(),
    ],
    defaultCeremonies: ['pithi', 'mehendi', 'mayra', 'sangeet', 'wedding', 'reception'],
  },

  gujarati: {
    id: 'gujarati',
    label: 'Gujarati',
    service:
      'A buffet or a seated Gujarati thali — almost always vegetarian, with Jain options. Farsan and a sweet are eaten with the meal, not only at the end.',
    courses: [
      {
        id: 'farsan',
        name: 'Farsan',
        pick: [2, 3],
        party: true,
        dishes: [
          must(v('Khaman dhokla', 25, true)),
          v('Handvo', 30, true),
          v('Khandvi', 30, true),
          v('Patra', 30, true),
          v('Lilva kachori', 40, true),
        ],
      },
      {
        id: 'shaak',
        name: 'Shaak (vegetables)',
        pick: [2, 4],
        party: true,
        dishes: [
          v('Sev tameta nu shaak', 40, true),
          v('Bharela ringan', 50, true),
          v('Lilva tuver nu shaak', 50, true),
          v('Paneer lababdar', 90),
          v('Undhiyu (winter)', 90),
        ],
      },
      {
        id: 'dal-kadhi',
        name: 'Dal & kadhi',
        pick: [1, 2],
        dishes: [v('Gujarati dal', 25, true), v('Gujarati kadhi', 25, true)],
      },
      {
        id: 'breads',
        name: 'Breads',
        pick: [1, 2],
        dishes: [v('Rotli', 15, true), v('Puri', 20, true), v('Bajra rotla', 20, true)],
      },
      {
        id: 'rice',
        name: 'Rice',
        pick: [1, 1],
        dishes: [v('Jeera rice', 30, true), v('Vaghareli khichdi', 30, true), v('Veg pulao', 40, true)],
      },
      {
        id: 'sweets',
        name: 'Sweets',
        pick: [1, 2],
        party: true,
        dishes: [
          v('Jalebi', 35, true),
          v('Mohanthal', 45, true),
          v('Shrikhand', 50, true),
          v('Doodh pak', 50, true),
          v('Basundi', 55, true),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 2],
        party: true,
        dishes: [v('Chaas', 20, true), v('Variyali sharbat', 30, true), MOCKTAILS()],
      },
    ],
    ceremonies: [
      engagement(
        'Gol Dhana',
        'The engagement: jaggery (gol) and coriander seeds (dhana) are shared to seal the match.',
        'gol-dhana',
      ),
      {
        id: 'mandvo',
        name: 'Mandvo Mahurat',
        when: 'A few days before',
        about: 'A puja to bless the mandap before the festivities begin.',
        palette: [MARIGOLD, LEAF, VERMILION],
        decor: ['Mango-leaf torans', 'A kalash and diyas', 'Rangoli at the entrance'],
        food: 'A simple family lunch.',
      },
      haldi(
        'Pithi',
        'Turmeric and sandalwood pithi is applied to the bride and groom at their homes.',
        'pithi',
      ),
      mehendi(),
      {
        id: 'garba',
        name: 'Garba & Dandiya Raas',
        when: 'Evening before the wedding',
        about: 'Family and friends dance garba around a lamp and play raas with dandiya sticks.',
        palette: [RANI, ORANGE, TEAL],
        decor: [
          'A central garbo (lit pot) with space to dance around it',
          'Mirror-work and bandhani drapes',
          'Coloured dandiya sticks for every guest',
        ],
        food: 'Snacks, chaat and drinks for dancers — farsan and chaas.',
      },
      {
        id: 'mameru',
        name: 'Mameru',
        when: 'A day before the wedding',
        about: 'The bride’s maternal uncle brings the panetar sari, jewellery and gifts.',
        palette: [WHITE, VERMILION, GOLD],
        decor: [
          'A display of the mameru gifts on brass trays',
          'Red-and-white panetar-inspired drapes',
          'Seating for the maternal family',
        ],
        food: 'A family meal.',
      },
      {
        id: 'wedding',
        name: 'Hasta Melap & Mangal Fera',
        when: 'At the muhurat',
        about:
          'The groom is welcomed with ponkhvu, then the couple’s hands are joined (hasta melap) and they take four mangal feras.',
        palette: [VERMILION, WHITE, GOLD],
        decor: [
          'A mandap with banana plants and mango leaves',
          'Marigold and rose strings',
          'Brass diyas and rangoli',
        ],
        food: 'The wedding thali or buffet — see the menu.',
        photo: 'mandap',
      },
      reception(),
    ],
    defaultCeremonies: ['mandvo', 'pithi', 'mehendi', 'garba', 'wedding', 'reception'],
  },

  marathi: {
    id: 'marathi',
    label: 'Marathi',
    service:
      'Traditionally a seated pangat on banana leaves or thalis, served in order: koshimbir, chutney and bhaji on the leaf, then varan-bhaat with ghee and lemon, masale bhaat, puris and the sweet, with mattha to finish. Many weddings now add a buffet.',
    courses: [
      {
        id: 'starters',
        name: 'Snacks',
        pick: [0, 2],
        note: 'Only at modern weddings; not part of the pangat',
        party: true,
        dishes: [v('Batata vada', 25), v('Kothimbir vadi', 30), v('Alu vadi', 30), v('Sabudana vada', 35)],
      },
      {
        id: 'leaf',
        name: 'On the leaf',
        pick: [2, 4],
        party: true,
        dishes: [
          v('Chutney', 10, true),
          v('Koshimbir', 15, true),
          v('Batata bhaji', 25),
          v('Matki usal', 30),
          v('Bharli vangi', 45),
        ],
      },
      {
        id: 'varan-bhaat',
        name: 'Varan-bhaat',
        pick: [1, 1],
        dishes: [must(v('Varan bhaat with ghee and lemon', 30, true))],
      },
      {
        id: 'masale-bhaat',
        name: 'Masale bhaat',
        pick: [1, 1],
        dishes: [v('Masale bhaat', 45), v('Vangi bhaat', 45)],
      },
      {
        id: 'breads',
        name: 'Puris & polis',
        pick: [1, 2],
        dishes: [v('Chapati', 15, true), v('Puri', 20, true)],
      },
      {
        id: 'sweets',
        name: 'Sweets',
        pick: [1, 2],
        party: true,
        dishes: [
          must(v('Jilebi', 35, true)),
          v('Puran poli with ghee', 45, true),
          v('Shrikhand or amrakhand', 50, true),
          v('Ukadiche modak', 50, true),
          v('Basundi', 55, true),
        ],
      },
      {
        id: 'finish',
        name: 'To finish',
        pick: [1, 1],
        dishes: [must(v('Mattha (spiced buttermilk)', 20, true)), v('Sol kadhi', 25, true)],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [0, 1],
        party: true,
        dishes: [v('Panha (raw mango)', 30, true), MOCKTAILS()],
      },
    ],
    ceremonies: [
      engagement(
        'Sakharpuda',
        'The engagement: the groom’s family gives the bride a sari and sugar (sakhar), and rings are exchanged.',
        'sakharpuda',
      ),
      haldi(
        'Halad Chadavne',
        'Turmeric is first applied to the groom; what remains is taken to the bride.',
        'halad',
      ),
      mehendi('A newer addition to many Maharashtrian weddings.'),
      {
        id: 'simant-pujan',
        name: 'Simant Pujan',
        when: 'Evening before or morning of the wedding',
        about: 'The bride’s family welcomes the groom’s family at the venue with a puja.',
        palette: [ORANGE, LEAF, GOLD],
        decor: [
          'Rangoli and diyas at the entrance',
          'Paithani-draped seating for the elders',
          'A banana-leaf and marigold toran',
        ],
        food: 'Tea, snacks and sweets for the groom’s family.',
      },
      {
        id: 'lagna',
        name: 'Lagna (Antarpat & Mangalashtak)',
        when: 'Morning or afternoon muhurat',
        about:
          'An antarpat cloth separates the couple while mangalashtak verses are sung; when it drops they exchange garlands, then take the saptapadi.',
        palette: [ORANGE, LEAF, GOLD],
        decor: [
          'A mandap with banana plants and mango leaves',
          'An antarpat cloth in auspicious colours',
          'Marigold and mogra strings, rangoli and brass samai lamps',
        ],
        food: 'The wedding pangat — see the menu.',
        photo: 'mandap',
      },
      reception(),
    ],
    defaultCeremonies: ['halad', 'simant-pujan', 'lagna', 'reception'],
  },

  tamil: {
    id: 'tamil',
    label: 'Tamil',
    service:
      'The wedding lunch (kalyana saapadu) is served on a banana leaf to seated guests in a set order: vegetables, vadai and appalam on the leaf, payasam, then rice with paruppu and ghee, sambar, kuzhambu, rasam and finally curd. Vegetarian for most Hindu weddings.',
    courses: [
      {
        id: 'tiffin',
        name: 'Wedding-morning tiffin',
        pick: [0, 3],
        note: 'Served before or after the muhurtham',
        dishes: [
          v('Medu vadai', 30),
          v('Rava kesari', 30, true),
          v('Ven pongal', 35),
          v('Idli with chutney and sambar', 40),
        ],
      },
      {
        id: 'leaf',
        name: 'On the leaf',
        pick: [4, 7],
        party: true,
        dishes: [
          v('Appalam', 5, true),
          v('Pickle', 5, true),
          v('Banana chips', 10, true),
          v('Pachadi', 20, true),
          v('Kosambari', 20, true),
          v('Poriyal', 25, true),
          v('Kootu', 25, true),
          v('Medu vadai', 30),
        ],
      },
      {
        id: 'payasam',
        name: 'Payasam & sweet',
        pick: [1, 2],
        note: 'Served in the middle of the meal',
        party: true,
        dishes: [
          v('Semiya payasam', 30, true),
          v('Jangiri', 30, true),
          v('Paruppu payasam', 35, true),
          v('Sakkarai pongal', 35, true),
          v('Paal payasam', 40, true),
        ],
      },
      {
        id: 'rice',
        name: 'Rice courses, in order',
        pick: [3, 5],
        dishes: [
          v('Rice with paruppu and ghee', 30, true),
          v('Sambar', 25),
          v('Vatha kuzhambu or mor kuzhambu', 25, true),
          v('Rasam', 15, true),
          v('Curd rice with moru', 20, true),
        ],
      },
      {
        id: 'reception-dinner',
        name: 'Reception dinner',
        pick: [0, 2],
        note: 'At the reception, for families who serve non-vegetarian food',
        dishes: [nv('Chettinad chicken', 170), nv('Chicken biryani', 180), nv('Mutton chukka', 250)],
      },
      {
        id: 'finish',
        name: 'To finish',
        pick: [1, 2],
        party: true,
        dishes: [v('Banana', 10, true), v('Beeda (paan)', 20, true), v('Filter coffee', 25, true)],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [0, 1],
        party: true,
        dishes: [v('Nannari sarbath', 25, true), v('Rose milk', 30, true), MOCKTAILS()],
      },
    ],
    ceremonies: [
      mehendi('A newer addition to many Tamil weddings.'),
      {
        id: 'nichayathartham',
        name: 'Nichayathartham',
        when: 'Often the evening before the wedding',
        about:
          'The formal engagement: the families exchange thamboolam trays and the wedding invitation (lagna patrikai) is read out.',
        palette: [KUMKUM, GOLD, JASMINE],
        decor: [
          'Brass thamboolam trays with fruit, betel leaves and flowers',
          'A kolam at the entrance',
          'Jasmine and marigold strings',
        ],
        food: 'Dinner — often the reception dinner the same evening.',
      },
      reception(
        'Reception',
        'Usually the evening before the muhurtham; guests greet the couple and stay for dinner.',
      ),
      {
        id: 'kashi-yatra',
        name: 'Kashi Yatra & Oonjal',
        when: 'Morning of the wedding',
        about:
          'The groom sets off for Kashi with an umbrella and fan until the bride’s father persuades him to marry; then the couple sits on a swing (oonjal) while women sing.',
        palette: [KUMKUM, GOLD, LEAF],
        decor: [
          'A decorated wooden oonjal (swing)',
          'A silk umbrella, hand fan and walking stick for the groom',
          'Coloured rice balls and lamps for the oonjal ritual',
        ],
        food: 'The wedding-morning tiffin.',
      },
      {
        id: 'muhurtham',
        name: 'Muhurtham',
        when: 'Early morning, at the muhurtham',
        about:
          'Kanyadanam, then the groom ties the thali at the auspicious moment to the sound of the nadaswaram, followed by the saptapadi.',
        palette: [KUMKUM, GOLD, JASMINE],
        decor: [
          'A manavarai (stage) with banana trees and sugarcane',
          'Jasmine and rose garlands around brass kuthuvilakku lamps',
          'Kolam and a mango-leaf thoranam',
        ],
        food: 'The kalyana saapadu on banana leaves — see the menu.',
      },
      {
        id: 'nalangu',
        name: 'Nalangu',
        when: 'The day before or after the muhurtham',
        about: 'A playful ritual of turmeric, sandal and games between the couple and families.',
        palette: [TURMERIC, MARIGOLD, LEAF],
        decor: [
          'Jasmine strings and banana-leaf accents',
          'Brass kuthuvilakku lamps',
          'A kolam and a low seat for the couple',
        ],
        food: 'Snacks and filter coffee.',
      },
    ],
    defaultCeremonies: ['nichayathartham', 'reception', 'kashi-yatra', 'muhurtham'],
  },

  kerala: {
    id: 'kerala',
    label: 'Kerala (Hindu)',
    service:
      'The sadya is served on a banana leaf to seated guests in a fixed order: chips, pickles and curries on the leaf first, then rice with parippu and ghee, sambar, the payasams, and finally rasam and moru. Reception dinners often add biryani or meat dishes.',
    courses: [
      {
        id: 'leaf',
        name: 'On the leaf (sadya)',
        pick: [6, 10],
        party: true,
        dishes: [
          v('Pappadam', 5, true),
          v('Upperi (banana chips)', 10, true),
          v('Pickles (manga, naranga)', 10, true),
          v('Inji puli', 10, true),
          v('Sharkara varatti', 15, true),
          v('Kichadi', 20, true),
          v('Pachadi', 20, true),
          v('Thoran', 25, true),
          v('Olan', 30),
          v('Kalan', 30),
          v('Erissery', 30),
          must(v('Avial', 35)),
          v('Koottu curry', 35),
        ],
      },
      {
        id: 'rice',
        name: 'Rice and curries, in order',
        pick: [2, 4],
        dishes: [
          v('Rice with parippu and ghee', 30, true),
          v('Sambar', 25),
          v('Rasam', 15, true),
          v('Moru (buttermilk)', 15, true),
        ],
      },
      {
        id: 'payasam',
        name: 'Payasam',
        pick: [1, 2],
        party: true,
        dishes: [
          v('Parippu payasam', 40, true),
          must(v('Ada pradhaman', 45, true)),
          v('Palada payasam', 45, true),
        ],
      },
      {
        id: 'reception-dinner',
        name: 'Reception dinner',
        pick: [0, 3],
        note: 'At the reception only',
        dishes: [
          v('Vegetable biryani', 100),
          nv('Appam with chicken stew', 140),
          nv('Malabar chicken biryani', 180),
          nv('Fish moilee', 200),
          nv('Karimeen pollichathu', 280),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [0, 1],
        party: true,
        dishes: [v('Sambharam (spiced buttermilk)', 15, true), MOCKTAILS()],
      },
    ],
    ceremonies: [
      engagement(
        'Nischayam',
        'The elders fix the match and the date; rings are often exchanged.',
        'nischayam',
      ),
      mehendi('A newer addition to many Kerala weddings.'),
      {
        id: 'vivaham',
        name: 'Vivaham (Thalikettu)',
        when: 'Morning, at a short muhurtham — often at a temple',
        about:
          'The groom ties the thali, gives the pudava (sari) and the couple circles the nilavilakku lamp; the ceremony takes only minutes.',
        palette: [{ name: 'Kasavu gold', hex: '#c8a24a' }, { name: 'Off-white', hex: '#f4efe1' }, LEAF],
        decor: [
          'A mandapam with coconut-frond (kuruthola) work and banana plants',
          'Brass nilavilakku lamps and a nirapara (paddy-filled measure)',
          'Jasmine strings in a kasavu white-and-gold palette',
        ],
        food: 'The sadya — see the menu.',
      },
      reception(),
    ],
    defaultCeremonies: ['nischayam', 'vivaham', 'reception'],
  },

  telugu: {
    id: 'telugu',
    label: 'Telugu',
    service:
      'Served on banana leaves to seated guests: a sweet and pulihora first, then rice with pappu and ghee, curries, pachadi, sambar or pulusu, charu and curd. Hyderabadi biryani features at many receptions.',
    courses: [
      {
        id: 'leaf',
        name: 'On the leaf',
        pick: [3, 5],
        party: true,
        dishes: [
          v('Appadalu', 5, true),
          v('Avakaya (mango pickle)', 10, true),
          v('Gongura pachadi', 15),
          must(v('Pulihora', 25)),
          v('Dondakaya fry', 25),
          v('Mamidikaya pappu', 30),
          v('Gutti vankaya curry', 40),
        ],
      },
      {
        id: 'rice',
        name: 'Rice courses, in order',
        pick: [3, 4],
        dishes: [
          v('Rice with mudda pappu and ghee', 30, true),
          v('Sambar or pappu charu', 25),
          v('Charu (rasam)', 15, true),
          v('Perugu (curd)', 15, true),
        ],
      },
      {
        id: 'sweets',
        name: 'Sweets',
        pick: [1, 2],
        party: true,
        dishes: [
          v('Payasam', 35, true),
          v('Bobbatlu', 35, true),
          v('Poornalu', 35, true),
          v('Pootharekulu', 40, true),
          v('Double ka meetha', 50),
          v('Qubani ka meetha', 70, true),
        ],
      },
      {
        id: 'reception-dinner',
        name: 'Reception dinner',
        pick: [0, 3],
        note: 'At the reception only',
        dishes: [
          v('Mirchi ka salan', 30),
          v('Veg dum biryani', 110),
          nv('Chicken 65', 150),
          nv('Hyderabadi dum biryani', 220),
          nv('Gongura mutton', 260),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [0, 1],
        party: true,
        dishes: [v('Majjiga (buttermilk)', 15, true), MOCKTAILS()],
      },
    ],
    ceremonies: [
      engagement(
        'Nischitartham',
        'The engagement: the families exchange gifts and fix the muhurtham.',
        'nischitartham',
      ),
      haldi(
        'Pellikuthuru',
        'The bride is bathed with turmeric and dressed as a bride for the first time; elders bless her.',
        'pellikuthuru',
        'A day or two before the wedding',
      ),
      haldi(
        'Pellikoduku',
        'The same turmeric ritual for the groom at his home.',
        'pellikoduku',
        'A day or two before the wedding',
      ),
      {
        id: 'pelli',
        name: 'Pelli (wedding)',
        when: 'At the muhurtham — often night or early morning',
        about:
          'At the muhurtham the couple place jeelakarra bellam (cumin and jaggery) on each other’s heads, then mangalya dharanam and talambralu — showering each other with turmeric rice.',
        palette: [KUMKUM, GOLD, LEAF],
        decor: [
          'A pelli mandapam with banana plants and a coconut-leaf thoranam',
          'A curtain (tera) held between the couple until the muhurtham',
          'Brass lamps and baskets of talambralu rice',
        ],
        food: 'The wedding meal on banana leaves — see the menu.',
      },
      reception(),
      mehendi('A newer addition to many Telugu weddings.'),
    ],
    defaultCeremonies: ['nischitartham', 'pellikuthuru', 'pellikoduku', 'pelli', 'reception'],
  },

  muslim: {
    id: 'muslim',
    label: 'Muslim',
    service:
      'Served on a dastarkhwan (seated, shared platters) or as a buffet. Biryani and kebabs are the heart of the menu; the walima feast is hosted by the groom’s family.',
    courses: [
      {
        id: 'starters',
        name: 'Kebabs & starters',
        pick: [2, 3],
        party: true,
        dishes: [
          v('Dahi ke kebab', 90),
          v('Paneer tikka', 110),
          nv('Shami kebab', 130),
          nv('Chicken tikka', 150),
          nv('Seekh kebab', 150),
          nv('Galouti kebab', 180),
        ],
      },
      {
        id: 'mains',
        name: 'Biryani & mains',
        pick: [2, 4],
        party: true,
        dishes: [
          v('Dalcha', 50),
          v('Veg biryani', 110),
          v('Paneer korma', 120),
          nv('Chicken biryani', 180),
          nv('Haleem (seasonal)', 200),
          nv('Mutton korma', 250),
          nv('Mutton biryani (Lucknowi, Hyderabadi or Kolkata style)', 260),
          nv('Nihari', 260),
        ],
      },
      {
        id: 'breads',
        name: 'Breads',
        pick: [1, 2],
        dishes: [v('Roomali roti', 25), v('Naan', 30), v('Sheermal', 35), v('Taftan', 40)],
      },
      {
        id: 'desserts',
        name: 'Desserts',
        pick: [1, 2],
        party: true,
        dishes: [
          v('Zarda', 40),
          v('Phirni in kulhad', 45),
          v('Double ka meetha', 50),
          must(v('Shahi tukda', 55)),
          v('Qubani ka meetha', 70),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 2],
        party: true,
        dishes: [v('Rooh Afza sherbet', 25), v('Kahwa', 40), MOCKTAILS()],
      },
    ],
    ceremonies: [
      engagement('Mangni', 'The engagement: rings and gifts are exchanged and the date is fixed.', 'mangni'),
      {
        ...haldi(
          'Manjha (ubtan)',
          'Ubtan of turmeric and sandalwood is applied to the bride, who wears yellow, a few days before the nikah.',
          'manjha',
          'A few days before the nikah',
        ),
        palette: [TURMERIC, EMERALD, MARIGOLD],
      },
      mehendi(),
      {
        id: 'nikah',
        name: 'Nikah',
        when: 'Often after the Asr or Maghrib prayer',
        about:
          'The qazi conducts the nikah: ijab-o-qubool, signing the nikahnama and agreeing the mehr, followed by the khutba and dua.',
        palette: [EMERALD, IVORY, GOLD],
        decor: [
          'A floral partition of jasmine and roses',
          'A low takht with bolsters for the couple',
          'Ivory, green and gold drapes with lanterns',
        ],
        food: 'Dinner after the nikah, and dates and sweets as it ends.',
      },
      reception(
        'Walima',
        'The groom’s family hosts a feast after the nikah to celebrate the marriage.',
        'walima',
      ),
    ],
    defaultCeremonies: ['manjha', 'mehendi', 'nikah', 'walima'],
  },

  christian: {
    id: 'christian',
    label: 'Christian',
    service:
      'A buffet reception after the church service, with a toast, cake cutting and the first dance. The menu follows the family’s region — Goan, Mangalorean, Kerala Syrian or Anglo-Indian.',
    courses: [
      {
        id: 'starters',
        name: 'Starters',
        pick: [2, 3],
        party: true,
        dishes: [
          v('Vegetable cutlets', 40),
          nv('Chicken cutlets', 70),
          nv('Chicken drumsticks', 110),
          nv('Fish fingers', 120),
          nv('Prawn rissoles (Goan)', 140),
        ],
      },
      {
        id: 'mains',
        name: 'Mains',
        pick: [2, 4],
        party: true,
        note: 'Pick the dishes of your family’s region',
        dishes: [
          v('Vegetable stew with appam', 70),
          v('Mushroom xacuti', 90),
          nv('Chicken roast', 160),
          nv('Chicken xacuti (Goan)', 170),
          nv('Fish moilee (Kerala)', 200),
          nv('Appam with mutton stew (Kerala)', 200),
          nv('Pork sorpotel with sannas (Goan)', 220),
          nv('Pork vindaloo (Goan)', 220),
          nv('Duck roast (Kerala)', 260),
        ],
      },
      {
        id: 'rice',
        name: 'Rice',
        pick: [1, 1],
        dishes: [v('Fried rice', 40), v('Ghee rice', 40), v('Pulao', 45)],
      },
      {
        id: 'desserts',
        name: 'Desserts',
        pick: [1, 2],
        party: true,
        note: 'Besides the wedding cake',
        dishes: [
          v('Plum cake', 35),
          v('Bread pudding', 35),
          v('Caramel custard', 40),
          v('Bebinca (Goan)', 60),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 2],
        party: true,
        dishes: [v('Fresh lime soda', 30), MOCKTAILS(), v('A toast with wine or sparkling juice', 100)],
      },
    ],
    ceremonies: [
      engagement('Engagement', 'Rings are exchanged and blessed, often after a prayer service.'),
      {
        id: 'roce',
        name: 'Roce',
        when: 'The day before the wedding',
        about:
          'In Goan and Mangalorean Catholic families, coconut milk and oil are applied to the bride or groom while the family sings traditional songs.',
        palette: [IVORY, LEAF, MARIGOLD],
        decor: [
          'Coconut shells and a brass bowl of coconut milk',
          'Banana leaves and fresh flowers',
          'Seating for the singers and family',
        ],
        food: 'Snacks, sweets and a family dinner.',
      },
      {
        id: 'church',
        name: 'Church wedding',
        when: 'Usually morning or afternoon',
        about:
          'Vows, rings and the nuptial blessing during the wedding service; the bride often walks down the aisle with her father.',
        palette: [WHITE, IVORY, { name: 'Lilac', hex: '#b8a1d9' }],
        decor: [
          'Pew-end flower arrangements along the aisle',
          'An altar arrangement in white roses and lilies',
          'A floral arch at the church entrance',
        ],
        food: 'Refreshments after the service, then the reception.',
        photo: 'churchWedding',
      },
      reception(
        'Reception',
        'A grand entry, toast, cake cutting and first dance, followed by dinner and music.',
      ),
    ],
    defaultCeremonies: ['church', 'reception'],
  },

  modern: {
    id: 'modern',
    label: 'Modern / mixed',
    service: 'A buffet with live counters — mix regional favourites with a chaat and dessert station.',
    courses: [
      {
        id: 'starters',
        name: 'Starters',
        pick: [2, 4],
        party: true,
        dishes: [
          v('Chaat counter', 60),
          v('Hara bhara kebab', 70),
          v('Mini sliders', 100),
          v('Paneer tikka', 110),
          nv('Chicken tikka', 150),
          nv('Amritsari fish', 180),
        ],
      },
      {
        id: 'mains',
        name: 'Mains',
        pick: [2, 4],
        party: true,
        dishes: [
          v('Mixed vegetable', 50),
          v('Dal makhani', 70),
          v('Paneer butter masala', 110),
          v('Live pasta counter', 120),
          nv('Butter chicken', 170),
          nv('Chicken biryani', 180),
        ],
      },
      {
        id: 'breads',
        name: 'Breads & rice',
        pick: [1, 2],
        party: true,
        dishes: [v('Butter naan', 30), v('Jeera rice', 35), v('Lachha paratha', 35)],
      },
      {
        id: 'cake',
        name: 'Birthday cake',
        pick: [1, 1],
        party: true,
        onlyFor: ['birthday'],
        dishes: [
          v('Eggless pineapple cake', 45),
          v('Chocolate truffle cake', 60),
          v('Fresh fruit cake', 60),
          v('Designer theme cake', 120),
        ],
      },
      {
        id: 'desserts',
        name: 'Desserts',
        pick: [1, 3],
        party: true,
        dishes: [
          v('Gulab jamun', 35),
          v('Rasmalai', 50),
          v('Ice-cream counter', 60),
          v('Jalebi with rabri', 60),
          v('Brownie with ice cream', 70),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 2],
        party: true,
        dishes: [v('Lassi', 40), v('Cold coffee', 60), MOCKTAILS()],
      },
    ],
    ceremonies: [
      engagement('Engagement', 'Rings are exchanged in front of both families.'),
      mehendi(),
      haldi('Haldi', 'Turmeric paste is applied to the bride and groom for blessings and glow.'),
      sangeet(),
      {
        id: 'wedding',
        name: 'Wedding',
        when: 'At the muhurat',
        about: 'Varmala, pheras and vows in a decorated mandap or on a stage.',
        palette: [RANI, GOLD, IVORY],
        decor: ['A floral mandap', 'A rose-petal aisle', 'Warm lights and drapes'],
        food: 'The wedding feast — see the menu.',
        photo: 'mandap',
      },
      reception(),
    ],
    defaultCeremonies: ['mehendi', 'haldi', 'sangeet', 'wedding', 'reception'],
  },
};

/** The single "ceremony" for non-wedding events, so décor works the same way. */
export const PARTY_CEREMONIES: Record<'birthday' | 'community' | 'corporate', Ceremony> = {
  birthday: {
    id: 'party',
    name: 'The party',
    when: 'On the day',
    about: 'Décor, games and a cake moment planned around the birthday person.',
    palette: [{ name: 'Party pink', hex: '#ec4899' }, { name: 'Sky blue', hex: '#38bdf8' }, MARIGOLD],
    decor: [
      'A balloon arch in two theme colours',
      'A themed backdrop behind the cake table',
      'A photo corner with props',
    ],
    food: 'See the menu.',
    photo: 'birthdayDecor',
  },
  community: {
    id: 'event',
    name: 'The event',
    when: 'On the day',
    about: 'Stalls, a stage and clear signage so the whole neighbourhood can join in.',
    palette: [MARIGOLD, VERMILION, TEAL],
    decor: [
      'A decorated entrance arch',
      'Stall rows with bunting and clear signage',
      'A stage with sound and lighting',
    ],
    food: 'See the menu.',
  },
  corporate: {
    id: 'event',
    name: 'The event',
    when: 'On the day',
    about: 'A clear agenda, good sound and a branded backdrop, with space to network.',
    palette: [
      { name: 'Navy', hex: '#1e3a5f' },
      { name: 'Slate grey', hex: '#64748b' },
      { name: 'Brand accent', hex: '#0ea5e9' },
    ],
    decor: [
      'A branded stage backdrop and standees at the entrance',
      'Clear signage for registration, halls and washrooms',
      'Simple centrepieces in brand colours',
    ],
    food: 'See the menu.',
  },
};
