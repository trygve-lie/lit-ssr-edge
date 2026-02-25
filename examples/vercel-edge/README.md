# lit-ssr-edge — Vercel Edge Functions example

Server-side renders Lit web components inside a [Vercel Edge Function](https://vercel.com/docs/functions/runtimes/edge) using lit-ssr-edge.

Vercel Edge Functions run on a **V8-isolate based runtime** that implements the
WinterTC Minimum Common Web Platform API. `ReadableStream`, `TextEncoder`,
`fetch()`, `URL`, and `btoa()` are all natively available.

> **⚠ Vercel recommends migrating away from edge to Node.js** (their docs note improved
> performance and reliability on their Fluid compute platform). The edge runtime remains
> fully supported for WinterTC use cases like this one.

## How it works

```
api/render.js                                     (edge function)
  │
  ├─ import 'lit-ssr-edge/install-global-dom-shim.js'   → sets up HTMLElement, customElements
  ├─ import '../components/my-app.js'                    → registers <my-app>
  │
  └─ export default async function handler(request) {   ← Vercel Edge handler
       const stream = new RenderResultReadable(render(page)).getStream();
       return new Response(stream, { headers: { 'Content-Type': 'text/html' } });
     }
     export const config = { runtime: 'edge' };         ← opt-in to edge runtime
```

`vercel.json` rewrites all requests (`/*`) to `/api/render`, so the function
handles every incoming URL.

## Requirements

- [Node.js 18+](https://nodejs.org/)
- [Vercel CLI](https://vercel.com/docs/cli)

Install the Vercel CLI globally if you haven't already:

```bash
npm install -g vercel
```

## Getting started

```bash
npm install
npm start              # runs: vercel dev
```

`vercel dev` starts a local development server (default port **3000**) that
emulates the Vercel production environment. On first run it will ask you to
log in and link the project to a Vercel account; you can press `N` at the
"Link to existing project?" prompt to run locally without deploying.

## Key differences from other platforms

| | Vercel Edge | Netlify Edge | Cloudflare Workers | Fastly Compute |
|---|---|---|---|---|
| **Handler pattern** | `export default async function handler(req)` | `export default async (req, ctx) => ...` | `export default { fetch(req) {} }` | `addEventListener('fetch', ...)` |
| **Runtime** | V8 isolate | Deno | V8 isolate | SpiderMonkey + WASM |
| **Build step** | None (auto-bundled) | None (auto-bundled) | `esbuild.config.js` | `esbuild.config.js` |
| **Opt-in** | `export const config = { runtime: 'edge' }` | — | — | — |
| **Local dev** | `vercel dev` (port 3000) | `netlify dev` (port 8888) | `wrangler dev` (port 8787) | `fastly compute serve` (port 7676) |
| **Config** | `vercel.json` | `netlify.toml` | `wrangler.toml` | `fastly.toml` |

## Bundling and the `document is not defined` issue

Vercel bundles edge functions automatically using an esbuild-based pipeline.
The `node` vs `browser` export condition used during bundling determines which
build of `lit-html` is selected:

- **`node` build** (`lit-html/node/lit-html.js`) — safe for edge environments;
  guards against a missing `document` with a conditional check.
- **`browser` build** (`lit-html/lit-html.js`) — accesses `document` at module
  level without a guard; causes `ReferenceError: document is not defined`.

If you encounter this error, Vercel's bundler is selecting the browser build.
The fix is the same as for Cloudflare Workers: pre-bundle with esbuild yourself
using `--platform=neutral --conditions=node --main-fields=module,main`, then
point Vercel at the pre-bundled output. See the
[`cloudflare-worker` example](../cloudflare-worker/) for the `esbuild.config.js`
pattern.

## Streaming

Vercel's edge runtime accepts `ReadableStream` as a `Response` body:

```js
const stream = new RenderResultReadable(render(page)).getStream();
return new Response(stream, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});
```

Streaming responses can continue for up to 300 seconds after the first byte is
sent (provided the initial response begins within 25 seconds).

## Deploying to Vercel

```bash
# Authenticate (once)
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

## Client-side hydration

To hydrate components on the client, add to your HTML head:

```html
<script type="module">
  import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
  import './components/my-app.js';
</script>
```

The `defer-hydration` attribute on nested components and the `<!--lit-part-->`
markers emitted by lit-ssr-edge are compatible with `@lit-labs/ssr-client`.
