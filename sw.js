const CACHE_NAME = 'metricsaiup-v27';
const STATIC_ASSETS = [
  './',
  './index.html',
  './favicon.svg',
];

// Install — cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET, API, socket, and streaming requests
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;
  if (event.request.url.includes('/socket.io/')) return;
  if (event.request.url.includes('/hls/')) return;
  if (event.request.url.includes('.m3u8')) return;
  if (event.request.url.includes('.ts')) return;
  if (event.request.url.includes(':8181')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./')))
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'MetricsAiUp';
  const options = {
    body: data.body || '',
    icon: './favicon.svg',
    badge: './favicon.svg',
    tag: data.tag || 'default',
    data: data.url || './',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Click on notification — open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow(event.notification.data || './');
    })
  );
});
