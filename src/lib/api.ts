import type {
  ChangeProposal,
  ChatTurn,
  EventDetails,
  Ideas,
  IdeasSection,
  Inspiration,
  Logistics,
  Venue,
} from '../types.js';
import { isArrayOf, isIdeasPart, isInspiration, isLogistics, isVenue } from './guards.js';
import type { PreparedImage } from './image.js';
import { fallbackIdeas } from './ideas.js';
import { fallbackLogistics } from './logistics.js';

export const CLIENT_TIMEOUT_MS = 25_000;

export interface AiResult<T> {
  value: T;
  /** Set when we fell back to curated content, explaining why. */
  notice?: string;
}

async function postJson(body: unknown, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    return await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function noticeFor(status: number): string {
  if (status === 429)
    return 'You are generating quickly — showing curated suggestions for now. Try again in a minute.';
  if (status === 503) return 'AI is not configured on this deployment — showing curated suggestions.';
  return 'The AI service is busy — showing curated suggestions instead.';
}

const OFFLINE = 'You appear to be offline — showing curated suggestions.';

/**
 * Calls the API and validates the response. Never throws for network or
 * model failures: it degrades to curated content so the user is never stuck.
 */
async function requestWithFallback<T>(
  body: unknown,
  key: string,
  parse: (raw: unknown) => T | null,
  fallback: () => T,
  signal?: AbortSignal,
): Promise<AiResult<T>> {
  try {
    const res = await postJson(body, signal);
    if (!res.ok) return { value: fallback(), notice: noticeFor(res.status) };
    const data = (await res.json()) as Record<string, unknown>;
    const value = parse(data?.[key]);
    return value ? { value } : { value: fallback(), notice: noticeFor(502) };
  } catch (err) {
    if (signal?.aborted) throw err;
    return { value: fallback(), notice: OFFLINE };
  }
}

export interface RefineOptions {
  request: string;
  previousThemes: string[];
}

export interface IdeasOptions {
  refine?: RefineOptions;
  /** Regenerate only this part (decor, menu or extras), leaving the rest untouched. */
  section?: IdeasSection;
}

/**
 * Personalised ideas. For a whole-plan request a failure falls back to the
 * knowledge-base plan; for a section request it returns no change (with a notice).
 */
export function fetchIdeas(
  details: EventDetails,
  signal?: AbortSignal,
  options: IdeasOptions = {},
): Promise<AiResult<Partial<Ideas>>> {
  const { refine, section } = options;
  const body = {
    mode: 'ideas',
    details,
    ...(section ? { section } : {}),
    ...(refine ? { refinement: refine.request, previousThemes: refine.previousThemes } : {}),
  };
  // The server has already validated the model output; check the response shape.
  const parse = (raw: unknown): Partial<Ideas> | null => {
    if (section) return isIdeasPart(raw, section) ? raw : null;
    const whole = isIdeasPart(raw, 'decor') && isIdeasPart(raw, 'menu') && isIdeasPart(raw, 'extras');
    return whole ? { ...raw, source: 'gemini' } : null;
  };
  return requestWithFallback(body, 'ideas', parse, () => (section ? {} : fallbackIdeas(details)), signal);
}

/** Day-of schedule and per-vendor questions/tasks. */
export function fetchLogistics(details: EventDetails, signal?: AbortSignal): Promise<AiResult<Logistics>> {
  return requestWithFallback(
    { mode: 'logistics', details },
    'logistics',
    // The server has already validated the model output; check the response shape.
    (raw) => (isLogistics(raw) && raw.daySchedule.length > 0 ? raw : null),
    () => fallbackLogistics(details.eventType),
    signal,
  );
}

export interface AskResult {
  answer: string;
  proposal?: ChangeProposal;
}

/** Asks a follow-up question with recent conversation as context; may include a change proposal. */
export async function askPlanner(
  details: EventDetails,
  question: string,
  history: ChatTurn[] = [],
): Promise<AskResult> {
  try {
    const turns = history.slice(-4).map(({ question: q, answer }) => ({ question: q, answer }));
    const res = await postJson({ mode: 'ask', details, question, history: turns });
    if (!res.ok) {
      return {
        answer:
          res.status === 429
            ? 'Too many questions at once — please wait a minute.'
            : 'Sorry, I could not answer right now. Please try again shortly.',
      };
    }
    const data = (await res.json()) as { answer?: unknown; proposal?: unknown };
    if (typeof data.answer !== 'string' || !data.answer) return { answer: 'Sorry, I could not answer that.' };
    // The server validated the proposal; re-check its shape before showing an Apply button.
    const p = data.proposal as Partial<ChangeProposal> | undefined;
    const valid =
      p &&
      typeof p.summary === 'string' &&
      (typeof p.guests === 'number' || typeof p.budget === 'number' || typeof p.date === 'string');
    return valid ? { answer: data.answer, proposal: p as ChangeProposal } : { answer: data.answer };
  } catch {
    return { answer: 'You appear to be offline. Please check your connection and try again.' };
  }
}

export interface ExtractResult {
  fields: Partial<EventDetails>;
  /** Set when nothing could be extracted, explaining what to do instead. */
  notice?: string;
}

/** Turns a free-text description into form fields for the user to review. */
export async function extractDetails(description: string): Promise<ExtractResult> {
  try {
    const res = await postJson({ mode: 'extract', description });
    if (!res.ok) {
      return {
        fields: {},
        notice:
          res.status === 503
            ? 'AI is not configured here — please fill in the form below.'
            : 'Could not read that just now — please fill in the form below or try again.',
      };
    }
    const data = (await res.json()) as { extracted?: unknown };
    const fields =
      data.extracted && typeof data.extracted === 'object' ? (data.extracted as Partial<EventDetails>) : {};
    return Object.keys(fields).length > 0
      ? { fields }
      : {
          fields,
          notice:
            'I could not find event details in that — try mentioning the occasion, date, guests and budget.',
        };
  } catch {
    return { fields: {}, notice: 'You appear to be offline — please fill in the form below.' };
  }
}

export interface InspirationResult {
  inspiration?: Inspiration;
  error?: string;
}

/** Reads the décor style (theme, colours, elements) from an inspiration photo. */
export async function analyzePhoto(image: PreparedImage): Promise<InspirationResult> {
  try {
    const res = await postJson({ mode: 'vision', image: image.data, mimeType: image.mimeType });
    if (!res.ok) {
      return {
        error:
          res.status === 503
            ? 'AI is not configured here, so photos cannot be read.'
            : res.status === 413
              ? 'That photo is too large.'
              : 'Could not read that photo just now — please try again.',
      };
    }
    const data = (await res.json()) as { inspiration?: unknown };
    return isInspiration(data.inspiration)
      ? { inspiration: data.inspiration }
      : { error: 'Could not read a décor style from that photo.' };
  } catch {
    return { error: 'You appear to be offline — please try again.' };
  }
}

export interface VenueResult {
  venues: Venue[];
  error?: string;
}

async function venueRequest(body: Record<string, string>): Promise<VenueResult> {
  try {
    const res = await postJson({ mode: 'venues', ...body });
    if (!res.ok) {
      return {
        venues: [],
        error:
          res.status === 404
            ? 'We could not find that city on the map — check the spelling.'
            : res.status === 429
              ? 'Too many searches at once — please wait a minute.'
              : 'The map service is busy — please try again shortly.',
      };
    }
    const data = (await res.json()) as { venues?: unknown };
    // Links are checked so a tampered response cannot point users elsewhere.
    return { venues: isArrayOf(isVenue)(data.venues) ? data.venues : [] };
  } catch {
    return { venues: [], error: 'You appear to be offline — please try again.' };
  }
}

/** Looks up a named venue on the map. */
export const checkVenue = (name: string, city: string) => venueRequest({ action: 'check', name, city });

/** Venues near a city that best match the kind of place wanted. */
export const findVenues = (city: string, venueType = 'undecided', preference = '') =>
  venueRequest({ action: 'search', city, venueType, preference });
