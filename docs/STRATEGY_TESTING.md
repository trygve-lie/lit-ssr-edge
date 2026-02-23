# Testing Strategy for lit-edge

This document outlines the testing strategy for lit-edge, ensuring our edge-compatible implementation maintains full compatibility with the original @lit-labs/ssr.

## Table of Contents

1. [Overview](#overview)
2. [Testing Principles](#testing-principles)
3. [Test Architecture](#test-architecture)
4. [Test Categories](#test-categories)
5. [Fixture Organization](#fixture-organization)
6. [Assertion Patterns](#assertion-patterns)
7. [Test Execution](#test-execution)
8. [CI/CD Integration](#cicd-integration)
9. [Performance Testing](#performance-testing)

---

## Overview

### Goals

1. **Compatibility verification** - Ensure lit-edge produces identical output to @lit-labs/ssr
2. **Regression prevention** - Catch breaking changes early
3. **Edge runtime validation** - Verify functionality on Cloudflare Workers and Fastly Compute
4. **Performance benchmarking** - Track rendering performance metrics

### Test Types

| Type | Purpose | Location |
|------|---------|----------|
| **Baseline Tests** | Core compatibility tests that run against both implementations | `test/integration/baseline/` |
| **Unit Tests** | Internal implementation details | `test/unit/` |
| **Edge Runtime Tests** | Platform-specific validation | `test/edge/` |
| **Performance Tests** | Benchmarking and optimization | `test/performance/` |

---

## Testing Principles

### 1. Single Source of Truth

Tests are written **once** and executed against **both** implementations:

```javascript
// test/integration/baseline/template-rendering.test.js
import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { createRenderer } from '../helpers/renderer.js';

test('renders basic template', async () => {
  const renderer = createRenderer(); // Abstracts implementation
  const html = await renderer.renderToString(html`<div>Hello</div>`);

  strictEqual(html, '<div>Hello</div>');
});
```

### 2. Full HTML Comparison

Tests compare **complete HTML output**, not partial matches:

```javascript
// ✅ Good - Complete comparison
strictEqual(result, '<!DOCTYPE html><html><head></head><body><div>Content</div></body></html>');

// ❌ Bad - Partial matching
assert(result.includes('<div>Content</div>'));
```

### 3. Deterministic Output

All tests produce **reproducible results**:

- No timestamps or random values in output
- Consistent ordering of attributes
- Predictable whitespace handling

### 4. Test Isolation

Each test is **completely independent**:

- No shared state between tests
- Clean component registries
- Fresh render contexts

---

## Test Architecture

### Renderer Abstraction Layer

A unified interface allows tests to run against different implementations:

```javascript
// test/helpers/renderer.js

/**
 * Creates a renderer instance for the specified implementation.
 *
 * @param {'lit-ssr' | 'lit-edge'} implementation - Which renderer to use
 * @returns {Renderer} Renderer instance
 */
export function createRenderer(implementation = process.env.TEST_IMPL || 'lit-edge') {
  if (implementation === 'lit-ssr') {
    return new LitSSRRenderer();
  } else if (implementation === 'lit-edge') {
    return new LitEdgeRenderer();
  }
  throw new Error(`Unknown implementation: ${implementation}`);
}

/**
 * Abstract renderer interface
 */
class Renderer {
  /**
   * Renders a template to an HTML string
   * @param {TemplateResult} template - Lit template to render
   * @returns {Promise<string>} Rendered HTML
   */
  async renderToString(template) {
    throw new Error('Not implemented');
  }

  /**
   * Renders a template to a ReadableStream
   * @param {TemplateResult} template - Lit template to render
   * @returns {ReadableStream} HTML stream
   */
  renderToStream(template) {
    throw new Error('Not implemented');
  }

  /**
   * Registers custom element components
   * @param {Map<string, CustomElementConstructor>} components
   */
  registerComponents(components) {
    throw new Error('Not implemented');
  }

  /**
   * Cleans up renderer state
   */
  cleanup() {
    // Optional cleanup
  }
}

/**
 * Renderer for @lit-labs/ssr
 */
class LitSSRRenderer extends Renderer {
  async renderToString(template) {
    const { render } = await import('@lit-labs/ssr');
    const { collectResult } = await import('@lit-labs/ssr/lib/render-result.js');

    const result = render(template);
    return await collectResult(result);
  }

  renderToStream(template) {
    const { render } = await import('@lit-labs/ssr');
    const { RenderResultReadable } = await import('@lit-labs/ssr/lib/render-result-readable.js');

    const result = render(template);
    return new RenderResultReadable(result);
  }

  registerComponents(components) {
    // @lit-labs/ssr uses global customElements
    for (const [name, ctor] of components) {
      if (!customElements.get(name)) {
        customElements.define(name, ctor);
      }
    }
  }
}

/**
 * Renderer for lit-edge
 */
class LitEdgeRenderer extends Renderer {
  async renderToString(template) {
    const { render, collectResult } = await import('../../src/index.js');

    const result = render(template);
    return await collectResult(result);
  }

  renderToStream(template) {
    const { render, RenderResultReadable } = await import('../../src/index.js');

    const result = render(template);
    return new RenderResultReadable(result);
  }

  registerComponents(components) {
    // lit-edge component registration
    for (const [name, ctor] of components) {
      if (!customElements.get(name)) {
        customElements.define(name, ctor);
      }
    }
  }
}
```

### Test Helper Utilities

```javascript
// test/helpers/html-compare.js

/**
 * Normalizes HTML for comparison
 * - Trims whitespace
 * - Sorts attributes alphabetically
 * - Normalizes self-closing tags
 *
 * @param {string} html - HTML string to normalize
 * @returns {string} Normalized HTML
 */
export function normalizeHTML(html) {
  return html
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\s*=\s*/g, '=')
    .replace(/"\s+/g, '" ')
    .replace(/\s+"/g, '"');
}

/**
 * Asserts two HTML strings are equivalent
 *
 * @param {string} actual - Actual HTML output
 * @param {string} expected - Expected HTML output
 */
export function assertHTMLEqual(actual, expected) {
  strictEqual(
    normalizeHTML(actual),
    normalizeHTML(expected)
  );
}
```

```javascript
// test/helpers/stream.js

/**
 * Collects a ReadableStream into a string
 *
 * @param {ReadableStream} stream - Stream to collect
 * @returns {Promise<string>} Complete stream content
 */
export async function collectStream(stream) {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }

  result += decoder.decode(); // Final flush
  return result;
}
```

---

## Test Categories

### 1. Template Rendering (baseline/template-rendering.test.js)

Test basic template rendering capabilities:

```javascript
import { test } from 'node:test';
import { html } from 'lit';
import { createRenderer } from '../helpers/renderer.js';
import { assertHTMLEqual } from '../helpers/html-compare.js';

test('renders static template', async () => {
  const renderer = createRenderer();
  const result = await renderer.renderToString(html`<div>Hello World</div>`);

  assertHTMLEqual(result, '<div>Hello World</div>');
});

test('renders template with expressions', async () => {
  const renderer = createRenderer();
  const name = 'Alice';
  const result = await renderer.renderToString(html`<div>Hello ${name}</div>`);

  assertHTMLEqual(result, '<div>Hello Alice</div>');
});

test('renders nested templates', async () => {
  const renderer = createRenderer();
  const inner = html`<span>Inner</span>`;
  const result = await renderer.renderToString(html`<div>${inner}</div>`);

  assertHTMLEqual(result, '<div><span>Inner</span></div>');
});

test('renders arrays of templates', async () => {
  const renderer = createRenderer();
  const items = [1, 2, 3];
  const result = await renderer.renderToString(
    html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>`
  );

  assertHTMLEqual(result, '<ul><li>1</li><li>2</li><li>3</li></ul>');
});

test('escapes HTML in text content', async () => {
  const renderer = createRenderer();
  const unsafe = '<script>alert("xss")</script>';
  const result = await renderer.renderToString(html`<div>${unsafe}</div>`);

  assertHTMLEqual(result, '<div>&lt;script&gt;alert("xss")&lt;/script&gt;</div>');
});
```

### 2. Attribute Binding (baseline/attribute-binding.test.js)

Test attribute handling:

```javascript
test('renders boolean attributes', async () => {
  const renderer = createRenderer();
  const result = await renderer.renderToString(
    html`<button ?disabled=${true}>Click</button>`
  );

  assertHTMLEqual(result, '<button disabled>Click</button>');
});

test('removes false boolean attributes', async () => {
  const renderer = createRenderer();
  const result = await renderer.renderToString(
    html`<button ?disabled=${false}>Click</button>`
  );

  assertHTMLEqual(result, '<button>Click</button>');
});

test('renders property bindings', async () => {
  const renderer = createRenderer();
  const value = 'test-value';
  const result = await renderer.renderToString(
    html`<input .value=${value}>`
  );

  // Properties don't serialize to HTML in SSR
  assertHTMLEqual(result, '<input>');
});

test('renders multi-value attributes', async () => {
  const renderer = createRenderer();
  const cls1 = 'foo';
  const cls2 = 'bar';
  const result = await renderer.renderToString(
    html`<div class="${cls1} ${cls2}">Content</div>`
  );

  assertHTMLEqual(result, '<div class="foo bar">Content</div>');
});
```

### 3. Directives (baseline/directives.test.js)

Test built-in directive behavior:

```javascript
import { repeat } from 'lit/directives/repeat.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { classMap } from 'lit/directives/class-map.js';

test('repeat directive with key function', async () => {
  const renderer = createRenderer();
  const items = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ];

  const result = await renderer.renderToString(html`
    <ul>
      ${repeat(
        items,
        item => item.id,
        item => html`<li>${item.name}</li>`
      )}
    </ul>
  `);

  assertHTMLEqual(result, '<ul><li>Alice</li><li>Bob</li></ul>');
});

test('map directive', async () => {
  const renderer = createRenderer();
  const items = ['a', 'b', 'c'];

  const result = await renderer.renderToString(html`
    <div>${map(items, (item, i) => html`<span>${i}: ${item}</span>`)}</div>
  `);

  assertHTMLEqual(result, '<div><span>0: a</span><span>1: b</span><span>2: c</span></div>');
});

test('when directive', async () => {
  const renderer = createRenderer();

  const resultTrue = await renderer.renderToString(html`
    ${when(true, () => html`<div>Shown</div>`, () => html`<div>Hidden</div>`)}
  `);

  const resultFalse = await renderer.renderToString(html`
    ${when(false, () => html`<div>Shown</div>`, () => html`<div>Hidden</div>`)}
  `);

  assertHTMLEqual(resultTrue, '<div>Shown</div>');
  assertHTMLEqual(resultFalse, '<div>Hidden</div>');
});

test('ifDefined directive', async () => {
  const renderer = createRenderer();

  const result = await renderer.renderToString(html`
    <img src="image.jpg" alt=${ifDefined(undefined)}>
  `);

  assertHTMLEqual(result, '<img src="image.jpg">');
});

test('classMap directive', async () => {
  const renderer = createRenderer();

  const result = await renderer.renderToString(html`
    <div class=${classMap({ active: true, disabled: false, 'has-error': true })}>
      Content
    </div>
  `);

  assertHTMLEqual(result, '<div class="active has-error">Content</div>');
});
```

### 4. Component Rendering (baseline/components.test.js)

Test LitElement component rendering:

```javascript
import { loadFixture } from '../helpers/fixtures.js';

test('renders simple component', async () => {
  const renderer = createRenderer();
  const SimpleElement = await loadFixture('simple-element.js');

  renderer.registerComponents(new Map([
    ['simple-element', SimpleElement]
  ]));

  const result = await renderer.renderToString(html`<simple-element></simple-element>`);

  assertHTMLEqual(result, `
    <simple-element>
      <template shadowroot="open">
        <div>Simple Element Content</div>
      </template>
    </simple-element>
  `);
});

test('renders component with properties', async () => {
  const renderer = createRenderer();
  const GreetingElement = await loadFixture('greeting-element.js');

  renderer.registerComponents(new Map([
    ['greeting-element', GreetingElement]
  ]));

  const result = await renderer.renderToString(
    html`<greeting-element name="Alice"></greeting-element>`
  );

  assertHTMLEqual(result, `
    <greeting-element name="Alice">
      <template shadowroot="open">
        <h1>Hello, Alice!</h1>
      </template>
    </greeting-element>
  `);
});

test('renders component with styles', async () => {
  const renderer = createRenderer();
  const StyledElement = await loadFixture('styled-element.js');

  renderer.registerComponents(new Map([
    ['styled-element', StyledElement]
  ]));

  const result = await renderer.renderToString(html`<styled-element></styled-element>`);

  // Verify style tag is present in shadow root
  assert(result.includes('<style>'));
  assert(result.includes(':host { display: block; }'));
});

test('renders nested components', async () => {
  const renderer = createRenderer();
  const ParentElement = await loadFixture('parent-element.js');
  const ChildElement = await loadFixture('child-element.js');

  renderer.registerComponents(new Map([
    ['parent-element', ParentElement],
    ['child-element', ChildElement]
  ]));

  const result = await renderer.renderToString(html`<parent-element></parent-element>`);

  // Verify nested structure with declarative shadow DOM
  assert(result.includes('<parent-element>'));
  assert(result.includes('<child-element>'));
  assert(result.includes('shadowroot="open"'));
});
```

### 5. Shadow DOM (baseline/shadow-dom.test.js)

Test declarative shadow DOM generation:

```javascript
test('generates declarative shadow DOM', async () => {
  const renderer = createRenderer();
  const ShadowElement = await loadFixture('shadow-element.js');

  renderer.registerComponents(new Map([
    ['shadow-element', ShadowElement]
  ]));

  const result = await renderer.renderToString(html`<shadow-element></shadow-element>`);

  assertHTMLEqual(result, `
    <shadow-element>
      <template shadowroot="open">
        <div class="content">Shadow Content</div>
      </template>
    </shadow-element>
  `);
});

test('handles slotted content', async () => {
  const renderer = createRenderer();
  const SlottedElement = await loadFixture('slotted-element.js');

  renderer.registerComponents(new Map([
    ['slotted-element', SlottedElement]
  ]));

  const result = await renderer.renderToString(html`
    <slotted-element>
      <span slot="header">Header Content</span>
      <p>Default Content</p>
    </slotted-element>
  `);

  // Verify slot structure
  assert(result.includes('<slot name="header"></slot>'));
  assert(result.includes('<slot></slot>'));
  assert(result.includes('slot="header"'));
});
```

### 6. Streaming (baseline/streaming.test.js)

Test streaming output:

```javascript
import { collectStream } from '../helpers/stream.js';

test('streams template output', async () => {
  const renderer = createRenderer();
  const template = html`<div>Streaming Content</div>`;

  const stream = renderer.renderToStream(template);
  const result = await collectStream(stream);

  assertHTMLEqual(result, '<div>Streaming Content</div>');
});

test('streams large content efficiently', async () => {
  const renderer = createRenderer();
  const items = Array.from({ length: 1000 }, (_, i) => i);

  const template = html`
    <ul>
      ${items.map(i => html`<li>Item ${i}</li>`)}
    </ul>
  `;

  const stream = renderer.renderToStream(template);

  // Verify streaming happens (chunks arrive before full completion)
  const chunks = [];
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }

  // Should receive multiple chunks for large content
  assert(chunks.length > 1, 'Should stream in multiple chunks');
});
```

### 7. Server-Only Templates (baseline/server-only-templates.test.js)

Test server-only template rendering:

```javascript
import { html as serverHtml } from '@lit-labs/ssr';
import { html } from 'lit';

test('server-only template omits hydration markers', async () => {
  const renderer = createRenderer();
  const template = serverHtml`<div>Static content</div>`;

  const result = await renderer.renderToString(template);

  assertHTMLEqual(result, '<div>Static content</div>');
  assert(!result.includes('<!--lit-part'));
});

test('server-only renders full document', async () => {
  const renderer = createRenderer();
  const template = serverHtml`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Page</title>
      </head>
      <body>
        <h1>Hello</h1>
      </body>
    </html>
  `;

  const result = await renderer.renderToString(template);

  assert(result.startsWith('<!DOCTYPE html>'));
  assert(result.includes('<html>'));
  assert(result.includes('<title>Test Page</title>'));
  assert(!result.includes('<!--lit-part'));
});

test('server-only can contain regular templates', async () => {
  const renderer = createRenderer();
  const inner = html`<div>Hydratable</div>`;
  const outer = serverHtml`<body>${inner}</body>`;

  const result = await renderer.renderToString(outer);

  // Outer has no markers
  assert(!result.startsWith('<!--lit-part'));

  // Inner has markers
  assert(result.includes('<!--lit-part'));
  assert(result.includes('<!--/lit-part'));
});

test('server-only renders script tags safely', async () => {
  const renderer = createRenderer();
  const data = { user: 'Alice', id: 123 };
  const template = serverHtml`
    <script type="application/json">
      ${JSON.stringify(data)}
    </script>
  `;

  const result = await renderer.renderToString(template);

  assertHTMLEqual(
    result,
    '<script type="application/json">{"user":"Alice","id":123}</script>'
  );
});

test('server-only rejects event bindings', async () => {
  const renderer = createRenderer();
  const handler = () => {};
  const template = serverHtml`<button @click=${handler}>Click</button>`;

  await assert.rejects(
    () => renderer.renderToString(template),
    /can't bind to events/
  );
});

test('server-only rejects property bindings', async () => {
  const renderer = createRenderer();
  const value = 'test';
  const template = serverHtml`<input .value=${value}>`;

  await assert.rejects(
    () => renderer.renderToString(template),
    /can't bind to properties/
  );
});

test('regular template cannot contain server-only', async () => {
  const renderer = createRenderer();
  const inner = serverHtml`<p>Server-only</p>`;
  const outer = html`<div>${inner}</div>`;

  await assert.rejects(
    () => renderer.renderToString(outer),
    /can't be rendered inside.*hydratable template/
  );
});
```

### 8. Edge Cases (baseline/edge-cases.test.js)

Test corner cases and error conditions:

```javascript
test('handles nothing sentinel', async () => {
  const renderer = createRenderer();
  const { nothing } = await import('lit');

  const result = await renderer.renderToString(html`<div>${nothing}</div>`);

  assertHTMLEqual(result, '<div></div>');
});

test('handles null and undefined', async () => {
  const renderer = createRenderer();

  const resultNull = await renderer.renderToString(html`<div>${null}</div>`);
  const resultUndefined = await renderer.renderToString(html`<div>${undefined}</div>`);

  assertHTMLEqual(resultNull, '<div></div>');
  assertHTMLEqual(resultUndefined, '<div></div>');
});

test('handles empty arrays', async () => {
  const renderer = createRenderer();

  const result = await renderer.renderToString(html`<div>${[]}</div>`);

  assertHTMLEqual(result, '<div></div>');
});

test('handles deeply nested structures', async () => {
  const renderer = createRenderer();

  const deep = html`
    <div>
      ${html`
        <div>
          ${html`
            <div>
              ${html`<span>Deep</span>`}
            </div>
          `}
        </div>
      `}
    </div>
  `;

  const result = await renderer.renderToString(deep);

  assertHTMLEqual(result, '<div><div><div><span>Deep</span></div></div></div>');
});
```

---

## Fixture Organization

### Directory Structure

```
test/
├── fixtures/
│   ├── components/
│   │   ├── simple-element.js
│   │   ├── greeting-element.js
│   │   ├── styled-element.js
│   │   ├── parent-element.js
│   │   ├── child-element.js
│   │   ├── shadow-element.js
│   │   ├── slotted-element.js
│   │   └── reactive-element.js
│   ├── templates/
│   │   ├── basic.js
│   │   ├── complex.js
│   │   └── edge-cases.js
│   └── README.md
├── helpers/
│   ├── renderer.js
│   ├── html-compare.js
│   ├── stream.js
│   └── fixtures.js
└── integration/
    └── baseline/
        ├── template-rendering.test.js
        ├── attribute-binding.test.js
        ├── directives.test.js
        ├── components.test.js
        ├── shadow-dom.test.js
        ├── streaming.test.js
        └── edge-cases.test.js
```

### Fixture Example: Simple Element

```javascript
// test/fixtures/components/simple-element.js
import { LitElement, html, css } from 'lit';

export class SimpleElement extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    return html`<div>Simple Element Content</div>`;
  }
}

export default SimpleElement;
```

### Fixture Example: Greeting Element

```javascript
// test/fixtures/components/greeting-element.js
import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';

export class GreetingElement extends LitElement {
  static properties = {
    name: { type: String }
  };

  constructor() {
    super();
    this.name = 'World';
  }

  render() {
    return html`<h1>Hello, ${this.name}!</h1>`;
  }
}

export default GreetingElement;
```

### Fixture Helper

```javascript
// test/helpers/fixtures.js
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

/**
 * Loads a fixture component
 *
 * @param {string} name - Fixture filename (e.g., 'simple-element.js')
 * @returns {Promise<CustomElementConstructor>} Component class
 */
export async function loadFixture(name) {
  const fixturePath = join(process.cwd(), 'test/fixtures/components', name);
  const fixtureURL = pathToFileURL(fixturePath).href;

  // Add cache busting to ensure fresh import
  const module = await import(`${fixtureURL}?t=${Date.now()}`);

  return module.default || module[Object.keys(module)[0]];
}

/**
 * Loads multiple fixtures
 *
 * @param {string[]} names - Fixture filenames
 * @returns {Promise<Map<string, CustomElementConstructor>>} Component map
 */
export async function loadFixtures(names) {
  const components = new Map();

  for (const name of names) {
    const ctor = await loadFixture(name);
    const tagName = name.replace('.js', '');
    components.set(tagName, ctor);
  }

  return components;
}
```

---

## Assertion Patterns

### ✅ Preferred Patterns

**Full HTML comparison:**
```javascript
assertHTMLEqual(actual, expected);
```

**Exact string matching:**
```javascript
strictEqual(actual, expected);
```

**Stream collection:**
```javascript
const result = await collectStream(stream);
assertHTMLEqual(result, expected);
```

### ❌ Avoid These Patterns

**Partial matching:**
```javascript
// Don't use
assert(result.includes('expected'));
```

**Regex matching:**
```javascript
// Don't use
assert(/expected/.test(result));
```

**Multiple assertions on same output:**
```javascript
// Don't use
assert(result.includes('<div>'));
assert(result.includes('content'));
assert(result.includes('</div>'));

// Instead, compare full HTML
assertHTMLEqual(result, '<div>content</div>');
```

---

## Test Execution

### Running Tests

**Run all baseline tests against lit-edge (default):**
```bash
npm test
```

**Run baseline tests against original @lit-labs/ssr:**
```bash
TEST_IMPL=lit-ssr npm test
```

**Run specific test file:**
```bash
node --test test/integration/baseline/template-rendering.test.js
```

**Run with coverage:**
```bash
node --test --experimental-test-coverage test/integration/baseline/**/*.test.js
```

**Watch mode:**
```bash
node --test --watch test/integration/baseline/**/*.test.js
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "node --test test/integration/baseline/**/*.test.js",
    "test:lit-ssr": "TEST_IMPL=lit-ssr npm test",
    "test:lit-edge": "TEST_IMPL=lit-edge npm test",
    "test:all": "npm run test:lit-ssr && npm run test:lit-edge",
    "test:watch": "node --test --watch test/integration/baseline/**/*.test.js",
    "test:coverage": "node --test --experimental-test-coverage test/integration/baseline/**/*.test.js",
    "test:unit": "node --test test/unit/**/*.test.js",
    "test:edge": "node --test test/edge/**/*.test.js"
  }
}
```

### Environment Variables

| Variable | Values | Default | Purpose |
|----------|--------|---------|---------|
| `TEST_IMPL` | `lit-ssr`, `lit-edge` | `lit-edge` | Which implementation to test |
| `TEST_VERBOSE` | `true`, `false` | `false` | Verbose output |
| `TEST_TIMEOUT` | Number (ms) | `5000` | Test timeout |

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  baseline:
    name: Baseline Tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]
        implementation: [lit-ssr, lit-edge]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run baseline tests (${{ matrix.implementation }})
        run: npm test
        env:
          TEST_IMPL: ${{ matrix.implementation }}

      - name: Upload coverage
        if: matrix.implementation == 'lit-edge'
        uses: codecov/codecov-action@v3

  unit:
    name: Unit Tests
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit

  edge-runtime:
    name: Edge Runtime Tests
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'
      - run: npm ci

      # Install Cloudflare Workers CLI
      - run: npm install -g wrangler

      # Run edge runtime tests
      - run: npm run test:edge
```

