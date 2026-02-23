/**
 * Baseline tests for declarative shadow DOM generation
 *
 * Tests shadow root rendering, slot distribution, and style encapsulation.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert';
import { html } from 'lit';
import { createRenderer, stripHydrationMarkers } from '../../helpers/renderer.js';

// Import test fixtures
import '../../fixtures/simple-greeting.js';
import '../../fixtures/card-component.js';

describe('Shadow DOM - Basic', () => {
  const renderer = createRenderer();

  test('generates declarative shadow DOM', async () => {
    const template = html`<simple-greeting></simple-greeting>`;
    const result = await renderer.renderToString(template);

    // Should include declarative shadow DOM template tag
    assert.ok(result.includes('<template shadowroot'));
    assert.ok(result.includes('shadowroot="open"') || result.includes('shadowrootmode="open"'));
  });

  test('renders shadow root content', async () => {
    const template = html`<simple-greeting name="Test"></simple-greeting>`;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Should render component's template inside shadow root
    assert.ok(stripped.includes('Hello, Test!'));
  });

  test('includes component styles in shadow root', async () => {
    const template = html`<simple-greeting></simple-greeting>`;
    const result = await renderer.renderToString(template);

    // Should include style tag with component styles
    assert.ok(result.includes('<style>'));
    assert.ok(result.includes(':host'));
    assert.ok(result.includes('.greeting'));
  });
});

describe('Shadow DOM - Slots', () => {
  const renderer = createRenderer();

  test('renders slot elements', async () => {
    const template = html`
      <card-component title="Test Card">
        <p>Slotted content</p>
      </card-component>
    `;
    const result = await renderer.renderToString(template);

    // Should include slot element
    assert.ok(result.includes('<slot'));
  });

  test('preserves slotted light DOM content', async () => {
    const template = html`
      <card-component title="Card">
        <p>Light DOM content</p>
      </card-component>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Light DOM content should be preserved outside shadow root
    assert.ok(stripped.includes('<p>Light DOM content</p>'));
  });

  test('renders named slots', async () => {
    const template = html`
      <card-component title="Named Slot">
        <span slot="header">Header Content</span>
        <p>Default slot content</p>
      </card-component>
    `;
    const result = await renderer.renderToString(template);

    // Should preserve slot attribute in light DOM
    assert.ok(result.includes('slot="header"'));
  });
});

describe('Shadow DOM - Style Encapsulation', () => {
  const renderer = createRenderer();

  test('includes :host selector styles', async () => {
    const template = html`<simple-greeting></simple-greeting>`;
    const result = await renderer.renderToString(template);

    // Should include :host selector
    assert.ok(result.includes(':host {'));
    assert.ok(result.includes(':host'));
  });

  test('includes scoped CSS selectors', async () => {
    const template = html`<simple-greeting></simple-greeting>`;
    const result = await renderer.renderToString(template);

    // Should include component's scoped selectors
    assert.ok(result.includes('.greeting'));
  });

  test('multiple components have separate shadow roots', async () => {
    const template = html`
      <simple-greeting name="First"></simple-greeting>
      <simple-greeting name="Second"></simple-greeting>
    `;
    const result = await renderer.renderToString(template);

    // Should have multiple shadow root templates
    const shadowRootMatches = result.match(/<template shadowroot/g);
    assert.ok(shadowRootMatches && shadowRootMatches.length >= 2);
  });
});

describe('Shadow DOM - Nested Components', () => {
  const renderer = createRenderer();

  test('renders nested shadow roots', async () => {
    const template = html`
      <card-component title="Outer">
        <simple-greeting name="Inner"></simple-greeting>
      </card-component>
    `;
    const result = await renderer.renderToString(template);

    // Should have multiple shadow roots (one for card, one for greeting)
    const shadowRootMatches = result.match(/<template shadowroot/g);
    assert.ok(shadowRootMatches && shadowRootMatches.length >= 2);
  });

  test('preserves component hierarchy', async () => {
    const template = html`
      <card-component title="Parent">
        <simple-greeting name="Child"></simple-greeting>
      </card-component>
    `;
    const result = await renderer.renderToString(template);
    const stripped = stripHydrationMarkers(result);

    // Both components should be present
    assert.ok(stripped.includes('<card-component'));
    assert.ok(stripped.includes('<simple-greeting'));
    assert.ok(stripped.includes('Hello, Child!'));
  });
});
