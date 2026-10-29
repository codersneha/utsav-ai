import type { ChatTurn, EventDetails, Ideas, Logistics } from '../types.js';
import { fallbackIdeas, parseIdeas } from './ideas.js';
import { fallbackLogistics, parseLogistics } from './logistics.js';

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
    (raw) => parseLogistics(raw, details.eventType),
    () => fallbackLogistics(details.eventType),
    signal,
  );
}

/** Asks a follow-up question with recent conversation as context. */
export async function askPlanner(
  details: EventDetails,
  question: string,
  history: ChatTurn[] = [],
): Promise<string> {
  try {
    const res = await postJson({ mode: 'ask', details, question, history: history.slice(-4) });
    if (!res.ok) {
      return res.status === 429
        ? 'Too many questions at once — please wait a minute.'
        : 'Sorry, I could not answer right now. Please try again shortly.';
    }
    const data = (await res.json()) as { answer?: unknown };
    return typeof data.answer === 'string' && data.answer ? data.answer : 'Sorry, I could not answer that.';
  } catch {
    return 'You appear to be offline. Please check your connection and try again.';
  }
}
