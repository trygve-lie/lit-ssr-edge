/**
 * Memory profiling for render operations
 *
 * Measures memory consumption during rendering.
 * Run with: node --expose-gc test/performance/memory-profile.js
 */

import { html } from 'lit';
import { map } from 'lit/directives/map.js';
import { createRenderer } from '../helpers/renderer.js';

// Import test fixtures
import '../fixtures/simple-greeting.js';
import '../fixtures/card-component.js';

const renderer = createRenderer();

/**
 * Gets current memory usage
 */
function getMemoryUsage() {
  if (global.gc) {
    global.gc();
  }

  const usage = process.memoryUsage();
  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    rss: usage.rss
  };
}

/**
 * Formats bytes to human-readable format
 */
function formatBytes(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Profiles memory usage for a render operation
 */
async function profileMemory(name, fn, iterations = 1000) {
  console.log(`\n📊 Profiling: ${name}`);
  console.log('-'.repeat(80));

  // Force GC and get baseline
  if (global.gc) {
    global.gc();
  }
  const before = getMemoryUsage();

  console.log(`Before:  Heap Used: ${formatBytes(before.heapUsed)}, RSS: ${formatBytes(before.rss)}`);

  // Run iterations
  for (let i = 0; i < iterations; i++) {
    await fn();

    // Periodic GC to prevent buildup
    if (i % 100 === 0 && global.gc) {
      global.gc();
    }
  }

  // Force GC and measure
  if (global.gc) {
    global.gc();
  }
  const after = getMemoryUsage();

  console.log(`After:   Heap Used: ${formatBytes(after.heapUsed)}, RSS: ${formatBytes(after.rss)}`);

  const heapDiff = after.heapUsed - before.heapUsed;
  const rssDiff = after.rss - before.rss;

  console.log(`Change:  Heap Used: ${formatBytes(heapDiff)}, RSS: ${formatBytes(rssDiff)}`);
  console.log(`Per op:  Heap Used: ${formatBytes(heapDiff / iterations)}, RSS: ${formatBytes(rssDiff / iterations)}`);

  return {
    name,
    iterations,
    before,
    after,
    heapDiff,
    rssDiff,
    perOp: {
      heap: heapDiff / iterations,
      rss: rssDiff / iterations
    }
  };
}

/**
 * Run all memory profiling tests
 */
async function runMemoryProfiles() {
  console.log('\n🔍 Memory Profiling');
  console.log('='.repeat(80));
  console.log(`Implementation: ${process.env.TEST_IMPL || 'lit-edge'}`);
  console.log(`Node version: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);

  if (!global.gc) {
    console.log('\n⚠️  Warning: GC not exposed. Run with --expose-gc for accurate results.\n');
  }

  const results = [];

  // Simple template
  results.push(await profileMemory(
    'Simple text template',
    () => renderer.renderToString(html`Hello, World!`),
    5000
  ));

  // String interpolation
  results.push(await profileMemory(
    'String interpolation',
    () => renderer.renderToString(html`Hello, ${'Alice'}!`),
    5000
  ));

  // HTML structure
  results.push(await profileMemory(
    'Nested elements',
    () => renderer.renderToString(html`
      <div>
        <section>
          <article>
            <p>Content</p>
          </article>
        </section>
      </div>
    `),
    3000
  ));

  // Small list
  results.push(await profileMemory(
    'List: 10 items',
    () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      return renderer.renderToString(
        html`<ul>${map(items, i => html`<li>Item ${i}</li>`)}</ul>`
      );
    },
    1000
  ));

  // Medium list
  results.push(await profileMemory(
    'List: 100 items',
    () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      return renderer.renderToString(
        html`<ul>${map(items, i => html`<li>Item ${i}</li>`)}</ul>`
      );
    },
    200
  ));

  // Large list
  results.push(await profileMemory(
    'List: 1000 items',
    () => {
      const items = Array.from({ length: 1000 }, (_, i) => i);
      return renderer.renderToString(
        html`<ul>${map(items, i => html`<li>Item ${i}</li>`)}</ul>`
      );
    },
    50
  ));

  // Simple component
  results.push(await profileMemory(
    'Component: simple-greeting',
    () => renderer.renderToString(html`<simple-greeting></simple-greeting>`),
    1000
  ));

  // Component with props
  results.push(await profileMemory(
    'Component: with properties',
    () => renderer.renderToString(html`<simple-greeting name="Alice"></simple-greeting>`),
    1000
  ));

  // Nested components
  results.push(await profileMemory(
    'Component: nested',
    () => renderer.renderToString(html`
      <card-component title="Parent">
        <simple-greeting name="Child"></simple-greeting>
      </card-component>
    `),
    500
  ));

  // Summary
  console.log('\n\n📋 Summary');
  console.log('='.repeat(80));

  for (const result of results) {
    console.log(`\n${result.name}:`);
    console.log(`  Iterations: ${result.iterations}`);
    console.log(`  Per operation:`);
    console.log(`    Heap: ${formatBytes(result.perOp.heap)}`);
    console.log(`    RSS:  ${formatBytes(result.perOp.rss)}`);
  }

  // Save results
  const fs = await import('node:fs/promises');
  const implementation = process.env.TEST_IMPL || 'lit-edge';
  const filename = `memory-profile-${implementation}-${Date.now()}.json`;

  await fs.writeFile(filename, JSON.stringify({
    timestamp: new Date().toISOString(),
    implementation,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    results: results.map(r => ({
      name: r.name,
      iterations: r.iterations,
      heapDiff: r.heapDiff,
      rssDiff: r.rssDiff,
      perOp: r.perOp
    }))
  }, null, 2));

  console.log(`\n\n💾 Results saved to ${filename}\n`);
}

// Run profiling
runMemoryProfiles().catch(console.error);
