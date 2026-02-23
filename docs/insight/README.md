# Lit Edge: Research and Insights

This directory contains comprehensive research documentation for building a Lit server-side renderer for edge workers.

## Documentation Index

### Edge Runtime Research

**[edge-runtimes.md](./edge-runtimes.md)**
- WinterTC (TC55) Minimum Common Web Platform API specification
- Cloudflare Workers runtime capabilities and constraints
- Fastly Compute architecture and APIs
- Security model and sandbox constraints
- ESM module support and limitations
- Compatibility matrix for Web APIs

### Node.js Dependency Analysis

**[node-dependencies.md](./node-dependencies.md)**
- Analysis of @lit-labs/ssr Node.js dependencies
- Replacement strategies for edge compatibility:
  - `stream.Readable` → Web Streams API
  - `vm` module → Platform isolation
  - `enhanced-resolve` → Build-time bundling
  - `node-fetch` → Native `fetch()`
  - `fs`/`path` → Pre-bundling strategies
  - `parse5` compatibility assessment

### Lit Internals Research

**[lit-html-core.md](./lit-html-core.md)**
- The `html` tagged template literal system
- TemplateResult objects and structure
- Marker system for binding locations
- Template parsing and compilation
- Part types (Child, Attribute, Property, Event, Element, Boolean)
- Template caching with WeakMap
- Security architecture

**[lit-reactive-element.md](./lit-reactive-element.md)**
- ReactiveElement base class architecture
- Property declaration system and decorators
- Reactive property lifecycle
- Update cycle deep dive (requestUpdate → performUpdate)
- Lifecycle hooks (willUpdate, update, updated, firstUpdated)
- LitElement template integration
- SSR implications for lifecycle methods

**[lit-directives.md](./lit-directives.md)**
- Directive architecture and base classes
- Directive lifecycle (render, update, disconnected, reconnected)
- AsyncDirective for asynchronous operations
- Understanding Parts and PartInfo
- Built-in directives reference (22 directives)
- SSR compatibility matrix for all directives
- Creating custom directives

**[lit-styles.md](./lit-styles.md)**
- The `css` tagged template system
- CSSResult structure and types
- Adopted StyleSheets API
- Style composition and sharing
- SSR style serialization
- Security model and injection prevention
- CSS custom properties for theming

**[lit-ssr-internals.md](./lit-ssr-internals.md)**
- @lit-labs/ssr architecture and design
- Opcode system for template processing
- Value rendering and type handling
- Directive patching for SSR
- Declarative Shadow DOM generation
- Streaming HTML output
- Hydration markers and process

**[lit-hydration.md](./lit-hydration.md)**
- Complete hydration system analysis
- Hydration marker format (`lit-part`, `lit-node`, `/lit-part`)
- Template digest algorithm (DJB2 hash)
- Client-side hydration process
- LitElement automatic hydration
- Declarative Shadow DOM requirements
- Requirements for lit-ssr-edge compatibility

**[lit-server-only-templates.md](./lit-server-only-templates.md)**
- Server-only templates vs regular templates
- Special `html` function from `@lit-labs/ssr`
- No hydration markers (optimized output)
- Full document support (`<!DOCTYPE>`, `<html>`, `<head>`, `<body>`)
- Special elements (`<title>`, `<textarea>`, `<template>`, `<script>`)
- Composition rules (server-only can wrap regular templates)
- Binding restrictions (no events, properties, element parts)
- Use cases and implementation requirements

## Key Findings for lit-ssr-edge

### 1. WinterTC-Compatible Runtimes (Including Node.js)

lit-ssr-edge targets WinterTC-compatible runtimes, which **includes modern Node.js**:

**Target platforms:**
- **Cloudflare Workers** (without nodejs_compat)
- **Fastly Compute**
- **Node.js 18+** (modern LTS)
- **Deno**
- **Bun**
- Any WinterTC-compliant runtime

**Key principle:** Use only Web Platform APIs from WinterTC Minimum Common API specification, avoiding Node.js-specific APIs entirely.

### 2. Web Streams API Is the Foundation

Replace Node.js `stream.Readable` with Web Streams `ReadableStream` (available in all target runtimes):

```javascript
class RenderResultReadable {
  #stream;

  constructor(result) {
    const encoder = new TextEncoder();

    this.#stream = new ReadableStream({
      async pull(controller) {
        // Process render result iterators
        // Enqueue chunks
        // Close when complete
      }
    });
  }

  getStream() {
    return this.#stream;
  }
}
```

### 2. Pre-bundling Is Required

Edge runtimes have no filesystem access. Components must be pre-bundled:

```javascript
// Build time: Bundle all components
import './components/button.js';
import './components/card.js';

// Runtime: Components already registered
customElements.get('my-button'); // Available
```

### 3. Opcode System Enables Streaming

Templates are compiled to opcodes that interleave static HTML with dynamic operations:

```
Opcode: text("<!DOCTYPE html><html><body>")
Opcode: child-part (index 0)
Opcode: text("</body></html>")
```

This enables streaming HTML output before all values resolve.

### 4. Directive SSR Requires Patching

@lit-labs/ssr patches directives to call `render()` instead of `update()`:

```javascript
function patchDirectiveResolve(directiveCtor, ssrResolve) {
  directiveCtor.prototype.$resolve = ssrResolve;
}
```

Only SSR-safe directives will work on edge workers.

### 5. DOM Shim Is Minimal

The DOM shim provides just enough for SSR:

- `EventTarget`, `Event` - For component lifecycle
- `Element`, `HTMLElement` - Minimal implementations
- `CustomElementRegistry` - Component registration
- No DOM tree manipulation - Output is strings

