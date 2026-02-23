/**
 * Utilities for collecting a RenderResult or ThunkedRenderResult into a string.
 *
 * RenderResult is an iterable of strings, thunks, Promises, and nested
 * iterables. These functions resolve all of them into a final string.
 */

/**
 * Joins a RenderResult or ThunkedRenderResult into a string asynchronously.
 * Supports Promises in the result (awaits them in order).
 *
 * @param {Iterable} result - RenderResult or ThunkedRenderResult
 * @returns {Promise<string>} Rendered HTML string
 */
export const collectResult = async (result) => {
  let str = '';
  for (const chunk of result) {
    let value = chunk;
    while (value !== undefined) {
      // Resolve thunks (functions that return the next value).
      while (typeof value === 'function') {
        value = value();
      }
      if (value === undefined) {
        break;
      }
      if (typeof value === 'string') {
        str += value;
        break;
      }
      if (Array.isArray(value) || typeof value[Symbol.iterator] === 'function') {
        str += await collectResult(value);
        break;
      }
      // Must be a Promise.
      if (typeof value.then !== 'function') {
        throw new Error(
          `Unexpected value in RenderResult: ${value} (${typeof value})`
        );
      }
      value = await value;
    }
  }
  return str;
};

/**
 * Joins a RenderResult or ThunkedRenderResult into a string synchronously.
 * Throws if the result contains Promises.
 *
 * @param {Iterable} result - RenderResult or ThunkedRenderResult
 * @returns {string} Rendered HTML string
 */
export const collectResultSync = (result) => {
  let str = '';
  for (const chunk of result) {
    let value = chunk;
    while (typeof value === 'function') {
      value = value();
    }
    if (typeof value === 'string') {
      str += value;
    } else if (Array.isArray(value)) {
      str += collectResultSync(value);
    } else if (value !== undefined) {
      throw new Error(
        'Promises not supported in collectResultSync. Please use collectResult.'
      );
    }
  }
  return str;
};
