# lit-ssr-edge Architecture

This document outlines the architecture for lit-ssr-edge, a server-side renderer for Lit web components targeting edge workers and WinterTC-compatible runtimes.

## Table of Contents

1. [System Overview](#system-overview)
2. [Architectural Principles](#architectural-principles)
3. [Module Structure](#module-structure)
4. [Core Components](#core-components)
5. [Rendering Pipeline](#rendering-pipeline)
6. [Template Processing](#template-processing)
7. [Component Rendering](#component-rendering)
8. [Hydration Support](#hydration-support)
9. [Public API](#public-api)
10. [Data Flow](#data-flow)
11. [Error Handling](#error-handling)
12. [Performance Considerations](#performance-considerations)
13. [Edge Runtime Compatibility](#edge-runtime-compatibility)
14. [Testing Architecture](#testing-architecture)
15. [Decision Points](#decision-points)

---

## System Overview

### Project Goals

lit-ssr-edge provides server-side rendering for Lit components on WinterTC-compatible runtimes, including edge computing platforms (Cloudflare Workers, Fastly Compute), modern Node.js, Deno, and Bun. It maintains compatibility with Lit's official `@lit-labs/ssr-client` hydration.

### Core Requirements

1. **WinterTC compatibility** - Run on any WinterTC-compatible runtime:
   - Cloudflare Workers (without nodejs_compat mode)
   - Fastly Compute
   - Node.js 18+ (modern LTS versions)
   - Deno
   - Bun
   - Other WinterTC-compliant runtimes
2. **SSR compatibility** - Generate output compatible with `@lit-labs/ssr`
3. **Hydration support** - Work seamlessly with `@lit-labs/ssr-client`
4. **Web Platform APIs only** - Use only WinterTC Minimum Common API:
   - Web Streams (`ReadableStream`, `WritableStream`, `TransformStream`)
   - `fetch()`, `Request`, `Response`, `Headers`
   - `TextEncoder`, `TextDecoder`
   - `URL`, `URLSearchParams`
   - No Node.js-specific APIs (no `stream.Readable`, `fs`, `path`, `vm`)
5. **Modern JavaScript** - ES2026 features, modern runtime assumptions
6. **ESM modules** - Pure ESM, no CommonJS
7. **Minimal dependencies** - Prefer zero dependencies when possible
8. **Component pre-bundling** - Components bundled at build time

### Non-Goals

1. ❌ Full feature parity with `@lit-labs/ssr` (subset of features)
2. ❌ VM-based isolation (use platform-provided isolation)
3. ❌ Runtime module resolution (components pre-bundled)
4. ❌ Legacy Node.js versions (< 18)
5. ❌ Node.js-specific APIs (no `process.cwd()`, `__dirname`, etc.)
6. ❌ Cloudflare Workers nodejs_compat dependency (works without it)
7. ❌ Client-side code (use official `@lit-labs/ssr-client`)

---

## Architectural Principles

### 1. Compatibility First

Generate output that is **byte-for-byte compatible** with `@lit-labs/ssr` (after normalization). This ensures:
- Official client hydration works without modification
- Drop-in replacement capability
- Predictable behavior

### 2. Web Platform APIs Only

Use only APIs available in edge runtimes:
- ✅ `ReadableStream`, `WritableStream`, `TransformStream`
- ✅ `TextEncoder`, `TextDecoder`
- ✅ `URL`, `URLSearchParams`
- ✅ `fetch()`, `Request`, `Response`
- ❌ `stream.Readable` (Node.js)
- ❌ `fs`, `path` (Node.js)
- ❌ `vm` module (Node.js)

### 3. Streaming by Default

All rendering operations stream output via `ReadableStream`:
- Memory efficient (handle large documents)
- Low time-to-first-byte
- Natural backpressure handling
- Edge runtime optimized

### 4. Zero Runtime Dependencies

Dependencies should be:
- **Build-time only** - Bundlers, test runners, type definitions
- **Platform-provided** - Web Platform APIs
- **Vendored if essential** - parse5 (pure JS, edge-compatible)

### 5. Pre-bundled Components

Components are bundled at build time, not resolved at runtime:
- No filesystem access required
- No module resolution needed
- Faster startup
- Predictable behavior

---

## Module Structure

### Proposed Directory Layout

```
lit-ssr-edge/
├── src/
│   ├── index.js                    # Main entry point
│   ├── server-template.js          # Server-only template exports
│   ├── lib/
│   │   ├── render.js               # Core render function
│   │   ├── render-value.js         # Value type rendering
│   │   ├── render-result.js        # Result types and collectors
│   │   ├── render-stream.js        # Web Streams implementation
│   │   ├── render-lit-html.js      # Template result rendering
│   │   ├── element-renderer.js     # Custom element rendering
│   │   ├── lit-element-renderer.js # LitElement-specific rendering
│   │   ├── template-cache.js       # Template parsing and caching
│   │   ├── opcodes.js              # Opcode generation and execution
│   │   ├── digest.js               # Template digest calculation
│   │   ├── markers.js              # Hydration marker generation
│   │   ├── directives.js           # Directive handling
│   │   ├── dom-shim.js             # Minimal DOM shim
│   │   └── util/
│   │       ├── escape-html.js      # HTML escaping
│   │       ├── parse-template.js   # Template parsing with parse5
│   │       └── constants.js        # Shared constants
│   └── directives/                 # SSR-compatible directives
│       ├── repeat.js
│       ├── map.js
│       ├── when.js
│       └── ...
├── test/
│   ├── fixtures/
│   ├── helpers/
│   ├── integration/
│   │   └── baseline/
│   ├── unit/
│   └── edge/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── STRATEGY_TESTING.md
│   └── insight/
├── examples/
│   ├── cloudflare-worker/
│   └── fastly-compute/
└── package.json
```

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| **index.js** | Public API exports for regular templates |
| **server-template.js** | Public API for server-only templates |
| **render.js** | Main render entry point, creates render context |
| **render-value.js** | Type-specific value rendering logic |
| **render-result.js** | Result collection (sync/async) |
| **render-stream.js** | Web Streams `ReadableStream` wrapper |
| **render-lit-html.js** | TemplateResult processing and opcode execution |
| **element-renderer.js** | Base custom element rendering |
| **lit-element-renderer.js** | LitElement lifecycle and shadow DOM |
| **template-cache.js** | Template parsing, caching, opcode generation |
| **opcodes.js** | Opcode types and execution |
| **digest.js** | Template digest (DJB2 hash) calculation |
| **markers.js** | Hydration marker generation |
| **directives.js** | Directive resolution and patching |
| **dom-shim.js** | Minimal DOM for component instantiation |

---

## Core Components

### 1. Render Function

**Purpose:** Main entry point for rendering templates

**Signature:**
```javascript
function render(
  value: unknown,
  options?: RenderOptions
): RenderResult
```

**Responsibilities:**
- Create render context
- Initialize opcode execution
- Return RenderResult iterable

**Implementation notes:**
- Similar to `@lit-labs/ssr` render function
- Options for component registry, module loader (if needed)
- Returns iterable of strings/promises

### 2. RenderResult

**Purpose:** Lazy iterable of rendered chunks

**Interface:**
```javascript
interface RenderResult extends AsyncIterable<string> {
  [Symbol.asyncIterator](): AsyncIterator<string>;
}
```

**Responsibilities:**
- Yield rendered chunks lazily
- Handle thunked operations (deferred rendering)
- Support both sync and async iteration

**Implementation notes:**
- Generator-based implementation
- Thunks allow lazy evaluation
- Compatible with `@lit-labs/ssr` RenderResult

### 3. RenderResultReadable

**Purpose:** Web Streams wrapper for RenderResult

**Interface:**
```javascript
class RenderResultReadable {
  constructor(result: RenderResult);
  getStream(): ReadableStream<Uint8Array>;
}
```

**Responsibilities:**
- Convert RenderResult to `ReadableStream`
- Handle text encoding (UTF-8)
- Manage backpressure
- Support streaming to Response

**Implementation notes:**
- Uses `TextEncoder` for UTF-8 encoding
- Implements Web Streams `ReadableStream`
- Similar to `@lit-labs/ssr` `RenderResultReadable` but Web Streams

### 4. Template Cache

**Purpose:** Parse templates once, cache for reuse

**Interface:**
```javascript
class TemplateCache {
  getTemplate(strings: TemplateStringsArray): Template;
}

interface Template {
  strings: TemplateStringsArray;
  parts: TemplatePart[];
  opcodes: Opcode[];
}
```

**Responsibilities:**
- Parse templates with parse5
- Generate opcodes
- Cache by `TemplateStringsArray` reference (WeakMap)
- Calculate template digest

**Implementation notes:**
- WeakMap cache (automatic GC)
- Lazy parsing (parse on first use)
- Thread-safe (each request has own cache instance or shared cache)

### 5. Opcode System

**Purpose:** Efficient template rendering instructions

**Opcode Types:**
```javascript
type Opcode =
  | { type: 'text'; value: string }
  | { type: 'child-part'; index: number }
  | { type: 'attribute-part'; index: number; name: string; strings?: string[] }
  | { type: 'custom-element-open'; tagName: string; ctor: CustomElementConstructor }
  | { type: 'custom-element-shadow' }
  | { type: 'custom-element-close' }
  | { type: 'possible-node-marker'; index: number };
```

**Responsibilities:**
- Represent template structure
- Guide rendering process
- Optimize repeated rendering

**Implementation notes:**
- Similar to `@lit-labs/ssr` opcode system
- Generated during template parsing
- Executed sequentially during rendering

### 6. Digest Calculator

**Purpose:** Generate template digest for hydration validation

**Signature:**
```javascript
function digestForTemplateResult(result: TemplateResult): string
```

**Algorithm:**
```javascript
// DJB2 hash with two 32-bit accumulators
const hashes = new Uint32Array(2).fill(5381);
for (const s of result.strings) {
  for (let i = 0; i < s.length; i++) {
    hashes[i % 2] = (hashes[i % 2] * 33) ^ s.charCodeAt(i);
  }
}
// Convert to base64
const str = String.fromCharCode(...new Uint8Array(hashes.buffer));
return btoa(str);
```

**Responsibilities:**
- Calculate template hash
- Cache digests (WeakMap)
- Ensure exact compatibility with `@lit-labs/ssr` algorithm

### 7. Marker Generator

**Purpose:** Generate hydration markers

**Markers:**
```javascript
function generateMarkers(hydratable: boolean, digest?: string) {
  return {
    openPart: () => hydratable ? `<!--lit-part ${digest}-->` : '',
    closePart: () => hydratable ? `<!--/lit-part-->` : '',
    nodeMarker: (index: number) => hydratable ? `<!--lit-node ${index}-->` : ''
  };
}
```

**Responsibilities:**
- Generate `<!--lit-part DIGEST-->`
- Generate `<!--lit-node INDEX-->`
- Generate `<!--/lit-part-->`
- Skip markers for server-only templates

### 8. DOM Shim

**Purpose:** Minimal DOM for component instantiation

**Exports:**
```javascript
export class EventTarget { /* ... */ }
export class Event { /* ... */ }
export class CustomEvent extends Event { /* ... */ }
export class Element extends EventTarget { /* ... */ }
export class HTMLElement extends Element { /* ... */ }
export const customElements = new CustomElementRegistry();
```

**Responsibilities:**
- Provide base classes for custom elements
- Implement `customElements.define()`
- Minimal shadow root placeholder
- No actual DOM tree

**Implementation notes:**
- Adapted from `@lit-labs/ssr-dom-shim`
- Only what's needed for component instantiation
- No rendering methods (components use `render()`)

### 9. Directive Handler

**Purpose:** Resolve and execute directives during SSR

**Interface:**
```javascript
function resolveDirective(part: Part, value: unknown): unknown
function patchDirective(directiveCtor: DirectiveClass): void
```

**Responsibilities:**
- Detect directive results
- Patch directives to call `render()` instead of `update()`
- Handle SSR-compatible directives
- Throw errors for client-only directives

**Implementation notes:**
- Similar to `@lit-labs/ssr` directive patching
- Only SSR-compatible directives supported initially

---

## Rendering Pipeline

### High-Level Flow

```
1. render(template, options)
   └─> Create RenderResult

2. RenderResult iteration
   ├─> Get/create Template from cache
   ├─> Generate opcodes (if not cached)
   ├─> Calculate digest (if not cached)
   └─> Execute opcodes sequentially
       ├─> 'text' → yield string
       ├─> 'child-part' → recurse with renderValue()
       ├─> 'attribute-part' → render attribute
       ├─> 'custom-element-open' → instantiate component
       ├─> 'custom-element-shadow' → render shadow DOM
       └─> 'custom-element-close' → cleanup

3. renderValue(value, part)
   ├─> Primitive → escape and yield
   ├─> TemplateResult → recurse to step 2
   ├─> Directive → resolve and recurse
   ├─> Iterable → map and recurse
   ├─> Node → serialize (if supported)
   └─> nothing/undefined/null → skip

4. Component rendering
   ├─> Instantiate constructor
   ├─> Set properties
   ├─> Call willUpdate()
   ├─> Call render()
   ├─> Generate declarative shadow DOM
   │   ├─> <template shadowroot="open">
   │   ├─> <style> tags (component styles)
   │   ├─> Rendered shadow content
   │   └─> </template>
   └─> Yield component HTML

5. Stream consumption
   └─> RenderResultReadable.getStream()
       ├─> Iterate RenderResult
       ├─> Encode strings to Uint8Array
       └─> Enqueue to ReadableStream
```

### Detailed Rendering Steps

#### Step 1: Template Parsing

```javascript
function parseTemplate(result: TemplateResult): Template {
  // 1. Get HTML string with markers
  const html = getTemplateHtml(result.strings);

  // 2. Determine parser type
  const hydratable = isHydratable(result);
  const isDocument = !hydratable && /^(\s|<!--)*<!DOCTYPE/i.test(html);

  // 3. Parse with parse5
  const ast = isDocument
    ? parse5.parse(html, { sourceCodeLocationInfo: true })
    : parse5.parseFragment(html, { sourceCodeLocationInfo: true });

  // 4. Generate opcodes from AST
  const opcodes = generateOpcodes(ast, result);

  // 5. Return template
  return { strings: result.strings, parts: [], opcodes };
}
```

#### Step 2: Opcode Generation

```javascript
function generateOpcodes(ast, result): Opcode[] {
  const opcodes = [];
  let partIndex = 0;

  walkAST(ast, (node) => {
    if (isTextNode(node)) {
      opcodes.push({ type: 'text', value: node.value });
    }

    if (isComment(node) && node.data.includes('lit$')) {
      // Found a binding marker
      opcodes.push({
        type: 'child-part',
        index: partIndex++
      });
    }

    if (isElement(node) && hasBindings(node)) {
      opcodes.push({
        type: 'possible-node-marker',
        index: getNodeIndex(node)
      });

      // Process attribute bindings
      for (const attr of node.attrs) {
        if (attr.name.endsWith('$lit$')) {
          opcodes.push({
            type: 'attribute-part',
            index: partIndex++,
            name: attr.name.replace('$lit$', ''),
            strings: attr.value.split('lit$')
          });
        }
      }
    }

    if (isCustomElement(node)) {
      opcodes.push({
        type: 'custom-element-open',
        tagName: node.tagName,
        ctor: customElements.get(node.tagName)
      });
      // ... traverse children ...
      opcodes.push({ type: 'custom-element-close' });
    }
  });

  return opcodes;
}
```

#### Step 3: Opcode Execution

```javascript
function* executeOpcodes(opcodes, values, renderInfo) {
  let valueIndex = 0;

  for (const op of opcodes) {
    switch (op.type) {
      case 'text':
        yield op.value;
        break;

      case 'child-part':
        const hydratable = renderInfo.hydratable;
        if (hydratable) {
          yield `<!--lit-part ${renderInfo.digest}-->`;
        }
        yield* renderValue(values[valueIndex++], renderInfo);
        if (hydratable) {
          yield `<!--/lit-part-->`;
        }
        break;

      case 'attribute-part':
        // Render attribute value
        const attrValue = renderAttributePart(
          values[valueIndex++],
          op.strings
        );
        yield ` ${op.name}="${attrValue}"`;
        break;

      case 'custom-element-open':
        yield* renderCustomElement(op, values, renderInfo);
        break;

      // ... other opcodes ...
    }
  }
}
```

#### Step 4: Value Rendering

```javascript
function* renderValue(value, renderInfo) {
  // Resolve directives first
  value = resolveDirective(value, renderInfo);

  // Handle by type
  if (value === nothing || value === undefined || value === null) {
    return; // Render nothing
  }

  if (isPrimitive(value)) {
    yield escapeHtml(String(value));
    return;
  }

  if (isTemplateResult(value)) {
    yield* renderTemplateResult(value, renderInfo);
    return;
  }

  if (isIterable(value)) {
    for (const item of value) {
      yield* renderValue(item, renderInfo);
    }
    return;
  }

  // Unsupported type
  yield escapeHtml(String(value));
}
```

#### Step 5: Component Rendering

```javascript
function* renderCustomElement(op, values, renderInfo) {
  const { tagName, ctor } = op;

  // 1. Instantiate component
  const instance = new ctor();

  // 2. Set properties from attributes/properties
  setComponentProperties(instance, values);

  // 3. Run lifecycle
  if (instance.willUpdate) {
    instance.willUpdate(new Map());
  }

  // 4. Call render()
  const shadowContent = instance.render ? instance.render() : nothing;

  // 5. Generate opening tag with defer-hydration
  yield `<${tagName} defer-hydration>`;

  // 6. Generate declarative shadow DOM
  yield `<template shadowroot="open">`;

  // 7. Render styles
  if (ctor.styles) {
    yield `<style>`;
    yield getStyleText(ctor.styles);
    yield `</style>`;
  }

  // 8. Render shadow content
  yield* renderValue(shadowContent, renderInfo);

  // 9. Close shadow root
  yield `</template>`;

  // 10. Render light DOM children (slots)
  yield* renderLightChildren(values);

  // 11. Close element
  yield `</${tagName}>`;
}
```

---

## Template Processing

### Template Types

lit-ssr-edge supports two template types:

#### Regular Templates (Hydratable)

**Import:** `import { html } from 'lit-ssr-edge'`

**Characteristics:**
- Generate hydration markers
- Can be updated on client
- Support all binding types
- Fragment parsing

**Example:**
```javascript
import { html } from 'lit-ssr-edge';
const template = html`<div class=${cls}>${content}</div>`;
```

**Output:**
```html
<!--lit-part AEmR7W+R0Ak=-->
<!--lit-node 0-->
<div class="active">
  <!--lit-part-->
  Hello
  <!--/lit-part-->
</div>
<!--/lit-part-->
```

#### Server-Only Templates (Non-Hydratable)

**Import:** `import { html } from 'lit-ssr-edge/server-template.js'`

**Characteristics:**
- No hydration markers
- Cannot update on client
- Support document elements
- Can contain regular templates
- Document/fragment parsing

**Example:**
```javascript
import { html as serverHtml } from 'lit-ssr-edge/server-template.js';
const template = serverHtml`<!DOCTYPE html><html>...</html>`;
```

**Output:**
```html
<!DOCTYPE html>
<html>
  <body>Hello</body>
</html>
```

### Template Detection

```javascript
const SERVER_ONLY = 1;

function isHydratable(result: TemplateResult): boolean {
  return result._$litServerRenderMode !== SERVER_ONLY;
}
```

### Template Parsing Strategy

```javascript
function selectParser(html: string, hydratable: boolean) {
  // Server-only templates with document elements
  const isDocument = !hydratable &&
    /^(\s|<!--[^]*?-->)*<(!doctype|html|head|body)(\s|>)/i.test(html);

  if (isDocument) {
    return parse5.parse; // Full document parser
  } else {
    return parse5.parseFragment; // Fragment parser
  }
}
```

---

## Component Rendering

### Component Lifecycle (SSR)

Only specific lifecycle methods run during SSR:

```javascript
class LitElement extends HTMLElement {
  // ✅ Runs on server
  constructor() {
    super();
    // Initialize properties
  }

  // ✅ Runs on server
  willUpdate(changedProperties) {
    // Compute derived values
  }

  // ✅ Runs on server
  render() {
    return html`...`;
  }

  // ❌ Skipped on server
  connectedCallback() { }

  // ❌ Skipped on server
  firstUpdated() { }

  // ❌ Skipped on server
  updated() { }
}
```

### Shadow DOM Generation

Components generate Declarative Shadow DOM:

```javascript
function* renderLitElement(instance, ctor) {
  // Opening tag with defer-hydration
  yield `<${ctor.tagName} defer-hydration>`;

  // Declarative shadow root
  yield `<template shadowroot="open">`;

  // Styles
  if (ctor.styles) {
    yield `<style>`;
    for (const style of ctor.styles) {
      yield style.cssText;
    }
    yield `</style>`;
  }

  // Shadow content with hydration markers
  const shadowTemplate = instance.render();
  yield* renderValue(shadowTemplate, { hydratable: true });

  // Close shadow root
  yield `</template>`;

  // Light DOM children (slotted content)
  // ...

  // Closing tag
  yield `</${ctor.tagName}>`;
}
```

### Property Handling

```javascript
function setComponentProperties(instance, attributes, properties) {
  // Attributes → properties (with conversion)
  for (const [name, value] of attributes) {
    const propDecl = instance.constructor.getPropertyDeclaration(name);
    if (propDecl) {
      const converter = propDecl.converter || defaultConverter;
      instance[name] = converter.fromAttribute(value, propDecl.type);
    }
  }

  // Direct property bindings (.prop)
  for (const [name, value] of properties) {
    instance[name] = value;
  }
}
```

---

## Hydration Support

### Marker Generation

lit-ssr-edge generates markers compatible with `@lit-labs/ssr-client`:

```javascript
function generateHydrationMarkers(hydratable, digest) {
  if (!hydratable) {
    return {
      openPart: '',
      closePart: '',
      nodeMarker: () => ''
    };
  }

  return {
    openPart: `<!--lit-part ${digest}-->`,
    closePart: `<!--/lit-part-->`,
    nodeMarker: (index) => `<!--lit-node ${index}-->`
  };
}
```

### Digest Calculation

**Must match `@lit-labs/ssr` exactly:**

```javascript
function digestForTemplateResult(result) {
  // Check cache
  let digest = digestCache.get(result.strings);
  if (digest) return digest;

  // DJB2 hash
  const hashes = new Uint32Array(2).fill(5381);
  for (const s of result.strings) {
    for (let i = 0; i < s.length; i++) {
      hashes[i % 2] = (hashes[i % 2] * 33) ^ s.charCodeAt(i);
    }
  }

  // Base64 encode
  const str = String.fromCharCode(...new Uint8Array(hashes.buffer));
  digest = btoa(str);

  // Cache
  digestCache.set(result.strings, digest);
  return digest;
}
```

### Node Index Calculation

Depth-first element traversal:

```javascript
function calculateNodeIndex(element, template) {
  let index = 0;
  const walker = createTreeWalker(template.content);

  while (walker.nextNode()) {
    if (walker.currentNode === element) {
      return index;
    }
    index++;
  }

  return -1;
}
```

### Client Compatibility

Output must be compatible with:

```javascript
// Client-side
import { hydrate } from '@lit-labs/ssr-client';
import { html } from 'lit';

// Same template and data as server
const template = html`<div class=${cls}>${content}</div>`;

// Hydrate
hydrate(template, document.body);

// Now can render updates
import { render } from 'lit';
render(updatedTemplate, document.body);
```

---

## Public API

### Main Entry Point (index.js)

```javascript
// Core rendering
export { render } from './lib/render.js';
export { collectResult, collectResultSync } from './lib/render-result.js';

// Streaming
export { RenderResultReadable } from './lib/render-stream.js';

// Re-export from lit-html for convenience
export { html, svg, noChange, nothing } from 'lit-html';

// Utility
export { isHydratable } from './lib/util/constants.js';
```

### Server-Only Templates (server-template.js)

```javascript
// Server-only template functions
export { html, svg, mathml, noChange, nothing } from './lib/server-template.js';
```

### Usage Examples

**Basic rendering:**
```javascript
import { render, collectResult } from 'lit-ssr-edge';
import { html } from 'lit';

const template = html`<div>Hello, ${name}!</div>`;
const result = render(template);
const htmlString = await collectResult(result);
```

**Streaming:**
```javascript
import { render, RenderResultReadable } from 'lit-ssr-edge';
import { html } from 'lit';

const template = html`<div>Content</div>`;
const result = render(template);
const readable = new RenderResultReadable(result);

// Return as Response
return new Response(readable.getStream(), {
  headers: { 'Content-Type': 'text/html' }
});
```

**Server-only template:**
```javascript
import { render, collectResult } from 'lit-ssr-edge';
import { html as serverHtml } from 'lit-ssr-edge/server-template.js';
import { html } from 'lit';

const page = serverHtml`
  <!DOCTYPE html>
  <html>
    <body>
      ${html`<my-app></my-app>`}
    </body>
  </html>
`;

const result = render(page);
const htmlString = await collectResult(result);
```

**Component rendering:**
```javascript
import { render } from 'lit-ssr-edge';
import { html } from 'lit';
import './components-bundle.js'; // Pre-bundled components

const template = html`
  <my-header></my-header>
  <my-content>
    <h1>Hello</h1>
  </my-content>
`;

const result = render(template);
```

---

## Data Flow

### Rendering Data Flow

```
User Code
  │
  ├─> template = html`...`
  │      │
  │      └─> TemplateResult { strings, values }
  │
  └─> render(template)
         │
         ├─> Get/create Template from cache
         │      │
         │      ├─> Parse with parse5
         │      ├─> Generate opcodes
         │      └─> Calculate digest
         │
         ├─> Create RenderInfo context
         │      │
         │      └─> { hydratable, digest, customElements, ... }
         │
         └─> Return RenderResult
                │
                └─> Lazy iteration
                       │
                       ├─> Execute opcodes
                       │      │
                       │      ├─> Text → yield string
                       │      ├─> Child part → renderValue()
                       │      ├─> Attribute → render attr
                       │      └─> Element → renderElement()
                       │
                       └─> Yield strings/promises
```

### Component Data Flow

```
Custom Element Rendering
  │
  ├─> customElements.get(tagName)
  │      │
  │      └─> CustomElementConstructor
  │
  ├─> new Constructor()
  │      │
  │      └─> Component instance
  │
  ├─> Set properties
  │      │
  │      ├─> Attributes → properties (with conversion)
  │      └─> Property bindings
  │
  ├─> willUpdate(changedProps)
  │      │
  │      └─> Compute derived values
  │
  ├─> render()
  │      │
  │      └─> TemplateResult (shadow content)
  │
  ├─> Generate declarative shadow DOM
  │      │
  │      ├─> <template shadowroot="open">
  │      ├─> <style> tags
  │      ├─> Render shadow content
  │      └─> </template>
  │
  └─> Yield component HTML
```

### Stream Data Flow

```
RenderResult
  │
  └─> RenderResultReadable(result)
         │
         ├─> ReadableStream({
         │      pull(controller) {
         │        │
         │        ├─> Iterate RenderResult
         │        │      │
         │        │      └─> Get next chunk (string/promise)
         │        │
         │        ├─> Await promises
         │        │
         │        ├─> TextEncoder.encode()
         │        │      │
         │        │      └─> Uint8Array
         │        │
         │        └─> controller.enqueue(chunk)
         │      }
         │   })
         │
         └─> Response(stream, { headers })
                │
                └─> Edge worker response
```

---

## Error Handling

### Error Categories

1. **Template errors** - Invalid template structure
2. **Component errors** - Component instantiation/rendering failures
3. **Directive errors** - Unsupported or misused directives
4. **Hydration errors** - Invalid composition (server-only inside regular)
5. **Platform errors** - Edge runtime constraints exceeded

### Error Handling Strategy

```javascript
class LitEdgeError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'LitEdgeError';
    this.cause = cause;
  }
}

class TemplateError extends LitEdgeError { }
class ComponentError extends LitEdgeError { }
class DirectiveError extends LitEdgeError { }
class HydrationError extends LitEdgeError { }
```

### Error Contexts

**Template parsing:**
```javascript
try {
  const ast = parse5.parse(html);
} catch (err) {
  throw new TemplateError(
    `Failed to parse template: ${err.message}`,
    err
  );
}
```

**Component rendering:**
```javascript
try {
  const instance = new ctor();
  instance.willUpdate?.(new Map());
  const shadowContent = instance.render();
} catch (err) {
  throw new ComponentError(
    `Failed to render component <${tagName}>: ${err.message}`,
    err
  );
}
```

**Directive validation:**
```javascript
if (!isHydratable && part.type === PartType.EVENT) {
  throw new DirectiveError(
    "Server-only templates can't bind to events"
  );
}
```

**Hydration validation:**
```javascript
if (!childHydratable && parentHydratable) {
  throw new HydrationError(
    "A server-only template can't be rendered inside " +
    "an ordinary, hydratable template"
  );
}
```

---

## Performance Considerations

### Template Caching

**Strategy:** WeakMap-based caching by `TemplateStringsArray`

```javascript
const templateCache = new WeakMap();

function getTemplate(result) {
  let template = templateCache.get(result.strings);
  if (!template) {
    template = parseTemplate(result);
    templateCache.set(result.strings, template);
  }
  return template;
}
```

**Benefits:**
- Parse templates once
- Automatic garbage collection
- Thread-safe (per-context cache)

### Streaming Chunk Size

**🔴 DECISION POINT:** What chunk size should we target?

**Options:**

A. **Small chunks (256-1024 bytes)**
   - Lower time-to-first-byte
   - More function calls
   - Better for slow connections

B. **Medium chunks (4-16 KB)**
   - Balanced approach
   - Similar to Node.js default
   - Good for most cases

C. **Large chunks (64+ KB)**
   - Fewer function calls
   - Higher throughput
   - May delay first byte

**Considerations:**
- Edge worker memory limits (128 MB)
- Time to first byte requirements
- CPU time limits (10ms-30s)

### Memory Management

**Strategies:**

1. **Lazy evaluation** - Use thunks to defer work
2. **Streaming** - Don't buffer entire response
3. **WeakMap caching** - Automatic GC
4. **Avoid large strings** - Yield incrementally

**Example:**
```javascript
// Don't do this (buffers everything)
const html = await collectResult(result);
return new Response(html);

// Do this (streams)
const stream = new RenderResultReadable(result);
return new Response(stream.getStream());
```

### Opcode Optimization

**🔴 DECISION POINT:** How should we optimize opcode execution?

**Options:**

A. **Generate minimal opcodes**
   - Skip opcodes for static-only sections
   - Combine adjacent text opcodes
   - Smaller opcode arrays

B. **Optimize hot paths**
   - Inline common operations
   - Avoid function calls in loops
   - Cache frequently accessed values

C. **JIT-style optimization**
   - Generate specialized functions per template
   - More memory but faster execution
   - Complex implementation

---

## Runtime Compatibility

### Target Runtimes

lit-ssr-edge targets **WinterTC-compatible runtimes** that implement the Minimum Common Web Platform API:

1. **Cloudflare Workers**
   - V8 isolate-based
   - 128 MB memory limit
   - Works **without** `nodejs_compat` flag
   - Uses pure Web Platform APIs

2. **Fastly Compute**
   - SpiderMonkey (WASI/WebAssembly)
   - Variable memory by plan
   - WinterTC-compliant

3. **Node.js 18+**
   - Modern LTS versions (18, 20, 22+)
   - Native Web Streams support
   - Native `fetch()` support (Node 18+)
   - WinterTC-compliant

4. **Deno**
   - Built on Web Platform APIs
   - WinterTC-compliant

5. **Bun**
   - Fast JavaScript runtime
   - WinterTC-compliant

### Platform Support Matrix

| Feature | Cloudflare | Fastly | Node.js 18+ | Deno | Bun |
|---------|------------|--------|-------------|------|-----|
| ReadableStream | ✅ | ✅ | ✅ | ✅ | ✅ |
| TextEncoder/Decoder | ✅ | ✅ | ✅ | ✅ | ✅ |
| URL APIs | ✅ | ✅ | ✅ | ✅ | ✅ |
| fetch() | ✅ | ✅ | ✅ | ✅ | ✅ |
| AbortController | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom elements (global) | ✅ | ✅ | ❌* | ✅ | ✅ |
| ESM modules | ✅ | ✅ | ✅ | ✅ | ✅ |

*Node.js requires DOM shim for `customElements` (provided by lit-ssr-edge)

### Cloudflare Workers: No nodejs_compat Required

lit-ssr-edge works on Cloudflare Workers **without** enabling the `nodejs_compat` compatibility flag.

**Why?**
- Uses only Web Platform APIs (WinterTC Minimum Common API)
- No Node.js-specific imports (`node:stream`, `node:fs`, etc.)
- No `process`, `Buffer`, `__dirname` usage
- Pure Web Streams implementation

**Configuration:**
```toml
# wrangler.toml - No nodejs_compat needed!
name = "my-lit-app"
main = "dist/worker.js"
compatibility_date = "2024-01-01"

# ❌ NOT needed:
# compatibility_flags = ["nodejs_compat"]
```

### Memory Constraints

- **Cloudflare Workers:** 128 MB
- **Fastly Compute:** Variable by plan
- **Node.js:** Variable (typically GB+)
- **Strategy:** Stream to avoid buffering (works everywhere)

### Execution Limits

- **Cloudflare Workers:** 10ms CPU (free), 30s (paid)
- **Fastly Compute:** Variable by plan
- **Node.js:** No strict limits
- **Strategy:** Efficient rendering, minimal processing

### Modern JavaScript & Node.js Versions

lit-ssr-edge assumes **modern JavaScript (ES2026)** and **modern runtime support**:

**JavaScript features:**
- Top-level `await`
- Optional chaining (`?.`)
- Nullish coalescing (`??`)
- `Promise.allSettled()`
- `String.prototype.replaceAll()`
- `Array.prototype.at()`
- `Object.hasOwn()`

**Node.js requirements (when using Node.js):**
- **Minimum:** Node.js 18.0.0 (LTS)
- **Recommended:** Node.js 20+ or 22+
- **Why 18+?**
  - Native `fetch()` (18.0+)
  - Native Web Streams (16.5+, stable in 18+)
  - Native `globalThis` (12+)
  - ESM loader stability (18+)

**Runtime detection:**
```javascript
// lit-ssr-edge detects runtime automatically
const isNode = typeof process !== 'undefined' &&
               process.versions?.node !== undefined;
const isCloudflare = typeof caches !== 'undefined' &&
                     caches.default !== undefined;
const isFastly = typeof fastly !== 'undefined';

// Uses appropriate APIs for each platform
```

### Module Loading

**🔴 DECISION POINT:** How should components be registered?

**Options:**

A. **Global customElements registry**
   ```javascript
   import './components-bundle.js';
   // Components auto-register
   ```
   - Simple for users
   - Global state
   - Potential conflicts

B. **Explicit registry**
   ```javascript
   import { MyElement } from './components.js';
   const registry = new ComponentRegistry();
   registry.define('my-element', MyElement);

   render(template, { registry });
   ```
   - Explicit control
   - No global state
   - More verbose

C. **Hybrid approach**
   ```javascript
   // Use global by default
   render(template);

   // Or provide custom registry
   render(template, { registry });
   ```
   - Flexible
   - Best of both worlds
   - Slight complexity

---

## Testing Architecture

### Test Structure

See [STRATEGY_TESTING.md](./STRATEGY_TESTING.md) for comprehensive testing strategy.

**Key points:**

1. **Baseline tests** - Run against both `@lit-labs/ssr` and `lit-ssr-edge`
2. **Full HTML comparison** - No partial matching
3. **Fixture-based** - Reusable components
4. **Renderer abstraction** - Switch implementations via env var

### Test Categories

1. ✅ Template rendering
2. ✅ Attribute binding
3. ✅ Directives
4. ✅ Components
5. ✅ Shadow DOM
6. ✅ Streaming
7. ✅ Server-only templates
8. ✅ Edge cases

---

## Decision Points

### ✅ Decision 1: Streaming Chunk Size

**Question:** What chunk size should we target for streaming?

**Options:**
- A) Small (256-1024 bytes) - Lower TTFB
- B) Medium (4-16 KB) - Balanced
- C) Large (64+ KB) - Higher throughput

**Recommendation:** Start with medium (8 KB), make configurable

**Decision:** **B - Medium (4-16 KB)** ✅

**Implementation:** Target 8 KB chunks by default, configurable via options if needed later.

---

### ✅ Decision 2: Opcode Optimization Level

**Question:** How aggressive should opcode optimization be?

**Options:**
- A) Minimal opcodes (combine adjacent, skip static)
- B) Hot path optimization (inline common operations)
- C) JIT-style (generate specialized functions)

**Recommendation:** Start with A, add B incrementally

**Decision:** **Start with A, add B incrementally based on performance measurements** ✅

**Implementation:**
- Phase 1: Implement minimal opcode optimization (combine adjacent text, skip static-only sections)
- Phase 2: Profile and identify hot paths, add inline optimizations where beneficial
- Measure impact at each step against baseline performance tests

---

### ✅ Decision 3: Component Registry Approach

**Question:** How should components be registered?

**Options:**
- A) Global `customElements` only
- B) Explicit registry required
- C) Hybrid (global default, custom optional)

**Recommendation:** C (hybrid) for flexibility

**Decision:** **C - Hybrid (global default, custom optional)** ✅

**Implementation:**
```javascript
export function render(value, options = {}) {
  const registry = options.registry || globalThis.customElements;
  return createRenderResult(value, registry, options);
}

// Simple case (uses global)
render(template);

// Advanced case (custom registry)
const registry = new ComponentRegistry();
registry.define('my-element', MyElement);
render(template, { registry });
```

**Benefits:**
- Simple migration from @lit-labs/ssr (global by default)
- Test isolation (custom registry per test)
- Multi-tenant support (custom registry per tenant)
- A/B testing (different component versions)

---

### ✅ Decision 4: parse5 Integration

**Question:** How should we include parse5?

**Options:**
- A) Runtime dependency (import from npm)
- B) Vendored/bundled (copy into src)
- C) Optional peer dependency

**Recommendation:** A (runtime dependency) - it's edge-compatible

**Decision:** **A - Runtime dependency from npm** ✅

**Implementation:**
```json
{
  "dependencies": {
    "parse5": "^7.1.2"
  }
}
```

**Rationale:**
- parse5 is pure JavaScript (edge-compatible)
- Well-maintained and stable
- No Node.js dependencies
- Used by @lit-labs/ssr (proven compatibility)

---

### ✅ Decision 5: Template Cache Scope

**Question:** Should template cache be global or per-request?

**Options:**
- A) Global cache (shared across requests)
- B) Per-request cache (isolated)
- C) Configurable (user chooses)

