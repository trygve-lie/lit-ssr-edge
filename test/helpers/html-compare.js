/**
 * HTML comparison utilities for testing
 *
 * Provides functions to normalize and compare HTML output for testing,
 * ensuring consistent comparisons across different implementations.
 */

import { strictEqual } from 'node:assert';

/**
 * Normalizes HTML for comparison
 * - Trims whitespace
 * - Normalizes attribute spacing
 * - Removes extra whitespace between tags
 * - Normalizes self-closing tags
 *
 * @param {string} html - HTML string to normalize
 * @returns {string} Normalized HTML
 */
export function normalizeHTML(html) {
  return html
    .trim()
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove whitespace between tags
    .replace(/>\s+</g, '><')
    // Normalize attribute spacing
    .replace(/\s*=\s*/g, '=')
    // Normalize quotes around attributes
    .replace(/"\s+/g, '" ')
    .replace(/\s+"/g, '"');
}

/**
 * Asserts two HTML strings are equivalent
 *
 * Normalizes both HTML strings and performs strict equality comparison.
 * This ensures we're doing full HTML comparison rather than partial matching.
 *
 * @param {string} actual - Actual HTML output
 * @param {string} expected - Expected HTML output
 * @param {string} message - Optional assertion message
 */
export function assertHTMLEqual(actual, expected, message) {
  const normalizedActual = normalizeHTML(actual);
  const normalizedExpected = normalizeHTML(expected);

  strictEqual(normalizedActual, normalizedExpected, message);
}
