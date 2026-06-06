# 🍞 NUIKA — Project Passport
> **Context document for AI assistants.** Load this at the start of every new session so work can continue without re-explanation.

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

**Single-file app.** Everything lives in `index.html` — HTML + CSS (Tailwind CDN + custom) + JavaScript. There is no build step, no npm, no framework.

**Supporting files:**
- `manifest.json` — PWA manifest (icons, shortcuts, start URL)
- `sw.js` — Service Worker (caches assets for offline)
- `logo.png.png` — logo (double extension, intentional)
- `images/` — product photos (`1-lechem-mushalam.jpg`, `2-lechem-kusmin.jpg`, etc.)
- `PASSPORT.md` — this file

**Persistence:** `localStorage` only. No backend. Data is per-device.

**Hosting:** GitHub Pages at `/NUIKA/` subdirectory. All manifest URLs use `/NUIKA/` prefix.

---

## Key Constants (in index.html script section)

```js
const ADMIN_PASSWORD = 'nuika2026';
const OWNER_WHATSAPP = '972547382282';
const OWNER_EMAIL    = 'shaharazmon24@gmail.com';
const DELIVERY_COST  = 25;
const MIN_ORDER      = 100;
```

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

## HTML Structure (index.html)

```
<head>
  Meta, Tailwind CDN, Google Fonts, custom CSS (~875 lines)

<body>
  #landing              — Full-screen landing page with CTA button
  <header>              — Logo + PWA install btn + lang toggle + Instagram + WhatsApp
  <section#menu>        — Hero text + info pills + countdown
  <section#menu>        — #repeat-order-banner + #products-grid (injected by JS)
  #cart-bar             — Sticky bottom cart bar (progress bar + total + order button)
  #scroll-top-btn       — Floating scroll-to-top button
  #order-modal          — Order form overlay
  #thankyou-overlay     — Thank you page with Bit payment link
  #admin-login-overlay  — Admin password gate
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

2. **GitHub Pages subdirectory:** All absolute URLs must use `/NUIKA/` prefix. The manifest was previously broken because `start_url: "/index.html"` resolved to the root domain.

3. **localStorage is per-device:** Orders placed on customer phones will NOT appear in Noy's admin unless she's viewing on the same device. This is by design (no backend). Noy uses her own phone to receive WhatsApp orders and manages the admin on her device.

4. **Image uploads in admin:** Stored as base64 data URLs in localStorage. Large images will inflate localStorage quota. Recommend compressing before uploading.

5. **Stock calculation:** `getStockRemaining()` counts all non-archived, non-done orders from `nuika_order_log`. If Noy marks orders as "done" or archives them, stock frees up accordingly.

---

## Pending / Future Ideas

- Push notifications for new orders (requires backend/service)
- Weekly reset of stock automatically (e.g., every Wednesday)
- Email/SMS order confirmation backend
- Analytics dashboard
- Waitlist when sold out
- Multi-week menu scheduling