**Recommendation:** A (global) - templates are immutable and safe to share

**Decision:** **A - Global cache shared across requests** ✅

**Implementation:**
```javascript
// Module-level cache (shared across all requests)
const templateCache = new WeakMap();

function getTemplate(strings) {
  let template = templateCache.get(strings);
  if (!template) {
    template = parseTemplate(strings);
    templateCache.set(strings, template);
  }
  return template;
}
```

**Rationale:**
- Templates are immutable (TemplateStringsArray never changes)
- Safe to share across requests (no mutable state)
- Better performance (parse once, reuse forever)
- Lower memory usage (single cache vs per-request)
- WeakMap ensures automatic cleanup when templates are GC'd

---

### ✅ Decision 6: Directive Support Level

**Question:** Which directives should we support initially?

**Options:**
- A) SSR-safe only (repeat, map, when, choose, ifDefined, guard)
- B) SSR-safe + partial (add classMap, styleMap with render() only)
- C) All directives (throw errors for client-only ones)

**Recommendation:** B (safe + partial) for better compatibility

**Decision:** **B - SSR-safe + partial support** ✅

**Implementation:**

**Full support (render() works on server):**
- `repeat` - List rendering with keys
- `map` - Array transformation
- `join` - Join items with separator
- `range` - Number sequence generation
- `when` - Conditional rendering
- `choose` - Multi-way conditional
- `ifDefined` - Conditional attributes
- `guard` - Prevent unnecessary re-renders

