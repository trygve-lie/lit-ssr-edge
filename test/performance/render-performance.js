/**
 * Render performance benchmarks
 *
 * Measures rendering performance for various template types and complexity levels.
 * Run with: TEST_IMPL=lit-ssr node test/performance/render-performance.js
 */

import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRenderer } from '../helpers/renderer.js';
import { benchmark, printResults, saveResults } from './benchmark.js';

// Import test fixtures
import '../fixtures/simple-greeting.js';
import '../fixtures/card-component.js';
import '../fixtures/property-types.js';

const renderer = createRenderer();

/**
 * Run all render performance benchmarks
 */
async function runBenchmarks() {
  const results = [];

  console.log('\n🚀 Starting render performance benchmarks...\n');
  console.log(`Implementation: ${process.env.TEST_IMPL || 'lit-ssr-edge'}`);
  console.log(`Node version: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}\n`);

  // =====================================================
  // Simple Template Rendering
  // =====================================================

  results.push(await benchmark(
    'Simple text',
    () => renderer.renderToString(html`Hello, World!`),
    { iterations: 5000 }
  ));

  results.push(await benchmark(
    'String interpolation',
    () => renderer.renderToString(html`Hello, ${'Alice'}!`),
    { iterations: 5000 }
  ));

  results.push(await benchmark(
    'Number interpolation',
    () => renderer.renderToString(html`Count: ${42}`),
    { iterations: 5000 }
  ));

  results.push(await benchmark(
    'Multiple interpolations',
    () => {
      const name = 'Bob';
      const age = 30;
      const city = 'New York';
      return renderer.renderToString(
        html`Name: ${name}, Age: ${age}, City: ${city}`
      );
    },
    { iterations: 5000 }
  ));

  // =====================================================
  // HTML Structure Rendering
  // =====================================================

  results.push(await benchmark(
    'Simple div',
    () => renderer.renderToString(html`<div>Content</div>`),
    { iterations: 5000 }
  ));

  results.push(await benchmark(
    'Nested elements (3 levels)',
    () => renderer.renderToString(html`
      <div>
        <section>
          <article>
            <p>Content</p>
          </article>
        </section>
      </div>
    `),
    { iterations: 3000 }
  ));

  results.push(await benchmark(
    'Nested elements (5 levels)',
    () => renderer.renderToString(html`
      <div>
        <section>
          <article>
            <header>
              <h1>Title</h1>
            </header>
          </article>
        </section>
      </div>
    `),
    { iterations: 3000 }
  ));

  // =====================================================
  // Attribute Rendering
  // =====================================================

  results.push(await benchmark(
    'Element with attributes',
    () => renderer.renderToString(
      html`<div id="test" class="container" data-value="123">Content</div>`
    ),
    { iterations: 5000 }
  ));

  results.push(await benchmark(
    'Dynamic attributes',
    () => {
      const id = 'dynamic-id';
      const className = 'my-class';
      return renderer.renderToString(
        html`<div id="${id}" class="${className}">Content</div>`
      );
    },
    { iterations: 5000 }
  ));

  results.push(await benchmark(
    'Boolean attributes',
    () => renderer.renderToString(
      html`<button ?disabled="${true}" ?hidden="${false}">Click</button>`
    ),
    { iterations: 5000 }
  ));

  // =====================================================
  // List Rendering (Small)
  // =====================================================

  results.push(await benchmark(
    'List: 10 items (array.map)',
    () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      return renderer.renderToString(
        html`<ul>${items.map(i => html`<li>Item ${i}</li>`)}</ul>`
      );
    },
    { iterations: 2000 }
  ));

  results.push(await benchmark(
    'List: 10 items (map directive)',
    () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      return renderer.renderToString(
        html`<ul>${map(items, i => html`<li>Item ${i}</li>`)}</ul>`
      );
    },
    { iterations: 2000 }
  ));

  results.push(await benchmark(
    'List: 10 items (repeat directive)',
    () => {
      const items = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      return renderer.renderToString(
        html`<ul>${repeat(items, i => i.id, i => html`<li>${i.name}</li>`)}</ul>`
      );
    },
    { iterations: 2000 }
  ));

  // =====================================================
  // List Rendering (Medium)
  // =====================================================

  results.push(await benchmark(
    'List: 100 items (array.map)',
    () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      return renderer.renderToString(
        html`<ul>${items.map(i => html`<li>Item ${i}</li>`)}</ul>`
      );
    },
    { iterations: 500 }
  ));

  results.push(await benchmark(
    'List: 100 items (map directive)',
    () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      return renderer.renderToString(
        html`<ul>${map(items, i => html`<li>Item ${i}</li>`)}</ul>`
      );
    },
    { iterations: 500 }
  ));

  // =====================================================
  // List Rendering (Large)
  // =====================================================

  results.push(await benchmark(
    'List: 1000 items (array.map)',
    () => {
      const items = Array.from({ length: 1000 }, (_, i) => i);
      return renderer.renderToString(
        html`<ul>${items.map(i => html`<li>Item ${i}</li>`)}</ul>`
      );
    },
    { iterations: 100 }
  ));

  results.push(await benchmark(
    'List: 1000 items (map directive)',
    () => {
      const items = Array.from({ length: 1000 }, (_, i) => i);
      return renderer.renderToString(
        html`<ul>${map(items, i => html`<li>Item ${i}</li>`)}</ul>`
      );
    },
    { iterations: 100 }
  ));

  // =====================================================
  // Directive Performance
  // =====================================================

  results.push(await benchmark(
    'when directive (true)',
    () => renderer.renderToString(
      html`${when(true, () => html`<div>Shown</div>`, () => html`<div>Hidden</div>`)}`
    ),
    { iterations: 3000 }
  ));

  results.push(await benchmark(
    'classMap directive',
    () => {
      const classes = { active: true, disabled: false, 'has-error': true };
      return renderer.renderToString(
        html`<div class="${classMap(classes)}">Content</div>`
      );
    },
    { iterations: 3000 }
  ));

  // =====================================================
  // Component Rendering
  // =====================================================

  results.push(await benchmark(
    'Component: simple-greeting',
    () => renderer.renderToString(html`<simple-greeting></simple-greeting>`),
    { iterations: 1000 }
  ));

  results.push(await benchmark(
    'Component: simple-greeting with props',
    () => renderer.renderToString(html`<simple-greeting name="Alice"></simple-greeting>`),
    { iterations: 1000 }
  ));

  results.push(await benchmark(
    'Component: card-component',
    () => renderer.renderToString(html`
      <card-component title="Test Card">
        <p>Content</p>
      </card-component>
    `),
    { iterations: 1000 }
  ));

  results.push(await benchmark(
    'Component: property-types',
    () => renderer.renderToString(html`
      <property-types
        stringProp="test"
        numberProp="42"
        ?booleanProp="${true}">
      </property-types>
    `),
    { iterations: 1000 }
  ));

  results.push(await benchmark(
    'Component: nested components',
    () => renderer.renderToString(html`
      <card-component title="Parent">
        <simple-greeting name="Child"></simple-greeting>
      </card-component>
    `),
    { iterations: 800 }
  ));

  // =====================================================
  // Complex Scenarios
  // =====================================================

  results.push(await benchmark(
    'Complex: mixed content',
    () => {
      const items = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        title: `Item ${i}`,
        active: i % 2 === 0
      }));

      return renderer.renderToString(html`
        <div class="container">
          <header>
            <h1>List</h1>
          </header>
          <ul>
            ${map(items, item => html`
              <li class="${classMap({ active: item.active })}">${item.title}</li>
            `)}
          </ul>
        </div>
      `);
    },
    { iterations: 500 }
  ));

  results.push(await benchmark(
    'Complex: component list',
    () => {
      const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
      return renderer.renderToString(html`
        <div>
          ${map(names, name => html`
            <simple-greeting name="${name}"></simple-greeting>
          `)}
        </div>
      `);
    },
    { iterations: 300 }
  ));

  // Print and save results
  printResults(results);

  const implementation = process.env.TEST_IMPL || 'lit-ssr-edge';
  const filename = `benchmark-${implementation}-${Date.now()}.json`;
  await saveResults(results, filename);

  console.log('\n✅ Benchmarks complete!\n');
}

// Run benchmarks
runBenchmarks().catch(console.error);
