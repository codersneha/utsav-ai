import { describe, expect, it } from 'vitest';
import { birthdayDetails, geminiIdeas, weddingDetails } from '../test/fixtures.js';
import { menuFor } from './culture/index.js';
import { coloursFromText, fallbackIdeas, fallbackLooks, mergeIdeas, parseIdeas } from './ideas.js';

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

describe('colours from an inspiration photo', () => {
  it('reads named hex colours and uses them for curated décor', () => {
    const colors = 'Deep Violet #4b0082, Lavender Mist #e6e6fa';
    expect(coloursFromText(colors)).toEqual([
      { name: 'Deep Violet', hex: '#4b0082' },
      { name: 'Lavender Mist', hex: '#e6e6fa' },
    ]);
    expect(coloursFromText('pastel pink and mint')).toEqual([]);
    const ideas = fallbackIdeas({ ...birthdayDetails, colors });
    expect(ideas.ceremonies[0].palette[0]).toEqual({ name: 'Deep Violet', hex: '#4b0082' });
  });
});

describe('décor looks', () => {
  it('offers three different trend looks when the user gave no style', () => {
    const looks = fallbackLooks(birthdayDetails);
    expect(looks).toHaveLength(3);
    expect(new Set(looks.map((l) => l.name)).size).toBe(3);
    expect(looks.every((l) => l.palette.length > 0 && l.decor.length > 0 && l.why)).toBe(true);
  });

  it('keeps café looks light and leads with the user’s own colours', () => {
    const cafe = fallbackLooks({ ...birthdayDetails, venueType: 'cafe', ageGroup: 'adults' });
    expect(cafe[0].name).toBe('Table-top florals');
    const own = fallbackLooks({ ...birthdayDetails, colors: 'Sage #9caf88, Ivory #f6efe2' });
    expect(own[0].palette).toEqual([
      { name: 'Sage', hex: '#9caf88' },
      { name: 'Ivory', hex: '#f6efe2' },
    ]);
    expect(own[0].why).toMatch(/colours you chose/);
  });

  it('fills missing looks from the model with its own idea and then trends — never for weddings', () => {
    const raw = {
      ceremonies: [
        {
          id: fallbackIdeas(birthdayDetails).ceremonies[0].ceremonyId,
          theme: 'Under the sea',
          palette: [{ name: 'Ocean', hex: '#1b6ca8' }],
          decor: ['Bubble machine'],
        },
      ],
      looks: [
        {
          name: 'Rainbow',
          palette: [{ name: 'Red', hex: '#c1121f' }],
          decor: ['Rainbow arch'],
          why: 'Bright.',
        },
      ],
    };
    const looks = parseIdeas(JSON.stringify(raw), birthdayDetails, 'decor')?.looks ?? [];
    expect(looks.map((l) => l.name)).toEqual(['Rainbow', 'Pastel balloon garland', 'Jungle safari']);
    const none = parseIdeas(JSON.stringify({ ...raw, looks: [] }), birthdayDetails, 'decor')?.looks ?? [];
    expect(none[0].name).toBe('Under the sea');
    expect(fallbackIdeas(weddingDetails).looks).toBeUndefined();
  });
});
