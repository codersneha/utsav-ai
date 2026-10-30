import type { Diet, EventDetails, EventType, MenuChoice } from '../../types.js';
import { buildBudget } from '../budget.js';
import { PHOTOS, type DecorTier, type Photo } from './photos.js';
import {
  PARTY_CEREMONIES,
  TRADITION_DATA,
  type Ceremony,
  type Course,
  type Dish,
  type Tradition,
} from './traditions.js';

export { PHOTOS, type DecorTier, type Photo, type PhotoKey } from './photos.js';
export {
  TRADITIONS,
  TRADITION_DATA,
  type Ceremony,
  type Course,
  type Dish,
  type TraditionId,
} from './traditions.js';

type MenuDetails = Pick<
  EventDetails,
  'eventType' | 'tradition' | 'diets' | 'budget' | 'guests' | 'priorities'
>;

export function traditionOf(details: Pick<EventDetails, 'tradition'>): Tradition {
  return TRADITION_DATA[details.tradition];
}

/** The functions being planned: the chosen wedding ceremonies, or the single party/event. */
export function ceremoniesFor(
  details: Pick<EventDetails, 'eventType' | 'tradition' | 'ceremonies'>,
): Ceremony[] {
  if (details.eventType !== 'wedding') return [PARTY_CEREMONIES[details.eventType]];
  const all = traditionOf(details).ceremonies;
  const chosen = all.filter((c) => details.ceremonies.includes(c.id));
  return chosen.length > 0
    ? chosen
    : all.filter((c) => traditionOf(details).defaultCeremonies.includes(c.id));
}

const VEG_DIETS: Diet[] = ['vegetarian', 'jain', 'vegan'];

/** True when the guests are vegetarian only (dietary needs given, none non-vegetarian). */
export function isVegOnly(diets: Diet[]): boolean {
  return diets.length > 0 && !diets.includes('non-vegetarian');
}

/** Service, staff, crockery and staples per plate, before any dish. */
export const BASE_PLATE_COST: Record<EventType, number> = {
  wedding: 180,
  corporate: 150,
  birthday: 80,
  community: 60,
};

/** The catering budget per plate: the user's own catering amount if given, else the estimate. */
export function foodBudgetPerPlate(details: MenuDetails, catering?: number): number {
  const amount =
    catering ??
    buildBudget(details.eventType, details.budget, details.guests, details.priorities).lines.find(
      (l) => l.id === 'catering',
    )?.amount ??
    0;
  return Math.floor(amount / Math.max(1, details.guests));
}

export type MenuTier = 'simple' | 'classic' | 'premium' | 'grand';

export const MENU_TIER_LABELS: Record<MenuTier, string> = {
  simple: 'Simple and traditional',
  classic: 'Classic',
  premium: 'Premium',
  grand: 'Grand',
};

/** How lavish a menu the food budget allows. */
export function menuTier(eventType: EventType, perPlate: number): MenuTier {
  const steps = eventType === 'wedding' ? [900, 1600, 2600] : [450, 900, 1500];
  if (perPlate < steps[0]) return 'simple';
  if (perPlate < steps[1]) return 'classic';
  if (perPlate < steps[2]) return 'premium';
  return 'grand';
}

export interface MenuPlan {
  service: string;
  courses: Course[];
  /** What the catering budget allows per plate (INR). */
  perPlate: number;
  /** Service and staples per plate, already included in every estimate. */
  base: number;
  tier: MenuTier;
}

/**
 * The courses that fit this event and these guests: the full wedding sequence
 * or a shorter party menu, with non-vegetarian dishes removed for vegetarian
 * events and vegetarian alternatives added when needed.
 */
export function menuFor(details: MenuDetails, catering?: number): MenuPlan {
  const tradition = traditionOf(details);
  const vegOnly = isVegOnly(details.diets);
  const needsVegAlternatives = vegOnly || details.diets.some((d) => VEG_DIETS.includes(d));
  const wedding = details.eventType === 'wedding';
  const courses = tradition.courses
    .filter((c) => (c.onlyFor ? c.onlyFor.includes(details.eventType) : wedding || c.party))
    .filter((c) => !c.vegAlternative || needsVegAlternatives)
    .map((c) => (vegOnly ? { ...c, dishes: c.dishes.filter((d) => d.diet === 'veg') } : c))
    .filter((c) => c.dishes.length > 0 && c.pick[1] > 0);
  const service = wedding
    ? tradition.service
    : 'Buffet tables or food stalls suit a party best — keep the menu short and easy to eat while mingling.';
  const perPlate = foodBudgetPerPlate(details, catering);
  return {
    service,
    courses,
    perPlate,
    base: BASE_PLATE_COST[details.eventType],
    tier: menuTier(details.eventType, perPlate),
  };
}

