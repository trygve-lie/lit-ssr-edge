# Lit-HTML Core Template Rendering System

This document provides a comprehensive analysis of Lit's core template rendering system, focusing on the `lit-html` package that handles template parsing, compilation, and efficient DOM updates.

## Table of Contents

1. [Overview](#overview)
2. [The `html` Tagged Template Literal](#the-html-tagged-template-literal)
3. [TemplateResult Objects](#templateresult-objects)
4. [The Marker System](#the-marker-system)
5. [Template Parsing and Compilation](#template-parsing-and-compilation)
6. [The Template Class](#the-template-class)
7. [Part Types and Implementation](#part-types-and-implementation)
8. [TemplateInstance and Rendering](#templateinstance-and-rendering)
9. [Template Caching](#template-caching)
10. [Static Templates](#static-templates)
11. [Security Architecture](#security-architecture)

---

## Overview

Lit-html is a templating library that enables efficient HTML rendering through tagged template literals. The system works through three main phases:

1. **Prepare Phase** (cached): Parses template strings, inserts markers, and creates `Template` objects
2. **Create Phase** (cached): Clones DOM fragments and instantiates Part objects
3. **Update Phase** (runs every render): Diffs values and updates only changed DOM

The key insight is that template literal strings are immutable and can be used as cache keys, allowing Lit to parse templates once and reuse the parsed structure for all subsequent renders.

---

## The `html` Tagged Template Literal

### Basic Structure

The `html` function is created using a tag factory pattern:

```typescript
export const html = tag(HTML_RESULT);
export const svg = tag(SVG_RESULT);
export const mathml = tag(MATHML_RESULT);
```

The `tag` factory generates template tag functions:

```typescript
const tag = <T extends ResultType>(type: T) =>
  (strings: TemplateStringsArray, ...values: unknown[]): TemplateResult<T> => {
    // Development mode: validates template strings
    // Checks for illegal octal sequences
    // Verifies static values are in appropriate templates
    return {
      ['_$litType$']: type,
      strings,
      values,
    };
  };
```

### How It Works

When you write:

```typescript
const greeting = html`<h1>Hello, ${name}!</h1>`;
```

JavaScript automatically separates:
- **Static strings**: `['<h1>Hello, ', '!</h1>']` (the `TemplateStringsArray`)
- **Dynamic values**: `[name]` (the interpolated expressions)

The `html` tag function receives these as arguments and packages them into a `TemplateResult` object. Critically, the `strings` array is the same object reference for identical template literals across multiple evaluations, enabling efficient caching.

### Result Types

Lit supports three template result types:

| Type | Constant | Purpose |
|------|----------|---------|
| `HTML_RESULT` | 1 | Standard HTML templates |
| `SVG_RESULT` | 2 | SVG elements (requires different parsing context) |
| `MATHML_RESULT` | 3 | MathML elements |

---

## TemplateResult Objects

### Interface Definition

```typescript
export type UncompiledTemplateResult<T extends ResultType = ResultType> = {
  ['_$litType$']: T;
  strings: TemplateStringsArray;
  values: unknown[];
};
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `_$litType$` | `ResultType` | Identifies the template type (HTML, SVG, MathML) |
| `strings` | `TemplateStringsArray` | Immutable array of static string parts |
| `values` | `unknown[]` | Array of dynamic expression values |

### Key Characteristics

1. **Immutability**: The `strings` array never changes for a given template literal
2. **Identity**: The same template literal always produces the same `strings` reference
3. **Separation**: Static content is cleanly separated from dynamic values
4. **Lightweight**: TemplateResult is a simple object literal, not a class instance

### Example

```typescript
// Template literal
const result = html`<div class="${cls}">${content}</div>`;

// Resulting TemplateResult
{
  _$litType$: 1,  // HTML_RESULT
  strings: ['<div class="', '">', '</div>'],
  values: [cls, content]
}
```

---

## The Marker System

The marker system is the foundation of Lit's template processing. Markers are special strings inserted into templates to identify where dynamic bindings occur.

### Marker Constants

```typescript
// Unique marker generated at runtime
const marker = `lit$${Math.random().toFixed(9).slice(2)}$`;

// Match pattern for finding markers
const markerMatch = `?${marker}`;

// Full comment marker for child positions
const nodeMarker = `<?${marker}>`;

// Suffix for bound attributes
const boundAttributeSuffix = '$lit$';
```

### Marker Types

#### 1. Child Position Markers

For expressions in text content, Lit inserts comment nodes:

```html
<!-- Before processing -->
<div>${content}</div>

<!-- After marker insertion -->
<div><!--?lit$123456789$--></div>
```

The `?` prefix creates a processing instruction-like comment that's easy to identify during DOM walking.

#### 2. Attribute Markers

For attribute bindings, Lit modifies attribute names and values:

```html
<!-- Before processing -->
<div class="${cls}">

<!-- After marker insertion -->
<div class$lit$="lit$123456789$">
```

The `$lit$` suffix:
- Prevents browsers from prematurely handling special attributes (style, class, SVG attributes)
- Allows invalid placeholder values without browser errors
- Makes bound attributes easily identifiable during template instantiation

#### 3. Multi-Value Attribute Markers

For interpolated attributes with multiple values:

```html
<!-- Template -->
<div class="foo ${a} bar ${b}">

<!-- Marker format stores the pattern -->
<div class$lit$="foo lit$123456789$ bar lit$123456789$">
```

### Why Random Markers?

The random component (`Math.random()`) prevents:
- Collisions with user content
- Security vulnerabilities from predictable markers
- Cross-template interference

---

## Template Parsing and Compilation

### The Parsing State Machine

Lit's parser tracks HTML structure using multiple regex patterns:

```typescript
// State patterns
const textEndRegex: RegExp;           // Matches '<' for tags/comments
const tagEndRegex: RegExp;            // Matches '>', attributes, whitespace
const commentEndRegex: RegExp;        // Matches '-->'
const comment2EndRegex: RegExp;       // Matches '>' for other comments
const singleQuoteAttrEndRegex: RegExp;
const doubleQuoteAttrEndRegex: RegExp;
```

### Parsing States

The parser maintains these states:

| State | Description |
|-------|-------------|
| TEXT | Outside any tag, in text content |
| TAG_OPEN | After '<', determining tag type |
| COMMENT | Inside HTML comment |
| RAWTEXT | Inside `<script>`, `<style>`, `<textarea>`, `<title>` |
| ATTR_NAME | Parsing attribute name |
| ATTR_VALUE | Parsing attribute value |

### The `getTemplateHtml` Function

This critical function processes template strings and inserts markers:

```typescript
function getTemplateHtml(
  strings: TemplateStringsArray,
  type: ResultType
): TrustedHTML | string {
  // 1. Iterate through static string parts
  // 2. Track parser state (text, tag, attribute, etc.)
  // 3. Insert appropriate markers at binding positions
  // 4. Return annotated HTML string
}
```

### Processing Steps

1. **Iterate Static Strings**: Process each string segment between expressions
2. **State Tracking**: Use regex patterns to track HTML structure
3. **Marker Insertion**: Add appropriate markers based on context:
   - Text position: Insert comment marker
   - Attribute name: Add `$lit$` suffix
   - Attribute value: Insert value marker
4. **Raw Text Handling**: Special handling for `<script>`, `<style>`, `<textarea>`, `<title>`
5. **Return Annotated HTML**: Complete string with all markers

### Special Cases

#### Raw Text Elements

Inside `<script>`, `<style>`, `<textarea>`, and `<title>` tags, comment syntax isn't valid. The parser detects these contexts and inserts text-based markers that can be found via `Text.splitText()`.

#### SVG and MathML

SVG and MathML templates are wrapped in their respective namespace elements to ensure proper parsing:

```typescript
// SVG wrapping
`<svg>${templateContent}</svg>`

// MathML wrapping
`<math>${templateContent}</math>`
```

---

## The Template Class

The `Template` class represents a parsed and prepared template ready for instantiation.

### Structure

```typescript
class Template {
  /** @internal */
  el!: HTMLTemplateElement;

  /** @internal */
  parts: Array<TemplatePart> = [];

  constructor(
    { strings, _$litType$: type }: UncompiledTemplateResult,
    options?: RenderOptions
  ) {
    // 1. Get annotated HTML with markers
    // 2. Create HTMLTemplateElement
    // 3. Walk DOM to find markers and build parts array
  }

  static createElement(html: string, _options?: RenderOptions): HTMLTemplateElement;
}
```

### TemplatePart Types

```typescript
type TemplatePart = {
  type: PartType;
  index: number;
  name?: string;
  strings?: ReadonlyArray<string>;
  ctor?: typeof AttributePart;
};
```

| Field | Description |
|-------|-------------|
| `type` | Part type constant (CHILD, ATTRIBUTE, PROPERTY, etc.) |
| `index` | Depth-first node index in the template |
| `name` | Attribute/property/event name (for attribute parts) |
| `strings` | Static strings for interpolated attributes |
| `ctor` | Constructor for specialized part types |

### Template Construction Process

1. **Get Annotated HTML**
   ```typescript
   const html = getTemplateHtml(strings, type);
   ```

2. **Create Template Element**
   ```typescript
   this.el = Template.createElement(html, options);
   ```

3. **Walk DOM with TreeWalker**
   ```typescript
   const walker = document.createTreeWalker(
     this.el.content,
     NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
   );
   ```

4. **Find Markers and Build Parts**
   - Identify comment markers for child parts
   - Find `$lit$` suffixed attributes
   - Record node indices and part metadata

### Node Index System

Templates track binding locations using depth-first node indices:

```html
<div>           <!-- index 0 -->
  <span>        <!-- index 1 -->
    text        <!-- index 2 -->
  </span>
  <!--marker--> <!-- index 3 (binding location) -->
</div>
```

This allows `TemplateInstance` to efficiently locate binding points when cloning.

---

## Part Types and Implementation

Parts are the objects that manage specific DOM binding locations. Each part type handles a different kind of binding.

### Part Type Constants

```typescript
const PartType = {
  ATTRIBUTE: 1,
  CHILD: 2,
  PROPERTY: 3,
  BOOLEAN_ATTRIBUTE: 4,
  EVENT: 5,
  ELEMENT: 6,
} as const;
```

### ChildPart

Manages dynamic content in child positions (text nodes, nested templates, arrays).

```typescript
class ChildPartImpl {
  _$startNode: ChildNode;
  _$endNode: ChildNode | null;
  _$parent: ChildPart | TemplateInstance;

  _$setValue(value: unknown): void {
    // Resolves directives
    // Dispatches to appropriate commit method based on value type
  }

  _commitText(value: string): void;
  _commitNode(value: Node): void;
  _commitTemplateResult(result: TemplateResult): void;
  _commitIterable(value: Iterable<unknown>): void;
  _$clear(): void;
}
```

**Value Handling:**

| Value Type | Handling |
|------------|----------|
| Primitive | Create/update text node |
| `Node` | Insert DOM node directly |
| `TemplateResult` | Create/update TemplateInstance |
| `Array`/Iterable | Create child parts for each item |
| `nothing` | Clear content |
| Directive | Resolve and commit result |

### AttributePart

Manages attribute bindings on elements.

```typescript
class AttributePartImpl {
  element: Element;
  name: string;
  strings?: ReadonlyArray<string>;

  _$setValue(
    value: unknown | unknown[],
    directiveParent?: DirectiveParent,
    valueIndex?: number,
    noCommit?: boolean
  ): void;

  _commitValue(value: unknown): void {
    this.element.setAttribute(this.name, value);
  }
}
```

**Single vs. Multi-Value:**

```typescript
// Single value - direct binding
html`<div class=${cls}>`

// Multi-value - interpolation
html`<div class="foo ${a} bar ${b}">`
// strings: ['foo ', ' bar ', '']
// Concatenates: 'foo ' + a + ' bar ' + b + ''
```

### PropertyPart

Sets element properties instead of attributes.

```typescript
class PropertyPartImpl extends AttributePartImpl {
  _commitValue(value: unknown): void {
    this.element[this.name] = value === nothing ? undefined : value;
  }
}
```

Usage:
```typescript
html`<input .value=${inputValue}>`
```

### BooleanAttributePart

Handles boolean attributes (present or absent).

```typescript
class BooleanAttributePartImpl extends AttributePartImpl {
  _commitValue(value: unknown): void {
    if (value) {
      this.element.setAttribute(this.name, '');
    } else {
      this.element.removeAttribute(this.name);
    }
  }
}
```

Usage:
```typescript
html`<button ?disabled=${isDisabled}>`
```

### EventPart

Manages event listeners.

```typescript
class EventPartImpl implements EventListener {
  element: Element;
  name: string;

  _$setValue(value: unknown): void {
    // Compare listener and options
    // Add or remove event listener as needed
  }

  handleEvent(event: Event): void {
    // Delegate to committed listener
    this._$committedValue.call(this.options?.host ?? this.element, event);
  }
}
```

Usage:
```typescript
html`<button @click=${handleClick}>`
```

**Event Options:**

```typescript
// Using EventListenerObject with options
html`<button @click=${{
  handleEvent: (e) => console.log(e),
  capture: true,
  once: true,
  passive: true
}}>`
```

### ElementPart

Provides access to the element itself for directives.

```typescript
class ElementPartImpl {
  element: Element;

  _$setValue(value: unknown): void {
    // Only resolves directives
  }
}
```

Usage:
```typescript
html`<div ${myDirective()}>`
```

---

## TemplateInstance and Rendering

### TemplateInstance

Represents a cloned template with instantiated parts.

```typescript
class TemplateInstance {
  _$template: Template;
  _$parts: Part[] = [];

  constructor(template: Template, parent: ChildPart) {
    this._$template = template;
    // Parts are created during _clone()
  }

  _clone(options: RenderOptions): DocumentFragment {
    // 1. Clone template content
    // 2. Walk cloned DOM
    // 3. Create Part instances at marked locations
    // 4. Return ready-to-insert fragment
  }

  _update(values: unknown[]): void {
    // Iterate parts and values
    // Call _$setValue on each part
  }
}
```

### The Clone Process

```typescript
_clone(options: RenderOptions): DocumentFragment {
  const fragment = this._$template.el.content.cloneNode(true);
  const walker = document.createTreeWalker(fragment, ...);

  let partIndex = 0;
  let nodeIndex = 0;

  while ((node = walker.nextNode()) !== null && partIndex < parts.length) {
    if (nodeIndex === part.index) {
      // Create appropriate Part based on part.type
      // Add to _$parts array
    }
    nodeIndex++;
  }

  return fragment;
}
```

### The Render Function

The entry point for rendering templates to the DOM:

```typescript
export const render = (
  value: unknown,
  container: HTMLElement | DocumentFragment,
  options?: RenderOptions
): RootPart => {
  // 1. Get or create ChildPart for container
  let part = container._$litPart$;

  if (part === undefined) {
    const endNode = options?.renderBefore ?? null;
    container._$litPart$ = part = new ChildPartImpl(
      container.insertBefore(createMarker(), endNode),
      endNode,
      undefined,
      options ?? {}
    );
  }

  // 2. Set value on part
  part._$setValue(value);

  return part;
};
```

### Update Flow

```
render(template, container)
  └── ChildPart._$setValue(TemplateResult)
       └── _commitTemplateResult()
            └── if same template: TemplateInstance._update(values)
            └── else: create new TemplateInstance
                 └── _clone() - creates Parts
                 └── _update(values) - sets initial values
```

---

## Template Caching

### WeakMap-Based Caching

Templates are cached using the immutable `strings` array as a key:

```typescript
const templateCache = new WeakMap<TemplateStringsArray, Template>();

function getOrCreateTemplate(result: TemplateResult): Template {
  let template = templateCache.get(result.strings);
  if (template === undefined) {
    template = new Template(result);
    templateCache.set(result.strings, template);
  }
  return template;
}
```

### Why WeakMap?

1. **Automatic Cleanup**: When template strings are garbage collected, cached templates are too
2. **Identity-Based**: Uses object identity, not value equality
3. **No Memory Leaks**: References don't prevent garbage collection

### Caching Scope

| Level | What's Cached | Lifetime |
|-------|--------------|----------|
| Template | Parsed HTML, part metadata | Until strings are GC'd |
| TemplateInstance | Cloned DOM, Part instances | Per render location |
| Part | Committed values | Per binding |

### TemplateInstance Reuse

When re-rendering the same template to the same location:

```typescript
_commitTemplateResult(result: TemplateResult) {
  const template = getOrCreateTemplate(result);

  if (this._$committedValue instanceof TemplateInstance &&
      this._$committedValue._$template === template) {
    // Same template - just update values
    this._$committedValue._update(result.values);
  } else {
    // Different template - create new instance
    const instance = new TemplateInstance(template, this);
    this._$setChildPartValue(instance);
    instance._update(result.values);
  }
}
```

---

## Static Templates

The `static.ts` module provides support for safely embedding static HTML in templates.

### StaticValue Type

```typescript
interface StaticValue {
  _$litStatic$: string;
  r: typeof brand; // Symbol for security
}
```

### Creating Static Values

```typescript
// Unsafe - requires developer responsibility
const header = unsafeStatic('<h1>');
html`${header}Hello</h1>`;

// Safe - validates content
const tag = literal`div`;
html`<${tag}>content</${tag}>`;
```

### How Static Works

The `withStatic()` wrapper:

1. Scans values for `StaticValue` objects
2. Merges static values into the strings array
3. Creates a new `TemplateStringsArray`
4. Caches the result for reuse

```typescript
function withStatic(coreTag) {
  return (strings, ...values) => {
    const staticStrings = [];
    const dynamicValues = [];

    // Process values, merging static ones into strings
    // ...

    return coreTag(staticStrings, ...dynamicValues);
  };
}
```

### Security Model

The `brand` symbol prevents JSON injection:

```typescript
const brand = Symbol.for('');

// This cannot be created via JSON.parse
const valid: StaticValue = {
  _$litStatic$: 'content',
  r: brand
};
```

---

## Security Architecture

### Sanitization System

When `ENABLE_EXTRA_SECURITY_HOOKS` is enabled:

```typescript
// Set global sanitizer
setSanitizer((node, name, type) => {
  return {
    sanitizeHTMLContent(value: string): string { /* ... */ },
    sanitizeAttributeValue(value: string): string { /* ... */ }
  };
});
```

### Sanitization Points

| Location | Protection |
|----------|------------|
| Text content | HTML injection |
| Attribute values | Attribute injection |
| Property values | Type coercion issues |
| Event handlers | XSS via handlers |

### Marker Security

The random marker component prevents:

1. **Content Collision**: User content cannot accidentally match markers
2. **Injection Attacks**: Attackers cannot predict marker values
3. **Cross-Template Interference**: Different templates use different markers

---

## Summary

Lit-html's template system achieves high performance through:

1. **Separation of Concerns**: Static strings vs. dynamic values
2. **Aggressive Caching**: Templates parsed once, reused forever
3. **Minimal DOM Operations**: Only changed values trigger updates
4. **Efficient Diffing**: Part-level dirty checking
5. **Type-Specific Handling**: Optimized paths for each value type

The marker system enables reliable template parsing while maintaining HTML validity and security. The Part abstraction provides a clean interface for different binding types while sharing common update logic.

---

## References

- [lit-html GitHub Repository](https://github.com/lit/lit/tree/main/packages/lit-html)
- [How Lit-HTML Works (Design Doc)](https://github.com/lit/lit/blob/main/dev-docs/design/how-lit-html-works.md)
- [Lit Documentation](https://lit.dev/docs/)
