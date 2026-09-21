# NUIKA Redesign — Plan 4: The Events Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** לתת לנוי לוח אירועים שהיא מעדכנת לבד מדף הניהול, ולהציג אותו בעמוד ציבורי `events.html` — בלי שאף אחד מהשינויים האלה יגע בזרימת ההזמנות.

**Architecture:** ענף חדש `nuika/events` ב-Firebase (קריאה ציבורית, כתיבה לנוי בלבד), לשונית ניהול חדשה בתוך החנות שכותבת אליו **לפי מפתח בודד**, ועמוד סטטי `events.html` שקורא אותו פעם אחת ומחלק לקרובים ולארכיון. `gallery.html` הוא מימוש הייחוס: משיכה → `esc()` → `innerHTML` → `window.nuikaRefresh()`.

**Tech Stack:** HTML/CSS/JS סטטיים, בלי שלב בנייה. Firebase Realtime Database 10.12.0 compat מה-CDN. `scripts/validate.mjs` הוא מערכת הבדיקות; אין `node_modules` ואין רץ בדיקות.

---

## Global Constraints

מתוך `docs/superpowers/specs/2026-09-20-nuika-redesign-design.md`. חלים על **כל** משימה:

- **`index.html` היא החנות החיה, עם הזמנות אמיתיות ונתוני לקוחות אמיתיים.** תוכנית 3 אסרה לגעת בה בכלל. תוכנית 4 **חייבת** לגעת בה, במשימה 5 בלבד, ורק בתוך לוח הניהול. כל שינוי שם נוגע בעסק פעיל.
- **`CNAME` לא נוגעים בו.** מחיקה או עריכה מבטלת את הדומיין המותאם ומורידה את החנות.
- **פרסום רק דרך `node scripts/ship.mjs "מה השתנה"`.** אף פעם לא `git push` ישיר.
- **`node scripts/validate.mjs` חייב להסתיים ב-`All checks passed.`** — `deploy.yml` מתנה בזה את העלייה לאתר החי, כך שקומיט שנכשל **עוצר את הפרסום של החנות**.
- **כתיבה לפי מפתח בודד בלבד:** `db.ref('nuika/events/' + id).set(ev)`. אף פעם לא `.set()` על `nuika/events` כולו. נוי עובדת מטלפון ומלפטופ, וה-SDK מתייג כתיבות לא-מקוונות — כתיבה ישנה שנוחתת מאוחר תמחק אירוע שהמכשיר השני הוסיף.
- **לכל כתיבה `.catch(fbError)`.** כתיבות נכשלו כאן בשקט בזמן שהממשק דיווח על הצלחה.
- **כל טקסט שנוי כותבת עובר `esc()`** לפני שהוא מגיע ל-`innerHTML` — גם בעמוד הציבורי וגם בלוח הניהול.
- **בלי seeding.** ענף ריק פירושו "אין אירועים", לא "ריצה ראשונה". לא ליצור ברירות מחדל, לא לגעת ב-`nuika/_seeded`.
- **אסור לשמור לפני שהמאזין ענה.** מערך מקומי ריק לפני התשובה הראשונה פירושו "עוד לא נטען", לא "נוי מחקה הכל".
- **ריווח כהתחלה/סוף בלבד** (`margin-inline-start`, `padding-block`, `inset-inline`). הבדיקה ב-`--pages` חוסמת `left`/`right` פיזי בכל עמוד חדש.
- **קידומת מחלקות `.ev-`** לכל מחלקה ב-`events.html`. מחלקה גנרית בת אות אחת כבר התנגשה בפועל בין שני עמודים ועיוותה עמוד שלם.
- **`window.nuikaRefresh()` חובה אחרי כל הזרקת HTML דו-לשוני.** בלעדיו כל מה שמוזרק אחרי הטעינה מוצג **בשתי השפות בו-זמנית**, ומחלקת תנועה עליו נשארת בלתי נראית לנצח.
- **נתיבים יחסיים בלבד** (`./`).
- **`prefers-reduced-motion` מקבל את המצב הסופי**, לא הנפשה מהירה יותר.
- **שלב השבירה המכוונת אינו טקס.** בתוכניות 1 ו-3 נכתבו **18 בדיקות ומעלה** שלא יכלו לירות לעולם, כולל בדיקות שנכתבו *כדי* לסגור תקלה שהן עצמן לא תפסו. **אף אחת מהן לא נתפסה בקריאה.** כל אחת נתפסה רק בשבירה מכוונת של מה שהיא אמורה לשמור עליו. שלב "לשבור בכוונה" בכל משימה כאן הוא חלק מהמשימה.

### מה שכבר קיים ואסור לשכפל

| מה | איפה | איך משתמשים |
|---|---|---|
| צבע, טיפוגרפיה, כפתורים, תנועה | `site.css` | אסימונים ומחלקות. עמוד לא מגדיר צבע משלו. |
| כותרת ותחתית | `site.js` | `<header class="nu-header" data-nuika-header="events">` ו-`<footer class="nu-footer" data-nuika-footer>` |
| מעבר עברית/אנגלית | `site.js` | `lang-content="he"` / `lang-content="en"` על כל טקסט |
| שחרור תנועות | `site.js` | המחלקות `.rise` `.fade` `.reveal` |
| בריחה ותגובה להחלפת שפה | `site.js` | `window.nuikaEsc` ו-`window.nuikaOnLangChange` — **נוצרים במשימה 2** |
| הרצף המלא של טעינה מאוחרת | `gallery.html:287–300` | משיכה → `esc()` → `innerHTML` → `window.nuikaRefresh()` |
| דיווח כשל כתיבה | `index.html:3235` | `fbError(err)` |
| הגדרות Firebase | `index.html:3163–3171` | `apiKey`, `databaseURL` וכו' — להעתיק מילה במילה |

**מפתח התפריט של העמוד הזה:** `events`. הכותרת המשותפת כבר מקשרת ל-`./events.html` מארבעת העמודים הקיימים, והקישור הזה **מחזיר 404 מאז תוכנית 1**. משימה 4 היא זו שסוגרת אותו.

---

## File Structure

| קובץ | אחריות |
|---|---|
| `scripts/validate.mjs` | **משתנה בכל משימה.** שלוש מלכודות בשומרים עצמם (משימה 1), בדיקת כללי Firebase (משימה 3), בדיקות `events.html` (משימה 4), בדיקות לשונית הניהול (משימה 5). |
| `site.js` | **משתנה במשימה 2.** מייצא `nuikaEsc` ו-`nuikaOnLangChange`. |
| `gallery.html`, `contact.html` | **משתנים במשימה 2.** מפסיקים להגדיר `esc()` משלהם. |
| `firebase-rules.json` | **משתנה במשימה 3.** ענף `events` חדש. שאר הענפים לא נגעים. |
| `events.html` | **נוצר במשימה 4.** הלוח הציבורי. קורא בלבד, לעולם לא כותב. |
| `index.html` | **משתנה במשימה 5, ורק שם.** לשונית ניהול חדשה. אפס שינוי בהזמנות, בתשלום, במלאי, במטבח ובכספים. |

**גבולות:** הפריסה של `events.html` חיה בתוך `events.html`, בתוך `<style>` עם קידומת `.ev-`. `site.css` לא גדל בתוכנית הזאת. לשונית הניהול חיה בתוך `index.html` לצד שאר הלשוניות, כי החנות היא קובץ אחד וזה הדפוס הקיים.

---

## Task 1: שלוש מלכודות בשומרים עצמם

המפרט מסמן שלוש בדיקות שיכשילו או יחמיצו את המשימות הבאות. כולן ב-`scripts/validate.mjs`, וכולן ממתינות לשינוי הראשון שתוכנית 4 עושה. מתקנים אותן לפני שכותבים שורת מוצר אחת.

**Files:**
- Modify: `scripts/validate.mjs`

**Interfaces:**
- Consumes: כלום.
- Produces: `inlineScripts(src)` שמסנן גם לפי `type`; בדיקת בריחה שעובדת **לפי אתר כתיבה** ולא לפי קובץ; בדיקת `lang-content` שרצה על טקסט בלי הערות.

---

- [ ] **Step 1: לראות את המלכודת הראשונה יורה**

`inlineScripts()` מסנן רק תגיות עם `src`. תגית `application/ld+json` — סימון מובנה לגוגל, דבר סביר מאוד למאפייה עם אירועים — תיבלע כאילו הייתה JavaScript ותפיל את כל הסוויטה בשגיאת תחביר על JSON תקין.

