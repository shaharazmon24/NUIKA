# NUIKA Redesign — Plan 5: The Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ש-`nuika.co.il` ייפתח בעמוד הבית עם הסרט במקום בחנות, ושהחנות תעבור ל-`shop.html` — בלי שנוי תצטרך לעשות דבר, ובלי שאייקון שמור, הזמנה פתוחה או כלי בטיחות יישברו.

**Architecture:** שינוי שם של שני קבצים, ובאותו קומיט כל מה שמצביע אליהם: `manifest.json`, `sw.js`, `admin.html` ושלושת הסקריפטים. הכל בקומיט אחד כדי שביטול אחד יחזיר את הכל תוך דקה. שינוי שם ולא כתיבה מחדש, כך שההיסטוריה של החנות נשמרת.

**Tech Stack:** HTML/CSS/JS סטטיים, בלי שלב בנייה. `scripts/validate.mjs` הוא מערכת הבדיקות; אין `node_modules`.

---

## Global Constraints

- **`index.html` היום הוא החנות החיה, עם הזמנות אמיתיות.** אחרי משימה 4 הוא יהיה עמוד הבית. שתי המשמעויות חיות באותה תוכנית — בכל צעד לוודא על איזה מהן מדברים.
- **`CNAME` לא נוגעים בו.** מחיקה או עריכה מבטלת את הדומיין ומורידה את החנות.
- **פרסום רק דרך `node scripts/ship.mjs`.** אף פעם לא `git push` ישיר.
- **`node scripts/validate.mjs` חייב להסתיים ב-`All checks passed.`** עם כל חמשת השלבים עוברים לבד. `deploy.yml` מתנה בזה את העלייה לאתר החי.
- **`git mv`, לא מחיקה ויצירה.** ההיסטוריה של 9,000 שורות החנות חייבת להישרד.
- **אחרי כל שינוי ב-`site.js`** יש להעלות ביד את `?v=` בכל העמודים **ואת `CACHE` ב-`sw.js`**. הבדיקה אוכפת שהמספר קיים ושכולם מסכימים עליו; היא לא יודעת ש-`site.js` השתנה והמספר לא.
- **כל טקסט לקוח עובר `esc()`**, כל כתיבה ל-Firebase היא לפי מפתח בודד עם `.catch(fbError)`, ואף פעם לא לגעת ב-`nuika/_seeded`.
- **שלב השבירה המכוונת הוא המשימה.** בתוכנית 4 נמצאו 22 תקלות ואף אחת לא נמצאה בקריאה.

### מה כבר נכון ואסור "לתקן"

| מה | מצב | הערה |
|---|---|---|
| `site.js:53`, `:67` — הלוגו מצביע ל-`./index.html` | **נכון אחרי ההחלפה** | אחרי השינוי זה עמוד הבית. לא לגעת. |
| `site.js:73` — `./shop.html` | **נכון אחרי ההחלפה** | מחזיר 404 היום; משימה 4 סוגרת את זה. |
| `admin.html` בלי `<link rel="manifest">` | **מכוון** | אייפון קורא את המניפסט של העמוד שנשמר ותמיד פותח ב-`start_url`. בלי מניפסט האייקון נשאר על הכתובת המדויקת. |
| מנגנון השפה | **אין התנגשות** | `index.html:775` משתמש ב-`body.lang-en` ו-`site.css:88` ב-`html[lang="en"]`, והחנות לא טוענת את `site.css`. המפרט הזהיר מ-`display: revert` — זה כבר תוקן ל-`display:none !important`. **חוזר להיות רלוונטי רק בשלב 3**, כשהחנות תקבל את העיצוב החדש. |

---

## File Structure

| קובץ | מה קורה לו |
|---|---|
| `scripts/validate.mjs` | משתנה במשימות 1 ו-4 |
| `scripts/status.mjs`, `scripts/ship.mjs` | משתנים במשימה 1 |
| `sw.js` | משתנה במשימה 2 |
| `home.html` | משתנה במשימה 3, **ומשנה שם ל-`index.html` במשימה 4** |
| `index.html` | **משנה שם ל-`shop.html` במשימה 4.** התוכן לא נוגע. |
| `manifest.json`, `admin.html` | משתנים במשימה 4 בלבד |
| `CNAME` | לא נוגעים |

