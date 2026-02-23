/**
 * Baseline tests for Lit directives
 *
 * Tests SSR-compatible directives like repeat, map, when, etc.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert';
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { createRenderer, stripHydrationMarkers } from '../../helpers/renderer.js';
import { assertHTMLEqual } from '../../helpers/html-compare.js';

describe('Directives - repeat', () => {
  const renderer = createRenderer();

  test('renders list with repeat directive', async () => {
    const items = ['Apple', 'Banana', 'Cherry'];
    const template = html`
      <ul>
        ${repeat(items, (item) => item, (item) => html`<li>${item}</li>`)}
      </ul>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<ul> <li>Apple</li><li>Banana</li><li>Cherry</li> </ul>');
  });

  test('renders list with repeat and object items', async () => {
    const items = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' }
    ];
    const template = html`
      <ul>
        ${repeat(
          items,
          (item) => item.id,
          (item) => html`<li data-id="${item.id}">${item.name}</li>`
        )}
      </ul>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<ul> <li data-id="1">Alice</li><li data-id="2">Bob</li><li data-id="3">Charlie</li> </ul>');
  });

  test('renders empty list with repeat', async () => {
    const items = [];
    const template = html`
      <ul>
        ${repeat(items, (item) => item, (item) => html`<li>${item}</li>`)}
      </ul>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<ul> </ul>');
  });
});

describe('Directives - map', () => {
  const renderer = createRenderer();

  test('renders list with map directive', async () => {
    const items = ['Red', 'Green', 'Blue'];
    const template = html`
      <ul>
        ${map(items, (item) => html`<li>${item}</li>`)}
      </ul>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<ul> <li>Red</li><li>Green</li><li>Blue</li> </ul>');
  });

  test('renders list with map and index', async () => {
    const items = ['First', 'Second', 'Third'];
    const template = html`
      <ul>
        ${map(items, (item, index) => html`<li>${index}: ${item}</li>`)}
      </ul>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<ul> <li>0: First</li><li>1: Second</li><li>2: Third</li> </ul>');
  });
});

describe('Directives - when', () => {
  const renderer = createRenderer();

  test('renders content when condition is true', async () => {
    const showContent = true;
    const template = html`
      <div>
        ${when(showContent, () => html`<p>Visible</p>`, () => html`<p>Hidden</p>`)}
      </div>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div> <p>Visible</p> </div>');
  });

  test('renders fallback when condition is false', async () => {
    const showContent = false;
    const template = html`
      <div>
        ${when(showContent, () => html`<p>Visible</p>`, () => html`<p>Hidden</p>`)}
      </div>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div> <p>Hidden</p> </div>');
  });

  test('renders nothing when condition is false and no fallback', async () => {
    const showContent = false;
    const template = html`
      <div>
        ${when(showContent, () => html`<p>Content</p>`)}
      </div>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div> </div>');
  });
});

describe('Directives - ifDefined', () => {
  const renderer = createRenderer();

  test('renders attribute when value is defined', async () => {
    const title = 'Test Title';
    const template = html`<div title="${ifDefined(title)}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div title="Test Title">Content</div>');
  });

  test('omits attribute when value is undefined', async () => {
    const title = undefined;
    const template = html`<div title="${ifDefined(title)}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Attribute should not be present (note trailing space)
    assertHTMLEqual(stripped, '<div >Content</div>');
  });

  test('omits attribute when value is null', async () => {
    const title = null;
    const template = html`<div title="${ifDefined(title)}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // With ifDefined, null should also omit the attribute (note trailing space)
    assertHTMLEqual(stripped, '<div >Content</div>');
  });
});

describe('Directives - classMap', () => {
  const renderer = createRenderer();

  test('renders classes from classMap', async () => {
    const classes = {
      active: true,
      disabled: false,
      'has-error': true
    };
    const template = html`<div class="${classMap(classes)}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // classMap adds leading/trailing spaces
    assertHTMLEqual(stripped, '<div class=" active has-error ">Content</div>');
  });

  test('renders empty class when all false', async () => {
    const classes = {
      active: false,
      disabled: false
    };
    const template = html`<div class="${classMap(classes)}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Should have no class attribute or empty class
    assertHTMLEqual(stripped, '<div class="">Content</div>');
  });

  test('combines static and dynamic classes', async () => {
    const classes = {
      dynamic: true,
      active: true
    };
    const template = html`<div class="static ${classMap(classes)}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div class="static dynamic active">Content</div>');
  });
});

describe('Directives - styleMap', () => {
  const renderer = createRenderer();

  test('renders styles from styleMap', async () => {
    const styles = {
      color: 'red',
      'font-size': '16px',
      display: 'block'
    };
    const template = html`<div style="${styleMap(styles)}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div style="color:red;font-size:16px;display:block;">Content</div>');
  });

  test('renders empty style when object is empty', async () => {
    const styles = {};
    const template = html`<div style="${styleMap(styles)}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div style="">Content</div>');
  });

  test('skips undefined style values', async () => {
    const styles = {
      color: 'blue',
      fontSize: undefined,
      display: 'block'
    };
    const template = html`<div style="${styleMap(styles)}">Content</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<div style="color:blue;display:block;">Content</div>');
  });
});

describe('Directives - unsafeHTML', () => {
  const renderer = createRenderer();

  test('renders raw HTML with unsafeHTML', async () => {
    const rawHTML = '<strong>Bold</strong> text';
    const template = html`<div>${unsafeHTML(rawHTML)}</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Should include the raw HTML tags
    assertHTMLEqual(stripped, '<div><strong>Bold</strong> text</div>');
  });

  test('renders script tags with unsafeHTML (unsafe)', async () => {
    const rawHTML = '<script>console.log("test")</script>';
    const template = html`<div>${unsafeHTML(rawHTML)}</div>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // unsafeHTML allows script tags (which is why it's "unsafe")
    assertHTMLEqual(stripped, '<div><script>console.log("test")</script></div>');
  });

  test('renders complex HTML with unsafeHTML', async () => {
    const rawHTML = '<article><h1>Title</h1><p>Content</p></article>';
    const template = html`${unsafeHTML(rawHTML)}`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assertHTMLEqual(stripped, '<article><h1>Title</h1><p>Content</p></article>');
  });
});

describe('Directives - Combined Usage', () => {
  const renderer = createRenderer();

  test('combines multiple directives', async () => {
    const items = ['A', 'B', 'C'];
    const showList = true;
    const template = html`
      ${when(
        showList,
        () => html`
          <ul>
            ${map(items, (item) => html`
              <li class="${classMap({ active: item === 'B' })}">${item}</li>
            `)}
          </ul>
        `
      )}
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // classMap adds leading/trailing spaces, empty classes show as ""
    assertHTMLEqual(stripped, '<ul> <li class="">A</li> <li class=" active ">B</li> <li class="">C</li> </ul>');
  });
});
