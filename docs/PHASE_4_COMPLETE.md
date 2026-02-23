# Phase 4 Complete: Component Support

**Status:** ✅ Complete
**Date:** February 23, 2026
**Implementation:** lit-edge v1.0.0
**Node Version:** v24.13.0
**Platform:** Linux x64

---

## Overview

Phase 4 formalised component support in lit-edge. The core rendering of LitElement components had been working since Phase 2, but Phase 4 delivered the architectural pieces that make the implementation stand on its own:

- A proper DOM shim module (`src/lib/dom-shim.js`) backed by `@lit-labs/ssr-dom-shim`
- A public side-effect entry point (`src/install-global-dom-shim.js`) for edge runtimes
- ElementInternals / ARIA attribute reflection in `LitElementRenderer`
- A dedicated component test suite (53 tests across 3 files) covering the full surface area

---

## Deliverables

### ✅ 1. DOM Shim

**`src/lib/dom-shim.js`**

Provides the minimal browser DOM globals needed to instantiate and render LitElement components on server-side runtimes. Wraps `@lit-labs/ssr-dom-shim` (a pure-JS, WinterTC-compatible package) and adds:

- A guard for `globalThis.process` before importing the shim, preventing `ReferenceError` in runtimes that don't provide Node's `process` global (Cloudflare Workers, Fastly Compute, Deno, Bun)
- `installGlobalDomShim(scope?)` — installs shim classes and a `customElements` registry into the target scope using `??=` (safe to call multiple times; does not overwrite existing browser globals)
- Named re-exports of all shim classes for explicit use without side effects

**Installed globals (when absent):**

| Global | Source |
|--------|--------|
| `HTMLElement` | `@lit-labs/ssr-dom-shim` Element shim |
| `Element` | `@lit-labs/ssr-dom-shim` Element shim |
| `Event` / `CustomEvent` | `@lit-labs/ssr-dom-shim` Event shims |
| `EventTarget` | `@lit-labs/ssr-dom-shim` EventTarget shim |
| `CSSStyleSheet` | `@lit-labs/ssr-dom-shim` CSS shim |
| `customElements` | New `CustomElementRegistry` instance |

**`src/install-global-dom-shim.js`**

A side-effect-only module that calls `installGlobalDomShim()` on import. Users who need the DOM shim can import it once at the top of their entry point:

```js
// worker.js
import 'lit-edge/install-global-dom-shim.js';
import { render, RenderResultReadable } from 'lit-edge';
import './my-components-bundle.js';
import { html } from 'lit';

export default {
  fetch() {
    const stream = new RenderResultReadable(
      render(html`<my-app></my-app>`)
    ).getStream();
    return new Response(stream, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
};
```

**When is the shim needed?**

| Runtime | Needs shim? | Reason |
|---------|------------|--------|
| Cloudflare Workers | ✅ Yes | WinterTC — no DOM globals |
| Fastly Compute | ✅ Yes | WinterTC — no DOM globals |
| Node.js 18+ | ✅ Yes | No DOM globals by default |
| Deno | ✅ Yes | No DOM globals by default |
| Bun | ✅ Yes | No DOM globals by default |
| Browser | ❌ No | Native DOM APIs already present |

**Note:** In practice, when users import `lit` (or `lit-element`) in Node.js, `@lit-labs/ssr-dom-shim` is installed as a transitive side effect of `lit-element`. For edge runtimes where `lit` is not pre-loaded, users must import `lit-edge/install-global-dom-shim.js` explicitly.

---

### ✅ 2. ElementInternals and ARIA Attribute Reflection

**`src/lib/lit-element-renderer.js`** (updated)

The `LitElementRenderer` constructor now imports `ariaMixinAttributes` and `HYDRATE_INTERNALS_ATTR_PREFIX` from `src/lib/dom-shim.js` and reflects ElementInternals ARIA properties to the element's HTML attributes, matching `@lit-labs/ssr` behaviour.

