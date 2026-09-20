# NUIKA Redesign — Plan 1: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** לבנות את שכבת הבסיס המשותפת של האתר החדש — נכסי הלוגו, `site.css` ו-`site.js` — יחד עם בדיקות אוטומטיות ששומרות עליה, בלי לגעת ב-`index.html` החי.

**Architecture:** קובץ עיצוב אחד וקובץ סקריפט אחד שכל העמודים החדשים יונקים מהם. הבדיקות נכתבות כשלב חדש ב-`scripts/validate.mjs` — הסקריפט שכבר רץ ב-CI ומהווה שער בין קומיט לאתר החי — כך שהן ממשיכות להגן על העבודה לנצח, בלי להוסיף שום תלות חדשה לפרויקט.

**Tech Stack:** HTML/CSS/JS סטטיים, בלי שלב בנייה. Node 20 לסקריפטים. Google Fonts כ-CDN. אין framework לבדיקות ואין `node_modules` — `package.json` ריק, ובכוונה.

---

## Global Constraints

מתוך המפרט `docs/superpowers/specs/2026-09-20-nuika-redesign-design.md`. חלים על **כל** משימה בתוכנית:

- **`index.html` לא נוגעים בו בתוכנית הזאת בכלל.** הוא החנות החיה עם הזמנות אמיתיות.
- **`CNAME` לא נוגעים בו.** מחיקה או עריכה מורידה את הדומיין ואת החנות.
- **פרסום רק דרך `node scripts/ship.mjs "הודעה"`.** אף פעם לא `git push` ישיר. לפני שמתחילים: `node scripts/status.mjs` ואז `node scripts/sync.mjs`.
- **ערכי הצבע אינם נתונים לטעם.** `--terra: #B84830` נדגם מהפיקסלים של הלוגו. כל ערך נבחר כדי לעבור סף ניגודיות מדוד. שינוי גוון אחד מפיל כפתור מתחת לסף הקריאוּת.
- **ריווח נכתב כהתחלה/סוף בלבד** (`margin-inline-start`, `inset-inline`, `padding-inline`), אף פעם לא `left`/`right`, כדי שהמעבר לאנגלית יתהפך לבד.
- **כל רצף לטיני בתוך עברית** עטוף ב-`direction:ltr; unicode-bidi:isolate`.
- **נתיבים יחסיים בלבד** (`./`), כדי שהאתר יעבוד גם מ-`nuika.co.il` וגם מ-`github.io`.
- **`prefers-reduced-motion` מקבל את המצב הסופי**, לא הנפשה מהירה יותר.
- **שמות מחלקות מקומיים לעמוד.** מחלקה גנרית בת אות אחת (`.f`, `.a`) התנגשה בפועל במוקאפים ועיוותה עמוד שלם.
- **הרצפה של הלוגו המלא היא 130px רוחב.** מתחתיה משתמשים רק ב-`umbel`.

### רקע שמשנה התנהגות

`.github/workflows/deploy.yml` **מתנה את העלייה לאתר החי בהצלחת `scripts/validate.mjs`**. קומיט שנכשל בוולידציה נכנס ל-git אבל **לא מגיע לאתר** — האתר ממשיך להגיש את הגרסה הטובה האחרונה. לכן בדיקה שנוספת כאן היא לא קישוט: היא שער.

---

## File Structure

| קובץ | אחריות |
|---|---|
| `images/logo.png` | **נוצר.** הלוגו חתוך לשוליים אפס, 1915×703. הקובץ הקיים `logo.png.png` נשאר כפי שהוא — `sw.js` ו-`index.html` מצביעים עליו. |
| `images/umbel.png` | **נוצר.** סימן הפרח לבדו, לשימוש מתחת ל-130px. |
| `site.css` | **נוצר.** מקור יחיד לצבע, טיפוגרפיה, כפתורים ותנועה. לא מכיל פריסה של עמוד מסוים. |
| `site.js` | **נוצר.** כותרת ותחתית משותפות, בורר שפה, זיהוי הפחתת תנועה. לא מכיל לוגיקה של עמוד מסוים. |
| `scripts/validate.mjs` | **משתנה.** שלב `--design` חדש. השלבים הקיימים לא נגעים. |
| `.github/workflows/validate.yml` | **משתנה.** שורה אחת שמריצה את השלב החדש. |

**גבולות:** `site.css` לא יודע על שום עמוד. `site.js` לא יודע על שום עמוד. עמוד שצריך פריסה מיוחדת כותב אותה אצלו, עם קידומת מחלקות משלו.

---

## Task 1: נכסי הלוגו

**Files:**
- Create: `images/logo.png`, `images/umbel.png`
- Modify: `scripts/validate.mjs` (הוספת שלב `--design`)
- Modify: `.github/workflows/validate.yml`

