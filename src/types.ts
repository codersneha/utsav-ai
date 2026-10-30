/** Shared domain types for UtsavAI (used by both the browser app and the API). */

export const EVENT_TYPES = ['wedding', 'birthday', 'community', 'corporate'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const PRIORITIES = ['food', 'decor', 'photography', 'entertainment', 'venue'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const VENUE_TYPES = [
  'undecided',
  'banquet',
  'outdoor',
  'home',
  'community-hall',
  'temple',
  'restaurant',
  'cafe',
  'hotel',
  'office',
] as const;
export type VenueType = (typeof VENUE_TYPES)[number];

export const DIETS = ['vegetarian', 'non-vegetarian', 'jain', 'vegan', 'gluten-free'] as const;
export type Diet = (typeof DIETS)[number];

export const LANGUAGES = ['en', 'hi', 'hinglish'] as const;
export type Language = (typeof LANGUAGES)[number];

export const AGE_GROUPS = ['mixed', 'kids', 'teens', 'adults', 'seniors'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

import type { TraditionId } from './lib/culture/traditions.js';

export type { TraditionId };

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
  /** Language for AI-written text (ideas, schedule, answers). */
  language: Language;
  /** Cultural tradition: drives the menu, service style and ceremonies. */
  tradition: TraditionId;
  /** Wedding functions being planned (ids from the tradition), e.g. gaye-holud, biye. */
  ceremonies: string[];
  /** The venue, if already chosen. */
  venueName: string;
  /** What kind of place the user would like, in their words (e.g. "rooftop with dine-in"). */
  venuePreference: string;
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
  /** Phone or email. */
  contact: string;
  address?: string;
  /** The user's own notes, e.g. what the quote includes. */
  notes?: string;
  /** Google Maps link for a venue chosen from the map. */
  mapsUrl?: string;
  /** Quoted price in INR, 0 if not yet quoted. */
  quote: number;
  status: VendorStatus;
}

export interface Theme {
  name: string;
  description: string;
}

/** Decor ideas for one ceremony (or the party itself). */
export interface CeremonyIdea {
  ceremonyId: string;
  /** A short theme name, e.g. "Shola & Marigold". */
  theme: string;
  /** Colours for this function, with hex codes for the swatches. */
  palette: { name: string; hex: string }[];
  decor: string[];
}

/** Dishes chosen for one course of the menu (always from the knowledge base). */
export interface MenuChoice {
  courseId: string;
  dishes: string[];
}

/** Personalised, AI-generated (or fallback) ideas. */
export interface Ideas {
  summary: string;
  ceremonies: CeremonyIdea[];
  menu: MenuChoice[];
  activities: string[];
  budgetTips: string[];
  source: 'gemini' | 'fallback';
}

/** Which part of the ideas to regenerate on its own. */
export type IdeasSection = 'decor' | 'menu' | 'extras';

/** Look extracted from an inspiration photo. */
export interface Inspiration {
  theme: string;
  mood: string;
  palette: { name: string; hex: string }[];
  elements: string[];
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

/** A change to the plan suggested by the assistant; applied only if the user agrees. */
export interface ChangeProposal {
  guests?: number;
  budget?: number;
  date?: string;
  /** One-line description of the change, in the user's words. */
  summary: string;
}

/** One turn of the Ask AI conversation. */
export interface ChatTurn {
  question: string;
  answer: string;
  proposal?: ChangeProposal;
  /** What the user did with the proposal. */
  proposalState?: 'applied' | 'dismissed';
}

/** A venue found on the map (OpenStreetMap today; other providers later). */
export interface Venue {
  name: string;
  kind: string;
  address: string;
  lat: number;
  lon: number;
  /** Distance from the city centre, when searching around a city. */
  distanceKm?: number;
  /** Why it was suggested, e.g. Matches “rooftop”. */
  match?: string;
  /** Google Maps search link — for photos, reviews and ratings. */
  mapsUrl: string;
  osmUrl: string;
}

export const RSVP_STATUSES = ['not-asked', 'maybe', 'likely', 'confirmed', 'declined'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const GUEST_SIDES = ['bride', 'groom', 'family', 'friends', 'work', 'neighbours', 'other'] as const;
export type GuestSide = (typeof GUEST_SIDES)[number];

/** One invited family or person in the guest ledger (entered by the user). */
export interface GuestEntry {
  id: string;
  /** Family or person, e.g. "Sharma family". */
  name: string;
  /** How they are related, e.g. "Mama’s family", "College friends". */
  relation: string;
  side: GuestSide;
  adults: number;
  children: number;
  /** Marked as an important guest. */
  vip: boolean;
  /** The invitation has been sent. */
  invited: boolean;
  rsvp: RsvpStatus;
}

export const MENU_CATEGORIES = ['starter', 'main', 'bread', 'rice', 'dessert', 'drink', 'other'] as const;
export type MenuCategory = (typeof MENU_CATEGORIES)[number];

/** One line of a party order planned from a restaurant's own menu. */
export interface PartyOrderLine {
  name: string;
  category: MenuCategory;
  veg: boolean;
  /** Price of one order, as printed on the menu (INR). */
  price: number;
  /** How many people one order typically feeds. */
  serves: number;
  quantity: number;
  /** quantity × price, computed in code. */
  cost: number;
}

/** A party order built from a photo of a restaurant or café menu. */
export interface PartyOrder {
  /** How many dishes were read from the menu. */
  itemsRead: number;
  lines: PartyOrderLine[];
  /** Sum of the lines (before taxes and service charge). */
  total: number;
  perHead: number;
  guests: number;
  /** The food budget the order was fitted to. */
  budget: number;
  /** True when quantities were reduced to fit the budget. */
  trimmed: boolean;
  note: string;
}