**Partial support (render() only, update() client-only):**
- `classMap` - CSS class management
- `styleMap` - Inline style management
- `keyed` - Force re-render on key change

**Not supported (client-only):**
- `cache`, `live`, `until`, `asyncAppend`, `asyncReplace`, `ref`, `templateContent`

**Validation:** Throw clear errors for unsupported directives with suggestions.

---

### ✅ Decision 7: Error Handling Verbosity

**Question:** How detailed should error messages be?

**Options:**
- A) Minimal (short messages, low overhead)
- B) Detailed (stack traces, context, suggestions)
- C) Configurable (dev vs production mode)

**Recommendation:** C (configurable) - detailed in dev, minimal in prod

**Decision:** **C - Configurable (dev mode vs production mode)** ✅

**Implementation:**
```javascript
// Detect environment
const isDev = process.env.NODE_ENV !== 'production';

function createError(message, details) {
  if (isDev) {
    // Detailed error with context and suggestions
    return new LitEdgeError(
      `${message}\n\nContext: ${details.context}\n\nSuggestion: ${details.suggestion}`,
      { cause: details.cause }
    );
  } else {
    // Minimal error for production
    return new LitEdgeError(message);
  }
}
```

**Dev mode:**
```
TemplateError: Failed to parse template

Context: Template contains invalid HTML structure at line 5, column 12
  <div class="foo>
              ^
Suggestion: Check for unclosed quotes in attribute values

  at parseTemplate (template-cache.js:45)
  at getTemplate (template-cache.js:23)
  ...
```