**Interfaces:**
- Consumes: `logo.png.png` בשורש (2400×1400) — **הקובץ היחיד שנדרש.** שני הנכסים נחתכים ממנו, כך שאין תלות בקבצים ש-git מתעלם מהם ותיקיית עבודה נפרדת לא חסרה כלום
- Produces: `images/logo.png` (1915×703) · `images/umbel.png` (348×701) · שלב הרצה `node scripts/validate.mjs --design`

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

בסוף `scripts/validate.mjs`, לפני בלוק ה-`if (failed)` הסופי:

```js
if (want('design')) {
  console.log('Design system assets:');

  // The supplied logo is 2400x1400 but the drawing occupies only 1915x703 —
  // a quarter of the file is empty margin. A browser measures the file, not
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
}
```

- [ ] **Step 2: להריץ ולוודא שהיא נכשלת**

```bash
node scripts/validate.mjs --design
```

צפוי: `FAIL  images/logo.png is missing`, `FAIL  images/umbel.png is missing`, ויציאה בקוד 1.

- [ ] **Step 3: לייצר את הנכסים**

```bash
ffmpeg -nostdin -loglevel error -i logo.png.png -vf "crop=1915:703:238:341" -y images/logo.png
ffmpeg -nostdin -loglevel error -i logo.png.png -vf "crop=348:701:1089:341"  -y images/umbel.png
```

שתי קבוצות המספרים הן תיבות דיו **שנמדדו** בקובץ המקורי — `1915:703:238:341` לסימן
המילולי המלא, ו-`348:701:1089:341` לפרח ולגבעול שלו לבדם. **אין לנחש אותן מחדש
ואין לעגל.** חיתוך רחב יותר של הפרח גורר איתו את הרגל של האות `k`, שיושבת מימינו.

- [ ] **Step 4: להריץ ולוודא שעוברת**

```bash
node scripts/validate.mjs --design
```

צפוי: `ok    images/logo.png is the cropped 1915x703 wordmark` ו-`ok    images/umbel.png is the 348x701 flower and stem`.

ולהסתכל על שני הקבצים בפועל: הסימן המילולי צריך להיות `nuika` בלי שוליים, והפרח
צריך להיות פרח וגבעול **בלי שום שבר של אות** בצד.

- [ ] **Step 5: לחבר ל-CI**

ב-`.github/workflows/validate.yml`, אחרי השלב `Check referenced files exist`:

```yaml
      - name: Check the design system
        run: node scripts/validate.mjs --design
```

- [ ] **Step 6: לוודא שכל השלבים יחד עדיין עוברים**

```bash
node scripts/validate.mjs
```

צפוי: `All checks passed.` — כולל כל הבדיקות הקיימות של החנות, שלא נגענו בהן.

- [ ] **Step 7: קומיט**

```bash
git add images/logo.png images/umbel.png scripts/validate.mjs .github/workflows/validate.yml
git commit -m "נכסי לוגו לאתר החדש: גרסה חתוכה וסימן הפרח, עם בדיקה"
```

---

## Task 2: `site.css` — אסימוני הצבע, עם שומר ניגודיות

**Files:**
- Create: `site.css`
- Modify: `scripts/validate.mjs` (הרחבת שלב `--design`)

**Interfaces:**
- Consumes: שלב `--design` מ-Task 1
- Produces: תשעה אסימוני צבע על `:root` — `--wheat --ink --cream --muted --terra --terra-deep --butter --sage --crust`

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

בתוך `if (want('design'))`, אחרי בדיקות הנכסים:

```js
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
    if (/color\s*:\s*var\(\s*--crust\s*\)/.test(css))
      fail('--crust is used as a text colour; it measures 2.30 on --wheat and vanishes');
    else pass('--crust is never used as a text colour');
  }
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --design
```

צפוי: `FAIL  site.css is missing`.

- [ ] **Step 3: לכתוב את `site.css`**

```css
/* NUIKA — the design system.
   One file. Every page derives from it; no page defines its own colours.

   The values below are not adjustable by taste. --terra is sampled from the
   pixels of Noy's logo, and each other value was chosen so that the pairs in
   `node scripts/validate.mjs --design` clear their contrast threshold. That
   check is the reason this comment can be short: change a shade and CI will
   tell you exactly which pair you broke. */

:root {
  /* ground and ink */
  --wheat:  #EFE6D6;  /* the page ground */
  --ink:    #3B2A24;  /* all text, and the footer's ground */
  --cream:  #F6F0E4;  /* text on film, on --ink, and on --terra */
  --muted:  #6B655C;  /* secondary text */

  /* Noy's colour, in two values.
     --terra is the logo's own pixel colour. Against --cream it carries 4.62,
     which is enough for the primary button. A small link on --wheat needs
     more than it has (4.23), so --terra-deep exists for that one job. */
  --terra:      #B84830;
  --terra-deep: #AE472C;

  /* accents */
  --butter: #F0E2BA;  /* dates, labels, the button that sits on film */
  --sage:   #C3C8AE;  /* the active filter or tag */
  --crust:  #B8935E;  /* SURFACE ONLY — as text on --wheat it measures 2.30 */
}

html { background: var(--wheat); }

body {
  margin: 0;
  background: var(--wheat);
  color: var(--ink);
}
```

