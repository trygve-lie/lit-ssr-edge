/**
 * Web Streams wrapper for RenderResult.
 *
 * Converts a RenderResult (iterable of strings and thunks) into a Web Streams
 * ReadableStream<Uint8Array>, suitable for use with the Response constructor
 * on edge runtimes (Cloudflare Workers, Fastly Compute, etc.).
 *
 * This replaces @lit-labs/ssr's RenderResultReadable which extends Node's
 * stream.Readable. No Node.js APIs are used here.
 *
 * ## Chunk coalescing
 *
 * Lit SSR produces many small strings (hydration markers, tag names, attribute
 * strings, text content). Encoding and enqueueing each one individually creates
 * excessive overhead on the ReadableStream machinery.
 *
 * RenderResultReadable buffers strings until the accumulated length reaches
 * `chunkSize` bytes (default 8 KB), then encodes the entire buffer as a single
 * Uint8Array chunk. This matches the streaming behaviour recommended by the
 * WinterTC spec and significantly reduces CPU overhead on edge runtimes.
 *
 * The buffer is flushed immediately when a Promise is awaited, ensuring that
 * partially-rendered content is not held back while waiting for async data.
 */

const encoder = new TextEncoder();

/** Default target chunk size in bytes (8 KB). */
const DEFAULT_CHUNK_SIZE = 8 * 1024;

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
 *
 * @example Custom chunk size (e.g. for low-latency streaming):
 * ```js
 * const readable = new RenderResultReadable(result, { chunkSize: 1024 });
 * ```
 */
export class RenderResultReadable {
  /**
   * @param {Iterable} result - RenderResult from render()
   * @param {object} [options]
   * @param {number} [options.chunkSize=8192] - Target chunk size in bytes.
   *   Strings are buffered until this threshold is reached, then flushed as a
   *   single encoded Uint8Array. Use a smaller value for lower time-to-first-byte
   *   at the cost of higher per-chunk overhead.
   */
  constructor(result, { chunkSize = DEFAULT_CHUNK_SIZE } = {}) {
    this._result = result;
    this._chunkSize = chunkSize;
  }

  /**
   * Returns the underlying ReadableStream<Uint8Array>.
   *
   * @returns {ReadableStream<Uint8Array>}
   */
  getStream() {
    const iterators = [this._result[Symbol.iterator]()];
    const chunkSize = this._chunkSize;
    let buffer = '';

    /**
     * Encodes and enqueues whatever is in `buffer`, then clears it.
     * No-op if the buffer is empty.
     *
     * @param {ReadableStreamDefaultController} controller
     */
    function flush(controller) {
      if (buffer.length > 0) {
        controller.enqueue(encoder.encode(buffer));
        buffer = '';
      }
    }

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
            buffer += value;
            // Flush once we reach the target chunk size. Yield after flushing
            // so the stream consumer can apply backpressure.
            if (buffer.length >= chunkSize) {
              flush(controller);
              return;
            }
            // Otherwise keep accumulating — don't yield yet.
            continue;
          }

          if (Array.isArray(value) || typeof value[Symbol.iterator] === 'function') {
            iterators.push(value[Symbol.iterator]());
            continue;
          }

          // Must be a Promise. Flush the buffer before awaiting so that
          // already-rendered content reaches the client without delay.
          if (typeof value.then === 'function') {
            flush(controller);
            value = await value;
            if (typeof value === 'string') {
              buffer += value;
              if (buffer.length >= chunkSize) {
                flush(controller);
                return;
              }
              continue;
            }
            if (Array.isArray(value) || typeof value[Symbol.iterator] === 'function') {
              iterators.push(value[Symbol.iterator]());
            }
            continue;
          }
        }

        // All iterators exhausted — flush any remaining buffered content.
        flush(controller);
        controller.close();
      },

      cancel() {
        iterators.length = 0;
        buffer = '';
      },
    });
  }
}
