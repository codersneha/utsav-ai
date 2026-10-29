import type { PhotoKey } from './photos.js';

/**
 * Curated cultural knowledge: how each community actually celebrates.
 * The AI personalises *within* these facts (e.g. it may pick which Bengali
 * fish dishes to serve) but can never replace them (it cannot turn a
 * seated Bengali biye dinner into a buffet). Every menu the user sees is
 * validated against these lists.
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
  /** Safe for Jain guests: no onion, garlic or root vegetables. */
  jain?: boolean;
  photo?: PhotoKey;
}

export interface Course {
  id: string;
  name: string;
  /** How many dishes are usually served from this course: [min, max]. */
  pick: [number, number];
  dishes: Dish[];
  note?: string;
  /** Also served at birthdays and community events. */
  party?: boolean;
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
  photo?: PhotoKey;
}

export interface Tradition {
  id: TraditionId;
  label: string;
  /** How the wedding meal is served — e.g. "seated, never a buffet". */
  service: string;
  courses: Course[];
  ceremonies: Ceremony[];
  defaultCeremonies: string[];
}

const v = (name: string, photo?: PhotoKey, jain = false): Dish => ({ name, diet: 'veg', jain, photo });
const nv = (name: string, photo?: PhotoKey): Dish => ({ name, diet: 'nonveg', photo });

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

/** Shared ceremonies, adapted per tradition below. */
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
  photo: 'mehendi',
});

