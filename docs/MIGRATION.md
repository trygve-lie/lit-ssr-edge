# Migrating from @lit-labs/ssr to lit-ssr-edge

This guide covers migrating a project that uses `@lit-labs/ssr` to `lit-ssr-edge`.

---

## Why migrate?

| | `@lit-labs/ssr` | `lit-ssr-edge` |
|---|---|---|
| **Target** | Node.js 14+ | WinterTC (Cloudflare Workers, Fastly, Node.js 18+, Deno, Bun) |
| **Streaming** | `stream.Readable` (Node.js) | `ReadableStream` (Web Streams) |
| **nodejs_compat** | Required on Cloudflare | Not required |
| **Runtime deps** | `node-fetch`, Node core APIs | `parse5`, `@lit-labs/ssr-dom-shim` (pure JS) |
| **Digest** | From `@lit-labs/ssr-client` | Native DJB2 (same algorithm) |
| **Module loader** | `vm` module + `enhanced-resolve` | Pre-bundled components |

---

## Step 1: Install lit-ssr-edge

```bash
npm install lit-ssr-edge
npm uninstall @lit-labs/ssr          # optional — keep it if you also need Node-specific SSR
```

---

## Step 2: Update import paths

### Core rendering

```js
// Before
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { RenderResultReadable } from '@lit-labs/ssr/lib/render-result-readable.js';

// After
import { render, collectResult, RenderResultReadable } from 'lit-ssr-edge';
```

### Server-only templates

```js
// Before
import { html as serverHtml } from '@lit-labs/ssr';

// After
import { html as serverHtml } from 'lit-ssr-edge/server-template.js';
```

### Module loader (removed)

`@lit-labs/ssr` provides a `ModuleLoader` class that executes component code in
isolated `vm` contexts. lit-ssr-edge does not include this — components must be
imported directly (pre-bundled at build time):

```js
// Before
import { ModuleLoader } from '@lit-labs/ssr/lib/module-loader.js';
const loader = new ModuleLoader();
await loader.importModule('./my-component.js', cwd);

// After — just import the component file directly
import './my-component.js'; // registers customElements.define() as a side effect
```

---

## Step 3: Set up the DOM shim

`@lit-labs/ssr` sets up the DOM shim automatically via `install-global-dom-shim.js`
(which it calls internally). With lit-ssr-edge, you set it up explicitly — import it
**before** any component files:

```js
// worker.js, server.js, or any entry point
import 'lit-ssr-edge/install-global-dom-shim.js'; // must be first
import { render } from 'lit-ssr-edge';
import './my-components.js';
```

On **Node.js** with `lit` installed as a dependency, `@lit-labs/ssr-dom-shim` is
already installed as a transitive dependency of `lit-element`, so the shim globals
may already be present. Calling `install-global-dom-shim.js` is still recommended
for explicitness; it uses `??=` internally and is safe to call multiple times.

On **Cloudflare Workers** and other edge runtimes, the shim import is required.

---

## Step 4: Update streaming code

`@lit-labs/ssr`'s `RenderResultReadable` extends Node's `stream.Readable`.
lit-ssr-edge's `RenderResultReadable` uses the Web Streams `ReadableStream` API.

### Cloudflare Workers / Fastly Compute / edge runtimes

```js
// Before (does not work on Cloudflare without nodejs_compat;
//         does not work at all on Fastly Compute)
import { render } from '@lit-labs/ssr';
import { RenderResultReadable } from '@lit-labs/ssr/lib/render-result-readable.js';
const readable = new RenderResultReadable(render(template));
// readable is a Node.js Readable stream — cannot use in edge runtimes

// After (works everywhere — Cloudflare Workers, Fastly Compute, Node.js, Deno, Bun)
import { render, RenderResultReadable } from 'lit-ssr-edge';
const stream = new RenderResultReadable(render(template)).getStream();
return new Response(stream, { headers: { 'Content-Type': 'text/html' } });
```

The entry point differs between Cloudflare and Fastly, but the rendering code is identical:

```js
// Cloudflare Workers
export default {
  fetch(request) {
    const stream = new RenderResultReadable(render(page)).getStream();
    return new Response(stream, { headers: { 'Content-Type': 'text/html' } });
  },
};

// Fastly Compute
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event));
});
async function handleRequest(event) {
  const stream = new RenderResultReadable(render(page)).getStream();
  return new Response(stream, { headers: { 'Content-Type': 'text/html' } });
}
```

### Node.js HTTP server

```js
// Before (Node.js Readable → pipe to ServerResponse)
const readable = new RenderResultReadable(render(template));
readable.pipe(res);

// After (Web Streams → read into ServerResponse)
const stream = new RenderResultReadable(render(template)).getStream();
const reader = stream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  res.write(value); // Uint8Array chunk
}
res.end();

// Or: buffer the whole response (simpler, higher memory)
import { collectResult } from 'lit-ssr-edge';
const html = await collectResult(render(template));
res.end(html);
```

