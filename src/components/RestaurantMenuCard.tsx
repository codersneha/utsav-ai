import { ExternalLink, ImagePlus, Keyboard, ScanLine, Sparkles } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { scanMenu, type MenuRequest } from '../lib/api';
import { isPartyOrder } from '../lib/guards';
import { ACCEPTED_TYPES, MENU_EDGE, prepareImage } from '../lib/image';
import { formatInr } from '../lib/plan';
import { partyFoodBudget } from '../lib/restaurantMenu';
import { LIMITS } from '../lib/validation';
import type { EventDetails, MenuSource, PartyOrder } from '../types';

interface Props {
  details: EventDetails;
  /** The planned catering amount (the user's own figure if edited). */
  catering?: number;
}

const MAX_PAGES = 8;

interface Saved {
  venue: string;
  order: PartyOrder;
}

const isSaved = (v: unknown): v is Saved | null =>
  v === null ||
  (typeof v === 'object' && typeof (v as Saved).venue === 'string' && isPartyOrder((v as Saved).order));

const CATEGORY_LABELS: Record<string, string> = {
  starter: 'Starters',
  main: 'Mains',
  bread: 'Breads',
  rice: 'Rice',
  dessert: 'Desserts',
  drink: 'Drinks',
  other: 'Other',
};

const MODE_LABELS: Record<MenuSource, string> = {
  photos: 'Menu photos',
  text: 'Type or paste it',
  estimate: 'Estimate for me',
};

/**
 * At a restaurant or café the venue's own menu is the menu, so no menu is
 * invented here. With a venue chosen, its menu photos (or pasted text) give a
 * custom order; without one, the user types a menu or asks for an estimate
 * from typical prices. Gemini reads the dishes; code prices the order and keeps
 * it within the food budget.
 */