- [ ] **Step 4: להריץ ולוודא שעוברת**

```bash
node scripts/validate.mjs --design
```

צפוי: תשע שורות `ok` לאסימונים, שבע שורות `ok` לזוגות הניגודיות עם המספרים המדודים (‎10.99, ‎4.66, ‎4.62, ‎4.54, ‎11.99, ‎10.56, ‎7.90), ו-`ok --crust is never used as a text colour`.

- [ ] **Step 5: לוודא שהשומר באמת שומר**

לשנות זמנית ב-`site.css` את `--terra` ל-`#BD4D30` (הערך שהיה בפלטה לפני הדגימה מהלוגו), ולהריץ:

```bash
node scripts/validate.mjs --design
```

צפוי: `FAIL  --terra is #BD4D30 — expected #B84830`, ואילו היה עובר את בדיקת השם — `the label on the primary button: 4.34 is below 4.5`. **להחזיר את הערך ל-`#B84830`** ולהריץ שוב כדי לוודא חזרה ל-`ok`.

- [ ] **Step 6: קומיט**

```bash
git add site.css scripts/validate.mjs
git commit -m "site.css: אסימוני צבע, עם בדיקת ניגודיות שרצה ב-CI"
```

---

## Task 3: `site.css` — טיפוגרפיה ומשמעת RTL

**Files:**
- Modify: `site.css`
- Modify: `scripts/validate.mjs`

**Interfaces:**
- Consumes: האסימונים מ-Task 2
- Produces: `--font-display`, `--font-text`, ו-`--t-giant --t-page --t-sub --t-body --t-small --t-label` · המחלקות `.ltr` ו-`.u-display`

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

בתוך בלוק ה-`else` של `site.css` ב-`--design`, בסוף:

```js
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
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --design
```

צפוי: שמונה שורות `FAIL  --font-display is missing` וכו', ו-`FAIL  no unicode-bidi:isolate rule`.

- [ ] **Step 3: להוסיף את הטיפוגרפיה ל-`site.css`**

להוסיף בתוך בלוק ה-`:root` הקיים, אחרי אסימוני הצבע:

```css
  /* Bellefair carries real Hebrew, not a synthetic slant, and that is what
     gives the retro-Parisian note without looking like a template. It is also
     thin, so it never sets running text: anything a visitor actually reads is
     Plex. The two are loaded by each page's <head>, not by @import, which
     would block rendering. */
  --font-display: 'Bellefair', 'Times New Roman', serif;
  --font-text:    'IBM Plex Sans Hebrew', 'Segoe UI', system-ui, sans-serif;

  --t-giant: clamp(40px, 7vw, 64px);
  --t-page:  clamp(30px, 5vw, 44px);
  --t-sub:   clamp(20px, 3vw, 26px);
  --t-body:  17px;
  --t-small: 13px;
  --t-label: 11px;
```

ואחרי בלוק ה-`body` הקיים:

```css
body {
  font-family: var(--font-text);
  font-size: var(--t-body);
  font-weight: 300;
  line-height: 1.9;
}

h1, h2, h3, .u-display {
  font-family: var(--font-display);
  font-weight: 400;
  line-height: 1.1;
  margin: 0;
}

h1 { font-size: var(--t-page); }
h2 { font-size: var(--t-sub); }

.u-giant { font-family: var(--font-display); font-size: var(--t-giant); line-height: 1.05; }
.u-small { font-size: var(--t-small); line-height: 1.7; color: var(--muted); }
.u-label { font-size: var(--t-label); letter-spacing: .3em; color: var(--muted); }

/* A Latin run inside a Hebrew sentence reverses without this: "@nuika_bread"
   renders as "nuika_bread@". Every phone number, handle and URL gets it. */
.ltr {
  direction: ltr;
  unicode-bidi: isolate;
  display: inline-block;
}
```

- [ ] **Step 4: להריץ ולוודא שעוברת**

```bash
node scripts/validate.mjs --design
```

צפוי: כל שמונת האסימונים `ok`, `ok no physical left/right`, `ok .ltr isolates Latin runs inside Hebrew`.

- [ ] **Step 5: לוודא ששומר ה-RTL באמת שומר**

להוסיף זמנית ל-`site.css` שורה `  margin-left: 4px;` בתוך כלל כלשהו, ולהריץ:

```bash
node scripts/validate.mjs --design
```

