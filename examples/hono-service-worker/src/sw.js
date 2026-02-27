/**
 * Service worker entry point.
 *
 * Wraps the shared Hono app (src/app.js) in service worker lifecycle events.
 * esbuild bundles this file — along with all its dependencies including Hono
 * and lit-ssr-edge — into public/sw.js for the browser to load.
 *
 * Lifecycle:
 *   install  → pre-cache client-side assets, skipWaiting().
 *   activate → clients.claim(), then postMessage each window client.
 *   fetch    → navigate requests → Hono SSR app.
 *              asset requests   → stale-while-revalidate from Cache API.
 *              everything else  → fall through to the network.
 *
 * Caching strategy — stale-while-revalidate:
 *   On every asset request the cached version is returned immediately (fast,
 *   no network latency). A background fetch then updates the cache so the
 *   next request gets the fresh version. This keeps assets snappy while
 *   still picking up new builds without requiring a manual cache clear.
 */

import app from './app.js';

// ── Cache configuration ───────────────────────────────────────────────────────

const CACHE_NAME = 'assets-v1';

// Assets to pre-cache on install and to serve stale-while-revalidate.
const PRECACHE_ASSETS = ['/client.js'];

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  // Pre-populate the cache so the first asset request is served from cache.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Remove stale caches from previous SW versions.
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ))
      .then(() => clients.claim())
      .then(async () => {
        const windowClients = await clients.matchAll({ type: 'window' });
        for (const client of windowClients) {
          client.postMessage({ type: 'sw-activated' });
        }
      }),
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    // Full-page navigation → SSR via the Hono app.
    event.respondWith(app.fetch(request));
    return;
  }

  if (PRECACHE_ASSETS.includes(url.pathname)) {
    // Known asset → stale-while-revalidate.
    event.respondWith(staleWhileRevalidate(request));
  }

  // Everything else (images, fonts, API calls, etc.) falls through to the
  // network with no SW involvement.
});

// ── Stale-while-revalidate ────────────────────────────────────────────────────

/**
 * Returns the cached response immediately, then fetches a fresh copy from
 * the network in the background and updates the cache for the next request.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Start a background network request regardless of cache state.
  const networkFetch = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });

  // Serve the cached version if available; otherwise wait for the network.
  return cached ?? networkFetch;
}