להוסיף זמנית ל-`gallery.html`, מיד לפני `</head>`:

```html
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Bakery","name":"NUIKA"}</script>
```

להריץ:

```bash
node scripts/validate.mjs --syntax
```

צפוי: `FAIL gallery.html inline script #1 syntax error` (או דומה), ויציאה בקוד 1. **זו הנקודה — בדיקת התחביר נופלת על קובץ תקין לגמרי.**

- [ ] **Step 2: לתקן את `inlineScripts()`**

ב-`scripts/validate.mjs`, בגוף `inlineScripts()`, להחליף את שורת ה-`.filter` היחידה בזו:

```js
    // A block is inline JavaScript only if it has no src AND its type says
    // JavaScript (or says nothing, which means JavaScript). Filtering on src
    // alone swallowed an application/ld+json block — structured data for
    // Google, an entirely reasonable thing for a bakery with events to have —
    // and failed the whole suite with a syntax error on valid JSON.
    .filter(m => !/\bsrc\s*=/.test(m[1]))
    .filter(m => {
      const type = m[1].match(/\btype\s*=\s*["']([^"']*)["']/);
      if (!type) return true;
      return /^(text\/javascript|application\/javascript|module)$/i.test(type[1].trim());
    })
```

- [ ] **Step 3: לוודא שהמלכודת נסגרה, ושהבדיקה עדיין עובדת**

```bash
node scripts/validate.mjs --syntax
```

צפוי: `All checks passed.` — בזמן שתגית ה-`ld+json` עדיין בקובץ.

עכשיו לוודא שהבדיקה לא הפכה לעיוורת. לשבור בכוונה **סקריפט אמיתי** ב-`gallery.html` — למשל להוסיף `var x = ;` בתוך בלוק ה-`<script>` הגדול — ולהריץ שוב. צפוי: `FAIL` עם שגיאת תחביר.

לבטל את שתי התוספות (תגית ה-`ld+json` והשורה השבורה). `git diff gallery.html` חייב לצאת ריק.

- [ ] **Step 4: לראות את המלכודת השנייה מחמיצה**

בדיקת ההברחה מחפשת את המחרוזת `esc(` **ברמת הקובץ**. לכן כתיבה חדשה ולא מוברחת, לצד כתיבות מוברחות קיימות, עוברת בשקט — וזו בדיוק הכתיבה שתוכנית 4 עומדת להוסיף.

למצוא את הבדיקה:

```bash
grep -n "esc(" scripts/validate.mjs | grep -i "innerHTML\|escape"
```

להוסיף זמנית ל-`gallery.html`, בתוך הסקריפט, שורה שמזריקה נתון לא מוברח:

```js
      grid.innerHTML = '<p>' + entries[0].alt.he + '</p>';
```

להריץ:

```bash
node scripts/validate.mjs --pages
```

צפוי היום: **עובר.** זו המלכודת — כתיבה לא מוברחת, בקובץ שכבר מכיל `esc(` במקום אחר, לא נראית בכלל.

לבטל את השורה הזמנית לפני שממשיכים. היא חוזרת בצעד 7 כשבירה מכוונת, אחרי שיש בדיקה שיכולה לתפוס אותה.

- [ ] **Step 5: לכתוב בדיקה שבודקת אתר כתיבה, לא קובץ**

שלושת העוזרים נכתבים ב-**scope של המודול**, ליד `inlineScripts()` ו-`PAGES` — משימה 5 משתמשת בהם משלב אחר, ו-CI מריץ כל שלב בנפרד. זו בדיוק הסיבה ש-`PAGES` כבר הועלה לשם, עם הערה שמסבירה את זה.

```js
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
// Hoisted to module scope, like PAGES above and for the same reason: the
// `features` phase uses these too, and CI runs each phase on its own.

// A `+` inside a string, a call, a bracket or a brace is not a join.
const htmlPieces = rhs => {
  const out = []; let depth = 0, cur = '', q = null;
  for (let i = 0; i < rhs.length; i++) {
    const c = rhs[i];
    if (q) { cur += c; if (c === q && rhs[i - 1] !== '\\') q = null; continue; }
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

// Every unescaped write to innerHTML/outerHTML in `code`. `raw` is the same
// file before comments were stripped, and is used only to read the
// /* esc-ok: */ markers back off it: uncommented() collapses a block comment
// to one space, and the lines it spanned with it, so a line number taken from
// the stripped text does not point at the same line in the file. The
// statement's own opening text is the anchor instead. Statements themselves
// come from the stripped text, so a write that appears only inside a comment
// is never considered at all.
function unsafeHtmlWrites(code, raw) {
  return [...code.matchAll(/\.(innerHTML|outerHTML)\s*\+?=\s*([^;]*);/g)].filter(m => {
    if (/\$\{/.test(m[2])) {
      // A template literal: the splitter cannot see its holes.
      if (htmlEscapes(m[2])) return false;
    } else {
      const risky = htmlPieces(m[2]).filter(p => !htmlLiteralOnly(p) && !htmlEscapes(p));
      if (!risky.length) return false;
    }
    const anchor = m[0].trim().slice(0, 40);
    const at = raw.indexOf(anchor);
    const before = at > 0 ? raw.slice(Math.max(0, at - 220), at) : '';
    return !/esc-ok:/.test(before);
  });
}
```

ובתוך לולאת `for (const page of PAGES)` בשלב `pages`, **במקום** בדיקת ההברחה הקיימת:

```js
    const unsafe = unsafeHtmlWrites(hCode, h);
    if (unsafe.length) {
      fail(`${page}: ${unsafe.length} write(s) to innerHTML/outerHTML render data without esc() — ${unsafe.map(m => m[0].slice(0, 60).replace(/\s+/g, ' ')).join(' | ')}`);
    } else {
      pass(`${page}: every innerHTML/outerHTML write escapes what it renders`);
    }
```

`hCode` הוא הגרסה בלי הערות של הקובץ ו-`h` הוא הגולמי; שניהם כבר קיימים בלולאה. אם השמות שונים — להשתמש בשמות הקיימים, לא להגדיר עותק שני.

- [ ] **Step 6: לסמן את שתי הכתיבות ב-`gallery.html` שמאצילות את ההברחה**

הבדיקה החדשה מסמנת מיד שתי כתיבות **תקינות** ב-`gallery.html` — `grid.innerHTML = entries.map(tileHTML).join('')` ו-`filterRow.innerHTML = html`. שתיהן מבריחות, אבל **בתוך הבונה**, לא בהשמה. זה בדיוק המקרה שהסמן קיים בשבילו, ולסמן אותו הופך את ההאצלה לדבר שסוקר רואה בדיף.

להוסיף מעל כל אחת מהשתיים, בשורה נפרדת:

```js
        /* esc-ok: tileHTML escapes every field it renders */
```

```js
        /* esc-ok: every value in `html` above went through esc() */
```

**אסור לסמן כתיבה כדי להשתיק את הבדיקה.** הסמן חייב לנקוב בפונקציה שמבריחה, וסוקר חייב יהיה לפתוח אותה ולראות שהיא באמת עושה את זה.

- [ ] **Step 7: לשבור בכוונה, שתים-עשרה פעמים**

כל אחת בנפרד, ואחריה `node scripts/validate.mjs --pages`:

| השבירה | צפוי |
|---|---|
| `grid.innerHTML = '<p>' + entries[0].alt.he + '</p>';` | **FAIL** |
| `grid.innerHTML += '<p>' + tag + '</p>';` | **FAIL** |
| ``el.outerHTML = `<p>${name}</p>`;`` | **FAIL** |
| ``el.outerHTML = `<p>${esc(name)}</p>`;`` | **עובר** |
| `box.innerHTML = rows.map(rowHTML).join('');` בלי סמן | **FAIL** — האצלה לא מתועדת |
| `box.innerHTML = html;` (משתנה עירום) | **FAIL** |
| `grid.innerHTML = '<p>אין תמונות</p>';` (מחרוזת בלבד) | **עובר** — אין מה להבריח |
| אותה כתיבה לא-מוברחת, אבל **בתוך הערה** | **עובר** — הערה אינה קוד |
| `b.innerHTML = '<a href="?t=' + encodeURIComponent(t) + '">x</a>';` | **עובר** |
| `b.innerHTML = '<b>' + esc(ev.date) + '</b>' + esc(ev.title);` | **עובר** — שני השדות |
| `b.innerHTML = '<b>' + esc(ev.date) + '</b>' + ev.title;` | **FAIL** — אחד מהשניים |
| להסיר סמן `esc-ok` מאחת משתי הכתיבות של הגלריה | **FAIL** |

