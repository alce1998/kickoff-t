// Service Worker per Calcio d'Inizio PWA
const CACHE_NAME = 'calcio-dinizio-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Installazione del service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aperta');
        return cache.addAll(urlsToCache);
      })
  );
  // Forza l'attivazione immediata
  self.skipWaiting();
});

// Attivazione del service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminazione cache vecchia:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Prendi il controllo di tutte le pagine immediatamente
  return self.clients.claim();
});

// Strategia: Network First, poi Cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se la richiesta ha successo, aggiorna la cache
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Se la rete fallisce, usa la cache
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          // Se non c'è nemmeno in cache, restituisci una pagina offline
          return caches.match('/');
        });
      })
  );
});