**Production mode:**
```
TemplateError: Failed to parse template
```

---

### 🔴 Decision 8: Build Target

**Question:** What should the build output format be?

**Options:**
- A) Single ESM bundle (all-in-one)
- B) Multiple ESM modules (user bundles)
- C) Both (provide pre-built and source)

**Recommendation:** B (multiple modules) - users bundle for their platform

**Your choice:** ___________

---

## Implementation Phases

### Phase 0: Baseline Integration Tests (No Implementation)

**Goals:**
- Establish comprehensive integration test suite
- All tests pass against original @lit-labs/ssr
- Zero lit-ssr-edge implementation code

**Deliverables:**
- Test infrastructure (helpers, fixtures, renderer abstraction)
- Baseline test suite covering:
  - Template rendering (primitives, expressions, nesting)
  - Attribute binding (boolean, property, multi-value)
  - Directives (repeat, map, when, classMap, etc.)
  - Components (simple, with properties, with styles, nested)
  - Shadow DOM (declarative shadow roots, slots)
  - Streaming (ReadableStream output)
  - Server-only templates (document rendering, composition)
  - Edge cases (nothing, null, undefined, deep nesting)

**Success Criteria:**
- ✅ All tests pass with `TEST_IMPL=lit-ssr`
- ✅ Tests use renderer abstraction (ready for lit-ssr-edge)
- ✅ Fixtures cover common use cases
- ✅ Full HTML comparison (no partial matching)

