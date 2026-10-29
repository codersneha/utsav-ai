import { describe, expect, it } from 'vitest';
import { fallbackLogistics } from './logistics.js';
import { isArrayOf, isChatTurn, isCustomTask, isLogistics, isVendorEntry } from './guards.js';

describe('storage guards', () => {
  it('accepts valid records', () => {
    expect(isCustomTask({ id: 't', task: 'x', due: '2026-12-01', priority: 'High' })).toBe(true);
    expect(
      isVendorEntry({ id: 'v', groupId: 'venue', name: 'A', contact: '', quote: 0, status: 'pending' }),
    ).toBe(true);
    expect(isChatTurn({ question: 'q', answer: 'a' })).toBe(true);
    expect(isLogistics(fallbackLogistics('wedding'))).toBe(true);
    expect(isArrayOf(isChatTurn)([])).toBe(true);
  });

  it('rejects tampered or stale data', () => {
    expect(isCustomTask({ id: 't', task: 'x', due: 'soon', priority: 'High' })).toBe(false);
    expect(isCustomTask({ id: 't', task: 'x', due: '2026-12-01', priority: 'Urgent' })).toBe(false);
    expect(
      isVendorEntry({ id: 'v', groupId: 'venue', name: 'A', contact: '', quote: 'free', status: 'pending' }),
    ).toBe(false);
    expect(
      isVendorEntry({ id: 'v', groupId: 'venue', name: 'A', contact: '', quote: 1, status: 'booked' }),
    ).toBe(false);
    expect(isLogistics({ source: 'gemini', daySchedule: [{ time: 1 }], vendors: {} })).toBe(false);
    expect(isLogistics({ source: 'other', daySchedule: [], vendors: {} })).toBe(false);
    expect(isArrayOf(isChatTurn)({})).toBe(false);
    expect(isChatTurn(null)).toBe(false);
  });
});
