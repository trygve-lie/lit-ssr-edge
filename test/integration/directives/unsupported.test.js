/**
 * Phase 5 integration tests — unsupported (client-only) directives.
 *
 * Verifies that lit-ssr-edge throws a clear, informative error when a directive
 * that requires browser DOM APIs or asynchronous update cycles is used during
 * server-side rendering.
 *
 * Unsupported directives: cache, live, until, asyncAppend, asyncReplace,
 *                         ref, templateContent
 *
 * The error message must:
 *   1. Name the specific directive that was used
 *   2. Explain why it is not supported in SSR
 *   3. List the supported alternatives
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { html } from 'lit';
import { render, collectResult } from '../../../src/index.js';
import { cache }           from 'lit/directives/cache.js';
import { live }            from 'lit/directives/live.js';
import { until }           from 'lit/directives/until.js';
import { asyncAppend }     from 'lit/directives/async-append.js';
import { asyncReplace }    from 'lit/directives/async-replace.js';
import { ref }             from 'lit/directives/ref.js';
import { templateContent } from 'lit/directives/template-content.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Attempts to render a template and asserts that it throws.
 * Returns the caught error so callers can make additional assertions.
 *
 * @param {TemplateResult} template
 * @returns {Promise<Error>}
 */
async function assertThrows(template) {
  try {
    await collectResult(render(template));
    throw new assert.AssertionError({
      message: 'Expected render to throw but it did not',
    });
  } catch (err) {
    if (err instanceof assert.AssertionError) throw err;
    return err;
  }
}

const emptyAsyncIter = {
  [Symbol.asyncIterator]: () => ({
    next: async () => ({ done: true, value: undefined }),
  }),
};

// ── Error shape ───────────────────────────────────────────────────────────────

describe('Phase 5 unsupported directives - error message shape', () => {
  test('error is an instance of Error', async () => {
    const err = await assertThrows(html`<div>${cache(html`<p>x</p>`)}</div>`);
    assert.ok(err instanceof Error);
  });

  test('error message names the directive', async () => {
    const err = await assertThrows(html`<div>${cache(html`<p>x</p>`)}</div>`);
    assert.ok(err.message.includes('cache'), `Expected "cache" in: ${err.message}`);
  });

  test('error message lists supported alternatives', async () => {
    const err = await assertThrows(html`<div>${cache(html`<p>x</p>`)}</div>`);
    // The error message should mention at least one supported directive
    assert.ok(
      err.message.includes('repeat') || err.message.includes('when') || err.message.includes('classMap'),
      `Expected supported directives to be listed in: ${err.message}`
    );
  });
});

// ── cache ────────────────────────────────────────────────────────────────────

describe('Phase 5 unsupported directives - cache', () => {
  test('throws when cache is used in a child part', async () => {
    const err = await assertThrows(html`<div>${cache(html`<p>hi</p>`)}</div>`);
    assert.ok(err.message.includes('cache'));
  });

  test('error message explains SSR incompatibility', async () => {
    const err = await assertThrows(html`<div>${cache(html`<p>hi</p>`)}</div>`);
    assert.ok(
      err.message.toLowerCase().includes('server') ||
      err.message.toLowerCase().includes('ssr') ||
      err.message.toLowerCase().includes('not supported'),
      `Error message should explain SSR incompatibility: ${err.message}`
    );
  });
});

// ── live ─────────────────────────────────────────────────────────────────────

describe('Phase 5 unsupported directives - live', () => {
  test('throws when live is used in an attribute binding', async () => {
    const err = await assertThrows(html`<input .value="${live('hello')}" />`);
    assert.ok(err.message.includes('live'));
  });
});

// ── until ─────────────────────────────────────────────────────────────────────

describe('Phase 5 unsupported directives - until', () => {
  test('throws when until is used with a Promise', async () => {
    const err = await assertThrows(html`<div>${until(Promise.resolve('async'))}</div>`);
    assert.ok(err.message.includes('until'));
  });

  test('throws when until is used with no arguments', async () => {
    const err = await assertThrows(html`<div>${until()}</div>`);
    assert.ok(err.message.includes('until'));
  });
});

// ── asyncAppend ───────────────────────────────────────────────────────────────

describe('Phase 5 unsupported directives - asyncAppend', () => {
  test('throws when asyncAppend is used', async () => {
    const err = await assertThrows(html`<div>${asyncAppend(emptyAsyncIter)}</div>`);
    assert.ok(err.message.includes('asyncAppend'));
  });
});

// ── asyncReplace ──────────────────────────────────────────────────────────────

describe('Phase 5 unsupported directives - asyncReplace', () => {
  test('throws when asyncReplace is used', async () => {
    const err = await assertThrows(html`<div>${asyncReplace(emptyAsyncIter)}</div>`);
    assert.ok(err.message.includes('asyncReplace'));
  });
});

// ── ref ───────────────────────────────────────────────────────────────────────
//
// ref is an element-part directive: it is placed on an element tag (not inside
// a child expression). The element-part opcode silently skips it — the element
// is rendered correctly but the ref callback is never invoked.
//
// This matches @lit-labs/ssr behaviour: ref does not throw in SSR; it simply
// does nothing. Not setting a ref callback on the server is correct because
// there is no real DOM element to reference.

describe('Phase 5 directives - ref (element-part, silently does nothing)', () => {
  test('ref in element position does not throw', async () => {
    await assert.doesNotReject(
      collectResult(render(html`<div ${ref(() => {})}></div>`))
    );
  });

  test('element with ref still renders correctly', async () => {
    const output = await collectResult(render(html`<span ${ref(() => {})} id="x">text</span>`));
    const stripped = output
      .replace(/<!--lit-part[^>]*-->/g, '')
      .replace(/<!--\/lit-part-->/g, '')
      .replace(/<!--lit-node \d+-->/g, '');
    assert.ok(stripped.includes('<span'), 'Element must be rendered');
    assert.ok(stripped.includes('text'), 'Element content must be rendered');
  });

  test('ref with a Ref object does not throw and renders the element', async () => {
    const { createRef } = await import('lit/directives/ref.js');
    const r = createRef();
    // r.value will be undefined (no DOM, no assignment) — but rendering succeeds
    const output = await collectResult(render(html`<span ${ref(r)}>content</span>`));
    const stripped = output
      .replace(/<!--lit-part[^>]*-->/g, '')
      .replace(/<!--\/lit-part-->/g, '')
      .replace(/<!--lit-node \d+-->/g, '');
    assert.ok(stripped.includes('content'), 'Element content must appear in output');
  });
});

// ── templateContent ───────────────────────────────────────────────────────────

describe('Phase 5 unsupported directives - templateContent', () => {
  test('throws when templateContent is used', async () => {
    // Pass null as a placeholder — the error is thrown before render() is called
    const err = await assertThrows(html`<div>${templateContent(null)}</div>`);
    assert.ok(err.message.includes('templateContent'));
  });
});
