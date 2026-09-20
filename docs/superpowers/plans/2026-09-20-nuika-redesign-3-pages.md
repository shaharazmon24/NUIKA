# NUIKA Redesign — Plan 3: The Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** לבנות ארבעה עמודים — בית, סיפור, גלריה וקשר — שעולים לאוויר על הדומיין האמיתי **בלי שאף אחד מקשר אליהם**, כך שאפשר לראות ולבדוק את האתר החדש בזמן שהחנות ממשיכה לקבל הזמנות.

**Architecture:** כל עמוד הוא קובץ סטטי שטוען `site.css` ו-`site.js`, מצהיר איפה הכותרת והתחתית נכנסות, וכותב את הפריסה שלו תחת קידומת מחלקות משלו. אין שלב בנייה, אין framework, ואין Firebase באף אחד מארבעת העמודים האלה.

**Tech Stack:** HTML/CSS/JS סטטיים. Google Fonts כ-CDN. `scripts/validate.mjs` הוא מערכת הבדיקות, ואין `node_modules`.

---

## Global Constraints

מתוך `docs/superpowers/specs/2026-09-20-nuika-redesign-design.md`. חלים על **כל** משימה:

- **`index.html` לא נוגעים בו בתוכנית הזאת בכלל.** הוא החנות החיה עם הזמנות אמיתיות. עמוד הבית החדש נבנה בשם **`home.html`** ומשנה שם רק בתוכנית 5.
- **`CNAME` לא נוגעים בו.**
- **פרסום רק דרך `node scripts/ship.mjs`.** אף פעם לא `git push` ישיר.
- **אף עמוד לא מקושר מ-`index.html`.** הם באוויר ולא נגישים אלא למי שמקליד את הכתובת.
- **`node scripts/validate.mjs` חייב להסתיים ב-`All checks passed.`** — `deploy.yml` מתנה בזה את העלייה לאתר החי, כך שקומיט שנכשל עוצר את הפרסום של החנות.
- **ריווח כהתחלה/סוף בלבד** (`margin-inline-start`, `padding-block`, `inset-inline`). הבדיקה ב-`--design` חוסמת `left`/`right` פיזי ב-`site.css`; אותו כלל חל על כל עמוד.
- **כל רצף לטיני בתוך עברית** מקבל את המחלקה `.ltr`.
- **נתיבים יחסיים בלבד** (`./`).
- **`prefers-reduced-motion` מקבל את המצב הסופי**, לא הנפשה מהירה יותר.
- **קידומת מחלקות לכל עמוד** — `.st-` לסיפור, `.gl-` לגלריה, `.ct-` לקשר, `.hm-` לבית. מחלקה גנרית בת אות אחת התנגשה בפועל במוקאפים ועיוותה עמוד שלם.
- **הטקסט של נוי הוא שלה, מילה במילה.** לא לנסח מחדש, לא לקצר, לא "לשפר".

### מה שכבר קיים ואסור לשכפל

| מה | איפה | איך משתמשים |
|---|---|---|
| צבע, טיפוגרפיה, כפתורים, תנועה | `site.css` | אסימונים ומחלקות. עמוד לא מגדיר צבע משלו. |
| כותרת ותחתית | `site.js` | `<header class="nu-header" data-nuika-header="<key>">` ו-`<footer class="nu-footer" data-nuika-footer>` |
| מעבר עברית/אנגלית | `site.js` | `lang-content="he"` / `lang-content="en"` על כל טקסט |
| שחרור תנועות | `site.js` | המחלקות `.rise` `.fade` `.reveal`; `site.js` מוסיף `is-in` בגלילה |
| תוכן שנטען מאוחר | `site.js` | `window.nuikaRefresh()` — חובה אחרי הזרקת HTML דו-לשוני |
| הסרט | `media/film-desktop.mp4`, `media/film-phone.mp4` | ‎1600×602 ו-‎720×1280, שניהם 128.71 שניות |
| תמונות פתיחה | `media/film-poster.jpg`, `media/film-poster-phone.jpg` | |
| גלריה | `images/gallery/gallery.json` | 24 רשומות `{file, thumb, tag, alt:{he,en}}` |
| לוגו | `images/logo.png` (1915×703), `images/umbel.png` | **לעולם לא מתחת ל-130px רוחב** |

**מפתחות התפריט:** `story` · `gallery` · `events` · `contact`. עמוד הבית לא מסמן אף אחד מהם.

---

## File Structure

