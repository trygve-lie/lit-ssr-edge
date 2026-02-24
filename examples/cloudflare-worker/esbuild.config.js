import { build } from 'esbuild';

await build({
  entryPoints: ['worker.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/worker.js',
  platform: 'neutral',
  conditions: ['node'],
  mainFields: ['module', 'main'],
  target: 'es2022',
});