**Estimated effort:** 1-2 weeks

---

### Phase 1: Baseline Performance Tests (No Implementation)

**Goals:**
- Establish performance baseline
- Measure @lit-labs/ssr performance characteristics
- Create benchmark suite for comparison

**Deliverables:**
- Performance test suite:
  - Simple template rendering (primitives, expressions)
  - Complex templates (nested, conditional)
  - List rendering (small, medium, large arrays)
  - Component rendering (simple, complex)
  - Streaming performance (TTFB, throughput)
  - Memory usage profiling
- Baseline metrics documented:
  - Average render time per template type
  - Memory consumption patterns
  - Streaming characteristics
  - CPU usage profiles

**Success Criteria:**
- ✅ Consistent benchmark results for @lit-labs/ssr
- ✅ Performance metrics documented
- ✅ Benchmark suite ready for lit-ssr-edge comparison

**Estimated effort:** 1 week

---

### Phase 2: Core Rendering (Foundation)

**Goals:**
- Basic template rendering
- Primitive value handling
- Template caching
- Web Streams output

**Deliverables:**
- `render()` function
- `RenderResult` iterable
- `RenderResultReadable` stream wrapper
- Template parser with parse5
- Basic opcode system
- HTML escaping

**Tests:**
- Run baseline tests with `TEST_IMPL=lit-ssr-edge`
- Simple templates
- Primitives (string, number, boolean)
- Nested templates
- Arrays

