/**
 * Performance benchmark utilities
 *
 * Provides functions for running performance benchmarks with proper warmup,
 * statistical analysis, and result formatting.
 */

import { performance } from 'node:perf_hooks';

/**
 * Runs a benchmark with warmup and statistical analysis
 *
 * @param {string} name - Benchmark name
 * @param {Function} fn - Function to benchmark (async or sync)
 * @param {Object} options - Benchmark options
 * @param {number} options.iterations - Number of iterations (default: 1000)
 * @param {number} options.warmup - Number of warmup iterations (default: 10)
 * @returns {Promise<BenchmarkResult>} Benchmark results with statistics
 */
export async function benchmark(name, fn, options = {}) {
  const {
    iterations = 1000,
    warmup = 10
  } = options;

  // Warmup phase
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Measurement phase
  const measurements = [];
  const startTotal = performance.now();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    measurements.push(end - start);
  }

  const endTotal = performance.now();
  const totalDuration = endTotal - startTotal;

  // Calculate statistics
  const sorted = measurements.sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / iterations;
  const median = sorted[Math.floor(iterations / 2)];
  const min = sorted[0];
  const max = sorted[iterations - 1];
  const p95 = sorted[Math.floor(iterations * 0.95)];
  const p99 = sorted[Math.floor(iterations * 0.99)];

  // Standard deviation
  const variance = measurements.reduce((acc, val) => {
    return acc + Math.pow(val - mean, 2);
  }, 0) / iterations;
  const stdDev = Math.sqrt(variance);

  // Operations per second
  const opsPerSec = 1000 / mean;

  return {
    name,
    iterations,
    totalDuration,
    mean,
    median,
    min,
    max,
    p95,
    p99,
    stdDev,
    opsPerSec
  };
}

/**
 * Formats benchmark results as a table row
 *
 * @param {BenchmarkResult} result - Benchmark result
 * @returns {string} Formatted result string
 */
export function formatResult(result) {
  return [
    result.name.padEnd(40),
    `${result.mean.toFixed(3)}ms`.padStart(12),
    `${result.median.toFixed(3)}ms`.padStart(12),
    `${result.p95.toFixed(3)}ms`.padStart(12),
    `${result.opsPerSec.toFixed(0)} ops/s`.padStart(15)
  ].join(' | ');
}

/**
 * Prints benchmark results as a formatted table
 *
 * @param {BenchmarkResult[]} results - Array of benchmark results
 */
export function printResults(results) {
  console.log('\n' + '='.repeat(120));
  console.log('PERFORMANCE BENCHMARK RESULTS');
  console.log('='.repeat(120));
  console.log();

  // Header
  const header = [
    'Benchmark'.padEnd(40),
    'Mean'.padStart(12),
    'Median'.padStart(12),
    'P95'.padStart(12),
    'Throughput'.padStart(15)
  ].join(' | ');

  console.log(header);
  console.log('-'.repeat(120));

  // Results
  for (const result of results) {
    console.log(formatResult(result));
  }

  console.log('='.repeat(120));
  console.log();

  // Summary statistics
  console.log('SUMMARY STATISTICS');
  console.log('-'.repeat(120));

  for (const result of results) {
    console.log(`\n${result.name}:`);
    console.log(`  Iterations:    ${result.iterations}`);
    console.log(`  Total time:    ${result.totalDuration.toFixed(2)}ms`);
    console.log(`  Mean:          ${result.mean.toFixed(3)}ms`);
    console.log(`  Median:        ${result.median.toFixed(3)}ms`);
    console.log(`  Min:           ${result.min.toFixed(3)}ms`);
    console.log(`  Max:           ${result.max.toFixed(3)}ms`);
    console.log(`  P95:           ${result.p95.toFixed(3)}ms`);
    console.log(`  P99:           ${result.p99.toFixed(3)}ms`);
    console.log(`  Std Dev:       ${result.stdDev.toFixed(3)}ms`);
    console.log(`  Throughput:    ${result.opsPerSec.toFixed(0)} ops/s`);
  }

  console.log('\n' + '='.repeat(120) + '\n');
}

/**
 * Saves benchmark results to JSON file
 *
 * @param {BenchmarkResult[]} results - Array of benchmark results
 * @param {string} filename - Output filename
 */
export async function saveResults(results, filename) {
  const fs = await import('node:fs/promises');

  const output = {
    timestamp: new Date().toISOString(),
    implementation: process.env.TEST_IMPL || 'lit-ssr-edge',
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    results: results.map(r => ({
      name: r.name,
      iterations: r.iterations,
      totalDuration: r.totalDuration,
      statistics: {
        mean: r.mean,
        median: r.median,
        min: r.min,
        max: r.max,
        p95: r.p95,
        p99: r.p99,
        stdDev: r.stdDev
      },
      throughput: {
        opsPerSec: r.opsPerSec
      }
    }))
  };

  await fs.writeFile(filename, JSON.stringify(output, null, 2));
  console.log(`Results saved to ${filename}`);
}

/**
 * Compares two benchmark result files
 *
 * @param {string} baselineFile - Baseline results file
 * @param {string} currentFile - Current results file
 */
export async function compareResults(baselineFile, currentFile) {
  const fs = await import('node:fs/promises');

  const baseline = JSON.parse(await fs.readFile(baselineFile, 'utf-8'));
  const current = JSON.parse(await fs.readFile(currentFile, 'utf-8'));

  console.log('\n' + '='.repeat(120));
  console.log('PERFORMANCE COMPARISON');
  console.log('='.repeat(120));
  console.log();
  console.log(`Baseline: ${baseline.implementation} (${baseline.timestamp})`);
  console.log(`Current:  ${current.implementation} (${current.timestamp})`);
  console.log();

  // Header
  const header = [
    'Benchmark'.padEnd(40),
    'Baseline'.padStart(12),
    'Current'.padStart(12),
    'Change'.padStart(12),
    'Ratio'.padStart(10)
  ].join(' | ');

  console.log(header);
  console.log('-'.repeat(120));

  // Compare each benchmark
  for (const baseResult of baseline.results) {
    const currResult = current.results.find(r => r.name === baseResult.name);

    if (!currResult) {
      console.log(`${baseResult.name.padEnd(40)} | MISSING IN CURRENT`);
      continue;
    }

    const baselineMean = baseResult.statistics.mean;
    const currentMean = currResult.statistics.mean;
    const change = currentMean - baselineMean;
    const ratio = currentMean / baselineMean;
    const changePercent = ((ratio - 1) * 100).toFixed(1);

    const changeStr = change >= 0
      ? `+${change.toFixed(3)}ms (${changePercent >= 0 ? '+' : ''}${changePercent}%)`
      : `${change.toFixed(3)}ms (${changePercent}%)`;

    const ratioStr = `${ratio.toFixed(2)}x`;

    console.log([
      baseResult.name.padEnd(40),
      `${baselineMean.toFixed(3)}ms`.padStart(12),
      `${currentMean.toFixed(3)}ms`.padStart(12),
      changeStr.padStart(12),
      ratioStr.padStart(10)
    ].join(' | '));
  }

  console.log('='.repeat(120) + '\n');
}
