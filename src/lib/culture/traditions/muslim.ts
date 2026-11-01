import {
  type Tradition,
  v,
  nv,
  must,
  GOLD,
  IVORY,
  MARIGOLD,
  TURMERIC,
  EMERALD,
  mehendi,
  haldi,
  reception,
  engagement,
  MOCKTAILS,
} from './model.js';

export const muslim: Tradition = {
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
};
