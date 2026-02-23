# Agent Guide: Working with lit-edge

**Purpose:** Help AI agents efficiently navigate this codebase and documentation.

---

## Quick Start

### You are here to...

**1. Implement a feature** → Start with:
   - Read `/docs/ARCHITECTURE.md` (implementation phases, decisions)
   - Read `/docs/QUICK_REFERENCE.md` (fast lookups)
   - Grep for related code: `grep -r "keyword" src/`

**2. Fix a bug** → Start with:
   - Read the failing test
   - Check `/docs/QUICK_REFERENCE.md` for relevant section
   - Read specific insight doc if needed

**3. Optimize performance** → Start with:
   - Read `/docs/PHASE_1_COMPLETE.md` (performance targets)
   - Run benchmarks: `npm run perf:lit-edge`
   - Profile: `node --inspect test/performance/...`

**4. Understand Lit internals** → Start with:
   - Read `/docs/QUICK_REFERENCE.md` (overview)
   - Read specific `/docs/insight/*.md` doc for deep dive

---

## Documentation Architecture

### Tier 1: Essential (Read These First)

**`AGENT.md`** (at repo root)
- Project overview
- Goals and non-goals
- Target runtimes
- Quick architecture overview

**`docs/QUICK_REFERENCE.md`** ← **START HERE**
- Fast lookups for common questions
- Common patterns
- Implementation checklist
- No need to read full insight docs

**`docs/ARCHITECTURE.md`**
- Implementation decisions
- Module structure
- Phase-by-phase implementation plan

### Tier 2: Phase Status (Check Progress)

**`docs/PHASE_0_ALIGNMENT.md`**
- Test alignment with strategy
- What was fixed

**`docs/PHASE_1_COMPLETE.md`**
- Performance baselines
- Targets for lit-edge
- Benchmark results

**`docs/STRATEGY_TESTING.md`**
- Testing strategy
- Assertion patterns
- Test categories

### Tier 3: Deep Knowledge (Read When Needed)

**`docs/insight/`** directory contains comprehensive research:

- **`README.md`** - Index of all insight docs
- **`lit-ssr-internals.md`** - Opcode system (MOST IMPORTANT for implementation)
- **`lit-hydration.md`** - Hydration markers and digest
- **`lit-html-core.md`** - Template system
- **`lit-reactive-element.md`** - Component lifecycle
- **`lit-directives.md`** - Directive system
- **`lit-styles.md`** - CSS handling
- **`lit-server-only-templates.md`** - Server-only html
- **`edge-runtimes.md`** - WinterTC compatibility
- **`node-dependencies.md`** - Dependency replacement

**⚠️ Token cost:** 500-1000 lines each. Only read when you need deep understanding.

---

## Efficient Navigation Strategies

### Strategy 1: Search First, Read Second

**Don't:** Read entire files looking for information

**Do:** Use grep/search to find relevant sections
```bash
grep -r "opcode" docs/insight/
grep -r "digest" docs/insight/
grep -n "DJB2" docs/insight/lit-hydration.md
```

Then read just that section with Read tool using offset/limit.

### Strategy 2: Quick Reference → Deep Dive

**Don't:** Start by reading all insight docs

**Do:** Check QUICK_REFERENCE.md first
- If answer is there: Done!
- If not: QUICK_REFERENCE tells you which insight doc to read
- Read just the relevant section of that doc

### Strategy 3: Code as Documentation

**Don't:** Read docs to understand implementation details

**Do:** Look at test fixtures and tests
```javascript
// test/fixtures/simple-greeting.js - Example component
// test/integration/baseline/*.test.js - Expected behavior
// test/performance/*.js - Performance patterns
```

Tests show exactly what behavior is expected.

### Strategy 4: Use Glob for Discovery

**Don't:** Assume file locations

**Do:** Use Glob to find files
```javascript
Glob({ pattern: "**/*opcode*.js" })
Glob({ pattern: "**/render*.js" })
Glob({ pattern: "test/**/*component*.test.js" })
```

---

## Common Tasks

### Task: Implement Template Rendering

1. **Read:** `/docs/QUICK_REFERENCE.md` → "SSR Opcode System"
2. **Deep dive:** `/docs/insight/lit-ssr-internals.md` (lines 150-350)
3. **Reference:** `test/integration/baseline/template-rendering.test.js`
4. **Implement:** Create `src/lib/render.js`
5. **Test:** `npm run test:baseline`

### Task: Implement Hydration Markers

1. **Read:** `/docs/QUICK_REFERENCE.md` → "Hydration System"
2. **Copy algorithm:** Digest calculation (DJB2) is in QUICK_REFERENCE
3. **Reference:** `test/integration/baseline/components.test.js`
4. **Implement:** Add to opcode executor
5. **Test:** Verify markers match @lit-labs/ssr format

### Task: Implement a Directive

1. **Read:** `/docs/QUICK_REFERENCE.md` → "Directives"
2. **Check:** Is it SSR-safe? (list in QUICK_REFERENCE)
3. **Reference:** `test/integration/baseline/directives.test.js`
4. **Deep dive:** `/docs/insight/lit-directives.md` if needed
5. **Implement:** Patch directive resolution
6. **Test:** Run directive tests

### Task: Optimize Performance

1. **Check targets:** `/docs/PHASE_1_COMPLETE.md`
2. **Benchmark current:** `npm run perf:lit-edge`
3. **Compare:** `npm run perf:compare baseline.json current.json`
4. **Profile:** `node --inspect test/performance/render-performance.js`
5. **Optimize hot paths**
6. **Re-benchmark**

---

## Testing Workflow

### Running Tests

