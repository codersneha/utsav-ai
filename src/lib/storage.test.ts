import { describe, expect, it, vi } from 'vitest';
import { isBoolean, isRecordOf, loadJson, removeKey, saveJson } from './storage.js';

describe('storage', () => {
  it('round-trips JSON values', () => {
    saveJson('k', { a: true });
    expect(loadJson('k', {})).toEqual({ a: true });
    removeKey('k');
    expect(loadJson('k', 'fallback')).toBe('fallback');
  });

  it('falls back on corrupt or invalid data', () => {
    window.localStorage.setItem('utsav-ai:v1:bad', '{oops');
    expect(loadJson('bad', 1)).toBe(1);
    saveJson('wrong', { a: 'yes' });
    expect(loadJson('wrong', {}, isRecordOf(isBoolean))).toEqual({});
  });

  it('survives storage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveJson('x', 1)).not.toThrow();
    expect(() => removeKey('x')).not.toThrow();
    expect(loadJson('x', 'safe')).toBe('safe');
  });

  it('isRecordOf rejects arrays and non-objects', () => {
    const check = isRecordOf(isBoolean);
    expect(check([])).toBe(false);
    expect(check(null)).toBe(false);
    expect(check({ a: true })).toBe(true);
  });
});
