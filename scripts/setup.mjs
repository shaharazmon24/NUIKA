// One-time setup for a machine that will edit this site.
//
// Run once after cloning:   node scripts/setup.mjs
//
// It wires up the git hooks in .githooks/ and sets a couple of git options
// that stop the two most expensive mistakes: pushing a broken file, and
// pushing over someone else's work.

import { execSync } from 'node:child_process';
import { existsSync, chmodSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim();
}

console.log('Setting up NUIKA…\n');

// 1. Point git at the versioned hooks directory, so the checks travel with
//    the repo instead of living only on one machine.
git('config core.hooksPath .githooks');
console.log('  ok  git hooks enabled (.githooks)');

// Windows clones lose the executable bit; git-bash still runs the hook, but
// set it where the filesystem supports it.
for (const f of readdirSync(join(ROOT, '.githooks'))) {
  try { chmodSync(join(ROOT, '.githooks', f), 0o755); } catch {}
}

// 2. Merge on pull rather than rebase. Rebase mid-conflict is confusing, and
//    confusion is what leads to "just overwrite it".
git('config pull.rebase false');
console.log('  ok  git pull will merge, not rebase');

// 3. Never let a pull silently discard local edits.
git('config merge.ff false');
console.log('  ok  merges are recorded explicitly');

// 4. Sanity check that the validator runs on this machine.
console.log('\nRunning the site check…\n');
try {
  execSync('node scripts/validate.mjs', { cwd: ROOT, stdio: 'inherit' });
} catch {
  console.error('\nThe site check failed. Fix that before making changes.');
  process.exit(1);
}

console.log(`
Done. From now on:

  git pull            before you start
  ...make changes...
  git add -A && git commit -m "what changed" && git push

The push will be blocked automatically if the site is broken, or if someone
else pushed something you have not pulled yet.
`);
