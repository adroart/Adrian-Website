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
   * LIVING LEGACY — Adrian-Website is the canonical registry for permanent
   * physical artwork identities and keeper binding. Each plate has a public QR
   * identity and a permanent Ownership Code. D1 stores its verifier plus an
   * encrypted recoverable envelope; R2 mirrors only that encrypted envelope.
   * Public QR history and keeper binding stay behind this flag. Private admin
   * issuance/recovery can be staged first with the runtime-only
   * ARTWORK_REGISTRY_ADMIN_ENABLED variable, without exposing collector claims.
   *
   * Production configuration, migrations, restore checks, fabrication, and
   * first-shipment procedure are documented in docs/lineage-plate-runbook.md.
   * Keep this false until that runbook's production and prototype gates pass.
   */
  livingLegacy: false,
};
