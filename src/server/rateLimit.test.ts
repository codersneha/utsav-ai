import { describe, expect, it } from 'vitest';
import { LruCache, RateLimiter } from './rateLimit';

describe('RateLimiter', () => {
  it('allows up to the limit and then reports retry seconds', () => {
    const limiter = new RateLimiter(2, 60_000);
    expect(limiter.check('ip', 0)).toBe(0);
    expect(limiter.check('ip', 1000)).toBe(0);
    expect(limiter.check('ip', 2000)).toBe(58);
    expect(limiter.check('other', 2000)).toBe(0);
  });

  it('frees capacity once the window slides', () => {
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.check('ip', 0)).toBe(0);
    expect(limiter.check('ip', 500)).toBeGreaterThan(0);
    expect(limiter.check('ip', 1500)).toBe(0);
  });

  it('evicts old keys to bound memory', () => {
    const limiter = new RateLimiter(1, 60_000, 2);
    limiter.check('a', 0);
    limiter.check('b', 0);
    limiter.check('c', 0);
    expect(limiter.check('a', 1)).toBe(0);
  });
});

describe('LruCache', () => {
  it('stores, expires and evicts least recently used entries', () => {
    const cache = new LruCache<number>(2, 1000);
    cache.set('a', 1, 0);
    cache.set('b', 2, 0);
    expect(cache.get('a', 10)).toBe(1);
    cache.set('c', 3, 10);
    expect(cache.get('b', 10)).toBeUndefined();
    expect(cache.get('a', 2000)).toBeUndefined();
    expect(cache.get('missing')).toBeUndefined();
  });
});
