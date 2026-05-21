# Oracle + Accounts Implementation Checklist

Branch: `claude/oracle-energy-birthdate-4HS3f`
Plan: `/root/.claude/plans/on-the-oracle-section-compiled-kernighan.md`

Six phases. Each phase commits independently. Adrian only needs to act on the items in the **Adrian to provision** section at the bottom.

## Phase 1 — Today + Year energy (client-only) ✓

- [x] Add `astronomy-engine` to package.json
- [x] `lib/astrology/types.ts` — shared types
- [x] `lib/astrology/ephemeris.ts` — planetary longitudes wrapper (note: uses `default ?? namespace` shim for tsx/Vite CJS/ESM duality)
- [x] `lib/astrology/gates.ts` — 64-gate sequence, longitudeToGateLine, findDesignTime, findSunCrossing
- [x] `lib/astrology/today.ts` — todaysEnergy, yearsEnergy (finds exact Gate 41 transit per year, leap-year safe)
- [x] `utils/universalLanguage.ts` — add `findUlArtworkForGate(gate)` helper
- [x] `components/oracle/TodayEnergyPanel.tsx`
- [x] `components/oracle/YearEnergyPanel.tsx`
- [x] `components/OracleGateway.tsx` — embed both panels (CSS in inline `<style>` tag)
- [x] `launchFlags.ts` — add `hologeneticProfile`, `accounts` flags
- [x] Verify: Gate 41 transit found exactly for 2024-2027; design-time round-trip error 2.6e-5°
- [x] `scripts/verify-astrology.ts` — sanity check script (`tsx scripts/verify-astrology.ts`)
- [x] Commit + push (commit 2339ac5)

## Phase 2 — Account foundation (Clerk + D1) ✓

