# Phase 3 Complete: Hydration Support

**Status:** ✅ Complete
**Date:** February 23, 2026
**Implementation:** lit-ssr-edge v1.0.0
**Node Version:** v24.13.0
**Platform:** Linux x64

---

## Overview

Phase 3 delivered native hydration support for lit-ssr-edge, removing the runtime dependency on `@lit-labs/ssr-client` for digest calculation and centralising all hydration marker logic. The implementation produces byte-for-byte identical output to `@lit-labs/ssr` so that the official `@lit-labs/ssr-client` can hydrate server-rendered pages without modification.

---

## Deliverables

### ✅ 1. Native Digest Implementation

**`src/lib/digest.js`**

Implements `digestForTemplateResult()` natively using the DJB2 hash algorithm. Previously, `render-value.js` imported this from `@lit-labs/ssr-client` (a devDependency). Now lit-ssr-edge owns the implementation.

**Algorithm:**
1. Two 32-bit DJB2 accumulators initialised to 5381 (`DIGEST_SIZE = 2`)
2. Characters from each string in the template's `strings` array are XOR-folded into alternating accumulators: `hash = (hash * 33) ^ charCode`
3. The resulting 8-byte buffer is base64-encoded with `btoa()`
4. Results are memoised per `TemplateStringsArray` reference (WeakMap)

`btoa()` is used throughout (not `Buffer.from()`) because all WinterTC-compliant runtimes provide it natively, with no Node.js fallback needed.

**Verification:** 10 compatibility tests confirm the output is byte-for-byte identical to `@lit-labs/ssr-client`'s `digestForTemplateResult()` across a variety of template structures.

---

### ✅ 2. Hydration Marker Module

**`src/lib/markers.js`**

Centralises all hydration marker strings in one place, replacing the previously inline template literals scattered through `render-value.js`.

| Export | Format | Purpose |
|--------|--------|---------|
| `openTemplatePart(digest)` | `<!--lit-part DIGEST-->` | Opens a TemplateResult child part |
| `openPart()` | `<!--lit-part-->` | Opens a non-template child part |
| `closePart` | `<!--/lit-part-->` | Closes any child part |
| `nodeMarker(index)` | `<!--lit-node N-->` | Placed before elements with attribute bindings |

These are the exact marker formats that `@lit-labs/ssr-client` expects when walking the server-rendered DOM during hydration.

---

### ✅ 3. Render Engine Updated

**`src/lib/render-value.js`**

- Replaced `import { digestForTemplateResult } from '@lit-labs/ssr-client'` with `import { digestForTemplateResult } from './digest.js'`
- Replaced inline marker template literals with named imports from `./markers.js`

The render engine is otherwise unchanged — the refactor is purely about ownership and readability.

---

### ✅ 4. Public API Extended

**`src/index.js`**

`digestForTemplateResult` and all marker functions are now exported from the main entry point:

```js
import { digestForTemplateResult, openTemplatePart, openPart, closePart, nodeMarker } from 'lit-ssr-edge';
```

This lets consuming code calculate digests and generate markers without a separate import, and makes the hydration primitives available for testing and tooling.

---

## Tests Added

### Unit tests

**`test/unit/digest.test.js`** — 17 tests

- Algorithm correctness (non-empty, valid base64, determinism, template-independence of values)
- Compatibility with `@lit-labs/ssr-client` across 10 template variations (simple, one binding, attribute binding, multiple bindings, no bindings, boolean attribute, deep nesting, empty, special characters, unicode)
- Caching behaviour

**`test/unit/markers.test.js`** — 14 tests

- Each marker function produces the correct format string
- Marker strings are valid HTML comments
- Format matches patterns expected by `@lit-labs/ssr-client`'s hydration parser

### Integration tests

**`test/integration/hydration/markers.test.js`** — 20 tests

