/**
 * ScanEan Service Worker v3
 * Caching offline con percorsi relativi per funzionare in qualsiasi cartella
 */

const CACHE_NAME = 'scanean-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './style.css',
  './app.js',
  './storage.js',
  './openfoodfacts.js',
  './recipes-api.js',
  './camera.js',
  './barcode-scanner.js',
  './manifest.json',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png'
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

// Attivazione: pulizia cache vecchie + claim clients
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

// Fetch: strategia Cache First per asset, Network First per API
self.addEventListener('fetch', function(event) {
  var request = event.request;
  var url = new URL(request.url);

  // Ignora richieste non GET
  if (request.method !== 'GET') {
    return;
  }

  // Ignora protocolli non http(s)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Per risorse esterne (CDN, API): Network First con fallback cache
  if (url.hostname !== self.location.hostname) {
    if (isExternalAPI(url)) {
      event.respondWith(networkFirst(request));
    }
    return;
  }

  // Per asset statici locali: Cache First
  event.respondWith(cacheFirst(request));
});

function isExternalAPI(url) {
  var host = url.hostname;
  return host.indexOf('openfoodfacts.org') !== -1 ||
         host.indexOf('themealdb.com') !== -1 ||
         host.indexOf('unpkg.com') !== -1 ||
         host.indexOf('jsdelivr.net') !== -1 ||
         host.indexOf('tesseract.js') !== -1;
}

function cacheFirst(request) {
  return caches.match(request)
    .then(function(cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then(function(networkResponse) {
          if (!networkResponse || networkResponse.status !== 200) {
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
          // Se e una navigazione HTML, mostra offline.html
          if (request.mode === 'navigate' || request.headers.get('accept').indexOf('text/html') !== -1) {
            return caches.match('./offline.html');
          }
          // Altrimenti errore
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
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

// Gestione push notification
self.addEventListener('push', function(event) {
  if (event.data) {
    var data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'ScanEan', {
        body: data.body || 'Hai prodotti in scadenza!',
        icon: './icons/icon-192x192.png',
        badge: './icons/icon-72x72.png',
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
    clients.openWindow('./index.html')
  );
});
