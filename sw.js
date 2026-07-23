/**
 * ScanEan Service Worker
 * Gestisce caching offline per la PWA
 */

const CACHE_NAME = 'scanean-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/storage.js',
  '/openfoodfacts.js',
  '/recipes-api.js',
  '/camera.js',
  '/barcode-scanner.js',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

// Installazione: cache degli asset statici
self.addEventListener('install', function(event) {
  console.log('[SW] Installazione in corso...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SW] Caching asset statici');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(function() {
        return self.skipWaiting();
      })
      .catch(function(err) {
        console.error('[SW] Errore caching:', err);
      })
  );
});

// Attivazione: pulizia cache vecchie
self.addEventListener('activate', function(event) {
  console.log('[SW] Attivazione...');
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Rimozione cache vecchia:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(function() {
        return self.clients.claim();
      })
  );
});

// Fetch: strategia Cache First, poi Network
self.addEventListener('fetch', function(event) {
  var request = event.request;

  // Ignora richieste non GET
  if (request.method !== 'GET') {
    return;
  }

  // Ignora richieste Chrome-extension
  if (request.url.indexOf('chrome-extension') !== -1) {
    return;
  }

  // Per API esterne (Open Food Facts, TheMealDB): Network First
  if (request.url.indexOf('openfoodfacts.org') !== -1 || 
      request.url.indexOf('themealdb.com') !== -1 ||
      request.url.indexOf('unpkg.com') !== -1 ||
      request.url.indexOf('jsdelivr.net') !== -1) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Per asset statici: Cache First
  event.respondWith(cacheFirst(request));
});

function cacheFirst(request) {
  return caches.match(request)
    .then(function(cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then(function(networkResponse) {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          var responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(request, responseToCache);
            });

          return networkResponse;
        })
        .catch(function() {
          // Fallback per navigazione
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    });
}

function networkFirst(request) {
  return fetch(request)
    .then(function(networkResponse) {
      if (networkResponse && networkResponse.status === 200) {
        var responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME)
          .then(function(cache) {
            cache.put(request, responseToCache);
          });
      }
      return networkResponse;
    })
    .catch(function() {
      return caches.match(request);
    });
}

// Gestione push notification (futuro)
self.addEventListener('push', function(event) {
  if (event.data) {
    var data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'ScanEan', {
        body: data.body || 'Hai prodotti in scadenza!',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: data.tag || 'scanean-reminder',
        requireInteraction: true
      })
    );
  }
});

// Clic su notifica
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
