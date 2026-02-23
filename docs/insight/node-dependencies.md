# Node.js Dependencies in Lit SSR: Analysis and Edge Runtime Replacement Strategies

This document analyzes the Node.js-specific dependencies used in `@lit-labs/ssr` and provides edge-compatible replacement strategies for each.

## Executive Summary

The Lit SSR package (`@lit-labs/ssr`) has several Node.js-specific dependencies that prevent direct use in edge runtimes like Cloudflare Workers, Deno Deploy, and Vercel Edge Runtime. This analysis covers each dependency, explains its usage, and proposes edge-compatible alternatives.

| Dependency | Node.js API | Edge Alternative | Complexity |
|------------|-------------|------------------|------------|
| stream.Readable | Node streams | Web Streams API (ReadableStream) | Medium |
| vm module | VM contexts | V8 Isolates (built-in) / Remove need | High |
| enhanced-resolve | Module resolution | Static bundling / import.meta.resolve | Medium |
| node-fetch | HTTP client | Native fetch() | Low |
| fs/path | File system | Static bundling / URL imports | Medium |
| parse5 | HTML parsing | Compatible (pure JS) | Low |

---

## 1. stream.Readable

### Current Usage in Lit SSR

**File:** `packages/labs/ssr/src/lib/render-result-readable.ts`

The `RenderResultReadable` class extends Node.js's `stream.Readable` to provide streaming HTML output:

```typescript
import {Readable} from 'stream';
import {RenderResult} from './render-result.js';

export class RenderResultReadable extends Readable {
  private _iterators: Array<RenderResultIterator>;
  private _currentIterator?: RenderResultIterator;
  private _waiting = false;

  constructor(result: RenderResult | ThunkedRenderResult) {
    super();
    this._iterators = [result[Symbol.iterator]()];
  }

  override async _read(_size: number) {
    // Iterates through RenderResult, pushing string chunks
    // Handles async values via Promise resolution
    // Manages backpressure via this.push() return value
  }
}
```

### Why It's Needed

- **Streaming HTML**: Allows sending HTML chunks to the client as they're rendered
- **Memory Efficiency**: Avoids buffering the entire HTML response in memory
- **Backpressure Handling**: Node streams handle flow control automatically
- **Async Value Resolution**: The `_waiting` flag prevents race conditions when resolving Promises

### Edge-Compatible Replacement: Web Streams API

The Web Streams API (`ReadableStream`) is available in all modern edge runtimes and provides equivalent functionality.

```typescript
import {RenderResult, ThunkedRenderResult, Thunk} from './render-result.js';

type RenderResultIterator = Iterator<string | Thunk | Promise<RenderResult>>;

export class RenderResultReadableStream {
  private stream: ReadableStream<Uint8Array>;

  constructor(result: RenderResult | ThunkedRenderResult) {
    const encoder = new TextEncoder();
    const iterators: Array<RenderResultIterator> = [result[Symbol.iterator]()];
    let currentIterator: RenderResultIterator | undefined = iterators.pop();

    this.stream = new ReadableStream({
      async pull(controller) {
        while (currentIterator !== undefined) {
          const next = currentIterator.next();

          if (next.done === true) {
            currentIterator = iterators.pop();
            continue;
          }

          let value = next.value;

          // Resolve thunks
          while (typeof value === 'function') {
            value = value();
          }

          if (value === undefined) {
            continue;
          }

          // Handle string values - enqueue and return for backpressure
          if (typeof value === 'string') {
            controller.enqueue(encoder.encode(value));
            return;
          }

          // Handle nested iterables
          if (Array.isArray(value) || typeof value[Symbol.iterator] === 'function') {
            iterators.push(currentIterator);
            currentIterator = value[Symbol.iterator]();
            continue;
          }

          // Handle Promises
          if (typeof value.then === 'function') {
            value = await value;
            // Process resolved value in next iteration
            continue;
          }
        }

        // All iterators exhausted
        controller.close();
      },

      cancel() {
        // Clean up if stream is cancelled
        iterators.length = 0;
        currentIterator = undefined;
      }
    });
  }

  getStream(): ReadableStream<Uint8Array> {
    return this.stream;
  }
}

// Usage with edge runtime Response
export function renderToStream(result: RenderResult): Response {
  const readable = new RenderResultReadableStream(result);
  return new Response(readable.getStream(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
```