השורה לפני האחרונה היא הסיבה שהבדיקה הזאת נכתבה מחדש. **הניסוח הקודם — "האם `esc(` מופיע איפשהו במשפט" — עבר אותה**, כי `esc(ev.date)` באותה שורה סיפק אותו, בזמן ש-`ev.title` הוא ההזרקה.

**אם אחת מ-12 התנהגה אחרת מהצפוי, הבדיקה שגויה ולא השבירה.** לתקן את הבדיקה ולהריץ את כל ה-12 שוב.

לבטל את כל השבירות. השינוי היחיד שנשאר ב-`gallery.html` הוא שני הסמנים מצעד 6.

- [ ] **Step 8: לסגור את המלכודת השלישית**

בדיקת ערכי `lang-content` קוראת את הקובץ הגולמי. הערה שמדגימה ערך אחר מפילה אותה — והמשימות הבאות יכתבו בדיוק הערה כזאת.

למצוא אותה:

```bash
grep -n "lang-content" scripts/validate.mjs
```

להחליף את המשתנה שהיא קוראת מ-`h` (הגולמי) ל-`hCode` (בלי הערות). לאמת:

להוסיף זמנית ל-`gallery.html` הערת HTML:

```html
  <!-- כל טקסט מקבל lang-content="fr" ... לא. הערכים היחידים הם he ו-en. -->
```

להריץ `node scripts/validate.mjs --pages`. צפוי: **עובר**.
עכשיו להוסיף `lang-content="fr"` על אלמנט **אמיתי**. צפוי: **FAIL**.
לבטל את שתי התוספות.

- [ ] **Step 9: הכל ירוק, וקומיט**

```bash
node scripts/validate.mjs
```

צפוי: `All checks passed.` ו-`git status --short` נקי חוץ מ-`scripts/validate.mjs`.

```bash
git add scripts/validate.mjs gallery.html
git commit -m "תיקון: שלוש מלכודות בשומרים עצמם, לפני שתוכנית 4 נופלת עליהן"
```

---

## Task 2: `esc` ו-`nuikaOnLangChange` עולים ל-`site.js`

המפרט: *"`esc()`, `currentLang()` ו'הרץ משהו אחרי שהשפה התחלפה' נכתבו ביד **פעמיים** כבר... לוח האירועים יכתוב אותם בפעם השלישית. להעלות אותם ל-`site.js` זול יותר עכשיו מאשר אחרי שיהיה עותק שלישי."*

**Files:**
- Modify: `site.js`, `gallery.html`, `contact.html`, `scripts/validate.mjs`

**Interfaces:**
- Consumes: כלום.
- Produces:
  - `window.nuikaEsc(s) → string` — מחליף `& < > " '` בישויות HTML.
  - `window.nuikaOnLangChange(fn)` — רושם `fn(lang)` שירוץ **רק כשהשפה באמת מתחלפת**, לא בכל קריאה ל-`nuikaLang()`.

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

ב-`scripts/validate.mjs`, בשלב `design`, בתוך הבלוק `console.log('Shared chrome:')`:

```js
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
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --design
```

צפוי: ארבעה `FAIL` — שני הייצואים, שומר ההחלפה, ושני העמודים — ויציאה בקוד 1.

- [ ] **Step 3: לייצא מ-`site.js`**

ב-`site.js`, אחרי `function currentLang()` ולפני `function nuikaLang()`:

```js
  /* Listeners for an actual language change. They fire from nuikaLang() only
     when the value moved, never on a same-language call — nuikaRefresh() calls
     nuikaLang(currentLang()) on purpose, and a listener that re-injects markup
     calls nuikaRefresh() in turn. Firing on every call would make that pair an
     infinite loop the first time anyone wired them together. */
  var langListeners = [];

  function nuikaOnLangChange(fn) {
    if (typeof fn === 'function') langListeners.push(fn);
  }
```

בתוך `nuikaLang(next)`, כשורה הראשונה בגוף:

```js
    var wasLang = currentLang();
```

ובסוף `nuikaLang()`, אחרי כתיבת ה-`localStorage`:

```js
    /* One listener that throws must not stop the others, and must not leave
       the page half-switched. */
    if (lang !== wasLang) {
      for (var j = 0; j < langListeners.length; j++) {
        try { langListeners[j](lang); }
        catch (e) { console.error('nuika: a language listener threw', e); }
      }
    }
```

ובשורות הייצוא בתחתית הקובץ, לצד הקיימות:

```js
  window.nuikaEsc = esc;
  window.nuikaOnLangChange = nuikaOnLangChange;
```

- [ ] **Step 4: להפסיק את העותקים ב-`gallery.html` וב-`contact.html`**

בשני הקבצים, להחליף את ההגדרה המקומית כולה — ההערה שמעליה נשארת, היא עדיין נכונה ומסבירה **למה** — בשורה אחת:

```js
      var esc = window.nuikaEsc;
```

`site.js` נטען בתגית `<script src>` בראש כל עמוד ורץ לפני הסקריפטים המוטבעים, אז `window.nuikaEsc` קיים ברגע ההשמה. **לא** להחליף את `currentLang()` המקומי — הוא שורה אחת, חסר תופעות לוואי, ו-`site.js` לא מייצא אותו; זה מחוץ לתחום המשימה.

- [ ] **Step 5: להריץ ולוודא שעוברת**

```bash
node scripts/validate.mjs
```

צפוי: `All checks passed.`

- [ ] **Step 6: לשבור בכוונה, חמש פעמים**

| השבירה | צפוי |
|---|---|
| למחוק את `window.nuikaEsc = esc;` מ-`site.js` | **FAIL** — "does not export nuikaEsc" |
| למחוק את `window.nuikaOnLangChange = ...` | **FAIL** |
| להחליף `if (lang !== wasLang) {` ב-`if (true) {` | **FAIL** — שומר ההחלפה |
| להחזיר `function esc(s) {` ל-`gallery.html` | **FAIL** |
| להחזיר `function esc(s) {` ל-`contact.html` | **FAIL** |

לבטל כל שבירה מיד אחרי שראית אותה יורה.

- [ ] **Step 7: לבדוק בדפדפן אמיתי שהלולאה האינסופית באמת נמנעת**

זו לא בדיקה שאפשר לכתוב ב-`validate.mjs` — צריך דפדפן.

לפתוח את `gallery.html`, ובקונסולה:

```js
window.nuikaOnLangChange(function (l) { console.log('lang ->', l); window.nuikaRefresh(); });
window.nuikaRefresh();   // חייב להדפיס כלום, ולחזור מיד
window.nuikaLang('en');  // חייב להדפיס פעם אחת: lang -> en
window.nuikaLang('en');  // חייב להדפיס כלום
window.nuikaLang('he');  // חייב להדפיס פעם אחת: lang -> he
```

אם הלשונית קופאת — השומר לא עובד. לתקן, ולהריץ את חמש השורות שוב.

- [ ] **Step 8: קומיט**

```bash
git add site.js gallery.html contact.html scripts/validate.mjs
git commit -m "esc ומאזין החלפת שפה עולים ל-site.js, לפני העותק השלישי"
```

---

## Task 3: `nuika/events` — הכללים

**Files:**
- Modify: `firebase-rules.json`, `scripts/validate.mjs`

**Interfaces:**
- Consumes: כלום.
- Produces: הצומת `nuika/events` — קריאה ציבורית, כתיבה לנוי בלבד, כל שדה מוגדר בטיפוס שלו, `$other` חסום.

**שדות האירוע** (מהמפרט §6.1). `date` ו-`title` חובה; השאר אופציונליים, והעמוד מדלג על מה שריק:

| שדה | טיפוס | מגבלה |
|---|---|---|
| `date` | מחרוזת | `YYYY-MM-DD` בדיוק |
| `title` | מחרוזת | 1–120 |
| `place` | מחרוזת | עד 120 |
| `time` | מחרוזת | עד 60, טקסט חופשי ("שישי 8:00–12:00") |
| `body` | מחרוזת | עד 600 |
| `ctaLabel` | מחרוזת | עד 40. ריק = בלי כפתור |
| `ctaText` | מחרוזת | עד 300 |
| `created` | מספר | חותמת זמן |

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

