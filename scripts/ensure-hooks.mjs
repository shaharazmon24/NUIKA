// Makes the safety hooks self-installing.
//
// setup.mjs wires up core.hooksPath, but it only helps if someone remembers to
// run it. On a machine where it was never run there is no pre-push guard at
// all, which is exactly the machine most likely to overwrite someone's work.
// Both sync.mjs and ship.mjs call this first, so the guard installs itself on
// first use.

import { execSync } from 'node:child_process';
import { existsSync, chmodSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function ensureHooks() {
  try {
    const current = execSync('git config --get core.hooksPath', {
      cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    if (current === '.githooks') return false;
  } catch {
    // not set at all — fall through and set it
  }

  if (!existsSync(join(ROOT, '.githooks'))) return false;

  execSync('git config core.hooksPath .githooks', { cwd: ROOT });
  execSync('git config pull.rebase false', { cwd: ROOT });
  for (const f of readdirSync(join(ROOT, '.githooks'))) {
    try { chmodSync(join(ROOT, '.githooks', f), 0o755); } catch {}
  }

  console.log('');
  console.log('─'.repeat(52));
  console.log('  הפעלתי את ההגנות על המחשב הזה (פעם אחת בלבד).');
  console.log('  מעכשיו לא תוכלי לשלוח קוד שבור או לדרוס עבודה של שהר.');
  console.log('─'.repeat(52));
  return true;
}
