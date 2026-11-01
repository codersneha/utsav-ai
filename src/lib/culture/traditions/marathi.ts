import {
  type Tradition,
  v,
  must,
  GOLD,
  LEAF,
  ORANGE,
  mehendi,
  haldi,
  reception,
  engagement,
  MOCKTAILS,
} from './model.js';

export const marathi: Tradition = {
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
    },
    reception(),
  ],
  defaultCeremonies: ['halad', 'simant-pujan', 'lagna', 'reception'],
};