ב-`scripts/validate.mjs`, בשלב `assets`, בתוך `console.log('Deployment:')` ואחרי בדיקות `ship.mjs`:

```js
  // The rules are the only thing between a public database handle and Noy's
  // data. An untyped field under events is an HTML injection route straight
  // into the admin panel — the same shape the orders node was hardened
  // against. This checks the shape; Noy publishes the file by hand once.
  const rules = JSON.parse(readFileSync(join(ROOT, 'firebase-rules.json'), 'utf8'));
  const ev = rules?.rules?.nuika?.events;
  if (!ev) {
    fail('firebase-rules.json has no nuika/events — events.html would read PERMISSION_DENIED');
  } else {
    if (ev['.read'] === true) pass('nuika/events is publicly readable');
    else fail('nuika/events must be publicly readable — events.html reads it with no sign-in');

    if (typeof ev['.write'] === 'string' && ev['.write'].includes("root.child('nuika/admins')")) {
      pass('nuika/events is writable only by an admin');
    } else {
      fail('nuika/events must be writable only by an admin, the same way products and settings are');
    }

    const item = ev['$eventId'];
    if (!item) {
      fail('nuika/events has no $eventId rule — every field would be unvalidated');
    } else {
      if (item['$other'] && item['$other']['.validate'] === false) pass('nuika/events rejects unknown fields');
      else fail('nuika/events must carry "$other": { ".validate": false } — an unknown field is an injection route');

      if (typeof item['.validate'] === 'string' && /date/.test(item['.validate']) && /title/.test(item['.validate'])) {
        pass('an event must carry date and title');
      } else {
        fail('nuika/events/$eventId must require date and title — the page sorts on date and titles the card');
      }

      for (const f of ['date', 'title', 'place', 'time', 'body', 'ctaLabel', 'ctaText', 'created']) {
        if (item[f] && typeof item[f]['.validate'] === 'string') pass(`nuika/events.${f} is typed`);
        else fail(`nuika/events.${f} has no .validate — an untyped field reaches the admin panel's innerHTML`);
      }
    }
  }

  // Nothing in this plan may loosen a node that already holds real data.
  for (const node of ['orders', 'kitchen', 'finance']) {
    const n = rules?.rules?.nuika?.[node];
    if (n && typeof n['.read'] === 'string' && n['.read'].includes("root.child('nuika/admins')")) {
      pass(`nuika/${node} is still admin-read only`);
    } else {
      fail(`nuika/${node} is no longer admin-read only — customer data would be public`);
    }
  }
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --assets
```

צפוי: `FAIL firebase-rules.json has no nuika/events`, ויציאה בקוד 1. בדיקות `orders`/`kitchen`/`finance` צריכות **לעבור** כבר עכשיו — הן מגינות על מה שקיים.

- [ ] **Step 3: להוסיף את הענף**

ב-`firebase-rules.json`, בתוך `"nuika"`, בין `"settings"` ל-`"stockUsed"`:

```json
      "events": {
        "//": "Noy's events board. Public read — events.html shows it to anyone, with no sign-in. Admin write only. Every field is typed for the same reason orders are: Noy's own text lands in the admin panel through innerHTML, and an untyped field is an injection route into a page holding a live database handle.",
        ".read": true,
        ".write": "auth != null && root.child('nuika/admins').child(auth.uid).val() === true",

        "$eventId": {
          ".validate": "newData.hasChildren(['date','title'])",

          "date":     { ".validate": "newData.isString() && newData.val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)" },
          "title":    { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 120" },
          "place":    { ".validate": "newData.isString() && newData.val().length <= 120" },
          "time":     { ".validate": "newData.isString() && newData.val().length <= 60" },
          "body":     { ".validate": "newData.isString() && newData.val().length <= 600" },
          "ctaLabel": { ".validate": "newData.isString() && newData.val().length <= 40" },
          "ctaText":  { ".validate": "newData.isString() && newData.val().length <= 300" },
          "created":  { ".validate": "newData.isNumber()" },

          "$other":   { ".validate": false }
        }
      },
```

- [ ] **Step 4: להריץ ולוודא שעוברת**

```bash
node scripts/validate.mjs --assets
```

צפוי: כל בדיקות `nuika/events` ירוקות, ו-`orders`/`kitchen`/`finance` עדיין ירוקות.

- [ ] **Step 5: לשבור בכוונה, חמש פעמים**

| השבירה | צפוי |
|---|---|
| למחוק את בלוק `"events"` כולו | **FAIL** — "has no nuika/events" |
| `".read": true` → `".read": false` | **FAIL** |
| `".write"` → `true` | **FAIL** |
| למחוק את `"$other": { ".validate": false }` | **FAIL** |
| למחוק את `"body"` | **FAIL** — "nuika/events.body has no .validate" |

ובנוסף, ובמיוחד: `"orders"` → `".read": true`. צפוי **FAIL** — "customer data would be public". **הבדיקה הזאת היא היחידה שעומדת בין טעות עריכה בקובץ הזה לבין חשיפת שמות וטלפונים של לקוחות.** אם היא לא ירתה, היא שגויה ויש לתקן אותה לפני שממשיכים.

לבטל כל שבירה מיד.

- [ ] **Step 6: קומיט, והערה לשחר**

```bash
git add firebase-rules.json scripts/validate.mjs
git commit -m "nuika/events: קריאה ציבורית, כתיבה לנוי, כל שדה בטיפוס שלו"
```

**הקובץ לא מפרסם את עצמו.** בסיום המשימה לרשום בפלט:

> `firebase-rules.json` עודכן אבל **הכללים באוויר לא השתנו.** מישהו צריך להדביק את הקובץ פעם אחת ב-Firebase Console ← Realtime Database ← Rules ← Publish. עד שזה קורה, כתיבה מלשונית הניהול תיכשל ב-PERMISSION_DENIED, ו-`events.html` יראה את המצב הריק. שאר האתר לא מושפע.

---

## Task 4: `events.html` — הלוח הציבורי

**Files:**
- Create: `events.html`
- Modify: `scripts/validate.mjs`

**Interfaces:**
- Consumes: `site.css`, `site.js` (כולל `window.nuikaEsc` ו-`window.nuikaRefresh` ממשימה 2), `nuika/events` (ממשימה 3), Firebase 10.12.0 compat.
- Produces: עמוד ציבורי שקורא בלבד. **לעולם לא כותב.**

**מבנה** (מהמפרט §5.3): כל אירוע — תאריך, כותרת, מקום, שתיים-שלוש שורות, ופעולה אחת אופציונלית שפותחת וואטסאפ. מה שעבר יורד לבדו לארכיון **"היה"** לפי התאריך; נוי לא מוחקת כלום. כשאין אירוע קרוב — **מצב ריק מעוצב** שמציע להצטרף לוואטסאפ.

---

- [ ] **Step 1: לכתוב את הבדיקות שנכשלות**

א. ב-`scripts/validate.mjs`, להוסיף `'events.html'` לקבוע `PAGES` במקום שבו הוא מוגדר (מודול, שורה ~65). זה לבדו מפעיל על העמוד את כל בדיקות השלד: עברית, RTL, `site.css`, `site.js`, כותרת, תחתית, פונטים, viewport, `<title>`, `<meta description>`, בלי צבעים גולמיים, בלי `left`/`right` פיזי, והבדיקה החדשה ממשימה 1 על כל כתיבה ל-`innerHTML`.

ב. בסוף שלב `pages`, בלוק משלו:

```js
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

    // "What is past" is decided against today's date. toISOString() is UTC,
    // and Israel is UTC+2/+3 — an event would move to the archive at 21:00 or
    // 22:00 the evening BEFORE it happens, on the day people are looking it up.
    if (/toISOString\s*\(\s*\)/.test(evCode)) {
      fail('events.html builds a date with toISOString() — that is UTC, so an event drops into the archive hours before its day ends in Israel');
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
  }
```

ג. **הכותרת המשותפת מקשרת ל-`./events.html` מארבעת העמודים ומחזירה 404 מאז תוכנית 1.** להוסיף בדיקה, באותו בלוק:

```js
    // The shared header has linked here since Plan 1. Until this file existed
    // that link was a 404 from every page on the site.
    if (existsSync(join(ROOT, 'events.html'))) pass('the nav link to events.html finally resolves');
    else fail('every page links to ./events.html — it must exist');
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --pages
```

צפוי: `FAIL events.html is missing` מבדיקות השלד, וקריסה או `FAIL` בבלוק החדש. יציאה בקוד 1.

- [ ] **Step 3: לכתוב את `events.html`**

השלד — זהה במבנה לארבעת העמודים הקיימים, עם `data-nuika-header="events"`:

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>אירועים — NUIKA</title>
  <meta name="description" content="דוכנים, סדנאות והזמנות לחג אצל נואיקה. מה קרוב, ומה כבר היה.">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bellefair&family=IBM+Plex+Sans+Hebrew:wght@300;400&display=swap">
  <link rel="stylesheet" href="./site.css">
</head>
<body>
  <header class="nu-header" data-nuika-header="events"></header>

  <main class="ev-main">
    <h1 class="ev-title">
      <span lang-content="he">אירועים</span>
      <span lang-content="en">Events</span>
    </h1>

    <section id="evUpcoming" class="ev-list" aria-labelledby="evUpcomingH"></section>
    <section id="evEmpty" class="ev-empty" hidden></section>
    <section id="evPast" class="ev-list ev-list--past" aria-labelledby="evPastH" hidden></section>
  </main>

  <footer class="nu-footer" data-nuika-footer></footer>

  <script src="./site.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js"></script>
  <script>
  (function () {
    var esc = window.nuikaEsc;

    // The same config block index.html carries. Copied, not shared, and that
    // is a deliberate call rather than an oversight: the site has no build
    // step, index.html is one self-contained file by design, and a shared
    // firebase-config.js would be a third script tag on every page that
    // needs the database plus a load-order dependency on a page whose whole
    // job is to render fast. These are public client keys — the rules are
    // what protect the data, not the config. If a third page ever needs it,
    // that is the moment to extract it.
    //
    // Copy it out of index.html rather than from here, and check it matches.
    firebase.initializeApp({
      apiKey: "AIzaSyBH1KnxvJVBuMCkQ4vRjoBT0kfIn5ZEtqQ",
      authDomain: "nuika-5371f.firebaseapp.com",
      databaseURL: "https://nuika-5371f-default-rtdb.firebaseio.com",
      projectId: "nuika-5371f",
      storageBucket: "nuika-5371f.firebasestorage.app",
      messagingSenderId: "652173710332",
      appId: "1:652173710332:web:ab1d01485446fb2075d879"
    });

    // Read out of contact.html, not invented. An earlier draft of this plan
    // carried a made-up number, which would have sent a customer's message to
    // a stranger. Verify it against contact.html before trusting this line.
    var WHATSAPP = '972547382282';

    // Today as YYYY-MM-DD in the VISITOR'S timezone. Not toISOString(): that
    // is UTC, and from 21:00 or 22:00 Israel time it already reads tomorrow —
    // so an event would drop into the archive on the evening before the day
    // it actually happens, exactly when someone is checking whether to come.
    function todayKey() {
      var d = new Date();
      var m = String(d.getMonth() + 1);
      var day = String(d.getDate());
      return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
    }

    function dateLabel(iso) {
      var p = iso.split('-');
      return p[2] + '.' + p[1] + '.' + p[0];
    }

    function cardHTML(ev) {
      var bits = '';
      bits += '<p class="ev-card__date">' + esc(dateLabel(ev.date)) + '</p>';
      bits += '<h3 class="ev-card__title">' + esc(ev.title) + '</h3>';
      // Each line is skipped rather than rendered empty — Noy fills in what
      // she has, and an empty row reads like a mistake on her part.
      if (ev.time)  bits += '<p class="ev-card__meta">' + esc(ev.time) + '</p>';
      if (ev.place) bits += '<p class="ev-card__meta">' + esc(ev.place) + '</p>';
      if (ev.body)  bits += '<p class="ev-card__body">' + esc(ev.body) + '</p>';
      if (ev.ctaLabel) {
        var text = encodeURIComponent(ev.ctaText || ev.title);
        bits += '<a class="btn btn--primary ev-card__cta" target="_blank" rel="noopener"' +
                ' href="https://wa.me/' + WHATSAPP + '?text=' + text + '">' + esc(ev.ctaLabel) + '</a>';
      }
      return '<article class="ev-card rise">' + bits + '</article>';
    }

    function render(list) {
      var today = todayKey();
      var upcoming = [], past = [];
      for (var i = 0; i < list.length; i++) {
        (list[i].date >= today ? upcoming : past).push(list[i]);
      }
      upcoming.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      past.sort(function (a, b) { return a.date > b.date ? -1 : a.date < b.date ? 1 : 0; });

      var up = document.getElementById('evUpcoming');
      var pa = document.getElementById('evPast');
      var em = document.getElementById('evEmpty');

      /* esc-ok: cardHTML escapes every field it renders */
      up.innerHTML = upcoming.length
        ? '<h2 id="evUpcomingH" class="ev-h2"><span lang-content="he">מה קרוב</span>' +
          '<span lang-content="en">Coming up</span></h2>' + upcoming.map(cardHTML).join('')
        : '';
      up.hidden = !upcoming.length;

      /* esc-ok: cardHTML escapes every field it renders */
      pa.innerHTML = past.length
        ? '<h2 id="evPastH" class="ev-h2"><span lang-content="he">היה</span>' +
          '<span lang-content="en">Past</span></h2>' + past.map(cardHTML).join('')
        : '';
      pa.hidden = !past.length;

      em.innerHTML = upcoming.length ? '' :
        '<p class="ev-empty__line"><span lang-content="he">אין אירוע קרוב כרגע.</span>' +
        '<span lang-content="en">Nothing coming up right now.</span></p>' +
        '<p class="ev-empty__sub"><span lang-content="he">כשיהיה, זה יופיע כאן. אפשר גם פשוט לכתוב לי.</span>' +
        '<span lang-content="en">When there is, it shows up here. Or just write to me.</span></p>' +
        '<a class="btn btn--primary" target="_blank" rel="noopener" href="https://wa.me/' + WHATSAPP +
        '?text=' + encodeURIComponent('היי נוי, אשמח לשמוע על אירועים קרובים') + '">' +
        '<span lang-content="he">דברו איתי</span><span lang-content="en">Talk to me</span></a>';
      em.hidden = !!upcoming.length;

      // Everything above was injected after site.js already ran its one-time
      // pass in mount(). Without this every card shows Hebrew and English at
      // the same time, and .rise never releases.
      window.nuikaRefresh();
    }

    // once(), not on(): an events board does not change while someone reads
    // it, and a page that keeps a socket open is a page that keeps a socket
    // open. There is no seeding here of any kind — an empty node means Noy
    // has no events listed, which is a real and ordinary state.
    firebase.database().ref('nuika/events').once('value')
      .then(function (snap) {
        var val = snap.val() || {};
        var list = Object.keys(val).map(function (k) { return val[k]; })
                         .filter(function (e) { return e && e.date && e.title; });
        render(list);
      })
      .catch(function (err) {
        console.error('events: could not read nuika/events', err);
        render([]);   // the designed empty state, never a blank page
      });
  })();
  </script>
</body>
</html>
```

**שתי הכתיבות ל-`up.innerHTML` ו-`pa.innerHTML` נושאות סמן `esc-ok`** כי ההברחה קורית בתוך `cardHTML()`, לא בהשמה. בלי הסמן בדיקת ההברחה ממשימה 1 תסמן אותן, ובצדק — היא לא יכולה לדעת לבד ש-`cardHTML` מבריח.

**עיצוב.** להוסיף `<style>` עם קידומת `.ev-` בלבד. נקודת הפתיחה, להרחיב ממנה:

```css
    .ev-main       { max-width: 760px; margin-inline: auto; padding: 96px 20px 64px; }
    .ev-title      { font-family: Bellefair, serif; font-size: 44px; line-height: 1.1;
                     color: var(--ink); text-align: center; margin-block-end: 48px; }
    .ev-h2         { font-family: Bellefair, serif; font-size: 26px; line-height: 1.2;
                     color: var(--terra); margin-block: 40px 20px; }
    .ev-card       { border-block-end: 1px solid rgba(59,42,36,.14); padding-block: 24px; }
    .ev-card__date { font-family: 'IBM Plex Sans Hebrew', sans-serif; font-size: 11px;
                     letter-spacing: .3em; color: var(--muted); margin: 0 0 8px; }
    .ev-card__title{ font-family: Bellefair, serif; font-size: 26px; line-height: 1.2;
                     color: var(--ink); margin: 0 0 6px; }
    .ev-card__meta { font-size: 13px; line-height: 1.7; color: var(--muted); margin: 0; }
    .ev-card__body { font-size: 17px; line-height: 1.9; color: var(--ink); margin: 12px 0 0; }
    .ev-card__cta  { margin-block-start: 16px; }

    /* The archive is the same card, quieter. Not a new colour — every colour
       on this page is a token from site.css, and the contrast table there was
       measured. */
    .ev-list--past .ev-card { opacity: .62; }

    .ev-empty      { text-align: center; padding-block: 56px; }
    .ev-empty__line{ font-family: Bellefair, serif; font-size: 26px; color: var(--ink); margin: 0 0 8px; }
    .ev-empty__sub { font-size: 13px; line-height: 1.7; color: var(--muted); margin: 0 0 24px; }

    @media (max-width: 600px) {
      .ev-main    { padding: 72px 16px 48px; }
      .ev-title   { font-size: 34px; }
    }
```

`--crust` הוא **משטח ואף פעם לא אות** — הוא נמדד 2.30 כטקסט על רקע העמוד ונכשל. ריווח כהתחלה/סוף בלבד, בלי `left`/`right` פיזי.

- [ ] **Step 4: להריץ ולוודא שעוברת**

```bash
node scripts/validate.mjs
```

צפוי: `All checks passed.`

- [ ] **Step 5: לשבור בכוונה, שבע פעמים**

| השבירה | צפוי |
|---|---|
| למחוק את `window.nuikaRefresh()` מ-`render()` | **FAIL** |
| להחליף `esc(ev.title)` ב-`ev.title` | **FAIL** — בדיקת הכתיבה ממשימה 1 |
| להחליף את `todayKey()` ב-`new Date().toISOString().slice(0,10)` | **FAIL** — UTC |
| להוסיף `firebase.database().ref('nuika/events/x').set({})` לעמוד | **FAIL** — "a public page must only read" |
| למחוק את `id="evEmpty"` | **FAIL** |
| למחוק את תגית `firebase-database-compat.js` | **FAIL** |
| להוסיף `color: #B84830` ב-`<style>` | **FAIL** — צבע גולמי |

לבטל כל שבירה מיד אחרי שראית אותה יורה. אם אחת לא ירתה — הבדיקה שגויה, לתקן אותה ולהריץ את כל השבע שוב.

- [ ] **Step 6: לבדוק בדפדפן, בארבעה מצבים**

`node scripts/validate.mjs` לא טוען את העמוד. לפתוח אותו בדפדפן על שרת מקומי ולבדוק:

1. **ריק** — ענף `nuika/events` לא קיים עדיין. צפוי: המצב הריק המעוצב, כפתור וואטסאפ, בלי שגיאות בקונסולה, בלי אזורים ריקים.
2. **עם אירועים** — להוסיף ביד ב-Firebase Console שלושה אירועים: אחד בעתיד, אחד היום, ואחד בעבר. צפוי: שני הראשונים תחת "מה קרוב" (והיום **לא** בארכיון), השלישי תחת "היה", והמצב הריק מוסתר.
3. **אנגלית** — ללחוץ EN. צפוי: כל כרטיס מציג **שפה אחת בלבד**. אם מופיעות שתיהן — `nuikaRefresh()` לא נקרא.
4. **טלפון** — רוחב 375. צפוי: בלי גלילה אופקית, הכרטיסים נקראים, הכפתור נלחץ באצבע.

לצרף צילום מסך של מצב 2 ושל מצב 4.

- [ ] **Step 7: קומיט**

```bash
git add events.html scripts/validate.mjs
git commit -m "עמוד האירועים: מה קרוב, מה היה, ומצב ריק שאומר את זה"
```

---

## Task 5: לשונית האירועים בלוח הניהול

**זו המשימה היחידה בתוכנית שנוגעת ב-`index.html` — החנות החיה, עם הזמנות אמיתיות.**

לפני שמתחילים: `node scripts/status.mjs`. אם הוא אומר שיש משהו לא מסונכרן, **לעצור ולדווח**, לא לעקוף.

**Files:**
- Modify: `index.html`, `scripts/validate.mjs`

**Interfaces:**
- Consumes: `switchAdminTab(tab)`, `fbError(err)`, `esc()`, `db`, `ROOT` — כולם כבר ב-`index.html`.
- Produces: `initEvents()`, `renderEventsAdmin()`, `saveEvent()`, `deleteEvent(id)`, והדגל `_eventsLoaded`.

**מה לא נוגעים בו, בכלל:** זרימת ההזמנות, התשלום, המלאי, המטבח, הכספים, האימות, `getCartTotal()`, `esc()`, `kitchenReady()`, `_submitting`, וכל מה שתחת `nuika/products`, `nuika/orders`, `nuika/kitchen`, `nuika/finance`, `nuika/settings`, `nuika/stockUsed`, `nuika/_seeded`.

---

- [ ] **Step 1: לכתוב את הבדיקות שנכשלות**

ב-`scripts/validate.mjs`, בשלב `features`, אחרי הבדיקות הקיימות:

```js
  // The events tab lives inside the live shop. These are not style checks:
  // each line below is a way this project has already lost data once.
  const app = appScript();
  if (!app) {
    fail('index.html: could not find the application script');
  } else {
    const has = (re, why) => re.test(app) ? pass(`admin events: ${why}`) : fail(`admin events: ${why}`);

    has(/function\s+initEvents\s*\(/, 'has initEvents()');
    // ROOT is the const 'nuika', so the node is written as ROOT + '/events'
    // and the literal string "nuika/events" never appears in the script.
    has(/['"`]\/events\/?['"`]|['"`]nuika\/events/, 'addresses the events node');

    // db.ref('nuika/events').set(obj) replaces the whole subtree and destroys
    // whatever the other device changed in the same round-trip. Noy uses a
    // phone and a laptop, and the SDK queues offline writes, so a stale queued
    // write lands later and deletes an event the other device added. This is
    // the bug savePantry(), saveRecipes() and saveWeeklyPlan() still carry.
    //
    // The node is addressed as ROOT + '/events', never as the literal string
    // "nuika/events" — a regex that only matched the literal form would have
    // been unable to fire at all, which is the failure this project keeps
    // shipping. Both spellings are matched.
    if (/ref\s*\(\s*(?:ROOT\s*\+\s*)?['"`](?:nuika)?\/?events['"`]\s*\)\s*\.\s*(?:set|update)\s*\(/.test(app)) {
      fail('admin events: writes the whole events node — use per-key writes: ref(ROOT + "/events/" + id).set(ev)');
    } else {
      pass('admin events: writes one event at a time, never the whole node');
    }

    // Writes used to fail silently here while the UI reported success.
    const evWrites = [...app.matchAll(/ref\s*\([^)]*events\/[^)]*\)\s*\.\s*(set|remove|update)\s*\(([\s\S]{0,200}?)(?=\n\s*(?:function|\}|const|let|var|db\.ref)|$)/g)];
    const uncaught = evWrites.filter(m => !/\.catch\s*\(\s*fbError\s*\)/.test(m[0]));
    if (evWrites.length === 0) fail('admin events: found no write to nuika/events/<id> at all');
    else if (uncaught.length) fail(`admin events: ${uncaught.length} write(s) to nuika/events have no .catch(fbError) — they fail silently while the UI says saved`);
    else pass('admin events: every write catches its failure');

    // PANTRY, RECIPES and PRODUCTS are empty until Firebase answers. Saving in
    // that window wrote emptiness over real data and wiped the pantry on every
    // offline open. The events list is the same shape.
    has(/_eventsLoaded/, 'has a loaded flag, so a save before the listener answers cannot write emptiness');

    // An empty node means Noy has no events. It does NOT mean first run.
    if (/_seeded[\s\S]{0,200}events|events[\s\S]{0,200}_seeded/.test(app)) {
      fail('admin events: the events node must never be seeded — an empty tree means Noy listed none');
    } else {
      pass('admin events: never seeds the events node');
    }

    // The escaping check from Task 1 runs over the four static pages; the shop
    // is not in that list and putting it there is a separate piece of work
    // (see "what this plan does not do"). But the admin panel is the highest-
    // risk innerHTML in the project — it renders text a person typed on a page
    // holding an admin database handle — so the events functions get the same
    // test, scoped to themselves.
    const evBlock = app.slice(
      app.indexOf('// ─── ADMIN: EVENTS'),
      app.indexOf('// ─── ADMIN: EVENTS') > -1 ? app.indexOf('// ─── ADMIN: EVENTS') + 4000 : 0
    );
    const evHtmlWrites = [...evBlock.matchAll(/\.(innerHTML|outerHTML)\s*\+?=\s*([^;]*);/g)];
    const evUnsafe = unsafeHtmlWrites(evBlock, html);
    if (!evHtmlWrites.length) fail('admin events: found no innerHTML write in the events block — did the marker comment change?');
    else if (evUnsafe.length) fail(`admin events: ${evUnsafe.length} innerHTML write(s) render data without esc() — a crafted event title would run against the live database handle`);
    else pass('admin events: every innerHTML write escapes what it renders');
  }
