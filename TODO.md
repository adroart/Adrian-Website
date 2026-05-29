# TODO — Adrian-Website

Living list of outstanding work on the artist portfolio + shop. See `CLAUDE.md` for the project's intent and constraints.

## Soon

### Recent decisions to watch

- [ ] **Decide whether to strip Bali from About bio + Writings stories.** Trigger: revisit if a buyer reading About reads too "Bali-coded." Owner: Adrian. 2026-05-29 scrub removed Bali from business copy and SEO; autobiographical mentions in `components/About.tsx` and `content/stories/*.md` left in place per scope. Standing rule lives at `feedback_no_business_location.md` in project memory.

- [ ] **Watch SEO ranking shift after Bali removal.** Trigger: glance at Cloudflare Analytics search-term data over the next month. Owner: Adrian. Removing `addressLocality: Bali` from JSON-LD will drop "Bali artist" local-search results — intended.

### Adrian-only — blocks launch

- [ ] **Photography.** 40+ site-level images plus 2-3 gallery shots per artwork. Shoot, upload to Cloudinary under `adrian-website/` folder structure, then either update the public IDs in `data/mockData.ts` yourself or hand the filenames to Claude. Site-level shots needed: homepage commission detail (9:11); About portrait (3:4), tea/travels (3:4), studio creation (1:1), two interstitials (16:9); 8 Creations category tiles (1:1); 4 Multidimensional Art subcategory tiles (1:1); Universal Language / Light Codes / Mandala subcategory heroes (3:2); Illuminated Works hero (2:1, day-to-dark); Oracle Cards 4 deck covers (9:11), 4 sample cards (2:3), 1 ceremony interstitial (16:9); 6 Writings story images (3:2); Inquire hero (16:9), personal path (5:6), spatial path (6:5). Illuminated pieces need daylight + glowing versions.

- [ ] **Stripe activation.** Switch to live mode, create Products + Prices for every ready-to-ship piece and for all UL sizeVariants (29 / 58 / 90 cm), replace every `price_REPLACE` and `_REPLACE_WITH_REAL_ID` in `data/mockData.ts`, configure shipping rates in the Stripe dashboard (carrier from Bali, flat vs weight-based, regional rates, free-shipping threshold).

- [ ] **Cloudflare Pages env vars.** Set `STRIPE_SECRET_KEY` (live `sk_live_...`), `VITE_STRIPE_PUBLISHABLE_KEY` (live `pk_live_...`), `RESEND_API_KEY` (inquiry emails are silent without this). Verify `VITE_KIT_FORM_ID` and `VITE_KIT_PUBLIC_API_KEY` are set.

- [ ] **Pricing decisions.** Final pricing for all pieces by size tier; add-on pricing for crystals / wood frame / illumination per size tier / custom frame; category pricing ranges for Light Codes, Jewelry, Tables, Oracle Cards. Current UL sizeVariant placeholders are $395 / $1,111 / $2,500.

- [ ] **Shipping + returns policy content.** Cover: where pieces ship from, domestic vs international timelines, ready-to-ship (~2-3 weeks typical), commissioned work (ships on completion), packaging and insurance, returns/exchanges, customs and import duties (buyer responsibility or included). Claude will build the page component and route once the content lands. Heads-up: per the no-business-location rule, the policy shouldn't name Bali.

- [ ] **UL piece descriptions.** All 22 currently say "Number [N] in the Universal Language series." Write a short unique paragraph for each.

- [ ] **Other launch content.** Illuminated Works voice (2-3 sentences in your voice, replaces TODO in `IlluminatedWorks.tsx`); About page "The Root" review for biographical accuracy; favicon source (512x512 square); OG share image (1200x630).

- [ ] **Curation.** Choose 10-20 pieces for the homepage Selected Works grid. Ensure at least one full series is populated end-to-end (real images + descriptions + pricing) before shipping.

### Claude-side — code bugs to fix before shop launch

- [ ] **Configurator duplication between `PiecePage` and `PieceConfigurator`.** Two copies of the same wizard state + pricing math + helpers + buy handler. Any pricing change today means two edits. Refactor: delete the wizard JSX + state from `PiecePage` and render `<PieceConfigurator art={art} initialSize={preferredSize} />` instead. Blocker to bypass: `PiecePage`'s sticky mobile bottom bar reads live total + selectedSize from local state. Either lift state up (configurator becomes controlled, PiecePage owns the state) or simplify the sticky bar to "From $X · View options" + scroll-to-purchase (smaller change, removes the coupling).

