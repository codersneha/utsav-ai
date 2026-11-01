import type { GuestEntry, GuestSide, RsvpStatus } from '../types.js';

/** How likely each reply is to mean the guests actually come. */
const ATTENDANCE_CHANCE: Record<RsvpStatus, number> = {
  confirmed: 1,
  likely: 0.85,
  'not-asked': 0.75,
  maybe: 0.5,
  declined: 0,
};

export interface GuestTotals {
  /** Families or invitations in the ledger. */
  families: number;
  adults: number;
  children: number;
  /** Everyone invited (adults + children). */
  invited: number;
  /** Heads who have confirmed. */
  confirmed: number;
  declined: number;
  /** Families still waiting for a reply. */
  awaiting: number;
  /** Families whose invitation has not gone out yet. */
  notSent: number;
  vips: number;
  /** Likely turnout, weighted by each reply. */
  expected: number;
  bySide: Partial<Record<GuestSide, number>>;
}

export const heads = (g: GuestEntry) => g.adults + g.children;

/** Counts the ledger so nobody has to count by hand. */
export function guestTotals(guests: GuestEntry[]): GuestTotals {
  const totals: GuestTotals = {
    families: guests.length,
    adults: 0,
    children: 0,
    invited: 0,
    confirmed: 0,
    declined: 0,
    awaiting: 0,
    notSent: 0,
    vips: 0,
    expected: 0,
    bySide: {},
  };
  let expected = 0;
  for (const g of guests) {
    totals.adults += g.adults;
    totals.children += g.children;
    totals.invited += heads(g);
    if (g.rsvp === 'confirmed') totals.confirmed += heads(g);
    if (g.rsvp === 'declined') totals.declined += heads(g);
    if (g.rsvp !== 'confirmed' && g.rsvp !== 'declined') totals.awaiting += 1;
    if (!g.invited) totals.notSent += 1;
    if (g.vip) totals.vips += 1;
    expected += heads(g) * ATTENDANCE_CHANCE[g.rsvp];
    totals.bySide[g.side] = (totals.bySide[g.side] ?? 0) + heads(g);
  }
  totals.expected = Math.round(expected);
  return totals;
}

export type GuestFilter = 'all' | 'vip' | 'not-sent' | 'awaiting' | 'confirmed';

export function filterGuests(guests: GuestEntry[], filter: GuestFilter, query = ''): GuestEntry[] {
  const q = query.trim().toLowerCase();
  return guests.filter((g) => {
    if (q && !`${g.name} ${g.relation}`.toLowerCase().includes(q)) return false;
    if (filter === 'vip') return g.vip;
    if (filter === 'not-sent') return !g.invited;
    if (filter === 'awaiting') return g.rsvp !== 'confirmed' && g.rsvp !== 'declined';
    if (filter === 'confirmed') return g.rsvp === 'confirmed';
    return true;
  });
}

const csvCell = (v: string | number | boolean) => {
  const text = String(v);
  // Neutralise spreadsheet formulas and quote every cell.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** The ledger as CSV, for printing invitation lists or sharing with family. */
export function guestsCsv(guests: GuestEntry[]): string {
  const header = ['Name', 'Relation', 'Side', 'Adults', 'Children', 'Important', 'Invitation sent', 'Reply'];
  const rows = guests.map((g) => [
    g.name,
    g.relation,
    g.side,
    g.adults,
    g.children,
    g.vip ? 'Yes' : 'No',
    g.invited ? 'Yes' : 'No',
    g.rsvp,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}
