/**
 * Client-side bundle entry point.
 *
 * Import ORDER matters:
 *   1. @lit-labs/ssr-client/lit-element-hydrate-support.js — must be first.
 *      It patches LitElement so it can attach to server-rendered shadow DOM
 *      (declared shadow root) instead of creating a new one.
 *   2. Component definition — registers <my-counter> via customElements.define().
 *
 * This file is bundled by esbuild into public/client.js using the standard
 * browser platform (no --conditions=node override needed — client-side code
 * uses the browser build of lit-html as intended).
 */

// Must be imported before any component definition.
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';

// Component definition — triggers hydration of the SSR-rendered shadow root.
import '../components/my-counter.js';
