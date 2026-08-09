// Bump this version on every deploy that must reach existing users.
const CACHE = 'nuika-v3';

// Relative paths — the app is served from /NUIKA/ on GitHub Pages,
// so absolute '/index.html' would 404 and silently break the precache.
const ASSETS = [
  './',
  './index.html',
  './logo.png.png',
  './manifest.json',
  './images/1-lechem-mushalam.jpg',
  './images/2-lechem-kusmin.jpg',
  './images/3-baguette.jpg',
  './images/4-ugat-earl-grey.jpg',
  './images/5-lachmaniya.jpg',
  './images/6-maafe-ananin.jpg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll rejects the whole batch if any single asset fails, which would
      // leave the cache empty. Cache each asset independently instead.
      .then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {}))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Never cache Firebase — it must always hit the network to stay live.
  if (url.hostname.endsWith('firebaseio.com') || url.hostname.endsWith('googleapis.com')) return;

  const isHTML = e.request.mode === 'navigate'
    || (e.request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Network-first for the app itself, so admin/code updates always arrive.
    // Falls back to cache only when genuinely offline.
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for images and static assets, refreshing in the background.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
