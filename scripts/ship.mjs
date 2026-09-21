// End-of-session command: check, save and publish, in the safe order.
//
//   node scripts/ship.mjs "מה שינית"
//
// Pulls first when the other machine is ahead, so a push can never quietly
// replace the other person's work — the failure that already cost this
// project its entire data-sync layer once.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureHooks } from './ensure-hooks.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The shop is index.html until the cutover and shop.html after it. Resolve it
// rather than hardcoding, so every tool is correct on both sides of the rename.
//
// This file stamps the version into the shop on every publish. Hardcoded, it
// would go on stamping index.html after the cutover moved the shop out of it
// — stamping the film page — and status.mjs reads that one tag to compare the
// folder, GitHub and the live site. Every release after that would be
// invisible to the one tool whose job is to refuse to pretend all is well.
//
// Resolve by name, then confirm by content — the name alone cannot answer
// this. The cutover's FINISHED state is both files present: `git mv
// index.html shop.html` then `git mv home.html index.html`, after which
// shop.html is the shop and index.html is the home page serving the root.
// Throwing on "both exist" would have called the destination a fault, and
// this file is the one that pushes: it would have refused to publish the
// finished cutover and refused to publish the revert of it too.
//
// Copied from validate.mjs; status.mjs and enable-deploy-gate.mjs have the
// same copy. There is no shared module between these scripts and this is not
// the change that should invent one.
const SHOP_MARKERS = ['firebase.initializeApp', 'getCartTotal()'];

function shopFile(root) {
  const at = n => join(root, n);
  const hasShop = existsSync(at('shop.html'));

  if (!hasShop && !existsSync(at('index.html'))) {
    throw new Error('neither shop.html nor index.html exists — this is not the NUIKA checkout');
  }

  // The cutover is two renames. shop.html here while home.html is still here
  // means only the first one ran, and nothing has taken over the site root.
  if (hasShop && existsSync(at('home.html'))) {
    throw new Error('shop.html exists but home.html is still here — the cutover is half-applied: "git mv home.html index.html" never ran, so nothing serves the site root');
  }

  const name = hasShop ? 'shop.html' : 'index.html';
  const body = readFileSync(at(name), 'utf8');
  const missing = SHOP_MARKERS.filter(m => !body.includes(m));
  if (missing.length) {
    throw new Error(`${name} is the shop by name but not by content — missing ${missing.join(' and ')}. Either the rename put the wrong file at that name, or the shop itself is damaged.`);
  }
  return name;
}

// Install the safety hooks if this machine has never had them.
ensureHooks();
const git = (a, quiet) => execSync(`git ${a}`, { cwd: ROOT, encoding: 'utf8', stdio: quiet ? 'pipe' : undefined }).trim();
const run = a => execSync(a, { cwd: ROOT, stdio: 'inherit' });

const line = '─'.repeat(52);
const say  = m => console.log(m);

// Noy runs this one. Every other failure path here speaks Hebrew, says what
// to do and exits cleanly; a raw English Node stack would be the one place
// the tool stops talking to the person using it. The English detail stays on
// its own line for whoever fixes it. This sits before any git work, so an
// unresolvable shop stops the publish rather than stamping the wrong file.
let SHOP;
try {
  SHOP = shopFile(ROOT);
} catch (err) {
  say('\n' + line);
  say('  ❌ לא הצלחתי לזהות איזה קובץ הוא החנות — לא שלחתי כלום.');
  say('');
  say(`     ${err.message}`);
  say('');
  say('     תגידי לקלוד: "תסדר את קובץ החנות".');
  say(line);
  process.exit(1);
}

const message = process.argv.slice(2).join(' ').trim();