צפוי: `FAIL  site.css uses physical left/right on line(s) N`. **למחוק את השורה** ולהריץ שוב.

- [ ] **Step 6: קומיט**

```bash
git add site.css scripts/validate.mjs
git commit -m "site.css: טיפוגרפיה, ובדיקה שחוסמת ריווח ימין/שמאל פיזי"
```

---

## Task 4: `site.css` — כפתורים, מיקוד ותנועה

**Files:**
- Modify: `site.css`
- Modify: `scripts/validate.mjs`

**Interfaces:**
- Consumes: האסימונים מ-Task 2 ו-Task 3
- Produces: `.btn` · `.btn--primary` · `.btn--outline` · `.btn--on-film` · `.btn--ghost` · `.link` · `.rise` · `.fade` · `.reveal`

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

בהמשך אותו בלוק:

```js
    console.log('Components and motion:');
    for (const cls of ['.btn', '.btn--primary', '.btn--outline', '.btn--on-film', '.btn--ghost', '.link',
                       '.rise', '.fade', '.reveal']) {
      if (css.includes(cls + ' ') || css.includes(cls + ',') || css.includes(cls + '{') || css.includes(cls + ':'))
        pass(`${cls} is defined`);
      else fail(`${cls} is missing`);
    }

    // Without a visible focus ring, anyone navigating by keyboard cannot tell
    // where they are. It is not decoration.
    if (/:focus-visible/.test(css) && /outline-offset/.test(css))
      pass('a keyboard focus ring is defined');
    else fail('no :focus-visible outline — keyboard users lose their place');

    // Reduced motion must render the FINAL state, not a faster animation.
    const rm = css.match(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{([\s\S]*?)\n\}/);
    if (!rm) fail('no prefers-reduced-motion block');
    else if (/animation\s*:\s*none/.test(rm[1]) && /transition\s*:\s*none/.test(rm[1]))
      pass('reduced motion switches animation and transition off, not shortens them');
    else fail('the prefers-reduced-motion block must set animation:none and transition:none');
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --design
```

צפוי: תשע שורות `FAIL  .btn is missing` וכו', `FAIL no :focus-visible outline`, `FAIL no prefers-reduced-motion block`.

- [ ] **Step 3: להוסיף ל-`site.css`**

```css
/* ---------- buttons ---------- */

.btn {
  display: inline-block;
  font: inherit;
  font-size: var(--t-small);
  line-height: 1;
  padding: 14px 28px;
  border: 1px solid transparent;
  border-radius: 999px;
  cursor: pointer;
  text-decoration: none;
  transition: background-color .18s ease, color .18s ease, border-color .18s ease;
}

.btn--primary { background: var(--terra); color: var(--cream); }
.btn--outline { background: transparent; color: var(--ink); border-color: var(--ink); }

/* On film the primary is solid cream, not terracotta. A full light colour is
   the only thing that stays readable over a picture that changes every second. */
.btn--on-film { background: var(--cream); color: var(--ink); }
.btn--ghost   { background: transparent; color: var(--cream); border-color: rgba(246, 240, 228, .6); }

.link {
  color: var(--terra-deep);
  text-decoration: none;
  border-bottom: 1px solid currentColor;
}

/* The ring is how a keyboard user knows where they are. */
.btn:focus-visible,
.link:focus-visible {
  outline: 2px solid var(--terra-deep);
  outline-offset: 3px;
}

.btn--on-film:focus-visible,
.btn--ghost:focus-visible {
  outline: 2px solid var(--cream);
  outline-offset: 3px;
}

/* ---------- motion ---------- */
/* Three movements for the whole site. A site that breathes is one where a
   single thing moves at a time, always in the same language. Each starts in
   its hidden state and is released by adding .is-in — site.js does that with
   an IntersectionObserver. */

.rise   { opacity: 0; transform: translateY(14px); transition: opacity .6s cubic-bezier(.22,.61,.36,1), transform .6s cubic-bezier(.22,.61,.36,1); }
.fade   { opacity: 0; transition: opacity .9s ease; }
.reveal { clip-path: inset(0 0 0 100%); transition: clip-path .6s cubic-bezier(.65,0,.35,1); }

/* The reveal follows the reading direction, so it uncovers right-to-left in
   Hebrew and left-to-right in English rather than running backwards.
   This matches on the attribute rather than :dir(), which Chrome only shipped
   in 120 and Safari in 16.4 — site.js sets dir on <html> explicitly, so the
   attribute is always there and every browser understands it. */
[dir="ltr"] .reveal { clip-path: inset(0 100% 0 0); }

.rise.is-in   { opacity: 1; transform: none; }
.fade.is-in   { opacity: 1; }
.reveal.is-in { clip-path: inset(0 0 0 0); }

/* The final state, not a faster animation. Someone who asked for less motion
   sees exactly the same page — just without the journey to it. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
  .rise, .fade, .reveal {
    opacity: 1;
    transform: none;
    clip-path: none;
  }
}
```