const findIn = (course: Course, name: string) => course.dishes.find((d) => d.name === name);

/** Estimated cost per plate of the chosen dishes, including service and staples. */
export function menuCost(menu: MenuChoice[], plan: MenuPlan): number {
  return menu.reduce((sum, m) => {
    const course = plan.courses.find((c) => c.id === m.courseId);
    return sum + m.dishes.reduce((s, n) => s + ((course && findIn(course, n)?.cost) ?? 0), 0);
  }, plan.base);
}

const byCost = (a: Dish, b: Dish) => a.cost - b.cost;
/** Must-have dishes first, then the most affordable. */
const bySignatureThenCost = (a: Dish, b: Dish) =>
  Number(Boolean(b.signature)) - Number(Boolean(a.signature)) || byCost(a, b);

/** Makes sure Jain, vegetarian and non-vegetarian guests each have something in a mixed course. */
function balance(course: Course, picked: Dish[], diets: Diet[]): Dish[] {
  const out = [...picked];
  const ensure = (wanted: (d: Dish) => boolean) => {
    if (out.length === 0 || out.some(wanted)) return;
    const option = [...course.dishes].sort(byCost).find((d) => wanted(d) && !out.includes(d));
    if (option) out[out.length - 1] = option;
  };
  const mixed = course.dishes.some((d) => d.diet === 'veg') && course.dishes.some((d) => d.diet === 'nonveg');
  if (mixed && out.length >= 2 && diets.includes('non-vegetarian')) ensure((d) => d.diet === 'nonveg');
  if (mixed && out.length >= 2 && diets.some((d) => VEG_DIETS.includes(d))) ensure((d) => d.diet === 'veg');
  if (diets.includes('jain')) ensure((d) => Boolean(d.jain));
  return out;
}

/**
 * Fits the menu to the food budget per plate. Starts from the usual minimum
 * of the most affordable dishes, then — while the budget allows — adds
 * variety and upgrades to premium dishes, most expensive courses first. A
 * richer budget therefore gets a richer menu (e.g. ilish, prawns and mutton
 * at a grand Bengali wedding); a tight one keeps to the essentials.
 */
function fitToBudget(plan: MenuPlan, diets: Diet[], start?: Map<string, Dish[]>): Map<string, Dish[]> {
  const chosen = new Map<string, Dish[]>();
  for (const course of plan.courses) {
    const initial =
      start?.get(course.id) ?? [...course.dishes].sort(bySignatureThenCost).slice(0, course.pick[0]);
    chosen.set(course.id, balance(course, initial, diets));
  }
  const total = () => plan.base + [...chosen.values()].flat().reduce((sum, d) => sum + d.cost, 0);
  const order = [...plan.courses].sort(
    (a, b) => Math.max(...b.dishes.map((d) => d.cost)) - Math.max(...a.dishes.map((d) => d.cost)),
  );
  const tryAdd = (course: Course) => {
    const picked = chosen.get(course.id) ?? [];
    if (picked.length >= course.pick[1]) return false;
    const room = plan.perPlate - total();
    const option = course.dishes
      .filter((d) => !picked.includes(d) && d.cost <= room)
      // Must-haves first, then the most premium dish that still fits.
      .sort((a, b) => Number(Boolean(b.signature)) - Number(Boolean(a.signature)) || b.cost - a.cost)[0];
    if (!option) return false;
    chosen.set(course.id, [...picked, option]);
    return true;
  };
  const tryUpgrade = (course: Course) => {
    const picked = chosen.get(course.id) ?? [];
    const cheapest = picked.filter((d) => !d.signature).sort(byCost)[0];
    if (!cheapest) return false;
    const room = plan.perPlate - total() + cheapest.cost;
    const option = course.dishes
      .filter(
        (d) => !picked.includes(d) && d.cost > cheapest.cost && d.cost <= room && d.diet === cheapest.diet,
      )
      .sort(byCost)
      .at(-1);
    if (!option) return false;
    chosen.set(
      course.id,
      picked.map((d) => (d === cheapest ? option : d)),
    );
    return true;
  };
  // The costliest course (e.g. fish & meat) is enriched first, then the rest.
  const step = () => order.some((course) => tryAdd(course) || tryUpgrade(course));
  for (let guard = 0; guard < 120 && step(); guard++);
  return chosen;
}

