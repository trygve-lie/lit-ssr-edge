# Service Worker Compatibility Analysis

**Status:** Research / Pre-implementation analysis
**Date:** February 2026
**Conclusion:** ✅ Compatible — implementation is feasible with no public API changes

---

## Background

WinterTC (formerly WinterCG) standardised its Minimum Common Web Platform API by
drawing directly from the APIs already available in browser **Service Workers**.
The fetch event model, `Request`/`Response`, `ReadableStream`, `TextEncoder`, and
`URL` all originated in the Service Worker specification before being ported to
edge runtimes.  This means lit-ssr-edge, which was built to target WinterTC runtimes,
has a natural affinity for service workers.

---

## What a Service Worker can do

A service worker sits between a browser and the network and intercepts all fetch
requests from controlled pages. The lifecycle is:

```
navigator.serviceWorker.register('/sw.js', { type: 'module' })
         │
         └─ install event  → cache static assets
         └─ activate event → clean up old caches, claim clients
         └─ fetch event    → intercept every network request
```

The fetch event is the key hook for SSR:

```js
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    // This is a full-page navigation — return server-rendered HTML
    event.respondWith(renderPage(event.request));
  }
});
```

`event.respondWith()` accepts any `Response`, including one whose body is a
`ReadableStream` — exactly what `RenderResultReadable.getStream()` produces.

---

## Service Worker API Surface — Full Audit

### ✅ APIs lit-ssr-edge needs that ARE available in a service worker

| API | Used by | Notes |
|-----|---------|-------|
| `ReadableStream` | `render-stream.js` | Available; `Response` body can be a `ReadableStream` |
| `TextEncoder` | `render-stream.js` | Available |
| `Uint8Array` / `Uint32Array` | `render-stream.js`, `digest.js` | Available |
| `btoa()` | `digest.js` | Available via `WorkerGlobalScope` |
| `WeakMap` | `render-value.js` (template cache) | Standard JS global |
| `Map` | `reflected-attributes.js`, `directives-validation.js` | Standard JS global |
| `Symbol.iterator` / `Symbol.asyncIterator` | `render-stream.js`, `render-result.js` | Standard JS |
| `RegExp` / `String.matchAll()` | `render-value.js` | Standard JS |
| `Promise` | `render-result.js`, `render-stream.js` | Standard JS |
| `URL` | event handler in user code | Available |
| `Request` / `Response` | event handler in user code | Available |
| `fetch()` | user code | Available |
| `setTimeout` / `queueMicrotask` | none directly | Available anyway |

### ❌ APIs NOT available in a service worker, and how they're handled

| API | Status | Resolution |
|-----|--------|------------|
| `document` | Not present | lit-html `node` build guards against this: `void 0 === globalThis.document ? {createTreeWalker:()=>({})} : document`. Safe. |
| `window` | Not present | Never accessed by lit-ssr-edge |
| `customElements` (native) | Not present | Provided by `installGlobalDomShim()` via `@lit-labs/ssr-dom-shim` |
| `HTMLElement` | Not present | Provided by `installGlobalDomShim()` |
| `Element` | Not present | Provided by `installGlobalDomShim()` |
| `CSSStyleSheet` | Not present | Provided by `installGlobalDomShim()` |
| `EventTarget` | Present natively | Also provided by shim via `??=`; native value preserved |
| `Event` / `CustomEvent` | Present natively | Also provided by shim via `??=`; native values preserved |
| `dynamic import()` | Throws in service workers | **Not used anywhere in lit-ssr-edge source** ✅ |
| `eval()` / `new Function()` | Restricted by CSP | **Not used anywhere in lit-ssr-edge source** ✅ |
| `localStorage` | Not present | Never accessed by lit-ssr-edge |

### Dependency audit: external packages

All runtime dependencies are pure JavaScript with **no browser DOM access**:

| Package | `document`? | `window`? | Notes |
|---------|-------------|-----------|-------|
| `@lit-labs/ssr-dom-shim` | ❌ | ❌ | Pure JS shims only; sets `globalThis.litServerRoot` as a side effect |
| `parse5` | ❌ | ❌ | Pure AST-based HTML parser |
| `@parse5/tools` | ❌ | ❌ | Pure AST traversal helpers |

**Conclusion:** Every piece of lit-ssr-edge and all its runtime dependencies work in a
service worker environment, provided the DOM shim is installed first.

---

## The One Blocker: lit-html Export Condition

