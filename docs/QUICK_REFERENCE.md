# Quick Reference Guide for Agents

**Purpose:** Fast lookups for common questions without reading full insight docs.

**For deep dives:** See `/docs/insight/` directory with comprehensive documentation.

---

## Template System (lit-html)

### Template Structure
```javascript
const result = html`<div>${value}</div>`;
// result.strings = ['<div>', '</div>']
// result.values = [value]
// result._$litType$ = 1 (TemplateResult marker)
```

### Marker System
- **Static HTML:** Template strings array (immutable, cached)
- **Dynamic values:** `<!--lit-part-->...<!--/lit-part-->` in SSR
- **Binding types:** Child, Attribute, Property, Boolean, Event, Element

**Deep dive:** `/docs/insight/lit-html-core.md`

---

## SSR Opcode System

### Opcode Types
```javascript
{
  type: 'text',           // Static HTML text
  type: 'child-part',     // Dynamic content binding
  type: 'attribute-part', // Dynamic attribute
  type: 'custom-element-open', // Component start
  type: 'custom-element-close' // Component end
}
```

### Opcode Generation
1. Parse template strings with parse5
2. Walk AST looking for markers (`<?lit$...?>`)
3. Generate opcodes for static + dynamic parts
4. Cache by template strings array reference

**Deep dive:** `/docs/insight/lit-ssr-internals.md` (lines 150-350)

---

## Hydration System

### Marker Format
```html
<!--lit-part DIGEST-->content<!--/lit-part-->  <!-- Child part -->
<!--lit-node INDEX-->                          <!-- Element marker -->
<?>                                            <!-- Placeholder -->
```

### Template Digest (DJB2)
```javascript
const hashes = new Uint32Array(2).fill(5381);
for (const s of result.strings) {
  for (let i = 0; i < s.length; i++) {
    hashes[i % 2] = (hashes[i % 2] * 33) ^ s.charCodeAt(i);
  }
}
const digest = btoa(String.fromCharCode(...new Uint8Array(hashes.buffer)));
```

**Deep dive:** `/docs/insight/lit-hydration.md` (lines 50-150)

---

## Component Rendering

### LitElement Lifecycle in SSR
**Runs on server:**
- ✅ `constructor()`
- ✅ `hasChanged()`
- ✅ `willUpdate()`
- ✅ `render()`
- ✅ `update()` (attribute reflection only)

**Does NOT run:**
- ❌ `connectedCallback()`
- ❌ `firstUpdated()`
- ❌ `updated()`
- ❌ Event handlers

### Declarative Shadow DOM Output
```html
<my-element>
  <template shadowroot="open" shadowrootmode="open">
    <style>:host { display: block; }</style>
    <div>Content</div>
  </template>
</my-element>
```

**Deep dive:** `/docs/insight/lit-reactive-element.md` (lines 200-300)

---

## Directives

### SSR-Safe Directives
- ✅ `repeat` - List rendering with keys
- ✅ `map` - Array transformation
- ✅ `when` - Conditional rendering
- ✅ `ifDefined` - Conditional attributes
- ✅ `classMap` - Dynamic classes
- ✅ `styleMap` - Dynamic styles
- ✅ `unsafeHTML` - Raw HTML injection
- ✅ `cache` - Template caching
- ✅ `until` - Async content

### Client-Only Directives (NOT SSR-safe)
- ❌ `live` - Requires DOM
- ❌ `ref` - Requires DOM
- ❌ `asyncAppend` / `asyncReplace` - Streaming only on client

### Directive Resolution in SSR
@lit-labs/ssr patches directives to call `render()` instead of `update()`:
```javascript
directiveCtor.prototype.$resolve = ssrResolveFunction;
```

**Deep dive:** `/docs/insight/lit-directives.md`

---

## Server-Only Templates

### Key Differences from Regular Templates

| Feature | Regular `html` | Server-Only `html` |
|---------|---------------|-------------------|
| Hydration markers | ✅ Yes | ❌ No |
| Full document | ❌ No | ✅ Yes (`<!DOCTYPE>`, `<html>`) |
| Event bindings | ✅ Yes | ❌ Not allowed |
| Property bindings | ✅ Yes | ❌ Not allowed |
| Can contain regular | ❌ No | ✅ Yes |

### Usage
```javascript
import { html as serverHtml } from '@lit-labs/ssr';
import { html } from 'lit';

const page = serverHtml`
  <!DOCTYPE html>
  <html>
    <body>
      ${html`<my-app></my-app>`}  <!-- Regular template hydrates -->
    </body>
  </html>
`;
```

**Deep dive:** `/docs/insight/lit-server-only-templates.md`

---

## WinterTC Runtime Compatibility

### Target Runtimes
- Cloudflare Workers (NO `nodejs_compat` needed!)
- Fastly Compute
- Node.js 18+ (LTS)
- Deno
- Bun

### Allowed APIs (WinterTC Minimum Common)
- ✅ `ReadableStream`, `WritableStream`, `TransformStream`
- ✅ `TextEncoder`, `TextDecoder`
- ✅ `fetch()`, `Request`, `Response`, `Headers`
- ✅ `URL`, `URLSearchParams`
- ✅ `AbortController`, `AbortSignal`
- ✅ `setTimeout`, `queueMicrotask`
- ✅ Modern JavaScript (ES2026)

