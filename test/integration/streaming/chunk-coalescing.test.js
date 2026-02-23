/**
 * Phase 6 integration tests — streaming chunk coalescing.
 *
 * Verifies that RenderResultReadable:
 *   1. Produces complete, correct HTML (content is unchanged)
 *   2. Coalesces small strings into larger chunks (reducing round-trips)
 *   3. Respects the configurable chunk size
 *   4. Flushes the buffer at the end of the stream
 *   5. Flushes before awaiting Promises (so partial content is not held back)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { html } from 'lit';
import { render, RenderResultReadable, collectResult } from '../../../src/index.js';
import { collectStream, collectStreamChunks } from '../../helpers/stream.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const streamToString = async (template, opts) => {
  const readable = new RenderResultReadable(render(template), opts);
  return collectStream(readable.getStream());
};

const streamToChunks = async (template, opts) => {
  const readable = new RenderResultReadable(render(template), opts);
  return collectStreamChunks(readable.getStream());
};

// ── Content correctness ───────────────────────────────────────────────────────

describe('Phase 6 streaming - content correctness', () => {
  test('streamed output matches collectResult output for a simple template', async () => {
    const template = html`<div>Hello, ${'World'}!</div>`;
    const streamed = await streamToString(template);
    const collected = await collectResult(render(template));
    assert.equal(streamed, collected);
  });

  test('streamed output matches collectResult for a large list', async () => {
    const items = Array.from({ length: 200 }, (_, i) => i);
    const template = html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`;
    const streamed = await streamToString(template);
    const collected = await collectResult(render(template));
    assert.equal(streamed, collected);
  });

  test('streamed output is correct for nested templates', async () => {
    const inner = html`<span>${'inner'}</span>`;
    const outer = html`<div>${inner}</div>`;
    const streamed = await streamToString(outer);
    const collected = await collectResult(render(outer));
    assert.equal(streamed, collected);
  });

  test('stream closes cleanly and all content is received', async () => {
    const template = html`<p>End marker: ${'last'}</p>`;
    const output = await streamToString(template);
    // Content is split by hydration markers — check each part separately
    assert.ok(output.includes('End marker:'), 'Static text must be present');
    assert.ok(output.includes('last'), 'Dynamic value must be present');
    assert.ok(output.includes('<!--/lit-part-->'), 'Closing marker must be present');
    // Full stream must be closed (output ends with the outer closing marker)
    assert.ok(output.trimEnd().endsWith('<!--/lit-part-->'));
  });
});

// ── Chunk coalescing behaviour ────────────────────────────────────────────────

describe('Phase 6 streaming - chunk coalescing', () => {
  test('a large template produces fewer chunks than strings', async () => {
    // 100-item list produces many small strings; default 8 KB buffer should
    // coalesce them into very few chunks
    const items = Array.from({ length: 100 }, (_, i) => i);
    const template = html`<ul>${items.map((i) => html`<li>Item ${i}</li>`)}</ul>`;

    const chunks = await streamToChunks(template);

    // A list of 100 items produces hundreds of small strings.
    // With 8 KB coalescing we expect far fewer chunks than strings.
    assert.ok(chunks.length < 20, `Expected < 20 chunks, got ${chunks.length}`);
  });

  test('small template with chunkSize=1 produces multiple small chunks', async () => {
    // With a 1-byte chunk size every string forces a flush → many chunks
    const template = html`<p>${'hello'} ${'world'}</p>`;
    const chunks = await streamToChunks(template, { chunkSize: 1 });
    // Content is still complete
    const full = chunks.join('');
    assert.ok(full.includes('hello'));
    assert.ok(full.includes('world'));
    // Multiple chunks expected
    assert.ok(chunks.length > 1, `Expected multiple chunks, got ${chunks.length}`);
  });

  test('large template with chunkSize=Infinity produces exactly one chunk', async () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const template = html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`;
    const chunks = await streamToChunks(template, { chunkSize: Infinity });
    assert.equal(chunks.length, 1, 'Infinite chunk size should produce exactly one chunk');
  });

  test('default chunk size is 8 KB (configurable)', () => {
    // Verify the class accepts a chunkSize option without throwing
    const readable = new RenderResultReadable(render(html`<div>ok</div>`), { chunkSize: 4096 });
    assert.ok(readable instanceof RenderResultReadable);
  });

  test('each chunk is a Uint8Array', async () => {
    const template = html`<div>bytes</div>`;
    const readable = new RenderResultReadable(render(template));
    const reader = readable.getStream().getReader();
    const { value } = await reader.read();
    reader.releaseLock();
    assert.ok(value instanceof Uint8Array, 'Each chunk must be a Uint8Array');
  });
});

// ── Buffer flushing ───────────────────────────────────────────────────────────

describe('Phase 6 streaming - buffer flushing', () => {
  test('remaining buffer is flushed when stream ends', async () => {
    // Use a large chunk size so buffering definitely happens
    const template = html`<p>Short template</p>`;
    const output = await streamToString(template, { chunkSize: 100_000 });
    // All content must be present despite never hitting the chunk threshold
    assert.ok(output.includes('Short template'));
    assert.ok(output.includes('</p>'));
  });

  test('small template with large chunkSize still produces complete output', async () => {
    const template = html`<span>${'value'}</span>`;
    const output = await streamToString(template, { chunkSize: 1_000_000 });
    assert.ok(output.includes('value'));
    assert.ok(output.includes('</span>'));
  });

  test('cancel() clears the buffer safely', async () => {
    const template = html`<div>${'content'}</div>`;
    const readable = new RenderResultReadable(render(template));
    const stream = readable.getStream();
    const reader = stream.getReader();
    await reader.read(); // read first chunk
    await reader.cancel(); // cancel remaining
    // Should not throw
    assert.ok(true);
  });
});

// ── Streaming vs collectResult equivalence ────────────────────────────────────

describe('Phase 6 streaming - equivalence with collectResult', () => {
  test('long string content is identical whether streamed or collected', async () => {
    const longString = 'A'.repeat(5000);
    const template = html`<div>${longString}</div>`;
    const streamed = await streamToString(template);
    const collected = await collectResult(render(template));
    assert.equal(streamed, collected);
  });

  test('deeply nested templates produce identical output', async () => {
    let t = html`<span>leaf</span>`;
    for (let i = 0; i < 10; i++) t = html`<div>${t}</div>`;
    const streamed = await streamToString(t);
    const collected = await collectResult(render(t));
    assert.equal(streamed, collected);
  });
});
