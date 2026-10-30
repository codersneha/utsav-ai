import { HandPlatter, PartyPopper, PiggyBank, RefreshCw, Sparkles, Utensils, Wand2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  MENU_TIER_LABELS,
  ceremoniesFor,
  decorPhoto,
  decorTier,
  findDish,
  menuCost,
  menuFor,
  type Ceremony,
  type DecorTier,
  type Photo as DecorPhoto,
} from '../lib/culture';
import { formatInr } from '../lib/plan';
import { LIMITS } from '../lib/validation';
import type { EventDetails, Ideas, IdeasSection } from '../types';
import { InspirationCard } from './InspirationCard';

interface Props {
  details: EventDetails;
  ideas: Ideas | null;
  loading: boolean;
  busySection: IdeasSection | null;
  notice?: string;
  onRegenerate: () => void;
  onRefine: (request: string) => void;
  onRefreshSection: (section: IdeasSection, request?: string) => void;
  onUseInspiration: (look: { colors: string; note: string }) => void;
  /** The planned catering and décor amounts (the user's own figures if edited). */
  catering?: number;
  decor?: number;
}

/** A credited décor photo from Wikimedia Commons, or the colour palette when no photo fits. */
function Photo({ photo, alt, palette }: { photo?: DecorPhoto; alt: string; palette: string[] }) {
  if (!photo) {
    return (
      <div
        className="photo-fallback"
        style={{ background: `linear-gradient(135deg, ${palette.join(', ')})` }}
        role="img"
        aria-label={`Colour palette for ${alt}`}
      />
    );
  }
  return (
    <figure className="photo">
      <img src={photo.src} alt={alt} loading="lazy" decoding="async" />
      <figcaption>
        <a href={photo.page} target="_blank" rel="noopener noreferrer">
          Photo: Wikimedia Commons, {photo.license}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </figcaption>
    </figure>
  );
}

function SectionRefine({
  section,
  label,
  placeholder,
  busy,
  onRefresh,
}: {
  section: IdeasSection;
  label: string;
  placeholder: string;
  busy: boolean;
  onRefresh: (section: IdeasSection, request?: string) => void;
}) {
  const [request, setRequest] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (request.trim().length < 3 || busy) return;
    onRefresh(section, request.trim());
    setRequest('');
  };
  return (
    <form className="section-refine" onSubmit={submit} aria-label={label}>
      <label htmlFor={`refine-${section}`} className="sr-only">
        {label}
      </label>
      <input
        id={`refine-${section}`}
        value={request}
        maxLength={LIMITS.refinementMax}
        placeholder={placeholder}
        onChange={(e) => setRequest(e.target.value)}
      />
      <button type="submit" className="btn small primary" disabled={busy || request.trim().length < 3}>
        <Wand2 size={16} aria-hidden="true" /> Change
      </button>
      <button type="button" className="btn small" disabled={busy} onClick={() => onRefresh(section)}>
        <RefreshCw size={16} aria-hidden="true" /> New ideas
      </button>
    </form>
  );
}

function CeremonyCard({
  ceremony,
  idea,
  tier,
}: {
  ceremony: Ceremony;
  idea?: Ideas['ceremonies'][number];
  tier: DecorTier;
}) {
  const palette = ceremony.palette.map((p) => p.hex);
  // Show a photo only when it fits the budget level and (for AI ideas) the AI says it matches.
  const photo = idea?.photoMatches === false ? undefined : decorPhoto(ceremony, tier);
  return (
    <li className="ceremony-card card">
      <Photo photo={photo} alt={`${ceremony.name} décor`} palette={palette} />
      <div className="ceremony-body">
        <p className="eyebrow">
          {ceremony.name} · {ceremony.when}
        </p>
        <h4>{idea?.theme ?? ceremony.name}</h4>
        <p className="muted small">{ceremony.about}</p>
        <ul className="swatches" aria-label="Colours">
          {ceremony.palette.map((s) => (
            <li key={s.name}>
              <span className="swatch-dot" style={{ background: s.hex }} aria-hidden="true" />
              {s.name}
            </li>
          ))}
        </ul>
        <ul className="ticks">
          {(idea?.decor ?? ceremony.decor).map((d) => (
            <li key={d}>
              <Sparkles size={14} aria-hidden="true" /> {d}
            </li>
          ))}
        </ul>
        <p className="food-note">
          <Utensils size={16} aria-hidden="true" /> {ceremony.food}
        </p>
      </div>
    </li>
  );
}

