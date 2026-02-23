# lit-ssr-edge — Fastly Compute example

Server-side renders Lit web components on [Fastly Compute](https://www.fastly.com/products/edge-compute) using lit-ssr-edge.

Fastly Compute runs JavaScript inside a **SpiderMonkey-based WebAssembly runtime**, which implements the WinterTC Minimum Common Web Platform API. lit-ssr-edge uses only those APIs, so no polyfills or compatibility layers are required.

## How it works

```
src/index.js                     (entry point — ESM)
  │
  ├─ import 'lit-ssr-edge/install-global-dom-shim.js'   → sets up HTMLElement, customElements
  ├─ import '../components/my-edge.js'               → registers <my-edge>
  │
  └─ addEventListener('fetch', event => {
       event.respondWith(handleRequest(event));      ← Fastly Compute entry point
     })
     │
     └─ render(serverHtml`...`) → new RenderResultReadable(...).getStream()
        → new Response(stream)  ← ReadableStream passed directly to Response
```

esbuild bundles `src/index.js` into a single `dist/bundle.js`, which
`js-compute-runtime` then compiles to `bin/main.wasm` for deployment.

## Requirements

- [Fastly CLI](https://developer.fastly.com/learning/tools/cli/) (`npm install -g @fastly/cli` or download from Fastly)
- [Node.js 18+](https://nodejs.org/) (for the build pipeline)
- A Fastly account (for deployment; local dev works without one)

## Getting started

```bash
npm install
npm run build          # bundle → compile to WASM
npm start              # local dev server on http://127.0.0.1:7676
npm run deploy         # build + publish to your Fastly service
```

## Key differences from Cloudflare Workers

| | Cloudflare Workers | Fastly Compute |
|---|---|---|
| **Entry point** | `export default { fetch(req) {} }` | `addEventListener('fetch', event => event.respondWith(...))` |
| **Runtime** | V8 isolate | SpiderMonkey + WASM |
| **Build** | esbuild → deploy | esbuild → js-compute-runtime → WASM → deploy |
| **Local dev** | `wrangler dev` (port 8787) | `fastly compute serve` (port 7676) |
| **Config** | `wrangler.toml` | `fastly.toml` |
| **Binding globals** | `env` parameter | `fastly:env` module import |

The **rendering code is identical** — both platforms receive a `Request` and
return a `Response` with a `ReadableStream` body, so the same lit-ssr-edge code
works on both without modification.

## Build pipeline

```
src/index.js (ESM)
     │
     │  esbuild --bundle
     ▼
dist/bundle.js (single-file ESM, all imports inlined)
     │
     │  js-compute-runtime
     ▼
bin/main.wasm (WebAssembly binary — deployed to Fastly)
```

Components and dependencies are inlined at the esbuild step; no dynamic
imports or runtime module resolution happen inside the WASM binary.

## Streaming

Fastly Compute's SpiderMonkey runtime supports `ReadableStream` natively.
lit-ssr-edge's `RenderResultReadable.getStream()` returns a
`ReadableStream<Uint8Array>` which is passed directly to the `Response`
constructor — no conversion or intermediate buffering needed.

```js
const stream = new RenderResultReadable(render(page)).getStream();
return new Response(stream, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});
```

## Fastly-specific features

This example does not use any Fastly-specific APIs (`fastly:` imports),
but your application can use:

```js
import { env } from 'fastly:env';           // environment variables
import { KVStore } from 'fastly:kv-store';  // edge KV storage
import { Logger } from 'fastly:logger';     // structured logging
```

See the [Fastly JavaScript SDK reference](https://js-compute-reference-docs.edgecompute.app/docs/)
for the full list of available modules.

## Client-side hydration

To hydrate components on the client, add to your HTML head:

```html
<script type="module">
  import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
  import './components/my-edge.js';
</script>
```

The `defer-hydration` attribute on nested components and the `<!--lit-part-->`
markers emitted by lit-ssr-edge are compatible with `@lit-labs/ssr-client`'s
hydration algorithm.

## Sources

- [Fastly Compute JavaScript documentation](https://www.fastly.com/documentation/guides/compute/developer-guides/javascript/)
- [Fastly JS Compute SDK reference](https://js-compute-reference-docs.edgecompute.app/docs/)
- [fastly.toml format reference](https://developer.fastly.com/reference/compute/fastly-toml/)
- [WinterTC Minimum Common API](https://min-common-api.proposal.wintertc.org/)
