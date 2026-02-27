/**
 * Hono SSR application — shared between the Node.js server and the service worker.
 *
 * Each route is responsible for its own full HTML document (classical SSR).
 * The web component <my-counter> is a self-contained widget embedded in each
 * page to demonstrate SSR + client-side hydration.
 *
 * This file is bundled twice by esbuild:
 *   1. Into public/sw.js  — runs inside the browser service worker
 *   2. Used directly by server.js — runs inside Node.js
 */

import { installGlobalDomShim, render, RenderResultReadable } from 'lit-ssr-edge';
import { html as serverHtml } from 'lit-ssr-edge/server-template.js';
import { html } from 'lit';
import { Hono } from 'hono';

import '../components/my-counter.js';

installGlobalDomShim();

// Detect execution context so each page can label who rendered it.
const renderedBy = (() => {
  try {
    return self instanceof ServiceWorkerGlobalScope ? 'service-worker' : 'server';
  } catch {
    return 'server';
  }
})();

// ── Shared document shell ──────────────────────────────────────────────────────
//
// A server-only template (serverHtml) for the outer HTML scaffold — no
// hydration markers on the document, head, or navigation. Each route passes
// its page body as a hydratable html`` template.

function shell(title, body) {
  return serverHtml`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} — Hono + lit-ssr-edge</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: system-ui, sans-serif;
        max-width: 820px;
        margin: 2rem auto;
        padding: 0 1.25rem;
        line-height: 1.6;
        color: #1a1a2e;
      }
      nav {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        border-bottom: 2px solid #e36002;
        padding-bottom: 0.75rem;
        margin-bottom: 2rem;
      }
      nav a { color: #e36002; text-decoration: none; font-weight: 500; }
      nav a:hover { text-decoration: underline; }
      .rendered-by {
        margin-left: auto;
        font-size: 0.78rem;
        font-family: monospace;
        padding: 0.2rem 0.5rem;
        border-radius: 3px;
        background: #fff3e0;
        color: #b34700;
        border: 1px solid #ffcc80;
      }
      h1 { margin-top: 0; }
    </style>

    <!--
      Client bundle: @lit-labs/ssr-client hydration support + component definition.
      Must be loaded as a module; the import order inside client.js matters.
    -->
    <script type="module" src="/client.js"></script>

    <!--
      Register the service worker.
      After it activates, all subsequent navigate requests are served by Hono
      running inside the SW — no server round-trip.
    -->
    <script type="module">
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js', { type: 'module' });
      }
    </script>
  </head>
  <body>
    <nav>
      <strong>🔥</strong>
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
      <span class="rendered-by">${renderedBy}</span>
    </nav>

    ${body}
  </body>
</html>`;
}

// ── Response helper ────────────────────────────────────────────────────────────

function respond(result) {
  return new Response(new RenderResultReadable(render(result)).getStream(), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Rendered-By': renderedBy,
    },
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

const app = new Hono();

app.get('/', (c) => respond(shell('Home', html`
  <h1>Home</h1>
  <p>
    This page was server-side rendered by the <strong>${renderedBy}</strong>.
    After the service worker activates, navigating here again will be rendered
    locally in the browser — no server round-trip.
  </p>
  <p>The counter below is SSR'd with its initial value and hydrated on the client:</p>
  <my-counter label="Visits" count="0"></my-counter>
`)));

app.get('/about', (c) => respond(shell('About', html`
  <h1>About</h1>
  <p>
    Each route is a self-contained Hono handler that produces a complete HTML
    document via <code>serverHtml</code>. The same handlers run on the Node.js
    server and inside the browser service worker — only the entry point differs.
  </p>
  <p>Rate this page:</p>
  <my-counter label="Rating" count="3"></my-counter>
`)));

app.get('/contact', (c) => respond(shell('Contact', html`
  <h1>Contact</h1>
  <p>
    The <code>&lt;my-counter&gt;</code> component is server-rendered with its
    initial <code>count</code> attribute value baked into the HTML. Once
    <code>client.js</code> loads, <code>@lit-labs/ssr-client</code> attaches
    to the existing shadow DOM and the buttons become interactive — no
    re-render, no flash of unstyled content.
  </p>
  <my-counter label="Messages" count="0"></my-counter>
`)));

export default app;