**Success Criteria:**
- ✅ Basic template tests pass
- ✅ Streaming tests pass
- ✅ Output matches @lit-labs/ssr

**Estimated effort:** 2-3 weeks

---

### Phase 3: Hydration Support

**Goals:**
- Generate correct hydration markers
- Calculate template digests
- Support regular vs server-only templates

**Deliverables:**
- Digest calculation (exact DJB2 algorithm)
- Marker generation (`lit-part`, `lit-node`)
- Server-only template detection
- Template type handling

**Tests:**
- Marker generation tests
- Digest compatibility tests
- Server-only template tests
- Template composition tests

**Success Criteria:**
- ✅ Hydration marker tests pass
- ✅ Digests match @lit-labs/ssr exactly
- ✅ Server-only templates work correctly
- ✅ Client hydration works with @lit-labs/ssr-client

**Estimated effort:** 1-2 weeks

---

### Phase 4: Component Support

**Goals:**
- Render LitElement components
- Generate declarative shadow DOM
- Handle component lifecycle

**Deliverables:**
- DOM shim (minimal)
- Component instantiation
- Property handling
- Shadow DOM generation
- Style serialization

**Tests:**
- Simple component tests
- Components with properties
- Components with styles
- Nested components
- Slotted content tests

**Success Criteria:**
- ✅ Component tests pass
- ✅ Declarative shadow DOM correct
- ✅ Styles embedded properly
- ✅ Components hydrate on client

