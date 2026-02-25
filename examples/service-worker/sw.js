/**
 * Service Worker — lit-ssr-edge SSR entry point.
 *
 * This service worker intercepts all navigation requests (HTML page loads)
 * and renders Lit components on-the-fly using lit-ssr-edge — entirely inside
 * the browser, with no server involved.
 *
 * Lifecycle:
 *   install  → skip waiting so the new SW activates immediately
 *   activate → claim all clients, then postMessage them to reload
 *   fetch    → intercept navigate-mode requests and return rendered HTML
 *
 * Build:
 *   This file must be pre-bundled with esbuild using --platform=neutral
 *   --conditions=node so that lit-html resolves to its SSR-safe node build
 *   rather than the browser build that calls `document` at module init.
 *   See esbuild.config.js.
 *
 * Streaming note:
 *   Firefox does not yet support ReadableStream as a Response body in service
 *   workers. This file detects support at startup and falls back to buffered
 *   rendering (collectResult) for non-supporting browsers.
 */

// 1. Install the DOM shim.
//    Service Workers have no browser DOM globals (HTMLElement, customElements,
//    CSSStyleSheet, etc.). We call installGlobalDomShim() explicitly here
//    (not via the side-effect import) so that minification cannot tree-shake
//    the call away — a named function call is always preserved.
import { installGlobalDomShim } from 'lit-ssr-edge';
installGlobalDomShim();

// 2. Import lit-ssr-edge rendering utilities.
import { render, RenderResultReadable, collectResult } from 'lit-ssr-edge';
import { html as serverHtml } from 'lit-ssr-edge/server-template.js';
import { html } from 'lit';

// 3. Import components. esbuild inlines these at build time.
import './components/my-page.js';

// ── Streaming support detection ───────────────────────────────────────────────
//
// Firefox does not yet support ReadableStream as a Response body inside service
// workers. We detect this once at SW startup and choose the appropriate render
// path for every subsequent request.
//
// When Firefox ships support, this detection becomes a no-op and streaming is
// used automatically — no code change required.

const STREAMING_SUPPORTED = (() => {
  try {
    new Response(new ReadableStream());
    return true;
  } catch {
    return false;
  }
})();

// ── Lifecycle: install ────────────────────────────────────────────────────────

self.addEventListener('install', () => {
  // Skip the waiting phase so the new service worker activates immediately,
  // even if the previous version is still controlling clients.
  self.skipWaiting();
});

// ── Lifecycle: activate ───────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  // 1. Claim all currently open clients so they are immediately controlled.
  // 2. Once claim() resolves, notify every window client to reload.
  //
  // Using postMessage rather than relying on the client-side 'controllerchange'
  // event is more reliable: the message is sent only after claim() has fully
  // completed, guaranteeing the SW is ready to intercept the subsequent
  // navigation request before the client triggers it.
  event.waitUntil(
    clients.claim().then(async () => {
      const windowClients = await clients.matchAll({ type: 'window' });
      for (const client of windowClients) {
        client.postMessage({ type: 'sw-activated' });
      }
    }),
  );
});

// ── Fetch event: intercept navigation requests ────────────────────────────────

self.addEventListener('fetch', (event) => {
  // Only intercept full-page navigation requests (HTML document loads).
  // Requests for scripts, stylesheets, images, etc. fall through to the
  // network as normal.
  if (event.request.mode === 'navigate') {
    event.respondWith(renderPage(event.request));
  }
});

// ── Rendering ─────────────────────────────────────────────────────────────────

/**
 * Renders a full HTML document for the given navigation request.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function renderPage(request) {
  const url = new URL(request.url);

  const page = serverHtml`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>lit-ssr-edge — Service Worker</title>
  </head>
  <body>
    ${html`<my-page path="${url.pathname}"></my-page>`}
    <script type="module">
      if ('serviceWorker' in navigator) {
        // Re-register so the SW stays active across sessions.
        navigator.serviceWorker.register('/sw.js', { type: 'module' });
        // Listen for the activation message from the SW (sent after a SW
        // update activates and claims this client). Reload so the new SW
        // version serves the page.
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'sw-activated') {
            window.location.reload();
          }
        });
      }
    </script>
  </body>
</html>`;

  const headers = { 'Content-Type': 'text/html; charset=utf-8' };
  const result = render(page);

  if (STREAMING_SUPPORTED) {
    return new Response(
      new RenderResultReadable(result).getStream(),
      { status: 200, headers },
    );
  }

  // Firefox fallback: buffer the entire response before sending.
  const body = await collectResult(result);
  return new Response(body, { status: 200, headers });
}