```bash
# Run all baseline tests against @lit-labs/ssr
npm run test:baseline

# Run all tests against lit-edge (once implemented)
npm run test:lit-edge

# Run performance benchmarks
npm run perf:lit-edge

# Compare performance
npm run perf:compare baseline.json current.json
```

### Understanding Test Failures

When a test fails:

1. **Read the test file** - Shows expected behavior
2. **Check QUICK_REFERENCE** - Shows how feature should work
3. **Run single test** - `node --test test/path/to/test.js`
4. **Debug** - Add console.log or use `--inspect`

### Test Assertions

All tests use `assertHTMLEqual()` for full HTML comparison:

```javascript
const stripped = stripHydrationMarkers(result);
assertHTMLEqual(stripped, '<div>Expected HTML</div>');
```

**Don't use:** `assert.ok(result.includes(...))` (partial matching)
**Do use:** `assertHTMLEqual(actual, expected)` (full comparison)

---

## Implementation Phases (from ARCHITECTURE.md)

### ✅ Phase 0: Baseline Integration Tests
**Status:** Complete (122 tests passing)

### ✅ Phase 1: Baseline Performance Tests
**Status:** Complete (26 benchmarks, targets defined)

### ⏳ Phase 2: Core Rendering (NEXT)
**Implement:**
- Template parsing → opcodes
- Opcode execution
- Text rendering
- Child parts (dynamic values)
- HTML escaping
- Web Streams output

**Targets:**
- Simple text: > 100,000 ops/s
- String interpolation: > 100,000 ops/s
- HTML structure: > 125,000 ops/s

### ⏳ Phase 3: Attributes & Directives
- Attribute rendering
- Boolean attributes
- Directive resolution
- SSR-safe directives

### ⏳ Phase 4: Components
- Component detection
- Lifecycle execution
- Shadow DOM generation
- Style serialization

### ⏳ Phase 5: Server-Only Templates
- Detect server-only mode
- Skip hydration markers
- Full document support

### ⏳ Phase 6: Optimization
- Profile and optimize
- Meet all performance targets
- Memory optimization

---

## Key Principles

### 1. WinterTC-Only APIs

**Always check:** Am I using only WinterTC APIs?

```javascript
// ✅ Good - Web Platform APIs
new ReadableStream()
new TextEncoder()
fetch()
URL

// ❌ Bad - Node.js-specific
require()
fs.readFile()
stream.Readable
Buffer
```

### 2. Match @lit-labs/ssr Output

**Always verify:** Does output match @lit-labs/ssr exactly?

```bash
# Generate reference output
echo 'console.log(result)' | node

# Compare to lit-edge output
npm run test:baseline
```

### 3. Performance Targets

**Always check:** Am I meeting performance targets?

```bash
npm run perf:lit-edge
npm run perf:compare baseline.json current.json
```

Tier 1 operations MUST match baseline speed.

### 4. Full HTML Comparison

**Always test:** Use full HTML comparison, not partial.

```javascript
// ✅ Good
assertHTMLEqual(stripped, '<div>Hello</div>');

// ❌ Bad
assert.ok(result.includes('Hello'));
```

---

## Code Patterns to Follow

### Module Structure

```javascript
// src/lib/render.js
export function render(value, options = {}) {
  // Implementation
}
```

### Renderer Abstraction (for tests)

```javascript
// test/helpers/renderer.js
class LitEdgeRenderer extends Renderer {
  async renderToString(template) {
    const { render, collectResult } = await import('../../src/index.js');
    return await collectResult(render(template));
  }
}
```

### Web Streams Output

```javascript
// src/lib/render-stream.js
export class RenderResultReadable {
  #stream;

  constructor(result) {
    this.#stream = new ReadableStream({
      async pull(controller) {
        // Emit chunks
        controller.enqueue(encoder.encode(chunk));
      }
    });
  }

  getStream() {
    return this.#stream;
  }
}
```

---

## Common Mistakes to Avoid

### ❌ Using Node.js APIs
```javascript
// Don't:
const fs = require('fs');
const stream = require('stream');
```

### ❌ Reading Entire Insight Docs
```javascript
// Don't:
Read({ file_path: "/docs/insight/lit-ssr-internals.md" })

// Do:
Read({ file_path: "/docs/QUICK_REFERENCE.md" })
// Then if needed:
Read({ file_path: "/docs/insight/lit-ssr-internals.md", offset: 150, limit: 200 })
```

### ❌ Partial Test Assertions
```javascript
// Don't:
assert.ok(result.includes('expected'));

// Do:
assertHTMLEqual(result, '<div>expected</div>');
```

### ❌ Implementing Without Tests
```javascript
// Don't: Write implementation then tests
// Do: Tests already exist! Just make them pass.
```

---

## Getting Help

### When Stuck

1. **Check QUICK_REFERENCE** - Most questions answered here
2. **Search insight docs** - Use grep to find relevant sections
3. **Read tests** - They show expected behavior
4. **Run benchmarks** - Compare to baseline
5. **Check baseline output** - Debug with actual @lit-labs/ssr output

### Debug Commands

```bash
# See actual @lit-labs/ssr output
node test/debug-output.js

# Run single test
node --test test/integration/baseline/template-rendering.test.js

# Profile performance
node --inspect test/performance/render-performance.js

# Check memory
node --expose-gc test/performance/memory-profile.js
```

---

## Success Checklist

Before moving to next phase:

- [ ] All baseline tests passing
- [ ] Performance targets met (check tier)
- [ ] Only WinterTC APIs used
- [ ] Full HTML comparison in tests
- [ ] Memory usage acceptable
- [ ] Documentation updated

---

**Remember:**
- Start with QUICK_REFERENCE.md
- Use grep to find, Read to learn
- Tests show expected behavior
- Benchmark everything
- Match @lit-labs/ssr exactly

Good luck! 🚀
