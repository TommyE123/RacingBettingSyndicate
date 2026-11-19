// Service worker for the installed app (registered by src/components/core/pwa/pwa-provider.tsx).
//
// It deliberately caches almost nothing. Pages, /api requests and anything else that can show a
// member's bets, returns or standings always go to the network and are never stored, so signing
// out leaves nothing behind and nobody sees stale money figures. Only Next's content-hashed build
// files are cached (they never change under the same URL), plus a static offline page shown when
// a page can't be loaded.
//
// Bump CACHE_VERSION when offline.html changes, so the new worker replaces the cached copy.

const CACHE_VERSION = 'v1';
const CACHE_PREFIX = 'rbs-';
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';
// Old build files pile up across deployments; keep the cache to a sensible size.
const MAX_STATIC_ENTRIES = 200;

globalThis.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => globalThis.skipWaiting())
  );
});

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE).map((key) => caches.delete(key))
        )
      )
      .then(() => globalThis.clients.claim())
  );
});

function isHashedBuildFile(url) {
  return url.pathname.startsWith('/_next/static/');
}

async function trimCache(cache) {
  const keys = await cache.keys();
  const excess = keys.length - MAX_STATIC_ENTRIES;
  // Keys come back oldest first; never drop the offline page.
  const stale = keys.filter((request) => new URL(request.url).pathname !== OFFLINE_URL).slice(0, Math.max(excess, 0));
  await Promise.all(stale.map((request) => cache.delete(request)));
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
    await trimCache(cache);
  }
  return response;
}

async function networkWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const offline = await caches.match(OFFLINE_URL);
    if (offline) {
      return offline;
    }
    throw error;
  }
}

globalThis.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== globalThis.location.origin) {
    return;
  }
  if (request.mode === 'navigate') {
    // Pages: always from the network, never cached. Offline, show the offline page instead.
    event.respondWith(networkWithOfflineFallback(request));
    return;
  }
  if (isHashedBuildFile(url)) {
    event.respondWith(cacheFirst(request));
  }
  // Everything else, including /api, is left to the browser's normal network handling.
});
