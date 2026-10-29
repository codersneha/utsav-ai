import type { EventDetails, EventPlan } from '../types.js';
import { daysBetween, formatDate } from './dates.js';
import { formatInr } from './plan.js';
import { validateEventDetails } from './validation.js';

/** Sharing a plan with family: a link that recreates it, and WhatsApp-ready text. */

const SHARE_PREFIX = '#plan=';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** A link that opens the same event details on another device (no server, no account). */
export function shareUrl(details: EventDetails, base: string): string {
  return `${base}${SHARE_PREFIX}${toBase64Url(JSON.stringify(details))}`;
}

/** Reads and validates a shared plan from a URL hash; null if absent or invalid. */
export function readSharedPlan(hash: string): EventDetails | null {
  if (!hash.startsWith(SHARE_PREFIX) || hash.length > 4000) return null;
  try {
    const value: unknown = JSON.parse(fromBase64Url(hash.slice(SHARE_PREFIX.length)));
    const date = (value as { date?: unknown })?.date;
    if (typeof date !== 'string') return null;
    const result = validateEventDetails(value, date);
    return result.ok ? result.value : null;
  } catch {
    return null;
  }
}

/** A short status update for the family group, built from the plan's own facts. */
export function familyUpdate(plan: EventPlan, done: Record<string, boolean>, today: string): string {
  const { details, timeline, budget } = plan;
  const name = details.title || `Our ${details.eventType}`;
  const days = daysBetween(today, details.date);
  const finished = timeline.milestones.filter((m) => done[m.id]).length;
  const next = timeline.milestones.filter((m) => !done[m.id] && m.daysBefore > 0).slice(0, 3);
  const lines = [
    `🎉 ${name} — ${formatDate(details.date)}, ${details.city}`,
    `${days > 0 ? `${days} days to go` : 'It’s here!'} · ${details.guests} guests · budget ${formatInr(budget.total)}`,
    `✅ ${finished} of ${timeline.milestones.length} planning tasks done`,
  ];
  if (next.length > 0) {
    lines.push('Next up:', ...next.map((m) => `• ${m.task} (by ${formatDate(m.due)})`));
  }
  lines.push('', 'Planned with UtsavAI');
  return lines.join('\n');
}

/** WhatsApp "click to chat" link with prefilled text (the user picks who to send it to). */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
