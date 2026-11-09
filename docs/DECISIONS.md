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
