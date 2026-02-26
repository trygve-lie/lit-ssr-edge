/**
 * Node.js entry point for local development.
 *
 * Uses @hono/node-server to run the Hono app on Node.js 18+.
 * The app itself (src/app.js) is runtime-agnostic — this file is the only
 * Node.js-specific piece.
 *
 * Usage:  npm start   (runs: node server.js)
 */
import { serve } from '@hono/node-server';
import app from './src/app.js';

const PORT = process.env.PORT ?? 3000;

serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`\nlit-ssr-edge + Hono`);
  console.log(`────────────────────`);
  console.log(`Server: http://localhost:${info.port}\n`);
});