- [ ] **Step 4: להריץ ולוודא שעוברת**

```bash
node scripts/validate.mjs --design
```

צפוי: תשע שורות `ok` למחלקות, `ok a keyboard focus ring is defined`, `ok reduced motion switches animation and transition off`.

- [ ] **Step 5: לוודא בדפדפן שהמצב הסופי באמת נראה נכון**

לכתוב קובץ בדיקה זמני **מחוץ לריפו**, בתיקיית ה-scratchpad, שמכיל את `site.css` ואת ארבעת הכפתורים ושלוש התנועות, ולפתוח אותו עם Playwright פעמיים: פעם רגילה ופעם עם `prefers-reduced-motion: reduce` (דרך `browser_emulate_media`). לאמת:

- `getComputedStyle(el).opacity === '1'` לשלושת האלמנטים במצב reduced motion, **בלי** `.is-in`
- `outlineWidth` אינו `0px` על כפתור אחרי `Tab`
- `.btn--primary` מקבל `rgb(184, 72, 48)` ו-`.btn--on-film` מקבל `rgb(246, 240, 228)`

הקובץ הזמני **לא נכנס לריפו.**

- [ ] **Step 6: קומיט**

```bash
git add site.css scripts/validate.mjs
git commit -m "site.css: כפתורים, טבעת מיקוד, ושלוש תנועות עם כיבוי אמיתי"
```

---

## Task 5: `site.js` — כותרת ותחתית ממקור אחד

**Files:**
- Create: `site.js`
- Modify: `site.css` (פריסת הכותרת והתחתית)
- Modify: `scripts/validate.mjs`

**Interfaces:**
- Consumes: `site.css`, `images/logo.png`, `images/umbel.png`
- Produces: הפונקציות הגלובליות `nuikaHeader(active)` ו-`nuikaFooter()`, שמוזרקות אוטומטית לתוך `<header class="nu-header" data-nuika-header="<key>">` ו-`<footer class="nu-footer" data-nuika-footer>`. מפתחות התפריט: `story` · `gallery` · `events` · `contact`. מחלקות שהעמוד מחיל: `.nu-header` · `.nu-header--on-film` · `.nu-footer`

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

בתוך `if (want('design'))`, בסוף:

```js
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
      ['images/logo.png',      'the header uses the cropped wordmark'],
      ['shop.html',            'the shop is reachable from every page'],
    ]) {
      if (js.includes(needle)) pass(why);
      else fail(`missing "${needle}" — ${why}`);
    }

    // Below 130px wide the finest strokes of the umbel fade out. The header
    // must not shrink the full wordmark past that; it uses images/umbel.png.
    const declared = js.match(/images\/logo\.png[\s\S]{0,80}?width="(\d+)"/);
    if (!declared) fail('site.js does not declare a width for the logo — it will render at its natural 1915px');
    else if (Number(declared[1]) < 130) fail(`site.js renders the full logo at ${declared[1]}px — the floor is 130px`);
    else pass(`the full logo is rendered at ${declared[1]}px, at or above its 130px floor`);
  }
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --design
```

צפוי: `FAIL  site.js is missing`.

- [ ] **Step 3: לכתוב את `site.js`**

