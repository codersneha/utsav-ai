import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react';
import { usePersistentState } from '../../hooks/usePersistentState';
import { newId } from '../../lib/entries';
import { isArrayOf } from '../../lib/guards';
import {
  LIMITS,
  OCCASIONS,
  forecastHeadcount,
  isGuestGroup,
  isOccasion,
  type GuestGroup,
  type Occasion,
  type Reply,
} from '../../lib/headcount';
import { isNumber } from '../../lib/storage';
import { MarigoldMark, Toran } from '../Brand';
import { NumberField } from '../NumberField';
import { SelectField } from '../plannerForm/fields';
import { ForecastCard } from './ForecastCard';
import { GroupForm } from './GroupForm';
import { GroupList } from './GroupList';
import { EXAMPLE_GROUPS, OCCASION_LABELS, OCCASION_WORDS } from './labels';

const DEFAULT_PLATE_PRICE = 800;

const pageLink = () =>
  typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`;

/**
 * A free, no-login tool: list the families you invited and what they said, and get the likely
 * headcount, the number to guarantee to the caterer and the money at stake.
 */
export function HeadcountPage() {
  const [occasion, setOccasion] = usePersistentState<Occasion>('headcount.occasion', 'wedding', isOccasion);
  const [platePrice, setPlatePrice] = usePersistentState<number>(
    'headcount.plate',
    DEFAULT_PLATE_PRICE,
    isNumber,
  );
  const [groups, setGroups] = usePersistentState<GuestGroup[]>(
    'headcount.groups',
    [],
    isArrayOf(isGuestGroup),
  );
  const forecast = forecastHeadcount(groups, platePrice);
  const full = groups.length >= LIMITS.groupsMax;

  const add = (group: Omit<GuestGroup, 'id'>) =>
    setGroups((list) => [...list, { ...group, id: newId('group') }]);
  const setReply = (id: string, reply: Reply) =>
    setGroups((list) => list.map((g) => (g.id === id ? { ...g, reply } : g)));
  const remove = (id: string) => setGroups((list) => list.filter((g) => g.id !== id));
  const loadExample = () => setGroups(EXAMPLE_GROUPS.map((g) => ({ ...g, id: newId('group') })));

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className="site-header">
        <div className="container">
          <p className="logo">
            <MarigoldMark />
            <span>
              Utsav<em>AI</em>
            </span>
          </p>
        </div>
        <Toran />
      </header>
      <main id="main" className="container headcount">
        <section className="headcount-intro">
          <p className="eyebrow">Free headcount check</p>
          <h1>How many guests will actually come?</h1>
          <p className="lead">
            Your caterer charges for the plates you guarantee, whoever turns up. List the families you invited
            and what they said on the phone. You get a likely headcount, the number to guarantee and the money
            at stake.
          </p>
        </section>

        <section className="card" aria-labelledby="occasion-heading">
          <h2 id="occasion-heading" className="card-title">
            1. The occasion
          </h2>
          <div className="headcount-basics">
            <div className="field">
              <SelectField
                id="occasion"
                label="What are you hosting?"
                value={occasion}
                options={OCCASIONS}
                labels={(o) => OCCASION_LABELS[o]}
                onChange={setOccasion}
              />
            </div>
            <NumberField
              id="plate-price"
              label="Caterer’s price per plate (₹)"
              value={platePrice}
              min={0}
              max={LIMITS.plateMax}
              hint="From your caterer’s quote. A rough figure is fine."
              onChange={setPlatePrice}
            />
          </div>
        </section>

        <section className="card" aria-labelledby="guests-heading">
          <div className="panel-head">
            <h2 id="guests-heading" className="card-title">
              2. Who is invited
            </h2>
            <div className="actions">
              <button type="button" className="btn small" onClick={loadExample}>
                <Sparkles size={16} aria-hidden="true" /> Try an example
              </button>
              {groups.length > 0 && (
                <button type="button" className="btn small ghost" onClick={() => setGroups([])}>
                  <RotateCcw size={16} aria-hidden="true" /> Clear all
                </button>
              )}
            </div>
          </div>
          <p className="hint">
            One row per family, or one row for a batch of similar guests such as an office. Count everyone the
            invitation covers.
          </p>
          {full ? (
            <p className="notice">
              That’s the most rows this list holds. Combine similar guests into one row.
            </p>
          ) : (
            <GroupForm onAdd={add} />
          )}
          <GroupList groups={groups} onReply={setReply} onRemove={remove} />
        </section>

        <ForecastCard forecast={forecast} occasion={OCCASION_WORDS[occasion]} link={pageLink()} />

        <section className="card headcount-more">
          <h2 className="card-title">Planning the whole event?</h2>
          <p>
            UtsavAI also plans the budget, the menu for your tradition, the timeline and your vendor list,
            free.
          </p>
          <a className="btn" href="/">
            Open the full planner <ArrowRight size={18} aria-hidden="true" />
          </a>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container">
          <p>UtsavAI · Estimates, not quotes · Your guest list stays in this browser.</p>
        </div>
      </footer>
    </>
  );
}