- [ ] **`PieceConfigurator` missing edition-closed gate.** When `shopEnabled` flips on, a sold-out edition (`editionSize && (editionSold ?? 0) >= editionSize`) can still be purchased through the inline BuySheet wizard. `PiecePage` has the gate; the extracted component skips it. Mirror the check at the top of `PieceConfigurator`. Not user-facing today (shop off, request routes to `/inquire`), but shop-launch-blocker.

- [ ] **No auto-scroll on configurator step 1 → 2.** Inside the BuySheet on short phones, "Continue to options" leaves the new step below the visible fold. Same in `PiecePage`. Fix: when `configStep` becomes 2, `scrollIntoView({ behavior: 'smooth', block: 'start' })` on the step-2 container or the nearest scrollable ancestor.

### Claude-side — needs Adrian's content before it can ship

- [ ] **Shipping policy page component + route.** Build once the policy content is written.

### Oracle accounts branch — decision pending

- [ ] **Oracle accounts branch decision.** `origin/claude/oracle-energy-birthdate-4HS3f` carries Clerk + D1 + Hologenetic profile + today/year energy panels. Today/year cards on `main` are placeholder. Either merge that branch into `main`, or accept the placeholder state as permanent now that the oracle work lives in mandalacodes. Mandalacodes already has its own Clerk swap merged (2026-05-28); double-Clerk-app or shared-app is the choice point. Full per-file implementation log is at [`docs/oracle-accounts-implementation.md`](docs/oracle-accounts-implementation.md). If merging: complete the provisioning steps in that doc's "Adrian to provision" section, run the smoke test, then flip `accounts: true` in `launchFlags.ts`.

## Future

### Shop launch
- [ ] **Shop launch.** `LAUNCH_FLAGS.shopEnabled` is `false`. "Add to Cart" routes to `/inquire`. Price IDs still placeholder. When ready: real Stripe price IDs, flip the flag.

### Mandala Codes
- [ ] **Mandala Codes split — Phase 2 cleanup.** The oracle reader components, oracle data files, and inline-redirect components are still in place as planned (see Operational notes below). Once mandalacodes.com is visibly sale-ready (deck purchase path live) and the redirects have been live long enough to confirm no traffic still relies on the in-site oracle pages, remove the oracle reader (`UniversalLanguageCard`, `UniversalLanguageIndex`, `OracleSystems`, `OracleProfile`, `OracleCardEntrance`, `components/oracle/`) and any oracle-only data files (`synthesisData`, expanded readings, `profilePositions`, `trigrams`) that nothing else imports. Optionally add a small "Experience this in Mandala Codes" cross-link on each Universal Language piece page. Full scope in [`docs/phase-2-mandala-split.md`](docs/phase-2-mandala-split.md).

