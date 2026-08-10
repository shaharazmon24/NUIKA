// Safety net: take back the last change that went live.
//
//   node scripts/undo.mjs
//
// Written for someone who does not know git. It shows what the last change was,
// asks for confirmation, then reverses it and publishes the reversal.
//
// It uses `git revert`, which adds a new commit undoing the old one. Nothing is
// erased and the history stays intact, so the change can be brought back later.

import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureHooks } from './ensure-hooks.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
ensureHooks();

const git = (a, quiet) => execSync(`git ${a}`, { cwd: ROOT, encoding: 'utf8', stdio: quiet ? 'pipe' : undefined }).trim();
const run = a => execSync(a, { cwd: ROOT, stdio: 'inherit' });
const line = '─'.repeat(52);
const say = m => console.log(m);

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(question, a => { rl.close(); r(a.trim()); }));
}

try {
  if (git('status --porcelain')) {
    say('\n' + line);
    say('  יש לך שינויים שעוד לא נשלחו.');
    say('');
    say('  קודם תשלחי אותם:   node scripts/ship.mjs "מה שינית"');
    say('  או תמחקי אותם:     git checkout -- .');
    say(line);
    process.exit(1);
  }

  const branch = git('rev-parse --abbrev-ref HEAD');
  git(`fetch origin ${branch}`, true);
  if (+git(`rev-list --count HEAD..origin/${branch}`) > 0) {
    say('\n' + line);
    say('  יש עדכונים חדשים מהמחשב השני.');
    say('  הריצי קודם:  node scripts/sync.mjs');
    say(line);
    process.exit(1);
  }

  const subject = git('log -1 --pretty=%s');
  const when    = git('log -1 --pretty=%cr');
  const who     = git('log -1 --pretty=%an');
  const files   = git('show --stat --oneline HEAD').split('\n').slice(1).filter(Boolean);

  say('\n' + line);
  say('  השינוי האחרון שיצא לאתר:');
  say('');
  say('    ' + subject);
  say('    מאת ' + who + ', ' + when);
  say('');
  files.forEach(f => say('    ' + f.trim()));
  say(line);

  const answer = await ask('\nלבטל את השינוי הזה? (כן / לא): ');
  if (!/^(כן|y|yes)$/i.test(answer)) {
    say('\nלא שיניתי כלום.\n');
    process.exit(0);
  }

  say('\nמבטל...\n');
  // --no-edit keeps the generated message; the revert is a new commit, so the
  // original change is still in the history and can be restored.
  run('git revert --no-edit HEAD');

  say('\nבודק שהאתר תקין אחרי הביטול...\n');
  try {
    run('node scripts/validate.mjs');
  } catch {
    say('\n' + line);
    say('  הביטול עצמו יצר בעיה. לא שלחתי.');
    say('  תגידי לקלוד: "ביטלתי שינוי והבדיקה נכשלת"');
    say(line);
    process.exit(1);
  }

  run(`git push origin ${branch}`);

  say('\n' + line);
  say('  ✓ בוטל ונשלח. תוך כדקה האתר יחזור למצב הקודם.');
  say('');
  say('  השינוי לא נמחק — הוא שמור בהיסטוריה ואפשר להחזיר אותו.');
  say(line);
} catch (err) {
  console.error('\n' + line);
  console.error('  משהו השתבש: ' + String(err.message).split('\n')[0]);
  console.error('  תגידי לקלוד מה כתוב כאן.');
  console.error(line);
  process.exit(1);
}
