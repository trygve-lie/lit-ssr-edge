/**
 * Integration tests for hydration marker generation.
 *
 * Verifies that lit-edge embeds the correct hydration markers in rendered HTML
 * so that @lit-labs/ssr-client can hydrate the output on the client.
 *
 * These tests exercise the full render pipeline and check the raw output
 * (before stripping markers) to confirm marker placement and format.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { html } from 'lit';
import { render, collectResult, digestForTemplateResult } from '../../../src/index.js';
import { html as serverHtml } from '../../../src/server-template.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const renderToString = async (template) => {
  const result = render(template);
  return collectResult(result);
};

// ─── lit-part markers ────────────────────────────────────────────────────────

describe('Hydration markers - lit-part (template child parts)', () => {
  test('wraps a TemplateResult child in open/close lit-part markers', async () => {
    const inner = html`<span>inner</span>`;
    const outer = html`<div>${inner}</div>`;
    const output = await renderToString(outer);

    // The outer template has its own lit-part wrapper
    // The inner template child part also has open/close markers
    const openCount = (output.match(/<!--lit-part /g) ?? []).length;
    const closeCount = (output.match(/<!--\/lit-part-->/g) ?? []).length;

    // Markers must be balanced
    assert.equal(openCount, closeCount, 'lit-part markers must be balanced');
    assert.ok(openCount >= 2, 'At least 2 open markers (outer + inner template)');
  });

  test('outer template marker includes digest', async () => {
    const template = html`<div>${'hello'}</div>`;
    const expectedDigest = digestForTemplateResult(template);
    const output = await renderToString(template);

    assert.ok(
      output.startsWith(`<!--lit-part ${expectedDigest}-->`),
      `Output should start with <!--lit-part ${expectedDigest}-->`
    );
  });

  test('output ends with closing lit-part marker', async () => {
    const template = html`<div>${'hello'}</div>`;
    const output = await renderToString(template);

    assert.ok(
      output.trimEnd().endsWith('<!--/lit-part-->'),
      'Output should end with <!--/lit-part-->'
    );
  });

  test('primitive child part uses empty lit-part marker (no digest)', async () => {
    const template = html`<div>${'text'}</div>`;
    const output = await renderToString(template);

    // The primitive binding wraps in <!--lit-part--> (no digest)
    assert.ok(output.includes('<!--lit-part-->'), 'Primitive should use empty lit-part');
  });

  test('null/undefined child uses empty lit-part with no content', async () => {
    const template = html`<div>${null}</div>`;
    const output = await renderToString(template);

    // null renders as <!--lit-part--><!--/lit-part--> with no content between
    assert.ok(output.includes('<!--lit-part--><!--/lit-part-->'));
  });

  test('nothing sentinel uses empty lit-part with no content', async () => {
    const { nothing } = await import('lit');
    const template = html`<div>${nothing}</div>`;
    const output = await renderToString(template);

    assert.ok(output.includes('<!--lit-part--><!--/lit-part-->'));
  });

  test('markers are properly nested for nested templates', async () => {
    const level3 = html`<em>deep</em>`;
    const level2 = html`<p>${level3}</p>`;
    const level1 = html`<div>${level2}</div>`;
    const output = await renderToString(level1);

    const opens = [...output.matchAll(/<!--lit-part/g)].length;
    const closes = [...output.matchAll(/<!--\/lit-part-->/g)].length;

    assert.equal(opens, closes, 'Nested markers must be balanced');
    // One lit-part marker per TemplateResult: level1, level2, level3 = 3
    // (Each child-part call wraps the inner template with its own marker,
    //  not an additional one)
    assert.equal(opens, 3);
  });

  test('array of templates produces a marker per item', async () => {
    const items = [
      html`<li>a</li>`,
      html`<li>b</li>`,
      html`<li>c</li>`,
    ];
    const template = html`<ul>${items}</ul>`;
    const output = await renderToString(template);

    // 1 outer + 1 child-part (array) + 3 inner items = 5 open markers
    const opens = [...output.matchAll(/<!--lit-part/g)].length;
    const closes = [...output.matchAll(/<!--\/lit-part-->/g)].length;

    assert.equal(opens, closes);
    assert.equal(opens, 5);
  });
});

// ─── lit-node markers ────────────────────────────────────────────────────────

describe('Hydration markers - lit-node (attribute-bound elements)', () => {
  test('emits a lit-node marker before an element with a dynamic attribute', async () => {
    const template = html`<div id=${'foo'}>content</div>`;
    const output = await renderToString(template);

    assert.ok(
      /<!--lit-node \d+-->/.test(output),
      'Should contain a lit-node comment'
    );
  });

  test('lit-node marker appears before the bound element', async () => {
    const template = html`<div id=${'foo'}>content</div>`;
    const output = await renderToString(template);

    const nodeMarkerIdx = output.indexOf('<!--lit-node');
    const divIdx = output.indexOf('<div');

    assert.ok(
      nodeMarkerIdx < divIdx,
      'lit-node marker must appear before its element'
    );
  });

  test('lit-node index is a non-negative integer', async () => {
    const template = html`<span class=${'c'}>text</span>`;
    const output = await renderToString(template);

    const match = output.match(/<!--lit-node (\d+)-->/);
    assert.ok(match, 'lit-node comment should be present');
    const index = parseInt(match[1], 10);
    assert.ok(index >= 0);
  });

  test('no lit-node marker for static-only elements', async () => {
    const template = html`<div class="static">static</div>`;
    const output = await renderToString(template);

    assert.ok(
      !output.includes('<!--lit-node'),
      'Static elements should not have lit-node markers'
    );
  });

  test('multiple bound elements each get a lit-node marker', async () => {
    const template = html`
      <div id=${'a'}>first</div>
      <div id=${'b'}>second</div>
    `;
    const output = await renderToString(template);

    const markers = [...output.matchAll(/<!--lit-node \d+-->/g)];
    assert.equal(markers.length, 2, 'Two bound elements → two lit-node markers');
  });
});

// ─── Digest compatibility ────────────────────────────────────────────────────

describe('Hydration markers - digest compatibility', () => {
  test('digest embedded in rendered output matches digestForTemplateResult()', async () => {
    const template = html`<div class=${'c'}>${'v'}</div>`;
    const expectedDigest = digestForTemplateResult(template);
    const output = await renderToString(template);

    assert.ok(
      output.includes(`<!--lit-part ${expectedDigest}-->`),
      `Output should contain <!--lit-part ${expectedDigest}-->`
    );
  });

  test('different templates produce different digests in output', async () => {
    const t1 = html`<div>${'a'}</div>`;
    const t2 = html`<span>${'a'}</span>`;

    const o1 = await renderToString(t1);
    const o2 = await renderToString(t2);

    const d1 = o1.match(/<!--lit-part ([^-]+)-->/)?.[1];
    const d2 = o2.match(/<!--lit-part ([^-]+)-->/)?.[1];

    assert.ok(d1, 'First template should have a digest marker');
    assert.ok(d2, 'Second template should have a digest marker');
    assert.notEqual(d1, d2, 'Different templates should have different digests');
  });

  test('re-rendering same template produces the same digest', async () => {
    const makeTemplate = () => html`<p class=${'c'}>${'v'}</p>`;

    const o1 = await renderToString(makeTemplate());
    const o2 = await renderToString(makeTemplate());

    const d1 = o1.match(/<!--lit-part ([^-]+)-->/)?.[1];
    const d2 = o2.match(/<!--lit-part ([^-]+)-->/)?.[1];

    assert.equal(d1, d2, 'Same template should always produce the same digest');
  });
});

// ─── Server-only templates ───────────────────────────────────────────────────

describe('Hydration markers - server-only templates', () => {
  test('server-only template produces no lit-part markers', async () => {
    const template = serverHtml`<div>static</div>`;
    const output = await renderToString(template);

    assert.ok(
      !output.includes('<!--lit-part'),
      'Server-only templates must not emit lit-part markers'
    );
  });

  test('server-only template produces no lit-node markers', async () => {
    const template = serverHtml`<div id="static">content</div>`;
    const output = await renderToString(template);

    assert.ok(
      !output.includes('<!--lit-node'),
      'Server-only templates must not emit lit-node markers'
    );
  });

  test('regular template nested inside server-only template has markers', async () => {
    const inner = html`<span>${'value'}</span>`;
    const outer = serverHtml`<div>${inner}</div>`;
    const output = await renderToString(outer);

    // The server-only wrapper has no markers, but the regular inner template does
    assert.ok(
      output.includes('<!--lit-part'),
      'Inner regular template should emit lit-part markers'
    );
  });

  test('server-only template renders full document without markers', async () => {
    const template = serverHtml`<!DOCTYPE html><html><head><title>Test</title></head><body>${'content'}</body></html>`;
    const output = await renderToString(template);

    assert.ok(output.includes('<!DOCTYPE html>'));
    assert.ok(output.includes('<html>'));
    // Body content is server-only, so no markers
    assert.ok(!output.includes('<!--lit-part'));
  });
});
