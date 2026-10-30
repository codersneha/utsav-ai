import { describe, expect, it, vi } from 'vitest';
import { VenueLookupError, checkVenue, distanceKm, findVenues, searchesFor } from './venues.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const KOLKATA = { lat: '22.5726', lon: '88.3639' };

describe('distanceKm', () => {
  it('measures great-circle distance', () => {
    expect(distanceKm(22.5726, 88.3639, 22.5726, 88.3639)).toBe(0);
    expect(distanceKm(22.5726, 88.3639, 22.8, 88.6)).toBeGreaterThan(30);
  });
});

describe('checkVenue', () => {
  it('returns map matches with links and identifies itself to the map service', async () => {
    const fetchImpl = vi.fn(async () =>
      json([
        {
          name: 'Kasturi Banquet',
          display_name: 'Kasturi Banquet, Salt Lake, Kolkata',
          type: 'events_venue',
          osm_type: 'way',
          osm_id: 42,
          ...KOLKATA,
        },
      ]),
    );
    const venues = await checkVenue('Kasturi Banquet', 'Kolkata', fetchImpl as unknown as typeof fetch);
    expect(venues[0]).toMatchObject({
      name: 'Kasturi Banquet',
      kind: 'events venue',
      osmUrl: 'https://www.openstreetmap.org/way/42',
    });
    expect(venues[0].mapsUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Kasturi/);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('countrycodes=in');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/UtsavAI/);
  });

  it('returns nothing for unknown places and ignores bad coordinates', async () => {
    const fetchImpl = (async () => json([{ name: 'X', lat: 'abc', lon: '1' }])) as unknown as typeof fetch;
    expect(await checkVenue('Nowhere Hall', 'Kolkata', fetchImpl)).toEqual([]);
  });
});

describe('findVenues', () => {
  const hit = (name: string, type: string, lat: number, lon: number, id = 1) => ({
    name,
    type,
    lat: String(lat),
    lon: String(lon),
    osm_type: 'node',
    osm_id: id,
    display_name: `${name}, Habra`,
  });

  it('searches politely, lists event venues first and nearest first, without duplicates', async () => {
    const urls: string[] = [];
    const answers = [
      [{ lat: '22.84', lon: '88.66' }],
      [
        hit('Mangalik', 'events_venue', 22.9, 88.7, 1),
        hit('Royal Aura Banquet', 'events_venue', 22.85, 88.67, 2),
      ],
      [
        hit('Royal Aura Banquet', 'events_venue', 22.85, 88.67, 2),
        hit('Banquet Apartments Shop', 'apartment', 22.84, 88.66, 3),
        hit('Bika Bakery', 'bakery', 22.84, 88.66, 4),
      ],
      [hit('Shubho Marriage Hall', 'yes', 22.86, 88.66, 5)],
      [hit('Spandan Hall', 'community_centre', 22.841, 88.661, 6)],
      [],
      [hit('Monorama Hotel', 'hotel', 22.8401, 88.6631, 7), { name: '', lat: '1', lon: '1' }],
    ];
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url);
      return json(answers[urls.length - 1] ?? []);
    });
    const pause = vi.fn(async () => {});
    const venues = await findVenues('Habra', fetchImpl as unknown as typeof fetch, { pause });

    // Event venues first (nearest first), then the other kinds of place in search order.
    expect(venues.map((v) => v.name)).toEqual([
      'Royal Aura Banquet',
      'Mangalik',
      'Banquet Apartments Shop',
      'Shubho Marriage Hall',
      'Spandan Hall',
      'Monorama Hotel',
    ]);
    expect(venues.find((v) => v.name === 'Shubho Marriage Hall')?.kind).toBe('banquet / marriage hall');
    expect(venues.find((v) => v.name === 'Spandan Hall')?.kind).toBe('community hall');
    expect(venues[0].address).toBe('Habra');
    // One geocode plus every search, each spaced to respect the one-request-per-second policy.
    expect(fetchImpl).toHaveBeenCalledTimes(7);
    expect(pause).toHaveBeenCalledTimes(6);
    expect(urls[1]).toContain('bounded=1');
    expect(decodeURIComponent(urls[1])).toContain('[amenity=events_venue]');
  });

  it('stops searching once it has enough venues', async () => {
    const many = Array.from({ length: 16 }, (_, i) => hit(`Hall ${i}`, 'events_venue', 22.84, 88.66, i));
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json([{ lat: '22.84', lon: '88.66' }]))
      .mockResolvedValueOnce(json(many));
    const venues = await findVenues('Habra', fetchImpl as unknown as typeof fetch, { pause: async () => {} });
    expect(venues).toHaveLength(16);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('removes duplicate matches when checking a named venue', async () => {
    const fetchImpl = (async () =>
      json([
        hit('ITC Royal Bengal', 'hotel', 22.5, 88.4, 1),
        hit('ITC Royal Bengal', 'hotel', 22.5, 88.4, 2),
      ])) as unknown as typeof fetch;
    expect(await checkVenue('ITC Royal Bengal', 'Kolkata', fetchImpl)).toHaveLength(1);
  });

  it('reports an unknown city and map outages', async () => {
    await expect(findVenues('Atlantis', (async () => json([])) as unknown as typeof fetch)).rejects.toThrow(
      'City not found',
    );
    await expect(
      checkVenue('Hall', 'Kolkata', (async () => json({}, 503)) as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(VenueLookupError);
  });
});

describe('searchesFor', () => {
  it('puts the user’s own words first, then the venue type', () => {
    expect(searchesFor('restaurant', 'rooftop bar and dine in')).toEqual([
      'rooftop',
      'terrace',
      '[amenity=bar]',
      '[amenity=pub]',
      '[amenity=restaurant]',
      'banquet',
    ]);
    expect(searchesFor('cafe', '')[0]).toBe('[amenity=cafe]');
    expect(searchesFor('banquet', 'garden with a banquet hall').slice(0, 2)).toEqual(['lawn', 'garden']);
  });

  it('ranks places matching the user’s words first and says why', async () => {
    const answers = [
      [{ lat: '22.57', lon: '88.36' }],
      [{ name: 'Sky Rooftop Lounge', type: 'bar', lat: '22.6', lon: '88.4', osm_type: 'node', osm_id: 1 }],
      [],
      [{ name: 'Corner Pub', type: 'bar', lat: '22.571', lon: '88.361', osm_type: 'node', osm_id: 2 }],
    ];
    let call = 0;
    const fetchImpl = (async () => json(answers[call++] ?? [])) as unknown as typeof fetch;
    const venues = await findVenues('Kolkata', fetchImpl, {
      venueType: 'restaurant',
      preference: 'rooftop bar',
      pause: async () => {},
    });
    expect(venues[0].name).toBe('Sky Rooftop Lounge');
    expect(venues[0].match).toMatch(/roof/);
  });
});
