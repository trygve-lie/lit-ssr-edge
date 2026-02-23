/**
 * Minimal DOM shim for lit-ssr-edge.
 *
 * Provides the minimal set of browser DOM APIs needed to instantiate and
 * render LitElement components during server-side rendering. Wraps
 * @lit-labs/ssr-dom-shim which is pure JavaScript with no Node.js core
 * module dependencies and is therefore WinterTC-compatible.
 *
 * When to use:
 *   - Cloudflare Workers, Fastly Compute: WinterTC runtimes have Web Streams,
 *     fetch(), etc. but NOT customElements, HTMLElement, or CSSStyleSheet.
 *   - Node.js, Deno, Bun: No browser DOM globals by default.
 *
 * In all of these environments, call installGlobalDomShim() (or import the
 * side-effect module src/install-global-dom-shim.js) before importing any
 * Lit component bundles.
 *
 * Note: @lit-labs/ssr-dom-shim reads process.env.NODE_ENV for dev/prod mode
 * warnings. We guard globalThis.process before importing to prevent
 * ReferenceError on runtimes that do not provide a process global.
 */

// Guard: ensure process.env exists so that @lit-labs/ssr-dom-shim's
// NODE_ENV check does not throw on runtimes without Node's process global
// (e.g. Cloudflare Workers). We default to 'production' mode.
// The ??= operator leaves an existing process object untouched.
globalThis.process ??= { env: { NODE_ENV: 'production' } };

import {
  HTMLElement,
  Element,
  Event,
  CustomEvent,
  EventTarget,
  CSSStyleSheet,
  CustomElementRegistry,
  ariaMixinAttributes,
  ElementInternals,
  HYDRATE_INTERNALS_ATTR_PREFIX,
} from '@lit-labs/ssr-dom-shim';

/**
 * Installs the minimal DOM globals required for SSR component rendering into
 * the given scope (default: globalThis).
 *
 * Uses ??= (nullish-coalescing assignment) so that:
 *  - On Node.js/Deno/Bun: shimmed classes are installed.
 *  - In a real browser or a test environment that already has these globals:
 *    the native implementations are preserved.
 *
 * Safe to call multiple times.
 *
 * @param {object} [scope=globalThis]
 */
export function installGlobalDomShim(scope = globalThis) {
  scope.HTMLElement ??= HTMLElement;
  scope.Element ??= Element;
  scope.Event ??= Event;
  scope.CustomEvent ??= CustomEvent;
  scope.EventTarget ??= EventTarget;
  scope.CSSStyleSheet ??= CSSStyleSheet;
  scope.customElements ??= new CustomElementRegistry();
}

// Re-export shim classes for explicit use without side effects
export {
  HTMLElement,
  Element,
  Event,
  CustomEvent,
  EventTarget,
  CSSStyleSheet,
  CustomElementRegistry,
  ariaMixinAttributes,
  ElementInternals,
  HYDRATE_INTERNALS_ATTR_PREFIX,
};