```js
/* NUIKA — chrome shared by every page of the new site.
 *
 * The header and the footer are built here and nowhere else. There is no
 * second copy, so no page can drift out of sync with a stale menu.
 *
 * A page opts in by placing an empty element:
 *     <header data-nuika-header="story"></header>
 *     <footer data-nuika-footer></footer>
 * The attribute's value marks which menu item is the current page.
 */

(function () {
  'use strict';

  var NAV = [
    { key: 'story',   href: './story.html',   he: 'הסיפור',    en: 'Story' },
    { key: 'gallery', href: './gallery.html', he: 'גלריה',     en: 'Gallery' },
    { key: 'events',  href: './events.html',  he: 'אירועים',   en: 'Events' },
    { key: 'contact', href: './contact.html', he: 'דברו איתי', en: 'Talk to me' }
  ];

  var SOCIAL = [
    { href: 'https://www.instagram.com/nuika_bread/', he: 'אינסטגרם', en: 'Instagram' },
    { href: 'https://wa.me/972500000000',            he: 'וואטסאפ',  en: 'WhatsApp' }
  ];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function navHTML(active) {
    return NAV.map(function (item) {
      var current = item.key === active;
      return '<a class="nu-nav__item' + (current ? ' is-current' : '') + '"' +
             ' href="' + item.href + '"' + (current ? ' aria-current="page"' : '') + '>' +
             '<span lang-content="he">' + esc(item.he) + '</span>' +
             '<span lang-content="en">' + esc(item.en) + '</span>' +
             '</a>';
    }).join('');
  }

  /* The full wordmark is never rendered below 130px wide — under that its
     finest strokes fade out. The header sits at 160px, which measures 59px
     tall and leaves the flower legible. */
  function nuikaHeader(active) {
    return '' +
      '<a class="nu-mark" href="./index.html" aria-label="NUIKA">' +
        '<img src="./images/logo.png" alt="NUIKA" width="160" height="59">' +
      '</a>' +
      '<nav class="nu-nav">' + navHTML(active) + '</nav>' +
      '<button class="nu-lang" type="button" data-nuika-lang></button>';
  }

  function nuikaFooter() {
    var links = SOCIAL.map(function (s) {
      return '<a class="nu-soc" href="' + s.href + '" target="_blank" rel="noopener">' +
             '<span lang-content="he">' + esc(s.he) + '</span>' +
             '<span lang-content="en">' + esc(s.en) + '</span></a>';
    }).join('');
    return '' +
      '<a class="nu-mark nu-mark--foot" href="./index.html" aria-label="NUIKA"></a>' +
      '<div class="nu-soc-row">' + links + '</div>' +
      '<p class="nu-fine">' +
        '<span lang-content="he">רחובות · איסוף בימי שישי</span>' +
        '<span lang-content="en">Rehovot · Friday pickup</span>' +
      '</p>' +
      '<a class="nu-to-shop" href="./shop.html">' +
        '<span lang-content="he">למאפייה של NUIKA</span>' +
        '<span lang-content="en">To the NUIKA bakery</span>' +
      '</a>';
  }

  function mount() {
    var head = document.querySelector('[data-nuika-header]');
    if (head) head.innerHTML = nuikaHeader(head.getAttribute('data-nuika-header'));
    var foot = document.querySelector('[data-nuika-footer]');
    if (foot) foot.innerHTML = nuikaFooter();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  window.nuikaHeader = nuikaHeader;
  window.nuikaFooter = nuikaFooter;
})();
```

- [ ] **Step 4: לעצב את הכותרת והתחתית ב-`site.css`**

הקוד ב-`site.js` בונה מבנה; בלי הכלל הזה הכותרת מופיעה כשורת קישורים חשופה
והלוגו בתחתית הוא אלמנט ריק ללא גובה. להוסיף בסוף `site.css`:

```css
/* ---------- shared chrome ---------- */
/* Laid out here because the header and footer belong to every page. A page's
   own layout stays in that page's stylesheet, under its own class prefix. */

.nu-header {
  position: relative;
  display: flex;
  align-items: center;
  padding: 18px 28px;
  border-block-end: 1px solid rgba(59, 42, 36, .13);
}

.nu-mark { flex: 0 0 auto; display: block; line-height: 0; }
.nu-mark img { display: block; width: 160px; height: auto; }

/* Centred no matter how wide the items are, with the mark and the language
   button pinned to the two ends. Absolute so the nav's own width cannot pull
   the centre off true. */
.nu-nav {
  position: absolute;
  inset-inline: 0;
  display: flex;
  justify-content: center;
  gap: 26px;
  pointer-events: none;
}

.nu-nav__item {
  pointer-events: auto;
  font-size: var(--t-small);
  color: inherit;
  text-decoration: none;
  padding-block-end: 2px;
  border-block-end: 1px solid transparent;
}

.nu-nav__item.is-current { border-block-end-color: var(--terra); }

.nu-lang {
  margin-inline-start: auto;
  flex: 0 0 auto;
  font: inherit;
  font-size: var(--t-label);
  background: transparent;
  color: inherit;
  border: 1px solid currentColor;
  border-radius: 999px;
  padding: 4px 13px;
  cursor: pointer;
  opacity: .75;
}

/* The header sits on the film on the home page, where it needs no rule under
   it and its own ink colour. A page opts in by adding this class. */
.nu-header--on-film { color: var(--cream); border-block-end: 0; }

.nu-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 22px;
  padding: 40px 28px;
  background: var(--ink);
  color: var(--cream);
}

/* Drawn as a mask rather than an image, so the one file serves both grounds:
   cream here, terracotta on a light page. No second copy to keep in step. */
.nu-mark--foot {
  width: 150px;
  height: 55px;
  background: var(--cream);
  -webkit-mask: url(./images/logo.png) center / contain no-repeat;
          mask: url(./images/logo.png) center / contain no-repeat;
}

.nu-soc-row { display: flex; gap: 18px; }
.nu-soc { color: inherit; font-size: var(--t-small); text-decoration: none; opacity: .85; }
.nu-fine { margin: 0; font-size: var(--t-label); letter-spacing: .04em; opacity: .6; }

.nu-to-shop {
  color: inherit;
  font-size: var(--t-small);
  text-decoration: none;
  border-block-end: 1px solid currentColor;
}

@media (max-width: 720px) {
  .nu-header { flex-wrap: wrap; gap: 14px; padding: 14px 18px; }
  .nu-mark img { width: 130px; }   /* the floor, never below it */
  .nu-nav { position: static; order: 3; width: 100%; gap: 16px; flex-wrap: wrap; }
  .nu-footer { justify-content: center; text-align: center; padding: 32px 18px; }
}
```

