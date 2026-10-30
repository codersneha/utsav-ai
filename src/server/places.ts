import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

/**
 * An offline index of India's cafés, restaurants, halls and hotels from
 * Overture Maps Places (CDLA-Permissive-2.0), built by scripts/build_places.py.
 * It lists many small places OpenStreetMap lacks, needs no API key and is
 * read straight from disk, so lookups are fast and never rate-limited.
 */

/** [name, kind, lat, lon, address, weight] — weight (0–1) says how established the listing is. */
export type PlaceRow = [
  name: string,
  kind: string,
  lat: number,
  lon: number,
  address: string,
  weight: number,
];

/** Loads one tile's rows; an unknown tile is simply empty. */
export type TileLoader = (key: string) => Promise<PlaceRow[]>;

/** Tile size in degrees (about 55 km). Must match scripts/build_places.py. */
const TILE = 0.5;
const MAX_CACHED_TILES = 24;

const isRow = (r: unknown): r is PlaceRow =>
  Array.isArray(r) &&
  typeof r[0] === 'string' &&
  typeof r[1] === 'string' &&
  Number.isFinite(r[2]) &&
  Number.isFinite(r[3]) &&
  typeof r[4] === 'string' &&
  Number.isFinite(r[5]);

/** Reads tiles from data/places (bundled with the serverless function). */
export const fileTiles =
  (dir = process.env.PLACES_DIR || join(process.cwd(), 'data', 'places')): TileLoader =>
  async (key) => {
    try {
      const rows: unknown = JSON.parse(
        gunzipSync(await readFile(join(dir, `${key}.json.gz`))).toString('utf8'),
      );
      return Array.isArray(rows) ? rows.filter(isRow) : [];
    } catch {
      return [];
    }
  };

const defaultLoader = fileTiles();
const cache = new Map<string, Promise<PlaceRow[]>>();

/** Keeps recently used tiles in memory; a warm function answers without touching disk. */
function cachedTile(key: string, load: TileLoader): Promise<PlaceRow[]> {
  if (load !== defaultLoader) return load(key);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const rows = load(key);
  cache.set(key, rows);
  if (cache.size > MAX_CACHED_TILES) cache.delete(cache.keys().next().value as string);
  return rows;
}

/** Places within radiusKm of a point, nearest tiles first. */
export async function placesNear(
  lat: number,
  lon: number,
  radiusKm: number,
  load: TileLoader = defaultLoader,
): Promise<PlaceRow[]> {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const keys: string[] = [];
  for (let y = Math.floor((lat - dLat) / TILE); y <= Math.floor((lat + dLat) / TILE); y++)
    for (let x = Math.floor((lon - dLon) / TILE); x <= Math.floor((lon + dLon) / TILE); x++)
      keys.push(`${y}_${x}`);
  const tiles = await Promise.all(keys.map((k) => cachedTile(k, load)));
  return tiles
    .flat()
    .filter(([, , pLat, pLon]) => Math.abs(pLat - lat) <= dLat && Math.abs(pLon - lon) <= dLon);
}
