import type { Venue } from '../types.js';
import { cleanText } from '../lib/validation.js';

/**
 * Reads a venue from a Google Maps link the user pasted. Short links are expanded by
 * following Google's redirect; nothing outside Google's own hosts is ever fetched.
 */

const USER_AGENT = 'UtsavAI/1.0 (event planner; https://github.com/codersneha/utsav-ai)';
const TIMEOUT_MS = 8_000;

const MAPS_HOSTS = new Set([
  'www.google.com',
  'google.com',
  'maps.google.com',
  'www.google.co.in',
  'google.co.in',
]);
const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);

const MAX_REDIRECTS = 3;

function parseUrl(link: string): URL | null {
  try {
    return new URL(link.trim());
  } catch {
    return null;
  }
}

/** Short links redirect to the full link; only Google's own short hosts are ever fetched. */
async function expandShortLink(start: URL, fetchImpl: typeof fetch): Promise<URL | null> {
  let url = start;
  for (
    let hop = 0;
    hop < MAX_REDIRECTS && url.protocol === 'https:' && SHORT_HOSTS.has(url.hostname);
    hop++
  ) {
    const res = await fetchImpl(url.toString(), {
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const next = res.headers.get('location');
    if (!next) return null;
    url = new URL(next, url);
  }
  return url;
}

const isMapsUrl = (url: URL) =>
  url.protocol === 'https:' && MAPS_HOSTS.has(url.hostname) && url.pathname.startsWith('/maps');

const isCoordinate = (lat: number, lon: number) =>
  Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/** The place name and its pin (or, failing that, the map's centre) from a full Google Maps URL. */
function placeFromMapsUrl(url: URL): Venue | null {
  const placeName = /\/maps\/place\/([^/]+)/.exec(url.pathname)?.[1];
  const name = cleanText(decodeURIComponent((placeName ?? '').replace(/\+/g, ' ')), 100);
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(url.pathname);
  const view = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(url.pathname);
  const lat = Number(pin?.[1] ?? view?.[1]);
  const lon = Number(pin?.[2] ?? view?.[2]);
  if (!name || !isCoordinate(lat, lon)) return null;
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

/** Reads a venue's name and location from a Google Maps link (full or short). */
export async function resolveMapsLink(link: string, fetchImpl: typeof fetch = fetch): Promise<Venue | null> {
  const start = parseUrl(link);
  const url = start && (await expandShortLink(start, fetchImpl));
  return url && isMapsUrl(url) ? placeFromMapsUrl(url) : null;
}
