# Claude Tasks

Code tasks that can be done without Adrian's input. Ordered by priority.

---

## Bugs (fix immediately)

- [ ] **Configurator duplication between `PiecePage` and `PieceConfigurator`** — the inline wizard on `PiecePage` (the variant branch with size step + add-ons + total + buy) and the `PieceConfigurator` component used inside the oracle BuySheet hold separate copies of the same state, the same pricing math, the same `getIlluminationTier` / `getAddOnSizeTier` / `getEditionDisplay` helpers, and the same buy handler. Any pricing change, any new add-on, any availability rule must be edited in both places — easy to drift, easy to miss. **Refactor:** delete the wizard JSX + state from `PiecePage` and render `<PieceConfigurator art={art} initialSize={preferredSize} />` in its place. **Blocker to bypass:** the sticky mobile bottom bar at the bottom of `PiecePage` reads the live total (`mtoTotal`) and live `selectedSize` from PiecePage's own state to render the persistent CTA when the configurator scrolls offscreen. Either (a) lift state up — make `PieceConfigurator` controlled, with PiecePage owning the state — or (b) simplify the sticky bar for variant pieces to "From $X · View options" that scrolls back to `purchaseRef` (no live total). Option (b) is smaller and removes the cross-component coupling.
- [ ] **`PieceConfigurator` doesn't gate on edition-closed** — when `LAUNCH_FLAGS.shopEnabled` is true, a piece whose edition has fully sold (`art.editionSize && (art.editionSold ?? 0) >= art.editionSize`) can still be purchased through the inline wizard inside `BuySheet`. `PiecePage` has an `editionClosed` early-return that shows a different "edition closed" UI; the extracted component skips that guard. Mirror the same check at the top of `PieceConfigurator` and either render an "Edition closed · Inquire about a similar piece" panel in place of the wizard, or hide the buy CTA. Not user-facing today (shop is off, request-to-purchase routes to /inquire where Adrian filters), but ship-blocker for shop launch.
- [ ] **No auto-scroll on step 1 → step 2 in the configurator** — inside the `BuySheet` on a short phone, tapping "Continue to options" leaves the new step below the visible fold of the sheet. Reader has to scroll the sheet manually to see the add-ons and buy CTA. Same behavior in `PiecePage`. Fix: when `configStep` flips to 2, call `scrollIntoView({ behavior: 'smooth', block: 'start' })` on the step-2 container, or scroll the nearest scrollable ancestor.
- [x] ~~**`getIlluminationTier` cm thresholds**~~ FIXED. Function now detects cm vs inch and uses correct thresholds (30/60/90 cm).
- [x] ~~**Inquire isDirty false positive**~~ FIXED. Tracks `prefilled` flag, clears on first focus. Pre-filled vision excluded from dirty check.
- [x] ~~**Lightbox body scroll lock**~~ FIXED. Sets `overflow: hidden` on body while open, restores on close.

---

## Before Launch: High Priority

