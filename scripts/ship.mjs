// End-of-session command: check, save and publish, in the safe order.
//
//   node scripts/ship.mjs "מה שינית"
//
// Pulls first when the other machine is ahead, so a push can never quietly
// replace the other person's work — the failure that already cost this
// project its entire data-sync layer once.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureHooks } from './ensure-hooks.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Install the safety hooks if this machine has never had them.
ensureHooks();
const git = (a, quiet) => execSync(`git ${a}`, { cwd: ROOT, encoding: 'utf8', stdio: quiet ? 'pipe' : undefined }).trim();
const run = a => execSync(a, { cwd: ROOT, stdio: 'inherit' });

const line = '─'.repeat(52);
const say  = m => console.log(m);
const message = process.argv.slice(2).join(' ').trim();

try {
  const branch = git('rev-parse --abbrev-ref HEAD');

  if (!git('status --porcelain')) {
    say('\n' + line);
    say('  אין שינויים לשלוח.');
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

  // Stamp the version into the page itself, before the commit, so the stamp is
  // part of what ships. Without it "which version are you looking at?" has no
  // answer that does not require git — and one of the two people here does not
  // use git. The timestamp orders the versions; the hash identifies the commit
  // it was built on. Read it back with `node scripts/status.mjs`, or in the
  // admin panel header, or as NUIKA_VERSION in the browser console.
  try {
    const idxPath = join(ROOT, 'index.html');
    const before  = readFileSync(idxPath, 'utf8');
    const stamp   = new Date().toISOString();
    const parent  = git('rev-parse --short HEAD', true);
    const after    = before.replace(
      /(<meta name="nuika-version" content=")[^"]*("\s*\/?>)/,
      `$1${stamp}|${parent}$2`
    );
    if (after === before) {
      say('     ⚠  לא מצאתי את תג הגרסה ב-index.html — ממשיך בלי לחתום.');
    } else {
      writeFileSync(idxPath, after);
      say(`     גרסה: ${stamp.slice(0, 16).replace('T', ' ')}`);
    }
  } catch (e) {
    say('     ⚠  חתימת הגרסה נכשלה: ' + e.message + ' — ממשיך.');
  }

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
  run(`git push origin ${branch}`);

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
