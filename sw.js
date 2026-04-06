// QuizMaster Service Worker
const CACHE_NAME = 'quizmaster-v2';

const CACHE_ASSETS = [
  '/kvizmester/quiz-player.html',
  '/kvizmester/manifest.json',
  '/kvizmester/icons/icon-192.png',
  '/kvizmester/icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        CACHE_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Nem sikerült:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase kérések soha nem cache-elve
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    return;
  }

  // HTML: Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request)
          .then(cached => cached || caches.match('/kvizmester/quiz-player.html'))
        )
    );
    return;
  }

  // Egyéb: Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      });
    })
  );
});
