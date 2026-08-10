// End-of-session command: check, save and publish, in the safe order.
//
//   node scripts/ship.mjs "מה שינית"
//
// Pulls first when the other machine is ahead, so a push can never quietly
// replace the other person's work — the failure that already cost this
// project its entire data-sync layer once.

import { execSync } from 'node:child_process';
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