### Key Differences

| Node.js Readable | Web ReadableStream |
|------------------|---------------------|
| `push(chunk)` returns boolean for backpressure | `pull()` called when ready for more data |
| `push(null)` signals end | `controller.close()` signals end |
| Event-based (`'data'`, `'end'`) | Async iterator or reader-based |
| Extends class | Factory pattern with strategies |

---

## 2. vm Module

### Current Usage in Lit SSR

**File:** `packages/labs/ssr/src/lib/module-loader.ts`

The `ModuleLoader` class uses Node's `vm` module to create isolated JavaScript execution contexts:

```typescript
import * as vm from 'vm';
import enhancedResolve from 'enhanced-resolve';
import {builtinModules} from 'module';

class ModuleLoader {
  private context: vm.Context;
  private moduleCache: Map<string, vm.Module>;

  constructor(options?: ModuleLoaderOptions) {
    // Create isolated context with controlled globals
    this.context = vm.createContext(
      options?.global ?? makeDefaultContextObject()
    );
  }

  async importModule(specifier: string): Promise<unknown> {
    // Load module as vm.SourceTextModule
    const module = new vm.SourceTextModule(source, {
      context: this.context,
      identifier: resolvedPath,
    });

    // Link dependencies
    await module.link(this.linker.bind(this));

    // Evaluate module
    await module.evaluate();

    return module.namespace;
  }
}
```

### Why It's Needed

1. **Isolation**: Prevents SSR-rendered code from accessing Node.js globals or affecting the host process
2. **Controlled Global Environment**: Provides only browser-compatible APIs (URL, fetch, console, etc.)
3. **Module Loading**: Dynamically loads and evaluates JavaScript modules in the sandbox
4. **Cache Management**: Maintains separate module caches per context

### Edge-Compatible Replacement Strategies

Edge runtimes provide isolation at the platform level via V8 Isolates, making the `vm` module unnecessary.

#### Strategy A: Direct Module Import (Recommended for Edge)

In edge runtimes, code runs in isolated V8 isolates by default. No sandbox is needed:

```typescript
// Edge runtime - isolation is handled by the platform
export async function renderComponent(componentPath: string) {
  // Dynamic import works directly in edge runtimes
  // Each worker/isolate has its own global scope
  const module = await import(componentPath);
  return render(module.default);
}
```

#### Strategy B: Pre-bundled Components (Build-time Isolation)

Bundle all components at build time to avoid runtime module loading:

```typescript
// Build-time: Create a component registry
// components-registry.ts (generated at build)
import { MyButton } from './components/my-button.js';
import { MyCard } from './components/my-card.js';

export const componentRegistry = new Map([
  ['my-button', MyButton],
  ['my-card', MyCard],
]);

// Runtime: Look up components from registry
export function getComponent(tagName: string) {
  return componentRegistry.get(tagName);
}
```

#### Strategy C: Controlled Global Shimming (If Needed)

If you need a controlled environment, create shims that don't rely on `vm`:

```typescript
// Create a minimal shim layer for compatibility
const shimmedGlobals = {
  // Browser-compatible APIs only
  URL,
  URLSearchParams,
  fetch,
  console,
  setTimeout,
  clearTimeout,
  TextEncoder,
  TextDecoder,

  // Custom implementations
  customElements: new CustomElementRegistry(),
  document: createDocumentShim(),
  HTMLElement: HTMLElementShim,
};

// Apply shims to globalThis during initialization
export function installGlobalShims() {
  Object.assign(globalThis, shimmedGlobals);
}
```

