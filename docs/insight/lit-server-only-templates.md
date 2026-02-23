# Lit Server-Only Templates

This document analyzes Lit's server-only templates feature, a specialized template type designed exclusively for server-side rendering without client-side hydration capabilities.

## Table of Contents

1. [Overview](#overview)
2. [Server-Only vs Regular Templates](#server-only-vs-regular-templates)
3. [The Server-Only html Function](#the-server-only-html-function)
4. [ServerTemplate Type Structure](#servertemplate-type-structure)
5. [Rendering Differences](#rendering-differences)
6. [Composition Rules](#composition-rules)
7. [Use Cases](#use-cases)
8. [Constraints and Limitations](#constraints-and-limitations)
9. [Implementation Requirements for lit-edge](#implementation-requirements-for-lit-edge)
10. [Examples](#examples)

---

## Overview

### What Are Server-Only Templates?

Server-only templates are templates that render **exclusively on the server** and **cannot be hydrated or updated on the client**. They use a special `html` function exported from `@lit-labs/ssr` (not from `lit`).

```javascript
// Regular Lit template (can hydrate)
import { html } from 'lit';
const regularTemplate = html`<div>Can be hydrated</div>`;

// Server-only template (cannot hydrate)
import { html } from '@lit-labs/ssr';
const serverTemplate = html`<!DOCTYPE html><html>...</html>`;
```

### Why Server-Only Templates?

**Benefits:**

1. **No hydration overhead** - Skip generating hydration markers
2. **Full document support** - Can render `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`
3. **Special elements** - Can render `<title>`, `<textarea>`, `<template>`, `<script type="...">>`
4. **Performance** - More efficient rendering (no marker generation)
5. **Simpler output** - Cleaner HTML without hydration comments

**Trade-off:**
- Cannot update on client (static server output)
- No event handlers or property bindings
- No element parts

---

## Server-Only vs Regular Templates

### Feature Comparison

| Feature | Regular Template | Server-Only Template |
|---------|------------------|---------------------|
| **Import from** | `lit` | `@lit-labs/ssr` |
| **Client hydration** | ✅ Yes | ❌ No |
| **Hydration markers** | ✅ Generated | ❌ Omitted |
| **Document elements** | ❌ No | ✅ Yes (`<!DOCTYPE>`, `<html>`, etc.) |
| **Special elements** | ❌ Limited | ✅ `<title>`, `<textarea>`, `<template>` |
| **Script tags** | ❌ Can't render safely | ✅ Can render `<script type="...">` |
| **Event bindings** | ✅ `@event` | ❌ Forbidden |
| **Property bindings** | ✅ `.prop` | ❌ Forbidden |
| **Element parts** | ✅ Supported | ❌ Forbidden |
| **Attribute bindings** | ✅ Yes | ✅ Yes |
| **Child expressions** | ✅ Yes | ✅ Yes |
| **Nested regular templates** | ✅ Yes | ✅ Yes (can contain) |
| **Nested inside regular** | ✅ Yes | ❌ Forbidden |
| **Performance** | Standard | Optimized (no markers) |

### Rendering Output Comparison

**Regular Template:**
```javascript
import { html } from 'lit';
const template = html`<div class=${className}>${content}</div>`;
```

**Output (with hydration markers):**
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

**Server-Only Template:**
```javascript
import { html } from '@lit-labs/ssr';
const template = html`<div class=${className}>${content}</div>`;
```

**Output (no hydration markers):**
```html
<div class="active">Hello</div>
```

---

## The Server-Only html Function

### Implementation

```typescript
// packages/labs/ssr/src/lib/server-template.ts

import {
  html as coreHtml,
  svg as coreSvg,
  mathml as coreMathml,
  noChange,
  nothing
} from 'lit-html';

const SERVER_ONLY = 1;

const isServer =
  typeof process !== 'undefined' &&
  process.release?.name === 'node';

/**
 * Server-only html tag function
 */
export const html = (strings: TemplateStringsArray, ...values: unknown[]) => {
  if (!isServer) {
    throw new Error(
      'Server-only templates can only be rendered on the server'
    );
  }

  const result = coreHtml(strings, ...values);
  (result as ServerRenderedTemplate)._$litServerRenderMode = SERVER_ONLY;
  return result;
};

export const svg = (strings: TemplateStringsArray, ...values: unknown[]) => {
  if (!isServer) {
    throw new Error(
      'Server-only templates can only be rendered on the server'
    );
  }

  const result = coreSvg(strings, ...values);
  (result as ServerRenderedTemplate)._$litServerRenderMode = SERVER_ONLY;
  return result;
};

export const mathml = (strings: TemplateStringsArray, ...values: unknown[]) => {
  if (!isServer) {
    throw new Error(
      'Server-only templates can only be rendered on the server'
    );
  }

  const result = coreMathml(strings, ...values);
  (result as ServerRenderedTemplate)._$litServerRenderMode = SERVER_ONLY;
  return result;
};

export {noChange, nothing};
```

### Key Characteristics

1. **Runtime check** - Throws error if executed in browser
2. **Wraps core functions** - Uses `lit-html` functions internally
3. **Marks result** - Adds `_$litServerRenderMode = SERVER_ONLY` property
4. **Identical syntax** - Same template literal syntax as regular `html`

---

## ServerTemplate Type Structure

### TypeScript Interface

```typescript
const SERVER_ONLY = 1;

export interface ServerRenderedTemplate extends TemplateResult {
  /**
   * Marker indicating this template is server-only
   */
  _$litServerRenderMode: typeof SERVER_ONLY;
}

export type ServerTemplate = ServerRenderedTemplate;
```

### Detection Function

```typescript
/**
 * Returns true if the template can be hydrated
 * (i.e., is NOT server-only)
 */
function isHydratable(result: TemplateResult): boolean {
  return (result as ServerRenderedTemplate)._$litServerRenderMode !== SERVER_ONLY;
}
```

**Usage in rendering:**
```typescript
if (isHydratable(templateResult)) {
  // Generate hydration markers
  result.push(`<!--lit-part ${digest}-->`);
}
// Otherwise, skip markers
```

---

## Rendering Differences

### 1. Hydration Marker Generation

**Regular templates:**
```typescript
if (hydratable) {
  result.push(`<!--lit-part ${digestForTemplateResult(value)}-->`);
}
result.push(() => renderTemplateResult(value, renderInfo));
if (hydratable) {
  result.push(`<!--/lit-part-->`);
}
```

**Server-only templates:**
```typescript
// No opening marker
result.push(() => renderTemplateResult(value, renderInfo));
// No closing marker
```

### 2. HTML Parsing Strategy

**Fragment parsing (regular templates):**
```typescript
const ast = parseFragment(htmlString, {
  sourceCodeLocationInfo: true
});
```

**Document parsing (server-only with document elements):**
```typescript
const isPageLevelTemplate = !hydratable &&
  /^(\s|<!--[^]*?-->)*<(!doctype|html|head|body)(\s|>)/i.test(htmlString);

const ast = isPageLevelTemplate
  ? parse(htmlString, { sourceCodeLocationInfo: true })
  : parseFragment(htmlString, { sourceCodeLocationInfo: true });
```

**Why?** Document elements (`<html>`, `<head>`, `<body>`) require full document parsing to be valid.

### 3. Binding Restrictions

**Forbidden in server-only templates:**

```typescript
// In render-value.ts

if (!isValueHydratable) {
  // Property bindings forbidden
  if (part.type === PartType.PROPERTY) {
    throw new Error(
      "Server-only templates can't bind to properties. " +
      "Bind to attributes instead."
    );
  }

  // Event bindings forbidden
  if (part.type === PartType.EVENT) {
    throw new Error("Server-only templates can't bind to events.");
  }

  // Element parts forbidden
  if (part.type === PartType.ELEMENT) {
    throw new Error(
      "Server-only templates don't support element parts."
    );
  }
}
```

**Allowed bindings:**
- ✅ Attribute bindings (`attr=${value}`)
- ✅ Boolean attribute bindings (`?attr=${value}`)
- ✅ Child expressions (`${value}`)

### 4. Raw Text Element Support

Server-only templates can render into raw text elements:

```typescript
// Can render dynamic content in <script>, <style>, <textarea>, <template>
const template = html`
  <script type="application/json">
    ${JSON.stringify(data)}
  </script>
`;
```

**Implementation:** Special handling traverses text nodes to find binding markers in elements where comment nodes aren't valid.

### 5. Template Element Traversal

```typescript
// Server-only templates can traverse <template> contents
if (!hydratable && node.nodeName === 'TEMPLATE') {
  // Traverse template.content
}
```

Regular templates skip `<template>` contents to avoid complexity since they're rarely used in hydratable templates.

---

## Composition Rules

### Nesting Hierarchy

```
✅ Allowed:
├─ Server-only template
   ├─ Server-only template (nested)
   └─ Regular template (can be hydrated!)

✅ Allowed:
├─ Regular template
   └─ Regular template (nested)

❌ Forbidden:
├─ Regular template
   └─ Server-only template ❌
```

### Validation

```typescript
if (!isValueHydratable && hydratable) {
  throw new Error(
    `A server-only template can't be rendered inside an ordinary, ` +
    `hydratable template. This can happen if the \`html\` template ` +
    `tag function used on the server doesn't match the one expected ` +
    `for hydration on the client.`
  );
}
```

### Composition Pattern

**Common pattern:**
```javascript
import { html as serverHtml } from '@lit-labs/ssr';
import { html } from 'lit';

// Server-only wrapper
const page = serverHtml`
  <!DOCTYPE html>
  <html>
    <head>
      <title>My Page</title>
    </head>
    <body>
      <!-- Regular template inside (can be hydrated!) -->
      ${appContent()}
    </body>
  </html>
`;

// Regular template (hydratable)
function appContent() {
  return html`
    <my-app>
      <h1>Hello, World!</h1>
    </my-app>
  `;
}
```

**Result:**
- Document structure is server-only (static)
- `<my-app>` component hydrates on client
- Perfect for SSR + hydration hybrid

---

## Use Cases

### 1. Full HTML Documents

```javascript
import { html } from '@lit-labs/ssr';

const document = html`
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>${pageTitle}</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      ${content}
    </body>
  </html>
`;
```

**Why server-only?** Document elements can't be hydrated (they're not custom elements).

### 2. Data Serialization

```javascript
const pageWithData = html`
  <!DOCTYPE html>
  <html>
    <body>
      <div id="app">${appTemplate}</div>

      <!-- Serialize data for client -->
      <script type="application/json" id="initial-data">
        ${JSON.stringify(initialData)}
      </script>
    </body>
  </html>
`;
```

**Benefits:**
- Safe JSON serialization in `<script>` tag
- Client can read with `JSON.parse(document.getElementById('initial-data').textContent)`

### 3. Meta Tags and Special Elements

```javascript
const metaTemplate = html`
  <!DOCTYPE html>
  <html>
    <head>
      <title>${pageTitle}</title>
      <meta name="description" content="${description}">
      <meta property="og:title" content="${ogTitle}">

      <!-- Structured data -->
      <script type="application/ld+json">
        ${JSON.stringify(structuredData)}
      </script>
    </head>
    <body>
      ${content}
    </body>
  </html>
`;
```

### 4. Template Elements

```javascript
const templateTemplate = html`
  <template id="card-template">
    <div class="card">
      <h2>${title}</h2>
      <p>${description}</p>
    </div>
  </template>
`;
```

**Note:** Regular templates cannot render `<template>` contents safely.

### 5. Textarea with Default Content

```javascript
const form = html`
  <form>
    <textarea name="message">${defaultMessage}</textarea>
    <button type="submit">Send</button>
  </form>
`;
```

**Note:** Regular templates handle `<textarea>` specially; server-only templates render content directly.

---

## Constraints and Limitations

### 1. No Client-Side Updates

```javascript
// ❌ Cannot do this with server-only templates
import { html } from '@lit-labs/ssr';
import { render } from 'lit';

const template = html`<div>Content</div>`;

// Server - works
const ssrOutput = await renderToString(template);

// Client - throws error!
render(template, document.body); // Error: server-only templates...
```

**Solution:** Use regular `html` from `lit` for hydratable content.

### 2. No Event Handlers

```javascript
import { html } from '@lit-labs/ssr';

// ❌ Forbidden
const template = html`
  <button @click=${handleClick}>Click me</button>
`;
// Error: Server-only templates can't bind to events
```

**Solution:** Use regular templates for interactive elements.

### 3. No Property Bindings

```javascript
import { html } from '@lit-labs/ssr';

// ❌ Forbidden
const template = html`
  <input .value=${inputValue}>
`;
// Error: Server-only templates can't bind to properties
```

**Solution:** Use attribute bindings instead:
```javascript
const template = html`
  <input value=${inputValue}>
`;
```

### 4. No Element Parts

```javascript
import { html } from '@lit-labs/ssr';
import { myDirective } from './directives.js';

// ❌ Forbidden
const template = html`
  <div ${myDirective()}></div>
`;
// Error: Server-only templates don't support element parts
```

### 5. Cannot Nest Inside Regular Templates

```javascript
import { html as litHtml } from 'lit';
import { html as serverHtml } from '@lit-labs/ssr';

// ❌ Forbidden
const template = litHtml`
  <div>
    ${serverHtml`<p>Server-only</p>`}
  </div>
`;
// Error: Server-only template can't be rendered inside hydratable template
```

**Solution:** Reverse the nesting (server-only wraps regular):
```javascript
const template = serverHtml`
  <div>
    ${litHtml`<p>Hydratable</p>`}
  </div>
`;
```

---

## Implementation Requirements for lit-edge

To support server-only templates, lit-edge must:

### 1. Detect Server-Only Templates

```javascript
function isHydratable(result) {
  return result._$litServerRenderMode !== SERVER_ONLY;
}
```

### 2. Skip Hydration Markers

```javascript
function renderTemplateResult(result, renderInfo) {
  const hydratable = isHydratable(result);

  if (hydratable) {
    yield `<!--lit-part ${digestForTemplateResult(result)}-->`;
  }

  // Render content
  yield* renderContent(result, renderInfo);

  if (hydratable) {
    yield `<!--/lit-part-->`;
  }
}
```

### 3. Use Appropriate Parser

```javascript
function parseTemplate(htmlString, hydratable) {
  // Check if document-level template
  const isPageLevel = !hydratable &&
    /^(\s|<!--[^]*?-->)*<(!doctype|html|head|body)(\s|>)/i.test(htmlString);

  if (isPageLevel) {
    // Full document parsing
    return parse5.parse(htmlString, { sourceCodeLocationInfo: true });
  } else {
    // Fragment parsing
    return parse5.parseFragment(htmlString, { sourceCodeLocationInfo: true });
  }
}
```

### 4. Enforce Binding Restrictions

```javascript
function validateBinding(part, isHydratable) {
  if (!isHydratable) {
    if (part.type === PartType.PROPERTY) {
      throw new Error(
        "Server-only templates can't bind to properties. " +
        "Bind to attributes instead."
      );
    }

    if (part.type === PartType.EVENT) {
      throw new Error("Server-only templates can't bind to events.");
    }

    if (part.type === PartType.ELEMENT) {
      throw new Error(
        "Server-only templates don't support element parts."
      );
    }
  }
}
```

### 5. Handle Raw Text Elements

```javascript
function processRawTextElement(element, hydratable) {
  const tagName = element.tagName.toLowerCase();

  if (
    !hydratable &&
    (tagName === 'script' ||
     tagName === 'style' ||
     tagName === 'textarea' ||
     tagName === 'template')
  ) {
    // Special processing for server-only raw text elements
    return processTextContent(element);
  }

  // Normal processing
  return processElement(element);
}
```

### 6. Support Template Contents Traversal

```javascript
function traverseNode(node, hydratable) {
  // Regular templates skip <template> contents
  if (hydratable && node.tagName === 'TEMPLATE') {
    return;
  }

  // Server-only templates can traverse <template>
  if (!hydratable && node.tagName === 'TEMPLATE') {
    traverseChildren(node.content);
  }
}
```

### 7. Validate Composition Rules

```javascript
function renderValue(value, renderInfo, parentHydratable) {
  if (isTemplateResult(value)) {
    const childHydratable = isHydratable(value);

    // Server-only cannot be inside hydratable
    if (!childHydratable && parentHydratable) {
      throw new Error(
        "A server-only template can't be rendered inside an " +
        "ordinary, hydratable template."
      );
    }

    return renderTemplateResult(value, renderInfo);
  }

  // ... other value types
}
```

### 8. Export Server-Only Template Functions

```javascript
// src/lib/server-template.js
import { html as coreHtml } from './lit-html.js';

const SERVER_ONLY = 1;

export const html = (strings, ...values) => {
  const result = coreHtml(strings, ...values);
  result._$litServerRenderMode = SERVER_ONLY;
  return result;
};

export const svg = (strings, ...values) => {
  const result = coreSvg(strings, ...values);
  result._$litServerRenderMode = SERVER_ONLY;
  return result;
};

export { noChange, nothing } from './lit-html.js';
```

---

## Examples

### Example 1: Basic Document

```javascript
import { render } from 'lit-edge';
import { html } from 'lit-edge/server-template.js';

const template = html`
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>My Page</title>
    </head>
    <body>
      <h1>Hello, World!</h1>
    </body>
  </html>
`;

const result = render(template);
const htmlString = await collectResult(result);
```

**Output:**
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>My Page</title>
  </head>
  <body>
    <h1>Hello, World!</h1>
  </body>
</html>
```

**No hydration markers!**

### Example 2: Data Serialization

```javascript
import { html as serverHtml } from 'lit-edge/server-template.js';

const pageData = {
  user: { name: 'Alice', id: 123 },
  posts: [...]
};

const template = serverHtml`
  <!DOCTYPE html>
  <html>
    <body>
      <div id="app"></div>

      <script type="application/json" id="page-data">
        ${JSON.stringify(pageData)}
      </script>

      <script type="module">
        const data = JSON.parse(
          document.getElementById('page-data').textContent
        );
        // Use data to hydrate app
      </script>
    </body>
  </html>
`;
```

### Example 3: Hybrid (Server-Only + Hydratable)

```javascript
import { html as serverHtml } from 'lit-edge/server-template.js';
import { html } from 'lit';

// Hydratable app content
function appContent(data) {
  return html`
    <my-app .data=${data}>
      <h1>Welcome, ${data.user.name}!</h1>
    </my-app>
  `;
}

// Server-only document wrapper
const page = serverHtml`
  <!DOCTYPE html>
  <html>
    <head>
      <title>My App</title>
      <script type="module" src="/app.js"></script>
    </head>
    <body>
      <!-- Hydratable content -->
      ${appContent(pageData)}

      <!-- Data for hydration -->
      <script type="application/json" id="data">
        ${JSON.stringify(pageData)}
      </script>
    </body>
  </html>
`;
```

**Output:**
```html
<!DOCTYPE html>
<html>
  <head>
    <title>My App</title>
    <script type="module" src="/app.js"></script>
  </head>
  <body>
    <!-- Hydratable content with markers -->
    <!--lit-part ...-->
    <my-app>
      <template shadowroot="open">
        <!--lit-part ...-->
        <h1>Welcome, Alice!</h1>
        <!--/lit-part-->
      </template>
    </my-app>
    <!--/lit-part-->

    <!-- Data for hydration (no markers) -->
    <script type="application/json" id="data">
      {"user":{"name":"Alice","id":123}}
    </script>
  </body>
</html>
```

**Key points:**
- Document structure has no hydration markers
- `<my-app>` content has markers (can hydrate)
- Perfect balance of static + interactive

---

## Summary

### Key Takeaways

1. **Two template types** - Server-only (no hydration) vs Regular (hydratable)
2. **Different imports** - `@lit-labs/ssr` for server-only, `lit` for regular
3. **Marker control** - Server-only skips hydration markers
4. **Document support** - Server-only can render full HTML documents
5. **Composition allowed** - Server-only can wrap regular templates
6. **Restrictions enforced** - No events, properties, or element parts in server-only
7. **Performance benefit** - Cleaner output without markers

### Implementation Checklist for lit-edge

- [ ] Export server-only `html`, `svg`, `mathml` functions
- [ ] Mark templates with `_$litServerRenderMode = SERVER_ONLY`
- [ ] Detect server-only via `isHydratable()` check
- [ ] Skip hydration markers for server-only templates
- [ ] Use full document parsing for page-level templates
- [ ] Support raw text elements (script, style, textarea, template)
- [ ] Enforce binding restrictions (no events, properties, element parts)
- [ ] Validate composition rules (no server-only inside regular)
- [ ] Support template contents traversal

### Testing Strategy

```javascript
// Test 1: Basic server-only template
test('server-only template omits markers', async () => {
  const template = serverHtml`<div>Content</div>`;
  const result = await renderToString(template);
  assertHTMLEqual(result, '<div>Content</div>');
  assert(!result.includes('<!--lit-part'));
});

// Test 2: Document-level template
test('server-only renders full document', async () => {
  const template = serverHtml`<!DOCTYPE html><html><body></body></html>`;
  const result = await renderToString(template);
  assert(result.startsWith('<!DOCTYPE html>'));
});

// Test 3: Hybrid composition
test('server-only can wrap regular templates', async () => {
  const inner = html`<div>Hydratable</div>`;
  const outer = serverHtml`<body>${inner}</body>`;
  const result = await renderToString(outer);
  assert(result.includes('<!--lit-part')); // Inner has markers
  assert(!result.startsWith('<!--lit-part')); // Outer doesn't
});

// Test 4: Binding restrictions
test('server-only rejects event bindings', async () => {
  const template = serverHtml`<button @click=${() => {}}>Click</button>`;
  await assertThrows(() => renderToString(template));
});
```

---

## References

- [@lit-labs/ssr README](https://github.com/lit/lit/tree/main/packages/labs/ssr#server-only-templates)
- [server-template.ts Source](https://github.com/lit/lit/blob/main/packages/labs/ssr/src/lib/server-template.ts)
- [render-value.ts Source](https://github.com/lit/lit/blob/main/packages/labs/ssr/src/lib/render-value.ts)
- [Lit SSR Documentation](https://lit.dev/docs/ssr/overview/)
