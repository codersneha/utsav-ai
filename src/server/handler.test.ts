import { beforeEach, describe, expect, it, vi } from 'vitest';
import { geminiIdeas, geminiLogistics, geminiResponse, weddingDetails } from '../test/fixtures.js';
import type { Ideas } from '../types.js';
import {
  MAX_BODY_BYTES,
  MAX_IMAGE_BODY_BYTES,
  handleGenerate,
  stripMarkdown,
  type HandlerDeps,
} from './handler.js';
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
      (await handleGenerate(post('{}', { 'content-length': String(MAX_IMAGE_BODY_BYTES + 1) }), deps()))
        .status,
    ).toBe(413);
    expect((await handleGenerate(post('x'.repeat(MAX_IMAGE_BODY_BYTES + 1)), deps())).status).toBe(413);
    // Only photo uploads may exceed the small limit.
    const big = { mode: 'ideas', details: weddingDetails, padding: 'x'.repeat(MAX_BODY_BYTES) };
    expect((await handleGenerate(post(big), deps())).status).toBe(413);
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
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns validated ideas with security headers and caches them', async () => {
    const d = deps();
    const res = await handleGenerate(post({ mode: 'ideas', details: weddingDetails }), d);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect((await res.json()).ideas.ceremonies[0].theme).toBe('Marigold');

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
    const fetchImpl = vi.fn(async () =>
      geminiResponse(JSON.stringify({ answer: 'Book <b>early</b>.' })),
    ) as unknown as typeof fetch;
    const res = await handleGenerate(
      post({ mode: 'ask', details: weddingDetails, question: 'When to book?' }),
      deps({ fetchImpl }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).answer).toBe('Book b early /b .');
  });
});

describe('stripMarkdown', () => {
  it('removes emphasis, code ticks and heading marks', () => {
    expect(stripMarkdown('## Plan 1. **Venue** first, then `food` and __decor__.')).toBe(
      'Plan 1. Venue first, then food and decor.',
    );
  });
});

describe('handleGenerate — logistics, refinement and conversation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns validated logistics and caches them', async () => {
    const fetchImpl = vi.fn(async () =>
      geminiResponse(JSON.stringify(geminiLogistics)),
    ) as unknown as typeof fetch;
    const d = deps({ fetchImpl });
    const details = { ...weddingDetails, eventType: 'birthday' };
    const res = await handleGenerate(post({ mode: 'logistics', details }), d);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logistics.daySchedule[0].time).toBe('16:00');
    expect(Object.keys(body.logistics.vendors)).toEqual(['caterer']);
    const again = await handleGenerate(post({ mode: 'logistics', details }), d);
    expect((await again.json()).cached).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns 502 for unusable logistics', async () => {
    const fetchImpl = (async () => geminiResponse('{"daySchedule":[]}')) as typeof fetch;
    const res = await handleGenerate(
      post({ mode: 'logistics', details: weddingDetails }),
      deps({ fetchImpl }),
    );
    expect(res.status).toBe(502);
  });

  it('sends refinement feedback and previous themes to the model', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      geminiResponse(JSON.stringify(geminiIdeas)),
    );
    const res = await handleGenerate(
      post({
        mode: 'ideas',
        details: weddingDetails,
        refinement: 'cheaper',
        previousThemes: ['Marigold', 5],
      }),
      deps({ fetchImpl: fetchImpl as typeof fetch }),
    );
    expect(res.status).toBe(200);
    const prompt = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).contents[0].parts[0].text;
    expect(prompt).toContain('USER_FEEDBACK: "cheaper"');
    expect(prompt).toContain('PREVIOUS_THEMES: ["Marigold"]');
  });

  it('rejects a too-short refinement', async () => {
    const res = await handleGenerate(
      post({ mode: 'ideas', details: weddingDetails, refinement: 'x' }),
      deps(),
    );
    expect(res.status).toBe(400);
  });

  it('includes cleaned, capped conversation history in ask prompts', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      geminiResponse(JSON.stringify({ answer: 'Sure.' })),
    );
    const history = [
      ...Array.from({ length: 6 }, (_, i) => ({ question: `Q${i}`, answer: `A${i}` })),
      { question: '', answer: 'orphan' },
    ];
    const res = await handleGenerate(
      post({ mode: 'ask', details: weddingDetails, question: 'And then?', history }),
      deps({ fetchImpl: fetchImpl as typeof fetch }),
    );
    expect(res.status).toBe(200);
    const prompt = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).contents[0].parts[0].text;
    expect(prompt).toContain('"question":"Q0"');
    expect(prompt).not.toContain('"question":"Q4"');
    expect(prompt).not.toContain('orphan');
    expect(prompt).toContain('BUDGET_ESTIMATES');
  });
});

