/**
 * esbuild configuration for the client-side hydration bundle.
 *
 * Bundles src/client.js (which imports the ssr-client hydration support and
 * the component definition) into public/client.js for the browser.
 *
 * This uses the standard browser platform — unlike the SW bundle, the client
 * bundle intentionally uses lit-html's browser build for client-side rendering
 * and hydration.
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['src/client.js'],
  bundle: true,
  format: 'esm',
  outfile: 'public/client.js',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
});

console.log('Built public/client.js');
