import type { Venue } from '../types.js';
import { cleanText } from '../lib/validation.js';

/**
 * Venue lookups from OpenStreetMap via Nominatim (free, no API key). Kept behind small
 * functions so a richer provider (e.g. Google Places with ratings and photos)
 * can replace it later without touching the UI.
 * Usage policy: identify ourselves, keep request rates low, cache results.
 */

const USER_AGENT = 'UtsavAI/1.0 (event planner; https://github.com/codersneha/utsav-ai)';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const TIMEOUT_MS = 8_000;
/** Nominatim allows at most one request per second. */
const SPACING_MS = 1_100;

export class VenueLookupError extends Error {}

async function getJson(url: string, fetchImpl: typeof fetch, init: RequestInit = {}): Promise<unknown> {
  const res = await fetchImpl(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new VenueLookupError(`Map service responded with ${res.status}`);
  return res.json();
}

const mapsSearch = (name: string, city: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${city}`)}`;

/** Great-circle distance in km (haversine). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(a)) * 10) / 10;
}

interface NominatimHit {
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
  osm_type?: string;
  osm_id?: number;
  type?: string;
}

const isHit = (v: unknown): v is NominatimHit => typeof v === 'object' && v !== null;

/** The address without the venue's own name or the country. */
function shortAddress(displayName: string, name: string): string {
  const parts = displayName.split(',').map((p) => p.trim());
  if (parts[0]?.toLowerCase() === name.toLowerCase()) parts.shift();
  if (parts.at(-1) === 'India') parts.pop();
  return cleanText(parts.join(', '), 200);
}

/** Turns Nominatim hits into venues, skipping unnamed places, bad coordinates and duplicates. */
function toVenues(data: unknown, city: string, fallbackName = ''): Venue[] {
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  return data.filter(isHit).flatMap((hit) => {
    const lat = Number(hit.lat);
    const lon = Number(hit.lon);
    const name = cleanText(hit.name || fallbackName, 100);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || seen.has(name.toLowerCase())) return [];
    seen.add(name.toLowerCase());
    return [
      {
        name,
        kind: kindOf(hit.type ?? '', name),
        address: shortAddress(hit.display_name ?? '', name),
        lat,
        lon,
        mapsUrl: mapsSearch(name, city),
        osmUrl: `https://www.openstreetmap.org/${hit.osm_type ?? 'node'}/${hit.osm_id ?? ''}`,
      },
    ];
  });
}

/** Looks up a named venue in a city. Returns matches (empty if not on the map). */
export async function checkVenue(
  name: string,
  city: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Venue[]> {
  const url = `${NOMINATIM}?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(`${name}, ${city}`)}`;
  return toVenues(await getJson(url, fetchImpl), city, name);
}

/** Coordinates of a city or town (first match in India). */
export async function geocodeCity(
  city: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ lat: number; lon: number }> {
  const data = await getJson(
    `${NOMINATIM}?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(city)}`,
    fetchImpl,
  );
  const hit = Array.isArray(data) && isHit(data[0]) ? data[0] : null;
  const lat = Number(hit?.lat);
  const lon = Number(hit?.lon);
  if (!hit || !Number.isFinite(lat) || !Number.isFinite(lon)) throw new VenueLookupError('City not found');
  return { lat, lon };
}

const EVENT_NAME = /banquet|marriage|wedding|lawn|bhawan|bhavan|kalyan|mandap|vivah|utsav|hall/i;

function kindOf(type: string, name: string): string {
  if (type === 'events_venue') return 'events venue';
  if (type === 'community_centre') return 'community hall';
  if (type === 'resort') return 'resort';
  if (type === 'hotel') return 'hotel';
  if (/lawn/i.test(name)) return 'lawn';
  if (/banquet|marriage|wedding|kalyan|vivah/i.test(name)) return 'banquet / marriage hall';
  return 'hall';
}

/**
 * Searches, most event-specific first. Bracketed queries are Nominatim special
 * phrases (OSM tags); the others match venue names.
 */
const SEARCHES = [
  '[amenity=events_venue]',
  'banquet',
  'marriage hall',
  '[amenity=community_centre]',
  '[tourism=resort]',
  '[tourism=hotel]',
];
const ENOUGH = 15;
const BOX_DEGREES = 0.12; // ~13 km either side of the centre

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Event venues around a city or town: banquet and marriage halls, community
 * halls, resorts and hotels — event venues first, then nearest first.
 */
export async function findVenues(
  city: string,
  fetchImpl: typeof fetch = fetch,
  { limit = 20, pause = wait }: { limit?: number; pause?: (ms: number) => Promise<unknown> } = {},
): Promise<Venue[]> {
  const centre = await geocodeCity(city, fetchImpl);
  const { lat, lon } = centre;
  const viewbox = [lon - BOX_DEGREES, lat + BOX_DEGREES, lon + BOX_DEGREES, lat - BOX_DEGREES].join(',');
  const found = new Map<string, Venue & { rank: number }>();
  for (const [rank, query] of SEARCHES.entries()) {
    if (found.size >= ENOUGH) break;
    await pause(SPACING_MS);
    const url = `${NOMINATIM}?format=jsonv2&limit=20&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(query)}`;
    for (const venue of toVenues(await getJson(url, fetchImpl), city)) {
      // Name searches can match shops or flats; keep only places named like a venue.
      if (!query.startsWith('[') && !EVENT_NAME.test(venue.name)) continue;
      const key = venue.name.toLowerCase();
      if (found.has(key)) continue;
      found.set(key, { ...venue, distanceKm: distanceKm(lat, lon, venue.lat, venue.lon), rank });
    }
  }
  const eventy = (v: { rank: number; kind: string }) => v.rank < 3 || v.kind === 'banquet / marriage hall';
  return [...found.values()]
    .sort((a, b) => Number(eventy(b)) - Number(eventy(a)) || (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
    .slice(0, limit)
    .map(({ rank: _rank, ...v }) => v);
}
