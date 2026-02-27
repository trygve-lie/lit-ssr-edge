/**
 * Bun HTTP server — lit-ssr-edge SSR example.
 *
 * Demonstrates how to use lit-ssr-edge to server-side render Lit web components
 * with Bun's built-in HTTP server. No adapters or polyfills are needed — Bun
 * natively supports the Web Platform APIs (Request, Response, ReadableStream,
 * TextEncoder) that lit-ssr-edge targets.
 *
 * Usage:
 *   bun run server.js
 *   # or: bun start
 *   # then open http://localhost:3000
 */

// 1. Install the DOM shim FIRST, before any Lit or component imports.
//    Bun has no HTMLElement or customElements, so this sets up the minimal
//    subset that lit-element and lit-ssr-edge require.
import { installGlobalDomShim, render, RenderResultReadable, collectResult } from 'lit-ssr-edge';
import { html as serverHtml } from 'lit-ssr-edge/server-template.js';
import { html } from 'lit';

installGlobalDomShim();

// 2. Import components (registers custom elements as a side effect).
import './components/my-page.js';

const PORT = Number(Bun.env.PORT ?? 3000);

// ── Rendering helpers ────────────────────────────────────────────────────────

/**
 * Builds the full HTML document for a given URL path.
 * Returns a lit-ssr-edge RenderResult iterable.
 */
function buildPage(pathname) {
  return render(
    serverHtml`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>lit-ssr-edge + Bun</title>
    <!--
      In production, add the @lit-labs/ssr-client hydration script and your
      bundled client-side component code here.
    -->
  </head>
  <body>
    ${html`<my-page path="${pathname}"></my-page>`}
  </body>
</html>`
  );
}

// ── HTTP server ──────────────────────────────────────────────────────────────

Bun.serve({
  port: PORT,

  fetch(request) {
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);

    // ── Option A: Streaming (low TTFB, ideal for large pages) ────────────────
    //
    // RenderResultReadable.getStream() returns a ReadableStream<Uint8Array>
    // which Bun accepts directly as a Response body — no adapter needed.

    const stream = new RenderResultReadable(buildPage(url.pathname)).getStream();

    return new Response(stream, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

    // ── Option B: Buffered (simpler, for small pages or when Content-Length is needed) ──
    //
    // const body = await collectResult(buildPage(url.pathname));
    // return new Response(body, {
    //   headers: { 'Content-Type': 'text/html; charset=utf-8' },
    // });
  },
});

console.log(`\nlit-ssr-edge + Bun`);
console.log(`──────────────────`);
console.log(`Server: http://localhost:${PORT}\n`);
