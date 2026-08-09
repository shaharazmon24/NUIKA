// Bump this version on every deploy that must reach existing users.
const CACHE = 'nuika-v5';

// Relative paths, so the same worker is correct whether the site is served
// from the domain root (nuika.co.il) or a subdirectory.
const ASSETS = [
  './',
  './index.html',
  './logo.png.png',
  './icon-192.png',
  './icon-512.png',
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

  // Never cache the live database. fonts.googleapis.com also ends in
  // googleapis.com, so match it exactly rather than by suffix.
  if (url.hostname.endsWith('firebaseio.com') || url.hostname === 'www.googleapis.com') return;

  // Only store a genuinely good response. Without this a transient Cloudflare
  // or GitHub Pages error page — which is text/html and matches the HTML test —
  // gets written into the cache AS the shop, and stays there until CACHE is
  // bumped. Opaque responses (status 0) are cross-origin scripts and fonts,
  // which are fine to keep.
  const cacheable = res => res && (res.ok || res.type === 'opaque') && !res.redirected;

  const store = (req, res) => {
    if (!cacheable(res)) return;
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
  };

  const isHTML = e.request.mode === 'navigate'
    || (e.request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Network-first for the app itself, so admin/code updates always arrive.
    // Falls back to cache only when genuinely offline.
    e.respondWith(
      fetch(e.request)
        .then(res => { store(e.request, res); return res; })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for images and static assets, refreshing in the background.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request)
        .then(res => { store(e.request, res); return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
