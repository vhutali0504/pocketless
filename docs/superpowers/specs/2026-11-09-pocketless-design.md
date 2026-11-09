# Pocketless: design

Date: 2026-11-09
Status: approved by owner 2026-11-09

## 1. What it is and why

Pocketless is a free app that lets people in South Africa leave their shop loyalty cards at home (Pick n Pay Smart Shopper, Checkers Xtra Savings, Clicks ClubCard, Dis-Chem Benefits, Woolworths WRewards and so on). You scan each physical card once. At the till you open the app, tap the card and show the barcode to the cashier.

The owner thought of it at a Pick n Pay till without their wallet, when they lost the points on that shop. It's a public product that anyone can use, and it's free. Success means people actually use it.

**The two things that would make the owner wince:**
1. **A slow app.** Opening a card at the till has to be instant.
2. **Inaccurate scanning.** A wrong number saved from the camera would fail at the till, which is the one moment that matters.

The owner also named **security of people's data** as a top concern.

## 2. Goals, non-goals, anti-goals

**Goals**
- Scan a card once and show a barcode the till can read first time.
- From tapping the app icon to a scannable barcode in under 2 seconds on a mid-range Android phone, and well under 1 second from tapping a card to seeing its barcode.
- Works fully offline, for everyone, whether signed in or not.
- No sign-up needed to use it. An optional account backs up cards and syncs them to a new phone.
- Collect as little personal data as possible and comply with POPIA.

**Non-goals (version one)**
- Points balances, specials, coupons or anything that needs the shops' cooperation or an API.
- Making money: no ads, no payments, no data sales.
- Sharing cards between people or family accounts.

**Anti-goals (a failure even if it technically works)**
- Saving a misread number without the user confirming it.
- Blocking or slowing a card at the till for any reason, including sign-up nudges, loading spinners, network calls or animations longer than about 350 ms.
- Nagging people to sign up.
- Collecting data we don't need, or tracking users in ways the privacy policy wouldn't plainly explain.

## 3. Decided by the owner

