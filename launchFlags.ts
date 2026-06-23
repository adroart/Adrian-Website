/**
 * LAUNCH FLAGS — Temporary disables for initial launch
 *
 * This file is the single source of truth for everything temporarily
 * disabled at launch. When you're ready to re-enable a feature:
 *
 * 1. Flip the flag from false to true
 * 2. Check the "Files affected" note for that flag
 * 3. That's it — all UI code is still in place, just gated behind these flags
 *
 * To restore the full site, set every flag to true and delete this file's
 * import from each component listed below.
 */

export const LAUNCH_FLAGS = {
  /**
   * SHOP / CART — Online purchasing via Stripe
   * Disabled because: All stripePriceIds are 'price_REPLACE' placeholders.
   * To re-enable: Set up Stripe Products/Prices, replace IDs in mockData.ts,
   *   set env vars (STRIPE_SECRET_KEY, VITE_STRIPE_PUBLISHABLE_KEY), flip to true.
   * Files affected:
   *   - Navigation.tsx (Shop nav item hidden, cart icon hidden)
   *   - PiecePage.tsx ("Add to Cart" replaced with "Request to Purchase" linking to /inquire)
   *   - Footer.tsx (Shop link hidden)
   *   - Welcome.tsx (Shop link hidden)
   *   - Creations.tsx ("Visit the Shop" link hidden)
   *   - About.tsx ("Acquire a piece" changed to "Inquire about a piece" linking to /inquire)
   *   - Store.tsx, CartDrawer.tsx (route still exists but not linked from anywhere)
   */
  shopEnabled: false,

  /**
   * FURNITURE category tile (formerly Tables)
   * Disabled because: Only 1 piece (SOLD), placeholder image.
   * To re-enable: Upload real images, add pieces to mockData.ts,
   *   remove hidden: true from FURNITURE in mockData.ts CREATION_CATEGORIES.
   * Files affected: mockData.ts (hidden: true on FURNITURE category)
   */
  furniture: false,

  /**
   * INSTALLATIONS category tile
   * Disabled because: Only 1 piece (SOLD), placeholder image.
   * To re-enable: Upload real images, add pieces to mockData.ts,
   *   remove hidden: true from INSTALL in mockData.ts CREATION_CATEGORIES.
   * Files affected: mockData.ts (hidden: true on INSTALL category)
   */
  installations: false,

  /**
   * SPACES category tile
   * Disabled because: No pieces at all.
   * To re-enable: Upload images, add pieces to mockData.ts,
   *   remove hidden: true from SPACES in mockData.ts CREATION_CATEGORIES.
   * Files affected: mockData.ts (hidden: true on SPACES category)
   */
  spaces: false,

  /**
   * ABOUT — "What Art Can Mean" section
   * Disabled because: Adrian didn't finish writing this section.
   * To re-enable: Finish the writing, flip to true.
   * Files affected: About.tsx (section + side nav entry hidden)
   */
  aboutMeaning: false,

  /**
   * ACCOUNTS — Unified Clerk sign-in for profile sync, order history, saved
   * collections, and synced cart across devices.
   * Disabled because: Clerk app + D1 database + Stripe webhook still need to
   *   be provisioned in Cloudflare. See todo/oracle-accounts-implementation.md
   *   under "Adrian to provision" for the exact env vars and steps.
   * To re-enable: provision the external services, set env vars, flip to true.
   * Files affected:
   *   - Navigation.tsx (AuthButton in header)
   *   - App.tsx (ClerkProvider, /account routes)
   *   - CartContext.tsx (D1 sync when signed in)
   *   - components/account/* (all account UI)
   *
   * Enabled 2026-06-09: shared Clerk app (enabling-oyster-2) across
   * adrianrasmussen.com + mandalacodes.com, shared D1 (adrian-website).
   * Keys live in Infisical (dev) and Cloudflare Pages env (prod).
   */
  accounts: true,

  /**
   * PRICING EXPLORER — Customer-facing price-range tool in the
   * Multidimensional Art section. Shares the internal calculator's engine and
   * tuned config (utils/pricing/*).
   * Disabled because: the internal model should be validated against real
   * pieces first (Settings tab at /admin/pricing, then the Reference tab),
   * so the public ranges read true before visitors see them.
   * To re-enable: tune the model in /admin/pricing, then flip to true.
   * Files affected:
   *   - MultidimensionalArt.tsx (renders <PricingExplorer /> when true)
   */
  pricingExplorer: false,

  /**
   * LIVING LEGACY — the QR "front door" for physical pieces: scan → temple-paced
   * arrival + substantive certificate, keeper binding via a recovery code, and
   * the yearly birthday-locked INTENTION ritual (confirm-before-it-sets).
   * Adrian-Website is the canonical ledger/record home; the chain itself is
   * written through the shared inscription path (mandalacodes side).
   *
   * Disabled because: the D1 migration 008_living_legacy.sql is not yet applied
   * to the shared `adrian-website` database, real per-piece recovery codes have
   * not been generated/printed, and the experience is still being built out
   * (Phase 1 vertical slice only). With this flag false the site behaves exactly
   * as before — no arrival treatment, no keeper UI, and the keeper API endpoints
   * answer 404 — so nothing ships half-built.
   *
   * To re-enable:
   *   1. Apply migration 008 (wrangler d1 migrations apply adrian-website --remote).
   *   2. Generate a recovery code per piece (utils/recoveryCode.ts), print it on
   *      the back of the art, store ONLY the hash in data/qrRegistry.ts + the
   *      keeper bind row. Never commit the plaintext.
   *   3. Confirm the keeper birthday source (lib/profile / a stored MM-DD field).
   *   4. Flip to true.
   *
   * Files affected:
   *   - components/WorksPage.tsx (arrival treatment + keeper doors + intention UI)
   *   - components/legacy/* (PieceConstellation, KeeperPanel, IntentionRitual)
   *   - functions/api/keeper/bind.js, functions/api/keeper/intention.js (404 when off)
   *   - functions/api/atlas/mirror.js (piece-lens read; 404 when off)
   *   - data/qrRegistry.ts (recoveryCodeHash on artwork entries)
   */
  livingLegacy: true,
};
