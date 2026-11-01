import {
  type Tradition,
  v,
  nv,
  IVORY,
  MARIGOLD,
  LEAF,
  WHITE,
  reception,
  engagement,
  MOCKTAILS,
} from './model.js';

export const christian: Tradition = {
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
      dishes: [v('Plum cake', 35), v('Bread pudding', 35), v('Caramel custard', 40), v('Bebinca (Goan)', 60)],
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
    },
    reception(
      'Reception',
      'A grand entry, toast, cake cutting and first dance, followed by dinner and music.',
    ),
  ],
  defaultCeremonies: ['church', 'reception'],
};