const haldi = (
  name = 'Haldi',
  about = 'Turmeric paste is applied to the bride and groom for blessings and glow.',
): Ceremony => ({
  id: 'haldi',
  name,
  when: 'Morning of or the day before the wedding',
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

const sangeet = (name = 'Sangeet'): Ceremony => ({
  id: 'sangeet',
  name,
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
          v('Phuchka', 'phuchka'),
          nv('Fish fry', 'fishFry'),
          v('Papri chaat', 'papdiChaat'),
          v('Ghugni', 'ghugni', true),
          v('Vegetable chop'),
          nv('Fish kabiraji'),
        ],
      },
      {
        id: 'first',
        name: 'First course',
        pick: [1, 1],
        dishes: [
          v('Luchi with aloor dom', 'luchiAlurDom'),
          v('Radhaballabhi with chholar dal', 'cholarDal', true),
          v('Kochuri with chholar dal', 'cholarDal', true),
          v('Kochuri with aloor dom', 'luchiAlurDom'),
        ],
      },
      {
        id: 'rice',
        name: 'Rice & dal',
        pick: [1, 1],
        dishes: [
          nv('Rice with muri ghonto', 'muriGhonto'),
          v('Rice with moong dal and jhuri aloo bhaja', 'bengaliThali'),
          v('Rice with sona moong dal', 'bengaliThali', true),
        ],
      },
      {
        id: 'mains',
        name: 'Fish & meat',
        pick: [2, 2],
        party: true,
        dishes: [
          nv('Bhetki macher paturi', 'bhetkiPaturi'),
          nv('Chingri macher malai curry', 'chingriMalai'),
          nv('Doi katla', 'doiKatla'),
          nv('Mutton kosha', 'muttonCurry'),
          nv('Shorshe ilish', 'shorsheIlish'),
        ],
      },
      {
        id: 'veg-mains',
        name: 'Vegetarian mains',
        pick: [1, 2],
        vegAlternative: true,
        party: true,
        dishes: [
          v('Chhanar dalna'),
          v('Dhokar dalna'),
          v('Mochar ghonto'),
          v('Potoler dolma', undefined, true),
        ],
      },
      {
        id: 'polao',
        name: 'Polao',
        pick: [1, 1],
        dishes: [v('Basanti polao', 'basantiPolao', true), v('Ghee bhaat', undefined, true)],
      },
      {
        id: 'chutney',
        name: 'Chutney & papad',
        pick: [1, 1],
        dishes: [
          v('Aamer chutney', 'mangoChutney', true),
          v('Khejur-aamshotto chutney', undefined, true),
          v('Tomato-khejur chutney', undefined, true),
          v('Plastic chutney (raw papaya)', undefined, true),
        ],
      },
      {
        id: 'doi',
        name: 'Doi',
        pick: [1, 1],
        dishes: [v('Mishti doi', 'mishtiDoi', true), v('Tok-mishti doi', 'mishtiDoi', true)],
      },
      {
        id: 'mishti',
        name: 'Mishti',
        pick: [1, 2],
        party: true,
        dishes: [
          v('Rosogolla (white or baked)', 'rosogolla', true),
          v('Sandesh (makha or kancha golla)', 'sandesh', true),
          v('Nolen gur ice cream (winter special)', 'nolenGurIceCream', true),
          v('Baked mihidana with rabri', 'mihidana', true),
        ],
      },
      { id: 'finish', name: 'To finish', pick: [1, 1], dishes: [v('Mishti paan', undefined, true)] },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 2],
        note: 'Bengali-themed drinks, or a mocktail counter for a contemporary feel',
        party: true,
        dishes: [
          v('Aam pora shorbot', 'aamPanna', true),
          v('Gondhoraj ghol', undefined, true),
          v('Daab (tender coconut) shorbot', undefined, true),
          v('Mocktail counter', 'mocktails', true),
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
        photo: 'gayeHolud',
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
        photo: 'bengaliWedding',
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
    service: 'A lavish buffet with live counters — tandoor, chaat and dessert counters are expected.',
    courses: [
      {
        id: 'starters',
        name: 'Starters',
        pick: [3, 4],
        party: true,
        dishes: [
          v('Paneer tikka', 'paneerTikka'),
          nv('Amritsari fish', 'amritsariFish'),
          nv('Chicken tikka'),
          v('Aloo tikki chaat'),
          v('Dahi bhalla', undefined, true),
          v('Hara bhara kebab'),
        ],
      },
      {
        id: 'mains',
        name: 'Mains',
        pick: [3, 4],
        party: true,
        dishes: [
          v('Dal makhani', 'dalMakhani'),
          v('Sarson da saag with makki di roti (winter)', 'sarsonSaag'),
          nv('Butter chicken', 'butterChicken'),
          v('Kadhai paneer'),
          nv('Rara mutton'),
          v('Amritsari chole', 'choleBhature'),
        ],
      },
      {
        id: 'breads',
        name: 'Breads',
        pick: [2, 3],
        dishes: [v('Butter naan'), v('Lachha paratha'), v('Tandoori roti'), v('Amritsari kulcha')],
      },
      {
        id: 'rice',
        name: 'Rice',
        pick: [1, 1],
        dishes: [v('Jeera rice', undefined, true), v('Veg pulao'), nv('Mutton biryani', 'biryani')],
      },
      {
        id: 'desserts',
        name: 'Desserts',
        pick: [2, 3],
        party: true,
        dishes: [
          v('Gulab jamun', 'gulabJamun', true),
          v('Gajar ka halwa (winter)', 'gajarHalwa'),
          v('Jalebi with rabri', 'rabri', true),
          v('Phirni', 'phirni', true),
          v('Kulfi', undefined, true),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 2],
        party: true,
        dishes: [
          v('Patiala lassi', 'lassi', true),
          v('Masala chaas', undefined, true),
          v('Mocktail counter', 'mocktails', true),
        ],
      },
    ],
    ceremonies: [
      mehendi(),
      sangeet(),
      haldi('Haldi (Vatna)'),
      {
        id: 'choora',
        name: 'Choora',
        when: 'Morning of the wedding',
        about:
          'The bride’s maternal uncle gifts the red-and-white choora bangles; kaleeras are tied to them.',
        palette: [VERMILION, IVORY, GOLD],
        decor: [
          'A low stool with phulkari drapes',
          'Brass plates for the choora and kaleeras',
          'Marigold and rose petals',
        ],
        food: 'A family breakfast — parathas, chole and lassi.',
      },
      {
        id: 'wedding',
        name: 'Anand Karaj or Pheras',
        when: 'Morning (Sikh) or evening (Hindu)',
        about:
          'Sikh couples take four laavan around the Guru Granth Sahib; Hindu couples take pheras around the sacred fire.',
        palette: [ORANGE, MAROON, GOLD],
        decor: [
          'Simple, respectful floral rows in the gurdwara or a mandap with drapes',
          'Rose and marigold aisles',
          'Phulkari accents',
        ],
        food: 'Langar at the gurdwara, or the wedding dinner — see the menu.',
        photo: 'sikhWedding',
      },
      reception(),
    ],
    defaultCeremonies: ['mehendi', 'sangeet', 'haldi', 'wedding', 'reception'],
  },

  marwari: {
    id: 'marwari',
    label: 'Marwari / Rajasthani',
    service:
      'Often a grand buffet; traditional families also hold a seated pangat served on thalis. Largely vegetarian and frequently Jain-friendly.',
    courses: [
      {
        id: 'starters',
        name: 'Starters',
        pick: [2, 3],
        party: true,
        dishes: [
          v('Pyaaz kachori', 'pyaazKachori'),
          v('Mirchi vada'),
          v('Moong dal kachori', undefined, true),
          v('Kanji vada', undefined, true),
        ],
      },
      {
        id: 'mains',
        name: 'Mains',
        pick: [3, 4],
        party: true,
        dishes: [
          v('Dal baati churma', 'dalBaati', true),
          v('Gatte ki sabzi', undefined, true),
          v('Ker sangri', 'kerSangri', true),
          v('Papad ki sabzi', undefined, true),
          v('Rajasthani kadhi', undefined, true),
        ],
      },
      {
        id: 'breads',
        name: 'Breads',
        pick: [1, 2],
        dishes: [v('Bajre ki roti', undefined, true), v('Missi roti'), v('Puri', undefined, true)],
      },
      {
        id: 'desserts',
        name: 'Desserts',
        pick: [2, 2],
        party: true,
        dishes: [
          v('Ghevar', 'ghevar', true),
          v('Moong dal halwa', undefined, true),
          v('Malpua with rabri', 'rabri', true),
          v('Churma ladoo', undefined, true),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 2],
        party: true,
        dishes: [
          v('Chaas', undefined, true),
          v('Kesar thandai', undefined, true),
          v('Mocktail counter', 'mocktails', true),
        ],
      },
    ],
    ceremonies: [
      mehendi(),
      haldi('Pithi Dastoor (haldi)'),
      {
        id: 'mahira',
        name: 'Mahira Dastoor',
        when: '1–2 days before',
        about:
          'The maternal uncle’s family arrives with gifts, clothes and jewellery for the bride or groom.',
        palette: [RANI, ORANGE, GOLD],
        decor: [
          'Leheriya and bandhani drapes',
          'Brass thalis with gifts on display',
          'A welcome path of marigold',
        ],
        food: 'Rajasthani snacks and sweets for the visiting family.',
      },
      sangeet(),
      {
        id: 'wedding',
        name: 'Pheras',
        when: 'Evening or night',
        about: 'Seven pheras around the sacred fire under a mandap.',
        palette: [VERMILION, GOLD, MARIGOLD],
        decor: [
          'A mandap with mirror-work and marigold',
          'Brass lamps and diyas',
          'Rajasthani puppets or lanterns as accents',
        ],
        food: 'The wedding dinner — see the menu.',
        photo: 'pheras',
      },
      reception(),
    ],
    defaultCeremonies: ['mehendi', 'haldi', 'sangeet', 'wedding', 'reception'],
  },

  gujarati: {
    id: 'gujarati',
    label: 'Gujarati',
    service: 'A buffet or a seated Gujarati thali — almost always vegetarian, with Jain options.',
    courses: [
      {
        id: 'starters',
        name: 'Farsan',
        pick: [2, 3],
        party: true,
        dishes: [
          v('Dhokla', 'dhokla', true),
          v('Khandvi', 'khandvi', true),
          v('Patra', undefined, true),
          v('Lilva kachori'),
        ],
      },
      {
        id: 'mains',
        name: 'Shaak & dal',
        pick: [3, 3],
        party: true,
        dishes: [
          v('Undhiyu (winter)', 'undhiyu'),
          v('Sev tameta nu shaak', undefined, true),
          v('Bharela ringan', undefined, true),
          v('Gujarati kadhi', undefined, true),
          v('Gujarati dal', undefined, true),
        ],
      },
      {
        id: 'breads',
        name: 'Rotli & rice',
        pick: [2, 2],
        dishes: [v('Puri', undefined, true), v('Rotli', undefined, true), v('Jeera rice', undefined, true)],
      },
      {
        id: 'desserts',
        name: 'Mithai',
        pick: [1, 2],
        party: true,
        dishes: [
          v('Shrikhand', 'shrikhandPuri', true),
          v('Basundi', 'basundi', true),
          v('Mohanthal', undefined, true),
          v('Jalebi', undefined, true),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 2],
        party: true,
        dishes: [v('Chaas', undefined, true), v('Mocktail counter', 'mocktails', true)],
      },
    ],
    ceremonies: [
      {
        id: 'mandvo',
        name: 'Mandvo Mahurat',
        when: 'A few days before',
        about: 'A puja to bless the mandap before the festivities begin.',
        palette: [MARIGOLD, LEAF, VERMILION],
        decor: ['Mango-leaf torans', 'A kalash and diyas', 'Rangoli at the entrance'],
        food: 'A simple family lunch.',
      },
      haldi('Pithi (haldi)'),
      mehendi(),
      {
        id: 'garba',
        name: 'Garba / Dandiya night',
        when: 'Evening before the wedding',
        about: 'Family and friends dance garba and raas with dandiya sticks.',
        palette: [RANI, ORANGE, TEAL],
        decor: [
          'A central garbo (lamp) with a circular dance floor',
          'Mirror-work and bandhani drapes',
          'Hanging lanterns',
        ],
        food: 'Snack counters and chaas between rounds of dance.',
        photo: 'garba',
      },
      {
        id: 'wedding',
        name: 'Wedding (Hast Milap & Pheras)',
        when: 'Day or evening',
        about: 'The couple’s hands are joined, followed by the pheras around the sacred fire.',
        palette: [VERMILION, GOLD, LEAF],
        decor: ['A mandap with marigold and mango leaves', 'Brass diyas', 'Rangoli around the mandap'],
        food: 'The wedding meal — see the menu.',
        photo: 'pheras',
      },
      reception(),
    ],
    defaultCeremonies: ['haldi', 'mehendi', 'garba', 'wedding', 'reception'],
  },

  marathi: {
    id: 'marathi',
    label: 'Maharashtrian',
    service:
      'Traditionally a seated pangat served on banana leaves or thalis; many weddings now add a buffet.',
    courses: [
      {
        id: 'starters',
        name: 'Starters',
        pick: [2, 2],
        party: true,
        dishes: [
          v('Kothimbir vadi', undefined, true),
          v('Alu vadi', undefined, true),
          v('Sabudana vada'),
          v('Batata vada'),
        ],
      },
      {
        id: 'mains',
        name: 'Mains',
        pick: [2, 3],
        party: true,
        dishes: [
          v('Masale bhaat', 'masaleBhaat'),
          v('Varan bhaat with ghee and lemon', undefined, true),
          v('Batata bhaji'),
          v('Matki usal'),
        ],
      },
      {
        id: 'breads',
        name: 'Breads',
        pick: [1, 2],
        dishes: [
          v('Puran poli', 'puranPoli', true),
          v('Puri', undefined, true),
          v('Chapati', undefined, true),
        ],
      },
      {
        id: 'desserts',
        name: 'Desserts',
        pick: [1, 2],
        party: true,
        dishes: [
          v('Shrikhand or amrakhand', 'shrikhandPuri', true),
          v('Jilebi', undefined, true),
          v('Ukadiche modak', 'modak', true),
          v('Basundi', 'basundi', true),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 2],
        party: true,
        dishes: [
          v('Sol kadhi', 'solKadhi'),
          v('Panha (raw mango)', undefined, true),
          v('Mocktail counter', 'mocktails', true),
        ],
      },
    ],
    ceremonies: [
      haldi('Halad'),
      mehendi('A newer addition to many Maharashtrian weddings.'),
      {
        id: 'wedding',
        name: 'Wedding (Antarpat & Mangalashtak)',
        when: 'Morning or afternoon muhurat',
        about:
          'A cloth (antarpat) separates the couple while mangalashtak verses are sung, then garlands are exchanged.',
        palette: [ORANGE, LEAF, GOLD],
        decor: [
          'A mandap with mango leaves and marigold',
          'Paithani-inspired drapes',
          'Rangoli and brass samai lamps',
        ],
        food: 'The wedding pangat — see the menu.',
        photo: 'mandap',
      },
      reception(),
    ],
    defaultCeremonies: ['haldi', 'wedding', 'reception'],
  },

  tamil: {
    id: 'tamil',
    label: 'Tamil',
    service:
      'Seated and served on banana leaves (virundhu) in a set order; vegetarian for most Hindu weddings.',
    courses: [
      {
        id: 'leaf',
        name: 'On the leaf',
        pick: [4, 6],
        party: true,
        dishes: [
          v('Sambar'),
          v('Rasam'),
          v('Poriyal', undefined, true),
          v('Kootu', undefined, true),
          v('Medu vadai'),
          v('Appalam', undefined, true),
          v('Pachadi', undefined, true),
        ],
      },
      {
        id: 'rice',
        name: 'Rice',
        pick: [2, 2],
        dishes: [
          v('Plain rice with ghee', undefined, true),
          v('Curd rice', undefined, true),
          v('Lemon rice', undefined, true),
        ],
      },
      {
        id: 'desserts',
        name: 'Sweets',
        pick: [2, 2],
        party: true,
        dishes: [
          v('Payasam', 'payasam', true),
          v('Rava kesari', undefined, true),
          v('Sakkarai pongal', undefined, true),
          v('Jangiri', undefined, true),
        ],
      },
      {
        id: 'drinks',
        name: 'To finish',
        pick: [1, 2],
        party: true,
        dishes: [
          v('Filter coffee', 'filterCoffee', true),
          v('Rose milk', undefined, true),
          v('Paan', undefined, true),
        ],
      },
    ],
    ceremonies: [
      {
        id: 'nalangu',
        name: 'Nalangu',
        when: 'The day before',
        about: 'A playful ritual of turmeric, sandal and games between the families.',
        palette: [TURMERIC, MARIGOLD, LEAF],
        decor: [
          'Jasmine strings and banana-leaf accents',
          'Brass kuthuvilakku lamps',
          'Kolam at the entrance',
        ],
        food: 'Snacks and filter coffee.',
        photo: 'haldi',
      },
      mehendi('A newer addition to many Tamil weddings.'),
      {
        id: 'wedding',
        name: 'Muhurtham',
        when: 'Early morning muhurtham',
        about: 'Kanyadaanam and mangalya dharanam (tying the thali) under a decorated mandapam.',
        palette: [GOLD, VERMILION, LEAF],
        decor: [
          'A mandapam with banana trees and mango-leaf thoranams',
          'Jasmine and rose garlands',
          'Brass lamps and kolam',
        ],
        food: 'The wedding feast on banana leaves — see the menu.',
        photo: 'tamilWedding',
      },
      reception(),
    ],
    defaultCeremonies: ['nalangu', 'wedding', 'reception'],
  },

  kerala: {
    id: 'kerala',
    label: 'Kerala (Malayali)',
    service:
      'The wedding sadya is served on a banana leaf to seated guests in a fixed order. Christian and Muslim weddings serve biryani, appam and meat dishes instead.',
    courses: [
      {
        id: 'sadya',
        name: 'Sadya on the leaf',
        pick: [5, 7],
        party: true,
        dishes: [
          v('Avial', 'avial', true),
          v('Olan', undefined, true),
          v('Thoran'),
          v('Kalan'),
          v('Pachadi', undefined, true),
          v('Parippu with ghee', undefined, true),
          v('Sambar'),
          v('Rasam'),
          v('Pappadam', undefined, true),
          v('Banana chips and sharkara varatti'),
        ],
      },
      {
        id: 'nonveg',
        name: 'For Christian or Muslim weddings',
        pick: [0, 2],
        dishes: [nv('Malabar chicken biryani', 'biryani'), nv('Appam with chicken stew'), nv('Fish moilee')],
      },
      {
        id: 'desserts',
        name: 'Payasam',
        pick: [1, 2],
        party: true,
        dishes: [
          v('Ada pradhaman', undefined, true),
          v('Palada payasam', 'payasam', true),
          v('Pazham (banana)', undefined, true),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 1],
        party: true,
        dishes: [v('Sambharam (spiced buttermilk)'), v('Mocktail counter', 'mocktails', true)],
      },
    ],
    ceremonies: [
      haldi('Haldi (modern addition)'),
      mehendi('A newer addition to many Kerala weddings.'),
      {
        id: 'wedding',
        name: 'Wedding (Thaali kettu)',
        when: 'Morning muhurtham',
        about: 'A short ceremony where the groom ties the thaali; simple, elegant and on time.',
        palette: [IVORY, GOLD, LEAF],
        decor: [
          'Kasavu-inspired white and gold drapes',
          'Nilavilakku (brass lamps) and jasmine',
          'Coconut-palm and banana-leaf accents',
        ],
        food: 'The sadya — see the menu.',
        photo: 'sadya',
      },
      reception(),
    ],
    defaultCeremonies: ['wedding', 'reception'],
  },

  telugu: {
    id: 'telugu',
    label: 'Telugu',
    service:
      'The wedding feast is served on banana leaves to seated guests; Hyderabadi biryani features at many receptions.',
    courses: [
      {
        id: 'leaf',
        name: 'On the leaf',
        pick: [4, 5],
        party: true,
        dishes: [
          v('Pulihora', 'pulihora', true),
          v('Gutti vankaya curry', 'guttiVankaya'),
          v('Mudda pappu with ghee', undefined, true),
          v('Gongura pachadi'),
          v('Sambar'),
          v('Perugu (curd)', undefined, true),
        ],
      },
      {
        id: 'nonveg',
        name: 'Non-vegetarian',
        pick: [0, 2],
        dishes: [nv('Hyderabadi biryani', 'biryani'), nv('Gongura mutton'), nv('Chicken 65')],
      },
      {
        id: 'desserts',
        name: 'Sweets',
        pick: [2, 2],
        party: true,
        dishes: [
          v('Bobbatlu', 'puranPoli', true),
          v('Double ka meetha', 'doubleKaMeetha', true),
          v('Qubani ka meetha', undefined, true),
          v('Payasam', 'payasam', true),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 1],
        party: true,
        dishes: [v('Majjiga (buttermilk)'), v('Mocktail counter', 'mocktails', true)],
      },
    ],
    ceremonies: [
      haldi('Pellikuthuru / Pellikoduku (haldi)'),
      mehendi(),
      {
        id: 'wedding',
        name: 'Pelli',
        when: 'At the muhurtham',
        about:
          'Jeelakarra-bellam is placed on each other’s heads, followed by talambralu (showering of rice).',
        palette: [VERMILION, GOLD, LEAF],
        decor: [
          'A mandapam with banana trees and flowers',
          'Brass lamps',
          'Rice and turmeric for talambralu',
        ],
        food: 'The wedding feast — see the menu.',
        photo: 'mandap',
      },
      reception(),
    ],
    defaultCeremonies: ['haldi', 'wedding', 'reception'],
  },

  muslim: {
    id: 'muslim',
    label: 'Muslim',
    service: 'A dastarkhwan (seated, shared platters) or buffet; the menu centres on biryani and kebabs.',
    courses: [
      {
        id: 'starters',
        name: 'Kebabs & starters',
        pick: [2, 3],
        party: true,
        dishes: [
          nv('Seekh kebab', 'seekhKebab'),
          nv('Galouti kebab'),
          nv('Chicken tikka'),
          nv('Haleem (seasonal)', 'haleem'),
          v('Paneer tikka', 'paneerTikka'),
        ],
      },
      {
        id: 'mains',
        name: 'Mains',
        pick: [2, 3],
        party: true,
        dishes: [
          nv('Biryani (Lucknowi, Hyderabadi or Kolkata style)', 'biryani'),
          nv('Mutton korma', 'korma'),
          nv('Nihari'),
          v('Paneer korma'),
          v('Veg biryani'),
        ],
      },
      { id: 'breads', name: 'Breads', pick: [1, 2], dishes: [v('Sheermal'), v('Roomali roti'), v('Naan')] },
      {
        id: 'desserts',
        name: 'Desserts',
        pick: [1, 2],
        party: true,
        dishes: [
          v('Shahi tukda', 'shahiTukda'),
          v('Phirni', 'phirni', true),
          v('Qubani ka meetha', undefined, true),
          v('Double ka meetha', 'doubleKaMeetha'),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 2],
        party: true,
        dishes: [v('Rooh Afza sherbet', 'roohAfza', true), v('Mocktail counter', 'mocktails', true)],
      },
    ],
    ceremonies: [
      haldi('Manjha / Haldi'),
      mehendi(),
      {
        id: 'nikah',
        name: 'Nikah',
        when: 'Day or evening',
        about: 'The marriage contract is read and accepted in the presence of witnesses and the qazi.',
        palette: [IVORY, { name: 'Emerald', hex: '#2e7d5b' }, GOLD],
        decor: [
          'A floral stage with sheer white drapes',
          'Jasmine and rose garlands',
          'Separate seating as the family prefers',
        ],
        food: 'Dates and sherbet after the nikah, then dinner — see the menu.',
        photo: 'nikah',
      },
      reception('Walima', 'The reception hosted by the groom’s family after the nikah.'),
    ],
    defaultCeremonies: ['mehendi', 'nikah', 'reception'],
  },

  christian: {
    id: 'christian',
    label: 'Christian',
    service: 'A buffet reception after the church service; the menu reflects the family’s region.',
    courses: [
      {
        id: 'starters',
        name: 'Starters',
        pick: [2, 3],
        party: true,
        dishes: [nv('Chicken cutlets'), v('Vegetable cutlets'), nv('Fish fingers')],
      },
      {
        id: 'mains',
        name: 'Mains',
        pick: [2, 3],
        party: true,
        dishes: [
          nv('Chicken roast'),
          nv('Appam with mutton stew'),
          v('Vegetable stew with appam'),
          v('Fried rice or pulao'),
        ],
      },
      {
        id: 'desserts',
        name: 'Desserts',
        pick: [2, 2],
        party: true,
        dishes: [v('Wedding cake'), v('Caramel custard'), v('Plum cake')],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 2],
        party: true,
        dishes: [v('Mocktail counter', 'mocktails', true), v('Fresh lime soda', undefined, true)],
      },
    ],
    ceremonies: [
      {
        id: 'wedding',
        name: 'Church wedding',
        when: 'Usually morning or afternoon',
        about: 'Vows and the exchange of rings in church, followed by the reception.',
        palette: [WHITE, IVORY, { name: 'Sage', hex: '#8fa98a' }],
        decor: [
          'White floral pew-ends and an aisle runner',
          'Lilies and baby’s breath',
          'Candle arrangements at the altar',
        ],
        food: 'Served at the reception — see the menu.',
        photo: 'churchWedding',
      },
      reception(),
    ],
    defaultCeremonies: ['wedding', 'reception'],
  },

  modern: {
    id: 'modern',
    label: 'Modern / mixed',
    service: 'A buffet with live counters — mix regional favourites with a chaat and dessert station.',
    courses: [
      {
        id: 'starters',
        name: 'Starters',
        pick: [3, 4],
        party: true,
        dishes: [
          v('Paneer tikka', 'paneerTikka'),
          v('Chaat counter', 'papdiChaat'),
          v('Hara bhara kebab'),
          nv('Chicken tikka'),
          nv('Amritsari fish', 'amritsariFish'),
        ],
      },
      {
        id: 'mains',
        name: 'Mains',
        pick: [3, 4],
        party: true,
        dishes: [
          v('Dal makhani', 'dalMakhani'),
          v('Paneer butter masala'),
          nv('Butter chicken', 'butterChicken'),
          v('Mixed vegetable'),
          nv('Chicken biryani', 'biryani'),
        ],
      },
      {
        id: 'breads',
        name: 'Breads & rice',
        pick: [2, 2],
        dishes: [v('Butter naan'), v('Lachha paratha'), v('Jeera rice', undefined, true)],
      },
      {
        id: 'desserts',
        name: 'Desserts',
        pick: [2, 3],
        party: true,
        dishes: [
          v('Gulab jamun', 'gulabJamun', true),
          v('Rasmalai', undefined, true),
          v('Ice-cream counter', undefined, true),
          v('Jalebi with rabri', 'rabri', true),
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        pick: [1, 2],
        party: true,
        dishes: [v('Mocktail counter', 'mocktails', true), v('Lassi', 'lassi', true)],
      },
    ],
    ceremonies: [
      mehendi(),
      haldi(),
      sangeet(),
      {
        id: 'wedding',
        name: 'Wedding',
        when: 'Evening',
        about: 'The main ceremony — pheras, vows or the family’s own rituals.',
        palette: [VERMILION, GOLD, BLUSH],
        decor: [
          'A mandap or stage with fresh flowers',
          'An aisle of marigold and roses',
          'Warm lighting and candles',
        ],
        food: 'The wedding dinner — see the menu.',
        photo: 'pheras',
      },
      reception(),
    ],
    defaultCeremonies: ['mehendi', 'haldi', 'sangeet', 'wedding', 'reception'],
  },
};

/** The single "ceremony" for non-wedding events, so decor works the same way. */
export const PARTY_CEREMONIES: Record<'birthday' | 'community', Ceremony> = {
  birthday: {
    id: 'party',
    name: 'The party',
    when: 'On the day',
    about: 'Decor, games and a cake moment planned around the birthday person.',
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
    photo: 'pandal',
  },
};