---

## Performance Testing

### Benchmark Suite

```javascript
// test/performance/render-benchmark.js
import { performance } from 'node:perf_hooks';
import { createRenderer } from '../helpers/renderer.js';

async function benchmark(name, fn, iterations = 1000) {
  // Warmup
  for (let i = 0; i < 10; i++) {
    await fn();
  }

  // Measure
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    await fn();
  }

  const end = performance.now();
  const duration = end - start;
  const avgMs = duration / iterations;

  console.log(`${name}: ${avgMs.toFixed(3)}ms avg (${iterations} iterations, ${duration.toFixed(0)}ms total)`);

  return { name, avgMs, total: duration, iterations };
}

async function runBenchmarks() {
  const renderer = createRenderer();

  const results = [];

  // Simple template
  results.push(await benchmark(
    'Simple template',
    () => renderer.renderToString(html`<div>Hello</div>`)
  ));

  // Template with expressions
  results.push(await benchmark(
    'Template with expressions',
    () => renderer.renderToString(html`<div>Hello ${'World'}</div>`)
  ));

  // List rendering
  results.push(await benchmark(
    'List rendering (100 items)',
    () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      return renderer.renderToString(
        html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>`
      );
    },
    100
  ));

  // Component rendering
  const SimpleElement = await loadFixture('simple-element.js');
  renderer.registerComponents(new Map([['simple-element', SimpleElement]]));

  results.push(await benchmark(
    'Component rendering',
    () => renderer.renderToString(html`<simple-element></simple-element>`)
  ));

  return results;
}

