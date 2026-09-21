// Guardrail for a single-file site with no build step.
//
// The failure mode this exists to catch: someone uploads a whole index.html
// through GitHub's web uploader from a stale local copy. Git accepts it as a
// normal commit, the site keeps loading, and the loss is invisible until a
// customer hits it. These checks turn that into a red X on the commit.
//
// Run locally:  node scripts/validate.mjs
// CI runs each phase separately so the failing one is obvious in the log.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

const phases = process.argv.slice(2);
const want = f => phases.length === 0 || phases.includes(`--${f}`);

let failed = false;
const pass = m => console.log(`  ok    ${m}`);
const fail = m => { console.error(`  FAIL  ${m}`); failed = true; };

// The last <script> block holds the whole application.
function appScript() {
  const start = html.lastIndexOf('<script>');
  const end = html.lastIndexOf('</script>');
  if (start < 0 || end < 0 || end < start) return null;
  return html.slice(start + '<script>'.length, end);
}

// Every inline <script> block in a page, in file order — the same
// new Function(...) mechanism appScript() uses above, generalised to a file
// that may hold several such blocks (home.html has two). A block whose
// opening tag carries a src attribute is a separate file (site.js today; a
// CDN script tomorrow) — the browser fetches its own contents, this file
// never sees them, so it is skipped rather than parsed as if its text (there
// is none, the element is empty) or, worse, some future non-JS src were
// inline JavaScript.
//
// HTML comments are stripped first. Not a defensive guess: writing this very
// function's own doc comment on the finding it fixes ("even if the
// <script> below fails to parse...") put the literal text "<script>" inside
// an HTML comment in contact.html, and the first run of this check against
// the real file parsed everything from THAT word through the next real
// </script> — several hundred characters later — as one JavaScript block,
// failing with "Unexpected identifier" on ordinary prose. None of the four
// pages' real script content contains "<!--" or "-->" (checked directly,
// since stripping comments blindly would corrupt a block that did), so this
// is safe today; it is recorded as a discovered failure, not a theoretical
// one, precisely because the next person to comment on this code will
// reach for the word "script" too.
function inlineScripts(src) {
  const withoutComments = src.replace(/<!--[\s\S]*?-->/g, ' ');
  return [...withoutComments.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(m => isInlineJs(m[1]))
    .map(m => m[2]);
}

// The HTML standard's list of JavaScript MIME type essences.
const JS_MIME_ESSENCES = new Set([
  'application/ecmascript', 'application/javascript',
  'application/x-ecmascript', 'application/x-javascript',
  'text/ecmascript', 'text/javascript',
  'text/javascript1.0', 'text/javascript1.1', 'text/javascript1.2',
  'text/javascript1.3', 'text/javascript1.4', 'text/javascript1.5',
  'text/jscript', 'text/livescript',
  'text/x-ecmascript', 'text/x-javascript',
]);

// True when a <script> tag's attribute text says "this element's own text is
// JavaScript, and this process can read it". Used by inlineScripts() above
// (which parses those bodies) and by classifyHtml() below (which strips
// their comments), from one definition, so the two can never disagree about
// what a script is.
//
// A src= block's contents live in a file nothing here fetches. An
// application/ld+json block is data — structured data for Google is an
// entirely reasonable thing for a bakery with events to publish, and
// parsing that JSON as JavaScript failed the whole suite once.
//
// Everything else here is the HTML rule, and each clause is a measured
// regression rather than defensive breadth. A three-value list
// (text/javascript, application/javascript, module) shipped in fix round 4
// and silently stopped reading two kinds of block that are classic
// JavaScript per the spec: `type=""` and `type="text/javascript;charset=utf-8"`.
// `loading="lazy"` deleted from gallery.html and left in a // comment inside
// either one passed clean, exit 0 — the body was never comment-stripped and
// never syntax-checked. So: no type attribute means JavaScript; an empty or
// whitespace-only type means JavaScript; `module` means JavaScript; and
// anything else is matched on its ESSENCE — everything before the first `;`
// — trimmed and case-insensitively, because `TEXT/JavaScript` and
// `text/javascript;charset=utf-8` are both the same type as `text/javascript`.
// The value may also be unquoted (`type=module`), which the old pattern,
// requiring quotes, silently read as "no type at all".
const isInlineJs = attrs => {
  if (/\bsrc\s*=/.test(attrs)) return false;
  const m = attrs.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
  if (!m) return true;
  const value = (m[1] ?? m[2] ?? m[3] ?? '').trim();
  if (value === '') return true;
  if (value.toLowerCase() === 'module') return true;
  return JS_MIME_ESSENCES.has(value.split(';')[0].trim().toLowerCase());
};

// Shared with the `pages` phase below. Hoisted here, to module scope, so
// `--syntax` alone (CI runs every phase separately) can still check these
// four files' inline JavaScript without depending on the `pages` phase
// having run first to define the list.
const PAGES = ['home.html', 'story.html', 'gallery.html', 'contact.html', 'events.html'];

// The token kinds a REGEX LITERAL can legally follow. This is the standard
// rule every JavaScript tokeniser uses to tell `/` apart from division:
// after one of these, a `/` can only open a regex literal; after anything
// else — an identifier, a number, a closing `)` or `]`, a string or a
// template — there is a value on the left, so the `/` is division.
// It reads /\D/g, /["']/g and /\/\//g as the regex literals they are, and
// `a / b` as the division it is. Where even this cannot decide, classify()
// refuses to guess rather than desync (see its `trouble` list below).
const REGEX_MAY_FOLLOW_PUNCT = new Set(
  ['=', '(', ',', ':', '[', '!', '&', '|', '?', '+', '-', '*', '%', '~', '^', '{', '}', ';',
   // `<` and `>` complete the same idea, and are not decoration: `>` is the
   // last character of an arrow, so `list.filter(x => /a/.test(x))` needs
   // them. Without `>` in here that arrow's `/` reads as division, `/a/.test`
   // desyncs the walk, and nothing downstream knows. No page uses an arrow
   // with a regex today; it is here so the day one does is not another
   // silent pass.
   '<', '>']);
const REGEX_MAY_FOLLOW_WORD = new Set(
  ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'do', 'else', 'case']);
// The `(` of one of these heads a STATEMENT, so what comes after its `)` is
// the start of an expression and a `/` there opens a regex literal. After
// any other `)` — a call, a grouping — there is a value on the left and the
// `/` is division. This is the one preceder the simple "one character back"
// rule genuinely cannot decide: `if (x) /don't/.test(x)` and `(a + b) / c`
// end in the same character and mean opposite things. Measured before this
// existed: `if (alt) /don't/.test(alt);` added to gallery.html read as
// division, the apostrophe opened a phantom string, the walk re-synced by
// chance on a later quote, and the whole suite reported exit 0.
const STATEMENT_HEADS = new Set(['if', 'for', 'while', 'with']);

// Real JavaScript string/template/regex/comment walker. Hand it JAVASCRIPT —
// the body of an inline <script>, or a function body sliced out of one —
// never a whole HTML file. classifyHtml() (below) is what splits a page into
// markup, script bodies and style bodies and calls this on the script bodies
// only; running this over markup is a measured, shipped bug, recorded on
// uncommented()'s own doc comment.
//
// Classifies every position in `s` as:
//   'c' — code, INCLUDING a template literal's own `${ }` hole, which is
//         code, not text, however deeply it nests further strings of its own
//   's' — not code: inside a plain '/" string, a template literal's literal
//         text (never a hole), or the body of a regex literal
//   'm' — a comment: //, /* */, or <!--
// and reports `uncertain` (with a `trouble` list of {index, reason}) for a
// `/` it genuinely cannot resolve — one with no preceding token at all to
// judge it by, or one that looked like a regex literal and then failed to
// close before the end of its line. A regex literal cannot span a line, so
// that second case means the guess was wrong, and saying so beats carrying a
// wrong guess forward: that is exactly how /don't/'s apostrophe, read as a
// plain quote by a walker with no concept of a regex literal, desynced
// everything after it (task-4-report.md, fix round 2). Callers that can
// refuse — the events board's cardHTML check, and the per-page check in the
// `pages` phase — FAIL on `uncertain` rather than report "ok" over code they
// cannot read.
//
// Backslash handling is the one place a wrong guess here shipped live: on
// meeting `\` inside any string, template or regex, the VERY NEXT character
// is consumed unconditionally, never by asking "was the previous character a
// backslash" once a possible closing quote is reached. That lookbehind is an
// off-by-one for a literal ending in an ESCAPED backslash (`\\`) — the
// second backslash is itself escaped and does not escape what follows, but
// a one-character lookbehind cannot tell `\\` (string still closes
// normally) apart from a single `\` right before the closing quote (the
// quote is escaped, string does not close). `` `x\\` `` measured this live,
// twice: the escaping check's own scanner treated the template as
// unterminated and masked the rest of cardHTML() as string text — a real
// `<img src="y">` landed in a rendered card from a field with nothing
// escaping it at all — and the separate quote-tracker that finds a
// function's matching closing brace had the identical bug for the identical
// reason. Consuming forward one character at a time has no lookbehind to get
// wrong regardless of how many backslashes are chained. The same off-by-one
// survived in htmlPieces() and statementEnd() until fix round 4, where
// `lbDesc.innerHTML = 'C:\\' + location.hash + esc(activeTag);` was measured
// passing clean. See task-4-report.md, fix rounds 3 and 4.
function classify(s) {
  const tags = new Array(s.length).fill('c');
  const stack = []; // {k:'str',q} | {k:'tmpl'} | {k:'hole',depth} | {k:'line'} | {k:'block'}
  const trouble = [];
  let uncertain = false;
  const top = () => stack[stack.length - 1];
  const note = (index, reason) => { uncertain = true; trouble.push({ index, reason }); };

  // What does the `/` at position `i` open? Returns the index of the last
  // character of a regex literal (flags included), -1 for division, or -2
  // for "cannot tell — do not guess". Everything before `i` is already
  // tagged, so "the previous significant token" is a real question this can
  // answer rather than a lookbehind over raw characters.
  // The word immediately before the `(` that `closeIdx`'s `)` closes, or
  // null if the parentheses do not balance (in which case nothing here can
  // be trusted and the caller refuses). Positions inside strings and
  // comments are skipped, so a `(` in a string never counts.
  const headBefore = (closeIdx) => {
    let d = 0;
    for (let k = closeIdx; k >= 0; k--) {
      if (tags[k] === 's' || tags[k] === 'm') continue;
      if (s[k] === ')') d++;
      else if (s[k] === '(') {
        if (--d > 0) continue;
        let e = k - 1;
        while (e >= 0 && (tags[e] === 'm' || /\s/.test(s[e]))) e--;
        let w = e;
        while (w >= 0 && /[A-Za-z0-9_$]/.test(s[w])) w--;
        return s.slice(w + 1, e + 1);
      }
    }
    return null;
  };

  const readSlash = (i) => {
    let j = i - 1;
    while (j >= 0 && (tags[j] === 'm' || /\s/.test(s[j]))) j--;
    if (j < 0) return -2;
    let isRegex;
    const pc = s[j];
    // Punctuation is checked before the tag, deliberately: the `{` of a
    // template literal's own `${` is tagged 's' (it is the hole's
    // punctuation, not code), and `${/re/.test(x)}` is a regex literal.
    // No string, template or regex can END on one of these characters —
    // they all end on a quote, a backtick, a `/` or a flag letter — so
    // nothing is mis-credited by looking here first.
    if (REGEX_MAY_FOLLOW_PUNCT.has(pc)) isRegex = true;
    else if (tags[j] === 's') isRegex = false;     // a string, template or regex ended here
    else if (pc === ')') {
      const head = headBefore(j);                  // see STATEMENT_HEADS above
      if (head === null) return -2;                // parentheses do not balance: refuse
      isRegex = STATEMENT_HEADS.has(head);
    }
    else if (/[A-Za-z0-9_$]/.test(pc)) {
      let k = j;
      while (k >= 0 && /[A-Za-z0-9_$]/.test(s[k])) k--;
      isRegex = REGEX_MAY_FOLLOW_WORD.has(s.slice(k + 1, j + 1));
    } else isRegex = false;                        // `]` `.` and friends
    if (!isRegex) return -1;

    let k = i + 1, inClass = false, closed = false;
    for (; k < s.length; k++) {
      const ch = s[k];
      if (ch === '\\') { k++; continue; }
      if (ch === '\n') return -2;                  // a regex literal cannot span a line
      if (inClass) { if (ch === ']') inClass = false; continue; }
      if (ch === '[') { inClass = true; continue; }
      if (ch === '/') { closed = true; break; }
    }
    if (!closed) return -2;
    k++;
    while (k < s.length && /[A-Za-z]/.test(s[k])) k++;   // flags
    return k - 1;
  };

  // Is position `i` preceded, on its own line, by nothing but whitespace and
  // comments? That is what makes a `-->` a comment rather than `--` and `>`.
  const lineLeading = (i) => {
    for (let k = i - 1; k >= 0; k--) {
      if (s[k] === '\n') return true;
      if (tags[k] === 'm' || /\s/.test(s[k])) continue;
      return false;
    }
    return true;
  };

  // Shared by the two code contexts — top level and a template literal's
  // `${ }` hole — which differ only in how they end.
  const codeChar = (i) => {
    const c = s[i];
    if (c === "'" || c === '"') { tags[i] = 's'; stack.push({ k: 'str', q: c }); return i; }
    if (c === '`') { tags[i] = 's'; stack.push({ k: 'tmpl' }); return i; }
    // JavaScript's own HTML-like comments (Annex B B.1.3), and they are LINE
    // comments, not a block pair. `<!--` comments to the end of its line and
    // nothing more; the lines after it RUN. Treating `<!-- … -->` as a block
    // and blanking everything between was measured hiding live code from the
    // escaping guard: on gallery.html,
    //     var hOpen = 1; <!--
    //     lbDesc.innerHTML = '<b>' + location.hash + '</b>';
    //     -->
    //     var hClose = 2;
    // passed clean, exit 0, while `new Function()` accepted it, --syntax
    // stayed green, and the unescaped write really did reach innerHTML in a
    // browser. See task-4-report.md, fix round 5.
    if (c === '<' && s[i + 1] === '!' && s[i + 2] === '-' && s[i + 3] === '-') {
      tags[i] = tags[i + 1] = tags[i + 2] = tags[i + 3] = 'm';
      stack.push({ k: 'line' }); return i + 3;
    }
    // `-->` is a comment ONLY where nothing but whitespace and comments comes
    // before it on its own line. Anywhere else it is a decrement followed by
    // a greater-than — `while (i --> 0)` is ordinary, if cute, JavaScript.
    if (c === '-' && s[i + 1] === '-' && s[i + 2] === '>' && lineLeading(i)) {
      tags[i] = tags[i + 1] = tags[i + 2] = 'm';
      stack.push({ k: 'line' }); return i + 2;
    }
    if (c === '/' && s[i + 1] === '*') { tags[i] = tags[i + 1] = 'm'; stack.push({ k: 'block' }); return i + 1; }
    if (c === '/' && s[i + 1] === '/') { tags[i] = tags[i + 1] = 'm'; stack.push({ k: 'line' }); return i + 1; }
    if (c === '/') {
      const end = readSlash(i);
      if (end === -2) {
        note(i, 'a "/" this checker cannot read as either a regex literal or division');
        return i;
      }
      if (end === -1) return i;                    // division: ordinary code
      for (let k = i; k <= end; k++) tags[k] = 's';
      return end;
    }
    return i;
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const ctx = top();

    if (!ctx) { i = codeChar(i); continue; }

    if (ctx.k === 'str') {
      tags[i] = 's';
      if (c === '\\') { i++; if (i < s.length) tags[i] = 's'; continue; }
      if (c === ctx.q) { stack.pop(); continue; }
      continue;
    }

    if (ctx.k === 'tmpl') {
      tags[i] = 's';
      if (c === '\\') { i++; if (i < s.length) tags[i] = 's'; continue; }
      if (c === '`') { stack.pop(); continue; }
      if (c === '$' && s[i + 1] === '{') {
        tags[i] = 's'; i++; tags[i] = 's';
        stack.push({ k: 'hole', depth: 0 });
        continue;
      }
      continue;
    }

    if (ctx.k === 'hole') {
      if (c === '{') { ctx.depth++; continue; }
      if (c === '}') {
        if (ctx.depth > 0) { ctx.depth--; continue; }
        tags[i] = 's'; // the hole's own closing brace — punctuation, not code
        stack.pop();
        continue;
      }
      i = codeChar(i);
      continue;
    }

    if (ctx.k === 'line') {
      if (c === '\n') { stack.pop(); continue; } // the newline ends it but is not itself part of it
      tags[i] = 'm';
      continue;
    }

    // ctx.k === 'block'
    tags[i] = 'm';
    if (c === '*' && s[i + 1] === '/') { tags[i + 1] = 'm'; i++; stack.pop(); continue; }
  }

  // Anything still open at the end means this walk lost track of where it
  // was — an unterminated string or template, or a comment that never
  // closes. Well-formed JavaScript never ends that way, so rather than hand
  // back a tag array built on a wrong turn somewhere upstream, say so. (A
  // `//` comment running to the end of input is ordinary and is not counted.)
  const left = stack[stack.length - 1];
  if (left && left.k !== 'line') {
    note(s.length - 1, `the file ends inside an unterminated ${left.k === 'str' ? 'string' : left.k === 'tmpl' || left.k === 'hole' ? 'template literal' : 'comment'} — this checker lost track of where code stops and text starts`);
  }

  return { tags, uncertain, trouble };
}

