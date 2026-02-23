/**
 * Fixture loading utilities for testing
 *
 * Provides utilities for loading test fixtures with proper cache busting
 * to ensure test isolation.
 */

import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

/**
 * Loads a fixture component
 *
 * @param {string} name - Fixture filename (e.g., 'simple-greeting.js')
 * @returns {Promise<CustomElementConstructor>} Component class
 */
export async function loadFixture(name) {
  const fixturePath = join(process.cwd(), 'test/fixtures', name);
  const fixtureURL = pathToFileURL(fixturePath).href;

  // Add cache busting to ensure fresh import for test isolation
  const module = await import(`${fixtureURL}?t=${Date.now()}`);

  return module.default || module[Object.keys(module).find(key => key !== 'default')];
}

/**
 * Loads multiple fixtures
 *
 * @param {string[]} names - Fixture filenames
 * @returns {Promise<Map<string, CustomElementConstructor>>} Component map
 */
export async function loadFixtures(names) {
  const components = new Map();

  for (const name of names) {
    const ctor = await loadFixture(name);
    // Extract tag name from filename (e.g., 'simple-greeting.js' -> 'simple-greeting')
    const tagName = name.replace('.js', '');
    components.set(tagName, ctor);
  }

  return components;
}
