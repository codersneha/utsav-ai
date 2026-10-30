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

/** Words that don't identify a place ("and" vs "N", "the", "&"). */
const FILLER = new Set(['and', 'n', 'the', 'of', 'a', 'at', 'in', 'near', 'by']);

const words = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !FILLER.has(w));

/** The name the user meant, without the city they typed with it ("Bubble and Tea, kolkata", "… habra"). */
export function coreName(name: string, city: string): string {
  const cityWords = new Set([...words(city), 'india']);
  const kept = name
    .replace(/[,|]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !cityWords.has(w.toLowerCase().replace(/[^a-z0-9]/g, '')));
  return kept.length > 0 ? kept.join(' ').trim() : name.trim();
}

/**
 * A sound-alike key for Indian spellings, so "banket" matches "banquet",
 * "shibalay" matches "shibaloy" and "chai" matches "chaai".
 */
export function soundKey(word: string): string {
  return word
    .toLowerCase()
    .replace(/qu/g, 'k')
    .replace(/q/g, 'k')
    .replace(/ck/g, 'k')
    .replace(/ph/g, 'f')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/y/g, 'i')
    .replace(/(.)\1+/g, '$1')
    .replace(/(?<=[a-z])h/g, '')
    .replace(/[aeiou]+$/, '');
}

const sameWord = (a: string, b: string) =>
  a === b ||
  soundKey(a) === soundKey(b) ||
  (a.length > 3 && b.length > 3 && nameSimilarity(soundKey(a), soundKey(b)) >= 0.75);

/**
 * How well a place matches what the user typed, the way a search engine
 * would judge it: the meaningful words typed appear in the name (in any
 * order, allowing sound-alike spellings), extra words in the real name are
 * fine ("Bubble and Tea" → "Bubble N Tea Asian Cafe"), and area words typed
 * after the name may instead appear in the address ("arsalan park street").
 */
export function matchScore(typed: string, candidate: string, address = ''): number {
  const want = words(typed);
  const have = words(candidate);
  if (want.length === 0 || have.length === 0) return 0;
  const inName = want.filter((w) => have.some((h) => sameWord(w, h)));
  const typedCoverage = inName.length / want.length;
  // Every word of the real name was typed; the rest of what was typed describes where it is.
  const nameCovered = have.every((h) => want.some((w) => sameWord(w, h)));
  const place = words(address);
  const restInAddress = want
    .filter((w) => !inName.includes(w))
    .every((w) => place.some((p) => sameWord(w, p)));
  // Typed name-first ("arsalan park street") means the rest is the area, even if the map's address differs.
  const nameFirst = sameWord(want[0], have[0]);
  const located =
    nameCovered && have.join('').length >= 4 ? (restInAddress ? 0.95 : nameFirst ? 0.8 : 0.6) : 0;
  return Math.max(typedCoverage, located, nameSimilarity(typed, candidate));
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | number | undefined>;
}

