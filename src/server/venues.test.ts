import { describe, expect, it, vi } from 'vitest';
import {
  VenueLookupError,
  checkVenue,
  coreName,
  distanceKm,
  findVenues,
  googleTextSearch,
  matchScore,
  nameSimilarity,
  soundKey,
  resolveMapsLink,
  searchesFor,
} from './venues.js';
import { placesNear } from './places.js';

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
      tiles: async () => [],
    });
    expect(venues[0].name).toBe('Sky Rooftop Lounge');
    expect(venues[0].match).toMatch(/roof/);
  });
});

describe('venue name matching and Google Maps links', () => {
  it('scores near-identical spellings high and different places low', () => {
    expect(nameSimilarity('Royal Aura Banket', 'Royal Aura Banquet')).toBeGreaterThan(0.85);
    expect(nameSimilarity('Shibaloy Garden', 'Shibaloy')).toBeLessThan(0.8);
  });

  it('finds a misspelt venue anywhere in India when the city search misses', async () => {
    const answers: unknown[] = [
      [],
      [
        {
          name: 'Royal Aura Banquet',
          type: 'events_venue',
          lat: '22.85',
          lon: '88.67',
          osm_type: 'node',
          osm_id: 9,
          display_name: 'Royal Aura Banquet, Ashoknagar, India',
        },
      ],
    ];
    let call = 0;
    const fetchImpl = (async () => json(answers[call++] ?? [])) as unknown as typeof fetch;
    const venues = await checkVenue('royal aura banket', 'Habra', fetchImpl, async () => {});
    expect(venues[0].name).toBe('Royal Aura Banquet');
    expect(venues[0].address).toBe('Ashoknagar');
  });

  it('reads the name and exact location from a Google Maps place link', async () => {
    const venue = await resolveMapsLink(
      'https://www.google.com/maps/place/Shibaloy+Garden/@22.70,88.45,911m/data=!3m1!4b1!4m6!3m5!8m2!3d22.7038147!4d88.4565584',
    );
    expect(venue).toMatchObject({ name: 'Shibaloy Garden', lat: 22.7038147, lon: 88.4565584 });
    expect(venue?.mapsUrl).toMatch(/^https:\/\/www\.google\.com\/maps\//);
  });

  it('follows a short link only to Google Maps and rejects other sites', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://www.google.com/maps/place/Rajbari/@22.5,88.3,17z' },
        }),
    );
    const venue = await resolveMapsLink('https://maps.app.goo.gl/abc', fetchImpl as unknown as typeof fetch);
    expect(venue?.name).toBe('Rajbari');
    expect(await resolveMapsLink('https://evil.example.com/maps/place/X/@1,2')).toBeNull();
    expect(await resolveMapsLink('http://www.google.com/maps/place/X/@1,2')).toBeNull();
    expect(await resolveMapsLink('not a url')).toBeNull();
  });
});

describe('search-engine style matching', () => {
  it('hears Indian spelling variants as the same word', () => {
    expect(soundKey('banket')).toBe(soundKey('banquet'));
    expect(soundKey('Shibaloy')).toBe(soundKey('shibaloi'));
    expect(soundKey('zaika')).toBe(soundKey('jaika'));
  });

  it('drops the city and filler words from what was typed', () => {
    expect(coreName('bubble and tea kolkata', 'Kolkata')).toBe('bubble and tea');
    expect(coreName('Royal Aura Banket, Habra', 'Habra')).toBe('Royal Aura Banket');
  });

  it('finds a place whose kind was misspelt by searching its distinctive name word', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const q = decodeURIComponent(new URL(url).searchParams.get('q') ?? '');
      if (q === 'Kolkata') return json([{ name: 'Kolkata', ...KOLKATA }]);
      return json(
        q.startsWith('mangalam,')
          ? [
              {
                name: 'Mangalam Banquets Kolkata',
                type: 'events_venue',
                osm_type: 'way',
                osm_id: 5,
                ...KOLKATA,
              },
            ]
          : [],
      );
    });
    const venues = await checkVenue(
      'mangalam banket kolkata',
      'Kolkata',
      fetchImpl as unknown as typeof fetch,
      async () => {},
    );
    expect(venues[0]?.name).toBe('Mangalam Banquets Kolkata');
  });

  it('matches a loosely typed name to the real one, but not to a different place', () => {
    expect(matchScore('bubble and tea', 'Bubble N Tea Asian Cafe')).toBeGreaterThanOrEqual(0.75);
    expect(matchScore('arsalan park street', 'Arsalan', 'Park Street, Kolkata')).toBeGreaterThanOrEqual(0.75);
    expect(matchScore('bubble and tea', 'Tea Junction')).toBeLessThan(0.75);
  });
});

