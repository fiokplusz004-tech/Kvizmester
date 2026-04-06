// QuizMaster Service Worker
// Verzió: 1.0 — frissítésnél növeld ezt a számot!
const CACHE_NAME = 'quizmaster-v1';

// Ezeket a fájlokat tároljuk el offline használathoz
const CACHE_ASSETS = [
  '/quizmaster/quiz-player.html',
  '/quizmaster/manifest.json',
  '/quizmaster/icons/icon-192.png',
  '/quizmaster/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap',
];

// ============================================================
// TELEPÍTÉS — fájlok cache-elése
// ============================================================
self.addEventListener('install', event => {
  console.log('[SW] Telepítés...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Fájlok cache-elése');
      // Minden fájlt próbálunk cache-elni, de ha valami nem sikerül
      // (pl. külső font), attól még az app működik
      return Promise.allSettled(
        CACHE_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Nem sikerült cache-elni:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ============================================================
// AKTIVÁLÁS — régi cache törlése
// ============================================================
self.addEventListener('activate', event => {
  console.log('[SW] Aktiválás...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Régi cache törölve:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — hálózati kérések kezelése
// Network First stratégia: először próbál netet, ha nincs → cache
// Firebase kérések mindig hálózatról mennek (real-time szükséges)
// ============================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase és Google API kérések: SOHA nem cache-eljük
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    return; // böngésző kezeli normálisan
  }

  // HTML és app fájlok: Network First (mindig friss verziót próbál)
  if (event.request.mode === 'navigate' ||
      event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Sikeres hálózati válasz → frissítjük a cache-t is
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          // Nincs net → cache-ből töltjük
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            return caches.match('/quizmaster/quiz-player.html');
          });
        })
    );
    return;
  }

  // Egyéb statikus fájlok: Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        return response;
      }).catch(() => cached);
    })
  );
});
