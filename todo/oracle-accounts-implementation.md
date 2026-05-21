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
- [ ] Commit + push

## Phase 2 — Account foundation (Clerk + D1)

- [ ] Add `@clerk/clerk-react`, `@clerk/backend`, `svix` to package.json
- [ ] `wrangler.toml` — add D1 binding `DB` (database id placeholder)
- [ ] `migrations/001_init.sql` — schema for users, profiles, orders, order_items, cart_items, collections, collection_items
- [ ] `App.tsx` — wrap in `<ClerkProvider>` (publishableKey from env, graceful no-op if missing so site still builds)
- [ ] `components/account/AuthButton.tsx` — Clerk SignedIn/SignedOut + UserButton
- [ ] `components/Navigation.tsx` — slot AuthButton
- [ ] `functions/api/_lib/clerk.js` — helper to verify Clerk token, return 401 on failure
- [ ] `functions/api/_lib/db.js` — D1 helper (env.DB binding)
- [ ] `functions/api/auth/sync-user.js` — upsert user + create Stripe Customer
- [ ] `functions/api/clerk/webhook.js` — svix-verified, handle user.created/updated/deleted, re-link guest orders by email
- [ ] `components/AccountDashboard.tsx` — `/account` shell page
- [ ] `App.tsx` — route for `/account`
- [ ] Commit + push (gated by `accounts` flag in UI; site still builds without Clerk keys)

## Phase 3 — Hologenetic Profile

- [ ] Add `@vvo/tzdb` to package.json
- [ ] `lib/astrology/profile.ts` — buildHologeneticProfile
- [ ] `lib/astrology/places.ts` — searchPlaces, placeToUtc
- [ ] `scripts/build-cities-index.ts` + `public/data/cities-index.json` (lazy-loaded)
- [ ] `lib/profile/storage.ts` — localStorage `ul.profile.v1`
- [ ] `lib/profile/context.tsx` — ProfileProvider + useProfile hook (local-first, D1-aware)
- [ ] `data/profilePositions.ts` — 11 positions metadata + copy
- [ ] `components/oracle/ProfileForm.tsx`
- [ ] `components/oracle/ProfileGraph.tsx`
- [ ] `components/oracle/ProfileSummary.tsx`
- [ ] `components/OracleProfile.tsx` — `/oracle/profile` page
- [ ] `App.tsx` — route + ProfileProvider in stack
- [ ] `components/OracleGateway.tsx` — embed ProfileSummary or "Enter your birth chart" link
- [ ] `functions/api/profile/get.js`, `put.js`, `delete.js` — D1-backed
- [ ] Verify: known birth data produces published gate.line values
- [ ] Commit + push

## Phase 4 — Card overlay (YourPositionCallout)

- [ ] `components/oracle/YourPositionCallout.tsx`
- [ ] `components/UniversalLanguageCard.tsx` — embed callout in Field section
- [ ] Verify: callout shows on matching gates only, no callout when no profile saved
- [ ] Commit + push

## Phase 5 — Orders + synced cart

- [ ] `functions/api/stripe/webhook.js` — HMAC-verified, persist orders on checkout.session.completed
- [ ] `functions/api/orders/list.js` — list user's orders
- [ ] `functions/api/orders/claim.js` — link guest orders to user by email
- [ ] `functions/api/checkout.js` — attach Stripe Customer ID when Authorization header present
- [ ] `functions/api/cart/get.js`, `put.js` — D1-synced cart
- [ ] `lib/cart/sync.ts` — adapter merged into CartContext
- [ ] `CartContext.tsx` — extend with sync-on-sign-in + debounced PUT
- [ ] `components/CartDrawer.tsx` — send Clerk token on checkout if signed in
- [ ] `components/account/OrdersList.tsx`
- [ ] `components/account/SaveOrderPrompt.tsx` — on /order-confirmed for guests
- [ ] `App.tsx` — `/account/orders` route
- [ ] Commit + push

## Phase 6 — Collections + save buttons

- [ ] `functions/api/collections/list.js`, `create.js`, `update.js`, `delete.js`, `add-item.js`, `remove-item.js`
- [ ] `lib/collections/context.tsx` — useCollections hook
- [ ] `components/account/CollectionsManager.tsx`
- [ ] `components/account/SaveToCollectionButton.tsx`
- [ ] Surface SaveToCollectionButton on `UniversalLanguageCard`, artwork pages, shop products
- [ ] `App.tsx` — `/account/collections` route
- [ ] Commit + push

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
