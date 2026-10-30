import { handleGenerate } from '../src/server/handler.js';

/** Vercel Function: POST /api/generate. The Gemini key never reaches the browser. */
export async function POST(request: Request): Promise<Response> {
  return handleGenerate(request, {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    // Optional: Google Places (New) key for Google-quality venue search with ratings.
    placesKey: process.env.GOOGLE_MAPS_API_KEY,
  });
}
