import { describe, expect, it } from 'vitest';
import {
  buildChecklist,
  checklistProgress,
  fallbackVendorAdvice,
  mapsSearchUrl,
  summariseQuotes,
  vendorGroupsFor,
  venueTypeOf,
} from './checklist.js';

describe('checklist', () => {
  it('builds unique, stable item ids for each event type', () => {
    for (const type of ['wedding', 'birthday', 'community'] as const) {
      const ids = buildChecklist(type).flatMap((g) => g.items.map((i) => i.id));
      expect(new Set(ids).size).toBe(ids.length);
      expect(buildChecklist(type)).toEqual(buildChecklist(type));
    }
  });

  it('computes progress percentage', () => {
    const groups = buildChecklist('birthday');
    const total = groups.flatMap((g) => g.items).length;
    const first = groups[0].items[0].id;
    expect(checklistProgress(groups, {})).toBe(0);
    expect(checklistProgress(groups, { [first]: true })).toBe(Math.round(100 / total));
    expect(checklistProgress([], {})).toBe(0);
  });

  it('builds an encoded Google Maps search link', () => {
    expect(mapsSearchUrl('caterers', 'New Delhi')).toBe(
      'https://www.google.com/maps/search/?api=1&query=caterers%20in%20New%20Delhi',
    );
  });
});

describe('vendor advice and records', () => {
  it('appends AI tasks with stable, distinct ids and an ai flag', () => {
    const groups = buildChecklist('wedding', {
      caterer: { questions: [], tasks: ['Separate Jain counter'] },
    });
    const caterer = groups.find((g) => g.id === 'caterer')!;
    const ai = caterer.items.filter((i) => i.ai);
    expect(ai).toEqual([{ id: 'caterer-ai-0', task: 'Separate Jain counter', ai: true }]);
    expect(caterer.budgetId).toBe('catering');
  });

  it('exposes vendor groups and curated fallback questions for every group', () => {
    for (const type of ['wedding', 'birthday', 'community'] as const) {
      const groups = vendorGroupsFor(type);
      const advice = fallbackVendorAdvice(type);
      groups.forEach((g) => expect(advice[g.id].questions.length).toBeGreaterThan(0));
    }
  });

  it('summarises quotes per vendor group', () => {
    const entries = [
      { id: '1', groupId: 'venue', name: 'A', contact: '', quote: 90_000, status: 'quoted' as const },
      { id: '2', groupId: 'venue', name: 'B', contact: '', quote: 70_000, status: 'confirmed' as const },
      { id: '3', groupId: 'venue', name: 'C', contact: '', quote: 0, status: 'shortlisted' as const },
      { id: '4', groupId: 'caterer', name: 'D', contact: '', quote: 10, status: 'quoted' as const },
    ];
    expect(summariseQuotes(entries, 'venue')).toEqual({ count: 3, lowest: 70_000, confirmed: entries[1] });
    expect(summariseQuotes(entries, 'decorator')).toEqual({ count: 0, lowest: 0, confirmed: undefined });
  });
});

describe('restaurant and café venues', () => {
  it('drop the separate caterer and plan the venue as venue and food', () => {
    const groups = buildChecklist('birthday', {}, 'cafe');
    expect(groups.some((g) => g.id === 'caterer')).toBe(false);
    const venue = groups.find((g) => g.id === 'venue');
    expect(venue?.vendor).toMatch(/Restaurant \/ café/);
    expect(venue?.budgetId).toBe('catering');
    expect(buildChecklist('birthday', {}, 'banquet').some((g) => g.id === 'caterer')).toBe(true);
  });

  it('guess the venue type from a map listing', () => {
    expect(venueTypeOf('from Google Maps', 'Boho The Sky Cafe- Madhyamgram')).toBe('cafe');
    expect(venueTypeOf('restaurant', 'Arsalan')).toBe('restaurant');
    expect(venueTypeOf('events venue', 'Mangalik')).toBe('banquet');
    expect(venueTypeOf('from Google Maps', 'Shibaloy Garden')).toBe('outdoor');
    expect(venueTypeOf('hall', 'Something')).toBeNull();
  });
});

describe('décor turned off', () => {
  it('drops the decorator from the vendor checklist', () => {
    const ids = (on: boolean) => buildChecklist('birthday', {}, 'cafe', on).map((g) => g.id);
    expect(ids(true).some((id) => id === 'decor' || id === 'decorator')).toBe(true);
    expect(ids(false).some((id) => id === 'decor' || id === 'decorator')).toBe(false);
  });
});
