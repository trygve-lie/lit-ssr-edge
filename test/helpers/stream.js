/**
 * Stream utilities for testing
 *
 * Provides utilities for working with ReadableStream in tests.
 */

/**
 * Collects a ReadableStream into a complete string
 *
 * @param {ReadableStream} stream - Stream to collect
 * @returns {Promise<string>} Complete stream content as string
 */
export async function collectStream(stream) {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let result = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }

    // Final flush
    result += decoder.decode();

    return result;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Collects a ReadableStream into an array of chunks
 *
 * Useful for testing streaming behavior and chunk boundaries.
 *
 * @param {ReadableStream} stream - Stream to collect
 * @returns {Promise<string[]>} Array of decoded chunks
 */
export async function collectStreamChunks(stream) {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  const chunks = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value, { stream: true }));
    }

    // Add final flush if any
    const final = decoder.decode();
    if (final) {
      chunks.push(final);
    }

    return chunks;
  } finally {
    reader.releaseLock();
  }
}
