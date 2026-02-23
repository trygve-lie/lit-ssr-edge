# Edge Runtimes Research

This document provides comprehensive research on WinterTC (formerly WinterCG), edge runtime APIs, and their compatibility for building a Lit edge renderer.

## Table of Contents

1. [WinterTC Overview](#wintertc-overview)
2. [Minimum Common Web Platform API](#minimum-common-web-platform-api)
3. [Common APIs Across Edge Runtimes](#common-apis-across-edge-runtimes)
4. [Cloudflare Workers](#cloudflare-workers)
5. [Fastly Compute](#fastly-compute)
6. [Security and Sandbox Constraints](#security-and-sandbox-constraints)
7. [ESM Module Support](#esm-module-support)
8. [Limitations Compared to Node.js](#limitations-compared-to-nodejs)
9. [APIs for Lit Edge Renderer](#apis-for-lit-edge-renderer)

---

## WinterTC Overview

### What is WinterTC?

WinterTC (TC55) is an Ecma International Technical Committee focused on achieving API interoperability across server-side JavaScript runtimes that share APIs with the web platform. It was formerly known as WinterCG (Web-interoperable Runtimes Community Group) under W3C.

In December 2024, WinterTC was formally established as TC55 under Ecma International, transitioning from the W3C community group structure. This move enables WinterTC to publish formal standards.

### Goals and Mission

- Standardize a "minimum common API" shared with the web that server-side runtimes should support
- Collaborate with standards organizations (WHATWG, W3C) on web API development
- Publish standards for new interoperable server-side APIs
- Enable code reuse between browser and server environments

### Participating Organizations

Major technology companies involved in WinterTC include:
- Cloudflare
- Fastly
- Deno
- Node.js Foundation
- Vercel
- Netlify
- Shopify
- ByteDance
- Alibaba
- Azion
- Bloomberg
- Igalia

### Resources

- **Official Site**: https://wintertc.org/
- **GitHub**: https://github.com/WinterTC55
- **Ecma Scope**: https://ecma-international.org/technical-committees/tc55
- **Specification**: https://min-common-api.proposal.wintertc.org/

---

## Minimum Common Web Platform API

The Minimum Common Web Platform API (2025 ECMA Standard) defines a curated subset of Web Platform APIs that server-side JavaScript runtimes should implement for interoperability with browsers.

### Core Principles

1. **Conformance**: All Web-interoperable Runtimes conforming to this Standard shall implement each required Web Platform API according to normative requirements
2. **Documentation of Divergence**: Where any runtime must diverge for technical reasons, clear documentation shall be provided
3. **Extensions**: Runtime-specific extensions may be implemented but shall not contradict normative functionality

### Global Scope APIs

All of the following interfaces shall be exposed on `globalThis`:

#### Core Objects
- `globalThis` - the global object reference
- `navigator.userAgent` - runtime identification string
- `console` - logging interface with standard methods

#### Timing Functions
- `setTimeout()` / `clearTimeout()`
- `setInterval()` / `clearInterval()`
- `queueMicrotask()`

#### Data Encoding
- `atob()` / `btoa()` - base64 conversion
- `structuredClone()` - deep cloning with circular reference handling

#### Error Handling
- `onerror`, `onunhandledrejection`, `onrejectionhandled` event handlers
- `reportError()` method

### Event System

- `Event`, `EventTarget`, `CustomEvent`
- `MessageEvent`, `MessageChannel`, `MessagePort`
- `ErrorEvent`, `PromiseRejectionEvent`
- `AbortController`, `AbortSignal`

### Fetch and Network APIs

- `fetch()` function
- `Request` interface
- `Response` interface
- `Headers` interface
- `FormData` interface

### Web Streams API

Complete Streams Standard support:

| Interface | Description |
|-----------|-------------|
| `ReadableStream` | Source of data that can be consumed incrementally |
| `WritableStream` | Destination for receiving streamed data |
| `TransformStream` | Processes data as it flows through |
| `ReadableStreamDefaultReader` | Standard reader for consuming data |
| `ReadableStreamBYOBReader` | Reader with "Bring Your Own Buffer" capability |
| `WritableStreamDefaultWriter` | Standard writer for pushing data |
| `ByteLengthQueuingStrategy` | Queuing strategy based on byte length |
| `CountQueuingStrategy` | Queuing strategy based on chunk count |

### URL and Encoding APIs

- `URL`, `URLSearchParams` classes
- `URLPattern` for route matching
- `TextEncoder`, `TextDecoder` (UTF-8)
- `TextEncoderStream`, `TextDecoderStream`

### Compression APIs

- `CompressionStream`
- `DecompressionStream`

### Cryptography APIs

- `crypto` object with `subtle` interface
- `Crypto`, `CryptoKey`, `SubtleCrypto` interfaces

### Performance APIs

- `performance` object
- `Performance` interface for timing measurements

### File APIs

- `Blob` interface
- `File` interface

### WebAssembly Support

Complete WebAssembly JavaScript API:
- `WebAssembly` namespace with compile/instantiate methods
- `Module`, `Instance`, `Memory`, `Table`, `Global` interfaces
- Exception types: `CompileError`, `LinkError`, `RuntimeError`

### Web IDL

- `DOMException` for standardized errors

---

## Common APIs Across WinterTC Runtimes

The following APIs are reliably available across WinterTC-compatible runtimes (Cloudflare Workers, Fastly Compute, Node.js 18+, Deno, Bun, Vercel Edge):

### Fetch API (Full Support)

```javascript
// Standard fetch is available
const response = await fetch('https://api.example.com/data');
const data = await response.json();

// Request and Response objects
const request = new Request('https://example.com', {
  method: 'POST',
  headers: new Headers({ 'Content-Type': 'application/json' }),
  body: JSON.stringify({ key: 'value' })
});
```

### Web Streams API (Full Support)

```javascript
// ReadableStream
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue('Hello');
    controller.enqueue(' World');
    controller.close();
  }
});

// TransformStream for processing
const transform = new TransformStream({
  transform(chunk, controller) {
    controller.enqueue(chunk.toUpperCase());
  }
});

// Piping streams
const transformed = stream.pipeThrough(transform);

// Streaming response
return new Response(transformed, {
  headers: { 'Content-Type': 'text/plain' }
});
```

### URL APIs (Full Support)

```javascript
const url = new URL('https://example.com/path?query=value');
console.log(url.hostname); // 'example.com'
console.log(url.searchParams.get('query')); // 'value'

const pattern = new URLPattern({ pathname: '/users/:id' });
const match = pattern.exec('https://example.com/users/123');
```

### Encoding APIs (Full Support)

```javascript
// TextEncoder/TextDecoder
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const encoded = encoder.encode('Hello');
const decoded = decoder.decode(encoded);

// Base64
const base64 = btoa('Hello');
const original = atob(base64);

// Structured Clone
const cloned = structuredClone({ nested: { data: [1, 2, 3] } });
```

### Crypto APIs (Full Support)

```javascript
// Random values
const array = new Uint8Array(16);
crypto.getRandomValues(array);

// Random UUID
const uuid = crypto.randomUUID();

// SubtleCrypto for hashing, signing, etc.
const hash = await crypto.subtle.digest('SHA-256', data);
```

### Timers (Partial Support)

```javascript
// Available but with restrictions
setTimeout(() => {}, 1000);
setInterval(() => {}, 1000);
queueMicrotask(() => {});

// Note: Timers may not advance during synchronous code execution
// Date.now() returns last I/O time in some runtimes
```

### Console API (Full Support)

```javascript
console.log('Message');
console.error('Error');
console.warn('Warning');
console.info('Info');
```

### AbortController (Full Support)

```javascript
const controller = new AbortController();
const signal = controller.signal;

fetch(url, { signal })
  .catch(err => {
    if (err.name === 'AbortError') {
      console.log('Fetch aborted');
    }
  });

// Abort the request
controller.abort();
```

---

## Node.js (WinterTC-Compatible)

### Overview

Modern Node.js (18+) implements the WinterTC Minimum Common Web Platform API, making it a first-class target for lit-edge alongside edge runtimes.

### Runtime Architecture

- **Engine**: V8 JavaScript engine
- **Version requirement**: Node.js 18.0.0+ (LTS)
- **Recommended**: Node.js 20+ or 22+
- **WinterTC compliance**: Full support for Minimum Common API

### Native Web Platform APIs (Node.js 18+)

Node.js 18+ includes native implementations of Web Platform APIs:

| API | Node.js Version | Notes |
|-----|-----------------|-------|
| **fetch()** | 18.0+ | Native, no flag needed |
| **ReadableStream** | 16.5+ (stable 18+) | Web Streams API |
| **WritableStream** | 16.5+ (stable 18+) | Web Streams API |
| **TransformStream** | 16.5+ (stable 18+) | Web Streams API |
| **TextEncoder/Decoder** | All versions | Native |
| **URL/URLSearchParams** | All versions | Native |
| **AbortController** | 15.0+ | Native |
| **crypto.subtle** | 15.0+ | Web Crypto API |
| **structuredClone** | 17.0+ | Native |

### Why Node.js 18+ is a Target

**Before Node.js 18:**
- Had to polyfill `fetch()` (node-fetch)
- Web Streams required polyfills
- Different from edge workers

**Node.js 18+:**
- Native `fetch()` (same as browsers/workers)
- Native Web Streams (same API as Cloudflare/Fastly)
- WinterTC-compliant
- **Can run the same code as edge workers**

### lit-edge on Node.js

```javascript
// Same code runs on Node.js, Cloudflare, Fastly
import { render, RenderResultReadable } from 'lit-edge';
import { html } from 'lit';
import { createServer } from 'http'; // Node.js-specific server

const server = createServer(async (req, res) => {
  const template = html`<div>Hello, World!</div>`;
  const result = render(template);
  const readable = new RenderResultReadable(result);

  res.writeHead(200, { 'Content-Type': 'text/html' });

  // Convert Web Stream to Node stream
  const reader = readable.getStream().getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(decoder.decode(value, { stream: true }));
  }

  res.end();
});

server.listen(3000);
```

### Node.js vs Edge Workers

| Feature | Node.js 18+ | Edge Workers |
|---------|-------------|--------------|
| Web Streams | ✅ Native | ✅ Native |
| fetch() | ✅ Native | ✅ Native |
| File system | ✅ Available | ❌ Not available |
| Persistent process | ✅ Yes | ❌ Isolated per request |
| Memory limits | ❌ No strict limit | ✅ 128MB typical |
| Execution time | ❌ No limit | ✅ 10ms-30s |
| V8 isolates | ❌ Single process | ✅ Per request |

**For lit-edge:** We use only the **shared subset** (Web Platform APIs), so the same code runs everywhere.

---

## Cloudflare Workers

### Overview

Cloudflare Workers is built on the V8 JavaScript engine (same as Chrome) and runs code in V8 isolates. The runtime is updated at least weekly to match Chrome's stable V8 version.

### No nodejs_compat Required for lit-edge

lit-edge runs on Cloudflare Workers **without** the `nodejs_compat` compatibility flag.

**Why lit-edge doesn't need nodejs_compat:**
- Uses only Web Platform APIs (WinterTC Minimum Common API)
- No Node.js-specific imports:
  - ❌ No `node:stream`
  - ❌ No `node:fs`
  - ❌ No `node:path`
  - ❌ No `node:buffer`
  - ✅ Only `ReadableStream`, `fetch()`, etc.
- No Node.js globals:
  - ❌ No `process`
  - ❌ No `Buffer`
  - ❌ No `__dirname`
  - ✅ Only `globalThis`, `crypto`, etc.

**Configuration (no nodejs_compat):**
```toml
# wrangler.toml
name = "my-lit-app"
main = "dist/worker.js"
compatibility_date = "2024-01-01"

# ✅ lit-edge works without this!
# compatibility_flags = ["nodejs_compat"]
```

### Runtime Architecture

- **Engine**: V8 JavaScript and WebAssembly engine
- **Isolation**: V8 isolates (~10KB memory overhead per isolate)
- **Memory Limit**: 128MB per Worker
- **Execution Limit**: Up to 30 seconds (paid plans) or 10ms CPU time (free plan)

### Supported Web APIs

| Category | APIs |
|----------|------|
| **Fetch** | `fetch()`, `Request`, `Response`, `Headers`, `FormData` |
| **Streams** | `ReadableStream`, `WritableStream`, `TransformStream`, readers, writers |
| **URL** | `URL`, `URLSearchParams`, `URLPattern` |
| **Encoding** | `TextEncoder`, `TextDecoder`, `atob()`, `btoa()` |
| **Crypto** | `crypto`, `SubtleCrypto`, `CryptoKey` |
| **Timers** | `setTimeout`, `setInterval`, `queueMicrotask` |
| **Events** | `EventTarget`, `Event`, `AbortController`, `AbortSignal` |
| **Compression** | `CompressionStream`, `DecompressionStream` |
| **WebAssembly** | Full WebAssembly API support |
| **Performance** | `performance.now()`, `performance.timeOrigin` |

### Web Streams Details

```javascript
// Streaming response without buffering
export default {
  async fetch(request) {
    const { readable, writable } = new TransformStream();

    // Write to stream asynchronously
    const writer = writable.getWriter();
    writer.write(new TextEncoder().encode('Hello '));
    writer.write(new TextEncoder().encode('World'));
    writer.close();

    // Return streaming response immediately
    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};
```

**Key Benefits**:
- Process multi-gigabyte payloads within 128MB memory limit
- Start processing data incrementally
- Stream responses before full body is ready

**Limitations**:
- Streams API only available within Request context (inside fetch handler)
- `internal_stream_byob_return_view` flag needed for full BYOB compliance

### Fetch API Details

```javascript
// Standard fetch
const response = await fetch('https://api.example.com/data');

// With cache control (limited options)
const response = await fetch(url, {
  cache: 'no-store' // or 'no-cache' - only these two supported
});

// Compression handling
const response = await fetch(url, {
  headers: {
    'Accept-Encoding': 'gzip, br'
  }
});
```

**Limitations**:
- Only `cache: 'no-store'` and `cache: 'no-cache'` supported
- Fetch must be called within a handler (not global scope)
- Custom ports require `allow_custom_ports` compatibility flag

### Node.js Compatibility

Cloudflare Workers provides partial Node.js API compatibility through the `nodejs_compat` flag:

**Supported Node.js APIs** (partial list):
- `node:buffer`
- `node:crypto`
- `node:stream`
- `node:util`
- `node:events`
- `node:assert`
- `node:path`
- `node:url`
- `node:http` (wrapper around fetch)
- `node:fs` (with compatibility date 2025-09-01+)

**Limitations**:
- `node:http`/`node:https`: No connection headers, trailing headers, upgrade events, or direct socket access
- `node:fs`: No glob APIs, file watching, or full timestamp support
- Some APIs are mocked (present but throw errors when called)
- I/O objects from one request cannot be accessed from another request's handler

### Cloudflare-Specific APIs

- **HTMLRewriter**: Server-side DOM manipulation
- **Cache API**: Programmatic cache control
- **KV**: Key-value storage
- **Durable Objects**: Stateful edge computing
- **R2**: Object storage
- **D1**: SQLite database
- **Queues**: Message queuing
- **AI**: AI inference
- **Vectorize**: Vector database

### Security Constraints

- `eval()` and `new Function()` are prohibited
- Dynamic code execution is blocked
- `Date.now()` returns last I/O time (doesn't advance during execution)
- No access to concurrency/multi-threading
- Timers locked during execution (defense against timing attacks)

---

## Fastly Compute

### Overview

Fastly Compute (formerly Compute@Edge) runs JavaScript by compiling it to WebAssembly using the WASI (WebAssembly System Interface). It uses the SpiderMonkey JavaScript engine (from Firefox).

### Runtime Architecture

- **Engine**: SpiderMonkey (Firefox's JavaScript engine)
- **Compilation**: JavaScript compiled to WebAssembly
- **Execution**: WASI-based WebAssembly runtime
- **SDK**: `@fastly/js-compute` (v3.40.0+)

### Standards Compliance

The Fastly JavaScript runtime is designed to be compliant with:
- JavaScript standards (ECMAScript)
- Minimum Common Web APIs (WinterTC specification)
- Service Worker API patterns

### Supported Web APIs

| Category | APIs |
|----------|------|
| **Fetch** | `fetch()`, `Request`, `Response`, `Headers` |
| **Streams** | `ReadableStream`, `WritableStream`, `TransformStream` |
| **URL** | `URL`, `URLSearchParams` |
| **Encoding** | `TextEncoder`, `TextDecoder` |
| **Console** | `console.log`, `console.error`, etc. |
| **Timers** | Limited timer support |
| **Globals** | `Date`, standard ECMAScript globals |

### Request Handling Pattern

```javascript
/// <reference types="@fastly/js-compute" />

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const request = event.request;
  const client = event.client;

  // Fetch from backend
  const response = await fetch(request, {
    backend: 'origin_backend'
  });

  return response;
}
```

### Streaming Responses

```javascript
// Requests and responses are streams by default
const response = await fetch(request, { backend: 'origin' });

// Stream the response (no buffering)
return response;

// Or consume into memory (small responses only)
const text = await response.text();
const json = await response.json();
```

### Fetch API Extensions

Fastly extends the standard `fetch()` with additional options:

```javascript
// Named backend (statically defined)
const response = await fetch('https://origin.com/path', {
  backend: 'origin'
});

// Dynamic backend (when enabled)
import { Backend } from 'fastly:backend';

const backend = new Backend({
  name: 'dynamic_origin',
  target: 'origin.example.com',
  hostOverride: 'origin.example.com'
});

const response = await fetch(request, { backend });
```

### Fastly-Specific APIs

Available through `fastly:` namespaced imports:

| Module | Description |
|--------|-------------|
| `fastly:backend` | Backend configuration |
| `fastly:cache` | Caching functionality |
| `fastly:cache-override` | Cache override controls |
| `fastly:config-store` | Configuration storage |
| `fastly:kv-store` | Key-value storage |
| `fastly:secret-store` | Secret management |
| `fastly:logger` | Real-time logging |
| `fastly:geolocation` | IP geolocation |
| `fastly:device` | Device detection |
| `fastly:edge-rate-limiter` | Rate limiting |
| `fastly:env` | Environment variables |
| `fastly:html-rewriter` | HTML manipulation |
| `fastly:image-optimizer` | Image optimization |
| `fastly:websocket` | WebSocket handling |
| `fastly:fanout` | Real-time messaging |
| `fastly:acl` | Access control lists |

### Bundler Configuration

When using bundlers, configure them to recognize `fastly:` imports:

**Webpack**:
```javascript
module.exports = {
  externals: [/^fastly:.*$/],
  resolve: {
    conditionNames: ['fastly', 'import', 'module', 'require', 'default']
  }
};
```

**Esbuild**:
```javascript
{
  external: ['fastly:*'],
  conditions: ['fastly']
}
```

### Performance Optimization

```bash
# Enable AOT compilation for ~3x performance
fastly compute build --enable-aot
```

Requires SDK v3.27.0 or later.

### Limitations

1. **Backend Requirement**: Fetch requests require defined backends unless dynamic backends are enabled
2. **Package Size Limits**: Account and platform-level limits on package size
3. **Library Compatibility**: Not all npm packages work (different from Node.js)
4. **Memory Constraints**: Large payloads can trigger memory limits
5. **TypeScript**: Built-in support only for erasable syntax; full TS requires pre-compilation

---

## Security and Sandbox Constraints

### V8 Isolates (Cloudflare, Vercel, Deno)

Edge runtimes use V8 isolates for security and performance:

#### Architecture
- Each isolate has its own memory heap, garbage collector, and execution state
- Isolates are completely separate; one cannot access another's memory
- ~10KB memory overhead per isolate (vs ~10MB for containers)
- Sub-millisecond startup times

#### Security Measures

1. **Code Execution Restrictions**
   - `eval()` is prohibited
   - `new Function()` is prohibited
   - Dynamic code evaluation blocked

2. **Timing Attack Prevention**
   - `Date.now()` locked during code execution
   - `performance.now()` doesn't advance during execution
   - No access to multi-threading/concurrency

3. **Memory Isolation**
   - Memory protection keys isolate heap data
   - Hardware traps prevent cross-isolate memory access
   - V8 Sandbox confines heap pointers to reserved address space

4. **Process-Level Sandboxing**
   - Linux namespaces and seccomp
   - No filesystem access
   - No network access outside allowed APIs

### WebAssembly Sandbox (Fastly)

Fastly uses WASI-based WebAssembly isolation:

- JavaScript compiled to WebAssembly
- WASI provides sandboxed system interface
- No direct filesystem or network access
- Memory isolated per instance

### Common Constraints Across Runtimes

| Constraint | Impact |
|------------|--------|
| No filesystem access | Cannot read/write local files |
| No direct database connections | Must use HTTP APIs or platform services |
| No dynamic code execution | No `eval()`, `new Function()` |
| No long-running processes | Execution time limits (10ms - 30s) |
| No native modules | Cannot use Node.js native addons |
| Limited concurrency | No Web Workers or threads |

---

## ESM Module Support

### Module Format

All major edge runtimes support ES Modules (ESM) as the primary module format:

```javascript
// ESM imports
import { html } from 'lit';
import { renderToString } from '@lit-labs/ssr';

// ESM exports
export default {
  async fetch(request) {
    return new Response('Hello');
  }
};
```

### Cloudflare Workers

- **Format**: ES Modules recommended (Service Worker format deprecated)
- **Bundling**: Wrangler uses esbuild by default
- **npm support**: Direct import from `package.json` dependencies
- **Conditional exports**: Respects `workerd` condition in `package.json`

```javascript
// wrangler.toml
main = "src/index.js"
compatibility_date = "2024-01-01"
```

### Fastly Compute

- **Format**: ES Modules (`"type": "module"` in `package.json`)
- **Bundling**: Webpack or esbuild recommended
- **TypeScript**: Supported with compilation

```json
{
  "type": "module",
  "main": "src/index.js"
}
```

### Dynamic Import Limitations

```javascript
// WORKS: Static imports
import { foo } from './module.js';

// WORKS: Dynamic imports with static paths
const module = await import('./module.js');

// DOES NOT WORK: Dynamic imports with variable paths
const path = `./lang/${language}.mjs`;
const module = await import(path); // Fails at runtime

// DOES NOT WORK: URL imports
const module = await import('https://example.com/module.js');
```

**Workarounds for variable imports**:
- Pre-bundle all possible modules
- Use Wrangler rules to include modules: `{ "type": "EsModule", "globs": ["./lang/**/*.mjs"] }`
- Convert runtime detection to compile-time

### CommonJS Compatibility

- Build tools can handle CommonJS during bundling
- Runtime itself only executes ESM
- `require()` is not available at runtime
- Dynamic `require()` with variable paths fails

---

## Limitations Compared to Node.js

### APIs Not Available

| Node.js API | Edge Alternative |
|-------------|------------------|
| `fs` module | Platform-specific storage APIs (KV, R2, etc.) |
| `child_process` | Not available |
| `cluster` | Not available |
| `worker_threads` | Not available |
| `net`/`dgram` | HTTP-only via fetch |
| `dns` | Not available (use DNS-over-HTTPS) |
| `os` | Limited `navigator.userAgent` |
| `process` | Partial (env vars, limited properties) |
| Native addons | Not available |
| `require()` | ESM imports only |

### Behavioral Differences

1. **No persistent processes**
   - Each request runs in fresh context
   - No in-memory state between requests (use external storage)

2. **No filesystem**
   - Cannot read/write files
   - Use platform storage services

3. **No direct database connections**
   - No TCP sockets for database protocols
   - Use HTTP-based database APIs or platform services

4. **Limited timers**
   - Timers may not fire after response sent
   - Use `waitUntil()` for background tasks

5. **Execution limits**
   - CPU time limits (varies by platform)
   - Wall clock time limits
   - Memory limits (typically 128MB)

6. **No dynamic code**
   - No `eval()`
   - No `new Function()`
   - No dynamic `require()` paths

### npm Package Compatibility

Many npm packages will NOT work because they:
- Use Node.js-specific APIs (`fs`, `child_process`, etc.)
- Use native C++ addons
- Use dynamic `require()` with computed paths
- Rely on synchronous I/O operations
- Assume filesystem access

**Compatible packages typically**:
- Use only Web APIs
- Are pure JavaScript/TypeScript
- Use static ESM imports
- Designed for browser or edge environments

---

## APIs for Lit Edge Renderer

Based on this research, the following APIs are reliably available for building a Lit SSR renderer that works across all WinterTC-compatible runtimes (edge workers, Node.js 18+, Deno, Bun):

### Core APIs (Safe to Use)

```javascript
// These work across all major edge runtimes

// Fetch API
fetch(url, options);
new Request(url, init);
new Response(body, init);
new Headers(init);

// Web Streams (critical for streaming SSR)
new ReadableStream({ start, pull, cancel });
new WritableStream({ start, write, close, abort });
new TransformStream({ start, transform, flush });
stream.pipeThrough(transform);
stream.pipeTo(writable);
readable.getReader();
writable.getWriter();

// URL handling
new URL(urlString, base);
new URLSearchParams(init);

// Text encoding
new TextEncoder();
new TextDecoder();

// Async utilities
AbortController;
AbortSignal;
queueMicrotask(callback);
setTimeout(callback, delay);

// Error handling
DOMException;

// Console
console.log(), console.error(), etc.
```

### Streaming SSR Pattern

```javascript
// Optimal pattern for Lit SSR on edge runtimes
import { html } from 'lit';
import { RenderResultReadable } from '@lit-labs/ssr/lib/render-result-readable.js';

export default {
  async fetch(request) {
    const template = html`
      <html>
        <body>
          <my-component></my-component>
        </body>
      </html>
    `;

    // Create a streaming response
    const stream = new RenderResultReadable(render(template));

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }
};
```

### Recommended Architecture

1. **Use Web Streams** for rendering
   - Avoid buffering entire responses
   - Stream HTML as it's generated
   - Stay within memory limits

2. **Use static imports** for components
   - Pre-bundle all Lit components
   - No dynamic component loading at runtime

3. **Use fetch for data**
   - All external data via HTTP
   - No direct database connections

4. **Avoid Node.js-specific code**
   - No `fs`, `path`, etc.
   - Use URL APIs instead of `path`
   - Use Web Crypto instead of `node:crypto`

5. **Handle hydration correctly**
   - Include hydration scripts
   - Use declarative shadow DOM

### Compatibility Matrix

| Feature | Cloudflare | Fastly | Node.js 18+ | Deno | Bun | Notes |
|---------|------------|--------|-------------|------|-----|-------|
| `fetch()` | ✅ | ✅ | ✅ | ✅ | ✅ | Fastly requires backend config |
| `ReadableStream` | ✅ | ✅ | ✅ | ✅ | ✅ | Full support |
| `WritableStream` | ✅ | ✅ | ✅ | ✅ | ✅ | Full support |
| `TransformStream` | ✅ | ✅ | ✅ | ✅ | ✅ | Full support |
| `TextEncoder` | ✅ | ✅ | ✅ | ✅ | ✅ | UTF-8 |
| `TextDecoder` | ✅ | ✅ | ✅ | ✅ | ✅ | UTF-8 |
| `URL` | ✅ | ✅ | ✅ | ✅ | ✅ | Full support |
| `URLSearchParams` | ✅ | ✅ | ✅ | ✅ | ✅ | Full support |
| `Headers` | ✅ | ✅ | ✅ | ✅ | ✅ | Full support |
| `Request` | ✅ | ✅ | ✅ | ✅ | ✅ | Full support |
| `Response` | ✅ | ✅ | ✅ | ✅ | ✅ | Full support |
| `AbortController` | ✅ | ✅ | ✅ | ✅ | ✅ | Full support |
| `crypto.subtle` | ✅ | ✅ | ✅ | ✅ | ✅ | Full support |
| `setTimeout` | ✅ | Limited | ✅ | ✅ | ✅ | In request context |
| `console` | ✅ | ✅ | ✅ | ✅ | ✅ | Full support |
| ESM imports | ✅ | ✅ | ✅ | ✅ | ✅ | Static only |

---

## References

### WinterTC
- [WinterTC Official Site](https://wintertc.org/)
- [Minimum Common Web Platform API Specification](https://min-common-api.proposal.wintertc.org/)
- [WinterTC GitHub](https://github.com/WinterTC55)
- [W3C Blog: Collaborating for Web-Interoperable Server Runtimes](https://www.w3.org/blog/2025/collaborating-across-w3c-and-ecma-for-web-interoperable-server-runtimes-through-wintertc/)

### Cloudflare Workers
- [Runtime APIs Documentation](https://developers.cloudflare.com/workers/runtime-apis/)
- [Streams API](https://developers.cloudflare.com/workers/runtime-apis/streams/)
- [Fetch API](https://developers.cloudflare.com/workers/runtime-apis/fetch/)
- [Web Standards](https://developers.cloudflare.com/workers/runtime-apis/web-standards/)
- [Node.js Compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- [Security Model](https://developers.cloudflare.com/workers/reference/security-model/)

### Fastly Compute
- [JavaScript on Compute](https://www.fastly.com/documentation/guides/compute/javascript/)
- [JavaScript SDK Reference](https://js-compute-reference-docs.edgecompute.app/docs/)
- [js-compute-runtime GitHub](https://github.com/fastly/js-compute-runtime)
- [@fastly/js-compute on npm](https://www.npmjs.com/package/@fastly/js-compute)

### Additional Resources
- [Vercel Edge Runtime](https://vercel.com/docs/functions/runtimes/edge)
- [Next.js Edge Runtime](https://nextjs.org/docs/app/api-reference/edge)