```

ובבדיקות המבנה (לא בסקריפט):

```js
  for (const [re, why] of [
    [/id="atab-events"/,             'the admin has an events tab button'],
    [/id="admin-tab-events"/,        'the admin has an events tab panel'],
    [/switchAdminTab\('events'\)/,   'the events tab button switches to it'],
  ]) {
    if (re.test(html)) pass(`admin events: ${why}`);
    else fail(`admin events: ${why}`);
  }

  // Plan 5 is what links the new site from the shop. Until then a customer who
  // finds a half-built page has found a bug, not a preview.
  if (html.includes('events.html')) fail('index.html links to events.html — the new pages are not public until Plan 5');
  else pass('the shop still links to none of the new pages');
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --features
```

צפוי: `FAIL` על כל השורות החדשות, ויציאה בקוד 1. **כל שאר הבדיקות הקיימות חייבות להישאר ירוקות** — אם אחת מהן האדימה, שינית משהו שלא היית אמור.

- [ ] **Step 3: כפתור הלשונית ופאנל הלשונית**

ב-`index.html`, אחרי כפתור `atab-settings` ולפני `atab-kitchen` (שורה ~2195):

```html
      <button class="admin-tab-btn" id="atab-events" onclick="switchAdminTab('events')" role="tab">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        אירועים
      </button>