**Estimated effort:** 2-3 weeks

---

### Phase 5: Directive Support

**Goals:**
- Support SSR-compatible directives
- Directive resolution and patching

**Deliverables:**
- Directive detection
- Directive patching
- Built-in directives:
  - Full: repeat, map, join, range, when, choose, ifDefined, guard
  - Partial: classMap, styleMap, keyed

**Tests:**
- Directive tests from baseline suite
- repeat directive
- map directive
- when/choose directives
- classMap/styleMap (render only)

**Success Criteria:**
- ✅ All directive tests pass
- ✅ Output matches @lit-labs/ssr
- ✅ Clear errors for unsupported directives

**Estimated effort:** 2 weeks

---

### Phase 6: Optimization & Polish

**Goals:**
- Performance optimization
- Error handling refinement
- Documentation completion

**Deliverables:**
- Opcode optimization (minimal + hot path)
- Chunk size tuning (8 KB default)
- Comprehensive error messages (dev mode)
- API documentation
- Examples for Cloudflare Workers and Fastly Compute
- Migration guide from @lit-labs/ssr

**Tests:**
- Performance benchmarks vs Phase 1 baseline
- Edge case handling
- Error message clarity
- Memory profiling

**Success Criteria:**
- ✅ All baseline tests pass
- ✅ Performance within 2x of @lit-labs/ssr (target: 1x or better)
- ✅ Memory usage reasonable
- ✅ Complete documentation
- ✅ Working examples for both platforms

