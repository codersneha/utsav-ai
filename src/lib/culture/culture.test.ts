import { describe, expect, it } from 'vitest';
import { birthdayDetails, weddingDetails } from '../../test/fixtures.js';
import type { EventDetails } from '../../types.js';
import {
  TRADITION_DATA,
  ceremoniesFor,
  decorTier,
  defaultMenu,
  findDish,
  menuCost,
  menuFor,
  menuTier,
  validateMenu,
} from './index.js';

const bengali: EventDetails = {
  ...weddingDetails,
  city: 'Kolkata',
  tradition: 'bengali',
  ceremonies: ['aiburobhat', 'gaye-holud', 'biye', 'bou-bhaat'],
  diets: ['vegetarian', 'non-vegetarian'],
};

describe('Bengali wedding menu', () => {
  it('is served course by course in the traditional order — never a buffet', () => {
    const plan = menuFor(bengali);
    expect(plan.service).toMatch(/Never a buffet/);
    expect(plan.courses.map((c) => c.id)).toEqual([
      'starters',
      'first',
      'rice',
      'mains',
      'veg-mains',
      'polao',
      'chutney',
      'doi',
      'mishti',
      'finish',
      'drinks',
    ]);
  });

  it('offers the dishes a Bengali family expects', () => {
    const names = (id: string) =>
      menuFor(bengali)
        .courses.find((c) => c.id === id)
        ?.dishes.map((d) => d.name);
    expect(names('starters')).toEqual(expect.arrayContaining(['Phuchka', 'Fish fry', 'Papri chaat']));
    expect(names('mains')).toEqual(
      expect.arrayContaining(['Bhetki macher paturi', 'Doi katla', 'Mutton kosha']),
    );
    expect(names('finish')).toEqual(['Mishti paan']);
  });

  it('serves no fish or meat at a vegetarian-only wedding', () => {
    const veg = { ...bengali, diets: ['vegetarian' as const] };
    const dishes = menuFor(veg).courses.flatMap((c) => c.dishes);
    expect(dishes.every((d) => d.diet === 'veg')).toBe(true);
    expect(menuFor(veg).courses.map((c) => c.id)).not.toContain('mains');
  });
});

