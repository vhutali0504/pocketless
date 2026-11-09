# Decisions

Every significant decision and why.

## Builder's calls (spec section 7, not confirmed by the owner)

- The 18+ age requirement for accounts.
- The 200-card limit, and "most recently used" ordering with pinning.
- "Other store" cards use a fixed colour palette.
- Cookieless analytics plus a notice banner, rather than a consent wall.
- The backup nudge appears after 2 cards and stays away for 30 days after dismissal.
- Newest change wins when syncing.
- Card values are protected by RLS and encryption at rest, not end-to-end encryption, with a warning when a value looks like an SA ID number.
- No PIN or biometric lock in version one.
- Sign-in to a phone with guest cards asks before merging. Sign-out removes that account's cards from the phone.
- A 6-digit email code instead of magic links.
- No Google sign-in in version one, to avoid needing Sign in with Apple as well.
- Native scanning through ML Kit, and native brightness control, in the store apps.

## Added during the core wallet build

- No refund policy page: the app is free, so there is nothing to refund.
- Fonts (Baloo 2 and Nunito) are self-hosted through Fontsource, so no visitor data goes to a font CDN.
- Woolworths is deferred until its barcode format has been tested on a real card.
- react-router-dom pinned to 6.30.x (not 6.28 as planned) to pick up security fixes for redirect advisories.
- Accepted risk: two moderate react-router 6.x advisories remain (GHSA-wrjc-x8rr-h8h6, SSR-only; GHSA-337j-9hxr-rhxg, backslash open-redirect only when navigating to user-supplied URLs). The app has no SSR and never navigates to user input; revisit before any such feature or upgrade to v7.
- Logo SVGs redrawn from the owner's brand sheet; awaiting owner approval (regenerate icons with `npm run icons` after any change). The brand sheet is kept at `docs/brand/pocketless-brand-sheet.png` as the reference. The wordmark is Baloo 2 ExtraBold converted to outlines by `npm run icons`, using opentype.js (dev-only, used by that script alone).
- The PWA manifest is served at `/manifest.webmanifest` with `scope` and `start_url` `/app/`. Vite keeps base `/`, so the service worker lives at `/sw.js` (scope `/`) and its navigation fallback is `/index.html`, allowed only for `/app` URLs.
- The ZXing scanner is built as its own `zxing-*.js` chunk. It is left out of the precache and cached on first use (CacheFirst), so the app shell stays small and scanning still works offline once used.
- The iPhone 14 Playwright project runs in Chromium with the iPhone viewport and user agent. Playwright's WebKit on Windows blocks offline navigations before the service worker can answer them, so the offline test cannot run there. Check offline behaviour on a real iPhone before launch.
