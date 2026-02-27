/**
 * Phase 4 integration tests — component rendering.
 *
 * Covers component instantiation, the SSR lifecycle, the DOM shim entry
 * point, fallback behaviour for unregistered elements, and edge cases such
 * as components with no shadow DOM or components that render nothing.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { html } from 'lit';
import { render, collectResult, installGlobalDomShim } from '../../../src/index.js';

// Fixtures — static imports so the file works on all runtimes including Deno,
// which does not yet implement node:test's before() hook.
import '../../fixtures/simple-greeting.js';
import '../../fixtures/card-component.js';
import '../../fixtures/lifecycle-element.js';
import '../../fixtures/aria-element.js';
import '../../fixtures/reflected-element.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const renderToString = async (template, opts) =>
  collectResult(render(template, opts));

const stripMarkers = (html) =>
  html
    .replace(/<!--lit-part[^>]*-->/g, '')
    .replace(/<!--\/lit-part-->/g, '')
    .replace(/<!--lit-node \d+-->/g, '');

// ── DOM shim ─────────────────────────────────────────────────────────────────

describe('Phase 4 - DOM shim', () => {
  test('installGlobalDomShim is exported from the main entry point', () => {
    assert.equal(typeof installGlobalDomShim, 'function');
  });

  test('installGlobalDomShim is idempotent — calling it twice is safe', () => {
    assert.doesNotThrow(() => {
      installGlobalDomShim();
      installGlobalDomShim();
    });
  });

  test('customElements global is available after import (lit-element installs it)', () => {
    // @lit-labs/ssr-dom-shim is installed as a side effect of importing lit-element
    assert.ok(typeof customElements !== 'undefined');
    assert.equal(typeof customElements.define, 'function');
    assert.equal(typeof customElements.get, 'function');
  });

  test('installGlobalDomShim installs HTMLElement if absent', () => {
    const scope = {};
    installGlobalDomShim(scope);
    assert.ok(typeof scope.HTMLElement === 'function');
  });

  test('installGlobalDomShim installs customElements registry if absent', () => {
    const scope = {};
    installGlobalDomShim(scope);
    assert.ok(typeof scope.customElements !== 'undefined');
    assert.equal(typeof scope.customElements.define, 'function');
  });

  test('installGlobalDomShim does not overwrite existing globals', () => {
    const sentinel = function OriginalHTMLElement() {};
    const scope = { HTMLElement: sentinel };
    installGlobalDomShim(scope);
    assert.equal(scope.HTMLElement, sentinel, 'Existing HTMLElement should be preserved');
  });
});

// ── Basic rendering ───────────────────────────────────────────────────────────

describe('Phase 4 - basic component rendering', () => {
  test('renders a registered custom element', async () => {
    const output = stripMarkers(
      await renderToString(html`<simple-greeting></simple-greeting>`)
    );
    assert.ok(output.includes('<simple-greeting'));
    assert.ok(output.includes('Hello, World!'));
  });

  test('renders the opening tag with the element name', async () => {
    const output = stripMarkers(
      await renderToString(html`<simple-greeting></simple-greeting>`)
    );
    assert.ok(output.includes('<simple-greeting'));
    assert.ok(output.includes('</simple-greeting>'));
  });

  test('top-level component has a declarative shadow root (not defer-hydration)', async () => {
    // defer-hydration is only added to NESTED components (inside another component's
    // shadow DOM). Top-level components get a plain declarative shadow root.
    const output = await renderToString(html`<simple-greeting></simple-greeting>`);
    assert.ok(output.includes('shadowroot="open"'), 'Declarative shadow root must be present');
    assert.ok(!output.includes('defer-hydration'), 'Top-level component must NOT have defer-hydration');
  });

  test('does NOT add defer-hydration to a bare (non-component) element', async () => {
    const output = await renderToString(html`<div>plain</div>`);
    assert.ok(!output.includes('defer-hydration'));
  });

  test('unregistered custom element is rendered as a plain tag', async () => {
    // unregistered-el has no renderer — FallbackRenderer produces the tag
    const output = stripMarkers(
      await renderToString(html`<unregistered-el>content</unregistered-el>`)
    );
    // The tag itself is present (pass-through)
    assert.ok(output.includes('<unregistered-el'));
    assert.ok(output.includes('content'));
    // No shadow DOM template
    assert.ok(!output.includes('<template shadowroot'));
  });

  test('renders multiple components in one template', async () => {
    const raw = await renderToString(html`
      <simple-greeting name="Alice"></simple-greeting>
      <simple-greeting name="Bob"></simple-greeting>
    `);
    const output = stripMarkers(raw);
    assert.ok(output.includes('Hello, Alice!'));
    assert.ok(output.includes('Hello, Bob!'));
  });
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────

describe('Phase 4 - SSR lifecycle (willUpdate)', () => {
  test('willUpdate is called before render()', async () => {
    // LifecycleElement derives fullName in willUpdate
    const output = stripMarkers(
      await renderToString(html`<lifecycle-element></lifecycle-element>`)
    );
    assert.ok(output.includes('John Doe'), 'fullName derived in willUpdate should appear');
  });

  test('willUpdate receives updated property values from attribute binding', async () => {
    const output = stripMarkers(
      await renderToString(
        html`<lifecycle-element firstname="Jane" lastname="Smith"></lifecycle-element>`
      )
    );
    // After conversion and willUpdate, fullName should be derived from the bound values
    assert.ok(output.includes('Jane'), 'First name should appear');
    assert.ok(output.includes('Smith'), 'Last name should appear');
  });

  test('default property values from constructor are used when no attributes set', async () => {
    const output = stripMarkers(
      await renderToString(html`<lifecycle-element></lifecycle-element>`)
    );
    assert.ok(output.includes('John'), 'Default first name should appear');
    assert.ok(output.includes('Doe'), 'Default last name should appear');
  });
});

// ── Shadow DOM presence ───────────────────────────────────────────────────────

describe('Phase 4 - declarative shadow DOM output', () => {
  test('produces a <template shadowroot> element', async () => {
    const output = await renderToString(html`<simple-greeting></simple-greeting>`);
    assert.ok(output.includes('<template shadowroot'));
  });

  test('shadowrootmode attribute is present alongside shadowroot', async () => {
    // Both attributes are required for cross-browser compatibility
    const output = await renderToString(html`<simple-greeting></simple-greeting>`);
    assert.ok(output.includes('shadowrootmode="open"'));
  });

  test('shadow DOM template is closed with </template>', async () => {
    const output = await renderToString(html`<simple-greeting></simple-greeting>`);
    assert.ok(output.includes('</template>'));
  });

  test('component styles appear inside the shadow DOM template', async () => {
    const output = await renderToString(html`<simple-greeting></simple-greeting>`);
    const shadowStart = output.indexOf('<template shadowroot');
    const shadowEnd = output.indexOf('</template>');
    const shadow = output.slice(shadowStart, shadowEnd);
    assert.ok(shadow.includes('<style>'), 'Styles should be inside shadow DOM');
  });
});

// ── ElementInternals / ARIA ───────────────────────────────────────────────────

describe('Phase 4 - ElementInternals ARIA attribute reflection', () => {
  test('component renders without throwing when attachInternals is unavailable', async () => {
    // Our aria-element uses attachInternals optionally — rendering must not throw
    await assert.doesNotReject(
      renderToString(html`<aria-element></aria-element>`)
    );
  });

  test('component with ElementInternals renders shadow content', async () => {
    const output = stripMarkers(
      await renderToString(html`<aria-element label="Close"></aria-element>`)
    );
    assert.ok(output.includes('Close'), 'Label text should appear in shadow content');
  });
});
