// Builds _site/ — the only thing GitHub Pages publishes.
//
// Until now the deploy uploaded the whole repository, so nuika.co.il/CLAUDE.md,
// /SECURITY.md, /firebase-rules.json, /scripts/*.mjs and the rest of the
// working files were readable by anyone. This copies an explicit allowlist
// instead. A file that is not named here is simply not on the site.
//
// Adding a new page or asset type? Pages (*.html) and the folders images/ and
// media/ are picked up automatically. A new top-level file needs a line in
// ROOT_FILES below — and the check at the end fails the deploy if something
// the site points at did not make it in, so a forgotten line is caught before
// customers see a broken page.
//
//   node scripts/build-site.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');

// Top-level files that are part of the site. (*.html is added automatically.)
const ROOT_FILES = [
  'CNAME',            // never drop this: it is what keeps nuika.co.il attached
  '.nojekyll',
  'site.css', 'site.js', 'sw.js', 'manifest.json',
  'robots.txt', 'sitemap.xml',
  'favicon.ico', 'apple-touch-icon.png', 'og-image.png',
  'icon-192.png', 'icon-512.png', 'icon-manage-192.png',
];
// Whole folders that are part of the site.
const DIRS = ['images', 'media'];

const problems = [];
const fail = m => problems.push(m);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const copy = rel => {
  const from = path.join(ROOT, rel);
  if (!fs.existsSync(from)) { fail('missing from the repo: ' + rel); return; }
  fs.cpSync(from, path.join(OUT, rel), { recursive: true });
};

for (const f of fs.readdirSync(ROOT)) if (f.endsWith('.html')) copy(f);
ROOT_FILES.forEach(copy);
DIRS.forEach(copy);

// ── Check 1: nothing that should stay private made it in ────────────────────
const walk = d => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const built = walk(OUT).map(f => path.relative(OUT, f).split(path.sep).join('/'));
const forbidden = /(^|\/)(\.git|\.claude|\.agents|\.github|\.githooks|scripts|docs|marketing|node_modules)(\/|$)|\.md$|^firebase-rules|^skills-lock|^package\.json$|^\.env/i;
for (const f of built) if (forbidden.test(f)) fail('private file in the build: ' + f);

// ── Check 2: everything the site points at is in the build ──────────────────
// The old deploy served everything, so a reference to a file that is not on
// the allowlist would have worked by accident. Prove each one resolves.
// url("...") / url('...') / url(bare). A quoted value may hold the other kind of
// quote (an inline SVG does), so each form is matched on its own.
const URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^"')\s]+))\s*\)/g;
const SKIP =/^(https?:|\/\/|mailto:|tel:|sms:|data:|javascript:|#|blob:|whatsapp:)/i;
const checkRef = (from, ref) => {
  ref = ref.trim();
  if (!ref || SKIP.test(ref) || ref.includes('${') || ref.includes('\'+') || ref.includes('"+')) return;
  ref = ref.split('#')[0].split('?')[0];
  if (!ref) return;
  const base = ref.startsWith('/') ? OUT : path.dirname(path.join(OUT, from));
  const target = path.normalize(path.join(base, ref));
  if (!target.startsWith(OUT)) return;
  let ok = fs.existsSync(target);
  // a link to a folder or to "/" resolves to its index.html
  if (!ok && fs.existsSync(target) === false && fs.existsSync(path.join(target, 'index.html'))) ok = true;
  if (!ok) fail(`${from} points at ${ref}, which is not in the build`);
};
for (const f of built) {
  const full = path.join(OUT, f);
  if (/\.(html)$/.test(f)) {
    const s = fs.readFileSync(full, 'utf8');
    for (const m of s.matchAll(/\b(?:src|poster)=["']([^"']+)["']/g)) checkRef(f, m[1]);
    for (const m of s.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["']/g)) checkRef(f, m[1]);
    for (const m of s.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/g)) checkRef(f, m[1]);
    for (const m of s.matchAll(URL_RE)) checkRef(f, m[1] || m[2] || m[3]);
  } else if (f.endsWith('.css')) {
    const s = fs.readFileSync(full, 'utf8');
    for (const m of s.matchAll(URL_RE)) checkRef(f, m[1] || m[2] || m[3]);
  } else if (f === 'sw.js') {
    const s = fs.readFileSync(full, 'utf8');
    for (const m of s.matchAll(/['"](\.\/[^'"]*)['"]/g)) checkRef(f, m[1]);
  } else if (f === 'manifest.json') {
    const j = JSON.parse(fs.readFileSync(full, 'utf8'));
    for (const i of j.icons || []) checkRef(f, i.src);
    if (j.start_url) checkRef(f, j.start_url);
  } else if (f === 'images/gallery/gallery.json') {
    const j = JSON.parse(fs.readFileSync(full, 'utf8'));
    const list = Array.isArray(j) ? j : (j.photos || j.items || []);
    for (const p of list) for (const k of ['file', 'thumb', 'view']) {
      if (typeof p[k] === 'string') checkRef(f, p[k].startsWith('images/') ? '/' + p[k] : '/images/gallery/' + p[k]);
    }
  }
}

// ── Check 3: the domain file survived ───────────────────────────────────────
if (!built.includes('CNAME') || fs.readFileSync(path.join(OUT, 'CNAME'), 'utf8').trim() !== 'nuika.co.il')
  fail('CNAME is missing or changed — publishing would unset the custom domain');
for (const must of ['index.html', 'shop.html', 'site.js', 'site.css', 'sw.js'])
  if (!built.includes(must)) fail('missing from the build: ' + must);

if (problems.length) {
  console.error('\nבניית האתר נכשלה:');
  for (const p of [...new Set(problems)]) console.error('  ✗ ' + p);
  process.exit(1);
}
console.log(`✓ _site נבנה: ${built.length} קבצים. אף קובץ פנימי לא נכנס, וכל מה שהאתר מפנה אליו קיים.`);
