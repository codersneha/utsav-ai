import type { EventDetails, Ideas } from '../types';
import { fallbackIdeas, parseIdeas } from './ideas';

export const CLIENT_TIMEOUT_MS = 25_000;

export interface IdeasResult {
  ideas: Ideas;
  /** Set when we fell back to built-in ideas, explaining why. */
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
    return 'You are generating ideas quickly — showing our curated ideas for now. Try again in a minute.';
  if (status === 503) return 'AI ideas are not configured on this deployment — showing curated ideas.';
  return 'The AI service is busy — showing curated ideas instead.';
}

/**
 * Requests personalised ideas from the API. Never throws for network or
 * model failures: it degrades to curated ideas so the user is never stuck.
 */
export async function fetchIdeas(details: EventDetails, signal?: AbortSignal): Promise<IdeasResult> {
  try {
    const res = await postJson({ mode: 'ideas', details }, signal);
    if (!res.ok) return { ideas: fallbackIdeas(details), notice: noticeFor(res.status) };
    const data: unknown = await res.json();
    const ideas = parseIdeas((data as { ideas?: unknown })?.ideas);
    if (!ideas) return { ideas: fallbackIdeas(details), notice: noticeFor(502) };
    return { ideas };
  } catch (err) {
    if (signal?.aborted) throw err;
    return { ideas: fallbackIdeas(details), notice: 'You appear to be offline — showing curated ideas.' };
  }
}

/** Asks a free-form planning question. Returns a friendly message on failure. */
export async function askPlanner(details: EventDetails, question: string): Promise<string> {
  try {
    const res = await postJson({ mode: 'ask', details, question });
    if (!res.ok)
      return res.status === 429
        ? 'Too many questions at once — please wait a minute.'
        : 'Sorry, I could not answer right now. Please try again shortly.';
    const data = (await res.json()) as { answer?: unknown };
    return typeof data.answer === 'string' && data.answer ? data.answer : 'Sorry, I could not answer that.';
  } catch {
    return 'You appear to be offline. Please check your connection and try again.';
  }
}
