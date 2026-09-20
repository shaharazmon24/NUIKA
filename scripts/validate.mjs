// Guardrail for a single-file site with no build step.
//
// The failure mode this exists to catch: someone uploads a whole index.html
// through GitHub's web uploader from a stale local copy. Git accepts it as a
// normal commit, the site keeps loading, and the loss is invisible until a
// customer hits it. These checks turn that into a red X on the commit.
//
// Run locally:  node scripts/validate.mjs
// CI runs each phase separately so the failing one is obvious in the log.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

const phases = process.argv.slice(2);
const want = f => phases.length === 0 || phases.includes(`--${f}`);

let failed = false;
const pass = m => console.log(`  ok    ${m}`);
const fail = m => { console.error(`  FAIL  ${m}`); failed = true; };

// The last <script> block holds the whole application.
function appScript() {
  const start = html.lastIndexOf('<script>');
  const end = html.lastIndexOf('</script>');
  if (start < 0 || end < 0 || end < start) return null;
  return html.slice(start + '<script>'.length, end);
}

if (want('syntax')) {
  console.log('JavaScript syntax:');
  const js = appScript();
  if (!js) {
    fail('could not locate the application <script> block');
  } else {
    try {
      new Function(js);
      pass(`parses (${js.split('\n').length} lines)`);
    } catch (err) {
      fail(`syntax error: ${err.message}`);
    }
  }

  // A merge that was committed without resolving would ship these markers.
  if (/^(<{7}|={7}|>{7})/m.test(html)) fail('unresolved merge conflict markers');
  else pass('no conflict markers');
}

if (want('features')) {
  console.log('Critical features:');
  // Each entry is something whose absence means real, silent breakage.
  const required = [
    ['firebase.initializeApp',  'Firebase init — without it nothing syncs and the shop is stuck on build-time data'],
    ['${ROOT}/orders/',         'orders are written to Firebase'],
    ['function esc(',           'HTML escaping for customer-supplied text in the admin panel'],
    ['ordersAreOpen',           'closed-shop / deadline enforcement'],
    ['kitchenReady',            'guard that stops kitchen saves overwriting real data with defaults'],
    ['_submitting',             'double-submit guard on the order button'],
    ['getCartTotal()',          'order total is computed, not read from a stale variable'],
    ['persistCart',             'cart survives a reload'],
    ['PICKUP_ADDRESS',          'pickup-only ordering'],
    ['togglePayment',           'cash / Bit / PayBox selection'],
    ['rel="manifest"',          'the manifest is linked, or the app stops being installable'],
    ['serviceWorker.register',  'the service worker is registered'],
    ['pruneCart',               'sold-out items are cleared from the cart rather than becoming unremovable'],
    ['menuProducts',            'dishes parked in the bank stay hidden from customers'],
    ['toggleInMenu',            'dishes can be moved between the menu and the bank'],
  ];
  for (const [needle, why] of required) {
    if (html.includes(needle)) pass(why);
    else fail(`missing "${needle}" — ${why}`);
  }

  // Bugs that shipped once already. Their exact shape must not come back.
  const banned = [
    ['itemsTotal + delivery', 'undefined variable that silently killed order submission'],
  ];
  for (const [needle, why] of banned) {
    if (html.includes(needle)) fail(`regression: "${needle}" — ${why}`);
    else pass(`no regression: ${why}`);
  }
}

