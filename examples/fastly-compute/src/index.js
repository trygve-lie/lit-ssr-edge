/// <reference types="@fastly/js-compute" />
/**
 * Fastly Compute — lit-edge SSR entry point.
 *
 * Fastly Compute runs JavaScript inside a SpiderMonkey-based WASM runtime.
 * The build pipeline bundles this ESM file with esbuild, then compiles the
 * bundle to WebAssembly with js-compute-runtime.
 *
 * The runtime implements the WinterTC Minimum Common Web Platform API, so
 * ReadableStream, TextEncoder, URL, fetch(), Response, and Request all work
 * exactly as they do in browsers and Cloudflare Workers.
 *
 * Setup:
 *   npm install
 *   npm run build         # bundle JS → compile to bin/main.wasm
 *   npm start             # local dev server on http://127.0.0.1:7676
 *   npm run deploy        # publish to your Fastly service
 */

// 1. Install the DOM shim FIRST — before any Lit imports or component imports.
//    This sets up globalThis.HTMLElement, globalThis.customElements, etc.
import 'lit-edge/install-global-dom-shim.js';

// 2. Import lit-edge rendering utilities.
import { render, RenderResultReadable } from 'lit-edge';
import { html as serverHtml } from 'lit-edge/server-template.js';
import { html } from 'lit';

// 3. Import components. esbuild inlines them at build time — no runtime
//    module resolution or dynamic imports needed.
import '../components/my-edge.js';

// ── Request handler ───────────────────────────────────────────────────────────

/**
 * Renders a full HTML page for the given request.
 *
 * @param {FetchEvent} event
 * @returns {Promise<Response>}
 */
async function handleRequest(event) {
  const request = event.request;

  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET' },
    });
  }

  const url = new URL(request.url);

  // Only render HTML pages (skip requests for static assets).
  if (url.pathname.includes('.')) {
    return new Response('Not Found', { status: 404 });
  }

  // Server-only template for the document shell (no hydration markers on the
  // outer HTML). Regular html`` inside produces hydration markers so the Lit
  // client can attach to <my-edge> after the page loads.
  const page = serverHtml`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>lit-edge on Fastly Compute</title>
    <!--
      In production, include the @lit-labs/ssr-client hydration script and
      your bundled client-side components here so the component can be
      updated on the client after the initial render.
    -->
  </head>
  <body>
    ${html`<my-edge path="${url.pathname}" region="fastly"></my-edge>`}
  </body>
</html>`;

  // Stream the rendered HTML directly into the Response body.
  // ReadableStream is natively supported by the Fastly Compute runtime.
  const stream = new RenderResultReadable(render(page)).getStream();

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Fastly's cache can be instructed to cache this response at the edge.
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  });
}

// ── Fastly Compute entry point ────────────────────────────────────────────────
//
// Unlike Cloudflare Workers (which use `export default { fetch() {} }`),
// Fastly Compute uses an addEventListener-based event model.
// The fetch event fires for every incoming request.

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event));
});
