# Phase 2 Complete: Core Rendering Implementation

**Status:** ✅ Complete
**Date:** February 23, 2026
**Implementation:** lit-ssr-edge v1.0.0
**Node Version:** v24.13.0
**Platform:** Linux x64

---

## Overview

Phase 2 implemented the core rendering engine for lit-ssr-edge. Starting from zero source files, this phase produced a complete SSR renderer that passes all 122 baseline integration tests with output byte-for-byte compatible with `@lit-labs/ssr` (after normalization). The implementation uses only Web Platform APIs — no Node.js-specific dependencies.

---

## Deliverables

### ✅ 1. Entry Points

**`src/index.js`**

Main public API:
- `render(value, renderInfo?)` — renders a template to a `RenderResultIterator`
- `collectResult(result)` — collects a `RenderResult` to a string (async)
- `collectResultSync(result)` — collects a `RenderResult` to a string (sync)
- `RenderResultReadable` — Web Streams wrapper for edge runtime responses
- `isHydratable(template)` — utility to detect server-only templates
- Re-exports `html`, `svg`, `noChange`, `nothing` from `lit-html`

**`src/server-template.js`**

Server-only template entry point:
- `html` — server-only template tag (no hydration markers, supports full documents)
- Re-exports `noChange`, `nothing` from `lit-html`

---

### ✅ 2. Core Rendering Engine

**`src/lib/render.js`**

- `render(value, renderInfo?)` — creates a `RenderResultIterator` from a thunked render result
- `renderThunked(value, renderInfo?)` — generates the raw `ThunkedRenderResult` array
- `RenderResultIterator` — flattens thunks, nested arrays, and Promises into a sequential iterable

**`src/lib/render-value.js`**

The heart of the rendering engine. Adapted from `@lit-labs/ssr` to use Web Platform APIs only.

Responsibilities:
- **Opcode generation** — parses lit-html marked template HTML with `parse5`, traverses the AST, and generates a cached opcode list per `TemplateStringsArray`
- **Opcode execution** — walks opcodes to produce a `ThunkedRenderResult` (array of strings and thunks)
- **Value rendering** — handles primitives, `TemplateResult`, iterables, `nothing`/`null`/`undefined`, and directives
- **Attribute rendering** — handles regular, boolean, and property attribute bindings
- **Hydration markers** — emits `<!--lit-part DIGEST-->` and `<!--/lit-part-->` for hydratable templates, `<!--lit-node N-->` before elements with bindings
- **Custom element lifecycle** — drives `custom-element-open/attributes/shadow/close` opcodes

Opcode types handled:
| Opcode | Action |
|--------|--------|
| `text` | Emit static HTML substring |
| `child-part` | Emit a dynamic child value with hydration markers |
| `attribute-part` | Emit a dynamic attribute (regular, boolean, or property) |
| `element-part` | Advance part index (element directives not rendered server-side) |
| `possible-node-marker` | Conditionally emit `<!--lit-node N-->` |
| `custom-element-open` | Instantiate element renderer, set static attributes |
| `custom-element-attributes` | Run `connectedCallback`, emit reflected attributes |
| `custom-element-shadow` | Emit `<template shadowroot>` with shadow content |
| `custom-element-close` | Pop element renderer from stack |
| `slot-element-open/close` | Track slot elements |
| `slotted-element-open/close` | Track slotted children |

---

### ✅ 3. Result Collection

**`src/lib/render-result.js`**

- `collectResult(result)` — async; resolves thunks, nested iterables, and Promises into a final HTML string
- `collectResultSync(result)` — sync; resolves thunks and nested arrays (throws on Promises)

---

### ✅ 4. Web Streams Output

**`src/lib/render-stream.js`**

`RenderResultReadable` — wraps a `RenderResult` in a Web Streams `ReadableStream<Uint8Array>`:
- Uses `TextEncoder` for UTF-8 encoding (no `Buffer`)
- Handles backpressure via the `pull()` controller strategy
- Resolves thunks and nested iterables incrementally
- `cancel()` cleans up pending iterators

Replaces `@lit-labs/ssr`'s `RenderResultReadable` which extends Node's `stream.Readable`. No Node.js APIs used.

