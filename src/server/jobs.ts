import { cleanList, cleanObjects } from '../lib/aiOutput.js';
import { isValidImage } from '../lib/assistant.js';
import { cleanMenuItems, partyFoodBudget, type MenuInput } from '../lib/restaurantMenu.js';
import type { Refinement } from '../lib/prompts.js';
import { LIMITS, cleanText, validateEventDetails } from '../lib/validation.js';
import type { ChatTurn, EventDetails, IdeasSection, MenuItem } from '../types.js';

export const MAX_BODY_BYTES = 16 * 1024;
/** Photo uploads are resized in the browser; up to 8 menu pages fit under Vercel's 4.5 MB limit. */
export const MAX_IMAGE_BODY_BYTES = 4_200_000;
/** One photo, base64-encoded. */
const MAX_PHOTO_CHARS = 1_500_000;
const MAX_MENU_PAGES = 8;
const MAX_HISTORY = 4;
const SECTIONS: IdeasSection[] = ['decor', 'menu', 'extras'];

export interface JobImage {
  data: string;
  mimeType: string;
}

/** Validated, mode-specific request — everything the model sees has been cleaned. */
export type Job =
  | { mode: 'venues' }
  | { mode: 'extract'; description: string; today: string }
  | { mode: 'vision'; image: JobImage }
  | {
      mode: 'menuScan';
      details: EventDetails;
      input: MenuInput;
      images: JobImage[];
      known: MenuItem[];
      budget: number;
    }
  | { mode: 'ideas'; details: EventDetails; refinement?: Refinement; section?: IdeasSection }
  | { mode: 'logistics'; details: EventDetails }
  | { mode: 'ask'; details: EventDetails; question: string; history: ChatTurn[]; today: string };

export type JobError = { error: string; fields?: object };
type Payload = Record<string, unknown>;
type Parsed = Job | JobError;

const pickTurn = (o: Record<string, unknown>): ChatTurn | null => {
  const turn = { question: cleanText(o.question, LIMITS.questionMax), answer: cleanText(o.answer, 600) };
  return turn.question && turn.answer ? turn : null;
};

function pickImage(data: unknown, mimeType: unknown, maxChars: number): JobImage | null {
  return isValidImage(data, mimeType, maxChars) ? { data, mimeType: mimeType as string } : null;
}

function parseVision(payload: Payload): Parsed {
  const image = pickImage(payload.image, payload.mimeType, MAX_IMAGE_BODY_BYTES);
  return image ? { mode: 'vision', image } : { error: 'Invalid image' };
}

function parseExtract(payload: Payload, today: string): Parsed {
  const description = cleanText(payload.description, LIMITS.describeMax);
  if (description.length < LIMITS.describeMin) return { error: 'Description is too short' };
  return { mode: 'extract', description, today };
}

/** 1 to 8 menu pages, each checked against its image signature; a string is the error to report. */
function pickMenuPhotos(value: unknown): JobImage[] | string {
  const photos = Array.isArray(value) ? value : [];
  if (photos.length < 1 || photos.length > MAX_MENU_PAGES) return 'Add 1 to 8 menu photos';
  const images: JobImage[] = [];
  for (const p of photos) {
    const photo = (p ?? {}) as Record<string, unknown>;
    const image = pickImage(photo.data, photo.mimeType, MAX_PHOTO_CHARS);
    if (!image) return 'Invalid image';
    images.push(image);
  }
  return images;
}

function parseMenuScan(payload: Payload, details: EventDetails): Parsed {
  const given = Math.round(Number(payload.budget));
  const budget =
    Number.isFinite(given) && given > 0 ? Math.min(given, details.budget) : partyFoodBudget(details);
  const base = { mode: 'menuScan' as const, details, budget };

  if (payload.source === 'estimate') return { ...base, input: { source: 'estimate' }, images: [], known: [] };

  const known = cleanMenuItems(payload.known);
  if (payload.source === 'text') {
    const text = cleanText(payload.text, LIMITS.menuTextMax);
    if (text.length < LIMITS.menuTextMin) return { error: 'Menu text is too short' };
    return { ...base, input: { source: 'text', text }, images: [], known };
  }
  const images = pickMenuPhotos(payload.images);
  if (typeof images === 'string') return { error: images };
  return { ...base, input: { source: 'photos' }, images, known };
}

function parseIdeasJob(payload: Payload, details: EventDetails): Parsed {
  const section = SECTIONS.find((x) => x === payload.section);
  if (payload.section !== undefined && !section) return { error: 'Unknown section' };
  const request = cleanText(payload.refinement, LIMITS.refinementMax);
  if (!request) return { mode: 'ideas', details, section };
  if (request.length < 3) return { error: 'Refinement is too short' };
  return {
    mode: 'ideas',
    details,
    section,
    refinement: { request, previousThemes: cleanList(payload.previousThemes, 8, 60) },
  };
}

function parseAskJob(payload: Payload, details: EventDetails, today: string): Parsed {
  const question = cleanText(payload.question, LIMITS.questionMax);
  if (question.length < 3) return { error: 'Question is too short' };
  return {
    mode: 'ask',
    details,
    question,
    history: cleanObjects(payload.history, MAX_HISTORY, pickTurn),
    today,
  };
}

/** Modes that need a valid event description before anything else is read. */
const DETAIL_PARSERS = new Map<string, (payload: Payload, details: EventDetails, today: string) => Parsed>([
  ['menuScan', (payload, details) => parseMenuScan(payload, details)],
  ['ideas', (payload, details) => parseIdeasJob(payload, details)],
  ['logistics', (_payload, details) => ({ mode: 'logistics', details })],
  ['ask', parseAskJob],
]);

/** Turns the untrusted payload into a Job, or an error message for a 400. */
export function parseJob(payload: Payload, today: string): Parsed {
  const { mode } = payload;
  if (mode === 'venues') return { mode: 'venues' };
  if (mode === 'vision') return parseVision(payload);
  if (mode === 'extract') return parseExtract(payload, today);

  const result = validateEventDetails(payload.details, today);
  if (!result.ok) return { error: 'Invalid event details', fields: result.errors };
  const parse = typeof mode === 'string' ? DETAIL_PARSERS.get(mode) : undefined;
  return parse ? parse(payload, result.value, today) : { error: 'Unknown mode' };
}
