import {
  Building2,
  Check,
  ClipboardPaste,
  ExternalLink,
  LocateFixed,
  MapPin,
  Search,
  Star,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { checkVenue, findVenues, venueFromMapsLink } from '../lib/api';
import { LIMITS } from '../lib/validation';
import type { Venue, VenueType } from '../types';

interface Props {
  city: string;
  venueName: string;
  venueType: VenueType;
  /** The user's own description of the place they want. */
  preference: string;
  onChoose: (venue: Venue) => void;
  /** The venue chosen so far (from a search or a Google Maps link). */
  chosen: Venue | null;
  /** Why a Google Maps link typed as the venue couldn't be read. */
  resolveError?: string;
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

const isLink = (text: string) => /^https?:\/\//i.test(text.trim());
/** Adds the city to a search unless it was already typed. */
const withCity = (query: string, city: string) =>
  query.toLowerCase().includes(city.trim().toLowerCase()) ? query : `${query} ${city}`;
const googleSearch = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

function Rating({ venue }: { venue: Venue }) {
  if (venue.rating === undefined) return null;
  return (
    <span
      className="badge rating"
      aria-label={`Rated ${venue.rating} out of 5 from ${venue.reviews ?? 0} reviews`}
    >
      <Star size={12} aria-hidden="true" fill="currentColor" /> {venue.rating}
      {venue.reviews !== undefined && (
        <span aria-hidden="true"> ({venue.reviews.toLocaleString('en-IN')})</span>
      )}
    </span>
  );
}

function VenueRow({ venue, chosen, onChoose }: { venue: Venue; chosen: boolean; onChoose?: () => void }) {
  return (
    <li className="venue-row">
      <span className="icon-badge" aria-hidden="true">
        <Building2 size={18} />
      </span>
      <div className="venue-row-main">
        <strong>{venue.name}</strong>
        <div className="venue-tags">
          <span className="badge subtle">{venue.kind}</span>
          <Rating venue={venue} />
          {venue.distanceKm !== undefined && <span className="badge subtle">{venue.distanceKm} km</span>}
          {venue.match && <span className="badge match">{venue.match}</span>}
        </div>
        {venue.address && <p className="muted small">{venue.address}</p>}
        <div className="venue-links">
          <a href={venue.mapsUrl} target="_blank" rel="noopener noreferrer">
            Photos & reviews on Google Maps<span className="sr-only"> (opens in a new tab)</span>
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

/**
 * Two ways to settle the venue: look up a specific place by name or Google
 * Maps link (matched like a search engine would), or discover places of the
 * right kind near an area — or near the user.
 */
export function VenuePanel({
  city,
  venueName,
  venueType,
  preference,
  onChoose,
  chosen,
  resolveError,
}: Props) {
  const [query, setQuery] = useState('');
  const [lookup, setLookup] = useState<{ query: string; venues: Venue[]; error?: string } | null>(null);
  const [looking, setLooking] = useState(false);
  const [wish, setWish] = useState(preference);
  const [near, setNear] = useState(city);
  const [radiusKm, setRadiusKm] = useState(12);
  const [results, setResults] = useState<{ venues: Venue[]; wish: string; area?: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const known = chosen?.name === venueName ? chosen : undefined;
  const pendingLink = isLink(venueName);
  // A venue name typed in the form (not yet confirmed) is looked up once, to offer the matches.
  const typedName = venueName && !known && !pendingLink ? venueName : '';

  useEffect(() => {
    if (!typedName) return;
    let active = true;
    void checkVenue(typedName, city).then((r) => {
      if (active) setLookup({ query: typedName, ...r });
    });
    return () => {
      active = false;
    };
  }, [typedName, city]);

  const choose = (venue: Venue) => {
    setResults(null);
    setLookup(null);
    setQuery('');
    setSearchError('');
    onChoose(venue);
  };

  /** One box: a Google Maps link is read directly; a name is matched like a search engine would. */
  const find = (e: FormEvent) => {
    e.preventDefault();
    void lookUp(query.trim());
  };

  const lookUp = async (text: string) => {
    if (text.length < 2) return;
    setLooking(true);
    if (isLink(text)) {
      const r = await venueFromMapsLink(text);
      setLooking(false);
      if (r.venues[0]) return choose(r.venues[0]);
      return setLookup({ query: text, venues: [], error: r.error });
    }
    const r = await checkVenue(text, city);
    setLooking(false);
    setLookup({ query: text, ...r });
  };

  /** Reads a Google Maps link the user just copied (Share → Copy link) and uses it. */
  const pasteLink = async () => {
    let text = '';
    try {
      text = (await navigator.clipboard.readText()).trim();
    } catch {
      // Clipboard access declined or unsupported; the box above still takes the link.
    }
    const link = text.match(/https?:\/\/\S+/)?.[0] ?? '';
    if (!link) {
      setLookup(
        (l) => l && { ...l, error: 'No Google Maps link was copied yet — or paste it into the box above.' },
      );
      return;
    }
    setQuery(link);
    void lookUp(link);
  };

  const discover = async (position?: { lat: number; lon: number }) => {
    setSearching(true);
    setSearchError('');
    const wanted = wish.trim();
    const r = await findVenues(city, {
      venueType,
      preference: wanted,
      near: near.trim(),
      radiusKm,
      position,
    });
    setResults({ venues: r.venues, wish: wanted, area: r.area });
    setSearchError(
      r.error ??
        (r.venues.length === 0 ? `No matching places on the open map around ${r.area ?? near}.` : ''),
    );
    setSearching(false);
  };

  const nearMe = () => {
    if (!('geolocation' in navigator)) return setSearchError('Your browser can’t share its location.');
    setSearching(true);
    navigator.geolocation.getCurrentPosition(
      (p) => void discover({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => {
        setSearching(false);
        setSearchError('Location access was declined — type your locality or PIN code instead.');
      },
      { timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const exact = results?.venues.some((v) => v.match);
  const showLookup = lookup && lookup.query !== known?.name;

  return (
    <section className="card venue-panel" aria-labelledby="venue-heading">
      <h4 id="venue-heading" className="card-title">
        <span className="icon-badge gold" aria-hidden="true">
          <MapPin size={20} />
        </span>
        Venue
      </h4>

      <div aria-live="polite" className="venue-status">
        {pendingLink ? (
          resolveError ? (
            <p className="notice warning">{resolveError}</p>
          ) : (
            <p className="muted">Reading your Google Maps link…</p>
          )
        ) : known ? (
          <>
            <p className="notice success">
              <Check size={16} aria-hidden="true" /> “{known.name}” is your venue
              {known.kind === 'from Google Maps' ? ' — saved from Google Maps.' : '.'}
            </p>
            <ul className="plain venue-list">
              <VenueRow venue={known} chosen />
            </ul>
          </>
        ) : (
          !venueName && (
            <p className="muted">No venue yet — find a specific place, or discover places near you.</p>
          )
        )}
      </div>

      <form className="venue-find" onSubmit={find}>
        <label htmlFor="venue-query">Find a specific venue</label>
        <div className="venue-find-row">
          <input
            id="venue-query"
            value={query}
            maxLength={LIMITS.venueLinkMax}
            placeholder="Venue name (e.g. Bubble and Tea Kolkata) or a Google Maps link"
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn primary" disabled={looking || query.trim().length < 2}>
            <Search size={16} aria-hidden="true" /> {looking ? 'Finding…' : 'Find'}
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {showLookup &&
          (lookup.venues.length > 0 ? (
            <>
              <p className="hint">
                {lookup.venues.length === 1 ? 'Is this the place?' : 'Did you mean one of these?'} Choose it
                to make it your venue.
              </p>
              <ul className="plain venue-list">
                {lookup.venues.map((v) => (
                  <VenueRow key={v.osmUrl + v.name} venue={v} chosen={false} onChoose={() => choose(v)} />
                ))}
              </ul>
            </>
          ) : (
            <div className="notice lookup-miss">
              <p>
                {lookup.error ??
                  `We couldn’t find “${lookup.query}” on the open map — many local places aren’t listed there yet.`}
              </p>
              {!isLink(lookup.query) && (
                <ol className="lookup-steps">
                  <li>
                    <a
                      className="btn small"
                      href={googleSearch(withCity(lookup.query, city))}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={14} aria-hidden="true" /> Search Google Maps for “{lookup.query}”
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>{' '}
                    — it understands loose names.
                  </li>
                  <li>Open the right place, then Share → Copy link.</li>
                  <li>
                    <button type="button" className="btn small primary" onClick={() => void pasteLink()}>
                      <ClipboardPaste size={14} aria-hidden="true" /> Use the copied link
                    </button>
                  </li>
                </ol>
              )}
            </div>
          ))}
      </div>

      <hr className="venue-divider" />

      <form
        className="venue-search"
        onSubmit={(e) => {
          e.preventDefault();
          void discover();
        }}
      >
        <h5 className="col-title">Discover places</h5>
        <div className="venue-search-grid">
          <div className="field wish">
            <label htmlFor="venue-wish">What kind of place?</label>
            <input
              id="venue-wish"
              value={wish}
              maxLength={LIMITS.venueMax}
              placeholder="e.g. rooftop café, garden with a banquet hall"
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
              <option value={5}>5 km</option>
              <option value={12}>12 km</option>
              <option value={25}>25 km</option>
            </select>
          </div>
        </div>
        <div className="venue-search-actions">
          <button type="submit" className="btn primary" disabled={searching || near.trim().length < 2}>
            <Search size={16} aria-hidden="true" /> {searching ? 'Searching…' : 'Find places'}
          </button>
          <button type="button" className="btn" disabled={searching} onClick={nearMe}>
            <LocateFixed size={16} aria-hidden="true" /> Near me
          </button>
          <span className="hint">
            {TYPE_WORDS[venueType] ? `Focusing on ${TYPE_WORDS[venueType]}. ` : ''}A PIN code gives the most
            accurate area.
          </span>
        </div>
      </form>

      <div aria-live="polite">
        {results?.area && (
          <p className="area-note">
            Searched around <strong>{results.area}</strong>. Not your area? Change “Near”.
          </p>
        )}
        {searchError && <p className="notice">{searchError}</p>}
        {results && results.venues.length > 0 && (
          <>
            <p className="hint">
              {results.wish && !exact
                ? `Nothing on the map is described as “${results.wish}” exactly — these are the closest matches. `
                : `${results.venues.length} places, best matches first. `}
              Open Google Maps for photos, ratings and reviews before you choose.
            </p>
            <ul className="plain venue-list">
              {results.venues.map((v) => (
                <VenueRow
                  key={v.osmUrl + v.name}
                  venue={v}
                  chosen={v.name === venueName}
                  onChoose={() => choose(v)}
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
