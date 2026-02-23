/**
 * Debug actual output to see what we're getting
 */
import { html } from 'lit';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';

// Test 1: quotes in text content
const text = 'Say "Hello"';
const template1 = html`${text}`;
const result1 = render(template1);
const html1 = await collectResult(result1);
console.log('Quotes in text:');
console.log(html1);
console.log('');

// Test 2: self-closing tags
const template2 = html`<input type="text" /><br />`;
const result2 = render(template2);
const html2 = await collectResult(result2);
console.log('Self-closing tags:');
console.log(html2);
console.log('');

// Strip markers helper
function stripHydrationMarkers(html) {
  return html
    .replace(/<!--lit-part [^>]+?-->/g, '')
    .replace(/<!--\/lit-part-->/g, '')
    .replace(/<!--lit-node \d+-->/g, '')
    .replace(/<!--\?-->/g, '')
    .replace(/<!--lit-part-->/g, '');
}

console.log('Stripped quotes:');
console.log(stripHydrationMarkers(html1));
console.log('');

console.log('Stripped self-closing:');
console.log(stripHydrationMarkers(html2));
