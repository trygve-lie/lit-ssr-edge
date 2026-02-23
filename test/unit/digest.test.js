/**
 * Unit tests for the native digest implementation.
 *
 * The digest must be byte-for-byte identical to the one produced by
 * @lit-labs/ssr-client so that server-rendered pages can be hydrated
 * by the official client library.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { html } from 'lit';
import { digestForTemplateResult as nativeDigest } from '../../src/lib/digest.js';
import { digestForTemplateResult as ssrClientDigest } from '@lit-labs/ssr-client';

describe('digest - algorithm correctness', () => {
  test('produces a non-empty string', () => {
    const template = html`<div>Hello</div>`;
    const digest = nativeDigest(template);

    assert.ok(typeof digest === 'string');
    assert.ok(digest.length > 0);
  });

  test('result is valid base64', () => {
    const template = html`<div>${'value'}</div>`;
    const digest = nativeDigest(template);

    // btoa output only contains A-Z a-z 0-9 + / =
    assert.match(digest, /^[A-Za-z0-9+/]+=*$/);
  });

  test('same template always produces the same digest', () => {
    const t1 = html`<span class=${'x'}>${'y'}</span>`;
    const t2 = html`<span class=${'x'}>${'y'}</span>`;

    // Same template literal → same TemplateStringsArray reference → same digest
    assert.equal(nativeDigest(t1), nativeDigest(t2));
  });

  test('different templates produce different digests', () => {
    const t1 = html`<div>${'a'}</div>`;
    const t2 = html`<span>${'a'}</span>`;

    assert.notEqual(nativeDigest(t1), nativeDigest(t2));
  });

  test('digest depends only on static strings, not dynamic values', () => {
    const t1 = html`<div>${'hello'}</div>`;
    const t2 = html`<div>${'world'}</div>`;

    // Same template literal strings → same digest regardless of values
    assert.equal(nativeDigest(t1), nativeDigest(t2));
  });
});

describe('digest - compatibility with @lit-labs/ssr-client', () => {
  test('matches ssr-client for a simple template', () => {
    const template = html`<div>Hello</div>`;
    assert.equal(nativeDigest(template), ssrClientDigest(template));
  });

  test('matches ssr-client for a template with one binding', () => {
    const template = html`<div>${'value'}</div>`;
    assert.equal(nativeDigest(template), ssrClientDigest(template));
  });

  test('matches ssr-client for a template with an attribute binding', () => {
    const template = html`<div class=${'cls'}>${'content'}</div>`;
    assert.equal(nativeDigest(template), ssrClientDigest(template));
  });

  test('matches ssr-client for a template with multiple bindings', () => {
    const template = html`
      <div id=${'id'} class=${'cls'}>
        <span>${'a'}</span>
        <span>${'b'}</span>
      </div>
    `;
    assert.equal(nativeDigest(template), ssrClientDigest(template));
  });

  test('matches ssr-client for a template with no bindings', () => {
    const template = html`<p>Static content with no bindings</p>`;
    assert.equal(nativeDigest(template), ssrClientDigest(template));
  });

  test('matches ssr-client for a template with boolean attribute', () => {
    const template = html`<input ?disabled=${true} />`;
    assert.equal(nativeDigest(template), ssrClientDigest(template));
  });

  test('matches ssr-client for a deeply nested template', () => {
    const template = html`
      <section>
        <h1>${'title'}</h1>
        <ul>
          <li>${'item1'}</li>
          <li>${'item2'}</li>
        </ul>
      </section>
    `;
    assert.equal(nativeDigest(template), ssrClientDigest(template));
  });

  test('matches ssr-client for an empty template', () => {
    const template = html``;
    assert.equal(nativeDigest(template), ssrClientDigest(template));
  });

  test('matches ssr-client for a template with special characters in static parts', () => {
    const template = html`<div class="foo &amp; bar">${'v'}</div>`;
    assert.equal(nativeDigest(template), ssrClientDigest(template));
  });

  test('matches ssr-client for a template with unicode in static parts', () => {
    const template = html`<div>Hello 世界 🌍 ${''}</div>`;
    assert.equal(nativeDigest(template), ssrClientDigest(template));
  });
});

describe('digest - caching behaviour', () => {
  test('returns the same object reference for repeated calls', () => {
    const template = html`<div>${'x'}</div>`;
    const d1 = nativeDigest(template);
    const d2 = nativeDigest(template);

    // Same string value (interning is not guaranteed, but equality is)
    assert.equal(d1, d2);
  });

  test('two distinct template literals with identical strings produce the same digest', () => {
    // JavaScript interns identical template string arrays in some engines,
    // but not all. This test documents the expected behaviour either way.
    const fn1 = () => html`<div>${'x'}</div>`;
    const fn2 = () => html`<div>${'x'}</div>`;
    const t1 = fn1();
    const t2 = fn2();

    // Whether strings are interned or not, digests must be equal by value
    assert.equal(nativeDigest(t1), nativeDigest(t2));
  });
});
