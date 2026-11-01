/**
 * The tradition knowledge base, one file per tradition in `traditions/`. Shared
 * building blocks (dish helpers, colour swatches, common functions such as
 * mehendi and haldi) live in `traditions/model.ts`.
 */
export { TRADITIONS } from './traditions/model.js';
export type { Ceremony, Course, Dish, DishDiet, Swatch, Tradition, TraditionId } from './traditions/model.js';
export { PARTY_CEREMONIES } from './traditions/party.js';
import { bengali } from './traditions/bengali.js';
import { punjabi } from './traditions/punjabi.js';
import { marwari } from './traditions/marwari.js';
import { gujarati } from './traditions/gujarati.js';
import { marathi } from './traditions/marathi.js';
import { tamil } from './traditions/tamil.js';
import { kerala } from './traditions/kerala.js';
import { telugu } from './traditions/telugu.js';
import { muslim } from './traditions/muslim.js';
import { christian } from './traditions/christian.js';
import { modern } from './traditions/modern.js';
import type { Tradition, TraditionId } from './traditions/model.js';

export const TRADITION_DATA: Record<TraditionId, Tradition> = {
  bengali,
  punjabi,
  marwari,
  gujarati,
  marathi,
  tamil,
  kerala,
  telugu,
  muslim,
  christian,
  modern,
};
