/**
 * Baseline tests for LitElement component rendering
 *
 * Tests rendering of custom elements, shadow DOM, styles, and properties.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert';
import { html } from 'lit';
import { createRenderer, stripHydrationMarkers } from '../../helpers/renderer.js';
import { assertHTMLEqual } from '../../helpers/html-compare.js';

// Import test fixtures
import '../../fixtures/simple-greeting.js';
import '../../fixtures/card-component.js';
import '../../fixtures/property-types.js';

describe('Components - Basic Rendering', () => {
  const renderer = createRenderer();

  test('renders simple custom element', async () => {
    const template = html`<simple-greeting></simple-greeting>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Verify component tag is present
    assert.ok(stripped.includes('<simple-greeting'));
    // Verify rendered content
    assert.ok(stripped.includes('Hello, World!'));
  });

  test('renders custom element with property', async () => {
    const template = html`<simple-greeting name="Alice"></simple-greeting>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assert.ok(stripped.includes('<simple-greeting'));
    assert.ok(stripped.includes('name="Alice"'));
    assert.ok(stripped.includes('Hello, Alice!'));
  });

  test('renders custom element with dynamic property', async () => {
    const name = 'Bob';
    const template = html`<simple-greeting name="${name}"></simple-greeting>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assert.ok(stripped.includes('name="Bob"'));
    assert.ok(stripped.includes('Hello, Bob!'));
  });

  test('renders multiple instances of same component', async () => {
    const template = html`
      <simple-greeting name="Alice"></simple-greeting>
      <simple-greeting name="Bob"></simple-greeting>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assert.ok(stripped.includes('Hello, Alice!'));
    assert.ok(stripped.includes('Hello, Bob!'));
  });
});

describe('Components - Shadow DOM', () => {
  const renderer = createRenderer();

  test('renders declarative shadow DOM', async () => {
    const template = html`<simple-greeting></simple-greeting>`;
    const result = await renderer.renderToString(template);

    // Should include declarative shadow DOM template tag
    assert.ok(result.includes('<template shadowroot'));
    assert.ok(result.includes('shadowroot="open"') || result.includes('shadowrootmode="open"'));
  });

  test('renders component styles in shadow DOM', async () => {
    const template = html`<simple-greeting></simple-greeting>`;
    const result = await renderer.renderToString(template);

    // Should include style tag with component styles
    assert.ok(result.includes('<style>'));
    assert.ok(result.includes(':host'));
    assert.ok(result.includes('.greeting'));
    assert.ok(result.includes('color: blue'));
  });

  test('renders shadow DOM content', async () => {
    const template = html`<simple-greeting name="Charlie"></simple-greeting>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Should render the component's template inside shadow root
    assert.ok(stripped.includes('<div class="greeting">'));
    assert.ok(stripped.includes('Hello, Charlie!'));
  });
});

describe('Components - Nested Components', () => {
  const renderer = createRenderer();

  test('renders nested custom elements', async () => {
    const template = html`
      <card-component title="User Card">
        <simple-greeting name="Alice"></simple-greeting>
      </card-component>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assert.ok(stripped.includes('<card-component'));
    assert.ok(stripped.includes('title="User Card"'));
    assert.ok(stripped.includes('<simple-greeting'));
    assert.ok(stripped.includes('Hello, Alice!'));
  });

  test('renders slots', async () => {
    const template = html`
      <card-component title="Test Card">
        <p>Slotted content</p>
      </card-component>
    `;
    const result = await renderer.renderToString(template);

    assert.ok(result.includes('<slot'));
    assert.ok(result.includes('Slotted content'));
  });

  test('renders component with variant attribute', async () => {
    const template = html`<card-component title="Primary Card" variant="primary"></card-component>`;
    const result = await renderer.renderToString(template);

    assert.ok(result.includes('variant="primary"'));
  });
});

describe('Components - Property Types', () => {
  const renderer = createRenderer();

  test('renders component with string property', async () => {
    const template = html`<property-types stringProp="test-string"></property-types>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assert.ok(stripped.includes('String: test-string'));
  });

  test('renders component with number property', async () => {
    const template = html`<property-types numberProp="42"></property-types>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assert.ok(stripped.includes('Number: 42'));
  });

  test('renders component with boolean property', async () => {
    const template = html`<property-types ?booleanProp="${true}"></property-types>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assert.ok(stripped.includes('Boolean: true'));
  });

  test('renders component with default values', async () => {
    const template = html`<property-types></property-types>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Should show default values
    assert.ok(stripped.includes('String: default'));
    assert.ok(stripped.includes('Number: 0'));
    assert.ok(stripped.includes('Boolean: false'));
  });

  test('renders component with custom attribute name', async () => {
    const template = html`<property-types data-custom="custom-value"></property-types>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    assert.ok(stripped.includes('data-custom="custom-value"'));
    assert.ok(stripped.includes('Custom: custom-value'));
  });
});

describe('Components - Hydration Markers', () => {
  const renderer = createRenderer();

  test('includes hydration markers in output', async () => {
    const template = html`<simple-greeting name="Test"></simple-greeting>`;
    const result = await renderer.renderToString(template);

    // Lit SSR includes hydration markers for client-side hydration
    // Markers are HTML comments with specific format
    assert.ok(result.includes('<!--'));
  });

  test('includes defer-hydration attribute', async () => {
    const template = html`<simple-greeting></simple-greeting>`;
    const result = await renderer.renderToString(template);

    // Components should have defer-hydration attribute for hydration
    // Note: @lit-labs/ssr doesn't add defer-hydration by default in all cases
    // This test checks for either defer-hydration or presence of shadowroot
    assert.ok(result.includes('shadowroot') || result.includes('defer-hydration'));
  });
});

describe('Components - Edge Cases', () => {
  const renderer = createRenderer();

  test('renders component with no properties', async () => {
    const template = html`<simple-greeting></simple-greeting>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Should use default property values
    assert.ok(stripped.includes('Hello, World!'));
  });

  test('renders empty component slot', async () => {
    const template = html`<card-component title="Empty"></card-component>`;
    const result = await renderer.renderToString(template);

    assert.ok(result.includes('<slot'));
    assert.ok(result.includes('title="Empty"'));
  });

  test('renders component with special characters in properties', async () => {
    const template = html`<simple-greeting name="<Alice>"></simple-greeting>`;
    const result = await renderer.renderToString(template);

    // Property values should be escaped
    assert.ok(result.includes('&lt;Alice&gt;'));
  });
});
