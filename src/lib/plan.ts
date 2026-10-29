import type { CustomTask, EventDetails, EventPlan, VendorAdvice } from '../types.js';
import { buildBudget } from './budget.js';
import { buildChecklist } from './checklist.js';
import { buildTimeline } from './timeline.js';

/** The user's own edits layered on top of the generated plan. */
export interface PlanEdits {
  overrides?: Record<string, number>;
  customTasks?: CustomTask[];
  vendorAdvice?: Record<string, VendorAdvice>;
}

/** Assembles the deterministic parts of a plan from validated details plus user edits. */
export function buildPlan(details: EventDetails, today: string, edits: PlanEdits = {}): EventPlan {
  return {
    details,
    budget: buildBudget(
      details.eventType,
      details.budget,
      details.guests,
      details.priorities,
      edits.overrides,
    ),
    timeline: buildTimeline(details.eventType, details.date, today, edits.customTasks),
    checklist: buildChecklist(details.eventType, edits.vendorAdvice),
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

/** Short Indian notation for tight spaces: ₹2.5Cr, ₹25L, ₹60k. */
export function formatCompactInr(amount: number): string {
  const trim = (n: number) => String(Math.round(n * 10) / 10);
  if (amount >= 10_000_000) return `₹${trim(amount / 10_000_000)}Cr`;
  if (amount >= 100_000) return `₹${trim(amount / 100_000)}L`;
  if (amount >= 1000) return `₹${trim(amount / 1000)}k`;
  return `₹${amount}`;
}
