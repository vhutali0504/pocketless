<p align="center">
  <img src="client/public/brand/pocketless-logo.svg" alt="Pocketless logo: an aubergine tile with a mango P holding barcode bars, next to the word Pocketless" width="360">
</p>

# Pocketless

Keep your shop loyalty cards on your phone. Scan each card once, then show the barcode at the till.

Live: https://pocketless-one.vercel.app/app

## Why we built this

It started at a Pick n Pay till. The groceries were packed and the Smart Shopper card was at home in a wallet that never left the house, so the points on that shop were lost.

That happens to a lot of people. South Africans carry a stack of loyalty cards (Smart Shopper, Xtra Savings, ClubCard, Dis-Chem Benefits and more), and the one you need is never the one you have. The phone, on the other hand, is always with you.

Pocketless puts those cards on the phone:

- **Free.** No ads, no payments, no selling anyone's data.
- **Fast at the till.** Open the app, tap the card, show the barcode. Nothing waits on the internet, so it works in a store with no signal.
- **Accurate.** The camera has to read the same number three times in a row, and you check it against the printed card before it's saved. A wrong number at the till would defeat the whole point.
- **Private.** No sign-up needed. Cards stay on your phone. Optional backup (coming next) will only ever ask for an email address.

## What works today

- Add a card: pick the store, scan the barcode (or type the number), check it, save
- A stacked wallet: tap a card and it slides out with a full-width barcode, black on white
- Edit, recolour, pin to the top, change the number or delete a card
- Works fully offline and installs to the home screen like an app
- Built-in stores: Pick n Pay Smart Shopper, Checkers Xtra Savings, Clicks ClubCard, Dis-Chem Benefits. Any other card can be added as "Other store"

Pocketless is not affiliated with any of these retailers. Store names are used only so you can tell your cards apart.

## What's next

1. Real-card testing at tills, then locking in each store's barcode type
2. Optional accounts so cards are backed up and come back on a new phone
3. The public website and legal pages (privacy, terms, cookies, contact)
4. Play Store and App Store versions, which can also turn the screen brightness up at the till

## Running it locally

Needs Node 22 and npm.

```bash
npm install
npm run dev          # http://localhost:5173/app
```

| Command | What it does |
|---|---|
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:e2e` | Browser tests, including offline, accessibility and keyboard-only flows (Playwright) |
| `npm run lint` | ESLint |
| `npm run build` | Production build into `dist/` |
| `npm run size` | Checks the app's JavaScript stays under 150 KB gzipped |
| `npm run icons` | Regenerates the app icons from `client/public/brand/pocketless-icon.svg` |

Camera scanning needs a secure page (https or localhost), so test scanning on a phone through a deployed link.

## How it's built

- React 18 and Vite, installable as a PWA with an offline service worker
- Cards stored on the device in IndexedDB
- Barcodes drawn with JsBarcode and qrcode, shown as a picture so they stay black on white
- Scanning with the browser's BarcodeDetector where available, and ZXing elsewhere (loaded only when you add a card)
- Hosted on Vercel

```
client/        the app (src/, tests/, public/)
server/        build scripts for now; accounts and sync arrive in the next phase
docs/          design, plans, decisions and brand files
```

## Project documents

- [Design](docs/superpowers/specs/2026-11-09-pocketless-design.md): what Pocketless is, its goals and its constraints
- [Decisions](docs/DECISIONS.md): every significant choice and why it was made
- [Ground rules](docs/GROUND_RULES.md): the standards every part of the project follows
- [Brand](docs/brand/): the p-card logo and colours

## Built by

Elevate Digital Solutions

## Licence

The code is open source under the [MIT licence](LICENSE). The Pocketless name and the p-card logo are the project's brand: please don't use them for your own app.
