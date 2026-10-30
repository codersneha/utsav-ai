import { describe, expect, it } from 'vitest';
import { birthdayDetails } from '../test/fixtures.js';
import { buildMenuScanPrompt, parsePartyOrder } from './restaurantMenu.js';

const read = {
  items: [
    { name: 'Paneer Tikka', category: 'starter', price: 320, veg: true, serves: 2 },
    { name: 'Chicken Pizza', category: 'main', price: 520, veg: false, serves: 4 },
    { name: 'Cold Coffee', category: 'drink', price: 160, veg: true, serves: 1 },
    { name: '<b>Bad</b>', category: 'starter', price: -5, veg: true, serves: 1 },
  ],
  order: [
    { name: 'paneer tikka', quantity: 5 },
    { name: 'Chicken Pizza', quantity: 4 },
    { name: 'Cold Coffee', quantity: 15 },
    { name: 'Invented Lobster', quantity: 3 },
  ],
  note: 'Taxes not included.',
};

describe('parsePartyOrder', () => {
  it('prices the order in code from the menu, ignoring invented or invalid dishes', () => {
    const order = parsePartyOrder(read, 15, 100_000);
    expect(order?.itemsRead).toBe(3);
    expect(order?.lines.map((l) => [l.name, l.quantity, l.cost])).toEqual([
      ['Paneer Tikka', 5, 1600],
      ['Chicken Pizza', 4, 2080],
      ['Cold Coffee', 15, 2400],
    ]);
    expect(order?.total).toBe(6080);
    expect(order?.perHead).toBe(405);
    expect(order?.trimmed).toBe(false);
  });

  it('trims the costliest lines until the order fits the budget', () => {
    const order = parsePartyOrder(read, 15, 5000);
    expect(order?.trimmed).toBe(true);
    expect(order!.total).toBeLessThanOrEqual(5000 * 1.02);
    expect(order?.lines.every((l) => l.quantity >= 1 && l.cost === l.quantity * l.price)).toBe(true);
  });

  it('keeps dishes read from earlier pages and counts the pages', () => {
    const known = [{ name: 'Gulab Jamun', category: 'dessert' as const, veg: true, price: 120, serves: 1 }];
    const order = parsePartyOrder(
      { ...read, order: [...read.order, { name: 'Gulab Jamun', quantity: 15 }] },
      15,
      100_000,
      known,
      3,
    );
    expect(order?.itemsRead).toBe(4);
    expect(order?.pages).toBe(3);
    expect(order?.lines.map((l) => l.name)).toContain('Gulab Jamun');
    expect(buildMenuScanPrompt(birthdayDetails, 9000, known)).toContain('ALREADY_READ');
  });

  it('returns null when no menu was read', () => {
    expect(parsePartyOrder({ items: [], order: [], note: 'Not a menu' }, 10, 5000)).toBeNull();
    expect(parsePartyOrder('nonsense', 10, 5000)).toBeNull();
  });

  it('asks for portions sized to the guests and the budget', () => {
    const prompt = buildMenuScanPrompt({ ...birthdayDetails, guests: 15, ageGroup: 'kids' }, 12000);
    expect(prompt).toContain('a party of 15 guests');
    expect(prompt).toContain('₹12000');
    expect(prompt).toMatch(/children/);
  });
});
