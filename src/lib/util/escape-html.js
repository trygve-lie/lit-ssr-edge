/**
 * HTML entity replacement map for escaping special characters.
 */
const replacements = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  // &apos; was not defined in HTML4 and is not supported by IE8,
  // so a codepoint entity is used instead.
  "'": '&#39;',
};

const replacer = (char) => replacements[char];

/**
 * Escapes characters which have special meaning in HTML (&, <, >, ", ')
 * by replacing them with HTML entities.
 *
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export const escapeHtml = (str) => str.replace(/[&<>"']/g, replacer);