- lit-part markers wrap TemplateResult child parts correctly
- Outer template marker includes the correct digest
- Output starts and ends with matching lit-part markers
- Primitive child parts use the empty `<!--lit-part-->` form
- `null`, `undefined`, and `nothing` produce empty lit-part pairs
- Nested template markers are balanced and correctly counted
- Array child parts produce one marker per item
- lit-node markers appear before attribute-bound elements
- lit-node index is a non-negative integer
- Static-only elements do not get lit-node markers
- Multiple bound elements each get their own lit-node marker
- Digest embedded in output matches `digestForTemplateResult()` directly
- Different templates embed different digests
- Re-rendering produces stable digests
- Server-only templates produce no lit-part or lit-node markers
- Regular templates nested inside server-only templates still have markers

---

## Full Test Results

### Phase 3 tests (new)

```
ℹ tests 51
ℹ suites 12
ℹ pass 51
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### Phase 0/2 baseline regression (all 122 still passing)

```
ℹ tests 122
ℹ suites 37
ℹ pass 122
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

---

## How to Run Tests

```bash
# Phase 3 unit tests only
node --test test/unit/digest.test.js test/unit/markers.test.js

# Phase 3 integration tests only
node --test test/integration/hydration/markers.test.js

# All Phase 3 tests
node --test test/unit/*.test.js test/integration/hydration/*.test.js

# Full test suite (baseline + Phase 3)
TEST_IMPL=lit-ssr-edge node --test test/integration/baseline/**/*.test.js
node --test test/unit/*.test.js test/integration/hydration/*.test.js
```

---

## Hydration Compatibility Notes

### Marker format

The hydration markers generated by lit-ssr-edge are identical to `@lit-labs/ssr`:

```html
<!--lit-part AEmR7W+R0Ak=-->
<div>
  <!--lit-node 0-->
  <span class="bold">
    <!--lit-part-->
    Hello
    <!--/lit-part-->
  </span>
</div>
<!--/lit-part-->
```

`@lit-labs/ssr-client`'s `hydrate()` function locates parts by walking this comment structure, so the marker format must match exactly. The 51 Phase 3 tests confirm this.

### Digest algorithm

The DJB2 variant used by lit-ssr-edge is character-by-character XOR folding across two 32-bit accumulators, base64-encoded as an 8-byte value. All 10 compatibility tests pass confirming byte-for-byte agreement with `@lit-labs/ssr-client`.

### Runtime dependency removed

`@lit-labs/ssr-client` remains a devDependency (used in tests to verify digest compatibility) but is no longer a runtime import anywhere in `src/`. The lit-ssr-edge package itself can now be bundled and deployed to edge runtimes without it.

---

## Success Criteria

From the architecture document:

- ✅ Hydration marker tests pass (51 new tests, all passing)
- ✅ Digests match `@lit-labs/ssr` exactly (10 compatibility tests, all passing)
- ✅ Server-only templates work correctly (4 dedicated integration tests)
- ✅ Output compatible with `@lit-labs/ssr-client` (marker format verified)

**Status: ALL CRITERIA MET ✅**

---

## Next Steps

### Phase 4: Component Support (already working — formalise)

LitElement rendering works in Phase 2/3 as a side effect of the complete rendering engine. Phase 4 should formally validate and document:
- DOM shim independence (remove `@lit-labs/ssr-dom-shim` as a runtime dep)
- Edge cases: async properties, reactive controllers, `ElementInternals`
- Slot distribution and named slots
- Nested component hydration

### Phase 5: Directive Support (already working — formalise)

All 21 directive tests pass. Phase 5 should formally validate:
- Full support list: `repeat`, `map`, `join`, `range`, `when`, `choose`, `ifDefined`, `guard`
- Partial support: `classMap`, `styleMap`, `keyed`
- Clear error messages for unsupported client-only directives

### Phase 6: Optimisation & Polish

- Profile against Phase 1 benchmarks
- Tune streaming chunk size (currently unbuffered)
- Add Cloudflare Workers and Fastly Compute examples
- Complete API documentation

---

## Conclusion

Phase 3 has fully decoupled lit-ssr-edge's hydration support from `@lit-labs/ssr-client` at runtime. The native DJB2 digest implementation, centralised marker module, and 51 new tests give high confidence that server-rendered output will hydrate correctly with the official Lit client library.

**Phase 3 Complete. Ready for Phase 4: Component Support.**
