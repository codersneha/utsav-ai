import type { EventDetails, EventPlan } from '../types.js';
import { buildBudget } from './budget.js';
import { buildChecklist } from './checklist.js';
import { buildTimeline } from './timeline.js';

/** Assembles the deterministic parts of a plan from validated details. */
export function buildPlan(details: EventDetails, today: string, now: Date = new Date()): EventPlan {
  return {
    details,
    budget: buildBudget(details.eventType, details.budget, details.guests, details.priorities),
    timeline: buildTimeline(details.eventType, details.date, today),
    checklist: buildChecklist(details.eventType),
    createdAt: now.toISOString(),
  };
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatInr(amount: number): string {
  return currency.format(amount);
}
