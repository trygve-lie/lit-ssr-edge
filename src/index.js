/**
 * lit-edge - Server-side renderer for Lit web components
 *
 * Targets WinterTC-compatible runtimes (Cloudflare Workers, Fastly Compute,
 * Node.js 18+, Deno, Bun) using only Web Platform APIs.
 *
 * @example
 * ```js
 * import { render, collectResult } from 'lit-edge';
 * import { html } from 'lit';
 *
 * const template = html`<div>Hello, ${name}!</div>`;
 * const result = render(template);
 * const htmlString = await collectResult(result);
 * ```
 *
 * @example Streaming (edge runtime):
 * ```js
 * import { render, RenderResultReadable } from 'lit-edge';
 * import { html } from 'lit';
 *
 * const template = html`<div>Hello</div>`;
 * const stream = new RenderResultReadable(render(template)).getStream();
 * return new Response(stream, { headers: { 'Content-Type': 'text/html' } });
 * ```
 */

// Core rendering
export { render } from './lib/render.js';
export { collectResult, collectResultSync } from './lib/render-result.js';

// Streaming (Web Streams API)
export { RenderResultReadable } from './lib/render-stream.js';

// Template type detection utility
export { isHydratable } from './lib/server-template.js';

// Re-export lit-html primitives for convenience
export { html, svg, noChange, nothing } from 'lit-html';