/** Photon results (typo-tolerant) as venues, in India only. */
async function photonSearch(
  query: string,
  city: string,
  near: { lat: number; lon: number } | null,
  fetchImpl: typeof fetch,
): Promise<Venue[]> {
  const bias = near ? `&lat=${near.lat}&lon=${near.lon}` : '';
  const data = (await getJson(`${PHOTON}?limit=15${bias}&q=${encodeURIComponent(query)}`, fetchImpl)) as {
    features?: PhotonFeature[];
  };
  return (data.features ?? []).flatMap((f) => {
    const props = f.properties ?? {};
    const found = cleanText(props.name, 100);
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (props.countrycode !== 'IN' || !found || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    // Roads, stations and land areas share names with venues but are never one.
    if (NOT_VENUES.has(String(props.osm_key ?? ''))) return [];
    const address = [props.street, props.district, props.city ?? props.county, props.state]
      .filter((p) => typeof p === 'string' && p)
      .join(', ');
    const type = props.osm_type === 'W' ? 'way' : props.osm_type === 'R' ? 'relation' : 'node';
    return [
      {
        name: found,
        kind: kindOf(String(props.osm_value ?? ''), found),
        address: cleanText(address, 200),
        lat: Number(lat),
        lon: Number(lon),
        mapsUrl: mapsSearch(found, String(props.city ?? city)),
        osmUrl: `https://www.openstreetmap.org/${type}/${props.osm_id ?? ''}`,
      },
    ];
  });
}

/** Far-away places with the same name are someone else's venue. */
const MAX_VENUE_KM = 80;

/**
 * Looks up a named venue like a search engine would: strips the city from
 * the name, matches the meaningful words in any order with small spelling
 * slips allowed, and ranks the best match nearest the event city first.
 * Uses Google Places when a key is configured, otherwise OpenStreetMap
 * (Nominatim and the typo-tolerant Photon). Empty if nothing matches.
 */
export async function checkVenue(
  name: string,
  city: string,
  fetchImpl: typeof fetch = fetch,
  pause: (ms: number) => Promise<unknown> = wait,
  placesKey?: string,
): Promise<Venue[]> {
  const core = coreName(name, city);
  const near = await geocodeCity(city, fetchImpl).catch(() => null);
  if (placesKey) {
    const found = await googleTextSearch(`${core} ${city}`, near, placesKey, fetchImpl);
    if (found.length > 0) return rankMatches(found, core, near);
  }
  const nominatim = (q: string) =>
    getJson(`${NOMINATIM}?format=jsonv2&limit=8&countrycodes=in&q=${encodeURIComponent(q)}`, fetchImpl).then(
      (d) =>
        toVenues(
          Array.isArray(d) ? d.filter((h) => isHit(h) && !NOT_VENUES.has(h.category ?? '')) : [],
          city,
        ),
    );
  const pool: Venue[] = [];
  await pause(SPACING_MS);
  pool.push(...(await nominatim(`${core}, ${city}`)));
  if (rankMatches(pool, core, near).length === 0) {
    await pause(SPACING_MS);
    pool.push(...(await nominatim(core)));
    pool.push(...(await photonSearch(core, city, near, fetchImpl)));
    const plain = words(core).join(' ');
    if (plain !== core.toLowerCase()) pool.push(...(await photonSearch(plain, city, near, fetchImpl)));
  }
  return rankMatches(pool, core, near);
}

/** Keeps good matches near the event city, best and closest first, without duplicates. */
function rankMatches(pool: Venue[], typed: string, near: { lat: number; lon: number } | null): Venue[] {
  const seen = new Set<string>();
  return pool
    .map((v) => ({
      v,
      score: matchScore(typed, v.name, v.address),
      km: near ? distanceKm(near.lat, near.lon, v.lat, v.lon) : 0,
    }))
    .filter(({ v, score, km }) => {
      const key = `${v.name.toLowerCase()}|${v.lat.toFixed(3)}`;
      if (score < 0.75 || km > MAX_VENUE_KM || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score || a.km - b.km)
    .slice(0, 5)
    .map(({ v, score, km }) => ({
      ...v,
      ...(near ? { distanceKm: km } : {}),
      ...(score < 1 || simplify(v.name) !== simplify(typed) ? { match: 'Closest match' } : {}),
    }));
}

const PLACES_SEARCH = 'https://places.googleapis.com/v1/places:searchText';

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text?: string };
}

/**
 * Google Places text search — the same fuzzy matching and "best near me"
 * ranking as the Maps app, with ratings. Used only when GOOGLE_MAPS_API_KEY
 * is configured on the server.
 */
export async function googleTextSearch(
  query: string,
  near: { lat: number; lon: number } | null,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  radiusKm = 25,
): Promise<Venue[]> {
  const res = await fetchImpl(PLACES_SEARCH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.primaryTypeDisplayName',
    },
    body: JSON.stringify({
      textQuery: query,
      regionCode: 'IN',
      languageCode: 'en',
      maxResultCount: 20,
      ...(near
        ? {
            locationBias: {
              circle: { center: { latitude: near.lat, longitude: near.lon }, radius: radiusKm * 1000 },
            },
          }
        : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new VenueLookupError(`Places responded with ${res.status}`);
  const data = (await res.json()) as { places?: GooglePlace[] };
  return (data.places ?? []).flatMap((p) => {
    const name = cleanText(p.displayName?.text, 100);
    const lat = Number(p.location?.latitude);
    const lon = Number(p.location?.longitude);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const id = typeof p.id === 'string' && /^[\w-]+$/.test(p.id) ? p.id : '';
    return [
      {
        name,
        kind: cleanText(p.primaryTypeDisplayName?.text, 40).toLowerCase() || 'place',
        address: cleanText(p.formattedAddress?.replace(/, India$/, ''), 200),
        lat,
        lon,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}${id ? `&query_place_id=${id}` : ''}`,
        osmUrl: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`,
        ...(typeof p.rating === 'number' ? { rating: Math.round(p.rating * 10) / 10 } : {}),
        ...(typeof p.userRatingCount === 'number' ? { reviews: p.userRatingCount } : {}),
      },
    ];
  });
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
  /** Google Places key — when set, results are Google's, ranked like "best … near me". */
  placesKey?: string;
}

/** Plain words for each venue type, for a Google-style "best … near" search. */
const TYPE_QUERY: Record<VenueType, string> = {
  undecided: 'event venues',
  banquet: 'banquet halls',
  outdoor: 'lawns and garden venues',
  home: 'party venues',
  'community-hall': 'community halls',
  temple: 'marriage halls',
  restaurant: 'restaurants for parties',
  cafe: 'cafes',
  hotel: 'hotels with banquet halls',
  office: 'conference venues',
};

/** Google-style popularity: a great rating backed by many reviews ranks first. */
const popularity = (v: Venue) => (v.rating ?? 0) * Math.log10((v.reviews ?? 0) + 10);

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
    placesKey,
  }: VenueSearch = {},
): Promise<Venue[]> {
  const area = centre ?? (await geocodeCity(city, fetchImpl));
  const { lat, lon } = area;
  if (placesKey) {
    const what = preference.trim() || TYPE_QUERY[venueType];
    const places = await googleTextSearch(
      `best ${what} near ${area.name}`,
      area,
      placesKey,
      fetchImpl,
      radiusKm,
    );
    return places
      .map((v) => ({ ...v, distanceKm: distanceKm(lat, lon, v.lat, v.lon) }))
      .filter((v) => v.distanceKm <= radiusKm * 1.5)
      .sort((a, b) => popularity(b) - popularity(a) || a.distanceKm - b.distanceKm)
      .slice(0, limit);
  }
  const box = radiusKm * KM;
  const viewbox = [lon - box, lat + box, lon + box, lat - box].join(',');
  const searches = searchesFor(venueType, preference);
  const words = preferenceWords(preference);
  const found = new Map<string, Venue & { score: number }>();
  for (const [rank, query] of searches.entries()) {
    if (found.size >= ENOUGH) break;
    await pause(SPACING_MS);
    const url = `${NOMINATIM}?format=jsonv2&limit=20&bounded=1&extratags=1&viewbox=${viewbox}&q=${encodeURIComponent(query)}`;
    const data = await getJson(url, fetchImpl);
    const hits = Array.isArray(data) ? data.filter((h) => isHit(h) && !NOT_VENUES.has(h.category ?? '')) : [];
    for (const hit of hits) {
      const venue = toVenues([hit], city)[0];
      if (!venue) continue;
      // Name searches can match shops or flats; keep places whose name carries the word or sounds like a venue.
      const byName = !query.startsWith('[');
      if (byName && !venue.name.toLowerCase().includes(query.split(' ')[0]) && !EVENT_NAME.test(venue.name))
        continue;
      const key = venue.name.toLowerCase();
      if (found.has(key)) continue;
      const text = `${venue.name} ${venue.kind}`.toLowerCase();
      const matched = words.filter((w) => text.includes(w));
      // Established places usually list a website, phone, opening hours or cuisine on the map.
      const tags = (hit as { extratags?: Record<string, string> | null }).extratags ?? {};
      const established = [
        'website',
        'contact:website',
        'phone',
        'contact:phone',
        'opening_hours',
        'cuisine',
      ].filter((k) => tags[k]).length;
      const score = matched.length * 3 + Math.max(0, searches.length - rank) + Math.min(established, 3);
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
