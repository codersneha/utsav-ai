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
/** Photon: typo-tolerant search over the same OpenStreetMap data. */
const PHOTON = 'https://photon.komoot.io/api/';
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
  /** OSM key, e.g. amenity, tourism, leisure. */
  category?: string;
}

/** Parks, nature and land areas are never venues, even when named "… Garden". */
const NOT_VENUES = new Set([
  'leisure',
  'natural',
  'landuse',
  'place',
  'boundary',
  'highway',
  'railway',
  'waterway',
]);

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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const simplify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');

/** Edit distance between two short strings. */
function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** 1 for the same name, lower for more spelling differences (ignores spaces and punctuation). */
export function nameSimilarity(a: string, b: string): number {
  const x = simplify(a);
  const y = simplify(b);
  if (!x || !y) return 0;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | number | undefined>;
}

/** Typo-tolerant name search across India, biased towards (but not limited to) the event city. */
async function fuzzyLookup(
  name: string,
  city: string,
  near: { lat: number; lon: number } | null,
  fetchImpl: typeof fetch,
): Promise<Venue[]> {
  const bias = near ? `&lat=${near.lat}&lon=${near.lon}` : '';
  const data = (await getJson(`${PHOTON}?limit=10${bias}&q=${encodeURIComponent(name)}`, fetchImpl)) as {
    features?: PhotonFeature[];
  };
  return (data.features ?? []).flatMap((f) => {
    const props = f.properties ?? {};
    const found = cleanText(props.name, 100);
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (props.countrycode !== 'IN' || !found || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    // Only near-identical names count, so a "Shibaloy" temple is not taken for "Shibaloy Garden".
    if (nameSimilarity(found, name) < 0.8) return [];
    const address = [props.street, props.district, props.city ?? props.county, props.state]
      .filter((p) => typeof p === 'string' && p)
      .join(', ');
    return [
      {
        name: found,
        kind: kindOf(String(props.osm_value ?? ''), found),
        address: cleanText(address, 200),
        lat: Number(lat),
        lon: Number(lon),
        mapsUrl: mapsSearch(found, String(props.city ?? city)),
        osmUrl: `https://www.openstreetmap.org/${props.osm_type === 'W' ? 'way' : props.osm_type === 'R' ? 'relation' : 'node'}/${props.osm_id ?? ''}`,
        match: nameSimilarity(found, name) < 1 ? 'Closest spelling match' : undefined,
      },
    ];
  });
}

/**
 * Looks up a named venue. Tries the name with the event city, then the name
 * anywhere in India (a good banquet can be far from home), then a
 * typo-tolerant search. Returns matches, or an empty list if it is not on
 * the open map.
 */
export async function checkVenue(
  name: string,
  city: string,
  fetchImpl: typeof fetch = fetch,
  pause: (ms: number) => Promise<unknown> = wait,
): Promise<Venue[]> {
  const search = (q: string) =>
    getJson(`${NOMINATIM}?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`, fetchImpl);
  const close = (venues: Venue[]) => venues.filter((v) => nameSimilarity(v.name, name) >= 0.6);

  const inCity = close(toVenues(await search(`${name}, ${city}`), city, name));
  if (inCity.length > 0) return inCity;
  await pause(SPACING_MS);
  const anywhere = close(toVenues(await search(name), city));
  if (anywhere.length > 0) return anywhere;
  const near = await geocodeCity(city, fetchImpl).catch(() => null);
  return fuzzyLookup(name, city, near, fetchImpl);
}

const MAPS_HOSTS = new Set([
  'www.google.com',
  'google.com',
  'maps.google.com',
  'www.google.co.in',
  'google.co.in',
]);
const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);

/** Reads a venue's name and location from a Google Maps link (full or short). */
export async function resolveMapsLink(link: string, fetchImpl: typeof fetch = fetch): Promise<Venue | null> {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  // Short links redirect to the full link; only Google's own hosts are ever fetched.
  for (let hop = 0; hop < 3 && url.protocol === 'https:' && SHORT_HOSTS.has(url.hostname); hop++) {
    const res = await fetchImpl(url.toString(), {
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const next = res.headers.get('location');
    if (!next) return null;
    url = new URL(next, url);
  }
  if (url.protocol !== 'https:' || !MAPS_HOSTS.has(url.hostname) || !url.pathname.startsWith('/maps')) {
    return null;
  }
  const placeName = /\/maps\/place\/([^/]+)/.exec(url.pathname)?.[1];
  const name = cleanText(decodeURIComponent((placeName ?? '').replace(/\+/g, ' ')), 100);
  const exact = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(url.pathname);
  const view = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(url.pathname);
  const lat = Number(exact?.[1] ?? view?.[1]);
  const lon = Number(exact?.[2] ?? view?.[2]);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }
  return {
    name,
    kind: 'from Google Maps',
    address: '',
    lat,
    lon,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${lat},${lon}`)}`,
    osmUrl: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`,
  };
}

export interface Area {
  /** The place we searched around, so the user can spot a wrong match. */
  name: string;
  lat: number;
  lon: number;
}

/** Coordinates of a town, locality or PIN code (first match in India). */
export async function geocodeCity(city: string, fetchImpl: typeof fetch = fetch): Promise<Area> {
  const data = await getJson(
    `${NOMINATIM}?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(city)}`,
    fetchImpl,
  );
  const hit = Array.isArray(data) && isHit(data[0]) ? data[0] : null;
  const lat = Number(hit?.lat);
  const lon = Number(hit?.lon);
  if (!hit || !Number.isFinite(lat) || !Number.isFinite(lon)) throw new VenueLookupError('City not found');
  const name = cleanText(
    (hit.display_name ?? city)
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p !== 'India')
      .slice(0, 4)
      .join(', '),
    160,
  );
  return { name, lat, lon };
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
/** Degrees of latitude per km (longitude is close enough at Indian latitudes). */
const KM = 1 / 111;

export interface VenueSearch {
  venueType?: VenueType;
  /** The user's own words, e.g. "rooftop with dine-in". */
  preference?: string;
  limit?: number;
  pause?: (ms: number) => Promise<unknown>;
  /** Already-located search centre (skips geocoding). */
  centre?: Area;
  /** How far around the centre to look. */
  radiusKm?: number;
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
  {
    venueType = 'undecided',
    preference = '',
    limit = 20,
    pause = wait,
    centre,
    radiusKm = 12,
  }: VenueSearch = {},
): Promise<Venue[]> {
  const { lat, lon } = centre ?? (await geocodeCity(city, fetchImpl));
  const box = radiusKm * KM;
  const viewbox = [lon - box, lat + box, lon + box, lat - box].join(',');
  const searches = searchesFor(venueType, preference);
  const words = preferenceWords(preference);
  const found = new Map<string, Venue & { score: number }>();
  for (const [rank, query] of searches.entries()) {
    if (found.size >= ENOUGH) break;
    await pause(SPACING_MS);
    const url = `${NOMINATIM}?format=jsonv2&limit=20&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(query)}`;
    const data = await getJson(url, fetchImpl);
    const hits = Array.isArray(data) ? data.filter((h) => isHit(h) && !NOT_VENUES.has(h.category ?? '')) : [];
    for (const venue of toVenues(hits, city)) {
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