### First week after launch
- [ ] Finishes / Options modal (needs Adrian's images for Natural, Painted, Crystal, LED, Framing; needs illumination demo videos 15-30s, loop-friendly, day-to-dark transitions).
- [ ] "Available Now" dedicated section on Creations landing.
- [ ] Rate limiting on `/api/checkout` (Cloudflare rate limiting rules).
- [ ] Post-purchase confirmation page (needs Adrian's tone/copy direction).
- [ ] Review Cloudflare Web Analytics dashboard.
- [ ] Build newsletter welcome sequence in Kit dashboard (3 emails: welcome, story, invitation). Decide frequency approach ("as inspired, not scheduled"?).

### First month after launch
- [ ] Dedicated category pages for Jewelry, Oracle Cards, Tables, Installations, Objects, Spaces (Adrian writes intro text per category; Claude builds pages).
- [ ] Category-specific filters per spec (Jewelry: type/material/price; Tables: size/material; etc.) and series-specific filters (UL: availability/finish/size; Light Codes: category/size; etc.). Includes UX decisions for single vs multi-select, active display style, clear-all vs individual, result counts, empty state messaging.
- [ ] Mobile bottom-sheet filter overlay (replaces inline filters on small screens).
- [ ] Mobile two-tap hero grid (tap once reveals name + description, tap again navigates).
- [ ] "See What's Possible" modal as full-screen overlay on mobile.
- [ ] Flesh out "Objects" category descriptions (sphere holders, incense, dimensional pieces).
- [ ] More Writings content; publish at least one piece in The Path.
- [ ] SEO keyword strategy review (Claude drafts, Adrian approves).
- [ ] Conversion tracking: inquiry submissions + completed purchases.
- [ ] Cookie consent mechanism (if needed for GDPR/CCPA with analytics + Kit).
- [ ] Cross-browser testing (Safari, Firefox, Chrome, mobile browsers).
- [ ] Full WCAG color contrast audit; screen reader end-to-end testing; keyboard navigation audit.
- [ ] Teajia integration points: Spaces category page, Tables category page, Inquire spatial commissions.
- [ ] Route-based code splitting with `React.lazy`; self-host Google Fonts.
- [ ] Decide newsletter signup placement: Welcome page link? Mobile hamburger menu?
- [ ] Friendly error state messaging (light touch, per Copy Guidelines).
- [ ] Cart drawer swipe-to-close; page transition animations; pause GenerativeBackground when offscreen.
- [ ] Image LQIP blur-up placeholders; responsive image srcset on non-ArtImage images; DarkModeContext targeted re-renders.

### Optional polish (Claude-side, non-blocking)
- [ ] Surface `SaveToCollectionButton` on artwork pages and Store cards (currently only on Universal Language card reading; component + provider already in place).
- [ ] Refactor cart's add-on identity to thread `configurator` state through `lib/cart/sync.ts` if configurator state ships in the cart (add-ons, frame, illumination). Server already keys cart rows on `(user_id, product_id, configurator_json)`.
- [ ] Pre-launch only: lazy-import Clerk inside `AuthButton` so the home-page bundle doesn't carry ~18 KB gz from Clerk's SDK when accounts are off.
- [ ] Expand `public/data/cities-index.json` by running `npx tsx scripts/build-cities-index.ts cities15000.txt` against a fresh GeoNames extract (current 92-city seed is fine for early users, undersized long-term).

### PiecePage / Store design improvements
50 design suggestions from an April 2026 audit — typography, layout, color, motion, configurator, related works, IA, mobile, peripheral. Full list at [`docs/piece-page-design-audit.md`](docs/piece-page-design-audit.md).

### Larger features (no commitment yet)
- [ ] Re-add featured creations / Selected Works / Available Now sections to homepage + Creations page.
- [ ] Global site search.
- [ ] Recently Viewed pieces (localStorage).
- [ ] Image comparison slider for Illuminated Works (day vs night).
- [ ] Pricing explorer tool (interactive sliders for size + finish).
- [ ] Currency selector for international visitors.
- [ ] PWA capabilities (Service Worker + manifest).
- [ ] Print stylesheet for collectors.
- [ ] Save for Later / wishlist.
- [ ] Notify Me for sold-out pieces.
- [ ] Custom laser cut frame add-on (temporarily disabled, needs pricing).
- [ ] Apple Pay / Google Pay express checkout.
- [ ] Made-to-order deposit structure (50% upfront, 50% on completion).
- [ ] Abandoned cart recovery; order tracking post-purchase; inventory management synced with Stripe; edition tracking system (real-time counts).
- [ ] Dynamic og:image per artwork page; additional structured data (ImageGallery, FAQ); keyword strategy execution; per-category/series meta descriptions.
- [ ] End-to-end tests (Playwright/Cypress); error monitoring (Sentry); heat mapping for post-launch optimization.
- [ ] Headless CMS migration when `mockData.ts` becomes unmaintainable.
- [ ] Cloudflare Images migration if outgrowing Cloudinary free tier.
- [ ] Route-level error boundaries; intersection-based infinite scroll for Store.
- [ ] Backup strategy for content, images, and order data.
- [ ] NFT integration for legacy documentation; QR codes on physical plaques.
- [ ] Virtual tours / 3D piece viewing; client portal for commission progress; events calendar; press / media section; process videos for The Practice; installation project documentation.

## Operational notes (not TODOs — context for future-you)

- The QR Function at `functions/qr/[number].js` redirects scanned plaques to `mandalacodes.com/universal-language/:n`. Treat it as permanent infrastructure — printed plaques out in the world depend on it.

- Oracle code (`OracleGateway`, `UniversalLanguageCard`, oracle data files, vite OG plugin) was intentionally left in place when mandalacodes split off. It can be removed in a future PR after the redirect has been live long enough to confirm no traffic still relies on the in-site oracle pages.

- `/atlas` and `/atlas/*` hard-redirect to `mandalacodes.com/atlas`. The atlas implementation was removed from Adrian-Website on 2026-05-23 (PR #111 + #112).

- A bunch of pre-launch code work shipped in March-April 2026 (PiecePage redesign, lightbox, share, breadcrumbs, accessibility, focus states, shared `formatPrice`, etc.). Detailed log was previously in `todo/claude-tasks.md`; pre-cleanup snapshot is preserved at [`docs/claude-tasks-archive-2026-05.md`](docs/claude-tasks-archive-2026-05.md) for the record.

- The Cloudinary pipeline is built end-to-end. `utils/cloudinary.ts` handles responsive srcSet automatically; `ArtImage.tsx` accepts both `publicId` (Cloudinary) and `src` (plain URL); ArtImage has a styled fallback for missing images.

- The cart system and checkout flow are already built. Stripe webhooks for fulfillment notifications are wired (see `docs/oracle-accounts-implementation.md` for the per-file detail). Cart persists via localStorage.
