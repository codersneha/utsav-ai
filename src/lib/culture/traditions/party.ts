import { type Ceremony, MARIGOLD, VERMILION, TEAL } from './model.js';

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
