import { daysBetween, formatDate, todayIso } from '../lib/dates';
import type { Timeline } from '../types';

function relative(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1) return `In ${days} days`;
  return `${Math.abs(days)} days ago`;
}

/** Milestones scheduled backwards from the event date. */
export function TimelinePanel({ timeline }: { timeline: Timeline }) {
  const today = todayIso();
  return (
    <section aria-labelledby="timeline-heading">
      <h3 id="timeline-heading">Planning timeline</h3>
      {timeline.compressed && (
        <p className="notice">
          Your event is {timeline.leadDays} days away, sooner than the ideal planning window, so tasks have
          been compressed. Book key vendors first.
        </p>
      )}
      <ol className="timeline">
        {timeline.milestones.map((m) => {
          const days = daysBetween(today, m.due);
          return (
            <li key={m.id} className={`milestone phase-${m.phase.replace(/\s+/g, '-').toLowerCase()}`}>
              <div className="milestone-date">
                <time dateTime={m.due}>{formatDate(m.due)}</time>
                <span className="muted">{relative(days)}</span>
              </div>
              <div>
                <span className="phase">{m.phase}</span>
                <p>{m.task}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
