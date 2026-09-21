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
// Both present means the cutover is half-applied — a state in which every
// later answer would be a guess. Neither present means the checkout is not
// this project. Both throw rather than pick, and throwing here stops the
// publish before ensureHooks() and before anything is pushed.
//
// Copied verbatim from validate.mjs; status.mjs has the same copy. There is
// no shared module between the three scripts and this is not the change that
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

// Install the safety hooks if this machine has never had them.
ensureHooks();
const git = (a, quiet) => execSync(`git ${a}`, { cwd: ROOT, encoding: 'utf8', stdio: quiet ? 'pipe' : undefined }).trim();
const run = a => execSync(a, { cwd: ROOT, stdio: 'inherit' });

const line = '─'.repeat(52);
const say  = m => console.log(m);
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
