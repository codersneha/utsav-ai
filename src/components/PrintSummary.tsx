import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { ceremoniesFor, menuFor } from '../lib/culture';
import { formatDate } from '../lib/dates';
import { guestTotals } from '../lib/guests';
import { formatInr } from '../lib/plan';
import type { EventPlan, GuestEntry, Ideas, Logistics, VendorEntry } from '../types';

interface Props {
  plan: EventPlan;
  ideas: Ideas | null;
  logistics: Logistics | null;
  timelineDone: Record<string, boolean>;
  vendors: VendorEntry[];
  guests: GuestEntry[];
}

/**
 * True only while the page is being printed, so the summary is added to the
 * page just for printing (no duplicate headings for screen readers).
 */
export function usePrinting(): boolean {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    // Render synchronously so the summary is in place before the print snapshot.
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  return printing;
}

/** A clean, ink-friendly summary that is only shown when printing. */
export function PrintSummary({ plan, ideas, logistics, timelineDone, vendors, guests }: Props) {
  const { details, budget, timeline, checklist } = plan;
  const menu = menuFor(details, budget.lines.find((l) => l.id === 'catering')?.amount);
  const totals = guestTotals(guests);
  const ceremonies = ceremoniesFor(details);

  return (
    <article className="print-sheet">
      <header>
        <p className="print-brand">UtsavAI · Celebration plan</p>
        <h1>{details.title || 'Our celebration'}</h1>
        <p>
          {formatDate(details.date)} · {details.city} · {details.guests} guests · Total budget{' '}
          {formatInr(budget.total)}
          {details.venueName ? ` · Venue: ${details.venueName}` : ''}
        </p>
      </header>

      <section>
        <h2>Budget</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Amount</th>
              <th>Share</th>
              <th>Basis</th>
            </tr>
          </thead>
          <tbody>
            {budget.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.label}</td>
                <td>{formatInr(l.amount)}</td>
                <td>{l.percent}%</td>
                <td>{l.overridden ? 'Your amount' : 'Estimate'}</td>
              </tr>
            ))}
            {budget.unallocated !== 0 && (
              <tr>
                <td>Unallocated</td>
                <td>{formatInr(budget.unallocated)}</td>
                <td />
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {ideas && (
        <section>
          <h2>Décor</h2>
          <table>
            <tbody>
              {ceremonies.map((c) => {
                const idea = ideas.ceremonies.find((i) => i.ceremonyId === c.id);
                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <br />
                      {c.when}
                    </td>
                    <td>
                      <strong>{idea?.theme ?? c.name}</strong> —{' '}
                      {(idea?.palette ?? c.palette).map((p) => p.name).join(', ')}
                      <br />
                      {(idea?.decor ?? c.decor).join('; ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h2>Menu</h2>
          <p>{menu.service}</p>
          <table>
            <tbody>
              {ideas.menu.map((m) => (
                <tr key={m.courseId}>
                  <td>{menu.courses.find((c) => c.id === m.courseId)?.name ?? m.courseId}</td>
                  <td>{m.dishes.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2>Timeline</h2>
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Due</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {timeline.milestones.map((m) => (
              <tr key={m.id}>
                <td>{m.task}</td>
                <td>{formatDate(m.due)}</td>
                <td>{m.priority}</td>
                <td>{timelineDone[m.id] ? 'Done' : 'To do'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {logistics && logistics.daySchedule.length > 0 && (
        <section>
          <h2>On the day</h2>
          <ul>
            {logistics.daySchedule.map((s) => (
              <li key={s.time + s.activity}>
                {s.time} — {s.activity}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Vendors</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Contacts</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {checklist.map((g) => {
              const mine = vendors.filter((v) => v.groupId === g.id);
              return (
                <tr key={g.id}>
                  <td>{g.vendor}</td>
                  <td>
                    {mine.length === 0
                      ? '—'
                      : mine
                          .map((v) =>
                            [v.name, v.contact, v.quote > 0 ? formatInr(v.quote) : '']
                              .filter(Boolean)
                              .join(' · '),
                          )
                          .join('; ')}
                  </td>
                  <td>
                    {mine.some((v) => v.status === 'confirmed')
                      ? 'Booked'
                      : mine.length > 0
                        ? 'In talks'
                        : 'Not started'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {guests.length > 0 && (
        <section>
          <h2>Guests</h2>
          <p>
            {totals.families} families · {totals.invited} invited ({totals.adults} adults, {totals.children}{' '}
            children) · {totals.confirmed} confirmed · about {totals.expected} expected · {totals.vips}{' '}
            important guests
          </p>
        </section>
      )}

      <footer>Amounts are estimates unless they are your own figures or quotes. Planned with UtsavAI.</footer>
    </article>
  );
}
