import { describe, expect, it, vi } from 'vitest';
import { resolveMapsLink } from './mapsLink.js';

const redirectTo = (location: string) =>
  vi.fn(async () => new Response(null, { status: 302, headers: { location } })) as unknown as typeof fetch;

describe('resolveMapsLink', () => {
  it('reads the name and exact pin from a Google Maps place link', async () => {
    const venue = await resolveMapsLink(
      'https://www.google.com/maps/place/Shibaloy+Garden/@22.70,88.45,911m/data=!3m1!4b1!4m6!3m5!8m2!3d22.7038147!4d88.4565584',
    );
    expect(venue).toMatchObject({ name: 'Shibaloy Garden', lat: 22.7038147, lon: 88.4565584 });
    expect(venue?.mapsUrl).toMatch(/^https:\/\/www\.google\.com\/maps\//);
  });

  it('falls back to the map centre when the link has no pin', async () => {
    const venue = await resolveMapsLink('https://www.google.co.in/maps/place/Rajbari/@22.5,88.3,17z');
    expect(venue).toMatchObject({ name: 'Rajbari', lat: 22.5, lon: 88.3 });
  });

  it('follows a short link to Google Maps', async () => {
    const fetchImpl = redirectTo('https://www.google.com/maps/place/Rajbari/@22.5,88.3,17z');
    const venue = await resolveMapsLink('https://maps.app.goo.gl/abc', fetchImpl);
    expect(venue?.name).toBe('Rajbari');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects other sites, plain http, bad coordinates and text that is not a link', async () => {
    expect(await resolveMapsLink('https://evil.example.com/maps/place/X/@1,2')).toBeNull();
    expect(await resolveMapsLink('http://www.google.com/maps/place/X/@1,2')).toBeNull();
    expect(await resolveMapsLink('https://www.google.com/maps/place/X/@95,200')).toBeNull();
    expect(await resolveMapsLink('not a url')).toBeNull();
  });

  it('does not follow a short link that redirects away from Google Maps', async () => {
    const fetchImpl = redirectTo('https://evil.example.com/maps/place/X/@1,2');
    expect(await resolveMapsLink('https://maps.app.goo.gl/abc', fetchImpl)).toBeNull();
  });

  it('gives up when a short link does not redirect', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch;
    expect(await resolveMapsLink('https://maps.app.goo.gl/abc', fetchImpl)).toBeNull();
  });
});