### Architectural Recommendation

For edge runtimes, **remove the module loader entirely** and use one of these approaches:

1. **Build-time bundling**: Bundle all components into a single file
2. **Component registry**: Pre-register all components at build time
3. **Platform isolation**: Rely on the edge platform's built-in V8 isolate security

---

## 3. enhanced-resolve

### Current Usage in Lit SSR

**File:** `packages/labs/ssr/src/lib/module-loader.ts`

```typescript
import enhancedResolve from 'enhanced-resolve';

// Create resolver with webpack-like resolution
const resolver = enhancedResolve.create({
  conditionNames: ['import', 'node'],
  extensions: ['.js', '.mjs', '.cjs'],
  // ... other options
});

// Resolve module specifiers
const resolvedPath = await new Promise((resolve, reject) => {
  resolver(context, request, (err, result) => {
    if (err) reject(err);
    else resolve(result);
  });
});
```

### Why It's Needed

- **Node-style Resolution**: Resolves bare module specifiers (`'lit'` -> actual file path)
- **Package.json Exports**: Understands `exports` field and conditional exports
- **Extension Resolution**: Tries multiple extensions (`.js`, `.mjs`, etc.)
- **Custom Conditions**: Supports custom import conditions for SSR

### Edge-Compatible Replacement Strategies

#### Strategy A: Build-time Bundling (Recommended)

Resolve all modules at build time using esbuild:

```javascript
// esbuild.config.js
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/ssr-entry.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/ssr-entry.js',
  platform: 'browser', // or 'neutral' for edge workers
  // All imports resolved at build time
});
```

#### Strategy B: Import Maps

Use import maps for runtime resolution (supported in edge runtimes):

```json
{
  "imports": {
    "lit": "https://cdn.skypack.dev/lit@3.1.2",
    "lit/": "https://cdn.skypack.dev/lit@3.1.2/",
    "@lit/reactive-element": "https://cdn.skypack.dev/@lit/reactive-element@2.0.4"
  }
}
```

#### Strategy C: URL-based Imports

Use full URLs for imports in edge environments:

```typescript
// Direct URL imports (no resolution needed)
import {html, render} from 'https://esm.sh/lit@3.1.2';
import {LitElement} from 'https://esm.sh/lit@3.1.2/element.js';
```

#### Strategy D: import.meta.resolve (Future)

The `import.meta.resolve()` API is gaining support:

```typescript
// Standard API for module resolution
const litPath = import.meta.resolve('lit');
const module = await import(litPath);
```

---

## 4. node-fetch

### Current Usage in Lit SSR

**File:** `packages/labs/ssr/src/lib/dom-shim.ts`

```typescript
// Used to provide fetch() in Node.js environments
import fetch from 'node-fetch';

function makeDefaultContextObject() {
  return {
    fetch,  // Provided via node-fetch
    // ... other globals
  };
}
```

### Why It's Needed

- **HTTP Requests**: Allows components to make HTTP requests during SSR
- **Browser API Compatibility**: Provides the same `fetch()` API as browsers
- **Node.js < 18 Support**: Native fetch wasn't available in older Node versions

### Edge-Compatible Replacement: Native fetch()

All edge runtimes provide native `fetch()` - no replacement needed:

```typescript
// Edge runtimes have native fetch
// Just use it directly - no import required

export async function fetchData(url: string) {
  const response = await fetch(url);
  return response.json();
}

// In the DOM shim, simply reference globalThis.fetch
function makeDefaultContextObject() {
  return {
    fetch: globalThis.fetch,  // Native fetch in edge runtimes
    // ... other globals
  };
}
```

### Important Considerations

| Feature | node-fetch | Native fetch (Edge) |
|---------|------------|---------------------|
| Availability | Requires import | Global |
| Streams | Node streams | Web streams |
| Request limits | Configurable | Platform-specific |
| Timeouts | Manual AbortController | Manual AbortController |

