import {
  type Tradition,
  v,
  nv,
  must,
  GOLD,
  LEAF,
  KUMKUM,
  mehendi,
  haldi,
  reception,
  engagement,
  MOCKTAILS,
} from './model.js';

export const telugu: Tradition = {
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
};