| Decision | Owner's choice |
|---|---|
| Audience | Public. Anyone can use it. |
| Price | Free |
| Stack | React, Supabase and Vercel (the builder's suggestion, which the owner agreed to). Capacitor wraps the same code for the app stores (see "App stores" below). |
| Accounts | Optional. Use it straight away, and sign up later for backup and sync. |
| Offline | Every card works offline, for everyone. |
| Points balance | Not needed |
| Name | **Pocketless** |
| Home screen | **Stacked wallet.** Cards overlap like a real wallet. Tapping one slides it up out of the stack while the others drop away, and it grows to show the barcode. Tapping again puts it back. The owner approved the prototype's motion as "perfect": about 340 ms, `cubic-bezier(.2,.8,.2,1)`, with the barcode panel fading in about 140 ms after the card starts moving. |
| Add-card flow | **Pick the store first**, then scan (or type the number), then confirm the number before saving. |
| Website | One landing page that explains Pocketless and shows how to install it, plus privacy, terms and contact pages. The app opens from a button on that page. |
| Project location | `C:\Projects\pocketless` |
| App stores | **Option B:** the installable web app *and* native apps on the Google Play Store and Apple App Store, built from the same React code with Capacitor. The native apps can turn the screen brightness up. |
| Domain | **None for now.** Launch on a free `*.vercel.app` address. |
| Auth email | A dedicated Gmail account through Supabase custom SMTP until a domain is bought. Accounts and backup ship in version one. |
| Who's behind it | **Elevate Digital Solutions (EDS)**, which isn't a registered company. It's shown as the owner's own name, trading as Elevate Digital Solutions. |
| Built-in stores | Pick n Pay Smart Shopper, Checkers Xtra Savings, Clicks ClubCard and Dis-Chem Benefits, all tested with the owner's real cards. Woolworths WRewards waits until a card can be tested (see section 9). |

The approved mockups are in `.superpowers/brainstorm/*/content/` (gitignored): `wallet-motion.html` is the stacked wallet prototype and `add-card-flow.html` is the add-card flow.

## 4. How it works

### 4.1 The app screens

**Home (the wallet).** The header shows "Pocketless" and a round "+" button. Below it the cards are stacked, each showing a strip of colour with the store name and programme name. Order: pinned cards first, then most recently used. With many cards the stack scrolls. Empty state: a single "Add your first card" prompt with a short line explaining what the app does.

**Card out (the till view).** A white barcode panel sits inside the card with the barcode at full card width, the human-readable number underneath, and a "Tap to put back" hint. While a card is out:
- Use the Screen Wake Lock API so the screen doesn't turn off. Fail silently where it isn't supported.
- Screen brightness: **in the native apps**, raise it to full while a card is out and restore the user's previous level when it's put back or the app goes to the background (Capacitor screen-brightness plugin). **In the web app** this isn't possible, so keep the barcode panel pure white on a high-contrast background.
- Record "last used" locally. This drives the ordering.
- Respect `prefers-reduced-motion`: the card simply appears with no slide.

**Add a card.**
1. *Pick the store:* a searchable list of built-in South African programmes, plus "Other store" (enter a name and pick a colour from a fixed palette).
2. *Scan:* a camera view with a guide box, and a "Type the number instead" button that is always visible.
3. *Check and save:* shows the card as it will look, with the generated barcode and number, and asks "Does this number match the one printed on your card?" The buttons are "Yes, save card" and "No, scan again".

**Card details.** Rename, change colour, pin or unpin, edit the number (which goes through the same confirm step), and delete (with a confirm prompt).

**Settings.** Back up and sync (sign up or sign in), sign out, delete account, links to the privacy and terms pages, and the app version.

**Backup nudge.** A single dismissible line on the home screen ("Back up your cards so you don't lose them if you change phones") appears after a guest has saved 2 or more cards. Once dismissed, it doesn't come back for 30 days. It never appears on the till view.

### 4.2 Scanning accuracy (a top priority)
- Decode the barcode itself, never OCR of the printed digits.
- **Native apps:** use the platform scanner through Capacitor (Google ML Kit barcode scanning). It's the most accurate option. **Web app:** use the native `BarcodeDetector` where it exists (Chrome on Android) and fall back to a JS decoder (ZXing) elsewhere, iOS Safari in particular. Put all of this behind one scanner interface so the screens don't care which one is in use.
- **Consensus rule:** only accept a value after 3 consecutive identical decodes. Discard anything that fails the format's checksum (EAN-13, UPC and so on).
- Each built-in store may list an expected format and length. If a read doesn't match, show "That doesn't look like a [store] card number, so check it" but still allow saving after the confirm step.
- Save the **decoded value and the barcode format**, never a photo.
- Render the barcode at till time from the value and format: SVG via JsBarcode for 1D formats and a QR library for QR. Use crisp edges and leave enough quiet zone either side.
- Typed numbers: digits only for numeric formats, with the checksum checked where one applies, then the same confirm step.

### 4.3 Data and sync
- **On the phone:** cards live in IndexedDB, and every read and write goes there first. The app shell is cached by a service worker, so the app opens fully offline.
- **Server (Supabase):** a `cards` table (`id` uuid generated on the client, `user_id`, `store_key`, `display_name`, `programme`, `colour`, `value`, `format`, `pinned`, `sort_hint`, `updated_at`, `deleted_at`). Row-level security allows `user_id = auth.uid()` only, for select, insert, update and delete. Put an index on `(user_id, updated_at)`.
- **Sync:** runs in the background when online and signed in. Changes travel both ways and are compared by `updated_at`, with the newest change winning. Deletes are kept as tombstones (`deleted_at`) so they spread to other devices. On first sign-up, any cards already on the phone are uploaded.
- **Limits:** a maximum of 200 cards per user, enforced by a database trigger as well as in the client. Limit the length of every text field.
- **Account deletion:** a Supabase Edge Function with the service role deletes the user and all their rows. The client asks whether to also wipe the cards on this phone.
- **"Last used" stays on the phone only** and is never synced. It isn't needed on the server.
- **Whose cards are on the phone.** Every local card is tagged with its owner: `guest` or the user id.
  - *Signing in on a phone that has guest cards:* ask "Add these N cards to your account?" If yes, merge them and skip duplicates (same `store_key` and `value`). If no, the guest cards stay as guest cards and are hidden while signed in.
  - *Sign-out:* remove that account's cards from the phone. They're backed up on the server, and this stops the next person on the same phone from seeing them.
  - Sync only ever reads or uploads cards tagged with the signed-in user's id, so one person's cards can never leak into another person's account.
- **Card values are not end-to-end encrypted.** They're protected by RLS, HTTPS and Supabase's encryption at rest. Loyalty numbers aren't secrets: they're printed on a plastic card and shown to cashiers. End-to-end encryption would need a recovery-key flow that doesn't fit the "no friction" goal. To guard against the one sensitive case, if a typed or scanned value looks like a 13-digit SA ID number (valid Luhn and a plausible date of birth), warn the user not to save their ID number and require a second confirmation.
- **No app lock (PIN or biometric) in version one.** It would slow the till moment.

### 4.4 Accounts and security
- Sign-in uses Supabase Auth with **email and password** or a **6-digit email code**. There are no magic links, because on iPhone a link opens in Safari, not in the installed app. **There's no Google sign-in in version one:** Apple requires apps that offer Google sign-in to also offer Sign in with Apple, and email alone keeps it simple. Email is the only personal data collected.
- **Auth email (decided by the owner, 2026-11-09):** Supabase custom SMTP through a **dedicated Gmail account** (for example `pocketless.app@gmail.com`) using a Google app password. That gives about 500 emails a day at no cost. The SMTP credentials live only in Supabase's settings, never in the repo or the client. The email templates are plain and branded and say why the person is receiving them. When a domain is bought later, switch the SMTP settings to a domain sender (no code change). Keep Supabase's auth rate limits on to protect the Gmail account from being flagged.
- Passwords must be at least 10 characters and are checked against Supabase's leaked-password protection. Supabase's built-in auth rate limits stay on, and the auth emails come from a verified sender domain.
- No admin area in version one (there's no admin role at all), so no 2FA flow is needed.
- Sign-up requires a "I'm 18 or older" checkbox that isn't pre-ticked, plus an unticked checkbox agreeing to the terms and privacy policy. Guests send nothing to the server, so this only applies to accounts.
- Everything goes over HTTPS, with a strict Content-Security-Policy and no third-party scripts in the app beyond what's listed in section 4.6.

### 4.5 The website
- `/`: the landing page. A clear headline and an "Open Pocketless" button above the fold. Then how it works in three plain steps, the stores it works with (by name, with no logos), install instructions for Android and iPhone, "Is my data safe?" in plain words, an FAQ, and a footer with legal links. A sticky "Open app" button on mobile.
- `/app`: the PWA itself. The manifest scope and `start_url` live here.
- `/privacy`, `/terms`, `/cookies`, `/contact`, a custom 404, `robots.txt`, `sitemap.xml`, a meta title and description for every page, an Open Graph image and a favicon or app icons.
- No refund policy page, because nothing is ever charged. (A ground-rule exception, recorded in `docs/DECISIONS.md`.)
- **Shop names and colours, not logos.** Trademark use is limited to plain factual naming. The site states that Pocketless isn't affiliated with any retailer.

### 4.6 Analytics and cookies
- Use cookieless, privacy-friendly page analytics on the website only (for example Plausible or self-hosted Umami), with no tracking inside the app. Because no non-essential cookies are set, the cookie banner is a short notice linking to `/cookies` rather than a consent wall. If any cookie-setting tool is added later, it must go behind opt-in consent.
- Use error logging (for example Sentry) with personal-data scrubbing: no card values, no emails.
- Set up uptime monitoring on the landing page and the Supabase health endpoint.

### 4.7 Look and feel
- **Brand (supplied by the owner, 2026-11-09): "The p-card" logo.** A rounded "P" whose bowl holds barcode bars, in a rounded-square tile, next to a bold rounded "Pocketless" wordmark. The owner's brand sheet shows four versions: on white, on dark, one colour, and one colour reversed. The app icon is shown at 200, 64, 48, 32 and 24 px.
- **Brand colours:** Aubergine `#43144F`, Mango `#FFC02E`, Cream `#FFF6E6`. The dark surface in the sheet is about `#1A1320`.
  - Light mode: a Cream background, Aubergine text and primary buttons, and Mango as an accent fill (the "+" button, highlights).
  - Dark mode: a near-black aubergine background, Cream text, and Mango accents.
  - **Mango is never used for text on Cream or white**, because it fails contrast. On light backgrounds it's for fills only.
  - The barcode panel is always pure black on pure white, whatever the theme.
  - Store cards in the wallet keep their own per-store colours. The brand colours are for the app chrome and the website.
- **Wordmark font:** taken from the owner's logo files (see open items). Body text uses a licensed, readable sans that pairs with it, not Inter.
- **Icons and PWA assets** are generated from the owner's logo: the favicon, Apple touch icon, maskable 192 and 512 px icons, and the OG image.
- Follow the owner's ground rules (`docs/GROUND_RULES.md`, section 4). In particular: no gradients on the hero or text, no glassmorphism, no emoji in headings, no fade-in-on-scroll sections, no badge above the headline, and no buzzword copy.
- Accessibility: every control is reachable by keyboard, colour contrast passes AA (barcode panels are always black on white), cards carry text labels and not just colour, and every image has alt text.

### 4.8 Project layout
Follow the owner's standard structure (from the global ground rules):
```
server/
  functions/delete-account/       Supabase Edge Function
  database/migrations/            SQL: table, RLS, indexes, card-limit trigger
  tests/                          RLS and function tests
client/
  index.html, src/{main.jsx, App.jsx, api/, components/, pages/, context/, hooks/, styles/}, public/
docs/
  DECISIONS.md, GROUND_RULES.md, superpowers/specs/
```
Build with Vite and `vite-plugin-pwa` (Workbox). Host on Vercel. Use the Supabase free tier, which has no paid overage, so spending is capped by default.

## 5. Quality bar
- **Performance:** a Lighthouse performance score of at least 90 on mobile for both `/` and `/app`. The app shell JS should be under about 150 KB gzipped, with the scanner library loaded only when "Add card" is opened.
- **Tests:**
  - unit tests for the consensus rule, checksums, format rendering and sync conflict resolution
  - Playwright end-to-end tests for add, show and delete, offline open, and sign-up followed by sync to a second browser profile
  - database tests proving one user can't read another user's cards
- **Real-device check before launch:** scan and show at least one real card from each built-in store, on one Android phone and one iPhone, and confirm a real till scanner reads the screen.

## 6. Constraints
- Free to run at launch: free tiers only.
- POPIA: a named responsible party with real contact details is required on `/privacy` and `/contact`.
- A PWA on iOS has limits: no brightness control, and push or install prompts work differently. Data in an installed home-screen PWA is not subject to Safari's 7-day storage eviction, but data in an *uninstalled* browser tab can be, so the landing page should push installing to the home screen, and the backup nudge exists for this reason.

## 7. Calls made by the builder-designer (not confirmed by the owner)
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

## 8. Left to the builder
- The exact libraries (JsBarcode, QR library, ZXing build, IndexedDB wrapper) and the choice of analytics or error vendor, within the rules above.
- The barcode format and length for each built-in store, which must be verified against real cards (don't guess).
- Component structure, state management, and the copy wording (plain, no buzzwords, few em dashes).

### App store constraints (from Option B)
- **Google Play:** a one-off fee of about US$25. New *personal* developer accounts must run a closed test with at least 12 testers for 14 days before the app can go public, so recruit testers early. An organisation account would need a registered company with a D-U-N-S number.
- **Apple App Store:** about US$99 a year. Because EDS isn't registered, the account will be an individual one, and the seller name shown in the App Store is the owner's personal name. Apple needs a privacy policy URL, an in-app "delete account" option (already planned), and privacy "nutrition labels".
- Building and submitting iOS apps needs a Mac (or a cloud Mac build service).
- Local storage in the native apps uses the Capacitor storage layer, which iOS won't clear under storage pressure. The web app uses IndexedDB. Both sit behind one storage interface.

## 9. Open items for the owner
- **Dedicated Gmail account:** the owner creates it, turns on 2-step verification and generates an app password for Supabase. Its address is kept in the owner's private notes.
- **Legal details:** kept out of the repository, in the owner's private notes. They go onto the privacy, terms and contact pages when Plan 3 builds them.
- **Logo files:** only a PNG brand sheet exists. *Builder's call:* redraw the p-card icon and the wordmark as clean SVGs from the sheet and get the owner to approve them. The wordmark looks like a rounded display face such as Baloo 2 ExtraBold (OFL); confirm the font with the owner, or use the SVG wordmark as outlines so the font doesn't matter.
- **Test cards:** the owner has Pick n Pay, Checkers, Clicks and Dis-Chem, but no Woolworths. *Builder's call:* launch with four built-in stores. Woolworths can still be added through "Other store" and joins the built-in list once a real card has been tested.