describe('handleGenerate — extraction and change proposals', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('extracts validated form fields from a free-text description without needing details', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      geminiResponse(
        JSON.stringify({
          eventType: 'wedding',
          city: 'Pune',
          guests: 200,
          budget: 800000,
          date: '2027-02-15',
          diets: ['jain', 'keto'],
        }),
      ),
    );
    const res = await handleGenerate(
      post({ mode: 'extract', description: 'Shaadi in Pune, 200 guests, 8 lakh, mid-Feb, Jain food' }),
      deps({ fetchImpl: fetchImpl as typeof fetch }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).extracted).toEqual({
      eventType: 'wedding',
      city: 'Pune',
      guests: 200,
      budget: 800000,
      date: '2027-02-15',
      diets: ['jain'],
    });
    const prompt = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).contents[0].parts[0].text;
    expect(prompt).toContain('DESCRIPTION: "Shaadi in Pune');
  });

  it('rejects too-short descriptions and unusable extractions', async () => {
    expect((await handleGenerate(post({ mode: 'extract', description: 'party' }), deps())).status).toBe(400);
    const fetchImpl = (async () => geminiResponse('{}')) as typeof fetch;
    const res = await handleGenerate(
      post({ mode: 'extract', description: 'something unrelated entirely' }),
      deps({ fetchImpl }),
    );
    expect(res.status).toBe(502);
  });

  it('returns a validated change proposal with the answer', async () => {
    const fetchImpl = (async () =>
      geminiResponse(
        JSON.stringify({
          answer: 'Here is the update.',
          proposal: { guests: 350, budget: 2_200_000, summary: '50 more guests' },
        }),
      )) as typeof fetch;
    const res = await handleGenerate(
      post({ mode: 'ask', details: weddingDetails, question: 'We now have 50 more guests and less money' }),
      deps({ fetchImpl }),
    );
    expect(await res.json()).toEqual({
      answer: 'Here is the update.',
      proposal: { guests: 350, budget: 2_200_000, summary: '50 more guests' },
    });
  });

  it('drops invalid or no-op proposals', async () => {
    for (const proposal of [
      { guests: 999999, summary: 'too many' },
      { guests: 300, summary: 'same' },
      'nonsense',
    ]) {
      const fetchImpl = (async () =>
        geminiResponse(JSON.stringify({ answer: 'OK', proposal }))) as typeof fetch;
      const res = await handleGenerate(
        post({ mode: 'ask', details: weddingDetails, question: 'Change?' }),
        deps({ fetchImpl }),
      );
      expect(await res.json()).toEqual({ answer: 'OK' });
    }
  });

  it('returns 502 when the answer is missing', async () => {
    const fetchImpl = (async () => geminiResponse(JSON.stringify({ proposal: {} }))) as typeof fetch;
    const res = await handleGenerate(
      post({ mode: 'ask', details: weddingDetails, question: 'Hi there' }),
      deps({ fetchImpl }),
    );
    expect(res.status).toBe(502);
  });
});