**Estimated effort:** 2 weeks

---

### Total Estimated Timeline

- Phase 0 (Tests): 1-2 weeks
- Phase 1 (Benchmarks): 1 week
- Phase 2 (Core): 2-3 weeks
- Phase 3 (Hydration): 1-2 weeks
- Phase 4 (Components): 2-3 weeks
- Phase 5 (Directives): 2 weeks
- Phase 6 (Polish): 2 weeks

**Total: 11-15 weeks (3-4 months)**

---

## Success Criteria

### Functional Requirements

- ✅ Renders Lit templates to HTML strings
- ✅ Generates hydration markers compatible with `@lit-labs/ssr-client`
- ✅ Supports server-only templates
- ✅ Renders LitElement components with declarative shadow DOM
- ✅ Handles SSR-compatible directives
- ✅ Streams output via Web Streams API
- ✅ Runs on Cloudflare Workers and Fastly Compute

### Quality Requirements

- ✅ All baseline tests pass against both implementations
- ✅ Output matches `@lit-labs/ssr` (byte-for-byte after normalization)
- ✅ Performance within 2x of `@lit-labs/ssr`
- ✅ Memory usage stays under 50% of edge worker limit
- ✅ No Node.js dependencies
- ✅ 100% ESM modules

### Documentation Requirements

- ✅ API documentation
- ✅ Usage examples for each edge platform
- ✅ Migration guide from `@lit-labs/ssr`
- ✅ Architecture documentation (this document)
- ✅ Testing strategy

---

## References

### Research Documentation

- [AGENT.md](../AGENT.md) - Project overview and guidance
- [STRATEGY_TESTING.md](./STRATEGY_TESTING.md) - Testing strategy
- [insight/README.md](./insight/README.md) - Research index
- [insight/lit-html-core.md](./insight/lit-html-core.md) - Template system
- [insight/lit-reactive-element.md](./insight/lit-reactive-element.md) - Reactive properties
- [insight/lit-directives.md](./insight/lit-directives.md) - Directive system
- [insight/lit-styles.md](./insight/lit-styles.md) - CSS handling
- [insight/lit-ssr-internals.md](./insight/lit-ssr-internals.md) - SSR architecture
- [insight/lit-hydration.md](./insight/lit-hydration.md) - Hydration system
- [insight/lit-server-only-templates.md](./insight/lit-server-only-templates.md) - Server-only templates
- [insight/edge-runtimes.md](./insight/edge-runtimes.md) - Edge runtime APIs
- [insight/node-dependencies.md](./insight/node-dependencies.md) - Dependency replacement

### External References

- [Lit Documentation](https://lit.dev/docs/)
- [@lit-labs/ssr](https://github.com/lit/lit/tree/main/packages/labs/ssr)
- [@lit-labs/ssr-client](https://github.com/lit/lit/tree/main/packages/labs/ssr-client)
- [WinterTC Specification](https://min-common-api.proposal.wintertc.org/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Fastly Compute](https://www.fastly.com/documentation/guides/compute/javascript/)
