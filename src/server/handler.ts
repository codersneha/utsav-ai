import { cleanList, cleanObjects, toObject } from '../lib/aiOutput.js';
import {
  ASK_RESPONSE_SCHEMA,
  EXTRACT_RESPONSE_SCHEMA,
  parseExtracted,
  parseProposal,
} from '../lib/assistant.js';
import { buildBudget } from '../lib/budget.js';
import { addDays, todayIso } from '../lib/dates.js';
import { IDEAS_RESPONSE_SCHEMA, parseIdeas } from '../lib/ideas.js';
import { LOGISTICS_RESPONSE_SCHEMA, parseLogistics } from '../lib/logistics.js';
import {
  SYSTEM_INSTRUCTION,
  buildAskPrompt,
  buildExtractPrompt,
  buildIdeasPrompt,
  buildLogisticsPrompt,
  type Refinement,
} from '../lib/prompts.js';
import { LIMITS, cleanText, validateEventDetails } from '../lib/validation.js';
import type { ChatTurn, EventDetails } from '../types.js';
import { DEFAULT_MODEL, GeminiError, generateText, type GeminiRequest } from './gemini.js';
import { LruCache, RateLimiter } from './rateLimit.js';

export const MAX_BODY_BYTES = 16 * 1024;
const MAX_HISTORY = 4;

/** Removes Markdown emphasis and heading marks the UI would show literally. */
export function stripMarkdown(text: string): string {
  return text.replace(/(\*\*|__|`)/g, '').replace(/(^|\s)#{1,6}\s/g, '$1');
}

export interface HandlerDeps {
  apiKey: string | undefined;
  model?: string;
  fetchImpl?: typeof fetch;
  limiter?: RateLimiter;
  cache?: LruCache<unknown>;
  now?: () => Date;
}

const defaultLimiter = new RateLimiter(20, 60_000);
const defaultCache = new LruCache<unknown>(300, 30 * 60_000);

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

/** Validated, mode-specific request — everything the model sees has been cleaned. */
type Job =
  | { mode: 'extract'; description: string; today: string }
  | { mode: 'ideas'; details: EventDetails; refinement?: Refinement }
  | { mode: 'logistics'; details: EventDetails }
  | { mode: 'ask'; details: EventDetails; question: string; history: ChatTurn[]; today: string };

const pickTurn = (o: Record<string, unknown>): ChatTurn | null => {
  const turn = { question: cleanText(o.question, LIMITS.questionMax), answer: cleanText(o.answer, 600) };
  return turn.question && turn.answer ? turn : null;
};

/** Turns the untrusted payload into a Job, or an error message for a 400. */
function parseJob(payload: Record<string, unknown>, today: string): Job | { error: string; fields?: object } {
  if (payload.mode === 'extract') {
    const description = cleanText(payload.description, LIMITS.describeMax);
    if (description.length < LIMITS.describeMin) return { error: 'Description is too short' };
    return { mode: 'extract', description, today };
  }
  const result = validateEventDetails(payload.details, today);
  if (!result.ok) return { error: 'Invalid event details', fields: result.errors };
  const details = result.value;

  switch (payload.mode) {
    case 'ideas': {
      const request = cleanText(payload.refinement, LIMITS.refinementMax);
      if (!request) return { mode: 'ideas', details };
      if (request.length < 3) return { error: 'Refinement is too short' };
      return {
        mode: 'ideas',
        details,
        refinement: { request, previousThemes: cleanList(payload.previousThemes, 4, 60) },
      };
    }
    case 'logistics':
      return { mode: 'logistics', details };
    case 'ask': {
      const question = cleanText(payload.question, LIMITS.questionMax);
      if (question.length < 3) return { error: 'Question is too short' };
      return {
        mode: 'ask',
        details,
        question,
        history: cleanObjects(payload.history, MAX_HISTORY, pickTurn),
        today,
      };
    }
    default:
      return { error: 'Unknown mode' };
  }
}

/** Runs a job against Gemini and returns the response body, or null if the output was unusable. */
async function runJob(job: Job, base: Omit<GeminiRequest, 'prompt'>, fetchImpl?: typeof fetch) {
  switch (job.mode) {
    case 'ideas': {
      const prompt = buildIdeasPrompt(job.details, job.refinement);
      const text = await generateText({ ...base, prompt, responseSchema: IDEAS_RESPONSE_SCHEMA }, fetchImpl);
      const ideas = parseIdeas(text);
      return ideas ? { ideas } : null;
    }
    case 'logistics': {
      const prompt = buildLogisticsPrompt(job.details);
      const text = await generateText(
        { ...base, prompt, responseSchema: LOGISTICS_RESPONSE_SCHEMA, temperature: 0.4 },
        fetchImpl,
      );
      const logistics = parseLogistics(text, job.details.eventType);
      return logistics ? { logistics } : null;
    }
    case 'ask': {
      const { details } = job;
      const budget = buildBudget(details.eventType, details.budget, details.guests, details.priorities);
      const prompt = buildAskPrompt(details, budget, job.history, job.question, job.today);
      const text = await generateText(
        { ...base, prompt, responseSchema: ASK_RESPONSE_SCHEMA, temperature: 0.5, maxOutputTokens: 1024 },
        fetchImpl,
      );
      const obj = toObject(text);
      const answer = stripMarkdown(cleanText(obj?.answer, 1200));
      if (!answer) return null;
      const proposal = parseProposal(obj?.proposal, details, job.today);
      return proposal ? { answer, proposal } : { answer };
    }
    case 'extract': {
      const prompt = buildExtractPrompt(job.description, job.today);
      const text = await generateText(
        { ...base, prompt, responseSchema: EXTRACT_RESPONSE_SCHEMA, temperature: 0.1, maxOutputTokens: 1024 },
        fetchImpl,
      );
      const extracted = parseExtracted(text, job.today);
      return extracted ? { extracted } : null;
    }
  }
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

  // Allow one day of slack so users in any timezone can plan for "today".
  const today = addDays(todayIso(deps.now?.() ?? new Date()), -1);
  const job = parseJob(payload, today);
  if ('error' in job) return json(400, job);

  const retryAfter = (deps.limiter ?? defaultLimiter).check(clientId(request));
  if (retryAfter > 0) {
    return json(429, { error: 'Too many requests' }, { 'Retry-After': String(retryAfter) });
  }

  if (!deps.apiKey) return json(503, { error: 'AI is not configured' });

  // Ideas, logistics and extraction are deterministic enough to cache; conversations are not.
  const cache = deps.cache ?? defaultCache;
  const cacheKey = job.mode === 'ask' ? '' : JSON.stringify(job);
  const cached = cacheKey ? cache.get(cacheKey) : undefined;
  if (cached) return json(200, { ...(cached as object), cached: true });

  const base = {
    apiKey: deps.apiKey,
    model: deps.model || DEFAULT_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
  };
  try {
    const body = await runJob(job, base, deps.fetchImpl);
    if (!body) {
      console.error(`[generate] ${job.mode} failed: model output did not pass validation`);
      return json(502, { error: 'The AI returned an unusable answer' });
    }
    if (cacheKey) cache.set(cacheKey, body);
    return json(200, body);
  } catch (err) {
    // Log the upstream reason for operators; the client only gets a generic message.
    console.error(`[generate] ${job.mode} failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    const status = err instanceof GeminiError && err.status === 504 ? 504 : 502;
    return json(status, { error: 'The AI service is unavailable' });
  }
}
