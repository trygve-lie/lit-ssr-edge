# Lit Reactive Element & LitElement Internals

This document provides a deep analysis of Lit's reactive property system, focusing on `ReactiveElement` (the base class) and `LitElement` (the template integration layer).

## Table of Contents

1. [Overview](#overview)
2. [ReactiveElement Architecture](#reactiveelement-architecture)
3. [Property Declaration System](#property-declaration-system)
4. [Reactive Properties Lifecycle](#reactive-properties-lifecycle)
5. [Update Cycle Deep Dive](#update-cycle-deep-dive)
6. [LitElement Integration](#litelement-integration)
7. [SSR Implications](#ssr-implications)

---

## Overview

Lit's component system is built on two key classes:

| Class | Package | Purpose |
|-------|---------|---------|
| `ReactiveElement` | `@lit/reactive-element` | Reactive properties and update lifecycle |
| `LitElement` | `lit-element` | Adds lit-html template rendering |

**ReactiveElement** provides the foundation for reactive properties, change tracking, and batched DOM updates. **LitElement** extends it by integrating lit-html's template rendering system into the update cycle.

---

## ReactiveElement Architecture

### Source Location
`packages/reactive-element/src/reactive-element.ts`

### Core Responsibilities

1. **Property observation** - Track changes to reactive properties
2. **Update batching** - Coalesce multiple property changes into single update
3. **Lifecycle management** - Coordinate `willUpdate`, `update`, `updated` hooks
4. **Attribute synchronization** - Reflect properties to/from HTML attributes
5. **Controller integration** - Support reactive controllers pattern

### Class Structure

```typescript
export class ReactiveElement extends HTMLElement {
  // Static metadata
  static properties: PropertyDeclarations = {};
  static elementProperties: PropertyDeclarationMap;
  static elementStyles: CSSResultOrNative[];
  static shadowRootOptions: ShadowRootInit = { mode: 'open' };

  // Instance properties
  protected renderRoot!: HTMLElement | DocumentFragment;
  protected _$updatePromise: Promise<boolean>;
  private _$changedProperties: PropertyValues;

  // Lifecycle hooks
  connectedCallback(): void;
  disconnectedCallback(): void;
  attributeChangedCallback(name: string, old: string | null, value: string | null): void;

  requestUpdate(name?: PropertyKey, oldValue?: unknown): Promise<boolean>;
  protected performUpdate(): void;
  protected shouldUpdate(_changedProperties: PropertyValues): boolean;
  protected willUpdate(_changedProperties: PropertyValues): void;
  protected update(changedProperties: PropertyValues): void;
  protected updated(_changedProperties: PropertyValues): void;
  protected firstUpdated(_changedProperties: PropertyValues): void;
}
```

---

## Property Declaration System

### PropertyDeclaration Interface

Properties are configured via `PropertyDeclaration` objects:

```typescript
export interface PropertyDeclaration<Type = unknown, TypeHint = unknown> {
  /**
   * Whether property is internal state (not reflected to attribute)
   * Default: false
   */
  state?: boolean;

  /**
   * Attribute name to observe/reflect, or false to disable
   * Default: lowercase property name
   */
  attribute?: boolean | string;

  /**
   * Type hint for default converter
   * Default: String
   */
  type?: TypeHint;

  /**
   * Custom attribute converter
   * Default: defaultConverter
   */
  converter?: AttributeConverter<Type, TypeHint>;

  /**
   * Whether to reflect property to attribute
   * Default: false
   */
  reflect?: boolean;

  /**
   * Custom equality check
   * Default: strict inequality (!==)
   */
  hasChanged?: (value: Type, oldValue: Type) => boolean;

  /**
   * Whether to skip automatic accessor creation
   * Default: false
   */
  noAccessor?: boolean;

  /**
   * Whether to use initializer value as default
   * Default: false
   */
  useDefault?: boolean;

  /**
   * Internal: marks wrapped accessors
   * @internal
   */
  wrapped?: boolean;
}
```

### Defining Properties

**Via Static Properties Field:**

```typescript
class MyElement extends LitElement {
  static properties = {
    name: { type: String },
    count: { type: Number, reflect: true },
    disabled: { type: Boolean, attribute: 'disabled' },
    data: { type: Object },
    _internal: { state: true }
  };

  name = 'default';
  count = 0;
  disabled = false;
  data = {};
  _internal = null;
}
```

**Via Decorators (TypeScript):**

```typescript
class MyElement extends LitElement {
  @property({ type: String })
  name = 'default';

  @property({ type: Number, reflect: true })
  count = 0;

  @property({ type: Boolean })
  disabled = false;

  @state()
  private _internal = null;
}
```

### Default Converter

The `defaultConverter` handles common type transformations:

```typescript
export const defaultConverter: ComplexAttributeConverter = {
  toAttribute(value: unknown, type?: unknown): unknown {
    switch (type) {
      case Boolean:
        // True -> empty string, False -> null (removes attribute)
        value = value ? emptyStringForBooleanAttribute : null;
        break;
      case Object:
      case Array:
        // Serialize to JSON
        value = value == null ? value : JSON.stringify(value);
        break;
      case Number:
      case String:
      default:
        // String coercion
        value = value;
    }
    return value;
  },

  fromAttribute(value: string | null, type?: unknown) {
    let fromValue: unknown = value;
    switch (type) {
      case Boolean:
        // Any attribute presence -> true
        fromValue = value !== null;
        break;
      case Number:
        // Parse number, null if attribute missing
        fromValue = value === null ? null : Number(value);
        break;
      case Object:
      case Array:
        // Parse JSON, null on error
        try {
          fromValue = JSON.parse(value!) as unknown;
        } catch (e) {
          fromValue = null;
        }
        break;
      default:
        // String passthrough
        fromValue = value;
    }
    return fromValue;
  }
};
```

### Property Accessor Generation

ReactiveElement automatically creates property accessors:

```typescript
protected static getPropertyDescriptor(
  name: PropertyKey,
  key: string | symbol,
  options: PropertyDeclaration
): PropertyDescriptor | undefined {
  const {get, set} = getOwnPropertyDescriptor(this.prototype, name) ?? {
    get(this: ReactiveElement) {
      return this[key as keyof typeof this];
    },
    set(this: ReactiveElement, v: unknown) {
      (this as unknown as Record<string | symbol, unknown>)[key] = v;
    }
  };

  return {
    get,
    set(this: ReactiveElement, value: unknown) {
      const oldValue = get?.call(this);
      set?.call(this, value);
      // Trigger update cycle
      this.requestUpdate(name, oldValue, options);
    },
    configurable: true,
    enumerable: true
  };
}
```

**Key mechanism:** The setter intercepts property assignments and calls `requestUpdate()`, triggering the reactive update cycle.

---

## Reactive Properties Lifecycle

### Property Change Detection

When a property is set:

```
User sets property
    ↓
Setter intercept (generated accessor)
    ↓
this.requestUpdate(name, oldValue, options)
    ↓
hasChanged() check (default: oldValue !== newValue)
    ↓
If changed: _$changeProperty(name, oldValue, options)
    ↓
Record in _$changedProperties Map
    ↓
Queue update (if not already queued)
```

### The requestUpdate() Method

```typescript
requestUpdate(
  name?: PropertyKey,
  oldValue?: unknown,
  options?: PropertyDeclaration,
  useNewValue = false,
  newValue?: unknown
): void {
  if (name !== undefined) {
    options ??= this.constructor.getPropertyOptions(name);

    // Get new value
    if (useNewValue === false) {
      newValue = this[name as keyof this];
    }

    // Check if changed
    const hasChanged = (options.hasChanged ?? notEqual)(newValue, oldValue);

    if (!hasChanged) {
      return; // Skip update
    }

    this._$changeProperty(name, oldValue, options);
  }

  // Queue update if not already pending
  if (this.isUpdatePending === false) {
    this.__updatePromise = this.__enqueueUpdate();
  }
}
```

**Default hasChanged:** Uses `notEqual()` which is `oldValue !== newValue`

**Manual Updates:** Call `requestUpdate()` without arguments to force an update.

### Attribute Synchronization

**From Attribute to Property:**

```typescript
attributeChangedCallback(name: string, _old: string | null, value: string | null) {
  const ctor = this.constructor as typeof ReactiveElement;
  const prop = ctor.__attributeNameToPropertyMap.get(name);

  if (prop !== undefined) {
    const options = ctor.getPropertyOptions(prop);
    const converter = options.converter || defaultConverter;

    const newValue = typeof converter === 'function'
      ? converter(value, options.type)
      : converter.fromAttribute(value, options.type);

    this._$changeProperty(prop, this[prop as keyof this], options, useNewValue: true, newValue);
  }
}
```

**From Property to Attribute:**

During the `update()` phase, properties with `reflect: true` are synchronized to attributes:

```typescript
protected update(changedProperties: PropertyValues) {
  // Reflect properties to attributes
  for (const [name, _oldValue] of changedProperties) {
    const options = this.constructor.getPropertyOptions(name);

    if (options.reflect === true) {
      const converter = options.converter || defaultConverter;
      const attrValue = typeof converter === 'function'
        ? undefined
        : converter.toAttribute(this[name as keyof this], options.type);

      const attrName = options.attribute ?? name.toString();

      if (attrValue == null) {
        this.removeAttribute(attrName);
      } else {
        this.setAttribute(attrName, attrValue as string);
      }
    }
  }
}
```

---

## Update Cycle Deep Dive

### Update Flow

```
Property changes accumulate
    ↓
__enqueueUpdate() - queues microtask
    ↓
scheduleUpdate() - override point for timing control
    ↓
performUpdate()
    ├─ createRenderRoot() (first update only)
    ├─ shouldUpdate(changedProperties) → boolean
    │   ↓ (if false, skip)
    ├─ willUpdate(changedProperties)
    ├─ Controllers: hostUpdate()
    ├─ update(changedProperties)
    │   ├─ Reflect properties to attributes
    │   └─ LitElement: render template
    └─ _$didUpdate(changedProperties)
        ├─ firstUpdated() (first update only)
        ├─ updated(changedProperties)
        └─ Controllers: hostUpdated()
```

### The __enqueueUpdate() Method

```typescript
private async __enqueueUpdate() {
  this.isUpdatePending = true;

  try {
    // Wait for previous update
    await this.__updatePromise;
  } catch (e) {
    // Re-throw to ensure rejection is not silently swallowed
    Promise.reject(e);
  }

  const result = this.scheduleUpdate();

  // Wait for scheduleUpdate if it returns a Promise
  if (result != null) {
    await result;
  }

  return !this.isUpdatePending;
}
```

### The scheduleUpdate() Hook

```typescript
protected scheduleUpdate(): void | Promise<unknown> {
  const result = this.performUpdate();
  return result;
}
```

**Override example for debouncing:**

```typescript
class MyElement extends LitElement {
  private _updateTimeout?: number;

  protected override scheduleUpdate(): Promise<unknown> {
    return new Promise((resolve) => {
      clearTimeout(this._updateTimeout);
      this._updateTimeout = setTimeout(() => {
        this.performUpdate();
        resolve(true);
      }, 100); // 100ms debounce
    });
  }
}
```

### The performUpdate() Method

```typescript
protected performUpdate(): void {
  // Early exit if no update pending
  if (!this.isUpdatePending) {
    return;
  }

  debugLogEvent?.({kind: 'update'});

  // Create render root on first update
  if (!this.hasUpdated) {
    this.renderRoot ??= this.createRenderRoot();
  }

  let shouldUpdate = false;
  const changedProperties = this._$changedProperties;

  try {
    shouldUpdate = this.shouldUpdate(changedProperties);

    if (shouldUpdate) {
      this.willUpdate(changedProperties);

      // Call controllers
      this.__controllers?.forEach((c) => c.hostUpdate?.());

      this.update(changedProperties);
    } else {
      this.__markUpdated();
    }
  } catch (e) {
    shouldUpdate = false;
    this.__markUpdated();
    throw e;
  }

  if (shouldUpdate) {
    this._$didUpdate(changedProperties);
  }
}
```

### Lifecycle Hooks

**shouldUpdate(changedProperties):**
- Returns `boolean` indicating whether to proceed with update
- Default: `return true` (always update)
- Use to skip updates based on specific property changes

```typescript
shouldUpdate(changedProperties: PropertyValues) {
  // Only update if 'important' property changed
  return changedProperties.has('important');
}
```

**willUpdate(changedProperties):**
- Called before `update()` and DOM changes
- Use to compute derived values
- Setting properties here **will not** trigger another update

```typescript
willUpdate(changedProperties: PropertyValues) {
  if (changedProperties.has('firstName') || changedProperties.has('lastName')) {
    this.fullName = `${this.firstName} ${this.lastName}`;
  }
}
```

**update(changedProperties):**
- Reflects properties to attributes
- LitElement: renders template
- Rarely overridden directly

**updated(changedProperties):**
- Called after DOM updates complete
- Use for DOM queries or side effects
- **Warning:** Setting properties here triggers another update

```typescript
updated(changedProperties: PropertyValues) {
  if (changedProperties.has('active') && this.active) {
    this.focus();
  }
}
```

**firstUpdated(changedProperties):**
- Called only on the first update after element connection
- Use for one-time setup requiring DOM access

```typescript
firstUpdated() {
  this.renderRoot.querySelector('input')?.focus();
}
```

---

## LitElement Integration

### Source Location
`packages/lit-element/src/lit-element.ts`

### LitElement Extends ReactiveElement

```typescript
export class LitElement extends ReactiveElement {
  static ['_$litElement$'] = true;

  // Render options
  readonly renderOptions: RenderOptions = {host: this};

  // Child part reference
  private __childPart: RootPart | undefined = undefined;

  // Abstract render method
  protected render(): unknown {
    return noChange;
  }

  // Overridden update to integrate rendering
  protected override update(changedProperties: PropertyValues) {
    // Render template
    const value = this.render();

    if (!this.hasUpdated) {
      this.renderOptions.isConnected = this.isConnected;
    }

    // Call ReactiveElement's update (reflects attributes)
    super.update(changedProperties);

    // Render to shadow root
    this.__childPart = render(value, this.renderRoot, this.renderOptions);
  }

  // Shadow root creation with style support
  protected override createRenderRoot() {
    const renderRoot = super.createRenderRoot();

    // Adjust renderBefore for style ordering
    this.renderOptions.renderBefore ??= renderRoot!.firstChild as ChildNode;

    return renderRoot;
  }
}
```

### The render() Method

```typescript
protected render(): unknown {
  return noChange;
}
```

**Contract:**
- Returns a value renderable by lit-html (TemplateResult, primitives, nothing, etc.)
- Called during every update cycle
- **Important:** Setting properties inside `render()` will not trigger updates

```typescript
class MyElement extends LitElement {
  @property() name = '';
  @property() count = 0;

  render() {
    return html`
      <h1>Hello, ${this.name}!</h1>
      <p>Count: ${this.count}</p>
    `;
  }
}
```

### Shadow Root and Styles

**createRenderRoot():**

```typescript
protected createRenderRoot(): Element | ShadowRoot {
  const renderRoot = this.shadowRoot ??
    this.attachShadow(this.constructor.shadowRootOptions);

  adoptStyles(renderRoot, this.constructor.elementStyles);

  return renderRoot;
}
```

**Static styles:**

```typescript
class MyElement extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 16px;
    }

    h1 {
      color: blue;
    }
  `;

  render() {
    return html`<h1>Styled content</h1>`;
  }
}
```

**Multiple style sheets:**

```typescript
static styles = [
  commonStyles,
  css`
    :host {
      background: white;
    }
  `
];
```

**Light DOM rendering (no shadow root):**

```typescript
class MyElement extends LitElement {
  protected createRenderRoot() {
    return this; // Render to light DOM
  }
}
```

---

## SSR Implications

### Server-Side Rendering Constraints

During SSR, only specific lifecycle methods execute:

| Method | SSR | Client | Notes |
|--------|-----|--------|-------|
| `constructor` | ✅ | ✅ | Component instantiation |
| `hasChanged` | ✅ | ✅ | Property change detection |
| `willUpdate` | ✅ | ✅ | Pre-render computation |
| `render` | ✅ | ✅ | Template generation |
| `update` | ✅ | ✅ | Attribute reflection (no DOM) |
| `connectedCallback` | ❌ | ✅ | DOM connection only |
| `firstUpdated` | ❌ | ✅ | DOM availability required |
| `updated` | ❌ | ✅ | Post-DOM updates |
| `disconnectedCallback` | ❌ | ✅ | DOM disconnection only |

### SSR-Safe Patterns

**Good - Compute derived values in willUpdate:**

```typescript
willUpdate(changedProperties: PropertyValues) {
  if (changedProperties.has('data')) {
    this.processedData = this.data.map(transformFn);
  }
}

render() {
  return html`${this.processedData.map(item => html`<div>${item}</div>`)}`;
}
```

**Bad - DOM queries in lifecycle:**

```typescript
updated() {
  // This will fail on server - no DOM
  const input = this.renderRoot.querySelector('input');
  input.focus(); // TypeError: Cannot read property 'focus' of null
}
```

**Good - Guard client-only code:**

```typescript
updated() {
  if (typeof window !== 'undefined') {
    this.renderRoot.querySelector('input')?.focus();
  }
}
```

### Attribute Reflection in SSR

Properties with `reflect: true` generate attributes during SSR:

```typescript
class MyElement extends LitElement {
  @property({ type: String, reflect: true })
  status = 'active';

  @property({ type: Number, reflect: true })
  count = 5;
}
```

**SSR Output:**

```html
<my-element status="active" count="5">
  <!-- Shadow root content -->
</my-element>
```

This allows proper hydration on the client.

### Hydration Considerations

1. **Properties must be serializable** - Complex objects in reflected properties use JSON.stringify
2. **Attribute names** - Use lowercase or explicit `attribute: 'custom-name'` for consistency
3. **Initial values** - Properties should have sensible defaults for SSR rendering
4. **Controllers** - Reactive controllers may need SSR awareness checks

---

## Summary

Key takeaways for understanding Lit's reactive system:

1. **Property setters trigger updates** - Automatic accessor generation intercepts changes
2. **Updates are batched** - Multiple property changes coalesce into single DOM update
3. **Lifecycle hooks provide control** - `willUpdate`, `update`, `updated` for different phases
4. **Attribute reflection is bidirectional** - Properties can sync to/from HTML attributes
5. **LitElement adds template rendering** - Integrates lit-html into the update cycle
6. **SSR has constraints** - Only certain lifecycle methods execute on server

The reactive property system is the foundation of Lit's efficient update mechanism, enabling declarative component authoring while maintaining performance through smart batching and change detection.

---

## References

- [ReactiveElement Source](https://github.com/lit/lit/blob/main/packages/reactive-element/src/reactive-element.ts)
- [LitElement Source](https://github.com/lit/lit/blob/main/packages/lit-element/src/lit-element.ts)
- [Lit Reactive Properties Docs](https://lit.dev/docs/components/properties/)
- [Lit Lifecycle Docs](https://lit.dev/docs/components/lifecycle/)
