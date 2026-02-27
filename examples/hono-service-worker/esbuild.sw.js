/**
 * esbuild configuration for the service worker bundle.
 *
 * Bundles src/sw.js (which imports src/app.js, Hono, lit-ssr-edge, and the
 * component) into public/sw.js for the browser to load as a module SW.
 *
 * Key flags:
 *   --platform=neutral  Remove the default 'browser' condition so that
 *                       lit-html resolves to its SSR-safe node build instead
 *                       of the browser build that calls `document` at module
 *                       initialisation (service workers have no DOM).
 *   --conditions=node   Select the 'node' export condition, picking
 *                       node/lit-html.js which guards against missing document.
 *   --main-fields       Required by --platform=neutral for packages that only
 *                       publish a 'main' field (e.g. @parse5/tools).
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['src/sw.js'],
  bundle: true,
  format: 'esm',
  outfile: 'public/sw.js',
  platform: 'neutral',
  conditions: ['node'],
  mainFields: ['module', 'main'],
  target: 'es2022',
  minify: true,
  legalComments: 'none',
});

console.log('Built public/sw.js');
