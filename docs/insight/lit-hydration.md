# Lit SSR Hydration System

This document provides comprehensive analysis of Lit's hydration system, focusing on how server-rendered output reconnects with client-side JavaScript for reactivity. This knowledge is critical for ensuring lit-ssr-edge generates output compatible with Lit's official `@lit-labs/ssr-client` hydration code.

## Table of Contents

1. [Hydration Overview](#hydration-overview)
2. [Hydration Marker System](#hydration-marker-system)
3. [Template Digest Algorithm](#template-digest-algorithm)
4. [Client-Side Hydration Process](#client-side-hydration-process)
5. [LitElement Hydration](#litelement-hydration)
6. [Declarative Shadow DOM](#declarative-shadow-dom)
7. [Requirements for lit-ssr-edge](#requirements-for-lit-ssr-edge)
8. [Hydration Example Flow](#hydration-example-flow)

---

## Hydration Overview

### What is Hydration?

Hydration is the process of reconnecting server-rendered static HTML with client-side JavaScript to restore reactivity and interactivity. In Lit's case:

1. **Server renders** - Components render to static HTML with special markers
2. **Browser parses** - HTML displays immediately (fast first paint)
3. **JavaScript loads** - Lit loads and initializes
4. **Hydration occurs** - Markers guide reconstruction of Lit's internal data structures
5. **App becomes interactive** - Event handlers attach, updates work normally

### Two Hydration Scenarios

| Scenario | Hydration Approach | Use Case |
|----------|-------------------|----------|
| **Standalone Templates** | Manual `hydrate()` call | Server-rendered template containers |
| **LitElement Components** | Automatic via `lit-element-hydrate-support.js` | Custom element components |

### Key Benefits

- **Fast First Paint** - HTML renders before JavaScript loads
- **SEO Friendly** - Crawlers see complete HTML content
- **Progressive Enhancement** - Works even if JavaScript fails
- **Efficient Updates** - Hydration reuses DOM instead of recreating

---

## Hydration Marker System

### Marker Types

Lit's SSR output includes HTML comment markers to track template structure and binding locations.

#### 1. ChildPart Markers

**Opening Marker:**
```html
<!--lit-part DIGEST-->
```

**Closing Marker:**
```html
<!--/lit-part-->
```

**Purpose:**
- Mark beginning and end of a ChildPart (dynamic content position)
- Optional `DIGEST` is a base64-encoded template hash for validation
- Nested templates create nested marker pairs

**Example:**
```html
<!--lit-part AEmR7W+R0Ak=-->
<div>Dynamic Content</div>
<!--/lit-part-->
```

#### 2. Node Markers

**Format:**
```html
<!--lit-node INDEX-->
```

**Purpose:**
- Mark elements that have attribute/property/event bindings
- `INDEX` is the depth-first node index in the template
- Indicates the next element has AttributeParts

**Example:**
```html
<!--lit-node 0-->
<div class="dynamic-class">Content</div>
```

#### 3. Nested Structure Example

```html
<!--lit-part AEmR7W+R0Ak=-->
<!--lit-node 0-->
<div class="active">
  <!--lit-part-->
  Hello, World!
  <!--/lit-part-->
</div>
<!--/lit-part-->
```

This represents:
```javascript
html`<div class=${className}>${content}</div>`
```

### Marker Placement Rules

1. **Before elements with bindings** - `<!--lit-node INDEX-->` precedes the element
2. **Around dynamic content** - Opening/closing `lit-part` surround child positions
3. **Nested templates** - Create nested marker hierarchies
4. **Template digests** - Only on outermost `lit-part` of each TemplateResult

---

## Template Digest Algorithm

### Purpose

Template digests uniquely identify template structures to validate that client and server used the same template. Mismatches throw hydration errors.

### Algorithm (DJB2-based Hash)

```typescript
function digestForTemplateResult(templateResult: TemplateResult): string {
  // Check cache first
  let digest = digestCache.get(templateResult.strings);
  if (digest !== undefined) return digest;

  // Initialize two 32-bit hash values (DJB2 initial value)
  const hashes = new Uint32Array(2).fill(5381);

  // Hash all template strings
  for (const s of templateResult.strings) {
    for (let i = 0; i < s.length; i++) {
      // Alternate between two hash values to improve distribution
      hashes[i % 2] = (hashes[i % 2] * 33) ^ s.charCodeAt(i);
    }
  }

  // Convert Uint32Array to binary string
  const str = String.fromCharCode(...new Uint8Array(hashes.buffer));

  // Base64 encode for HTML safety
  digest = btoa(str); // Browser
  // or: Buffer.from(str, 'binary').toString('base64'); // Node.js

  // Cache for reuse
  digestCache.set(templateResult.strings, digest);
  return digest;
}
```

### Key Properties

| Property | Value |
|----------|-------|
| **Input** | `TemplateStringsArray` from template literal |
| **Hash type** | DJB2 variant with two 32-bit accumulators |
| **Output format** | Base64-encoded 8-byte string |
| **Example** | `AEmR7W+R0Ak=` |
| **Caching** | WeakMap keyed by template strings array |

### Why Two Hash Values?

Using two alternating hash accumulators improves distribution and reduces collision probability while keeping output compact (8 bytes → ~11 base64 chars).

### Template Identity

```javascript
// Same template literal reference
const template = html`<div>${x}</div>`;

// Always produces same digest
digestForTemplateResult({ strings: template.strings }); // "AEmR7W+R0Ak="
digestForTemplateResult({ strings: template.strings }); // "AEmR7W+R0Ak="

// Different template (different strings array)
const other = html`<div>${x}</div>`;
digestForTemplateResult({ strings: other.strings }); // Different digest!
```

**Critical insight:** JavaScript creates a new `TemplateStringsArray` for each unique template literal location in source code. Same template text in different locations = different digests.

---

## Client-Side Hydration Process

### Package: @lit-labs/ssr-client

The `@lit-labs/ssr-client` package provides hydration utilities.

### Main Export: hydrate()

```typescript
import { hydrate } from '@lit-labs/ssr-client';

hydrate(
  rootValue: unknown,        // Same template/data used on server
  container: Element | DocumentFragment,  // Container with SSR'd content
  options?: Partial<RenderOptions>
): void
```

### Hydration Algorithm

```
1. Validate container has no existing render
   └─ Check for _$litPart$ property

2. Create TreeWalker for comment nodes
   └─ NodeFilter.SHOW_COMMENT

3. Walk DOM and process markers:

   When <!--lit-part DIGEST-->:
   ├─ Create ChildPart
   ├─ Validate digest matches template
   ├─ Resolve value (directive/primitive/template/iterable)
   └─ Push state to stack

   When <!--lit-node INDEX-->:
   ├─ Find element at index
   ├─ Create AttributeParts from template metadata
   ├─ Set committed values from template.values
   └─ Remove defer-hydration attribute

   When <!--/lit-part-->:
   ├─ Set ChildPart end node
   ├─ Validate iterable completion (if applicable)
   └─ Pop state from stack

4. Attach root ChildPart to container
   └─ container._$litPart$ = rootPart

5. Return (container now hydratable with render())
```

### State Management

The hydration process maintains a stack of states to handle nested templates:

```typescript
type ChildPartState =
  | { type: 'leaf'; part: ChildPart }
  | {
      type: 'iterable';
      part: ChildPart;
      value: Iterable<unknown>;
      iterator: Iterator<unknown>;
      done: boolean;
    }
  | {
      type: 'template-instance';
      part: ChildPart;
      result: TemplateResult;
      instance: TemplateInstance;
      templatePartIndex: number;
      instancePartIndex: number;
    };
```

**States:**

- **Leaf** - Simple value (primitive, directive result)
- **Iterable** - Array/iterable requiring multiple ChildParts
- **Template Instance** - Nested template with sub-parts to hydrate

### Value Handling During Hydration

```typescript
function openChildPart(rootValue, marker, stack, options) {
  // 1. Create ChildPart
  const part = new ChildPart(marker, null, undefined, options);

  // 2. Resolve directives
  const value = resolveDirective(part, rootValue);

  // 3. Handle by type
  if (isPrimitive(value)) {
    // Primitive - simple leaf state
    part._$committedValue = value;
    return { type: 'leaf', part };
  }

  if (isTemplateResult(value)) {
    // Validate digest
    const digest = marker.data.split(' ')[1];
    const expected = digestForTemplateResult(value);
    if (digest !== expected) {
      throw new Error('Hydration value mismatch');
    }

    // Create TemplateInstance
    const instance = new TemplateInstance(getTemplate(value), part);
    part._$committedValue = instance;

    return {
      type: 'template-instance',
      part,
      result: value,
      instance,
      templatePartIndex: 0,
      instancePartIndex: 0
    };
  }

  if (isIterable(value)) {
    // Iterable - will create multiple child parts
    return {
      type: 'iterable',
      part,
      value,
      iterator: value[Symbol.iterator](),
      done: false
    };
  }

  // Other types
  part._$committedValue = value;
  return { type: 'leaf', part };
}
```

### AttributePart Creation

```typescript
function createAttributeParts(marker, stack, options) {
  // Get current template instance state
  const state = stack[stack.length - 1];
  if (state.type !== 'template-instance') return;

  const { instance, result } = state;
  const template = instance._$template;

  // Parse node index from marker
  const nodeIndex = parseInt(marker.data.split(' ')[1], 10);

  // Find all template parts for this node
  while (state.templatePartIndex < template.parts.length) {
    const part = template.parts[state.templatePartIndex];

    if (part.index !== nodeIndex) break;

    // Create appropriate Part type
    const instancePart = instance._$parts[state.instancePartIndex];
    const value = result.values[state.templatePartIndex];

    // Set committed value
    instancePart._$setValue(value);

    state.templatePartIndex++;
    state.instancePartIndex++;
  }

  // Remove defer-hydration attribute (prevents premature initialization)
  const element = getElementAtIndex(marker, nodeIndex);
  element.removeAttribute('defer-hydration');
}
```

---

## LitElement Hydration

### Automatic Hydration Support

LitElement components hydrate automatically when `lit-element-hydrate-support.js` is loaded before component definitions.

### Loading Order (Critical!)

```html
<!-- 1. Load hydration support FIRST -->
<script src="/node_modules/@lit-labs/ssr-client/lit-element-hydrate-support.js"></script>

<!-- 2. Then load Lit -->
<script src="/node_modules/lit/index.js"></script>

<!-- 3. Then load components -->
<script src="/my-components.js"></script>
```

**Why?** The hydration support patches `LitElement.prototype` before component classes are defined.

### Hydration Support Patches

The `lit-element-hydrate-support` module patches four key areas:

#### 1. observedAttributes Extension

```typescript
// Add defer-hydration to observed attributes
Object.defineProperty(LitElement, 'observedAttributes', {
  get() {
    const attrs = originalObservedAttributes.call(this);
    return [...attrs, 'defer-hydration'];
  }
});
```

**Purpose:** Watch for `defer-hydration` attribute removal to trigger initialization.

#### 2. connectedCallback Deferral

```typescript
LitElement.prototype.connectedCallback = function() {
  // If defer-hydration present, skip initialization
  if (this.hasAttribute('defer-hydration')) {
    return;
  }

  // Otherwise, run original callback
  originalConnectedCallback.call(this);
};
```

**Purpose:** Prevent component from initializing until hydration completes.

#### 3. Shadow Root Detection

```typescript
LitElement.prototype.createRenderRoot = function() {
  // Check if shadow root already exists (from SSR)
  if (this.shadowRoot) {
    this._$needsHydration = true;
    return this.shadowRoot;
  }

  // Otherwise create normally
  return originalCreateRenderRoot.call(this);
};
```

**Purpose:** Detect server-rendered shadow DOM and flag for hydration.

#### 4. Hydration vs Rendering

```typescript
LitElement.prototype.update = function(changedProperties) {
  // Clean up SSR ARIA shim attributes
  for (const attrName of this.getAttributeNames()) {
    if (attrName.startsWith('hydrate-internals-')) {
      this.removeAttribute(attrName);
    }
  }

  // First update after SSR - hydrate instead of render
  if (this._$needsHydration) {
    this._$needsHydration = false;

    const value = this.render();
    hydrate(value, this.renderRoot, this.renderOptions);
  } else {
    // Normal rendering
    originalUpdate.call(this, changedProperties);
  }
};
```

**Purpose:** Use `hydrate()` on first update instead of `render()`, preserving SSR'd DOM.

### defer-hydration Attribute

Server-rendered LitElements include `defer-hydration` attribute:

```html
<my-element defer-hydration>
  <template shadowroot="open">
    <!-- Shadow DOM content -->
  </template>
</my-element>
```

**Lifecycle:**

1. Browser parses HTML, custom element defined
2. `connectedCallback` runs but sees `defer-hydration` → returns early
3. JavaScript loads and removes `defer-hydration`
4. Attribute change triggers `connectedCallback` again
5. Component initializes with existing shadow root
6. First `update()` calls `hydrate()` instead of `render()`

---

## Declarative Shadow DOM

### What is Declarative Shadow DOM?

Declarative Shadow DOM is a web standard that allows shadow roots to be declared in HTML without JavaScript:

```html
<my-element>
  <template shadowroot="open">
    <style>:host { display: block; }</style>
    <slot></slot>
  </template>
</my-element>
```

When parsed, the browser:
1. Creates a shadow root on `<my-element>`
2. Moves `<template>` contents into shadow root
3. Removes the `<template>` element

### Browser Support

| Browser | Support |
|---------|---------|
| Chrome | 90+ |
| Edge | 90+ |
| Safari | 16.4+ |
| Firefox | 123+ |

### Polyfill for Older Browsers

```javascript
// Check for native support
if (!HTMLTemplateElement.prototype.hasOwnProperty('shadowRoot')) {
  // Load polyfill
  const { hydrateShadowRoots } = await import(
    '@webcomponents/template-shadowroot/template-shadowroot.js'
  );

  // Apply to document
  hydrateShadowRoots(document.body);
}
```

### DSD Output Format

```html
<my-element>
  <template shadowroot="open">
    <style>
      :host {
        display: block;
      }
    </style>
    <div class="content">
      <slot></slot>
    </div>
  </template>
  <!-- Light DOM children (slotted content) -->
  <span slot="header">Header</span>
</my-element>
```

### Lit SSR Output Structure

```html
<my-element defer-hydration>
  <template shadowroot="open">
    <style>/* Component styles */</style>
    <!--lit-part AEmR7W+R0Ak=-->
    <!--lit-node 0-->
    <div class="container">
      <!--lit-part-->
      Rendered content
      <!--/lit-part-->
    </div>
    <!--/lit-part-->
  </template>
</my-element>
```

**Key features:**
- `defer-hydration` on host element
- `<template shadowroot="open">` with shadow content
- Hydration markers inside shadow root
- Styles embedded in shadow root

---

## Requirements for lit-ssr-edge

To ensure our lit-ssr-edge implementation is compatible with Lit's official client-side hydration, we must:

### 1. Generate Correct Markers

**ChildPart markers:**
```html
<!--lit-part DIGEST-->
<!-- content -->
<!--/lit-part-->
```

**Node markers:**
```html
<!--lit-node INDEX-->
<element>...</element>
```

**Placement:**
- Before elements with bindings: `lit-node`
- Around child expressions: `lit-part` pairs
- Nested templates: nested `lit-part` pairs

### 2. Calculate Template Digests

Implement the exact digest algorithm:

```javascript
function digestForTemplateResult(templateResult) {
  const hashes = new Uint32Array(2).fill(5381);

  for (const s of templateResult.strings) {
    for (let i = 0; i < s.length; i++) {
      hashes[i % 2] = (hashes[i % 2] * 33) ^ s.charCodeAt(i);
    }
  }

  const str = String.fromCharCode(...new Uint8Array(hashes.buffer));
  return btoa(str);
}
```

**Critical:** Must match exactly or hydration will fail.

### 3. Generate Declarative Shadow DOM

Components must output:

```html
<custom-element defer-hydration>
  <template shadowroot="open">
    <style>/* styles */</style>
    <!-- hydration markers and content -->
  </template>
</custom-element>
```

**Required attributes:**
- `defer-hydration` on host
- `shadowroot="open"` on template (or `shadowroot="closed"`)

### 4. Embed Styles in Shadow Roots

```html
<template shadowroot="open">
  <style>
    :host {
      display: block;
    }
    .content {
      padding: 16px;
    }
  </style>
  <!-- content -->
</template>
```

All component styles must be in `<style>` tags within the shadow root.

### 5. Node Index Calculation

Node indices must match depth-first traversal order:

```html
<!--lit-node 0-->  <!-- First element -->
<div>
  <!--lit-node 1-->  <!-- Second element -->
  <span></span>
</div>
<!--lit-node 2-->  <!-- Third element -->
<p></p>
```

**Algorithm:**
```javascript
function calculateNodeIndex(element, template) {
  let index = 0;
  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_ELEMENT
  );

  while (walker.nextNode()) {
    if (walker.currentNode === element) {
      return index;
    }
    index++;
  }

  return -1;
}
```

### 6. Value Commitment During SSR

During SSR, we must:
- Resolve all directives
- Render primitives to text
- Recursively render nested templates
- Handle iterables by creating multiple child parts
- Escape HTML in text content

### 7. Attribute Handling

**Boolean attributes:**
```html
<!-- true -->
<button disabled>Click</button>

<!-- false (attribute omitted) -->
<button>Click</button>
```

**Property bindings (.prop):**
- Properties don't serialize to HTML
- No marker needed in SSR output
- Hydration will set from template values

**Event bindings (@event):**
- Events don't serialize
- No marker in SSR output
- Hydration attaches listeners

### 8. Slot Distribution

```html
<template shadowroot="open">
  <slot name="header"></slot>
  <div class="content">
    <slot></slot>
  </div>
</template>
<!-- Light DOM (slotted content) -->
<h1 slot="header">Title</h1>
<p>Content paragraph</p>
```

Slots must be present in shadow DOM for browser distribution.

---

## Hydration Example Flow

### Server-Side (lit-ssr-edge generates this)

```javascript
// Server template
const template = html`<div class=${className}>${content}</div>`;

// lit-ssr-edge renders to:
```

```html
<!--lit-part AEmR7W+R0Ak=-->
<!--lit-node 0-->
<div class="active">
  <!--lit-part-->
  Hello, World!
  <!--/lit-part-->
</div>
<!--/lit-part-->
```

### Client-Side (browser receives this)

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { hydrate } from '@lit-labs/ssr-client';
    import { html } from 'lit';

    // Same template and data as server
    const className = 'active';
    const content = 'Hello, World!';
    const template = html`<div class=${className}>${content}</div>`;

    // Hydrate container
    hydrate(template, document.body);

    // Now can render updates
    import { render } from 'lit';
    render(html`<div class="updated">New content</div>`, document.body);
  </script>
</head>
<body>
  <!--lit-part AEmR7W+R0Ak=-->
  <!--lit-node 0-->
  <div class="active">
    <!--lit-part-->
    Hello, World!
    <!--/lit-part-->
  </div>
  <!--/lit-part-->
</body>
</html>
```

### Hydration Process

```
1. hydrate() called with template and container

2. TreeWalker finds: <!--lit-part AEmR7W+R0Ak=-->
   ├─ Create ChildPart
   ├─ Extract digest: "AEmR7W+R0Ak="
   ├─ Calculate digest from template
   ├─ Validate digests match ✓
   └─ Push template-instance state

3. TreeWalker finds: <!--lit-node 0-->
   ├─ Find element at index 0: <div class="active">
   ├─ Template has AttributePart for class
   ├─ Create AttributePart
   ├─ Set committed value: "active"
   └─ Remove defer-hydration (if present)

4. TreeWalker finds: <!--lit-part--> (child part)
   ├─ Create ChildPart for content
   ├─ Value is primitive: "Hello, World!"
   ├─ Set committed value
   └─ Push leaf state

5. TreeWalker finds: <!--/lit-part--> (child part end)
   ├─ Set end node
   └─ Pop leaf state

6. TreeWalker finds: <!--/lit-part--> (root part end)
   ├─ Set end node
   └─ Pop template-instance state

7. Attach to container
   └─ container._$litPart$ = rootPart

8. Hydration complete ✓
```

### Subsequent Updates

```javascript
// Render new content
render(html`<div class="updated">New content</div>`, document.body);

// Lit's normal rendering takes over:
// - Reuses ChildPart from hydration
// - Diffs template (different strings array)
// - Replaces DOM content efficiently
```

---

## Summary

### Critical Hydration Requirements for lit-ssr-edge

1. ✅ **Generate hydration markers** - `lit-part`, `lit-node`, `/lit-part`
2. ✅ **Calculate template digests** - DJB2 hash with exact algorithm
3. ✅ **Output Declarative Shadow DOM** - `<template shadowroot>`
4. ✅ **Include `defer-hydration` attribute** - On LitElement hosts
5. ✅ **Embed styles in shadow roots** - Component CSS in `<style>` tags
6. ✅ **Calculate correct node indices** - Depth-first element order
7. ✅ **Preserve marker structure** - Proper nesting and placement
8. ✅ **Handle all value types** - Primitives, templates, directives, iterables

### Compatibility Promise

If lit-ssr-edge generates output matching these requirements, then:

- ✅ `@lit-labs/ssr-client` hydration works without modification
- ✅ LitElement components hydrate automatically
- ✅ Standalone templates hydrate with `hydrate()`
- ✅ Updates work normally after hydration
- ✅ No client-side re-rendering needed

### Testing Strategy

To verify hydration compatibility:

```javascript
// 1. Render with lit-ssr-edge (server)
const ssrOutput = await renderToString(template);

// 2. Load in browser with client script
document.body.innerHTML = ssrOutput;

// 3. Hydrate with official @lit-labs/ssr-client
import { hydrate } from '@lit-labs/ssr-client';
hydrate(template, document.body);

// 4. Verify no errors
// 5. Test updates work
render(updatedTemplate, document.body);
```

---

## References

- [@lit-labs/ssr Documentation](https://lit.dev/docs/ssr/overview/)
- [@lit-labs/ssr-client Package](https://github.com/lit/lit/tree/main/packages/labs/ssr-client)
- [Declarative Shadow DOM](https://web.dev/declarative-shadow-dom/)
- [Lit Hydration Client Usage](https://lit.dev/docs/ssr/client-usage/)
- [Template Shadowroot Polyfill](https://github.com/webcomponents/template-shadowroot)
