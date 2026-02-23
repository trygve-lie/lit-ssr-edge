/**
 * Hydration marker generation for lit-ssr-edge.
 *
 * Generates the HTML comment markers that lit-html uses to locate and update
 * dynamic parts of server-rendered HTML during client-side hydration.
 *
 * Marker formats (must match @lit-labs/ssr-client exactly):
 *
 *   <!--lit-part DIGEST-->  Opening marker for a TemplateResult child part.
 *                           DIGEST identifies the template structure.
 *   <!--lit-part-->         Opening marker for a non-template child part
 *                           (primitive, iterable, nothing, etc.)
 *   <!--/lit-part-->        Closing marker for any child part.
 *   <!--lit-node N-->       Marker placed before an element that has attribute
 *                           bindings. N is the depth-first node index of that
 *                           element, matching the client template's node walk.
 *
 * All marker functions are pure and produce the exact strings expected by
 * @lit-labs/ssr-client's hydration algorithm.
 */

/**
 * Opening marker for a TemplateResult child part (includes digest).
 *
 * @param {string} digest - Template digest from digestForTemplateResult()
 * @returns {string}
 */
export const openTemplatePart = (digest) => `<!--lit-part ${digest}-->`;

/**
 * Opening marker for a non-template child part (primitives, iterables,
 * nothing, null, undefined).
 *
 * @returns {string}
 */
export const openPart = () => `<!--lit-part-->`;

/**
 * Closing marker for any child part (both template and non-template).
 *
 * @type {string}
 */
export const closePart = `<!--/lit-part-->`;

/**
 * Marker placed as the previous sibling of an element that has attribute
 * bindings, or any element that needs to be located during hydration.
 *
 * The index is the depth-first position of the bound element in the template's
 * DOM tree, counting only element and comment nodes (matching lit-html's
 * client-side tree walker).
 *
 * @param {number} index - Depth-first node index
 * @returns {string}
 */
export const nodeMarker = (index) => `<!--lit-node ${index}-->`;
