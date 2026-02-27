/**
 * Phase 4 integration tests — shadow DOM and slot rendering.
 *
 * Verifies declarative shadow DOM output, style serialisation, named and
 * unnamed slots, nested shadow roots, and shadow root option variants
 * (delegatesFocus, closed mode).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { html, css } from 'lit';
import { LitElement } from 'lit';
import { render, collectResult } from '../../../src/index.js';

// Fixtures — static imports so the file works on all runtimes including Deno,
// which does not yet implement node:test's before() hook.
import '../../fixtures/simple-greeting.js';
import '../../fixtures/card-component.js';

// ── Inline fixtures for Phase 4-specific scenarios ────────────────────────────
// Defined at module scope (not inside before()) for cross-runtime compatibility.

class FocusDelegator extends LitElement {
  static shadowRootOptions = { mode: 'open', delegatesFocus: true };
  render() {
    return html`<button>Focus me</button>`;
  }
}
if (!customElements.get('focus-delegator')) {
  customElements.define('focus-delegator', FocusDelegator);
}

class EmptyRenderer extends LitElement {
  render() {
    return html``;
  }
}
if (!customElements.get('empty-renderer')) {
  customElements.define('empty-renderer', EmptyRenderer);
}

class SlottedCard extends LitElement {
  static styles = css`:host { display: block; }`;
  render() {
    return html`
      <header><slot name="header">Default header</slot></header>
      <main><slot></slot></main>
      <footer><slot name="footer">Default footer</slot></footer>
    `;
  }
}
if (!customElements.get('slotted-card')) {
  customElements.define('slotted-card', SlottedCard);
}

class InnerComponent extends LitElement {
  static properties = { value: { type: String } };
  constructor() { super(); this.value = 'inner'; }
  render() {
    return html`<span class="inner-value">${this.value}</span>`;
  }
}
if (!customElements.get('inner-component')) {
  customElements.define('inner-component', InnerComponent);
}

class OuterComponent extends LitElement {
  render() {
    return html`
      <div class="outer-wrapper">
        <inner-component value="nested"></inner-component>
      </div>
    `;
  }
}
if (!customElements.get('outer-component')) {
  customElements.define('outer-component', OuterComponent);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const renderToString = async (template) => collectResult(render(template));

const stripMarkers = (str) =>
  str
    .replace(/<!--lit-part[^>]*-->/g, '')
    .replace(/<!--\/lit-part-->/g, '')
    .replace(/<!--lit-node \d+-->/g, '');

// ── Declarative shadow DOM format ─────────────────────────────────────────────

describe('Phase 4 - declarative shadow DOM structure', () => {
  test('shadow root uses <template shadowroot="open"> with mode attribute', async () => {
    const output = await renderToString(html`<simple-greeting></simple-greeting>`);
    assert.ok(output.includes('shadowroot="open"'));
    assert.ok(output.includes('shadowrootmode="open"'));
  });

  test('shadow DOM template is properly enclosed', async () => {
    const output = await renderToString(html`<simple-greeting></simple-greeting>`);
    const start = output.indexOf('<template shadowroot');
    const end = output.indexOf('</template>', start);
    assert.ok(start !== -1, 'Shadow root template must open');
    assert.ok(end !== -1, 'Shadow root template must close');
    assert.ok(start < end, 'Opening must precede closing');
  });

  test('light DOM children appear after the shadow DOM template', async () => {
    const output = await renderToString(html`
      <card-component title="Test">
        <p>Light DOM child</p>
      </card-component>
    `);
    const templateEnd = output.indexOf('</template>');
    const lightDomIdx = output.indexOf('Light DOM child');
    assert.ok(lightDomIdx > templateEnd, 'Light DOM must appear after </template>');
  });
});

// ── Style serialisation ───────────────────────────────────────────────────────

describe('Phase 4 - style serialisation', () => {
  test('component styles are rendered inside the shadow DOM template', async () => {
    const output = await renderToString(html`<simple-greeting></simple-greeting>`);
    const shadowStart = output.indexOf('<template shadowroot');
    const shadowEnd = output.indexOf('</template>', shadowStart);
    const shadow = output.slice(shadowStart, shadowEnd);

    assert.ok(shadow.includes('<style>'), 'Style tag must be inside shadow DOM');
    assert.ok(shadow.includes('</style>'), 'Style tag must be properly closed');
  });

  test(':host CSS selector is preserved in the style output', async () => {
    const output = await renderToString(html`<simple-greeting></simple-greeting>`);
    assert.ok(output.includes(':host'), ':host rules must be serialised');
  });

  test('component with multiple style blocks serialises all of them', async () => {
    const output = await renderToString(html`<card-component></card-component>`);
    // card-component has :host and :host([variant="primary"]) rules
    assert.ok(output.includes(':host'));
    assert.ok(output.includes('.card-header'));
    assert.ok(output.includes('.card-body'));
  });

  test('component without styles has no <style> in shadow DOM', async () => {
    const output = await renderToString(html`<empty-renderer></empty-renderer>`);
    const shadowStart = output.indexOf('<template shadowroot');
    const shadowEnd = output.indexOf('</template>', shadowStart);
    const shadow = output.slice(shadowStart, shadowEnd);

    assert.ok(!shadow.includes('<style>'), 'No style tag expected for unstyled component');
  });
});

// ── Shadow root options ───────────────────────────────────────────────────────

describe('Phase 4 - shadow root options', () => {
  test('delegatesFocus adds shadowrootdelegatesfocus attribute', async () => {
    const output = await renderToString(html`<focus-delegator></focus-delegator>`);
    assert.ok(
      output.includes('shadowrootdelegatesfocus'),
      'delegatesFocus should add shadowrootdelegatesfocus to <template>'
    );
  });

  test('default shadow root has no shadowrootdelegatesfocus', async () => {
    const output = await renderToString(html`<simple-greeting></simple-greeting>`);
    assert.ok(
      !output.includes('shadowrootdelegatesfocus'),
      'Non-delegating components should not have the attribute'
    );
  });
});

// ── Slots ─────────────────────────────────────────────────────────────────────

describe('Phase 4 - slot rendering', () => {
  test('unnamed slot renders <slot> in shadow DOM', async () => {
    const output = await renderToString(html`<card-component></card-component>`);
    const shadowStart = output.indexOf('<template shadowroot');
    const shadowEnd = output.indexOf('</template>', shadowStart);
    const shadow = output.slice(shadowStart, shadowEnd);
    assert.ok(shadow.includes('<slot>'), 'Unnamed slot element must appear in shadow DOM');
  });

  test('named slot renders <slot name="..."> in shadow DOM', async () => {
    const output = await renderToString(html`<slotted-card></slotted-card>`);
    const shadowStart = output.indexOf('<template shadowroot');
    const shadowEnd = output.indexOf('</template>', shadowStart);
    const shadow = output.slice(shadowStart, shadowEnd);
    assert.ok(shadow.includes('name="header"'), 'Named header slot must be present');
    assert.ok(shadow.includes('name="footer"'), 'Named footer slot must be present');
  });

  test('slotted light DOM content is rendered outside the shadow template', async () => {
    const output = await renderToString(html`
      <card-component title="My Card">
        <p>Slotted paragraph</p>
      </card-component>
    `);
    const shadowEnd = output.indexOf('</template>');
    const slottedIdx = output.indexOf('Slotted paragraph');
    assert.ok(slottedIdx > shadowEnd, 'Slotted content must be after shadow template');
  });

  test('named slot content appears in light DOM', async () => {
    const output = await renderToString(html`
      <slotted-card>
        <h1 slot="header">My Header</h1>
        <p>Body content</p>
        <div slot="footer">Footer text</div>
      </slotted-card>
    `);
    assert.ok(output.includes('My Header'));
    assert.ok(output.includes('Body content'));
    assert.ok(output.includes('Footer text'));
  });
});

// ── Nested components ─────────────────────────────────────────────────────────

describe('Phase 4 - nested component rendering', () => {
  test('nested component is rendered inside outer shadow DOM', async () => {
    const output = await renderToString(html`<outer-component></outer-component>`);
    assert.ok(output.includes('<inner-component'), 'Inner component tag must be present');
    assert.ok(output.includes('nested'), 'Inner component value must be rendered');
  });

  test('each nested component has its own shadow DOM template', async () => {
    const output = await renderToString(html`<outer-component></outer-component>`);
    // Count shadow root templates — outer and inner each produce one
    const templateCount = (output.match(/<template shadowroot/g) ?? []).length;
    assert.ok(templateCount >= 2, 'Outer and inner components must each have a shadow root');
  });

  test('nested component gets defer-hydration attribute', async () => {
    const output = await renderToString(html`<outer-component></outer-component>`);
    // Inner component is nested inside outer's shadow — must defer hydration
    const innerStart = output.indexOf('<inner-component');
    const innerTag = output.slice(innerStart, output.indexOf('>', innerStart));
    assert.ok(innerTag.includes('defer-hydration'), 'Nested component must have defer-hydration');
  });
});
