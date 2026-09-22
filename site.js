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


  /* ---------- the way into the shop ----------
   *
   * Every link to shop.html plays an oven door closing over the page before
   * the browser leaves it: a warm panel sweeps up from the bottom, the
   * wordmark settles into it, and the shop loads behind it.
   *
   * This wraps the most important click on the site, so it is built to fail
   * open. The click is only intercepted once every precondition is met, and
   * from that point three separate things can still complete the navigation:
   * the animation's own end, a watchdog timer, and a catch around the whole
   * attempt. A visitor who asked for less motion is never intercepted at
   * all, and neither is a middle-click, a modified click or a new tab.
   */
  var DOOR_MS = 460;

  function wantsStillness() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function ovenDoor(go) {
    var done = false;
    function finish() { if (done) return; done = true; go(); }

    try {
      var door = document.createElement('div');
      door.className = 'nu-door';
      door.setAttribute('aria-hidden', 'true');
      door.innerHTML = '<span class="nu-door__mark"></span>';
      document.body.appendChild(door);

      /* One frame, so the browser has a start state to animate FROM.
         Without it the class lands in the same style recalculation as the
         element itself and nothing moves. */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { door.classList.add('is-shut'); });
      });

      door.addEventListener('transitionend', function (e) {
        if (e.propertyName === 'transform') finish();
      });
    } catch (e) {
      finish();      /* no door, but the visitor still gets to the shop */
      return;
    }

    /* The watchdog. transitionend does not fire on a background tab, and it
       does not fire at all if something upstream removed the transition. */
    setTimeout(finish, DOOR_MS + 140);
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;

    /* Its own resolved URL against this page's, so './shop.html',
       'shop.html' and a full https:// address are all the same door — and a
       link to shop.html on ANOTHER host is not. */
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin) return;
    if (!/\/shop\.html$/.test(url.pathname)) return;

    if (wantsStillness()) return;   /* let the browser navigate plainly */

    e.preventDefault();
    ovenDoor(function () { location.href = a.href; });
  });

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
