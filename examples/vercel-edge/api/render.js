/**
 * Vercel Edge Function — lit-ssr-edge SSR entry point.
 *
 * Vercel Edge Functions run on a V8-isolate based runtime that implements
 * the WinterTC Minimum Common Web Platform API. ReadableStream, TextEncoder,
 * fetch(), URL, and btoa() are all available natively.
 *
 * Handler pattern (Vercel Edge, non-framework):
 *   export default async function handler(request) → Response
 *   export const config = { runtime: 'edge' }
 *
 * Files in the api/ directory are automatically picked up by Vercel.
 * The vercel.json rewrites route all incoming requests to this function.
 *
 * ⚠ Note on bundling: Vercel bundles edge functions automatically using an
 * esbuild-based pipeline. If you encounter "ReferenceError: document is not
 * defined" at startup, Vercel's bundler resolved lit-html to its browser build
 * (which accesses `document` at module level). In that case, pre-bundle with
 * esbuild using --platform=neutral --conditions=node --main-fields=module,main
 * (see the cloudflare-worker example for the pattern) and point Vercel at the
 * pre-bundled output instead.
 */

// 1. Install the DOM shim FIRST — before any Lit or component imports.
//    Vercel's V8 edge runtime does not expose browser DOM globals
//    (HTMLElement, customElements, CSSStyleSheet, etc.).
import 'lit-ssr-edge/install-global-dom-shim.js';

// 2. Import lit-ssr-edge rendering utilities.
import { render, RenderResultReadable } from 'lit-ssr-edge';
import { html as serverHtml } from 'lit-ssr-edge/server-template.js';
import { html } from 'lit';

// 3. Import components. Vercel bundles these automatically at deploy time.
import '../components/my-app.js';

/**
 * Renders a full HTML document for the incoming request.
 *
 * @param {Request} request - Standard WinterTC Request object.
 * @returns {Response}
 */
export default async function handler(request) {
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET' },
    });
  }

  // Server-only template for the document shell (no hydration markers on the
  // outer HTML). The regular html`` inside produces markers so the Lit client
  // can attach to <my-app> once JavaScript loads on the client.
  const page = serverHtml`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>lit-ssr-edge on Vercel Edge Functions</title>
    <!--
      In production, include the @lit-labs/ssr-client hydration script and
      your bundled client-side components here.
    -->
  </head>
  <body>
    ${html`<my-app path="${url.pathname}"></my-app>`}
  </body>
</html>`;

  // Stream the rendered HTML directly into the Response body.
  // Vercel's edge runtime supports ReadableStream as a Response body natively.
  const stream = new RenderResultReadable(render(page)).getStream();

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

// Mark this function as an Edge Function.
// Without this, Vercel defaults to the Node.js serverless runtime.
export const config = {
  runtime: 'edge',
};