### NOT Allowed (Node.js-specific)
- ❌ `stream.Readable`, `stream.Writable`
- ❌ `fs`, `path`, `process`, `Buffer`
- ❌ `vm` module
- ❌ `require()`, `__dirname`, `__filename`

**Deep dive:** `/docs/insight/edge-runtimes.md`

---

## Common Patterns

### Render a Template
```javascript
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';

const result = render(template);
const html = await collectResult(result);
```

### Stream a Template
```javascript
import { RenderResultReadable } from '@lit-labs/ssr/lib/render-result-readable.js';

const result = render(template);
const stream = new RenderResultReadable(result);
// Note: Node.js stream, NOT Web Stream
```

### Register Components
```javascript
customElements.define('my-element', MyElement);
// Components must be registered BEFORE rendering
```

### Strip Hydration Markers (Testing)
```javascript
function stripHydrationMarkers(html) {
  return html
    .replace(/<!--lit-part [^>]+?-->/g, '')
    .replace(/<!--\/lit-part-->/g, '')
    .replace(/<!--lit-node \d+-->/g, '')
    .replace(/<!--lit-part-->/g, '')
    .replace(/<\?>/g, '');
}
```

---

## Implementation Checklist for lit-edge

### Phase 2: Core Rendering
- [ ] Parse template strings → opcodes (use parse5)
- [ ] Implement opcode executor
- [ ] Text opcode → static HTML output
- [ ] Child-part opcode → value rendering
- [ ] Escape HTML in text content
- [ ] Generate hydration markers
- [ ] Calculate template digest (DJB2)
- [ ] Web Streams `ReadableStream` output

### Phase 3: Attributes & Directives
- [ ] Attribute-part opcode → attributes
- [ ] Boolean attributes (`.?disabled`)
- [ ] Property bindings (`.value`)
- [ ] Directive resolution (`render()` not `update()`)
- [ ] SSR-safe directives (repeat, map, when, classMap, etc.)

### Phase 4: Components
- [ ] Custom element detection
- [ ] Component instantiation
- [ ] Property → attribute conversion
- [ ] Lifecycle: constructor → willUpdate → render → update
- [ ] Declarative Shadow DOM generation
- [ ] Style serialization (CSSResult → `<style>`)
- [ ] Slot distribution

### Phase 5: Server-Only Templates
- [ ] Detect `_$litServerRenderMode = SERVER_ONLY`
- [ ] Skip hydration markers
- [ ] Support full document elements
- [ ] Reject event/property bindings
- [ ] Allow regular templates inside server-only

---

## Quick File Index

**Need to know about...** → **Read this file**

- Template system, parts, markers → `lit-html-core.md`
- Opcode system, SSR architecture → `lit-ssr-internals.md`
- Hydration markers, digest algorithm → `lit-hydration.md`
- Component lifecycle, properties → `lit-reactive-element.md`
- Directives, SSR compatibility → `lit-directives.md`
- CSS system, style serialization → `lit-styles.md`
- Server-only templates → `lit-server-only-templates.md`
- WinterTC, edge runtimes → `edge-runtimes.md`
- Node.js replacement strategies → `node-dependencies.md`
- Full index → `insight/README.md`

---

## Common Questions

### Q: How do I render a template?
**A:** Use `render(template)` → iterate result → collect strings. See "Common Patterns" above.

### Q: What's an opcode?
**A:** Instructions for rendering (text, child-part, attribute-part, etc.). See "SSR Opcode System" above.

### Q: How does hydration work?
**A:** Server adds `<!--lit-part DIGEST-->` markers, client matches templates by digest. See "Hydration System" above.

### Q: Which directives work in SSR?
**A:** Most work (repeat, map, when, classMap, styleMap). See "Directives" above for full list.

### Q: Can I use Node.js APIs?
**A:** No! Only WinterTC Web Platform APIs. See "WinterTC Runtime Compatibility" above.

### Q: What's server-only template?
**A:** Special `html` from `@lit-labs/ssr` with no hydration markers. See "Server-Only Templates" above.

### Q: How do components render in SSR?
**A:** Limited lifecycle, declarative shadow DOM output. See "Component Rendering" above.

---

## Performance Targets (from Phase 1)

### Tier 1 (Critical - must match @lit-labs/ssr)
- Simple text: > 100,000 ops/s
- String interpolation: > 100,000 ops/s
- HTML structure: > 125,000 ops/s

### Tier 2 (Important - within 1.5x)
- Attributes: > 60,000 ops/s
- Small lists: > 37,000 ops/s
- Directives: > 80,000 ops/s

### Tier 3 (Acceptable - within 2x)
- Components: > 35,000 ops/s
- Complex scenarios: > 18,000 ops/s

**Full results:** `/docs/PHASE_1_COMPLETE.md`

---

## Testing Patterns

### Integration Test Structure
```javascript
import { createRenderer, stripHydrationMarkers } from '../../helpers/renderer.js';
import { assertHTMLEqual } from '../../helpers/html-compare.js';

const renderer = createRenderer(); // Uses TEST_IMPL env var
const result = await renderer.renderToString(template);
const stripped = stripHydrationMarkers(result);
assertHTMLEqual(stripped, '<div>Expected</div>');
```

### Performance Benchmark
```javascript
import { benchmark } from './benchmark.js';

const result = await benchmark(
  'Benchmark name',
  () => renderer.renderToString(template),
  { iterations: 1000 }
);
```

**Test strategy:** `/docs/STRATEGY_TESTING.md`

---

**Last Updated:** Phase 1 Complete (Feb 2026)
