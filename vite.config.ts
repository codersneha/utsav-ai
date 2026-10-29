/// <reference types="vitest/config" />
import type { IncomingMessage } from 'node:http';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import type { handleGenerate as HandleGenerate } from './src/server/handler.ts';

/** Serves /api/generate during `npm run dev`, mirroring the Vercel Function. */
function devApi(apiKey: string | undefined, model: string | undefined): Plugin {
  return {
    name: 'utsav-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/generate', async (req: IncomingMessage, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') headers.set(key, value);
        }
        const request = new Request('http://localhost/api/generate', {
          method: req.method,
          headers,
          body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
        });
        const { handleGenerate } = (await server.ssrLoadModule('/src/server/handler.ts')) as {
          handleGenerate: typeof HandleGenerate;
        };
        const response = await handleGenerate(request, { apiKey, model });
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(await response.text());
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), devApi(env.GEMINI_API_KEY, env.GEMINI_MODEL)],
    build: { target: 'es2022', sourcemap: false },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}', 'api/**/*.ts'],
        exclude: ['src/test/**', 'src/main.tsx', 'src/**/*.test.{ts,tsx}'],
        reporter: ['text', 'html', 'json-summary'],
      },
    },
  };
});