```

ופאנל, לצד שאר ה-`admin-tab-content`:

```html
  <div id="admin-tab-events" class="admin-tab-content">
    <h2 style="font-family:'Noto Serif Hebrew',serif;color:#6B2E1E;font-size:1.2rem;font-weight:700;margin:0 0 18px;">אירועים</h2>

    <div class="admin-card">
      <p style="font-family:'Noto Sans Hebrew',sans-serif;color:#9B8B75;font-size:0.78rem;margin:0 0 12px;">
        מה שמופיע כאן מופיע באתר. אירוע שהתאריך שלו עבר יורד לבד ל"היה" — אין צורך למחוק.
      </p>

      <form id="evForm" onsubmit="saveEvent(); return false;">
        <input type="hidden" id="evId">
        <input type="date" id="evDate" class="field" required>
        <input type="text" id="evTitle" class="field" maxlength="120" placeholder="כותרת" required>
        <input type="text" id="evTime" class="field" maxlength="60" placeholder="שעה — למשל שישי 8:00–12:00">
        <input type="text" id="evPlace" class="field" maxlength="120" placeholder="מקום">
        <textarea id="evBody" class="field" maxlength="600" rows="3" placeholder="שתיים-שלוש שורות"></textarea>
        <input type="text" id="evCtaLabel" class="field" maxlength="40" placeholder="כפתור — מה כתוב עליו (ריק = בלי כפתור)">
        <input type="text" id="evCtaText" class="field" maxlength="300" placeholder="כפתור — ההודעה שתיפתח בוואטסאפ">
        <button type="submit" class="admin-save-btn">שמירה</button>
        <button type="button" class="admin-save-btn" onclick="clearEventForm()">ניקוי</button>
      </form>
    </div>

    <div id="evAdminList"></div>
  </div>
