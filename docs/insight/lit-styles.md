# Lit Styles and CSS System

This document provides a comprehensive analysis of Lit's CSS handling system, including the `css` tagged template, `CSSResult` objects, adopted stylesheets, and SSR considerations.

## Table of Contents

1. [Overview](#overview)
2. [The css Tagged Template](#the-css-tagged-template)
3. [CSSResult Structure](#cssresult-structure)
4. [Adopted StyleSheets](#adopted-stylesheets)
5. [Style Composition](#style-composition)
6. [SSR and CSS Handling](#ssr-and-css-handling)
7. [Security Model](#security-model)
8. [Best Practices](#best-practices)

---

## Overview

Lit provides a `css` tagged template literal for defining component styles with several key benefits:

- **Type safety** - Only CSS text and numbers allowed in expressions
- **Performance** - Styles converted to native `CSSStyleSheet` objects
- **Deduplication** - Shared styles reference same stylesheet
- **SSR support** - Styles serializable to text for server rendering
- **Security** - Prevents injection attacks through validation

### Source Location
`packages/reactive-element/src/css-tag.ts`

### Core Components

| Type | Purpose |
|------|---------|
| `CSSResult` | Encapsulates CSS text and stylesheet |
| `CSSResultOrNative` | `CSSResult` or native `CSSStyleSheet` |
| `CSSResultArray` | Nested arrays of styles |
| `CSSResultGroup` | Union type for flexible composition |

---

## The css Tagged Template

### Basic Usage

```typescript
import {LitElement, css, html} from 'lit';

class MyElement extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 16px;
      background: white;
    }

    h1 {
      color: blue;
      font-size: 24px;
    }
  `;

  render() {
    return html`<h1>Hello</h1>`;
  }
}
```

### Implementation

```typescript
export const css = (
  strings: TemplateStringsArray,
  ...values: (CSSResultGroup | number)[]
): CSSResult => {
  // Single string optimization
  const cssText = strings.length === 1
    ? strings[0]
    : values.reduce(
        (acc, v, idx) => acc + textFromCSSResult(v) + strings[idx + 1],
        strings[0]
      );

  return new (CSSResult as ConstructableCSSResult)(
    cssText,
    strings,
    constructionToken
  );
};
```

**Key points:**
- Concatenates static strings with interpolated values
- Only allows `CSSResultGroup` (other `CSSResult` objects) or `number` in expressions
- Prevents string interpolation to avoid injection attacks

### Valid Expressions

```typescript
const color = css`blue`;
const fontSize = 24; // Number allowed

static styles = css`
  :host {
    color: ${color};           // ✅ CSSResult
    font-size: ${fontSize}px;  // ✅ Number
  }
`;
```

### Invalid Expressions

```typescript
const userInput = 'red; } body { background: red';

static styles = css`
  :host {
    color: ${userInput}; // ❌ TypeError: string not allowed
  }
`;
```

**Solution:** Use `unsafeCSS()` for runtime strings (developer responsibility):

```typescript
import {unsafeCSS} from 'lit';

const dynamicColor = unsafeCSS(userInput);

static styles = css`
  :host {
    color: ${dynamicColor};
  }
`;
```

---

## CSSResult Structure

### Class Definition

```typescript
export class CSSResult {
  readonly ['_$cssResult$'] = true;
  readonly cssText: string;
  private _styleSheet?: CSSStyleSheet;
  private _strings: TemplateStringsArray | undefined;

  get styleSheet(): CSSStyleSheet | undefined {
    // Lazy creation
    let workingSheets = this._styleSheet;

    if (workingSheets === undefined) {
      const useAdoptedStyleSheets = supportsAdoptingStyleSheets;

      if (useAdoptedStyleSheets) {
        // Create native CSSStyleSheet
        this._styleSheet = new CSSStyleSheet();
        this._styleSheet.replaceSync(this.cssText);
      }

      workingSheets = this._styleSheet;
    }

    return workingSheets;
  }
}
```

### Type System

```typescript
// CSSResult or native CSSStyleSheet
export type CSSResultOrNative = CSSResult | CSSStyleSheet;

// Nested arrays of CSS results
export type CSSResultArray = Array<CSSResultOrNative | CSSResultArray>;

// Union of all CSS types
export type CSSResultGroup = CSSResultOrNative | CSSResultArray;
```

**Flexibility:** This type system allows:
- Single `CSSResult`
- Array of results
- Nested arrays
- Native `CSSStyleSheet` objects

### Private Constructor Pattern

```typescript
const constructionToken = Symbol();

type ConstructableCSSResult = {
  new (
    cssText: string,
    strings: TemplateStringsArray,
    safeToken: typeof constructionToken
  ): CSSResult;
};

// Constructor is private via Symbol token
```

**Security benefit:** Prevents direct `new CSSResult()` construction, forcing use of `css` tag or `unsafeCSS()`.

---

## Adopted StyleSheets

### The adoptStyles Function

```typescript
export const adoptStyles = (
  renderRoot: ShadowRoot,
  styles: Array<CSSResultOrNative>
) => {
  if (supportsAdoptingStyleSheets) {
    // Modern browsers - use adoptedStyleSheets
    (renderRoot as ShadowRoot).adoptedStyleSheets = styles.map((s) =>
      s instanceof CSSStyleSheet ? s : s.styleSheet!
    );
  } else {
    // Fallback - append <style> elements
    for (const s of styles) {
      const style = document.createElement('style');

      // CSP nonce support
      const nonce = (global as any)['litNonce'];
      if (nonce !== undefined) {
        style.setAttribute('nonce', nonce);
      }

      style.textContent = (s as CSSResult).cssText;
      renderRoot.appendChild(style);
    }
  }
};
```

### Adopted StyleSheets Benefits

1. **Performance** - Sheets parsed once, reused across shadow roots
2. **Memory efficiency** - Single stylesheet shared by multiple elements
3. **Dynamic updates** - Can modify stylesheet and all instances update
4. **No DOM overhead** - Sheets don't add DOM nodes

### Browser Support

| Feature | Chrome | Edge | Firefox | Safari |
|---------|--------|------|---------|--------|
| Adopted StyleSheets | 73+ | 79+ | 101+ | 16.4+ |
| Fallback `<style>` | All | All | All | All |

**Lit automatically uses fallback for older browsers.**

### LitElement Integration

```typescript
protected createRenderRoot(): Element | ShadowRoot {
  const renderRoot = this.shadowRoot ??
    this.attachShadow(this.constructor.shadowRootOptions);

  // Adopt component styles
  adoptStyles(
    renderRoot as ShadowRoot,
    (this.constructor as typeof LitElement).elementStyles
  );

  return renderRoot;
}
```

---

## Style Composition

### Sharing Styles Across Components

**Define shared styles:**

```typescript
// shared-styles.ts
import {css} from 'lit';

export const buttonStyles = css`
  button {
    padding: 8px 16px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
  }

  button:hover {
    background: #f0f0f0;
  }
`;

export const cardStyles = css`
  :host {
    display: block;
    padding: 16px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
`;
```

**Use in components:**

```typescript
import {LitElement, css, html} from 'lit';
import {buttonStyles, cardStyles} from './shared-styles.js';

class MyCard extends LitElement {
  static styles = [
    cardStyles,
    buttonStyles,
    css`
      /* Component-specific styles */
      h2 {
        margin-top: 0;
      }
    `
  ];

  render() {
    return html`
      <h2>Card Title</h2>
      <p>Card content</p>
      <button>Click me</button>
    `;
  }
}
```

### Inheritance Patterns

**Base class with common styles:**

```typescript
class BaseElement extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .error {
      color: red;
    }

    .success {
      color: green;
    }
  `;
}

class DerivedElement extends BaseElement {
  static styles = [
    BaseElement.styles,
    css`
      :host {
        padding: 16px;
      }
    `
  ];
}
```

**Important:** Derived class styles come after base styles (cascade order).

### Array Flattening

Lit automatically flattens nested style arrays:

```typescript
const theme = [colorStyles, typographyStyles];
const layout = [gridStyles, flexStyles];

static styles = [
  theme,     // Flattened
  layout,    // Flattened
  css`...`   // Component styles
];
```

---

## SSR and CSS Handling

### The getCompatibleStyle Function

```typescript
export const getCompatibleStyle =
  supportsAdoptingStyleSheets ||
  (NODE_MODE && global.CSSStyleSheet === undefined)
    ? (s: CSSResultOrNative) => s
    : (s: CSSResultOrNative) =>
        s instanceof CSSStyleSheet ? cssResultFromStyleSheet(s) : s;
```

**Logic:**
- **Node.js environment** - Returns `CSSResult` (no native `CSSStyleSheet`)
- **Browser with adopted stylesheets** - Returns as-is
- **Browser without adopted stylesheets** - Converts `CSSStyleSheet` to `CSSResult`

### SSR Style Serialization

During SSR, Lit serializes styles into `<style>` tags within declarative shadow DOM:

```html
<!-- Server-rendered output -->
<my-element>
  <template shadowroot="open">
    <style>
      :host {
        display: block;
        padding: 16px;
      }
      h1 {
        color: blue;
      }
    </style>
    <h1>Hello</h1>
  </template>
</my-element>
```

### Extracting CSS Text

```typescript
function textFromCSSResult(value: CSSResultGroup | number): string {
  if (typeof value === 'number') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((v) => textFromCSSResult(v as CSSResultGroup)).join('');
  }

  if (value instanceof CSSResult) {
    return value.cssText;
  }

  if (value instanceof CSSStyleSheet) {
    return Array.from(value.cssRules)
      .map((rule) => rule.cssText)
      .join('\n');
  }

  return '';
}
```

**Usage in SSR:**
1. Collect all component styles
2. Extract CSS text via `textFromCSSResult()`
3. Emit as `<style>` tags in declarative shadow DOM
4. Browser applies styles during hydration

### CSP Nonce Support

For Content Security Policy compliance:

```typescript
// Set nonce globally
(globalThis as any).litNonce = 'random-nonce-value';

// Or per-element
class MyElement extends LitElement {
  connectedCallback() {
    super.connectedCallback();
    this.renderRoot.querySelector('style')?.setAttribute('nonce', nonceValue);
  }
}
```

The `adoptStyles()` function reads `globalThis.litNonce` and applies it to created `<style>` elements.

---

## Security Model

### Why Restrict Expressions?

**Prevent CSS injection attacks:**

```typescript
// Malicious user input
const userColor = 'red; } body { display: none';

// If allowed:
css`
  :host {
    color: ${userColor}; // Breaks out of rule, injects malicious CSS
  }
`

// Result:
/*
  :host {
    color: red; } body { display: none;
  }
*/
```

**Protection mechanism:**
- Only `CSSResult` objects (from `css` tags) allowed
- Numbers allowed (safe primitive)
- Strings rejected with `TypeError`

### The unsafeCSS Function

For runtime CSS strings, use `unsafeCSS()`:

```typescript
export const unsafeCSS = (value: unknown): CSSResult => {
  return new (CSSResult as ConstructableCSSResult)(
    String(value),
    undefined,
    constructionToken
  );
};
```

**Developer responsibility:**
- Sanitize input before passing to `unsafeCSS()`
- Never use with untrusted user input
- Prefer static `css` templates when possible

### Safe Dynamic Patterns

**CSS Custom Properties:**

```typescript
class MyElement extends LitElement {
  @property() color = 'blue';

  static styles = css`
    :host {
      --user-color: blue;
    }

    .content {
      color: var(--user-color);
    }
  `;

  render() {
    return html`
      <div class="content" style="--user-color: ${this.color}">
        Dynamically colored
      </div>
    `;
  }
}
```

**Benefit:** Style bindings in templates are HTML-escaped, preventing injection.

---

## Best Practices

### 1. Use Static Styles When Possible

```typescript
// Good - styles parsed once at module load
static styles = css`
  :host { display: block; }
`;

// Avoid - styles recreated on every component definition
static get styles() {
  return css`:host { display: block; }`;
}
```

### 2. Share Common Styles

```typescript
// shared-styles.ts
export const resetStyles = css`
  * { box-sizing: border-box; }
`;

export const typographyStyles = css`
  h1 { font-size: 2em; }
  p { line-height: 1.5; }
`;

// component.ts
static styles = [resetStyles, typographyStyles];
```

### 3. Use CSS Custom Properties for Theming

```typescript
static styles = css`
  :host {
    --primary-color: blue;
    --secondary-color: gray;
  }

  button {
    background: var(--primary-color);
    color: white;
  }

  .secondary {
    background: var(--secondary-color);
  }
`;
```

**Theme override:**

```html
<my-element style="--primary-color: red;"></my-element>
```

### 4. Organize Styles Logically

```typescript
static styles = [
  // Reset/base styles
  css`
    :host {
      display: block;
      box-sizing: border-box;
    }
  `,

  // Layout styles
  css`
    .container {
      display: grid;
      gap: 16px;
    }
  `,

  // Component styles
  css`
    .header { font-weight: bold; }
    .content { padding: 16px; }
  `
];
```

### 5. Avoid !important

```typescript
// Bad - hard to override
css`
  :host {
    color: blue !important;
  }
`

// Good - use specificity or custom properties
css`
  :host {
    color: var(--element-color, blue);
  }
`
```

### 6. Use :host Selectors Wisely

```typescript
css`
  /* Styles for the host element */
  :host {
    display: block;
  }

  /* Styles when host has class */
  :host(.active) {
    border: 2px solid blue;
  }

  /* Styles when host has attribute */
  :host([disabled]) {
    opacity: 0.5;
    pointer-events: none;
  }

  /* Styles based on context */
  :host-context(.dark-theme) {
    background: #333;
    color: white;
  }
`
```

### 7. Minimize Selector Complexity

```typescript
// Avoid deep nesting
css`
  .container .sidebar .menu .item .link {
    /* Overly specific */
  }
`

// Prefer flatter structure
css`
  .menu-link {
    /* More maintainable */
  }
`
```

### 8. Consider Performance

```typescript
// Expensive - universal selector
css`
  * { margin: 0; }
`

// Better - target specific elements
css`
  h1, h2, h3, p { margin: 0; }
`
```

---

## Summary

Lit's CSS system provides:

1. **Type safety** - Prevents injection via expression restrictions
2. **Performance** - Adopted stylesheets shared across instances
3. **Composability** - Easy style sharing and inheritance
4. **SSR support** - Styles serialize to declarative shadow DOM
5. **Security** - Protected against CSS injection attacks
6. **Flexibility** - Supports both static and dynamic styling

Key takeaways:
- Use `css` tagged templates for static styles
- Share common styles across components
- Leverage CSS custom properties for theming
- Understand SSR style serialization
- Use `unsafeCSS()` carefully with sanitized input only

---

## References

- [CSS Tag Source](https://github.com/lit/lit/blob/main/packages/reactive-element/src/css-tag.ts)
- [Lit Styles Documentation](https://lit.dev/docs/components/styles/)
- [Constructable Stylesheets (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet)
- [Adopted Stylesheets Explainer](https://github.com/WICG/construct-stylesheets/blob/gh-pages/explainer.md)