הכותרת והתחתית בעמוד נכתבות אז כך, והמחלקות מגיעות מהעמוד ולא מהסקריפט:

```html
<header class="nu-header" data-nuika-header="story"></header>
<footer class="nu-footer" data-nuika-footer></footer>
```

- [ ] **Step 5: להריץ ולוודא שעוברת**

```bash
node scripts/validate.mjs --design
```

צפוי: `ok site.js parses`, שש שורות `ok` לתכונות, ו-`ok the full logo is rendered at 160px, at or above its 130px floor`.

- [ ] **Step 6: לאמת בדפדפן שההזרקה קורית**

לכתוב דף בדיקה זמני ב-scratchpad שטוען את `site.css` ו-`site.js` ומכיל רק:

```html
<header data-nuika-header="gallery"></header>
<footer data-nuika-footer></footer>
```

לפתוח עם Playwright ולאמת:
- `document.querySelectorAll('.nu-nav__item').length === 4`
- הפריט עם `aria-current="page"` הוא זה שה-`href` שלו `./gallery.html`
- `document.querySelector('.nu-mark img').naturalWidth === 1915` (התמונה נטענה, והיא החתוכה)
- `document.querySelector('.nu-to-shop').getAttribute('href') === './shop.html'`

- [ ] **Step 7: קומיט**

```bash
git add site.js site.css scripts/validate.mjs
git commit -m "site.js: כותרת ותחתית ממקור אחד לכל העמודים"
```

---

## Task 6: `site.js` — בורר שפה ושחרור התנועות

**Files:**
- Modify: `site.js`
- Modify: `site.css`
- Modify: `scripts/validate.mjs`

**Interfaces:**
- Consumes: `nuikaHeader` מ-Task 5, ו-`.rise .fade .reveal` מ-Task 4
- Produces: `window.nuikaLang(next)` שמחליף שפה ושומר ב-`localStorage` תחת המפתח `nuika-lang` · משחרר `.is-in` דרך `IntersectionObserver`

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

בבלוק של `site.js` ב-`--design`:

```js
    for (const [needle, why] of [
      ['nuika-lang',            'the chosen language is remembered per device'],
      ['lang-content',          'the same attribute the shop already uses'],
      ['IntersectionObserver',  'movements are released when they reach the screen'],
      ['prefers-reduced-motion','reduced motion is honoured in script too, not only in CSS'],
      ['is-in',                 'the release class the stylesheet waits for'],
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
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --design
```

צפוי: חמש שורות `FAIL  missing "..."` ו-`FAIL the language switch never sets document direction`.

- [ ] **Step 3: להוסיף ל-`site.js`**

לפני `window.nuikaHeader = nuikaHeader;`:

```js
  /* ---------- language ---------- */
  /* The shop already toggles with lang-content="he" / "en" attributes. The new
     pages use the same attribute so there is one idea to learn, not two. */

  var LANG_KEY = 'nuika-lang';

  function readLang() {
    try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'he'; }
    catch (e) { return 'he'; }   /* private mode throws rather than returning null */
  }

  function nuikaLang(next) {
    var lang = next === 'en' ? 'en' : 'he';
    var root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');

    var nodes = document.querySelectorAll('[lang-content]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].hidden = nodes[i].getAttribute('lang-content') !== lang;
    }

    var btn = document.querySelector('[data-nuika-lang]');
    if (btn) {
      btn.textContent = lang === 'he' ? 'EN' : 'עב';
      btn.setAttribute('aria-label', lang === 'he' ? 'Switch to English' : 'החלף לעברית');
    }

    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* nothing to do */ }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-nuika-lang]');
    if (btn) nuikaLang(readLang() === 'he' ? 'en' : 'he');
  });

  /* ---------- releasing the movements ---------- */
  /* Someone who asked for less motion gets the final state immediately. The
     CSS already renders it; this makes sure the script never undoes that. */

  function releaseMotion() {
    var targets = document.querySelectorAll('.rise, .fade, .reveal');
    var quiet = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (quiet || !('IntersectionObserver' in window)) {
      for (var i = 0; i < targets.length; i++) targets[i].classList.add('is-in');
      return;
    }

    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        seen.unobserve(entry.target);   /* one movement per element, never a loop */
      });
    }, { rootMargin: '0px 0px -12% 0px' });

    for (var j = 0; j < targets.length; j++) seen.observe(targets[j]);
  }
```