export function RestaurantMenuCard({ details, catering }: Props) {
  const venue = details.venueName;
  const place = details.venueType === 'cafe' ? 'café' : 'restaurant';
  const budget = partyFoodBudget(details, catering);
  const modes: MenuSource[] = venue ? ['photos', 'text'] : ['text', 'estimate'];
  const [saved, setSaved] = usePersistentState<Saved | null>('restaurantMenu', null, isSaved);
  const [picked, setPicked] = useState<MenuSource | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const order = saved && saved.venue === venue ? saved.order : null;
  const mode = picked && modes.includes(picked) ? picked : modes[0];
  // Orders saved before menus could be typed or estimated were all read from photos.
  const fromPhotos = order !== null && (order.source ?? 'photos') === 'photos';

  const build = async (request: MenuRequest, pages: number) => {
    setError('');
    setBusy(true);
    try {
      const result = await scanMenu(details, request, budget);
      if (result.order) setSaved({ venue, order: { ...result.order, pages } });
      else setError(result.error ?? 'We couldn’t build an order from that menu.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t read that menu.');
    } finally {
      setBusy(false);
    }
  };

  /** Reads all chosen pages at once; "more pages" keeps the dishes already read. */
  const onFiles = async (e: ChangeEvent<HTMLInputElement>, more: boolean) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (files.length === 0) return;
    if (files.length > MAX_PAGES) return setError(`Choose up to ${MAX_PAGES} menu photos at a time.`);
    try {
      const images = await Promise.all(files.map((f) => prepareImage(f, MENU_EDGE)));
      const keep = more && fromPhotos ? order : null;
      await build(
        { source: 'photos', images, known: keep?.items ?? [] },
        (keep ? keep.pages : 0) + images.length,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t read those photos.');
    }
  };

  const onText = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim().length < LIMITS.menuTextMin) return setError('Paste a few dishes with their prices.');
    void build({ source: 'text', text: text.trim() }, 0);
  };

  const menuSearch = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${venue} ${details.city} menu`,
  )}`;
  const categories = order ? [...new Set(order.lines.map((l) => l.category))] : [];

  return (
    <section className="card restaurant-menu" aria-labelledby="restaurant-menu-heading">
      <h4 id="restaurant-menu-heading" className="card-title">
        <span className="icon-badge gold" aria-hidden="true">
          <ScanLine size={20} />
        </span>
        {venue ? `Party order from ${venue}’s menu` : `Party order from the ${place}’s menu`}
      </h4>
      <p className="muted small">
        {venue
          ? `${venue} serves the food, so we don’t invent a menu. Add its menu to get a custom order for ${details.guests} guests within your food budget of ${formatInr(budget)}.`
          : `A ${place} serves its own food, so we don’t invent a menu. Choose your ${place} in the Venue card (Vendors tab) to get an order from its real menu — or type a menu, or let us estimate one from typical prices. Food budget: ${formatInr(budget)} for ${details.guests} guests.`}
      </p>

      <div className="segmented" role="group" aria-label="How to add the menu">
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            className={`segment${mode === m ? ' active' : ''}`}
            aria-pressed={mode === m}
            onClick={() => {
              setPicked(m);
              setError('');
            }}
          >
            {m === 'photos' ? (
              <ScanLine size={16} aria-hidden="true" />
            ) : m === 'text' ? (
              <Keyboard size={16} aria-hidden="true" />
            ) : (
              <Sparkles size={16} aria-hidden="true" />
            )}{' '}
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {mode === 'photos' && (
        <ol className="menu-steps">
          <li>
            <a href={menuSearch} target="_blank" rel="noopener noreferrer">
              Open {venue} on Google Maps <ExternalLink size={14} aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            , then open <strong>Menu</strong> and screenshot each page — or photograph the printed menu.
          </li>
          <li>
            <div className="menu-upload">
              <label className="btn primary upload-btn">
                <ScanLine size={18} aria-hidden="true" />{' '}
                {busy ? 'Reading the menu…' : fromPhotos ? 'Read a new menu' : 'Add menu photos'}
                <input
                  type="file"
                  multiple
                  accept={ACCEPTED_TYPES.join(',')}
                  className="sr-only"
                  onChange={(e) => void onFiles(e, false)}
                  disabled={busy}
                />
              </label>
              {fromPhotos && (
                <label className="btn upload-btn">
                  <ImagePlus size={18} aria-hidden="true" /> Add more pages
                  <input
                    type="file"
                    multiple
                    accept={ACCEPTED_TYPES.join(',')}
                    className="sr-only"
                    onChange={(e) => void onFiles(e, true)}
                    disabled={busy}
                  />
                </label>
              )}
            </div>
            <p className="hint">
              Select all the pages at once — up to {MAX_PAGES} photos. Photos are not stored.
            </p>
          </li>
        </ol>
      )}

      {mode === 'text' && (
        <form className="menu-text" onSubmit={onText}>
          <label htmlFor="menu-text">Menu, with prices</label>
          <textarea
            id="menu-text"
            rows={6}
            value={text}
            maxLength={LIMITS.menuTextMax}
            placeholder={'e.g.\nPaneer tikka 280\nChicken biryani (full) 420\nCold coffee 160'}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="hint">Copy it from Zomato, Swiggy or the {place}’s website — any layout works.</p>
          <button type="submit" className="btn primary" disabled={busy}>
            <Keyboard size={16} aria-hidden="true" /> {busy ? 'Building the order…' : 'Build the order'}
          </button>
        </form>
      )}

      {mode === 'estimate' && (
        <div className="menu-estimate">
          <p className="hint">
            We’ll suggest a party order from typical {place} dishes and prices in {details.city}. It’s a
            starting point for budgeting — your {place}’s own menu will differ.
          </p>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void build({ source: 'estimate' }, 0)}
          >
            <Sparkles size={16} aria-hidden="true" /> {busy ? 'Estimating…' : 'Estimate an order'}
          </button>
        </div>
      )}

      <div aria-live="polite">
        {error && <p className="notice warning">{error}</p>}
        {order && (
          <div className="party-order">
            {order.source === 'estimate' && <p className="badge subtle">Estimated prices</p>}
            <div className="menu-budget" role="group" aria-label="Order cost">
              <div>
                <span className="eyebrow">Order total</span>
                <strong>{formatInr(order.total)}</strong>
              </div>
              <div>
                <span className="eyebrow">Per guest</span>
                <strong>{formatInr(order.perHead)}</strong>
              </div>
              <div>
                <span className="eyebrow">Food budget</span>
                <strong>{formatInr(order.budget)}</strong>
              </div>
            </div>
            <div className="table-wrap">
              <table className="order-table">
                <caption className="sr-only">Suggested order for {order.guests} guests</caption>
                <thead>
                  <tr>
                    <th scope="col">Dish</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Price</th>
                    <th scope="col">Cost</th>
                  </tr>
                </thead>
                {categories.map((c) => (
                  <tbody key={c}>
                    <tr className="order-group">
                      <th scope="rowgroup" colSpan={4}>
                        {CATEGORY_LABELS[c]}
                      </th>
                    </tr>
                    {order.lines
                      .filter((l) => l.category === c)
                      .map((l) => (
                        <tr key={l.name}>
                          <th scope="row">
                            {l.name}{' '}
                            <span className={`diet ${l.veg ? 'veg' : 'nonveg'}`}>
                              {l.veg ? 'Veg' : 'Non-veg'}
                            </span>
                            <span className="muted small"> · serves {l.serves}</span>
                          </th>
                          <td>× {l.quantity}</td>
                          <td>{formatInr(l.price)}</td>
                          <td>{formatInr(l.cost)}</td>
                        </tr>
                      ))}
                  </tbody>
                ))}
              </table>
            </div>
            <p className="hint">
              {order.source === 'estimate'
                ? `Estimated from ${order.itemsRead} typical dishes — not a real menu. Add the ${place}’s menu for exact prices.`
                : order.source === 'text'
                  ? `Read ${order.itemsRead} dishes from the menu you typed.`
                  : `Read ${order.itemsRead} dishes from ${order.pages} menu ${order.pages === 1 ? 'photo' : 'photos'}.`}
              {order.trimmed ? ' Quantities were reduced to fit your budget.' : ''} {order.note} Check taxes
              and the service charge with the {place}.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
