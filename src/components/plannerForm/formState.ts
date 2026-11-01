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

export function initialFormState(initial?: Partial<EventDetails>): FormState {
  const tradition = initial?.tradition ?? 'modern';
  return {
    eventType: initial?.eventType ?? '',
    title: initial?.title ?? '',
    date: initial?.date ?? '',
    city: initial?.city ?? '',
    guests: initial?.guests ? String(initial.guests) : '',
    budget: initial?.budget ? String(initial.budget) : '',
    preferences: initial?.preferences ?? '',
    priorities: initial?.priorities ?? [],
    venueType: initial?.venueType ?? 'undecided',
    ageGroup: initial?.ageGroup ?? 'mixed',
    diets: initial?.diets ?? [],
    colors: initial?.colors ?? '',
    language: initial?.language ?? 'en',
    tradition,
    ceremonies: initial?.ceremonies?.length
      ? initial.ceremonies
      : TRADITION_DATA[tradition].defaultCeremonies,
    venueName: initial?.venueName ?? '',
    venuePreference: initial?.venuePreference ?? '',
    wantsDecor: initial?.wantsDecor ?? true,
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
