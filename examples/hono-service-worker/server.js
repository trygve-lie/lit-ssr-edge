/**
 * Node.js server entry point.
 *
 * Composes two Hono apps:
 *   1. A static-file handler for the built assets in public/  (client.js, sw.js)
 *   2. The shared SSR app from src/app.js for all other routes
 *
 * On the first visit the browser receives server-rendered HTML. The page then
 * registers the service worker (public/sw.js). After the SW activates it
 * intercepts subsequent navigate requests locally — the server is only needed
 * to serve static assets from that point on.
 */
import { serve }       from '@hono/node-server';
import { Hono }        from 'hono';
import { readFile }    from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join }  from 'node:path';

import ssrApp from './src/app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ?? 3000;

const server = new Hono();

// ── Static assets ─────────────────────────────────────────────────────────────
//
// Serve the two pre-built files from public/.
// All other paths are handled by the SSR app below.

async function serveFile(c, filename, contentType) {
  const content = await readFile(join(__dirname, 'public', filename));
  return c.body(content, 200, { 'Content-Type': contentType });
}

server.get('/client.js', (c) => serveFile(c, 'client.js', 'text/javascript; charset=utf-8'));
server.get('/sw.js',     (c) => serveFile(c, 'sw.js',     'text/javascript; charset=utf-8'));

// ── SSR app ───────────────────────────────────────────────────────────────────

server.route('/', ssrApp);

// ── Start ─────────────────────────────────────────────────────────────────────

serve({ fetch: server.fetch, port: Number(PORT) }, (info) => {
  console.log(`Server running at:  http://localhost:${info.port}`);
});
