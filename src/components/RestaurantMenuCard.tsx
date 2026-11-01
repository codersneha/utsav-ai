import { ExternalLink, ImagePlus, Keyboard, ScanLine, Sparkles } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
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

const MODES: Record<MenuSource, { label: string; icon: typeof ScanLine }> = {
  photos: { label: 'Menu photos', icon: ScanLine },
  text: { label: 'Type or paste it', icon: Keyboard },
  estimate: { label: 'Estimate for me', icon: Sparkles },
};

const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Where the dishes in an order came from, in a sentence. */
function sourceNote(order: PartyOrder, place: string): string {
  if (order.source === 'estimate')
    return `Estimated from ${order.itemsRead} typical dishes — not a real menu. Add the ${place}’s menu for exact prices.`;
  if (order.source === 'text') return `Read ${order.itemsRead} dishes from the menu you typed.`;
  return `Read ${order.itemsRead} dishes from ${order.pages} menu ${order.pages === 1 ? 'photo' : 'photos'}.`;
}

function ModeTabs({
  modes,
  mode,
  onPick,
}: {
  modes: MenuSource[];
  mode: MenuSource;
  onPick: (m: MenuSource) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label="How to add the menu">
      {modes.map((m) => {
        const { label, icon: Icon } = MODES[m];
        return (
          <button
            key={m}
            type="button"
            className={`segment${mode === m ? ' active' : ''}`}
            aria-pressed={mode === m}
            onClick={() => onPick(m)}
          >
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        );
      })}
    </div>
  );
}

function FilePicker({
  label,
  icon,
  primary,
  busy,
  onFiles,
}: {
  label: string;
  icon: ReactNode;
  primary?: boolean;
  busy: boolean;
  onFiles: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className={`btn${primary ? ' primary' : ''} upload-btn`}>
      {icon} {label}
      <input
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        onChange={onFiles}
        disabled={busy}
      />
    </label>
  );
}

function PhotoSteps({
  venue,
  city,
  busy,
  hasPhotos,
  onFiles,
}: {
  venue: string;
  city: string;
  busy: boolean;
  hasPhotos: boolean;
  onFiles: (e: ChangeEvent<HTMLInputElement>, more: boolean) => void;
}) {
  const menuSearch = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue} ${city} menu`)}`;
  const mainLabel = busy ? 'Reading the menu…' : hasPhotos ? 'Read a new menu' : 'Add menu photos';
  return (
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
          <FilePicker
            primary
            label={mainLabel}
            icon={<ScanLine size={18} aria-hidden="true" />}
            busy={busy}
            onFiles={(e) => onFiles(e, false)}
          />
          {hasPhotos && (
            <FilePicker
              label="Add more pages"
              icon={<ImagePlus size={18} aria-hidden="true" />}
              busy={busy}
              onFiles={(e) => onFiles(e, true)}
            />
          )}
        </div>
        <p className="hint">
          Select all the pages at once — up to {MAX_PAGES} photos. Photos are not stored.
        </p>
      </li>
    </ol>
  );
}

function MenuTextForm({
  place,
  busy,
  onBuild,
  onError,
}: {
  place: string;
  busy: boolean;
  onBuild: (text: string) => void;
  onError: (message: string) => void;
}) {
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const menu = text.trim();
    if (menu.length < LIMITS.menuTextMin) return onError('Paste a few dishes with their prices.');
    onBuild(menu);
  };
  return (
    <form className="menu-text" onSubmit={submit}>
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
  );
}

function OrderTable({ order }: { order: PartyOrder }) {
  const categories = [...new Set(order.lines.map((l) => l.category))];
  return (
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
                    <span className={`diet ${l.veg ? 'veg' : 'nonveg'}`}>{l.veg ? 'Veg' : 'Non-veg'}</span>
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
  );
}

function OrderView({ order, place }: { order: PartyOrder; place: string }) {
  const totals: [string, number][] = [
    ['Order total', order.total],
    ['Per guest', order.perHead],
    ['Food budget', order.budget],
  ];
  return (
    <div className="party-order">
      {order.source === 'estimate' && <p className="badge subtle">Estimated prices</p>}
      <div className="menu-budget" role="group" aria-label="Order cost">
        {totals.map(([label, amount]) => (
          <div key={label}>
            <span className="eyebrow">{label}</span>
            <strong>{formatInr(amount)}</strong>
          </div>
        ))}
      </div>
      <OrderTable order={order} />
      <p className="hint">
        {sourceNote(order, place)}
        {order.trimmed ? ' Quantities were reduced to fit your budget.' : ''} {order.note} Check taxes and the
        service charge with the {place}.
      </p>
    </div>
  );
}

function MenuIntro({
  venue,
  place,
  guests,
  budget,
}: {
  venue: string;
  place: string;
  guests: number;
  budget: number;
}) {
  return (
    <>
      <h4 id="restaurant-menu-heading" className="card-title">
        <span className="icon-badge gold" aria-hidden="true">
          <ScanLine size={20} />
        </span>
        {venue ? `Party order from ${venue}’s menu` : `Party order from the ${place}’s menu`}
      </h4>
      <p className="muted small">
        {venue
          ? `${venue} serves the food, so we don’t invent a menu. Add its menu to get a custom order for ${guests} guests within your food budget of ${formatInr(budget)}.`
          : `A ${place} serves its own food, so we don’t invent a menu. Choose your ${place} in the Venue card (Vendors tab) to get an order from its real menu — or type a menu, or let us estimate one from typical prices. Food budget: ${formatInr(budget)} for ${guests} guests.`}
      </p>
    </>
  );
}

function EstimateBox({
  place,
  city,
  busy,
  onEstimate,
}: {
  place: string;
  city: string;
  busy: boolean;
  onEstimate: () => void;
}) {
  return (
    <div className="menu-estimate">
      <p className="hint">
        We’ll suggest a party order from typical {place} dishes and prices in {city}. It’s a starting point
        for budgeting — your {place}’s own menu will differ.
      </p>
      <button type="button" className="btn primary" disabled={busy} onClick={onEstimate}>
        <Sparkles size={16} aria-hidden="true" /> {busy ? 'Estimating…' : 'Estimate an order'}
      </button>
    </div>
  );
}

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
      setError(errorText(err, 'We couldn’t read that menu.'));
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
      await build({ source: 'photos', images, known: keep?.items ?? [] }, (keep?.pages ?? 0) + images.length);
    } catch (err) {
      setError(errorText(err, 'We couldn’t read those photos.'));
    }
  };

  const pick = (m: MenuSource) => {
    setPicked(m);
    setError('');
  };

  return (
    <section className="card restaurant-menu" aria-labelledby="restaurant-menu-heading">
      <MenuIntro venue={venue} place={place} guests={details.guests} budget={budget} />

      <ModeTabs modes={modes} mode={mode} onPick={pick} />

      {mode === 'photos' && (
        <PhotoSteps
          venue={venue}
          city={details.city}
          busy={busy}
          hasPhotos={fromPhotos}
          onFiles={(e, more) => void onFiles(e, more)}
        />
      )}
      {mode === 'text' && (
        <MenuTextForm
          place={place}
          busy={busy}
          onBuild={(text) => void build({ source: 'text', text }, 0)}
          onError={setError}
        />
      )}
      {mode === 'estimate' && (
        <EstimateBox
          place={place}
          city={details.city}
          busy={busy}
          onEstimate={() => void build({ source: 'estimate' }, 0)}
        />
      )}

      <div aria-live="polite">
        {error && <p className="notice warning">{error}</p>}
        {order && <OrderView order={order} place={place} />}
      </div>
    </section>
  );
}
