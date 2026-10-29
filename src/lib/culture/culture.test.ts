import { describe, expect, it } from 'vitest';
import { birthdayDetails, weddingDetails } from '../../test/fixtures.js';
import type { EventDetails } from '../../types.js';
import {
  PHOTOS,
  TRADITION_DATA,
  ceremoniesFor,
  defaultMenu,
  findDish,
  menuFor,
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
    expect(defaultMenu(bengali).find((m) => m.courseId === 'mains')?.dishes).toHaveLength(2);
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

describe('photos', () => {
  it('come only from Wikimedia Commons (allowed by the CSP) with a licence', () => {
    for (const photo of Object.values(PHOTOS)) {
      expect(photo.src).toMatch(/^https:\/\/upload\.wikimedia\.org\//);
      expect(photo.page).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      expect(photo.license.length).toBeGreaterThan(0);
    }
  });

  it('every photo a dish or function names exists', () => {
    for (const t of Object.values(TRADITION_DATA)) {
      for (const course of t.courses)
        for (const d of course.dishes) if (d.photo) expect(PHOTOS[d.photo]).toBeDefined();
      for (const c of t.ceremonies) if (c.photo) expect(PHOTOS[c.photo]).toBeDefined();
      expect(t.defaultCeremonies.every((id) => t.ceremonies.some((c) => c.id === id))).toBe(true);
    }
  });
});
