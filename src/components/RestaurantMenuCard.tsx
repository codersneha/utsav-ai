import { ExternalLink, ScanLine } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { scanMenu } from '../lib/api';
import { isPartyOrder } from '../lib/guards';
import { ACCEPTED_TYPES, prepareImage } from '../lib/image';
import { formatInr } from '../lib/plan';
import { partyFoodBudget } from '../lib/restaurantMenu';
import type { EventDetails, PartyOrder } from '../types';

interface Props {
  details: EventDetails;
  /** The planned catering amount (the user's own figure if edited). */
  catering?: number;
}

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

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const result = await scanMenu(details, await prepareImage(file), budget);
      if (result.order) setSaved({ venue, order: result.order });
      else setError(result.error ?? 'We couldn’t read that menu.');
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
        At a restaurant or café the food comes from its own menu — no separate caterer. Add a photo of the
        menu and we’ll plan what to order for {details.guests} guests within your food budget of{' '}
        {formatInr(budget)}.
      </p>
      <ol className="menu-steps">
        <li>
          <a href={menuSearch} target="_blank" rel="noopener noreferrer">
            Open {venue || 'the restaurant'} on Google Maps <ExternalLink size={14} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>{' '}
          and screenshot the <strong>Menu</strong> photos — or photograph the printed menu.
        </li>
        <li>
          <label className="btn upload-btn">
            <ScanLine size={18} aria-hidden="true" /> {busy ? 'Reading the menu…' : 'Add a menu photo'}
            <input
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="sr-only"
              onChange={(e) => void onFile(e)}
              disabled={busy}
            />
          </label>
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
              Read {order.itemsRead} dishes from the menu.
              {order.trimmed ? ' Quantities were reduced to fit your budget.' : ''} {order.note} Prices are as
              printed; check taxes and the service charge with the restaurant.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
