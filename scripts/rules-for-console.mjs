#!/usr/bin/env node
/**
 * firebase-rules.json, ready to paste into the Firebase console.
 *
 * The committed file cannot be pasted as it stands. Firebase's rules parser
 * accepts `.read`, `.write`, `.validate` and `.indexOn`; every other key is
 * read as the name of a CHILD NODE and its value must be an object. The
 * comments in that file are `"//"` keys holding strings, so the console
 * rejects the paste outright:
 *
 *     Line 2: Expected 'rules' property.
 *     Line 6: Expected '{'.
 *
 * Measured on 21 Sep 2026, when the events rules were published by hand and
 * the console refused the file twice. The comments are worth keeping — they
 * say why each node is locked — so they are stripped here instead of deleted
 * there.
 *
 * This script REFUSES to print anything it cannot vouch for. Stripping
 * comments is an automated edit to the file that protects every customer's
 * name, phone and address, so the output is checked against what the rules
 * are supposed to say before it is handed over:
 *
 *   - the tree is closed by default at the root
 *   - orders, admins, kitchen and finance are never publicly readable
 *   - every node that IS publicly readable is still admin-write only
 *   - nothing survived that the console would reject
 *
 * Usage:
 *   node scripts/rules-for-console.mjs          print the clean rules
 *   node scripts/rules-for-console.mjs --check  verify only, print nothing
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'firebase-rules.json');

/* Any key whose name begins with // is a comment: the bare "//" used for a
   note on a node, and the "//field" form used for a note about one field. */
const isComment = k => k.startsWith('//');

function strip(node) {
  if (Array.isArray(node)) return node.map(strip);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (isComment(k)) continue;
      out[k] = strip(v);
    }
    return out;
  }
  return node;
}

const problems = [];
const say = (ok, what) => {
  if (!ok) problems.push(what);
  return ok;
};

let raw;
try {
  raw = readFileSync(SRC, 'utf8');
} catch (e) {
  console.error(`cannot read ${SRC}: ${e.message}`);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  console.error(`firebase-rules.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

const clean = strip(parsed);
const text = JSON.stringify(clean, null, 2);

/* ---- what the output has to be true of ---------------------------------- */

const rules = clean.rules || {};
const nuika = rules.nuika || {};

say(rules['.read'] === false && rules['.write'] === false,
    'the root no longer denies read and write by default');

/* Locked: not readable without auth, and never writable by a plain visitor.
   These hold every customer's name, phone and address, and Noy's costs. */
for (const name of ['orders', 'admins', 'kitchen', 'finance']) {
  const node = nuika[name];
  if (!node) { say(false, `nuika/${name} is missing from the rules entirely`); continue; }
  say(node['.read'] !== true, `nuika/${name} would be publicly readable`);
  say(node['.write'] !== true, `nuika/${name} would be publicly writable`);
}

/* Public on purpose — the shop and the board read them with no sign-in — but
   only an admin may change them. */
for (const name of ['products', 'settings', 'events']) {
  const node = nuika[name];
  if (!node) { say(false, `nuika/${name} is missing from the rules entirely`); continue; }
  say(node['.read'] === true, `nuika/${name} is no longer publicly readable — the page that reads it would go blank`);
  say(typeof node['.write'] === 'string' && node['.write'].includes('admins'),
      `nuika/${name} is not restricted to an admin write`);
}

/* Nothing the console will refuse. */
const leftover = [];
(function scan(node, path) {
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (isComment(k)) leftover.push(path + '/' + k);
    scan(v, path + '/' + k);
  }
})(clean, '');
say(leftover.length === 0, `comment keys survived the strip: ${leftover.join(', ')}`);

/* And it must still be JSON. */
try { JSON.parse(text); } catch (e) { say(false, `the stripped output is not valid JSON: ${e.message}`); }

if (problems.length) {
  console.error('REFUSING to print rules that do not check out:\n');
  for (const p of problems) console.error('  ✗ ' + p);
  console.error('\nNothing was printed. Fix firebase-rules.json first.');
  process.exit(1);
}

const commentsRemoved = (raw.match(/"\/\/[^"]*"\s*:/g) || []).length;

if (process.argv.includes('--check')) {
  console.error(`ok — ${commentsRemoved} comment key(s) would be removed, and the result still locks orders, admins, kitchen and finance.`);
  process.exit(0);
}

console.error(`ok — ${commentsRemoved} comment key(s) removed. Paste everything below into the Firebase console.\n`);
console.log(text);
