# Lit SSR Internals - Deep Dive Research Document

## Executive Summary

Lit SSR (`@lit-labs/ssr`) is a server-side rendering solution for Lit templates and components. It enables rendering web components to static HTML in Node.js environments without fully emulating the browser DOM. This document provides a comprehensive analysis of the internals, architecture, dependencies, and rendering pipeline.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Package Structure](#package-structure)
3. [Core Rendering Pipeline](#core-rendering-pipeline)
4. [DOM Shim System](#dom-shim-system)
5. [Module Loading and Resolution](#module-loading-and-resolution)
6. [Template Rendering](#template-rendering)
7. [Node.js Dependencies](#nodejs-dependencies)
8. [Streaming Support](#streaming-support)
9. [Hydration Mechanism](#hydration-mechanism)
10. [Limitations and Constraints](#limitations-and-constraints)
11. [Key Files Reference](#key-files-reference)

---

## Architecture Overview

### High-Level Design

Lit SSR operates on a fundamentally different model than traditional DOM-based SSR solutions. Instead of emulating a full browser DOM, it:

1. **Parses templates** into an optimized operation sequence (opcodes) using `parse5`
2. **Generates HTML strings** by walking through opcodes and rendering values
3. **Supports streaming** via thunked (lazy-evaluated) render results
4. **Provides minimal DOM shims** only for APIs that Lit components require during initialization

### Core Design Principles

```
┌─────────────────────────────────────────────────────────────────┐
│                        Lit SSR Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Template    │───▶│   Opcode     │───▶│  Thunked Result  │  │
│  │   Input      │    │  Generation  │    │    (Lazy Eval)   │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│                              │                     │            │
│                              ▼                     ▼            │
│                      ┌──────────────┐    ┌──────────────────┐  │
│                      │   parse5     │    │  String/Stream   │  │
│                      │   (HTML AST) │    │     Output       │  │
│                      └──────────────┘    └──────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    DOM Shim Layer                         │   │
│  │  EventTarget │ Element │ HTMLElement │ CustomElements     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Package Structure

### @lit-labs/ssr (Main Package)

```
packages/labs/ssr/
├── src/
│   ├── lib/
│   │   ├── dom-shim.ts              # Window object shim
│   │   ├── element-renderer.ts       # Base element renderer
│   │   ├── install-global-dom-shim.ts # Global shim installation
│   │   ├── lit-element-renderer.ts   # LitElement-specific renderer
│   │   ├── module-loader.ts          # VM-based module loader
│   │   ├── reflected-attributes.ts   # HTML attribute reflection mapping
│   │   ├── render.ts                 # Main render entry point
│   │   ├── render-lit-html.ts        # Deprecation wrapper
│   │   ├── render-module.ts          # Isolated module rendering
│   │   ├── render-result.ts          # Result types and collectors
│   │   ├── render-result-readable.ts # Node.js Readable stream
│   │   ├── render-value.ts           # Core value rendering logic
│   │   ├── render-with-global-dom-shim.ts # Shim + render export
│   │   ├── server-template.ts        # Server-only templates
│   │   └── util/
│   │       └── escape-html.ts        # HTML escaping utility
│   └── ...
├── package.json
└── ...
```

### @lit-labs/ssr-dom-shim (DOM Polyfills)

```
packages/labs/ssr-dom-shim/
├── src/
│   ├── index.ts                      # Main shim exports
│   └── css-shim.ts                   # CSS-related shims
├── register-css-hook.js              # Node.js CSS import hooks
└── package.json
```

---

## Core Rendering Pipeline

### Entry Points

The SSR package provides two primary rendering approaches:

#### 1. Global Scope Rendering

```typescript
import {render} from '@lit-labs/ssr';
import {html} from 'lit';

const result = render(html`<my-element></my-element>`);
```

#### 2. Isolated VM Context Rendering

```typescript
import {renderModule} from '@lit-labs/ssr/lib/render-module.js';

const result = await renderModule(
  './my-component.js',
  import.meta.url,
  'renderTemplate',
  [data]
);
```

### Rendering Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Rendering Pipeline                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. render(templateResult)                                       │
│          │                                                       │
│          ▼                                                       │
│  2. renderThunked(value, renderInfo)                            │
│          │                                                       │
│          ▼                                                       │
│  3. renderValue(value, renderInfo, hydratable)                  │
│          │                                                       │
│          ├──▶ isTemplateResult? ──▶ renderTemplateResult()      │
│          │                                                       │
│          ├──▶ isDirective? ──▶ renderLight()                    │
│          │                                                       │
│          └──▶ isPrimitive? ──▶ escapeHtml() + yield             │
│                                                                  │
│  4. renderTemplateResult(result, renderInfo)                    │
│          │                                                       │
│          ▼                                                       │
│  5. getTemplateOpcodes(result) ──▶ parse5 AST                   │
│          │                                                       │
│          ▼                                                       │
│  6. Process opcodes sequentially:                               │
│          ├── text-opcode ──▶ yield string                       │
│          ├── child-part ──▶ renderValue(expression)             │
│          ├── attribute-part ──▶ serialize attribute             │
│          ├── custom-element-open ──▶ ElementRenderer.create()   │
│          ├── custom-element-shadow ──▶ renderShadow()           │
│          └── custom-element-close ──▶ finalize                  │
│                                                                  │
│  7. ThunkedRenderResult (Array<string | Thunk>)                 │
│          │                                                       │
│          ├──▶ collectResultSync() ──▶ String                    │
│          ├──▶ collectResult() ──▶ Promise<String>               │
│          └──▶ RenderResultReadable ──▶ Node.js Stream           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### The Opcode System

Templates are compiled into a sequence of operations (opcodes) that enable efficient streaming:

```typescript
type Opcode =
  | {type: 'text'; value: string}
  | {type: 'child-part'; index: number}
  | {type: 'attribute-part'; name: string; index: number}
  | {type: 'property-part'; name: string; index: number}
  | {type: 'boolean-attribute-part'; name: string; index: number}
  | {type: 'event-part'; name: string; index: number}
  | {type: 'custom-element-open'; tagName: string}
  | {type: 'custom-element-shadow'}
  | {type: 'custom-element-close'};
```

### RenderInfo Context

The rendering context maintains state throughout the render:

```typescript
interface RenderInfo {
  // Registry of element renderers (e.g., LitElementRenderer)
  elementRenderers: ElementRendererConstructor[];

  // Stack tracking open custom elements
  customElementStack: string[];

  // Stack tracking event targets for composed paths
  eventTargetStack: EventTarget[];

  // Current slot context for light DOM distribution
  slotContext?: {name: string; parent: Element};

  // Whether output should include hydration markers
  hydratable: boolean;
}
```

---

## DOM Shim System

### Purpose

The DOM shim provides minimal browser API implementations that Lit needs during server-side initialization. Unlike JSDOM, it does NOT fully emulate the DOM - it provides just enough for Lit components to instantiate.

### Shim Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DOM Shim Hierarchy                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  globalThis.EventTarget (shimmed)                               │
│         │                                                        │
│         ├──▶ addEventListener(type, callback)                   │
│         ├──▶ removeEventListener(type, callback)                │
│         └──▶ dispatchEvent(event)                               │
│                                                                  │
│  globalThis.Element extends EventTarget                         │
│         │                                                        │
│         ├──▶ attachShadow(options) ──▶ ShadowRoot              │
│         ├──▶ getAttribute(name)                                 │
│         ├──▶ setAttribute(name, value)                          │
│         ├──▶ hasAttribute(name)                                 │
│         ├──▶ removeAttribute(name)                              │
│         ├──▶ toggleAttribute(name, force?)                      │
│         └──▶ attachInternals() ──▶ ElementInternals            │
│                                                                  │
│  globalThis.HTMLElement extends Element                         │
│         │                                                        │
│         └──▶ (no additional methods)                            │
│                                                                  │
│  globalThis.CustomElementRegistry                               │
│         │                                                        │
│         ├──▶ define(name, constructor)                          │
│         ├──▶ get(name) ──▶ constructor                          │
│         ├──▶ getName(constructor) ──▶ string                    │
│         ├──▶ whenDefined(name) ──▶ Promise                      │
│         └──▶ upgrade() ──▶ throws (not supported in SSR)        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Window Shim (dom-shim.ts)

The `getWindow()` function creates a minimal window object:

```typescript
function getWindow(options?: {includeJSBuiltIns?: boolean}): Window {
  return {
    // Core DOM classes
    EventTarget,
    Event,
    CustomEvent,
    Element,
    HTMLElement,
    Document,
    ShadowRoot,
    CSSStyleSheet,
    CustomElementRegistry,
    customElements: new CustomElementRegistry(),

    // Browser APIs
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    fetch: nodeFetch,
    location: new URL('http://localhost'),
    MutationObserver: NoOpMutationObserver,
    requestAnimationFrame: () => {},

    // Optional JS built-ins (when includeJSBuiltIns=true)
    setTimeout: () => {},
    clearTimeout: () => {},
    Buffer,
    URL,
    URLSearchParams,
    console,
  };
}
```

### CSS Shims

The DOM shim also provides CSS-related APIs:

```typescript
// CSS classes shimmed for SSR
class CSSStyleSheet {
  cssRules: CSSRuleList = [];
  replaceSync(text: string): void { /* no-op */ }
  replace(text: string): Promise<CSSStyleSheet> { /* no-op */ }
}

class CSSRule { /* minimal implementation */ }
class CSSRuleList { /* array-like implementation */ }
class MediaList { /* minimal implementation */ }
class StyleSheet { /* minimal implementation */ }
```

### Global Installation

The shim is installed via `install-global-dom-shim.ts`:

```typescript
// Imports CSS hook for .css file imports
import '@lit-labs/ssr-dom-shim/register-css-hook.js';

// Installs window object on globalThis
import {installWindowOnGlobal} from './dom-shim.js';
installWindowOnGlobal();
```

---

## Module Loading and Resolution

### ModuleLoader Class

For isolated rendering, the `ModuleLoader` class provides VM-based module loading:

```typescript
class ModuleLoader {
  // VM context for isolated execution
  private _vmContext: vm.Context;

  // Module cache by file path
  private _modules: Map<string, ModuleRecord>;

  // Unique context ID to prevent v8 crashes
  private _vmContextId: string;

  async importModule(specifier: string, referrer: string): Promise<vm.Module>;
  private async resolveSpecifier(specifier: string, referrer: string): string;
  private async loadModule(specifier: string): ModuleRecord;
}
```

### Module Resolution Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Module Resolution Flow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  resolveSpecifier(specifier, referrer)                          │
│         │                                                        │
│         ├──▶ Try parse as full URL                              │
│         │         │                                              │
│         │         └──▶ Success? Return URL                      │
│         │                                                        │
│         ├──▶ Relative path (./ or ../)                          │
│         │         │                                              │
│         │         └──▶ Resolve from referrer directory          │
│         │                                                        │
│         └──▶ Bare specifier (package name)                      │
│                   │                                              │
│                   ▼                                              │
│         enhanced-resolve with conditions:                        │
│         ['node', 'module', 'import']                            │
│                   │                                              │
│                   ▼                                              │
│         Special handling for lit packages:                       │
│         Redirect to consistent SSR-compatible versions          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Node.js Dependencies for Module Loading

```typescript
// Required Node.js built-in modules
import * as vm from 'vm';
import * as fs from 'fs/promises';
import * as path from 'path';
import {builtinModules, createRequire} from 'module';
import {fileURLToPath, pathToFileURL} from 'url';

// External dependency
import {ResolverFactory} from 'enhanced-resolve';
```

---

## Template Rendering

### Lit Template Internals

Lit templates use tagged template literals:

```typescript
const template = html`<div class=${className}>${content}</div>`;
```

The browser/SSR processes these into:

1. **Static strings**: `['<div class="', '">', '</div>']`
2. **Dynamic values**: `[className, content]`

### parse5 Integration

Templates are parsed into AST using `parse5`:

```typescript
function getTemplateOpcodes(result: TemplateResult): Opcode[] {
  // Check cache first
  const cached = templateCache.get(result.strings);
  if (cached) return cached;

  // Parse HTML to AST with source locations
  const ast = parse5.parseFragment(result.strings.join(''), {
    sourceCodeLocationInfo: true
  });

  // Walk AST and generate opcodes
  const opcodes = generateOpcodes(ast, result);

  // Cache for reuse
  templateCache.set(result.strings, opcodes);
  return opcodes;
}
```

### Server-Only Templates

The SSR package provides a special `html` function for server-only content:

```typescript
import {html} from '@lit-labs/ssr';

// Server-only template supports:
// - DOCTYPE declarations
// - <title>, <textarea>, <template> elements
// - Non-executing <script> tags
// - Full HTML documents

const page = html`
  <!DOCTYPE html>
  <html>
    <head><title>${title}</title></head>
    <body>${content}</body>
  </html>
`;
```

Server-only templates are marked with `_$litServerRenderMode: SERVER_ONLY` and throw if instantiated in the browser.

---

## Node.js Dependencies

### Critical Dependencies Requiring Replacement for Edge Runtime

| Module | Usage | Replacement Strategy |
|--------|-------|---------------------|
| `vm` | Isolated module execution | Not needed for basic SSR; use global scope rendering |
| `fs/promises` | Module source loading | Bundle components ahead-of-time |
| `stream.Readable` | Streaming output | Web Streams API (`ReadableStream`) |
| `module.builtinModules` | Built-in detection | Static list or remove |
| `module.createRequire` | CommonJS interop | ESM-only approach |
| `enhanced-resolve` | npm-style resolution | Pre-bundled modules |
| `node-fetch` | HTTP requests | Native `fetch` (available in edge) |
| `Buffer` | Base64 encoding | `btoa`/`atob` or `TextEncoder` |

### Dependency Analysis

```
@lit-labs/ssr
├── @lit-labs/ssr-client (peer)
├── @lit-labs/ssr-dom-shim (required)
├── lit, lit-html, lit-element (peer)
├── parse5 (required) ──▶ Pure JS, edge-compatible
├── @parse5/tools (required) ──▶ Pure JS, edge-compatible
├── enhanced-resolve (required) ──▶ Node.js specific
└── node-fetch (required) ──▶ Replace with native fetch
```

### Edge-Compatible vs Node-Specific

```
┌─────────────────────────────────────────────────────────────────┐
│                    Dependency Classification                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Edge-Compatible (Pure JS):                                     │
│  ├── parse5 (HTML parsing)                                      │
│  ├── @parse5/tools (AST utilities)                              │
│  ├── lit-html (template processing)                             │
│  ├── @lit-labs/ssr-dom-shim (DOM polyfills)                    │
│  └── Core render-value.ts logic                                 │
│                                                                  │
│  Node.js-Specific (Requires Replacement):                       │
│  ├── vm module (isolated contexts)                              │
│  ├── fs module (file reading)                                   │
│  ├── module module (resolution)                                 │
│  ├── enhanced-resolve (npm resolution)                          │
│  ├── stream.Readable (Node streams)                             │
│  └── node-fetch (HTTP client)                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Streaming Support

### Thunked Render Results

SSR output uses "thunks" (lazy functions) for efficient streaming:

```typescript
type Thunk = () => string | Array<string | Thunk> | Promise<...>;
type ThunkedRenderResult = Array<string | Thunk>;
```

### Result Collection Methods

```typescript
// Synchronous collection (throws on Promises)
function collectResultSync(result: RenderResult): string;

// Asynchronous collection (handles Promises)
async function collectResult(result: RenderResult): Promise<string>;
```

### RenderResultReadable (Node.js Stream)

```typescript
class RenderResultReadable extends Readable {
  private _stack: Iterator<string | Thunk | Promise<...>>[];
  private _waiting: boolean = false;

  _read(): void {
    // Process stack until backpressure or completion
    while (this._stack.length > 0) {
      const current = this._stack[this._stack.length - 1];
      const {value, done} = current.next();

      if (done) {
        this._stack.pop();
        continue;
      }

      if (typeof value === 'string') {
        if (!this.push(value)) return; // backpressure
      } else if (typeof value === 'function') {
        // Trampoline thunk
        this._stack.push(iterify(value()));
      } else if (value instanceof Promise) {
        this._waiting = true;
        value.then(resolved => {
          this._waiting = false;
          this._stack.push(iterify(resolved));
          this._read();
        });
        return;
      }
    }
    this.push(null); // end stream
  }
}
```

### Edge-Compatible Streaming Alternative

For edge runtimes, replace with Web Streams:

```typescript
function createRenderStream(result: RenderResult): ReadableStream<string> {
  const iterator = result[Symbol.iterator]();

  return new ReadableStream({
    async pull(controller) {
      const {value, done} = iterator.next();

      if (done) {
        controller.close();
        return;
      }

      if (typeof value === 'string') {
        controller.enqueue(value);
      } else if (value instanceof Promise) {
        const resolved = await value;
        // Handle resolved value...
      }
    }
  });
}
```

---

## Hydration Mechanism

### Server-Side Output

SSR generates Declarative Shadow DOM:

```html
<my-element>
  <template shadowrootmode="open">
    <style>:host { display: block; }</style>
    <div>Shadow content</div>
  </template>
</my-element>
```

### Client-Side Hydration

```typescript
// Must load BEFORE component modules
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';

// Then load components
import './my-element.js';
```

### Hydration Process

```
┌─────────────────────────────────────────────────────────────────┐
│                      Hydration Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Browser parses HTML with <template shadowrootmode>          │
│         │                                                        │
│         ▼                                                        │
│  2. Native/polyfilled Declarative Shadow DOM attaches roots     │
│         │                                                        │
│         ▼                                                        │
│  3. Hydration support module patches LitElement                 │
│         │                                                        │
│         ▼                                                        │
│  4. Component class definition loads                            │
│         │                                                        │
│         ▼                                                        │
│  5. Custom element upgrades ──▶ connectedCallback()             │
│         │                                                        │
│         ▼                                                        │
│  6. LitElement.hydrate() reconnects reactive expressions        │
│         │                                                        │
│         ▼                                                        │
│  7. Component is fully interactive                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Limitations and Constraints

### Current SSR Limitations

1. **Async Components**: Async rendering not fully supported
2. **Shadow DOM Required**: Only shadow DOM components work
3. **Browser Support**: Declarative Shadow DOM needs polyfill in some browsers
4. **DOM Access**: Limited to specific lifecycle callbacks

### Lifecycle Methods on Server

| Method | Runs on Server | Safe for DOM Access |
|--------|---------------|---------------------|
| `constructor()` | Yes | No |
| `hasChanged()` | Yes | No |
| `willUpdate()` | Yes | No |
| `render()` | Yes | No |
| `connectedCallback()` | Optional* | No |
| `updated()` | No | Yes |
| `firstUpdated()` | No | Yes |
| `disconnectedCallback()` | No | Yes |

*Requires `globalThis.litSsrCallConnectedCallback = true`

### DOM Shim Limitations

The shim does NOT provide:

- `document.querySelector()` / `querySelectorAll()`
- `element.innerHTML` / `outerHTML`
- `element.children` / `childNodes`
- `getComputedStyle()`
- `getBoundingClientRect()`
- Full event bubbling/capture
- `MutationObserver` (no-op implementation)
- `IntersectionObserver`
- `ResizeObserver`

---

## Key Files Reference

### Core Rendering

| File | Responsibility |
|------|---------------|
| `render.ts` | Main entry point, `render()` and `renderThunked()` |
| `render-value.ts` | Core value rendering, opcode processing |
| `render-result.ts` | Result types, `collectResult()` functions |
| `render-result-readable.ts` | Node.js Readable stream integration |

### Element Rendering

| File | Responsibility |
|------|---------------|
| `element-renderer.ts` | Base `ElementRenderer` class |
| `lit-element-renderer.ts` | LitElement-specific rendering |
| `reflected-attributes.ts` | HTML attribute reflection mapping |

### DOM Shim

| File | Responsibility |
|------|---------------|
| `dom-shim.ts` | Window object and DOM class shims |
| `install-global-dom-shim.ts` | Global installation |
| `@lit-labs/ssr-dom-shim/index.ts` | Core Element/EventTarget shims |

### Module Loading

| File | Responsibility |
|------|---------------|
| `module-loader.ts` | VM-based module loading |
| `render-module.ts` | Isolated rendering entry point |

### Utilities

| File | Responsibility |
|------|---------------|
| `escape-html.ts` | XSS-safe HTML escaping |
| `server-template.ts` | Server-only template function |

---

## Summary for Edge Runtime Adaptation

To adapt Lit SSR for edge runtimes, the following changes are required:

### Must Replace

1. **`stream.Readable`** -> Web Streams API (`ReadableStream`)
2. **`vm` module** -> Global scope rendering only (no isolation)
3. **`fs` module** -> Pre-bundled components
4. **`enhanced-resolve`** -> Pre-resolved module graph
5. **`node-fetch`** -> Native `fetch`
6. **`Buffer`** -> `TextEncoder`/`TextDecoder` or `btoa`/`atob`

### Can Reuse

1. **`parse5`** - Pure JavaScript, edge-compatible
2. **`@lit-labs/ssr-dom-shim`** - Pure JavaScript shims
3. **Core rendering logic** in `render-value.ts`
4. **Template opcode generation** and caching
5. **Element renderer architecture**

### Architecture Recommendation

```
┌─────────────────────────────────────────────────────────────────┐
│                  Edge-Compatible Lit SSR                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Pre-build Phase:                                               │
│  ├── Bundle all components with esbuild                        │
│  ├── Pre-compute template opcodes (optional optimization)       │
│  └── Tree-shake unused code                                     │
│                                                                  │
│  Runtime:                                                        │
│  ├── Use global scope rendering (no VM isolation)              │
│  ├── Install DOM shims on globalThis                            │
│  ├── Render templates to Web ReadableStream                     │
│  └── Return streaming response                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## References

- [Lit SSR Documentation](https://lit.dev/docs/ssr/overview/)
- [Lit SSR GitHub Repository](https://github.com/lit/lit/tree/main/packages/labs/ssr)
- [Lit SSR DOM Shim](https://github.com/lit/lit/tree/main/packages/labs/ssr-dom-shim)
- [@lit-labs/ssr npm package](https://www.npmjs.com/package/@lit-labs/ssr)
