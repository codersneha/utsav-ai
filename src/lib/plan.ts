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