### UX fixes
- [x] ~~Back navigation uses history with fallback (UX#6)~~ DONE (Phase 3A)
- [x] ~~Deterministic "Continue the Journey" sorting (UX#33)~~ DONE. Already deterministic via useMemo — no randomization.
- [x] ~~Loading indicator + disable fields during inquiry submit (UX#35)~~ DONE. Fieldset wraps form, disables all inputs during SENDING state.
- [x] ~~Store "Configure" uses `<Link>` not `<a>` (UX#68)~~ DONE. Already used React Router `<Link>`.
- [x] ~~Inquiry completion bar starts at 0% (UX#62)~~ DONE. All 8 tracked fields initialize empty, bar starts at 0%.
- [x] ~~Cart minus-to-zero shows trash icon (UX#64)~~ DONE (Phase 3D)
- [x] ~~Persist cart in localStorage (UX#65)~~ DONE. CartContext already persists via localStorage.
- [x] ~~Hero video poster fallback (UX#59)~~ DONE (Phase 3B)
- [x] ~~Image error handling with styled fallback in ArtImage (UX#57)~~ DONE (Phase 1)
- [x] ~~PiecePage thumbnails keyboard accessible (UX#58)~~ DONE. Already uses `<button>` elements.

### Readability / contrast
- [x] Lighten GenerativeBackground particle alpha in light mode (was competing with body text)
- [x] ~~Sticky filter bars: fully opaque `bg-paper-50` (Creations, Writings, Shop, SubcategoryPage)~~ DONE.
- [x] ~~Navigation glass variant: bumped to `bg-paper-50/90` (light) and `bg-stone-950/85` (dark)~~ DONE.
- [x] ~~Card image overlays: strengthened to `from-stone-950/80` on Creations tiles, Shop cards, IlluminatedWorks~~ DONE.
- [x] ~~Shop product hover overlay: bumped to `bg-wood-900/70`~~ DONE.
- [x] ~~Hero "Enter" label: bumped to `text-paper-100/80`~~ DONE.

### Code quality
- [x] ~~Consolidate price formatting (UX#54)~~ DONE (Phase 1: shared `formatPrice` utility)
- [x] ~~Availability text colors WCAG contrast fix (UX#55)~~ DONE (Phase 4F)
- [x] ~~Move inline styles from About/OracleCards to index.css (UX#56)~~ DONE (Phase 1)
- [x] ~~Extract shared hooks to `hooks/` directory (UX#85)~~ DONE (Phase 1)

### Prep (waiting on Adrian's assets)
- [x] ~~Favicon markup + sizes~~ DONE. Link tags in index.html + site.webmanifest ready for images.
- [x] ~~Dynamic og:image meta tag system~~ DONE. `useMetaTags` hook updates OG/Twitter tags per route. Integrated in PiecePage.
- [ ] Shipping policy page component + route (ready for Adrian's content)

---

## Before Launch: Medium Priority

- [x] ~~Consistent breadcrumbs across all pages (UX#5)~~ DONE. Writings article pages now use `/`-separated breadcrumbs matching Creations pattern.
- [x] ~~Two-column mobile gallery (UX#11)~~ DONE (Phase 4D)
- [x] ~~Filter pill touch targets larger (UX#12)~~ DONE (Phase 4E)
- [x] ~~Category tile descriptions visible by default (UX#32)~~ DONE (Phase 4C: opacity-70)
- [x] ~~Gallery hover: replace overlay with subtle indicator (UX#27)~~ DONE. GalleryTileCard already uses subtle "View" prompt with 15% overlay.
- [x] ~~`:active` states for touch devices (UX#26)~~ DONE. `.touch-active` class in index.css + applied to category tiles, gallery cards, shop cards.
- [x] ~~Gallery tile keyboard focus visual (UX#30)~~ DONE. Already has `focus-visible:ring-2 ring-bronze-500`.
- [x] ~~Collection card click scrolls to results (UX#28)~~ DONE (Phase 3H)
- [x] ~~PiecePage "Add to Cart" confirmation more visible (UX#29)~~ DONE. Added scale pulse + ring glow on confirmation state.
- [x] ~~Consistent commission CTA text across site (UX#37)~~ DONE (Phase 4A: "Begin a conversation")
- [x] ~~Consolidate back-to-top implementations (UX#36)~~ DONE (Phase 4B: shared BackToTop)
- [x] ~~Unified hover underline mechanics (UX#39)~~ DONE. `.hover-underline` class in index.css with sliding scaleX animation.

---

## First Week After Launch

- [ ] Finishes/Options modal (needs Adrian's images for Natural, Painted, Crystal, LED, Framing)
- [ ] "Available Now" dedicated section on Creations landing
- [ ] Rate limiting on `/api/checkout` (Cloudflare rate limiting rules)
- [ ] Post-purchase confirmation page (needs Adrian's copy direction)

---

## First Month

- [ ] Dedicated category pages for Jewelry, Oracle Cards, Tables, Installations, Objects, Spaces
- [ ] Category-specific filters per spec (Jewelry: type/material/price; Tables: size/material; etc.)
- [ ] Series-specific filters (UL: availability/finish/size; Light Codes: category/size; etc.)
- [ ] Filter UX decisions: single vs multi-select, active display style, clear all vs individual, result counts, empty state messaging
- [ ] Mobile bottom sheet filter overlay (replaces inline filters on small screens)
- [ ] Mobile two-tap hero grid (tap once reveals name + description, tap again navigates)
- [ ] "See What's Possible" modal as full-screen overlay on mobile
- [ ] Friendly error state messaging (light touch, per Copy Guidelines)
- [ ] Conversion tracking: inquiry submissions + completed purchases
- [ ] Cookie consent mechanism (if needed for GDPR/CCPA with analytics + Kit)
- [ ] Cross-browser testing (Safari, Firefox, Chrome, mobile browsers)
- [ ] Full WCAG color contrast audit
- [ ] Screen reader end-to-end testing
- [ ] Keyboard navigation audit
- [ ] Content management workflow documentation
- [ ] Teajia integration points: Spaces category page, Tables category page, Inquire spatial commissions
- [ ] Route-based code splitting with React.lazy
- [ ] Self-host Google Fonts
- [ ] Cart drawer swipe-to-close (UX#14)
- [ ] Page transition animations (UX#8)
- [ ] Pause GenerativeBackground when not visible (UX#42)
- [ ] Image LQIP blur-up placeholders
- [ ] Responsive image srcset on non-ArtImage images
- [ ] DarkModeContext targeted re-renders (UX#87)
- [x] ~~System preference detection for dark mode (UX#81)~~ DONE (Phase 5A)

---

## Recently Completed (reference)

PiecePage redesign (March 2026):
- [x] Image lightbox with zoom (VisualLightbox + ZoomableImage extracted from Store)
- [x] Share button moved next to title, old duplicate removed
- [x] Collapsible series description block
- [x] SOLD redesign: "found its home" + historical price + series link + inquire CTA
- [x] Mobile sticky bar shows for SOLD pieces
- [x] Related pieces SOLD treatment (opacity + overlay)
- [x] All Inquire links pass router state
- [x] Inquire pre-fill from router state
- [x] 22 UL pieces: SOLD to MADE_TO_ORDER with cm sizeVariants
- [x] seriesDescription field + UL_SERIES_DESCRIPTION constant
- [x] avail-sold color distinct from avail-order
- [x] Made-to-order configuration UI (size selector, add-ons, dynamic totals)
- [x] Store.tsx updated to use shared VisualLightbox
- [x] Form errors aria-describedby (UX#22)
- [x] Budget slider aria-valuetext (UX#23)
- [x] Inquiry form unsaved navigation warning (UX#66)
- [x] PiecePage related pieces fallback (UX#67)
- [x] PiecePage share clipboard fallback (UX#76)

Infra fixes (March 2026):
- [x] Privacy Policy: updated third-party services (Formspree → Resend + Kit)
- [x] CSP header: replaced formspree.io with api.convertkit.com in connect-src
- [x] Removed console.log debug statements from index.tsx
- [x] Gated localhost origins in checkout.js/inquire.js (only allowed with test keys)
- [x] Fixed Instagram link in Footer.tsx (was href="#", now links to profile)
