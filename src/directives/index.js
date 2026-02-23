/**
 * SSR-compatible Lit directives for lit-ssr-edge.
 *
 * This module re-exports all directives that work correctly during server-side
 * rendering. Import from here instead of `lit/directives/*` to get the curated
 * set of SSR-safe directives, and to benefit from clear error messages when a
 * directive is used that is not supported on the server.
 *
 * Directives are categorised by their level of server-side support:
 *
 * ── Full support ──────────────────────────────────────────────────────────────
 * These directives have a `render()` method that produces correct HTML output
 * during SSR without requiring browser DOM APIs or asynchronous update cycles.
 *
 *   repeat      List rendering with key-based reconciliation (keys not used in SSR)
 *   map         Array-to-template transformation
 *   join        Join an iterable with a separator template/value
 *   range       Generate a sequence of integers
 *   when        Ternary conditional rendering
 *   choose      Multi-case conditional rendering (like switch/case)
 *   ifDefined   Render a value only when it is not undefined
 *   guard       Memoize rendering based on dependency values
 *   unsafeHTML  Render raw HTML strings without escaping
 *   unsafeSVG   Render raw SVG strings without escaping
 *   unsafeMathML Render raw MathML strings without escaping
 *
 * ── Partial support ───────────────────────────────────────────────────────────
 * The `render()` method works on the server; the `update()` method (which runs
 * on subsequent client-side renders) has additional DOM-dependent behaviour.
 * For SSR output these directives produce correct initial HTML.
 *
 *   classMap    Build a `class` attribute from a `{[className]: boolean}` object
 *   styleMap    Build a `style` attribute from a `{[property]: value}` object
 *   keyed       Force re-rendering when a key value changes (keys ignored in SSR)
 *
 * ── Not supported ─────────────────────────────────────────────────────────────
 * These directives rely on browser DOM APIs or Promise/AsyncIterable resolution
 * that cannot happen during synchronous SSR. Using them with lit-ssr-edge throws a
 * descriptive error at render time.
 *
 *   cache, live, until, asyncAppend, asyncReplace, ref, templateContent
 *
 * @example
 * ```js
 * import { render, collectResult } from 'lit-ssr-edge';
 * import { repeat, when, classMap } from 'lit-ssr-edge/directives/index.js';
 * import { html } from 'lit';
 *
 * const items = ['a', 'b', 'c'];
 * const template = html`
 *   <ul>
 *     ${repeat(items, (item) => item, (item) => html`<li>${item}</li>`)}
 *   </ul>
 * `;
 * const result = await collectResult(render(template));
 * ```
 */

// ── Full SSR support ──────────────────────────────────────────────────────────

export { repeat }      from 'lit/directives/repeat.js';
export { map }         from 'lit/directives/map.js';
export { join }        from 'lit/directives/join.js';
export { range }       from 'lit/directives/range.js';
export { when }        from 'lit/directives/when.js';
export { choose }      from 'lit/directives/choose.js';
export { ifDefined }   from 'lit/directives/if-defined.js';
export { guard }       from 'lit/directives/guard.js';
export { unsafeHTML }  from 'lit/directives/unsafe-html.js';
export { unsafeSVG }   from 'lit/directives/unsafe-svg.js';
export { unsafeMathML} from 'lit/directives/unsafe-mathml.js';

// ── Partial SSR support ───────────────────────────────────────────────────────

export { classMap }    from 'lit/directives/class-map.js';
export { styleMap }    from 'lit/directives/style-map.js';
export { keyed }       from 'lit/directives/keyed.js';
