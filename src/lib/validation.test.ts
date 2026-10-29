import { describe, expect, it } from 'vitest';
import { TODAY, weddingDetails } from '../test/fixtures';
import { cleanText, validateEventDetails } from './validation';

describe('cleanText', () => {
  it('strips markup characters, control chars and collapses whitespace', () => {
    expect(cleanText('  <script>hi</script>\n\tthere ', 100)).toBe('script hi /script there');
    expect(cleanText('abcdef', 3)).toBe('abc');
    expect(cleanText(42, 10)).toBe('');
  });
});

describe('validateEventDetails', () => {
  it('accepts valid input and normalises numbers', () => {
    const r = validateEventDetails({ ...weddingDetails, guests: '300', budget: '₹25,00,000' }, TODAY);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.guests).toBe(300);
      expect(r.value.budget).toBe(2_500_000);
    }
  });

  it('reports every invalid field', () => {
    const r = validateEventDetails(
      { eventType: 'party', date: '2020-01-01', city: '', guests: 0, budget: 10 },
      TODAY,
    );
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(Object.keys(r.errors).sort()).toEqual(['budget', 'city', 'date', 'eventType', 'guests']);
  });

  it('rejects dates too far ahead and malformed dates', () => {
    const far = validateEventDetails({ ...weddingDetails, date: '2030-01-01' }, TODAY);
    const bad = validateEventDetails({ ...weddingDetails, date: 'tomorrow' }, TODAY);
    expect(far.ok || bad.ok).toBe(false);
  });

  it('filters unknown priorities, de-duplicates and caps at two', () => {
    const r = validateEventDetails(
      { ...weddingDetails, priorities: ['food', 'food', 'hack', 'decor', 'venue'] },
      TODAY,
    );
    expect(r.ok && r.value.priorities).toEqual(['food', 'decor']);
  });

  it('handles non-object input', () => {
    expect(validateEventDetails(null, TODAY).ok).toBe(false);
    expect(validateEventDetails({ ...weddingDetails, priorities: 'food' }, TODAY).ok).toBe(true);
  });
});
