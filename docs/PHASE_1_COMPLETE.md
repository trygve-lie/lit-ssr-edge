# Phase 1 Complete: Baseline Performance Tests

**Status:** ✅ Complete
**Date:** February 23, 2026
**Implementation Tested:** @lit-labs/ssr v4.0.0
**Node Version:** v24.13.0
**Platform:** Linux x64

---

## Overview

Phase 1 established comprehensive performance baselines for @lit-labs/ssr before implementing lit-ssr-edge. This provides quantitative targets for the lit-ssr-edge implementation to match or exceed.

## Deliverables

### ✅ 1. Performance Benchmark Suite

**Location:** `test/performance/render-performance.js`

**Features:**
- 26 distinct benchmarks covering all rendering scenarios
- Statistical analysis (mean, median, P95, P99, std dev)
- Throughput measurement (ops/sec)
- Warmup phase for JIT optimization
- JSON output for comparison

**Coverage:**
- Simple templates (text, interpolation)
- HTML structure (nested elements)
- Attributes (static, dynamic, boolean)
- Lists (10, 100, 1000 items)
- Directives (when, classMap, map, repeat)
- Components (simple, with props, nested)
- Complex scenarios (mixed content)

### ✅ 2. Memory Profiling Suite

**Location:** `test/performance/memory-profile.js`

**Features:**
- Heap memory tracking
- RSS (Resident Set Size) measurement
- Per-operation allocation analysis
- Garbage collection integration
- JSON output for tracking

### ✅ 3. Benchmark Utilities

**Location:** `test/performance/benchmark.js`

**Utilities:**
- `benchmark()` - Run benchmarks with statistics
- `formatResult()` - Format results for display
- `printResults()` - Pretty-print results table
- `saveResults()` - Save to JSON
- `compareResults()` - Compare two benchmark runs

### ✅ 4. Comparison Tools

**Location:** `test/performance/compare.js`

Compares two benchmark result files showing:
- Absolute time differences
- Relative performance (ratio)
- Percentage change

### ✅ 5. Documentation

**Location:** `test/performance/README.md`

Comprehensive guide covering:
- How to run benchmarks
- How to interpret results
- Performance goals
- CI integration
- Advanced profiling techniques

---

## Baseline Performance Results

### Key Findings

**@lit-labs/ssr Performance (Node.js v24.13.0):**

#### Simple Operations (very fast ⚡)
- **Simple text:** 0.008ms (117,758 ops/s)
- **String interpolation:** 0.008ms (123,785 ops/s)
- **Number interpolation:** 0.007ms (150,218 ops/s)
- **Simple div:** 0.006ms (158,356 ops/s)

#### Attributes (very fast ⚡)
- **Static attributes:** 0.007ms (147,560 ops/s)
- **Dynamic attributes:** 0.011ms (90,148 ops/s)
- **Boolean attributes:** 0.009ms (106,512 ops/s)

#### Lists (varies with size)
- **10 items (array.map):** 0.018ms (56,737 ops/s)
- **10 items (map directive):** 0.014ms (71,189 ops/s)
- **100 items:** 0.064ms (15,562 ops/s)
- **1000 items:** 0.625ms (1,601 ops/s)

#### Directives (fast ⚡)
- **when directive:** 0.007ms (143,638 ops/s)
- **classMap directive:** 0.008ms (123,291 ops/s)

#### Components (moderate speed)
- **simple-greeting:** 0.014ms (71,636 ops/s)
- **simple-greeting with props:** 0.014ms (73,776 ops/s)
- **card-component:** 0.016ms (63,319 ops/s)
- **property-types:** 0.027ms (37,325 ops/s)
- **nested components:** 0.019ms (53,253 ops/s)

#### Complex Scenarios
- **Mixed content:** 0.055ms (18,133 ops/s)
- **Component list:** 0.036ms (27,760 ops/s)

### Memory Characteristics

**Per-Operation Memory Usage:**

- **Simple templates:** < 0.01 MB heap per operation
- **String interpolation:** < 0.01 MB heap per operation
- **Nested elements:** < 0.01 MB heap per operation
- **List (10 items):** < 0.01 MB heap per operation
- **List (100 items):** 0.00 MB heap, 0.02 MB RSS per operation
- **List (1000 items):** 0.01 MB heap, 0.18 MB RSS per operation
- **Components:** < 0.01 MB heap per operation

**Observation:** Memory usage scales linearly with template complexity. No evidence of memory leaks after GC.

---

## Performance Targets for lit-ssr-edge

Based on the baseline results, lit-ssr-edge should target:

### Tier 1 - Critical Performance (must match or exceed)

These operations are core primitives and must be as fast or faster:

- ✅ **Simple text rendering:** < 0.010ms (> 100,000 ops/s)
- ✅ **String interpolation:** < 0.010ms (> 100,000 ops/s)
- ✅ **HTML structure:** < 0.008ms (> 125,000 ops/s)
- ✅ **Static attributes:** < 0.008ms (> 125,000 ops/s)

### Tier 2 - Important Performance (within 1.5x)

These operations are common and should be competitive:

- ✅ **Dynamic attributes:** < 0.017ms (> 60,000 ops/s)
- ✅ **Boolean attributes:** < 0.014ms (> 70,000 ops/s)
- ✅ **Small lists (10 items):** < 0.027ms (> 37,000 ops/s)
- ✅ **Directives (when, classMap):** < 0.012ms (> 80,000 ops/s)

### Tier 3 - Acceptable Performance (within 2x)

These operations are less frequent and can have more overhead:

- ✅ **Medium lists (100 items):** < 0.128ms (> 7,800 ops/s)
- ✅ **Large lists (1000 items):** < 1.250ms (> 800 ops/s)
- ✅ **Simple components:** < 0.028ms (> 35,000 ops/s)
- ✅ **Complex components:** < 0.054ms (> 18,500 ops/s)
- ✅ **Nested components:** < 0.038ms (> 26,000 ops/s)

### Memory Targets

- **Heap overhead:** < 0.02 MB per simple operation
- **RSS overhead:** < 0.20 MB per 1000-item list
- **No memory leaks:** Stable memory after GC
- **Scaling:** Linear with template complexity

---

## Scripts Added to package.json

```json
{
  "perf": "TEST_IMPL=lit-ssr node test/performance/render-performance.js",
  "perf:lit-ssr-edge": "TEST_IMPL=lit-ssr-edge node test/performance/render-performance.js",
  "perf:memory": "TEST_IMPL=lit-ssr node --expose-gc test/performance/memory-profile.js",
  "perf:memory:lit-ssr-edge": "TEST_IMPL=lit-ssr-edge node --expose-gc test/performance/memory-profile.js",
  "perf:compare": "node test/performance/compare.js"
}
```

---

## Saved Results

### Performance Benchmarks

**File:** `benchmark-lit-ssr-1771843102967.json` (13 KB)

Contains:
- Timestamp and environment info
- 26 benchmark results
- Full statistical analysis
- Throughput measurements

### Memory Profile

**File:** `memory-profile-lit-ssr-1771843121008.json`

Contains:
- Timestamp and environment info
- 9 memory profiling results
- Heap and RSS measurements
- Per-operation allocation data

---

## How to Use These Baselines

### During lit-ssr-edge Development

1. **Implement a feature** (e.g., template rendering)

2. **Run benchmark:**
   ```bash
   npm run perf:lit-ssr-edge
   ```

3. **Compare to baseline:**
   ```bash
   npm run perf:compare benchmark-lit-ssr-*.json benchmark-lit-ssr-edge-*.json
   ```

4. **Check if within targets:**
   - Tier 1: Must be as fast or faster
   - Tier 2: Within 1.5x is acceptable
   - Tier 3: Within 2x is acceptable

5. **Optimize if needed:**
   - Profile with `node --inspect`
   - Identify hot paths
   - Refactor and re-benchmark

### Example Comparison

```bash
npm run perf:compare benchmark-lit-ssr-1771843102967.json benchmark-lit-ssr-edge-XXXXX.json
```

Expected output:
```
PERFORMANCE COMPARISON
========================================================
Baseline: lit-ssr (2026-02-23T10:30:00.000Z)
Current:  lit-ssr-edge (2026-02-23T15:45:00.000Z)

Benchmark                                | Baseline | Current  | Change       | Ratio
--------------------------------------------------------------------------------------------
Simple text                              | 0.008ms  | 0.007ms  | -0.001ms (-12.5%) | 0.88x
String interpolation                     | 0.008ms  | 0.009ms  | +0.001ms (+12.5%) | 1.12x
...
```

---

## Statistical Insights

### Performance Distribution

**Observations from P95/P99 analysis:**

1. **Most operations are consistent:**
   - Small std dev (< 0.02ms for most operations)
   - P95 close to median (< 2x difference)
   - Few outliers

2. **Occasional spikes:**
   - Max values can be 10-50x higher than mean
   - Likely due to GC pauses or JIT compilation
   - P99 filters out most outliers

3. **List rendering scales linearly:**
   - 10 items: ~0.015ms
   - 100 items: ~0.065ms (6.5x)
   - 1000 items: ~0.600ms (60x)
   - Ratio: ~0.0006ms per item

### Component Overhead

**Component vs Template rendering:**

- **Template:** 0.006ms (simple div)
- **Component:** 0.014ms (simple-greeting)
- **Overhead:** ~0.008ms per component

This includes:
- Constructor call
- Property initialization
- Lifecycle methods (willUpdate, render, update)
- Shadow DOM serialization
- Style serialization

---

## Next Steps (Phase 2+)

With baseline established, proceed to:

### Phase 2: Core Rendering Implementation

Implement basic template rendering with targets:
- Simple text: > 100,000 ops/s (match baseline)
- String interpolation: > 100,000 ops/s (match baseline)
- HTML structure: > 125,000 ops/s (match baseline)

### Phase 3: Advanced Features

Implement directives and components with targets:
- Directives: Within 1.5x of baseline
- Components: Within 2x of baseline

### Phase 4: Optimization

Profile and optimize to:
- Meet all Tier 1 targets
- Meet most Tier 2 targets
- Minimize memory overhead

---

## Success Criteria

Phase 1 is successful if:

- ✅ Comprehensive benchmark suite created
- ✅ Baseline results documented
- ✅ Performance targets defined
- ✅ Comparison tools available
- ✅ Memory profiling established
- ✅ Documentation complete

**Status: ALL CRITERIA MET ✅**

---

## Conclusion

Phase 1 has successfully established quantitative performance baselines for @lit-labs/ssr. The benchmark suite, profiling tools, and documented targets provide a solid foundation for implementing and optimizing lit-ssr-edge.

Key achievements:
- 26 performance benchmarks covering all scenarios
- Memory profiling across template complexities
- Statistical analysis with P95/P99 metrics
- Clear performance targets (Tier 1/2/3)
- Automated comparison tools
- Comprehensive documentation

**Phase 1 Complete. Ready for Phase 2: Core Rendering Implementation.**
