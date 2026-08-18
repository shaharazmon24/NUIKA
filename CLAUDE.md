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

**Never upload `index.html` through GitHub's web "Add files via upload".**

It replaces the whole file with whatever local copy you have, and git records it
as a normal commit. It has already happened once and silently deleted the entire
Firebase layer plus a batch of bug fixes. The site kept loading, so nothing
looked wrong until a customer hit it.

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
repo at all. `ship.mjs` stamps the version into `index.html` on every publish —
never edit the `nuika-version` meta tag by hand.

If the user asks in Hebrew to update or to publish ("תעדכני", "תשלחי"), run
these. Do not hand them raw git commands; plain `git push` skips the checks
that exist because work has already been lost once.

If a pull reports a conflict, resolve it properly. Never resolve by taking one
whole side of `index.html` — both people's work is real.

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

Single file, no build step. `index.html` holds all HTML, CSS and JavaScript.
Tailwind and Firebase load from CDNs. Hebrew RTL with an English toggle driven
by `lang-content="he"` / `lang-content="en"` attributes.

**All shared data lives in Firebase Realtime Database** under `nuika/`:

| Path | Contents |
|---|---|
| `nuika/products` | menu, prices, sold-out flags, stock caps, tags |
| `nuika/orders` | every order, keyed by timestamp |
| `nuika/settings` | `ordersOpen`, `bitLink`, `payboxLink`, `deadline` |
| `nuika/kitchen/pantry` | ingredients and prices |
| `nuika/kitchen/recipes` | recipes with ingredient weights |
| `nuika/kitchen/weeklyPlan` | `{recipeId: quantity}` |
| `nuika/_seeded` | one-time seed marker — **never delete this** |

`localStorage` is only for per-device convenience: the customer's own cart,
their saved name and phone, and their last order. Nothing Noy manages belongs
there — it would not reach anyone else's device.

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
