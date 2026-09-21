// Bump this version on every deploy that must reach existing users.
const CACHE = 'nuika-v12';

// Relative paths, so the same worker is correct whether the site is served
// from the domain root (nuika.co.il) or a subdirectory.
//
// The film is deliberately not in this list. Both posters are: they are 50KB
// and 40KB, and they are what anyone whose browser refuses to autoplay
// actually looks at. The two video files they stand in for are 13.7MB and
// 10.5MB and belong nowhere near a precache — see the exclusion in the fetch
// handler below.
//
// Both, not just the wide one. At phone width the page requests both and then
// sets v.poster to the phone cut, so precaching only the wide one caches the
// file that gets discarded and leaves the one actually on screen uncached:
// offline, it is a blank hero in exactly the case the poster exists for.
//
// './shop.html' was deliberately absent until the cutover: the file did not
// exist, precaching a name that 404s buys nothing — install swallows the
// failure — and carving it out of the "every precached path exists" check
// would have put a hole in the one check that catches a typo'd path. The
// cutover created it, so it is listed here now, in the same commit, and the
// validator fails if a future commit removes it while the file is still here.
//
// Both './' and './index.html' stay. They are the same bytes today (the film
// home page), but './' is what a visitor who typed nuika.co.il actually
// requested, and a cache entry is keyed on the full URL: dropping either one
// leaves that visitor with no offline copy of the page they asked for.
const ASSETS = [
  './',
  './index.html',
  './shop.html',
  './admin.html',
  './story.html',
  './gallery.html',
  './contact.html',
  './events.html',
  './site.css',
  './site.js?v=2',
  './logo.png.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.json',
  './media/film-poster.jpg',
  './media/film-poster-phone.jpg',
  './images/1-lechem-mushalam.jpg',
  './images/2-lechem-kusmin.jpg',
  './images/3-baguette.jpg',
  './images/4-ugat-earl-grey.jpg',
  './images/5-lachmaniya.jpg',
  './images/6-maafe-ananin.jpg',
  './images/hero-sandwich.jpg',
  './images/hero-loaf.jpg',
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
  // The translation API is per-phrase and its answers are not assets — cached,
  // they only grow the app cache with third-party JSON.
  if (url.hostname.endsWith('firebaseio.com')
      || url.hostname === 'www.googleapis.com'
      || url.hostname === 'api.mymemory.translated.net') return;

  // The film is 13.7MB (desktop) and 10.5MB (phone), and the non-HTML branch
  // below is cache-first over './' — so a visitor who has the shop's worker
  // installed and then opens the home page streams the whole file into the
  // same cache the shop lives in. Phones cap how much a site may store, and
  // hitting the cap throws ALL of it away, the shop included.
  //
  // This line is also the one that keeps seeking working, and it is the only
  // one: returning without calling respondWith() hands the request back to
  // the browser untouched, so the native range-request machinery the <video>
  // element relies on is never in the worker's hands at all. The 206 refusal
  // in cacheable() below does NOT cover this — do not delete this line
  // thinking it does. What breaks scrubbing in Safari is a full 200 copy
  // sitting in the cache and being served in answer to a range request, and
  // nothing downstream of here can prevent that once the copy exists.
  if (/\.(mp4|webm|mov)$/i.test(url.pathname)) return;

  // Only store a genuinely good response. Without this a transient Cloudflare
  // or GitHub Pages error page — which is text/html and matches the HTML test —
  // gets written into the cache AS the shop, and stays there until CACHE is
  // bumped. Opaque responses (status 0) are cross-origin scripts and fonts,
  // which are fine to keep.
  //
  // 206 is refused explicitly, and it is worth being exact about what that
  // does and does not buy. Measured against a Range-capable origin, with and
  // without this clause, nothing partial reached the cache either way:
  // caches.put() already rejects a partial response by spec and the .catch()
  // below swallows the rejection. So this is defence in depth and a statement
  // of intent — never let a range request be what seeds a cache entry, and
  // never let a future refactor reach put() by another route and get away
  // with it. It is NOT what protects seeking. The video exclusion above is.
  const cacheable = res =>
    res && (res.ok || res.type === 'opaque') && !res.redirected && res.status !== 206;

  const store = (req, res) => {
    if (!cacheable(res)) return;
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
  };

  const isHTML = e.request.mode === 'navigate'
    || (e.request.headers.get('accept') || '').includes('text/html');

  // Since the cutover the shop is './shop.html' and './index.html' is the
  // film. (Before it, './index.html' WAS the shop — which is why this resolves
  // per-URL rather than falling back to one page for everything.) A customer
  // who loses signal lands back on their cart, not on a video.
  const SHOP_FALLBACK = './shop.html';
  const isShopUrl = url.pathname.endsWith('/shop.html')
    || url.pathname.endsWith('/admin.html')
    || url.search.includes('admin');

  if (isHTML) {
    // Network-first for the app itself, so admin/code updates always arrive.
    // Falls back to cache only when genuinely offline.
    //
    // ignoreSearch, because the admin panel is a query string on the shop's
    // own URL ('?admin') and a cache entry is keyed on the full URL including
    // the search. Without it, Noy offline at 'shop.html?admin' misses her own
    // precached page and drops through to the per-URL fallback below. The
    // server returns the same HTML for either URL, so ignoring the search
    // here is not a guess; it is what the origin already does.
    //
    // (This paragraph used to end "…resolves '?admin' to './shop.html', a
    // file that does not exist until the cutover." It exists now, and it is
    // in ASSETS above.)
    e.respondWith(
      fetch(e.request)
        .then(res => { store(e.request, res); return res; })
        .catch(() => caches.match(e.request, { ignoreSearch: true })
          .then(r => r || caches.match(isShopUrl ? SHOP_FALLBACK : './index.html')))
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
