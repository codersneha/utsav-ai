import { handleGenerate } from '../src/server/handler.js';

/** Vercel Function: POST /api/generate. The Gemini key never reaches the browser. */
export async function POST(request: Request): Promise<Response> {
  return handleGenerate(request, {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
  });
}
