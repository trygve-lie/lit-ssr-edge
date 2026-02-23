/**
 * Phase 5 integration tests — SSR-safe directives (full support).
 *
 * Verifies that the following directives produce correct HTML output during
 * server-side rendering:
 *   repeat, map, join, range, when, choose, ifDefined, guard,
 *   unsafeHTML, unsafeSVG
 *
 * All tests compare stripped output (hydration markers removed) against
 * expected HTML so the assertions are stable across marker format changes.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { html } from 'lit';
import { render, collectResult } from '../../../src/index.js';
import {
  repeat, map, join, range, when, choose, ifDefined, guard,
  unsafeHTML, unsafeSVG,
} from '../../../src/directives/index.js';
import { assertHTMLEqual } from '../../helpers/html-compare.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const renderToString = async (template) => collectResult(render(template));

const strip = (str) =>
  str
    .replace(/<!--lit-part[^>]*-->/g, '')
    .replace(/<!--\/lit-part-->/g, '')
    .replace(/<!--lit-node \d+-->/g, '')
    .replace(/<\?>/g, ''); // Remove Lit's empty-expression placeholder marker

// ── repeat ────────────────────────────────────────────────────────────────────

describe('Phase 5 directives - repeat', () => {
  test('renders a list of string items', async () => {
    const items = ['a', 'b', 'c'];
    const output = strip(
      await renderToString(html`
        <ul>${repeat(items, (i) => i, (i) => html`<li>${i}</li>`)}</ul>
      `)
    );
    assertHTMLEqual(output, '<ul><li>a</li><li>b</li><li>c</li></ul>');
  });

  test('renders an empty list', async () => {
    const output = strip(
      await renderToString(html`<ul>${repeat([], () => '', () => html`<li>x</li>`)}</ul>`)
    );
    assertHTMLEqual(output, '<ul></ul>');
  });

  test('exposes the index to the template function', async () => {
    const items = ['x', 'y'];
    const output = strip(
      await renderToString(html`
        <ul>${repeat(items, (i) => i, (item, idx) => html`<li>${idx}:${item}</li>`)}</ul>
      `)
    );
    assertHTMLEqual(output, '<ul><li>0:x</li><li>1:y</li></ul>');
  });

  test('renders objects using a key function', async () => {
    const items = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
    const output = strip(
      await renderToString(html`
        <ul>${repeat(items, (i) => i.id, (i) => html`<li>${i.name}</li>`)}</ul>
      `)
    );
    assertHTMLEqual(output, '<ul><li>Alice</li><li>Bob</li></ul>');
  });

  test('renders large lists correctly', async () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const output = strip(
      await renderToString(html`
        <ul>${repeat(items, (i) => i, (i) => html`<li>${i}</li>`)}</ul>
      `)
    );
    assert.ok(output.includes('<li>0</li>'));
    assert.ok(output.includes('<li>99</li>'));
  });
});

// ── map ───────────────────────────────────────────────────────────────────────

describe('Phase 5 directives - map', () => {
  test('transforms an array into a list of templates', async () => {
    const items = ['foo', 'bar'];
    const output = strip(
      await renderToString(html`<ul>${map(items, (i) => html`<li>${i}</li>`)}</ul>`)
    );
    assertHTMLEqual(output, '<ul><li>foo</li><li>bar</li></ul>');
  });

  test('exposes the index to the mapper', async () => {
    const items = ['a', 'b'];
    const output = strip(
      await renderToString(html`
        <ol>${map(items, (item, idx) => html`<li>${idx}.${item}</li>`)}</ol>
      `)
    );
    assertHTMLEqual(output, '<ol><li>0.a</li><li>1.b</li></ol>');
  });

  test('handles an empty iterable', async () => {
    const output = strip(
      await renderToString(html`<ul>${map([], () => html`<li>x</li>`)}</ul>`)
    );
    assertHTMLEqual(output, '<ul></ul>');
  });

  test('maps a Set (non-array iterable)', async () => {
    const items = new Set(['p', 'q']);
    const output = strip(
      await renderToString(html`<ul>${map(items, (i) => html`<li>${i}</li>`)}</ul>`)
    );
    // Set preserves insertion order
    assertHTMLEqual(output, '<ul><li>p</li><li>q</li></ul>');
  });
});

// ── join ──────────────────────────────────────────────────────────────────────

describe('Phase 5 directives - join', () => {
  test('joins template items with a string separator', async () => {
    const items = [html`<span>a</span>`, html`<span>b</span>`, html`<span>c</span>`];
    const output = strip(
      await renderToString(html`<p>${join(items, ' | ')}</p>`)
    );
    assertHTMLEqual(output, '<p><span>a</span> | <span>b</span> | <span>c</span></p>');
  });

  test('joins template items with a template separator', async () => {
    const items = ['x', 'y', 'z'];
    const output = strip(
      await renderToString(html`<p>${join(items, html`<hr />`)}</p>`)
    );
    assertHTMLEqual(output, '<p>x<hr />y<hr />z</p>');
  });

  test('handles a single item (no separator emitted)', async () => {
    const output = strip(
      await renderToString(html`<p>${join(['only'], ', ')}</p>`)
    );
    assertHTMLEqual(output, '<p>only</p>');
  });

  test('handles an empty iterable', async () => {
    const output = strip(
      await renderToString(html`<p>${join([], ', ')}</p>`)
    );
    assertHTMLEqual(output, '<p></p>');
  });
});

// ── range ─────────────────────────────────────────────────────────────────────

describe('Phase 5 directives - range', () => {
  test('generates a sequence from 0 to n-1', async () => {
    const output = strip(
      await renderToString(html`
        <ul>${map(range(3), (i) => html`<li>${i}</li>`)}</ul>
      `)
    );
    assertHTMLEqual(output, '<ul><li>0</li><li>1</li><li>2</li></ul>');
  });

  test('generates a range with start and end', async () => {
    const output = strip(
      await renderToString(html`
        <ul>${map(range(2, 5), (i) => html`<li>${i}</li>`)}</ul>
      `)
    );
    assertHTMLEqual(output, '<ul><li>2</li><li>3</li><li>4</li></ul>');
  });

  test('generates a range with a step', async () => {
    const output = strip(
      await renderToString(html`
        <ul>${map(range(0, 10, 3), (i) => html`<li>${i}</li>`)}</ul>
      `)
    );
    assertHTMLEqual(output, '<ul><li>0</li><li>3</li><li>6</li><li>9</li></ul>');
  });
});

// ── when ──────────────────────────────────────────────────────────────────────

describe('Phase 5 directives - when', () => {
  test('renders the truthy template when condition is true', async () => {
    const output = strip(
      await renderToString(html`
        <div>${when(true, () => html`<span>yes</span>`, () => html`<span>no</span>`)}</div>
      `)
    );
    assertHTMLEqual(output, '<div><span>yes</span></div>');
  });

  test('renders the falsy template when condition is false', async () => {
    const output = strip(
      await renderToString(html`
        <div>${when(false, () => html`<span>yes</span>`, () => html`<span>no</span>`)}</div>
      `)
    );
    assertHTMLEqual(output, '<div><span>no</span></div>');
  });

  test('renders nothing when condition is false and no falsy template', async () => {
    const output = strip(
      await renderToString(html`<div>${when(false, () => html`<span>yes</span>`)}</div>`)
    );
    assertHTMLEqual(output, '<div></div>');
  });

  test('condition can be any truthy value', async () => {
    const output = strip(
      await renderToString(html`<div>${when(42, () => html`<span>truthy</span>`)}</div>`)
    );
    assertHTMLEqual(output, '<div><span>truthy</span></div>');
  });
});

// ── choose ────────────────────────────────────────────────────────────────────

describe('Phase 5 directives - choose', () => {
  test('selects the matching case', async () => {
    const value = 'b';
    const output = strip(
      await renderToString(html`
        <div>${choose(value, [
          ['a', () => html`<span>A</span>`],
          ['b', () => html`<span>B</span>`],
          ['c', () => html`<span>C</span>`],
        ])}</div>
      `)
    );
    assertHTMLEqual(output, '<div><span>B</span></div>');
  });

  test('renders the default template when no case matches', async () => {
    const output = strip(
      await renderToString(html`
        <div>${choose(
          'z',
          [['a', () => html`<span>A</span>`]],
          () => html`<span>default</span>`
        )}</div>
      `)
    );
    assertHTMLEqual(output, '<div><span>default</span></div>');
  });

  test('renders nothing when no case matches and no default', async () => {
    const output = strip(
      await renderToString(html`<div>${choose('x', [['a', () => html`<span>A</span>`]])}</div>`)
    );
    assertHTMLEqual(output, '<div></div>');
  });
});

// ── ifDefined ─────────────────────────────────────────────────────────────────

describe('Phase 5 directives - ifDefined', () => {
  test('renders a defined string value as an attribute', async () => {
    const val = 'hello';
    const output = strip(
      await renderToString(html`<div title="${ifDefined(val)}">x</div>`)
    );
    assertHTMLEqual(output, '<div title="hello">x</div>');
  });

  test('omits the attribute when value is undefined', async () => {
    const val = undefined;
    const output = strip(
      await renderToString(html`<div title="${ifDefined(val)}">x</div>`)
    );
    // Attribute is omitted; element has a trailing space before >
    assert.ok(!output.includes('title='), 'title attribute must be absent');
    assert.ok(output.includes('<div'), 'div element must still be present');
  });

  test('omits the attribute when value is null', async () => {
    const val = null;
    const output = strip(
      await renderToString(html`<div data-x="${ifDefined(val)}">x</div>`)
    );
    assert.ok(!output.includes('data-x='), 'attribute must be absent for null');
  });

  test('renders a number value', async () => {
    const output = strip(
      await renderToString(html`<input maxlength="${ifDefined(10)}" />`)
    );
    assertHTMLEqual(output, '<input maxlength="10" />');
  });
});

// ── guard ─────────────────────────────────────────────────────────────────────

describe('Phase 5 directives - guard', () => {
  test('renders the template value on first render', async () => {
    const output = strip(
      await renderToString(
        html`<div>${guard(['key'], () => html`<span>content</span>`)}</div>`
      )
    );
    assertHTMLEqual(output, '<div><span>content</span></div>');
  });

  test('renders a primitive value returned by the factory', async () => {
    const output = strip(
      await renderToString(html`<div>${guard(['v'], () => 'static text')}</div>`)
    );
    assertHTMLEqual(output, '<div>static text</div>');
  });

  test('dependencies array can have multiple values', async () => {
    const a = 'x', b = 2;
    const output = strip(
      await renderToString(
        html`<div>${guard([a, b], () => html`<span>${a}${b}</span>`)}</div>`
      )
    );
    assertHTMLEqual(output, '<div><span>x2</span></div>');
  });
});

// ── unsafeHTML ────────────────────────────────────────────────────────────────

describe('Phase 5 directives - unsafeHTML', () => {
  test('renders raw HTML without escaping', async () => {
    const raw = '<strong>bold</strong>';
    const output = strip(
      await renderToString(html`<div>${unsafeHTML(raw)}</div>`)
    );
    assertHTMLEqual(output, '<div><strong>bold</strong></div>');
  });

  test('renders complex nested HTML', async () => {
    const raw = '<ul><li>a</li><li>b</li></ul>';
    const output = strip(
      await renderToString(html`<div>${unsafeHTML(raw)}</div>`)
    );
    assertHTMLEqual(output, '<div><ul><li>a</li><li>b</li></ul></div>');
  });

  test('renders HTML that includes script tags', async () => {
    const raw = '<script>console.log("x")</script>';
    const output = strip(
      await renderToString(html`<div>${unsafeHTML(raw)}</div>`)
    );
    // Script tag must be present verbatim (unsafeHTML is intentionally unsafe)
    assert.ok(output.includes('<script>'));
  });

  test('renders empty string as nothing', async () => {
    const output = strip(
      await renderToString(html`<div>${unsafeHTML('')}</div>`)
    );
    assertHTMLEqual(output, '<div></div>');
  });
});

// ── unsafeSVG ─────────────────────────────────────────────────────────────────

describe('Phase 5 directives - unsafeSVG', () => {
  test('renders raw SVG markup', async () => {
    const rawSvg = '<circle cx="50" cy="50" r="40" />';
    const output = strip(
      await renderToString(html`<svg>${unsafeSVG(rawSvg)}</svg>`)
    );
    assert.ok(output.includes('<circle'));
    assert.ok(output.includes('cx="50"'));
  });
});
