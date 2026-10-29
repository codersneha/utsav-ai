import { describe, expect, it, vi } from 'vitest';
import { geminiIdeas, weddingDetails } from '../test/fixtures.js';
import { askPlanner, fetchIdeas } from './api.js';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('fetchIdeas', () => {
  it('returns Gemini ideas on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ideas: geminiIdeas }));
    const result = await fetchIdeas(weddingDetails);
    expect(result.value.source).toBe('gemini');
    expect(result.notice).toBeUndefined();
  });

  it.each([
    [429, /quickly/],
    [503, /not configured/],
    [500, /busy/],
  ])('falls back with a helpful notice on HTTP %i', async (status, pattern) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'x' }, status));
    const result = await fetchIdeas(weddingDetails);
    expect(result.value.source).toBe('fallback');
    expect(result.notice).toMatch(pattern);
  });

  it('falls back when the payload is unusable or the network fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ ideas: {} }));
    expect((await fetchIdeas(weddingDetails)).value.source).toBe('fallback');
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('offline'));
    expect((await fetchIdeas(weddingDetails)).notice).toMatch(/offline/);
  });

  it('rethrows when the caller aborted', async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      controller.abort();
      throw new DOMException('aborted', 'AbortError');
    });
    await expect(fetchIdeas(weddingDetails, controller.signal)).rejects.toBeTruthy();
  });
});

describe('askPlanner', () => {
  it('returns the answer text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ answer: 'Book early.' }));
    expect(await askPlanner(weddingDetails, 'When?')).toBe('Book early.');
  });

  it('returns friendly messages on failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}, 429));
    expect(await askPlanner(weddingDetails, 'When?')).toMatch(/wait/);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}, 500));
    expect(await askPlanner(weddingDetails, 'When?')).toMatch(/try again/);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ answer: 5 }));
    expect(await askPlanner(weddingDetails, 'When?')).toMatch(/could not/);
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('offline'));
    expect(await askPlanner(weddingDetails, 'When?')).toMatch(/offline/);
  });
});
