import { describe, expect, it, vi } from 'vitest';
import { geminiIdeas, geminiResponse, weddingDetails } from '../test/fixtures.js';
import type { Ideas } from '../types.js';
import { MAX_BODY_BYTES, handleGenerate, type HandlerDeps } from './handler.js';
import { LruCache, RateLimiter } from './rateLimit.js';

const NOW = () => new Date('2026-10-29T06:00:00Z');

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    apiKey: 'key',
    now: NOW,
    limiter: new RateLimiter(100, 60_000),
    cache: new LruCache<Ideas>(10, 60_000),
    fetchImpl: vi.fn(async () => geminiResponse(JSON.stringify(geminiIdeas))) as unknown as typeof fetch,
    ...overrides,
  };
}

describe('handleGenerate — request guards', () => {
  it('rejects non-POST methods', async () => {
    const res = await handleGenerate(new Request('http://localhost/api/generate'), deps());
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
  });

  it('rejects wrong content type, oversized and malformed bodies', async () => {
    expect((await handleGenerate(post('{}', { 'content-type': 'text/plain' }), deps())).status).toBe(415);
    expect(
      (await handleGenerate(post('{}', { 'content-length': String(MAX_BODY_BYTES + 1) }), deps())).status,
    ).toBe(413);
    expect((await handleGenerate(post('x'.repeat(MAX_BODY_BYTES + 1)), deps())).status).toBe(413);
    expect((await handleGenerate(post('{not json'), deps())).status).toBe(400);
    expect((await handleGenerate(post('42'), deps())).status).toBe(400);
  });

  it('rejects unknown modes and invalid details with field errors', async () => {
    expect((await handleGenerate(post({ mode: 'hack', details: weddingDetails }), deps())).status).toBe(400);
    const res = await handleGenerate(
      post({ mode: 'ideas', details: { ...weddingDetails, guests: -1 } }),
      deps(),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).fields.guests).toBeTruthy();
  });

  it('requires a meaningful question in ask mode', async () => {
    const res = await handleGenerate(post({ mode: 'ask', details: weddingDetails, question: ' ' }), deps());
    expect(res.status).toBe(400);
  });

  it('returns 503 when no API key is configured', async () => {
    const res = await handleGenerate(
      post({ mode: 'ideas', details: weddingDetails }),
      deps({ apiKey: undefined }),
    );
    expect(res.status).toBe(503);
  });

  it('rate limits per client and sets Retry-After', async () => {
    const d = deps({ limiter: new RateLimiter(1, 60_000) });
    expect((await handleGenerate(post({ mode: 'ideas', details: weddingDetails }), d)).status).toBe(200);
    const limited = await handleGenerate(
      post({ mode: 'ideas', details: { ...weddingDetails, guests: 10 } }),
      d,
    );
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});

describe('handleGenerate — Gemini calls', () => {
  it('returns validated ideas with security headers and caches them', async () => {
    const d = deps();
    const res = await handleGenerate(post({ mode: 'ideas', details: weddingDetails }), d);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect((await res.json()).ideas.themes[0].name).toBe('Marigold');

    const again = await handleGenerate(post({ mode: 'ideas', details: weddingDetails }), d);
    expect((await again.json()).cached).toBe(true);
    expect(d.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns 502 when the model output is unusable', async () => {
    const fetchImpl = (async () => geminiResponse('{"summary":"x"}')) as typeof fetch;
    const res = await handleGenerate(post({ mode: 'ideas', details: weddingDetails }), deps({ fetchImpl }));
    expect(res.status).toBe(502);
  });

  it('maps upstream failures to 502 without leaking details', async () => {
    const fetchImpl = (async () => geminiResponse('', 500)) as typeof fetch;
    const res = await handleGenerate(post({ mode: 'ideas', details: weddingDetails }), deps({ fetchImpl }));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('key');
  });

  it('answers questions in ask mode with sanitised text', async () => {
    const fetchImpl = vi.fn(async () => geminiResponse('Book <b>early</b>.')) as unknown as typeof fetch;
    const res = await handleGenerate(
      post({ mode: 'ask', details: weddingDetails, question: 'When to book?' }),
      deps({ fetchImpl }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).answer).toBe('Book b early /b .');
  });
});
