/**
 * Compare benchmark results
 *
 * Usage: node test/performance/compare.js <baseline-file> <current-file>
 */

import { compareResults } from './benchmark.js';

const args = process.argv.slice(2);

if (args.length !== 2) {
  console.error('Usage: node test/performance/compare.js <baseline-file> <current-file>');
  console.error('');
  console.error('Example:');
  console.error('  node test/performance/compare.js benchmark-lit-ssr-1234.json benchmark-lit-ssr-edge-5678.json');
  process.exit(1);
}

const [baselineFile, currentFile] = args;

compareResults(baselineFile, currentFile).catch(console.error);