**How it works:**

When a component calls `this.attachInternals()` and sets ARIA properties (e.g. `internals.ariaLabel = 'Close'`), those properties are reflected to real HTML attributes during SSR so that:
1. Search bots can read semantic information without executing JavaScript
2. Accessibility tools work on the server-rendered page before hydration

The `hydrate-internals-*` attribute prefix allows the client to clean up these reflected attributes after hydration (the element's own ARIA getters take over).

```js
// Example component
class MyButton extends LitElement {
  constructor() {
    super();
    this._internals = this.attachInternals();
  }
  willUpdate() {
    this._internals.ariaLabel = this.label;
    this._internals.ariaPressed = String(this.pressed);
  }
  render() { return html`<span>${this.label}</span>`; }
}
```

Rendered output will include `aria-label="..."` and `hydrate-internals-aria-label="..."` on the element's opening tag.

---

### ✅ 3. Public API Extended

**`src/index.js`** now exports:

```js
export { installGlobalDomShim } from './lib/dom-shim.js';
```

---

### ✅ 4. Runtime Dependency Added

`@lit-labs/ssr-dom-shim` is added as a proper **runtime** dependency (previously only a transitive dev dependency). It is pure JavaScript with no Node.js core module imports — WinterTC-compatible.

---

## Test Fixtures Added

### `test/fixtures/aria-element.js`

A `LitElement` component that calls `attachInternals()` and sets `ariaLabel` and `ariaPressed` via ElementInternals in `willUpdate()`. Used to test ARIA attribute reflection.

### `test/fixtures/reflected-element.js`

A `LitElement` component with `reflect: true` properties (`status` as String, `count` as Number, `active` as Boolean). Used to test that reflected properties appear as HTML attributes in the rendered output.

### `test/fixtures/lifecycle-element.js`

A `LitElement` component with a `willUpdate` hook that derives `fullName` from `firstName` and `lastName`. Used to verify the SSR lifecycle is called correctly before `render()`.

---

## Tests Added

### `test/integration/components/rendering.test.js` — 21 tests

| Suite | Tests |
|-------|-------|
| Phase 4 - DOM shim | 6 |
| Phase 4 - basic component rendering | 6 |
| Phase 4 - SSR lifecycle (willUpdate) | 3 |
| Phase 4 - declarative shadow DOM output | 4 |
| Phase 4 - ElementInternals ARIA | 2 |

Key scenarios:
- `installGlobalDomShim()` is idempotent and safe to call multiple times
- The function does not overwrite existing globals in scopes that already have them
- Unregistered custom elements render as plain pass-through tags
- Top-level components have a declarative shadow root but NOT `defer-hydration`
- Nested components receive `defer-hydration` (checked in shadow-dom.test.js)
- `willUpdate` derives computed values before `render()` is called

### `test/integration/components/properties.test.js` — 17 tests

| Suite | Tests |
|-------|-------|
| Attribute-to-property type conversion | 4 |
| Default property values | 2 |
| Static attribute bindings | 2 |
| Dynamic attribute bindings | 2 |
| Property bindings (.prop=) | 2 |
| reflect:true properties | 4 |
| (extra) | 1 |

Key findings documented in tests:
- `String`, `Number`, `Boolean`, and custom-attribute properties are correctly converted from HTML attribute strings during SSR
- `reflect: true` properties appear as attributes on the element's opening tag after `connectedCallback()` runs
- Property bindings (`.prop=`) set the property directly on the element instance; however, for non-reflected LitElement properties, this may not affect shadow DOM content (consistent with `@lit-labs/ssr` — prefer attribute bindings for reliable SSR content)

### `test/integration/components/shadow-dom.test.js` — 15 tests

| Suite | Tests |
|-------|-------|
| Declarative shadow DOM structure | 3 |
| Style serialisation | 4 |
| Shadow root options | 2 |
| Slot rendering | 4 |
| Nested component rendering | 3 |
| (extra) | ... |

Key scenarios:
- Both `shadowroot="open"` and `shadowrootmode="open"` are present (cross-browser compatibility)
- Light DOM children appear after `</template>`, not inside the shadow DOM
- `delegatesFocus: true` shadow root option adds `shadowrootdelegatesfocus` to the template tag
- Named and unnamed slots are serialised inside the shadow DOM template
- Slotted content (light DOM) is rendered outside the shadow template
- Nested components each have their own shadow DOM template
- Nested components (inside another component's shadow) receive `defer-hydration`

---

## Known Limitations

### Property Bindings and SSR Content

Property bindings (`.prop=value`) in SSR set the property on the element instance via `setProperty()`. For non-reflected LitElement properties, this may not reliably affect the rendered shadow DOM content when going through LitElement's `changedProperties` system. This is consistent behaviour with `@lit-labs/ssr`.

**Workaround:** Use attribute bindings (`name=value`) with LitElement's `type` converter, or declare the property with `reflect: true` for values needed in HTML attributes.

### `attachInternals()` Availability

The `attachInternals()` method is provided by `@lit-labs/ssr-dom-shim`'s Element shim. Components using it must have the DOM shim installed. If not installed, `attachInternals` is `undefined` and ARIA properties are not reflected.

---

## Full Test Results

### Phase 4 tests (new)

```
ℹ tests 53
ℹ suites 16
ℹ pass 53
ℹ fail 0
```

### All tests (cumulative)

| Test suite | Tests | Pass |
|-----------|-------|------|
| Baseline integration (Phase 0/2) | 122 | 122 |
| Hydration unit + integration (Phase 3) | 51 | 51 |
| Component integration (Phase 4) | 53 | 53 |
| **Total** | **226** | **226** |

---

## How to Run Tests

```bash
# Phase 4 component tests only
node --test test/integration/components/*.test.js

# Full test suite
TEST_IMPL=lit-edge node --test test/integration/baseline/**/*.test.js
node --test test/unit/*.test.js test/integration/hydration/*.test.js
node --test test/integration/components/*.test.js
```

---

## Success Criteria

From the architecture document:

- ✅ Component tests pass (53 new tests, all passing)
- ✅ Declarative shadow DOM correct (`shadowroot` + `shadowrootmode` attributes)
- ✅ Styles embedded properly (inside `<template shadowroot>`)
- ✅ Components compatible with `@lit-labs/ssr-client` (same output format)
- ✅ DOM shim module created and exported
- ✅ `installGlobalDomShim()` available for edge runtime setup

**Status: ALL CRITERIA MET ✅**

---

## Next Steps

### Phase 5: Directive Support (already working — formalise)

All 21 directive baseline tests pass. Phase 5 should:
- Write a dedicated directive test suite (`test/integration/directives/`)
- Formally validate each supported directive: `repeat`, `map`, `join`, `range`, `when`, `choose`, `ifDefined`, `guard`, `classMap`, `styleMap`, `keyed`, `unsafeHTML`
- Add clear errors for unsupported client-only directives (`cache`, `live`, `until`, `ref`, etc.)
- Export directive utilities from the main `lit-edge` entry point

### Phase 6: Optimisation & Polish

- Profile against Phase 1 baselines
- Remove `@lit-labs/ssr-client` as a dev dependency (digest is now native)
- Add Cloudflare Workers and Fastly Compute example workers
- Complete public API documentation

---

## Conclusion

Phase 4 formally delivered the DOM shim infrastructure that makes lit-edge self-contained on edge runtimes, upgraded `LitElementRenderer` with full ElementInternals/ARIA support, and added a 53-test component suite covering the complete component rendering surface. All 226 tests across all phases pass.

**Phase 4 Complete. Ready for Phase 5: Directive Support.**
