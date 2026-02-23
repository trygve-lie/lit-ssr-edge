# Refactoring to Use assertHTMLEqual()

This document summarizes the refactoring of all baseline tests to use `assertHTMLEqual()` for full HTML comparison instead of partial matching with `assert.ok(result.includes(...))`.

## Objective

Align with the testing strategy (STRATEGY_TESTING.md) which explicitly requires:
- ✅ **Full HTML comparison** instead of partial matching
- ❌ **No `assert.ok(result.includes(...))`** for content validation

## Changes Made

### 1. Updated All Test Files

Refactored **7 test files** to use `assertHTMLEqual()`:

1. ✅ `template-rendering.test.js` - 13 tests
2. ✅ `attribute-binding.test.js` - 22 tests
3. ✅ `directives.test.js` - 16 tests
4. ✅ `components.test.js` - 19 tests
5. ✅ `shadow-dom.test.js` - 11 tests
6. ✅ `edge-cases.test.js` - 16 tests
7. ✅ `server-only-templates.test.js` - 11 tests (+ streaming.test.js already correct)

### 2. Import Pattern

All test files now import `assertHTMLEqual`:

```javascript
import { assertHTMLEqual } from '../../helpers/html-compare.js';
```

### 3. Assertion Pattern Changes

**Before (Partial Matching):**
```javascript
assert.ok(result.includes('<div>Hello, World!</div>'));
assert.ok(result.includes('Hello'));
assert.ok(!result.includes('error'));
```

**After (Full HTML Comparison):**
```javascript
const stripped = stripHydrationMarkers(result);
assertHTMLEqual(stripped, '<div>Hello, World!</div>');
```

### 4. Exceptions

Some tests appropriately retain `assert.ok()` for checking:
- **Structural features**: Presence of `<template shadowroot>`, `<slot>`, etc.
- **Hydration markers**: Checking for `<!--lit-part-->` (metadata, not content)
- **Error conditions**: Verifying error messages
- **Large content**: Arrays with 1000+ items where full comparison is impractical
- **Multiple matches**: Counting occurrences (e.g., `result.match(/<template shadowroot/g).length >= 2`)

**Example - Appropriate use of `assert.ok()`:**
```javascript
// Checking for structural feature (not content comparison)
assert.ok(result.includes('<template shadowroot'));

// Checking for absence of hydration markers
assert.ok(!result.includes('<!--lit-part'));

// Counting instances
const shadowRootMatches = result.match(/<template shadowroot/g);
assert.ok(shadowRootMatches && shadowRootMatches.length >= 2);
```

## Key Discoveries

### 1. Fixed `stripHydrationMarkers()`

Updated to properly remove `<?>` placeholder markers (which are NOT HTML comments):

```javascript
export function stripHydrationMarkers(html) {
  return html
    .replace(/<!--lit-part [^>]+?-->/g, '')
    .replace(/<!--\/lit-part-->/g, '')
    .replace(/<!--lit-node \d+-->/g, '')
    .replace(/<!--lit-part-->/g, '')
    .replace(/<\?>/g, '');  // ← Fixed: was trying to match as HTML comment
}
```

### 2. Actual @lit-labs/ssr Output Quirks

Discovered several formatting quirks in @lit-labs/ssr output:

**Self-closing tags preserve `/` syntax:**
```javascript
// Input
html`<input type="text" />`

// Output
'<input type="text" />'  // NOT '<input type="text">'
```

**Boolean attributes leave trailing space when false:**
```javascript
// Input
html`<button ?disabled="${false}">Click</button>`

// Output
'<button >Click</button>'  // Note the trailing space
```

**Property bindings DO render as attributes:**
```javascript
// Input
html`<input .value="${'test'}" />`

// Output
'<input value="test" />'  // Property bindings render as attributes in SSR!
```

**ifDefined leaves trailing space:**
```javascript
// Input
html`<div title="${ifDefined(undefined)}">Content</div>`

// Output
'<div >Content</div>'  // Trailing space where attribute would be
```

**classMap adds leading/trailing spaces:**
```javascript
// Input
html`<div class="${classMap({ active: true, disabled: false })}">Content</div>`

// Output
'<div class=" active ">Content</div>'  // Leading and trailing spaces
```

### 3. Updated Test Expectations

All test expectations now match actual @lit-labs/ssr output:

```javascript
// Boolean false
assertHTMLEqual(stripped, '<button >Click</button>');

// Self-closing
assertHTMLEqual(stripped, '<input type="text" />');

// Property binding
assertHTMLEqual(stripped, '<input value="test-value" />');

// ifDefined undefined
assertHTMLEqual(stripped, '<div >Content</div>');

// classMap
assertHTMLEqual(stripped, '<div class=" active has-error ">Content</div>');
```

## Test Results

**All 122 baseline tests passing:**

```
ℹ tests 122
ℹ suites 37
ℹ pass 122
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 148.840996
```

## Benefits

1. **Full Output Validation**: Tests now verify complete HTML output, not just fragments
2. **Better Error Messages**: When tests fail, see full expected vs actual comparison
3. **Strategy Compliance**: Perfectly aligned with STRATEGY_TESTING.md requirements
4. **Future-Proof**: When implementing lit-edge, these tests will catch any output differences
5. **Documented Quirks**: Test expectations now document @lit-labs/ssr output behavior

## Implementation Guidelines for lit-edge

When implementing lit-edge, the tests document expected behavior:

1. **Preserve self-closing syntax**: `<input />` not `<input>`
2. **Handle attribute spacing**: Match @lit-labs/ssr's trailing/leading spaces
3. **Property bindings**: Convert to attributes in SSR (e.g., `.value` → `value=""`)
4. **classMap spacing**: Leading and trailing spaces in class list
5. **Boolean attributes**: Trailing space when attribute is omitted

## Summary

The refactoring successfully transformed all baseline tests from partial matching to full HTML comparison using `assertHTMLEqual()`. This provides:

- ✅ Complete output validation
- ✅ Better test failure diagnostics
- ✅ Perfect alignment with testing strategy
- ✅ Documentation of @lit-labs/ssr output quirks
- ✅ All 122 tests passing

The test suite is now ready to serve as the baseline for lit-edge implementation.
