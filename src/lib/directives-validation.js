/**
 * Directive SSR support validation for lit-ssr-edge.
 *
 * Identifies directives that are client-only (they rely on browser DOM APIs or
 * asynchronous update cycles that don't exist during server-side rendering) and
 * throws a clear, actionable error when they are used.
 *
 * Detection strategy:
 *   Each directive factory is called once at module load time with minimal
 *   dummy arguments to obtain its DirectiveResult, from which we extract the
 *   Directive constructor via `getDirectiveClass()`. Constructor references are
 *   stable and work correctly even when code is minified (class names are not
 *   used for comparison).
 *
 * Supported directives (full SSR support — have a working render() method):
 *   repeat, map, join, range, when, choose, ifDefined, guard,
 *   unsafeHTML, unsafeSVG, unsafeMathML
 *
 * Partially supported (render() works, update() is client-only):
 *   classMap, styleMap, keyed
 *
 * Not supported (client-only — throw a clear error):
 *   cache, live, until, asyncAppend, asyncReplace, ref, templateContent
 */

import { getDirectiveClass } from 'lit/directive-helpers.js';

// Minimal async iterable used only for constructor capture at load time.
const _emptyAsyncIter = {
  [Symbol.asyncIterator]: () => ({
    next: async () => ({ done: true, value: undefined }),
  }),
};

/**
 * Map of unsupported directive constructor → human-readable name.
 * Built once at module load time.
 *
 * @type {Map<Function, string>}
 */
const UNSUPPORTED = new Map();

/**
 * Registers an unsupported directive by calling its factory once with minimal
 * args to extract the constructor.
 *
 * @param {Function} factory - Directive factory function (e.g. `cache`)
 * @param {string}   name    - Human-readable directive name for error messages
 * @param {...unknown} args  - Minimal arguments to make the factory return a DirectiveResult
 */
function _register(factory, name, ...args) {
  try {
    const ctor = getDirectiveClass(factory(...args));
    if (ctor !== undefined) {
      UNSUPPORTED.set(ctor, name);
    }
  } catch {
    // If the factory throws with these dummy args, we cannot register it.
    // This should not happen in practice.
  }
}

// Eagerly import and register each client-only directive.
// Dynamic import is not used here because we need synchronous registration.

import { cache }           from 'lit/directives/cache.js';
import { live }            from 'lit/directives/live.js';
import { until }           from 'lit/directives/until.js';
import { asyncAppend }     from 'lit/directives/async-append.js';
import { asyncReplace }    from 'lit/directives/async-replace.js';
import { ref }             from 'lit/directives/ref.js';
import { templateContent } from 'lit/directives/template-content.js';

_register(cache,           'cache',           null);
_register(live,            'live',            '');
_register(until,           'until');
_register(asyncAppend,     'asyncAppend',     _emptyAsyncIter);
_register(asyncReplace,    'asyncReplace',    _emptyAsyncIter);
_register(ref,             'ref',             () => {});
_register(templateContent, 'templateContent', null);

/**
 * Supported directives grouped by support level, for use in error messages.
 */
const SUPPORTED_FULL = [
  'repeat', 'map', 'join', 'range', 'when', 'choose', 'ifDefined', 'guard',
  'unsafeHTML', 'unsafeSVG', 'unsafeMathML',
];
const SUPPORTED_PARTIAL = ['classMap', 'styleMap', 'keyed'];

/**
 * Checks whether the given directive constructor is a known client-only
 * directive and throws a descriptive error if so.
 *
 * Call this inside `patchIfDirective()` before patching the directive class.
 *
 * @param {Function} directiveCtor - Directive constructor from getDirectiveClass()
 * @throws {Error} When the directive is client-only
 */
export function validateDirectiveSupport(directiveCtor) {
  const name = UNSUPPORTED.get(directiveCtor);
  if (name === undefined) return; // Supported directive — nothing to do

  throw new Error(
    `The \`${name}\` directive is not supported in server-side rendering. ` +
    `It relies on browser DOM APIs or asynchronous update cycles that are ` +
    `unavailable on the server.\n\n` +
    `Supported directives (full SSR support):\n` +
    `  ${SUPPORTED_FULL.join(', ')}\n\n` +
    `Supported directives (render() only, update() is client-side):\n` +
    `  ${SUPPORTED_PARTIAL.join(', ')}`
  );
}
