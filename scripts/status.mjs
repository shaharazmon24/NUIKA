// Where is everyone? One command that answers "are we looking at the same
// version?" without anyone needing to understand git.
//
//   node scripts/status.mjs
//
// It compares four things:
//   1. this folder            — what you are editing right now
//   2. GitHub (origin/main)   — the shared truth
//   3. the live site          — what customers actually see
//   4. this folder's identity — is it even connected to the right project?
//
// Check 4 exists because a fresh folder that was never connected to GitHub
// looks completely normal from the inside. Work done in one is invisible to
// the other person and never reaches the shop — which has already happened.

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://nuika.co.il';
const EXPECTED_REMOTE = 'shaharazmon24/NUIKA';

// The shop is index.html until the cutover and shop.html after it. Resolve it
// rather than hardcoding, so every tool is correct on both sides of the rename.
//
// This tool is the reason the resolver exists at all. Hardcoded, it would
// have gone on comparing index.html after the cutover moved the shop out of
// it — comparing the film page, which barely changes, finding it identical in
// all three places, and reporting "everything is in sync" while the shop
// diverged between Noy's phone and Shahar's laptop. That is the exact failure
// this file was written to prevent.
//
// Both present means the cutover is half-applied — a state in which every
// later answer would be a guess. Neither present means the checkout is not
// this project. Both throw rather than pick.
//
// Copied verbatim from validate.mjs; ship.mjs has the same copy. There is no
// shared module between the three scripts and this is not the change that
// should invent one.
function shopFile(root) {
  const a = existsSync(join(root, 'shop.html'));
  const b = existsSync(join(root, 'index.html'));
  if (a && b) throw new Error('both shop.html and index.html exist — the cutover is half-applied; finish it or revert it before running this');
  if (a) return 'shop.html';
  if (b) return 'index.html';
  throw new Error('neither shop.html nor index.html exists — this is not the NUIKA checkout');
}
const SHOP = shopFile(ROOT);

const say  = m => console.log(m);
const line = () => say('─'.repeat(58));

function trySh(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch { return null; }
}

// Pull the stamp out of a page's HTML. Returns a comparable, printable shape.
function versionOf(html) {
  if (!html) return { ok: false, text: 'לא זמין' };
  const m = html.match(/<meta name="nuika-version" content="([^"]*)"/);
  if (!m) return { ok: false, text: 'אין תג גרסה (גרסה ישנה מלפני המעקב)' };
  const [stamp, commit] = m[1].split('|');
  if (stamp === 'dev') return { ok: true, key: 'dev', text: 'מקומית, טרם פורסמה' };
  const d = new Date(stamp);
  const when = isNaN(d) ? stamp
    : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ` +
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { ok: true, key: m[1], text: `${when}  ·  ${commit}`, stamp };
}

say('');
line();
say('  איפה כולם — נואיקה');
line();
say('');

// ── 0. Is this folder actually the project? ─────────────────
const inRepo = trySh('git rev-parse --is-inside-work-tree') === 'true';
if (!inRepo) {
  say('  ❌ התיקייה הזאת אינה מחוברת לגיט.');
  say('');
  say('     כל עבודה כאן לא מגיעה לאף אחד ולא מגיעה לאתר.');
  say('     זו בדיוק התקלה שגורמת ל"עשיתי את זה והוא לא רואה".');
  say('');
  say('     הפתרון: לעבוד בתיקייה המחוברת, או לשכפל אותה מחדש:');
  say(`     git clone https://github.com/${EXPECTED_REMOTE}.git`);
  line();
  process.exit(1);
}

const remote = trySh('git remote get-url origin') || '';
if (!remote.includes(EXPECTED_REMOTE)) {
  say('  ❌ התיקייה מחוברת למאגר אחר (או לשום מאגר):');
  say(`     ${remote || '— אין origin —'}`);
  say(`     היה אמור להיות: https://github.com/${EXPECTED_REMOTE}.git`);
  say('');
  say('     עבודה כאן לא תגיע לנואיקה.');
  line();
  process.exit(1);
}
say(`  ✓  התיקייה מחוברת ל-${EXPECTED_REMOTE}`);

// ── 1. Refresh our knowledge of the remote ──────────────────
if (trySh('git fetch origin --prune') === null) {
  say('  ⚠  לא הצלחתי לפנות לגיטהאב — אולי אין אינטרנט. ממשיך עם מידע ישן.');
}

const head    = trySh('git rev-parse --short HEAD')        || '?';
const originC = trySh('git rev-parse --short origin/main') || '?';
const dirty   = trySh('git status --porcelain')            || '';
const ahead   = trySh('git rev-list --count origin/main..HEAD') || '0';
const behind  = trySh('git rev-list --count HEAD..origin/main') || '0';

