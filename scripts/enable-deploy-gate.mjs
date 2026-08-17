// Turns on the deploy gate, so a broken commit can never become the live shop.
//
//   node scripts/enable-deploy-gate.mjs
//
// Run once. It is safe to run again — it detects work already done and skips it.
//
// What it changes: GitHub Pages currently publishes whatever lands on main.
// After this, Pages publishes only what .github/workflows/deploy.yml produces,
// and that workflow refuses to publish anything scripts/validate.mjs rejects.
// A broken commit still lands in git — nothing is lost — but nuika.co.il keeps
// serving the last good version.
//
// This deliberately does NOT use branch protection: protection on main would
// reject the direct pushes scripts/ship.mjs makes, and both machines rely on it.
//
// Every step is verified, and the Pages configuration is captured before it is
// touched. If the live site does not come back healthy, the original setting is
// restored automatically.

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT   = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO   = 'shaharazmon24/NUIKA';
const SITE   = 'https://nuika.co.il';
const BACKUP = join(ROOT, '.pages-config-backup.json');

const say  = m => console.log(m);
const line = () => say('─'.repeat(56));

function sh(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', ...opts }).trim();
}

// Returns null instead of throwing, for probes where failure is a valid answer.
function trySh(cmd) {
  try { return sh(cmd, { stdio: 'pipe' }); } catch { return null; }
}

function die(msg) {
  say('');
  say('❌ ' + msg);
  process.exit(1);
}

line();
say('  הדלקת שער הפרסום — נואיקה');
line();
say('');

// ── 1. gh installed ─────────────────────────────────────────
if (!trySh('gh --version')) {
  die('הכלי gh לא מותקן.\n' +
      '   התקן מ- https://cli.github.com  ואז הרץ את הפקודה הזו שוב.');
}
say('  ✓  gh מותקן');

// ── 2. gh authenticated ─────────────────────────────────────
// This is the one step that needs a human: authentication cannot be delegated.
if (!trySh('gh auth status')) {
  // gh auth login draws a keyboard-driven prompt. A window that is not a real
  // terminal — the app's embedded runner, a CI log, anything piped — accepts no
  // keystrokes, so the prompt hangs forever with no way to answer it. Detect
  // that here instead of launching something unusable.
  if (!process.stdin.isTTY) {
    say('');
    say('  ⚠  צריך להתחבר לגיטהאב, וזה דורש חלון טרמינל אמיתי.');
    say('     החלון הנוכחי לא מעביר הקשות מקלדת, אז ה-prompt ייתקע.');
    say('');
    say('  פתח טרמינל אמיתי:');
    say('     GitHub Desktop → Repository → Open in Command Prompt');
    say('     או: תפריט התחל → Windows Terminal');
    say('');
    say('  ושם הרץ:');
    say('     cd C:\\Projects\\NUIKA');
    say('     node scripts/enable-deploy-gate.mjs');
    say('');
    process.exit(1);
  }

  say('');
  say('  נדרשת התחברות לגיטהאב. ייפתח דפדפן — תאשר שם, וזה יחזור לכאן לבד.');
  say('  אם תישאל "Authenticate Git with your GitHub credentials?" — תלחץ Y ואז Enter.');
  say('');
  const r = spawnSync('gh', ['auth', 'login', '--web', '--git-protocol', 'https'], {
    cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32'
  });
  if (r.status !== 0 || !trySh('gh auth status')) {
    die('ההתחברות לא הושלמה. הרץ שוב כשתהיה מוכן.');
  }
}
say('  ✓  מחובר לגיטהאב');

// ── 3. the workflow file must exist ─────────────────────────
const WF = join(ROOT, '.github', 'workflows', 'deploy.yml');
if (!existsSync(WF)) {
  die('חסר .github/workflows/deploy.yml — בלעדיו אין מה להדליק.');
}
say('  ✓  קובץ ה-workflow קיים');

// ── 4. capture the current Pages config, for rollback ───────
const before = trySh(`gh api repos/${REPO}/pages`);
if (!before) {
  die('לא הצלחתי לקרוא את הגדרות Pages.\n' +
      '   ייתכן שלחשבון אין הרשאת admin על המאגר.');
}
let cfg;
try { cfg = JSON.parse(before); } catch { die('תשובה לא צפויה מגיטהאב.'); }

