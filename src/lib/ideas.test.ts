import { describe, expect, it } from 'vitest';
import { birthdayDetails, geminiIdeas, weddingDetails } from '../test/fixtures.js';
import { fallbackIdeas, parseIdeas } from './ideas.js';

describe('parseIdeas', () => {
  it('parses valid JSON text and tags the source', () => {
    const ideas = parseIdeas(JSON.stringify(geminiIdeas));
    expect(ideas?.themes[0].name).toBe('Marigold');
    expect(ideas?.source).toBe('gemini');
  });

  it('sanitises and caps untrusted model output', () => {
    const ideas = parseIdeas({
      ...geminiIdeas,
      decor: ['<img src=x onerror=alert(1)>', 5, '', ...Array(10).fill('Lights')],
      themes: [{ name: 'Ok', description: 'Fine' }, { name: '', description: 'x' }, 'bad'],
    });
    expect(ideas?.decor[0]).not.toContain('<');
    expect(ideas?.decor.length).toBeLessThanOrEqual(6);
    expect(ideas?.themes).toHaveLength(1);
  });

  it('returns null for unusable output', () => {
    expect(parseIdeas('not json')).toBeNull();
    expect(parseIdeas(null)).toBeNull();
    expect(parseIdeas({ summary: 'x', themes: [] })).toBeNull();
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
      expect(ideas.themes.length).toBeGreaterThan(0);
      expect(ideas.summary).toContain(details.city);
      expect(parseIdeas(ideas)).not.toBeNull();
    }
  });
});
