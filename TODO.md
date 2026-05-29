# TODO: Adrian-Website

Living list of outstanding work on the artist portfolio + shop. See `CLAUDE.md` for the project's intent and constraints.

## Soon

### Recent decisions to watch

- [ ] Decide whether to strip Bali from the About bio and Writings stories _(band: you-required)_ _(effort: moderate)_
- [ ] Watch the SEO ranking shift over the next month after removing Bali _(band: you-required)_ _(effort: moderate)_

## Pre-launch

### Adrian-only: blocks launch

- [ ] Commit the staged Bali-to-studio wording change (8 files already edited, on their own branch) _(band: you-required)_ _(effort: quick)_
- [ ] Review the stray planning doc in the working tree and decide whether to keep or delete it _(band: you-required)_ _(effort: quick)_ → File: [docs/phase-2-mandala-split.md](docs/phase-2-mandala-split.md)
- [ ] Photograph the site and the artworks _(band: you-required)_ _(effort: deep)_ → Plan: [photography.md](todo/plans/photography.md)
- [ ] Turn the shop on: Stripe, pricing, env vars, and launch content _(band: you-required)_ _(effort: deep)_ → Plan: [shop-launch.md](todo/plans/shop-launch.md)

### Claude-side: code bugs to fix before shop launch

- [ ] Fix the piece configurator before the shop launches (three bugs) _(band: agent-runnable)_ _(effort: deep)_ → Plan: [configurator-fixes.md](todo/plans/configurator-fixes.md)

### Claude-side: needs Adrian's content before it can ship

- [ ] Build the shipping policy page once the policy content is written _(band: agent-runnable)_ _(effort: moderate)_

### Oracle accounts branch: decision pending

- [ ] Decide what happens to the oracle accounts branch _(band: you-required)_ _(effort: deep)_ → Plan: [oracle-accounts-decision.md](todo/plans/oracle-accounts-decision.md)

## Future

### Shop launch

- [ ] Flip the shop on once Stripe price IDs are real _(band: you-required)_ _(effort: deep)_ → Plan: [shop-launch.md](todo/plans/shop-launch.md)

### Mandala Codes split

- [ ] Remove the leftover in-site oracle code once mandalacodes is sale-ready and redirects are proven _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/phase-2-mandala-split.md](docs/phase-2-mandala-split.md)

### First week after launch

- [ ] Build the Finishes and Options modal (needs Adrian's images and illumination demo videos) _(band: you-required)_ _(effort: moderate)_
- [ ] Add an "Available Now" section to the Creations landing page _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Add rate limiting on the checkout endpoint _(band: you-required)_ _(effort: moderate)_
- [ ] Build the post-purchase confirmation page (needs Adrian's tone and copy) _(band: you-required)_ _(effort: moderate)_
- [ ] Review the Cloudflare Web Analytics dashboard _(band: you-required)_ _(effort: quick)_
- [ ] Build the newsletter welcome sequence in Kit (3 emails: welcome, story, invitation) _(band: you-required)_ _(effort: moderate)_

### First month after launch

- [ ] Build dedicated category pages for Jewelry, Oracle Cards, Tables, Installations, Objects, Spaces (Adrian writes intros, Claude builds) _(band: agent-runnable)_ _(effort: deep)_
- [ ] Build category-specific and series-specific filters per spec _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Build a mobile bottom-sheet filter overlay for small screens _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Build the mobile two-tap hero grid (tap reveals name, tap again navigates) _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Build the "See What's Possible" modal as a full-screen overlay on mobile _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Flesh out the "Objects" category descriptions (sphere holders, incense, dimensional pieces) _(band: you-required)_ _(effort: moderate)_
- [ ] Publish at least one more Writings piece in The Path _(band: you-required)_ _(effort: moderate)_
- [ ] Review the SEO keyword strategy (Claude drafts, Adrian approves) _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Add conversion tracking for inquiries and completed purchases _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Add a cookie consent mechanism if needed for GDPR/CCPA _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Cross-browser testing across Safari, Firefox, Chrome, and mobile browsers _(band: you-required)_ _(effort: moderate)_
- [ ] Run a full accessibility audit (color contrast, screen reader, keyboard navigation) _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Add Teajia integration points (Spaces page, Tables page, spatial commissions in Inquire) _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Add route-based code splitting and self-host Google Fonts _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Decide where the newsletter signup lives _(band: you-required)_ _(effort: quick)_
- [ ] Add friendly error-state messaging _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Motion polish: cart drawer swipe-to-close, page transitions, pause the background when offscreen _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Image performance: blur-up placeholders, responsive images, targeted re-renders _(band: agent-runnable)_ _(effort: moderate)_

### Optional polish (Claude-side, non-blocking)

- [ ] Surface the Save-to-Collection button on artwork pages and Store cards _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Thread configurator state through the cart sync if configured options ship in the cart _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Lazy-load the sign-in SDK so the home page bundle stays light while accounts are off _(band: agent-runnable)_ _(effort: quick)_
- [ ] Expand the cities index from a fresh GeoNames extract _(band: agent-runnable)_ _(effort: quick)_

### PiecePage / Store design improvements

- [ ] Work through the 50 PiecePage and Store design suggestions from the April 2026 audit _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/piece-page-design-audit.md](docs/piece-page-design-audit.md)

### Architecture, AI, and SEO roadmap

- [ ] Repair the verification baseline so typecheck, tests, and build all pass _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] Build a central route metadata registry feeding sitemap and page SEO from one source _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] Consolidate Universal Language card metadata into one source for names, images, canonicals, and OG pages _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] Rebuild the content model around validated source data split into domain modules _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] Add JSON-LD structured data across the site (Person, VisualArtwork, CollectionPage, Article, ImageObject, BreadcrumbList) _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] Build the mandala search-growth cluster (collection page, artwork descriptions, supporting writings, image SEO) _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] Set up crawl and index hygiene (robots policy, AI crawler decisions, sitemap from launch flags) _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] Decompose the oversized feature components (UniversalLanguageCard, PiecePage, Store, Inquire) _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)

