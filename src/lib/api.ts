import type { ChangeProposal, ChatTurn, EventDetails, Ideas, Logistics } from '../types.js';
import { fallbackIdeas, parseIdeas } from './ideas.js';
import { isLogistics } from './guards.js';
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

/** Personalised ideas; pass `refine` to adapt the previous ideas to feedback. */
export function fetchIdeas(
  details: EventDetails,
  signal?: AbortSignal,
  refine?: RefineOptions,
): Promise<AiResult<Ideas>> {
  const body = refine
    ? { mode: 'ideas', details, refinement: refine.request, previousThemes: refine.previousThemes }
    : { mode: 'ideas', details };
  return requestWithFallback(body, 'ideas', parseIdeas, () => fallbackIdeas(details), signal);
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