This is the same problem that required `--platform=neutral --conditions=node` in the
Cloudflare Workers and Fastly Compute examples.

`lit-html`'s `package.json` exports map lists keys in this order:
```json
{ "browser": "...", "node": "...", "default": "..." }
```

The browser build (`lit-html.js`) executes `const l = document` at module
initialisation — a bare `document` global access that throws `ReferenceError` in
any environment without a DOM, including service workers.

The node build (`node/lit-html.js`) guards this safely:
```js
const l = void 0 === globalThis.document
  ? { createTreeWalker: () => ({}) }
  : document;
```

**When a service worker loads modules** (via `type: 'module'` registration), the
browser resolves package exports using the `browser` condition, which picks the
unsafe browser build.

**Fix:** Pre-bundle the service worker entry point using esbuild with:
```
--platform=neutral --conditions=node --main-fields=module,main
```
This is exactly the same approach as the Cloudflare Worker and Fastly Compute examples.

---

## What Needs to be Done

### 1. Pre-bundle the service worker (required)

```js
// esbuild.config.js (same pattern as cloudflare-worker example)
import { build } from 'esbuild';

await build({
  entryPoints: ['sw.js'],
  bundle: true,
  format: 'esm',        // or 'iife' for classic (non-module) service workers
  outfile: 'dist/sw.js',
  platform: 'neutral',
  conditions: ['node'],
  mainFields: ['module', 'main'],
  target: 'es2022',
});
```

Alternatively, if the deployment system supports it, esbuild can output a classic
(IIFE) bundle to avoid requiring `{ type: 'module' }` in the registration call.

### 2. Install the DOM shim (same as all other platforms)

```js
// sw.js  (before any lit imports)
import 'lit-ssr-edge/install-global-dom-shim.js';
```

The shim uses `??=` throughout, so it never overwrites native Service Worker globals
(`EventTarget`, `Event`, `CustomEvent`) that are already present.

### 3. Write the service worker entry point

The rendering code is **identical** to all other examples. Only the event handling
pattern is different — a `fetch` event instead of an HTTP request handler:

```js
import 'lit-ssr-edge/install-global-dom-shim.js';
import { render, RenderResultReadable } from 'lit-ssr-edge';
import { html as serverHtml } from 'lit-ssr-edge/server-template.js';
import { html } from 'lit';
import './components/my-app.js';

self.addEventListener('fetch', (event) => {
  // Only intercept navigation requests (full HTML page loads)
  if (event.request.mode === 'navigate') {
    event.respondWith(renderPage(event.request));
  }
  // All other requests (JS, CSS, images) fall through to the network
});

async function renderPage(request) {
  const url = new URL(request.url);

  const page = serverHtml`<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8"><title>My App</title></head>
  <body>${html`<my-app path="${url.pathname}"></my-app>`}</body>
</html>`;

  return new Response(
    new RenderResultReadable(render(page)).getStream(),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
```

### 4. Register the service worker in the host page

```html
<script type="module">
  if ('serviceWorker' in navigator) {
    // Module service worker (if serving the bundled ESM directly)
    await navigator.serviceWorker.register('/dist/sw.js', { type: 'module' });

    // — OR — classic service worker (if using IIFE bundle)
    await navigator.serviceWorker.register('/dist/sw.js');
  }
</script>
```

### 5. Decide on a streaming strategy per browser

`ReadableStream` as a `Response` body inside a service worker is **not supported in
Firefox** (as of 2026; a tracking bug is open). For cross-browser compatibility, the
`renderPage` function should detect Firefox and fall back to a buffered response:

```js
async function renderPage(request) {
  const page = serverHtml`...`;
  const result = render(page);

  // Firefox does not support ReadableStream in SW responses
  if (!supportsStreamingResponse()) {
    const html = await collectResult(result);
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  return new Response(
    new RenderResultReadable(result).getStream(),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

function supportsStreamingResponse() {
  // ReadableStream in SW responses requires this to be constructable and transferable
  try {
    new ReadableStream();
    return true;
  } catch {
    return false;
  }
}
```

---

## Public API Changes Required: None

Every public export of lit-ssr-edge is unchanged:

| Export | Service worker usable? | Notes |
|--------|----------------------|-------|
| `render(value)` | ✅ | Unchanged |
| `collectResult(result)` | ✅ | Unchanged |
| `collectResultSync(result)` | ✅ | Unchanged |
| `RenderResultReadable` | ✅ | `.getStream()` returns `ReadableStream` — accepted by SW `Response` |
| `digestForTemplateResult` | ✅ | Uses only `Uint32Array`, `btoa()` — both available |
| `openTemplatePart/closePart/nodeMarker` | ✅ | Pure string utilities |
| `isHydratable` | ✅ | Pure JS |
| `installGlobalDomShim` | ✅ | Uses `??=` — safe to call in SW scope |
| `html` (re-export from lit-html) | ✅ | After bundling with node condition |
| `noChange` / `nothing` | ✅ | Plain Symbol values |
| `html` (server-template) | ✅ | After bundling with node condition |
| `repeat/map/when/...` (directives) | ✅ | Pure functions — no DOM access |

---

## Comparison with Other Supported Platforms

| Aspect | Service Worker | Cloudflare | Fastly | Netlify Edge | Vercel Edge |
|--------|---------------|------------|--------|--------------|-------------|
| Runtime | V8 (browser) | V8 isolate | SpiderMonkey | Deno | V8 isolate |
| Request entry | `fetch` event | `fetch()` handler | `addEventListener('fetch',...)` | `export default async fn` | `export default async fn` |
| Build step | ✅ esbuild required | ✅ esbuild | ✅ esbuild + WASM | ❌ auto | ❌ auto† |
| `node` export condition | via flag | via flag | via flag | native | via flag† |
| `document` global | ❌ (needs shim) | ❌ (needs shim) | ❌ (needs shim) | ❌ (needs shim) | ❌ (needs shim) |
| `customElements` | ❌ (needs shim) | ❌ (needs shim) | ❌ (needs shim) | ❌ (needs shim) | ❌ (needs shim) |
| `ReadableStream` body | ✅ (not Firefox) | ✅ | ✅ | ✅ | ✅ |
| Deployment location | User's browser | Cloudflare edge | Fastly PoP | Netlify edge | Vercel edge |
| HTTPS required | ✅ (or localhost) | N/A | N/A | N/A | N/A |

---

## Notable Service-Worker-Specific Considerations

### Installation scope and `navigate` mode

Service workers control a URL scope. A worker registered at `/` controls all pages.
Only requests with `event.request.mode === 'navigate'` are HTML page navigations;
all others (images, scripts, styles) should generally be passed through to the
network or the cache to avoid re-rendering the page on every asset fetch.

### First-visit limitation

A newly registered service worker only controls pages on the **next navigation**
after `activate`, unless `clients.claim()` is called during activation:

```js
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
```

This is important to communicate to users: the SSR takes effect on the second page
load, not the first.

### Offline fallback opportunity

Unlike server-side edge rendering, service workers can combine SSR with offline
caching. The shell can be pre-cached during `install` and the SSR can run entirely
offline using cached data — a capability no server-side platform can offer.

### `litServerRoot` side-effect from `@lit-labs/ssr-dom-shim`

`@lit-labs/ssr-dom-shim/index.js` sets `globalThis.litServerRoot` as a side effect
when imported. This creates an instance of the shimmed `EventTarget` as the root
event propagation target. In a service worker this is harmless — the property is
only used internally by lit for event path calculation.

### Component isolation between requests

Service workers persist across multiple `fetch` events (until terminated by the
browser). The global `customElements` registry — populated by component imports —
persists for the lifetime of the worker. This is the same model as all server-side
platforms: components are registered once, then used for every request.

The template opcode `WeakMap` cache also persists across requests, which is the
intended behaviour (parse once, render many times).

---

## Summary of Work Required for an Example

To produce a `examples/service-worker/` example matching the style of the other
examples, the following is needed:

1. **`esbuild.config.js`** — same `--platform=neutral --conditions=node` pattern as
   the Cloudflare Worker example.

2. **`sw.js`** — the service worker entry point using the `fetch` event pattern above.

3. **`public/index.html`** — a host page that registers the service worker. Must be
   served over HTTPS or `localhost`.

4. **`components/my-page.js`** — a demo `LitElement`.

5. **`package.json`** — scripts for `build` (esbuild) and `start` (any static HTTP
   server — `npx serve public` works for localhost testing).

6. **`README.md`** — covering the `fetch` event pattern, the pre-bundling requirement,
   the Firefox streaming caveat, the first-visit activation delay, and how to test on
   localhost.

No changes to `lit-ssr-edge`'s public API are needed.