// Run benchmarks
const results = await runBenchmarks();

// Save results for comparison
const fs = await import('node:fs/promises');
await fs.writeFile(
  'benchmark-results.json',
  JSON.stringify(results, null, 2)
);
```

### Performance Comparison

```bash
# Benchmark @lit-labs/ssr
TEST_IMPL=lit-ssr node test/performance/render-benchmark.js > benchmark-lit-ssr.json

# Benchmark lit-edge
TEST_IMPL=lit-edge node test/performance/render-benchmark.js > benchmark-lit-edge.json

# Compare results
node test/performance/compare-benchmarks.js benchmark-lit-ssr.json benchmark-lit-edge.json
```

---

## Summary

### Testing Workflow

1. **Write baseline test** - Test against @lit-labs/ssr first
2. **Verify baseline passes** - `TEST_IMPL=lit-ssr npm test`
3. **Implement feature in lit-edge** - Build the functionality
4. **Run against lit-edge** - `TEST_IMPL=lit-edge npm test`
5. **Iterate until passing** - Fix implementation
6. **Verify both implementations** - `npm run test:all`
7. **Commit passing tests** - Both implementations work

### Success Criteria

✅ All baseline tests pass against both implementations
✅ Output is byte-for-byte identical (after normalization)
✅ No regressions in edge runtime tests
✅ Performance within 2x of @lit-labs/ssr
✅ 100% test coverage for public API

### Next Steps

1. Set up test infrastructure (helpers, fixtures)
2. Implement initial baseline tests
3. Verify tests pass against @lit-labs/ssr
4. Begin lit-edge implementation
5. Iterate until all tests pass

---

## References

- [Node.js Test Runner](https://nodejs.org/api/test.html)
- [@lit-labs/ssr Documentation](https://lit.dev/docs/ssr/overview/)
- [Lit Testing Best Practices](https://lit.dev/docs/tools/testing/)
- [Web Test Runner](https://modern-web.dev/docs/test-runner/overview/) (future consideration)
