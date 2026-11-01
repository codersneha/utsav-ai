import { addDays, todayIso } from '../lib/dates.js';
import { GeminiError } from './gemini.js';
import { clientId, json, reason, type HandlerDeps } from './http.js';
import { MAX_BODY_BYTES, MAX_IMAGE_BODY_BYTES, parseJob, type Job } from './jobs.js';
import { LruCache, RateLimiter } from './rateLimit.js';
import { geminiBase, runJob } from './runJob.js';
import { handleVenues } from './venueRoute.js';

export { MAX_BODY_BYTES, MAX_IMAGE_BODY_BYTES } from './jobs.js';
export { stripMarkdown } from './runJob.js';
export type { HandlerDeps } from './http.js';

type Payload = Record<string, unknown>;

const defaultLimiter = new RateLimiter(20, 60_000);
const defaultCache = new LruCache<unknown>(300, 30 * 60_000);
/** Only photo uploads may be large; every other request stays small. */
const PHOTO_MODES = new Set(['vision', 'menuScan']);
/** Chats and photos differ every time; ideas, logistics and extraction are deterministic enough to cache. */
const UNCACHED_MODES = new Set<Job['mode']>(['ask', 'vision', 'menuScan']);

/** Rejects the wrong method, content type or a declared size that is too large. */
function checkHeaders(request: Request): Response | null {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' }, { Allow: 'POST' });
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return json(415, { error: 'Expected application/json' });
  }
  const declared = Number(request.headers.get('content-length') ?? 0);
  return declared > MAX_IMAGE_BODY_BYTES ? json(413, { error: 'Request too large' }) : null;
}

/** Reads the body as a JSON object within the size limit for its mode. */
async function readPayload(request: Request): Promise<Payload | Response> {
  const raw = await request.text();
  if (raw.length > MAX_IMAGE_BODY_BYTES) return json(413, { error: 'Request too large' });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (typeof parsed !== 'object' || parsed === null) return json(400, { error: 'Invalid JSON' });

  const payload = parsed as Payload;
  if (!PHOTO_MODES.has(String(payload.mode)) && raw.length > MAX_BODY_BYTES) {
    return json(413, { error: 'Request too large' });
  }
  return payload;
}

/** Calls Gemini for a validated job, using the cache where answers repeat. */
async function generate(job: Job, deps: HandlerDeps & { apiKey: string }, cache: LruCache<unknown>) {
  const cacheKey = UNCACHED_MODES.has(job.mode) ? '' : JSON.stringify(job);
  const cached = cacheKey ? cache.get(cacheKey) : undefined;
  if (cached) return json(200, { ...(cached as object), cached: true });

  try {
    const body = await runJob(job, geminiBase(deps), deps.fetchImpl);
    if (!body) {
      console.error(`[generate] ${job.mode} failed: model output did not pass validation`);
      return json(502, { error: 'The AI returned an unusable answer' });
    }
    if (cacheKey) cache.set(cacheKey, body);
    return json(200, body);
  } catch (err) {
    // Log the upstream reason for operators; the client only gets a generic message.
    console.error(`[generate] ${job.mode} failed: ${reason(err)}`);
    const status = err instanceof GeminiError && err.status === 504 ? 504 : 502;
    return json(status, { error: 'The AI service is unavailable' });
  }
}

/**
 * POST /api/generate — validates input, enforces limits and calls Gemini.
 * Pure function of (request, deps) so it is fully unit-testable.
 */
export async function handleGenerate(request: Request, deps: HandlerDeps): Promise<Response> {
  const rejected = checkHeaders(request);
  if (rejected) return rejected;
  const payload = await readPayload(request);
  if (payload instanceof Response) return payload;

  // Allow one day of slack so users in any timezone can plan for "today".
  const today = addDays(todayIso(deps.now?.() ?? new Date()), -1);
  const job = parseJob(payload, today);
  if ('error' in job) return json(400, job);

  const retryAfter = (deps.limiter ?? defaultLimiter).check(clientId(request));
  if (retryAfter > 0) return json(429, { error: 'Too many requests' }, { 'Retry-After': String(retryAfter) });

  const cache = deps.cache ?? defaultCache;
  if (job.mode === 'venues') return handleVenues(payload, deps, cache);
  if (!deps.apiKey) return json(503, { error: 'AI is not configured' });
  return generate(job, { ...deps, apiKey: deps.apiKey }, cache);
}
