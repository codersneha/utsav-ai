import { Building2, Check, MapPin, Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { checkVenue, findVenues, venueFromMapsLink } from '../lib/api';
import { isVenue } from '../lib/guards';
import { LIMITS } from '../lib/validation';
import type { Venue, VenueType } from '../types';

interface Props {
  city: string;
  venueName: string;
  venueType: VenueType;
  /** The user's own description of the place they want. */
  preference: string;
  onChoose: (name: string) => void;
}

const TYPE_WORDS: Partial<Record<VenueType, string>> = {
  banquet: 'banquet halls',
  outdoor: 'lawns and gardens',
  'community-hall': 'community halls',
  temple: 'kalyana mandapams and halls',
  restaurant: 'restaurants',
  cafe: 'cafés',
  hotel: 'hotels and resorts',
  office: 'conference venues',
};

function VenueRow({ venue, chosen, onChoose }: { venue: Venue; chosen: boolean; onChoose?: () => void }) {
  return (
    <li className="venue-row">
      <span className="icon-badge" aria-hidden="true">
        <Building2 size={18} />
      </span>
      <div>
        <strong>{venue.name}</strong>
        <div className="venue-tags">
          <span className="badge subtle">{venue.kind}</span>
          {venue.distanceKm !== undefined && <span className="badge subtle">{venue.distanceKm} km</span>}
          {venue.match && <span className="badge match">{venue.match}</span>}
        </div>
        {venue.address && <p className="muted small">{venue.address}</p>}
        <div className="venue-links">
          <a href={venue.mapsUrl} target="_blank" rel="noopener noreferrer">
            Photos & reviews on Google Maps<span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a href={venue.osmUrl} target="_blank" rel="noopener noreferrer">
            Map<span className="sr-only"> of {venue.name} on OpenStreetMap (opens in a new tab)</span>
          </a>
        </div>
      </div>
      {onChoose && (
        <button
          type="button"
          className={`btn small${chosen ? ' primary' : ''}`}
          onClick={onChoose}
          disabled={chosen}
          aria-label={chosen ? `${venue.name} is your venue` : `Choose ${venue.name} as the venue`}
        >
          {chosen ? (
            <>
              <Check size={16} aria-hidden="true" /> Chosen
            </>
          ) : (
            'Choose'
          )}
        </button>
      )}
    </li>
  );
}

const isNullableVenue = (v: unknown): v is Venue | null => v === null || isVenue(v);

/** Checks the booked venue, takes a Google Maps link, or finds the closest matches to what the user wants. */
export function VenuePanel({ city, venueName, venueType, preference, onChoose }: Props) {
  const [lookup, setLookup] = useState<{ key: string; venues: Venue[]; error?: string } | null>(null);
  // A venue saved from a Google Maps link (many local venues are not on the open map).
  const [linked, setLinked] = usePersistentState<Venue | null>('venueLink', null, isNullableVenue);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [wish, setWish] = useState(preference);
  const [near, setNear] = useState(city);
  const [radiusKm, setRadiusKm] = useState(12);
  const [results, setResults] = useState<{ venues: Venue[]; wish: string; area?: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  // Venues we already know (picked from a search or saved from a link) need no lookup.
  const known =
    results?.venues.find((v) => v.name === venueName) ?? (linked?.name === venueName ? linked : undefined);
  const key = `${venueName}|${city}`;

  useEffect(() => {
    if (!venueName || known) return;
    let active = true;
    void checkVenue(venueName, city).then((r) => {
      if (active) setLookup({ key: `${venueName}|${city}`, ...r });
    });
    return () => {
      active = false;
    };
  }, [venueName, city, known]);

  const check: { venues: Venue[]; error?: string } | null = known
    ? { venues: [known] }
    : lookup?.key === key
      ? lookup
      : null;

  const search = async (e?: FormEvent) => {
    e?.preventDefault();
    setSearching(true);
    setSearchError('');
    const wanted = wish.trim();
    const r = await findVenues(city, { venueType, preference: wanted, near: near.trim(), radiusKm });
    setResults({ venues: r.venues, wish: wanted, area: r.area });
    setSearchError(
      r.error ??
        (r.venues.length === 0 ? `No matching places on the open map around ${r.area ?? near}.` : ''),
    );
    setSearching(false);
  };

  const saveLink = async (e: FormEvent) => {
    e.preventDefault();
    setLinkError('');
    const r = await venueFromMapsLink(link.trim());
    const venue = r.venues[0];
    if (!venue) return setLinkError(r.error ?? 'We couldn’t read that link.');
    setLinked(venue);
    setLink('');
    onChoose(venue.name);
  };

  const exact = results?.venues.some((v) => v.match);

  return (
    <section className="card venue-panel" aria-labelledby="venue-heading">
      <h4 id="venue-heading" className="card-title">
        <span className="icon-badge gold" aria-hidden="true">
          <MapPin size={20} />
        </span>
        Venue
      </h4>

      <div aria-live="polite">
        {venueName ? (
          !check ? (
            <p className="muted">Looking up “{venueName}”…</p>
          ) : check.venues.length > 0 ? (
            <>
              <p className="notice success">
                “{venueName}” {known === linked && linked ? 'is saved from Google Maps.' : 'is on the map.'}
              </p>
              <ul className="plain venue-list">
                <VenueRow venue={check.venues[0]} chosen />
              </ul>
            </>
          ) : (
            <div className="notice">
              <p>
                “{venueName}” isn’t on the open map yet — that’s common for local banquets.{' '}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Find it on Google Maps<span className="sr-only"> (opens in a new tab)</span>
                </a>
                , then paste its link here to save its location.
              </p>
              <form className="ask-row" onSubmit={(e) => void saveLink(e)}>
                <label htmlFor="maps-link" className="sr-only">
                  Google Maps link to {venueName}
                </label>
                <input
                  id="maps-link"
                  type="url"
                  inputMode="url"
                  placeholder="https://maps.app.goo.gl/…"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  aria-describedby={linkError ? 'maps-link-error' : undefined}
                />
                <button type="submit" className="btn" disabled={link.trim().length < 12}>
                  Save location
                </button>
              </form>
              {linkError && (
                <p id="maps-link-error" className="field-error" role="alert">
                  {linkError}
                </p>
              )}
            </div>
          )
        ) : (
          <p className="muted">
            No venue chosen yet — tell us what you’d like and we’ll find the closest matches.
          </p>
        )}
      </div>

      <form className="venue-search" onSubmit={(e) => void search(e)}>
        <div className="venue-search-grid">
          <div className="field">
            <label htmlFor="venue-wish">What kind of place would you like?</label>
            <input
              id="venue-wish"
              value={wish}
              maxLength={LIMITS.venueMax}
              placeholder="e.g. rooftop with dine-in, garden with a banquet hall"
              onChange={(e) => setWish(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="venue-near">Near</label>
            <input
              id="venue-near"
              value={near}
              maxLength={LIMITS.cityMax}
              placeholder="Locality, town or PIN code"
              onChange={(e) => setNear(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="venue-radius">Within</label>
            <select id="venue-radius" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}>
              <option value={12}>About 12 km</option>
              <option value={25}>About 25 km</option>
            </select>
          </div>
          <button type="submit" className="btn primary" disabled={searching || near.trim().length < 2}>
            <Search size={16} aria-hidden="true" /> {searching ? 'Searching…' : 'Find places'}
          </button>
        </div>
        <p className="hint">
          {TYPE_WORDS[venueType] ? `Focusing on ${TYPE_WORDS[venueType]}. ` : ''}A locality or PIN code (e.g.
          700130) gives the most accurate area. Takes a few seconds.
        </p>
      </form>

      <div aria-live="polite">
        {results?.area && (
          <p className="area-note">
            Searched around <strong>{results.area}</strong>. Not your area? Change “Near” to your locality or
            PIN code.
          </p>
        )}
        {searchError && <p className="notice">{searchError}</p>}
        {results && results.venues.length > 0 && (
          <>
            <p className="hint">
              {results.wish && !exact
                ? `Nothing on the open map is described as “${results.wish}” exactly — these are the closest matches. `
                : `${results.venues.length} places, best matches first. `}
              Open Google Maps for photos, ratings and reviews before you choose.
            </p>
            <ul className="plain venue-list">
              {results.venues.map((v) => (
                <VenueRow
                  key={v.osmUrl}
                  venue={v}
                  chosen={v.name === venueName}
                  onChoose={() => onChoose(v.name)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
      <p className="hint">
        Venue data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap contributors<span className="sr-only"> (opens in a new tab)</span>
        </a>
        . Prices and availability are never assumed — confirm with the venue.
      </p>
    </section>
  );
}
