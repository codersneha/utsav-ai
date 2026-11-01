import { type Tradition, v, nv, must, LEAF, mehendi, reception, engagement, MOCKTAILS } from './model.js';

export const kerala: Tradition = {
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
    engagement('Nischayam', 'The elders fix the match and the date; rings are often exchanged.', 'nischayam'),
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
};
