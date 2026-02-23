# lit-edge

Server-side renderer for Lit web components targeting WinterTC-compatible runtimes.

Runs on Cloudflare Workers (no `nodejs_compat` flag), Fastly Compute, Node.js 18+, Deno, and Bun using only Web Platform APIs — no Node.js dependencies.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Baseline integration tests | ✅ Complete |
| 1 | Baseline performance benchmarks | ✅ Complete |
| 2 | Core rendering engine | ✅ Complete |
| 3 | Hydration support (native digest + markers) | ✅ Complete |
| 4 | Component support (formalise LitElement) | ⏳ Planned |
| 5 | Directive support (formalise all directives) | ⏳ Planned |
| 6 | Optimisation & polish | ⏳ Planned |

**Current:** Phase 3 complete — 122 baseline tests + 51 hydration tests passing (173 total).

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full roadmap and [`docs/PHASE_3_COMPLETE.md`](docs/PHASE_3_COMPLETE.md) for the latest phase summary.

## Usage

```js
import { render, collectResult } from 'lit-edge';
import { html } from 'lit';

const template = html`<div>Hello, ${'World'}!</div>`;
const result = render(template);
const htmlString = await collectResult(result);
```

### Streaming (edge runtime)

```js
import { render, RenderResultReadable } from 'lit-edge';
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

### Server-only templates (full documents, no hydration)

```js
import { render, collectResult } from 'lit-edge';
import { html as serverHtml } from 'lit-edge/server-template.js';
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

- **WinterTC-compatible** — Cloudflare Workers (no `nodejs_compat`), Fastly Compute, Node.js 18+, Deno, Bun
- **Web Platform APIs only** — `ReadableStream`, `TextEncoder`, `btoa`, `fetch()` (no `stream.Readable`, `fs`, `vm`, `Buffer`)
- **Modern JavaScript** — ES modules, ES2026 features
- **Minimal dependencies** — `parse5` and `@parse5/tools` are the only runtime dependencies

## Non-goals

- Full feature parity with `@lit-labs/ssr`
- VM-based isolation (use platform isolation)
- Runtime module resolution (pre-bundle components)
- Legacy Node.js (< 18) or Node.js-specific APIs

## Running tests

```bash
# Baseline integration tests against lit-edge
TEST_IMPL=lit-edge node --test test/integration/baseline/**/*.test.js

# Phase 3 hydration tests
node --test test/unit/*.test.js test/integration/hydration/*.test.js

# Baseline tests against @lit-labs/ssr (reference)
TEST_IMPL=lit-ssr node --test test/integration/baseline/**/*.test.js

# Performance benchmarks
npm run perf:lit-edge
npm run perf:compare benchmark-lit-ssr-*.json benchmark-lit-edge-*.json
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
| [`docs/insight/`](docs/insight/) | Deep research on Lit internals and edge runtimes |

## External references

- [Lit Documentation](https://lit.dev/docs/)
- [@lit-labs/ssr](https://github.com/lit/lit/tree/main/packages/labs/ssr)
- [@lit-labs/ssr-client](https://github.com/lit/lit/tree/main/packages/labs/ssr-client)
- [WinterTC Specification](https://min-common-api.proposal.wintertc.org/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Fastly Compute](https://www.fastly.com/documentation/guides/compute/javascript/)
