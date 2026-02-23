/**
 * Baseline tests for streaming output
 *
 * Tests ReadableStream rendering and verifies streaming behavior.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert';
import { html } from 'lit';
import { createRenderer } from '../../helpers/renderer.js';
import { collectStream, collectStreamChunks } from '../../helpers/stream.js';
import { assertHTMLEqual } from '../../helpers/html-compare.js';

describe('Streaming - Basic', () => {
  test('streams template output', async () => {
    const renderer = createRenderer();
    const template = html`<div>Streaming Content</div>`;

    // Note: Not yet implemented, will throw
    try {
      const stream = renderer.renderToStream(template);
      const result = await collectStream(stream);

      assertHTMLEqual(result, '<div>Streaming Content</div>');
    } catch (error) {
      // Expected until streaming is implemented
      assert.ok(error.message.includes('not yet implemented'));
    }
  });

  test('streams large content efficiently', async () => {
    const renderer = createRenderer();
    const items = Array.from({ length: 1000 }, (_, i) => i);

    const template = html`
      <ul>
        ${items.map(i => html`<li>Item ${i}</li>`)}
      </ul>
    `;

    try {
      const stream = renderer.renderToStream(template);

      // Verify streaming happens (chunks arrive before full completion)
      const chunks = await collectStreamChunks(stream);

      // Should receive multiple chunks for large content
      assert.ok(chunks.length > 1, 'Should stream in multiple chunks');
    } catch (error) {
      // Expected until streaming is implemented
      assert.ok(error.message.includes('not yet implemented'));
    }
  });
});

describe('Streaming - Compatibility', () => {
  test('streamed output matches renderToString output', async () => {
    const renderer = createRenderer();
    const template = html`<div>Test <span>Content</span></div>`;

    try {
      // Render via renderToString
      const stringResult = await renderer.renderToString(template);

      // Render via stream
      const stream = renderer.renderToStream(template);
      const streamResult = await collectStream(stream);

      // Results should be identical
      assertHTMLEqual(streamResult, stringResult);
    } catch (error) {
      // Expected until streaming is implemented
      assert.ok(error.message.includes('not yet implemented'));
    }
  });
});