- [x] Add `@clerk/clerk-react`, `@clerk/backend`, `svix` to package.json
- [x] `wrangler.toml` — add D1 binding `DB` (database id is `PROVISION_ME_VIA_WRANGLER`, see Adrian to provision)
- [x] `migrations/001_init.sql` — schema for users, profiles, orders, order_items, cart_items, collections, collection_items + indexes
- [x] `lib/account/AccountProvider.tsx` — conditional ClerkProvider mount (only when VITE_CLERK_PUBLISHABLE_KEY is set); guest mode otherwise
- [x] `lib/account/useAccount.ts` — unified `useAccount()` hook with stub fallback so the rest of the app doesn't branch
- [x] `components/account/AuthButton.tsx` — renders nothing when accounts unavailable, else SignedIn/SignedOut + UserButton
- [x] `components/Navigation.tsx` — slot AuthButton
- [x] `functions/api/_lib/clerk.js` — verify token, requireUser helper, jsonResponse with CORS
- [x] `functions/api/_lib/db.js` — D1 helpers (getUserByClerkId, upsertUser, setUserStripeCustomer, relinkOrdersByEmail, deleteUserByClerkId)
- [x] `functions/api/_lib/stripe.js` — ensureStripeCustomer (idempotent by email), verifyStripeWebhook (HMAC SHA-256)
- [x] `functions/api/auth/sync-user.js` — upsert user + ensure Stripe Customer + relink guest orders
- [x] `functions/api/clerk/webhook.js` — svix-verified, user.created/updated/deleted
- [x] `components/account/AccountLayout.tsx` — shared sidebar nav for /account/*
- [x] `components/AccountDashboard.tsx` — `/account` shell page with tiles for Profile, Orders, Collections
- [x] `App.tsx` — wrap with `AccountProvider`, route for `/account`
- [x] Build clean; index chunk +18 KB gz (Clerk SDK statically imported via Navigation → AuthButton)
- [x] Commit + push (commit d60a654)

## Phase 3 — Hologenetic Profile ✓

- [x] ~~Add `@vvo/tzdb`~~ — removed; native `Intl.DateTimeFormat` handles local→UTC via the bundled cities' IANA tz id
- [x] `lib/astrology/profile.ts` — buildHologeneticProfile (11 positions: Activation / Venus / Pearl)
- [x] `lib/astrology/places.ts` — searchPlaces (over bundled JSON), placeToUtc (two-pass DST-aware offset)
- [x] `scripts/build-cities-index.ts` — GeoNames cities15000 → JSON; instructions in script header
- [x] `public/data/cities-index.json` — 92-city curated seed (lazy-loaded by ProfileForm)
- [x] `lib/profile/storage.ts` — localStorage `ul.profile.v1`
- [x] `lib/profile/context.tsx` — ProfileProvider + useProfile (local-first, D1 sync-on-sign-in)
- [x] `data/profilePositions.ts` — 11 positions metadata; role copy drafted, `body` reserved for Adrian
- [x] `components/oracle/HexagramGlyph.tsx` — shared glyph renderer (also used by callout)
- [x] `components/oracle/ProfileForm.tsx` — date + time + place typeahead
- [x] `components/oracle/ProfileGraph.tsx` — three sequence bands, each row links to UL card
- [x] `components/oracle/ProfileSummary.tsx` — compact view on /oracle gateway
- [x] `components/OracleProfile.tsx` — `/oracle/profile` page
- [x] `App.tsx` — `/oracle/profile` route + ProfileProvider in provider stack
- [x] `components/OracleGateway.tsx` — embed ProfileSummary or "Enter your birth chart" link
- [x] `functions/api/profile/get.js`, `put.js`, `delete.js` — D1-backed with input validation
- [x] Verified pipeline: sample birth produces 11 valid {gate, line} pairs; stable across re-runs
- [x] `scripts/verify-profile.ts` — sanity script (`tsx scripts/verify-profile.ts`)
- [x] Commit + push (commit 20c3ed3)

## Phase 4 — Card overlay (YourPositionCallout) ✓

- [x] `components/oracle/YourPositionCallout.tsx` — gated by LAUNCH_FLAGS.hologeneticProfile + matching profile
- [x] `components/UniversalLanguageCard.tsx` — embed callout in Field section under the title block
- [x] Multi-position match handling ("This is your Life's Work and your Core")
- [x] No-op when no profile saved
- [x] Commit + push (commit 20c3ed3)

## Phase 5 — Orders + synced cart ✓

- [x] `functions/api/stripe/webhook.js` — HMAC-verified, idempotent on stripe_session_id, fetches line items via Stripe API
- [x] `functions/api/orders/list.js` — list user's orders + items
- [x] `functions/api/orders/claim.js` — links guest order to user; verifies session.customer_details.email matches user's email
- [x] `functions/api/checkout.js` — attach Stripe Customer ID when Authorization header present (best-effort; never blocks guests)
- [x] `functions/api/cart/get.js`, `put.js` — D1-synced cart, max 64 rows, qty clamped 1-10
- [x] `lib/cart/sync.ts` — serializeCart, hydrateCart, mergeCarts
- [x] `CartContext.tsx` — sync-on-sign-in + debounced (350ms) PUT
- [x] `components/CartDrawer.tsx` — sends Clerk bearer token via account.fetchAuthed
- [x] `components/account/OrdersList.tsx` — fetches /api/orders/list, renders timeline
- [x] `components/account/SaveOrderPrompt.tsx` — auto-claims on sign-in via /api/orders/claim
- [x] `components/OrderConfirmed.tsx` — embeds SaveOrderPrompt
- [x] `App.tsx` — `/account/orders` route
- [x] Commit + push (commit 549625f)

## Phase 6 — Collections + save buttons ✓

- [x] `functions/api/collections/{list,create,update,delete,add-item,remove-item}.js`
- [x] `lib/collections/context.tsx` — CollectionsProvider + useCollections hook
- [x] `components/account/CollectionsManager.tsx` — list, create, rename, delete, remove items
- [x] `components/account/SaveToCollectionButton.tsx` — inline picker + create-new
- [x] `components/UniversalLanguageCard.tsx` — surface "Save to a collection" near acquire/share row
- [ ] (Optional, future) Surface on artwork pages + shop products
- [x] `App.tsx` — `/account/collections` route + CollectionsProvider
- [x] Commit + push (commit 549625f)

---

## Adrian to provision (do this when ready to launch accounts)

1. **Clerk** — sign up at clerk.com, create an application "Adrian Rasmussen Art", grab:
   - `VITE_CLERK_PUBLISHABLE_KEY` (pk_test_… or pk_live_…)
   - `CLERK_SECRET_KEY` (sk_test_… or sk_live_…)
   - `CLERK_WEBHOOK_SECRET` — set up a webhook endpoint pointed at `https://adrian-rasmussen.art/api/clerk/webhook` listening to user.created, user.updated, user.deleted
   - In Clerk dashboard, enable: email magic link (primary), Google OAuth, Apple OAuth
   - Theme: paste the bronze/wood/paper palette into Clerk's appearance config (I'll leave a TODO with the values in `AuthButton.tsx`)

2. **Cloudflare D1** — in the Cloudflare dashboard or via wrangler:
   ```
   wrangler d1 create adrian-website
   ```
   Copy the database_id into `wrangler.toml` (replacing the placeholder), then apply migrations:
   ```
   wrangler d1 migrations apply adrian-website
   ```

3. **Stripe webhook** — in Stripe dashboard, add an endpoint `https://adrian-rasmussen.art/api/stripe/webhook` listening to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

4. **Set Cloudflare Pages env vars** (Settings → Environment variables, both Production and Preview):
   - `VITE_CLERK_PUBLISHABLE_KEY` (Build variable, plaintext)
   - `CLERK_SECRET_KEY` (Function variable, secret)
   - `CLERK_WEBHOOK_SECRET` (Function variable, secret)
   - `STRIPE_WEBHOOK_SECRET` (Function variable, secret)

5. **Flip launch flags** — edit `launchFlags.ts`: `hologeneticProfile: true`, `accounts: true`, then merge to main.

---

## Open questions / blockers

(Will be filled in if anything blocks during implementation.)
