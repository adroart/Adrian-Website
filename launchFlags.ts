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
   *
   * OFF ON PURPOSE. Not a missing feature, and not a placeholder problem any more.
   *
   * Adrian's decision, 2026-09-02: stock sits in several places, some pieces ship
   * from Bali and some from the US, and a good share are made to order. Shipping
   * cost and lead time therefore depend on which piece, which size, and where the
   * buyer is — none of which a cart can work out on its own. Until that is solved,
   * a direct conversation gives the buyer a better answer than a checkout would,
   * so "Request to Purchase" into the enquiry flow IS the intended path, not a
   * fallback. The enquiry carries piece, price, size, add-ons and availability
   * through to the form, so the conversation starts with the details already known.
   *
   * Do NOT propose flipping this because the code is ready. The code being ready
   * was never the blocker. The blocker is logistics, and it is Adrian's call.
   *
   * The groundwork is done and waiting: scripts/stripe-sync-prices.ts creates the
   * Stripe catalog (291 prices, verified end to end against the real data) whenever
   * the logistics question is answered. Nothing has been created in Stripe yet.
   *
   * To re-enable, once shipping origin and lead time can be answered per piece:
   *   run `infisical run --env=dev -- npm run stripe:sync -- --apply`,
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
   * ACCOUNTS, Better Auth sign-in for profile sync, order history, saved
   * collections, and synced cart across devices. Both sites use the same
   * authentication service and shared D1 database.
   * Files affected:
   *   - Navigation.tsx (AuthButton in header)
   *   - App.tsx (/account routes)
   *   - CartContext.tsx (D1 sync when signed in)
   *   - components/account/* (all account UI)
   *
   * Better Auth configuration lives in Infisical for development and in the
   * Cloudflare Pages environment for production.
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
   * artwork identities and steward binding. A registered artwork has a public
   * identity and a permanent Ownership Code before any optional plate work. D1 stores its verifier plus an
   * encrypted recoverable envelope; R2 mirrors only that encrypted envelope.
   * Public arrival, collector registration, history, privacy, and steward binding stay behind this flag. Private admin
   * issuance/recovery can be staged first with the runtime-only
   * ARTWORK_REGISTRY_ADMIN_ENABLED variable, without exposing collector claims.
   *
   * Production configuration, migrations, restore checks, fabrication, and
   * first-shipment procedure are documented in docs/lineage-plate-runbook.md.
   * Keep this false until that runbook's production and prototype gates pass.
   */
  livingLegacy: false,
};
