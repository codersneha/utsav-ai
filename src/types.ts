/** Shared domain types for UtsavAI (used by both the browser app and the API). */

export const EVENT_TYPES = ['wedding', 'birthday', 'community'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const PRIORITIES = ['food', 'decor', 'photography', 'entertainment', 'venue'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Validated user input describing the event to plan. */
export interface EventDetails {
  eventType: EventType;
  title: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  city: string;
  guests: number;
  /** Total budget in INR (whole rupees). */
  budget: number;
  /** Free-text vibe / theme / cultural preferences. */
  preferences: string;
  priorities: Priority[];
}

export interface BudgetLine {
  id: string;
  label: string;
  /** Planned allocation in INR. */
  amount: number;
  /** Share of total, 0–100 (rounded to one decimal). */
  percent: number;
  priority: boolean;
}

export interface BudgetPlan {
  total: number;
  perGuest: number;
  lines: BudgetLine[];
  warnings: string[];
}

export interface Milestone {
  id: string;
  task: string;
  /** ISO date the task is due. */
  due: string;
  daysBefore: number;
  phase: 'Plan' | 'Book' | 'Prepare' | 'Final week' | 'Event day' | 'Wrap-up';
}

export interface Timeline {
  milestones: Milestone[];
  /** True when the lead time was shorter than ideal and tasks were compressed. */
  compressed: boolean;
  leadDays: number;
}

export interface ChecklistItem {
  id: string;
  task: string;
}

export interface VendorGroup {
  id: string;
  vendor: string;
  /** Search phrase used to build a Google Maps link. */
  searchTerm: string;
  items: ChecklistItem[];
}

export interface Theme {
  name: string;
  description: string;
}

/** Personalised, AI-generated (or fallback) ideas. */
export interface Ideas {
  summary: string;
  themes: Theme[];
  decor: string[];
  food: string[];
  activities: string[];
  budgetTips: string[];
  source: 'gemini' | 'fallback';
}

export interface EventPlan {
  details: EventDetails;
  budget: BudgetPlan;
  timeline: Timeline;
  checklist: VendorGroup[];
  createdAt: string;
}