### 6. Styles Serialize to Declarative Shadow DOM

Component styles become `<style>` tags in server output:

```html
<my-element>
  <template shadowroot="open">
    <style>
      :host { display: block; }
      h1 { color: blue; }
    </style>
    <h1>Content</h1>
  </template>
</my-element>
```

### 7. Lifecycle Methods Are Limited in SSR

Only these run server-side:
- `constructor`
- `hasChanged`
- `willUpdate`
- `render`
- `update` (attribute reflection only)

DOM-dependent methods don't run:
- `connectedCallback`
- `firstUpdated`
- `updated`
- `disconnectedCallback`

### 8. Server-Only Templates Provide Optimization

Lit SSR supports two template types:

**Regular templates** (from `lit`):
- Generate hydration markers
- Can be updated on client
- Support all bindings

**Server-only templates** (from `@lit-labs/ssr`):
- No hydration markers (cleaner output)
- Cannot update on client
- Can render full documents (`<!DOCTYPE>`, `<html>`, etc.)
- Can contain regular templates (which can hydrate)
- Performance optimized for static content

```javascript
import { html as serverHtml } from '@lit-labs/ssr';
import { html } from 'lit';

// Server-only wrapper (no markers)
const page = serverHtml`
  <!DOCTYPE html>
  <html>
    <body>
      <!-- Regular template inside (has markers) -->
      ${html`<my-app></my-app>`}
    </body>
  </html>
`;
```

## Implementation Strategy

### Phase 1: Core Rendering

1. Implement Web Streams-based `RenderResultReadable`
2. Port opcode generation from templates
3. Implement value rendering for primitives, templates, arrays
4. Handle basic directives (repeat, map, when, etc.)

### Phase 2: DOM Shim

1. Minimal `EventTarget`, `Event` implementations
2. `Element`, `HTMLElement` stubs
3. `CustomElementRegistry` for component registration
4. Shadow DOM placeholders

### Phase 3: Component Support

1. LitElement lifecycle in SSR mode
2. Reactive properties (render only)
3. Style serialization
4. Declarative Shadow DOM generation

### Phase 4: Advanced Features

1. Full directive support (SSR-compatible ones)
2. Slot distribution
3. Hydration markers
4. Streaming optimization

## Architecture Decisions

### 1. ESM Modules Only

```javascript
// lit-ssr-edge/src/index.js
export { render } from './lib/render.js';
export { RenderResultReadable } from './lib/render-stream.js';
```

No CommonJS support needed for edge workers.

### 2. Zero Dependencies on Node.js APIs

All implementations use Web Platform APIs:
- `ReadableStream` (not `stream.Readable`)
- `TextEncoder`/`TextDecoder` (not `Buffer`)
- `URL` (not `path`)
- `fetch()` (not `node-fetch`)

### 3. Component Pre-bundling Required

Users must bundle components at build time:

```javascript
// esbuild.config.js
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/components/index.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/components-bundle.js'
});
```

### 4. Minimal parse5 Usage

parse5 is pure JavaScript and edge-compatible. Use it for:
- HTML parsing for templates
- Opcode generation
- Attribute extraction

### 5. No VM Isolation

Edge workers provide V8 isolate isolation by default. No need for `vm` module:
- Each request runs in isolated context
- No shared global state between requests
- Platform handles security

## Testing Strategy

### Unit Tests
- Template parsing
- Opcode generation
- Value rendering
- Directive handling
- Stream output

### Integration Tests
- Full rendering pipeline
- Component rendering
- Shadow DOM output
- Style serialization

### Edge Runtime Tests
- Cloudflare Workers (via Wrangler)
- Fastly Compute (via Fastly CLI)
- Memory constraints
- Execution time limits

## Success Criteria

A successful lit-ssr-edge implementation will:

1. ✅ Run on Cloudflare Workers and Fastly Compute
2. ✅ Render LitElement components to HTML strings
3. ✅ Support Web Streams for streaming output
4. ✅ Handle SSR-compatible directives
5. ✅ Generate Declarative Shadow DOM
6. ✅ Serialize component styles
7. ✅ Support hydration on client
8. ✅ Have minimal or zero dependencies
9. ✅ Use only Web Platform APIs
10. ✅ Work with pre-bundled components

## References

### Lit Source Code
- [Lit Monorepo](https://github.com/lit/lit)
- [lit-html Package](https://github.com/lit/lit/tree/main/packages/lit-html)
- [reactive-element Package](https://github.com/lit/lit/tree/main/packages/reactive-element)
- [lit-element Package](https://github.com/lit/lit/tree/main/packages/lit-element)
- [@lit-labs/ssr Package](https://github.com/lit/lit/tree/main/packages/labs/ssr)
- [@lit-labs/ssr-dom-shim](https://github.com/lit/lit/tree/main/packages/labs/ssr-dom-shim)

### Lit Documentation
- [Lit.dev](https://lit.dev)
- [Components Overview](https://lit.dev/docs/components/overview/)
- [Templates](https://lit.dev/docs/templates/overview/)
- [SSR Overview](https://lit.dev/docs/ssr/overview/)
- [Directives](https://lit.dev/docs/templates/directives/)

### Edge Runtimes
- [WinterTC](https://wintertc.org/)
- [Minimum Common API Spec](https://min-common-api.proposal.wintertc.org/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Fastly Compute JavaScript](https://www.fastly.com/documentation/guides/compute/javascript/)

### Web Platform APIs
- [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)
- [Declarative Shadow DOM](https://web.dev/declarative-shadow-dom/)
- [Constructable Stylesheets](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet)
- [Custom Elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements)
