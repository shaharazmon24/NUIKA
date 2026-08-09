# NUIKA — working rules

Boutique bread shop, run by **Noy**. Live at https://nuika.co.il
(also reachable via shaharazmon24.github.io/NUIKA, which redirects there)
This is a real business. Orders placed here are real orders.

---

## The one rule that matters most

**Never upload `index.html` through GitHub's web "Add files via upload".**

It replaces the whole file with whatever local copy you have, and git records it
as a normal commit. It has already happened once and silently deleted the entire
Firebase layer plus a batch of bug fixes. The site kept loading, so nothing
looked wrong until a customer hit it.

Correct workflow, every time:

```bash
git pull            # take everyone else's work first
# ...make changes...
node scripts/validate.mjs
git add -A && git commit -m "..." && git push
```

If `git pull` reports a conflict, resolve it. Do not overwrite.

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

- The admin password is plaintext in the source and the database rules are
  open, so the password protects nothing at the data layer. Anyone can read
  `nuika/orders` (customer names and phone numbers) or wipe the tree. Fixing
  this properly means Firebase Auth plus rules scoped to Noy's uid.
- Product photos uploaded in the admin are stored as base64 inside the products
  node, so every visitor downloads them on every load. They should be resized
  before upload, or moved to Firebase Storage.
- The committed product images are 1–2 MB each.
- VAT is hardcoded at 17%; Israel has been at 18% since January 2025. The
  costing also assumes Noy is a עוסק פטור — worth confirming with her.