if (want('assets')) {
  console.log('Service worker:');
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  try {
    new Function(sw);
    pass('sw.js parses');
  } catch (err) {
    // A broken worker fails to install, so every existing visitor silently
    // keeps the old cached app while a fresh browser looks perfectly fine.
    fail(`sw.js syntax error: ${err.message}`);
  }
  // The precache swallows failures by design, so a typo'd path is invisible
  // at runtime and stays broken forever.
  const assetList = sw.match(/const ASSETS = \[([\s\S]*?)\]/);
  if (assetList) {
    for (const m of assetList[1].matchAll(/'\.\/([^']*)'/g)) {
      const rel = m[1];
      if (!rel || existsSync(join(ROOT, rel))) pass(`precache ./${rel}`);
      else fail(`sw.js precaches a file that does not exist: ./${rel}`);
    }
  }

  console.log('Deployment:');
  // Deleting or altering CNAME unsets the GitHub Pages custom domain, which
  // takes the whole shop offline. It has happened once already.
  const cnamePath = join(ROOT, 'CNAME');
  if (!existsSync(cnamePath)) fail('CNAME is missing — the custom domain will be unset and the site will go down');
  else {
    const host = readFileSync(cnamePath, 'utf8').trim();
    if (host === 'nuika.co.il') pass('CNAME points at nuika.co.il');
    else fail(`CNAME contains "${host}" — expected nuika.co.il`);
  }

  console.log('Referenced assets:');
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  for (const icon of manifest.icons || []) {
    const p = join(ROOT, icon.src);
    if (!existsSync(p)) { fail(`manifest icon missing on disk: ${icon.src}`); continue; }
    // The original install bug was a 2400x1400 logo declared as 192x192.
    // Read the real dimensions out of the PNG header rather than trusting it.
    const buf = readFileSync(p);
    if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') { fail(`${icon.src} is not a PNG`); continue; }
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    const [dw, dh] = (icon.sizes || '').split('x').map(Number);
    if (w === dw && h === dh) pass(`manifest icon ${icon.src} really is ${w}x${h}`);
    else fail(`${icon.src} is ${w}x${h} but the manifest declares ${icon.sizes} — Android will refuse to build a proper app icon`);
  }

  // Local images referenced from the page must actually be committed.
  const refs = new Set([...html.matchAll(/(?:src|href)="((?!https?:|data:|#|mailto:)[^"]+\.(?:png|jpe?g|svg|webp))"/g)]
    .map(m => m[1]));
  for (const ref of refs) {
    if (existsSync(join(ROOT, ref))) pass(ref);
    else fail(`referenced but not committed: ${ref}`);
  }
}

