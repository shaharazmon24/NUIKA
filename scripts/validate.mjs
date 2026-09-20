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
    if (/color\s*:\s*var\(\s*--crust\s*\)/.test(css))
      fail('--crust is used as a text colour; it measures 2.30 on --wheat and vanishes');
    else pass('--crust is never used as a text colour');
  }
}

if (failed) {
  console.error('\nValidation failed. Do not deploy this commit.');
  process.exit(1);
}
console.log('\nAll checks passed.');
