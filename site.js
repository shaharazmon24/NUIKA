/* NUIKA — chrome shared by every page of the new site.
 *
 * The header and the footer are built here and nowhere else. There is no
 * second copy, so no page can drift out of sync with a stale menu.
 *
 * A page opts in by placing an empty element:
 *     <header data-nuika-header="story"></header>
 *     <footer data-nuika-footer></footer>
 * The attribute's value marks which menu item is the current page.
 */

(function () {
  'use strict';

  /* Every value below reaches innerHTML, so every value below goes through
     esc(). These are hardcoded today; if they ever become admin-editable,
     esc() stops an attribute breakout but NOT a javascript: URL — that would
     need the scheme checked as well. */
  var NAV = [
    { key: 'story',   href: './story.html',   he: 'הסיפור',    en: 'Story' },
    { key: 'gallery', href: './gallery.html', he: 'גלריה',     en: 'Gallery' },
    { key: 'events',  href: './events.html',  he: 'אירועים',   en: 'Events' },
    { key: 'contact', href: './contact.html', he: 'דברו איתי', en: 'Talk to me' }
  ];

  /* The places to find Noy, as marks rather than words.

     Each entry carries its own glyph. An icon with no text needs an
     accessible name or it reaches a screen reader as "link", so `he`/`en`
     stay — they are now the aria-label instead of the visible label.

     FACEBOOK: asked for on 22 Sep 2026, then set aside the same day — NUIKA
     has no Facebook address anywhere in this repo, and Shahar's answer when
     asked for one was that it is not relevant for now. If that changes it is
     one entry in this array and it appears on all five pages at once;
     nothing else needs touching. */
  var SOCIAL = [
    {
      href: 'https://www.instagram.com/nuika_bread/',
      he: 'אינסטגרם', en: 'Instagram',
      icon: '<rect x="2" y="2" width="20" height="20" rx="5.5"/>' +
            '<circle cx="12" cy="12" r="4.2"/>' +
            '<circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none"/>'
    },
    {
      href: 'https://wa.me/972547382282',
      he: 'וואטסאפ', en: 'WhatsApp',
      icon: '<path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.6-4.5a8.4 8.4 0 1 1 15.4-4.4Z"/>' +
            '<path d="M9.2 8.4c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2 0 .4-.1.5l-.5.6c-.1.2-.2.3-.1.5a6 6 0 0 0 3 2.9c.2.1.4 0 .5-.1l.5-.6c.2-.2.3-.2.5-.1l1.8.9c.2.1.4.2.4.4a1.9 1.9 0 0 1-1.3 1.6 3.4 3.4 0 0 1-2.5-.3 10 10 0 0 1-4.7-4.4 3.7 3.7 0 0 1-.8-2.1c0-.7.3-1.3.7-1.6Z"/>'
    }
  ];

  /* Street address and pickup day, in one place. It used to say only
     "רחובות", which is a town, not somewhere a customer can drive to. */
  var PLACE = {
    he: 'ש. בן ציון 13, רחובות · איסוף בימי שישי',
    en: 'S. Ben Zion 13, Rehovot · Friday pickup'
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function navHTML(active) {
    return NAV.map(function (item) {
      var current = item.key === active;
      return '<a class="nu-nav__item' + (current ? ' is-current' : '') + '"' +
             ' href="' + esc(item.href) + '"' + (current ? ' aria-current="page"' : '') + '>' +
             '<span lang-content="he">' + esc(item.he) + '</span>' +
             '<span lang-content="en">' + esc(item.en) + '</span>' +
             '</a>';
    }).join('');
  }

  /* The full wordmark is never rendered below 130px wide — under that its
     finest strokes fade out. The header sits at 160px, which measures 59px
     tall and leaves the flower legible. */

  /* Both wordmarks below point at './index.html', and after the cutover that
     is the FILM home page, not the shop. This was decided, not inherited.

     On the open web it is simply right: the logo is the way home, and home is
     the film. Nothing else on these pages offers that.

     Inside the installed app it resolves differently, and that is the part
     worth writing down. index.html's first script forwards an installed
     launch straight to './shop.html', so in the app every wordmark tap lands
     on the shop instead of the film. That is not a loop and not a trap — the
     forward is location.replace(), which leaves no history entry, so Back
     from the shop goes to the page the tap came from, not around again
     (verified). The app's own identity says the same thing: the manifest's
     start_url is './shop.html'. Noy installed a shop; in the shop app the
     mark leading to the shop is the honest answer.

     The alternative — pointing these at './shop.html' — was rejected because
     it would fix a case nobody is in (there is no "home page" inside a shop
     app) by breaking the case everybody is in: a customer on contact.html in
     an ordinary tab would tap the logo and be dropped in the menu.

     The cost is real and accepted: the film is unreachable from inside the
     installed app. If that ever needs to change, the fix belongs in
     index.html's installed-launch redirect, not here. */
  function nuikaHeader(active) {
    return '' +
      '<a class="nu-mark" href="./index.html" aria-label="NUIKA">' +
        '<span class="nu-mark__art"></span>' +
      '</a>' +
      '<nav class="nu-nav">' + navHTML(active) + '</nav>' +
      '<button class="nu-lang" type="button" data-nuika-lang></button>';
  }

  function nuikaFooter() {
    /* icon markup is ours, from SOCIAL above — never user input — so it goes
       in whole; href and the label are escaped like everything else. */
    var links = SOCIAL.map(function (s) {
      return '<a class="nu-soc" href="' + esc(s.href) + '" target="_blank" rel="noopener"' +
             ' aria-label="' + esc(s.he) + '" data-label-he="' + esc(s.he) + '" data-label-en="' + esc(s.en) + '">' +
             '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"' +
             ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
             s.icon + '</svg></a>';
    }).join('');
    return '' +
      '<a class="nu-mark nu-mark--foot" href="./index.html" aria-label="NUIKA"></a>' +
      '<div class="nu-soc-row">' + links + '</div>' +
      '<p class="nu-fine">' +
        '<span lang-content="he">' + esc(PLACE.he) + '</span>' +
        '<span lang-content="en">' + esc(PLACE.en) + '</span>' +
      '</p>' +
      /* Filled only by a page that asks for it — index.html does, from a
         single REST read of nuika/settings. Empty and hidden everywhere
         else, so no other page pays for a network round trip it will not
         use. */
      '<p class="nu-orders" data-nuika-orders hidden></p>' +
      '<a class="nu-to-shop" href="./shop.html">' +
        '<span lang-content="he">למאפייה של NUIKA</span>' +
        '<span lang-content="en">To the NUIKA bakery</span>' +
      '</a>';
  }

  function mount() {
    var head = document.querySelector('[data-nuika-header]');
    if (head) head.innerHTML = nuikaHeader(head.getAttribute('data-nuika-header'));
    var foot = document.querySelector('[data-nuika-footer]');
    if (foot) foot.innerHTML = nuikaFooter();

    nuikaLang(readLang());
    releaseMotion();

    /* The other half of the transition that brought us here. Last, so the
       page underneath the panel is already built and laid out when the panel
       opens on it. */
    playArrival();
  }

  /* ---------- language ---------- */
  /* The shop already toggles with lang-content="he" / "en" attributes. The new
     pages use the same attribute so there is one idea to learn, not two. */

  var LANG_KEY = 'nuika-lang';

  function readLang() {
    try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'he'; }
    catch (e) { return 'he'; }   /* private mode throws rather than returning null */
  }

  /* The live language comes from the document, never from storage. A failed
     write must cost the visitor their preference on the NEXT visit, not the
     ability to switch at all on this one. */
  function currentLang() {
    return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'he';
  }

  /* Listeners for an actual language change. They fire from nuikaLang() only
     when the value moved, never on a same-language call — nuikaRefresh() calls
     nuikaLang(currentLang()) on purpose, and a listener that re-injects markup
     calls nuikaRefresh() in turn. Firing on every call would make that pair an
     infinite loop the first time anyone wired them together. */
  var langListeners = [];

  function nuikaOnLangChange(fn) {
    if (typeof fn === 'function') langListeners.push(fn);
  }

  function nuikaLang(next) {
    var wasLang = currentLang();
    var lang = next === 'en' ? 'en' : 'he';
    var root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');

    var nodes = document.querySelectorAll('[lang-content]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].hidden = nodes[i].getAttribute('lang-content') !== lang;
    }

    /* An icon-only link has no text to swap, so its accessible name lives in
       an attribute and the [lang-content] pass above cannot reach it. Without
       this the social marks announce themselves in Hebrew to an English
       reader for the life of the page. */
    var labelled = document.querySelectorAll('[data-label-he][data-label-en]');
    for (var k = 0; k < labelled.length; k++) {
      var label = labelled[k].getAttribute('data-label-' + lang);
      if (label) labelled[k].setAttribute('aria-label', label);
    }

    var btn = document.querySelector('[data-nuika-lang]');
    if (btn) {
      btn.textContent = lang === 'he' ? 'EN' : 'עב';
      btn.setAttribute('aria-label', lang === 'he' ? 'Switch to English' : 'החלף לעברית');
    }

    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* nothing to do */ }

    /* One listener that throws must not stop the others, and must not leave
       the page half-switched. */
    if (lang !== wasLang) {
      for (var j = 0; j < langListeners.length; j++) {
        try { langListeners[j](lang); }
        catch (e) { console.error('nuika: a language listener threw', e); }
      }
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-nuika-lang]');
    if (btn) nuikaLang(currentLang() === 'he' ? 'en' : 'he');
  });


  /* ---------- moving between pages ----------
   *
   * Every navigation inside the site plays a panel across the screen, and
   * the page being arrived at pulls the same panel away. Two flavours:
   *
   *   oven  — for the shop. A warm panel rises from the bottom and the
   *           wordmark settles into it. It is the door of the bakery, and it
   *           takes its time.
   *   sweep — everywhere else. The panel crosses in the reading direction,
   *           right to left in Hebrew and the other way in English, and it
   *           is quick: this happens on every link, so it has to stay out of
   *           the way.
   *
   * This wraps every internal click on the site, so it is built to fail
   * open. The click is only intercepted once every precondition is met, and
   * from there three separate things can complete the navigation: the
   * animation's own end, a watchdog timer, and a catch around the whole
   * attempt. Modified clicks, middle clicks, new tabs, downloads, other
   * origins, anchors on the same page, and anyone who asked for less motion
   * are never intercepted at all.
   *
   * The arriving half is what makes it a transition rather than a wipe
   * followed by a hard cut: the outgoing page leaves a note in
   * sessionStorage, and the page that loads next reads it, paints the panel
   * already closed, and opens it. The note is cleared the instant it is
   * read, so a stray one can never cover a page nobody navigated to.
   */
  var OVEN_MS  = 460;
  var SWEEP_MS = 340;
  var ARRIVE_KEY = 'nuika-arriving';

  function wantsStillness() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function makePanel(flavour) {
    var panel = document.createElement('div');
    panel.className = 'nu-door nu-door--' + flavour;
    panel.setAttribute('aria-hidden', 'true');
    if (flavour === 'oven') panel.innerHTML = '<span class="nu-door__mark"></span>';
    return panel;
  }

  /* Closes the panel over the page, then hands control back. */
  function closePanel(flavour, go) {
    var done = false;
    function finish() { if (done) return; done = true; go(); }

    try {
      var panel = makePanel(flavour);
      document.body.appendChild(panel);

      /* One frame, so the browser has a start state to animate FROM. Without
         it the class lands in the same style recalculation as the element
         itself and nothing moves. */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { panel.classList.add('is-shut'); });
      });

      panel.addEventListener('transitionend', function (e) {
        if (e.propertyName === 'transform') finish();
      });
    } catch (e) {
      finish();      /* no panel, but the visitor still gets where they asked */
      return;
    }

    /* The watchdog. transitionend does not fire on a background tab, and it
       does not fire at all if something upstream removed the transition. */
    setTimeout(finish, (flavour === 'oven' ? OVEN_MS : SWEEP_MS) + 160);
  }

  /* The other half, on the page being arrived at: paint the panel already
     closed and open it. */
  function openPanel(flavour) {
    var panel;
    try {
      panel = makePanel(flavour);
      panel.classList.add('is-shut');
      document.body.appendChild(panel);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { panel.classList.remove('is-shut'); });
      });
      panel.addEventListener('transitionend', function (e) {
        if (e.propertyName === 'transform' && panel.parentNode) panel.remove();
      });
    } catch (e) {
      if (panel && panel.parentNode) panel.remove();
      return;
    }
    /* Unconditional. Whatever happens to the transition, this panel comes off
       the page — it is the one thing here that is covering content. */
    setTimeout(function () { if (panel.parentNode) panel.remove(); },
               (flavour === 'oven' ? OVEN_MS : SWEEP_MS) + 260);
  }

  /* Back from a page restores the whole document from the browser's cache,
     panel and all, in whatever state it was left. That is an opaque sheet
     over the page, and because it takes no pointer events it does not even
     read as an overlay: the page simply looks broken until a manual reload. */
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    var stuck = document.querySelectorAll('.nu-door');
    for (var i = 0; i < stuck.length; i++) stuck[i].remove();
  });

  /* Which flavour a destination gets. The shop is the bakery door; every
     other page on the site is a sweep. */
  function flavourFor(pathname) {
    return /\/shop\.html$/.test(pathname) ? 'oven' : 'sweep';
  }

  /* A link this site should animate away from: same origin, a real page
     rather than an asset or a jump to an anchor on this one. */
  function internalPage(a) {
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return null; }
    if (url.origin !== location.origin) return null;

    /* An anchor on the page we are already on is not a navigation. */
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return null;

    /* Pages, not files. Anything with another extension is a download or an
       asset and the browser should handle it untouched. */
    var last = url.pathname.split('/').pop();
    if (last && last.indexOf('.') !== -1 && !/\.html?$/i.test(last)) return null;

    return url;
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    if (a.getAttribute('href').charAt(0) === '#') return;

    var url = internalPage(a);
    if (!url) return;

    if (wantsStillness()) return;   /* let the browser navigate plainly */

    var flavour = flavourFor(url.pathname);
    e.preventDefault();

    /* Written before leaving, read by the page that loads next. */
    try { sessionStorage.setItem(ARRIVE_KEY, flavour); } catch (err) { /* fine without it */ }

    closePanel(flavour, function () { location.href = a.href; });
  });

  /* Arrival. Read once and cleared immediately, so a note left by a
     navigation that never completed cannot cover some later page. */
  function playArrival() {
    var flavour = null;
    try {
      flavour = sessionStorage.getItem(ARRIVE_KEY);
      sessionStorage.removeItem(ARRIVE_KEY);
    } catch (err) { return; }
    if (!flavour || wantsStillness()) return;
    openPanel(flavour === 'oven' ? 'oven' : 'sweep');
  }

  /* ---------- releasing the movements ---------- */
  /* Someone who asked for less motion gets the final state immediately. The
     CSS already renders it; this makes sure the script never undoes that. */

  /* One observer, created lazily and reused across every releaseMotion() call
     (mount() calls it once, nuikaRefresh() may call it many times after).
     Reusing it is what keeps a later call from watching the same element
     with a second, independent observer. */
  var motionObserver = null;

  function releaseMotion() {
    var targets = document.querySelectorAll('.rise, .fade, .reveal');
    var quiet = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (quiet || !('IntersectionObserver' in window)) {
      for (var i = 0; i < targets.length; i++) targets[i].classList.add('is-in');
      return;
    }

    if (!motionObserver) {
      motionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          motionObserver.unobserve(entry.target);   /* one movement per element, never a loop */
        });
      }, { rootMargin: '0px 0px -12% 0px' });
    }

    for (var j = 0; j < targets.length; j++) {
      /* Already landed — leave it alone. Without this an element that was
         already unobserved after animating in would get observe()'d again
         and, since it is typically still on screen, would fire a second time. */
      if (targets[j].classList.contains('is-in')) continue;
      motionObserver.observe(targets[j]);   /* a no-op if already being watched */
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  /* Anything that injects [lang-content] or .rise/.fade/.reveal markup after
     load — the events board rendered from Firebase, for instance — must call
     this afterwards, or the new markup shows both languages at once and any
     motion class on it never releases. It never re-mounts the header or
     footer; it only re-applies the language and re-scans for new movement
     targets. */
  function nuikaRefresh() {
    nuikaLang(currentLang());
    releaseMotion();
  }

  window.nuikaHeader = nuikaHeader;
  window.nuikaFooter = nuikaFooter;
  window.nuikaLang = nuikaLang;
  window.nuikaRefresh = nuikaRefresh;
  window.nuikaEsc = esc;
  window.nuikaOnLangChange = nuikaOnLangChange;
})();
