import { describe, expect, it } from 'vitest';
import { birthdayDetails, geminiIdeas, weddingDetails } from '../test/fixtures.js';
import { menuFor } from './culture/index.js';
import { fallbackIdeas, mergeIdeas, parseIdeas } from './ideas.js';

describe('parseIdeas', () => {
  it('parses valid JSON text into ceremonies and courses', () => {
    const ideas = parseIdeas(JSON.stringify(geminiIdeas), weddingDetails);
    expect(ideas?.ceremonies?.map((c) => c.ceremonyId)).toEqual(['mehendi', 'wedding']);
    expect(ideas?.ceremonies?.[0].theme).toBe('Marigold');
    expect(ideas?.menu?.find((m) => m.courseId === 'starters')?.dishes).toEqual([
      'Kanji vada',
      'Moong dal kachori',
    ]);
  });

  it('drops ceremonies that are not being planned and invented dishes', () => {
    const ideas = parseIdeas(
      {
        ...geminiIdeas,
        ceremonies: [
          { id: 'mahira', theme: 'Not chosen', palette: [], decor: ['x'] },
          { id: 'pithi', theme: 'Sunshine', palette: ['Yellow'], decor: ['Marigold strings'] },
        ],
        menu: [{ course: 'starters', dishes: ['Sushi platter', 'Kanji vada'] }],
      },
      weddingDetails,
    );
    expect(ideas?.ceremonies?.map((c) => c.ceremonyId)).toEqual(['pithi']);
    const starters = ideas?.menu?.find((m) => m.courseId === 'starters')?.dishes ?? [];
    expect(starters).not.toContain('Sushi platter');
    expect(starters).toContain('Kanji vada');
    // Courses the model skipped are still filled from the knowledge base.
    expect(ideas?.menu?.map((m) => m.courseId)).toEqual(
      menuFor(weddingDetails)
        .courses.filter((c) => c.pick[0] > 0)
        .map((c) => c.id),
    );
  });

  it('sanitises and caps untrusted model output', () => {
    const ideas = parseIdeas(
      {
        ...geminiIdeas,
        ceremonies: [
          {
            id: 'mehendi',
            theme: '<b>Bold</b>',
            palette: ['Pink'],
            decor: ['<img src=x onerror=alert(1)>', 5, '', ...Array(10).fill('Lights')],
          },
        ],
      },
      weddingDetails,
    );
    const decor = ideas?.ceremonies?.[0].decor ?? [];
    expect(decor.join(' ')).not.toContain('<');
    expect(decor.length).toBeLessThanOrEqual(4);
  });

  it('parses only the requested section', () => {
    const menuOnly = parseIdeas({ menu: geminiIdeas.menu }, weddingDetails, 'menu');
    expect(Object.keys(menuOnly ?? {})).toEqual(['menu']);
    const extras = parseIdeas(geminiIdeas, weddingDetails, 'extras');
    expect(extras).toEqual({
      summary: geminiIdeas.summary,
      activities: ['Ghoomar'],
      budgetTips: ['Weekday date'],
    });
  });

  it('returns null for unusable output', () => {
    expect(parseIdeas('not json', weddingDetails)).toBeNull();
    expect(parseIdeas(null, weddingDetails)).toBeNull();
    expect(parseIdeas({ ...geminiIdeas, ceremonies: [] }, weddingDetails)).toBeNull();
    expect(parseIdeas({ ...geminiIdeas, menu: 'none' }, weddingDetails)).toBeNull();
    expect(parseIdeas({ summary: 'x', activities: [], budgetTips: [] }, weddingDetails, 'extras')).toBeNull();
  });
});

describe('mergeIdeas', () => {
  it('changes one section and keeps the others', () => {
    const base = fallbackIdeas(weddingDetails);
    const merged = mergeIdeas(base, { menu: [{ courseId: 'starters', dishes: ['Kanji vada'] }] });
    expect(merged.ceremonies).toBe(base.ceremonies);
    expect(merged.menu).toEqual([{ courseId: 'starters', dishes: ['Kanji vada'] }]);
    expect(merged.source).toBe('gemini');
  });
});

describe('fallbackIdeas', () => {
  it('always returns usable ideas for every event type', () => {
    for (const details of [
      weddingDetails,
      birthdayDetails,
      { ...birthdayDetails, eventType: 'community' as const },
    ]) {
      const ideas = fallbackIdeas(details);
      expect(ideas.source).toBe('fallback');
      expect(ideas.ceremonies.length).toBeGreaterThan(0);
      expect(ideas.menu.length).toBeGreaterThan(0);
      expect(ideas.summary).toContain(details.city);
      const raw = {
        ...ideas,
        ceremonies: ideas.ceremonies.map((c) => ({ ...c, id: c.ceremonyId })),
        menu: ideas.menu.map((m) => ({ course: m.courseId, dishes: m.dishes })),
      };
      expect(parseIdeas(raw, details)).not.toBeNull();
    }
  });

  it('plans one décor per wedding function and none for a party', () => {
    expect(fallbackIdeas(weddingDetails).ceremonies.map((c) => c.ceremonyId)).toEqual([
      'pithi',
      'mehendi',
      'wedding',
      'reception',
    ]);
    expect(fallbackIdeas(birthdayDetails).ceremonies.map((c) => c.ceremonyId)).toEqual(['party']);
  });
});
