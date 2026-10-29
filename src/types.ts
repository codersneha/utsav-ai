/** Shared domain types for UtsavAI (used by both the browser app and the API). */

export const EVENT_TYPES = ['wedding', 'birthday', 'community'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const PRIORITIES = ['food', 'decor', 'photography', 'entertainment', 'venue'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const VENUE_TYPES = ['undecided', 'banquet', 'outdoor', 'home', 'community-hall', 'temple'] as const;
export type VenueType = (typeof VENUE_TYPES)[number];

export const DIETS = ['vegetarian', 'non-vegetarian', 'jain', 'vegan', 'gluten-free'] as const;
export type Diet = (typeof DIETS)[number];

export const AGE_GROUPS = ['mixed', 'kids', 'teens', 'adults', 'seniors'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

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
  venueType: VenueType;
  diets: Diet[];
  ageGroup: AgeGroup;
  /** Preferred colour palette, free text. */
  colors: string;
}

export interface BudgetLine {
  id: string;
  label: string;
  /** Planned amount in INR: the suggested estimate, or the user's own figure. */
  amount: number;
  /** Share of total, 0–100 (rounded to one decimal). */
  percent: number;
  priority: boolean;
  /** Cost grows with the guest count (food, invitations, gifts…). */
  scalesWithGuests: boolean;
  /** True when the user replaced the suggested estimate with their own amount. */
  overridden: boolean;
}

export interface BudgetPlan {
  total: number;
  perGuest: number;
  lines: BudgetLine[];
  /** Sum of all planned category amounts. */
  allocated: number;
  /** total − allocated; negative when categories exceed the budget. */
  unallocated: number;
  warnings: string[];
}

export type TaskPriority = 'High' | 'Medium' | 'Low';

export interface Milestone {
  id: string;
  task: string;
  /** ISO date the task is due. */
  due: string;
  daysBefore: number;
  phase: 'Plan' | 'Book' | 'Prepare' | 'Final week' | 'Event day' | 'Wrap-up';
  priority: TaskPriority;
  /** Ids of tasks that should be finished first. */
  dependsOn: string[];
  /** Added by the user rather than the template. */
  custom: boolean;
}

export interface Timeline {
  milestones: Milestone[];
  /** True when the lead time was shorter than ideal and tasks were compressed. */
  compressed: boolean;
  leadDays: number;
}

/** A task the user added to their timeline. */
export interface CustomTask {
  id: string;
  task: string;
  due: string;
  priority: TaskPriority;
}

export interface ChecklistItem {
  id: string;
  task: string;
  /** Suggested by Gemini for this specific event. */
  ai?: boolean;
}

export interface VendorGroup {
  id: string;
  vendor: string;
  /** Search phrase used to build a Google Maps link. */
  searchTerm: string;
  /** Budget category this vendor is paid from. */
  budgetId: string;
  items: ChecklistItem[];
}

export const VENDOR_STATUSES = ['shortlisted', 'contacted', 'quoted', 'pending', 'confirmed'] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

/** A real vendor the user is talking to (entered by the user, never by AI). */
export interface VendorEntry {
  id: string;
  groupId: string;
  name: string;
  contact: string;
  /** Quoted price in INR, 0 if not yet quoted. */
  quote: number;
  status: VendorStatus;
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

export interface ScheduleItem {
  /** 24-hour HH:MM. */
  time: string;
  activity: string;
}

export interface VendorAdvice {
  /** What to ask this vendor before booking. */
  questions: string[];
  /** Extra checklist tasks tailored to this event. */
  tasks: string[];
}

/** AI-generated (or fallback) logistics: day-of schedule and vendor advice. */
export interface Logistics {
  daySchedule: ScheduleItem[];
  vendors: Record<string, VendorAdvice>;
  source: 'gemini' | 'fallback';
}

export interface EventPlan {
  details: EventDetails;
  budget: BudgetPlan;
  timeline: Timeline;
  checklist: VendorGroup[];
}

/** One turn of the Ask AI conversation. */
export interface ChatTurn {
  question: string;
  answer: string;
}
