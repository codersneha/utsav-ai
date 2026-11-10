import { describe, expect, it } from 'vitest';
import {
  forecastHeadcount,
  forecastMessage,
  isGuestGroup,
  turnoutChance,
  type GuestGroup,
} from './headcount';

let n = 0;
const group = (patch: Partial<GuestGroup> = {}): GuestGroup => ({
  id: `g${n++}`,
  name: 'Mama’s family',
  people: 4,
  closeness: 'close',
  distance: 'local',
  reply: 'not-asked',
  ...patch,
});

describe('turnoutChance', () => {
  it('falls with distance and with how loosely the guest is known', () => {
    const family = turnoutChance({ closeness: 'family', distance: 'local', reply: 'not-asked' });
    const farFamily = turnoutChance({ closeness: 'family', distance: 'far', reply: 'not-asked' });
    const acquaintance = turnoutChance({ closeness: 'acquaintance', distance: 'local', reply: 'not-asked' });
    expect(family).toBeGreaterThan(farFamily);
    expect(family).toBeGreaterThan(acquaintance);
  });

  it('lets a phone reply override the guess', () => {
    const base = { closeness: 'acquaintance', distance: 'far' } as const;
    expect(turnoutChance({ ...base, reply: 'yes' })).toBe(0.95);
    expect(turnoutChance({ ...base, reply: 'no' })).toBeLessThan(0.05);
    expect(turnoutChance({ ...base, reply: 'maybe' })).toBeLessThan(
      turnoutChance({ ...base, reply: 'not-asked' }),
    );
  });
});

describe('forecastHeadcount', () => {
  it('returns zeros for an empty list', () => {
    expect(forecastHeadcount([], 800)).toMatchObject({
      invited: 0,
      expected: 0,
      low: 0,
      high: 0,
      guarantee: 0,
    });
  });

  it('keeps low ≤ expected ≤ high ≤ invited and guarantees the low end', () => {
    const groups = [
      group({ people: 6, closeness: 'family' }),
      group({ people: 40, closeness: 'colleague', name: 'Office' }),
      group({ people: 5, closeness: 'extended', distance: 'far' }),
      group({ people: 120, closeness: 'extended', name: 'Para neighbours' }),
    ];
    const f = forecastHeadcount(groups, 1000);
    expect(f.invited).toBe(171);
    expect(f.low).toBeLessThanOrEqual(f.expected);
    expect(f.expected).toBeLessThanOrEqual(f.high);
    expect(f.high).toBeLessThanOrEqual(f.invited);
    expect(f.guarantee).toBe(f.low);
    expect(f.standby).toBe(f.high - f.low);
    expect(f.low % 5).toBe(0);
    expect(f.high % 5).toBe(0);
  });

  it('prices empty plates, the saving and the standby at the plate price', () => {
    const f = forecastHeadcount([group({ people: 100, closeness: 'extended', name: 'Relatives' })], 1200);
    expect(f.expected).toBe(70);
    expect(f.wastedIfFullList).toBe(30 * 1200);
    expect(f.saved).toBe((100 - f.guarantee) * 1200);
    expect(f.standbyCost).toBe(f.standby * 1200);
  });

  it('narrows the range once families have answered', () => {
    const asked = (reply: GuestGroup['reply']) =>
      forecastHeadcount(
        Array.from({ length: 30 }, () => group({ reply })),
        900,
      );
    const before = asked('not-asked');
    const after = asked('yes');
    expect(after.high - after.low).toBeLessThan(before.high - before.low);
    expect(after.undecided).toBe(0);
    expect(before.undecided).toBe(120);
  });

  it('does not round a small party to fives', () => {
    const f = forecastHeadcount([group({ people: 12, closeness: 'family', reply: 'yes' })], 500);
    expect(f.high).toBe(12);
    expect(f.low).toBeGreaterThan(5);
  });

  it('suggests calling the undecided groups that matter most, never ones that answered', () => {
    const big = group({ people: 8, name: 'Big undecided family', closeness: 'extended' });
    const small = group({ people: 2, name: 'Small undecided couple', closeness: 'extended' });
    const answered = group({ people: 8, name: 'Already said yes', reply: 'yes' });
    const { callFirst } = forecastHeadcount([small, answered, big], 800);
    expect(callFirst.map((g) => g.name)).toEqual(['Big undecided family', 'Small undecided couple']);
  });

  it('ignores a negative plate price', () => {
    expect(forecastHeadcount([group()], -50).saved).toBe(0);
  });
});

describe('isGuestGroup', () => {
  it('accepts a real group and rejects tampered ones', () => {
    expect(isGuestGroup(group())).toBe(true);
    expect(isGuestGroup(null)).toBe(false);
    expect(isGuestGroup({ ...group(), people: 0 })).toBe(false);
    expect(isGuestGroup({ ...group(), people: 2.5 })).toBe(false);
    expect(isGuestGroup({ ...group(), people: 99999 })).toBe(false);
    expect(isGuestGroup({ ...group(), closeness: 'enemy' })).toBe(false);
    expect(isGuestGroup({ ...group(), reply: '<script>' })).toBe(false);
    expect(isGuestGroup({ ...group(), name: 'x'.repeat(200) })).toBe(false);
  });
});

describe('forecastMessage', () => {
  it('summarises the forecast for a family group', () => {
    const f = forecastHeadcount([group({ people: 100, closeness: 'extended', name: 'Relatives' })], 1000);
    const text = forecastMessage(f, 'wedding', 'https://example.com/headcount');
    expect(text).toContain('Invited: 100');
    expect(text).toContain(`Guarantee to the caterer: ${f.guarantee} plates`);
    expect(text).toContain('Saves up to ₹');
    expect(text).toContain('https://example.com/headcount');
  });

  it('leaves out the saving when there is none', () => {
    const f = forecastHeadcount([], 1000);
    expect(forecastMessage(f, 'birthday', 'x')).not.toContain('Saves');
  });
});
