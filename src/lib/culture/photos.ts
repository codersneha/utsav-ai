/**
 * Hand-picked, verified décor photos from Wikimedia Commons (free licences,
 * credited in the UI). Only photos that actually show décor are kept, each
 * tagged with what it shows and the budget levels it honestly represents, so
 * a grand wedding is never illustrated with a modest set-up. Dishes have no
 * photos: no free photo can show what a particular caterer will serve.
 */

export type DecorTier = 'simple' | 'classic' | 'grand';

export interface Photo {
  src: string;
  /** Commons file page, for attribution and licence details. */
  page: string;
  license: string;
  /** What the photo shows, so the AI can judge whether it matches its ideas. */
  shows: string;
  /** Budget levels the décor in the photo fits. */
  tiers: DecorTier[];
}

export const PHOTOS = {
  aiburobhat: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Aiburobhat.jpg/500px-Aiburobhat.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Aiburobhat.jpg',
    license: 'CC BY-SA 4.0',
    shows: 'A home-style aiburobhat spread on a red cloth, ringed with marigolds',
    tiers: ['simple', 'classic'],
  },
  haldi: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Haldi_ceremony_7.jpg/500px-Haldi_ceremony_7.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Haldi_ceremony_7.jpg',
    license: 'CC BY-SA 4.0',
    shows: 'Yellow and pink fabric drapes behind a simple haldi seat',
    tiers: ['simple'],
  },
  mandap: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Indian_Wedding_Mandap_Decoration.jpg/500px-Indian_Wedding_Mandap_Decoration.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Indian_Wedding_Mandap_Decoration.jpg',
    license: 'CC BY-SA 4.0',
    shows: 'A pink-and-white pillared mandap with floral garlands, outdoors',
    tiers: ['classic'],
  },
  pheras: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Saat_phere.jpg/500px-Saat_phere.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Saat_phere.jpg',
    license: 'CC BY-SA 4.0',
    shows: 'A wedding stage with pink drapes and flower strings around the sacred fire',
    tiers: ['classic'],
  },
  reception: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Wedding_reception_stage%2C_decorations%2C_Kochi.jpg/500px-Wedding_reception_stage%2C_decorations%2C_Kochi.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Wedding_reception_stage,_decorations,_Kochi.jpg',
    license: 'CC BY-SA 4.0',
    shows: 'White curtain drapes with fairy lights, a floral ring and a small stage',
    tiers: ['simple'],
  },
  churchWedding: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Indian_christian_wedding.JPG/500px-Indian_christian_wedding.JPG',
    page: 'https://commons.wikimedia.org/wiki/File:Indian_christian_wedding.JPG',
    license: 'CC BY-SA 3.0',
    shows: 'A church aisle lined with white and purple flower arrangements',
    tiers: ['classic', 'grand'],
  },
  birthdayDecor: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Birthday_party_decoration.jpg/500px-Birthday_party_decoration.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Birthday_party_decoration.jpg',
    license: 'CC0',
    shows: 'Balloons and a paper Happy Birthday banner on a wall',
    tiers: ['simple'],
  },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;
