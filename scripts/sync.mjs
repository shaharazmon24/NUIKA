// Start-of-session command: take everyone else's work before touching anything.
//
//   node scripts/sync.mjs
//
// Written for two non-technical people sharing one big file. It reports in
// Hebrew, refuses to guess, and never discards local work.

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (a, quiet) => execSync(`git ${a}`, {
  cwd: ROOT, encoding: 'utf8', stdio: quiet ? 'pipe' : ['pipe', 'pipe', 'pipe']
}).trim();

const line = '─'.repeat(52);
const say = m => console.log(m);

try {
  const branch = git('rev-parse --abbrev-ref HEAD');
  git('fetch origin ' + branch, true);

  const behind = +git(`rev-list --count HEAD..origin/${branch}`);
  const ahead  = +git(`rev-list --count origin/${branch}..HEAD`);
  const dirty  = git('status --porcelain');

  say('');
  say(line);

  if (behind === 0 && ahead === 0 && !dirty) {
    say('  הכל מסונכרן. אפשר להתחיל לעבוד.');
    say(line);
    process.exit(0);
  }

  if (behind > 0) {
    say(`  יש ${behind} עדכונים חדשים מהמחשב השני. מוריד אותם...`);
    say('');
    // Show what is arriving, so a surprise change is visible rather than silent
    const log = git(`log --oneline HEAD..origin/${branch}`);
    log.split('\n').forEach(l => say('    · ' + l.replace(/^\w+ /, '')));
    say('');

    if (dirty) {
      say('  אבל יש לך שינויים שעוד לא נשמרו.');
      say('');
      say('  קודם תשמרי אותם:');
      say('     node scripts/ship.mjs "מה שינית"');
      say('');
      say('  ואז תריצי שוב את הפקודה הזו.');
      say(line);
      process.exit(1);
    }

    try {
      execSync(`git pull origin ${branch}`, { cwd: ROOT, stdio: 'inherit' });
    } catch {
      say('');
      say('  שני הצדדים שינו את אותו מקום בקוד.');
      say('  תגידי לקלוד: "יש התנגשות בגיט, תפתרי אותה"');
      say(line);
      process.exit(1);
    }
    say('');
    say('  ✓ עודכן.');
  }

  if (ahead > 0) {
    say(`  יש לך ${ahead} שינויים שעוד לא נשלחו לאתר.`);
    say('  כדי לשלוח:  node scripts/ship.mjs');
  }

  if (dirty && behind === 0) {
    say('  יש לך שינויים שעוד לא נשמרו.');
    say('  כדי לשלוח:  node scripts/ship.mjs "מה שינית"');
  }

  say(line);
} catch (err) {
  console.error('\n' + line);
  console.error('  משהו השתבש: ' + String(err.message).split('\n')[0]);
  console.error('  תגידי לקלוד מה כתוב כאן.');
  console.error(line);
  process.exit(1);
}