describe('handleGenerate — sections, photos and venues', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('regenerates one section only, with a smaller schema', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      geminiResponse(JSON.stringify({ menu: geminiIdeas.menu })),
    );
    const res = await handleGenerate(
      post({ mode: 'ideas', details: weddingDetails, section: 'menu' }),
      deps({ fetchImpl: fetchImpl as typeof fetch }),
    );
    expect(Object.keys((await res.json()).ideas)).toEqual(['menu']);
    const sent = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(Object.keys(sent.generationConfig.responseSchema.properties)).toEqual(['menu']);
  });

  const JPEG = btoa('\xff\xd8\xff\xe0' + 'x'.repeat(40));

  it('reads a décor photo and validates the colours', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      geminiResponse(
        JSON.stringify({
          theme: 'Marigold courtyard',
          mood: 'Warm and festive',
          palette: [
            { name: 'Marigold', hex: '#F2A900' },
            { name: 'Bad', hex: 'red' },
          ],
          elements: ['Marigold strings'],
        }),
      ),
    );
    const res = await handleGenerate(
      post({ mode: 'vision', image: JPEG, mimeType: 'image/jpeg' }),
      deps({ fetchImpl: fetchImpl as typeof fetch }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).inspiration.palette).toEqual([{ name: 'Marigold', hex: '#f2a900' }]);
    const parts = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).contents[0].parts;
    expect(parts.some((p: { inlineData?: unknown }) => p.inlineData)).toBe(true);
  });

  it('rejects files that are not really images', async () => {
    const fake = btoa('<script>alert(1)</script>xxxxxxxx');
    const res = await handleGenerate(post({ mode: 'vision', image: fake, mimeType: 'image/jpeg' }), deps());
    expect(res.status).toBe(400);
  });

  it('looks up venues without the AI key and caches them', async () => {
    const mapFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify([{ name: 'Rajbari', lat: '22.5', lon: '88.3', osm_type: 'node', osm_id: 7 }]),
          {
            status: 200,
          },
        ),
    );
    const d = deps({ apiKey: undefined, mapFetch: mapFetch as unknown as typeof fetch });
    const body = { mode: 'venues', action: 'check', name: 'Rajbari', city: 'Kolkata' };
    const res = await handleGenerate(post(body), d);
    expect(res.status).toBe(200);
    expect((await res.json()).venues[0].name).toBe('Rajbari');
    expect((await (await handleGenerate(post(body), d)).json()).cached).toBe(true);
    expect(mapFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects bad venue requests and reports unknown cities', async () => {
    const mapFetch = (async () => new Response('[]', { status: 200 })) as unknown as typeof fetch;
    expect(
      (await handleGenerate(post({ mode: 'venues', action: 'drop', city: 'Kolkata' }), deps())).status,
    ).toBe(400);
    const res = await handleGenerate(
      post({ mode: 'venues', action: 'search', city: 'Atlantis' }),
      deps({ mapFetch }),
    );
    expect(res.status).toBe(404);
  });
});

describe('handleGenerate — restaurant menu photos', () => {
  const JPEG = btoa('\xff\xd8\xff\xe0' + 'x'.repeat(40));
  const page = { data: JPEG, mimeType: 'image/jpeg' };

  it('reads several pages in one request and prices the order in code', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      geminiResponse(
        JSON.stringify({
          items: [{ name: 'Cold Coffee', category: 'drink', price: 160, veg: true, serves: 1 }],
          order: [{ name: 'Cold Coffee', quantity: 10 }],
          note: 'Taxes extra.',
        }),
      ),
    );
    const res = await handleGenerate(
      post({ mode: 'menuScan', details: weddingDetails, images: [page, page, page], budget: 50_000 }),
      deps({ fetchImpl: fetchImpl as typeof fetch }),
    );
    expect(res.status).toBe(200);
    const { order } = await res.json();
    expect(order.total).toBe(1600);
    expect(order.pages).toBe(3);
    const parts = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).contents[0].parts;
    expect(parts.filter((p: { inlineData?: unknown }) => p.inlineData)).toHaveLength(3);
  });

  it('rejects no pages, too many pages and files that are not images', async () => {
    const send = (images: unknown) =>
      handleGenerate(post({ mode: 'menuScan', details: weddingDetails, images }), deps());
    expect((await send([])).status).toBe(400);
    expect((await send(Array(9).fill(page))).status).toBe(400);
    expect((await send([{ data: btoa('not an image at all!!'), mimeType: 'image/jpeg' }])).status).toBe(400);
  });
});
