import { describe, expect, it, vi } from 'vitest';
import { apiLogistics, birthdayDetails, geminiIdeas, weddingDetails } from '../test/fixtures.js';
import { askPlanner, extractDetails, fetchIdeas, fetchLogistics } from './api.js';

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
    expect((await askPlanner(weddingDetails, 'When?')).answer).toBe('Book early.');
  });

  it('returns friendly messages on failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}, 429));
    expect((await askPlanner(weddingDetails, 'When?')).answer).toMatch(/wait/);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}, 500));
    expect((await askPlanner(weddingDetails, 'When?')).answer).toMatch(/try again/);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ answer: 5 }));
    expect((await askPlanner(weddingDetails, 'When?')).answer).toMatch(/could not/);
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('offline'));
    expect((await askPlanner(weddingDetails, 'When?')).answer).toMatch(/offline/);
  });
});

describe('fetchLogistics', () => {
  it('returns Gemini logistics on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ logistics: apiLogistics }));
    const result = await fetchLogistics(birthdayDetails);
    expect(result.value.source).toBe('gemini');
    expect(result.notice).toBeUndefined();
  });

  it('falls back to curated logistics on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'x' }, 502));
    const result = await fetchLogistics(birthdayDetails);
    expect(result.value.source).toBe('fallback');
    expect(result.notice).toMatch(/busy/);
  });
});

describe('request payloads', () => {
  it('sends refinement and the last four chat turns', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse({ ideas: geminiIdeas, answer: 'ok' }));
    await fetchIdeas(weddingDetails, undefined, { request: 'cheaper', previousThemes: ['Marigold'] });
    expect(JSON.parse(String(spy.mock.calls[0][1]?.body))).toMatchObject({
      mode: 'ideas',
      refinement: 'cheaper',
      previousThemes: ['Marigold'],
    });
    const history = Array.from({ length: 6 }, (_, i) => ({ question: `Q${i}`, answer: `A${i}` }));
    await askPlanner(weddingDetails, 'Next?', history);
    const sent = JSON.parse(String(spy.mock.calls[1][1]?.body));
    expect(sent.history.map((t: { question: string }) => t.question)).toEqual(['Q2', 'Q3', 'Q4', 'Q5']);
  });
});

describe('response contract', () => {
  it('accepts exactly what the server handler returns for logistics', async () => {
    const { handleGenerate } = await import('../server/handler.js');
    const { geminiLogistics, geminiResponse } = await import('../test/fixtures.js');
    const server = await handleGenerate(
      new Request('http://localhost/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'logistics', details: birthdayDetails }),
      }),
      {
        apiKey: 'k',
        fetchImpl: (async () => geminiResponse(JSON.stringify(geminiLogistics))) as typeof fetch,
      },
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(server);
    const result = await fetchLogistics(birthdayDetails);
    expect(result.notice).toBeUndefined();
    expect(result.value.source).toBe('gemini');
    expect(result.value.vendors.caterer.tasks).toEqual(['Confirm a separate Jain counter']);
  });

  it('accepts exactly what the server handler returns for ideas', async () => {
    const { handleGenerate } = await import('../server/handler.js');
    const { geminiResponse } = await import('../test/fixtures.js');
    const server = await handleGenerate(
      new Request('http://localhost/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'ideas', details: birthdayDetails }),
      }),
      { apiKey: 'k', fetchImpl: (async () => geminiResponse(JSON.stringify(geminiIdeas))) as typeof fetch },
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(server);
    const result = await fetchIdeas(birthdayDetails);
    expect(result.notice).toBeUndefined();
    expect(result.value.source).toBe('gemini');
  });
});

describe('assistant proposals and extraction', () => {
  it('returns a proposal only when it is well-formed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ answer: 'Done', proposal: { guests: 350, summary: 'More guests' } }),
    );
    expect(await askPlanner(weddingDetails, 'More guests?')).toEqual({
      answer: 'Done',
      proposal: { guests: 350, summary: 'More guests' },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ answer: 'Done', proposal: { summary: 'x' } }),
    );
    expect(await askPlanner(weddingDetails, 'More guests?')).toEqual({ answer: 'Done' });
  });

  it('extracts fields or explains what to do instead', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ extracted: { city: 'Pune' } }));
    expect(await extractDetails('Party in Pune for my son')).toEqual({ fields: { city: 'Pune' } });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ extracted: {} }));
    expect((await extractDetails('hello there friend')).notice).toMatch(/could not find/);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}, 503));
    expect((await extractDetails('hello there friend')).notice).toMatch(/not configured/);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}, 500));
    expect((await extractDetails('hello there friend')).notice).toMatch(/Could not read/);
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('offline'));
    expect((await extractDetails('hello there friend')).notice).toMatch(/offline/);
  });
});
