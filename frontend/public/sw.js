const CACHE_NAME = 'solairus-pwa-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Ignore unsupported schemes (e.g., chrome-extension://, devtools://) and non-HTTP(S)
  const url = new URL(request.url);
  const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
  if (!isHttp) return;

  // Avoid caching Vite HMR/WebSocket or other dynamic endpoints
  const isHmr = url.pathname.startsWith('/@vite') || url.pathname.startsWith('/__vite') || url.pathname.includes('hmr');
  if (isHmr) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          // Only cache successful same-origin responses
          const sameOrigin = url.origin === self.location.origin;
          if (networkResponse && networkResponse.ok && sameOrigin) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});