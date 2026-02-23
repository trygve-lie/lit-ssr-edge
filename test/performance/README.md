# Performance Testing

This directory contains performance benchmarks and profiling tools for measuring rendering performance and memory usage.

## Overview

The performance test suite measures:

- **Rendering Performance**: Time to render various template types
- **Memory Usage**: Heap and RSS consumption during rendering
- **Throughput**: Operations per second for different scenarios
- **Statistical Analysis**: Mean, median, P95, P99, standard deviation

## Running Performance Tests

### Benchmark @lit-labs/ssr (Baseline)

```bash
npm run perf
```

This runs the complete benchmark suite against `@lit-labs/ssr` and saves results to a timestamped JSON file.

### Benchmark lit-edge

```bash
npm run perf:lit-edge
```

Runs benchmarks against lit-edge implementation (once implemented).

### Memory Profiling

```bash
npm run perf:memory
```

Profiles memory usage for `@lit-labs/ssr`:
- Heap memory consumption
- RSS (Resident Set Size)
- Per-operation memory allocation

```bash
npm run perf:memory:lit-edge
```

Profiles memory usage for lit-edge.

### Comparing Results

```bash
npm run perf:compare benchmark-lit-ssr-1234.json benchmark-lit-edge-5678.json
```

Compares two benchmark result files and shows:
- Performance differences
- Relative speedup/slowdown
- Statistical comparison

## Benchmark Categories

### 1. Simple Template Rendering

- Plain text
- String interpolation
- Number interpolation
- Multiple interpolations

**Why?** Establishes baseline overhead for SSR machinery.

### 2. HTML Structure Rendering

- Simple div
- Nested elements (3 levels)
- Nested elements (5 levels)

**Why?** Measures impact of DOM tree depth on rendering performance.

### 3. Attribute Rendering

- Static attributes
- Dynamic attributes
- Boolean attributes

**Why?** Attributes are common and need efficient rendering.

### 4. List Rendering

**Small lists (10 items):**
- array.map
- map directive
- repeat directive

**Medium lists (100 items):**
- array.map
- map directive

**Large lists (1000 items):**
- array.map
- map directive

**Why?** Lists are performance-critical. Tests different approaches and scales.

### 5. Directive Performance

- when directive
- classMap directive

**Why?** Directives add abstraction overhead; need to quantify it.

### 6. Component Rendering

- Simple component (no props)
- Component with properties
- Card component with slots
- Component with various property types
- Nested components

**Why?** Components are the primary abstraction; performance matters.

### 7. Complex Scenarios

- Mixed content (lists + directives + nesting)
- Component lists

**Why?** Real-world usage combines multiple features.

## Benchmark Output

### Console Output

```
============================================================
PERFORMANCE BENCHMARK RESULTS
============================================================

Benchmark                                |         Mean |       Median |          P95 |     Throughput
------------------------------------------------------------------------------------------------------------------------
Simple text                              |    0.123ms |    0.120ms |    0.145ms |    8130 ops/s
String interpolation                     |    0.145ms |    0.142ms |    0.168ms |    6897 ops/s
...
```

### JSON Output Format

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "implementation": "lit-ssr",
  "nodeVersion": "v20.10.0",
  "platform": "linux",
  "arch": "x64",
  "results": [
    {
      "name": "Simple text",
      "iterations": 5000,
      "totalDuration": 615.234,
      "statistics": {
        "mean": 0.123,
        "median": 0.120,
        "min": 0.098,
        "max": 2.345,
        "p95": 0.145,
        "p99": 0.189,
        "stdDev": 0.023
      },
      "throughput": {
        "opsPerSec": 8130
      }
    }
  ]
}
```

## Memory Profiling Output

```
📊 Profiling: Simple text template
--------------------------------------------------------------------------------
Before:  Heap Used: 12.45 MB, RSS: 45.23 MB
After:   Heap Used: 13.78 MB, RSS: 46.12 MB
Change:  Heap Used: 1.33 MB, RSS: 0.89 MB
Per op:  Heap Used: 0.00027 MB, RSS: 0.00018 MB
```

## Interpreting Results

### Good Performance Indicators

- **Low mean time**: Faster rendering
- **Low standard deviation**: Consistent performance
- **Small P95-mean gap**: Few outliers
- **High ops/sec**: Good throughput

### Performance Goals

Based on testing, lit-edge should target:

- **2x or better**: Acceptable (within same order of magnitude)
- **1x to 1.5x**: Good (competitive)
- **< 1x**: Excellent (faster than baseline)

### Memory Goals

- **Per-operation overhead**: < 10 KB heap per simple template
- **Scaling**: Linear with template complexity
- **No leaks**: Stable memory after GC

## Continuous Performance Monitoring

### Workflow

1. **Establish baseline** (Phase 1):
   ```bash
   npm run perf
   # Save: benchmark-lit-ssr-baseline.json
   ```

2. **Implement feature** (Phase 2+):
   ```bash
   # Implement lit-edge code
   ```

3. **Benchmark implementation**:
   ```bash
   npm run perf:lit-edge
   # Creates: benchmark-lit-edge-1234.json
   ```

4. **Compare results**:
   ```bash
   npm run perf:compare benchmark-lit-ssr-baseline.json benchmark-lit-edge-1234.json
   ```

5. **Optimize if needed**:
   - Identify slow operations
   - Profile with `--inspect`
   - Refactor hot paths
   - Re-benchmark

### CI Integration

Add to `.github/workflows/performance.yml`:

```yaml
name: Performance

on:
  pull_request:
    branches: [main]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run perf:lit-edge
      - run: npm run perf:compare baseline.json benchmark-lit-edge-*.json
```

## Advanced Profiling

### CPU Profiling

```bash
node --inspect --inspect-brk test/performance/render-performance.js
```

Then open `chrome://inspect` in Chrome and start profiling.

### Flame Graphs

```bash
node --prof test/performance/render-performance.js
node --prof-process isolate-*.log > profile.txt
```

Or use `0x` for interactive flame graphs:

```bash
npx 0x test/performance/render-performance.js
```

### Memory Snapshots

```bash
node --inspect test/performance/memory-profile.js
```

Take heap snapshots in Chrome DevTools to identify memory leaks.

## Optimization Strategies

Based on profiling, common optimization targets:

1. **Template compilation**: Cache opcode generation
2. **String concatenation**: Use array join instead of +=
3. **Directive overhead**: Inline hot paths
4. **Object allocation**: Reuse objects where safe
5. **Async overhead**: Minimize promise creation

## References

- [Node.js Performance Measurement APIs](https://nodejs.org/api/perf_hooks.html)
- [V8 Performance Profiling](https://v8.dev/docs/profile)
- [Flame Graph Visualization](https://www.brendangregg.com/flamegraphs.html)
