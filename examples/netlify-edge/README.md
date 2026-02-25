# lit-ssr-edge — Netlify Edge Functions example

Server-side renders Lit web components inside a [Netlify Edge Function](https://docs.netlify.com/build/edge-functions/overview/) using lit-ssr-edge.

Netlify Edge Functions run on **Deno**, a WinterTC-compatible runtime. No custom
build step is required — Netlify bundles npm dependencies automatically.

## How it works

```
netlify/edge-functions/render.js          (edge function entry point)
  │
  ├─ import 'lit-ssr-edge/install-global-dom-shim.js'   → sets up HTMLElement, customElements
  ├─ import '../../components/my-site.js'               → registers <my-site>
  │
  └─ export default async (request, context) => {       ← Netlify Edge handler pattern
       const stream = new RenderResultReadable(render(page)).getStream();
       return new Response(stream, { headers: { 'Content-Type': 'text/html' } });
     }
```

Routing is declared either in `netlify.toml` or inline via `export const config`
inside the function file. This example uses both for illustration.

## Requirements

- [Node.js 18+](https://nodejs.org/) (for npm install)
- [Netlify CLI](https://docs.netlify.com/netlify-cli/get-started/)

Install the Netlify CLI globally if you haven't already:

```bash
npm install -g netlify-cli
```

## Getting started

```bash
npm install
npm start              # runs: netlify dev
```

`netlify dev` starts a local development server (default port **8888**) that
emulates the Netlify production environment, including edge functions.
Changes to function code are picked up automatically on page refresh.

## Key differences from Cloudflare Workers and Fastly Compute

| | Netlify Edge | Cloudflare Workers | Fastly Compute |
|---|---|---|---|
| **Handler pattern** | `export default async (req, ctx) => Response` | `export default { fetch(req) {} }` | `addEventListener('fetch', ...)` |
| **Runtime** | Deno | V8 isolate | SpiderMonkey + WASM |
| **Build step** | None (auto-bundled) | esbuild → deploy | esbuild → WASM → deploy |
| **Local dev** | `netlify dev` (port 8888) | `wrangler dev` (port 8787) | `fastly compute serve` (port 7676) |
| **Config** | `netlify.toml` | `wrangler.toml` | `fastly.toml` |
| **esbuild config** | Not needed | `esbuild.config.js` | `esbuild.config.js` |

The **rendering code** using lit-ssr-edge is identical across all platforms.

## Why no build step?

Netlify's bundler handles npm packages automatically for edge functions. Deno
(the runtime) also natively understands the `node` export condition in
package.json, so `lit-html` resolves to its SSR-safe build without any extra
bundler flags. This avoids the `ReferenceError: document is not defined` issue
that requires `--platform=neutral --conditions=node` on Cloudflare and Fastly.

## Why no `document is not defined` error?

Deno resolves npm packages using the `node` condition from `package.json`
exports automatically. `lit-html`'s `node` build guards against a missing
`document` with:

```js
const l = void 0 === globalThis.document
  ? { createTreeWalker: () => ({}) }
  : document;
```

So even though Deno has no browser DOM, `lit-html` initialises safely without
the `document` stub. The `install-global-dom-shim.js` import is still needed
to provide `HTMLElement`, `customElements`, and `CSSStyleSheet` for
LitElement component instantiation.

## Streaming

Deno's fetch API accepts `ReadableStream` as a `Response` body natively:

```js
const stream = new RenderResultReadable(render(page)).getStream();
return new Response(stream, { headers: { 'Content-Type': 'text/html' } });
```

## Deploying to Netlify

```bash
# Authenticate with Netlify (once)
netlify login

# Create a new Netlify site linked to this directory (once)
netlify init

# Deploy
netlify deploy --prod
```

## Client-side hydration

To hydrate components on the client, add to your HTML head:

```html
<script type="module">
  import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
  import './components/my-site.js';
</script>
```

The `defer-hydration` attribute on nested components and the `<!--lit-part-->`
markers emitted by lit-ssr-edge are compatible with `@lit-labs/ssr-client`'s
hydration algorithm.
