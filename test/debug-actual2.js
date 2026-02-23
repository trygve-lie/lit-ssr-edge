import { html } from 'lit';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';

function stripHydrationMarkers(html) {
  return html
    .replace(/<!--lit-part [^>]+?-->/g, '')
    .replace(/<!--\/lit-part-->/g, '')
    .replace(/<!--lit-node \d+-->/g, '')
    .replace(/<!--lit-part-->/g, '')
    .replace(/<\?>/g, '');
}

// Test 1: boolean false
const disabled = false;
const template1 = html`<button ?disabled="${disabled}">Click</button>`;
const result1 = await collectResult(render(template1));
console.log('Boolean false:');
console.log('[' + stripHydrationMarkers(result1) + ']');
console.log('');

// Test 2: property binding
const value = 'test-value';
const template2 = html`<input .value="${value}" />`;
const result2 = await collectResult(render(template2));
console.log('Property binding:');
console.log('[' + stripHydrationMarkers(result2) + ']');
console.log('');

// Test 3: ifDefined undefined
const title = undefined;
const template3 = html`<div title="${ifDefined(title)}">Content</div>`;
const result3 = await collectResult(render(template3));
console.log('ifDefined undefined:');
console.log('[' + stripHydrationMarkers(result3) + ']');
console.log('');

// Test 4: classMap
const classes = {
  active: true,
  disabled: false,
  'has-error': true
};
const template4 = html`<div class="${classMap(classes)}">Content</div>`;
const result4 = await collectResult(render(template4));
console.log('classMap:');
console.log('[' + stripHydrationMarkers(result4) + ']');
