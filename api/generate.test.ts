import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './generate.js';

describe('Vercel function entry', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reads configuration from environment variables', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const res = await POST(
      new Request('http://localhost/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'ideas',
          details: {
            eventType: 'birthday',
            date: '2099-01-01',
            city: 'Pune',
            guests: 10,
            budget: 10000,
          },
        }),
      }),
    );
    // Date is beyond the 2-year window, so validation fails before any AI call.
    expect(res.status).toBe(400);
  });
});
