import { describe, expect, it } from 'vitest';
import { parseInr } from './money.js';

describe('parseInr', () => {
  it.each([
    ['20 lakh', 2_000_000],
    ['20L', 2_000_000],
    ['1.5 crore', 15_000_000],
    ['2 cr', 20_000_000],
    ['8,00,000', 800_000],
    ['₹ 60k', 60_000],
    ['Rs. 45000', 45_000],
    ['50000', 50_000],
  ])('reads %s', (input, expected) => {
    expect(parseInr(input)).toBe(expected);
  });

  it('rejects text that is not an amount', () => {
    expect(parseInr('lots')).toBeNull();
    expect(parseInr('20 bananas')).toBeNull();
    expect(parseInr('')).toBeNull();
  });
});
