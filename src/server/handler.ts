import { cleanList, cleanObjects, toObject } from '../lib/aiOutput.js';
import {
  ASK_RESPONSE_SCHEMA,
  EXTRACT_RESPONSE_SCHEMA,
  VISION_PROMPT,
  VISION_RESPONSE_SCHEMA,
  isValidImage,
  parseExtracted,
  parseInspiration,
  parseProposal,
} from '../lib/assistant.js';
import { buildBudget, excludedCategories } from '../lib/budget.js';
import { addDays, todayIso } from '../lib/dates.js';
import { IDEAS_SCHEMAS, parseIdeas } from '../lib/ideas.js';
import {
  MENU_SCAN_SCHEMA,
  buildMenuScanPrompt,
  type MenuInput,
  cleanMenuItems,
  parsePartyOrder,
  partyFoodBudget,
} from '../lib/restaurantMenu.js';
import { LOGISTICS_RESPONSE_SCHEMA, parseLogistics } from '../lib/logistics.js';
import {
  SYSTEM_INSTRUCTION,
  buildAskPrompt,
  buildExtractPrompt,
  buildIdeasPrompt,
  buildLogisticsPrompt,
  type Refinement,
} from '../lib/prompts.js';
import { LIMITS, cleanText, isVenueType, validateEventDetails } from '../lib/validation.js';
import type { ChatTurn, EventDetails, IdeasSection, MenuItem, Venue } from '../types.js';
import { DEFAULT_MODEL, GeminiError, generateText, type GeminiRequest } from './gemini.js';
import { LruCache, RateLimiter } from './rateLimit.js';
import {
  VenueLookupError,
  checkVenue,
  findVenues,
  geocodeCity,
  resolveMapsLink,
  type Area,
} from './venues.js';

export const MAX_BODY_BYTES = 16 * 1024;
/** Photo uploads are resized in the browser; up to 8 menu pages fit under Vercel's 4.5 MB limit. */
export const MAX_IMAGE_BODY_BYTES = 4_200_000;
/** One photo, base64-encoded. */
const MAX_PHOTO_CHARS = 1_500_000;
const MAX_MENU_PAGES = 8;
const MENU_TIMEOUT_MS = 45_000;
const MAX_HISTORY = 4;
const SECTIONS: IdeasSection[] = ['decor', 'menu', 'extras'];

