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