**Example usage on edge runtimes:**
```js
import { render, RenderResultReadable } from 'lit-ssr-edge';
import { html } from 'lit';

const result = render(html`<div>Hello</div>`);
return new Response(new RenderResultReadable(result).getStream(), {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});
```

---

### ✅ 5. Server-Only Template Support

**`src/lib/server-template.js`**

- `html` — server-only template tag; sets `_$litServerRenderMode = 1` to suppress hydration markers
- `isHydratable(template)` — returns `false` for server-only templates

Server-only templates:
- Support full document elements (`<!DOCTYPE>`, `<html>`, `<head>`, `<body>`)
- Support raw-text elements (`<title>`, `<textarea>`, non-executable `<script>`)
- Reject event (`@`) and property (`.`) bindings with clear errors
- Can contain regular hydratable templates (which will be hydrated client-side)
- Cannot be nested inside regular hydratable templates

---

### ✅ 6. Element Rendering

**`src/lib/element-renderer.js`**

Base `ElementRenderer` class and `FallbackRenderer`:
- `setAttribute(name, value)` — lowercases name, sets on element, calls `attributeChangedCallback`
- `setProperty(name, value)` — sets property directly on element instance
- `renderAttributes()` — serializes element attributes to an array of strings
- `renderShadow(renderInfo)` — returns `undefined` by default (no shadow root)
- `renderLight(renderInfo)` — returns `undefined` by default (no light DOM)
- `shadowRootOptions` getter — returns `{ mode: 'open' }`

`FallbackRenderer` — used when no matching renderer is registered:
- Stores attributes in a plain object
- Renders them back as attribute strings

**`src/lib/lit-element-renderer.js`**

`LitElementRenderer` — handles `LitElement` subclasses:
- `matchesClass(ctor)` — matches any class with `_$litElement$` flag
- Constructor instantiates the actual element via `customElements.get(tagName)`
- `attributeChangedCallback` — converts attributes to properties via `attributeToProperty`
- `connectedCallback` — calls `willUpdate` and reflects properties to attributes
- `renderShadow` — serializes `elementStyles` as `<style>` tags, then renders `element.render()`
- Patches `LitElement.prototype.createRenderRoot` to avoid browser DOM API calls

---

### ✅ 7. Utilities

**`src/lib/util/escape-html.js`**

Escapes `&`, `<`, `>`, `"`, `'` to their HTML entity equivalents. Used in text content and attribute values to prevent XSS.

**`src/lib/reflected-attributes.js`**

Maps HTML element property names to their reflected attribute names (e.g. `className` → `class`, `colSpan` → `colspan`). Used when rendering property bindings (`.prop=value`) to determine what attribute to write to the HTML output.

---

## Dependencies Added

```json
{
  "dependencies": {
    "parse5": "^7.2.1",
    "@parse5/tools": "^0.5.0"
  }
}
```

Both are pure JavaScript packages with no Node.js-specific dependencies, compatible with all WinterTC-compliant edge runtimes.

---

## Test Results

All 122 baseline integration tests pass with `TEST_IMPL=lit-ssr-edge`:

```
ℹ tests 122
ℹ suites 37
ℹ pass 122
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms ~131ms
```

Additionally, all 11 server-only template tests pass:

```
ℹ tests 11
ℹ suites 4
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### Coverage by test file

| Test File | Tests | Result |
|-----------|-------|--------|
| `template-rendering.test.js` | 19 | ✅ All pass |
| `attribute-binding.test.js` | 21 | ✅ All pass |
| `directives.test.js` | 21 | ✅ All pass |
| `components.test.js` | 20 | ✅ All pass |
| `shadow-dom.test.js` | 11 | ✅ All pass |
| `edge-cases.test.js` | 16 | ✅ All pass |
| `streaming.test.js` | 3 | ✅ All pass |
| `server-only-templates.test.js` | 11 | ✅ All pass |
| **Total** | **122** | **✅ All pass** |

---

## How to Run Tests

```bash
# Run all baseline tests against lit-ssr-edge
TEST_IMPL=lit-ssr-edge node --test test/integration/baseline/**/*.test.js

# Run against @lit-labs/ssr (reference implementation)
TEST_IMPL=lit-ssr node --test test/integration/baseline/**/*.test.js

