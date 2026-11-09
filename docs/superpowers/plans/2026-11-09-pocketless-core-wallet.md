# Pocketless Core Wallet Implementation Plan (Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the offline, guest-only Pocketless wallet as an installable PWA at `/app`. A user can add a loyalty card (pick store, scan or type, confirm), see it in a stacked wallet, pull it out to show a scannable barcode at the till, and edit or delete it. Everything works with no network.

**Architecture:** A single Vite + React SPA in `client/`, with React Router. App routes live under `/app/*`, and the PWA scope is `/app/`. Cards are stored in IndexedDB behind a small `CardStore` interface, so Plan 2 (sync) and Plan 4 (Capacitor storage) can swap or extend it. Pure logic (validation, consensus, card rules) sits in plain modules with unit tests. UI is tested with Testing Library, and full flows with Playwright.

**Tech Stack:** Vite 5.4, React 18.3, react-router-dom 6.28, idb 8, jsbarcode 3.11, qrcode 1.5, @zxing/browser 0.1.5 (lazy-loaded), vite-plugin-pwa 0.21, Vitest 2 + jsdom + @testing-library/react 16 + fake-indexeddb 6, @playwright/test 1.49 + @axe-core/playwright 4.10, @fontsource/nunito and @fontsource/baloo-2 (OFL, self-hosted), sharp 0.33 (icon script only). Pin these exact versions in `package.json`.

**Spec:** `docs/superpowers/specs/2026-11-09-pocketless-design.md`

**Later plans (not in scope here):** Plan 2 covers accounts and sync (Supabase, RLS, Gmail SMTP, backup nudge, the Settings screen, delete account). Plan 3 covers the website and legal pages (landing `/`, privacy, terms, cookies, contact, 404, SEO, analytics). Plan 4 covers the native apps (Capacitor, ML Kit scanning, brightness, native storage, store submissions).

## Global Constraints

- Opening a card must never wait on the network, a sign-up nudge, a spinner, or an animation longer than about 350 ms.
- Card slide-out motion: about 340 ms, `cubic-bezier(.2,.8,.2,1)`. The barcode panel fades in about 140 ms after the card starts moving. With `prefers-reduced-motion: reduce`, the card appears with no slide.
- Never save a scanned or typed value without the user confirming it on the "Check your card" screen.
- Decode the barcode itself, never OCR. Accept a scan only after **3 consecutive identical decodes**. Discard reads that fail the format's checksum.
- Store the decoded **value and format**, never a photo.
- If a value looks like a 13-digit SA ID number (valid Luhn and a plausible YYMMDD date of birth), warn the user and require a second confirmation.
- Allow a maximum of **200 cards** per owner. Every text field is length-limited (`displayName` ≤ 40, `programme` ≤ 40, `value` ≤ 64).
- The barcode panel is always pure black on pure white, whatever the theme.
- Brand: Aubergine `#43144F`, Mango `#FFC02E`, Cream `#FFF6E6`, dark surface about `#1A1320`. **Mango is never used for text on Cream or white.** Store cards keep their own colours.
- Fonts: Baloo 2 (wordmark and headings only) and Nunito (body), both self-hosted. **Not Inter.**
- Ground rules (`docs/GROUND_RULES.md` §4): no purple-to-blue gradients, no gradient text, no glassmorphism, no emoji in headings, no fade-in-on-scroll, no badge above the headline, no colored left-border cards, no buttons that fade on hover, and no buzzword copy. Use em dashes sparingly in copy.
- Accessibility: every control is reachable by keyboard, AA contrast, cards carry a text label (never colour alone), and every image has alt text.
- The app shell JS is under about 150 KB gzipped. The scanner library loads only when "Add card" is opened.
- No third-party scripts or network calls in the app in this plan. Fonts are bundled locally.
- Project layout follows the owner's structure: `client/` (with `src/{api,components,pages,context,hooks,styles}`), `server/` (only `server/scripts/` in this plan), `docs/`. Shared config sits at the root.

## Review Focus

1. **Camera permission denied, or no camera** (desktop, iOS home-screen app): the scan step shows a plain message and the "Type the number instead" route, and is never a blank or stuck screen. *Pinned by Task 8, `scan-permission-denied` test.*
2. **IndexedDB unavailable** (private mode, blocked storage): the app shows a clear "Pocketless can't save cards in this browser" screen instead of a white page or an uncaught error. *Pinned by Task 11, `storage-unavailable` test.*
3. **Rapid double or triple taps on a card while it's animating**: the wallet ends in a consistent state (one card out, or none), never two cards out or a card stuck mid-way. *Pinned by Task 7, `rapid-taps` test.*
4. **Very long names and a full wallet of 200 cards**: names truncate with an ellipsis, the stack scrolls, and pulling a card out stays smooth. *Pinned by Task 7, `long-names-and-200-cards` test.*
5. **Adding the same card twice** (same store and value): warn "You already have this card" on the confirm screen, offering to open the existing card. Never create a silent duplicate. *Pinned by Task 4 (`addCard` throws `DuplicateCardError`) and Task 8 (`duplicate-card` test).*

