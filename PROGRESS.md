# Fledge Userflow Progress Log

## 2025-12-15
- Scaffolded new userflow console and storefront in `fledge-userflow/` separate from main FledgeBase.
- Added Quick Start wizard (generate keys → mint via Continuebee/BDO/Sanora → profile → store → seed products), env selector, identity export/import, and admin BDO JSON panel.
- Built storefront (`store.html`) that reads `?code`/`?storeId`, fetches BDO public store metadata, and lists Sanora products (store + global, hides private).
- Added product management basics in console: add products with visibility (global/store/private), refresh my/global lists, and auto-load products on login/mint.

- Split experiences into dedicated pages: `index.html` (landing), `login.html` (crypto login/signup), `console.html` (owner console wizard), `store.html` (public), `checkout.html` (branded checkout shell), plus admin placeholders (`admin-dashboard.html`, `admin-analytics.html`).
- Unified identity creation on mint/login: now provisions Continuebee, BDO, Sanora, Addie, and Fount at account creation and saves combined profile/store to BDO in one write; restores state from localStorage including `fountUuid`.
- Refreshed `store.html` UI with hero badges, refresh CTA, and enforced 3-up product card grid with hover/shadow polish while keeping live fetch logic for BDO/Sanora products.
- Added branded checkout scaffolding aligned with Fledge Base gradients/colors for future wiring.
- Wired admin dashboard to live services via admin.js: pulls Sanora global/store products, Dolores feed, Covenant health; renders visibility bars, live product table, service health, and BDO snapshot from stored profile/store.
- Added UX polish: toasts + inline validation (profile/store/product), copy-to-clipboard for UUID/emoji/hash/store link, and refreshed storefront to Tailwind dark gradient style.
- Added a11y/validation polish: toast containers aria-live, email validation on profile save, store name validation, copy-to-clipboard for store link/pills, and login success/error toasts.
- Wired checkout to Addie sandbox: uses stored sessionless keys, ensures Addie user, creates Stripe intent via /user/:uuid/processor/stripe/intent, and redirects if checkoutUrl returned (toasts on success/error).
- Added cart + checkout wiring: store now has add-to-cart buttons and cart badge, cart stored in localStorage; checkout renders cart, validates keys (login-with-key), creates Addie Stripe intent (/user/:uuid/processor/stripe/intent) with total, toasts + redirects if checkoutUrl present.
- Restored key bundle download with toasts in login (exports UUID/hash/keys) and copy-to-clipboard UX retained.

## 2025-12-16
- Added dedicated `mini-dashboard.html` experience wired to live Sanora/BDO data via new `mini-dashboard.js`: restores identity from storage, shows store link/UUIDs, fetches store + global products, computes stats, renders product table, and supports quick product add (signed sessionless upsert).
- Added login-with-key CTA and copy-link/refresh actions to the mini dashboard, plus toast feedback.
- Updated `nav.js` dropdown to include Mini Dashboard for quick navigation.
- Rebuilt `console.html` into a Tailwind product manager UI while preserving all existing IDs/hooks for onboarding, profile/store save, product CRUD, BDO editor, and logs.
- Added dedicated `product-manager.html` + `product-manager.js`: a streamlined product management page (no legacy console), wired to Sanora/BDO for identity restore, store link copy, product listing/stats, and quick add; removed console from nav and linked new manager instead.
- Pivoted checkout to hosted Stripe Checkout flow: `checkout.html` now requests `/user/:uuid/processor/stripe/checkout-session`, redirects via returned URL or sessionId/publishable key, and shows success/cancel banners based on query params; retains cart rendering and sessionless key prompts.
- Added Stripe PaymentIntent fallback to `checkout.html` using Stripe.js card element: mounts card, confirms `payment_intent` when Checkout session endpoint is absent, and shows inline card errors.
