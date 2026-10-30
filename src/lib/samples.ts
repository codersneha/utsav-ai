import type { EventDetails } from '../types.js';
import { addDays } from './dates.js';

export interface Sample {
  id: string;
  label: string;
  details: EventDetails;
}

/** Ready-made events so anyone can see a full plan in one click. Dates are relative to today. */
export function sampleEvents(today: string): Sample[] {
  return [
    {
      id: 'wedding',
      label: 'Bengali wedding · Kolkata',
      details: {
        eventType: 'wedding',
        title: 'Ananya & Rohan’s Biye',
        date: addDays(today, 120),
        city: 'Kolkata',
        guests: 300,
        budget: 2_000_000,
        preferences: 'Traditional and elegant; grandparents need step-free access',
        priorities: ['food', 'photography'],
        venueType: 'banquet',
        diets: ['vegetarian', 'non-vegetarian'],
        ageGroup: 'mixed',
        colors: 'red, ivory and gold',
        language: 'en',
        tradition: 'bengali',
        ceremonies: ['aiburobhat', 'gaye-holud', 'biye', 'bou-bhaat'],
        venueName: '',
        venuePreference: '',
        wantsDecor: true,
      },
    },
    {
      id: 'birthday',
      label: '7th birthday · Pune',
      details: {
        eventType: 'birthday',
        title: 'Meera turns 7',
        date: addDays(today, 30),
        city: 'Pune',
        guests: 40,
        budget: 60_000,
        preferences: 'Space explorer theme, eggless cake, games for 6–8 year olds',
        priorities: ['entertainment'],
        venueType: 'home',
        diets: ['vegetarian'],
        ageGroup: 'kids',
        colors: 'navy and silver',
        language: 'en',
        tradition: 'marathi',
        ceremonies: [],
        venueName: '',
        venuePreference: '',
        wantsDecor: true,
      },
    },
    {
      id: 'community',
      label: 'Society Diwali mela · Indore',
      details: {
        eventType: 'community',
        title: 'Green Valley Diwali Mela',
        date: addDays(today, 21),
        city: 'Indore',
        guests: 500,
        budget: 300_000,
        preferences: 'Zero-waste stalls, cultural performances by residents, rangoli competition',
        priorities: ['entertainment', 'food'],
        venueType: 'community-hall',
        diets: ['vegetarian', 'jain'],
        ageGroup: 'mixed',
        colors: 'marigold and deep red',
        language: 'hinglish',
        tradition: 'modern',
        ceremonies: [],
        venueName: '',
        venuePreference: '',
        wantsDecor: true,
      },
    },
  ];
}