---

## File Structure

```
package.json, vite.config.js, vitest.config.js, playwright.config.js, eslint.config.js, .gitignore
client/
  index.html
  public/brand/              pocketless-icon.svg, pocketless-logo.svg, generated PNG icons
  src/
    main.jsx, App.jsx        router: /app/* routes, /  → redirect to /app for now
    lib/barcode.js           formats, checksums, inferFormat, looksLikeSaId, normaliseValue
    lib/stores.js            built-in store catalogue + "Other" colour palette
    lib/cards.js             card rules: create/update/delete/markUsed/sortWallet, errors
    lib/scan-consensus.js    3-in-a-row consensus
    api/card-store.js        CardStore interface + IndexedDB implementation
    api/scanner.js           camera scanner adapter (BarcodeDetector → ZXing fallback)
    context/CardsContext.jsx cards state + actions for owner 'guest'
    hooks/useWakeLock.js
    hooks/useReducedMotion.js
    components/barcode/BarcodeView.jsx
    components/wallet/CardStack.jsx, WalletCard.jsx
    components/ui/           Button.jsx, ConfirmDialog.jsx, AppHeader.jsx
    pages/app/WalletPage.jsx
    pages/app/add/AddCardPage.jsx, StorePicker.jsx, ScanStep.jsx, ManualEntry.jsx, ConfirmStep.jsx
    pages/app/CardDetailsPage.jsx
    pages/app/StorageUnavailable.jsx
    styles/tokens.css, global.css, wallet.css
  tests/                     unit + component tests (*.test.js[x]); e2e/ for Playwright
server/scripts/generate-icons.mjs, check-bundle-size.mjs
docs/GROUND_RULES.md, docs/DECISIONS.md
```

**Shared types (JSDoc, defined in `lib/cards.js` and used everywhere):**

```js
/** @typedef {'EAN_13'|'EAN_8'|'UPC_A'|'CODE_128'|'CODE_39'|'ITF'|'QR_CODE'} BarcodeFormat */
/** @typedef {{
 *  id: string, owner: string, storeKey: string, displayName: string, programme: string,
 *  colour: string, value: string, format: BarcodeFormat, pinned: boolean, sortHint: number,
 *  lastUsedAt: number|null, createdAt: string, updatedAt: string, deletedAt: string|null
 * }} Card */
```

`owner` is always `'guest'` in this plan. `lastUsedAt` is local-only and is never synced (Plan 2 must exclude it).

---

### Task 1: Project scaffold, ground rules and brand tokens

**Files:**
- Create: `package.json`, `vite.config.js`, `vitest.config.js`, `playwright.config.js`, `eslint.config.js`, `client/index.html`, `client/src/main.jsx`, `client/src/App.jsx`, `client/src/styles/tokens.css`, `client/src/styles/global.css`, `docs/GROUND_RULES.md`, `docs/DECISIONS.md`, `client/tests/setup.js`
- Modify: `.gitignore` (add `test-results/`, `playwright-report/`, `coverage/`)
- Test: `client/tests/App.test.jsx`

**Interfaces:**
- Produces: `npm run dev | build | preview | test | test:e2e | lint`. CSS custom properties `--c-aubergine`, `--c-mango`, `--c-cream`, `--c-surface`, `--c-text`, `--c-text-muted`, `--c-bg`, `--motion-card: 340ms`, `--ease-card: cubic-bezier(.2,.8,.2,1)`, `--font-display: 'Baloo 2'`, `--font-body: 'Nunito'`. These are light by default, redefined under `@media (prefers-color-scheme: dark)`.

- [ ] **Step 1:** Create the root `package.json` (`"type": "module"`, the pinned deps from the Tech Stack) and `vite.config.js` with `root: 'client'`, `build.outDir: '../dist'`, `@vitejs/plugin-react`. Create `vitest.config.js` (jsdom, `setupFiles: client/tests/setup.js` importing `@testing-library/jest-dom` and `fake-indexeddb/auto`). Create `playwright.config.js` (`webServer: npm run build && npm run preview -- --port 4173`, a Pixel 7 project and an iPhone 14 project).
- [ ] **Step 2: Write the failing test** `client/tests/App.test.jsx`:
  ```jsx
  test('renders the wallet heading at /app', async () => {
    render(<MemoryRouter initialEntries={['/app']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Pocketless' })).toBeInTheDocument();
  });
  ```
