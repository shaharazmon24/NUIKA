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

  var SOCIAL = [
    { href: 'https://www.instagram.com/nuika_bread/', he: 'אינסטגרם', en: 'Instagram' },
    { href: 'https://wa.me/972547382282',             he: 'וואטסאפ',  en: 'WhatsApp' }
  ];

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
  function nuikaHeader(active) {
    return '' +
      '<a class="nu-mark" href="./index.html" aria-label="NUIKA">' +
        '<span class="nu-mark__art"></span>' +
      '</a>' +
      '<nav class="nu-nav">' + navHTML(active) + '</nav>' +
      '<button class="nu-lang" type="button" data-nuika-lang></button>';
  }

  function nuikaFooter() {
    var links = SOCIAL.map(function (s) {
      return '<a class="nu-soc" href="' + esc(s.href) + '" target="_blank" rel="noopener">' +
             '<span lang-content="he">' + esc(s.he) + '</span>' +
             '<span lang-content="en">' + esc(s.en) + '</span></a>';
    }).join('');
    return '' +
      '<a class="nu-mark nu-mark--foot" href="./index.html" aria-label="NUIKA"></a>' +
      '<div class="nu-soc-row">' + links + '</div>' +
      '<p class="nu-fine">' +
        '<span lang-content="he">רחובות · איסוף בימי שישי</span>' +
        '<span lang-content="en">Rehovot · Friday pickup</span>' +
      '</p>' +
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

  function nuikaLang(next) {
    var lang = next === 'en' ? 'en' : 'he';
    var root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');

    var nodes = document.querySelectorAll('[lang-content]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].hidden = nodes[i].getAttribute('lang-content') !== lang;
    }

    var btn = document.querySelector('[data-nuika-lang]');
    if (btn) {
      btn.textContent = lang === 'he' ? 'EN' : 'עב';
      btn.setAttribute('aria-label', lang === 'he' ? 'Switch to English' : 'החלף לעברית');
    }

    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* nothing to do */ }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-nuika-lang]');
    if (btn) nuikaLang(currentLang() === 'he' ? 'en' : 'he');
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
})();
