import type { Venue, VendorEntry } from '../types';

let nextId = 0;
/** A unique id for something the user adds (a guest, vendor or task). */
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(nextId++).toString(36)}`;

type Setter<T> = (update: (list: T[]) => T[]) => void;

/** Add, update and remove for a list of the user's own entries. `Fixed` keys cannot be patched. */
export function entryActions<T extends { id: string }, Fixed extends keyof T = never>(
  setList: Setter<T>,
  prefix: string,
) {
  return {
    add: (entry: Omit<T, 'id'>) => setList((list) => [...list, { ...entry, id: newId(prefix) } as T]),
    update: (id: string, patch: Partial<Omit<T, 'id' | Fixed>>) =>
      setList((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e))),
    remove: (id: string) => setList((list) => list.filter((e) => e.id !== id)),
  };
}

/** Adds the key if missing, removes it if present. */
export function toggleIn(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * Records the chosen venue in the vendor list: it becomes the pending venue booking and any other
 * pending venue drops back to "shortlisted".
 */
export function withChosenVenue(list: VendorEntry[], venue: Venue, id = newId('vendor')): VendorEntry[] {
  const others = list.map((e) =>
    e.groupId === 'venue' && e.status === 'pending' && e.name !== venue.name
      ? { ...e, status: 'shortlisted' as const }
      : e,
  );
  const existing = others.find((e) => e.groupId === 'venue' && e.name === venue.name);
  if (existing) return others.map((e) => (e === existing ? { ...e, status: 'pending' as const } : e));
  return [
    ...others,
    {
      id,
      groupId: 'venue',
      name: venue.name,
      contact: '',
      address: venue.address,
      mapsUrl: venue.mapsUrl,
      notes: 'Chosen as the venue — confirm the booking and update the status.',
      quote: 0,
      status: 'pending',
    },
  ];
}
