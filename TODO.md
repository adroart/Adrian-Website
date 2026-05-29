# TODO: Adrian-Website

Living list of outstanding work on the artist portfolio + shop. See `CLAUDE.md` for the project's intent and constraints.

## Soon

### Recent decisions to watch

- [ ] **Decide whether to strip Bali from About bio + Writings stories.** _(band: you-required)_ Trigger: revisit if a buyer reading About reads too "Bali-coded." The 2026-05-29 scrub removed Bali from business copy and SEO; autobiographical mentions in `components/About.tsx` and `content/stories/*.md` were left in place per scope. Standing rule: `feedback_no_business_location.md` in project memory.

- [ ] **Watch SEO ranking shift after Bali removal.** _(band: you-required)_ Trigger: glance at Cloudflare Analytics search-term data over the next month. Removing `addressLocality: Bali` from JSON-LD will drop "Bali artist" local-search results, intended.

## Pre-launch

### Adrian-only: blocks launch

- [ ] **Commit the staged Bali → studio scrub.** _(band: you-required)_ Trigger: any time you open Adrian-Website. 8 modified files in the working tree on `main` (`components/About.tsx`, `Footer.tsx`, `Inquire.tsx`, `PiecePage.tsx`, `Terms.tsx`, `hooks/useMetaTags.ts`, `useSeoMeta.ts`, `index.html`), small, focused, one commit on its own branch. They were stashed-then-restored during the 2026-05-29 oracle-removal work (PR #113) to keep that PR clean.

- [ ] **Review and decide on the untracked `docs/phase-2-mandala-split.md`.** _(band: you-required)_ Trigger: same session as the scrub commit. Planning doc that appeared in the working tree before the oracle-removal work; never reviewed. Either commit it into `docs/`, move it to the right place, or delete it.
- File: [docs/phase-2-mandala-split.md](docs/phase-2-mandala-split.md)

- [ ] **Photography.** _(band: you-required)_ 40+ site-level images plus 2-3 gallery shots per artwork. Shoot, upload to Cloudinary under `adrian-website/`, then update public IDs in `data/mockData.ts` yourself or hand filenames to Claude. Site-level shots: homepage commission detail (9:11); About portrait (3:4), tea/travels (3:4), studio creation (1:1), two interstitials (16:9); 8 Creations category tiles (1:1); 4 Multidimensional Art subcategory tiles (1:1); Universal Language / Light Codes / Mandala subcategory heroes (3:2); Illuminated Works hero (2:1, day-to-dark); Oracle Cards 4 deck covers (9:11), 4 sample cards (2:3), 1 ceremony interstitial (16:9); 6 Writings story images (3:2); Inquire hero (16:9), personal path (5:6), spatial path (6:5). Illuminated pieces need daylight + glowing versions.

- [ ] **Stripe activation.** _(band: you-required)_ Switch to live mode, create Products + Prices for every ready-to-ship piece and all UL sizeVariants (29 / 58 / 90 cm), replace every `price_REPLACE` and `_REPLACE_WITH_REAL_ID` in `data/mockData.ts`, configure shipping rates in the Stripe dashboard (carrier from Bali, flat vs weight-based, regional rates, free-shipping threshold).

- [ ] **Set Cloudflare Pages env vars.** _(band: you-required)_ Set `STRIPE_SECRET_KEY` (live `sk_live_...`), `VITE_STRIPE_PUBLISHABLE_KEY` (live `pk_live_...`), `RESEND_API_KEY` (inquiry emails are silent without this). Verify `VITE_KIT_FORM_ID` and `VITE_KIT_PUBLIC_API_KEY` are set.

- [ ] **Pricing decisions.** _(band: you-required)_ Final pricing for all pieces by size tier; add-on pricing for crystals / wood frame / illumination per size tier / custom frame; category ranges for Light Codes, Jewelry, Tables, Oracle Cards. Current UL sizeVariant placeholders are $395 / $1,111 / $2,500.

- [ ] **Write shipping + returns policy content.** _(band: you-required)_ Cover: where pieces ship from, domestic vs international timelines, ready-to-ship (~2-3 weeks typical), commissioned work (ships on completion), packaging and insurance, returns/exchanges, customs and import duties. Claude builds the page component once content lands. Per the no-business-location rule, the policy shouldn't name Bali.

- [ ] **Write UL piece descriptions.** _(band: you-required)_ All 22 currently say "Number [N] in the Universal Language series." Write a short unique paragraph for each.

- [ ] **Other launch content.** _(band: you-required)_ Illuminated Works voice (2-3 sentences, replaces TODO in `IlluminatedWorks.tsx`); About page "The Root" review for biographical accuracy; favicon source (512x512 square); OG share image (1200x630).

- [ ] **Curation.** _(band: you-required)_ Choose 10-20 pieces for the homepage Selected Works grid. Ensure at least one full series is populated end-to-end (images + descriptions + pricing) before shipping.

### Claude-side: code bugs to fix before shop launch

- [ ] **Resolve configurator duplication between `PiecePage` and `PieceConfigurator`.** _(band: agent-runnable)_ Two copies of the same wizard state + pricing math + helpers + buy handler; any pricing change means two edits. Refactor: delete the wizard JSX + state from `PiecePage`, render `<PieceConfigurator art={art} initialSize={preferredSize} />` instead. Blocker to bypass: `PiecePage`'s sticky mobile bottom bar reads live total + selectedSize from local state. Either lift state up (configurator becomes controlled, PiecePage owns state) or simplify the sticky bar to "From $X · View options" + scroll-to-purchase.

- [ ] **Add the edition-closed gate to `PieceConfigurator`.** _(band: agent-runnable)_ When `shopEnabled` flips on, a sold-out edition (`editionSize && (editionSold ?? 0) >= editionSize`) can still be purchased through the inline BuySheet wizard. `PiecePage` has the gate; the extracted component skips it. Mirror the check at the top of `PieceConfigurator`. Not user-facing today (shop off, request routes to `/inquire`), but a shop-launch blocker.

- [ ] **Add auto-scroll on configurator step 1 → 2.** _(band: agent-runnable)_ Inside the BuySheet on short phones, "Continue to options" leaves the new step below the fold. Same in `PiecePage`. Fix: when `configStep` becomes 2, `scrollIntoView({ behavior: 'smooth', block: 'start' })` on the step-2 container or nearest scrollable ancestor.

### Claude-side: needs Adrian's content before it can ship

- [ ] **Build the shipping policy page component + route.** _(band: agent-runnable)_ Build once the policy content is written (see the policy-content item under Adrian-only above).

### Oracle accounts branch: decision pending

- [ ] **Decide on the oracle accounts branch.** _(band: you-required)_ `origin/claude/oracle-energy-birthdate-4HS3f` carries Clerk + D1 + Hologenetic profile + today/year energy panels. Today/year cards on `main` are placeholder. Either merge that branch into `main`, or accept the placeholder state as permanent now that oracle work lives in mandalacodes. Mandalacodes already has its own Clerk swap merged (2026-05-28); double-Clerk-app or shared-app is the choice point. If merging: complete the provisioning steps in the doc's "Adrian to provision" section, run the smoke test, then flip `accounts: true` in `launchFlags.ts`.
- Full per-file implementation log: [docs/oracle-accounts-implementation.md](docs/oracle-accounts-implementation.md)

## Future

### Shop launch

- [ ] **Shop launch.** _(band: you-required)_ `LAUNCH_FLAGS.shopEnabled` is `false` (in `src/launchFlags.ts`). "Add to Cart" routes to `/inquire`. Price IDs still placeholder. When ready: real Stripe price IDs, flip the flag.

### Mandala Codes split

- [ ] **Mandala Codes split, Phase 2 cleanup.** _(band: agent-runnable)_ The oracle reader components, oracle data files, and inline-redirect components are still in place as planned (see Operational notes). Once mandalacodes.com is visibly sale-ready (deck purchase path live) and the redirects have been live long enough to confirm no traffic relies on the in-site oracle pages, remove the oracle reader (`UniversalLanguageCard`, `UniversalLanguageIndex`, `OracleSystems`, `OracleProfile`, `OracleCardEntrance`, `components/oracle/`) and any oracle-only data files (`synthesisData`, expanded readings, `profilePositions`, `trigrams`) nothing else imports. Optionally add a small "Experience this in Mandala Codes" cross-link on each Universal Language piece page.
- Full scope: [docs/phase-2-mandala-split.md](docs/phase-2-mandala-split.md)

### First week after launch

- [ ] **Finishes / Options modal.** _(band: you-required)_ Needs Adrian's images for Natural, Painted, Crystal, LED, Framing; needs illumination demo videos (15-30s, loop-friendly, day-to-dark transitions).
- [ ] **"Available Now" section on Creations landing.** _(band: agent-runnable)_ Dedicated section surfacing in-stock pieces.
- [ ] **Rate limiting on `/api/checkout`.** _(band: you-required)_ Cloudflare rate-limiting rules.
- [ ] **Post-purchase confirmation page.** _(band: you-required)_ Needs Adrian's tone/copy direction.
- [ ] **Review the Cloudflare Web Analytics dashboard.** _(band: you-required)_
- [ ] **Build newsletter welcome sequence in Kit dashboard.** _(band: you-required)_ 3 emails (welcome, story, invitation). Decide frequency approach ("as inspired, not scheduled"?).

### First month after launch

- [ ] **Dedicated category pages** _(band: agent-runnable)_ for Jewelry, Oracle Cards, Tables, Installations, Objects, Spaces (Adrian writes intro text per category; Claude builds pages).
- [ ] **Category-specific + series-specific filters** _(band: agent-runnable)_ per spec (Jewelry: type/material/price; Tables: size/material; UL: availability/finish/size; Light Codes: category/size). Includes UX decisions for single vs multi-select, active display style, clear-all vs individual, result counts, empty-state messaging.
- [ ] **Mobile bottom-sheet filter overlay.** _(band: agent-runnable)_ Replaces inline filters on small screens.
- [ ] **Mobile two-tap hero grid.** _(band: agent-runnable)_ Tap once reveals name + description, tap again navigates.
- [ ] **"See What's Possible" modal** _(band: agent-runnable)_ as a full-screen overlay on mobile.
- [ ] **Flesh out "Objects" category descriptions.** _(band: you-required)_ Sphere holders, incense, dimensional pieces.
- [ ] **More Writings content.** _(band: you-required)_ Publish at least one piece in The Path.
- [ ] **SEO keyword strategy review.** _(band: agent-runnable)_ Claude drafts, Adrian approves.
- [ ] **Conversion tracking.** _(band: agent-runnable)_ Inquiry submissions + completed purchases.
- [ ] **Cookie consent mechanism.** _(band: agent-runnable)_ If needed for GDPR/CCPA with analytics + Kit.
- [ ] **Cross-browser testing.** _(band: you-required)_ Safari, Firefox, Chrome, mobile browsers.
- [ ] **Full WCAG color-contrast audit + screen reader + keyboard navigation audit.** _(band: agent-runnable)_
- [ ] **Teajia integration points.** _(band: agent-runnable)_ Spaces category page, Tables category page, Inquire spatial commissions.
- [ ] **Route-based code splitting + self-host Google Fonts.** _(band: agent-runnable)_ `React.lazy` for routes.
- [ ] **Decide newsletter signup placement.** _(band: you-required)_ Welcome page link? Mobile hamburger menu?
- [ ] **Friendly error-state messaging.** _(band: agent-runnable)_ Light touch, per Copy Guidelines.
- [ ] **Motion polish.** _(band: agent-runnable)_ Cart drawer swipe-to-close; page transition animations; pause GenerativeBackground when offscreen.
- [ ] **Image performance.** _(band: agent-runnable)_ LQIP blur-up placeholders; responsive srcset on non-ArtImage images; DarkModeContext targeted re-renders.

### Optional polish (Claude-side, non-blocking)

- [ ] **Surface `SaveToCollectionButton`** _(band: agent-runnable)_ on artwork pages and Store cards (currently only on Universal Language card reading; component + provider already in place).
- [ ] **Refactor cart add-on identity** _(band: agent-runnable)_ to thread `configurator` state through `lib/cart/sync.ts` if configurator state ships in the cart (add-ons, frame, illumination). Server already keys cart rows on `(user_id, product_id, configurator_json)`.
- [ ] **Lazy-import Clerk inside `AuthButton`** _(band: agent-runnable)_ (pre-launch only) so the home-page bundle doesn't carry ~18 KB gz from Clerk's SDK when accounts are off.
- [ ] **Expand `public/data/cities-index.json`** _(band: agent-runnable)_ by running `npx tsx scripts/build-cities-index.ts cities15000.txt` against a fresh GeoNames extract (current 92-city seed is fine for early users, undersized long-term).

### PiecePage / Store design improvements

- [ ] **PiecePage / Store design pass.** _(band: agent-runnable)_ 50 design suggestions from an April 2026 audit, typography, layout, color, motion, configurator, related works, IA, mobile, peripheral.
- Full list: [docs/piece-page-design-audit.md](docs/piece-page-design-audit.md)

### Larger features (no commitment yet)

- [ ] **Homepage/Creations sections.** _(band: agent-runnable)_ Re-add featured creations / Selected Works / Available Now sections.
- [ ] **Global site search.** _(band: agent-runnable)_
- [ ] **Recently Viewed pieces (localStorage).** _(band: agent-runnable)_
- [ ] **Image comparison slider for Illuminated Works (day vs night).** _(band: agent-runnable)_
- [ ] **Pricing explorer tool (interactive sliders for size + finish).** _(band: agent-runnable)_
- [ ] **Currency selector for international visitors.** _(band: agent-runnable)_
- [ ] **PWA capabilities (Service Worker + manifest).** _(band: agent-runnable)_
- [ ] **Print stylesheet for collectors.** _(band: agent-runnable)_
- [ ] **Save for Later / wishlist.** _(band: agent-runnable)_
- [ ] **Notify Me for sold-out pieces.** _(band: agent-runnable)_
- [ ] **Custom laser-cut frame add-on.** _(band: you-required)_ Temporarily disabled, needs pricing.
- [ ] **Apple Pay / Google Pay express checkout.** _(band: agent-runnable)_
- [ ] **Made-to-order deposit structure (50% upfront, 50% on completion).** _(band: you-required)_
- [ ] **Order lifecycle features.** _(band: agent-runnable)_ Abandoned cart recovery; order tracking post-purchase; inventory management synced with Stripe; edition tracking (real-time counts).
- [ ] **SEO/metadata depth.** _(band: agent-runnable)_ Dynamic og:image per artwork; additional structured data (ImageGallery, FAQ); keyword strategy execution; per-category/series meta descriptions.
- [ ] **Quality infrastructure.** _(band: agent-runnable)_ End-to-end tests (Playwright/Cypress); error monitoring (Sentry); heat mapping for post-launch optimization.
- [ ] **Headless CMS migration** _(band: agent-runnable)_ when `mockData.ts` becomes unmaintainable.
- [ ] **Cloudflare Images migration** _(band: agent-runnable)_ if outgrowing Cloudinary free tier.
- [ ] **Route-level error boundaries + intersection-based infinite scroll for Store.** _(band: agent-runnable)_
- [ ] **Backup strategy for content, images, and order data.** _(band: you-required)_
- [ ] **NFT integration for legacy documentation; QR codes on physical plaques.** _(band: you-required)_
- [ ] **Larger experiences.** _(band: you-required)_ Virtual tours / 3D piece viewing; client portal for commission progress; events calendar; press/media section; process videos for The Practice; installation project documentation.

## Operational notes (not TODOs: context for future-you)

- The QR Function at `functions/qr/[number].js` redirects scanned plaques to `mandalacodes.com/universal-language/:n`. Treat it as permanent infrastructure, printed plaques out in the world depend on it.

- Oracle code (`OracleGateway`, `UniversalLanguageCard`, oracle data files, vite OG plugin) was intentionally left in place when mandalacodes split off. It can be removed in a future PR after the redirect has been live long enough to confirm no traffic relies on the in-site oracle pages.

- `/atlas` and `/atlas/*` hard-redirect to `mandalacodes.com/atlas`. The atlas implementation was removed from Adrian-Website on 2026-05-23 (PR #111 + #112).

- A bunch of pre-launch code work shipped in March-April 2026 (PiecePage redesign, lightbox, share, breadcrumbs, accessibility, focus states, shared `formatPrice`, etc.). Pre-cleanup snapshot is preserved at [docs/claude-tasks-archive-2026-05.md](docs/claude-tasks-archive-2026-05.md) for the record.

- The Cloudinary pipeline is built end-to-end. `utils/cloudinary.ts` handles responsive srcSet automatically; `ArtImage.tsx` accepts both `publicId` (Cloudinary) and `src` (plain URL); ArtImage has a styled fallback for missing images.

- The cart system and checkout flow are already built. Stripe webhooks for fulfillment notifications are wired (see `docs/oracle-accounts-implementation.md` for the per-file detail). Cart persists via localStorage.