---

## 5. fs and path Modules

### Current Usage in Lit SSR

**File:** `packages/labs/ssr/src/lib/module-loader.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';

// Read module source code
const source = fs.readFileSync(filePath, 'utf-8');

// Resolve paths
const resolvedPath = path.resolve(basePath, specifier);
const dirname = path.dirname(filePath);
```

### Why It's Needed

- **Module Loading**: Reading JavaScript source files from disk
- **Path Resolution**: Computing absolute paths for module resolution
- **Directory Traversal**: Walking up directories to find `node_modules`

### Edge-Compatible Replacement Strategies

Edge runtimes don't have filesystem access - all code must be bundled or fetched via HTTP.

#### Strategy A: Build-time Bundling (Recommended)

Bundle all code at build time:

```typescript
// Build step bundles everything into a single file
// No runtime file system access needed

// esbuild.config.js
await esbuild.build({
  entryPoints: ['src/ssr-components.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/ssr-components.js',
  // Self-contained bundle with all dependencies inlined
  splitting: false,
  platform: 'browser'
});
```

#### Strategy B: URL-based Asset Loading

For dynamic assets, use HTTP fetching:

```typescript
// Instead of fs.readFileSync, use fetch
async function loadTemplate(name: string): Promise<string> {
  const url = new URL(`./templates/${name}.html`, import.meta.url);
  const response = await fetch(url);
  return response.text();
}
```

#### Strategy C: Embedded Assets

Embed assets as strings at build time:

```typescript
// Build-time: Use esbuild plugin to inline assets

// esbuild.config.js
import { readFileSync } from 'fs';

const inlineAssets = {
  name: 'inline-assets',
  setup(build) {
    build.onLoad({ filter: /\.html$/ }, args => ({
      contents: `export default ${JSON.stringify(readFileSync(args.path, 'utf8'))}`,
      loader: 'js'
    }));
  }
};

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  plugins: [inlineAssets]
});

// Usage: import header from './header.html';
```

#### Path Module Replacement

For path operations, use URL APIs:

```typescript
// Instead of path.join / path.resolve
const url = new URL('./relative/path.js', import.meta.url);

// Instead of path.dirname
const dirUrl = new URL('./', import.meta.url);

// Instead of path.basename
const basename = new URL(fullPath).pathname.split('/').pop();

// Instead of path.extname
const extname = fullPath.match(/\.[^.]+$/)?.[0] ?? '';
```

---

## 6. parse5

### Current Usage in Lit SSR

**File:** `packages/labs/ssr/src/lib/render-value.ts` and `packages/labs/ssr/src/lib/util/parse5-utils.ts`

```typescript
import {parse, parseFragment, serialize} from 'parse5';
import {traverse, replaceWith, isElementNode} from '@parse5/tools';

// Parse template HTML into AST
function getTemplateOpcodes(template: TemplateStringsArray) {
  const ast = parseFragment(templateHtml, {
    sourceCodeLocationInfo: true,
  });

  // Walk AST to generate opcodes
  traverse(ast, {
    'pre:node': (node) => {
      if (isElementNode(node)) {
        // Process element
      }
    }
  });

  return opcodes;
}

// Remove synthetic wrapper elements
function removeFakeRootElements(ast: Node) {
  traverse(ast, {
    'pre:node': (node) => {
      if (isElementNode(node) &&
          ['html', 'head', 'body'].includes(node.nodeName) &&
          !node.sourceCodeLocation) {
        replaceWith(node, ...node.childNodes);
      }
    }
  });
}
```

### Why It's Needed

- **HTML Parsing**: Parse template strings into AST for analysis
- **Opcode Generation**: Generate rendering opcodes from template structure
- **Source Location Tracking**: Track positions for hydration markers
- **Spec Compliance**: WHATWG HTML5 compliant parsing

### Edge Compatibility Assessment

