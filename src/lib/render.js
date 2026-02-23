/**
 * Core render function for lit-edge.
 *
 * Renders a lit-html template (or any renderable value) to a RenderResult
 * iterable of strings and thunks. Compatible with @lit-labs/ssr output.
 */
import { isTemplateResult } from 'lit-html/directive-helpers.js';
import { LitElementRenderer } from './lit-element-renderer.js';
import { renderValue } from './render-value.js';
import { isHydratable } from './server-template.js';

/**
 * Renders a lit-html template (or any renderable value) to a RenderResult.
 *
 * The RenderResult is an iterable that yields strings and Promises. When
 * consuming the result, Promises must be awaited before retrieving subsequent
 * values. Use `collectResult()` from render-result.js for convenience.
 *
 * @param {unknown} value - Value to render (usually a TemplateResult)
 * @param {Object} [renderInfo] - Optional render context (advanced use)
 * @returns {RenderResultIterator} Iterable of strings/Promises
 */
export function render(value, renderInfo) {
  return new RenderResultIterator(renderThunked(value, renderInfo));
}

/**
 * Renders a value to a ThunkedRenderResult (array of strings and thunks).
 *
 * @param {unknown} value - Value to render
 * @param {Object} [renderInfo] - Optional render context
 * @returns {Array} ThunkedRenderResult
 */
export function renderThunked(value, renderInfo) {
  const defaultRenderInfo = {
    elementRenderers: [LitElementRenderer],
    customElementInstanceStack: [],
    customElementHostStack: [],
    eventTargetStack: [],
    slotStack: [],
    deferHydration: false,
  };
  renderInfo = { ...defaultRenderInfo, ...renderInfo };

  let hydratable = true;
  if (isTemplateResult(value)) {
    hydratable = isHydratable(value);
  }

  return renderValue(value, renderInfo, hydratable);
}

/**
 * Wraps a ThunkedRenderResult to implement the RenderResult interface.
 *
 * RenderResultIterator flattens thunks and nested arrays into a stream of
 * strings and Promises, suitable for collection or streaming.
 */
export class RenderResultIterator {
  constructor(result) {
    this._waiting = false;
    this._iterators = [result[Symbol.iterator]()];
  }

  next() {
    if (this._waiting) {
      throw new Error(
        'Cannot call next() while waiting for a Promise to resolve'
      );
    }

    while (true) {
      const iterator = this._iterators.at(-1);
      if (iterator === undefined) {
        return { done: true, value: undefined };
      }

      const result = iterator.next();
      if (result.done) {
        this._iterators.pop();
        continue;
      }

      let value = result.value;

      if (typeof value === 'string') {
        return result;
      }

      // Trampoline to fully evaluate thunks.
      while (typeof value === 'function') {
        value = value();
      }

      if (value === undefined) {
        continue;
      }

      if (typeof value === 'string') {
        return { done: false, value };
      }

      if (Array.isArray(value)) {
        this._iterators.push(value[Symbol.iterator]());
        continue;
      }

      // Value is a Promise.
      this._waiting = true;
      return {
        done: false,
        value: value.then((r) => {
          this._waiting = false;
          if (typeof r === 'string') {
            return r;
          }
          this._iterators.push(r[Symbol.iterator]());
          return this;
        }),
      };
    }
  }

  [Symbol.iterator]() {
    return this;
  }
}
