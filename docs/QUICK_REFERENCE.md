# Quick Reference Guide

**Purpose:** Fast lookups for the current lit-ssr-edge implementation without reading full phase docs or insight files.

**Last Updated:** Phase 6 Complete + Netlify Edge support confirmed (Feb 2026)

---

## Public API

### Main Entry Point (`src/index.js`)

```javascript
import {
  // Core rendering
  render,               // render(value, renderInfo?) → RenderResultIterator
  collectResult,        // async (result) → string
  collectResultSync,    // (result) → string  [throws on Promises]

  // Streaming (Web Streams)
  RenderResultReadable, // new RenderResultReadable(result).getStream() → ReadableStream<Uint8Array>

  // Hydration
  digestForTemplateResult, // (templateResult) → base64 string
  openTemplatePart,    // (digest) → '<!--lit-part DIGEST-->'
  openPart,            // () → '<!--lit-part-->'
  closePart,           // '<!--/lit-part-->'
  nodeMarker,          // (index) → '<!--lit-node N-->'

  // Template utilities
  isHydratable,        // (templateResult) → boolean

  // DOM shim
  installGlobalDomShim, // (scope?) → void

  // lit-html re-exports
  html, svg, noChange, nothing,
} from 'lit-ssr-edge';
```

### Server-Only Templates (`src/server-template.js`)

```javascript
import { html as serverHtml, noChange, nothing } from 'lit-ssr-edge/server-template.js';

const page = serverHtml`
  <!DOCTYPE html>
  <html lang="en">
    <body>${html`<my-app></my-app>`}</body>
  </html>
`;
```

### Directives (`src/directives/index.js`)

```javascript
import {
  // Full SSR support
  repeat, map, join, range, when, choose, ifDefined, guard,
  unsafeHTML, unsafeSVG, unsafeMathML,
  // Partial SSR support (render() only)
  classMap, styleMap, keyed,
} from 'lit-ssr-edge/directives/index.js';
```

### DOM Shim (`src/install-global-dom-shim.js`)

```javascript
// Import once before any component bundles (Cloudflare Workers, Fastly Compute, Netlify Edge, Vercel Edge, Service Workers, Node.js, Deno, Bun)
import 'lit-ssr-edge/install-global-dom-shim.js';
```

Or call programmatically:

```javascript
import { installGlobalDomShim } from 'lit-ssr-edge';
installGlobalDomShim(); // safe to call multiple times; uses ??= internally
```

---

## Common Patterns

### Render to String

```javascript
import { render, collectResult } from 'lit-ssr-edge';
import { html } from 'lit';

const result = render(html`<div>Hello, ${'World'}!</div>`);
const htmlString = await collectResult(result);
```

### Stream to Response (edge runtime)

```javascript
import { render, RenderResultReadable } from 'lit-ssr-edge';
import { html } from 'lit';

const stream = new RenderResultReadable(render(html`<div>Hello</div>`)).getStream();
return new Response(stream, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
```

### Server-Only Full Document

```javascript
import { render, collectResult } from 'lit-ssr-edge';
import { html as serverHtml } from 'lit-ssr-edge/server-template.js';
import { html } from 'lit';

const page = serverHtml`
  <!DOCTYPE html>
  <html><head><title>App</title></head>
    <body>${html`<my-app></my-app>`}</body>
  </html>
`;
const htmlString = await collectResult(render(page));
```

### Render Components

```javascript
import 'lit-ssr-edge/install-global-dom-shim.js'; // must be first
import { render, collectResult } from 'lit-ssr-edge';
import './my-components-bundle.js';           // registers custom elements
import { html } from 'lit';

const result = await collectResult(render(html`<my-app></my-app>`));
```

---

## Template System

### Template Structure

```javascript
const result = html`<div class=${cls}>${content}</div>`;
// result._$litType$ = 1  (HTML_RESULT)
// result.strings     = ['<div class="', '">', '</div>']  (TemplateStringsArray — immutable, cached)
// result.values      = [cls, content]
```

### Template Cache

Opcodes are parsed once per unique `TemplateStringsArray` reference (module-level `WeakMap`). Safe to share across all requests.

---

## SSR Opcode System

### Full Opcode Type List