function MenuCard({ details, ideas, catering }: { details: EventDetails; ideas: Ideas; catering?: number }) {
  const plan = menuFor(details, catering);
  const chosen = new Map(ideas.menu.map((m) => [m.courseId, m.dishes]));
  const courses = plan.courses.filter((c) => (chosen.get(c.id) ?? []).length > 0);
  const cost = menuCost(ideas.menu, plan);
  const over = cost - plan.perPlate;
  return (
    <div className="menu-card">
      <p className="service-note">
        <HandPlatter size={18} aria-hidden="true" /> {plan.service}
      </p>
      <div className="menu-budget" role="group" aria-label="Menu cost">
        <div>
          <span className="eyebrow">Menu level</span>
          <strong>{MENU_TIER_LABELS[plan.tier]}</strong>
        </div>
        <div>
          <span className="eyebrow">Estimated cost</span>
          <strong>~{formatInr(cost)} per plate</strong>
        </div>
        <div>
          <span className="eyebrow">Your food budget</span>
          <strong>{formatInr(plan.perPlate)} per plate</strong>
        </div>
      </div>
      <p className={`hint${over > plan.perPlate * 0.05 ? ' negative' : ''}`}>
        {over > plan.perPlate * 0.05
          ? `About ${formatInr(over)} per plate over budget — drop a dish, or move money to catering in the Budget tab.`
          : `Fits your catering budget, with ${formatInr(plan.base)} per plate set aside for service, staff and staples. A bigger food budget brings premium dishes and more variety.`}
      </p>
      <ol className="courses">
        {courses.map((course) => (
          <li key={course.id} className="course">
            <h4>
              {course.name}
              {course.note && <span className="muted"> · {course.note}</span>}
            </h4>
            <ul className="dishes">
              {(chosen.get(course.id) ?? []).map((name) => {
                const dish = findDish(course.id, name, details);
                return (
                  <li key={name} className="dish">
                    <span className="dish-name">{name}</span>
                    <span className="diet-tags">
                      {dish?.diet === 'nonveg' ? (
                        <span className="diet nonveg">Non-veg</span>
                      ) : (
                        <span className="diet veg">Veg</span>
                      )}
                      {dish?.jain && <span className="diet jain">Jain</span>}
                      {dish && <span className="dish-cost">~{formatInr(dish.cost)}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
      <p className="hint">
        Dishes come from a checked list for this tradition. Costs are rough per-plate estimates — your
        caterer’s quote is what counts.
      </p>
    </div>
  );
}

/** Ceremonies with real photos, a course-by-course menu and extras — each part editable on its own. */
export function IdeasPanel(props: Props) {
  const { details, ideas, loading, busySection, notice } = props;
  const [request, setRequest] = useState('');
  const ceremonies = ceremoniesFor(details);
  const tier = decorTier(details, props.decor);
  const busy = (s: IdeasSection) => loading && (busySection === s || busySection === null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (request.trim().length < 3) return;
    props.onRefine(request.trim());
    setRequest('');
  };

  return (
    <section aria-labelledby="ideas-heading" className="ideas" aria-busy={loading}>
      <div className="card ideas-intro">
        <div className="panel-head">
          <h3 id="ideas-heading">Personalised ideas</h3>
          <button type="button" className="btn small" onClick={props.onRegenerate} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" />{' '}
            {loading && !busySection ? 'Generating…' : 'Generate new ideas'}
          </button>
        </div>
        <div aria-live="polite">
          {loading && !busySection && <p className="muted">Gemini is crafting ideas for your event…</p>}
          {!loading && notice && <p className="notice">{notice}</p>}
        </div>
        {ideas && (
          <>
            <p className="lead">{ideas.summary}</p>
            <p className="source-tag">
              {ideas.source === 'gemini' ? (
                <>
                  <Sparkles size={14} aria-hidden="true" /> Generated with Google Gemini, within checked{' '}
                  {details.eventType === 'wedding' ? 'traditions' : 'menus'} — suggestions, not bookings
                </>
              ) : (
                'Curated ideas from our tradition guide'
              )}
            </p>
          </>
        )}
        <form className="refine" onSubmit={submit} aria-label="Refine ideas">
          <label htmlFor="refine-input">Not quite right? Tell the AI what to change</label>
          <div className="ask-row">
            <input
              id="refine-input"
              value={request}
              maxLength={LIMITS.refinementMax}
              placeholder="e.g. our venue is a small terrace, and grandparents need seating"
              onChange={(e) => setRequest(e.target.value)}
            />
            <button type="submit" className="btn primary" disabled={loading || request.trim().length < 3}>
              Refine
            </button>
          </div>
          <div className="chips" role="group" aria-label="Quick refinements">
            {['More eco-friendly', 'Cheaper options', 'More traditional', 'Better for elders and kids'].map(
              (r) => (
                <button
                  key={r}
                  type="button"
                  className="chip"
                  disabled={loading}
                  onClick={() => props.onRefine(r)}
                >
                  {r}
                </button>
              ),
            )}
          </div>
        </form>
      </div>

      <InspirationCard onUse={props.onUseInspiration} />

      {ideas && (
        <>
          <section className="ideas-section" aria-labelledby="decor-heading" aria-busy={busy('decor')}>
            <div className="panel-head">
              <h3 id="decor-heading">{details.eventType === 'wedding' ? 'Ceremonies & décor' : 'Décor'}</h3>
              {busy('decor') && busySection === 'decor' && <span className="pill">Updating décor…</span>}
            </div>
            <SectionRefine
              section="decor"
              label="Change the décor"
              placeholder="e.g. more flowers for the biye, simpler haldi"
              busy={loading}
              onRefresh={props.onRefreshSection}
            />
            <ul className="ceremony-grid">
              {ceremonies.map((c) => (
                <CeremonyCard
                  key={c.id}
                  ceremony={c}
                  idea={ideas.ceremonies.find((i) => i.ceremonyId === c.id)}
                  tier={tier}
                />
              ))}
            </ul>
          </section>

          <section className="ideas-section" aria-labelledby="menu-heading" aria-busy={busy('menu')}>
            <div className="panel-head">
              <h3 id="menu-heading">The menu</h3>
              {busySection === 'menu' && <span className="pill">Updating menu…</span>}
            </div>
            <SectionRefine
              section="menu"
              label="Change the menu"
              placeholder="e.g. add ilish, lighter starters, winter sweets"
              busy={loading}
              onRefresh={props.onRefreshSection}
            />
            <MenuCard details={details} ideas={ideas} catering={props.catering} />
          </section>

          <section className="ideas-section" aria-labelledby="extras-heading" aria-busy={busy('extras')}>
            <div className="panel-head">
              <h3 id="extras-heading">Make it memorable</h3>
              <button
                type="button"
                className="btn small"
                disabled={loading}
                onClick={() => props.onRefreshSection('extras')}
              >
                <RefreshCw size={16} aria-hidden="true" />{' '}
                {busySection === 'extras' ? 'Updating…' : 'New ideas'}
              </button>
            </div>
            <div className="extras-grid">
              <div className="card">
                <h4 className="card-title">
                  <span className="icon-badge" aria-hidden="true">
                    <PartyPopper size={20} />
                  </span>
                  Activities
                </h4>
                <ul className="ticks">
                  {ideas.activities.map((a) => (
                    <li key={a}>
                      <Sparkles size={14} aria-hidden="true" /> {a}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card">
                <h4 className="card-title">
                  <span className="icon-badge teal" aria-hidden="true">
                    <PiggyBank size={20} />
                  </span>
                  Ways to save
                </h4>
                <ul className="ticks">
                  {ideas.budgetTips.map((t) => (
                    <li key={t}>
                      <Sparkles size={14} aria-hidden="true" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
