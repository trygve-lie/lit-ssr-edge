# Phase 5 Complete: Directive Support

**Status:** ✅ Complete
**Date:** February 23, 2026
**Implementation:** lit-ssr-edge v1.0.0
**Node Version:** v24.13.0
**Platform:** Linux x64

---

## Overview

Phase 5 formalised directive support in lit-ssr-edge. The underlying directive patching mechanism (`patchIfDirective`, `resolveDirective`, `patchDirectiveResolve`) was already in place from Phase 2, and all 21 directive baseline tests were already passing. Phase 5 delivered:

- A curated public directive module (`src/directives/index.js`) exporting all SSR-safe directives
- A validation module (`src/lib/directives-validation.js`) that throws clear, informative errors when client-only directives are used during SSR
- A 65-test directive suite covering all supported and unsupported directives
- Documentation of the complete directive support matrix

---

## Deliverables

### ✅ 1. Public Directive Module

**`src/directives/index.js`**

A curated entry point that re-exports all SSR-compatible directives. Users can import from here instead of individual `lit/directives/*` paths to get an SSR-safe, well-documented set:

```js
import { repeat, when, classMap, unsafeHTML } from 'lit-ssr-edge/directives/index.js';
```

**Exported directives:**

| Directive | Support | Description |
|-----------|---------|-------------|
| `repeat` | ✅ Full | List rendering with key-based reconciliation |
| `map` | ✅ Full | Array-to-template transformation |
| `join` | ✅ Full | Join an iterable with a separator |
| `range` | ✅ Full | Generate a sequence of integers |
| `when` | ✅ Full | Ternary conditional rendering |
| `choose` | ✅ Full | Multi-case conditional (switch/case pattern) |
| `ifDefined` | ✅ Full | Render a value only when it is not `undefined` |
| `guard` | ✅ Full | Memoize rendering based on dependency values |
| `unsafeHTML` | ✅ Full | Render raw HTML strings without escaping |
| `unsafeSVG` | ✅ Full | Render raw SVG strings without escaping |
| `unsafeMathML` | ✅ Full | Render raw MathML strings without escaping |
| `classMap` | ⚠️ Partial | Build a `class` attribute from a boolean map |
| `styleMap` | ⚠️ Partial | Build a `style` attribute from a property map |
| `keyed` | ⚠️ Partial | Associate a key with a value (key ignored in SSR) |

**Partial support** means the `render()` method works correctly for server-rendered HTML. The `update()` method has additional DOM-dependent behaviour that only runs on subsequent client-side re-renders.

---

### ✅ 2. Directive Validation Module

**`src/lib/directives-validation.js`**

Builds a `Map<Constructor, name>` of known client-only directive constructors at module load time. Each directive factory is called once with minimal dummy arguments to obtain the constructor reference via `getDirectiveClass()`.

Constructor reference equality is used for detection rather than class name matching — this is stable even when user code is minified, because lit's directive constructors are the same object references in the module cache across all imports.

**`validateDirectiveSupport(directiveCtor)`** is exported and called inside `patchIfDirective()` in `render-value.js`. When a client-only directive is detected, it throws an `Error` with:
- The exact directive name
- An explanation of why it cannot be used in SSR
- A list of all supported directives

**Example error:**

```
The `cache` directive is not supported in server-side rendering.
It relies on browser DOM APIs or asynchronous update cycles that are unavailable on the server.

Supported directives (full SSR support):
  repeat, map, join, range, when, choose, ifDefined, guard, unsafeHTML, unsafeSVG, unsafeMathML

Supported directives (render() only, update() is client-side):
  classMap, styleMap, keyed
```

---

### ✅ 3. render-value.js Updated

**`src/lib/render-value.js`** — `patchIfDirective` now calls `validateDirectiveSupport(directiveCtor)` before patching, giving clear errors instead of cryptic runtime failures.

---

### ✅ 4. Directive Support Matrix

| Directive | Category | SSR Behaviour |
|-----------|----------|---------------|
| `repeat` | Full | Renders list items via `render()` |
| `map` | Full | Transforms iterable items via `render()` |
| `join` | Full | Joins items with separator via `render()` |
| `range` | Full | Generates integer sequence |
| `when` | Full | Ternary conditional via `render()` |
| `choose` | Full | Multi-case conditional via `render()` |
| `ifDefined` | Full | Returns value or `noChange` (attribute omitted) |
| `guard` | Full | Calls factory every SSR render (no memoization) |
| `unsafeHTML` | Full | Injects raw HTML into the output |
| `unsafeSVG` | Full | Injects raw SVG into the output |
| `unsafeMathML` | Full | Injects raw MathML into the output |
| `classMap` | Partial | Builds class string from boolean map |
| `styleMap` | Partial | Builds style string from property map (compact format: `color:red;`) |
| `keyed` | Partial | Renders value normally; key not used in SSR |
| `cache` | ❌ Error | Throws with clear message |
| `live` | ❌ Error | Throws with clear message |
| `until` | ❌ Error | Throws with clear message |
| `asyncAppend` | ❌ Error | Throws with clear message |
| `asyncReplace` | ❌ Error | Throws with clear message |
| `ref` | Element-part | Silent no-op (element renders, callback not invoked) |
| `templateContent` | ❌ Error | Throws with clear message |

