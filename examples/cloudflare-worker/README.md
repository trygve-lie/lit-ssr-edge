# lit-ssr-edge — Cloudflare Workers example

Server-side renders Lit web components on Cloudflare Workers using lit-ssr-edge.

**No `nodejs_compat` flag required.** lit-ssr-edge uses only Web Platform APIs.

## How it works

```
worker.js                        (entry point)
  │
  ├─ import 'lit-ssr-edge/install-global-dom-shim.js'   → sets up HTMLElement, customElements
  ├─ import './components/my-app.js'                 → registers <my-app>
  │
  └─ fetch(request) → render(serverHtml`...`) → new Response(stream)
```

The outer document shell uses a **server-only template** (`serverHtml`) — no
hydration markers in the `<html>`, `<head>`, or `<body>` tags. The `<my-app>`
component inside uses a regular `html` template, which gets hydration markers
so the Lit client can attach and handle updates.

## Requirements

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [esbuild](https://esbuild.github.io/) (or another bundler)

## Getting started

```bash
npm install
npm run dev       # local development server on http://localhost:8787
npm run deploy    # deploy to your Cloudflare account
```

## Key configuration points

**`wrangler.toml`** — no `nodejs_compat` flag:
```toml
name = "lit-ssr-edge-example"
main = "dist/worker.js"
compatibility_date = "2024-09-23"
# No compatibility_flags = ["nodejs_compat"] needed!
```

**`worker.js`** — DOM shim must be the first import:
```js
import 'lit-ssr-edge/install-global-dom-shim.js';  // must be first
import { render, RenderResultReadable } from 'lit-ssr-edge';
import './components/my-app.js';
```

**`--platform=neutral --conditions=node` in the build command** — `lit-html`'s package exports map lists the `browser` key before the `node` key. With `--platform=browser`, esbuild includes `browser` in its active conditions set, so the `browser` entry wins regardless of `--conditions=node`. That build contains `const l = document` at module level, which throws `ReferenceError: document is not defined` in the Workers runtime (which has no DOM). Using `--platform=neutral` removes `browser` from the conditions set entirely, letting `--conditions=node` take effect and resolving `lit-html` to its SSR-safe `node/lit-html.js` build. `--platform=neutral` also avoids injecting Node.js built-in shims that would not be available in the Workers runtime.

**Component loading** — components are bundled at build time (esbuild/rollup),
not resolved at runtime. Import your component files and they will be inlined
into `dist/worker.js` by the bundler.

## Streaming

lit-ssr-edge uses `ReadableStream` for output, which passes directly to the
`Response` constructor — no buffering, no conversion:

```js
const stream = new RenderResultReadable(render(page)).getStream();
return new Response(stream, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});
```

Output is buffered internally in 8 KB chunks (configurable) to reduce
ReadableStream overhead while preserving low time-to-first-byte.

## Client-side hydration

To hydrate components on the client, add to your HTML head:

```html
<script type="module">
  import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
  import './components/my-app.js';
</script>
```

Then use `hydrate()` from `@lit-labs/ssr-client` or let LitElement handle it
automatically via the `defer-hydration` attribute that lit-ssr-edge emits.
