/**
 * Baseline tests for attribute rendering
 *
 * Tests static attributes, dynamic attributes, boolean attributes,
 * and property bindings.
 */
import { describe, test } from 'node:test';
import { html } from 'lit';
import { createRenderer, stripHydrationMarkers } from '../../helpers/renderer.js';
import { assertHTMLEqual } from '../../helpers/html-compare.js';

describe('Attributes - Static', () => {
  const renderer = createRenderer();

  test('renders static attribute', async () => {
    const template = html`<div id="test">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div id="test">Content</div>');
  });

  test('renders multiple static attributes', async () => {
    const template = html`<div id="test" class="container" data-value="123">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div id="test" class="container" data-value="123">Content</div>');
  });

  test('renders data attributes', async () => {
    const template = html`<div data-id="42" data-name="test">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div data-id="42" data-name="test">Content</div>');
  });

  test('renders aria attributes', async () => {
    const template = html`<button aria-label="Close" aria-pressed="true">X</button>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<button aria-label="Close" aria-pressed="true">X</button>');
  });
});

describe('Attributes - Dynamic', () => {
  const renderer = createRenderer();

  test('renders dynamic attribute value', async () => {
    const id = 'dynamic-id';
    const template = html`<div id="${id}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div id="dynamic-id">Content</div>');
  });

  test('renders dynamic class', async () => {
    const className = 'my-class';
    const template = html`<div class="${className}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div class="my-class">Content</div>');
  });

  test('renders multiple dynamic attributes', async () => {
    const id = 'test-id';
    const className = 'test-class';
    const dataValue = '999';
    const template = html`<div id="${id}" class="${className}" data-value="${dataValue}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div id="test-id" class="test-class" data-value="999">Content</div>');
  });

  test('escapes attribute values', async () => {
    const unsafe = '<script>alert("xss")</script>';
    const template = html`<div title="${unsafe}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Attribute values should be escaped
    assertHTMLEqual(stripped, '<div title="&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;">Content</div>');
  });

  test('escapes quotes in attribute values', async () => {
    const value = 'Say "Hello"';
    const template = html`<div title="${value}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div title="Say &quot;Hello&quot;">Content</div>');
  });

  test('renders null attribute as empty', async () => {
    const value = null;
    const template = html`<div data-value="${value}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // null renders as empty string
    assertHTMLEqual(stripped, '<div data-value="">Content</div>');
  });

  test('renders undefined attribute as empty', async () => {
    const value = undefined;
    const template = html`<div data-value="${value}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div data-value="">Content</div>');
  });
});

describe('Attributes - Boolean', () => {
  const renderer = createRenderer();

  test('renders boolean attribute when true', async () => {
    const disabled = true;
    const template = html`<button ?disabled="${disabled}">Click</button>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Boolean attributes should appear without value when true
    assertHTMLEqual(stripped, '<button disabled>Click</button>');
  });

  test('removes boolean attribute when false', async () => {
    const disabled = false;
    const template = html`<button ?disabled="${disabled}">Click</button>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Boolean attribute should not appear when false (note trailing space)
    assertHTMLEqual(stripped, '<button >Click</button>');
  });

  test('renders multiple boolean attributes', async () => {
    const disabled = true;
    const hidden = false;
    const readonly = true;
    const template = html`<input ?disabled="${disabled}" ?hidden="${hidden}" ?readonly="${readonly}" />`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<input disabled readonly />');
  });

  test('renders checked attribute', async () => {
    const checked = true;
    const template = html`<input type="checkbox" ?checked="${checked}" />`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<input type="checkbox" checked />');
  });

  test('renders selected attribute', async () => {
    const selected = true;
    const template = html`<option ?selected="${selected}">Option</option>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<option selected>Option</option>');
  });
});

describe('Attributes - Property Binding', () => {
  const renderer = createRenderer();

  test('renders property binding (note: SSR may not support all property bindings)', async () => {
    const value = 'test-value';
    // Property bindings (.prop=) may not be fully supported in SSR
    // This test documents the expected behavior
    const template = html`<input .value="${value}" />`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // In @lit-labs/ssr, some property bindings do render as attributes
    assertHTMLEqual(stripped, '<input value="test-value" />');
  });
});

describe('Attributes - Special Cases', () => {
  const renderer = createRenderer();

  test('renders style attribute', async () => {
    const color = 'red';
    const template = html`<div style="color: ${color};">Styled</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div style="color: red;">Styled</div>');
  });

  test('renders href attribute', async () => {
    const url = '/path/to/page';
    const template = html`<a href="${url}">Link</a>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<a href="/path/to/page">Link</a>');
  });

  test('renders src attribute', async () => {
    const imgSrc = '/images/photo.jpg';
    const template = html`<img src="${imgSrc}" alt="Photo" />`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<img src="/images/photo.jpg" alt="Photo" />');
  });

  test('renders mixed static and dynamic attributes', async () => {
    const id = 'dynamic';
    const template = html`<div id="${id}" class="static" data-mixed="${id}-static">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div id="dynamic" class="static" data-mixed="dynamic-static">Content</div>');
  });
});
