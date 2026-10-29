import { describe, expect, it, vi } from 'vitest';
import { geminiResponse } from '../test/fixtures.js';
import { GeminiError, generateText } from './gemini.js';

const base = { apiKey: 'test-key', model: 'gemini-test', systemInstruction: 'sys', prompt: 'hi' };

describe('generateText', () => {
  it('sends the key in a header (never the URL) and requests JSON when a schema is given', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      geminiResponse('{"ok":1}'),
    );
    const text = await generateText(
      { ...base, responseSchema: { type: 'OBJECT' } },
      fetchImpl as typeof fetch,
    );
    expect(text).toBe('{"ok":1}');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain('/models/gemini-test:generateContent');
    expect(String(url)).not.toContain('test-key');
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(String(init?.body));
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
    expect(body.systemInstruction.parts[0].text).toBe('sys');
  });

  it('omits JSON mode for plain text requests', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => geminiResponse('answer'));
    await generateText(base, fetchImpl as typeof fetch);
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(body.generationConfig.responseMimeType).toBeUndefined();
  });

  it('throws GeminiError on HTTP errors and empty responses', async () => {
    await expect(
      generateText(base, (async () => geminiResponse('', 429)) as typeof fetch),
    ).rejects.toMatchObject({
      status: 429,
    });
    await expect(
      generateText(base, (async () => new Response(JSON.stringify({}), { status: 200 })) as typeof fetch),
    ).rejects.toBeInstanceOf(GeminiError);
  });

  it('maps network failures to 502 and timeouts to 504', async () => {
    await expect(
      generateText(base, (async () => {
        throw new TypeError('network');
      }) as typeof fetch),
    ).rejects.toMatchObject({ status: 502 });

    const hanging = ((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
        );
      })) as typeof fetch;
    await expect(generateText(base, hanging, 10)).rejects.toMatchObject({ status: 504 });
  });
});

describe('generateText retries', () => {
  it('retries once on a temporary 503 and then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'The model is overloaded.' } }), { status: 503 }),
      )
      .mockResolvedValueOnce(geminiResponse('recovered'));
    expect(await generateText(base, fetchImpl as typeof fetch, 5000, 0)).toBe('recovered');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('gives up after the last attempt and reports Google’s reason', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: 'The model is overloaded.' } }), { status: 503 }),
    );
    await expect(generateText(base, fetchImpl as typeof fetch, 5000, 0)).rejects.toThrow(
      'Gemini responded with 503: The model is overloaded.',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry client errors or when too little time remains', async () => {
    const bad = vi.fn(async () => new Response('not json', { status: 400 }));
    await expect(generateText(base, bad as typeof fetch, 5000, 0)).rejects.toThrow(
      'Gemini responded with 400',
    );
    expect(bad).toHaveBeenCalledTimes(1);

    const busy = vi.fn(async () => new Response('{}', { status: 503 }));
    await expect(generateText(base, busy as typeof fetch, 1000, 0)).rejects.toMatchObject({ status: 503 });
    expect(busy).toHaveBeenCalledTimes(1);
  });
});

describe('generateText stall handling', () => {
  it('retries a stalled first attempt within the overall budget', async () => {
    let calls = 0;
    const fetchImpl = ((_url: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        });
      }
      return Promise.resolve(geminiResponse('second try'));
    }) as typeof fetch;
    const started = Date.now();
    expect(await generateText(base, fetchImpl, 6000, 0)).toBe('second try');
    expect(calls).toBe(2);
    expect(Date.now() - started).toBeLessThan(6000);
  });
});
