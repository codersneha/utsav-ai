import type { Venue, VenueType } from '../types.js';
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

const KINDS: Record<string, string> = {
  events_venue: 'events venue',
  community_centre: 'community hall',
  conference_centre: 'conference centre',
  resort: 'resort',
  hotel: 'hotel',
  restaurant: 'restaurant',
  cafe: 'café',
  bar: 'bar',
  pub: 'pub',
};

function kindOf(type: string, name: string): string {
  if (KINDS[type]) return KINDS[type];
  if (/roof ?top|terrace/i.test(name)) return 'rooftop';
  if (/lawn|garden/i.test(name)) return 'lawn / garden';
  if (/banquet|marriage|wedding|kalyan|vivah/i.test(name)) return 'banquet / marriage hall';
  return 'hall';
}

/**
 * Searches for each kind of place. Bracketed queries are Nominatim special
 * phrases (OSM tags); the others match words in venue names.
 */
const EVENT_SEARCHES = ['[amenity=events_venue]', 'banquet', 'marriage hall', '[amenity=community_centre]'];

export const TYPE_SEARCHES: Record<VenueType, string[]> = {
  undecided: [...EVENT_SEARCHES, '[tourism=resort]', '[tourism=hotel]'],
  banquet: ['[amenity=events_venue]', 'banquet', 'marriage hall', '[tourism=hotel]'],
  outdoor: ['lawn', 'garden', '[tourism=resort]', '[amenity=events_venue]'],
  home: [...EVENT_SEARCHES],
  'community-hall': ['[amenity=community_centre]', '[amenity=events_venue]', 'marriage hall'],
  temple: ['kalyana mandapam', 'marriage hall', '[amenity=community_centre]'],
  restaurant: ['[amenity=restaurant]', 'banquet'],
  cafe: ['[amenity=cafe]'],
  hotel: ['[tourism=hotel]', '[tourism=resort]'],
  office: ['[amenity=conference_centre]', 'auditorium', '[tourism=hotel]'],
};

/** Words people use for a kind of place, and how to search for it. */
const PREFERENCE_SEARCHES: [RegExp, string[]][] = [
  [/roof ?top|terrace/i, ['rooftop', 'terrace']],
  [/\bbars?\b|pub|lounge|brewery/i, ['[amenity=bar]', '[amenity=pub]']],
  [/restaurant|dine|dining|dinner|lunch/i, ['[amenity=restaurant]']],
  [/caf[eé]|coffee/i, ['[amenity=cafe]']],
  [/garden|lawn|outdoor|open[- ]air/i, ['lawn', 'garden']],
  [/banquet|marriage|wedding hall/i, ['[amenity=events_venue]', 'banquet', 'marriage hall']],
  [/resort|farm ?house|villa/i, ['[tourism=resort]', 'farmhouse']],
  [/hotel|five[- ]star|5[- ]star|luxury/i, ['[tourism=hotel]']],
  [/club|gymkhana/i, ['club']],
  [/conference|auditorium|convention|corporate/i, ['[amenity=conference_centre]', 'auditorium']],
  [/community|society/i, ['[amenity=community_centre]']],
];

const STOP_WORDS = new Set([
  'and',
  'with',
  'for',
  'the',
  'a',
  'an',
  'or',
  'of',
  'in',
  'near',
  'big',
  'small',
]);

/** Turns the user's words and venue type into a short list of searches, their own words first. */
export function searchesFor(venueType: VenueType, preference: string, max = 6): string[] {
  const fromWords = PREFERENCE_SEARCHES.filter(([re]) => re.test(preference)).flatMap(([, q]) => q);
  return [...new Set([...fromWords, ...TYPE_SEARCHES[venueType], ...EVENT_SEARCHES])].slice(0, max);
}

/** Words from the preference that a venue's name or kind can match. */
function preferenceWords(preference: string): string[] {
  return preference
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map((w) => (w === 'rooftop' || w === 'roof' ? 'roof' : w.replace(/s$/, '')));
}

const ENOUGH = 15;
const BOX_DEGREES = 0.12; // ~13 km either side of the centre

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface VenueSearch {
  venueType?: VenueType;
  /** The user's own words, e.g. "rooftop with dine-in". */
  preference?: string;
  limit?: number;
  pause?: (ms: number) => Promise<unknown>;
}

/**
 * Venues around a city, town or district that best match the kind of place
 * the user wants: places matching their words first, then the right kind of
 * venue, then nearest first. Matches are close, not exact — "rooftop bar"
 * also finds rooftop restaurants.
 */
export async function findVenues(
  city: string,
  fetchImpl: typeof fetch = fetch,
  { venueType = 'undecided', preference = '', limit = 20, pause = wait }: VenueSearch = {},
): Promise<Venue[]> {
  const centre = await geocodeCity(city, fetchImpl);
  const { lat, lon } = centre;
  const viewbox = [lon - BOX_DEGREES, lat + BOX_DEGREES, lon + BOX_DEGREES, lat - BOX_DEGREES].join(',');
  const searches = searchesFor(venueType, preference);
  const words = preferenceWords(preference);
  const found = new Map<string, Venue & { score: number }>();
  for (const [rank, query] of searches.entries()) {
    if (found.size >= ENOUGH) break;
    await pause(SPACING_MS);
    const url = `${NOMINATIM}?format=jsonv2&limit=20&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(query)}`;
    for (const venue of toVenues(await getJson(url, fetchImpl), city)) {
      // Name searches can match shops or flats; keep places whose name carries the word or sounds like a venue.
      const byName = !query.startsWith('[');
      if (byName && !venue.name.toLowerCase().includes(query.split(' ')[0]) && !EVENT_NAME.test(venue.name))
        continue;
      const key = venue.name.toLowerCase();
      if (found.has(key)) continue;
      const text = `${venue.name} ${venue.kind}`.toLowerCase();
      const matched = words.filter((w) => text.includes(w));
      const score = matched.length * 3 + Math.max(0, searches.length - rank);
      found.set(key, {
        ...venue,
        distanceKm: distanceKm(lat, lon, venue.lat, venue.lon),
        ...(matched.length > 0 ? { match: `Matches “${matched.join(', ')}”` } : {}),
        score,
      });
    }
  }
  return [...found.values()]
    .sort((a, b) => b.score - a.score || (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
    .slice(0, limit)
    .map(({ score: _score, ...v }) => v);
}
