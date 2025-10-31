const CACHE_NAME = 'workspace-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Don't cache API requests - they need fresh data and credentials
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request.clone(), {
        credentials: 'include',
        // Preserve request mode and cache settings
        mode: event.request.mode,
        cache: 'no-store',
      })
    );
    return;
  }
  
  // For non-API requests, try cache first, then fetch
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        // For non-API requests, fetch without credentials (static assets)
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
