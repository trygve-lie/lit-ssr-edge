/**
 * Baseline tests for template rendering
 *
 * These tests run against @lit-labs/ssr to establish expected output.
 * Later, the same tests will run against lit-edge to verify compatibility.
 */
import { describe, test } from 'node:test';
import { html } from 'lit';
import { createRenderer, stripHydrationMarkers } from '../../helpers/renderer.js';
import { assertHTMLEqual } from '../../helpers/html-compare.js';

describe('Template Rendering - Primitives', () => {
  const renderer = createRenderer();

  test('renders plain text', async () => {
    const template = html`Hello, World!`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, 'Hello, World!');
  });

  test('renders string interpolation', async () => {
    const name = 'Alice';
    const template = html`Hello, ${name}!`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, 'Hello, Alice!');
  });

  test('renders number interpolation', async () => {
    const count = 42;
    const template = html`Count: ${count}`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, 'Count: 42');
  });

  test('renders boolean as string', async () => {
    const flag = true;
    const template = html`Flag: ${flag}`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Booleans are converted to strings in text content
    assertHTMLEqual(stripped, 'Flag: true');
  });

  test('renders null as empty string', async () => {
    const value = null;
    const template = html`Value: ${value}`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // null/undefined render as empty strings
    assertHTMLEqual(stripped, 'Value:');
  });

  test('renders undefined as empty string', async () => {
    const value = undefined;
    const template = html`Value: ${value}`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, 'Value:');
  });

  test('renders array of primitives', async () => {
    const items = ['a', 'b', 'c'];
    const template = html`Items: ${items}`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Arrays are joined without separators
    assertHTMLEqual(stripped, 'Items: abc');
  });

  test('escapes HTML special characters', async () => {
    const unsafe = '<script>alert("xss")</script>';
    const template = html`${unsafe}`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // HTML should be escaped
    assertHTMLEqual(stripped, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  test('escapes ampersands', async () => {
    const text = 'Rock & Roll';
    const template = html`${text}`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, 'Rock &amp; Roll');
  });

  test('escapes quotes in text content', async () => {
    const text = 'Say "Hello"';
    const template = html`${text}`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Quotes in text content should be escaped
    assertHTMLEqual(stripped, 'Say &quot;Hello&quot;');
  });
});

describe('Template Rendering - HTML Structure', () => {
  const renderer = createRenderer();

  test('renders simple div', async () => {
    const template = html`<div>Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div>Content</div>');
  });

  test('renders nested elements', async () => {
    const template = html`
      <div>
        <p>Paragraph</p>
        <span>Span</span>
      </div>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div> <p>Paragraph</p> <span>Span</span> </div>');
  });

  test('renders self-closing tags', async () => {
    const template = html`<input type="text" /><br />`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Note: @lit-labs/ssr preserves the /> syntax in self-closing tags
    assertHTMLEqual(stripped, '<input type="text" /><br />');
  });

  test('renders multiple root elements', async () => {
    const template = html`
      <div>First</div>
      <div>Second</div>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div>First</div> <div>Second</div>');
  });

  test('renders mixed content', async () => {
    const name = 'Bob';
    const template = html`
      <div>
        Hello, ${name}!
        <strong>Welcome</strong>
      </div>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div> Hello, Bob! <strong>Welcome</strong> </div>');
  });
});

describe('Template Rendering - Nested Templates', () => {
  const renderer = createRenderer();

  test('renders nested template', async () => {
    const innerTemplate = html`<span>Inner</span>`;
    const outerTemplate = html`<div>${innerTemplate}</div>`;
    const result = await renderer.renderToString(outerTemplate);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div><span>Inner</span></div>');
  });

  test('renders array of templates', async () => {
    const templates = [
      html`<li>Item 1</li>`,
      html`<li>Item 2</li>`,
      html`<li>Item 3</li>`
    ];
    const template = html`<ul>${templates}</ul>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>');
  });

  test('renders conditionally rendered templates', async () => {
    const showContent = true;
    const template = html`
      <div>
        ${showContent ? html`<p>Visible</p>` : html`<p>Hidden</p>`}
      </div>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div> <p>Visible</p> </div>');
  });

  test('renders deeply nested templates', async () => {
    const level3 = html`<span>Level 3</span>`;
    const level2 = html`<p>${level3}</p>`;
    const level1 = html`<div>${level2}</div>`;
    const result = await renderer.renderToString(level1);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div><p><span>Level 3</span></p></div>');
  });
});
