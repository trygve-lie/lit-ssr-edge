# lit-ssr-edge — Deno example

Server-side renders Lit web components using [Deno](https://deno.com)'s
built-in HTTP server and lit-ssr-edge.

No adapters or polyfills are needed — Deno natively supports the Web Platform
APIs (Request, Response, ReadableStream, TextEncoder) that lit-ssr-edge targets.

## Requirements

- [Deno 2.0+](https://deno.com)

## Getting started

```bash
deno task start
# Open http://localhost:3000
```

Deno resolves and caches all packages automatically via the `npm:` specifiers
in `deno.json`. No separate install step is required.

## How it works

```
server.js
  │
  ├─ import 'lit-ssr-edge/install-global-dom-shim.js'  → sets up HTMLElement, customElements
  ├─ import './components/my-page.js'                  → registers <my-page>
  │
  └─ Deno.serve({ port, onListen }, (request) => {
       const stream = new RenderResultReadable(
         render(serverHtml`...${html`<my-page>`}...`)
       ).getStream();
       return new Response(stream, { headers });        ← standard Response
     })
```

## deno.json

`deno.json` configures two things:

**`imports`** — an import map that resolves bare specifiers to `npm:` URLs.
Deno downloads and caches the packages on first run; no install step needed.

```json
{
  "imports": {
    "lit": "npm:lit@*",
    "lit/": "npm:lit@*/",
    "lit-ssr-edge": "npm:lit-ssr-edge@*",
    "lit-ssr-edge/": "npm:lit-ssr-edge@*/"
  }
}
```

**`tasks`** — Deno's equivalent of npm scripts. `deno task start` runs the
server with the minimum required permissions.

## Permissions

`Deno.serve` and `Deno.env.get` require explicit permission flags:

| Flag | Reason |
|------|--------|
| `--allow-env` | Read the `PORT` environment variable via `Deno.env.get()` |
| `--allow-net` | Start the HTTP server and accept connections |

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
