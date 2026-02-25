# lit-ssr-edge — Service Worker example

Server-side renders Lit web components inside a **browser Service Worker** using
lit-ssr-edge — no external server required after the first page load.

## How it works

```
sw.js  (service worker, runs in the browser)
  │
  ├─ installGlobalDomShim()                              → sets up HTMLElement, customElements
  ├─ import './components/my-page.js'                    → registers <my-page>
  │
  └─ self.addEventListener('fetch', (event) => {         ← intercepts navigation requests
       if (event.request.mode === 'navigate') {
         event.respondWith(renderPage(event.request));   ← returns SSR HTML
       }
     })
```

On the first visit `public/index.html` is served by the local Node.js server.
It registers the service worker, which activates and sends a `postMessage` to
the page triggering an automatic reload. From that point on every page navigation
is intercepted by the service worker and rendered by lit-ssr-edge.

## Requirements

- [Node.js 18+](https://nodejs.org/)
- A browser that supports module service workers — Chrome 91+, Edge 91+, Safari 15+

## Getting started

```bash
npm install
npm start
# Open http://localhost:3000
```

`npm start` bundles the service worker to `public/sw.js` then starts a static
file server on port 3000.

## Key configuration points

**`esbuild.config.js`** — `--platform=neutral --conditions=node` is required so
that esbuild resolves `lit-html` to its SSR-safe node build. The browser build
accesses `document` at module level and throws `ReferenceError: document is not
defined` in the service worker (which has no DOM).

**Service worker scope** — the bundle outputs to `public/sw.js` so the worker is
served at `/sw.js`. A service worker's default scope is the directory it is served
from, so `/sw.js` gives scope `/` (the whole site). Serving from `/dist/sw.js`
would only control pages under `/dist/`.

**DOM shim** — `installGlobalDomShim()` is called explicitly (not via a bare
side-effect import) so minification cannot tree-shake the call away.

## Firefox limitation

Firefox does not yet support `ReadableStream` as a `Response` body inside service
workers. `sw.js` detects this at startup and falls back to buffered rendering via
`collectResult()` for Firefox. When Firefox ships support the fallback becomes a
no-op — no code change is required.

## Streaming

On streaming-capable browsers, the response body is a `ReadableStream<Uint8Array>`
produced by `RenderResultReadable`:

```js
return new Response(
  new RenderResultReadable(render(page)).getStream(),
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
);
```

## Client-side hydration

To hydrate components on the client, add to the rendered page's `<head>`:

```html
<script type="module">
  import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
  import './components/my-page.js';
</script>
```

The `defer-hydration` attribute and `<!--lit-part-->` markers emitted by
lit-ssr-edge are compatible with `@lit-labs/ssr-client`.