/** Dishes are listed in serving order (the order of the knowledge base). */
const toChoices = (plan: MenuPlan, chosen: Map<string, Dish[]>): MenuChoice[] =>
  plan.courses
    .map((c) => ({
      courseId: c.id,
      dishes: c.dishes.filter((d) => chosen.get(c.id)?.includes(d)).map((d) => d.name),
    }))
    .filter((m) => m.dishes.length > 0);

/** A sensible menu without AI, fitted to the food budget. */
export function defaultMenu(details: MenuDetails, catering?: number): MenuChoice[] {
  const plan = menuFor(details, catering);
  return toChoices(plan, fitToBudget(plan, details.diets));
}

const norm = (s: string) => s.trim().toLowerCase();

/** Swaps the costliest dishes for cheaper ones in the same course until the menu fits. */
function trimToBudget(plan: MenuPlan, chosen: Map<string, Dish[]>): void {
  const total = () => plan.base + [...chosen.values()].flat().reduce((s, d) => s + d.cost, 0);
  for (let guard = 0; guard < 80 && total() > plan.perPlate * 1.05; guard++) {
    let best: { course: Course; from: Dish; to?: Dish; saving: number } | null = null;
    for (const course of plan.courses) {
      const picked = chosen.get(course.id) ?? [];
      for (const from of picked.filter((d) => !d.signature)) {
        if (picked.length > course.pick[0] && (!best || from.cost > best.saving)) {
          best = { course, from, saving: from.cost };
        }
        const to = course.dishes
          .filter((d) => !picked.includes(d) && d.cost < from.cost && d.diet === from.diet)
          .sort(byCost)[0];
        if (to && (!best || from.cost - to.cost > best.saving)) {
          best = { course, from, to, saving: from.cost - to.cost };
        }
      }
    }
    if (!best) return;
    const { course, from, to } = best;
    const picked = chosen.get(course.id) ?? [];
    chosen.set(course.id, to ? picked.map((d) => (d === from ? to : d)) : picked.filter((d) => d !== from));
  }
}

/**
 * Keeps only real dishes from the knowledge base, within each course's usual
 * count, fills gaps from the defaults, keeps a choice for every diet, and
 * trims the menu back to the food budget. The AI can choose; it cannot invent
 * dishes or overspend.
 */
export function validateMenu(
  raw: { courseId: string; dishes: string[] }[],
  details: MenuDetails,
  catering?: number,
): MenuChoice[] {
  const plan = menuFor(details, catering);
  const chosen = new Map<string, Dish[]>();
  for (const course of plan.courses) {
    const asked = raw.find((r) => r.courseId === course.id)?.dishes ?? [];
    const picked: Dish[] = [];
    for (const name of asked) {
      const dish = course.dishes.find((d) => norm(d.name) === norm(name));
      if (dish && !picked.includes(dish) && picked.length < course.pick[1]) picked.push(dish);
    }
    for (const dish of [...course.dishes].sort(bySignatureThenCost)) {
      if (picked.length >= course.pick[0]) break;
      if (!picked.includes(dish)) picked.push(dish);
    }
    chosen.set(course.id, balance(course, picked, details.diets));
  }
  trimToBudget(plan, chosen);
  return toChoices(plan, chosen);
}

/** Looks up a dish (for its cost and diet badges). */
export function findDish(
  courseId: string,
  name: string,
  details: Pick<EventDetails, 'tradition'>,
): Dish | undefined {
  return traditionOf(details)
    .courses.find((c) => c.id === courseId)
    ?.dishes.find((d) => d.name === name);
}

/** How much the décor budget allows per function. */
export function decorTier(
  details: Pick<EventDetails, 'eventType' | 'tradition' | 'ceremonies' | 'budget' | 'guests' | 'priorities'>,
  decor?: number,
): DecorTier {
  const amount =
    decor ??
    buildBudget(details.eventType, details.budget, details.guests, details.priorities).lines.find(
      (l) => l.id === 'decor',
    )?.amount ??
    0;
  const perFunction = amount / Math.max(1, ceremoniesFor(details).length);
  if (perFunction < 40_000) return 'simple';
  if (perFunction < 250_000) return 'classic';
  return 'grand';
}

/** A ceremony's photo, only when the décor in it honestly fits this budget level. */
export function decorPhoto(ceremony: Ceremony, tier: DecorTier): Photo | undefined {
  const photo = ceremony.photo ? PHOTOS[ceremony.photo] : undefined;
  return photo && (photo.tiers as DecorTier[]).includes(tier) ? photo : undefined;
}
