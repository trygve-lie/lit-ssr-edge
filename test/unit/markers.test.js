/**
 * Unit tests for hydration marker generation.
 *
 * Verifies that each marker function produces the exact string format
 * expected by @lit-labs/ssr-client's hydration algorithm.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  openTemplatePart,
  openPart,
  closePart,
  nodeMarker,
} from '../../src/lib/markers.js';

describe('markers - openTemplatePart', () => {
  test('includes the digest in the marker', () => {
    assert.equal(openTemplatePart('abc123'), '<!--lit-part abc123-->');
  });

  test('works with a realistic base64 digest', () => {
    const digest = 'R9dTYRm/9ss=';
    assert.equal(openTemplatePart(digest), `<!--lit-part ${digest}-->`);
  });

  test('returns a valid HTML comment', () => {
    const marker = openTemplatePart('X');
    assert.ok(marker.startsWith('<!--'));
    assert.ok(marker.endsWith('-->'));
  });
});

describe('markers - openPart', () => {
  test('returns an empty lit-part comment', () => {
    assert.equal(openPart(), '<!--lit-part-->');
  });

  test('returns a valid HTML comment', () => {
    const marker = openPart();
    assert.ok(marker.startsWith('<!--'));
    assert.ok(marker.endsWith('-->'));
  });
});

describe('markers - closePart', () => {
  test('is the correct closing comment string', () => {
    assert.equal(closePart, '<!--/lit-part-->');
  });

  test('is a valid HTML comment', () => {
    assert.ok(closePart.startsWith('<!--'));
    assert.ok(closePart.endsWith('-->'));
  });
});

describe('markers - nodeMarker', () => {
  test('includes the node index', () => {
    assert.equal(nodeMarker(0), '<!--lit-node 0-->');
    assert.equal(nodeMarker(1), '<!--lit-node 1-->');
    assert.equal(nodeMarker(42), '<!--lit-node 42-->');
  });

  test('returns a valid HTML comment', () => {
    const marker = nodeMarker(5);
    assert.ok(marker.startsWith('<!--'));
    assert.ok(marker.endsWith('-->'));
  });
});

describe('markers - format compatibility with ssr-client', () => {
  test('openTemplatePart matches expected ssr-client format', () => {
    // The ssr-client hydration algorithm looks for this exact pattern:
    //   /<!--lit-part\s([^>]+)-->/
    const marker = openTemplatePart('AEmR7W+R0Ak=');
    assert.match(marker, /^<!--lit-part [A-Za-z0-9+/]+=*-->$/);
  });

  test('openPart matches expected ssr-client format', () => {
    // Non-template child parts use a marker with no digest
    assert.equal(openPart(), '<!--lit-part-->');
  });

  test('closePart matches expected ssr-client format', () => {
    assert.equal(closePart, '<!--/lit-part-->');
  });

  test('nodeMarker matches expected ssr-client format', () => {
    // The ssr-client locates elements via: /<!--lit-node (\d+)-->/
    assert.match(nodeMarker(7), /^<!--lit-node \d+-->$/);
  });

  test('open and close markers are always balanced strings', () => {
    const digest = 'test';
    const open = openTemplatePart(digest);
    const close = closePart;
    // They are separate strings, not a pair of characters
    assert.ok(open.includes('lit-part'));
    assert.ok(close.includes('/lit-part'));
  });
});
