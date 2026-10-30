import { Building2, Check, ClipboardPaste, ExternalLink, Link2, MapPin } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { venueFromMapsLink } from '../lib/api';
import { LIMITS } from '../lib/validation';
import type { Venue, VenueType } from '../types';

interface Props {
  city: string;
  venueName: string;
  venueType: VenueType;
  /** The user's own description of the place they want. */
  preference: string;
  onChoose: (venue: Venue) => void;
  /** The venue saved so far, read from a Google Maps link. */
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
const googleSearch = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

function VenueRow({ venue }: { venue: Venue }) {
  return (
    <li className="venue-row">
      <span className="icon-badge" aria-hidden="true">
        <Building2 size={18} />
      </span>
      <div className="venue-row-main">
        <strong>{venue.name}</strong>
        {venue.address && <p className="muted small">{venue.address}</p>}
        <div className="venue-links">
          <a href={venue.mapsUrl} target="_blank" rel="noopener noreferrer">
            Photos & reviews on Google Maps<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </li>
  );
}

/**
 * The venue comes from Google Maps: the user finds the place there (the search
 * is already set up for the kind of venue they want), copies its link and
 * pastes it here. The link gives the exact name and location.
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
  const [link, setLink] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');

  const known = chosen?.name === venueName ? chosen : undefined;
  const pendingLink = isLink(venueName);
  // A name typed in the form is searched as it is; otherwise the best places of the right kind.
  const typedName = venueName && !known && !pendingLink ? venueName : '';
  const what = preference.trim() || TYPE_WORDS[venueType] || 'party venues';
  const search = typedName ? `${typedName} ${city}` : `best ${what} near ${city}`;

  const applyLink = async (text: string) => {
    const url = text.match(/https?:\/\/\S+/)?.[0] ?? '';
    if (!url) return setError('That isn’t a Google Maps link — in Google Maps, tap Share → Copy link.');
    setError('');
    setReading(true);
    const r = await venueFromMapsLink(url);
    setReading(false);
    if (!r.venues[0]) return setError(r.error ?? 'We couldn’t read that link — copy it again from Share.');
    setLink('');
    onChoose(r.venues[0]);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void applyLink(link);
  };

  /** Reads the link the user just copied in Google Maps. */
  const pasteCopied = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) return void applyLink(text);
    } catch {
      // Clipboard access declined or unsupported; the box still takes the link.
    }
    setError('No link was copied yet — or paste it into the box.');
  };

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
              <Check size={16} aria-hidden="true" /> “{known.name}” is your venue.
            </p>
            <ul className="plain venue-list">
              <VenueRow venue={known} />
            </ul>
          </>
        ) : typedName ? (
          <p className="muted">
            Your venue: <strong>{typedName}</strong>. Add its Google Maps link to save its exact location.
          </p>
        ) : (
          <p className="muted">No venue yet — pick one on Google Maps and paste its link here.</p>
        )}
      </div>

      <ol className="lookup-steps venue-steps">
        <li>
          <a className="btn small" href={googleSearch(search)} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} aria-hidden="true" />{' '}
            {typedName ? `Find “${typedName}” on Google Maps` : `Find ${what} near ${city} on Google Maps`}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
        <li>Open the place you like, then tap Share → Copy link.</li>
        <li>
          <form className="venue-find" onSubmit={submit}>
            <label htmlFor="venue-link">Paste its Google Maps link</label>
            <div className="venue-find-row">
              <input
                id="venue-link"
                inputMode="url"
                autoComplete="off"
                value={link}
                maxLength={LIMITS.venueLinkMax}
                placeholder="https://maps.app.goo.gl/…"
                onChange={(e) => setLink(e.target.value)}
              />
              <button type="submit" className="btn primary" disabled={reading || link.trim().length < 8}>
                <Link2 size={16} aria-hidden="true" /> {reading ? 'Reading…' : 'Use link'}
              </button>
            </div>
          </form>
          <button type="button" className="btn small" disabled={reading} onClick={() => void pasteCopied()}>
            <ClipboardPaste size={14} aria-hidden="true" /> Paste the copied link
          </button>
        </li>
      </ol>

      <div aria-live="polite">{error && <p className="notice warning">{error}</p>}</div>
      <p className="hint">
        {known ? 'To change the venue, paste another link. ' : ''}Prices and availability are never assumed —
        confirm with the venue.
      </p>
    </section>
  );
}
