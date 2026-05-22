const CACHE_NAME = 'prompt-optimizer-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/ai.png',
  '/manifest.json'
];

// Install Event: Cache critical standalone shell files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Cleanup stale caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event handler (Mandatory condition for Android/Chrome prompt injection)
self.addEventListener('fetch', event => {
  // Let network requests go through natively, falling back to cache if offline
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