| קובץ | אחריות |
|---|---|
| `home.html` | **נוצר.** מסך אחד, בלי גלילה, הסרט ממלא אותו. הופך ל-`index.html` בתוכנית 5. |
| `story.html` | **נוצר.** גלילה אחת בארבע תנועות. הטקסט של נוי. |
| `gallery.html` | **נוצר.** רשת עורכית מ-`gallery.json`, ותצוגה מוגדלת. |
| `contact.html` | **נוצר.** טופס שמרכיב הודעת וואטסאפ בצד הלקוח. |
| `scripts/validate.mjs` | **משתנה.** שלב `--pages` חדש. השלבים הקיימים לא נגעים. |
| `.github/workflows/validate.yml` | **משתנה.** שורה אחת. |

**גבולות:** הפריסה של כל עמוד חיה בתוך אותו עמוד, בתוך `<style>` עם קידומת המחלקות שלו. `site.css` לא גדל בתוכנית הזאת — אם משהו נדרש בשני עמודים, זה סימן שהוא שייך ל-`site.css`, ואז הוא נכנס לשם עם בדיקה משלו.

---

## Task 1: שלד עמוד, והבדיקה שאוכפת אותו

**Files:**
- Create: `home.html` (שלד בלבד — הסרט מגיע ב-Task 2)
- Modify: `scripts/validate.mjs`, `.github/workflows/validate.yml`

**Interfaces:**
- Consumes: `site.css`, `site.js`, `images/logo.png`
- Produces: שלב `node scripts/validate.mjs --pages`, והתבנית שכל עמוד אחר בתוכנית הזאת חוזר עליה

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

בסוף `scripts/validate.mjs`, לפני בלוק ה-`if (failed)` הסופי:

```js
if (want('pages')) {
  console.log('New pages:');

  // Every page of the new site shares one skeleton. These are not style
  // preferences: each line below is something that silently breaks the page
  // for somebody if it is missing.
  const PAGES = ['home.html', 'story.html', 'gallery.html', 'contact.html'];

  for (const page of PAGES) {
    const p = join(ROOT, page);
    if (!existsSync(p)) { fail(`${page} is missing`); continue; }
    const h = readFileSync(p, 'utf8');
    const need = (re, why) => re.test(h) ? pass(`${page}: ${why}`) : fail(`${page}: ${why}`);

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
    const hex = [...h.matchAll(/(?:color|background)\s*:\s*(#[0-9A-Fa-f]{3,6})/g)].map(m => m[1]);
    if (hex.length) fail(`${page}: writes raw colours (${[...new Set(hex)].join(', ')}) instead of using the tokens`);
    else pass(`${page}: takes every colour from site.css`);

    // The same rule site.css lives under. The English flip has to work by
    // itself, in the page's own styles too.
    const physical = /\b(?:margin|padding|border)-(?:left|right)\b|\btext-align\s*:\s*(?:left|right)\b/;
    const bad = h.split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => physical.test(line) && !line.includes('rtl-ok'))
      .map(({ n }) => n);
    if (bad.length) fail(`${page}: physical left/right on line(s) ${bad.join(', ')} — use the -inline- form or mark the line /* rtl-ok */`);
    else pass(`${page}: no physical left/right`);
  }

  // Until Plan 5 renames things, nothing may link the new pages from the shop.
  // A customer who finds a half-built page has found a bug, not a preview.
  const shop = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const leaked = PAGES.filter(p => shop.includes(p));
  if (leaked.length) fail(`index.html links to ${leaked.join(', ')} — the new pages are not public yet`);
  else pass('the shop links to none of the new pages');
}
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --pages
```

צפוי: `FAIL  home.html is missing` וכן לשלושת האחרים, ויציאה בקוד 1.

- [ ] **Step 3: לכתוב את `home.html` כשלד**

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>NUIKA — נואיקה</title>
  <meta name="description" content="מאפייה ארטיזנלית של אישה אחת ברחובות. לחמים, מאפים ומתוקים, בכמויות מוגבלות.">

  <!-- Loaded here, not with @import, which would block rendering. Bellefair
       carries real Hebrew; without this the page quietly falls back to Times. -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bellefair&family=IBM+Plex+Sans+Hebrew:wght@200;300;400;500&display=swap">
  <link rel="stylesheet" href="./site.css">

  <style>
    /* The home page's own layout. Prefixed .hm- so nothing here can collide
       with another page's styles — a one-letter class did exactly that once. */
    .hm-screen {
      position: relative;
      min-block-size: 100svb;
      display: grid;
      grid-template-rows: auto 1fr auto;
    }
  </style>
