/**
 * Side-effect module: installs the minimal DOM shim into globalThis.
 *
 * Import this module once at the start of your server-side entry point,
 * before importing any Lit component bundles. It sets up the browser DOM
 * globals (HTMLElement, customElements, CSSStyleSheet, etc.) required to
 * instantiate and render LitElement components on runtimes that do not
 * provide them natively.
 *
 * This is needed on:
 *   - Cloudflare Workers  (no DOM globals in WinterTC)
 *   - Fastly Compute      (no DOM globals in WinterTC)
 *   - Node.js 18+         (no DOM globals by default)
 *   - Deno                (no DOM globals by default)
 *   - Bun                 (no DOM globals by default)
 *
 * @example
 * ```js
 * // worker.js (Cloudflare Workers entry point)
 * import 'lit-ssr-edge/install-global-dom-shim.js';
 * import { render, RenderResultReadable } from 'lit-ssr-edge';
 * import './my-components-bundle.js';  // registers custom elements
 * import { html } from 'lit';
 *
 * export default {
 *   fetch() {
 *     const stream = new RenderResultReadable(
 *       render(html`<my-app></my-app>`)
 *     ).getStream();
 *     return new Response(stream, {
 *       headers: { 'Content-Type': 'text/html; charset=utf-8' },
 *     });
 *   },
 * };
 * ```
 */
import { installGlobalDomShim } from './lib/dom-shim.js';

installGlobalDomShim();
