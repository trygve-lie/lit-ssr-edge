/**
 * Baseline tests for edge cases and corner conditions
 *
 * Tests unusual inputs, special values, and error conditions.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert';
import { html, nothing } from 'lit';
import { createRenderer, stripHydrationMarkers } from '../../helpers/renderer.js';
import { assertHTMLEqual } from '../../helpers/html-compare.js';

describe('Edge Cases - Special Values', () => {
  const renderer = createRenderer();

  test('handles nothing sentinel', async () => {
    const template = html`<div>${nothing}</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div></div>');
  });

  test('handles null', async () => {
    const template = html`<div>${null}</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div></div>');
  });

  test('handles undefined', async () => {
    const template = html`<div>${undefined}</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div></div>');
  });

  test('handles empty arrays', async () => {
    const template = html`<div>${[]}</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div></div>');
  });

  test('handles empty strings', async () => {
    const template = html`<div>${''}</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div></div>');
  });

  test('handles zero', async () => {
    const template = html`<div>${0}</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div>0</div>');
  });

  test('handles false boolean', async () => {
    const template = html`<div>${false}</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div>false</div>');
  });
});

describe('Edge Cases - Deep Nesting', () => {
  const renderer = createRenderer();

  test('handles deeply nested templates', async () => {
    const level5 = html`<span>Level 5</span>`;
    const level4 = html`<div>${level5}</div>`;
    const level3 = html`<div>${level4}</div>`;
    const level2 = html`<div>${level3}</div>`;
    const level1 = html`<div>${level2}</div>`;

    const result = await renderer.renderToString(level1);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(
      stripped,
      '<div><div><div><div><span>Level 5</span></div></div></div></div>'
    );
  });

  test('handles deeply nested arrays', async () => {
    const template = html`
      <div>
        ${[[['Deep']]]}
      </div>
    `;

    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div> Deep </div>');
  });
});

describe('Edge Cases - Large Content', () => {
  const renderer = createRenderer();

  test('handles very long strings', async () => {
    const longString = 'A'.repeat(10000);
    const template = html`<div>${longString}</div>`;

    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assert.ok(stripped.includes('A'.repeat(10000)));
  });

  test('handles large arrays', async () => {
    const items = Array.from({ length: 1000 }, (_, i) => i);
    const template = html`
      <ul>
        ${items.map(i => html`<li>${i}</li>`)}
      </ul>
    `;

    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assert.ok(stripped.includes('<li>0</li>'));
    assert.ok(stripped.includes('<li>999</li>'));
  });
});

describe('Edge Cases - Special Characters', () => {
  const renderer = createRenderer();

  test('handles unicode characters', async () => {
    const unicode = '你好世界 🌍 Привет мир';
    const template = html`<div>${unicode}</div>`;

    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, `<div>${unicode}</div>`);
  });

  test('handles emoji', async () => {
    const emoji = '😀 🎉 🚀 ✨';
    const template = html`<div>${emoji}</div>`;

    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, `<div>${emoji}</div>`);
  });

  test('handles newlines and tabs', async () => {
    const multiline = 'Line 1\nLine 2\tTabbed';
    const template = html`<pre>${multiline}</pre>`;

    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Newlines and tabs are preserved in pre elements
    assertHTMLEqual(stripped, `<pre>Line 1\nLine 2\tTabbed</pre>`);
  });
});

describe('Edge Cases - Mixed Content', () => {
  const renderer = createRenderer();

  test('handles mix of primitives in array', async () => {
    const mixed = [1, 'two', true, null, undefined, html`<span>template</span>`];
    const template = html`<div>${mixed}</div>`;

    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Arrays concatenate: 1 + 'two' + true + '' + '' + '<span>template</span>'
    assertHTMLEqual(stripped, '<div>1twotrue<span>template</span></div>');
  });

  test('handles alternating static and dynamic content', async () => {
    const a = 'A';
    const b = 'B';
    const c = 'C';
    const template = html`<div>Static${a}More${b}Even${c}End</div>`;

    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div>StaticAMoreBEvenCEnd</div>');
  });
});
