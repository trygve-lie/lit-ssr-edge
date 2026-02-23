# Lit Directives: Complete Technical Reference

This document provides a comprehensive analysis of Lit's directive system, based on source code examination from the official Lit repository. It covers the directive architecture, lifecycle, Part interactions, and SSR compatibility for all built-in directives.

## Table of Contents

1. [Directive Architecture Overview](#directive-architecture-overview)
2. [The Directive Base Class](#the-directive-base-class)
3. [Directive Lifecycle](#directive-lifecycle)
4. [AsyncDirective for Asynchronous Operations](#asyncdirective-for-asynchronous-operations)
5. [Directive Helper Utilities](#directive-helper-utilities)
6. [Understanding Parts](#understanding-parts)
7. [SSR Considerations](#ssr-considerations)
8. [Built-in Directives Reference](#built-in-directives-reference)

---

## Directive Architecture Overview

Directives are functions that extend Lit's templating capabilities by customizing how template expressions render. They enable:

- **Stateful rendering logic** across render cycles
- **Direct DOM manipulation** when needed
- **Asynchronous updates** outside normal render cycles
- **Fine-grained control** over rendering behavior

### Core Components

The directive system consists of several key files:

| File | Purpose |
|------|---------|
| `directive.ts` | Base `Directive` class and `directive()` factory |
| `async-directive.ts` | `AsyncDirective` for async operations |
| `directive-helpers.ts` | Utility functions for directive authors |

### How Directives Work

1. A directive class extends `Directive` (or `AsyncDirective`)
2. The `directive()` factory wraps the class into a user-facing function
3. When used in a template, Lit creates a `DirectiveResult` object
4. During rendering, Lit instantiates the directive and calls lifecycle methods

```typescript
import {Directive, directive} from 'lit/directive.js';

class MyDirective extends Directive {
  render(value: string) {
    return `Processed: ${value}`;
  }
}

export const myDirective = directive(MyDirective);

// Usage: html`<div>${myDirective('hello')}</div>`
```

---

## The Directive Base Class

The `Directive` class is the foundation for all Lit directives.

### Source Location
`packages/lit-html/src/directive.ts`

### Class Structure

```typescript
export abstract class Directive implements Disconnectable {
  // Internal properties
  _$parent!: Disconnectable;
  _$disconnectableChildren?: Set<Disconnectable>;
  __part!: Part;
  __attributeIndex: number | undefined;
  __directive?: Directive;

  // Constructor receives PartInfo for validation
  constructor(_partInfo: PartInfo) {}

  // Abstract render method - must be implemented
  abstract render(...props: Array<unknown>): unknown;

  // Optional update method for DOM access
  update(_part: Part, props: Array<unknown>): unknown {
    return this.render(...props);
  }
}
```

### Key Types

**PartType Enumeration:**
```typescript
export const PartType = {
  ATTRIBUTE: 1,
  CHILD: 2,
  PROPERTY: 3,
  BOOLEAN_ATTRIBUTE: 4,
  EVENT: 5,
  ELEMENT: 6,
} as const;
```

**PartInfo Types:**
```typescript
interface ChildPartInfo {
  readonly type: typeof PartType.CHILD;
}

interface AttributePartInfo {
  readonly type: typeof PartType.ATTRIBUTE | PROPERTY | BOOLEAN_ATTRIBUTE | EVENT;
  readonly strings?: ReadonlyArray<string>;
  readonly name: string;
  readonly tagName: string;
}

interface ElementPartInfo {
  readonly type: typeof PartType.ELEMENT;
  readonly tagName: string;
}
```

### DirectiveResult

When a directive function is called, it returns a `DirectiveResult`:

```typescript
interface DirectiveResult<C extends DirectiveClass = DirectiveClass> {
  _$litDirective$: C;
  values: unknown[];
}
```

---

## Directive Lifecycle

Directives have a well-defined lifecycle that determines when different methods are called.

### Lifecycle Methods

| Method | When Called | Purpose |
|--------|-------------|---------|
| `constructor(partInfo)` | First render only | Initialization and validation |
| `render(...args)` | Every render | Return renderable value |
| `update(part, args)` | Every render (client-side) | DOM access, can return `noChange` |
| `disconnected()` | Element removed from DOM | Cleanup (AsyncDirective only) |
| `reconnected()` | Element re-added to DOM | Restore state (AsyncDirective only) |

### Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    First Render                              │
├─────────────────────────────────────────────────────────────┤
│  1. constructor(partInfo) called                            │
│  2. _$initialize(part, parent, attributeIndex) called       │
│  3. update(part, props) called                              │
│     └── By default calls render(...props)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Subsequent Renders                           │
├─────────────────────────────────────────────────────────────┤
│  1. update(part, props) called                              │
│     └── Can return noChange to skip render                  │
│  2. If update returns value, it's committed to DOM          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Disconnection (AsyncDirective)                  │
├─────────────────────────────────────────────────────────────┤
│  1. disconnected() called when removed from DOM             │
│  2. reconnected() called if re-added to DOM                 │
└─────────────────────────────────────────────────────────────┘
```

### The render() Method

The `render()` method is the core of any directive:

- **Required**: Must be implemented by all directives
- **Returns**: Any renderable value (string, TemplateResult, nothing, etc.)
- **Arguments**: Become the directive function's signature
- **SSR Safe**: Called on both server and client

```typescript
class HelloDirective extends Directive {
  render(name: string, greeting = 'Hello') {
    return `${greeting}, ${name}!`;
  }
}

const hello = directive(HelloDirective);
// Usage: html`${hello('World')}` renders "Hello, World!"
```

### The update() Method

The `update()` method provides access to the DOM:

- **Optional**: Defaults to calling `render()`
- **Client-only**: Not called during SSR
- **Part access**: Receives the Part for DOM manipulation
- **Can signal noChange**: Return `noChange` to keep previous value

```typescript
class FocusDirective extends Directive {
  render() {
    return nothing;
  }

  update(part: ElementPart) {
    part.element.focus();
    return nothing;
  }
}
```

### Signaling No Change

Return `noChange` (not `undefined`) to preserve the previously rendered value:

```typescript
import {noChange} from 'lit';

class CachedDirective extends Directive {
  private cachedValue: string | undefined;

  render(value: string) {
    if (value === this.cachedValue) {
      return noChange; // Preserves previous DOM
    }
    this.cachedValue = value;
    return value;
  }
}
```

---

## AsyncDirective for Asynchronous Operations

The `AsyncDirective` class extends `Directive` for scenarios requiring:

- Updates outside the normal render cycle
- Resource cleanup on disconnection
- Handling of Promises, Observables, or other async sources

### Source Location
`packages/lit-html/src/async-directive.ts`

### Class Structure

```typescript
export abstract class AsyncDirective extends Directive {
  // Connection state
  isConnected: boolean;

  // Push new values asynchronously
  setValue(value: unknown): void;

  // Lifecycle hooks for cleanup
  protected disconnected(): void {}
  protected reconnected(): void {}
}
```

### Architecture Pattern

AsyncDirective uses a sparse tree structure of `_$disconnectableChildren` Sets to efficiently track which branches contain async directives requiring lifecycle callbacks. This minimizes overhead when the feature isn't used.

Key helper functions:

| Function | Purpose |
|----------|---------|
| `notifyChildrenConnectedChanged()` | Recursively walks the tree to set connection state |
| `addDisconnectableToParent()` | Climbs parent tree, creating sparse tracking structure |
| `removeDisconnectableFromParent()` | Cleans up parent references on disconnect |
| `installDisconnectAPI()` | Patches disconnection methods onto ChildParts |

### Using setValue()

The `setValue()` method allows pushing values outside render:

```typescript
class ObservableDirective extends AsyncDirective {
  private subscription?: Subscription;

  render(observable: Observable<unknown>) {
    this.subscription?.unsubscribe();
    this.subscription = observable.subscribe((value) => {
      this.setValue(value);
    });
    return noChange;
  }

  disconnected() {
    this.subscription?.unsubscribe();
  }

  reconnected() {
    // Re-subscribe if needed
  }
}
```

### Disconnection and Reconnection

```typescript
class TimerDirective extends AsyncDirective {
  private intervalId?: number;

  render(interval: number) {
    if (this.intervalId === undefined) {
      this.intervalId = setInterval(() => {
        this.setValue(Date.now());
      }, interval);
    }
    return Date.now();
  }

  disconnected() {
    clearInterval(this.intervalId);
    this.intervalId = undefined;
  }

  reconnected() {
    // Timer restarts on next render
  }
}
```

---

## Directive Helper Utilities

The `directive-helpers.ts` file provides utility functions for directive authors.

### Source Location
`packages/lit-html/src/directive-helpers.ts`

### Type Guards

```typescript
// Check if value is a primitive
isPrimitive(value: unknown): boolean

// Check for template results
isTemplateResult(value: unknown, type?: TemplateResultType): boolean
isCompiledTemplateResult(value: unknown): boolean

// Check for directive results
isDirectiveResult(value: unknown): boolean

// Check if part has single expression
isSingleExpression(part: PartInfo): boolean
```

### DOM Utilities

```typescript
// Create marker comment nodes
createMarker(): Comment

// Insert a new child part
insertPart(
  containerPart: ChildPart,
  refPart?: ChildPart,
  part?: ChildPart
): ChildPart

// Remove a part and its DOM
removePart(part: ChildPart): void

// Clear part content without removing markers
clearPart(part: ChildPart): void
```

### Value Management

```typescript
// Update part value through _$setValue
setChildPartValue(
  part: ChildPart,
  value: unknown,
  directiveParent?: DirectiveParent,
  attributeIndex?: number
): void

// Directly modify committed value (bypass change detection)
setCommittedValue(part: Part, value?: unknown): unknown

// Get the cached committed value
getCommittedValue(part: Part): unknown

// Extract directive class from result
getDirectiveClass(value: unknown): typeof Directive | undefined
```

### Constants

```typescript
// Template result types
const TemplateResultType = {
  HTML: 1,
  SVG: 2,
  MATHML: 3,
} as const;

// Sentinel for forcing dirty-check failures
const RESET_VALUE: unique symbol;

// ShadyDOM configuration
const ENABLE_SHADYDOM_NOPATCH: boolean;
```

---

## Understanding Parts

Parts represent the binding locations in templates where directives can attach.

### Part Types

| Part Type | Template Syntax | Description |
|-----------|-----------------|-------------|
| `ChildPart` | `${expression}` | HTML child position |
| `AttributePart` | `attr="${expr}"` | Attribute value |
| `PropertyPart` | `.prop="${expr}"` | Property binding |
| `BooleanAttributePart` | `?attr="${expr}"` | Boolean attribute |
| `EventPart` | `@event="${expr}"` | Event listener |
| `ElementPart` | `${expr}` on element | Element-level binding |

### Part Interface

All Parts share common properties:

```typescript
interface Part {
  readonly type: PartType;
  readonly options: RenderOptions | undefined;
}
```

### ChildPart

```typescript
interface ChildPart extends Part {
  readonly type: typeof PartType.CHILD;
  readonly parentNode: Element | DocumentFragment;
  readonly startNode: ChildNode | null;
  readonly endNode: ChildNode | null;
}
```

### AttributePart

```typescript
interface AttributePart extends Part {
  readonly type: typeof PartType.ATTRIBUTE;
  readonly element: Element;
  readonly name: string;
  readonly strings: ReadonlyArray<string>;
}
```

### Accessing the DOM Element

In `update()`, access the DOM via the Part:

```typescript
update(part: ChildPart) {
  const parent = part.parentNode;
  // Manipulate parent...
}

update(part: AttributePart) {
  const element = part.element;
  const attrName = part.name;
  // Manipulate element...
}
```

---

## SSR Considerations

Server-Side Rendering (SSR) with Lit has specific implications for directives.

### How SSR Handles Directives

During SSR, Lit patches directives to:
1. Call `render()` instead of `update()`
2. Recursively process nested directives
3. Skip DOM-dependent operations

From `@lit-labs/ssr` source:
> "Looks for values of type `DirectiveResult` and patches its Directive class such that it calls `render` rather than `update`."

### SSR Constraints

| Binding Type | SSR Support | Reason |
|--------------|-------------|--------|
| Child expressions | Yes | Can be serialized to HTML |
| Attributes | Yes | Can be serialized to HTML |
| Properties (`.prop`) | Limited | Cannot serialize to HTML (hydration only) |
| Events (`@event`) | Limited | Cannot serialize listeners (hydration only) |
| Element parts | Limited | No server-side API (hydration only) |

### Writing SSR-Compatible Directives

**Do:**
- Implement meaningful `render()` methods that return serializable values
- Handle `undefined` or `null` gracefully
- Return `nothing` for DOM-only operations

**Don't:**
- Rely on `update()` for SSR-critical functionality
- Access DOM APIs in `render()`
- Assume `isConnected` state during initial render

```typescript
class SSRSafeDirective extends Directive {
  // SSR-compatible: returns serializable value
  render(value: string) {
    return `Processed: ${value}`;
  }

  // Client-only: DOM manipulation
  update(part: AttributePart, [value]: [string]) {
    if (someCondition) {
      part.element.setAttribute('data-processed', 'true');
    }
    return this.render(value);
  }
}
```

---

## Built-in Directives Reference

Lit provides a comprehensive set of built-in directives organized by category.

### Iterating and Looping Directives

#### repeat

**Import:** `import {repeat} from 'lit/directives/repeat.js'`

**Purpose:** Efficiently renders and updates lists with key-based reconciliation.

**Signature:**
```typescript
repeat<T>(
  items: Iterable<T>,
  keyFn: KeyFn<T>,
  template: ItemTemplate<T>
): unknown

repeat<T>(
  items: Iterable<T>,
  template: ItemTemplate<T>
): unknown
```

**How it works:**
- Uses an O(n) bidirectional pointer algorithm for reconciliation
- Maintains key-to-DOM mappings for efficient updates
- Performs minimal DOM operations for insertions/removals
- Head/tail pointers scan both old and new lists simultaneously

**SSR Compatibility:** **Yes**
- Includes explicit SSR hydration support
- Initializes empty keys array for hydration scenarios
- Works correctly during first-render hydration

```typescript
html`
  <ul>
    ${repeat(
      items,
      (item) => item.id,
      (item) => html`<li>${item.name}</li>`
    )}
  </ul>
`
```

---

#### map

**Import:** `import {map} from 'lit/directives/map.js'`

**Purpose:** Generator function that transforms iterable collections.

**Signature:**
```typescript
function* map<T>(
  items: Iterable<T> | undefined,
  f: (value: T, index: number) => unknown
): Generator<unknown>
```

**How it works:**
- Uses generator pattern (`function*`)
- Yields transformed results lazily
- Passes both value and index to callback
- Handles `undefined` items gracefully

**SSR Compatibility:** **Yes**
- Pure generator function with no DOM dependencies
- Returns iterable compatible with both server and client rendering

```typescript
html`
  <ul>
    ${map(items, (item, i) => html`<li>${i}: ${item.name}</li>`)}
  </ul>
`
```

---

#### join

**Import:** `import {join} from 'lit/directives/join.js'`

**Purpose:** Interleaves a joiner value between items in an iterable.

**Signature:**
```typescript
function* join<I, J>(
  items: Iterable<I> | undefined,
  joiner: J | ((index: number) => J)
): Generator<I | J>
```

**How it works:**
- Generator function that yields items with joiners between them
- Joiner can be static value or function returning dynamic values
- No joiner before first item

**SSR Compatibility:** **Yes**
- Pure generator function
- No browser-specific APIs

```typescript
html`
  <nav>
    ${join(
      links,
      html`<span class="separator">|</span>`
    )}
  </nav>
`
```

---

#### range

**Import:** `import {range} from 'lit/directives/range.js'`

**Purpose:** Generates an iterable of integers.

**Signature:**
```typescript
function* range(end: number): Generator<number>
function* range(start: number, end: number, step?: number): Generator<number>
```

**How it works:**
- Flexible parameter handling (end only, or start/end/step)
- Step defaults to 1, supports negative values
- Loop condition adapts based on step direction

**SSR Compatibility:** **Yes**
- Pure generator function producing JavaScript iterables

```typescript
html`
  <div class="grid">
    ${map(range(8), () => html`<div class="cell"></div>`)}
  </div>
`
```

---

### Conditional Directives

#### when

**Import:** `import {when} from 'lit/directives/when.js'`

**Purpose:** Conditional rendering based on a boolean condition.

**Signature:**
```typescript
when<T, F>(
  condition: boolean,
  trueCase: () => T,
  falseCase?: () => F
): T | F | undefined
```

**How it works:**
- Simple ternary-like pattern
- Type-safe with proper overloads for truthy/falsy inference
- Both branches receive the condition value

**SSR Compatibility:** **Yes**
- Pure JavaScript function with no framework-specific APIs

```typescript
html`
  ${when(
    isLoggedIn,
    () => html`<user-profile></user-profile>`,
    () => html`<login-form></login-form>`
  )}
`
```

---

#### choose

**Import:** `import {choose} from 'lit/directives/choose.js'`

**Purpose:** Select a template from multiple cases based on value matching.

**Signature:**
```typescript
choose<T, V>(
  value: T,
  cases: Array<[T, () => V]>,
  defaultCase?: () => V
): V | undefined
```

**How it works:**
- Uses strict equality (`===`) for matching
- Returns first matching case's result
- Optional default case for unmatched values

**SSR Compatibility:** **Yes**
- Pure expression evaluation with no browser dependencies

```typescript
html`
  ${choose(userRole, [
    ['admin', () => html`<admin-panel></admin-panel>`],
    ['user', () => html`<user-dashboard></user-dashboard>`],
    ['guest', () => html`<guest-view></guest-view>`],
  ], () => html`<access-denied></access-denied>`)}
`
```

---

#### ifDefined

**Import:** `import {ifDefined} from 'lit/directives/if-defined.js'`

**Purpose:** Sets attribute if value is defined, removes if undefined.

**Signature:**
```typescript
const ifDefined = <T>(value: T) => value ?? nothing;
```

**How it works:**
- Uses nullish coalescing pattern
- Returns `nothing` for `undefined`/`null` (removes attribute)
- Passes through all other values

**SSR Compatibility:** **Yes**
- Simple value transformation using Lit's `nothing` token

```typescript
html`
  <img src=${src} alt=${ifDefined(altText)}>
`
```

---

### Styling Directives

#### classMap

**Import:** `import {classMap} from 'lit/directives/class-map.js'`

**Purpose:** Dynamically applies CSS classes based on an object.

**Signature:**
```typescript
classMap(classInfo: ClassInfo): string
```

**How it works:**
- Accepts object with class names as keys, boolean/truthy values
- Filters truthy values and joins as class names
- Tracks previous classes for efficient add/remove on updates
- Distinguishes between static and dynamic classes

**SSR Compatibility:** **Limited**
- `render()` returns string of class names (SSR-safe)
- `update()` directly manipulates `classList` (client-only)
- Must be the only expression in `class` attribute

```typescript
html`
  <div class=${classMap({
    'active': isActive,
    'disabled': isDisabled,
    'highlighted': isHighlighted
  })}>
    Content
  </div>
`
```

---

#### styleMap

**Import:** `import {styleMap} from 'lit/directives/style-map.js'`

**Purpose:** Applies CSS properties to inline styles.

**Signature:**
```typescript
styleMap(styleInfo: StyleInfo): string
```

**How it works:**
- Keys are CSS property names (camelCase or dash-case)
- Dash-case uses `setProperty()`, camelCase uses assignment
- Auto-prefixes vendor properties (webkit, moz, ms, o)
- Handles `!important` declarations

**SSR Compatibility:** **Limited**
- `render()` converts to style string (SSR-safe)
- `update()` uses DOM style manipulation (client-only)

```typescript
html`
  <div style=${styleMap({
    backgroundColor: bgColor,
    '--custom-property': value,
    width: `${width}px`
  })}>
    Content
  </div>
`
```

---

### Caching and Optimization Directives

#### cache

**Import:** `import {cache} from 'lit/directives/cache.js'`

**Purpose:** Caches rendered DOM when switching between templates.

**Signature:**
```typescript
cache(value: TemplateResult): unknown
```

**How it works:**
- Maintains `WeakMap` storing DOM nodes indexed by template strings
- When switching templates, stores current `ChildPart` in cache
- When returning to cached template, retrieves and reinserts nodes
- Uses template strings array as cache key

**SSR Compatibility:** **No**
- Uses `document.createDocumentFragment()` directly
- Relies on DOM manipulation APIs unconditionally
- Stores client-side specific `ChildPart` instances

```typescript
html`
  ${cache(
    showDetails
      ? html`<detail-view></detail-view>`
      : html`<summary-view></summary-view>`
  )}
`
```

---

#### guard

**Import:** `import {guard} from 'lit/directives/guard.js'`

**Purpose:** Prevents template re-rendering until dependencies change.

**Signature:**
```typescript
guard<T>(
  deps: unknown[] | unknown,
  fn: () => T
): unknown
```

**How it works:**
- Dirty-checking mechanism comparing against previous values
- Arrays: compares each item at same index
- Non-arrays: identity comparison (`===`)
- Creates array copy to preserve reference tracking

**SSR Compatibility:** **Yes** (with caveats)
- `render()` executes template function immediately
- No SSR-specific handling, but pure computation

```typescript
html`
  ${guard([items.length], () => html`
    <expensive-list .items=${items}></expensive-list>
  `)}
`
```

---

#### keyed

**Import:** `import {keyed} from 'lit/directives/keyed.js'`

**Purpose:** Associates renderable values with unique keys for forced re-rendering.

**Signature:**
```typescript
keyed(key: unknown, value: unknown): unknown
```

**How it works:**
- Stores key and compares on updates
- When key changes, clears part before returning new value
- Forces DOM removal/recreation even for same values

**SSR Compatibility:** **Limited**
- `render()` returns value directly (SSR-safe)
- DOM clearing logic in `update()` (client-only)

```typescript
html`
  ${keyed(userId, html`<user-profile .user=${user}></user-profile>`)}
`
```

---

#### live

**Import:** `import {live} from 'lit/directives/live.js'`

**Purpose:** Checks expression against live DOM value instead of previously bound value.

**Signature:**
```typescript
live(value: unknown): unknown
```

**How it works:**
- Property bindings: strict equality against current property
- Boolean attributes: checks attribute presence
- Standard attributes: string comparison against `getAttribute()`
- Returns `noChange` if values match

**SSR Compatibility:** **No**
- Explicitly accesses `part.element` and DOM methods
- Uses `hasAttribute()`, `getAttribute()` unavailable server-side
- Designed exclusively for client-side input synchronization

```typescript
html`
  <input .value=${live(inputValue)}>
`
```

---

### Async Directives

#### until

**Import:** `import {until} from 'lit/directives/until.js'`

**Purpose:** Renders values with priority ordering, including Promises.

**Signature:**
```typescript
until(...values: unknown[]): unknown
```

**How it works:**
- First argument has highest priority, last has lowest
- Synchronous values render immediately and stop processing
- Promises render lower-priority fallback while pending
- Tracks `__lastRenderedIndex` to prevent lower-priority overwrites

**SSR Compatibility:** **No**
- Relies on async/await patterns and Promise callbacks
- Uses `disconnected()`/`reconnected()` lifecycle
- Designed for client-side dynamic rendering

```typescript
html`
  ${until(
    fetchUser().then(user => html`<user-card .user=${user}></user-card>`),
    html`<loading-spinner></loading-spinner>`
  )}
`
```

---

#### asyncAppend

**Import:** `import {asyncAppend} from 'lit/directives/async-append.js'`

**Purpose:** Renders async iterable values by appending sequentially.

**Signature:**
```typescript
asyncAppend<T>(
  value: AsyncIterable<T>,
  mapper?: (value: T, index: number) => unknown
): unknown
```

**How it works:**
- Extends `AsyncReplaceDirective`
- First value clears the part
- Subsequent values create new parts inserted into parent
- Each new part receives corresponding async value

**SSR Compatibility:** **No**
- Requires `AsyncDirective` lifecycle
- DOM manipulation for appending parts
- No server-side streaming support

```typescript
html`
  <ul>
    ${asyncAppend(streamingItems, (item) => html`<li>${item}</li>`)}
  </ul>
`
```

---

#### asyncReplace

**Import:** `import {asyncReplace} from 'lit/directives/async-replace.js'`

**Purpose:** Renders async iterable values, replacing previous with new.

**Signature:**
```typescript
asyncReplace<T>(
  value: AsyncIterable<T>,
  mapper?: (value: T, index: number) => unknown
): unknown
```

**How it works:**
- Uses `forAwaitOf()` to iterate async values
- Applies optional mapper function
- Calls `commitValue()` to replace previous value
- Uses `Pauser` utility for connection state management
- `PseudoWeakRef` avoids closure overhead for GC

**SSR Compatibility:** **No**
- Async iteration patterns
- DOM manipulation requirements
- No server-side support

```typescript
html`
  <div class="latest-value">
    ${asyncReplace(observableValues)}
  </div>
`
```

---

### DOM Reference Directives

#### ref

**Import:** `import {ref, createRef} from 'lit/directives/ref.js'`

**Purpose:** Retrieves references to rendered DOM elements.

**Signature:**
```typescript
ref(refOrCallback: RefOrCallback): unknown

function createRef<T = Element>(): Ref<T>
```

**How it works:**
- **Ref Object Pattern:** Updates `value` property when elements render
- **Callback Pattern:** Calls function with element reference
- Uses double-keyed WeakMap for callback tracking
- Returns `nothing` (no rendered output)

**SSR Compatibility:** **No**
- Requires DOM availability for references
- `isConnected` checks in `_updateRefValue()`
- `disconnected()`/`reconnected()` lifecycle methods

```typescript
const inputRef = createRef<HTMLInputElement>();

html`
  <input ${ref(inputRef)}>
  <button @click=${() => inputRef.value?.focus()}>Focus</button>
`

// Or with callback
html`
  <input ${ref((el) => el?.focus())}>
`
```

---

#### templateContent

**Import:** `import {templateContent} from 'lit/directives/template-content.js'`

**Purpose:** Renders HTML `<template>` element contents.

**Signature:**
```typescript
templateContent(template: HTMLTemplateElement): unknown
```

**How it works:**
- Uses `document.importNode(template.content, true)` to clone
- Caches via `_previousTemplate` to avoid re-processing
- Validates child binding usage only

**SSR Compatibility:** **No**
- Relies on `document.importNode()` browser API
- No server-side alternative

**Security Note:** Template should be developer-controlled, not user-controlled.

```typescript
html`
  <div>
    ${templateContent(document.querySelector('#my-template'))}
  </div>
`
```

---

### Unsafe Content Directives

#### unsafeHTML

**Import:** `import {unsafeHTML} from 'lit/directives/unsafe-html.js'`

**Purpose:** Parses and renders strings as HTML content.

**Signature:**
```typescript
unsafeHTML(value: string | nothing | null | undefined): unknown
```

**How it works:**
- Validates child binding usage only
- Returns `nothing` for undefined/null values
- Creates fake TemplateResult structure to bypass escaping
- Caches previous values

**SSR Compatibility:** **Limited**
- Returns TemplateResult-like structure (potentially SSR-safe)
- No explicit server-side handling documented

**Security Warning:** Unsafe with unsanitized user input - XSS vulnerability risk.

```typescript
html`
  <article>
    ${unsafeHTML(trustedMarkdownContent)}
  </article>
`
```

---

#### unsafeSVG

**Import:** `import {unsafeSVG} from 'lit/directives/unsafe-svg.js'`

**Purpose:** Parses and renders strings as SVG content.

**Signature:**
```typescript
unsafeSVG(value: string | nothing | null | undefined): unknown
```

**How it works:**
- Extends `UnsafeHTMLDirective`
- Sets `SVG_RESULT = 2` for SVG parsing
- Same behavior as `unsafeHTML` for SVG namespace

**SSR Compatibility:** **Limited**
- Similar to `unsafeHTML`
- No explicit server-side handling

**Security Warning:** Same XSS risks as `unsafeHTML`.

```typescript
html`
  <svg>
    ${unsafeSVG(trustedSVGContent)}
  </svg>
`
```

---

## SSR Compatibility Summary

| Directive | SSR Safe | Notes |
|-----------|----------|-------|
| **repeat** | Yes | Explicit hydration support |
| **map** | Yes | Pure generator function |
| **join** | Yes | Pure generator function |
| **range** | Yes | Pure generator function |
| **when** | Yes | Pure JavaScript function |
| **choose** | Yes | Pure expression evaluation |
| **ifDefined** | Yes | Simple value transformation |
| **classMap** | Partial | `render()` safe, `update()` client-only |
| **styleMap** | Partial | `render()` safe, `update()` client-only |
| **guard** | Yes | Pure computation |
| **keyed** | Partial | `render()` safe, DOM clearing client-only |
| **cache** | No | Requires DOM APIs |
| **live** | No | DOM comparison required |
| **until** | No | Promise/async handling |
| **asyncAppend** | No | Async iteration + DOM |
| **asyncReplace** | No | Async iteration + DOM |
| **ref** | No | DOM reference required |
| **templateContent** | No | Requires `document.importNode()` |
| **unsafeHTML** | Partial | May work, no explicit support |
| **unsafeSVG** | Partial | May work, no explicit support |

### SSR Best Practices

1. **Prefer SSR-safe directives** for content that must render on server
2. **Use conditional rendering** to exclude client-only directives during SSR
3. **Implement meaningful `render()` methods** that return serializable values
4. **Reserve `update()` for DOM-dependent logic** that can wait for hydration
5. **Test with `@lit-labs/ssr`** to verify directive behavior

---

## Creating Custom Directives

### Basic Pattern

```typescript
import {Directive, directive} from 'lit/directive.js';

class MyDirective extends Directive {
  render(value: string) {
    return `Processed: ${value}`;
  }
}

export const myDirective = directive(MyDirective);
```

### With Update Method

```typescript
class DOMManipulatingDirective extends Directive {
  render() {
    return nothing; // Or initial value
  }

  update(part: ElementPart) {
    part.element.setAttribute('data-processed', 'true');
    return nothing;
  }
}
```

### Async Directive

```typescript
import {AsyncDirective, directive} from 'lit/async-directive.js';

class StreamDirective extends AsyncDirective {
  private stream?: ReadableStream;

  render(stream: ReadableStream) {
    this.subscribeToStream(stream);
    return 'Loading...';
  }

  private async subscribeToStream(stream: ReadableStream) {
    this.stream = stream;
    const reader = stream.getReader();

    while (this.isConnected) {
      const {done, value} = await reader.read();
      if (done) break;
      this.setValue(value);
    }
  }

  disconnected() {
    // Cleanup handled by isConnected check
  }
}

export const streamDirective = directive(StreamDirective);
```

### Validating Part Type

```typescript
class AttributeOnlyDirective extends Directive {
  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ATTRIBUTE) {
      throw new Error('This directive can only be used in attributes');
    }
  }

  render(value: string) {
    return value;
  }
}
```

---

## Conclusion

Lit's directive system provides a powerful and flexible way to extend template functionality. Key takeaways:

1. **Use `Directive` for stateful rendering logic** that needs to persist across renders
2. **Use `AsyncDirective` for async operations** requiring cleanup and lifecycle management
3. **Implement `render()` for SSR compatibility** - it's the only method called on server
4. **Reserve `update()` for DOM manipulation** that requires client-side execution
5. **Choose built-in directives based on SSR needs** - not all are server-compatible
6. **Signal `noChange` appropriately** to optimize rendering performance

The directive system's architecture balances flexibility with performance, enabling complex rendering scenarios while maintaining Lit's lightweight footprint.