| Opcode | Description |
|--------|-------------|
| `text` | Emit static HTML substring |
| `child-part` | Emit a dynamic child value with hydration markers |
| `attribute-part` | Emit a dynamic attribute (regular, boolean, or property) |
| `element-part` | Advance part index; element-level directives (e.g. `ref`) silently skipped |
| `possible-node-marker` | Conditionally emit `<!--lit-node N-->` before bound element |
| `custom-element-open` | Instantiate element renderer; set static attributes |
| `custom-element-attributes` | Run `connectedCallback()`; emit reflected attributes |
| `custom-element-shadow` | Emit `<template shadowroot>` with shadow content |
| `custom-element-close` | Pop element renderer from stack |
| `slot-element-open/close` | Track `<slot>` elements in shadow DOM |
| `slotted-element-open/close` | Track children assigned to slots |

### Opcode Generation Flow

1. `getTemplateHtml(strings)` — inserts lit markers into the raw HTML
2. `parse5.parseFragment(html)` — produces parse5 AST
3. `traverse(ast)` — walk nodes, emit opcodes for markers and custom elements
4. Cache the opcode list in `templateCache` (WeakMap keyed by `TemplateStringsArray`)

---

## Hydration Markers

### Marker Format

```html
<!--lit-part DIGEST-->content<!--/lit-part-->   Template child part (TemplateResult value)
<!--lit-part-->content<!--/lit-part-->           Non-template child part (primitive/iterable)
<!--lit-node N-->                                Before a bound element (N = depth-first index)
<?>                                              Empty expression placeholder (from lit-html)
```

### Digest Algorithm (DJB2, two accumulators)

```javascript
const hashes = new Uint32Array(2).fill(5381);
for (const s of templateResult.strings) {
  for (let i = 0; i < s.length; i++) {
    hashes[i % 2] = (hashes[i % 2] * 33) ^ s.charCodeAt(i);
  }
}
const digest = btoa(String.fromCharCode(...new Uint8Array(hashes.buffer)));
```

Implemented natively in `src/lib/digest.js` — identical to `@lit-labs/ssr-client`.

### Strip Markers (Testing)

```javascript
const strip = (str) =>
  str
    .replace(/<!--lit-part[^>]*-->/g, '')
    .replace(/<!--\/lit-part-->/g, '')
    .replace(/<!--lit-node \d+-->/g, '')
    .replace(/<\?>/g, '');
```

---

## Component Rendering

### LitElement Lifecycle in SSR

| Method | Runs in SSR? |
|--------|-------------|
| `constructor()` | ✅ Yes |
| `willUpdate(changedProperties)` | ✅ Yes |
| `update(changedProperties)` | ✅ Yes (attribute reflection only) |
| `render()` | ✅ Yes |
| `connectedCallback()` | ❌ No |
| `firstUpdated()` / `updated()` | ❌ No |
| Event handlers | ❌ No |

### Declarative Shadow DOM Output

```html
<my-element defer-hydration>
  <template shadowroot="open" shadowrootmode="open">
    <style>:host { display: block; }</style>
    <!--lit-part DIGEST-->
    <div>Content</div>
    <!--/lit-part-->
  </template>
  <!-- light DOM / slotted content here -->
</my-element>
```

- **`defer-hydration`** is added to nested components only (not top-level)
- **Styles** appear as `<style>` inside `<template shadowroot>` before shadow content
- **`delegatesFocus: true`** adds `shadowrootdelegatesfocus` attribute to `<template>`

### Property Bindings in SSR

- **Attribute bindings** (`name="value"`) → converted by LitElement's type converter → reliable content
- **Property bindings** (`.prop=${val}`) → call `setProperty()` on element instance; only reflected properties appear as HTML attributes; non-reflected properties may not affect shadow content

### ElementInternals / ARIA

If a component calls `attachInternals()` and sets `ariaLabel`, `ariaPressed`, etc. in `willUpdate()`, those values are reflected to HTML attributes:

```html
<my-button aria-label="Close" hydrate-internals-aria-label="Close">
```

---

## Directives

### Supported Directive Matrix