// CSS's own comment rules, for a <style> body. CSS has `/* */` and nothing
// else: there is no `//` line comment in CSS, so running the JavaScript
// walker over a stylesheet reads the `//` in `url(https://…)` as a comment
// and blanks the rest of the line. Strings are tracked only so a `/*` inside
// one is not mistaken for a comment opening; they are left as string text,
// masked the same way classify() masks its own.
function classifyCss(s) {
  const tags = new Array(s.length).fill('c');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '*') {
      tags[i] = tags[i + 1] = 'm';
      let k = i + 2;
      for (; k < s.length; k++) {
        tags[k] = 'm';
        if (s[k] === '*' && s[k + 1] === '/') { tags[k + 1] = 'm'; k++; break; }
      }
      i = k;
      continue;
    }
    if (c === "'" || c === '"') {
      tags[i] = 's';
      let k = i + 1;
      for (; k < s.length; k++) {
        if (s[k] === '\n') break;            // an unescaped newline ends a CSS string
        tags[k] = 's';
        if (s[k] === '\\') { k++; if (k < s.length) tags[k] = 's'; continue; }
        if (s[k] === c) break;
      }
      i = k;
      continue;
    }
  }
  return { tags };
}

// An HTML document is three different languages in one file, and each one
// decides what a comment is differently. This walks the markup itself,
// hands every inline <script> body to classify() (JavaScript) and every
// <style> body to classifyCss() (CSS), and leaves everything in between as
// what it is: prose, where the only comment is <!-- --> and an apostrophe is
// punctuation.
//
// HTML comments are recognised BEFORE <script> tags, in the same
// left-to-right walk, because the word "<script>" written inside a comment
// is prose — the exact incident inlineScripts()' own doc comment records.
//
// Returns the tag array, plus one entry per inline script block
// ({start, end, uncertain, trouble}) so a caller can both read a script body
// back out by its real offsets and ask whether this file could be classified
// at all.
function classifyHtml(s) {
  const tags = new Array(s.length).fill('c');
  const lower = s.toLowerCase();
  const scripts = [];
  const trouble = [];
  const openRe = /<(script|style)\b([^>]*)>/iy;

  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '<') continue;

    if (lower.startsWith('<!--', i)) {
      const found = s.indexOf('-->', i + 4);
      const end = found === -1 ? s.length - 1 : found + 2;
      for (let k = i; k <= end; k++) tags[k] = 'm';
      i = end;
      continue;
    }

    openRe.lastIndex = i;
    const m = openRe.exec(s);
    if (!m) continue;

    const name = m[1].toLowerCase();
    const bodyStart = i + m[0].length;
    const found = lower.indexOf('</' + name, bodyStart);
    const bodyEnd = found === -1 ? s.length : found;
    const body = s.slice(bodyStart, bodyEnd);

    if (name === 'style') {
      const r = classifyCss(body);
      for (let k = 0; k < body.length; k++) tags[bodyStart + k] = r.tags[k];
    } else if (isInlineJs(m[2])) {
      const r = classify(body);
      for (let k = 0; k < body.length; k++) tags[bodyStart + k] = r.tags[k];
      const own = r.trouble.map(t => ({ index: bodyStart + t.index, reason: t.reason }));
      scripts.push({ start: bodyStart, end: bodyEnd, uncertain: r.uncertain, trouble: own });
      for (const t of own) trouble.push(t);
    }
    // A <script src=...> block, or a non-JavaScript type, is left exactly as
    // it stands: this file never sees what the browser fetches, and JSON is
    // not JavaScript.

    i = bodyEnd - 1; // the closing tag is walked as markup, like any other
  }

  return { tags, scripts, trouble };
}

// Replaces every position whose tag satisfies `pick` with a space, except a
// literal newline, which is always kept — this is what stops a stripped
// multi-line comment or string from gluing the tokens on either side of it
// into one, while keeping line numbers in the result meaningful.
function maskTags(s, tags, pick) {
  const out = s.split('');
  for (let i = 0; i < s.length; i++) {
    if (pick(tags[i]) && s[i] !== '\n') out[i] = ' ';
  }
  return out.join('');
}

// Every check in the `pages` phase reads source text, and source text has
// comments. Checks there have now been defeated four separate times by
// deleting the real code and leaving the word behind in a comment — once
// in HTML, once in a // line, once in a /* */ block inside <style> (see
// task-6-report.md for those three, each broken and reverted in turn), and
// once, far worse, across most of a whole file (fix round 4 below).
// Strip all three forms, once, in one shared function every simple
// presence check in that phase runs against, and check what is left.
// Replaced with a space, not nothing, so a stripped comment cannot glue
// two identifiers into one.
//
// The argument is an HTML DOCUMENT — that is what every caller passes, and
// what classifyHtml() below assumes. Handing this a bare .js file would
// leave its // comments standing, because in markup a `//` is not a comment.
//
// Built on classifyHtml(), which reads a page as the three languages it
// actually is. Through fix round 3 this ran classify() — a JavaScript
// walker — over the ENTIRE HTML file, as if markup were a program. HTML
// prose is full of apostrophes, and each one opened a phantom string that
// swallowed everything after it until some later apostrophe happened to
// close it. Measured on story.html, which carries Noy's own English:
// "I'm not really looking…", "don't stop eating…", "I'll always use mostly
// whole flours". Three such phantom spans covered 2,798 of that file's
// 12,732 characters — 22% of it — and inside them this function stripped
// nothing at all. SIX of story.html's nine content checks could then be
// defeated by the exact trick this function exists to stop: delete the
// phrase, leave it sitting in an HTML comment, and the check goes green
// (אשכרה, זאת מאפייה של אישה אחת, הכל נגמר מהר. אז יאללה, מושחת,
// תמיד אמעיט בסוכר, shop.html — every one of them exit 0, measured).
//
// The same one-language assumption reached the escaping guard too:
// `var dbl = /\/\//g;` — an ordinary normalise-a-double-slash regex, with
// no quote in it at all — has its own `//` read as a line comment, which
// blanked an unescaped innerHTML write on the same line out of existence
// before unsafeHtmlWrites() ever saw it. And `var qStrip = /["']/g;` opened
// a phantom string on its `"` that hid a deleted-and-commented requirement
// several lines later. Both measured passing clean, exit 0, before fix
// round 4.
//
// So: HTML comments are stripped by an HTML-aware pass over the markup;
// classify() runs only over the bodies of inline <script> blocks that have
// no src; <style> bodies go to classifyCss(), which knows CSS has /* */ and
// no // at all. Prose in between is prose, and an apostrophe there is
// punctuation. HTML comments are recognised before <script> tags in that
// same walk, which is what keeps the incident inlineScripts()' doc comment
// records — the literal word "<script>" written inside an HTML comment —
// from being read as a script block here too.
//
// The direction this replaced in fix round 3 is still fixed, and by the
// same machinery: `grid.innerHTML = '<a href=" // ">' + location.hash;` in
// gallery.html once passed the escaping check clean, because the guard of
// the day decided a `//` opened a comment by looking at the one character
// before it. classify() knows whether that position is inside a string.
// See task-4-report.md, fix rounds 3 and 4, for every direction measured
// before and after.
const uncommented = s => maskTags(s, classifyHtml(s).tags, t => t === 'm');

// uncommented() has no failure channel: it returns a string, and a page
// whose inline JavaScript could not be classified comes back looking
// exactly like one that was read perfectly. This is that channel — the
// `pages` phase asks it per page and FAILs, because an analyser that
// cannot understand its input must never report "ok".
const scriptTrouble = s => classifyHtml(s).trouble;

const lineOf = (s, index) => s.slice(0, Math.max(0, index)).split('\n').length;

// Escaping is a property of each write, not of the file. The check these
// replace looked for the string `esc(` anywhere in the page, so a new
// unescaped write sitting next to escaped ones passed — which is exactly the
// write a new page is about to add. It also saw only `.innerHTML =`, never
// `+=` and never `.outerHTML`.
//
// Each assignment is read to the end of its statement, and the statement is
// then split into the pieces it concatenates. EVERY piece that names something
// must escape. Asking only whether `esc(` appears somewhere in the statement
// was not enough, and was measured not to be — it passed
//     box.innerHTML = '<b>' + esc(ev.date) + '</b>' + ev.title;
// where one of two fields is escaped and the other one is the injection.
//
// encodeURIComponent() counts as escaping: it encodes < > " and ' too, so a
// value that went through it cannot open a tag or close an attribute.
//
// A statement that hands the escaping to a function it calls — a row builder
// that escapes every field itself — marks the line above it
// /* esc-ok: <which function escapes> */, the same escape hatch the
// physical-left/right check already uses as /* rtl-ok */. The marker has to
// name the function, so a reviewer can open it and see that it really does.
//
// Known limit, written down rather than hidden: within a single parenthesised
// piece — `(p ? ' - ' + esc(p) : '')` — one esc() satisfies the whole piece,
// so a crafted `(a ? b : esc(c))` would pass. The marker and the reviewer are
// what cover that; a regex is not going to.
//
// Hoisted to module scope, next to PAGES, inlineScripts() and uncommented():
// CI runs every phase on its own, so nothing the `pages` phase needs may
// depend on another phase's block having run first. (An earlier version of
// this note claimed the `features` phase calls unsafeHtmlWrites() too, on a
// slice of index.html's application script. It does not, and never did —
// the one call site is in the per-page loop of the `pages` phase.)