- [ ] **Step 3:** Run `npm test -- App`. Expected: FAIL (App not found).
- [ ] **Step 4:** Implement `App.jsx` (routes: `/` → `<Navigate to="/app" />`, `/app` → a placeholder `<h1>Pocketless</h1>`), `main.jsx` (BrowserRouter, imports the fonts and the `tokens.css` and `global.css` styles), and `tokens.css` with the values above. Light: bg Cream, text Aubergine. Dark: bg `#1A1320`, text Cream. `global.css` gives `body` an explicit background and sets `-webkit-tap-highlight-color: transparent`.
- [ ] **Step 5:** Run `npm test -- App`. Expected: PASS.
- [ ] **Step 6:** Copy the owner's ground rules verbatim from `C:\Users\Mukho\.claude\CLAUDE.md` into `docs/GROUND_RULES.md`. Start `docs/DECISIONS.md` with the "builder's calls" from spec §7, plus: no refund page (the app is free), self-hosted fonts (privacy), and Woolworths deferred until it's tested.
- [ ] **Step 7: Commit** `git add -A && git commit -m "chore: scaffold Pocketless client, tokens, ground rules"`

### Task 2: Barcode rules

**Files:**
- Create: `client/src/lib/barcode.js`
- Test: `client/tests/lib/barcode.test.js`

**Interfaces:**
- Produces:
  - `FORMATS: BarcodeFormat[]`
  - `isValidChecksum(value: string, format: BarcodeFormat): boolean`. True for formats without a checksum (CODE_128, CODE_39, QR_CODE). ITF checks for even length only.
  - `normaliseValue(value: string, format: BarcodeFormat): string`. Strips spaces and dashes for numeric formats and trims the rest.
  - `inferFormat(value: string, expected?: BarcodeFormat[]): BarcodeFormat`
  - `looksLikeSaId(value: string): boolean`
  - `validateValue(value: string, format: BarcodeFormat): { ok: true } | { ok: false, reason: 'empty'|'too_long'|'bad_chars'|'bad_checksum' }`