### Image workflow

- [ ] Replace placeholder photos with real artwork imagery once photos are prepped and uploaded to Cloudinary _(band: you-required)_ _(effort: deep)_ → Plan: [docs/IMAGE-WORKFLOW-PLAN.md](docs/IMAGE-WORKFLOW-PLAN.md)

### Larger features (no commitment yet)

- [ ] Re-add the featured creations, Selected Works, and Available Now homepage sections _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Add global site search _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Add a Recently Viewed pieces strip (localStorage) _(band: agent-runnable)_ _(effort: quick)_
- [ ] Add a day-vs-night comparison slider for Illuminated Works _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Build a pricing explorer tool with sliders for size and finish _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Add a currency selector for international visitors _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Add progressive-web-app capabilities (service worker plus manifest) _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Add a print stylesheet for collectors _(band: agent-runnable)_ _(effort: quick)_
- [ ] Add a Save for Later wishlist _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Add a Notify Me option for sold-out pieces _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Re-enable the custom laser-cut frame add-on once pricing is set _(band: you-required)_ _(effort: moderate)_
- [ ] Add Apple Pay and Google Pay express checkout _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Add a made-to-order deposit structure (50% upfront, 50% on completion) _(band: you-required)_ _(effort: moderate)_
- [ ] Add order lifecycle features: abandoned cart recovery, order tracking, Stripe inventory sync, real-time edition counts _(band: agent-runnable)_ _(effort: deep)_
- [ ] Deepen SEO metadata: per-artwork share images, more structured data, per-category meta descriptions _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Add quality infrastructure: end-to-end tests, error monitoring, heat mapping _(band: agent-runnable)_ _(effort: deep)_
- [ ] Migrate content to a headless CMS when the data file becomes unmaintainable _(band: agent-runnable)_ _(effort: deep)_
- [ ] Migrate images to Cloudflare Images if outgrowing the Cloudinary free tier _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Add route-level error boundaries and infinite scroll for the Store _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Set up a backup strategy for content, images, and order data _(band: you-required)_ _(effort: moderate)_
- [ ] Add NFT documentation for legacy pieces and QR codes on physical plaques _(band: you-required)_ _(effort: moderate)_
- [ ] Larger experiences: virtual tours, commission client portal, events calendar, press section, process videos _(band: you-required)_ _(effort: deep)_

## Operational notes (not TODOs: context for future-you)

- The QR Function at `functions/qr/[number].js` redirects scanned plaques to `mandalacodes.com/universal-language/:n`. Treat it as permanent infrastructure, printed plaques out in the world depend on it.

- Oracle code (`OracleGateway`, `UniversalLanguageCard`, oracle data files, vite OG plugin) was intentionally left in place when mandalacodes split off. It can be removed in a future PR after the redirect has been live long enough to confirm no traffic relies on the in-site oracle pages.

- `/atlas` and `/atlas/*` hard-redirect to `mandalacodes.com/atlas`. The atlas implementation was removed from Adrian-Website on 2026-05-23 (PR #111 + #112).

- A bunch of pre-launch code work shipped in March-April 2026 (PiecePage redesign, lightbox, share, breadcrumbs, accessibility, focus states, shared `formatPrice`, etc.). Pre-cleanup snapshot is preserved at [docs/claude-tasks-archive-2026-05.md](docs/claude-tasks-archive-2026-05.md) for the record.

- The Cloudinary pipeline is built end-to-end. `utils/cloudinary.ts` handles responsive srcSet automatically; `ArtImage.tsx` accepts both `publicId` (Cloudinary) and `src` (plain URL); ArtImage has a styled fallback for missing images.

- The cart system and checkout flow are already built. Stripe webhooks for fulfillment notifications are wired (see `docs/oracle-accounts-implementation.md` for the per-file detail). Cart persists via localStorage.
