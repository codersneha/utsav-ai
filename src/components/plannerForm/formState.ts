import { Briefcase, Cake, Heart, PartyPopper } from 'lucide-react';
import { TRADITION_DATA, type TraditionId } from '../../lib/culture';
import type { FieldErrors } from '../../lib/validation';
import type { AgeGroup, Diet, EventDetails, EventType, Language, Priority, VenueType } from '../../types';

/** Everything the wizard collects, as the user typed it (numbers stay strings until validation). */
export interface FormState {
  eventType: EventType | '';
  title: string;
  date: string;
  city: string;
  guests: string;
  budget: string;
  preferences: string;
  priorities: Priority[];
  venueType: VenueType;
  ageGroup: AgeGroup;
  diets: Diet[];
  colors: string;
  language: Language;
  tradition: TraditionId;
  ceremonies: string[];
  venueName: string;
  venuePreference: string;
  wantsDecor: boolean;
}

export type UpdateField = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

/** What each step needs: the values, a way to change one, and the current errors. */
export interface StepProps {
  form: FormState;
  update: UpdateField;
  errors: FieldErrors;
}

/** A blank form; ceremonies follow the chosen tradition. */
const EMPTY_FORM: Omit<FormState, 'ceremonies'> = {
  eventType: '',
  title: '',
  date: '',
  city: '',
  guests: '',
  budget: '',
  preferences: '',
  priorities: [],
  venueType: 'undecided',
  ageGroup: 'mixed',
  diets: [],
  colors: '',
  language: 'en',
  tradition: 'modern',
  venueName: '',
  venuePreference: '',
  wantsDecor: true,
};

/** The form for a saved plan (edit) or AI-extracted fields (create); anything missing starts blank. */
export function initialFormState(initial: Partial<EventDetails> = {}): FormState {
  const { guests, budget, ceremonies, ...rest } = initial;
  const given = Object.fromEntries(
    Object.entries(rest).filter(([key, value]) => key in EMPTY_FORM && value !== undefined),
  ) as Partial<FormState>;
  const form = { ...EMPTY_FORM, ...given };
  return {
    ...form,
    guests: guests ? String(guests) : '',
    budget: budget ? String(budget) : '',
    ceremonies: ceremonies?.length ? ceremonies : TRADITION_DATA[form.tradition].defaultCeremonies,
  };
}

/** Adds the item if missing, removes it if present. */
export function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export const STEPS: { title: string; fields: (keyof EventDetails)[] }[] = [
  { title: 'The occasion', fields: ['eventType', 'date', 'city'] },
  { title: 'Guests & budget', fields: ['guests', 'budget'] },
  { title: 'Make it yours', fields: [] },
];

export const EVENT_LABELS: Record<
  EventType,
  { label: string; hint: string; icon: typeof Heart; tone: string }
> = {
  wedding: { label: 'Wedding', hint: 'Ceremonies, reception and family functions', icon: Heart, tone: '' },
  birthday: { label: 'Birthday', hint: 'Kids’ parties to milestone birthdays', icon: Cake, tone: 'teal' },
  community: {
    label: 'Community event',
    hint: 'Society fests, fundraisers, cultural nights',
    icon: PartyPopper,
    tone: 'gold',
  },
  corporate: {
    label: 'Corporate event',
    hint: 'Offsites, annual days, launches, team dinners',
    icon: Briefcase,
    tone: 'teal',
  },
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  food: 'Food',
  decor: 'Decor',
  photography: 'Photos & video',
  entertainment: 'Entertainment',
  venue: 'Venue',
};

export const VENUE_LABELS: Record<VenueType, string> = {
  undecided: 'Not decided yet',
  banquet: 'Banquet hall / hotel',
  outdoor: 'Outdoor / lawn',
  home: 'At home',
  'community-hall': 'Community hall / society',
  temple: 'Temple / religious venue',
  restaurant: 'Restaurant',
  cafe: 'Café',
  hotel: 'Hotel / resort',
  office: 'Office / conference room',
};

export const AGE_LABELS: Record<AgeGroup, string> = {
  mixed: 'All ages',
  kids: 'Mostly kids',
  teens: 'Mostly teens',
  adults: 'Mostly adults',
  seniors: 'Mostly seniors',
};

export const DIET_LABELS: Record<Diet, string> = {
  vegetarian: 'Vegetarian',
  'non-vegetarian': 'Non-vegetarian',
  jain: 'Jain',
  vegan: 'Vegan',
  'gluten-free': 'Gluten-free',
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  hi: 'हिंदी (Hindi)',
  hinglish: 'Hinglish',
};