describe('ceremoniesFor', () => {
  it('plans only the chosen functions — a reception has no haldi', () => {
    const ids = ceremoniesFor({ ...bengali, ceremonies: ['bou-bhaat'] }).map((c) => c.id);
    expect(ids).toEqual(['bou-bhaat']);
  });

  it('falls back to the usual functions and uses one plan for parties', () => {
    expect(ceremoniesFor({ ...bengali, ceremonies: [] }).map((c) => c.id)).toEqual(
      TRADITION_DATA.bengali.defaultCeremonies,
    );
    expect(ceremoniesFor(birthdayDetails).map((c) => c.id)).toEqual(['party']);
  });

  it('gives every function its own décor and colours', () => {
    for (const c of ceremoniesFor(bengali)) {
      expect(c.decor.length).toBeGreaterThan(0);
      expect(c.palette.every((p) => /^#[0-9a-f]{6}$/i.test(p.hex))).toBe(true);
    }
  });
});

describe('validateMenu', () => {
  it('keeps real dishes, drops invented ones and respects course sizes', () => {
    const menu = validateMenu(
      [
        {
          courseId: 'mains',
          dishes: ['Sushi', 'Ilish', 'Doi katla', 'Mutton kosha', 'Chingri macher malai curry'],
        },
        { courseId: 'unknown', dishes: ['Pizza'] },
      ],
      bengali,
    );
    const mains = menu.find((m) => m.courseId === 'mains')?.dishes ?? [];
    expect(mains).not.toContain('Sushi');
    expect(mains.length).toBeLessThanOrEqual(menuFor(bengali).courses.find((c) => c.id === 'mains')!.pick[1]);
    expect(menu.map((m) => m.courseId)).not.toContain('unknown');
    // Courses the model left out are filled with defaults.
    expect(menu.find((m) => m.courseId === 'finish')?.dishes).toEqual(['Mishti paan']);
  });

  it('always leaves Jain guests a safe choice', () => {
    const menu = validateMenu(
      [{ courseId: 'starters', dishes: ['Pyaaz kachori', 'Mirchi vada'] }],
      weddingDetails,
    );
    const starters = menu.find((m) => m.courseId === 'starters')?.dishes ?? [];
    expect(starters.some((n) => findDish('starters', n, weddingDetails)?.jain)).toBe(true);
  });
});

describe('menus fit the food budget', () => {
  const at = (budget: number) => ({ ...bengali, guests: 300, budget, priorities: [] });
  const mains = (budget: number) => defaultMenu(at(budget)).find((m) => m.courseId === 'mains')?.dishes ?? [];

  it('gives a generous budget premium dishes and more variety', () => {
    expect(mains(2_500_000)).toEqual(
      expect.arrayContaining(['Mutton kosha', 'Shorshe ilish', 'Chingri macher malai curry']),
    );
    expect(mains(1_200_000)).toHaveLength(2);
    expect(mains(1_200_000)).not.toContain('Shorshe ilish');
  });

  it('always keeps the must-have dishes', () => {
    for (const budget of [600_000, 2_500_000]) {
      const menu = defaultMenu(at(budget));
      const all = menu.flatMap((m) => m.dishes);
      expect(all).toEqual(expect.arrayContaining(['Phuchka', 'Fish fry', 'Mishti doi', 'Mishti paan']));
    }
  });

  it('stays within the per-plate budget whenever the usual minimum allows', () => {
    const plan = menuFor(at(1_200_000));
    expect(menuCost(defaultMenu(at(1_200_000)), plan)).toBeLessThanOrEqual(plan.perPlate);
    expect(menuTier('wedding', plan.perPlate)).toBe('classic');
  });

  it('trims an AI menu that overspends', () => {
    const plan = menuFor(at(1_200_000));
    const menu = validateMenu(
      [{ courseId: 'mains', dishes: ['Shorshe ilish', 'Chingri macher malai curry', 'Mutton kosha'] }],
      at(1_200_000),
    );
    expect(menuCost(menu, plan)).toBeLessThanOrEqual(plan.perPlate * 1.05);
  });

  it('lists dishes in serving order', () => {
    const tamil = { ...at(2_000_000), tradition: 'tamil' as const, diets: ['vegetarian' as const] };
    const rice = defaultMenu(tamil).find((m) => m.courseId === 'rice')?.dishes ?? [];
    expect(rice[0]).toBe('Rice with paruppu and ghee');
    expect(rice.at(-1)).toBe('Curd rice with moru');
  });

  it('adds a birthday cake only at birthdays', () => {
    const party = { ...birthdayDetails, tradition: 'modern' as const };
    expect(menuFor(party).courses.map((c) => c.id)).toContain('cake');
    expect(menuFor({ ...party, eventType: 'corporate' }).courses.map((c) => c.id)).not.toContain('cake');
  });
});

describe('décor level', () => {
  it('follows the décor budget per function', () => {
    expect(decorTier({ ...bengali, budget: 25_00_000, guests: 300 })).toBe('classic');
    expect(decorTier({ ...bengali, budget: 3_00_000, guests: 100 })).toBe('simple');
  });

  it('every tradition’s default functions exist and every dish has a cost', () => {
    for (const t of Object.values(TRADITION_DATA)) {
      expect(t.defaultCeremonies.every((id) => t.ceremonies.some((c) => c.id === id))).toBe(true);
      for (const course of t.courses) for (const d of course.dishes) expect(d.cost).toBeGreaterThan(0);
      for (const c of t.ceremonies) expect(c.palette.every((p) => /^#[0-9a-f]{6}$/i.test(p.hex))).toBe(true);
    }
  });
});

describe('every tradition', () => {
  it('uses its own names for its functions', () => {
    const ids = (t: keyof typeof TRADITION_DATA) => TRADITION_DATA[t].ceremonies.map((c) => c.id);
    expect(ids('punjabi')).toEqual(expect.arrayContaining(['roka', 'jaggo', 'maiyan', 'choora']));
    expect(ids('marwari')).toEqual(expect.arrayContaining(['tilak', 'pithi', 'mayra', 'nikasi']));
    expect(ids('tamil')).toEqual(expect.arrayContaining(['nichayathartham', 'kashi-yatra', 'muhurtham']));
    expect(ids('telugu')).toEqual(expect.arrayContaining(['pellikuthuru', 'pellikoduku', 'pelli']));
    expect(ids('muslim')).toEqual(expect.arrayContaining(['manjha', 'nikah', 'walima']));
    expect(ids('kerala')).not.toContain('haldi');
  });
});
