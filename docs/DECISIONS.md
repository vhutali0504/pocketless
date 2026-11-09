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
- Accepted risk: two moderate react-router 6.x advisories remain. GHSA-wrjc-x8rr-h8h6 is a backslash open redirect in `<Link>` and `useNavigate`, which only matters when navigating to user-supplied URLs. GHSA-337j-9hxr-rhxg is in SSR `deserializeErrors`, which only matters with server rendering. The app has no SSR and never navigates to user input; revisit before adding either, or upgrade to v7.
- Logo: the icon in `client/public/brand/pocketless-icon.svg` uses the exact geometry from the owner's own brand board (`docs/brand/pocketless-brand-board.svg`, supplied 2026-11-09), scaled ×2 to a 200-unit viewBox. Regenerate the PWA icons with `npm run icons` after any change. The brand sheet is kept at `docs/brand/pocketless-brand-sheet.png` as the reference. The wordmark is Baloo 2 ExtraBold converted to outlines by `npm run icons`, using opentype.js (dev-only, used by that script alone).
- The PWA manifest is served at `/manifest.webmanifest` with `scope` and `start_url` `/app/`. Vite keeps base `/`, so the service worker lives at `/sw.js` (scope `/`) and its navigation fallback is `/index.html`, allowed only for `/app` URLs.
- The ZXing scanner is built as its own `zxing-*.js` chunk. It is left out of the precache and cached on first use (CacheFirst), so the app shell stays small and scanning still works offline once used.
- The iPhone 14 Playwright project runs in Chromium with the iPhone viewport and user agent. Playwright's WebKit on Windows blocks offline navigations before the service worker can answer them, so the offline test cannot run there. Check offline behaviour on a real iPhone before launch.
- Failure screens: when local storage is unavailable, every `/app` route shows one plain page (no buttons, since nothing on the page can fix it). Any render crash under `/app` shows "Something went wrong. Your cards are safe on this phone." with a Reload button. The error is logged to the console only, never sent anywhere.
- While a card is out at the till, the header and the other cards get the `inert` attribute, and the confirm dialog renders into `<body>` and makes everything else `inert` while open, so keyboard and screen reader users can't reach the page behind.
- Lighthouse 12.2.1 against `npm run preview`, `/app` (empty wallet), 2026-11-09: mobile Performance 99, Accessibility 100 (FCP 1.7 s, LCP 2.0 s, TBT 0 ms, CLS 0.001); desktop Performance 100, Accessibility 100. Lighthouse 12 no longer has a PWA category, so installability is covered by the e2e tests instead: the manifest test (scope, start_url, display, colours, 192/512/maskable icons all served) and the offline test (service worker controls the page and serves the wallet offline). Chromium's `Page.getInstallabilityErrors` was tried as a check but returns no errors even for a page with no manifest in headless Playwright, so it can't be used as a test.
- axe (WCAG 2.0/2.1 A and AA tags) reports no serious or critical violations on the wallet, the add flow and card details, in light and dark. The add flow and card details pages had no `<main>` landmark, which axe flagged as two moderate best-practice findings (`landmark-one-main`, `region`). Each of those pages now renders its content inside one `<main>`, and the axe e2e test also runs the landmark rules (`landmark-one-main`, `region`, `landmark-no-duplicate-main`) and fails on any finding, moderate included.
- BarcodeView must not depend on inline style attributes; the app must work under a strict CSP (style-src 'self'). Plan 3 will set the CSP header. JsBarcode colours its background and bars with `style` attributes, which such a CSP blocks (the barcode then draws solid black), so BarcodeView also sets `fill` presentation attributes and BarcodeView.css sets the same colours. An e2e test serves the app with `Content-Security-Policy: style-src 'self'` and checks the barcode's pixels. The barcode panel also sets `forced-color-adjust: none` so forced-colours modes can't recolour it.
- The service worker scope is '/' and navigateFallback is '/index.html' (the app shell). When the landing page moves to '/', the app shell must get its own HTML entry (e.g. /app/index.html) and navigateFallback must point to it. Until then the fallback is allowed only for `/app` and `/app/...` (`/^\/app(\/|$)/`), so other paths that merely start with "app" (such as `/apple-app-site-association`) never get the app shell.
- Scan consensus counts frames, not reads: a code is accepted once it appears in 3 consecutive camera frames. BarcodeDetector returns every code in a frame, so with two codes in view a read-by-read run (A, B, A, B) would never reach 3. A frame with no valid reads (blur) keeps the counts; a frame with valid reads drops any code it doesn't contain.
- The scanner falls back to ZXing when BarcodeDetector is present but broken (its `getSupportedFormats()` or constructor throws), and switches to ZXing for the rest of the session after 10 `detect()` failures in a row.
- "Change number" on card details prefers the card's current format, so a CODE_128 card whose new digits happen to pass an EAN check digit stays CODE_128.
- Only the Latin subsets of Nunito and Baloo 2 are bundled and precached (the `latin-*.css` Fontsource entries). Characters outside Latin fall back to the system font.
- Light or dark (owner's request, 2026-11-09): the app follows the phone by default, and a switch in the wallet header lets people pick light or dark without going into phone settings. The choice is remembered on the phone (localStorage) and applied before the first frame by `/theme-init.js`. The barcode panel is black on white in both themes. (This replaced an earlier "light only" setting.)
- App updates (2026-11-09): the app registers its own service worker (client/src/sw-updates.js), checks for a new version each time it's opened or brought to the front, and reloads into it only on the wallet screen with no card out, so it never interrupts the till or a half-added card.
- Barcode as a picture (2026-11-09): Samsung Internet's own dark mode repainted the in-page SVG barcode grey on grey (seen on the owner's phone). BarcodeView now shows the barcode as an <img> (SVG data URL) with its own white quiet zone; browser dark modes leave pictures alone. Plan 3's CSP must therefore allow `img-src 'self' data:`.
- Samsung Internet dark mode (resolved 2026-11-09): its own dark mode greyed the barcode while the app was "light only". Once the app had its own dark theme and an in-app light/dark switch, the owner confirmed on their Samsung phone that switching to light shows the barcode black on white.
