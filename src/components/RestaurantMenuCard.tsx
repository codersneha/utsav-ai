import { ExternalLink, ImagePlus, ScanLine } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { scanMenu } from '../lib/api';
import { isPartyOrder } from '../lib/guards';
import { ACCEPTED_TYPES, MENU_EDGE, prepareImage } from '../lib/image';
import { formatInr } from '../lib/plan';
import { partyFoodBudget } from '../lib/restaurantMenu';
import type { EventDetails, PartyOrder } from '../types';

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

/**
 * At a restaurant or café the venue's own menu is the menu. The user adds a
 * photo of it; Gemini reads the dishes and prices and suggests an order, and
 * code prices it and keeps it within the food budget.
 */
export function RestaurantMenuCard({ details, catering }: Props) {
  const venue = details.venueName;
  const budget = partyFoodBudget(details, catering);
  const [saved, setSaved] = usePersistentState<Saved | null>('restaurantMenu', null, isSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const order = saved && saved.venue === venue ? saved.order : null;

  /** Reads all chosen pages at once; "more pages" keeps the dishes already read. */
  const onFiles = async (e: ChangeEvent<HTMLInputElement>, more: boolean) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (files.length === 0) return;
    if (files.length > MAX_PAGES) return setError(`Choose up to ${MAX_PAGES} menu photos at a time.`);
    setError('');
    setBusy(true);
    try {
      const images = await Promise.all(files.map((f) => prepareImage(f, MENU_EDGE)));
      const known = more && order ? order.items : [];
      const result = await scanMenu(details, images, budget, known);
      if (result.order) {
        const pages = (more && order ? order.pages : 0) + images.length;
        setSaved({ venue, order: { ...result.order, pages } });
      } else setError(result.error ?? 'We couldn’t read that menu.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t read that menu.');
    } finally {
      setBusy(false);
    }
  };

  const menuSearch = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${venue || 'restaurant'} ${details.city} menu`,
  )}`;
  const categories = order ? [...new Set(order.lines.map((l) => l.category))] : [];

  return (
    <section className="card restaurant-menu" aria-labelledby="restaurant-menu-heading">
      <h4 id="restaurant-menu-heading" className="card-title">
        <span className="icon-badge gold" aria-hidden="true">
          <ScanLine size={20} />
        </span>
        {venue ? `Party order from ${venue}’s menu` : 'Party order from the restaurant’s menu'}
      </h4>
      <p className="muted small">
        At a restaurant or café the food comes from its own menu — no separate caterer. Add the menu pages and
        we’ll read every dish and price, then plan what to order for {details.guests} guests within your food
        budget of {formatInr(budget)}.
      </p>
      <ol className="menu-steps">
        <li>
          <a href={menuSearch} target="_blank" rel="noopener noreferrer">
            Open {venue || 'the restaurant'} on Google Maps <ExternalLink size={14} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          , then open <strong>Menu</strong> and screenshot each page — or photograph the printed menu.
        </li>
        <li>
          <div className="menu-upload">
            <label className="btn primary upload-btn">
              <ScanLine size={18} aria-hidden="true" />{' '}
              {busy ? 'Reading the menu…' : order ? 'Read a new menu' : 'Add menu photos'}
              <input
                type="file"
                multiple
                accept={ACCEPTED_TYPES.join(',')}
                className="sr-only"
                onChange={(e) => void onFiles(e, false)}
                disabled={busy}
              />
            </label>
            {order && (
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

      <div aria-live="polite">
        {error && <p className="notice warning">{error}</p>}
        {order && (
          <div className="party-order">
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
              Read {order.itemsRead} dishes from {order.pages} menu {order.pages === 1 ? 'photo' : 'photos'}.
              {order.trimmed ? ' Quantities were reduced to fit your budget.' : ''} {order.note} Prices are as
              printed; check taxes and the service charge with the restaurant.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
