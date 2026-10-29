import { describe, expect, it } from 'vitest';
import { buildChecklist, checklistProgress, mapsSearchUrl } from './checklist.js';

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
