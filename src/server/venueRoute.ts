import { LIMITS, cleanText, isVenueType } from '../lib/validation.js';
import type { Venue, VenueType } from '../types.js';
import { json, reason, type HandlerDeps } from './http.js';
import type { LruCache } from './rateLimit.js';
import {
  VenueLookupError,
  checkVenue,
  findVenues,
  geocodeCity,
  resolveMapsLink,
  type Area,
} from './venues.js';

type Action = 'check' | 'search' | 'link';
type Payload = Record<string, unknown>;
type VenueBody = { venues: Venue[]; area?: Area };

interface VenueRequest {
  action: Action;
  city: string;
  name: string;
  link: string;
  near: string;
  radiusKm: 12 | 25;
  venueType: VenueType;
  preference: string;
  /** Kept as sent: only used for the cache key and the "near me" search. */
  lat: unknown;
  lon: unknown;
}

const isAction = (value: unknown): value is Action =>
  value === 'check' || value === 'search' || value === 'link';

/** Reads the venue request, or returns null when it is incomplete. */
function parseVenueRequest(payload: Payload): VenueRequest | null {
  if (!isAction(payload.action)) return null;
  const action = payload.action;
  const city = cleanText(payload.city, LIMITS.cityMax);
  const name = cleanText(payload.name, LIMITS.venueMax);
  const link = typeof payload.url === 'string' ? payload.url.trim().slice(0, 600) : '';

  if (action === 'link' ? !/^https:\/\//.test(link) : city.length < 2) return null;
  if (action === 'check' && name.length < 2) return null;

  return {
    action,
    city,
    name,
    link,
    near: cleanText(payload.near, LIMITS.cityMax) || city,
    radiusKm: payload.radiusKm === 25 ? 25 : 12,
    venueType: isVenueType(payload.venueType) ? payload.venueType : 'undecided',
    preference: cleanText(payload.preference, LIMITS.venueMax),
    lat: payload.lat,
    lon: payload.lon,
  };
}

const cacheKey = (r: VenueRequest) =>
  [r.action, r.city, r.name, r.link, r.near, r.radiusKm, r.venueType, r.preference, r.lat, r.lon]
    .join('|')
    .toLowerCase();

/** "Near me" sends the browser's location; otherwise the typed area is located on the map. */
async function searchArea(r: VenueRequest, fetchImpl?: typeof fetch): Promise<Area> {
  const lat = Number(r.lat);
  const lon = Number(r.lon);
  const inIndia = lat >= 6 && lat <= 37 && lon >= 68 && lon <= 98;
  return inIndia ? { name: 'your current location', lat, lon } : geocodeCity(r.near, fetchImpl);
}

/** Looks the venue up on the map; null means the link was not a Google Maps place. */
async function lookupVenues(r: VenueRequest, deps: HandlerDeps): Promise<VenueBody | null> {
  const fetchImpl = deps.mapFetch ?? deps.fetchImpl;
  if (r.action === 'link') {
    const venue = await resolveMapsLink(r.link, fetchImpl);
    return venue ? { venues: [venue] } : null;
  }
  if (r.action === 'check') {
    return { venues: await checkVenue(r.name, r.city, fetchImpl, undefined, deps.placesKey) };
  }
  const area = await searchArea(r, fetchImpl);
  const venues = await findVenues(r.city, fetchImpl, {
    venueType: r.venueType,
    preference: r.preference,
    centre: area,
    radiusKm: r.radiusKm,
    placesKey: deps.placesKey,
  });
  return { venues, area };
}

function venueFailure(action: Action, err: unknown): Response {
  console.error(`[generate] venues ${action} failed: ${reason(err)}`);
  const notFound = err instanceof VenueLookupError && err.message === 'City not found';
  return json(notFound ? 404 : 502, {
    error: notFound ? 'City not found on the map' : 'Map service unavailable',
  });
}

/** Venue check, search and Google Maps links via the map provider (no AI key needed). Cached for a day. */
export async function handleVenues(
  payload: Payload,
  deps: HandlerDeps,
  cache: LruCache<unknown>,
): Promise<Response> {
  const venueRequest = parseVenueRequest(payload);
  if (!venueRequest) return json(400, { error: 'Invalid venue request' });

  const key = cacheKey(venueRequest);
  const cached = cache.get(key);
  if (cached) return json(200, { ...(cached as object), cached: true });

  try {
    const body = await lookupVenues(venueRequest, deps);
    if (!body) return json(422, { error: 'That doesn’t look like a Google Maps link to a place' });
    cache.set(key, body);
    return json(200, body);
  } catch (err) {
    return venueFailure(venueRequest.action, err);
  }
}
