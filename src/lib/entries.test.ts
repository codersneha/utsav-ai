import { describe, expect, it } from 'vitest';
import type { VendorEntry, Venue } from '../types';
import { entryActions, newId, toggleIn, withChosenVenue } from './entries';

const venue: Venue = {
  name: 'Boho The Sky Cafe',
  kind: 'cafe',
  address: 'Madhyamgram, Kolkata',
  lat: 22.69,
  lon: 88.45,
  mapsUrl: 'https://maps.google.com/?q=Boho',
  osmUrl: 'https://www.openstreetmap.org/?mlat=22.69&mlon=88.45',
};

const vendor = (patch: Partial<VendorEntry>): VendorEntry => ({
  id: 'v1',
  groupId: 'venue',
  name: 'Old Hall',
  contact: '',
  notes: '',
  quote: 0,
  status: 'pending',
  ...patch,
});

describe('newId', () => {
  it('is unique and keeps the prefix', () => {
    const a = newId('guest');
    const b = newId('guest');
    expect(a).toMatch(/^guest-/);
    expect(a).not.toBe(b);
  });
});

describe('entryActions', () => {
  type Row = { id: string; name: string };
  const run = (start: Row[]) => {
    let list = start;
    const actions = entryActions<Row>((update) => {
      list = update(list);
    }, 'row');
    return { actions, get: () => list };
  };

  it('adds with a fresh id, updates by id and removes by id', () => {
    const { actions, get } = run([{ id: 'a', name: 'Asha' }]);
    actions.add({ name: 'Ravi' });
    expect(get()).toHaveLength(2);
    expect(get()[1].id).toMatch(/^row-/);

    actions.update('a', { name: 'Asha Sen' });
    expect(get()[0]).toEqual({ id: 'a', name: 'Asha Sen' });

    actions.remove('a');
    expect(get().map((r) => r.name)).toEqual(['Ravi']);
  });
});

describe('toggleIn', () => {
  it('adds a missing id and removes a present one', () => {
    expect(toggleIn(['decor'], 'catering')).toEqual(['decor', 'catering']);
    expect(toggleIn(['decor', 'catering'], 'decor')).toEqual(['catering']);
  });
});

describe('withChosenVenue', () => {
  it('adds the venue as the pending booking and shortlists the previous one', () => {
    const list = withChosenVenue([vendor({})], venue, 'new');
    expect(list.find((e) => e.name === 'Old Hall')?.status).toBe('shortlisted');
    expect(list.find((e) => e.id === 'new')).toMatchObject({
      groupId: 'venue',
      name: venue.name,
      mapsUrl: venue.mapsUrl,
      status: 'pending',
    });
  });

  it('re-uses an existing row for the same venue instead of adding a duplicate', () => {
    const list = withChosenVenue([vendor({ name: venue.name, status: 'shortlisted' })], venue, 'new');
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('pending');
  });

  it('leaves other vendor groups alone', () => {
    const caterer = vendor({ id: 'c', groupId: 'catering', name: 'Caterer' });
    expect(withChosenVenue([caterer], venue, 'new')[0]).toEqual(caterer);
  });
});
