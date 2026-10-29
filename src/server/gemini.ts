/** Minimal Gemini REST client (no SDK, keeps the function bundle small). */

export const DEFAULT_MODEL = 'gemini-flash-latest';
export const GEMINI_TIMEOUT_MS = 20_000;
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiRequest {
  apiKey: string;
  model: string;
  systemInstruction: string;
  prompt: string;
  /** When set, Gemini returns JSON matching this schema. */
  responseSchema?: unknown;
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

/** Calls generateContent and returns the concatenated text of the first candidate. */
export async function generateText(
  req: GeminiRequest,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = GEMINI_TIMEOUT_MS,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const body = {
    systemInstruction: { parts: [{ text: req.systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
    generationConfig: {
      temperature: req.temperature ?? 0.8,
      maxOutputTokens: req.maxOutputTokens ?? 2048,
      ...(req.responseSchema
        ? { responseMimeType: 'application/json', responseSchema: req.responseSchema }
        : {}),
    },
  };

  try {
    const res = await fetchImpl(`${BASE_URL}/${encodeURIComponent(req.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': req.apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new GeminiError(`Gemini responded with ${res.status}`, res.status);
    const data = (await res.json()) as GeminiResponse;
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) throw new GeminiError('Gemini returned an empty response', 502);
    return text;
  } catch (err) {
    if (err instanceof GeminiError) throw err;
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new GeminiError(
      aborted ? 'Gemini request timed out' : 'Gemini request failed',
      aborted ? 504 : 502,
    );
  } finally {
    clearTimeout(timer);
  }
}