// Stamp the version AFTER the merge, never before it.
//
// Both machines write this same line, so stamping before the commit made the
// version tag a guaranteed conflict on every parallel session — the one line
// both sides always touch. Two conflicts in a row landed here and nowhere
// else. Stamped after the merge, the incoming stamp is simply replaced by the
// fresh one and there is nothing left to collide over.
//
// The timestamp orders the versions; the hash identifies the commit it was
// built on. Read it back with `node scripts/status.mjs`, in the admin panel
// header, or as NUIKA_VERSION in the browser console.
//
// This has to run on EVERY path that pushes. It used to live inline in the
// path that commits your own edits, so a publish from a clean tree — a merged
// branch, or a conflict you already resolved — went out unstamped. status.mjs
// reads this tag to compare the folder, GitHub and the live site, so an
// unstamped publish left all three reporting the same old version while the
// live site had in fact changed. The one tool whose job is to refuse to
// pretend everything is fine could not see the change at all.
function stampVersion() {
  try {
    const shopPath = join(ROOT, SHOP);
    const before  = readFileSync(shopPath, 'utf8');
    const stamp   = new Date().toISOString();
    const parent  = git('rev-parse --short HEAD', true);
    const after   = before.replace(
      /(<meta name="nuika-version" content=")[^"]*("\s*\/?>)/,
      `$1${stamp}|${parent}$2`
    );
    if (after === before) {
      say(`     ⚠  לא מצאתי את תג הגרסה ב-${SHOP} — ממשיך בלי לחתום.`);
    } else {
      writeFileSync(shopPath, after);
      execSync(`git add ${SHOP}`, { cwd: ROOT });
      execSync(`git commit -q -m "גרסה ${stamp.slice(0, 16).replace('T', ' ')}"`, { cwd: ROOT });
      say(`     גרסה: ${stamp.slice(0, 16).replace('T', ' ')}`);
    }
  } catch (e) {
    say('     ⚠  חתימת הגרסה נכשלה: ' + e.message + ' — ממשיך.');
  }
}

// Every publish goes through here, and it stamps before it pushes. Do not call
// `git push` anywhere else in this file: a second push site is exactly how the
// clean-tree path shipped unstamped for one release. `validate.mjs` enforces
// that this is the only one.
function publish(branch) {
  stampVersion();
  run(`git push origin ${branch}`);
}


try {
  const branch = git('rev-parse --abbrev-ref HEAD');

  // A clean tree does not mean there is nothing to send. After resolving a
  // conflict the merge is already committed, and this used to report "nothing
  // to send" and stop — leaving the merge sitting on one machine only, which is
  // the single worst moment for work to go missing.
  if (!git('status --porcelain')) {
    let ahead = '0';
    try { ahead = git(`rev-list --count origin/${branch}..HEAD`, true); } catch {}

    if (ahead === '0') {
      say('\n' + line);
      say('  אין שינויים לשלוח.');
      say(line);
      process.exit(0);
    }

    say(`\nיש ${ahead} שינויים ששמורים אבל לא נשלחו. שולחת אותם.\n`);
    try {
      run('node scripts/validate.mjs');
    } catch {
      say('\n' + line);
      say('  משהו בקוד שבור — לא שלחתי כלום.');
      say('  תגידי לקלוד: "תקן את מה שהבדיקה מצאה"');
      say(line);
      process.exit(1);
    }
    run(`git pull --rebase origin ${branch}`);
    publish(branch);
    say('\n' + line);
    say('  ✓ נשלח. תוך כדקה השינוי יהיה באתר.');
    say('     nuika.co.il');
    say(line);
    process.exit(0);
  }

  if (!message) {
    say('\n' + line);
    say('  צריך לכתוב מה שינית, למשל:');
    say('     node scripts/ship.mjs "הגדלתי את הכפתור בעגלה"');
    say(line);
    process.exit(1);
  }

  // 1. Does the site still work?
  say('\n1/4  בודק שהאתר תקין...\n');
  try {
    run('node scripts/validate.mjs');
  } catch {
    say('\n' + line);
    say('  משהו בקוד שבור — לא שלחתי כלום.');
    say('  תגידי לקלוד: "תקן את מה שהבדיקה מצאה"');
    say(line);
    process.exit(1);
  }

  // 2. Save locally.
  say('\n2/4  שומר את השינויים...');

  git('add -A', true);
  execSync(`git commit -q -m "${message.replace(/"/g, "'")}"`, { cwd: ROOT });

  // 3. Take the other machine's work first. Pushing while behind is exactly
  //    how one side's work gets replaced without warning.
  say('3/4  בודק אם יש עדכונים מהמחשב השני...');
  git(`fetch origin ${branch}`, true);
  if (+git(`rev-list --count HEAD..origin/${branch}`) > 0) {
    say('     יש. מוריד ומשלב...');
    try {
      execSync(`git pull origin ${branch}`, { cwd: ROOT, stdio: 'inherit' });
    } catch {
      say('\n' + line);
      say('  שני הצדדים שינו את אותו מקום בקוד.');
      say('  תגידי לקלוד: "יש התנגשות בגיט, תפתרי אותה"');
      say('  השינויים שלך שמורים — שום דבר לא אבד.');
      say(line);
      process.exit(1);
    }
    // The merge could have brought in something broken.
    try {
      run('node scripts/validate.mjs');
    } catch {
      say('\n' + line);
      say('  אחרי השילוב משהו נשבר.');
      say('  תגידי לקלוד: "תקן את מה שהבדיקה מצאה"');
      say(line);
      process.exit(1);
    }
  }

  // 4. Publish.
  say('4/4  שולח לאתר...\n');
  publish(branch);

  say('\n' + line);
  say('  ✓ נשלח. תוך כדקה השינוי יהיה באתר.');
  say('     nuika.co.il');
  say(line);
} catch (err) {
  console.error('\n' + line);
  console.error('  משהו השתבש: ' + String(err.message).split('\n')[0]);
  console.error('  תגידי לקלוד מה כתוב כאן.');
  console.error(line);
  process.exit(1);
}