---

## Step 5: Remove vm / ModuleLoader usage

`@lit-labs/ssr` uses Node's `vm` module to execute components in isolated
contexts. lit-ssr-edge does not support this pattern. Instead, bundle your components
at build time:

```js
// esbuild.config.js
import esbuild from 'esbuild';
await esbuild.build({
  entryPoints: ['src/worker.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/worker.js',
  platform: 'browser',          // or 'neutral' for edge workers
});
```

The bundler inlines all imports (including lit-ssr-edge and your component files)
into a single output file. No runtime module resolution is needed.

---

## Step 6: Update directive imports (if needed)

Most directives work identically — they are re-exported from `lit/directives/*`.
The only change is that lit-ssr-edge now throws explicit errors for client-only
directives instead of silently producing wrong output:

| Directive | @lit-labs/ssr | lit-ssr-edge |
|-----------|---------------|----------|
| `repeat`, `map`, `when`, etc. | Works | Works (same output) |
| `classMap` | Works | Works (same output) |
| `cache` | Silent wrong output | Throws with clear error |
| `live` | Silent wrong output | Throws with clear error |
| `until` | Silent empty output | Throws with clear error |
| `asyncAppend/Replace` | Silent empty output | Throws with clear error |
| `ref` | No-op | No-op (same — element renders, callback not invoked) |
| `templateContent` | Throws (`document is not defined`) | Throws with clear error |

```js
// Optional: import from the curated lit-ssr-edge directives entry point
import { repeat, when, classMap, unsafeHTML } from 'lit-ssr-edge/directives/index.js';

// Or continue importing from lit/directives/* directly — both work
import { repeat } from 'lit/directives/repeat.js';
```

---

## Step 7: Remove `renderWithGlobalDomShim` (if used)

`@lit-labs/ssr` exports `renderWithGlobalDomShim()` which automatically installs
the DOM shim before rendering. In lit-ssr-edge, install the shim once at startup
instead:

```js
// Before
import { renderWithGlobalDomShim } from '@lit-labs/ssr/lib/render-with-global-dom-shim.js';
const result = renderWithGlobalDomShim(template);

// After
import 'lit-ssr-edge/install-global-dom-shim.js'; // once at startup
import { render } from 'lit-ssr-edge';
const result = render(template);
```

---

## API mapping table

| `@lit-labs/ssr` | `lit-ssr-edge` | Notes |
|-----------------|------------|-------|
| `import { render } from '@lit-labs/ssr'` | `import { render } from 'lit-ssr-edge'` | Same signature |
| `import { collectResult } from '@lit-labs/ssr/lib/render-result.js'` | `import { collectResult } from 'lit-ssr-edge'` | Same behaviour |
| `import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js'` | `import { collectResultSync } from 'lit-ssr-edge'` | Same behaviour |
| `new RenderResultReadable(result)` then `.pipe(res)` | `new RenderResultReadable(result).getStream()` | Returns `ReadableStream`, not `stream.Readable` |
| `import { html as serverHtml } from '@lit-labs/ssr'` | `import { html as serverHtml } from 'lit-ssr-edge/server-template.js'` | Same template semantics |
| `import { isHydratable } from '@lit-labs/ssr/lib/server-template.js'` | `import { isHydratable } from 'lit-ssr-edge'` | Same function |
| `import { digestForTemplateResult } from '@lit-labs/ssr-client'` | `import { digestForTemplateResult } from 'lit-ssr-edge'` | Same algorithm, native implementation |
| `ModuleLoader` | Not provided | Pre-bundle components instead |
| `installGlobalDomShim()` (internal) | `import 'lit-ssr-edge/install-global-dom-shim.js'` | Must be called explicitly |
| `ElementRenderer` | `import { ElementRenderer } from 'lit-ssr-edge/src/lib/element-renderer.js'` | Custom renderer base class |

---

## Output compatibility

lit-ssr-edge produces **byte-for-byte identical HTML** to `@lit-labs/ssr` (after
whitespace normalisation). The hydration markers, digest values, and shadow DOM
format are all identical, so existing `@lit-labs/ssr-client` hydration code
works without modification.

---

## Checklist

- [ ] Replace `@lit-labs/ssr` import for `render` with `lit-ssr-edge`
- [ ] Replace `@lit-labs/ssr/lib/render-result.js` imports with `lit-ssr-edge`
- [ ] Replace `RenderResultReadable` with lit-ssr-edge's Web Streams version
- [ ] Replace `import { html as serverHtml } from '@lit-labs/ssr'` with `lit-ssr-edge/server-template.js`
- [ ] Add `import 'lit-ssr-edge/install-global-dom-shim.js'` as the first import
- [ ] Remove `ModuleLoader` usage; import components directly and bundle with esbuild
- [ ] Remove `nodejs_compat` from `wrangler.toml` (Cloudflare Workers)
- [ ] Test with `@lit-labs/ssr-client` to confirm hydration still works