</head>
<body>
  <div class="hm-screen">
    <header class="nu-header nu-header--on-film" data-nuika-header=""></header>
    <main></main>
    <footer class="nu-footer" data-nuika-footer></footer>
  </div>
  <script src="./site.js"></script>
</body>
</html>
```

- [ ] **Step 4: להריץ ולראות איזה חלק מהבדיקות עובר**

```bash
node scripts/validate.mjs --pages
```

צפוי: כל הבדיקות של `home.html` עוברות, ושלושת העמודים האחרים עדיין `FAIL ... is missing`. זה תקין — הם נבנים במשימות 3, 4 ו-5.

- [ ] **Step 5: לוודא שהשומרים באמת שומרים**

שלוש שבירות מכוונות, אחת בכל פעם, עם הרצה וחזרה בין לבין:

1. להוסיף ל-`<style>` ב-`home.html` את השורה `.hm-screen { color: #333; }` → צפוי `FAIL home.html: writes raw colours (#333)`. למחוק.
2. להוסיף `.hm-screen { margin-left: 4px; }` → צפוי `FAIL home.html: physical left/right on line(s) N`. למחוק.
3. להוסיף ל-`index.html` **זמנית** את המחרוזת `home.html` בתוך הערה → צפוי `FAIL index.html links to home.html`. **למחוק, ולוודא ש-`git diff index.html` ריק.**

השלישית היא החשובה: היא השומר היחיד שמונע מעמוד חצי בנוי להגיע ללקוחה.

- [ ] **Step 6: לחבר ל-CI**

ב-`.github/workflows/validate.yml`, אחרי השלב `Check the design system`:

```yaml
      - name: Check the new pages
        run: node scripts/validate.mjs --pages
```

- [ ] **Step 7: קומיט**

```bash
git add home.html scripts/validate.mjs .github/workflows/validate.yml
git commit -m "שלד עמוד משותף, ובדיקה שאוכפת אותו על כל העמודים החדשים"
```

---

## Task 2: `home.html` — הסרט

**Files:**
- Modify: `home.html`
- Modify: `scripts/validate.mjs`

**Interfaces:**
- Consumes: `media/film-desktop.mp4`, `media/film-phone.mp4`, `media/film-poster.jpg`, `media/film-poster-phone.jpg`
- Produces: עמוד בית שלם

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

בתוך `if (want('pages'))`, אחרי הלולאה על העמודים:

```js
  console.log('The home page and its film:');
  const home = readFileSync(join(ROOT, 'home.html'), 'utf8');
  const homeNeed = (re, why) => re.test(home) ? pass(why) : fail(why);

  homeNeed(/media\/film-desktop\.mp4/, 'the desktop cut is referenced');
  homeNeed(/media\/film-phone\.mp4/,   'the phone cut is referenced — the vertical re-edit, not the desktop one squeezed');
  homeNeed(/poster=/,                  'a poster stands in before the film plays, and instead of it when it cannot');
  homeNeed(/\bmuted\b/,                'muted, or no browser will autoplay it');
  homeNeed(/\bplaysinline\b/,          'plays inline, or iOS takes it fullscreen on its own');
  homeNeed(/visibilitychange/,         'pauses when the tab is not being looked at, rather than burning a stranger\'s data in the background');
  homeNeed(/saveData/,                 'honours Save-Data');
  homeNeed(/prefers-reduced-motion/,   'honours reduced motion');
  homeNeed(/\.play\(\)[\s\S]{0,120}catch/, 'survives a refused autoplay instead of throwing — iOS low power mode refuses');

  // The film is 25MB across two files. A service worker that caches it fills a
  // phone's storage quota and gets the whole cache evicted, shop included.
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  if (/\.mp4/.test(sw) && !/mp4[\s\S]{0,200}return/.test(sw))
    fail('sw.js mentions .mp4 without skipping it — see the spec, this evicts the shop from the cache');
  else pass('the service worker does not try to store the film');
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --pages
```

צפוי: תשע שורות `FAIL` על הסרט.

- [ ] **Step 3: להוסיף את הסרט ל-`home.html`**

בתוך `<main>`:

```html
    <!-- Two cuts, not one file scaled. A phone frame keeps about a fifth of
         the picture's width, so the phone cut is a real vertical re-edit with
         its own window on each of the film's 52 shots. `media` picks between
         them before either is fetched, so only one is ever downloaded. -->
    <video class="hm-film" id="hm-film"
           muted playsinline preload="metadata"
           poster="./media/film-poster.jpg"
           aria-hidden="true">
      <source src="./media/film-phone.mp4"   type="video/mp4" media="(max-width: 720px)">
      <source src="./media/film-desktop.mp4" type="video/mp4">
    </video>
```

ב-`<style>`:

```css
    .hm-film {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      z-index: 0;
    }

    /* The film is bright and the text sits on it. Without this the words are
       unreadable wherever a shot happens to be pale — and half of them are. */
    .hm-screen::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 1;
      background:
        linear-gradient(to bottom, rgba(59, 42, 36, .45), rgba(59, 42, 36, .12) 38%, rgba(59, 42, 36, .68));
      pointer-events: none;
    }

    .hm-screen > * { position: relative; z-index: 2; }
```

ולפני `</body>`, אחרי `site.js`:

```html
  <script>
    // The film is decoration. Everything below is about not making it a cost
    // to somebody who did not ask for it.
    (function () {
      var film = document.getElementById('hm-film');
      if (!film) return;

      var quiet = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var thrifty = navigator.connection && navigator.connection.saveData;

      if (quiet || thrifty) {
        // The poster already shows. Do not fetch 10-14MB to replace it.
        film.removeAttribute('preload');
        film.setAttribute('preload', 'none');
        return;
      }

      film.play().catch(function () {
        // iOS in low power mode refuses autoplay outright. The poster is
        // already on screen and stays; there is nothing to recover from.
      });

      // A film playing to nobody is somebody's data and somebody's battery.
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) film.pause();
        else film.play().catch(function () {});
      });
    })();
  </script>
```

- [ ] **Step 4: להריץ ולוודא שעוברת**

```bash
node scripts/validate.mjs --pages
```

צפוי: תשע שורות `ok` על הסרט, ו-`ok the service worker does not try to store the film`.

- [ ] **Step 5: לבדוק בדפדפן אמיתי, בשני גדלים**

להגיש את הריפו משרת סטטי מקומי ולפתוח את `home.html`. `file:///` חסום לכלי הדפדפן.

לאמת, ולרשום את הערכים שחזרו:

| מה | איך | הציפייה |
|---|---|---|
| הקובץ הנכון בכל מסך | `browser_resize` ל-375 רוחב ואז ל-1280, ורענון | `currentSrc` מכיל `film-phone` ב-375 ו-`film-desktop` ב-1280 |
| מתנגן | `video.paused` אחרי שנייה | `false` |
| מתקדם | `currentTime` אחרי שתי שניות | גדול מ-1 |
| ממלא את המסך | `getBoundingClientRect()` של `.hm-film` | רוחב וגובה שווים לחלון |
| נעצר כשלא מסתכלים | להריץ `document.dispatchEvent(new Event('visibilitychange'))` אחרי הגדרת `document.hidden` | `paused === true` |
| הפחתת תנועה | `browser_emulate_media` ל-`prefers-reduced-motion: reduce`, ורענון | `paused === true`, והתמונה מוצגת |
| הכותרת נטענה | `document.querySelectorAll('.nu-nav__item').length` | `4` |

**השורה השנייה בטבלה היא העיקר.** אם `currentSrc` בטלפון מצביע על `film-desktop`, המבקר מוריד קובץ גדול יותר **ורואה חמישית מהתמונה** — כלומר כל העבודה על 52 החלונות ירדה לטמיון בשקט.

- [ ] **Step 6: קומיט**

```bash
git add home.html scripts/validate.mjs
git commit -m "עמוד הבית: הסרט במסך מלא, עם הגרסה הנכונה לכל מסך"
```

---

## Task 3: `home.html` — המשפט, הכפתורים והרשתות

**Files:**
- Modify: `home.html`
- Modify: `scripts/validate.mjs`

**Interfaces:**
- Consumes: `.btn--on-film`, `.btn--ghost`, `.rise` מ-`site.css`
- Produces: עמוד הבית השלם, כפי שאושר בחלק 2 של העיצוב

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

```js
  console.log('The home page\'s words:');
  // Noy's own sentence, chosen in the design review. Not a placeholder.
  homeNeed(/אופה מה שאני הכי רוצה לאכול/, 'carries the line the design settled on');
  homeNeed(/I bake what I most want to eat/, 'and its English');
  homeNeed(/למאפייה של NUIKA/, 'the way into the shop');
  homeNeed(/btn--on-film/, 'the primary button is the cream one — terracotta is unreadable over a moving picture');
  homeNeed(/shop\.html/, 'the shop button points at shop.html, the name it takes in Plan 5');
  homeNeed(/instagram\.com\/nuika_bread/, 'the real Instagram handle');
  homeNeed(/wa\.me\/972547382282/, 'the real WhatsApp number, not a placeholder');

  // The home page is the one screen with no scroll. A stray scroll container
  // turns it into a page that almost scrolls, which reads as broken.
  if (/overflow\s*:\s*auto|overflow\s*:\s*scroll/.test(home))
    fail('home.html declares a scrolling overflow — the home page is one screen');
  else pass('nothing on the home page scrolls');
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --pages
```

צפוי: שבע שורות `FAIL` על הטקסט.

- [ ] **Step 3: לכתוב את התוכן**

בתוך `<main>`, אחרי ה-`<video>`:

```html
      <div class="hm-mid rise">
        <p class="hm-line u-giant">
          <span lang-content="he">אופה מה שאני הכי רוצה לאכול</span>
          <span lang-content="en">I bake what I most want to eat</span>
        </p>
        <div class="hm-acts">
          <a class="btn btn--on-film" href="./shop.html">
            <span lang-content="he">למאפייה של NUIKA</span>
            <span lang-content="en">To the NUIKA bakery</span>
          </a>
          <a class="btn btn--ghost" href="./contact.html">
            <span lang-content="he">דברו איתי</span>
            <span lang-content="en">Talk to me</span>
          </a>
        </div>
      </div>
```

ב-`<style>`:

```css
    .hm-mid {
      align-self: end;
      justify-self: center;
      text-align: center;
      color: var(--cream);
      padding-inline: 20px;
      padding-block-end: clamp(28px, 7vh, 72px);
      display: grid;
      gap: clamp(18px, 3vh, 34px);
      justify-items: center;
      max-inline-size: 22ch;
    }

    .hm-line { margin: 0; }
    .hm-acts { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
```

**הערה למבצע:** התחתית של עמוד הבית כבר מכילה את קישורי הרשתות, כי `nuikaFooter()` בונה אותם. אין צורך לכתוב אותם שוב — ואם נכתוב, יהיו שני עותקים שיצאו מסונכרן.

- [ ] **Step 4: להריץ ולוודא שעוברת**

```bash
node scripts/validate.mjs --pages
```

- [ ] **Step 5: לבדוק בדפדפן, ולהסתכל**

באותו שרת מקומי, בשני גדלים — 375 רוחב ו-1280.

לאמת בקריאה:
- `getComputedStyle(document.querySelector('.hm-line')).color` הוא `rgb(246, 240, 228)`
- אחרי `Tab` אל הכפתור הראשון, `outlineColor` הוא `rgb(246, 240, 228)` ולא הטרקוטה
- `document.body.scrollHeight <= window.innerHeight + 2` — העמוד באמת לא נגלל
- אחרי לחיצה על בורר השפה: המשפט מציג `I bake what I most want to eat`, ו-`documentElement.dir` הוא `ltr`

**ולצלם את שני הגדלים ולהסתכל עליהם.** הבדיקות יאשרו שהצבעים והמידות נכונים; הן לא יאשרו שהמשפט קריא מעל הצילום. זה דורש עין.

- [ ] **Step 6: קומיט**

```bash
git add home.html scripts/validate.mjs
git commit -m "עמוד הבית: המשפט של נוי, שני הכפתורים, ובלי גלילה"
```

---

## Task 4: `story.html`

**Files:**
- Create: `story.html`
- Modify: `scripts/validate.mjs`

**Interfaces:**
- Consumes: השלד מ-Task 1, `.rise` `.fade` `.reveal`, ופריימים מ-`images/gallery/`
- Produces: עמוד הסיפור

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

```js
  console.log('The story:');
  const story = readFileSync(join(ROOT, 'story.html'), 'utf8');
  const storyNeed = (s, why) => story.includes(s) ? pass(why) : fail(why);

  // Noy wrote this about herself. It is quoted, not adapted — a paraphrase
  // here would be putting words in a real person's mouth on her own website.
  storyNeed('אני קודם כל בודקת מה אני בעצמי הכי הייתי רוצה לאכול', 'movement 1, in her words');
  storyNeed('אשכרה', 'movement 2 ends on her word');
  storyNeed('זאת מאפייה של אישה אחת', 'movement 3, in her words');
  storyNeed('הכל נגמר מהר. אז יאללה', 'movement 3 ends on her line');
  storyNeed('לא מושחת', 'movement 4, in her words');
  storyNeed('רוב הקמחים מלאים', 'the first of the three claims');
  storyNeed('תמיד אמעיט בסוכר', 'the second');
  storyNeed('מתוק מדי', 'the third');
  storyNeed('shop.html', 'a way into the shop from the end of the story');

  const moves = (story.match(/class="[^"]*st-move/g) || []).length;
  if (moves === 4) pass('four movements, as the design settled');
  else fail(`the story has ${moves} movements, not 4`);
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --pages
```

צפוי: `FAIL story.html is missing` והשורות שאחריה.

- [ ] **Step 3: לכתוב את `story.html`**

להעתיק את השלד מ-`home.html` (אותו `<head>`, אותו `data-nuika-header` — הפעם עם הערך `"story"` — ואותה תחתית), ולכתוב ארבע תנועות. כל תנועה היא `<section class="st-move">`.

הטקסט של נוי, מילה במילה, בחלוקה שסוכמה:

1. **פתיחה**, על פריים במסך מלא: *"כשאני בונה תפריט, או חושבת מה להכין לכם לשבוע הקרוב, אני קודם כל בודקת מה אני בעצמי הכי הייתי רוצה לאכול הסופ״ש."*
2. **איך נבנה תפריט**, טקסט לצד תמונה: *"משם אני חושבת ומחשבת איזה חומרי גלם יעבדו הכי טוב ביחד בעונה הזאת, בשבוע הזה, ביום הזה — וישר אני יוצאת ללקט אותם. מי שמכיר אותי יודע שאני לא ממש מחפשת להכין את מה שכולם מכירים, אלא טעמים ושילובים שגורמים לחשוב, לעצור באמצע הביס ולהגיד"* — ואז **"אשכרה."** לבד, ב-`.u-giant` ובצבע `var(--terra)`, עם המחלקה `.reveal`.
3. **מאפייה של אישה אחת**, טקסט על פריים כהה: *"כל שבוע יוצא מהמטבח שלי מבחר שמלווה אתכם מיום שישי ולאורך כל השבת — לחם שנפרס כבר ברגע שנכנסתם הביתה ופשוט לא מצליחים להפסיק לאכול ממנו, מאפה מעניין וטעים שרק בא שכולם יטעמו ממנו, או עוגיות מפנקות ששותים קפה רק בשבילן. זאת מאפייה של אישה אחת, ככה שאתם יכולים לדעת בוודאות שמה שאתם בוחרים נעשה באהבה עמוקה והנאה ענקית למקצוע ולאהבת אנשים ואוכל טעים. מה שכן, בגלל זה הכמויות גם מאוד מוגבלות, והכל נגמר מהר. אז יאללה."* — והמשפט האחרון ב-`.u-giant`, ומתחתיו `<a class="btn btn--on-film" href="./shop.html">`.
4. **הפילוסופיה**, רקע `var(--wheat)`: *"הפילוסופיה שלי כטבחית ואופה היא שאוכל יכול להיות טעים ברמות לא הגיוניות וגם להיות מאוד נכון ונעים לבטן. בואו נגיד שאם אתם מחפשים מושחת, זה לא המקום. אבל זה כן המקום ללחמים, מאפים ומתוקים שבאמת נכונים לגוף ובאותה עת טעימים לא נורמלי."* — ומתחתיו שלוש הטענות בשורה: *"אני תמיד אשתמש ברוב של קמחים מלאים"*, *"תמיד אמעיט בסוכר"*, *"לעולם לא נאמר על מאפה שלי 'מתוק מדי'"*.

**כל טקסט מקבל גם `lang-content="en"` בתרגום.** התרגום הוא תרגום — לא ניסוח מחדש של הרעיון באנגלית.

**התמונות:** מתוך `images/gallery/`. `noy-by-the-window.jpg` לפתיחה, `plums-glistening.jpg` לתנועה 2, `seeded-dough-balls.jpg` לתנועה 3. הן כבר מוקטנות ומאומתות.

הפריסה תחת קידומת `.st-`, בתוך `<style>` בעמוד.

- [ ] **Step 4: להריץ ולוודא שעוברת**

```bash
node scripts/validate.mjs --pages
```

- [ ] **Step 5: לבדוק בדפדפן**

- לגלול מלמעלה למטה ולצלם כל תנועה, בשני גדלים. **להסתכל.**
- לאמת ש-`.reveal` על "אשכרה" מקבל `is-in` רק אחרי שגוללים אליו, ושב-`prefers-reduced-motion` הוא גלוי מיד בלי גלילה
- לוודא שהטקסט קריא מעל כל תמונה — במיוחד בתנועה 3, שם הוא יושב על צילום

- [ ] **Step 6: קומיט**

```bash
git add story.html scripts/validate.mjs
git commit -m "עמוד הסיפור: ארבע תנועות, בטקסט של נוי"
```

---

## Task 5: `gallery.html`

**Files:**
- Create: `gallery.html`
- Modify: `scripts/validate.mjs`

**Interfaces:**
- Consumes: `images/gallery/gallery.json` — 24 רשומות `{file, thumb, tag, alt:{he,en}}`
- Produces: עמוד הגלריה

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

```js
  console.log('The gallery:');
  const gal = readFileSync(join(ROOT, 'gallery.html'), 'utf8');
  const galNeed = (re, why) => re.test(gal) ? pass(why) : fail(why);

  galNeed(/gallery\.json/, 'reads the manifest instead of hardcoding the list');
  galNeed(/\.thumb\b|thumb\]/, 'the grid loads thumbnails — 24 full images is 2MB for a page of small squares');
  galNeed(/alt\s*=|\.alt\b/, 'every image carries its alt text');
  galNeed(/nuikaRefresh/, 'calls nuikaRefresh after injecting, or the injected markup shows both languages at once');
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
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --pages
```

- [ ] **Step 3: לכתוב את `gallery.html`**

השלד מ-Task 1, עם `data-nuika-header="gallery"`, ובתוכו:

- כותרת, ושורת מסננים **שנבנית מהערכים הייחודיים של `tag`** ב-`gallery.json`. אם כולם זהים, השורה לא מוצגת בכלל.
- רשת `.gl-grid`, נבנית מה-JSON. אריחים ברוחב משתנה ובגובה אחיד — **בלי אריחים גבוהים**, מהסיבה שבבדיקה.
- לחיצה פותחת תצוגה מוגדלת: התמונה המלאה, ה-`alt` כתיאור, וחיצים. `Escape` סוגר. המיקוד חוזר לאריח שממנו נפתחה.
- אחרי הזרקת הרשת — `window.nuikaRefresh()`.

תוויות המסננים: `bread` → לחמים / Breads · `sweet` → מתוקים / Sweets · `kitchen` → מהמטבח / From the kitchen.

- [ ] **Step 4: להריץ ולוודא שעוברת**

- [ ] **Step 5: לבדוק בדפדפן**

- כל 24 האריחים מופיעים; `document.querySelectorAll('.gl-tile').length === 24`
- לחיצה על מסנן מצמצמת, ולחיצה על "הכל" מחזירה
- לחיצה על אריח פותחת, `Escape` סוגר, והמיקוד חזר לאריח
- החיצים עוברים תמונה, ועוצרים או מתגלגלים בקצוות — **לבדוק את שניהם, לא להניח**
- במעבר לאנגלית, ה-`alt` של תמונה נבדקת משתנה לאנגלית
- לצלם את הרשת בשני גדלים ו**להסתכל** — אריח שחותך מאפה לחצי זה משהו שהבדיקות לא יתפסו

- [ ] **Step 6: קומיט**

```bash
git add gallery.html scripts/validate.mjs
git commit -m "עמוד הגלריה: רשת מהקטלוג, עם תצוגה מוגדלת"
```

---

## Task 6: `contact.html`

**Files:**
- Create: `contact.html`
- Modify: `scripts/validate.mjs`

**Interfaces:**
- Consumes: השלד מ-Task 1
- Produces: עמוד הקשר

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

```js
  console.log('Contact:');
  const ct = readFileSync(join(ROOT, 'contact.html'), 'utf8');
  const ctNeed = (re, why) => re.test(ct) ? pass(why) : fail(why);

  ctNeed(/wa\.me\/972547382282/, 'the real WhatsApp number');
  ctNeed(/encodeURIComponent/, 'the message is encoded, or a line break or an ampersand truncates it');
  ctNeed(/instagram\.com\/nuika_bread/, 'the Instagram handle');

  // The form composes a message and hands it to WhatsApp. It must not post
  // anywhere: there is no server, and a second copy of a customer's name and
  // phone number is a liability nobody asked for.
  if (/<form[^>]+action=/.test(ct)) fail('the form has an action — it must not submit anywhere');
  else pass('the form submits nowhere; it composes a WhatsApp message');
  if (/fetch\s*\(|XMLHttpRequest/.test(ct)) fail('contact.html sends a request somewhere');
  else pass('contact.html sends nothing');

  // Same exposure the shop's admin panel was hardened against.
  if (/innerHTML/.test(ct) && !/esc\(/.test(ct))
    fail('contact.html writes innerHTML without escaping');
  else pass('no unescaped innerHTML');
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

- [ ] **Step 3: לכתוב את `contact.html`**

השלד מ-Task 1, עם `data-nuika-header="contact"`, ובתוכו שתי עמודות: טופס מצד אחד, ופריים מהסרט והקישורים הישירים מהצד השני.

הטופס: שם, טלפון, נושא (הזמנה / אירוע / סדנה / שאלה), והודעה. הכפתור **מרכיב** מחרוזת ופותח `https://wa.me/972547382282?text=...` דרך `encodeURIComponent`. **אין `action`, אין `fetch`, ואין שליחה.**

מתחת לכפתור, משפט שאומר את האמת בפשטות: *"ההודעה נפתחת אצלכם בוואטסאפ. שום דבר לא נשלח בלי שתלחצו."*

הקישורים הישירים: וואטסאפ `972547382282`, אינסטגרם `nuika_bread`, ואיסוף מרחובות בימי שישי. כל רצף לטיני ב-`.ltr`.

- [ ] **Step 4: להריץ ולוודא שעוברת**

- [ ] **Step 5: לבדוק בדפדפן**

- למלא את הטופס ולוודא שה-`href` שנבנה מכיל את כל השדות, **כולל שורה חדשה ותו `&` בהודעה** — אלה בדיוק התווים ששוברים כתובת לא מקודדת
- לוודא ש**לא יוצאת אף בקשת רשת** בלחיצה: `browser_network_requests` לפני ואחרי
- לבדוק את הטופס במקלדת בלבד, מהשדה הראשון ועד הכפתור
- לצלם בשני גדלים

- [ ] **Step 6: קומיט**

```bash
git add contact.html scripts/validate.mjs
git commit -m "עמוד הקשר: טופס שמרכיב הודעת וואטסאפ ולא שולח כלום"
```

---

## סיום התוכנית

ארבעה עמודים באוויר על הדומיין האמיתי, **לא מקושרים מאף מקום**. `index.html` לא נגעו בו, והחנות ממשיכה לעבוד.

```bash
node scripts/status.mjs
node scripts/ship.mjs "ארבעת העמודים החדשים, עדיין לא מקושרים"
```

ואז לפתוח בטלפון: `nuika.co.il/home.html`, `story.html`, `gallery.html`, `contact.html`.

**התוכנית הבאה:** Plan 4 — האירועים (Firebase, לשונית בדף הניהול, ועמוד הלוח).

---

## Self-Review

**כיסוי המפרט.** §4 (עמוד הבית) → משימות 1–3 · §5.1 (סיפור) → 4 · §5.2 (גלריה) → 5 · §5.4 (קשר) → 6. §5.3 ו-§6.1 (אירועים) הם תוכנית 4; §8 ו-§9 (ההחלפה) הם תוכנית 5.

**מה שהתוכנית הזאת מונעת במפורש**, על בסיס מה שכבר קרה בפרויקט:

| השומר | מה הוא מונע, ולמה הוא קיים |
|---|---|
| `index.html` לא מקשר לעמודים החדשים | לקוחה שמוצאת עמוד חצי בנוי מצאה תקלה, לא תצוגה מקדימה |
| אין צבע גולמי בעמוד | צבע שנכתב בעמוד יוצא משמירת הניגודיות ואף אחד לא יבחין |
| אין `left`/`right` פיזי | המעבר לאנגלית מפסיק לעבוד לבד וצריך גיליון שני |
| `currentSrc` בטלפון | אם ייפול, כל העבודה על 52 חלונות החיתוך יורדת לטמיון **בשקט** |
| `nuikaRefresh` בגלריה | תוכן שמוזרק אחרי הטעינה מוצג בשתי השפות בו-זמנית |
| אין `action` ואין `fetch` בטופס | עותק שני של שם וטלפון של לקוחה הוא התחייבות שאיש לא ביקש |
| אין אריח גבוה ברשת | פריים 2.66:1 מאבד שני שלישים מרוחבו — אותה תקלה שבגללה נבנתה גרסת הטלפון מחדש |

**מצייני מקום.** אין. משימות 4, 5 ו-6 מתארות פריסה בפרוזה ולא בקוד מלא — במכוון: הן בונות עמודים שלמים, והתוכן המחייב (הטקסט של נוי מילה במילה, שמות השדות, הכתובות) מופיע במלואו. הבדיקות אוכפות את מה שחייב להתקיים.

**עקביות.** מפתחות התפריט (`story` `gallery` `events` `contact`) זהים ל-`NAV` ב-`site.js`. שמות המחלקות מ-`site.css` (`.btn--on-film` `.btn--ghost` `.rise` `.reveal` `.u-giant`) מופיעים בדיוק כפי שהוגדרו. שמות הקבצים ב-`media/` ו-`images/gallery/` תואמים למה שנבנה בפועל.
