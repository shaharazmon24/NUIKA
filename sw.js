const CACHE = 'nuika-v1';
const ASSETS = [
  '/index.html',
  '/logo.png.png',
  '/manifest.json',
  '/images/1-lechem-mushalam.jpg',
  '/images/2-lechem-kusmin.jpg',
  '/images/3-baguette.jpg',
  '/images/4-ugat-earl-grey.jpg',
  '/images/5-lachmaniya.jpg',
  '/images/6-maafe-ananin.jpg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
