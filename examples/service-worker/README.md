# lit-ssr-edge — Service Worker example

Server-side renders Lit web components inside a **browser Service Worker** using
lit-ssr-edge — no external server required after the first page load.

WinterTC standardised its Minimum Common Web Platform API by drawing directly
from the APIs already available in browser Service Workers. lit-ssr-edge was
built for WinterTC runtimes, so it runs in a service worker with the same
pre-bundling approach used for Cloudflare Workers and Fastly Compute.

## How it works

```
sw.js  (service worker, runs in the browser)
  │
  ├─ import 'lit-ssr-edge/install-global-dom-shim.js'   → sets up HTMLElement, customElements
  ├─ import './components/my-page.js'                    → registers <my-page>
  │
  └─ self.addEventListener('fetch', (event) => {         ← intercepts navigation requests
       if (event.request.mode === 'navigate') {
         event.respondWith(renderPage(event.request));   ← returns SSR HTML
       }
     })
```

On the first visit `public/index.html` is served by the local Node.js server.
It registers the service worker and reloads automatically once the SW activates.
From that point on every page navigation is intercepted by the service worker and
rendered by lit-ssr-edge — the Node.js server only serves the static assets
(`public/index.html` is never reached again).

## Requirements

- [Node.js 18+](https://nodejs.org/) — for npm install and the local dev server
- A browser that supports:
  - Module service workers (`type: 'module'`) — Chrome 91+, Edge 91+, Safari 15+
  - ReadableStream as Response body — Chrome 52+, Safari, Edge
  - (Firefox: see the [Firefox limitation](#firefox-limitation) section below)

## Getting started

```bash
npm install
npm start
# Open http://localhost:3000
```

`npm start` runs `node esbuild.config.js` (bundles the service worker to
`public/sw.js`) then `node server.js` (serves `public/` over localhost). Open
the URL in a browser. The page reloads once automatically when the service
worker activates, and after that every navigation is SSR-rendered by lit-ssr-edge
inside the browser.

## Key differences from other platforms

| | Service Worker | Cloudflare | Fastly | Netlify Edge | Vercel Edge |
|---|---|---|---|---|---|
| **Where it runs** | Browser (client) | Cloudflare PoP | Fastly PoP | Netlify edge | Vercel edge |
| **Entry point** | `fetch` event + `respondWith()` | `export default { fetch() }` | `addEventListener('fetch',...)` | `export default async fn` | `export default async fn` |
| **Opt-in** | `event.request.mode === 'navigate'` | all requests | all requests | path declaration | `{ runtime: 'edge' }` |
| **Build step** | ✅ esbuild | ✅ esbuild | ✅ esbuild + WASM | ❌ auto | ❌ auto† |
| **Local dev** | `node server.js` (port 3000) | `wrangler dev` | `fastly compute serve` | `netlify dev` | `vercel dev` |

The rendering code (`render()`, `RenderResultReadable`, `serverHtml`, `html`) is
identical across all platforms.

## Service worker scope and output path

A service worker's default scope is the directory it is **served from**. A
worker served at `/dist/sw.js` would only control pages under `/dist/` — it
would never intercept navigation requests to `/`.

The esbuild config outputs the bundle to **`public/sw.js`** (not `dist/sw.js`),
so the worker is served at `/sw.js`. Its default scope is `/` — the whole site.

## The esbuild pre-bundling requirement

This is the same requirement as Cloudflare Workers and Fastly Compute.

`lit-html`'s `package.json` exports list the `browser` key before the `node` key.
When the browser resolves modules in a service worker, it uses the `browser`
export condition, which picks `lit-html.js` — a build that calls
`const l = document` at module initialisation and throws
`ReferenceError: document is not defined` in the service worker (which has no DOM).

The esbuild config uses `--platform=neutral` to remove `browser` from the active
conditions, then `--conditions=node` to select `node/lit-html.js` — the SSR-safe
build that guards against a missing `document`:

```js
// node/lit-html.js (safe)
const l = void 0 === globalThis.document
  ? { createTreeWalker: () => ({}) }
  : document;
```

## Service worker lifecycle

### install — skip waiting

```js
self.addEventListener('install', () => {
  self.skipWaiting(); // activate immediately, don't wait for old SW to release
});
```

### activate — claim all clients

```js
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // take control of open pages immediately
});
```

`clients.claim()` makes this SW the controller of all open clients in its scope.
The host page (`public/index.html`) listens for the `controllerchange` event and
reloads — so the first SSR render happens automatically, without the user clicking
reload.

### fetch — intercept navigation requests only

```js
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(renderPage(event.request));
  }
  // Scripts, stylesheets, images, etc. fall through to the network.
});
```

`event.request.mode === 'navigate'` identifies full-page HTML navigations.
All other asset requests (JS, CSS, images) pass through to the network unchanged.

## Firefox limitation

Firefox does not yet support `ReadableStream` as a `Response` body inside service
workers. An upstream bug is open and tracked by the Firefox team.

`sw.js` detects this at startup by attempting to construct a `Response` with a
`ReadableStream` body:

```js
const STREAMING_SUPPORTED = (() => {
  try {
    new Response(new ReadableStream());
    return true;
  } catch {
    return false;
  }
})();
```

- **Streaming browsers** (Chrome, Edge, Safari): the rendered HTML is streamed
  directly into the response — low time-to-first-byte.
- **Firefox fallback**: `collectResult()` buffers the entire HTML string before
  responding. The browser waits for the complete render before painting, but the
  content is functionally identical.

When Firefox ships streaming support, the detection becomes a no-op and streaming
is used automatically — no code change is required.

## Streaming

On streaming-capable browsers, the response body is a `ReadableStream<Uint8Array>`
produced by `RenderResultReadable`:

```js
return new Response(
  new RenderResultReadable(render(page)).getStream(),
  { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
);
```

Content is delivered in 8 KB chunks (the default in `RenderResultReadable`) as
the component tree is traversed, so the browser can start parsing and painting
before the full render is complete.

## Offline capability

Unlike any server-side platform, a service worker can render pages entirely
offline. All the assets needed for rendering (the bundled `dist/sw.js` which
contains lit-ssr-edge, lit, and the component code) are already present in the
browser. No network request to an origin server is required.

To add offline support, pre-cache `dist/sw.js` and the component assets during
the `install` event using the Cache API:

```js
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open('v1').then(cache => cache.addAll(['/dist/sw.js']))
  );
});
```

## Client-side hydration

To hydrate components on the client, add to the rendered page's `<head>`:

```html
<script type="module">
  import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
  import './components/my-page.js';
</script>
```

The `defer-hydration` attribute on nested components and the `<!--lit-part-->`
markers emitted by lit-ssr-edge are compatible with `@lit-labs/ssr-client`.
