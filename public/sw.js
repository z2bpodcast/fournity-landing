// FOURNITY Service Worker
// Handles offline access and fast repeat loads.

const CACHE_NAME = 'fournity-cache-v2';

// Files we know about upfront — safe to cache immediately on install
const PRECACHE_URLS = [
  '/',
  '/read.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/fournity-logo.png',
  '/fournity-logo-typo-fixed.png',
  '/fournity-bookstand-display.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // If any single file fails (e.g. renamed), don't block install
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // For page navigations: try network first, fall back to cache (offline support)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request, { ignoreSearch: true }).then((res) => res || caches.match('/'))
        )
    );
    return;
  }

  // For images and static assets: cache-first, update cache in background
  if (
    request.destination === 'image' ||
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Everything else: just go to network
});
