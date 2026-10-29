import { addDays, todayIso } from '../lib/dates';
import {
  IDEAS_RESPONSE_SCHEMA,
  SYSTEM_INSTRUCTION,
  buildAskPrompt,
  buildIdeasPrompt,
  parseIdeas,
} from '../lib/ideas';
import { LIMITS, cleanText, validateEventDetails } from '../lib/validation';
import type { Ideas } from '../types';
import { DEFAULT_MODEL, GeminiError, generateText } from './gemini';
import { LruCache, RateLimiter } from './rateLimit';

export const MAX_BODY_BYTES = 8 * 1024;

export interface HandlerDeps {
  apiKey: string | undefined;
  model?: string;
  fetchImpl?: typeof fetch;
  limiter?: RateLimiter;
  cache?: LruCache<Ideas>;
  now?: () => Date;
}

const defaultLimiter = new RateLimiter(12, 60_000);
const defaultCache = new LruCache<Ideas>(200, 30 * 60_000);

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}

function clientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || 'anonymous';
}

/**
 * POST /api/generate — validates input, enforces limits and calls Gemini.
 * Pure function of (request, deps) so it is fully unit-testable.
 */
export async function handleGenerate(request: Request, deps: HandlerDeps): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' }, { Allow: 'POST' });
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return json(415, { error: 'Expected application/json' });
  }
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return json(413, { error: 'Request too large' });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'Request too large' });

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
    payload = parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const mode = payload.mode;
  if (mode !== 'ideas' && mode !== 'ask') return json(400, { error: 'Unknown mode' });

  // Allow one day of slack so users in any timezone can plan for "today".
  const today = addDays(todayIso(deps.now?.() ?? new Date()), -1);
  const result = validateEventDetails(payload.details, today);
  if (!result.ok) return json(400, { error: 'Invalid event details', fields: result.errors });
  const details = result.value;

  const question = mode === 'ask' ? cleanText(payload.question, LIMITS.questionMax) : '';
  if (mode === 'ask' && question.length < 3) return json(400, { error: 'Question is too short' });

  const retryAfter = (deps.limiter ?? defaultLimiter).check(clientId(request));
  if (retryAfter > 0) {
    return json(429, { error: 'Too many requests' }, { 'Retry-After': String(retryAfter) });
  }

  if (!deps.apiKey) return json(503, { error: 'AI is not configured' });

  const cache = deps.cache ?? defaultCache;
  const cacheKey = JSON.stringify(details);
  if (mode === 'ideas') {
    const cached = cache.get(cacheKey);
    if (cached) return json(200, { ideas: cached, cached: true });
  }

  const common = {
    apiKey: deps.apiKey,
    model: deps.model || DEFAULT_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
  };

  try {
    if (mode === 'ideas') {
      const text = await generateText(
        { ...common, prompt: buildIdeasPrompt(details), responseSchema: IDEAS_RESPONSE_SCHEMA },
        deps.fetchImpl,
      );
      const ideas = parseIdeas(text);
      if (!ideas) return json(502, { error: 'The AI returned an unusable answer' });
      cache.set(cacheKey, ideas);
      return json(200, { ideas });
    }

    const text = await generateText(
      { ...common, prompt: buildAskPrompt(details, question), temperature: 0.5, maxOutputTokens: 1024 },
      deps.fetchImpl,
    );
    return json(200, { answer: cleanText(text, 1200) });
  } catch (err) {
    const status = err instanceof GeminiError && err.status === 504 ? 504 : 502;
    return json(status, { error: 'The AI service is unavailable' });
  }
}
