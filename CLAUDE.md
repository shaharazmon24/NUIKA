# NUIKA — working rules

Boutique bread shop, run by **Noy**. Live at https://nuika.co.il
(also reachable via shaharazmon24.github.io/NUIKA, which redirects there)
This is a real business. Orders placed here are real orders.

> **If you are working with Noy rather than Shahar, read
> [`הוראות-לקלוד.md`](הוראות-לקלוד.md) in full before touching anything.** It is
> the same rules as this file plus the context she needs you to have: what the
> admin panel already does without code, how to recognise the upload that has
> twice deleted the Firebase layer, and how to talk to someone who does not
> know git.

---

## The one rule that matters most

**Never upload `shop.html` through GitHub's web "Add files via upload".**

> **The name changed on 21 Sep 2026.** The shop used to be `index.html`, and
> every older note, memory and screenshot says so. It is now **`shop.html`** —
> ~430KB, 9,000+ lines, all the ordering, payment, stock, kitchen and admin
> code. `index.html` is now the small film front page (~15KB). If you are
> working from a memory of this project, that memory is out of date; check the
> file, not the name.

Uploading replaces the whole file with whatever local copy you have, and git
records it as a normal commit. It has already happened once and silently deleted
the entire Firebase layer plus a batch of bug fixes. The site kept loading, so
nothing looked wrong until a customer hit it.

The rule is about *any* file, but `shop.html` is the one whose loss is
catastrophic and silent.

Two people share this one file from two machines. Use these two commands and
nothing else — they install the safety hooks on first use, refuse to push
broken code, and refuse to push while behind the other machine:

```bash
node scripts/status.mjs                # where is everyone — run this first
node scripts/sync.mjs                  # before you start
node scripts/ship.mjs "what changed"   # when you are done
```

`status.mjs` compares this folder, GitHub and the live site, and refuses to
pretend everything is fine when they differ. It also catches the case that has
now bitten this project twice in a different form: a folder that is not the
repo at all. `ship.mjs` stamps the version into `shop.html` on every publish —
never edit the `nuika-version` meta tag by hand.

How those four tools (`status.mjs`, `ship.mjs`, `validate.mjs`,
`enable-deploy-gate.mjs`) know which file is the shop, stated precisely, because
a vaguer version of this sentence was wrong here for one commit:

- They **find** it by name — `shop.html` if it exists, otherwise `index.html`.
  Those two names are hardcoded in `shopFile()`.
- They then **verify** by content: the file must contain
  `firebase.initializeApp` and `getCartTotal()`, or they refuse to run and say
  so ("is the shop by name but not by content").

The verification is what matters and what saved the cutover: without it the
tools would have gone on reading `index.html` and silently validated, stamped
and deployed against the **film page**. It is not, however, name-independence.
Rename the shop to any third name and all four stop with `neither shop.html nor
index.html exists — this is not the NUIKA checkout`. They survived this rename
because it was written into them in advance; another rename means editing
`shopFile()` in all four copies first.

If the user asks in Hebrew to update or to publish ("תעדכני", "תשלחי"), run
these. Do not hand them raw git commands; plain `git push` skips the checks
that exist because work has already been lost once.

If a pull reports a conflict, resolve it properly. Never resolve by taking one
whole side of `shop.html` — both people's work is real.

---

## Before every push

```bash
node scripts/validate.mjs
```

It parses the JavaScript, checks that critical features are still present, and
checks that referenced images are committed. The same script runs in GitHub
Actions, so a bad push turns the commit red — but catching it locally is better.

---

## Architecture

No build step. Since the cutover of 21 Sep 2026 the site has two front pages
plus four content pages:

| File | What it is |
|---|---|
| `index.html` | the film front page, ~280 lines. What nuika.co.il serves. One screen, no scroll. |
| `shop.html` | **the shop** — 9,000+ lines holding all its own HTML, CSS and JavaScript. Ordering, payment, stock, kitchen, finance, admin. |
| `admin.html` | a redirect page and nothing else: it exists so Noy can have a home-screen icon that lands on the admin sign-in. |
| `story.html` `gallery.html` `contact.html` `events.html` | content pages, sharing `site.css` + `site.js`. |

`shop.html` is still one self-contained file by design and does **not** use
`site.css` / `site.js`. Tailwind and Firebase load from CDNs. Hebrew RTL with an
English toggle driven by `lang-content="he"` / `lang-content="en"` attributes on
every page.

`index.html` and `shop.html` are both doors into the installed app: both link
`manifest.json` and both register `sw.js`. `admin.html` deliberately links no
manifest — see the comment in the file.

**All shared data lives in Firebase Realtime Database** under `nuika/`:

| Path | Contents |
|---|---|
| `nuika/products` | menu, prices, sold-out flags, stock caps, tags |
| `nuika/orders` | every order, keyed by timestamp |
| `nuika/settings` | `ordersOpen`, `bitLink`, `payboxLink`, `deadline` |
| `nuika/events` | Noy's events board — one record per event, each with `date` (`YYYY-MM-DD`), `title`, and optionally `place`, `time`, `body`, `ctaLabel`, `ctaText`, `created`. Public read (`events.html` shows it with no sign-in), admin write only. **Requires the rules to be published — see below.** |
| `nuika/kitchen/pantry` | ingredients and prices |
| `nuika/kitchen/recipes` | recipes with ingredient weights |
| `nuika/kitchen/weeklyPlan` | `{recipeId: quantity}` |
| `nuika/_seeded` | one-time seed marker — **never delete this** |

`localStorage` is only for per-device convenience: the customer's own cart,
their saved name and phone, and their last order. Nothing Noy manages belongs
there — it would not reach anyone else's device.

### One human step: publish the rules for `nuika/events`

`firebase-rules.json` is the file we edit; it is **not** what the database
enforces. The database enforces whatever was last pasted into the Firebase
console. `nuika/events` is in the committed file but is **not yet published**,
and until someone publishes it both halves of the events feature are dead:

- the **Events** tab in the admin panel (`?admin`) cannot save — every write
  comes back `PERMISSION_DENIED`;
- the public board at `events.html` reads nothing and shows its empty state,
  no matter what Noy has entered.

No amount of code fixes this. Someone has to do it once, by hand:

1. Open the [Firebase console](https://console.firebase.google.com/) →
   project **nuika-5371f** → **Realtime Database** → **Rules**.
2. Replace the whole contents with `firebase-rules.json` from this repo.
3. Press **Publish**.

Publishing is purely additive and safe: the live rules were checked against
the committed file and match on every other node, so this changes nothing
about orders, products, settings, stock or the kitchen — it only adds the
`events` node.

To check whether it has already been done, without signing in:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  'https://nuika-5371f-default-rtdb.firebaseio.com/nuika/events.json'
```

`200` means the rules are published. `401` means they are not, and the events
board is still dead.

## Things that will bite you

**Seeding.** Defaults are written exactly once, guarded by `nuika/_seeded`, and
only into subtrees that do not exist. Never seed from inside a `.on('value')`
listener: an empty tree there means "Noy deleted everything", not "first run".
Getting this wrong resurrects deleted products and recipes.

**Never save before the listener has loaded.** `PANTRY`, `RECIPES` and
`PRODUCTS` are empty until Firebase answers. Saving in that window writes
emptiness or defaults over real data — this wiped the pantry on every offline
open. `kitchenReady()` and the `_kitchenLoaded` / `_productsLoaded` flags exist
for this; keep using them.

**Prefer per-key writes.** `db.ref('nuika/kitchen/pantry').set(obj)` replaces the
whole subtree and destroys anything the other device changed in the same
round-trip. Noy uses a phone and a laptop. Write
`db.ref('nuika/kitchen/pantry/' + id).set(item)` instead.

**Every write needs a `.catch(fbError)`.** Writes used to fail silently while
the UI reported success.

**Escape customer text.** Name, notes and address go into the admin panel via
`innerHTML`. Always wrap them in `esc()` — unescaped, a crafted order note runs
arbitrary JavaScript against the live database handle.

**The service worker.** `sw.js` is network-first for HTML so fixes always reach
people. Bump `CACHE` when you change it. It must never go back to plain
cache-first: that version pinned every visitor to a stale copy forever.

**Function declarations are hoisted.** Do not wrap a function as
`const orig = fn; function fn() { orig(); }` — it recurses infinitely. Edit the
body directly.

**The site serves from the domain root** (nuika.co.il), fronted by Cloudflare.
Keep asset paths relative so they stay correct on either host. Never delete or
edit `CNAME` — doing so unsets the GitHub Pages custom domain and takes the shop
offline. Cloudflare must stay on SSL mode **Full**, never Full (strict): the
origin certificate is GitHub's `*.github.io`, and strict mode rejects it.

## Money paths — check these whenever you touch ordering

The total must be identical in the cart bar, the order modal, the WhatsApp
message, the thank-you page and the Firebase record. A stale variable in one of
them once shipped and killed the order button outright.

Stock is derived from orders in the current cycle, not from order status —
otherwise ticking an order off as delivered hands its units back to the shop.

## Who does what

Noy runs the business entirely from the admin panel (`?admin`): prices, menu,
sold-out, opening and closing orders, the deadline, payment links, and the
kitchen — pantry, recipes, costing, weekly plan. None of that needs code.

Code changes are for layout, new features, and bugs.

## Known, not yet fixed

- ~~The admin password is plaintext in the source and the database rules are
  open.~~ **Fixed and verified 17 Aug 2026.** Sign-in is Firebase Auth against a
  real account, authorised by `nuika/admins/{uid}`, and the rules are published:
  an unauthenticated read of `nuika/orders` and `nuika/admins` returns
  PERMISSION_DENIED while `nuika/settings` stays public. No password exists in
  the source.
- **Kitchen saves replace whole subtrees.** `savePantry()`, `saveRecipes()` and
  `saveWeeklyPlan()` call `.set()` on the entire node built from a local array.
  Noy uses a phone and a laptop, and the Firebase SDK queues offline writes, so
  a stale queued write can land later and delete recipes the other device added.
  `savePlanQty()` shows the correct per-key pattern, with a comment explaining
  why — four lines above a function that violates it.
- **`vat: 0` is unrepresentable.** `calcIngCost` uses `(1 + (p.vat || 0.17))`,
  so a genuine zero falls back to 17%, and `savePantryItem` hardcodes `0.17`
  back on every save. The same function guards `pricePerKg` correctly with
  `typeof` one line earlier. Whether `pricePerKg` is gross or net is also
  undefined per supplier — worth settling with Noy before trusting any margin.
- Product photos uploaded in the admin are stored as base64 inside the products
  node, so every visitor downloads them on every load. They should be resized
  before upload, or moved to Firebase Storage.
- The committed product images are 1–2 MB each.
- VAT is hardcoded at 17%; Israel has been at 18% since January 2025. The
  costing also assumes Noy is a עוסק פטור — worth confirming with her.

## What `scripts/validate.mjs` does not catch

Measured on 21 Sep 2026 while building the events board, each by breaking the
thing the check protects. None is a defect in shipped code; all are limits of
the guards. Listed because a check you trust more than it deserves is how this
project has lost work before.

- **The version marker is a manual discipline.** `./site.js?v=2` exists because
  `gallery.html` now depends on `window.nuikaEsc` from `site.js`, and the two
  files are cached on different clocks (`max-age=600` vs `max-age=14400`). The
  check enforces that all five pages carry a number and agree on it. It cannot
  know that `site.js` changed and the number did not, and it will not catch a
  downgrade to a number visitors already hold. **Change `site.js` → bump
  `?v=` in all five pages and `CACHE` in `sw.js`, by hand.**
- **The escaping guard is text analysis, not a parser.** An apostrophe inside a
  regex literal makes the statement splitter swallow the rest of a statement —
  a silent pass. Safe today only because `contact.html` holds the pages' only
  regex literal and has no `innerHTML` write at all.
- **`/* esc-ok: */` is a promise nothing verifies.** `events.html`'s `cardHTML`
  has a dedicated check; `gallery.html`'s two markers do not. Strip `esc()` out
  of `tileHTML` and the suite stays green.
- **The events write audit is a heuristic.** It catches every spelling that has
  actually gone wrong, but `const r = db.ref(ROOT + '/events'); r.set(all)` —
  the whole-node write, one variable away — passes when added beside a
  compliant write.
- **`shop.html` is not in `PAGES`**, so the hardened escaping check never runs
  over the shop. The events tab carries its own scoped check; nothing else in
  the file is covered. (Before the cutover this said `index.html`, which was
  the same statement about the same file. `index.html` is now `PAGES[0]` — the
  film page — and *is* covered; the file outside `PAGES` is `shop.html`.)
- **A `data-src=` or `data-type=` attribute on a `<script>` tag hides it** from
  the inline-script scan, so a syntax error in that block passes. No page
  carries such an attribute.
- **No check reads any documentation file, and this is the gap that keeps
  reopening.** `scripts/validate.mjs` parses JavaScript, asserts features,
  checks assets, design tokens and the four other pages. It reads no `.md` at
  all — not this file, not `PASSPORT.md`, not `SECURITY.md`, not the two Hebrew
  guides. So every factual claim in them is unguarded: they drift as the code
  moves and nothing ever goes red.

  This is not theoretical. The cutover of 21 Sep 2026 broke, in one commit,
  claims in five documents at once — including the restore procedure in
  `הוראות-לקלוד.md`, which told the reader to run a test that reports a false
  catastrophe on a perfectly healthy site, with the restore steps printed
  underneath it. It took two review rounds to find them all, and one of the
  "fixes" in the first round introduced the same trap pointing the other way.

  Until something checks them, treat every document here the way you would
  treat a comment: evidence of intent, not evidence of fact. **Check the code.**
  If you are writing a check for this, the cheap first version is a list of
  filenames that must not appear in any `.md` — the whole class so far has been
  documents naming a file that has moved.
- **`index.backup-v1.html` is committed and therefore served.** Measured 22 Sep
  2026: HTTP 200 at `nuika.co.il/index.backup-v1.html`, 80,978 bytes, carrying
  the pre-Firebase source and `const ADMIN_PASSWORD = 'nuika2026';` in plain
  text. Not a working credential — sign-in has been Firebase Auth since 17 Aug
  2026 — but it is a password on the open web and a stale whole copy of the
  shop sitting where someone might restore from it. Removing it changes what
  the site serves, so it is Noy's and Shahar's call, not a cleanup.
