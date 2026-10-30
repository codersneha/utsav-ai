import { Building2, Check, MapPin, Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { checkVenue, findVenues } from '../lib/api';
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

/** Checks the booked venue on the map, or finds the closest matches to what the user wants. */
export function VenuePanel({ city, venueName, venueType, preference, onChoose }: Props) {
  const [lookup, setLookup] = useState<{ key: string; venues: Venue[]; error?: string } | null>(null);
  const [wish, setWish] = useState(preference);
  const [results, setResults] = useState<{ venues: Venue[]; wish: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  // A venue picked from our own search is already on the map — no need to look it up again.
  const picked = results?.venues.find((v) => v.name === venueName);
  const key = `${venueName}|${city}`;

  useEffect(() => {
    if (!venueName || picked) return;
    let active = true;
    void checkVenue(venueName, city).then((r) => {
      if (active) setLookup({ key: `${venueName}|${city}`, ...r });
    });
    return () => {
      active = false;
    };
  }, [venueName, city, picked]);

  const check: { venues: Venue[]; error?: string } | null = picked
    ? { venues: [picked] }
    : lookup?.key === key
      ? lookup
      : null;

  const search = async (e?: FormEvent) => {
    e?.preventDefault();
    setSearching(true);
    setSearchError('');
    const wanted = wish.trim();
    const r = await findVenues(city, venueType, wanted);
    setResults({ venues: r.venues, wish: wanted });
    setSearchError(
      r.error ?? (r.venues.length === 0 ? `No matching places near ${city} on the open map yet.` : ''),
    );
    setSearching(false);
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
            <p className="muted">Checking “{venueName}” on the map…</p>
          ) : check.venues.length > 0 ? (
            <>
              <p className="notice success">“{venueName}” is on the map.</p>
              <ul className="plain venue-list">
                <VenueRow venue={check.venues[0]} chosen />
              </ul>
            </>
          ) : (
            <p className="notice">
              We couldn’t find “{venueName}” on OpenStreetMap — smaller venues are often missing.{' '}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venueName}, ${city}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Search Google Maps<span className="sr-only"> (opens in a new tab)</span>
              </a>
              {check.error ? ` (${check.error})` : ''}
            </p>
          )
        ) : (
          <p className="muted">
            No venue chosen yet — tell us what you’d like and we’ll find the closest matches.
          </p>
        )}
      </div>

      <form className="venue-search" onSubmit={(e) => void search(e)}>
        <label htmlFor="venue-wish">What kind of place would you like?</label>
        <div className="ask-row">
          <input
            id="venue-wish"
            value={wish}
            maxLength={LIMITS.venueMax}
            placeholder="e.g. rooftop with dine-in, garden with a banquet hall"
            onChange={(e) => setWish(e.target.value)}
          />
          <button type="submit" className="btn primary" disabled={searching}>
            <Search size={16} aria-hidden="true" /> {searching ? 'Searching…' : 'Find places'}
          </button>
        </div>
        <p className="hint">
          Searching around {city}
          {TYPE_WORDS[venueType] ? `, focusing on ${TYPE_WORDS[venueType]}` : ''}. Takes a few seconds.
        </p>
      </form>

      <div aria-live="polite">
        {searchError && <p className="notice">{searchError}</p>}
        {results && results.venues.length > 0 && (
          <>
            <p className="hint">
              {results.wish && !exact
                ? `Nothing on the open map is described as “${results.wish}” exactly — these are the closest matches. `
                : `${results.venues.length} places near ${city}, best matches first. `}
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