| Directive | Support | SSR output notes |
|-----------|---------|-----------------|
| `repeat` | ✅ Full | List items rendered normally |
| `map` | ✅ Full | Transforms iterable items |
| `join` | ✅ Full | Items separated by separator value |
| `range` | ✅ Full | Integer sequence |
| `when` | ✅ Full | One of two templates |
| `choose` | ✅ Full | Multi-case conditional |
| `ifDefined` | ✅ Full | Attribute omitted when `undefined` or `null` |
| `guard` | ✅ Full | Factory always called in SSR (no memoization) |
| `unsafeHTML` | ✅ Full | Raw HTML injected as-is |
| `unsafeSVG` | ✅ Full | Raw SVG injected as-is |
| `unsafeMathML` | ✅ Full | Raw MathML injected as-is |
| `classMap` | ⚠️ Partial | Format: `" active visible "` (leading/trailing spaces) |
| `styleMap` | ⚠️ Partial | Format: `"color:red;font-size:16px;"` (compact, no spaces) |
| `keyed` | ⚠️ Partial | Value rendered normally; key ignored in SSR |
| `ref` | Element-part | Silent no-op; element renders, callback not invoked |
| `cache` | ❌ Throws | Clear error message |
| `live` | ❌ Throws | Clear error message |
| `until` | ❌ Throws | Clear error message |
| `asyncAppend` | ❌ Throws | Clear error message |
| `asyncReplace` | ❌ Throws | Clear error message |
| `templateContent` | ❌ Throws | Clear error message |

### Directive Mechanism

lit-ssr-edge patches directive classes at first use to call `render()` instead of `update()`:

```javascript
// In src/lib/render-value.js
patchDirectiveResolve(directiveCtor, ssrResolve);
// ssrResolve calls this.render(...values) on the directive instance
```

Implemented in `src/lib/directives-validation.js` — client-only directives are detected by constructor reference equality (not class name, which is minified).

---

## Server-Only Templates

### Key Differences

| Feature | Regular `html` | Server-only `html` |
|---------|---------------|-------------------|
| Hydration markers | ✅ Yes | ❌ No |
| Full document tags (`<!DOCTYPE>`, `<html>`) | ❌ No | ✅ Yes |
| Event bindings (`@click`) | ✅ Yes | ❌ Throws |
| Property bindings (`.prop`) | ✅ Yes | ❌ Throws |
| Can contain regular templates | N/A | ✅ Yes (they hydrate) |
| Can be nested inside regular templates | ✅ N/A | ❌ Throws |

### Import

```javascript
// lit-ssr-edge (correct)
import { html as serverHtml } from 'lit-ssr-edge/server-template.js';

// NOT: import { html as serverHtml } from '@lit-labs/ssr'; // ← old reference
```

---

## DOM Shim

### When Needed

| Runtime | Needs shim? |
|---------|------------|
| Cloudflare Workers | ✅ Yes — no DOM globals |
| Fastly Compute | ✅ Yes — no DOM globals |
| Netlify Edge Functions | ✅ Yes — Deno has no browser DOM globals |
| Vercel Edge Functions | ✅ Yes — V8 edge runtime has no browser DOM globals |
| Browser Service Workers | ✅ Yes — no DOM globals in SW scope |
| Node.js 18+ | ✅ Yes (auto-installed by lit-element as transitive dep) |
| Deno / Bun | ✅ Yes |
| Browser | ❌ No |

### Installed Globals

`installGlobalDomShim()` sets these via `??=` (idempotent):

```
HTMLElement, Element, Event, CustomEvent, EventTarget, CSSStyleSheet, customElements
```

Source: `@lit-labs/ssr-dom-shim` (pure JS, WinterTC-compatible, runtime dependency of lit-ssr-edge).

---

## WinterTC API Allowlist

### Allowed (use freely)

```
ReadableStream, WritableStream, TransformStream
TextEncoder, TextDecoder
fetch(), Request, Response, Headers
URL, URLSearchParams
AbortController, AbortSignal
btoa(), atob()
setTimeout, queueMicrotask
WeakMap, WeakSet, WeakRef
Modern JavaScript (ES2026 features)
```

### Forbidden (no Node.js APIs)

```
stream.Readable, stream.Writable  →  use ReadableStream
Buffer                            →  use TextEncoder / Uint8Array
fs, path                          →  no filesystem; pre-bundle components
vm                                →  not needed; use platform isolation
process, __dirname, __filename    →  not available
require()                         →  ESM only
```