// A `+` inside a string, a call, a bracket or a brace is not a join.
//
// Backslashes are consumed FORWARD, never checked backward: on meeting `\`
// inside a string, the next character is taken unconditionally and is never
// tested as a possible closing quote. The lookbehind this replaces
// (`rhs[i - 1] !== '\\'`) is an off-by-one on a literal ending in an escaped
// backslash, and it survived here two rounds after the same bug was fixed in
// classify() — measured in fix round 4 with
// `lbDesc.innerHTML = 'C:\\' + location.hash + esc(activeTag);`, which
// passed clean: the walk read the closing quote as escaped, treated the rest
// of the statement as string text, and never saw the unescaped
// `location.hash` as its own piece at all. See classify()'s doc comment for
// the full mechanism and task-4-report.md, fix round 4, for the measurement.
const htmlPieces = rhs => {
  const out = []; let depth = 0, cur = '', q = null;
  for (let i = 0; i < rhs.length; i++) {
    const c = rhs[i];
    if (q) {
      cur += c;
      if (c === '\\') { i++; if (i < rhs.length) cur += rhs[i]; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    if (c === ')' || c === ']' || c === '}') depth--;
    if (c === '+' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
};

const htmlLiteralOnly = s =>
  !/[A-Za-z_$]/.test(s.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, ''));

const htmlEscapes = s => /\besc\s*\(/.test(s) || /\bencodeURIComponent\s*\(/.test(s);

// Finds the `;` that actually ends a statement starting at `from` in `s`.
// The matcher used to find this with `([^;]*);` — a character class with no
// idea what a quote is, so it stopped at the first `;` anywhere, including
// the one inside every HTML entity: `&nbsp;`, `&amp;`, `&mdash;`. That
// truncated `esc('&nbsp;') + ev.title;` down to `esc('&nbsp`, which still
// contains the substring `esc(` and made the whole statement — the
// unescaped `ev.title` included — read as escaped; and it truncated the
// pure literal `'<p>&nbsp;</p>';` down to an unterminated string that failed
// htmlLiteralOnly and FAILed a write with nothing to escape at all. Reuses
// the exact quote-and-depth state machine htmlPieces already tracks —
// walking forward instead of splitting on `+` — so a `;` inside a string or
// template literal, or inside an open `(`, `[` or `{`, is never mistaken for
// the end of the statement. Returns -1 if the statement never terminates
// before the end of `s` (malformed input; callers treat that as unsafe
// rather than silently skipping it).
//
// Backslashes are consumed forward here for the same reason, and from the
// same measurement, as in htmlPieces() above: `lbDesc.innerHTML = 'C:\\' +
// location.hash; var sTag = esc(activeTag);` passed clean while the
// lookbehind stood — the walk thought the string was still open at the real
// `;`, ran on to the NEXT statement's semicolon, and swallowed an unrelated
// `esc(` that made the whole thing read as escaped.
function statementEnd(s, from) {
  let depth = 0, q = null;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '\\') { i++; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ';' && depth === 0) return i;
  }
  return -1;
}

// Every unescaped write to innerHTML/outerHTML in `code`. `raw` is the same
// file before comments were stripped, and is used only to read the
// /* esc-ok: */ markers back off it: uncommented() collapses a block comment
// to one space, and the lines it spanned with it, so a line number taken from
// the stripped text does not point at the same line in the file. The
// statement's own opening text is the anchor instead. Statements themselves
// come from the stripped text, so a write that appears only inside a comment
// is never considered at all.
//
// The regex below only finds where a statement STARTS — `.innerHTML =` or
// `.outerHTML +=` — never how long it runs; statementEnd() (above) finds
// where it actually ends, for the reason documented there.
//
// `raw.indexOf(anchor)` alone breaks the moment two different statements
// share the same anchor text. The regex's own `\.` never includes the
// receiver, so `grid.innerHTML = html` and `filterRow.innerHTML = html`
// produce the identical anchor `.innerHTML = html;` — searching from 0 every
// time then resolves BOTH matches to whichever one sits first in the file.
// Found by mutation-testing row 6 of the table below (`box.innerHTML =
// html;`, no marker) against gallery.html's own already-marked
// `filterRow.innerHTML = html;`: the first-occurrence lookup made the real,
// marked write get re-flagged alongside the mutated one. In the opposite
// file order it is worse than a false alarm — an unmarked, genuinely unsafe
// write would silently inherit an earlier write's /* esc-ok: */ marker and
// pass. A cursor that only ever moves forward, advanced once per match in
// the same order matchAll already visits them in, maps the Nth match in
// `code` to the Nth occurrence of that text in `raw` instead of always the
// first, so same-shaped writes can no longer borrow each other's marker.
function unsafeHtmlWrites(code, raw) {
  let cursor = 0;
  const out = [];
  for (const m of code.matchAll(/\.(innerHTML|outerHTML)\s*\+?=\s*/g)) {
    const rhsStart = m.index + m[0].length;
    const semi = statementEnd(code, rhsStart);
    const rhsEnd = semi === -1 ? code.length : semi;
    const rhs = code.slice(rhsStart, rhsEnd);
    const full = code.slice(m.index, semi === -1 ? rhsEnd : semi + 1);

    let safe;
    if (/\$\{/.test(rhs)) {
      // A template literal: the splitter cannot see its holes.
      safe = htmlEscapes(rhs);
    } else {
      const risky = htmlPieces(rhs).filter(p => !htmlLiteralOnly(p) && !htmlEscapes(p));
      safe = risky.length === 0;
    }
    if (safe) continue;

    const anchor = full.trim().slice(0, 40);
    const at = raw.indexOf(anchor, cursor);
    if (at >= 0) cursor = at + anchor.length;
    const before = at > 0 ? raw.slice(Math.max(0, at - 220), at) : '';
    // "Anywhere in the last 220 characters" is not "the line above it": the
    // anchor excludes the receiver (`box`, `filterRow`, ...), so `before`
    // ends a few characters short of the statement's real start, and a
    // 220-character window reaches well past one whole neighbouring
    // statement. Found adversarially: an unmarked `box.innerHTML = html;`
    // placed after buildFilters()'s real, marked `filterRow.innerHTML =
    // html;` read as marked too — the closing `*/`, the marked statement
    // itself, `filterRow.hidden = false;` and the function's `}` all fit
    // inside 220 characters, so the unrelated marker leaked across a
    // complete statement boundary onto an unmarked one. A marker only
    // counts when its closing `*/` is the last thing before the statement,
    // give or take whitespace and the receiver expression itself (the bit
    // the anchor already excludes) — never an entire other statement.
    if (/\/\*\s*esc-ok:[^*]*\*\/\s*[\w$.[\]'"]*\s*$/.test(before)) continue;

    out.push([full, m[1], rhs]);
  }
  return out;
}

if (want('syntax')) {
  console.log('JavaScript syntax:');
  const js = appScript();
  if (!js) {
    fail('could not locate the application <script> block');
  } else {
    try {
      new Function(js);
      pass(`parses (${js.split('\n').length} lines)`);
    } catch (err) {
      fail(`syntax error: ${err.message}`);
    }
  }

  // A merge that was committed without resolving would ship these markers.
  if (/^(<{7}|={7}|>{7})/m.test(html)) fail('unresolved merge conflict markers');
  else pass('no conflict markers');

  // index.html (above) and site.js (checked under `--design`) were the only
  // files this phase ever parsed. The four new pages add roughly 440 lines
  // of their own inline JavaScript — the contact form's whole submit and
  // validate logic, the gallery's grid and lightbox, the home page's
  // autoplay handling — and none of it was parsed anywhere. A syntax error
  // dropped into any one of them left the entire suite green: the contact
  // form silently fell back to a native submit (see the leaked-phone-number
  // finding above `ctNeed` under `--pages`), the gallery rendered a heading
  // and nothing else, and the home page's film never played and never
  // honoured Save-Data or reduced motion. Parsing every inline block in all
  // four pages, the same way appScript() already does for index.html, turns
  // all three back into a red suite instead of a silent runtime failure.
  console.log('New pages\' inline JavaScript:');
  for (const page of PAGES) {
    const p = join(ROOT, page);
    if (!existsSync(p)) { fail(`${page}: missing, cannot check its inline JavaScript`); continue; }
    const scripts = inlineScripts(readFileSync(p, 'utf8'));
    if (scripts.length === 0) { pass(`${page}: no inline <script> block`); continue; }
    let ok = true;
    scripts.forEach((block, i) => {
      try {
        new Function(block);
      } catch (err) {
        fail(`${page}: inline <script> block ${i + 1} of ${scripts.length} has a syntax error: ${err.message}`);
        ok = false;
      }
    });
    if (ok) {
      const lines = scripts.reduce((n, s) => n + s.split('\n').length, 0);
      pass(`${page}: ${scripts.length} inline <script> block${scripts.length === 1 ? '' : 's'} ${scripts.length === 1 ? 'parses' : 'parse'} (${lines} lines)`);
    }
  }
}

if (want('features')) {
  console.log('Critical features:');
  // Each entry is something whose absence means real, silent breakage.
  const required = [
    ['firebase.initializeApp',  'Firebase init — without it nothing syncs and the shop is stuck on build-time data'],
    ['${ROOT}/orders/',         'orders are written to Firebase'],
    ['function esc(',           'HTML escaping for customer-supplied text in the admin panel'],
    ['ordersAreOpen',           'closed-shop / deadline enforcement'],
    ['kitchenReady',            'guard that stops kitchen saves overwriting real data with defaults'],
    ['_submitting',             'double-submit guard on the order button'],
    ['getCartTotal()',          'order total is computed, not read from a stale variable'],
    ['persistCart',             'cart survives a reload'],
    ['PICKUP_ADDRESS',          'pickup-only ordering'],
    ['togglePayment',           'cash / Bit / PayBox selection'],
    ['rel="manifest"',          'the manifest is linked, or the app stops being installable'],
    ['serviceWorker.register',  'the service worker is registered'],
    ['pruneCart',               'sold-out items are cleared from the cart rather than becoming unremovable'],
    ['menuProducts',            'dishes parked in the bank stay hidden from customers'],
    ['toggleInMenu',            'dishes can be moved between the menu and the bank'],
  ];
  for (const [needle, why] of required) {
    if (html.includes(needle)) pass(why);
    else fail(`missing "${needle}" — ${why}`);
  }

  // Bugs that shipped once already. Their exact shape must not come back.
  const banned = [
    ['itemsTotal + delivery', 'undefined variable that silently killed order submission'],
  ];
  for (const [needle, why] of banned) {
    if (html.includes(needle)) fail(`regression: "${needle}" — ${why}`);
    else pass(`no regression: ${why}`);
  }
}

if (want('assets')) {
  console.log('Service worker:');
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  try {
    new Function(sw);
    pass('sw.js parses');
  } catch (err) {
    // A broken worker fails to install, so every existing visitor silently
    // keeps the old cached app while a fresh browser looks perfectly fine.
    fail(`sw.js syntax error: ${err.message}`);
  }
  // The precache swallows failures by design, so a typo'd path is invisible
  // at runtime and stays broken forever.
  const assetList = sw.match(/const ASSETS = \[([\s\S]*?)\]/);
  if (assetList) {
    for (const m of assetList[1].matchAll(/'\.\/([^']*)'/g)) {
      const rel = m[1];
      if (!rel || existsSync(join(ROOT, rel))) pass(`precache ./${rel}`);
      else fail(`sw.js precaches a file that does not exist: ./${rel}`);
    }
  }

  console.log('Deployment:');
  // Deleting or altering CNAME unsets the GitHub Pages custom domain, which
  // takes the whole shop offline. It has happened once already.
  const cnamePath = join(ROOT, 'CNAME');
  if (!existsSync(cnamePath)) fail('CNAME is missing — the custom domain will be unset and the site will go down');
  else {
    const host = readFileSync(cnamePath, 'utf8').trim();
    if (host === 'nuika.co.il') pass('CNAME points at nuika.co.il');
    else fail(`CNAME contains "${host}" — expected nuika.co.il`);
  }

  // status.mjs reads this one tag to compare the folder, GitHub and the live
  // site, and ship.mjs rewrites it on every publish. If it ever goes missing,
  // stamping quietly becomes a no-op — ship.mjs prints a warning and carries
  // on — and every release after that is invisible to status.mjs. Never edit
  // it by hand; this only checks that it is there and in the shape both
  // scripts agree on.
  const versionTag = html.match(/<meta name="nuika-version" content="([^"]*)"/);
  if (!versionTag) {
    fail('index.html has no nuika-version meta tag — ship.mjs cannot stamp it and status.mjs cannot compare anything');
  } else if (/^\d{4}-\d\d-\d\dT[\d:.]+Z\|[0-9a-f]{7,}$/.test(versionTag[1])) {
    pass('index.html carries a version stamp in the shape ship.mjs writes');
  } else {
    fail(`the nuika-version tag reads "${versionTag[1]}" — expected <ISO timestamp>|<commit>, which is what status.mjs parses`);
  }

  // Every publish must stamp the version into index.html first. status.mjs
  // compares the folder, GitHub and the live site by that stamp, so a push
  // that skips it leaves all three reporting the same old version while the
  // live site has in fact changed — the one tool whose job is to refuse to
  // pretend everything is fine goes blind.
  //
  // Not hypothetical. ship.mjs grew a second publish path — the one taken when
  // the tree is already clean, as it is right after merging a branch — and that
  // path pushed without stamping. The four new pages went live under the
  // previous version tag and status.mjs reported all three in agreement.
  //
  // The fix was one publish() that stamps and then pushes. This keeps it one.
  // Comments in ship.mjs are whole lines, so dropping them is enough to keep a
  // comment that merely mentions pushing from counting as a push site.
  const ship = readFileSync(join(ROOT, 'scripts', 'ship.mjs'), 'utf8')
    .split('\n')
    .filter(l => !l.trimStart().startsWith('//'))
    .join('\n');

  const pushSites = [...ship.matchAll(/git push/g)].length;
  if (pushSites === 1) pass('ship.mjs pushes from exactly one place');
  else fail(`ship.mjs pushes from ${pushSites} place(s) — every push goes through publish(), which stamps first`);

  const publishFn = ship.match(/function publish\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
  if (!publishFn) {
    fail('ship.mjs has no publish() — the one function allowed to push');
  } else {
    const stampAt = publishFn[1].indexOf('stampVersion()');
    const pushAt  = publishFn[1].indexOf('git push');
    if (stampAt >= 0 && pushAt >= 0 && stampAt < pushAt) pass('publish() stamps the version before it pushes');
    else fail('publish() must call stampVersion() before it pushes, or a release goes out under the previous version tag');
  }

  // The rules are the only thing between a public database handle and Noy's
  // data. An untyped field under events is an HTML injection route straight
  // into the admin panel — the same shape the orders node was hardened
  // against. This checks the shape; Noy publishes the file by hand once.
  const rules = JSON.parse(readFileSync(join(ROOT, 'firebase-rules.json'), 'utf8'));

  // Whitespace-normalised exact equality is the only technique in this file confirmed
  // immune to an appended "|| true" — a plain .includes() test on a permission string has
  // the identical hole as the field-rule "contains the required pieces" checks fixed
  // above it, and it was live in exactly the two checks that used to sit here. Appending
  // " || true" to nuika/events's .write rule (making the events board writable by anyone
  // on the internet) still contains the substring "root.child('nuika/admins')", so
  // .includes(...) printed "ok nuika/events is writable only by an admin". The same four
  // characters appended to nuika/orders's .read rule — the check the brief calls the only
  // thing between an editing slip in this file and every customer's name, phone number
  // and address going public — still contains that substring too, and still printed "ok
  // nuika/orders is still admin-read only". Both are now compared against this literal
  // instead: the exact admin rule that products, settings, stockUsed, orders, kitchen,
  // finance and _seeded all use today (checked directly against the file, not assumed).
  // It is written out here rather than read from the file, so the check and the file stay
  // two independent statements of the same requirement.
  const normalize = s => s.replace(/\s+/g, '');
  const ADMIN_ONLY_RULE = "auth != null && root.child('nuika/admins').child(auth.uid).val() === true";

  const ev = rules?.rules?.nuika?.events;
  if (!ev) {
    fail('firebase-rules.json has no nuika/events — events.html would read PERMISSION_DENIED');
  } else {
    if (ev['.read'] === true) pass('nuika/events is publicly readable');
    else fail('nuika/events must be publicly readable — events.html reads it with no sign-in');

    if (typeof ev['.write'] === 'string' && normalize(ev['.write']) === normalize(ADMIN_ONLY_RULE)) {
      pass('nuika/events is writable only by an admin');
    } else {
      fail(`nuika/events must be writable only by an admin — .write must read exactly ${ADMIN_ONLY_RULE}, got ${JSON.stringify(ev['.write'])}`);
    }

    const item = ev['$eventId'];
    if (!item) {
      fail('nuika/events has no $eventId rule — every field would be unvalidated');
    } else {
      if (item['$other'] && item['$other']['.validate'] === false) pass('nuika/events rejects unknown fields');
      else fail('nuika/events must carry "$other": { ".validate": false } — an unknown field is an injection route');

      // A regex/substring test here is not a logic check: newData.hasChildren(['date']) ||
      // newData.hasChildren(['title']) contains the literal words "date" and "title", so
      // /date/.test(...) && /title/.test(...) reported "ok an event must carry date and
      // title" on a rule that requires only ONE of the two mandatory fields, not both —
      // an AND-to-OR slip that mutation testing caught and reading did not. Compare the
      // normalised rule against the exact text the plan requires instead of looking for
      // words inside it. The failure message below states what was expected and what was
      // found and nothing more: a rule that merely reorders the two names, such as
      // newData.hasChildren(['title','date']), is functionally identical in Firebase
      // (hasChildren is order-independent) and still fails this exact-text comparison —
      // correctly, since this file must also detect a plain unexplained edit — but the
      // message must not claim that specific reorder is an OR bug, because it isn't one.
      const EXPECTED_EVENT_ID_RULE = "newData.hasChildren(['date','title'])";
      if (typeof item['.validate'] === 'string' && normalize(item['.validate']) === normalize(EXPECTED_EVENT_ID_RULE)) {
        pass('an event must carry date and title');
      } else {
        fail(`nuika/events/$eventId's .validate must read exactly ${EXPECTED_EVENT_ID_RULE} — got ${JSON.stringify(item['.validate'])}`);
      }

      // A "does this rule contain the required pieces" check — a substring, a regex
      // fragment, a number pulled out and compared — proves the pieces are present, never
      // that the rule is only those pieces and nothing else. Two real mutations exploited
      // exactly that gap in the first version of this fix: created's rule became
      // newData.isNumber() || true, and place's became newData.isString() &&
      // newData.val().length <= 120 || true. By ordinary && / || precedence, `A && B ||
      // true` is unconditionally true regardless of the value's real type or length — yet
      // every piece a substring check looks for ("newData.isNumber()", "<= 120") was still
      // sitting right there in the string, so both printed "ok". It reproduced on 7 of the
      // 8 fields — every one except created, which already used exact equality and did not
      // fall for it. The only check strong enough against an appended "|| true" is exact
      // equality against the whole expected expression, so every field now gets it, the
      // same technique $eventId's rule above already uses. These expected strings are
      // written out from the plan's field table (§6.1) independently of
      // firebase-rules.json, so the check and the file are two separate statements of the
      // same requirement rather than one compared with itself.
      const EXPECTED_FIELD_RULE = {
        date:     "newData.isString() && newData.val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)",
        title:    "newData.isString() && newData.val().length > 0 && newData.val().length <= 120",
        place:    "newData.isString() && newData.val().length <= 120",
        time:     "newData.isString() && newData.val().length <= 60",
        body:     "newData.isString() && newData.val().length <= 600",
        ctaLabel: "newData.isString() && newData.val().length <= 40",
        ctaText:  "newData.isString() && newData.val().length <= 300",
        created:  "newData.isNumber()",
      };

      for (const [f, expected] of Object.entries(EXPECTED_FIELD_RULE)) {
        if (!item[f]) {
          fail(`nuika/events.${f} is missing entirely — the plan's field table (§6.1) requires a typed rule for it`);
        } else if (typeof item[f]['.validate'] === 'string' && normalize(item[f]['.validate']) === normalize(expected)) {
          pass(`nuika/events.${f} is typed correctly`);
        } else {
          fail(`nuika/events.${f}'s .validate must read exactly ${expected} — got ${JSON.stringify(item[f]['.validate'])}`);
        }
      }
    }
  }

  // Nothing in this plan may loosen a node that already holds real data. Same fix as
  // .write above and for the same reason: .includes("root.child('nuika/admins')") still
  // finds that substring in "...val() === true || true", so appending " || true" to
  // orders's .read — making every customer's name, phone number and address
  // world-readable — used to print "ok nuika/orders is still admin-read only" regardless.
  for (const node of ['orders', 'kitchen', 'finance']) {
    const n = rules?.rules?.nuika?.[node];
    if (n && typeof n['.read'] === 'string' && normalize(n['.read']) === normalize(ADMIN_ONLY_RULE)) {
      pass(`nuika/${node} is still admin-read only`);
    } else {
      fail(`nuika/${node} is no longer admin-read only — customer data would be public (its .read must read exactly ${ADMIN_ONLY_RULE}, got ${JSON.stringify(n && n['.read'])})`);
    }
  }

  console.log('Referenced assets:');
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  for (const icon of manifest.icons || []) {
    const p = join(ROOT, icon.src);
    if (!existsSync(p)) { fail(`manifest icon missing on disk: ${icon.src}`); continue; }
    // The original install bug was a 2400x1400 logo declared as 192x192.
    // Read the real dimensions out of the PNG header rather than trusting it.
    const buf = readFileSync(p);
    if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') { fail(`${icon.src} is not a PNG`); continue; }
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    const [dw, dh] = (icon.sizes || '').split('x').map(Number);
    if (w === dw && h === dh) pass(`manifest icon ${icon.src} really is ${w}x${h}`);
    else fail(`${icon.src} is ${w}x${h} but the manifest declares ${icon.sizes} — Android will refuse to build a proper app icon`);
  }

  // Local images referenced from the page must actually be committed.
  const refs = new Set([...html.matchAll(/(?:src|href)="((?!https?:|data:|#|mailto:)[^"]+\.(?:png|jpe?g|svg|webp))"/g)]
    .map(m => m[1]));
  for (const ref of refs) {
    if (existsSync(join(ROOT, ref))) pass(ref);
    else fail(`referenced but not committed: ${ref}`);
  }
}

if (want('design')) {
  console.log('Design system assets:');

  // The supplied logo is 2400x1400 but the drawing occupies only 1915x703 —
  // 60% of the file's area is empty margin. A browser measures the file, not
  // the drawing, which is why the logo came out tiny everywhere it was used.
  // The cropped copy is what the site ships.
  const png = rel => {
    const p = join(ROOT, rel);
    if (!existsSync(p)) return null;
    const buf = readFileSync(p);
    if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return 'not-png';
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  };

  const logo = png('images/logo.png');
  if (!logo) fail('images/logo.png is missing — the cropped wordmark the site ships');
  else if (logo === 'not-png') fail('images/logo.png is not a PNG');
  else if (logo.w === 1915 && logo.h === 703) pass('images/logo.png is the cropped 1915x703 wordmark');
  else fail(`images/logo.png is ${logo.w}x${logo.h} — expected 1915x703 (margins not cropped?)`);

  const umbel = png('images/umbel.png');
  if (!umbel) fail('images/umbel.png is missing — the mark used below 130px');
  else if (umbel === 'not-png') fail('images/umbel.png is not a PNG');
  else if (umbel.w === 348 && umbel.h === 701) pass('images/umbel.png is the 348x701 flower and stem');
  else fail(`images/umbel.png is ${umbel.w}x${umbel.h} — expected 348x701 (wrong crop? it must not carry a letter)`);

  console.log('Design tokens:');
  if (!existsSync(join(ROOT, 'site.css'))) {
    fail('site.css is missing');
  } else {
    const css = readFileSync(join(ROOT, 'site.css'), 'utf8');
    const token = name => {
      const m = css.match(new RegExp('--' + name + '\\s*:\\s*(#[0-9A-Fa-f]{6})'));
      return m ? m[1].toUpperCase() : null;
    };

    // These are not preferences. --terra is sampled from the pixels of Noy's
    // logo; every other value was chosen so the pairs below clear their
    // threshold. A shade's difference is what drops a button under the line.
    const REQUIRED = {
      wheat: '#EFE6D6', ink: '#3B2A24', cream: '#F6F0E4', muted: '#6B655C',
      terra: '#B84830', 'terra-deep': '#AE472C',
      butter: '#F0E2BA', sage: '#C3C8AE', crust: '#B8935E',
    };
    for (const [name, expected] of Object.entries(REQUIRED)) {
      const got = token(name);
      if (got === expected) pass(`--${name} is ${expected}`);
      else fail(`--${name} is ${got || 'missing'} — expected ${expected}`);
    }

    // Assert the ratios rather than trusting the values, so a later "small
    // tweak" to a colour fails here instead of on a customer's phone in sun.
    const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = hex => {
      const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16)));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };

    const PAIRS = [
      ['ink',        'wheat',  4.5, 'body text on the page ground'],
      ['muted',      'wheat',  4.5, 'secondary text on the page ground'],
      ['cream',      'terra',  4.5, 'the label on the primary button'],
      ['terra-deep', 'wheat',  4.5, 'a link inside a paragraph'],
      ['cream',      'ink',    4.5, 'the footer and the dark button'],
      ['ink',        'butter', 4.5, 'dates and labels'],
      ['ink',        'sage',   4.5, 'the active filter'],
    ];
    for (const [fg, bg, min, why] of PAIRS) {
      const a = token(fg), b = token(bg);
      if (!a || !b) { fail(`cannot measure ${fg} on ${bg} — a token is missing`); continue; }
      const r = ratio(a, b);
      if (r >= min) pass(`${why}: ${r.toFixed(2)} (needs ${min})`);
      else fail(`${why}: ${r.toFixed(2)} is below ${min} — ${fg} on ${bg}`);
    }

    // --crust measures 2.30 as text on --wheat. It is a surface, never a letter.
    // Anchored so a bare `color:` trips it but `background-color:` and
    // `border-color:` — its intended uses — do not: unanchored, the text
    // "color: var(--crust)" is a substring of both, so the old pattern fired
    // on the intended uses too.
    if (/(?<![\w-])color\s*:\s*var\(\s*--crust\s*\)/.test(css))
      fail('--crust is used as a text colour; it measures 2.30 on --wheat and vanishes');
    else pass('--crust is never used as a text colour');

    console.log('Typography and RTL:');
    for (const t of ['font-display', 'font-text', 't-giant', 't-page', 't-sub', 't-body', 't-small', 't-label']) {
      if (new RegExp('--' + t + '\\s*:').test(css)) pass(`--${t} is defined`);
      else fail(`--${t} is missing`);
    }

    // The English flip has to happen by itself. One physical left/right is
    // enough to strand a margin on the wrong side and force a second copy of
    // the stylesheet to maintain. A genuine exception marks itself /* rtl-ok */.
    const physical = /\b(?:margin|padding|border)-(?:left|right)\b|\btext-align\s*:\s*(?:left|right)\b/;
    const offenders = css.split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => physical.test(line) && !line.includes('rtl-ok'))
      .map(({ n }) => n);
    if (offenders.length === 0) pass('no physical left/right — the English flip works by itself');
    else fail(`site.css uses physical left/right on line(s) ${offenders.join(', ')} — use the -inline- form, or mark the line /* rtl-ok */`);

    // A Latin run inside Hebrew reverses without this. "@nuika_bread" became
    // "nuika_bread@" in a mockup, in exactly this way.
    if (/unicode-bidi\s*:\s*isolate/.test(css)) pass('.ltr isolates Latin runs inside Hebrew');
    else fail('no unicode-bidi:isolate rule — Latin runs inside Hebrew will reverse');

    console.log('Components and motion:');
    for (const cls of ['.btn', '.btn--primary', '.btn--outline', '.btn--on-film', '.btn--ghost', '.link',
                       '.rise', '.fade', '.reveal']) {
      if (css.includes(cls + ' ') || css.includes(cls + ',') || css.includes(cls + '{') || css.includes(cls + ':'))
        pass(`${cls} is defined`);
      else fail(`${cls} is missing`);
    }

    // Without a visible focus ring, anyone navigating by keyboard cannot tell
    // where they are. It is not decoration. Scoped to the declarations actually
    // inside a :focus-visible rule, and requiring a real width and colour on
    // `outline` — checking for :focus-visible and outline-offset independently
    // used to stay green even after both `outline: 2px solid …` declarations
    // were replaced with `outline: none`.
    const focusBlocks = [...css.matchAll(/:focus-visible[^{]*\{([^}]*)\}/g)].map(m => m[1]).join('\n');
    const hasFocusOffset = /outline-offset\s*:\s*\d/.test(focusBlocks);
    const hasFocusOutline = /outline\s*:\s*\d+(?:\.\d+)?(?:px|em|rem)\s+\S+\s+\S+/.test(focusBlocks);
    if (focusBlocks && hasFocusOffset && hasFocusOutline)
      pass('a keyboard focus ring is defined with a real width and colour');
    else fail('no :focus-visible rule declares both a real outline (width + colour, not "none") and outline-offset — keyboard users lose their place');

    // Reduced motion must render the FINAL state, not a faster animation. Four
    // independent assertions: deleting the whole
    // `.rise, .fade, .reveal, [dir="ltr"] .reveal { opacity: 1; … }` rule used
    // to leave this check green, and so did deleting only the `[dir="ltr"]`
    // selector from it — the exact regression this branch found in a browser
    // and fixed, which is why it gets its own line here.
    const rm = css.match(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{([\s\S]*?)\n\}/);
    if (!rm) {
      fail('no prefers-reduced-motion block');
    } else {
      const block = rm[1];
      if (/animation\s*:\s*none/.test(block) && /transition\s*:\s*none/.test(block))
        pass('reduced motion switches animation and transition off, not shortens them');
      else fail('the prefers-reduced-motion block must set animation:none and transition:none');

      if (/opacity\s*:\s*1/.test(block))
        pass('reduced motion sets opacity:1 — .rise and .fade land visible, not stuck at 0');
      else fail('the prefers-reduced-motion block never sets opacity:1 — .rise and .fade would stay invisible forever with motion off');

      if (/clip-path\s*:\s*none/.test(block))
        pass('reduced motion sets clip-path:none — .reveal lands fully uncovered');
      else fail('the prefers-reduced-motion block never sets clip-path:none — .reveal would stay clipped shut forever with motion off');

      if (/\[dir=["']ltr["']\]/.test(block))
        pass('the reduced-motion final state also covers the [dir="ltr"] .reveal override');
      else fail('the prefers-reduced-motion block never mentions [dir="ltr"] — an English page would keep .reveal clipped shut even with motion off');
    }

    console.log('Header mark:');
    // After F1 the header's wordmark is a CSS mask (.nu-mark__art), not an
    // <img width="…">, so what used to be read out of site.js is checked here
    // instead. Anchored to a line start so it reads the base rule, never the
    // "on-film" override two-class selector further down that shares the name.
    const artRule = css.match(/^\.nu-mark__art\s*\{([^}]*)\}/m);
    if (!artRule) {
      fail('.nu-mark__art is not defined in site.css — the header would show no mark at all');
    } else {
      const artBody = artRule[1];
      if (/url\(\s*\.\/images\/logo\.png\s*\)/.test(artBody))
        pass('.nu-mark__art masks the cropped wordmark (images/logo.png)');
      else fail('.nu-mark__art does not mask images/logo.png — the header mark would be blank');

      // Below 130px wide the finest strokes of the umbel fade out.
      const artWidth = artBody.match(/width\s*:\s*(\d+)px/);
      if (!artWidth) fail('.nu-mark__art has no declared width — it renders at 0×0, invisible');
      else if (Number(artWidth[1]) < 130) fail(`.nu-mark__art is ${artWidth[1]}px wide — below its 130px floor, where the umbel's strokes vanish`);
      else pass(`.nu-mark__art is rendered at ${artWidth[1]}px, at or above its 130px floor`);
    }

    const mobile = css.match(/@media\s*\(\s*max-width:\s*720px\s*\)\s*\{([\s\S]*?)\n\}/);
    const mobileArt = mobile && mobile[1].match(/\.nu-mark__art\s*\{([^}]*)\}/);
    const mobileWidth = mobileArt && mobileArt[1].match(/width\s*:\s*(\d+)px/);
    if (!mobile) fail('no @media (max-width: 720px) block — cannot verify the mobile logo floor');
    else if (!mobileWidth) fail('the mobile block never sets a width for .nu-mark__art — it would fall back to the 160px desktop size, or worse, to nothing');
    else if (Number(mobileWidth[1]) < 130) fail(`the mobile override shrinks .nu-mark__art to ${mobileWidth[1]}px — below the 130px floor where the umbel's strokes vanish`);
    else pass(`the mobile override keeps .nu-mark__art at ${mobileWidth[1]}px, at or above its 130px floor`);

    console.log('Bilingual language toggle:');
    // Comments are prose and can say "html" or "display: revert" in passing —
    // the comment right above the real rules does exactly that. Strip comments
    // before pattern-matching, or a comment could satisfy a selector-shaped
    // regex by accident and let a real regression through silently.
    const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

    // The bug this guards against: [lang-content="en"] { display: none; }
    // alone is (0,1,0), the same specificity as .btn's own
    // display:inline-block, and the later rule in the file wins — a bilingual
    // .btn pair then shows both languages at once, permanently, on a Hebrew
    // page. The html prefix is what raises this to (0,2,1), which beats .btn.
    const enHideBodies = [...cssNoComments.matchAll(/\bhtml\b[^{}]*\[lang-content=["']en["']\][^{}]*\{([^}]*)\}/g)].map(m => m[1]);
    if (enHideBodies.some(b => /display\s*:\s*none/.test(b)))
      pass('an html-prefixed selector hides [lang-content="en"] — a bare attribute selector would tie with .btn and lose the cascade');
    else
      fail('no html-prefixed rule hides [lang-content="en"] with display:none — dropping the html prefix reintroduces the bug where a bilingual .btn shows both languages at once on a Hebrew page');

    // The other half of the toggle: hiding the Hebrew copy once the page is English.
    const heHideBodies = [...cssNoComments.matchAll(/html\[lang=["']en["']\][^{}]*\[lang-content=["']he["']\][^{}]*\{([^}]*)\}/g)].map(m => m[1]);
    if (heHideBodies.some(b => /display\s*:\s*none/.test(b)))
      pass('html[lang="en"] hides [lang-content="he"] — the Hebrew copy disappears once the page switches to English');
    else
      fail('no html[lang="en"] rule hides [lang-content="he"] with display:none — an English page would show the Hebrew copy alongside the English one');

    // Any rule that targets [lang-content=...] at all, regardless of which
    // language or how it is prefixed — !important and display:revert are
    // both banned everywhere in this mechanism, not just on the two rules above.
    const lcBodies = [...cssNoComments.matchAll(/\[lang-content=["'][a-z]+["']\][^{}]*\{([^}]*)\}/g)].map(m => m[1]);

    const noImportant = lcBodies.length > 0 && lcBodies.every(b => !/!important/.test(b));
    if (noImportant)
      pass('no lang-content rule carries !important — after Plan 5 this stylesheet shares a page with the shop\'s own, and !important here would outrank it');
    else
      fail(lcBodies.length === 0
        ? 'no lang-content rule exists in site.css — the bilingual hide mechanism is missing entirely'
        : 'a lang-content rule carries !important — it would outrank the shop\'s own display rules once this stylesheet shares a page with index.html');

    // display:revert rolls an element back past the author origin entirely —
    // on an English page a .btn would lose its inline-block and collapse to
    // plain inline. Only ever hide with display; a revealed element must keep
    // whatever display its own classes already give it.
    const noRevert = lcBodies.length > 0 && lcBodies.every(b => !/display\s*:\s*revert/.test(b));
    if (noRevert)
      pass('lang-content rules never use display:revert — a revealed element keeps its own class\'s display instead of being rolled back past the author origin');
    else
      fail(lcBodies.length === 0
        ? 'no lang-content rule exists in site.css — the bilingual hide mechanism is missing entirely'
        : 'a lang-content rule uses display:revert — on an English page a .btn would revert past its own inline-block rule and collapse to plain inline');
  }

  console.log('Shared chrome:');
  if (!existsSync(join(ROOT, 'site.js'))) {
    fail('site.js is missing');
  } else {
    const js = readFileSync(join(ROOT, 'site.js'), 'utf8');
    try { new Function(js); pass(`site.js parses (${js.split('\n').length} lines)`); }
    catch (err) { fail(`site.js syntax error: ${err.message}`); }

    for (const [needle, why] of [
      ['nuikaHeader',          'the header is built in one place'],
      ['nuikaFooter',          'the footer is built in one place'],
      ['data-nuika-header',    'pages mark where the header goes'],
      ['data-nuika-footer',    'pages mark where the footer goes'],
      ['nu-mark__art',         'the header renders the mask element the wordmark needs'],
      ['shop.html',            'the shop is reachable from every page'],
    ]) {
      if (js.includes(needle)) pass(why);
      else fail(`missing "${needle}" — ${why}`);
    }

    // The logo itself — the mask URL and the 130px floor, on both the base
    // rule and the mobile override — is asserted against site.css under
    // "Header mark" above. Since F1, site.js carries no width or image
    // reference at all; the mark is pure CSS.

    for (const [needle, why] of [
      ['LANG_KEY',              'the language key is defined once, not spelled out at each use'],
      ['nuikaLang(',            'the switch is a real function, not just markup that looks bilingual'],
      ['IntersectionObserver',  'movements are released when they reach the screen'],
      ['prefers-reduced-motion','reduced motion is honoured in script too, not only in CSS'],
      ['is-in',                 'the release class the stylesheet waits for'],
      ["'nuika-lang'",          'the stored key is exactly nuika-lang — renaming it silently drops every saved preference'],
    ]) {
      if (js.includes(needle)) pass(why);
      else fail(`missing "${needle}" — ${why}`);
    }

    // The flip must set dir on <html>, or the whole page stays right-to-left
    // while its words turn English.
    // Two separate facts, not one chained expression: the code reaches
    // documentElement, and something sets a "dir" attribute. Insisting the two
    // appear adjacent would fail on `var root = document.documentElement`
    // followed by `root.setAttribute('dir', ...)`, which is what site.js does.
    if (/documentElement/.test(js) && /setAttribute\(\s*['"]dir['"]/.test(js))
      pass('the language switch flips the document direction');
    else fail('the language switch never sets document direction — English would stay RTL');

    // nuikaRefresh is what a caller uses after injecting markup after load
    // (e.g. a Firebase-backed board in a later plan). Nothing else in this
    // file exercises dynamically-injected content, so deleting this function
    // leaves every other check green. Requiring both the declaration and the
    // window export — not just the bare word — matters: releaseMotion()'s own
    // doc-comment above mentions "nuikaRefresh()" in passing, so a plain
    // js.includes('nuikaRefresh') would stay green even after the real
    // function and its export were deleted.
    if (/function\s+nuikaRefresh\s*\(/.test(js) && /window\.nuikaRefresh\s*=/.test(js))
      pass('nuikaRefresh exists — content injected after load has a way to re-apply language and release motion');
    else
      fail('nuikaRefresh is missing — content injected after load would render in both languages at once and never release its motion classes');

    // The real number is already public on the live shop (index.html,
    // OWNER_WHATSAPP). A placeholder here is a dead contact link on the
    // bakery's own footer. Anchored to the actual wa.me link rather than a
    // bare digit string, so a mention in a comment (e.g. a TODO) could not
    // satisfy this while the real href stays a placeholder.
    if (js.includes('wa.me/972547382282'))
      pass('the real WhatsApp number is wired into the footer');
    else
      fail('site.js does not contain the real WhatsApp number 972547382282 — a placeholder here is a dead contact link on a bakery\'s own footer');

    // Written by hand twice already, in gallery.html and contact.html. A third
    // copy was the moment to stop. esc() is the function this project's worst
    // class of bug runs through; three private copies means three places for one
    // of them to drift.
    const sjs = readFileSync(join(ROOT, 'site.js'), 'utf8');
    for (const name of ['nuikaEsc', 'nuikaOnLangChange']) {
      if (new RegExp(`window\\.${name}\\s*=`).test(sjs)) pass(`site.js exports ${name}`);
      else fail(`site.js does not export ${name} — every page writes its own copy instead`);
    }

    // A listener that re-injects markup calls nuikaRefresh(), which calls
    // nuikaLang() again. If listeners fired on every nuikaLang() call rather
    // than on an actual change, that is an infinite loop — the page would hang
    // on its own refresh. The guard is a comparison against the previous value.
    // Named against the exact implementation below on purpose. A looser pattern
    // —   /!==\s*lang|lang\s*===/   — was tried first and could never fail:
    // site.js already contains `lang === 'en'` in the dir attribute line, so the
    // check passed with the guard deleted. Tie it to the thing it guards.
    const guarded = /var\s+wasLang\s*=\s*currentLang\s*\(\s*\)/.test(sjs) &&
                    /if\s*\(\s*lang\s*!==\s*wasLang\s*\)/.test(sjs);
    if (guarded) {
      pass('site.js fires language listeners on a change, not on every call');
    } else {
      fail('site.js must only fire language listeners when the language actually changed, or nuikaRefresh() inside a listener recurses forever');
    }

    // The point of exporting them is that the pages stop defining their own.
    for (const page of ['gallery.html', 'contact.html']) {
      const src = readFileSync(join(ROOT, page), 'utf8');
      if (/function\s+esc\s*\(/.test(src)) fail(`${page} still defines its own esc() — use window.nuikaEsc`);
      else pass(`${page} takes esc from site.js`);
    }
  }
}

if (want('pages')) {
  console.log('New pages:');

  // Every page of the new site shares one skeleton. These are not style
  // preferences: each line below is something that silently breaks the page
  // for somebody if it is missing. PAGES itself is declared once, at module
  // scope above (next to inlineScripts(), which the `--syntax` phase needs
  // it for too) rather than here, so `--pages` and `--syntax` cannot list
  // the four files differently after one of them is edited and not the other.

  for (const page of PAGES) {
    const p = join(ROOT, page);
    if (!existsSync(p)) { fail(`${page} is missing`); continue; }
    const h = readFileSync(p, 'utf8');
    const hCode = uncommented(h);
    const need = (re, why) => re.test(hCode) ? pass(`${page}: ${why}`) : fail(`${page}: ${why}`);

    need(/<html[^>]+lang="he"/, 'starts in Hebrew, so the CSS hides English before any script runs');
    need(/<html[^>]+dir="rtl"/, 'starts right-to-left');
    need(/<link[^>]+href="\.\/site\.css"/, 'loads the shared stylesheet');
    need(/<script[^>]+src="\.\/site\.js"/, 'loads the shared script');
    need(/data-nuika-header=/, 'declares where the shared header goes');
    need(/data-nuika-footer/, 'declares where the shared footer goes');
    need(/fonts\.googleapis\.com/, 'loads Bellefair and Plex, or the page silently falls back to Times New Roman');
    need(/<meta[^>]+viewport/, 'has a viewport, or a phone renders it at desktop width');
    need(/<title>/, 'has a title');
    need(/<meta[^>]+name="description"/, 'has a description for search results and link previews');

    // A page that writes its own colour has left the design system, and the
    // contrast guard no longer covers it.
    //
    // Deliberately still against the raw `h`, not `hCode`: nobody comments
    // out a colour declaration and leaves the hex value behind as an
    // explanatory note the way wa.me/esc()/nuikaRefresh actually happened —
    // there is no demonstrated failure here to fix, and it costs nothing to
    // leave this the simpler check it already is.
    const hex = [...h.matchAll(/(?:color|background)\s*:\s*(#[0-9A-Fa-f]{3,6})/g)].map(m => m[1]);
    if (hex.length) fail(`${page}: writes raw colours (${[...new Set(hex)].join(', ')}) instead of using the tokens`);
    else pass(`${page}: takes every colour from site.css`);

    // The same rule site.css lives under. The English flip has to work by
    // itself, in the page's own styles too.
    //
    // Also deliberately still against the raw `h`: the /* rtl-ok */ marker
    // this check looks for a few lines down is ITSELF a comment. Running
    // this against `hCode` would strip that marker along with everything
    // else, silently turning every intentional exception into a failure —
    // the escape hatch would stop working the moment anyone reached for it.
    // No page currently uses the marker (grep confirms), so this is a
    // latent trap rather than a live bug; worth naming and avoiding now
    // rather than after someone reaches for the escape hatch and it fails.
    //
    // The property forms (margin-left, padding-right, border-left,
    // text-align:left/right) are unambiguous wherever they appear, so they
    // are checked across the whole page. The bare `left:`/`right:`
    // positioning form, `float:`, and `background-position:` are NOT
    // unambiguous outside CSS — `const r = { left: rect.left, right:
    // rect.right };` is ordinary JavaScript (and exactly the shape a later
    // task's own browser-check code will contain), and the word "left" turns
    // up in ordinary prose too. So those three are only looked for inside
    // <style> blocks. `background-position` allows either keyword order
    // (`top left`, `left center`, `top 10px right 20px`), so that branch
    // looks for the word anywhere in the value, not right after the colon.
    // `(?<![\w-])` keeps the bare-property branch from being fooled by a
    // hyphen (it would otherwise re-match inside "border-left:", which the
    // first branch already covers on its own). `direction: ltr`, `[dir="ltr"]`
    // and `inset: 0` are all legitimate and contain neither "left" nor
    // "right" as a word, so none of the branches touch them.
    const styleLineRanges = [];
    {
      let openAt = null;
      h.split('\n').forEach((line, i) => {
        const n = i + 1;
        if (openAt === null && /<style[^>]*>/.test(line)) openAt = n;
        if (openAt !== null && /<\/style>/.test(line)) { styleLineRanges.push([openAt, n]); openAt = null; }
      });
    }
    const inStyle = n => styleLineRanges.some(([s, e]) => n >= s && n <= e);

    const propertyForm = /\b(?:margin|padding|border)-(?:left|right)\b|\btext-align\s*:\s*(?:left|right)\b/;
    const positioningForm = /(?<![\w-])(?:left|right)\s*:|\bfloat\s*:\s*(?:left|right)\b|\bbackground-position\s*:[^;{}]*\b(?:left|right)\b/;

    const bad = h.split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line, n }) => !line.includes('rtl-ok') && (propertyForm.test(line) || (inStyle(n) && positioningForm.test(line))))
      .map(({ n }) => n);
    if (bad.length) fail(`${page}: physical left/right on line(s) ${bad.join(', ')} — use the -inline- form or mark the line /* rtl-ok */`);
    else pass(`${page}: no physical left/right`);

    // Every check above and below reads `hCode` — this page with its
    // comments stripped — and uncommented() has no way to say "I could not
    // read this file". It returns a string either way. So this is that
    // channel, and it runs before anything that depends on it: if classify()
    // could not decide what a `/` in this page's inline JavaScript meant, or
    // lost track of where a string ends, then the comment stripping this
    // whole phase is built on is a guess, and every `ok` after it would be a
    // guess too. An analyser that cannot understand its input must never
    // report "ok" — that is the lesson of the six story.html checks that
    // could be defeated with an HTML comment while this file read markup as
    // if it were JavaScript (see uncommented()'s doc comment).
    const trouble = scriptTrouble(h);
    if (trouble.length) {
      const where = [...new Set(trouble.map(t => `line ${lineOf(h, t.index)}: ${t.reason}`))].join('; ');
      fail(`${page}: this checker cannot verify this file — its inline JavaScript does not classify unambiguously (${where}). Every check on this page reads comment-stripped source, so none of them can be trusted until that is resolved`);
    } else {
      pass(`${page}: every inline script classifies unambiguously, so the checks below are reading real code`);
    }

    // Same exposure the shop's admin panel was hardened against — a crafted
    // name, note or address running arbitrary JavaScript against a live
    // database handle. This used to be one check, written against
    // contact.html specifically (`ctNeed` under "Contact" below), which is
    // the one page of the four that never builds innerHTML at all: it reads
    // fields with .value and writes errors with .textContent, so that guard
    // could not have caught anything. gallery.html is the page that actually
    // builds innerHTML (from gallery.json, `grid.innerHTML = ...` and
    // `filterRow.innerHTML = ...`), and had no guard of its own — the
    // reviewer removed esc() from both call sites and the suite stayed
    // green. Checked here, inside the loop every one of the four pages
    // already runs through, rather than against one named page again, so
    // Plan 4 (which does the same thing from Firebase, on a page not yet
    // written) inherits the guard automatically instead of needing its own
    // copy remembered.
    const unsafe = unsafeHtmlWrites(hCode, h);
    if (unsafe.length) {
      fail(`${page}: ${unsafe.length} write(s) to innerHTML/outerHTML render data without esc() — ${unsafe.map(m => m[0].slice(0, 60).replace(/\s+/g, ' ')).join(' | ')}`);
    } else {
      pass(`${page}: every innerHTML/outerHTML write escapes what it renders`);
    }

    // site.js hides anything whose lang-content value is not exactly "he" or
    // "en" (html:not([lang="en"]) [lang-content="en"] and html[lang="en"]
    // [lang-content="he"], both under "Bilingual language toggle" in
    // --design above) — there is no third state. A typo here is not an
    // error anywhere else in the page: the CSS still matches something
    // (just never this element), the JS still runs, and the paragraph
    // simply renders as nothing, in every language, forever. Confirmed by
    // deliberately changing one real "en" to "eng": movement 4's whole
    // English paragraph disappeared and the rest of this suite stayed
    // green. Checked against hCode, the comment-stripped copy — not the raw
    // file this check read before: a comment demonstrating a different
    // lang-content value (exactly the shape a later task's own doc comment
    // writes) is real text to this regex, and used to fail the check over a
    // value nobody had actually shipped.
    const langValues = [...hCode.matchAll(/\blang-content\s*=\s*["']([^"']*)["']/g)].map(m => m[1]);
    const badLang = langValues.filter(v => v !== 'he' && v !== 'en');
    if (badLang.length)
      fail(`${page}: lang-content value(s) "${[...new Set(badLang)].join('", "')}" — must be exactly "he" or "en", or the paragraph silently vanishes in every language`);
    else
      pass(`${page}: all ${langValues.length} lang-content values are "he" or "en"`);
  }

  console.log('The home page and its film:');
  // Same reason as story.html, gallery.html and contact.html below: Plan 5
  // renames this exact file to index.html, so this one is not a hypothetical
  // future gap the way theirs were — it is the one file in this section
  // GUARANTEED to go missing on Plan 5's very first commit. readFileSync
  // unguarded would throw ENOENT and crash the whole process right at that
  // moment, taking every check after it down with it instead of reporting
  // its own clean FAIL. existsSync + an empty-string fallback keeps every
  // homeNeed(...) below a safe .test() against '' (which simply fails), so
  // this line reports the missing file and every line after it reports its
  // own FAIL too, instead of a crash hiding them all.
  const homePath = join(ROOT, 'home.html');
  if (!existsSync(homePath)) fail('home.html is missing');
  const home = existsSync(homePath) ? readFileSync(homePath, 'utf8') : '';
  const homeCode = uncommented(home);
  const homeNeed = (re, why) => re.test(homeCode) ? pass(why) : fail(why);

  // Presence is not enough. The failure that matters is the two <source>
  // elements swapping media conditions: both files are still named, both
  // filename checks still pass, and every phone downloads the wide cut and
  // sees a fifth of the picture — with 52 hand-chosen crop windows silently
  // thrown away. So check which source carries the condition, and that the
  // conditional one comes first, because the browser takes the first match.
  const phoneSrc = home.match(/<source[^>]*film-phone\.mp4[^>]*>/);
  const deskSrc  = home.match(/<source[^>]*film-desktop\.mp4[^>]*>/);

  if (!phoneSrc) fail('no <source> for the phone cut');
  else if (!/media\s*=\s*["'][^"']*max-width:\s*720px/.test(phoneSrc[0]))
    fail('the phone cut carries no max-width: 720px condition — every desktop would download the vertical re-edit, or no phone would get it');
  else pass('the phone cut is behind a max-width: 720px condition');

  if (!deskSrc) fail('no <source> for the desktop cut');
  else if (/media\s*=/.test(deskSrc[0]))
    fail('the desktop cut carries a media condition — if the two were swapped, phones get the wide cut and nothing says so');
  else pass('the desktop cut is the unconditional fallback');

  if (phoneSrc && deskSrc && home.indexOf(phoneSrc[0]) > home.indexOf(deskSrc[0]))
    fail('the desktop <source> comes first, so it matches before the phone one is considered');
  else pass('the conditional source comes first, as <source> order requires');

  homeNeed(/poster\s*=\s*["']\.\/media\/film-poster\.jpg["']/, 'a real poster file, not an empty poster attribute');
  homeNeed(/film-poster-phone\.jpg/,   'phones get the phone-shaped poster — under reduced motion or a refused autoplay, the poster IS the page');
  homeNeed(/\bmuted\b/,                'muted, or no browser will autoplay it');
  homeNeed(/\bplaysinline\b/,          'plays inline, or iOS takes it fullscreen on its own');
  homeNeed(/visibilitychange/,         'pauses when the tab is not being looked at, rather than burning a stranger\'s data in the background');
  homeNeed(/saveData/,                 'honours Save-Data');
  homeNeed(/prefers-reduced-motion/,   'honours reduced motion');

  // Counts, not just "does one exist": two play() calls exist (the initial
  // autoplay attempt and the resume-on-visible branch), and a bare existence
  // test is satisfied by either one alone, leaving the other free to throw on
  // a refused autoplay and take the rest of the script with it.
  const plays = (home.match(/\.play\(\)/g) || []).length;
  const guarded = (home.match(/\.play\(\)[\s\S]{0,140}?catch/g) || []).length;
  if (plays > 0 && plays === guarded) pass(`all ${plays} play() calls are guarded — iOS low power mode refuses autoplay outright`);
  else fail(`${plays - guarded} of ${plays} play() calls are unguarded — a refused autoplay throws and takes the rest of the script with it`);

  // sw.js precaches everything in ASSETS. The film is 24MB across two files;
  // precaching it fills a phone's storage quota and gets the whole cache
  // evicted — the shop with it. This check is about that list specifically.
  //
  // The separate question of the runtime cache-first branch storing the film
  // as it streams is a Plan 5 item, recorded in the spec. It is not this
  // check's job and this check does not claim to cover it.
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const assets = sw.match(/const ASSETS = \[([\s\S]*?)\]/);
  if (assets && /\.(?:mp4|webm|mov)\b/.test(assets[1]))
    fail('sw.js precaches a video — 24MB on every visitor\'s device, and the shop evicted from the cache when the quota runs out');
  else pass('sw.js precaches no video');

  console.log('The home page\'s words:');
  // Noy's own sentence, chosen in the design review. Not a placeholder.
  homeNeed(/אופה מה שאני הכי רוצה לאכול/, 'carries the line the design settled on');
  homeNeed(/I bake what I most want to eat/, 'and its English');
  homeNeed(/למאפייה של NUIKA/, 'the way into the shop');

  // Presence is not attachment. Swapping the two buttons' classes and hrefs
  // leaves every string in the file, so substring checks stay green while the
  // primary call to action becomes a transparent ghost pointing at the wrong
  // page. Check the element that actually carries each one.
  // Hardened per Task 3's ledger (two carried-in findings, both fixed here):
  // the match hardcoded double quotes, so href='./shop.html' false-failed;
  // and it required the href to be exactly "./shop.html", so a fragment or
  // query like "./shop.html#top" false-failed too. Both proven against a
  // real, temporarily-mutated home.html before this fix landed — see
  // task-4-report.md.
  const shopLink = home.match(/<a[^>]*href=["']\.\/shop\.html(?:[?#][^"']*)?["'][^>]*>/);
  if (!shopLink) fail('no link to shop.html');
  else if (!/btn--on-film/.test(shopLink[0]))
    fail('the shop link is not the cream on-film button — anything else is unreadable over a moving picture');
  else pass('the shop link is the cream on-film button');

  const contactLink = home.match(/<a[^>]*href=["']\.\/contact\.html(?:[?#][^"']*)?["'][^>]*>/);
  if (!contactLink) fail('no link to contact.html');
  else if (!/btn--ghost/.test(contactLink[0]))
    fail('the contact link is not the ghost button');
  else pass('the contact link is the ghost button');

  // These live in site.js's footer builder and nowhere else. Two copies drift,
  // which is the entire reason this page does not write its own — so require
  // them in site.js AND require home.html not to have grown a copy. An OR of
  // the two files passes happily while a stale duplicate sits on the page.
  const siteJs = readFileSync(join(ROOT, 'site.js'), 'utf8');
  const onlyInSiteJs = (re, what) => {
    if (!re.test(siteJs)) fail(`${what} is missing from site.js, where the footer builds it`);
    else if (re.test(home)) fail(`${what} also appears in home.html — a second copy that will drift from the footer's`);
    else pass(`${what} lives in site.js only`);
  };
  onlyInSiteJs(/instagram\.com\/nuika_bread/, 'the Instagram handle');
  onlyInSiteJs(/wa\.me\/972547382282/, 'the WhatsApp number');

  // The home page is the one screen with no scroll. A stray scroll container
  // turns it into a page that almost scrolls, which reads as broken. The
  // longhand forms (overflow-y in particular) are the more likely way a
  // stray scroll container actually shows up, and the original pattern
  // missed them entirely.
  if (/overflow(?:-[xy])?\s*:\s*(?:auto|scroll)/.test(home))
    fail('home.html declares a scrolling overflow — the home page is one screen');
  else pass('nothing on the home page scrolls');

  // Until Plan 5 renames things, nothing may link the new pages from the shop.
  // A customer who finds a half-built page has found a bug, not a preview.
  const shop = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const leaked = PAGES.filter(p => shop.includes(p));
  if (leaked.length) fail(`index.html links to ${leaked.join(', ')} — the new pages are not public yet`);
  else pass('the shop links to none of the new pages');

  console.log('The story:');
  // The brief's literal Step 1 code calls readFileSync unguarded, which
  // throws ENOENT and crashes the whole process before story.html exists —
  // the exact moment Step 2 asks you to run this and read a clean report.
  // A crash is worse than a fail: it skips the intended-to-be-red rest of
  // this section instead of showing it. existsSync + an empty-string
  // fallback keeps every storyNeed(...) below a real, safe .includes() call
  // that returns false on empty input, so this one line reports the missing
  // file and every line after it reports its own FAIL too — matching the
  // brief's own stated expectation verbatim: "FAIL story.html is missing
  // והשורות שאחריה" (and the lines after it).
  const storyPath = join(ROOT, 'story.html');
  if (!existsSync(storyPath)) fail('story.html is missing');
  const story = existsSync(storyPath) ? readFileSync(storyPath, 'utf8') : '';
  const storyCode = uncommented(story);
  const storyNeed = (s, why) => storyCode.includes(s) ? pass(why) : fail(why);

  // Noy wrote this about herself. It is quoted, not adapted — a paraphrase
  // here would be putting words in a real person's mouth on her own website.
  storyNeed('אני קודם כל בודקת מה אני בעצמי הכי הייתי רוצה לאכול', 'movement 1, in her words');
  storyNeed('אשכרה', 'movement 2 ends on her word');
  storyNeed('זאת מאפייה של אישה אחת', 'movement 3, in her words');
  storyNeed('הכל נגמר מהר. אז יאללה', 'movement 3 ends on her line');

  // The brief's own check here read 'לא מושחת'. Noy's actual sentence is
  // "...אם אתם מחפשים מושחת, זה לא המקום" — "מושחת" and "לא" are not
  // adjacent; that "לא" belongs to the next clause ("זה לא המקום"). Confirmed
  // by extracting movement 4's paragraph straight out of the brief and
  // running .includes() against it: the literal check string is not a
  // substring of Noy's own verbatim words, so it could never pass without
  // altering her sentence — which is the one thing this task forbids.
  // Narrowed to the one distinctive word actually in the text (confirmed
  // unique to movement 4, so this stays a real assertion, not a vacuous one).
  storyNeed('מושחת', 'movement 4, in her words');

  // Same failure mode, same method: the brief's check here read
  // 'רוב הקמחים מלאים', but the claim reads "...אשתמש ברוב של קמחים מלאים" —
  // "של", not the "ה" the check assumed, sits between "רוב" and "קמחים".
  // Narrowed to a substring that is actually present in her sentence.
  storyNeed('ברוב של קמחים מלאים', 'the first of the three claims');
  storyNeed('תמיד אמעיט בסוכר', 'the second');
  storyNeed('מתוק מדי', 'the third');
  storyNeed('shop.html', 'a way into the shop from the end of the story');

  const moves = (story.match(/class="[^"]*st-move/g) || []).length;
  if (moves === 4) pass('four movements, as the design settled');
  else fail(`the story has ${moves} movements, not 4`);

  console.log('The gallery:');
  // Same reason as story.html above: readFileSync unguarded would throw
  // ENOENT and crash the whole process before gallery.html exists, which is
  // exactly the moment this is first run. existsSync + an empty-string
  // fallback keeps every galNeed(...) below a safe .test() against '' (which
  // simply fails), so this line reports the missing file and every line
  // after it reports its own FAIL too, instead of a crash hiding them all.
  const galleryPath = join(ROOT, 'gallery.html');
  if (!existsSync(galleryPath)) fail('gallery.html is missing');
  const gal = existsSync(galleryPath) ? readFileSync(galleryPath, 'utf8') : '';
  const galCode = uncommented(gal);
  const galNeed = (re, why) => re.test(galCode) ? pass(why) : fail(why);

  // Anchored to an actual fetch() call, not just the bare substring
  // "gallery.json" — the page's own error-log string ("could not load
  // gallery.json") and a doc comment both contain that substring too, so the
  // unanchored version stayed green even after the real fetch() target was
  // changed to a different file. Found by deliberately breaking it: see
  // task-5-report.md.
  galNeed(/fetch\(\s*["'][^"']*gallery\.json["']/, 'reads the manifest instead of hardcoding the list');
  galNeed(/\.thumb\b|thumb\]/, 'the grid loads thumbnails — 24 full images is 2MB for a page of small squares');
  // `alt\s*=` with no left boundary and no requirement that a quote follows
  // stayed green after every real alt="..." and .alt property access in the
  // file was renamed away, because of an entirely unrelated local variable
  // this page happens to declare: `var alt = (entry.alt && ...)`. `\s*=`
  // matches its ` = ` just fine, and nothing anchored the other side. Adding
  // \b before "alt" and requiring a quote after "=" (real attribute syntax,
  // not a bare JS assignment) fixes both: found by deliberately breaking it,
  // see task-5-report.md.
  //
  // Still not the whole story: this only confirms the attribute SYNTAX is
  // present, which it always is — it is baked into the static template
  // string regardless of what value ends up inside the quotes. Hardcoding
  // `var alt = '';` instead of reading the manifest leaves `alt="` sitting
  // in the generated markup exactly as before, so this check alone stayed
  // green through that mutation too (see task-6-report.md). The second
  // check below closes that: it requires the manifest field to actually be
  // read, so the two together say the value is both read AND placed.
  galNeed(/\balt\s*=\s*["']|\.alt\b/, 'every image carries its alt text');
  galNeed(/entry\.alt\s*(?:&&|\[|\.)/, "each tile's alt comes from the manifest, not an empty string");
  // A bare substring, not a call — commenting out the real
  // `window.nuikaRefresh();` line left the word sitting in the surrounding
  // prose (this very doc-comment two lines up says "nuikaRefresh" too) and
  // the check stayed green while the guarantee it exists to protect — that
  // markup injected after load does not render both languages at once,
  // named twice in the brief as the gallery's central risk — was completely
  // gone (see task-6-report.md). Requiring the call syntax, against the
  // comment-stripped text, closes both holes at once.
  galNeed(/nuikaRefresh\s*\(\s*\)/, 'the grid calls nuikaRefresh() after injecting — without it every tile shows both languages at once');
  galNeed(/loading\s*=\s*["']lazy|loading:\s*["']lazy/, 'images below the fold load lazily');

  // Every frame in the gallery is 2.66:1, straight off the film. A tall tile
  // keeps about a third of that width — the same failure the phone cut of the
  // film was rebuilt to avoid.
  if (/aspect-ratio\s*:\s*[0-9.]+\s*\/\s*[0-9.]+/.test(gal)) {
    const ratios = [...gal.matchAll(/aspect-ratio\s*:\s*([0-9.]+)\s*\/\s*([0-9.]+)/g)]
      .map(m => +m[1] / +m[2]);
    const tall = ratios.filter(r => r < 0.9);
    if (tall.length) fail(`the grid has ${tall.length} tile shape(s) taller than wide — a 2.66:1 frame loses two thirds of its width in one`);
    else pass('no tile is taller than it is wide');
  } else pass('tile shapes are not declared as portrait aspect ratios');

  // Anchored to the lightbox's own opening tag (found by its id), not to
  // role="dialog" / aria-modal="true" appearing anywhere in the file — the
  // gallery.json and alt checks above were both found vacuous that same way,
  // so this one is written the way those two were fixed, not the way they
  // were first written. A comment mentioning "dialog", or the attributes
  // sitting on some other element, must not satisfy it.
  const lbTag = gal.match(/<[a-z]+\b[^>]*\bid=["']glLb["'][^>]*>/i);
  if (!lbTag) {
    fail('no element with id="glLb" — the enlarged view container is missing');
  } else {
    const hasDialogRole = /\brole\s*=\s*["']dialog["']/.test(lbTag[0]);
    const hasAriaModal = /\baria-modal\s*=\s*["']true["']/.test(lbTag[0]);
    if (hasDialogRole && hasAriaModal)
      pass('the enlarged view element itself carries role="dialog" and aria-modal="true"');
    else
      fail('the #glLb element is missing role="dialog" and/or aria-modal="true" on itself — a screen reader would not announce it as a modal dialog even if those strings appear elsewhere in the file');
  }

  console.log('Contact:');
  // Same reason as story.html and gallery.html above: readFileSync unguarded
  // would throw ENOENT and crash the whole process before contact.html
  // exists — exactly the moment Step 2 of the brief asks this to be run, to
  // confirm it fails. existsSync + an empty-string fallback keeps every
  // ctNeed(...) below a safe .test() against '' (which simply fails), so
  // this line reports the missing file and every line after it reports its
  // own FAIL too, instead of a crash hiding them all.
  const contactPath = join(ROOT, 'contact.html');
  if (!existsSync(contactPath)) fail('contact.html is missing');
  const ct = existsSync(contactPath) ? readFileSync(contactPath, 'utf8') : '';

  // Every check below runs against this comment-stripped copy, not the raw
  // file — the shared `uncommented()` defined at module scope, near PAGES.
  // Proven necessary, not theoretical: FOUR of the six checks here stayed
  // green while deliberately wrong — the real wa.me number, the real
  // Instagram handle, the real encodeURIComponent( call, and the real
  // unescaped-innerHTML guard — each time by keeping the WRONG behaviour in
  // the code and leaving the RIGHT word sitting only in a nearby comment,
  // in all three comment styles this file uses (HTML, //, and /* */ inside
  // <style>) (see task-6-report.md for all four, run one at a time and
  // reverted).
  const ctCode = uncommented(ct);
  const ctNeed = (re, why) => re.test(ctCode) ? pass(why) : fail(why);

  ctNeed(/wa\.me\/972547382282/, 'the real WhatsApp number');
  // Anchored to the real mechanism, not the bare word: encodeURIComponent(
  // called within 60 characters of the "text=" query parameter it is
  // supposed to encode, the same distance-anchoring style already used
  // elsewhere in this file rather than a bare substring.
  ctNeed(/text=[^;]{0,60}encodeURIComponent\s*\(/, 'the message is encoded, or a line break or an ampersand truncates it');
  ctNeed(/instagram\.com\/nuika_bread/, 'the Instagram handle');

  // The form composes a message and hands it to WhatsApp. It must not post
  // anywhere: there is no server, and a second copy of a customer's name and
  // phone number is a liability nobody asked for.
  //
  // The brief's own check here only scans the <form ...> tag itself. Proven
  // incomplete by deliberately adding formaction="https://evil.example/…" to
  // the submit BUTTON instead — the original check stayed green, because a
  // button's formaction overrides the form's own (here, absent) action at
  // submit time regardless of what the <form> tag carries (see
  // task-6-report.md). This page's own submit handler calls
  // e.preventDefault() before anything else and never depends on that for
  // safety, but the check should catch the attribute either way, so it is
  // extended rather than trusted as originally written.
  if (/<form[^>]+action=/.test(ctCode)) fail('the form has an action — it must not submit anywhere');
  else if (/\bformaction\s*=/.test(ctCode)) fail('a control carries formaction — it would submit the form there no matter what the <form> tag itself says');
  else pass('the form submits nowhere; it composes a WhatsApp message');
  // "Sends nothing" covers the network APIs a form like this could
  // plausibly reach for: fetch, XMLHttpRequest, sendBeacon (built for
  // exactly this fire-and-forget shape — a POST that doesn't wait for a
  // response is not obfuscation, it is the standard tool for it), and
  // `new Image()` used as a 1x1 tracking pixel (the classic pre-fetch-API
  // beacon: `(new Image()).src = 'https://…'`). Neither of the last two is
  // exotic; both were pointed out as ordinary alternatives this check
  // missed entirely (see task-6-report.md).
  //
  // What this does NOT, and cannot, cover: a runtime `form.action = someUrl`
  // assigned by code this static text scan never executes, or the same
  // fetch/XMLHttpRequest names reached through JS built specifically to
  // dodge a literal-text scan — bracket notation (`window['fetch'](...)`),
  // string concatenation, `eval`, a dynamic `import()`. Those are real,
  // accepted blind spots of reading source text rather than running it, not
  // a promise this check makes. Recorded honestly rather than silently
  // hoped not to matter.
  if (/fetch\s*\(|XMLHttpRequest|sendBeacon\s*\(|new\s+Image\s*\(/.test(ctCode))
    fail('contact.html sends a request somewhere');
  else pass('contact.html sends nothing');

  // The unescaped-innerHTML guard that used to live here, checking only
  // contact.html, now runs inside the shared per-page loop above (see the
  // comment there) — this is the one page of the four that never touches
  // innerHTML at all, so a guard scoped to only this file could not have
  // caught the regression it was meant for.

  // The form's own action/name exposure (finding 1) is a contact.html-only
  // risk — no other page composes a message from customer-entered fields —
  // so unlike the innerHTML guard above, this one stays local rather than
  // moving into the shared loop.
  const ctForm = ct.match(/<form\b[^>]*\bid=["']ctForm["'][^>]*>/);
  if (!ctForm) {
    fail('contact.html: no <form id="ctForm"> — cannot check it for a name attribute or an action');
  } else {
    if (/\baction\s*=/.test(ctForm[0]))
      fail('contact.html: #ctForm has gained an action — it must not submit anywhere');
    else
      pass('contact.html: #ctForm has no action');

    if (/\bonsubmit\s*=\s*["']return false["']/.test(ctForm[0]))
      pass('contact.html: #ctForm still has onsubmit="return false" as a second layer against a native submit');
    else
      fail('contact.html: #ctForm lost onsubmit="return false" — a syntax error in the <script> below would once again fall through to a native GET submit');
  }

  // Every field inside the form, by id, so the message stays clear about
  // exactly what regained a name — except ctSubject's four radio inputs,
  // which legitimately keep name="ctSubject": it is what makes them a single
  // mutually-exclusive group at all (a radio with no name groups with
  // nothing), and the page's own script finds the checked one by that same
  // name. Their value is always one of four fixed words, never
  // customer-entered text, so it carries none of the exposure the fields
  // below do.
  const PII_FIELD_IDS = ['ctName', 'ctPhone', 'ctMessage'];
  for (const id of PII_FIELD_IDS) {
    const field = ct.match(new RegExp('<(?:input|textarea)\\b[^>]*\\bid=["\']' + id + '["\'][^>]*>'));
    if (!field) { fail(`contact.html: #${id} is missing`); continue; }
    if (/\bname\s*=/.test(field[0]))
      fail(`contact.html: #${id} has regained a name attribute — a native submit would put its value in the URL`);
    else
      pass(`contact.html: #${id} carries no name attribute`);
  }

  console.log('The events board:');
  {
    const evp = readFileSync(join(ROOT, 'events.html'), 'utf8');
    const evCode = uncommented(evp);
    const need = (re, why) => re.test(evCode) ? pass(why) : fail(why);

    need(/nuika\/events/, 'reads nuika/events');
    need(/firebase-database-compat\.js/, 'loads the database SDK, or the board is permanently empty');

    // A public page with a database handle that can write is one crafted
    // click away from being the shop's problem. It has no reason to.
    //
    // Scoped to a ref() chain. A bare /\.(push)\s*\(/ was tried first and
    // flagged `(a ? upcoming : past).push(x)` — pushing into a local array,
    // which this page does on every render.
    const writes = [...evCode.matchAll(/ref\s*\([^)]*\)\s*\.\s*(set|update|remove|push|transaction)\s*\(/g)];
    if (writes.length) fail(`events.html calls ref().${writes.map(m => m[1]).join(', ')} — a public page must only read`);
    else pass('events.html only reads; it never writes to the database');

    // The whole board is injected after mount() ran its one-time pass.
    need(/window\.nuikaRefresh\s*\(\s*\)/, 'calls nuikaRefresh() after injecting, or every card shows both languages at once');
    need(/window\.nuikaEsc|nuikaEsc/, 'escapes Noy\'s text with the shared esc');

    // The /* esc-ok: cardHTML escapes every field it renders */ marker above
    // up.innerHTML and pa.innerHTML is exactly that — a marker, never
    // verified by anything else in this file. cardHTML() is checked directly
    // instead of trusted.
    //
    // Fix round 1 (task-4-report.md) enumerated SINKS — `bits +=` and
    // `var <name> =` — plus a hardcoded field list, and reproduced the
    // regression it was written for (esc(ev.title) → ev.title). The reviewer
    // then got FOUR different shapes past that version, each with a clean
    // `All checks passed.`, and inverted it to an allowlist instead: every
    // appearance of `ev` inside cardHTML's body must be one of
    //   esc(ev.X)                     and  esc(<fn>(ev.X))
    //   encodeURIComponent(ev.X)      and  encodeURIComponent(ev.X || ev.Y)
    //   if (ev.X)                     — a presence guard; the value itself
    //                                    never reaches output from there
    // or it fails — closing "return statement", "let/const alias", "helper
    // function", and "new field" at once, because none of them are a bare
    // `ev.field` sitting inside one of those three shapes.
    //
    // Fix round 2 found that allowlist's own scanner — the thing standing
    // between "allowed" and "violation" — was itself defeated two more ways:
    //
    // 1. `maskStrings` (fix round 1) treated a backtick exactly like a quote,
    //    masking a template literal's ENTIRE span — including a `${...}`
    //    hole, which is CODE, not string text. `` `<h3>${ev.title}</h3>` ``
    //    passed clean: the hole's `ev.title` was masked away along with the
    //    literal text around it, so the final `\bev\b` scan never saw it at
    //    all. Confirmed live, not just in validate.mjs: served the page with
    //    a crafted title through this exact hole and got a real `<img>`
    //    element injected and `window.__xss` set. `${ev.subtitle}` passed
    //    too — the very door Task 5's field growth was supposed to be closed
    //    against was open again through one different kind of quote.
    //
    //    Two more shapes share the same root cause (a scanner that treats
    //    every quote character as an opaque, same-shaped span): a regex
    //    literal containing an apostrophe (`/don't/`) desyncs which
    //    characters are "inside a string" for everything after it, and a
    //    plain string containing `//` inside it can do the same once
    //    `uncommented()` (module scope, this file's comment stripper) has
    //    already run over the whole file once before this check ever sees
    //    `cardBody` — a space immediately before `//` is what that function
    //    treats as a real comment opening (see its own doc comment), and a
    //    string like '<a href=" // ">' carries exactly that shape.
    //
    //    classify() (module scope, shared with uncommented() — see its own
    //    doc comment there) replaces the quote-only mask with a real stack
    //    machine: `'`, `"`, and `` ` `` all open a string, but a backtick's
    //    `${` additionally opens a HOLE, which is code — tracked with its
    //    own brace depth so a nested object literal's `{`/`}` inside a hole
    //    is not mistaken for the hole's own closing `}`, and a further
    //    nested string or template inside a hole is handled by the same
    //    machine recursively (via the same stack). Only the characters
    //    genuinely inside string TEXT — never a hole — are masked.
    //
    //    A regex literal is where this stops trying to be clever: telling
    //    `/don't/` apart from a division sign is genuinely undecided without
    //    a real parser, and guessing wrong is exactly how the previous
    //    version got desynced. So classify() does not guess — ANY `/` it
    //    meets outside an already-open string sets `uncertain`, and this
    //    check FAILs outright rather than trust a scan it cannot vouch for.
    //    cardHTML contains no regex and no division today, so this costs
    //    nothing now; it exists so that if either is ever added, the check
    //    goes red and says so instead of quietly reporting "ok" over code it
    //    can no longer actually read. An analyser that cannot understand the
    //    code must never report "ok" — that is the whole lesson of this task.
    //
    // 2. `cardOpen` accepted ANY parameter name — `/function\s+cardHTML\s*
    //    \([^)]*\)\s*\{/` — so renaming the parameter to, say, `item` and
    //    rendering a genuinely unescaped `item.title` still printed
    //    `ok events.html: every reference to ev inside cardHTML() is
    //    escaped...`, because there was no longer any `ev` in the body at
    //    all for the scan to find — confident and wrong at once. Two fixes:
    //    the signature is now pinned to literally `(ev)`, with its own
    //    message naming the actual parameter when it is anything else — the
    //    body is never even reached once the signature does not match,
    //    verified both with every field left unescaped and with every field
    //    correctly escaped, identical FAIL either way; and the scan asserts
    //    it found at least one `ev` reference before trusting a clean
    //    result, for the narrower case a renamed-but-still-`(ev)` signature
    //    could not itself catch — zero references in a function that
    //    renders seven fields means this check stopped looking at what it
    //    thinks it is looking at, for whatever reason, and must say so
    //    rather than pass by default.
    //
    // Fix round 3 found two more problems, both inherited rather than
    // introduced by round 2, both the same class as everything above: a
    // scanner that cannot parse its own input reporting "ok" regardless.
    //
    // 3. The backslash bug described on classify()'s own doc comment (module
    //    scope, above uncommented()) applied here too: a title ending in an
    //    escaped backslash, `` `x\\` ``, made this check's own scanner treat
    //    the rest of cardHTML() as unterminated string text, hiding a
    //    genuinely unescaped field after it. Fixed by moving to classify(),
    //    which consumes forward past any `\` rather than looking backward at
    //    a possible closing quote — see its own doc comment for the measured
    //    incident. The identical bug in the simpler quote-tracker just below
    //    (extracting cardHTML()'s own body) is fixed the same way, in place,
    //    since that walk does not need holes or comments, only a correct
    //    idea of where a string ends.
    //
    // 4. uncommented() (module scope) used to decide a `//` opened a real
    //    comment by checking one preceding character — not by knowing
    //    whether it was actually inside a string. A crafted `'<a href=" // "
    //    >' + ev.title` never reached this check as a violation, because
    //    uncommented() had already truncated the statement at the `//`
    //    before this check's scanner ever ran. classify() (module scope) now
    //    backs uncommented() too, so a `//` inside a string is never mistaken
    //    for a comment regardless of what precedes it — see uncommented()'s
    //    own doc comment for the measured incident (gallery.html, not just
    //    this page).
    //
    // Fix round 4 found the one still standing, and it was the biggest:
    //
    // 5. Everything above ran against `evCode` — the whole HTML file with
    //    comments stripped — and the stripping itself ran classify(), a
    //    JAVASCRIPT walker, over that whole HTML file. Markup is not a
    //    program; see uncommented()'s doc comment (module scope) for the
    //    story.html measurement and the six checks it silently defeated.
    //    The fix there is the fix here: classify() is now only ever handed
    //    JavaScript. This check takes the inline <script> body that actually
    //    defines cardHTML, by its real offsets in the file, and works inside
    //    it — the signature match, the brace walk that finds the body, and
    //    the `ev` scan all read the same one classification of that one
    //    script. The brace walk no longer tracks quotes by hand at all: it
    //    simply ignores every position classify() did not tag as code, which
    //    is why a regex literal in the body (`/don't/`) can no longer desync
    //    it the way a hand-rolled quote tracker did.
    //
    // The parameter declaration itself (`function cardHTML(ev)`) is outside
    // `cardBody` already, since the slice below starts after the opening `{`.
    const evInfo = classifyHtml(evp);
    const evScript = evInfo.scripts.find(r => /function\s+cardHTML\s*\(/.test(evp.slice(r.start, r.end)));
    if (!evScript) {
      fail('events.html: no inline <script> defines cardHTML(...) — cannot verify it escapes what it renders');
    } else if (evScript.uncertain) {
      fail(`events.html: the <script> that defines cardHTML() does not classify unambiguously (${[...new Set(evScript.trouble.map(t => `line ${lineOf(evp, t.index)}: ${t.reason}`))].join('; ')}) — this check will not vouch for a scan of code it cannot read`);
    } else {
    const evJsTags = evInfo.tags.slice(evScript.start, evScript.end);
    const evJs = maskTags(evp.slice(evScript.start, evScript.end), evJsTags, t => t === 'm');
    const cardOpen = evJs.match(/function\s+cardHTML\s*\(\s*ev\s*\)\s*\{/);
    if (!cardOpen) {
      const looseOpen = evJs.match(/function\s+cardHTML\s*\(([^)]*)\)\s*\{/);
      if (looseOpen) {
        fail(`events.html: cardHTML()'s parameter is "${looseOpen[1].trim()}", not ev — this check hunts for the literal name ev, and a renamed parameter would carry every real reference away from it while still reporting ok`);
      } else {
        fail('events.html: no function cardHTML(ev) — cannot verify it escapes what it renders');
      }
    } else {
      // Finds cardHTML()'s matching closing brace, by asking classify()
      // which positions are code rather than tracking quotes by hand. The
      // hand-rolled tracker this replaces treated a backtick as one opaque
      // span and had no idea a regex literal existed, so `/don't/` in the
      // body sent it hunting for a closing quote that was never opened; and
      // before fix round 3 its `\` lookbehind over-ran the walk to the end
      // of the file on `` `x\\` ``. A template literal's `${ }` hole is
      // tagged as code, so a `{`/`}` inside one is counted — correctly, they
      // are balanced — while the hole's own braces are not.
      const bodyStart = cardOpen.index + cardOpen[0].length;
      let cdepth = 1, ci = bodyStart;
      for (; ci < evJs.length && cdepth > 0; ci++) {
        if (evJsTags[ci] !== 'c') continue;
        if (evJs[ci] === '{') cdepth++;
        else if (evJs[ci] === '}') cdepth--;
      }

      if (cdepth > 0) {
        fail('events.html: cardHTML()\'s body never closes — this check ran off the end of the script looking for its matching brace, so it cannot vouch for anything inside it');
      } else {
        const bodyEnd = ci - 1;
        const cardBody = evJs.slice(bodyStart, bodyEnd);
        // Everything that is not code — string text, template text, regex
        // bodies, and any comment — is blanked, so the `ev` scan below only
        // ever sees real code. This is what stops the word "ev" inside the
        // CSS class name 'ev-card__date' from reading as the parameter.
        const maskedBody = maskTags(cardBody, evJsTags.slice(bodyStart, bodyEnd), t => t !== 'c');

        // [start, end) ranges within cardBody already accounted for by one
        // of the three allowed shapes. A `||` fallback is credited whether
        // its right-hand side is another ev.<field> (visible as text) or a
        // literal, which classify() has already masked to blank space —
        // either way the matched call is still exactly one of the three
        // allowed shapes and nothing else.
        const allowed = [];
        const markAt = (base, localIndex, text) => allowed.push([base + localIndex, base + localIndex + text.length]);
        const TAIL = `(?:\\s*\\|\\|\\s*(?:ev\\.\\w+)?)*\\s*\\)+`;
        const ESC_RE = new RegExp(`\\besc\\s*\\(\\s*(?:\\w+\\s*\\(\\s*)?ev\\.\\w+${TAIL}`, 'g');
        const ENC_RE = new RegExp(`\\bencodeURIComponent\\s*\\(\\s*ev\\.\\w+${TAIL}`, 'g');
        const IF_RE = /\bif\s*\(\s*ev\.\w+\s*\)/g;

        for (const m of maskedBody.matchAll(ESC_RE)) {
          for (const fm of m[0].matchAll(/ev\.\w+/g)) markAt(m.index, fm.index, fm[0]);
        }
        for (const m of maskedBody.matchAll(ENC_RE)) {
          for (const fm of m[0].matchAll(/ev\.\w+/g)) markAt(m.index, fm.index, fm[0]);
        }
        for (const m of maskedBody.matchAll(IF_RE)) {
          const fm = m[0].match(/ev\.\w+/);
          markAt(m.index, fm.index, fm[0]);
        }

        const isAllowed = (idx, len) => allowed.some(([s, e]) => idx >= s && idx + len <= e);

        const allRefs = [...maskedBody.matchAll(/\bev\b(?:\.\w+)?/g)];
        if (allRefs.length === 0) {
          fail('events.html: cardHTML() never references ev anywhere in its body — this check is not looking at what it thinks it is (a renamed parameter with every usage renamed to match, or a body that stopped touching its own data, would look identical to this)');
        } else {
          const violations = allRefs.filter(m => !isAllowed(m.index, m[0].length)).map(m => m[0]);
          if (violations.length) {
            fail(`events.html: cardHTML() uses ${[...new Set(violations)].join(', ')} outside esc()/encodeURIComponent()/if(...) — Noy's own event text (or any new field a later task adds) would reach every visitor's innerHTML unescaped`);
          } else {
            pass('events.html: every reference to ev inside cardHTML() is escaped, encoded, or a presence guard');
          }
        }
      }
    }
    }

    // "What is past" is decided against today's date. toISOString() is UTC,
    // and Israel is UTC+2/+3 — AHEAD of UTC, so UTC is always the same
    // calendar day as Israel or the day BEFORE it, never after. Measured
    // directly: Israel 21:00 → toISOString reads the same day; Israel 00:01
    // and again at 02:00 the next morning → toISOString still reads
    // YESTERDAY. So the real failure is a finished event still showing under
    // "מה קרוב" for two or three hours after local midnight, not one
    // dropping out early — that second failure is real, but it belongs to a
    // visitor at a NEGATIVE offset (e.g. New York), where UTC can already
    // read tomorrow while their own clock still says today, hiding an event
    // on the day it actually happens.
    if (/toISOString\s*\(\s*\)/.test(evCode)) {
      fail('events.html builds a date with toISOString() — that is UTC, and Israel runs ahead of it, so a finished event keeps showing as upcoming for two or three hours after local midnight');
    } else {
      pass('events.html compares dates in local time, not UTC');
    }

    need(/getFullYear\s*\(\s*\)/, 'builds today from local date parts');
    need(/id="evUpcoming"/, 'has a container for what is coming');
    need(/id="evPast"/, 'has a container for the archive');
    need(/id="evEmpty"/, 'has a designed empty state — a board with no events must say so, not render nothing');
    need(/wa\.me|whatsapp/i, 'offers WhatsApp from the empty state');
    need(/encodeURIComponent/, 'encodes the WhatsApp text, or a line break truncates the message');
    need(/data-nuika-header="events"/, 'marks itself current in the shared nav');

    // The shared header has linked here since Plan 1. Until this file existed
    // that link was a 404 from every page on the site.
    if (existsSync(join(ROOT, 'events.html'))) pass('the nav link to events.html finally resolves');
    else fail('every page links to ./events.html — it must exist');
  }
}

if (failed) {
  console.error('\nValidation failed. Do not deploy this commit.');
  process.exit(1);
}
console.log('\nAll checks passed.');
