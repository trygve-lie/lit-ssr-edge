# lit-ssr-edge — Bun example

Server-side renders Lit web components using [Bun](https://bun.sh)'s built-in
HTTP server and lit-ssr-edge.

No adapters or polyfills are needed — Bun natively supports the Web Platform
APIs (Request, Response, ReadableStream, TextEncoder) that lit-ssr-edge targets.

## Requirements

- [Bun 1.0+](https://bun.sh)

## Getting started

```bash
bun install
bun start
# Open http://localhost:3000
```

## How it works

```
server.js
  │
  ├─ installGlobalDomShim()                        → sets up HTMLElement, customElements
  ├─ import './components/my-page.js'              → registers <my-page>
  │
  └─ Bun.serve({
       fetch(request) {
         const stream = new RenderResultReadable(
           render(serverHtml`...${html`<my-page>`}...`)
         ).getStream();
         return new Response(stream, { headers });  ← standard Response
       }
     })
```

## Streaming vs buffered output

**Streaming** (recommended for large pages — sends HTML as it is rendered):
```js
const stream = new RenderResultReadable(render(page)).getStream();
return new Response(stream, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});
```

**Buffered** (simpler — waits for full render before sending):
```js
const body = await collectResult(render(page));
return new Response(body, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});
```

## Why no DOM shim side-effect import?

The node-js example uses `import 'lit-ssr-edge/install-global-dom-shim.js'` as
a bare side-effect import. This works fine on Node.js where the module loader
always executes side-effect imports before the rest of the file.

The Bun example calls `installGlobalDomShim()` explicitly instead. This is
an explicit call that is unambiguous about ordering and is safe even when
the file is bundled with a tree-shaking bundler.

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
