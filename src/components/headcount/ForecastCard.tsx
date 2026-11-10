import { MessageCircle, Phone } from 'lucide-react';
import {
  CLOSENESS,
  DISTANCES,
  HOUSEHOLD_MAX,
  TURNOUT_BY_CLOSENESS,
  TURNOUT_BY_DISTANCE,
  forecastMessage,
  type HeadcountForecast,
} from '../../lib/headcount';
import { formatInr } from '../../lib/plan';
import { whatsappUrl } from '../../lib/share';
import { CLOSENESS_LABELS, DISTANCE_LABELS } from './labels';

interface Props {
  forecast: HeadcountForecast;
  /** The occasion as it reads in a sentence, e.g. "wedding". */
  occasion: string;
  /** Where this page lives, for the shared message. */
  link: string;
}

const percent = (share: number) => `${Math.round(share * 100)}%`;

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'bad' | 'good' }) {
  return (
    <div className={tone ? `tile ${tone}` : 'tile'}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Guaranteed plates, standby plates and the people unlikely to come, as one bar. */
function InviteBar({ forecast }: { forecast: HeadcountForecast }) {
  const unlikely = forecast.invited - forecast.high;
  return (
    <>
      <div
        className="plate-bar headcount-bar"
        role="img"
        aria-label={`Of ${forecast.invited} invited: guarantee ${forecast.guarantee}, keep ${forecast.standby} on standby, ${unlikely} unlikely to come`}
      >
        <span className="eaten" style={{ flexGrow: forecast.guarantee }} />
        <span className="standby" style={{ flexGrow: forecast.standby }} />
        <span className="unlikely" style={{ flexGrow: unlikely }} />
      </div>
      <p className="hint">
        Guarantee {forecast.guarantee} · standby {forecast.standby} · unlikely to come {unlikely}
      </p>
    </>
  );
}

/** The families whose answer would settle the most; in India a phone call is the RSVP. */
function CallFirst({ forecast }: { forecast: HeadcountForecast }) {
  if (forecast.callFirst.length === 0) return null;
  return (
    <div className="headcount-calls">
      <h3 className="col-title">
        <Phone size={16} aria-hidden="true" /> Call these first
      </h3>
      <p className="hint">
        {forecast.undecided} people haven’t given a clear answer. These calls would narrow your range the
        most.
      </p>
      <ul>
        {forecast.callFirst.map((g) => (
          <li key={g.id}>
            {g.name} ({g.people})
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The rules of thumb behind the forecast, so nobody mistakes them for measured data. */
function Assumptions() {
  return (
    <details className="shift-more">
      <summary>How this is worked out</summary>
      <p className="hint">
        These are rules of thumb, not measured data. A clear yes counts as 95%, a clear no as 3%, and a maybe
        as 60% of the usual chance. Families of up to {HOUSEHOLD_MAX} are treated as coming, or staying home,
        together.
      </p>
      <ul className="headcount-rules">
        {CLOSENESS.map((c) => (
          <li key={c}>
            {CLOSENESS_LABELS[c]}: {percent(TURNOUT_BY_CLOSENESS[c])} usually come
          </li>
        ))}
        {DISTANCES.filter((d) => d !== 'local').map((d) => (
          <li key={d}>
            {DISTANCE_LABELS[d]}: {percent(TURNOUT_BY_DISTANCE[d])} of that
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The answer: how many will come, what to tell the caterer, and the money either way. */
export function ForecastCard({ forecast, occasion, link }: Props) {
  if (forecast.invited === 0) return null;
  return (
    <section className="card headcount-result" aria-labelledby="forecast-heading">
      <h2 id="forecast-heading" className="card-title">
        Your likely headcount
      </h2>
      <div aria-live="polite">
        <p className="headcount-answer">
          <strong>
            {forecast.low}–{forecast.high}
          </strong>{' '}
          of {forecast.invited} invited are likely to come, most likely <strong>{forecast.expected}</strong>.
        </p>
        <InviteBar forecast={forecast} />
        <dl className="stats shift-tiles">
          <Tile label="Guarantee to the caterer" value={`${forecast.guarantee} plates`} tone="good" />
          <Tile label="Ask them to keep ready" value={`${forecast.standby} more`} />
          <Tile
            label="Lost if you pay for everyone"
            value={formatInr(forecast.wastedIfFullList)}
            tone="bad"
          />
          <Tile label="You keep with this guarantee" value={formatInr(forecast.saved)} tone="good" />
        </dl>
        <p className="impact">
          You pay for {forecast.guarantee} plates whoever comes. If all {forecast.standby} standby plates are
          needed, they cost about {formatInr(forecast.standbyCost)} more, and only if those guests really
          come.
        </p>
      </div>
      <CallFirst forecast={forecast} />
      <div className="actions">
        <a
          className="btn primary"
          href={whatsappUrl(forecastMessage(forecast, occasion, link))}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={18} aria-hidden="true" /> Share with the family on WhatsApp
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <Assumptions />
      <p className="hint">
        An estimate to help you decide, not a promise. Ask your caterer how many extra plates they can serve
        on the day and at what price, and get it in writing.
      </p>
    </section>
  );
}
