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
  
  // CRITICAL: Completely bypass service worker for ALL API requests
  // This is the ONLY way to ensure cookies, credentials, and headers work correctly
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    // Don't call event.respondWith() at all - let browser handle natively
    // This ensures 100% native request handling with all credentials
    return;
  }
  
  // For non-API static assets only, use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
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