# Run performance benchmarks
npm run perf:lit-ssr-edge

# Compare with @lit-labs/ssr baseline
npm run perf:compare benchmark-lit-ssr-*.json benchmark-lit-ssr-edge-*.json
```

---

## WinterTC Compatibility

The implementation uses **only Web Platform APIs**:

| API Used | Available In |
|----------|-------------|
| `ReadableStream` | All WinterTC runtimes |
| `TextEncoder` | All WinterTC runtimes |
| `WeakMap` | All JS runtimes |
| `btoa` | All WinterTC runtimes |

**No Node.js APIs used:**
- ❌ `stream.Readable` (replaced by `ReadableStream`)
- ❌ `fs`, `path` (no filesystem access needed)
- ❌ `vm` (no isolation needed; components are pre-bundled)
- ❌ `Buffer` (replaced by `TextEncoder`)
- ❌ `node-fetch` (native `fetch()` used)

---

## Architecture Notes

### Template Caching

Templates are parsed once per unique `TemplateStringsArray` reference and cached in a module-level `WeakMap`. Because template strings are immutable and identical template literals always share the same `strings` object reference, the cache is safe to share across all requests. The `WeakMap` ensures cached entries are garbage-collected if the template strings themselves become unreachable.

### Thunked Rendering

`renderValue` and `renderTemplateResult` return arrays of strings and **thunks** (zero-argument functions returning the next chunk). Thunks allow lazy evaluation — the rendering work for a child template is deferred until the parent's iterator reaches that position. `RenderResultIterator` resolves thunks as it walks the array, maintaining an iterator stack to flatten nested results without recursion.

### Directive Patching

SSR-compatible directives (e.g. `repeat`, `map`, `when`, `classMap`) expose a `render()` method for server rendering instead of the client-side `update()`. The engine patches directive classes on first use via `patchDirectiveResolve` from `lit-html/private-ssr-support.js`, redirecting calls through the SSR path.

---

## Success Criteria

From the architecture document:

- ✅ Basic template tests pass
- ✅ Streaming tests pass
- ✅ Output matches `@lit-labs/ssr` (byte-for-byte after normalization)
- ✅ No Node.js dependencies in runtime code
- ✅ Web Streams `ReadableStream` output for edge runtimes

**Status: ALL CRITERIA MET ✅**

---

## Next Steps

### Phase 3: Hydration Support

The digest algorithm (`digestForTemplateResult`) is currently imported from `@lit-labs/ssr-client` — a dev dependency. Phase 3 should:
- Implement `digestForTemplateResult` natively (DJB2 hash over `strings`)
- Verify digest values match `@lit-labs/ssr-client` exactly
- Confirm client-side hydration works end-to-end with `@lit-labs/ssr-client`

### Phase 4: Component Support (already working — validate further)

Component rendering works in Phase 2 as a bonus, leveraging `LitElementRenderer`. Dedicated Phase 4 work should:
- Validate edge cases (async components, reactive controllers, ElementInternals)
- Add DOM shim independence (currently relies on `@lit-labs/ssr-dom-shim`)
- Test client hydration of server-rendered components

### Phase 5: Directive Support (already working — validate further)

All tested directives pass. Phase 5 should:
- Validate all listed directives (`repeat`, `map`, `join`, `range`, `when`, `choose`, `ifDefined`, `guard`, `classMap`, `styleMap`, `keyed`)
- Add clear errors for unsupported client-only directives (`cache`, `live`, `until`, `ref`, etc.)

### Phase 6: Optimization & Polish

- Profile against Phase 1 baselines; verify within performance targets
- Implement native `digestForTemplateResult` (remove `@lit-labs/ssr-client` runtime dep)
- Add Cloudflare Workers and Fastly Compute example workers
- Complete API documentation

---

## Conclusion

Phase 2 has delivered a fully functional SSR engine for Lit web components that runs on WinterTC-compatible edge runtimes without Node.js dependencies. All 122 baseline tests pass, covering templates, attributes, directives, components, shadow DOM, streaming, server-only templates, and edge cases.

**Phase 2 Complete. Ready for Phase 3: Hydration Support.**
