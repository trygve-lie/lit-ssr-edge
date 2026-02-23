/**
 * Cloudflare Worker — lit-edge SSR example.
 *
 * Demonstrates how to use lit-edge to server-side render Lit web components
 * on Cloudflare Workers WITHOUT the nodejs_compat flag.
 *
 * Setup:
 *   npm install
 *   npx wrangler dev       # local development
 *   npx wrangler deploy    # deploy to Cloudflare
 *
 * Build step (esbuild bundles components + dependencies into a single file):
 *   npm run build
 */

// 1. Install the DOM shim FIRST — before any Lit imports or component imports.
//    This sets up globalThis.HTMLElement, globalThis.customElements, etc.
import 'lit-edge/install-global-dom-shim.js';

// 2. Import lit-edge rendering utilities.
import { render, RenderResultReadable } from 'lit-edge';
import { html as serverHtml } from 'lit-edge/server-template.js';
import { html } from 'lit';

// 3. Import components. In a real project these would be pre-bundled into the
//    worker script at build time using esbuild or another bundler.
import './components/my-app.js';

/**
 * Renders a full HTML page for the given request.
 *
 * @param {Request} request
 * @returns {Response}
 */
function renderPage(request) {
  const url = new URL(request.url);

  // Server-only template for the outer document shell (no hydration markers).
  // Regular html`` templates inside will be hydrated on the client.
  const page = serverHtml`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>lit-edge on Cloudflare Workers</title>
    <!--
      In production, include the @lit-labs/ssr-client hydration script
      and your bundled client-side components here.
    -->
  </head>
  <body>
    ${html`<my-app path="${url.pathname}" greeting="Hello from the edge!"></my-app>`}
  </body>
</html>`;

  // Stream the rendered HTML directly into the Response body.
  // RenderResultReadable buffers output in 8 KB chunks by default, which
  // reduces overhead on the ReadableStream machinery.
  const stream = new RenderResultReadable(render(page)).getStream();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Instruct browsers and CDNs to cache for 60 seconds
      'Cache-Control': 'public, max-age=60',
    },
  });
}

export default {
  /**
   * @param {Request} request
   * @param {object}  env     - Cloudflare Worker bindings (KV, R2, secrets, …)
   * @param {object}  ctx     - Execution context (ctx.waitUntil, ctx.passThroughOnException)
   * @returns {Response}
   */
  fetch(request, _env, _ctx) {
    const url = new URL(request.url);

    // Only render HTML for GET requests to HTML resources.
    if (request.method !== 'GET' || url.pathname.includes('.')) {
      return new Response('Not found', { status: 404 });
    }

    return renderPage(request);
  },
};
