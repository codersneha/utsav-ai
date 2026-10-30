import { describe, expect, it } from 'vitest';
import type { GuestEntry } from '../types.js';
import { filterGuests, guestTotals, guestsCsv } from './guests.js';

const guest = (over: Partial<GuestEntry>): GuestEntry => ({
  id: 'g',
  name: 'Sharma family',
  relation: 'Mama’s family',
  side: 'bride',
  adults: 4,
  children: 2,
  vip: false,
  invited: false,
  rsvp: 'not-asked',
  ...over,
});

const list = [
  guest({ id: '1', vip: true, invited: true, rsvp: 'confirmed' }),
  guest({
    id: '2',
    name: 'Bose family',
    side: 'groom',
    adults: 2,
    children: 0,
    invited: true,
    rsvp: 'declined',
  }),
  guest({ id: '3', name: 'Office team', relation: 'Rohan’s team', side: 'work', adults: 10, children: 0 }),
];

describe('guestTotals', () => {
  it('counts families, heads, replies and important guests', () => {
    const t = guestTotals(list);
    expect(t).toMatchObject({
      families: 3,
      adults: 16,
      children: 2,
      invited: 18,
      confirmed: 6,
      declined: 2,
      awaiting: 1,
      notSent: 1,
      vips: 1,
    });
    // 6 confirmed + 0 declined + 10 × 0.75 not yet asked.
    expect(t.expected).toBe(14);
    expect(t.bySide).toEqual({ bride: 6, groom: 2, work: 10 });
  });

  it('is zero for an empty list', () => {
    expect(guestTotals([]).invited).toBe(0);
  });
});

describe('filterGuests', () => {
  it('filters by status and searches names and relations', () => {
    expect(filterGuests(list, 'vip').map((g) => g.id)).toEqual(['1']);
    expect(filterGuests(list, 'not-sent').map((g) => g.id)).toEqual(['3']);
    expect(filterGuests(list, 'awaiting').map((g) => g.id)).toEqual(['3']);
    expect(filterGuests(list, 'all', 'rohan').map((g) => g.id)).toEqual(['3']);
  });
});

describe('guestsCsv', () => {
  it('quotes cells and neutralises spreadsheet formulas', () => {
    const csv = guestsCsv([guest({ name: '=HYPERLINK("x")', relation: 'Friend, "close"' })]);
    expect(csv.split('\r\n')[0]).toContain('"Name"');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"Friend, ""close"""');
  });
});
