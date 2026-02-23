/**
 * Server-only template API for lit-ssr-edge.
 *
 * Server-only templates do not generate hydration markers, supporting full
 * document rendering (<!DOCTYPE html>, <html>, <head>, <body>) and can render
 * into elements that regular templates cannot (<title>, <textarea>, etc.).
 *
 * A server-only template cannot be rendered inside an ordinary hydratable
 * template. However, ordinary templates can be composed inside server-only
 * templates.
 *
 * @example
 * ```js
 * import { render, collectResult } from 'lit-ssr-edge';
 * import { html as serverHtml } from 'lit-ssr-edge/server-template.js';
 * import { html } from 'lit';
 *
 * const page = serverHtml`
 *   <!DOCTYPE html>
 *   <html>
 *     <body>
 *       ${html`<my-app></my-app>`}
 *     </body>
 *   </html>
 * `;
 *
 * const htmlString = await collectResult(render(page));
 * ```
 */
export { html } from './lib/server-template.js';

// Re-export lit-html primitives for convenience
export { noChange, nothing } from 'lit-html';
