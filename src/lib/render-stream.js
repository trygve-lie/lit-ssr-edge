/**
 * Web Streams wrapper for RenderResult.
 *
 * Converts a RenderResult (iterable of strings and thunks) into a Web Streams
 * ReadableStream<Uint8Array>, suitable for use with the Response constructor
 * on edge runtimes (Cloudflare Workers, Fastly Compute, etc.).
 *
 * This replaces @lit-labs/ssr's RenderResultReadable which extends Node's
 * stream.Readable. No Node.js APIs are used here.
 */

const encoder = new TextEncoder();

/**
 * Wraps a RenderResult in a Web Streams ReadableStream.
 *
 * @example
 * ```js
 * import { render } from './render.js';
 * import { RenderResultReadable } from './render-stream.js';
 * import { html } from 'lit';
 *
 * const template = html`<div>Hello</div>`;
 * const result = render(template);
 * const readable = new RenderResultReadable(result);
 *
 * return new Response(readable.getStream(), {
 *   headers: { 'Content-Type': 'text/html; charset=utf-8' },
 * });
 * ```
 */
export class RenderResultReadable {
  /**
   * @param {Iterable} result - RenderResult from render()
   */
  constructor(result) {
    this._result = result;
  }

  /**
   * Returns the underlying ReadableStream<Uint8Array>.
   *
   * @returns {ReadableStream<Uint8Array>}
   */
  getStream() {
    const iterators = [this._result[Symbol.iterator]()];

    return new ReadableStream({
      async pull(controller) {
        while (iterators.length > 0) {
          const iterator = iterators.at(-1);
          const next = iterator.next();

          if (next.done) {
            iterators.pop();
            continue;
          }

          let value = next.value;

          // Resolve thunks.
          while (typeof value === 'function') {
            value = value();
          }

          if (value === undefined) {
            continue;
          }

          if (typeof value === 'string') {
            controller.enqueue(encoder.encode(value));
            // Yield control back after each chunk to allow backpressure.
            return;
          }

          if (Array.isArray(value) || typeof value[Symbol.iterator] === 'function') {
            iterators.push(value[Symbol.iterator]());
            continue;
          }

          // Must be a Promise.
          if (typeof value.then === 'function') {
            value = await value;
            if (typeof value === 'string') {
              controller.enqueue(encoder.encode(value));
              return;
            }
            if (Array.isArray(value) || typeof value[Symbol.iterator] === 'function') {
              iterators.push(value[Symbol.iterator]());
            }
            continue;
          }
        }

        controller.close();
      },

      cancel() {
        iterators.length = 0;
      },
    });
  }
}
