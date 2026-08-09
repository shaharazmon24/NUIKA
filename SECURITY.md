# Database security — DONE

> **Completed 10 August 2026.** Rules are published and verified: an
> unauthenticated read of `nuika/orders` and `nuika/kitchen` returns
> PERMISSION_DENIED, the menu still loads publicly, and ordering works.
> The steps below are kept as a record and for rebuilding from scratch.

Before this was done, the database was world-readable and world-writable. Anyone who opens
the site can read every order — **names, phone numbers, addresses** — or delete
the entire shop with a single request. The admin password sitting in the page
source protects the panel's appearance, nothing more.

The app code already supports the locked-down setup. What remains is four
console steps. **Do them in this order.** Applying the rules before Noy's
account exists locks her out of her own shop.

---

## 1. Turn on the two sign-in methods

[Firebase Console](https://console.firebase.google.com) → project **NUIKA** →
**Authentication** → **Get started** → **Sign-in method** tab.

Enable both:

- **Anonymous** — this is how customers get an identity. Without it they cannot
  place an order once the rules are live.
- **Email/Password** — this is how Noy signs in. Leave "Email link" off.

---

## 2. Create Noy's account

Same page → **Users** tab → **Add user**.

- Email: `noynaamad@gmail.com`
- Password: pick a real one, at least 12 characters, and **not** `nuika2026`.
  Send it to her over Signal or WhatsApp, not email.

Add a second user for Shahar the same way if you want your own login.

Then copy each **User UID** from the list — the long string like
`k3Jd8fQ2...`. You need it for the next step.

---

## 3. Mark those accounts as admins

> **Do steps 3 and 4 back to back, in one sitting.** Between them the database
> is still world-writable, so anyone holding the public config could add
> themselves to `admins` — and once step 4 lands, nothing in the app can remove
> them. After publishing, reopen the Data tab and confirm `admins` contains
> exactly the uids you expect and nothing else.
>
> Before you start, open the admin panel and switch **קבלת הזמנות** off. A tab
> that was already open will not pick up the new sign-in, and any order placed
> from it during the switchover is lost while the customer is told it was sent.
> Switch it back on once step 5 passes, and tell Noy to hard-refresh.

**Realtime Database** → **Data** tab. Hover `nuika`, press **+**, and create:

```
nuika
 └── admins
      └── <Noy's UID>   : true
      └── <Shahar's UID>: true
```

The value must be the boolean `true`, not the text `"true"`. Firebase shows
booleans without quotation marks.

This node is what the rules check. An account that is not listed here can sign
in but gets no more access than a customer.

---

## 4. Publish the rules

**Realtime Database** → **Rules** tab. Replace everything with the contents of
[`firebase-rules.json`](firebase-rules.json) and press **Publish**.

What changes the moment you do:

| Data | Before | After |
|---|---|---|
| Menu, prices, opening hours | anyone can read **and rewrite** | anyone can read, only an admin writes |
| Orders — names, phones, addresses | **anyone can read all of them** | only an admin can read; a customer can create their own and nothing else |
| Recipes, supplier prices, margins | anyone can read | only an admin |
| Whole database | anyone can delete it | nobody but an admin |

---

## 5. Check it worked

Two minutes, worth doing.

**As a customer** — open the shop in a private window and place a test order.
It should go through, and the "נותרו N יחידות" counts should still be right.
Then open the browser console and run:

```js
firebase.database().ref('nuika/orders').once('value').then(s => console.log(s.val()))
```

It must fail with **PERMISSION_DENIED**. If it prints orders instead, the rules
did not apply — re-check step 4.

**As Noy** — open `nuika.co.il/?admin`, sign in with the new email and password,
and confirm the orders, customers and kitchen tabs all still fill in.

**Check the existing orders.** The rules now type every field. Any order already
in the database with a missing phone, a name over 80 characters, or a total
stored as text will refuse to update, so marking it delivered fails with
"השמירה נכשלה". Open the orders tab and step one old order through its
statuses. If it fails, ask Claude to clean the legacy rows.

---

## 6. Remove the fallback password — DONE

The temporary `ADMIN_PASSWORD` constant and the branch that used it have been
deleted. No password appears anywhere in the source now: Firebase verifies it
server-side, and the rules are what protect the data.

If a password is ever forgotten, use the **שכחתי סיסמה** link on the admin
sign-in screen rather than editing anything in the console.

---

## What this does not cover

- **The Firebase config in `index.html` is public and that is fine.** It is an
  address, not a credential. The rules are what protect the data.
- **A signed-in customer can still raise a stock counter**, which would make an
  item look sold out sooner than it should. The rules stop them lowering or
  deleting one, so they cannot make a sold-out item look available. It exposes
  no one's data, and Noy's panel recomputes the real numbers from the orders
  each time she opens it.

- **The menu, prices, opening hours and payment links stay publicly readable.**
  They have to be — that is the shop. Note this includes the Bit and PayBox
  links, so treat those as public information.

- **Order volume is inferable.** The stock counters are public by design, so
  someone polling them could work out roughly how much sold and when. No names,
  phones or addresses are involved.
- **Product photos and the menu stay public** — they have to be; that is the
  shop.