describe('Google Places search (when a key is configured)', () => {
  const place = {
    id: 'ChIJabc-123',
    displayName: { text: 'Bubble N Tea Asian Cafe' },
    formattedAddress: 'Lake Town, Kolkata, West Bengal, India',
    location: { latitude: 22.6, longitude: 88.4 },
    rating: 4.46,
    userRatingCount: 812,
    primaryTypeDisplayName: { text: 'Cafe' },
  };

  it('sends the key in a header, biases to the area and returns ratings and a place link', async () => {
    const fetchImpl = vi.fn(async () => json({ places: [place, { displayName: { text: 'No location' } }] }));
    const venues = await googleTextSearch(
      'best cafe near Lake Town',
      { lat: 22.6, lon: 88.4 },
      'test-key',
      fetchImpl as unknown as typeof fetch,
      5,
    );
    expect(venues).toHaveLength(1);
    expect(venues[0]).toMatchObject({
      name: 'Bubble N Tea Asian Cafe',
      kind: 'cafe',
      rating: 4.5,
      reviews: 812,
    });
    expect(venues[0].mapsUrl).toContain('query_place_id=ChIJabc-123');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('places.googleapis.com');
    expect((init.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('test-key');
    expect(JSON.parse(String(init.body)).locationBias.circle.radius).toBe(5000);
  });

  it('finds a loosely named place through Google before the open map', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('places.googleapis.com')
        ? json({ places: [place] })
        : json([{ name: 'Kolkata', ...KOLKATA }]),
    );
    const venues = await checkVenue(
      'bubble and tea kolkata',
      'Kolkata',
      fetchImpl as unknown as typeof fetch,
      async () => {},
      'test-key',
    );
    expect(venues[0]).toMatchObject({ name: 'Bubble N Tea Asian Cafe', match: 'Closest match', rating: 4.5 });
  });

  it('reports a Places error instead of returning nothing', async () => {
    const fetchImpl = (async () => json({}, 403)) as unknown as typeof fetch;
    await expect(googleTextSearch('x', null, 'bad', fetchImpl)).rejects.toBeInstanceOf(VenueLookupError);
  });
});

describe('the offline venue index (Overture Maps)', () => {
  const geocodeOnly = vi.fn(async () => json([{ name: 'Kolkata', ...KOLKATA }]));
  const fetchImpl = geocodeOnly as unknown as typeof fetch;

  it('finds a loosely named café the open map lacks, without any API key or map search', async () => {
    geocodeOnly.mockClear();
    const venues = await checkVenue('bubble and tea kolkata', 'Kolkata', fetchImpl, async () => {});
    expect(venues[0]).toMatchObject({
      name: 'Bubble N Tea Asian Cafe',
      address: 'GC 15, Sector III, Salt Lake',
      match: 'Closest match',
    });
    expect(venues.map((v) => v.name)).not.toContain('Bubble Wash');
    expect(venues[0].mapsUrl).toContain(encodeURIComponent('Bubble N Tea Asian Cafe, GC 15'));
    // Only the city was located; no slow map searches were needed.
    expect(geocodeOnly).toHaveBeenCalledTimes(1);
  });

  it('treats the typed kind of place as optional ("chapter 2 cafe" is a restaurant)', async () => {
    const venues = await checkVenue('chapter 2 cafe', 'Kolkata', fetchImpl, async () => {});
    expect(venues[0]?.name).toBe('Chapter 2 Restaurant');
  });

  it('ranks the best cafés near an area: fit, well-established listings, then distance', async () => {
    const venues = await findVenues('Kolkata', fetchImpl, {
      venueType: 'cafe',
      radiusKm: 12,
      limit: 3,
      centre: { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
      pause: async () => {},
    });
    // Indexed places come first; the open map only tops up a short list.
    expect(venues.map((v) => v.name).slice(0, 2)).toEqual(['Sky Lounge Rooftop Cafe', 'Corner Coffee']);
    const rooftop = await findVenues('Kolkata', fetchImpl, {
      venueType: 'restaurant',
      preference: 'rooftop',
      radiusKm: 12,
      centre: { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
      pause: async () => {},
    });
    expect(rooftop[0]).toMatchObject({ name: 'Sky Lounge Rooftop Cafe', match: 'Matches “roof”' });
  });

  it('reads tiles from disk and treats a missing tile as empty', async () => {
    expect(await placesNear(22.58, 88.41, 0.5)).toEqual([
      ['Bubble N Tea Asian Cafe', 'restaurant', 22.58018, 88.41182, 'GC 15, Sector III, Salt Lake', 0.8],
    ]);
    expect(await placesNear(10, 70, 5)).toEqual([]);
  });
});
