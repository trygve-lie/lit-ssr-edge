# lit-ssr-edge — Hono + Service Worker example

Demonstrates a **progressive SSR handoff**: the Node.js server handles the first
page load, then a service worker takes over and all subsequent navigations are
rendered locally in the browser — without ever hitting the server again.

```
First visit
  browser → Node.js server (Hono + lit-ssr-edge) → SSR HTML + hydration

After service worker activates
  browser → Service Worker (Hono + lit-ssr-edge, in-browser) → SSR HTML + hydration
                                ↑ server not involved
```

## How it works

`src/app.js` is a single Hono app that is used in **two places**:

| Context | Entry point | How `app.fetch` is called |
|---------|-------------|--------------------------|
| Node.js server | `server.js` | `serve({ fetch: app.fetch })` |
| Browser service worker | `src/sw.js` | `event.respondWith(app.fetch(event.request))` |

Both produce identical SSR HTML. The `rendered-by` attribute on `<my-app>` and
the `X-Rendered-By` response header show which context rendered each page.

```
src/
├── app.js      ← Hono SSR app (shared — imported by server.js AND src/sw.js)
├── sw.js       ← SW lifecycle + delegates all navigate requests to app.js
└── client.js   ← Hydration entry: ssr-client support then component definition
components/
└── my-app.js   ← LitElement with nav links and rendered-by indicator
public/          ← Built output (served as static files)
├── sw.js       ← Bundled SW (Hono + lit-ssr-edge + component, ~275 KB)
└── client.js   ← Bundled hydration bundle (~24 KB)
```

## Requirements

- [Node.js 18+](https://nodejs.org/)
- A browser that supports module service workers (Chrome 91+, Edge 91+, Safari 15+)

## Getting started

```bash
npm install
npm start        # builds both bundles, then starts the server
# Open http://localhost:3000
```

`npm run build` can be run separately to rebuild the bundles without restarting
the server.

## What to observe

1. **First load** — navigate to `http://localhost:3000`. The badge shows
   **☁️ server** and the `X-Rendered-By: server` response header is visible in
   DevTools → Network.

2. **SW installs** — open DevTools → Application → Service Workers. The SW
   appears as *active and running* within a few seconds.

3. **Navigate between pages** — click Home / About / Contact. The badge now shows
   **🔥 service worker** and the Network tab shows requests as
   *"(from ServiceWorker)"* — no server round-trip.

4. **Hydration** — the components are fully interactive on the client via
   `@lit-labs/ssr-client`. Lit attaches to the server-rendered shadow DOM without
   re-rendering it.

## Key configuration points

**Two esbuild configs, two different platform flags:**

```
esbuild.sw.js     --platform=neutral --conditions=node
                  Picks lit-html's SSR-safe node build (no document access).

esbuild.client.js --platform=browser
                  Picks lit-html's browser build for client-side hydration.
```

**Import order in `src/client.js`:**

```js
// 1. Hydration support MUST come before the component definition
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';

// 2. Component definition triggers hydration of the SSR shadow root
import '../components/my-app.js';
```

**`installGlobalDomShim()` called explicitly** in `src/app.js` so that esbuild
minification cannot tree-shake it away when building the SW bundle.

**`src/sw.js` intercepts navigate requests only** — asset requests (client.js,
sw.js, images, etc.) fall through to the network, so the server continues
serving them.

## Client-side hydration

`@lit-labs/ssr-client/lit-element-hydrate-support.js` patches LitElement so that
when the component is defined on the client it attaches to the existing
server-rendered declarative shadow root instead of creating a new one. The
`defer-hydration` attribute on nested components and the `<!--lit-part-->`
markers in the SSR output coordinate the handoff.
