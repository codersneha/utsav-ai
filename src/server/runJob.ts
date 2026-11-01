import { cleanText } from '../lib/validation.js';
import { toObject } from '../lib/aiOutput.js';
import {
  ASK_RESPONSE_SCHEMA,
  EXTRACT_RESPONSE_SCHEMA,
  VISION_PROMPT,
  VISION_RESPONSE_SCHEMA,
  parseExtracted,
  parseInspiration,
  parseProposal,
} from '../lib/assistant.js';
import { budgetFor } from '../lib/budget.js';
import { IDEAS_SCHEMAS, parseIdeas } from '../lib/ideas.js';
import { LOGISTICS_RESPONSE_SCHEMA, parseLogistics } from '../lib/logistics.js';
import {
  SYSTEM_INSTRUCTION,
  buildAskPrompt,
  buildExtractPrompt,
  buildIdeasPrompt,
  buildLogisticsPrompt,
} from '../lib/prompts.js';
import { MENU_SCAN_SCHEMA, buildMenuScanPrompt, parsePartyOrder } from '../lib/restaurantMenu.js';
import { DEFAULT_MODEL, generateText, type GeminiRequest } from './gemini.js';
import type { HandlerDeps } from './http.js';
import type { Job } from './jobs.js';

const MENU_TIMEOUT_MS = 45_000;

type Base = Omit<GeminiRequest, 'prompt'>;
type Fetch = typeof fetch | undefined;
type Of<M extends Job['mode']> = Extract<Job, { mode: M }>;
/** A response body for the client, or null when the model output was unusable. */
type Outcome = Promise<object | null>;

/** Removes Markdown emphasis and heading marks the UI would show literally. */
export function stripMarkdown(text: string): string {
  return text.replace(/(\*\*|__|`)/g, '').replace(/(^|\s)#{1,6}\s/g, '$1');
}

/** The model settings shared by every request. */
export function geminiBase(deps: HandlerDeps & { apiKey: string }): Base {
  return {
    apiKey: deps.apiKey,
    model: deps.model || DEFAULT_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
  };
}

async function runIdeas(job: Of<'ideas'>, base: Base, fetchImpl: Fetch): Outcome {
  const prompt = buildIdeasPrompt(job.details, job.refinement, job.section);
  const schema = IDEAS_SCHEMAS[job.section ?? 'all'];
  const text = await generateText(
    { ...base, prompt, responseSchema: schema, maxOutputTokens: 8192 },
    fetchImpl,
  );
  const ideas = parseIdeas(text, job.details, job.section);
  return ideas ? { ideas } : null;
}

async function runLogistics(job: Of<'logistics'>, base: Base, fetchImpl: Fetch): Outcome {
  const prompt = buildLogisticsPrompt(job.details);
  const text = await generateText(
    { ...base, prompt, responseSchema: LOGISTICS_RESPONSE_SCHEMA, temperature: 0.4 },
    fetchImpl,
  );
  const logistics = parseLogistics(text, job.details.eventType);
  return logistics ? { logistics } : null;
}

async function runAsk(job: Of<'ask'>, base: Base, fetchImpl: Fetch): Outcome {
  const { details } = job;
  const budget = budgetFor(details);
  const prompt = buildAskPrompt(details, budget, job.history, job.question, job.today);
  const text = await generateText(
    { ...base, prompt, responseSchema: ASK_RESPONSE_SCHEMA, temperature: 0.5, maxOutputTokens: 2048 },
    fetchImpl,
  );
  const obj = toObject(text);
  const answer = stripMarkdown(cleanText(obj?.answer, 1200));
  if (!answer) return null;
  const proposal = parseProposal(obj?.proposal, details, job.today);
  return proposal ? { answer, proposal } : { answer };
}

async function runMenuScan(job: Of<'menuScan'>, base: Base, fetchImpl: Fetch): Outcome {
  const text = await generateText(
    {
      ...base,
      prompt: buildMenuScanPrompt(job.details, job.budget, job.known, job.input),
      ...(job.images.length > 0 ? { images: job.images } : {}),
      responseSchema: MENU_SCAN_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
    fetchImpl,
    // Several menu pages take longer to read than other requests.
    MENU_TIMEOUT_MS,
  );
  const order = parsePartyOrder(text, job.details.guests, job.budget, job.known, job.images.length);
  return order ? { order: { ...order, source: job.input.source } } : null;
}

async function runVision(job: Of<'vision'>, base: Base, fetchImpl: Fetch): Outcome {
  const text = await generateText(
    {
      ...base,
      prompt: VISION_PROMPT,
      image: job.image,
      responseSchema: VISION_RESPONSE_SCHEMA,
      temperature: 0.3,
    },
    fetchImpl,
  );
  const inspiration = parseInspiration(text);
  return inspiration ? { inspiration } : null;
}

async function runExtract(job: Of<'extract'>, base: Base, fetchImpl: Fetch): Outcome {
  const prompt = buildExtractPrompt(job.description, job.today);
  const text = await generateText(
    { ...base, prompt, responseSchema: EXTRACT_RESPONSE_SCHEMA, temperature: 0.1, maxOutputTokens: 2048 },
    fetchImpl,
  );
  const extracted = parseExtracted(text, job.today);
  return extracted ? { extracted } : null;
}

/** Runs a job against Gemini and returns the response body, or null if the output was unusable. */
export function runJob(job: Job, base: Base, fetchImpl?: Fetch): Outcome {
  switch (job.mode) {
    case 'venues':
      return Promise.resolve(null);
    case 'ideas':
      return runIdeas(job, base, fetchImpl);
    case 'logistics':
      return runLogistics(job, base, fetchImpl);
    case 'ask':
      return runAsk(job, base, fetchImpl);
    case 'menuScan':
      return runMenuScan(job, base, fetchImpl);
    case 'vision':
      return runVision(job, base, fetchImpl);
    case 'extract':
      return runExtract(job, base, fetchImpl);
  }
}
