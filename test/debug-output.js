/**
 * Debug script to inspect actual output from @lit-labs/ssr
 */
import { html } from 'lit';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';

// Import test fixture
import './fixtures/simple-greeting.js';

async function debugRender(template, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${label}`);
  console.log('='.repeat(60));

  const result = render(template);
  const html = await collectResult(result);

  console.log(html);
  console.log('='.repeat(60));

  return html;
}

// Test simple interpolation
await debugRender(
  html`Hello, ${' Alice'}!`,
  'String Interpolation'
);

// Test number
await debugRender(
  html`Count: ${42}`,
  'Number Interpolation'
);

// Test array
await debugRender(
  html`Items: ${['a', 'b', 'c']}`,
  'Array of Primitives'
);

// Test component
await debugRender(
  html`<simple-greeting name="Test"></simple-greeting>`,
  'Simple Component'
);

// Test list with map
import { map } from 'lit/directives/map.js';
await debugRender(
  html`<ul>${map(['Red', 'Green', 'Blue'], (item) => html`<li>${item}</li>`)}</ul>`,
  'List with Map Directive'
);