/** Removes Markdown emphasis and heading marks the UI would show literally. */
export function stripMarkdown(text: string): string {
  return text.replace(/(\*\*|__|`)/g, '').replace(/(^|\s)#{1,6}\s/g, '$1');
}

export interface HandlerDeps {
  apiKey: string | undefined;
  /** Used for map (venue) lookups; defaults to fetchImpl. */
  mapFetch?: typeof fetch;
  /** Optional Google Places key: Google-quality venue search with ratings. */
  placesKey?: string;
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
  | { mode: 'venues' }
  | { mode: 'extract'; description: string; today: string }
  | { mode: 'vision'; image: { data: string; mimeType: string } }
  | {
      mode: 'menuScan';
      details: EventDetails;
      input: MenuInput;
      images: { data: string; mimeType: string }[];
      known: MenuItem[];
      budget: number;
    }
  | { mode: 'ideas'; details: EventDetails; refinement?: Refinement; section?: IdeasSection }
  | { mode: 'logistics'; details: EventDetails }
  | { mode: 'ask'; details: EventDetails; question: string; history: ChatTurn[]; today: string };

const pickTurn = (o: Record<string, unknown>): ChatTurn | null => {
  const turn = { question: cleanText(o.question, LIMITS.questionMax), answer: cleanText(o.answer, 600) };
  return turn.question && turn.answer ? turn : null;
};

/** Turns the untrusted payload into a Job, or an error message for a 400. */
function parseJob(payload: Record<string, unknown>, today: string): Job | { error: string; fields?: object } {
  if (payload.mode === 'venues') return { mode: 'venues' };
  if (payload.mode === 'vision') {
    if (!isValidImage(payload.image, payload.mimeType, MAX_IMAGE_BODY_BYTES))
      return { error: 'Invalid image' };
    return { mode: 'vision', image: { data: payload.image, mimeType: payload.mimeType as string } };
  }
  if (payload.mode === 'extract') {
    const description = cleanText(payload.description, LIMITS.describeMax);
    if (description.length < LIMITS.describeMin) return { error: 'Description is too short' };
    return { mode: 'extract', description, today };
  }
  const result = validateEventDetails(payload.details, today);
  if (!result.ok) return { error: 'Invalid event details', fields: result.errors };
  const details = result.value;

  switch (payload.mode) {
    case 'menuScan': {
      const given = Math.round(Number(payload.budget));
      const budget =
        Number.isFinite(given) && given > 0 ? Math.min(given, details.budget) : partyFoodBudget(details);
      const known = cleanMenuItems(payload.known);
      if (payload.source === 'estimate')
        return { mode: 'menuScan', details, input: { source: 'estimate' }, images: [], known: [], budget };
      if (payload.source === 'text') {
        const text = cleanText(payload.text, LIMITS.menuTextMax);
        if (text.length < LIMITS.menuTextMin) return { error: 'Menu text is too short' };
        return { mode: 'menuScan', details, input: { source: 'text', text }, images: [], known, budget };
      }
      const photos = Array.isArray(payload.images) ? payload.images : [];
      if (photos.length < 1 || photos.length > MAX_MENU_PAGES) return { error: 'Add 1 to 8 menu photos' };
      const images: { data: string; mimeType: string }[] = [];
      for (const p of photos) {
        const photo = (p ?? {}) as Record<string, unknown>;
        if (!isValidImage(photo.data, photo.mimeType, MAX_PHOTO_CHARS)) return { error: 'Invalid image' };
        images.push({ data: photo.data, mimeType: photo.mimeType as string });
      }
      return { mode: 'menuScan', details, input: { source: 'photos' }, images, known, budget };
    }
    case 'ideas': {
      const section = SECTIONS.find((x) => x === payload.section);
      if (payload.section !== undefined && !section) return { error: 'Unknown section' };
      const request = cleanText(payload.refinement, LIMITS.refinementMax);
      if (!request) return { mode: 'ideas', details, section };
      if (request.length < 3) return { error: 'Refinement is too short' };
      return {
        mode: 'ideas',
        details,
        section,
        refinement: { request, previousThemes: cleanList(payload.previousThemes, 8, 60) },
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
    case 'venues':
      return null;
    case 'ideas': {
      const prompt = buildIdeasPrompt(job.details, job.refinement, job.section);
      const schema = IDEAS_SCHEMAS[job.section ?? 'all'];
      const text = await generateText(
        { ...base, prompt, responseSchema: schema, maxOutputTokens: 8192 },
        fetchImpl,
      );
      const ideas = parseIdeas(text, job.details, job.section);
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
      const budget = buildBudget(
        details.eventType,
        details.budget,
        details.guests,
        details.priorities,
        {},
        excludedCategories(details),
      );
      const prompt = buildAskPrompt(details, budget, job.history, job.question, job.today);
      const text = await generateText(
        { ...base, prompt, responseSchema: ASK_RESPONSE_SCHEMA, temperature: 0.5, maxOutputTokens: 2048 },
        fetchImpl,
      );
      const obj = toObject(text);
      const answer = stripMarkdown(cleanText(obj?.answer, 1200));
      if (!answer) return null;
      const proposal = parseProposal(obj?.proposal, details, job.today);
      return proposal ? { answer, proposal } : { answer };
    }
    case 'menuScan': {
      const text = await generateText(
        {
          ...base,
          prompt: buildMenuScanPrompt(job.details, job.budget, job.known, job.input),
          ...(job.images.length > 0 ? { images: job.images } : {}),
          responseSchema: MENU_SCAN_SCHEMA,
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
        fetchImpl,
        // Several menu pages take longer to read than other requests.
        MENU_TIMEOUT_MS,
      );
      const order = parsePartyOrder(text, job.details.guests, job.budget, job.known, job.images.length);
      return order ? { order: { ...order, source: job.input.source } } : null;
    }
    case 'vision': {
      const text = await generateText(
        {
          ...base,
          prompt: VISION_PROMPT,
          image: job.image,
          responseSchema: VISION_RESPONSE_SCHEMA,
          temperature: 0.3,
        },
        fetchImpl,
      );
      const inspiration = parseInspiration(text);
      return inspiration ? { inspiration } : null;
    }
    case 'extract': {
      const prompt = buildExtractPrompt(job.description, job.today);
      const text = await generateText(
        { ...base, prompt, responseSchema: EXTRACT_RESPONSE_SCHEMA, temperature: 0.1, maxOutputTokens: 2048 },
        fetchImpl,
      );
      const extracted = parseExtracted(text, job.today);
      return extracted ? { extracted } : null;
    }
  }
}

/** Venue check, search and Google Maps links via the map provider (no AI key needed). Cached for a day. */
async function handleVenues(
  payload: Record<string, unknown>,
  deps: HandlerDeps,
  cache: LruCache<unknown>,
): Promise<Response> {
  const action =
    payload.action === 'check' || payload.action === 'search' || payload.action === 'link'
      ? payload.action
      : null;
  const city = cleanText(payload.city, LIMITS.cityMax);
  const name = cleanText(payload.name, LIMITS.venueMax);
  const link = typeof payload.url === 'string' ? payload.url.trim().slice(0, 600) : '';
  const near = cleanText(payload.near, LIMITS.cityMax) || city;
  const radiusKm = payload.radiusKm === 25 ? 25 : 12;
  const invalid =
    !action ||
    (action === 'link' ? !/^https:\/\//.test(link) : city.length < 2) ||
    (action === 'check' && name.length < 2);
  if (invalid) return json(400, { error: 'Invalid venue request' });

  const venueType = isVenueType(payload.venueType) ? payload.venueType : 'undecided';
  const preference = cleanText(payload.preference, LIMITS.venueMax);
  const key = [action, city, name, link, near, radiusKm, venueType, preference, payload.lat, payload.lon]
    .join('|')
    .toLowerCase();
  const cached = cache.get(key);
  if (cached) return json(200, { ...(cached as object), cached: true });
  const fetchImpl = deps.mapFetch ?? deps.fetchImpl;
  try {
    let body: { venues: Venue[]; area?: Area };
    if (action === 'link') {
      const venue = await resolveMapsLink(link, fetchImpl);
      if (!venue) return json(422, { error: 'That doesn’t look like a Google Maps link to a place' });
      body = { venues: [venue] };
    } else if (action === 'check') {
      body = { venues: await checkVenue(name, city, fetchImpl, undefined, deps.placesKey) };
    } else {
      // "Near me" sends the browser's location; otherwise the typed area is located on the map.
      const lat = Number(payload.lat);
      const lon = Number(payload.lon);
      const inIndia = lat >= 6 && lat <= 37 && lon >= 68 && lon <= 98;
      const area: Area = inIndia
        ? { name: 'your current location', lat, lon }
        : await geocodeCity(near, fetchImpl);
      body = {
        venues: await findVenues(city, fetchImpl, {
          venueType,
          preference,
          centre: area,
          radiusKm,
          placesKey: deps.placesKey,
        }),
        area,
      };
    }
    cache.set(key, body);
    return json(200, body);
  } catch (err) {
    console.error(
      `[generate] venues ${action} failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    );
    const notFound = err instanceof VenueLookupError && err.message === 'City not found';
    return json(notFound ? 404 : 502, {
      error: notFound ? 'City not found on the map' : 'Map service unavailable',
    });
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
  if (declared > MAX_IMAGE_BODY_BYTES) return json(413, { error: 'Request too large' });

  const raw = await request.text();
  if (raw.length > MAX_IMAGE_BODY_BYTES) return json(413, { error: 'Request too large' });

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
    payload = parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  // Only photo uploads may be large; every other request stays small.
  if (payload.mode !== 'vision' && payload.mode !== 'menuScan' && raw.length > MAX_BODY_BYTES)
    return json(413, { error: 'Request too large' });

  // Allow one day of slack so users in any timezone can plan for "today".
  const today = addDays(todayIso(deps.now?.() ?? new Date()), -1);
  const job = parseJob(payload, today);
  if ('error' in job) return json(400, job);

  const retryAfter = (deps.limiter ?? defaultLimiter).check(clientId(request));
  if (retryAfter > 0) {
    return json(429, { error: 'Too many requests' }, { 'Retry-After': String(retryAfter) });
  }

  const cache = deps.cache ?? defaultCache;
  if (payload.mode === 'venues') return handleVenues(payload, deps, cache);

  if (!deps.apiKey) return json(503, { error: 'AI is not configured' });

  // Ideas, logistics and extraction are deterministic enough to cache; chats and photos are not.
  const cacheKey =
    job.mode === 'ask' || job.mode === 'vision' || job.mode === 'menuScan' ? '' : JSON.stringify(job);
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
