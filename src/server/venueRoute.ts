import { json, reason, type HandlerDeps } from './http.js';
import { resolveMapsLink } from './mapsLink.js';
import type { LruCache } from './rateLimit.js';

const MAX_LINK_LENGTH = 600;

/** The Google Maps link to read, or null when the request is not a valid link request. */
function linkFrom(payload: Record<string, unknown>): string | null {
  if (payload.action !== 'link' || typeof payload.url !== 'string') return null;
  const link = payload.url.trim().slice(0, MAX_LINK_LENGTH);
  return /^https:\/\//.test(link) ? link : null;
}

/** Reads a venue from a pasted Google Maps link (no AI key needed). Cached, as places rarely move. */
export async function handleVenues(
  payload: Record<string, unknown>,
  deps: HandlerDeps,
  cache: LruCache<unknown>,
): Promise<Response> {
  const link = linkFrom(payload);
  if (!link) return json(400, { error: 'Invalid venue request' });

  const key = `link|${link}`;
  const cached = cache.get(key);
  if (cached) return json(200, { ...(cached as object), cached: true });

  try {
    const venue = await resolveMapsLink(link, deps.mapFetch ?? deps.fetchImpl);
    if (!venue) return json(422, { error: 'That doesn’t look like a Google Maps link to a place' });
    const body = { venues: [venue] };
    cache.set(key, body);
    return json(200, body);
  } catch (err) {
    console.error(`[generate] venues link failed: ${reason(err)}`);
    return json(502, { error: 'Map service unavailable' });
  }
}
