import { build } from 'esbuild';

await build({
  entryPoints: ['sw.js'],
  bundle: true,
  format: 'esm',
  // Output directly into public/ so the service worker is served at /sw.js.
  // A service worker's default scope is the directory it is served FROM.
  // If served from /dist/sw.js the scope would be /dist/ — which would never
  // control pages at /. Serving from /sw.js gives scope / (the whole site).
  outfile: 'public/sw.js',
  // --platform=neutral: removes the 'browser' condition from esbuild's default
  // condition set. Without this, esbuild resolves lit-html to its browser build
  // which accesses `document` at module initialisation and throws
  // ReferenceError in the service worker (which has no DOM).
  platform: 'neutral',
  // --conditions=node: tells esbuild to prefer the 'node' export condition.
  // This resolves lit-html to node/lit-html.js, which guards against a missing
  // document: `void 0 === globalThis.document ? {createTreeWalker:()=>({})} : document`
  conditions: ['node'],
  // --main-fields: required by --platform=neutral to resolve packages that use
  // the classic 'main' or 'module' fields (e.g. @parse5/tools uses only 'main').
  mainFields: ['module', 'main'],
  target: 'es2022',
  // Tree-shaking removes unused exports. esbuild enables it automatically when
  // bundling ESM, but marking the entry point as side-effect-free lets it also
  // eliminate unused re-exports from packages that don't declare sideEffects:false.
  treeShaking: true,
  // Minify identifiers, whitespace, and syntax in one pass.
  minify: true,
  // Strip all legal comments (/* @license */, /*! ... */) from the output.
  // The full license text is kept in the root LICENSE file of the project.
  legalComments: 'none',
});
