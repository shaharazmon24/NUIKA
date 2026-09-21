# 🍞 NUIKA — Project Passport
> **Context document for AI assistants.** Load this at the start of every new session so work can continue without re-explanation.
>
> ⚠️ **`CLAUDE.md` wins wherever the two disagree, and this file has drifted before.** It is not checked by anything — `scripts/validate.mjs` reads no documentation at all — so it goes stale silently while the code moves. Corrected 22 Sep 2026 after the cutover found four separate claims here that were false: the backend, the hosting, the admin password, and the stock model. **Verify anything here against the code before acting on it.**

---

## Project Identity

| Field | Value |
|-------|-------|
| Project name | **NUIKA** (נואיקה) |
| Type | Boutique bread ordering website |
| Owner | **Noy** (Shahar's sister-in-law) |
| Developer | **Shahar Azmon** — `shaharazmon24@gmail.com` |
| Live URL | https://shaharazmon24.github.io/NUIKA |
| Local path | `C:\Projects\NUIKA\` |
| Deployment | GitHub Desktop → Commit + Push to `main` → GitHub Pages auto-deploys |
| Git backup tag | `v1.0-stable` (can restore at any time) |

---

## Architecture

**No build step, no npm, no framework.** Since the cutover of 21 Sep 2026 the site has two front pages:

- **`shop.html` — the shop.** One self-contained file, 9,000+ lines: its own HTML + CSS (Tailwind CDN + custom) + JavaScript. Ordering, payment, stock, kitchen, finance, admin. *This file was called `index.html` until 21 Sep 2026; older notes and memories say so.*
- **`index.html` — the film front page.** ~280 lines, one screen, no scroll. What `nuika.co.il` serves.

**Supporting files:**
- `story.html`, `gallery.html`, `contact.html`, `events.html` — content pages sharing `site.css` + `site.js`
- `admin.html` — a redirect page and nothing else; it exists so Noy can have a home-screen icon that lands on the admin sign-in. Deliberately links **no** manifest.
- `site.css`, `site.js` — shared chrome for the content pages. **Not used by `shop.html`,** which is self-contained by design.
- `manifest.json` — PWA manifest. `id` and `scope` are `"./"`; `start_url` is `./shop.html`.
- `sw.js` — Service Worker. Network-first for HTML, cache-first for assets, never caches the film or the database.
- `logo.png.png` — logo (double extension, intentional)
- `images/` — product photos (`1-lechem-mushalam.jpg`, `2-lechem-kusmin.jpg`, etc.)
- `firebase-rules.json`, `CNAME`, `scripts/` — rules, domain, tooling
- `PASSPORT.md` — this file

**Persistence: Firebase Realtime Database**, under `nuika/` — products, orders, settings, kitchen. See the data map in `CLAUDE.md`.

`localStorage` is **per-device convenience only**: the customer's own cart, their saved name and phone, and their last order (`nuika_cart`, `nuika_cust_name`, `nuika_cust_phone`, `nuika_last_order`). Nothing Noy manages lives there — it would not reach anyone else's device.

> This section said "`localStorage` only. No backend. Data is per-device" until 22 Sep 2026. That has been false since the Firebase layer landed, and believing it is how the Firebase layer got deleted twice.

**Hosting:** GitHub Pages, served from the **domain root** at `https://nuika.co.il` (fronted by Cloudflare, SSL mode Full — never Full (strict)). Keep asset paths **relative**. There is no `/NUIKA/` prefix; that was the old `shaharazmon24.github.io/NUIKA` layout, which now redirects. Never delete or edit `CNAME`.

---

## Key Constants (in the `shop.html` script section)

```js
const PICKUP_ADDRESS  = 'ש. בן ציון 13, רחובות';   // pickup only; no delivery
const MIN_ORDER_ITEMS = 3;                          // items, not shekels
const OWNER_WHATSAPP  = '972547382282';
const OWNER_EMAIL     = 'shaharazmon24@gmail.com';
const ADMIN_EMAIL     = 'noynaamad@gmail.com';      // prefills the sign-in field only
```

> **There is no `ADMIN_PASSWORD`, and this file used to print one.** Until 22 Sep 2026 this block listed `const ADMIN_PASSWORD = 'nuika2026';`. That mechanism was removed on 17 Aug 2026 and replaced by Firebase Auth against a real account, authorised by `nuika/admins/{uid}` with published database rules. **No password exists in the source.** Do not reintroduce one, and do not go looking for the old one.
>
> The string does still sit in `index.backup-v1.html`, which is committed and therefore **served publicly** — see *Known Gotchas* below.

`DELIVERY_COST` and `MIN_ORDER` are also gone: ordering is pickup-only, and the minimum is a count of items, not a shekel total.

---

## Product Data Model

Each product in the `PRODUCTS` array:

```js
{
  id: 1,                         // unique number (Date.now() for admin-added)
  nameHe: 'לחם מושלם לסופ״ש',
  nameEn: 'Perfect Weekend Loaf',
  descHe: 'קמח חיטה כפרי ומחמצת שיפון...',
  descEn: 'Country wheat & rye sourdough...',
  price: 30,
  illustration: 'images/1-lechem-mushalam.jpg',  // or base64 dataURL for admin-uploaded
  svg: null,
  soldOut: false,
  maxStock: null,   // number = weekly cap, null = unlimited
  tag: null         // 'popular' | 'new' | null
}
```

Products are persisted to `localStorage` key `nuika_products` when saved from admin. On load, this overrides the hardcoded array.

---

## LocalStorage Keys

| Key | Contents |
|-----|----------|
| `nuika_products` | Full products JSON array |
| `nuika_soldout` | `{id: boolean}` — fallback soldOut map |
| `nuika_order_log` | Array of order objects |
| `nuika_deadline` | Custom deadline ISO string (or absent = auto Tuesday 17:00) |
| `nuika_bit_link` | Bit payment URL (default: `https://bit.ly/nuika-bit`) |
| `nuika_orders_open` | `'0'` = closed, `'1'` or absent = open |
| `nuika_cust_name` | Saved customer name (pre-fills order form) |
| `nuika_cust_phone` | Saved customer phone |
| `nuika_last_order` | `[{id, qty}]` — last submitted order (for repeat-order feature) |

---

## Order Object Structure

```js
{
  id: 1700000000000,      // Date.now()
  name: 'רחל כהן',
  phone: '0501234567',
  items: '• לחם מושלם x1 = ₪30 | ...',   // human-readable string
  itemsArr: [                               // structured array
    { id: 1, name: 'לחם מושלם לסופ״ש', qty: 1, price: 30 }
  ],
  total: 55,
  delivery: 'pickup' | 'delivery',
  address: '',
  notes: '',
  date: '1.1.2026, 10:00:00',  // he-IL locale string
  timestamp: 1700000000000,
  status: 'new' | 'done',
  archived: false
}
```

---

## JavaScript Functions Reference

### Rendering
| Function | Purpose |
|----------|---------|
| `renderProducts()` | Renders all product cards to `#products-grid`. Shows tag badge, stock badge, sold-out stamp. |
| `updateCard(id)` | Updates a single card's visual state (in-cart badge, controls, icon) |
| `animateCard(id)` | Pulse animation on card tap |

### Cart
| Function | Purpose |
|----------|---------|
| `toggleProduct(id)` | Add/remove product from cart. Checks stock limit before adding. |
| `changeQty(e, id, delta)` | ±1 quantity. Respects `maxStock` cap. |
| `updateCard(id)` | Refresh card visual for qty |
| `updateCartBar()` | Update cart bar count, total, progress bar |
| `getCartTotal()` | Returns cart total in ₪ |
| `getCartCount()` | Returns total item count |

### Stock
| Function | Purpose |
|----------|---------|
| `getStockRemaining(productId)` | Returns `null` (unlimited) or number of units left. Calculated from active non-done orders. |

### Repeat Order
| Function | Purpose |
|----------|---------|
| `checkRepeatOrder()` | Shows `#repeat-order-banner` if `nuika_last_order` exists in localStorage |
| `repeatLastOrder()` | Fills cart from `nuika_last_order`, respects stock limits |

### Order Flow
| Function | Purpose |
|----------|---------|
| `openOrderModal()` | Opens order modal, pre-fills customer details |
| `submitOrder(method)` | Validates → saves `nuika_last_order` → sends WhatsApp/email → saves to log → thank you page |
| `saveCustomerDetails(name, phone)` | Saves to `nuika_cust_name` / `nuika_cust_phone` |
| `loadCustomerDetails()` | Pre-fills form from localStorage |
| `saveOrderToLog(orderData)` | Appends to `nuika_order_log` |
| `showThankYou(...)` | Shows thank-you overlay with Bit payment button |
| `backToMenu()` | Closes thank-you, clears cart |

### Admin
| Function | Purpose |
|----------|---------|
| `openAdminPanel()` | Opens panel, loads tab, deadline, order badge |
| `switchAdminTab(tab)` | Shows/hides tab content. Tabs: `dash`, `orders`, `menu`, `customers`, `settings` |
| `renderOrderManagement()` | Renders order cards with status controls |
| `renderAdminProducts()` | Renders product list in menu tab |
| `renderCustomers()` | CRM — aggregates orders by phone |
| `exportOrdersCSV()` | Downloads CSV with BOM for Hebrew Excel |
| `saveAdminSettings()` | Saves Bit link + soldOut states |
| `toggleOrdersStatus(checkbox)` | Opens/closes order taking |
| `printBakingList()` | Print view of all items to bake |
| `openEditProduct(id)` | Opens edit modal with product data (name, desc, price, maxStock, tag) |
| `openAddProduct()` | Opens edit modal for new product |
| `saveProductEdit()` | Saves product changes (incl. maxStock, tag) → `saveAllProducts()` |
| `deleteProduct()` | Removes from PRODUCTS array |
| `saveAllProducts()` | Persists PRODUCTS to `nuika_products` in localStorage |

### Deadline
| Function | Purpose |
|----------|---------|
| `getNextTuesdayDeadline()` | Auto deadline: next Tuesday 17:00. Checks localStorage first. |
| `getCustomDeadline()` | Reads `nuika_deadline` from localStorage |
| `saveDeadlineFromAdmin()` | Saves admin-entered date+time |
| `clearDeadline()` | Removes custom deadline, resets to auto |
| `loadDeadlineIntoAdmin()` | Populates admin deadline inputs |

### UX
| Function | Purpose |
|----------|---------|
| `haptic(ms)` | `navigator.vibrate(ms)` — haptic feedback |
| `updateProgressBar()` | Updates cart progress bar towards min order |
| `toggleLang()` | Toggles Hebrew/English. Uses `lang-content="he/en"` attribute system. |
| `enterSite()` | Dismisses landing page, calls `checkRepeatOrder()` |
| `installPWA()` | Triggers browser's PWA install prompt |

---

## HTML Structure (shop.html)

```
<head>
  Meta, PWA (manifest + iOS tags), Tailwind CDN, Google Fonts, custom CSS

<body>
  (no splash screen — removed in the cutover; the film page is the front
   door, and a gate here would have been a second one. The page opens
   straight onto the menu.)
  <header>              — Logo + PWA install btn + lang toggle + Instagram + WhatsApp
  <section#menu>        — Hero text + info pills + countdown
  <section#menu>        — #repeat-order-banner + #products-grid (injected by JS)
  #cart-bar             — Sticky bottom cart bar (progress bar + total + order button)
  #scroll-top-btn       — Floating scroll-to-top button
  #order-modal          — Order form overlay
  #thankyou-overlay     — Thank you page with Bit payment link
  #admin-login-overlay  — Admin sign-in (Firebase Auth; email + password checked on Firebase's servers)
  #admin-panel          — Full admin panel (tabbed)
  #edit-product-modal   — Product edit/add modal
  <footer>              — Contact info
  <script>              — All JavaScript (~1200+ lines)
```

### Admin Panel Tabs
```html
<div id="admin-tab-dash">       <!-- Dashboard: stats, baking summary, archive -->
<div id="admin-tab-orders">     <!-- Orders: filter/manage individual orders -->
<div id="admin-tab-menu">       <!-- Products: edit menu items -->
<div id="admin-tab-customers">  <!-- CRM: customers aggregated by phone -->
<div id="admin-tab-settings">   <!-- Settings: Bit link, deadline, orders on/off -->
```

---

## CSS Architecture

- **Tailwind CDN** with custom theme colors:
  - `earth` = `#6B3A2A` (dark brown)
  - `terracotta` = `#C4795A`
  - `ink` = `#2C1810`
  - `bark` = `#5A4A3A`
  - `muted` = `#8B7260`
  - `parchment` = `#EDE5D0`
  - `warm` = `#F7F2E8`
- **Custom fonts:** Frank Ruhl Libre (serif headings), Assistant (body), Playfair Display (accent)
- **Paper texture:** `body::after` fixed overlay, SVG fractalNoise, opacity 0.042, `mix-blend-mode: multiply`, `pointer-events: none`, `z-index: 9999`
- **RTL:** `<html dir="rtl" lang="he">`. English mode toggled via `.lang-en` on body + `lang-content` attributes.

---

## PWA Setup

**manifest.json** (`/NUIKA/manifest.json`):
- `start_url: "/NUIKA/"` — critical for GitHub Pages subdirectory
- `scope: "/NUIKA/"` — critical
- Shortcut to `?admin` (Android only — not supported on iOS Safari)

**sw.js** — service worker for offline caching.

**PWA Install button** (`#install-pwa-btn` in header):
- Hidden by default
- Shown when browser fires `beforeinstallprompt` event
- Calls `installPWA()` → `deferredPrompt.prompt()`
- Works on Android Chrome/Edge. On iOS: user must use Safari → Share → Add to Home Screen manually.

**Admin shortcut for Noy:**
- The shortcut IS in manifest.json. Anyone who installs the PWA gets it.
- Noy must: (1) uninstall old PWA, (2) visit site in Chrome on Android, (3) reinstall, (4) long-press icon.
- If Noy is on iPhone: shortcuts are NOT supported on iOS. She must manually visit `https://shaharazmon24.github.io/NUIKA/?admin`.

---

## Features Implemented

| # | Feature | Status |
|---|---------|--------|
| - | RTL Hebrew + English toggle | ✅ |
| - | Product grid with cart | ✅ |
| - | Order modal (name, phone, pickup/delivery) | ✅ |
| - | WhatsApp order to owner + confirmation to customer | ✅ |
| - | Email order fallback | ✅ |
| - | Thank-you page with Bit payment link | ✅ |
| - | Admin panel (5 tabs) | ✅ |
| - | Admin password gate (`?admin` URL) | ✅ |
| - | Order log with status management | ✅ |
| - | Baking list + print view | ✅ |
| - | CSV export (Hebrew Excel compatible) | ✅ |
| - | Customer CRM | ✅ |
| - | Deadline setting (auto Tuesday + manual override) | ✅ |
| - | Countdown timer on landing | ✅ |
| - | Bit payment link setting | ✅ |
| - | Orders open/close toggle | ✅ |
| - | Product edit/add/delete from admin | ✅ |
| - | Save customer details (pre-fill) | ✅ |
| - | Progress bar towards min order | ✅ |
| - | Haptic feedback | ✅ |
| - | Scroll-to-top button | ✅ |
| - | Paper texture overlay | ✅ |
| - | PWA manifest + service worker | ✅ |
| - | PWA install button | ✅ |
| - | PWA admin shortcut | ✅ |
| #5+27 | "נותרו X יחידות" — per-product weekly stock limit + auto sold-out | ✅ |
| #13 | "הזמני שוב" — repeat last order banner | ✅ |
| - | Product tags: "הכי פופולרי" 🔥 / "חדש השבוע" ✨ | ✅ |
| - | Dark mode | ❌ removed by user request |

---

## Design Language

- **Palette:** Warm parchment whites, earthy browns, terracotta accents
- **Typography:** Serif headings (Frank Ruhl Libre), sans body (Assistant)
- **Vibe:** Artisan, homemade, warm — not clinical or techy
- **Cards:** Rounded corners, subtle shadows, cream backgrounds
- **Interactions:** Subtle scale transforms, haptic feedback, smooth transitions

---

## Known Gotchas

1. **Function hoisting trap:** Don't wrap functions using `const orig = fn; function fn() { orig(); ... }` — causes infinite recursion because `function` declarations are hoisted. Edit the function body directly.

2. **The site serves from the domain root,** `https://nuika.co.il` — not from a `/NUIKA/` subdirectory. Keep every asset path **relative** (`./shop.html`, `icon-192.png`), so it is correct on the domain and on the old `shaharazmon24.github.io/NUIKA` host, which still redirects here. `manifest.json` uses `"./"` for `id` and `scope` and `"./shop.html"` for `start_url`.

   > This item used to say the opposite — that all absolute URLs must carry a `/NUIKA/` prefix. That was true of the old subdirectory layout and has been wrong since the custom domain landed.

   **Never change `manifest.json`'s `id`.** It is the installed app's identity, not a URL to keep current: changing it makes browsers treat this as a new app and orphans the icon already on Noy's home screen.

3. **Orders go to Firebase, and every device sees them.** A customer's order is written to `nuika/orders` and appears in Noy's admin panel wherever she opens it.

   > This item used to say orders would **not** appear in Noy's admin unless she was on the same device, "by design (no backend)". That describes the state before the Firebase layer, and it is exactly the belief that led to the layer being deleted and to two days of customers seeing a menu that no longer existed.

   What *is* per-device is `localStorage`: the customer's own cart, saved name and phone, and last order. Nothing Noy manages belongs there.

4. **Image uploads in admin:** stored as base64 inside the products node in Firebase, so every visitor downloads them on every load. Compress before uploading, or move them to Firebase Storage.

5. **Stock is derived from the orders in the current cycle, not from order status.** `getStockRemaining()` counts orders inside the window `currentCycle()` returns, and the cycle is anchored to the ISO week so that nudging the deadline cannot move it.

   > This item used to say stock "frees up accordingly" when Noy marks an order done or archives it, counted out of a `nuika_order_log` key in `localStorage`. Both halves are wrong: the log lives in Firebase, and freeing stock on status was a real bug — ticking a delivered order off handed its loaves back to the shop and oversold the week.

6. **`index.backup-v1.html` is committed, and GitHub Pages serves it.** Measured 22 Sep 2026: `https://nuika.co.il/index.backup-v1.html` returns **HTTP 200**, 80,978 bytes, and contains the pre-Firebase source including `const ADMIN_PASSWORD = 'nuika2026';` in plain text.

   It is **not** a working credential for the admin panel — sign-in has been Firebase Auth against a real account since 17 Aug 2026, authorised by `nuika/admins/{uid}`, and the database rules are published. The risks are that the string may be reused somewhere else, and that a stale full copy of the shop sitting on the live site is the kind of thing someone restores from.

   Recorded here rather than fixed: removing a published file is a change to what the site serves, and that is the owner's call, not a documentation edit's.

7. **Nothing validates this file.** `scripts/validate.mjs` reads no documentation at all — not this file, not `CLAUDE.md`, not the Hebrew guides. Every factual claim in them is unguarded and drifts silently as the code moves; four claims in this file were false before 22 Sep 2026. If a document says something load-bearing, check it against the code.

---

## Pending / Future Ideas

- Push notifications for new orders (requires backend/service)
- Weekly reset of stock automatically (e.g., every Wednesday)
- Email/SMS order confirmation backend
- Analytics dashboard
- Waitlist when sold out
- Multi-week menu scheduling
