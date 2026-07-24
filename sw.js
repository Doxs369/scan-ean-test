/**
 * ScanEan Service Worker v5
 * Controllo periodico in background, update silenzioso al prossimo avvio
 */

// ==== CAMBIA QUESTO NUMERO AD OGNI DEPLOY ====
const APP_VERSION = '1.3';
// =============================================

const CACHE_NAME = 'scanean-v' + APP_VERSION;
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

const NETWORK_FIRST_PATTERNS = [
  /\.html$/,
  /\.js$/,
  /\.css$/,
  /manifest\.json$/
];

function isNetworkFirst(url) {
  for (var i = 0; i < NETWORK_FIRST_PATTERNS.length; i++) {
    if (NETWORK_FIRST_PATTERNS[i].test(url.pathname)) {
      return true;
    }
  }
  return false;
}

// Installazione: cache degli asset statici
self.addEventListener('install', function(event) {
  console.log('[SW] Installazione v' + APP_VERSION + '...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SW] Caching asset statici v' + APP_VERSION);
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
  console.log('[SW] Attivazione v' + APP_VERSION + '...');
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

// Fetch: strategia intelligente
self.addEventListener('fetch', function(event) {
  var request = event.request;
  var url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (!url.protocol.startsWith('http')) {
    return;
  }

  if (url.hostname !== self.location.hostname) {
    if (isExternalAPI(url)) {
      event.respondWith(networkFirst(request));
    }
    return;
  }

  if (isNetworkFirst(url)) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
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
          if (request.mode === 'navigate' || request.headers.get('accept').indexOf('text/html') !== -1) {
            return caches.match('./offline.html');
          }
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
      return caches.match(request)
        .then(function(cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.mode === 'navigate' || request.headers.get('accept').indexOf('text/html') !== -1) {
            return caches.match('./offline.html');
          }
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        });
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
