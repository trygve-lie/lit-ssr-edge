/**
 * Template digest calculation for lit-ssr-edge.
 *
 * Implements the DJB2-based hash used by @lit-labs/ssr-client to create
 * template identifiers embedded in hydration markers. Our implementation
 * must produce byte-for-byte identical digests so that server-rendered
 * pages can be hydrated by the official @lit-labs/ssr-client package.
 *
 * Algorithm:
 *   - Two 32-bit DJB2 accumulators, both initialised to 5381
 *   - Characters from each string in the template's `strings` array are
 *     XOR-folded into alternating accumulators
 *   - The resulting 8-byte buffer is base64-encoded with btoa()
 *   - Results are memoised per TemplateStringsArray reference (WeakMap)
 *
 * Reference implementation:
 *   @lit-labs/ssr-client/development/lib/hydrate-lit-html.js
 */

/** Number of 32-bit hash accumulators (matches ssr-client `digestSize`). */
const DIGEST_SIZE = 2;

/**
 * Per-TemplateStringsArray digest cache.
 * WeakMap ensures entries are collected when template literals go out of scope.
 */
const digestCache = new WeakMap();

/**
 * Calculates a digest string for a TemplateResult.
 *
 * The digest is a base64-encoded string derived from a DJB2 hash of all
 * the static string parts of the template. It uniquely identifies the
 * template structure, allowing @lit-labs/ssr-client to verify that the
 * server-rendered HTML matches the client template before hydrating.
 *
 * @param {import('lit-html').TemplateResult} templateResult
 * @returns {string} Base64-encoded 8-byte digest
 */
export const digestForTemplateResult = (templateResult) => {
  let digest = digestCache.get(templateResult.strings);
  if (digest !== undefined) {
    return digest;
  }

  // Initialise two DJB2 accumulators with the canonical seed value.
  const hashes = new Uint32Array(DIGEST_SIZE).fill(5381);

  for (const s of templateResult.strings) {
    for (let i = 0; i < s.length; i++) {
      // DJB2: hash = hash * 33 ^ charCode
      // Characters are distributed across the two slots by index parity.
      hashes[i % DIGEST_SIZE] =
        (hashes[i % DIGEST_SIZE] * 33) ^ s.charCodeAt(i);
    }
  }

  // Reinterpret the two uint32 values as 8 raw bytes, then base64-encode.
  // btoa() is available on all WinterTC-compliant runtimes (no Buffer needed).
  const str = String.fromCharCode(...new Uint8Array(hashes.buffer));
  digest = btoa(str);

  digestCache.set(templateResult.strings, digest);
  return digest;
};