```

**המחלקות כאן הן המחלקות שהלוח באמת משתמש בהן** — נבדק בקובץ: `.admin-tab-content`, `.admin-card`, `.field`, `.admin-save-btn`. אלה כל מה שקיים; שאר הפאנל מסוגנן בסגנון מוטבע, וזה הדפוס שיש לחזור עליו. **לא להמציא מחלקות חדשות ולא להוסיף CSS חדש לחנות** — שינוי ב-CSS של `index.html` נוגע גם בעמודי ההזמנה.

- [ ] **Step 4: הלוגיקה**

בסקריפט הראשי של `index.html`, לצד `initFinance()`:

```js
// ─── ADMIN: EVENTS ─────────────────────────────────
let EVENTS = [];
// Empty until Firebase answers. Saving in that window is how the pantry got
// wiped on every offline open — an empty local array there means "not loaded
// yet", never "Noy deleted everything".
let _eventsLoaded = false;
let _eventsBound  = false;

function initEvents() {
  if (_eventsBound) { renderEventsAdmin(); return; }
  _eventsBound = true;
  db.ref(ROOT + '/events').on('value', snap => {
    const val = snap.val() || {};
    EVENTS = Object.keys(val).map(k => Object.assign({ id: k }, val[k]));
    _eventsLoaded = true;
    renderEventsAdmin();
  }, fbError);
}

function clearEventForm() {
  ['evId','evDate','evTitle','evTime','evPlace','evBody','evCtaLabel','evCtaText']
    .forEach(id => { document.getElementById(id).value = ''; });
}

function saveEvent() {
  if (!_eventsLoaded) { alert('רגע, עוד טוען. נסי שוב בעוד שנייה.'); return; }

  const date  = document.getElementById('evDate').value.trim();
  const title = document.getElementById('evTitle').value.trim();
  if (!date || !title) { alert('תאריך וכותרת הם חובה.'); return; }

  const id = document.getElementById('evId').value || String(Date.now());
  const ev = {
    date, title,
    time:     document.getElementById('evTime').value.trim(),
    place:    document.getElementById('evPlace').value.trim(),
    body:     document.getElementById('evBody').value.trim(),
    ctaLabel: document.getElementById('evCtaLabel').value.trim(),
    ctaText:  document.getElementById('evCtaText').value.trim(),
    created:  Date.now()
  };

  // Per key, never the whole node. Noy edits from a phone and a laptop, and
  // the SDK queues writes made offline — a whole-node write made on one
  // device and delivered later deletes what the other device added in
  // between. savePantry(), saveRecipes() and saveWeeklyPlan() still carry
  // exactly this bug; do not add a fourth.
  db.ref(ROOT + '/events/' + id).set(ev)
    .then(clearEventForm)
    .catch(fbError);
}

function editEvent(id) {
  const ev = EVENTS.find(e => e.id === id);
  if (!ev) return;
  document.getElementById('evId').value       = ev.id;
  document.getElementById('evDate').value     = ev.date || '';
  document.getElementById('evTitle').value    = ev.title || '';
  document.getElementById('evTime').value     = ev.time || '';
  document.getElementById('evPlace').value    = ev.place || '';
  document.getElementById('evBody').value     = ev.body || '';
  document.getElementById('evCtaLabel').value = ev.ctaLabel || '';
  document.getElementById('evCtaText').value  = ev.ctaText || '';
  document.getElementById('admin-panel').scrollTop = 0;
}

function deleteEvent(id) {
  const ev = EVENTS.find(e => e.id === id);
  if (!ev) return;
  if (!confirm('למחוק את "' + ev.title + '"? אירוע שעבר יורד לארכיון לבד — אין צורך למחוק אותו.')) return;
  db.ref(ROOT + '/events/' + id).remove().catch(fbError);
}

function renderEventsAdmin() {
  const box = document.getElementById('evAdminList');
  if (!box) return;
  if (!_eventsLoaded) { box.innerHTML = '<p>טוען…</p>'; return; }
  if (!EVENTS.length)  { box.innerHTML = '<p>אין אירועים. הטופס למעלה מוסיף אחד.</p>'; return; }

  const sorted = EVENTS.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  // Every value below is text Noy typed, and it lands in innerHTML on a page
  // holding a live database handle with admin rights. esc() is not optional
  // here — this is the exact route CLAUDE.md warns about for order notes.
  box.innerHTML = sorted.map(ev =>
    '<div class="admin-card">' +
      '<strong>' + esc(ev.date) + '</strong> — ' + esc(ev.title) +
      (ev.place ? ' · ' + esc(ev.place) : '') +
      '<button type="button" class="admin-save-btn" onclick="editEvent(\'' + esc(ev.id) + '\')">עריכה</button>' +
      '<button type="button" class="admin-save-btn" onclick="deleteEvent(\'' + esc(ev.id) + '\')">מחיקה</button>' +
    '</div>'
  ).join('');
}
```

ובתוך `switchAdminTab(tab)`, לצד `if (tab === 'finance') initFinance();`:

```js
  if (tab === 'events')  initEvents();
