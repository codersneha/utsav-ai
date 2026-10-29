import {
  CalendarClock,
  Check,
  MessageCircleHeart,
  RefreshCw,
  Sparkles,
  Store,
  Wallet,
  Wand2,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { extractDetails } from '../lib/api';
import { todayIso } from '../lib/dates';
import { sampleEvents } from '../lib/samples';
import { LIMITS } from '../lib/validation';
import type { EventDetails } from '../types';
import { Ring } from './Charts';

interface Props {
  onSample: (details: EventDetails) => void;
  onExtracted: (fields: Partial<EventDetails>) => void;
}

const FEATURES = [
  {
    icon: Wallet,
    tone: '',
    title: 'A budget that adds up',
    text: 'Rupee-exact estimates you can edit, with trade-offs when money is tight.',
  },
  {
    icon: CalendarClock,
    tone: 'gold',
    title: 'A timeline that adapts',
    text: 'Tasks back-scheduled from your date, a day-of run-of-show and reminders.',
  },
  {
    icon: Store,
    tone: 'teal',
    title: 'Vendors, sorted',
    text: 'Checklists, questions to ask, and your own quotes compared to the budget.',
  },
  {
    icon: Sparkles,
    tone: '',
    title: 'Ideas made for you',
    text: 'Themes, menus and décor from Google Gemini — refine them in a sentence.',
  },
  {
    icon: RefreshCw,
    tone: 'gold',
    title: 'Plans change. So does yours.',
    text: 'More guests? Earlier date? It revises in place and shows what changed.',
  },
  {
    icon: MessageCircleHeart,
    tone: 'teal',
    title: 'A planner you can talk to',
    text: 'Ask in English, Hindi or Hinglish — and share updates on WhatsApp.',
  },
];

/** The first screen: what UtsavAI does, one-click samples and natural-language intake. */
export function Landing({ onSample, onExtracted }: Props) {
  const samples = sampleEvents(todayIso());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const describe = async (e: FormEvent) => {
    e.preventDefault();
    if (text.trim().length < LIMITS.describeMin || busy) return;
    setBusy(true);
    setNotice('');
    const result = await extractDetails(text.trim());
    setBusy(false);
    if (result.notice) setNotice(result.notice);
    if (Object.keys(result.fields).length > 0) onExtracted(result.fields);
  };

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <p className="pill">
            <Sparkles size={16} aria-hidden="true" /> AI celebration planner for Indian families
          </p>
          <h1 id="hero-title">
            Plan celebrations people <em>remember</em>.
          </h1>
          <p className="lead">
            Weddings, birthdays and community festivals — budget, timeline, vendors and ideas in one calm,
            editable plan that keeps up when things change.
          </p>
          <div className="actions">
            <a className="btn primary" href="#describe">
              <Wand2 size={18} aria-hidden="true" /> Start planning
            </a>
            <a className="btn" href="#plan-form">
              Fill in a form instead
            </a>
          </div>
          <div className="samples">
            <p>Or see a full plan in one click:</p>
            <div className="chips" role="group" aria-label="Sample events">
              {samples.map((s) => (
                <button key={s.id} type="button" className="chip" onClick={() => onSample(s.details)}>
                  Try: {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="preview" aria-hidden="true">
          <div className="preview-banner">
            <span>WEDDING · JAIPUR</span>
            <strong>Priya & Arjun</strong>
            <span>108 days to go · 300 guests</span>
          </div>
          <div className="preview-row">
            <Ring value={42} label="Tasks done" size={92} />
            <ul className="preview-tasks">
              <li>
                <span className="tick">
                  <Check size={14} />
                </span>
                Book the venue
              </li>
              <li>
                <span className="tick">
                  <Check size={14} />
                </span>
                Taste menus with caterer
              </li>
              <li>
                <span className="todo" /> Send invitations
              </li>
              <li>
                <span className="todo" /> Lock the headcount
              </li>
            </ul>
          </div>
          <div className="preview-ai">
            <Sparkles size={18} />
            <span>“Pastel Palace” theme — mint drapes, marigold accents and a Jain-friendly thali.</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="features-title">
        <h2 id="features-title" className="section-title">
          Everything your celebration needs
        </h2>
        <ul className="features">
          {FEATURES.map(({ icon: Icon, tone, title, text: body }) => (
            <li key={title} className="card feature">
              <span className={`icon-badge ${tone}`}>
                <Icon size={22} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="describe" className="card describe" aria-labelledby="describe-title">
        <p className="eyebrow">
          <Wand2 size={14} aria-hidden="true" /> Step 1 · Tell us in your own words
        </p>
        <h2 id="describe-title" className="section-title">
          Describe your celebration
        </h2>
        <form onSubmit={describe}>
          <label htmlFor="describe-input">
            Write it like you would to a friend — English, Hindi or Hinglish. AI fills the form; you check it.
          </label>
          <textarea
            id="describe-input"
            value={text}
            maxLength={LIMITS.describeMax}
            placeholder="e.g. Didi ki shaadi in Indore around 14 Feb, ~250 guests, budget 12 lakh, mostly veg with a Jain counter, pastel theme"
            onChange={(e) => setText(e.target.value)}
          />
          <div className="actions">
            <button
              type="submit"
              className="btn primary"
              disabled={busy || text.trim().length < LIMITS.describeMin}
            >
              <Sparkles size={18} aria-hidden="true" />
              {busy ? 'Reading your description…' : 'Fill the form with AI'}
            </button>
            <span className="hint">
              {text.length}/{LIMITS.describeMax}
            </span>
          </div>
        </form>
        <div aria-live="polite">{notice && <p className="notice">{notice}</p>}</div>
      </section>
    </>
  );
}
