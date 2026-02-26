/**
 * Hono application — lit-ssr-edge SSR.
 *
 * This file is runtime-agnostic. It exports a standard Hono app whose
 * handlers return Web Platform Response objects. Deploy it to any runtime
 * Hono supports by changing only the entry point:
 *
 *   Node.js:           serve({ fetch: app.fetch, port: 3000 })
 *   Cloudflare Workers: export default app
 *   Fastly Compute:    addEventListener('fetch', (e) => e.respondWith(app.fetch(e.request)))
 *   Bun:               export default app
 *   Deno:              Deno.serve(app.fetch)
 *
 * See server.js for the Node.js entry point used by `npm start`.
 */

// Install the DOM shim before any Lit or component imports.
// Service workers and edge runtimes have no HTMLElement, customElements, etc.
import { installGlobalDomShim, render, RenderResultReadable } from 'lit-ssr-edge';
import { html as serverHtml } from 'lit-ssr-edge/server-template.js';
import { html } from 'lit';
import { Hono } from 'hono';

// Register components. On Node.js these are resolved by the module loader;
// for edge runtimes, bundle this file first (esbuild, Vite, etc.).
import '../components/my-page.js';

installGlobalDomShim();

const app = new Hono();

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('*', (c) => {
  const url = new URL(c.req.url);

  // Server-only template for the document shell — no hydration markers on the
  // outer HTML. The regular html`` inside produces markers so the Lit client
  // can attach to <my-page> after the page loads.
  const page = serverHtml`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>lit-ssr-edge + Hono</title>
    <!--
      In production, add the @lit-labs/ssr-client hydration script and your
      bundled client-side component code here.
    -->
  </head>
  <body>
    ${html`<my-page path="${url.pathname}" framework="Hono"></my-page>`}
  </body>
</html>`;

  // RenderResultReadable.getStream() returns ReadableStream<Uint8Array> which
  // Hono accepts directly as a Response body — no adapter needed.
  const stream = new RenderResultReadable(render(page)).getStream();

  return new Response(stream, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

export default app;