// ── 2. The three versions ───────────────────────────────────
// shopFile() has already proved SHOP exists, so this read cannot ENOENT.
const localV  = versionOf(readFileSync(join(ROOT, SHOP), 'utf8'));

// Deliberately the folder's name, not a second resolution against origin. If
// the two disagree this returns nothing and the version reads "לא זמין" —
// which is honest: one side has the cutover and the other does not, and the
// ahead/behind counts below already say so in words Noy can act on.
const originV = versionOf(trySh(`git show origin/main:${SHOP}`));

// A cutover is two files changing name at once. Until the deploy lands, the
// folder and the live site can disagree about which file IS the shop — and
// comparing the folder's shop against the live film page produces a version
// mismatch that looks like drift and is not. Say which it is.
//
// Only the real shop carries a version tag, and that is the whole test. A
// test on "the response was not empty" would have been wrong: GitHub Pages
// answers a missing path with a styled 404 page that is valid HTML —
// measured at 9,379 bytes for /shop.html against the live site today — so an
// emptiness check reads that 404 as proof the file exists. Resolving the live
// shop is the same job shopFile() does for the folder, so it is written the
// same way, as a named resolver rather than a bare ternary.
function liveShopFile(html) {
  return versionOf(html).ok ? 'shop.html' : 'index.html';
}
const liveShopHtml = trySh(`curl -s --max-time 25 "${SITE}/shop.html?cb=${Date.now()}"`);
const liveShop     = liveShopFile(liveShopHtml);

// Read the live version out of whichever file is the shop UP THERE, not
// whichever one is the shop down here. Asking for the folder's name during a
// half-landed deploy fetches a 404, reports "לא זמין", and hides the version
// the site is in fact still serving. When the live shop is shop.html its body
// is already in hand — no second request.
const liveV = liveShop === 'shop.html'
  ? versionOf(liveShopHtml)
  : versionOf(trySh(`curl -s --max-time 25 "${SITE}/index.html?cb=${Date.now()}"`));

say('');
say('  ┌─ התיקייה שלך');
say(`  │    גרסה:  ${localV.text}`);
say(`  │    commit: ${head}${dirty ? '   ⚠ יש שינויים שלא נשמרו' : ''}`);
say('  │');
say('  ├─ גיטהאב (מה שמשותף לשניכם)');
say(`  │    גרסה:  ${originV.text}`);
say(`  │    commit: ${originC}`);
say('  │');
say('  └─ האתר החי (מה שהלקוחות רואים)');
say(`       גרסה:  ${liveV.text}`);
say('');

// Only worth saying when the live site actually answered. With no internet
// the probe comes back empty, liveShopFile() falls to the pre-cutover name,
// and announcing a half-applied cutover on that silence would be inventing a
// diagnosis out of a failed request.
if (liveShop !== SHOP && liveV.ok) {
  say(`  ⚠  בתיקייה החנות נקראת ${SHOP} ובאתר החי ${liveShop} — ההחלפה באמצע.`);
  say('     זה תקין בדקה שאחרי פרסום. אם זה נמשך — תגידי לקלוד.');
  say('');
}

// ── 3. Verdict ──────────────────────────────────────────────
line();
const problems = [];

if (behind !== '0' && ahead !== '0') {
  problems.push(`הענפים התפצלו — יש לך ${ahead} שינויים שלא נשלחו, ובגיטהאב ${behind} שלא קלטת.\n     תריץ:  node scripts/sync.mjs`);
} else if (behind !== '0') {
  problems.push(`אתה מאחור ב-${behind} שינויים. מישהו עדכן ואתה עוד לא קלטת.\n     תריץ:  node scripts/sync.mjs`);
} else if (ahead !== '0') {
  problems.push(`יש לך ${ahead} שינויים שנשמרו אבל לא נשלחו.\n     תריץ:  node scripts/ship.mjs "מה שינית"`);
}

if (dirty) {
  problems.push(`יש קבצים ששונו ולא נשמרו כלל.\n     תריץ:  node scripts/ship.mjs "מה שינית"`);
}

if (originV.ok && liveV.ok && originV.key !== liveV.key) {
  problems.push('האתר החי אינו הגרסה שבגיטהאב.\n     או שהפרסום עוד רץ (בדוק שוב בעוד דקה), או שהוא נחסם בשער כי הבדיקה נכשלה.');
}

if (!problems.length) {
  say('  ✓  הכל מסונכרן. שניכם והאתר על אותה גרסה.');
} else {
  say('  צריך טיפול:');
  problems.forEach((p, i) => say(`\n  ${i + 1}. ${p}`));
}
line();
say('');