**parse5 IS compatible with edge runtimes**. It is pure JavaScript with no Node.js-specific dependencies.

From the [parse5 GitHub repository](https://github.com/inikulin/parse5):
- Pure JavaScript implementation
- No native Node.js module dependencies
- Used by major projects: jsdom, Angular, Lit, Cheerio

There is also a [Deno port](https://github.com/elgs/parse5) that explicitly confirms compatibility:
> "Pure Javascript, no Node API"

### Verification

```typescript
// parse5 works directly in edge runtimes
import {parseFragment, serialize} from 'parse5';

const ast = parseFragment('<div class="test">Hello</div>');
const html = serialize(ast);
// Works in Cloudflare Workers, Deno Deploy, etc.
```

### Alternative Approaches (If Needed)

If parse5 bundle size is a concern (it's ~50KB minified), consider:

#### Alternative A: Simpler Regex-based Parsing

For limited use cases, use regex patterns:

```typescript
// Simple attribute extraction
function parseAttributes(html: string): Map<string, string> {
  const attrs = new Map();
  const regex = /(\w+)=["']([^"']*)["']/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    attrs.set(match[1], match[2]);
  }
  return attrs;
}
```

#### Alternative B: Build-time Parsing

Parse templates at build time and serialize opcodes:

```typescript
// Build time: Parse and generate opcodes
const opcodes = parseTemplate(templateStrings);
const serialized = JSON.stringify(opcodes);

// Runtime: Load pre-parsed opcodes
const opcodes = JSON.parse(serializedOpcodes);
```

---

## Summary: Edge Runtime Migration Path

### Phase 1: Low-Hanging Fruit (Easy)

1. **Replace node-fetch**: Use native `fetch()` - no code changes needed in edge runtimes
2. **Verify parse5 works**: It should work out of the box

### Phase 2: Streaming (Medium)

3. **Replace stream.Readable**: Implement `RenderResultReadableStream` using Web Streams API
4. **Update render functions**: Return `ReadableStream` instead of Node Readable

### Phase 3: Build-time Changes (Medium)

5. **Bundle dependencies**: Use esbuild to resolve all modules at build time
6. **Remove enhanced-resolve**: Rely on esbuild for module resolution
7. **Replace fs/path**: Embed assets at build time, use URL APIs for paths

### Phase 4: Architecture (High Complexity)

8. **Remove vm dependency**: Choose one of:
   - Remove isolation entirely (rely on edge platform isolation)
   - Pre-bundle all components at build time
   - Create component registry pattern

### Minimal Edge-Compatible Render Function

```typescript
import {render} from './render.js';  // Core render logic (no Node deps)
import {RenderResult} from './render-result.js';

/**
 * Edge-compatible streaming HTML renderer
 */
export function renderToStream(value: unknown): ReadableStream<Uint8Array> {
  const result = render(value);
  const encoder = new TextEncoder();

  return new ReadableStream({
    async pull(controller) {
      for await (const chunk of result) {
        if (typeof chunk === 'string') {
          controller.enqueue(encoder.encode(chunk));
        }
      }
      controller.close();
    }
  });
}

/**
 * Edge-compatible Response helper
 */
export function renderToResponse(value: unknown): Response {
  return new Response(renderToStream(value), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    }
  });
}
```

---

## References

- [Lit SSR Source Code](https://github.com/lit/lit/tree/main/packages/labs/ssr)
- [Web Streams API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)
- [Cloudflare Workers Runtime APIs](https://developers.cloudflare.com/workers/runtime-apis/)
- [Cloudflare Workers Node.js Compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- [Cloudflare - How Workers Works (V8 Isolates)](https://developers.cloudflare.com/workers/reference/how-workers-works/)
- [parse5 - HTML Parser](https://github.com/inikulin/parse5)
- [Vercel - Streaming on the Web](https://vercel.com/blog/an-introduction-to-streaming-on-the-web)
- [Next.js Edge Runtime](https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes)
