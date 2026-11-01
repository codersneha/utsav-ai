import type { LruCache, RateLimiter } from './rateLimit.js';

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

export function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
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

export function clientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || 'anonymous';
}

/** A short, safe reason for the server log; the client only ever gets a generic message. */
export function reason(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown error';
}