---

## Task 1: הכלים מפסיקים להניח שהחנות נקראת `index.html`

שלושת כלי הבטיחות מחפשים את החנות **לפי השם `index.html`**. ברגע שהשם זז הם ימשיכו לעבוד — על הקובץ הלא נכון. `validate.mjs` יישבר בקול ויחסום כל פרסום; `status.mjs` יישבר **בשקט** ויגיד "הכל מסונכרן" בזמן שהחנות מתפצלת בין שתי מכונות, וזה בדיוק המצב שהכלי נכתב כדי למנוע אחרי שתי אבדות.

התיקון נעשה **לפני** ההחלפה, בצורה שעובדת משני צדדיה.

**Files:** Modify `scripts/validate.mjs`, `scripts/status.mjs`, `scripts/ship.mjs`

**Interfaces:** Produces `shopFile()` — מחזיר `'shop.html'` אם הוא קיים, אחרת `'index.html'`, **וזורק אם שניהם קיימים או אף אחד**.

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

ב-`scripts/validate.mjs`, בשלב `assets` בתוך `console.log('Deployment:')`:

```js
  // The three safety tools all hunted for the shop by the literal name
  // index.html. After the cutover that name belongs to the film page, and
  // status.mjs would have compared the film — which barely changes — and
  // reported "everything is in sync" while the shop diverged between two
  // machines. That is the exact failure it was written to prevent, after it
  // had already cost this project its data-sync layer once.
  for (const script of ['validate.mjs', 'status.mjs', 'ship.mjs']) {
    const src = readFileSync(join(ROOT, 'scripts', script), 'utf8')
      .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n');
    const hard = [...src.matchAll(/['"`]\.?\/?index\.html['"`]/g)];
    if (hard.length) fail(`scripts/${script} names index.html directly ${hard.length} time(s) — resolve the shop with shopFile() so the cutover cannot silently point it at the film page`);
    else pass(`scripts/${script} resolves the shop instead of hardcoding its name`);
  }
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --assets
```

צפוי: שלושה `FAIL`, אחד לכל סקריפט, ויציאה בקוד 1.

- [ ] **Step 3: לכתוב את `shopFile()` ולהשתמש בו**

ב-`scripts/validate.mjs`, ב-scope של המודול ליד `ROOT`:

```js
// The shop is index.html until the cutover and shop.html after it. Resolve it
// rather than hardcoding, so every tool is correct on both sides of the rename.
//
// Both present means the cutover is half-applied — a state in which every
// later answer would be a guess. Neither present means the checkout is not
// this project. Both throw rather than pick.
function shopFile(root) {
  const a = existsSync(join(root, 'shop.html'));
  const b = existsSync(join(root, 'index.html'));
  if (a && b) throw new Error('both shop.html and index.html exist — the cutover is half-applied; finish it or revert it before running this');
  if (a) return 'shop.html';
  if (b) return 'index.html';
  throw new Error('neither shop.html nor index.html exists — this is not the NUIKA checkout');
}
const SHOP = shopFile(ROOT);
```

להחליף כל `readFileSync(join(ROOT, 'index.html'))` ב-`readFileSync(join(ROOT, SHOP))`, וכל הודעת בדיקה שאומרת "index.html" על החנות — להשתמש ב-`SHOP`.

**זהירות:** `PAGES` מכיל `'home.html'` היום. זה עמוד סטטי, לא החנות — **לא להחליף אותו**. הוא משנה שם רק במשימה 4.

ב-`scripts/status.mjs` וב-`scripts/ship.mjs`: אותו `shopFile()` (להעתיק, שלושה קבצים בלי מודול משותף), ולהשתמש בו בכל מקום שקורא או חותם את החנות.

- [ ] **Step 4: `status.mjs` חייב גם לזהות החלפה חצי-מפורסמת**

`status.mjs` משווה את התיקייה מול האתר החי. אם התיקייה כבר אחרי ההחלפה והאתר עוד לפניה, הוא חייב לומר את זה במקום להשוות שני קבצים שונים.

להוסיף: למשוך את שתי הכתובות מהאתר החי, ולדווח איזו מהן היא החנות שם.

`status.mjs` כבר מושך מהאתר החי ב-`scripts/status.mjs:95`, דרך `trySh('curl -s --max-time 25 …')`. **להשתמש באותו מנגנון, לא להמציא שני.**

```js
// A cutover is two files changing name at once. Until the deploy lands, the
// folder and the live site can disagree about which file IS the shop — and
// comparing the folder's shop against the live film page produces a version
// mismatch that looks like drift and is not. Say which it is.
const liveShopHtml = trySh(`curl -s --max-time 25 "${SITE}/shop.html?cb=${Date.now()}"`);
const liveShop = (liveShopHtml && versionOf(liveShopHtml)) ? 'shop.html' : 'index.html';
if (liveShop !== SHOP) {
  say(`  ⚠  בתיקייה החנות נקראת ${SHOP} ובאתר החי ${liveShop} — ההחלפה באמצע.`);
  say('     זה תקין בדקה שאחרי פרסום. אם זה נמשך — תגידי לקלוד.');
}
```

**למה `versionOf` ולא רק "התשובה לא ריקה":** GitHub Pages מחזיר דף 404 מעוצב, שהוא HTML תקין. בדיקה על תוכן ריק הייתה מזהה 404 כ"הקובץ קיים". תג הגרסה מופיע רק בחנות האמיתית.

- [ ] **Step 5: לשבור בכוונה, שש פעמים**

| השבירה | צפוי |
|---|---|
| להחזיר `'index.html'` מילולי לאחד הסקריפטים | **FAIL**, בשם הסקריפט |
| להחזיר אותו בתוך הערה | **עובר** — הערה אינה קוד |
| ליצור `shop.html` ריק לצד `index.html`, ולהריץ | **קורס בהודעה ברורה** על החלפה חצי-מפורסמת, לא "עובר" |
| לשנות זמנית את שם `index.html` ולהריץ | **קורס בהודעה ברורה**, לא ENOENT |
| `node scripts/status.mjs` כשהתיקייה והאתר מסכימים | בלי אזהרת ההחלפה |
| `node scripts/status.mjs` כשהם לא | **אזהרת ההחלפה** |

את שתי השורות האחרונות אפשר לבדוק בזיוף התשובה מהאתר; לומר בדוח מה זויף.

- [ ] **Step 6: קומיט**

```bash
node scripts/validate.mjs
git add scripts/validate.mjs scripts/status.mjs scripts/ship.mjs
git commit -m "הכלים מוצאים את החנות לפי מה שהיא, לא לפי שמה"
```

---

## Task 2: `sw.js` — הסרט, והנפילה הלא-מקוונת

**זו לא הכנה להחלפה. זו תקלה חיה מהיום.** הענף שאינו HTML הוא cache-first ומוגדר על `./`, אז **מבקר שהתקין את ה-service worker של החנות ואז פותח את עמוד הבית מזרים 11–14 מגה לתוך אותו מטמון שבו החנות יושבת.** טלפונים מגבילים כמה אתר רשאי לאחסן, וכשמגיעים לתקרה נזרק הכל — כולל קבצי החנות.

**Files:** Modify `sw.js`, `scripts/validate.mjs`

---

- [ ] **Step 1: לכתוב את הבדיקות שנכשלות**

```js
  console.log('Service worker and the film:');
  const swSrc = readFileSync(join(ROOT, 'sw.js'), 'utf8');

  // Two separate problems, both real. STORAGE: a request without a Range
  // header returns 200, so the whole file — 13.7MB desktop, 10.5MB phone —
  // is written into the same cache the shop lives in. PLAYBACK: a request
  // WITH a Range returns 206, caches.put() rejects a partial response by
  // spec, and the existing .catch(() => {}) swallows it — but once a full
  // 200 copy is cached, the cache-first branch serves THAT in answer to a
  // range request, which breaks seeking in Safari.
  // Each of these matches the MECHANISM, not a word. A looser version was
  // written first and measured dead: /\.mp4|video|film/ passes on the string
  // './media/film-poster.jpg', which Step 5 adds to ASSETS — so deleting the
  // exclusion entirely would still have printed ok. Same for the fallback:
  // /shop\.html/ passes on './shop.html' in ASSETS.

  // The exclusion must be an early return keyed on a video extension.
  if (/\.(?:mp4|webm|mov)\$?\s*\/i?\s*\.test\([^)]*\)\s*\)\s*return/.test(swSrc.replace(/\s+/g, ' '))
      || /if\s*\([^)]*\b(?:mp4)\b[^)]*\)\s*return/.test(swSrc.replace(/\s+/g, ' '))) {
    pass('sw.js returns early for video, so the film never enters the cache');
  } else {
    fail('sw.js caches the film — 13.7MB desktop, 10.5MB phone, into the same cache the shop lives in, on a device with a storage quota that throws everything away when it is hit');
  }

  // A partial response must be refused where storing is decided.
  if (/cacheable[\s\S]{0,200}?206/.test(swSrc)) pass('sw.js refuses to store a partial (206) response');
  else fail('sw.js must refuse a 206 in cacheable(), or a range request gets answered from a full cached copy and seeking breaks in Safari');

  // The fallback must branch, not be a constant.
  if (/caches\.match\(\s*(?:isShopUrl|[A-Za-z_$][\w$]*\s*\?)/.test(swSrc.replace(/\s+/g, ' '))) {
    pass('sw.js chooses its offline fallback per URL');
  } else {
    fail('sw.js falls back to one fixed page for every HTML URL — after the cutover that page is the film, so a customer who loses signal lands on a video instead of their cart');
  }

  // ASSETS must never precache the film itself.
  const assetsBlock = (swSrc.match(/const ASSETS = \[([\s\S]*?)\]/) || [, ''])[1];
  if (/\.(?:mp4|webm|mov)/i.test(assetsBlock)) fail('sw.js precaches a video file in ASSETS — that is the 13.7MB problem, installed deliberately');
  else pass('sw.js precaches no video');
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**

```bash
node scripts/validate.mjs --assets
```

צפוי: שלושה `FAIL`.

- [ ] **Step 3: להחריג את הסרט**

ב-`sw.js`, מיד אחרי ההחרגה הקיימת של `firebaseio.com`:

```js
  // The film is 13.7MB (desktop) and 10.5MB (phone), and the non-HTML branch
  // below is cache-first over './' — so a visitor who has the shop's worker
  // installed and then opens the home page streams the whole file into the
  // same cache the shop lives in. Phones cap how much a site may store, and
  // hitting the cap throws ALL of it away, the shop included.
  //
  // It also fixes seeking: a range request returns 206, which caches.put()
  // rejects by spec, but a full 200 copy already in the cache would be served
  // in answer to a range request and break scrubbing in Safari.
  if (/\.(mp4|webm|mov)$/i.test(url.pathname)) return;
```

ובתוך `cacheable`, להוסיף את הסירוב המפורש לתשובה חלקית:

```js
  const cacheable = res =>
    res && (res.ok || res.type === 'opaque') && !res.redirected && res.status !== 206;
```

- [ ] **Step 4: הנפילה הלא-מקוונת לקובץ הנכון**

```js
  // Before the cutover './index.html' IS the shop; after it, the shop is
  // './shop.html' and index.html is the film. Resolving per-URL keeps a
  // customer who loses signal on their cart, not on a video.
  const SHOP_FALLBACK = './shop.html';
  const isShopUrl = url.pathname.endsWith('/shop.html')
    || url.pathname.endsWith('/admin.html')
    || url.search.includes('admin');
```

ובענף ה-HTML:

```js
        .catch(() => caches.match(e.request)
          .then(r => r || caches.match(isShopUrl ? SHOP_FALLBACK : './index.html')))
```

- [ ] **Step 5: `ASSETS` ו-`CACHE`**

להוסיף ל-`ASSETS`: `'./shop.html'`, `'./story.html'`, `'./gallery.html'`, `'./contact.html'`, `'./events.html'`, `'./site.css'`, `'./site.js?v=2'`, `'./media/film-poster.jpg'`.
**את קבצי ה-mp4 לא מוסיפים.** `'./index.html'` נשאר.

להעלות `CACHE` ל-`'nuika-v11'`.

- [ ] **Step 6: לשבור בכוונה, חמש פעמים**

| השבירה | צפוי |
|---|---|
| למחוק את שורת ההחרגה של הווידאו | **FAIL** |
| להחזיר את `cacheable` בלי `status !== 206` | **FAIL** |
| להחזיר את הנפילה ל-`'./index.html'` תמיד | **FAIL** |
| להוסיף `'./media/film-phone.mp4'` ל-`ASSETS` | **FAIL** — צריך בדיקה שחוסמת mp4 ב-`ASSETS`; אם אין, לכתוב אותה |
| לא להעלות את `CACHE` | **FAIL** — צריך בדיקה ש-`CACHE` השתנה מול `origin/main`; אם היא לא ניתנת לכתיבה, לומר זאת במפורש בדוח במקום להעמיד פנים |

- [ ] **Step 7: לבדוק בדפדפן אמיתי**

לשרת את התיקייה, לפתוח את `home.html`, לתת לסרט לנגן חמש שניות, ואז בקונסולה:

```js
caches.open('nuika-v11').then(c => c.keys()).then(k => console.log(k.map(r => r.url).filter(u => /\.mp4/.test(u))))
```

צפוי: **מערך ריק.** ואז לגרור בסרגל הסרט ולוודא שהדילוג עובד.

- [ ] **Step 8: קומיט**

```bash
node scripts/validate.mjs
git add sw.js scripts/validate.mjs
git commit -m "sw.js: הסרט לא נכנס למטמון של החנות, והנפילה הלא-מקוונת מגיעה לקובץ הנכון"
```

---

## Task 3: עמוד הבית מזהה שנפתח כאפליקציה מותקנת

האייקון שנוי שמרה במסך הבית פותח את `start_url` של המניפסט. אחרי ההחלפה הוא ינחת על הסרט במקום על החנות. שתי שכבות, כי אייפון ואנדרואיד פותרים את זה אחרת. **נוי לא צריכה לעשות כלום.**

**Files:** Modify `home.html`, `scripts/validate.mjs`

---

- [ ] **Step 1: לכתוב את הבדיקה שנכשלת**

```js
    // Noy's saved icon launches the manifest's start_url. The manifest half of
    // this is fixed in the cutover commit; this is the second layer, because
    // iOS and Android disagree about how an installed launch is detectable.
    // A visitor in a normal browser tab must never be redirected.
    need(/display-mode:\s*standalone/, 'detects an installed launch (Android/Chrome)');
    need(/navigator\.standalone/, 'detects an installed launch (iOS)');
    need(/shop\.html/, 'sends an installed launch to the shop');
```

- [ ] **Step 2: להריץ ולוודא שנכשלת**, ואז לכתוב את הקוד

ב-`home.html`, בראש הסקריפט המוטבע:

```js
    // Noy saved this site to her home screen when the root WAS the shop. After
    // the cutover her icon lands here, on the film. The manifest's start_url
    // handles it on Android; iOS ignores start_url for an already-saved icon,
    // so the page checks for itself and sends an installed launch onward.
    //
    // Deliberately NOT a redirect for everyone: a visitor in an ordinary tab
    // is here on purpose.
    var installed = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
                 || window.navigator.standalone === true;
    if (installed) { location.replace('./shop.html'); }
```

- [ ] **Step 3: לשבור בכוונה, ולבדוק בדפדפן**

| השבירה | צפוי |
|---|---|
| למחוק את `display-mode: standalone` | **FAIL** |
| למחוק את `navigator.standalone` | **FAIL** |
| להחליף `./shop.html` ב-`./index.html` | **FAIL** |

ובדפדפן: לפתוח את `home.html` בלשונית רגילה — **אסור שיפנה לשום מקום.** ואז בקונסולה לזייף את התנאי (`matchMedia` מוחזר כ-`{matches:true}`) ולוודא שההפניה קורית. לומר בדוח שזה זויף.

- [ ] **Step 4: קומיט**

```bash
node scripts/validate.mjs
git add home.html scripts/validate.mjs
git commit -m "עמוד הבית: מי שנכנס מאייקון מותקן מגיע לחנות"
```

---

## Task 4: ההחלפה — קומיט אחד

**זו המשימה שיכולה להוריד את החנות.** כל מה שקודם לה הוא הכנה. הכל כאן נכנס **בקומיט אחד**, כדי שביטול אחד יחזיר את הכל תוך דקה.

**מתי:** כשההזמנות סגורות ואין מאפים בתנור. המחזור נקרא מ-`nuika/settings` לפני ההחלפה. **לא בחמישי בלילה (אפייה) ולא בשישי בבוקר (איסוף).**

**Files:** Rename `index.html`→`shop.html`, `home.html`→`index.html`. Modify `manifest.json`, `admin.html`, `scripts/validate.mjs`.

---

- [ ] **Step 1: לוודא שעכשיו מותר**

```bash
node scripts/status.mjs
curl -s "https://nuika-5371f-default-rtdb.firebaseio.com/nuika/settings.json"
```

אם `status.mjs` אומר שמשהו לא מסונכרן — **לעצור ולדווח.** אם יש מחזור הזמנות פתוח — **לעצור ולשאול.** לא לעקוף.

- [ ] **Step 2: שינוי השם**

```bash
git mv index.html shop.html
git mv home.html index.html
```

**`git mv`, לא מחיקה ויצירה** — ההיסטוריה של 9,000 שורות החנות חייבת להישרד. לאמת:

```bash
git log --follow --oneline shop.html | tail -3
```

צפוי: קומיטים ישנים של החנות, לא היסטוריה שמתחילה עכשיו.

- [ ] **Step 3: `manifest.json`**

```json
  "start_url": "./shop.html",
```

ובקיצור הדרך: `"url": "./shop.html?admin"`.

**`id` נשאר `"./"` — אסור לשנות אותו.** `id` הוא זהות האפליקציה; שינוי שלו הופך את זה לאפליקציה **אחרת** בעיני הדפדפן, והאייקון שנוי כבר שמרה מתייתם. `scope` נשאר `"./"` כדי ששני העמודים יישארו בתוך אותה אפליקציה.

- [ ] **Step 4: `admin.html`**

שלוש הפניות ל-`./?admin` הופכות ל-`./shop.html?admin`: ב-`<noscript>`, ב-`location.replace`, ובקישור הנפילה.

**לא להוסיף `<link rel="manifest">`.** ההיעדר שלו מכוון ומוסבר בקובץ.

- [ ] **Step 5: הבדיקות עוברות לצד הנכון**

ב-`scripts/validate.mjs`:

- `SHOP` כבר מתפרש ל-`shop.html` לבד — כלום לא לשנות שם.
- ב-`PAGES`: `'home.html'` → `'index.html'`.
- **הבדיקה "החנות לא מקשרת לעמודים החדשים" חייבת להיכתב מחדש.** אחרי ההחלפה `index.html` הוא עמוד הבית והוא מקשר ל-`./contact.html` באופן לגיטימי. להחליף אותה בבדיקה ההפוכה:

```js
  // Before the cutover this asserted the shop linked to none of the new pages,
  // because they were live but unfinished. That is now backwards: the home
  // page links to all of them on purpose. What matters from here is the other
  // direction — every page can reach the shop, and no page still points at the
  // name the shop used to have.
  for (const page of PAGES) {
    const src = readFileSync(join(ROOT, page), 'utf8');
    if (/href=["']\.\/index\.html["']/.test(src) && page !== 'index.html') {
      // the shared nav's logo legitimately points home; only flag a link that
      // is trying to reach the SHOP by its old name
    }
  }
  const shopSrc = readFileSync(join(ROOT, SHOP), 'utf8');
  if (/\.\/home\.html/.test(shopSrc)) fail(`${SHOP} still links to home.html, which no longer exists`);
  else pass(`${SHOP} does not reference the old home page name`);
```

ולוודא שהבדיקה של `site.js` ("הקישור לחנות קיים") עכשיו מוצאת קובץ אמיתי.

- [ ] **Step 6: הכל ירוק**

```bash
node scripts/validate.mjs
```

צפוי `All checks passed.` עם חמשת השלבים לבד. **וכל 15 הבדיקות הקריטיות של החנות חייבות להיות ירוקות — עכשיו על `shop.html`.** אם אחת האדימה, ההחלפה הצביעה על הקובץ הלא נכון.

- [ ] **Step 7: לשבור בכוונה, שש פעמים**

| השבירה | צפוי |
|---|---|
| להחזיר את `start_url` ל-`"./"` | **FAIL** — צריך בדיקה ש-`start_url` מצביע לחנות |
| לשנות את `id` | **FAIL** — צריך בדיקה ש-`id` לא זז |
| להחזיר הפניה אחת ב-`admin.html` ל-`./?admin` | **FAIL** |
| להוסיף `<link rel="manifest">` ל-`admin.html` | **FAIL** |
| למחוק את `CNAME` | **FAIL** |
| להשאיר את `PAGES` עם `'home.html'` | **FAIL** — קובץ חסר |

אם אחת מהן לא ירתה — הבדיקה שגויה, לתקן ולהריץ את כל השש שוב.

- [ ] **Step 8: קומיט אחד**

```bash
git add -A
git commit -m "ההחלפה: הבית הוא הסרט, החנות עברה ל-shop.html"
git show --stat HEAD
```

לוודא בפלט שרואים **שני שינויי שם** (`R`), לא מחיקה ויצירה.

---

## Task 5: אימות על האתר החי ועל מכשיר אמיתי

**Files:** אין. זו משימת אימות.

---

- [ ] **Step 1: לפרסם**

```bash
node scripts/status.mjs
node scripts/validate.mjs
node scripts/ship.mjs "ההחלפה: הבית הוא הסרט, החנות עברה ל-shop.html"
```

- [ ] **Step 2: לאמת על `nuika.co.il` עצמו**

| כתובת | צפוי |
|---|---|
| `nuika.co.il` | עמוד הבית עם הסרט |
| `nuika.co.il/shop.html` | החנות, התפריט נטען |
| `nuika.co.il/index.html` | עמוד הבית |
| `nuika.co.il/home.html` | 404 — זה בסדר, אף אחד לא מקשר לשם |
| `nuika.co.il/admin.html` | מפנה לכניסת הניהול |
| `nuika.co.il/events.html` | לוח האירועים |
| `nuika.co.il/manifest.json` | `start_url` הוא `./shop.html`, `id` עדיין `./` |

- [ ] **Step 3: הזמנת בדיקה שלמה, מקצה לקצה**

**על החנות החיה.** מוצר לעגלה, פתיחת המודאל, ולוודא שהסכום **זהה** בסרגל העגלה, במודאל, בהודעת הוואטסאפ, בעמוד התודה וברשומה ב-Firebase. ואז **למחוק את ההזמנה**.

זו הבדיקה היחידה שמוכיחה שההחלפה לא שברה כסף. אם ההזמנות סגורות ולא ניתן לפתוח את המודאל — לומר זאת במפורש בדוח ולא להעמיד פנים שנבדק.

- [ ] **Step 4: האייקון של נוי, על מכשיר אמיתי**

ללחוץ על האייקון הקיים במסך הבית ולוודא שהוא נוחת **בחנות**, לא בסרט. **אייפון ואנדרואיד בנפרד** — הם פותרים את זה אחרת, ולכן יש שתי שכבות.

זו הבדיקה שאי אפשר לזייף. אם אין גישה למכשיר של נוי — **לומר זאת מפורשות** ולסמן שהאייקון לא אומת.

- [ ] **Step 5: לוודא שהסרט לא נכנס למטמון**

על טלפון אמיתי, אחרי ביקור בעמוד הבית: המטמון לא מכיל `.mp4`.

- [ ] **Step 6: לרשום במפרט**

סעיף `### מה שתוכנית 5 גילתה` — מה נמצא בפועל, כל בדיקה שנתפסה כלא-יורה, ומה נשאר פתוח לשלב 3 (עיצוב החנות), כולל **ההתנגשות בין שני מנגנוני השפה שחוזרת להיות רלוונטית ברגע ש-`shop.html` יטען את `site.css`.**

---

## מה שהתוכנית הזאת לא עושה

- **לא מעצבת מחדש את החנות.** `shop.html` מקבל את העיצוב החדש בשלב 3, אחרי שההחלפה יציבה. ההזמנות, המלאי, המטבח והכספים לא נוגעים בהם.
- **לא נוגעת ב-`CNAME`.**
- **לא מוחקת את `admin.html`.**
- **לא מפרסמת את כללי ה-Firebase** — זה עדיין צעד של אדם, ותוכנית 4 תיעדה אותו בשלושה מקומות.
