/**
 * Netlify Edge Function — lit-ssr-edge SSR entry point.
 *
 * Netlify Edge Functions run on Deno, a WinterTC-compatible runtime that
 * natively implements ReadableStream, fetch(), TextEncoder, and the `node`
 * package export condition. No custom build step is required — Netlify bundles
 * npm dependencies automatically when you run `netlify dev` or deploy.
 *
 * Handler pattern (Netlify):
 *   export default async (request, context) => Response
 *
 * This differs from Cloudflare Workers (export default { fetch() {} }) and
 * Fastly Compute (addEventListener('fetch', ...)), but the rendering code
 * using lit-ssr-edge is identical across all three platforms.
 */

// 1. Install the DOM shim FIRST — before any Lit or component imports.
//    Deno does not provide browser DOM globals (HTMLElement, customElements,
//    etc.) by default. The shim sets them up via ??= so it does not overwrite
//    anything already present.
import 'lit-ssr-edge/install-global-dom-shim.js';

// 2. Import lit-ssr-edge rendering utilities.
import { render, RenderResultReadable } from 'lit-ssr-edge';
import { html as serverHtml } from 'lit-ssr-edge/server-template.js';
import { html } from 'lit';

// 3. Import components. Netlify bundles these automatically at deploy time.
import '../../components/my-site.js';

/**
 * Renders a full HTML document for the incoming request.
 *
 * @param {Request} request - The incoming HTTP request.
 * @param {import('@netlify/edge-functions').Context} context - Netlify context.
 * @returns {Response}
 */
export default async (request, context) => {
  const url = new URL(request.url);

  // Skip non-GET requests.
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET' },
    });
  }

  // Server-only template for the document shell (no hydration markers on the
  // outer HTML). The regular html`` inside produces hydration-ready output so
  // the Lit client can attach to <my-site> once JavaScript loads.
  const page = serverHtml`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>lit-ssr-edge on Netlify Edge Functions</title>
    <!--
      In production, include the @lit-labs/ssr-client hydration script and
      your bundled client-side components here.
    -->
  </head>
  <body>
    ${html`<my-site path="${url.pathname}"></my-site>`}
  </body>
</html>`;

  // Stream the rendered HTML directly into the Response body.
  // Deno's fetch API accepts ReadableStream as a Response body natively.
  const stream = new RenderResultReadable(render(page)).getStream();

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
};

// Declare the URL path this function handles.
// Netlify also reads [[edge_functions]] from netlify.toml; this inline config
// form works as an alternative when you prefer to keep routing next to the
// function code.
export const config = {
  path: '/*',
};
