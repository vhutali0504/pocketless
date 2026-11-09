# Ground rules for every project

These apply to every project I build. Treat them as top priority: check them when planning, building, and before calling anything done.

## 1. Legal, privacy and trust

- Privacy policy
- Terms of service
- Refund policy
- Cookie policy
- Cookie consent banner
- Checkbox consents on forms (not pre-ticked)
- Collect no unnecessary data
- Audit third-party SDKs
- Remove dark patterns
- Remove hidden fees
- Remove unsupported claims
- Accessibility: alt text
- Fix color contrast
- Keyboard navigation
- Add real business details
- Age consent for kids' data
- Unsubscribe link in emails
- License fonts and images
- Data deletion requests

## 2. Reliability, performance and cost

- Add rate limiting
- Set API limits
- Set spending caps
- Add error handling
- Add loading states
- Add empty states
- Handle failed requests
- Handle API timeouts
- Prevent duplicate subscriptions
- Prevent duplicate payments
- Optimise DB queries
- Add DB indexes
- Paginate large results
- Compress files
- Limit upload size
- Cache repeat requests
- Uptime monitoring
- Error logging
- Test simultaneous users
- Test backup restore

## 3. Launch checklist (websites)

- Custom 404 page
- CTA above the fold
- Meta title per page
- Meta description per page
- Open Graph image
- Favicon
- robots.txt
- sitemap.xml
- Alt text on every image
- Mobile breakpoints
- Sticky mobile CTA
- Loading states
- Form error states
- Thank-you page
- Privacy policy page
- Terms page
- Cookie banner
- Analytics installed
- Real contact address

## 4. Design: never use these

- Purple-to-blue gradients
- Gradient hero text
- Emojis in headings
- Inter font everywhere
- Colored left-border cards
- Glassmorphism cards
- Low-contrast dark mode
- Three icon boxes in a row
- A badge above the headline
- Lucide icons everywhere
- Untouched shadcn components
- Sections fading in on scroll
- A beam that follows the cursor
- Hover effects that make buttons fade
- Inconsistent spacing
- Em dashes everywhere
- Generic buzzword copy
- Serif italics for accent words
- Space Grotesk plus Instrument Serif
- Grain texture over a gradient

## 5. Secure coding: apply whenever writing code

- Validate input from untrusted sources
- Heed compiler warnings
- Architect and design for security policies
- Keep it simple
- Default deny
- Least privilege
- Sanitise data sent to other systems
- Defence in depth
- Use effective QA techniques
- Adopt a secure coding standard
- Strict authentication: invite-only or verified accounts, strong passwords, two-step login for admin and money areas, secure session handling
- Strict authorisation: check permissions on the server for every request, never trust the browser, give each role only what it needs

## 6. Project structure: use for every project

```
server/
  routes/ or functions/   endpoints (routes/ for an always-on server, functions/ for serverless)
  middleware/             input validation, rate limiting, checks that run before handlers
  auth/                   server-side auth and permission checks
  services/               email, payments, SMS and other outside systems
  database/
    connect.*             database connection
    models/ or migrations/  schema (models/ for an ORM, migrations/ for SQL)
  tests/
  scripts/
client/
  index.html
  src/
    main.jsx, App.jsx
    api/                  API helpers (prefer built-in fetch over extra libraries)
    components/           shared components, grouped in subfolders when large
    pages/                one per route, with subfolders per area (e.g. pages/admin/)
    context/              React context (auth/session state)
    hooks/
    styles/
  public/
docs/
  DECISIONS.md            every significant decision and why
  GROUND_RULES.md         these ground rules, in the repo
```

- Shared config (package.json, build and lint config, .env) stays at the root
- Only add folders the project needs: no register route for invite-only apps, no custom login when an auth provider handles it