**Note on `ref`:** The `ref` directive is an element-part directive (placed on element tags, not in child positions). Element-part opcodes are silently skipped during SSR — the element renders correctly but the ref callback is never called. This is intentional and matches `@lit-labs/ssr` behaviour: there is no real DOM element to reference on the server. `ref` does not throw; it is simply a no-op.

**Note on `styleMap` format:** The compact CSS format (`color:red;font-size:16px;`) without spaces is the exact output of `@lit-labs/ssr` and is valid CSS. Client-side browsers accept it correctly.

---

## Tests Added

### `test/integration/directives/ssr-safe.test.js` — 36 tests

| Suite | Tests | Directives |
|-------|-------|------------|
| repeat | 5 | String items, empty list, index, object keys, large lists |
| map | 4 | Array transform, index, empty, Set iterable |
| join | 4 | String separator, template separator, single item, empty |
| range | 3 | 0..n, start..end, with step |
| when | 4 | True, false, no-fallback, truthy non-boolean |
| choose | 3 | Match, default, no match/no default |
| ifDefined | 4 | Defined string, undefined, null, number |
| guard | 3 | Template value, primitive, multiple deps |
| unsafeHTML | 4 | Raw HTML, complex HTML, script tag, empty string |
| unsafeSVG | 1 | SVG markup |

### `test/integration/directives/partial.test.js` — 16 tests

| Suite | Tests |
|-------|-------|
| classMap | 6 |
| styleMap | 6 |
| keyed | 4 |

Key scenarios:
- `classMap` produces `" active visible "` (with surrounding spaces — exact SSR format)
- `styleMap` produces compact CSS without spaces: `"color:red;font-size:16px;"`
- Both skip `undefined` and `null` values
- CSS custom properties (`--var`) work with styleMap
- `keyed` value is rendered normally; key is ignored on server

### `test/integration/directives/unsupported.test.js` — 13 tests

| Suite | Tests | Directive |
|-------|-------|-----------|
| Error shape | 3 | cache (tests error type, name, suggestions) |
| cache | 2 | Throws with correct message |
| live | 1 | Throws with correct message |
| until | 2 | Throws with Promise or no args |
| asyncAppend | 1 | Throws |
| asyncReplace | 1 | Throws |
| ref | 3 | Does NOT throw; element renders; ref value undefined |
| templateContent | 1 | Throws |

---

## Full Test Results

### Phase 5 tests (new)

```
ℹ tests 65
ℹ suites 21
ℹ pass 65
ℹ fail 0
```

### All tests (cumulative)

| Test suite | Tests | Pass |
|-----------|-------|------|
| Baseline integration (Phases 0/2) | 122 | 122 |
| Hydration unit + integration (Phase 3) | 51 | 51 |
| Component integration (Phase 4) | 53 | 53 |
| Directive integration (Phase 5) | 65 | 65 |
| **Total** | **291** | **291** |

---

## How to Run Tests

```bash
# Phase 5 directive tests only
node --test test/integration/directives/*.test.js

# All tests
TEST_IMPL=lit-ssr-edge node --test test/integration/baseline/**/*.test.js
node --test test/unit/*.test.js test/integration/hydration/*.test.js
node --test test/integration/components/*.test.js
node --test test/integration/directives/*.test.js
```

---

## Success Criteria

From the architecture document:

- ✅ All directive tests pass (65 new tests, all passing)
- ✅ Output matches `@lit-labs/ssr` (verified for classMap, styleMap, unsafeHTML)
- ✅ Clear errors for unsupported directives (cache, live, until, asyncAppend, asyncReplace, templateContent)

**Status: ALL CRITERIA MET ✅**

---

## Next Steps

### Phase 6: Optimisation & Polish

- Profile against Phase 1 baselines and verify within performance targets
- Consider removing `@lit-labs/ssr-client` as a devDependency (digest is now native)
- Add Cloudflare Workers and Fastly Compute example workers
- Complete public API documentation and migration guide from `@lit-labs/ssr`

---

## Conclusion

Phase 5 delivered a complete, well-documented directive system for lit-ssr-edge. The 11 fully-supported directives, 3 partially-supported directives, and clear error handling for 6 client-only directives give users a predictable, safe SSR directive API. All 291 cumulative tests pass.

**Phase 5 Complete. Ready for Phase 6: Optimisation & Polish.**
