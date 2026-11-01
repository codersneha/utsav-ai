/** Minimal Gemini REST client (no SDK, keeps the function bundle small). */

/**
 * Comma-separated models, tried in order on retry. Both answered in ~3–5 s on
 * the free tier in testing (Oct 2026); the second covers demand spikes on the first.
 */
export const DEFAULT_MODEL = 'gemini-3.1-flash-lite,gemini-3-flash-preview';
const GEMINI_TIMEOUT_MS = 20_000;
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiRequest {
  apiKey: string;
  /** One model id, or several separated by commas to fall back through. */
  model: string;
  systemInstruction: string;
  prompt: string;
  /** When set, Gemini returns JSON matching this schema. */
  responseSchema?: unknown;
  /** Optional photo to look at (base64, already validated). */
  image?: { data: string; mimeType: string };
  /** Several photos at once, e.g. the pages of a menu. */
  images?: { data: string; mimeType: string }[];
  temperature?: number;
  maxOutputTokens?: number;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/** Temporary failures worth one more try: rate limited, overloaded or stalled. */
const RETRYABLE = new Set([429, 503, 504]);
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 800;

/** Extracts Google's error message (never contains the key) for server logs. */
async function upstreamReason(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: unknown } };
    return typeof data.error?.message === 'string' ? `: ${data.error.message.slice(0, 200)}` : '';
  } catch {
    return '';
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls generateContent and returns the concatenated text of the first
 * candidate. The time budget is split across attempts so that a stalled or
 * overloaded first call can be retried once, on the next listed model,
 * without exceeding the timeout.
 */
export async function generateText(
  req: GeminiRequest,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = GEMINI_TIMEOUT_MS,
  retryDelayMs = RETRY_DELAY_MS,
): Promise<string> {
  // One deadline covers every attempt, so retries never exceed the timeout.
  const deadline = Date.now() + timeoutMs;
  const models = req.model
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  for (let attempt = 1; ; attempt++) {
    try {
      const attemptsLeft = MAX_ATTEMPTS - attempt + 1;
      const budget = Math.max(1, Math.floor((deadline - Date.now()) / attemptsLeft));
      const model = models[(attempt - 1) % models.length] ?? req.model;
      return await attemptGenerate({ ...req, model }, fetchImpl, budget);
    } catch (err) {
      const retryable = err instanceof GeminiError && RETRYABLE.has(err.status);
      const timeLeft = deadline - Date.now() - retryDelayMs;
      if (!retryable || attempt >= MAX_ATTEMPTS || timeLeft < 2000) throw err;
      await sleep(retryDelayMs);
    }
  }
}

/** The generateContent request body: system instruction, images, prompt and output settings. */
function requestBody(req: GeminiRequest) {
  const images = [...(req.image ? [req.image] : []), ...(req.images ?? [])];
  return {
    systemInstruction: { parts: [{ text: req.systemInstruction }] },
    contents: [
      {
        role: 'user',
        parts: [
          ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
          { text: req.prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: req.temperature ?? 0.8,
      // The limit includes thinking tokens, so leave room for the full JSON answer.
      maxOutputTokens: req.maxOutputTokens ?? 4096,
      // Planning ideas need little reasoning; low thinking keeps latency down.
      thinkingConfig: { thinkingLevel: 'low' },
      ...(req.responseSchema
        ? { responseMimeType: 'application/json', responseSchema: req.responseSchema }
        : {}),
    },
  };
}

/** The answer's text, joined across parts. */
async function responseText(res: Response): Promise<string> {
  if (!res.ok)
    throw new GeminiError(`Gemini responded with ${res.status}${await upstreamReason(res)}`, res.status);
  const data = (await res.json()) as GeminiResponse;
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  if (!text) throw new GeminiError('Gemini returned an empty response', 502);
  return text;
}

/** Network failures and timeouts become GeminiErrors with a gateway status. */
function asGeminiError(err: unknown): GeminiError {
  if (err instanceof GeminiError) return err;
  const aborted = err instanceof Error && err.name === 'AbortError';
  return new GeminiError(aborted ? 'Gemini request timed out' : 'Gemini request failed', aborted ? 504 : 502);
}

async function attemptGenerate(
  req: GeminiRequest,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${BASE_URL}/${encodeURIComponent(req.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': req.apiKey },
      body: JSON.stringify(requestBody(req)),
      signal: controller.signal,
    });
    return await responseText(res);
  } catch (err) {
    throw asGeminiError(err);
  } finally {
    clearTimeout(timer);
  }
}