if (want('design')) {
  console.log('Design system assets:');

  // The supplied logo is 2400x1400 but the drawing occupies only 1915x703 —
  // 60% of the file's area is empty margin. A browser measures the file, not
  // the drawing, which is why the logo came out tiny everywhere it was used.
  // The cropped copy is what the site ships.
  const png = rel => {
    const p = join(ROOT, rel);
    if (!existsSync(p)) return null;
    const buf = readFileSync(p);
    if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return 'not-png';
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  };

  const logo = png('images/logo.png');
  if (!logo) fail('images/logo.png is missing — the cropped wordmark the site ships');
  else if (logo === 'not-png') fail('images/logo.png is not a PNG');
  else if (logo.w === 1915 && logo.h === 703) pass('images/logo.png is the cropped 1915x703 wordmark');
  else fail(`images/logo.png is ${logo.w}x${logo.h} — expected 1915x703 (margins not cropped?)`);

  const umbel = png('images/umbel.png');
  if (!umbel) fail('images/umbel.png is missing — the mark used below 130px');
  else if (umbel === 'not-png') fail('images/umbel.png is not a PNG');
  else if (umbel.w === 348 && umbel.h === 701) pass('images/umbel.png is the 348x701 flower and stem');
  else fail(`images/umbel.png is ${umbel.w}x${umbel.h} — expected 348x701 (wrong crop? it must not carry a letter)`);

  console.log('Design tokens:');
  if (!existsSync(join(ROOT, 'site.css'))) {
    fail('site.css is missing');
  } else {
    const css = readFileSync(join(ROOT, 'site.css'), 'utf8');
    const token = name => {
      const m = css.match(new RegExp('--' + name + '\\s*:\\s*(#[0-9A-Fa-f]{6})'));
      return m ? m[1].toUpperCase() : null;
    };

    // These are not preferences. --terra is sampled from the pixels of Noy's
    // logo; every other value was chosen so the pairs below clear their
    // threshold. A shade's difference is what drops a button under the line.
    const REQUIRED = {
      wheat: '#EFE6D6', ink: '#3B2A24', cream: '#F6F0E4', muted: '#6B655C',
      terra: '#B84830', 'terra-deep': '#AE472C',
      butter: '#F0E2BA', sage: '#C3C8AE', crust: '#B8935E',
    };
    for (const [name, expected] of Object.entries(REQUIRED)) {
      const got = token(name);
      if (got === expected) pass(`--${name} is ${expected}`);
      else fail(`--${name} is ${got || 'missing'} — expected ${expected}`);
    }

    // Assert the ratios rather than trusting the values, so a later "small
    // tweak" to a colour fails here instead of on a customer's phone in sun.
    const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = hex => {
      const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16)));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };

    const PAIRS = [
      ['ink',        'wheat',  4.5, 'body text on the page ground'],
      ['muted',      'wheat',  4.5, 'secondary text on the page ground'],
      ['cream',      'terra',  4.5, 'the label on the primary button'],
      ['terra-deep', 'wheat',  4.5, 'a link inside a paragraph'],
      ['cream',      'ink',    4.5, 'the footer and the dark button'],
      ['ink',        'butter', 4.5, 'dates and labels'],
      ['ink',        'sage',   4.5, 'the active filter'],
    ];
    for (const [fg, bg, min, why] of PAIRS) {
      const a = token(fg), b = token(bg);
      if (!a || !b) { fail(`cannot measure ${fg} on ${bg} — a token is missing`); continue; }
      const r = ratio(a, b);
      if (r >= min) pass(`${why}: ${r.toFixed(2)} (needs ${min})`);
      else fail(`${why}: ${r.toFixed(2)} is below ${min} — ${fg} on ${bg}`);
    }

    // --crust measures 2.30 as text on --wheat. It is a surface, never a letter.
    // Anchored so a bare `color:` trips it but `background-color:` and
    // `border-color:` — its intended uses — do not: unanchored, the text
    // "color: var(--crust)" is a substring of both, so the old pattern fired
    // on the intended uses too.
    if (/(?<![\w-])color\s*:\s*var\(\s*--crust\s*\)/.test(css))
      fail('--crust is used as a text colour; it measures 2.30 on --wheat and vanishes');
    else pass('--crust is never used as a text colour');

    console.log('Typography and RTL:');
    for (const t of ['font-display', 'font-text', 't-giant', 't-page', 't-sub', 't-body', 't-small', 't-label']) {
      if (new RegExp('--' + t + '\\s*:').test(css)) pass(`--${t} is defined`);
      else fail(`--${t} is missing`);
    }

    // The English flip has to happen by itself. One physical left/right is
    // enough to strand a margin on the wrong side and force a second copy of
    // the stylesheet to maintain. A genuine exception marks itself /* rtl-ok */.
    const physical = /\b(?:margin|padding|border)-(?:left|right)\b|\btext-align\s*:\s*(?:left|right)\b/;
    const offenders = css.split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => physical.test(line) && !line.includes('rtl-ok'))
      .map(({ n }) => n);
    if (offenders.length === 0) pass('no physical left/right — the English flip works by itself');
    else fail(`site.css uses physical left/right on line(s) ${offenders.join(', ')} — use the -inline- form, or mark the line /* rtl-ok */`);

    // A Latin run inside Hebrew reverses without this. "@nuika_bread" became
    // "nuika_bread@" in a mockup, in exactly this way.
    if (/unicode-bidi\s*:\s*isolate/.test(css)) pass('.ltr isolates Latin runs inside Hebrew');
    else fail('no unicode-bidi:isolate rule — Latin runs inside Hebrew will reverse');

    console.log('Components and motion:');
    for (const cls of ['.btn', '.btn--primary', '.btn--outline', '.btn--on-film', '.btn--ghost', '.link',
                       '.rise', '.fade', '.reveal']) {
      if (css.includes(cls + ' ') || css.includes(cls + ',') || css.includes(cls + '{') || css.includes(cls + ':'))
        pass(`${cls} is defined`);
      else fail(`${cls} is missing`);
    }

    // Without a visible focus ring, anyone navigating by keyboard cannot tell
    // where they are. It is not decoration. Scoped to the declarations actually
    // inside a :focus-visible rule, and requiring a real width and colour on
    // `outline` — checking for :focus-visible and outline-offset independently
    // used to stay green even after both `outline: 2px solid …` declarations
    // were replaced with `outline: none`.
    const focusBlocks = [...css.matchAll(/:focus-visible[^{]*\{([^}]*)\}/g)].map(m => m[1]).join('\n');
    const hasFocusOffset = /outline-offset\s*:\s*\d/.test(focusBlocks);
    const hasFocusOutline = /outline\s*:\s*\d+(?:\.\d+)?(?:px|em|rem)\s+\S+\s+\S+/.test(focusBlocks);
    if (focusBlocks && hasFocusOffset && hasFocusOutline)
      pass('a keyboard focus ring is defined with a real width and colour');
    else fail('no :focus-visible rule declares both a real outline (width + colour, not "none") and outline-offset — keyboard users lose their place');

    // Reduced motion must render the FINAL state, not a faster animation. Four
    // independent assertions: deleting the whole
    // `.rise, .fade, .reveal, [dir="ltr"] .reveal { opacity: 1; … }` rule used
    // to leave this check green, and so did deleting only the `[dir="ltr"]`
    // selector from it — the exact regression this branch found in a browser
    // and fixed, which is why it gets its own line here.
    const rm = css.match(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{([\s\S]*?)\n\}/);
    if (!rm) {
      fail('no prefers-reduced-motion block');
    } else {
      const block = rm[1];
      if (/animation\s*:\s*none/.test(block) && /transition\s*:\s*none/.test(block))
        pass('reduced motion switches animation and transition off, not shortens them');
      else fail('the prefers-reduced-motion block must set animation:none and transition:none');

      if (/opacity\s*:\s*1/.test(block))
        pass('reduced motion sets opacity:1 — .rise and .fade land visible, not stuck at 0');
      else fail('the prefers-reduced-motion block never sets opacity:1 — .rise and .fade would stay invisible forever with motion off');

      if (/clip-path\s*:\s*none/.test(block))
        pass('reduced motion sets clip-path:none — .reveal lands fully uncovered');
      else fail('the prefers-reduced-motion block never sets clip-path:none — .reveal would stay clipped shut forever with motion off');

      if (/\[dir=["']ltr["']\]/.test(block))
        pass('the reduced-motion final state also covers the [dir="ltr"] .reveal override');
      else fail('the prefers-reduced-motion block never mentions [dir="ltr"] — an English page would keep .reveal clipped shut even with motion off');
    }

    console.log('Header mark:');
    // After F1 the header's wordmark is a CSS mask (.nu-mark__art), not an
    // <img width="…">, so what used to be read out of site.js is checked here
    // instead. Anchored to a line start so it reads the base rule, never the
    // "on-film" override two-class selector further down that shares the name.
    const artRule = css.match(/^\.nu-mark__art\s*\{([^}]*)\}/m);
    if (!artRule) {
      fail('.nu-mark__art is not defined in site.css — the header would show no mark at all');
    } else {
      const artBody = artRule[1];
      if (/url\(\s*\.\/images\/logo\.png\s*\)/.test(artBody))
        pass('.nu-mark__art masks the cropped wordmark (images/logo.png)');
      else fail('.nu-mark__art does not mask images/logo.png — the header mark would be blank');

      // Below 130px wide the finest strokes of the umbel fade out.
      const artWidth = artBody.match(/width\s*:\s*(\d+)px/);
      if (!artWidth) fail('.nu-mark__art has no declared width — it renders at 0×0, invisible');
      else if (Number(artWidth[1]) < 130) fail(`.nu-mark__art is ${artWidth[1]}px wide — below its 130px floor, where the umbel's strokes vanish`);
      else pass(`.nu-mark__art is rendered at ${artWidth[1]}px, at or above its 130px floor`);
    }

    const mobile = css.match(/@media\s*\(\s*max-width:\s*720px\s*\)\s*\{([\s\S]*?)\n\}/);
    const mobileArt = mobile && mobile[1].match(/\.nu-mark__art\s*\{([^}]*)\}/);
    const mobileWidth = mobileArt && mobileArt[1].match(/width\s*:\s*(\d+)px/);
    if (!mobile) fail('no @media (max-width: 720px) block — cannot verify the mobile logo floor');
    else if (!mobileWidth) fail('the mobile block never sets a width for .nu-mark__art — it would fall back to the 160px desktop size, or worse, to nothing');
    else if (Number(mobileWidth[1]) < 130) fail(`the mobile override shrinks .nu-mark__art to ${mobileWidth[1]}px — below the 130px floor where the umbel's strokes vanish`);
    else pass(`the mobile override keeps .nu-mark__art at ${mobileWidth[1]}px, at or above its 130px floor`);

    console.log('Bilingual language toggle:');
    // Comments are prose and can say "html" or "display: revert" in passing —
    // the comment right above the real rules does exactly that. Strip comments
    // before pattern-matching, or a comment could satisfy a selector-shaped
    // regex by accident and let a real regression through silently.
    const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

    // The bug this guards against: [lang-content="en"] { display: none; }
    // alone is (0,1,0), the same specificity as .btn's own
    // display:inline-block, and the later rule in the file wins — a bilingual
    // .btn pair then shows both languages at once, permanently, on a Hebrew
    // page. The html prefix is what raises this to (0,2,1), which beats .btn.
    const enHideBodies = [...cssNoComments.matchAll(/\bhtml\b[^{}]*\[lang-content=["']en["']\][^{}]*\{([^}]*)\}/g)].map(m => m[1]);
    if (enHideBodies.some(b => /display\s*:\s*none/.test(b)))
      pass('an html-prefixed selector hides [lang-content="en"] — a bare attribute selector would tie with .btn and lose the cascade');
    else
      fail('no html-prefixed rule hides [lang-content="en"] with display:none — dropping the html prefix reintroduces the bug where a bilingual .btn shows both languages at once on a Hebrew page');

    // The other half of the toggle: hiding the Hebrew copy once the page is English.
    const heHideBodies = [...cssNoComments.matchAll(/html\[lang=["']en["']\][^{}]*\[lang-content=["']he["']\][^{}]*\{([^}]*)\}/g)].map(m => m[1]);
    if (heHideBodies.some(b => /display\s*:\s*none/.test(b)))
      pass('html[lang="en"] hides [lang-content="he"] — the Hebrew copy disappears once the page switches to English');
    else
      fail('no html[lang="en"] rule hides [lang-content="he"] with display:none — an English page would show the Hebrew copy alongside the English one');

    // Any rule that targets [lang-content=...] at all, regardless of which
    // language or how it is prefixed — !important and display:revert are
    // both banned everywhere in this mechanism, not just on the two rules above.
    const lcBodies = [...cssNoComments.matchAll(/\[lang-content=["'][a-z]+["']\][^{}]*\{([^}]*)\}/g)].map(m => m[1]);

    const noImportant = lcBodies.length > 0 && lcBodies.every(b => !/!important/.test(b));
    if (noImportant)
      pass('no lang-content rule carries !important — after Plan 5 this stylesheet shares a page with the shop\'s own, and !important here would outrank it');
    else
      fail(lcBodies.length === 0
        ? 'no lang-content rule exists in site.css — the bilingual hide mechanism is missing entirely'
        : 'a lang-content rule carries !important — it would outrank the shop\'s own display rules once this stylesheet shares a page with index.html');

    // display:revert rolls an element back past the author origin entirely —
    // on an English page a .btn would lose its inline-block and collapse to
    // plain inline. Only ever hide with display; a revealed element must keep
    // whatever display its own classes already give it.
    const noRevert = lcBodies.length > 0 && lcBodies.every(b => !/display\s*:\s*revert/.test(b));
    if (noRevert)
      pass('lang-content rules never use display:revert — a revealed element keeps its own class\'s display instead of being rolled back past the author origin');
    else
      fail(lcBodies.length === 0
        ? 'no lang-content rule exists in site.css — the bilingual hide mechanism is missing entirely'
        : 'a lang-content rule uses display:revert — on an English page a .btn would revert past its own inline-block rule and collapse to plain inline');
  }

  console.log('Shared chrome:');
  if (!existsSync(join(ROOT, 'site.js'))) {
    fail('site.js is missing');
  } else {
    const js = readFileSync(join(ROOT, 'site.js'), 'utf8');
    try { new Function(js); pass(`site.js parses (${js.split('\n').length} lines)`); }
    catch (err) { fail(`site.js syntax error: ${err.message}`); }

    for (const [needle, why] of [
      ['nuikaHeader',          'the header is built in one place'],
      ['nuikaFooter',          'the footer is built in one place'],
      ['data-nuika-header',    'pages mark where the header goes'],
      ['data-nuika-footer',    'pages mark where the footer goes'],
      ['nu-mark__art',         'the header renders the mask element the wordmark needs'],
      ['shop.html',            'the shop is reachable from every page'],
    ]) {
      if (js.includes(needle)) pass(why);
      else fail(`missing "${needle}" — ${why}`);
    }

    // The logo itself — the mask URL and the 130px floor, on both the base
    // rule and the mobile override — is asserted against site.css under
    // "Header mark" above. Since F1, site.js carries no width or image
    // reference at all; the mark is pure CSS.

    for (const [needle, why] of [
      ['LANG_KEY',              'the language key is defined once, not spelled out at each use'],
      ['nuikaLang(',            'the switch is a real function, not just markup that looks bilingual'],
      ['IntersectionObserver',  'movements are released when they reach the screen'],
      ['prefers-reduced-motion','reduced motion is honoured in script too, not only in CSS'],
      ['is-in',                 'the release class the stylesheet waits for'],
      ["'nuika-lang'",          'the stored key is exactly nuika-lang — renaming it silently drops every saved preference'],
    ]) {
      if (js.includes(needle)) pass(why);
      else fail(`missing "${needle}" — ${why}`);
    }

    // The flip must set dir on <html>, or the whole page stays right-to-left
    // while its words turn English.
    // Two separate facts, not one chained expression: the code reaches
    // documentElement, and something sets a "dir" attribute. Insisting the two
    // appear adjacent would fail on `var root = document.documentElement`
    // followed by `root.setAttribute('dir', ...)`, which is what site.js does.
    if (/documentElement/.test(js) && /setAttribute\(\s*['"]dir['"]/.test(js))
      pass('the language switch flips the document direction');
    else fail('the language switch never sets document direction — English would stay RTL');

    // nuikaRefresh is what a caller uses after injecting markup after load
    // (e.g. a Firebase-backed board in a later plan). Nothing else in this
    // file exercises dynamically-injected content, so deleting this function
    // leaves every other check green. Requiring both the declaration and the
    // window export — not just the bare word — matters: releaseMotion()'s own
    // doc-comment above mentions "nuikaRefresh()" in passing, so a plain
    // js.includes('nuikaRefresh') would stay green even after the real
    // function and its export were deleted.
    if (/function\s+nuikaRefresh\s*\(/.test(js) && /window\.nuikaRefresh\s*=/.test(js))
      pass('nuikaRefresh exists — content injected after load has a way to re-apply language and release motion');
    else
      fail('nuikaRefresh is missing — content injected after load would render in both languages at once and never release its motion classes');

    // The real number is already public on the live shop (index.html,
    // OWNER_WHATSAPP). A placeholder here is a dead contact link on the
    // bakery's own footer. Anchored to the actual wa.me link rather than a
    // bare digit string, so a mention in a comment (e.g. a TODO) could not
    // satisfy this while the real href stays a placeholder.
    if (js.includes('wa.me/972547382282'))
      pass('the real WhatsApp number is wired into the footer');
    else
      fail('site.js does not contain the real WhatsApp number 972547382282 — a placeholder here is a dead contact link on a bakery\'s own footer');
  }
}

if (want('pages')) {
  console.log('New pages:');

  // Every page of the new site shares one skeleton. These are not style
  // preferences: each line below is something that silently breaks the page
  // for somebody if it is missing.
  const PAGES = ['home.html', 'story.html', 'gallery.html', 'contact.html'];

  for (const page of PAGES) {
    const p = join(ROOT, page);
    if (!existsSync(p)) { fail(`${page} is missing`); continue; }
    const h = readFileSync(p, 'utf8');
    const need = (re, why) => re.test(h) ? pass(`${page}: ${why}`) : fail(`${page}: ${why}`);

    need(/<html[^>]+lang="he"/, 'starts in Hebrew, so the CSS hides English before any script runs');
    need(/<html[^>]+dir="rtl"/, 'starts right-to-left');
    need(/<link[^>]+href="\.\/site\.css"/, 'loads the shared stylesheet');
    need(/<script[^>]+src="\.\/site\.js"/, 'loads the shared script');
    need(/data-nuika-header=/, 'declares where the shared header goes');
    need(/data-nuika-footer/, 'declares where the shared footer goes');
    need(/fonts\.googleapis\.com/, 'loads Bellefair and Plex, or the page silently falls back to Times New Roman');
    need(/<meta[^>]+viewport/, 'has a viewport, or a phone renders it at desktop width');
    need(/<title>/, 'has a title');
    need(/<meta[^>]+name="description"/, 'has a description for search results and link previews');

    // A page that writes its own colour has left the design system, and the
    // contrast guard no longer covers it.
    const hex = [...h.matchAll(/(?:color|background)\s*:\s*(#[0-9A-Fa-f]{3,6})/g)].map(m => m[1]);
    if (hex.length) fail(`${page}: writes raw colours (${[...new Set(hex)].join(', ')}) instead of using the tokens`);
    else pass(`${page}: takes every colour from site.css`);

    // The same rule site.css lives under. The English flip has to work by
    // itself, in the page's own styles too.
    //
    // The property forms (margin-left, padding-right, border-left,
    // text-align:left/right) are unambiguous wherever they appear, so they
    // are checked across the whole page. The bare `left:`/`right:`
    // positioning form, `float:`, and `background-position:` are NOT
    // unambiguous outside CSS — `const r = { left: rect.left, right:
    // rect.right };` is ordinary JavaScript (and exactly the shape a later
    // task's own browser-check code will contain), and the word "left" turns
    // up in ordinary prose too. So those three are only looked for inside
    // <style> blocks. `background-position` allows either keyword order
    // (`top left`, `left center`, `top 10px right 20px`), so that branch
    // looks for the word anywhere in the value, not right after the colon.
    // `(?<![\w-])` keeps the bare-property branch from being fooled by a
    // hyphen (it would otherwise re-match inside "border-left:", which the
    // first branch already covers on its own). `direction: ltr`, `[dir="ltr"]`
    // and `inset: 0` are all legitimate and contain neither "left" nor
    // "right" as a word, so none of the branches touch them.
    const styleLineRanges = [];
    {
      let openAt = null;
      h.split('\n').forEach((line, i) => {
        const n = i + 1;
        if (openAt === null && /<style[^>]*>/.test(line)) openAt = n;
        if (openAt !== null && /<\/style>/.test(line)) { styleLineRanges.push([openAt, n]); openAt = null; }
      });
    }
    const inStyle = n => styleLineRanges.some(([s, e]) => n >= s && n <= e);

    const propertyForm = /\b(?:margin|padding|border)-(?:left|right)\b|\btext-align\s*:\s*(?:left|right)\b/;
    const positioningForm = /(?<![\w-])(?:left|right)\s*:|\bfloat\s*:\s*(?:left|right)\b|\bbackground-position\s*:[^;{}]*\b(?:left|right)\b/;

    const bad = h.split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line, n }) => !line.includes('rtl-ok') && (propertyForm.test(line) || (inStyle(n) && positioningForm.test(line))))
      .map(({ n }) => n);
    if (bad.length) fail(`${page}: physical left/right on line(s) ${bad.join(', ')} — use the -inline- form or mark the line /* rtl-ok */`);
    else pass(`${page}: no physical left/right`);
  }

  console.log('The home page and its film:');
  const home = readFileSync(join(ROOT, 'home.html'), 'utf8');
  const homeNeed = (re, why) => re.test(home) ? pass(why) : fail(why);

  // Presence is not enough. The failure that matters is the two <source>
  // elements swapping media conditions: both files are still named, both
  // filename checks still pass, and every phone downloads the wide cut and
  // sees a fifth of the picture — with 52 hand-chosen crop windows silently
  // thrown away. So check which source carries the condition, and that the
  // conditional one comes first, because the browser takes the first match.
  const phoneSrc = home.match(/<source[^>]*film-phone\.mp4[^>]*>/);
  const deskSrc  = home.match(/<source[^>]*film-desktop\.mp4[^>]*>/);

  if (!phoneSrc) fail('no <source> for the phone cut');
  else if (!/media\s*=\s*["'][^"']*max-width:\s*720px/.test(phoneSrc[0]))
    fail('the phone cut carries no max-width: 720px condition — every desktop would download the vertical re-edit, or no phone would get it');
  else pass('the phone cut is behind a max-width: 720px condition');

  if (!deskSrc) fail('no <source> for the desktop cut');
  else if (/media\s*=/.test(deskSrc[0]))
    fail('the desktop cut carries a media condition — if the two were swapped, phones get the wide cut and nothing says so');
  else pass('the desktop cut is the unconditional fallback');

  if (phoneSrc && deskSrc && home.indexOf(phoneSrc[0]) > home.indexOf(deskSrc[0]))
    fail('the desktop <source> comes first, so it matches before the phone one is considered');
  else pass('the conditional source comes first, as <source> order requires');

  homeNeed(/poster\s*=\s*["']\.\/media\/film-poster\.jpg["']/, 'a real poster file, not an empty poster attribute');
  homeNeed(/film-poster-phone\.jpg/,   'phones get the phone-shaped poster — under reduced motion or a refused autoplay, the poster IS the page');
  homeNeed(/\bmuted\b/,                'muted, or no browser will autoplay it');
  homeNeed(/\bplaysinline\b/,          'plays inline, or iOS takes it fullscreen on its own');
  homeNeed(/visibilitychange/,         'pauses when the tab is not being looked at, rather than burning a stranger\'s data in the background');
  homeNeed(/saveData/,                 'honours Save-Data');
  homeNeed(/prefers-reduced-motion/,   'honours reduced motion');

  // Counts, not just "does one exist": two play() calls exist (the initial
  // autoplay attempt and the resume-on-visible branch), and a bare existence
  // test is satisfied by either one alone, leaving the other free to throw on
  // a refused autoplay and take the rest of the script with it.
  const plays = (home.match(/\.play\(\)/g) || []).length;
  const guarded = (home.match(/\.play\(\)[\s\S]{0,140}?catch/g) || []).length;
  if (plays > 0 && plays === guarded) pass(`all ${plays} play() calls are guarded — iOS low power mode refuses autoplay outright`);
  else fail(`${plays - guarded} of ${plays} play() calls are unguarded — a refused autoplay throws and takes the rest of the script with it`);

  // sw.js precaches everything in ASSETS. The film is 24MB across two files;
  // precaching it fills a phone's storage quota and gets the whole cache
  // evicted — the shop with it. This check is about that list specifically.
  //
  // The separate question of the runtime cache-first branch storing the film
  // as it streams is a Plan 5 item, recorded in the spec. It is not this
  // check's job and this check does not claim to cover it.
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const assets = sw.match(/const ASSETS = \[([\s\S]*?)\]/);
  if (assets && /\.(?:mp4|webm|mov)\b/.test(assets[1]))
    fail('sw.js precaches a video — 24MB on every visitor\'s device, and the shop evicted from the cache when the quota runs out');
  else pass('sw.js precaches no video');

  console.log('The home page\'s words:');
  // Noy's own sentence, chosen in the design review. Not a placeholder.
  homeNeed(/אופה מה שאני הכי רוצה לאכול/, 'carries the line the design settled on');
  homeNeed(/I bake what I most want to eat/, 'and its English');
  homeNeed(/למאפייה של NUIKA/, 'the way into the shop');
  homeNeed(/btn--on-film/, 'the primary button is the cream one — terracotta is unreadable over a moving picture');
  homeNeed(/shop\.html/, 'the shop button points at shop.html, the name it takes in Plan 5');

  // The Instagram and WhatsApp links are NOT in home.html's own markup — they
  // are built once by nuikaFooter() in site.js and mounted into the
  // data-nuika-footer element at runtime. Writing them into home.html too
  // would give two copies that can drift apart, which is exactly what the
  // task brief warns against. So these two check the page's real delivered
  // content — home.html or the shared script it loads — rather than
  // home.html alone. (Checked this catches a real regression: temporarily
  // corrupting the number in site.js turned this FAIL while every other
  // check on this list still, correctly, stayed green.)
  const inEither = (re, why) => (re.test(home) || re.test(readFileSync(join(ROOT, 'site.js'), 'utf8')))
    ? pass(why) : fail(`${why} — looked in home.html and site.js`);
  inEither(/instagram\.com\/nuika_bread/, 'the real Instagram handle');
  inEither(/wa\.me\/972547382282/, 'the real WhatsApp number, not a placeholder');

  // The home page is the one screen with no scroll. A stray scroll container
  // turns it into a page that almost scrolls, which reads as broken.
  if (/overflow\s*:\s*auto|overflow\s*:\s*scroll/.test(home))
    fail('home.html declares a scrolling overflow — the home page is one screen');
  else pass('nothing on the home page scrolls');

  // Until Plan 5 renames things, nothing may link the new pages from the shop.
  // A customer who finds a half-built page has found a bug, not a preview.
  const shop = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const leaked = PAGES.filter(p => shop.includes(p));
  if (leaked.length) fail(`index.html links to ${leaked.join(', ')} — the new pages are not public yet`);
  else pass('the shop links to none of the new pages');
}

if (failed) {
  console.error('\nValidation failed. Do not deploy this commit.');
  process.exit(1);
}
console.log('\nAll checks passed.');
