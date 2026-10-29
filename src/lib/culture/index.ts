import type { Diet, EventDetails, MenuChoice } from '../../types.js';
import {
  PARTY_CEREMONIES,
  TRADITION_DATA,
  type Ceremony,
  type Course,
  type Dish,
  type Tradition,
} from './traditions.js';

export { PHOTOS, type Photo, type PhotoKey } from './photos.js';
export {
  TRADITIONS,
  TRADITION_DATA,
  type Ceremony,
  type Course,
  type Dish,
  type TraditionId,
} from './traditions.js';

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

export interface MenuPlan {
  service: string;
  courses: Course[];
}

/**
 * The courses that fit this event and these guests: the full wedding sequence
 * or a shorter party menu, with non-vegetarian dishes removed for vegetarian
 * events and vegetarian alternatives added when needed.
 */
export function menuFor(details: Pick<EventDetails, 'eventType' | 'tradition' | 'diets'>): MenuPlan {
  const tradition = traditionOf(details);
  const vegOnly = isVegOnly(details.diets);
  const needsVegAlternatives = vegOnly || details.diets.some((d) => VEG_DIETS.includes(d));
  const courses = tradition.courses
    .filter((c) => details.eventType === 'wedding' || c.party)
    .filter((c) => !c.vegAlternative || needsVegAlternatives)
    .map((c) => (vegOnly ? { ...c, dishes: c.dishes.filter((d) => d.diet === 'veg') } : c))
    .filter((c) => c.dishes.length > 0 && c.pick[1] > 0);
  const service =
    details.eventType === 'wedding'
      ? tradition.service
      : 'Buffet tables or food stalls suit a party best — keep the menu short and easy to eat while mingling.';
  return { service, courses };
}

const prefersJain = (diets: Diet[]) => diets.includes('jain');

/** Dish order used when choosing defaults: Jain-safe first if needed, then dishes with photos. */
function ranked(course: Course, diets: Diet[]): Dish[] {
  const score = (d: Dish) => (prefersJain(diets) && d.jain ? 2 : 0) + (d.photo ? 1 : 0);
  return [...course.dishes].sort((a, b) => score(b) - score(a));
}

/** A sensible menu without AI: the minimum number of dishes from every course. */
export function defaultMenu(details: Pick<EventDetails, 'eventType' | 'tradition' | 'diets'>): MenuChoice[] {
  return menuFor(details)
    .courses.filter((c) => c.pick[0] > 0)
    .map((c) => ({
      courseId: c.id,
      dishes: ranked(c, details.diets)
        .slice(0, c.pick[0])
        .map((d) => d.name),
    }));
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Keeps only real dishes from the knowledge base, within each course's usual
 * count, and fills gaps from the defaults. The AI can choose; it cannot invent.
 */
export function validateMenu(
  raw: { courseId: string; dishes: string[] }[],
  details: Pick<EventDetails, 'eventType' | 'tradition' | 'diets'>,
): MenuChoice[] {
  const plan = menuFor(details);
  const defaults = new Map(defaultMenu(details).map((m) => [m.courseId, m.dishes]));
  return plan.courses
    .map((course) => {
      const asked = raw.find((r) => r.courseId === course.id)?.dishes ?? [];
      const picked: string[] = [];
      for (const name of asked) {
        const dish = course.dishes.find((d) => norm(d.name) === norm(name));
        if (dish && !picked.includes(dish.name) && picked.length < course.pick[1]) picked.push(dish.name);
      }
      for (const name of defaults.get(course.id) ?? []) {
        if (picked.length >= course.pick[0]) break;
        if (!picked.includes(name)) picked.push(name);
      }
      // Jain guests must have at least one safe choice wherever the course offers one.
      if (prefersJain(details.diets) && picked.length > 0) {
        const safe = course.dishes.filter((d) => d.jain);
        const hasSafe = picked.some((n) => safe.some((d) => d.name === n));
        if (!hasSafe && safe.length > 0) picked[picked.length - 1] = safe[0].name;
      }
      return { courseId: course.id, dishes: picked };
    })
    .filter((m) => m.dishes.length > 0);
}

/** Looks up a dish (for its photo and diet badges). */
export function findDish(
  courseId: string,
  name: string,
  details: Pick<EventDetails, 'tradition'>,
): Dish | undefined {
  return traditionOf(details)
    .courses.find((c) => c.id === courseId)
    ?.dishes.find((d) => d.name === name);
}