ובתוך `mount()`, בסוף:

```js
    nuikaLang(readLang());
    releaseMotion();
```

ולצד הייצוא הקיים:

```js
  window.nuikaLang = nuikaLang;
```

- [ ] **Step 4: להוסיף ל-`site.css` את הכלל שמסתיר את השפה שאינה פעילה**

```css
/* Both languages live in the page and one of them is hidden, exactly as the
   shop already does it. [hidden] needs the explicit rule because the elements
   are inline and some resets override the browser default. */
[lang-content][hidden] { display: none !important; }
```

- [ ] **Step 5: להריץ ולוודא שעוברת**

```bash
node scripts/validate.mjs --design
```

צפוי: חמש שורות `ok` ו-`ok the language switch flips the document direction`.

- [ ] **Step 6: לאמת בדפדפן**

לפתוח את דף הבדיקה הזמני מ-Task 5 עם Playwright ולאמת:
- בטעינה: `document.documentElement.dir === 'rtl'` והפריט הראשון בתפריט מציג `הסיפור`
- אחרי לחיצה על `[data-nuika-lang]`: `dir === 'ltr'`, הפריט מציג `Story`, והכפתור מציג `עב`
- אחרי רענון: העמוד נשאר באנגלית (נשמר ב-`localStorage`)
- עם `browser_emulate_media` ל-`prefers-reduced-motion: reduce`: לכל `.rise` יש `is-in` מיד בטעינה, בלי גלילה

- [ ] **Step 7: הרצה מלאה וקומיט**

```bash
node scripts/validate.mjs
```

צפוי: `All checks passed.` — כולל כל בדיקות החנות הקיימות.

```bash
git add site.js site.css scripts/validate.mjs
git commit -m "site.js: בורר שפה שנזכר, ושחרור תנועות שמכבד הפחתת תנועה"
```

---

## סיום התוכנית

בסוף שש המשימות קיימים בריפו `site.css`, `site.js`, `images/logo.png` ו-`images/umbel.png`, ושלב `--design` ב-CI שומר עליהם. **אף עמוד עדיין לא משתמש בהם, ו-`index.html` לא נגעו בו** — סיכון אפס לחנות.

לפרסם עם:

```bash
node scripts/status.mjs
node scripts/ship.mjs "שכבת בסיס לאתר החדש: עיצוב, סקריפט משותף ונכסי לוגו"
```

**התוכנית הבאה:** Plan 2 — הסרט (מפת השוטים, העריכה האנכית, שתי הקידודים ותמונת הפתיחה).

---

## Self-Review

**כיסוי המפרט.** התוכנית הזאת מכסה את §7 במלואו (מערכת העיצוב: §7.1 צבע → Task 2, §7.2 טיפוגרפיה → Task 3, §7.3 כפתורים ו-§7.4 תנועה → Task 4, §7.5 לוגו → Task 1, §7.6 כותרת ותחתית → Task 5) ואת חלק מ-§3.1 (משמעת RTL ובידוד לטיני → Task 3, בורר שפה → Task 6). השאר מכוסה בתוכניות 2–5, לפי הפירוק למטה.

**פירוק המפרט לחמש תוכניות.** המפרט גדול מכדי לייצר תוכנית אחת שאפשר לבצע בלי שתאבד דיוק. הגבולות נגזרים מ-§9 של המפרט עצמו:

| תוכנית | מכסה | מה מסתיים בסופה |
|---|---|---|
| **1 — בסיס** (זו) | §7, §3.1 | שכבה משותפת + שומרים ב-CI |
| **2 — הסרט** | §4.1, §4.2 | הסרט מתנגן נכון במחשב ובטלפון |
| **3 — העמודים** | §4, §5.1, §5.2, §5.4, §6.2 | בית, סיפור, גלריה, קשר — חיים ולא מקושרים |
| **4 — אירועים** | §5.3, §6.1 | נוי מוסיפה אירוע והוא מופיע |
| **5 — ההחלפה** | §8, §9 | האתר החדש הוא האתר |

**סריקת מצייני מקום.** אין `TBD`, אין "להוסיף טיפול בשגיאות", ואין "כמו משימה N". כל צעד שדורש קוד מכיל את הקוד.

**עקביות טיפוסים.** `nuikaHeader(active)` מוגדרת ב-Task 5 ונצרכת ב-Task 6 באותו שם. מפתחות התפריט (`story`, `gallery`, `events`, `contact`) זהים ב-`NAV` וב-`data-nuika-header`. מחלקות התנועה (`.rise`, `.fade`, `.reveal`) ומחלקת השחרור (`is-in`) מוגדרות ב-Task 4 ונצרכות ב-Task 6 באותם שמות. `LANG_KEY` הוא `'nuika-lang'` גם בקוד וגם בבדיקה.
