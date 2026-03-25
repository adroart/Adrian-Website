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
   * ORACLE CARDS category tile
   * Disabled because: No artwork pieces, placeholder images only.
   * To re-enable: Upload real images, add pieces to mockData.ts,
   *   remove hidden: true from ORACLE in mockData.ts CREATION_CATEGORIES.
   * Files affected: mockData.ts (hidden: true on ORACLE category)
   */
  oracleCards: false,

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
};
