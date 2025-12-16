# The Fledge Base – UX Build Roadmap

## Structure
- `landing.html`: Global landing with hero, value props, carousel, CTA to login/console.
- `login.html`: Cryptographic login/signup flow; shows generated emoji/UUID, copy, export key, enter dashboard.
- `console.html`: Owner console (product manager + mini-store dashboard + orders/settings/analytics panels).
- `store.html`: Public mini-store storefront with 3-up product cards; uses `storeId`/`code` query params.
- `checkout.html`: Brandable checkout (Fledge defaults, customizable later).
- `admin-dashboard.html`: Global control center (admin-only) for mini-store management, user ledger, platform settings, and broadcasts — now live-wired to Sanora (products), Dolores (feed), and Covenant (health) via `admin.js`.
- `admin-analytics.html`: Global analytics (network-wide KPIs, top stores/products, heatmaps, activity feed) — next to wire to live data similar to `admin.js`.

## Styling/Framework
- Use Tailwind via CDN (as in provided mocks) for all new pages.
- Keep a minimal shared CSS only if needed for legacy tokens; otherwise rely on Tailwind utilities and gradient styles from mocks.

## Wiring to Existing Logic (`script.js`)
- Keygen/Mint/Login: Reuse sessionless handlers; surface emoji/UUID prominently.
- Identity: Export/import flows for key bundle; copy-to-clipboard for emoji/UUID.
- Store: Load/save store metadata; generate store link; “Visit store” CTAs.
- Products: Save product (visibility global/store/private), list my products, list global; render as card grids (3-up on desktop).
- Public store (`store.html`): Fetch meta + products via `storeId`/`code`; show empty/loading states.

## Page-Specific Notes
- Landing: Hero CTA → `login.html` (or smooth-scroll if embedded). Secondary CTA to docs/global store.
- Login: Multi-step feel; warning about no password reset; “Enter Dashboard” → `console.html`; “Download key” → export handler.
- Console: Use Product Manager UI; replace UL lists with card grids; include orders/settings/analytics sections (static placeholders ok); sidebar anchors to sections.
- Storefront: Apply new card/grid styling, 3-across desktop, responsive auto-fit; badges for visibility/price.
- Checkout: Keep as branded default; steps Review → Shipping → Payment; static for now, wire later.
- Admin (separate access path): Use dashboard/analytics mocks with placeholder data; include mini-store list, user ledger, global settings stubs, global KPIs, charts, heatmap, activity feed; add fetch stubs for future APIs.

## UX Polish
- Empty/loading/error states on grids and meta fetches.
- Helper text on visibility rules; inline validation for product/store forms.
- Toasts/snackbars for save/mint/copy/link actions.
- Copy-to-clipboard for emoji/UUID and store link; clear success messaging.
- Accessibility: focus states, labels, aria for charts/buttons where applicable.

## Implementation Steps
1) Add new pages (`landing.html`, `login.html`, `console.html`, `checkout.html`; update `store.html`).
2) Import Tailwind CDN on each page; remove dependency on `styles.css` except for any shared tokens.
3) Port existing logic by page: bind CTAs to keygen/mint/login; wire product/store actions; enforce 3-up grids.
4) Replace old `index.html` with `landing.html` entry; keep public store at `store.html`.
5) Add admin analytics wiring: mirror `admin.js` patterns (Sanora, Dolores, Covenant) to replace placeholder charts/feeds in `admin-analytics.html`.

## Open Questions
- Keep single-page anchors vs. separate pages? (Plan assumes separate pages.)
- Any API endpoints for orders/analytics yet, or keep placeholders? (Currently: placeholders)
- Branding overrides per mini-store at launch, or later?
