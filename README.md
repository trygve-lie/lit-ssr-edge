# lit-ssr-edge

Server-side renderer for Lit web components targeting WinterTC-compatible runtimes.

Runs on Cloudflare Workers (no `nodejs_compat` flag), Fastly Compute, Node.js 18+, Deno, and Bun using only Web Platform APIs — no Node.js dependencies.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Baseline integration tests | ✅ Complete |
| 1 | Baseline performance benchmarks | ✅ Complete |
| 2 | Core rendering engine | ✅ Complete |
| 3 | Hydration support (native digest + markers) | ✅ Complete |
| 4 | Component support (DOM shim, ElementInternals, full test suite) | ✅ Complete |
| 5 | Directive support (validation module, public entry point, 65 tests) | ✅ Complete |
| 6 | Optimisation (8 KB streaming), examples, migration guide | ✅ Complete |

**Current:** All 6 phases complete — 305 tests passing, 0 failing.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full roadmap and [`docs/PHASE_6_COMPLETE.md`](docs/PHASE_6_COMPLETE.md) for the final phase summary.

## Usage

```js
import { render, collectResult } from 'lit-ssr-edge';
import { html } from 'lit';

const template = html`<div>Hello, ${'World'}!</div>`;
const result = render(template);
const htmlString = await collectResult(result);
```

### Streaming (edge runtime)

```js
import { render, RenderResultReadable } from 'lit-ssr-edge';
import { html } from 'lit';

export default {
  fetch() {
    const template = html`<div>Hello from the edge</div>`;
    const stream = new RenderResultReadable(render(template)).getStream();
    return new Response(stream, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
};
```

### Rendering Lit components (edge runtime setup)

On runtimes without browser DOM globals (Cloudflare Workers, Fastly Compute, Node.js, Deno, Bun), import the DOM shim before any component bundles:

```js
// worker.js
import 'lit-ssr-edge/install-global-dom-shim.js';  // sets up HTMLElement, customElements, etc.
import { render, RenderResultReadable } from 'lit-ssr-edge';
import './my-components-bundle.js';             // registers custom elements
import { html } from 'lit';

export default {
  fetch() {
    const stream = new RenderResultReadable(
      render(html`<my-app></my-app>`)
    ).getStream();
    return new Response(stream, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
};
```

### Server-only templates (full documents, no hydration)

```js
import { render, collectResult } from 'lit-ssr-edge';
import { html as serverHtml } from 'lit-ssr-edge/server-template.js';
import { html } from 'lit';

const page = serverHtml`
  <!DOCTYPE html>
  <html lang="en">
    <head><title>My App</title></head>
    <body>${html`<my-app></my-app>`}</body>
  </html>
`;

const htmlString = await collectResult(render(page));
```

## Goals

- **WinterTC-compatible** — Cloudflare Workers (no `nodejs_compat`), Fastly Compute, Netlify Edge Functions, Node.js 18+, Deno, Bun
- **Web Platform APIs only** — `ReadableStream`, `TextEncoder`, `btoa`, `fetch()` (no `stream.Readable`, `fs`, `vm`, `Buffer`)
- **Modern JavaScript** — ES modules, ES2026 features
- **Minimal dependencies** — `parse5`, `@parse5/tools`, `@lit-labs/ssr-dom-shim` are the only runtime dependencies

## Non-goals

- Full feature parity with `@lit-labs/ssr`
- VM-based isolation (use platform isolation)
- Runtime module resolution (pre-bundle components)
- Legacy Node.js (< 18) or Node.js-specific APIs

## Running tests

```bash
# Run everything: baseline cross-check + full lit-ssr-edge suite (427 tests total)
npm test

# Baseline tests against @lit-labs/ssr only (122 tests)
npm run test:baseline

# Full lit-ssr-edge suite only (305 tests)
npm run test:lit-ssr-edge

# Performance benchmarks
npm run perf:lit-ssr-edge
npm run perf:compare benchmark-lit-ssr-*.json benchmark-lit-ssr-edge-*.json
```

## Documentation

| Document | Purpose |
|----------|---------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Full architecture, rendering pipeline, decision points |
| [`docs/STRATEGY_TESTING.md`](docs/STRATEGY_TESTING.md) | Testing strategy and patterns |
| [`docs/PHASE_0_ALIGNMENT.md`](docs/PHASE_0_ALIGNMENT.md) | Phase 0 — baseline test suite |
| [`docs/PHASE_1_COMPLETE.md`](docs/PHASE_1_COMPLETE.md) | Phase 1 — performance baselines |
| [`docs/PHASE_2_COMPLETE.md`](docs/PHASE_2_COMPLETE.md) | Phase 2 — core rendering engine |
| [`docs/PHASE_3_COMPLETE.md`](docs/PHASE_3_COMPLETE.md) | Phase 3 — hydration support |
| [`docs/PHASE_4_COMPLETE.md`](docs/PHASE_4_COMPLETE.md) | Phase 4 — component support |
| [`docs/PHASE_5_COMPLETE.md`](docs/PHASE_5_COMPLETE.md) | Phase 5 — directive support |
| [`docs/PHASE_6_COMPLETE.md`](docs/PHASE_6_COMPLETE.md) | Phase 6 — optimisation & polish |
| [`docs/MIGRATION.md`](docs/MIGRATION.md) | Migrating from @lit-labs/ssr |
| [`docs/QUICK_REFERENCE.md`](docs/QUICK_REFERENCE.md) | Fast lookup for common patterns and API |
| [`docs/insight/`](docs/insight/) | Deep research on Lit internals and edge runtimes |

## External references

- [Lit Documentation](https://lit.dev/docs/)
- [@lit-labs/ssr](https://github.com/lit/lit/tree/main/packages/labs/ssr)
- [@lit-labs/ssr-client](https://github.com/lit/lit/tree/main/packages/labs/ssr-client)
- [WinterTC Specification](https://min-common-api.proposal.wintertc.org/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Fastly Compute](https://www.fastly.com/documentation/guides/compute/javascript/)

## Examples

| Example | Platform | Location |
|---------|----------|----------|
| Cloudflare Worker (streaming, no nodejs_compat) | Cloudflare Workers | [`examples/cloudflare-worker/`](examples/cloudflare-worker/) |
| Fastly Compute (SpiderMonkey + WASM) | Fastly Compute | [`examples/fastly-compute/`](examples/fastly-compute/) |
| Netlify Edge Functions (Deno, no build step) | Netlify Edge | [`examples/netlify-edge/`](examples/netlify-edge/) |
| Vercel Edge Functions (V8 isolate) | Vercel Edge | [`examples/vercel-edge/`](examples/vercel-edge/) |
| Browser Service Worker (no server required) | Browser SW | [`examples/service-worker/`](examples/service-worker/) |
| Node.js HTTP server (streaming + buffered) | Node.js 18+ | [`examples/node-js/`](examples/node-js/) |

## Migrating from @lit-labs/ssr

See [`docs/MIGRATION.md`](docs/MIGRATION.md) for a complete step-by-step guide including an API mapping table and migration checklist.