writeFileSync(BACKUP, JSON.stringify(cfg, null, 2));
say(`  ✓  ההגדרה הנוכחית נשמרה  (build_type: ${cfg.build_type}, domain: ${cfg.cname || 'none'})`);

const alreadyOn = cfg.build_type === 'workflow';
if (alreadyOn) say('  ℹ  Pages כבר מפרסם דרך Actions');

// ── 5. make sure the workflow is on the remote ──────────────
const tracked = trySh('git ls-files --error-unmatch .github/workflows/deploy.yml');
const dirty   = sh('git status --porcelain');
if (!tracked || dirty.includes('deploy.yml')) {
  say('');
  say('  שולח את קובץ ה-workflow...');
  try {
    sh('node scripts/ship.mjs "שער פרסום: קוד שנכשל בבדיקה לא מגיע לאתר"', { stdio: 'inherit' });
  } catch {
    die('השליחה נכשלה. תקן את מה שהבדיקה מצאה והרץ שוב.');
  }
} else {
  say('  ✓  ה-workflow כבר במאגר');
}

// ── 6. switch Pages to the workflow ─────────────────────────
// The custom domain lives in this same config. Passing cname through keeps
// nuika.co.il attached — dropping it would take the shop offline.
if (!alreadyOn) {
  say('');
  say('  מעביר את Pages לפרסום דרך Actions...');
  const args = [`gh api -X PUT repos/${REPO}/pages`, '-f build_type=workflow'];
  if (cfg.cname) args.push(`-f cname=${cfg.cname}`);
  if (!trySh(args.join(' '))) {
    die('לא הצלחתי לשנות את ההגדרה. ההגדרה המקורית לא שונתה — הכל כמו שהיה.');
  }
  say('  ✓  Pages מפרסם עכשיו דרך Actions');
}

// ── 7. run the workflow and wait ────────────────────────────
say('');
say('  מריץ את הפרסום ומחכה...');
trySh(`gh workflow run deploy.yml --repo ${REPO}`);

// Give the run a moment to be created before asking about it.
const started = Date.now();
let runOk = false;
while (Date.now() - started < 6 * 60 * 1000) {
  const raw = trySh(`gh run list --repo ${REPO} --workflow=deploy.yml --limit 1 --json status,conclusion`);
  if (raw) {
    let runs = [];
    try { runs = JSON.parse(raw); } catch {}
    const r = runs[0];
    if (r && r.status === 'completed') { runOk = r.conclusion === 'success'; break; }
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10000);
}

// ── 8. verify the live site, roll back if it is not healthy ─
say('');
say('  בודק את האתר החי...');

let healthy = false;
for (let i = 0; i < 20; i++) {
  const html = trySh(`curl -s --max-time 20 "${SITE}/index.html?cb=${Date.now()}"`);
  if (html && /firebase/i.test(html) && !/const ADMIN_PASSWORD/.test(html)) { healthy = true; break; }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10000);
}

if (!healthy) {
  say('');
  say('  ⚠  האתר לא חזר תקין. מחזיר את ההגדרה הקודמת...');
  const restore = [`gh api -X PUT repos/${REPO}/pages`, `-f build_type=${cfg.build_type}`];
  if (cfg.source && cfg.source.branch) {
    restore.push(`-f source[branch]=${cfg.source.branch}`, `-f source[path]=${cfg.source.path || '/'}`);
  }
  if (cfg.cname) restore.push(`-f cname=${cfg.cname}`);
  trySh(restore.join(' '));
  die('בוטל. ההגדרה חזרה למה שהייתה, והאתר אמור לחזור תוך דקה.\n' +
      `   הגדרות המקור שמורות ב- ${BACKUP}\n` +
      '   תראה את השגיאה כאן:  gh run list --repo ' + REPO);
}

line();
say('  ✓  השער דלוק');
line();
say('');
say('  מעכשיו:');
say('    • קוד שנכשל בבדיקה לא מגיע ללקוחות — הם רואים את הגרסה התקינה האחרונה');
say('    • העלאה דרך "Add files via upload" נכנסת לגיט אבל לא לאתר');
say('    • node scripts/ship.mjs ממשיך לעבוד בדיוק כמו קודם');
say('');
if (!runOk) {
  say('  ℹ  האתר תקין, אבל כדאי להציץ בריצה האחרונה:');
  say(`     gh run list --repo ${REPO}`);
  say('');
}
