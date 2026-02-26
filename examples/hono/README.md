# lit-ssr-edge — Hono example

Server-side renders Lit web components inside a [Hono](https://hono.dev)
application using lit-ssr-edge.

Hono is built on the same Web Platform standards as WinterTC, targets the same
runtimes (Cloudflare Workers, Fastly Compute, Bun, Deno, Node.js, Netlify,
Vercel), and uses the same `Request`/`Response` model. lit-ssr-edge integrates
with zero adapter code: `RenderResultReadable.getStream()` returns a
`ReadableStream<Uint8Array>` that is passed directly to `new Response()`.

## How it works

```
src/app.js  (runtime-agnostic Hono app)
  │
  ├─ installGlobalDomShim()                        → sets up HTMLElement, customElements
  ├─ import '../components/my-page.js'             → registers <my-page>
  │
  └─ app.get('*', (c) => {                         ← Hono route handler
       const stream = new RenderResultReadable(
         render(serverHtml`...${html`<my-page>`}...`)
       ).getStream();
       return new Response(stream, { headers });   ← standard Response
     })
```

`server.js` is the only Node.js-specific file. Swap it for `export default app`
(Cloudflare Workers / Bun / Deno) or any other runtime entry point without
touching `src/app.js`.

## Requirements

- [Node.js 18+](https://nodejs.org/)

## Getting started

```bash
npm install
npm start
# Open http://localhost:3000
```

## Key configuration points

**`installGlobalDomShim()`** — called explicitly at the top of `src/app.js`
(not via a bare side-effect import) so minification cannot tree-shake the call
away when bundling for edge runtimes.

**Streaming** — `RenderResultReadable.getStream()` returns a
`ReadableStream<Uint8Array>`. Hono accepts this directly as a `Response` body
on all runtimes.

## Deploying to other runtimes

Because `src/app.js` only uses Web Platform APIs and exports a standard Hono
app, the same file works everywhere Hono runs.

**Cloudflare Workers** — bundle with esbuild (`--platform=neutral
--conditions=node --main-fields=module,main`) and export the app:

```js
// worker.js
import app from './src/app.js';
export default app;
```

**Bun**:
```js
// index.js
import app from './src/app.js';
export default app;
```

**Deno**:
```js
import app from './src/app.js';
Deno.serve(app.fetch);
```

**Fastly Compute** — bundle with esbuild and wrap in the Fastly event model:
```js
import app from './src/app.js';
addEventListener('fetch', (event) => event.respondWith(app.fetch(event.request)));
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