---

## Implementation Status

| Phase | Description | Status | Tests |
|-------|-------------|--------|-------|
| 0 | Baseline integration test suite | ✅ Complete | 122 |
| 1 | Baseline performance benchmarks | ✅ Complete | 26 benchmarks |
| 2 | Core rendering engine | ✅ Complete | — |
| 3 | Hydration support (native digest + markers) | ✅ Complete | 51 |
| 4 | Component support (DOM shim, ElementInternals) | ✅ Complete | 53 |
| 5 | Directive support (validation, public entry point) | ✅ Complete | 65 |
| 6 | Optimisation & polish (8 KB streaming, examples, migration guide) | ✅ Complete | 14 |

**Total tests passing: 305**

**Confirmed platforms:** Cloudflare Workers, Fastly Compute, Netlify Edge Functions, Vercel Edge Functions, browser Service Workers, Node.js 18+, Deno, Bun

---

## Testing Patterns

### Baseline Test (renderer abstraction)

```javascript
import { createRenderer, stripHydrationMarkers } from '../../helpers/renderer.js';
import { assertHTMLEqual } from '../../helpers/html-compare.js';

const renderer = createRenderer(); // TEST_IMPL env var: 'lit-ssr-edge' or 'lit-ssr'
const result = await renderer.renderToString(template);
const stripped = stripHydrationMarkers(result);
assertHTMLEqual(stripped, '<div>Expected</div>');
```

### Phase 3–5 Direct Test

```javascript
import { render, collectResult } from '../../../src/index.js';

const renderToString = async (t) => collectResult(render(t));
const strip = (str) =>
  str.replace(/<!--lit-part[^>]*-->/g, '')
     .replace(/<!--\/lit-part-->/g, '')
     .replace(/<!--lit-node \d+-->/g, '')
     .replace(/<\?>/g, '');
```

### Run Tests

```bash
# Baseline (122 tests, cross-implementation)
TEST_IMPL=lit-ssr-edge node --test test/integration/baseline/**/*.test.js
TEST_IMPL=lit-ssr  node --test test/integration/baseline/**/*.test.js

# Phase 3 — hydration
node --test test/unit/*.test.js test/integration/hydration/*.test.js

# Phase 4 — components
node --test test/integration/components/*.test.js

# Phase 5 — directives
node --test test/integration/directives/*.test.js

# Performance
npm run perf:lit-ssr-edge
npm run perf:compare benchmark-lit-ssr-*.json benchmark-lit-ssr-edge-*.json
```

---

## Performance Targets (from Phase 1)

| Tier | Operations | Target |
|------|-----------|--------|
| 1 — Critical | Simple text, interpolation, static attrs | Match or exceed baseline |
| 2 — Important | Dynamic attrs, small lists, directives | < 1.5× slower |
| 3 — Acceptable | Medium/large lists, components, complex | < 2× slower |

**Full baseline results:** `docs/PHASE_1_COMPLETE.md`

---

## File Index

| Question | Read |
|----------|------|
| Public API reference | `src/index.js` |
| Directive entry point | `src/directives/index.js` |
| Core rendering engine | `src/lib/render-value.js` |
| Hydration digest | `src/lib/digest.js` |
| Hydration markers | `src/lib/markers.js` |
| DOM shim | `src/lib/dom-shim.js` |
| LitElement renderer | `src/lib/lit-element-renderer.js` |
| Directive validation | `src/lib/directives-validation.js` |
| Template system internals | `docs/insight/lit-html-core.md` |
| SSR opcode architecture | `docs/insight/lit-ssr-internals.md` |
| Hydration algorithm | `docs/insight/lit-hydration.md` |
| Component lifecycle | `docs/insight/lit-reactive-element.md` |
| Directives internals | `docs/insight/lit-directives.md` |
| Edge runtimes / WinterTC | `docs/insight/edge-runtimes.md` |
| Node.js API replacements | `docs/insight/node-dependencies.md` |
| Testing strategy | `docs/STRATEGY_TESTING.md` |
| Architecture / decisions | `docs/ARCHITECTURE.md` |
