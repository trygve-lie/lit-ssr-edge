import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/bundle.js',
  platform: 'neutral',
  conditions: ['node'],
  mainFields: ['module', 'main'],
  target: 'es2022',
});
