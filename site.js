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

  var NAV = [
    { key: 'story',   href: './story.html',   he: 'הסיפור',    en: 'Story' },
    { key: 'gallery', href: './gallery.html', he: 'גלריה',     en: 'Gallery' },
    { key: 'events',  href: './events.html',  he: 'אירועים',   en: 'Events' },
    { key: 'contact', href: './contact.html', he: 'דברו איתי', en: 'Talk to me' }
  ];

  var SOCIAL = [
    { href: 'https://www.instagram.com/nuika_bread/', he: 'אינסטגרם', en: 'Instagram' },
    { href: 'https://wa.me/972500000000',            he: 'וואטסאפ',  en: 'WhatsApp' }
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
             ' href="' + item.href + '"' + (current ? ' aria-current="page"' : '') + '>' +
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
        '<img src="./images/logo.png" alt="NUIKA" width="160" height="59">' +
      '</a>' +
      '<nav class="nu-nav">' + navHTML(active) + '</nav>' +
      '<button class="nu-lang" type="button" data-nuika-lang></button>';
  }

  function nuikaFooter() {
    var links = SOCIAL.map(function (s) {
      return '<a class="nu-soc" href="' + s.href + '" target="_blank" rel="noopener">' +
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  window.nuikaHeader = nuikaHeader;
  window.nuikaFooter = nuikaFooter;
})();