- [ ] **Step 1: Write failing tests:**
  ```js
  expect(isValidChecksum('4006381333931', 'EAN_13')).toBe(true);
  expect(isValidChecksum('4006381333932', 'EAN_13')).toBe(false);
  expect(isValidChecksum('96385074', 'EAN_8')).toBe(true);
  expect(isValidChecksum('036000291452', 'UPC_A')).toBe(true);
  expect(normaliseValue(' 4006 3813-33931 ', 'EAN_13')).toBe('4006381333931');
  expect(inferFormat('4006381333931')).toBe('EAN_13');
  expect(inferFormat('96385074')).toBe('EAN_8');
  expect(inferFormat('036000291452')).toBe('UPC_A');
  expect(inferFormat('ABC-123')).toBe('CODE_128');
  expect(inferFormat('4006381333932')).toBe('CODE_128'); // 13 digits, bad EAN check → not EAN_13
  expect(inferFormat('4006381333931', ['CODE_128'])).toBe('CODE_128'); // store expectation wins
  expect(looksLikeSaId('8001015009087')).toBe(true);   // 1980-01-01, Luhn-valid
  expect(looksLikeSaId('8013015009081')).toBe(false);  // month 13
  expect(looksLikeSaId('8001015009088')).toBe(false);  // Luhn fails
  expect(validateValue('', 'CODE_128')).toEqual({ ok: false, reason: 'empty' });
  expect(validateValue('x'.repeat(65), 'CODE_128')).toEqual({ ok: false, reason: 'too_long' });
  expect(validateValue('12a4', 'EAN_13')).toEqual({ ok: false, reason: 'bad_chars' });
  ```
  (If a sample ID value above isn't Luhn-correct, compute a correct one in the test with a small Luhn helper. The intent is one valid case, one bad-date case and one bad-Luhn case.)
- [ ] **Step 2:** Run `npm test -- barcode`. Expected: FAIL.
- [ ] **Step 3:** Implement. Use the standard mod-10 weighted checksum for EAN-13, EAN-8 and UPC-A, and the Luhn algorithm for SA IDs (13 digits, YYMMDD a real calendar date). CODE_39 allows `[0-9A-Z \-.$/+%]`. CODE_128 allows printable ASCII.
- [ ] **Step 4:** Run `npm test -- barcode`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: barcode validation, format inference and SA ID detection`

### Task 3: Store catalogue

**Files:**
- Create: `client/src/lib/stores.js`
- Test: `client/tests/lib/stores.test.js`

**Interfaces:**
- Produces:
  - `STORES: Array<{ key, name, programme, colour, expectedFormats: BarcodeFormat[]|null, expectedLength: number|null }>`
  - `OTHER_STORE_KEY = 'other'`
  - `OTHER_PALETTE: string[]`
  - `getStore(key): Store|undefined`
  - `searchStores(query: string): Store[]` (case-insensitive across name and programme, with "Other store" always last)

- [ ] **Step 1: Write failing tests.** `STORES.map(s => s.key)` equals `['pnp-smart-shopper','checkers-xtra-savings','clicks-clubcard','dischem-benefits']`. `searchStores('club')` returns Clicks plus Other. `searchStores('')` returns all 4 plus Other. Every `colour` in `STORES` and `OTHER_PALETTE` gives white label text at a contrast ratio of at least 4.5 (write a `contrastRatio(hexA, hexB)` helper in the test).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Names and programmes: Pick n Pay / Smart Shopper, Checkers / Xtra Savings, Clicks / ClubCard, Dis-Chem / Benefits. Colours (placeholders, no logos): `#B8232F`, `#1F6F43`, `#0B4F8A`, `#B5530A`. **`expectedFormats` and `expectedLength` are `null` for every store.** Task 12 fills them in from real cards, so don't guess. `OTHER_PALETTE` has 8 dark-enough colours, including Aubergine `#43144F` and `#3D3D3D`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat: built-in SA store catalogue`

### Task 4: Card storage and card rules

**Files:**
- Create: `client/src/api/card-store.js`, `client/src/lib/cards.js`
- Test: `client/tests/api/card-store.test.js`, `client/tests/lib/cards.test.js`

**Interfaces:**
- Produces:
  - `card-store.js`:
    - `openCardStore(): Promise<CardStore>`. Rejects with `StorageUnavailableError` if IndexedDB is missing or fails to open.
    - `CardStore = { list(owner): Promise<Card[]> /* excludes deletedAt */, get(id): Promise<Card|undefined>, put(card: Card): Promise<void> }`
    - The DB is named `pocketless`, version 1, with object store `cards` (keyPath `id`) and index `by_owner`.
  - `cards.js`:
    - `MAX_CARDS = 200`, `LIMITS = { displayName: 40, programme: 40, value: 64 }`
    - errors `ValidationError(field, reason)`, `CardLimitError`, `DuplicateCardError(existingId)`
    - `addCard(store, input: { owner, storeKey, displayName, programme, colour, value, format }) → Promise<Card>`. Normalises and validates the value (Task 2), enforces the limits and the 200-card cap, and rejects a duplicate where `storeKey` and `value` match a non-deleted card of the same owner. Sets `id = crypto.randomUUID()`, `pinned=false`, `lastUsedAt=null`, `sortHint=Date.now()`, timestamps in ISO format.
    - `updateCard(store, id, patch) → Promise<Card>`. Same validation, bumps `updatedAt`, and never lets `owner`/`id`/`createdAt` change.
    - `deleteCard(store, id) → Promise<void>`. Sets `deletedAt` and `updatedAt`, a soft delete for Plan 2's sync.
    - `markUsed(store, id) → Promise<void>`. Sets `lastUsedAt` and does **not** bump `updatedAt`, because it's local-only.
    - `sortWallet(cards: Card[]) → Card[]`. Pinned first, then `lastUsedAt` descending (null last), then `sortHint` descending.

- [ ] **Step 1: Write failing tests.**
  - Store: put then get round-trips, `list('guest')` excludes soft-deleted cards and other owners, and `openCardStore` rejects with `StorageUnavailableError` when `indexedDB` is undefined.
  - Cards: `addCard` with value `' 4006 381333931'` stores `'4006381333931'`; a 41-character `displayName` throws `ValidationError('displayName','too_long')`; the 201st card throws `CardLimitError`; a second card with the same storeKey and value throws `DuplicateCardError` carrying the first id; the same value at a *different* store is allowed; adding again after a delete is allowed; `markUsed` leaves `updatedAt` unchanged; and `sortWallet` orders `[pinned-old, used-today, used-yesterday, never-used-new, never-used-old]` correctly.
- [ ] **Step 2:** Run `npm test -- card`. Expected: FAIL.
- [ ] **Step 3:** Implement with `idb`'s `openDB`. Do the duplicate and limit checks in `addCard` by reading `list(owner)`. This is fine at 200 cards.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat: IndexedDB card store and card rules`

### Task 5: Barcode rendering

**Files:**
- Create: `client/src/components/barcode/BarcodeView.jsx`
- Test: `client/tests/components/BarcodeView.test.jsx`

**Interfaces:**
- Consumes: `BarcodeFormat` and `isValidChecksum` (Task 2)
- Produces: `<BarcodeView value format />`. Renders an `<svg role="img" aria-label="Barcode for {value}">`, black on white, at full container width with a quiet zone of at least 10 module widths each side, and the spaced human-readable number below in a monospace font. If drawing fails (an invalid value for the format), it renders `role="alert"` with the text "The barcode couldn't be drawn. Read this number to the cashier:" followed by the number at a large size.

- [ ] **Step 1: Write failing tests.** EAN_13 `4006381333931` renders an svg containing `rect` elements and the text `4006 3813 3393 1`. QR_CODE `HELLO` renders an svg. EAN_13 `123` renders the alert fallback with `123`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with JsBarcode for the 1D formats (map: EAN_13→`EAN13`, EAN_8→`EAN8`, UPC_A→`UPC`, CODE_128→`CODE128`, CODE_39→`CODE39`, ITF→`ITF`; `displayValue:false`, `margin:20`, `background:'#ffffff'`, `lineColor:'#000000'`) and `qrcode`'s `toString({type:'svg', margin:2})` for QR. Set `shape-rendering="crispEdges"`. Group the number in fours.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat: barcode rendering with readable fallback`

### Task 6: Scan consensus and camera scanner

**Files:**
- Create: `client/src/lib/scan-consensus.js`, `client/src/api/scanner.js`
- Test: `client/tests/lib/scan-consensus.test.js`, `client/tests/api/scanner.test.js`

**Interfaces:**
- Consumes: `isValidChecksum`, `normaliseValue` (Task 2)
- Produces:
  - `createConsensus(required = 3) → { push(read: {value, format}): {value, format} | null, reset(): void }`
  - `createScanner(video: HTMLVideoElement, { formats?: BarcodeFormat[], onRead(read), onError(err: ScannerError) }) → { start(): Promise<void>, stop(): void }`
  - `ScannerError.kind ∈ 'permission' | 'unavailable' | 'failed'`
  - `stop()` must release every camera track.

- [ ] **Step 1: Write failing consensus tests.** Three identical valid EAN reads → the third `push` returns the read, and the first two return null. A sequence `A, A, B, A, A` → null throughout, because consecutive means unbroken. `A, A, invalid-checksum, A` → the invalid read is ignored without breaking the run, so the 4th push returns A. Reads with the same value but different formats count as different. After returning a result, `reset()` starts over.
- [ ] **Step 2: Write failing scanner tests** with a mocked `navigator.mediaDevices.getUserMedia`. A `NotAllowedError` → `onError({kind:'permission'})`. No `mediaDevices` → `onError({kind:'unavailable'})`. With a stubbed `window.BarcodeDetector` whose `detect` returns `[{rawValue:'4006381333931', format:'ean_13'}]`, `onRead` receives `{value:'4006381333931', format:'EAN_13'}`. `stop()` calls `track.stop()` on every track.
- [ ] **Step 3:** Run `npm test -- scan`. Expected: FAIL.
- [ ] **Step 4:** Implement. Request the camera with `facingMode: 'environment'`. Use `BarcodeDetector` when present *and* `getSupportedFormats()` covers the needed formats. Otherwise use `await import('@zxing/browser')` (a dynamic import, so it lands in its own chunk). Decode about every 100 ms. Only the **consensus** result is surfaced to the UI. `scanner.js` emits raw reads and `ScanStep` (Task 8) owns the consensus.
- [ ] **Step 5:** Run. Expected: PASS.
- [ ] **Step 6: Commit** `feat: scan consensus and camera scanner adapter`

### Task 7: Wallet screen (stack, pull-out, till view)

**Files:**
- Create: `client/src/context/CardsContext.jsx`, `client/src/hooks/useWakeLock.js`, `client/src/hooks/useReducedMotion.js`, `client/src/components/wallet/CardStack.jsx`, `client/src/components/wallet/WalletCard.jsx`, `client/src/components/ui/AppHeader.jsx`, `client/src/pages/app/WalletPage.jsx`, `client/src/styles/wallet.css`
- Modify: `client/src/App.jsx` (the `/app` route renders `WalletPage` inside `CardsProvider`)
- Test: `client/tests/pages/WalletPage.test.jsx`, `client/tests/hooks/useWakeLock.test.js`

**Interfaces:**
- Consumes: `openCardStore`, `addCard`, `updateCard`, `deleteCard`, `markUsed`, `sortWallet` (Task 4); `BarcodeView` (Task 5)
- Produces:
  - `useCards() → { status: 'loading'|'ready'|'unavailable', cards: Card[] /* sorted */, add(input), update(id, patch), remove(id), markUsed(id) }`, with owner fixed to `'guest'`
  - `useWakeLock(active: boolean)`, which re-acquires on `visibilitychange` back to visible while active
  - `useReducedMotion(): boolean`

The motion is taken from the approved prototype `.superpowers/brainstorm/*/content/wallet-motion.html`: cards stacked with a 62 px offset. The picked card lifts to the top and grows to show the barcode, the others translate down out of view, and the header dims to 25% opacity. Animate only `transform` and `opacity` (to grow the card, scale an inner panel or use a FLIP-style approach rather than animating `height` across 200 cards).

- [ ] **Step 1: Write failing tests** (seed cards through the store before render):
  - `empty-state`: with no cards, the page shows "Add your first card" and a link to `/app/add`.
  - `pull-out`: clicking the "Pick n Pay, Smart Shopper" card button makes `BarcodeView` visible with the card's number, and `aria-expanded="true"`. Clicking it again hides it. `markUsed` was called once.
  - `keyboard`: Tab to a card and press Enter to pull it out. Press Escape to put it back.
  - `rapid-taps` *(Review Focus 3)*: five clicks on card A within 50 ms, then one on card B, leave exactly one card expanded (B) after `vi.runAllTimers()`. Clicks during an in-flight transition are queued to the final intended state, not ignored into a stuck state.
  - `long-names-and-200-cards` *(Review Focus 4)*: seed 200 cards, one with a 40-character name. All 200 card buttons render, the long name's element has computed `text-overflow: ellipsis`, and pulling out card #200 works.
  - `reduced-motion`: with `matchMedia('(prefers-reduced-motion: reduce)')` true, the stack root has class `reduced-motion`, which sets transition durations to `0.01ms` in `wallet.css`.
  - `useWakeLock`: requests `navigator.wakeLock.request('screen')` when active, releases when inactive, re-requests on visibility return while active, and doesn't throw when `navigator.wakeLock` is undefined.
- [ ] **Step 2:** Run `npm test -- Wallet useWakeLock`. Expected: FAIL.
- [ ] **Step 3:** Implement. Each card is a `<button aria-expanded>` labelled "{displayName}, {programme}". The expanded card shows `BarcodeView`, the hint "Tap to put back", and a small "Edit" link to `/app/cards/:id`. Show `useWakeLock(expandedId !== null)`. The "+" button in `AppHeader` has `aria-label="Add a card"` and uses Mango as a fill with Aubergine glyph.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat: stacked wallet with pull-out till view`

### Task 8: Add-card flow

**Files:**
- Create: `client/src/pages/app/add/AddCardPage.jsx`, `StorePicker.jsx`, `ScanStep.jsx`, `ManualEntry.jsx`, `ConfirmStep.jsx`, `client/src/components/ui/Button.jsx`, `client/src/components/ui/ConfirmDialog.jsx`
- Modify: `client/src/App.jsx` (route `/app/add`)
- Test: `client/tests/pages/AddCard.test.jsx`

**Interfaces:**
- Consumes: `STORES`, `searchStores`, `OTHER_STORE_KEY`, `OTHER_PALETTE` (Task 3); `createScanner` (Task 6); `createConsensus` (Task 6); `inferFormat`, `validateValue`, `looksLikeSaId`, `normaliseValue` (Task 2); `useCards().add` (Task 7); `DuplicateCardError` (Task 4); `BarcodeView` (Task 5)
- Produces:
  - The route `/app/add`. On save it navigates to `/app` with the new card pulled out (via router state `{ expandId }`, which `WalletPage` honours).
  - Reusable steps for Task 9:
    - `<ManualEntry store initialValue onSubmit={({value, format}) => …} onCancel />` (runs `normaliseValue`, `validateValue`, `inferFormat` and the SA ID check before calling `onSubmit`)
    - `<ConfirmStep draft={{store, displayName, programme, colour, value, format}} onConfirm onRetry error />` (`error` is a `DuplicateCardError` or null)
    - `<ConfirmDialog open title body confirmLabel cancelLabel onConfirm onCancel />` (focus-trapped, Escape cancels)

Flow state: `step ∈ 'store' | 'scan' | 'manual' | 'confirm'`, plus `{ store, displayName, programme, colour, value, format }`.

- [ ] **Step 1: Write failing tests** (mock `createScanner`):
  - `happy-path`: pick "Clicks", the mock scanner emits three identical valid reads, then the confirm screen shows "Does this number match the one printed on your card?" and the number. Clicking "Yes, save card" lands on `/app` with Clicks expanded.
  - `not-saved-without-confirm`: after the scan, the store still has 0 cards until "Yes, save card" is clicked. "No, scan again" returns to the scan step with consensus reset.
  - `scan-permission-denied` *(Review Focus 1)*: the mock emits `onError({kind:'permission'})`. The screen shows "Pocketless needs the camera to scan your card. You can allow it in your phone's settings, or type the number instead." and a focused "Type the number instead" button. The same applies to `'unavailable'`, with the message "We couldn't find a camera on this device."
  - `manual-entry`: typing `4006 3813 33931` → the confirm screen shows `4006 3813 3393 1` with format EAN_13. Typing `12a` at a numeric-expected store shows an inline error and doesn't advance. An empty submit shows "Enter the number from your card".
  - `sa-id-warning`: typing a value that `looksLikeSaId` matches shows a `ConfirmDialog` reading "This looks like an SA ID number. Loyalty cards don't need your ID number. Only save it if it's really your card number." It needs "Save anyway" plus the normal confirm, and "Cancel" returns to the entry step.
  - `duplicate-card` *(Review Focus 5)*: adding a Clicks card with an existing Clicks value shows "You already have this card" with an "Open it" button (navigates to `/app` with that card expanded) and doesn't create a second record.
  - `other-store`: choosing "Other store" requires a name (1–40 characters) and a palette colour before scanning.
  - `scanner-stopped`: leaving the scan step (back, or a route change) calls `stop()`.
- [ ] **Step 2:** Run `npm test -- AddCard`. Expected: FAIL.
- [ ] **Step 3:** Implement. The scan step shows a guide box and the copy "Hold the barcode on the back of your card inside the box", with "Type the number instead" always visible. Pass the store's `expectedFormats` to the scanner and to `inferFormat`. If a confirmed value's length or format doesn't match a non-null `expectedLength` or `expectedFormats`, show the soft warning "That doesn't look like a {store} card number. Check it against your card." without blocking.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add-card flow with scan, manual entry and confirm`

### Task 9: Card details

**Files:**
- Create: `client/src/pages/app/CardDetailsPage.jsx`
- Modify: `client/src/App.jsx` (route `/app/cards/:id`)
- Test: `client/tests/pages/CardDetails.test.jsx`

**Interfaces:**
- Consumes: `useCards()` (Task 7), `ConfirmStep` and `ManualEntry` (Task 8), `OTHER_PALETTE` (Task 3), `ConfirmDialog` (Task 8)

- [ ] **Step 1: Write failing tests:**
  - Rename to "Mom's Clicks" and save → the wallet shows the new name.
  - Pick a palette colour → saved.
  - The "Pin to top" toggle → `sortWallet` puts the card first.
  - "Change number" → goes through `ManualEntry` and then `ConfirmStep`, and the new value is saved only after confirming.
  - "Delete card" → a `ConfirmDialog` "Delete this card? You can add it again later." Confirm → back on `/app` and the card is gone. Cancel → nothing changes.
  - Unknown id → "We couldn't find that card" with a link back to the wallet.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat: card details (rename, colour, pin, change number, delete)`

### Task 10: Brand assets, PWA install and offline

**Files:**
- Create: `client/public/brand/pocketless-icon.svg`, `client/public/brand/pocketless-logo.svg`, `server/scripts/generate-icons.mjs`, `server/scripts/check-bundle-size.mjs`, `client/tests/e2e/offline.spec.js`
- Modify: `vite.config.js` (VitePWA), `client/index.html` (meta, theme-color, apple-touch-icon), `package.json` (scripts `icons`, `size`)

**Interfaces:**
- Produces: `/app/manifest.webmanifest` and a service worker scoped to `/app/`. Icons at `client/public/brand/icon-{192,512}.png`, `icon-maskable-512.png`, `apple-touch-icon-180.png` and `favicon.svg`.

- [ ] **Step 1:** Redraw the "p-card" icon from the owner's brand sheet as `pocketless-icon.svg`: a rounded square in Aubergine `#43144F`, a Mango `#FFC02E` rounded "P" whose bowl holds 4 vertical Aubergine bars, and a 24-unit rounded stem. Draw `pocketless-logo.svg` as the icon plus the "Pocketless" wordmark converted to outlined paths (Baloo 2 ExtraBold). **Show both to the owner and get approval before continuing.** Record it in `docs/DECISIONS.md`.
- [ ] **Step 2:** `server/scripts/generate-icons.mjs` uses sharp to render the PNG sizes above from the SVG. The maskable icon keeps the P inside the central 80% safe zone on a full-bleed Aubergine background. Run `npm run icons` and check the files exist.
- [ ] **Step 3:** Configure VitePWA: `registerType: 'autoUpdate'`, `scope: '/app/'`, `start_url: '/app/'`, `name: 'Pocketless'`, `short_name: 'Pocketless'`, `display: 'standalone'`, `theme_color: '#43144F'`, `background_color: '#FFF6E6'`, and the icons. Workbox precaches the shell, fonts and icons. The ZXing chunk is runtime-cached `CacheFirst` (so scanning still works offline after its first use). `navigateFallback: '/app/index.html'` with `navigateFallbackAllowlist: [/^\/app/]`.
- [ ] **Step 4: Write the failing e2e test** `offline.spec.js`: add a card through manual entry, `context.setOffline(true)`, reload `/app`, pull out the card, and expect the barcode svg to be visible. A second test checks that `/app/manifest.webmanifest` returns JSON with `scope: '/app/'`.
- [ ] **Step 5:** Run `npm run test:e2e -- offline`. Expected: PASS on both the Pixel 7 and iPhone 14 projects.
- [ ] **Step 6:** `check-bundle-size.mjs` gzips every `dist/assets/*.js` file except the ZXing chunk and fails if the total is over 150 KB, printing the sizes. Run `npm run build && npm run size`. Expected: PASS, with the sizes printed.
- [ ] **Step 7: Commit** `feat: brand icons, installable PWA, offline support`

### Task 11: Failure screens, accessibility and performance pass

**Files:**
- Create: `client/src/pages/app/StorageUnavailable.jsx`, `client/src/components/ui/ErrorBoundary.jsx`, `client/tests/e2e/a11y.spec.js`, `client/tests/e2e/flows.spec.js`
- Modify: `client/src/App.jsx`, `client/src/context/CardsContext.jsx`
- Test: `client/tests/pages/StorageUnavailable.test.jsx`

- [ ] **Step 1: Write failing tests:**
  - `storage-unavailable` *(Review Focus 2)*: with `indexedDB` deleted from the window, `/app` renders "Pocketless can't save cards in this browser. If you're in a private or incognito window, open Pocketless in a normal window." with no uncaught error.
  - `ErrorBoundary`: a child that throws renders "Something went wrong. Your cards are safe on this phone." with a "Reload" button.
  - `a11y.spec.js`: axe on `/app` (empty), `/app` (3 cards, one pulled out), `/app/add` (each step) and `/app/cards/:id` reports zero serious or critical violations, in both light and dark (`page.emulateMedia({ colorScheme })`).
  - `flows.spec.js`: the full add → pull out → edit → delete flow on mobile, done with the keyboard only.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Wrap the routes in `ErrorBoundary`. `CardsContext` maps `StorageUnavailableError` to `status: 'unavailable'`.
- [ ] **Step 4:** Run `npm test && npm run test:e2e`. Expected: all PASS.
- [ ] **Step 5:** Run `npx lighthouse http://localhost:4173/app --preset=desktop` and the mobile default against `npm run preview`. Expected: Performance ≥ 90 on mobile, plus "Installable" passing. Record the scores in `docs/DECISIONS.md`.
- [ ] **Step 6: Commit** `feat: failure screens, a11y and performance checks`

### Task 12: Real-card verification with the owner

**Files:**
- Modify: `client/src/lib/stores.js` (`expectedFormats`, `expectedLength`), `client/tests/lib/stores.test.js`, `docs/DECISIONS.md`

- [ ] **Step 1:** Deploy a preview build that the owner's phone can reach (`npm run build && npx vercel deploy dist` as a preview, or `npm run preview -- --host` on the same Wi-Fi network). Camera access needs HTTPS or localhost, so use the Vercel preview.
- [ ] **Step 2:** With the owner, scan their real **Pick n Pay, Checkers, Clicks and Dis-Chem** cards on an Android phone and an iPhone. For each, record the decoded format and length shown on the confirm screen and check that it matches the printed number.
- [ ] **Step 3:** Update the four `STORES` entries with the observed `expectedFormats` and `expectedLength`. Add a test per store asserting that `inferFormat(<a valid sample of that length>, store.expectedFormats)` returns the recorded format, using a made-up value of the same shape, **never the owner's real number**.
- [ ] **Step 4:** At a real till (or by scanning the phone screen with another phone's scanner), confirm that each pulled-out card scans first time with screen brightness at the user's normal level. Record the results in `docs/DECISIONS.md`. A failure is a blocking bug in Task 5 (quiet zone, bar width), not something to note and move on from.
- [ ] **Step 5:** Run `npm test`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: verified barcode formats for built-in stores`