```

- [ ] **Step 5: להריץ ולוודא שעוברת**

```bash
node scripts/validate.mjs
```

צפוי: `All checks passed.` — **כולל כל 15 בדיקות התכונות הקריטיות שהיו ירוקות לפני השינוי.** אם אחת מהן האדימה, לעצור ולהבין מה נשבר; זו החנות.

- [ ] **Step 6: לשבור בכוונה, שבע פעמים**

| השבירה | צפוי |
|---|---|
| להחליף את הכתיבה ב-`db.ref(ROOT + '/events').set(obj)` | **FAIL** — כתיבה לכל הענף |
| למחוק את `.catch(fbError)` מ-`saveEvent` | **FAIL** |
| למחוק את `.catch(fbError)` מ-`deleteEvent` | **FAIL** |
| למחוק את `if (!_eventsLoaded)` מ-`saveEvent` | **FAIL** |
| להחליף `esc(ev.title)` ב-`ev.title` ב-`renderEventsAdmin` | **FAIL** — בדיקת ההברחה הממוקדת |
| למחוק את `id="atab-events"` | **FAIL** |
| להוסיף `<a href="./events.html">` בלוח הניהול | **FAIL** — "not public until Plan 5" |

לבטל כל שבירה מיד. **אם אחת לא ירתה — הבדיקה שגויה ולא השבירה.** לתקן את הבדיקה ולהריץ את כל השבע שוב.

- [ ] **Step 7: לבדוק בדפדפן — החנות, ואז הלשונית**

קודם כל **שהחנות לא נשברה**:

1. לפתוח את `index.html` כלקוח. התפריט נטען, מוצר נכנס לעגלה, הסכום בפס העגלה נכון, מודל ההזמנה נפתח והסכום בו **זהה**. לא לשלוח הזמנה.
2. לפתוח את `?admin`. כל שבע הלשוניות הישנות נפתחות ומציגות את מה שהן הציגו קודם.

ורק אז הלשונית החדשה:

3. להוסיף אירוע. הוא מופיע ברשימה מיד.
4. לערוך אותו. השינוי נשמר, ולא נוצרה רשומה שנייה.
5. למחוק אותו, לאשר. נעלם.
6. לפתוח את `events.html` בלשונית אחרת ולרענן — האירוע מופיע שם.
7. **מבחן שתי המכונות:** לפתוח את הניהול בשני חלונות. בחלון א' להוסיף אירוע X. בחלון ב' (בלי לרענן) להוסיף אירוע Y. לרענן את שניהם. **שניהם חייבים להיות שם.** אם אחד נעלם — הכתיבה היא לכל הענף, וזה בדיוק הבאג שהמשימה הזאת נכתבה כדי לא להוסיף בפעם הרביעית.
8. להוסיף אירוע שהכותרת שלו היא `<img src=x onerror=alert(1)>`. **חייב להופיע כטקסט**, גם בלוח הניהול וגם ב-`events.html`. אם קופצת התראה — `esc()` חסר במקום כלשהו, וזו גישה מלאה למסד של העסק.

לצרף צילום מסך של 7 ושל 8.

- [ ] **Step 8: קומיט**

```bash
git add index.html scripts/validate.mjs
git commit -m "לוח הניהול: לשונית אירועים, כתיבה לפי מפתח בודד"
```

---

## Task 6: סקירת ענף מלאה ופרסום

**Files:**
- Modify: `docs/superpowers/specs/2026-09-20-nuika-redesign-design.md` (מה שהתגלה, לתוכנית 5)

---

- [ ] **Step 1: סקירה על כל הענף, לא על המשימה האחרונה**

`git diff main...HEAD`. לקרוא את כל השינוי בבת אחת ולחפש במפורש:

- כתיבה ל-Firebase בלי `.catch(fbError)`
- ערך כלשהו שמגיע ל-`innerHTML` בלי `esc()`
- `db.ref('nuika/events').set(` כלשהו
- הזרקת HTML דו-לשוני בלי `window.nuikaRefresh()` אחריה
- `left`/`right` פיזי
- `--crust` כצבע טקסט
- שינוי כלשהו ב-`index.html` מחוץ ללשונית האירועים
- `CNAME`, `sw.js`, `manifest.json` — חייבים להיות ללא שינוי בתוכנית הזאת

- [ ] **Step 2: הבדיקות המלאות**

```bash
node scripts/validate.mjs
```

צפוי: `All checks passed.`

- [ ] **Step 3: לרשום במפרט מה שהתגלה**

בסוף המפרט, בסעיף חדש `### מה שתוכנית 4 גילתה, ושתוכנית 5 חייבת לדעת`, לרשום **מה שנמצא בפועל** — לא מה שהיה צפוי. לכל הפחות:

- כל בדיקה שנכתבה כאן ונתפסה כלא-יורה בשלב השבירה המכוונת, ומה היה חסר בה.
- `events.html` הוא **העמוד החדש הראשון שטוען Firebase.** ל-`sw.js` יש ענף cache-first לכל מה שאינו HTML — לבדוק ולרשום מה קורה ל-SDK מה-CDN שם.
- מה שנשאר פתוח מול נוי: האם מבנה האירוע מספיק, או שחסר שדה.

- [ ] **Step 4: לפרסם**

```bash
node scripts/status.mjs
node scripts/validate.mjs
node scripts/ship.mjs "לוח האירועים: ניהול מהחנות, ועמוד ציבורי"
```

`ship.mjs` הוא הדרך היחידה. `git push` ישיר מדלג על הבדיקות שקיימות כי כבר אבדה כאן עבודה פעם אחת.

- [ ] **Step 5: לאמת על האתר החי, לא על עותק מקומי**

1. `node scripts/status.mjs` — שלושת השורות (התיקייה, גיטהאב, האתר החי) על אותה גרסה.
2. `https://nuika.co.il/events.html` נטען, בלי שגיאות בקונסולה.
3. `https://nuika.co.il/` — **החנות עדיין עובדת.** התפריט נטען, מוצר נכנס לעגלה, הסכום נכון.
4. הקישור "אירועים" בכותרת של `story.html`, `gallery.html` ו-`contact.html` כבר לא מחזיר 404.

- [ ] **Step 6: לדווח מה שנשאר**

> `firebase-rules.json` עודכן בריפו. **הכללים באוויר לא השתנו עד שמישהו מדביק אותם פעם אחת** ב-Firebase Console ← Realtime Database ← Rules ← Publish. עד אז לשונית הניהול תיתקל ב-PERMISSION_DENIED בשמירה, ו-`events.html` יראה את המצב הריק. שאר האתר — החנות, ההזמנות, המטבח — לא מושפע בכלל.

---

## מה שהתוכנית הזאת לא עושה

- **לא מחליפה שמות קבצים.** `index.html` נשארת החנות עד תוכנית 5.
- **לא מקשרת את העמודים החדשים מהחנות.** בדיקה אוכפת את זה.
- **לא נוגעת ב-`sw.js`, ב-`manifest.json`, ב-`admin.html` וב-`CNAME`.** כולם שייכים לתוכנית 5.
- **לא מוסיפה הרשמה לאירועים.** אין ספירת מקומות ואין רישום — כפתור אחד שפותח וואטסאפ. אם יתברר שצריך הרשמה אמיתית, זה פרויקט נפרד.
- **לא מרחיבה את בדיקת ההברחה על `index.html` כולו.** הבדיקה ממשימה 1 רצה על העמודים הסטטיים, ובמשימה 5 נוספת גרסה ממוקדת על בלוק האירועים בלבד. החנות מכילה עשרות כתיבות ל-`innerHTML` שקודמות לתוכנית הזאת, וסריקה שלהן היא עבודה נפרדת — **לא כי היא לא נחוצה, אלא כי היא לא שייכת לכאן.** לרשום את זה במפרט בצעד 3 של משימה 6.
- **לא מוסיפה העלאת תמונות לאירוע.** Firebase Storage דורש תוכנית בתשלום מאז 3 בפברואר 2026, והחלופה — base64 בתוך המסד — היא בדיוק מה שמאט את החנות היום.
