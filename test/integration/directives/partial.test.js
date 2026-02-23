/**
 * Phase 5 integration tests — partially-supported directives.
 *
 * These directives have a render() method that works correctly during SSR.
 * Their update() method (used for subsequent client-side re-renders) may
 * have additional DOM-dependent behaviour, but for server-rendered output
 * they produce correct initial HTML.
 *
 * Covered directives: classMap, styleMap, keyed
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { html } from 'lit';
import { render, collectResult } from '../../../src/index.js';
import { classMap, styleMap, keyed } from '../../../src/directives/index.js';
import { assertHTMLEqual } from '../../helpers/html-compare.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const renderToString = async (template) => collectResult(render(template));

const strip = (str) =>
  str
    .replace(/<!--lit-part[^>]*-->/g, '')
    .replace(/<!--\/lit-part-->/g, '')
    .replace(/<!--lit-node \d+-->/g, '')
    .replace(/<\?>/g, ''); // Remove Lit's empty-expression placeholder marker

// ── classMap ──────────────────────────────────────────────────────────────────

describe('Phase 5 directives - classMap', () => {
  // Note: classMap produces class values with leading/trailing spaces when
  // used without surrounding static text. This matches @lit-labs/ssr output
  // exactly: class=" active visible " is the canonical SSR format.
  // assertHTMLEqual normalises extra internal spaces but not leading/trailing
  // ones inside attribute values, so we use assert.ok with includes() checks.

  test('renders classes whose values are truthy', async () => {
    const output = strip(
      await renderToString(
        html`<div class="${classMap({ active: true, disabled: false, visible: true })}">x</div>`
      )
    );
    assert.ok(output.includes('active'), 'active class must be present');
    assert.ok(output.includes('visible'), 'visible class must be present');
    assert.ok(!output.includes('disabled'), 'disabled class must be absent');
  });

  test('renders empty class string when all values are false', async () => {
    const output = strip(
      await renderToString(
        html`<div class="${classMap({ active: false, disabled: false })}">x</div>`
      )
    );
    // class attribute is present but contains no class names
    assert.ok(output.includes('class='), 'class attribute must be present');
    assert.ok(!output.includes('active'), 'active must be absent');
    assert.ok(!output.includes('disabled'), 'disabled must be absent');
  });

  test('combines with static classes', async () => {
    const output = strip(
      await renderToString(
        html`<div class="base ${classMap({ extra: true })}">x</div>`
      )
    );
    assert.ok(output.includes('base'), 'static class must be present');
    assert.ok(output.includes('extra'), 'dynamic class must be present');
  });

  test('handles a single truthy class', async () => {
    const output = strip(
      await renderToString(
        html`<div class="${classMap({ only: true })}">x</div>`
      )
    );
    assert.ok(output.includes('only'), 'only class must be present');
  });

  test('handles class names with hyphens', async () => {
    const output = strip(
      await renderToString(
        html`<div class="${classMap({ 'is-active': true, 'has-error': false })}">x</div>`
      )
    );
    assert.ok(output.includes('is-active'), 'is-active must be present');
    assert.ok(!output.includes('has-error'), 'has-error must be absent');
  });

  test('does not render classes with undefined or null values', async () => {
    const output = strip(
      await renderToString(
        html`<div class="${classMap({ present: true, absent: undefined, alsoAbsent: null })}">x</div>`
      )
    );
    assert.ok(output.includes('present'), 'present class must be present');
    assert.ok(!output.includes('absent'), 'absent class must not be rendered');
  });
});

// ── styleMap ──────────────────────────────────────────────────────────────────

describe('Phase 5 directives - styleMap', () => {
  // Note: styleMap serialises to compact CSS format (no spaces after colon/semicolon).
  // This matches @lit-labs/ssr output exactly:
  //   style="color:red;font-size:16px;" — no spaces, trailing semicolon.

  test('renders inline styles from an object', async () => {
    const output = strip(
      await renderToString(
        html`<div style="${styleMap({ color: 'red', fontSize: '16px' })}">x</div>`
      )
    );
    // Check compact format (no spaces around colon or semicolon)
    assert.ok(output.includes('color:red'), `Expected "color:red" in: ${output}`);
    assert.ok(output.includes('font-size:16px'), `Expected "font-size:16px" in: ${output}`);
  });

  test('renders empty style attribute when object is empty', async () => {
    const output = strip(
      await renderToString(html`<div style="${styleMap({})}">x</div>`)
    );
    assertHTMLEqual(output, '<div style="">x</div>');
  });

  test('skips undefined style values', async () => {
    const output = strip(
      await renderToString(
        html`<div style="${styleMap({ color: 'blue', margin: undefined })}">x</div>`
      )
    );
    assert.ok(output.includes('color:blue'), `Expected "color:blue" in: ${output}`);
    assert.ok(!output.includes('margin'), 'undefined value must be omitted');
  });

  test('skips null style values', async () => {
    const output = strip(
      await renderToString(
        html`<div style="${styleMap({ padding: '4px', border: null })}">x</div>`
      )
    );
    assert.ok(output.includes('padding:4px'), `Expected "padding:4px" in: ${output}`);
    assert.ok(!output.includes('border'), 'null value must be omitted');
  });

  test('renders a single style property', async () => {
    const output = strip(
      await renderToString(html`<p style="${styleMap({ fontWeight: 'bold' })}">x</p>`)
    );
    assert.ok(output.includes('font-weight:bold'), `Expected "font-weight:bold" in: ${output}`);
  });

  test('handles CSS custom properties (--var)', async () => {
    const output = strip(
      await renderToString(
        html`<div style="${styleMap({ '--primary-color': '#fff' })}">x</div>`
      )
    );
    assert.ok(output.includes('--primary-color:#fff'), `Expected "--primary-color:#fff" in: ${output}`);
  });
});

// ── keyed ─────────────────────────────────────────────────────────────────────

describe('Phase 5 directives - keyed', () => {
  test('renders the value normally (key is ignored in SSR)', async () => {
    const output = strip(
      await renderToString(html`<div>${keyed('id-1', html`<span>content</span>`)}</div>`)
    );
    assertHTMLEqual(output, '<div><span>content</span></div>');
  });

  test('renders a primitive value', async () => {
    const output = strip(
      await renderToString(html`<div>${keyed(42, 'hello')}</div>`)
    );
    assertHTMLEqual(output, '<div>hello</div>');
  });

  test('renders nothing when value is nothing sentinel', async () => {
    const { nothing } = await import('lit');
    const output = strip(
      await renderToString(html`<div>${keyed('k', nothing)}</div>`)
    );
    assertHTMLEqual(output, '<div></div>');
  });

  test('works with different key types', async () => {
    const numKey = strip(
      await renderToString(html`<div>${keyed(1, html`<p>a</p>`)}</div>`)
    );
    const strKey = strip(
      await renderToString(html`<div>${keyed('key', html`<p>b</p>`)}</div>`)
    );
    assertHTMLEqual(numKey, '<div><p>a</p></div>');
    assertHTMLEqual(strKey, '<div><p>b</p></div>');
  });
});
