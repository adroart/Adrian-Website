# TODO: Adrian-Website

Living list of outstanding work on the artist portfolio + shop. See `CLAUDE.md` for the project's intent and constraints. Each item is a cold-start work surface: the title says what it is, the sub-line says why + done-when, and links carry the detail.

## Soon

### Recent decisions to watch

- [ ] Decide whether to strip Bali from the About bio and Writings stories _(band: you-required)_ _(effort: moderate)_
  - What & why: a no-business-location SEO rule applies to marketing copy, but the bio/stories are autobiographical and exempt — so this is a judgment call, not a rule. · Done when: you decide keep-or-strip and the About + Writings copy reflects it.
- [ ] Watch the SEO ranking shift over the next month after removing Bali _(band: you-required)_ _(effort: moderate)_
  - What & why: Bali was removed from business-facing copy; confirm rankings hold rather than drop. · Done when: a month of Search Console data is reviewed and the call to keep/revert is made.

## Pre-launch

### Adrian-only: blocks launch

- [ ] Commit the staged Bali-to-studio wording change (8 files already edited, on their own branch) _(band: you-required)_ _(effort: quick)_
  - What & why: the edits exist on a branch but aren't committed, so they're invisible until you commit. · Done when: the branch is committed and merged.
- [ ] Review the stray planning doc in the working tree and decide whether to keep or delete it _(band: you-required)_ _(effort: quick)_
  - What & why: an untracked phase-2 doc sits in the tree; decide if it's still wanted. · Done when: kept (committed) or deleted. → File: [docs/phase-2-mandala-split.md](docs/phase-2-mandala-split.md)
- [ ] Photograph the site and the artworks _(band: you-required)_ _(effort: deep)_
  - What & why: real photography replaces placeholders before launch; the shop can't look credible without it. · Done when: every live piece has real imagery shot and prepped. → Plan: [photography.md](todo/plans/photography.md)
- [ ] Turn the shop on: Stripe, pricing, env vars, and launch content _(band: you-required)_ _(effort: deep)_
  - What & why: shop is gated off because all Stripe price IDs are `price_REPLACE` placeholders; real products + keys are needed to sell. · Done when: real prices set, env vars in place, `shopEnabled` flag flipped, a test purchase succeeds. → Plan: [shop-launch.md](todo/plans/shop-launch.md)
- [ ] Take Clerk login to production for real users: rotate the exposed secret, add the 5 DNS records, finish Google OAuth, then Claude wires the live keys _(band: you-required)_ _(effort: deep)_
  - What & why: shared dev login is live; production needs its own keys/DNS, and the pasted `sk_live_` must be rotated for safety. · Done when: DNS verified, Google OAuth set, prod keys wired, a real sign-up lands a D1 row on the live site. → Plan: [clerk-production-launch.md](todo/plans/clerk-production-launch.md)

### Claude-side: code bugs to fix before shop launch

- [ ] Fix the piece configurator before the shop launches (three bugs) _(band: agent-runnable)_ _(effort: deep)_
  - What & why: the size/finish configurator has three known bugs that would break the buy flow. · Done when: all three are fixed and the configurator round-trips into the cart correctly. → Plan: [configurator-fixes.md](todo/plans/configurator-fixes.md)

### Claude-side: needs Adrian's content before it can ship

- [ ] Build the shipping policy page once the policy content is written _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: a shipping policy page is legally/UX expected at checkout, but it's blocked on your written policy copy. · Done when: copy is supplied and the page is built and linked from checkout/footer.

### Oracle accounts branch: decision pending

- [ ] Decide what happens to the oracle accounts branch _(band: you-required)_ _(effort: deep)_
  - What & why: an older oracle-accounts branch predates the shared-Clerk work that just shipped; it may now be partly redundant. · Done when: you decide to merge, salvage, or close it. → Plan: [oracle-accounts-decision.md](todo/plans/oracle-accounts-decision.md)

## Future

### Modernize the site + make it interactive

- [ ] Explore modernizing the website and new ways to interact with it, including having i64os know the art business the way it knows the tea business _(band: you-required)_ _(effort: deep)_
  - What & why: not yet shaped. The old HTTP "integration contract" approach is retired (archived at `i64os/_archive/adrian-website-int/`, kept only for its clean data shape: piece / edition / writing / inquiry / customer / order); the live way is MCP, as Teajia uses. · Done when: a `/shape` session defines what "modern + interactive" means and whether i64os reading the art business is in scope.

### Shop launch

- [ ] Flip the shop on once Stripe price IDs are real _(band: you-required)_ _(effort: deep)_
  - What & why: duplicate-facing reminder of the pre-launch shop item — the shop stays hidden until real Stripe prices replace the placeholders. · Done when: `shopEnabled` is true with real prices and a test sale clears. → Plan: [shop-launch.md](todo/plans/shop-launch.md)

### Mandala Codes split

- [ ] Remove the leftover in-site oracle code once mandalacodes is sale-ready and redirects are proven _(band: agent-runnable)_ _(effort: deep)_
  - What & why: oracle components/data were left in place during the split; they can be deleted once the redirects to mandalacodes have run long enough to confirm no traffic relies on them. · Done when: redirects verified stable and the dead oracle code is removed in a PR. → Plan: [docs/phase-2-mandala-split.md](docs/phase-2-mandala-split.md)

### First week after launch

- [ ] Build the Finishes and Options modal _(band: you-required)_ _(effort: moderate)_
  - What & why: shows collectors the finish/illumination options on a piece; blocked on your images + illumination demo videos. · Done when: assets supplied and the modal renders on piece pages.
- [ ] Add an "Available Now" section to the Creations landing page _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: surfaces in-stock pieces so buyers see what they can purchase immediately. · Done when: the section renders the currently-available pieces on /creations.
- [ ] Add rate limiting on the checkout endpoint _(band: you-required)_ _(effort: moderate)_
  - What & why: protects the Stripe checkout Function from abuse/spam once the shop is live. · Done when: the checkout endpoint rejects excessive requests per IP.
- [ ] Build the post-purchase confirmation page _(band: you-required)_ _(effort: moderate)_
  - What & why: the page a buyer lands on after paying; blocked on your tone + copy. · Done when: copy supplied and the page shows after a successful Stripe checkout.
- [ ] Review the Cloudflare Web Analytics dashboard _(band: you-required)_ _(effort: quick)_
  - What & why: confirm analytics are recording real traffic post-launch. · Done when: you've checked the dashboard shows live data.
- [ ] Build the newsletter welcome sequence in Kit (3 emails: welcome, story, invitation) _(band: you-required)_ _(effort: moderate)_
  - What & why: onboards new subscribers; needs your voice across three emails. · Done when: the three-email sequence is live in Kit and triggers on signup.

### First month after launch

- [ ] Build dedicated category pages for Jewelry, Oracle Cards, Tables, Installations, Objects, Spaces _(band: agent-runnable)_ _(effort: deep)_
  - What & why: each top-level category needs its own landing page; you write intros, Claude builds. · Done when: all six category pages exist with your intro copy.
- [ ] Build category-specific and series-specific filters per spec _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: lets visitors filter creations within a category/series. · Done when: filters work on the category + subcategory pages per the spec.
- [ ] Build a mobile bottom-sheet filter overlay for small screens _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: the desktop filter UI doesn't fit mobile; a bottom-sheet is the mobile pattern. · Done when: filters open as a bottom sheet on small screens.
- [ ] Build the mobile two-tap hero grid (tap reveals name, tap again navigates) _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: lets mobile users preview a piece's name before committing to navigate. · Done when: the hero grid uses the two-tap interaction on mobile.
- [ ] Build the "See What's Possible" modal as a full-screen overlay on mobile _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: an existing modal that's cramped on mobile; full-screen makes it usable. · Done when: the modal renders full-screen on small viewports.
- [ ] Flesh out the "Objects" category descriptions (sphere holders, incense, dimensional pieces) _(band: you-required)_ _(effort: moderate)_
  - What & why: the Objects category lacks real descriptive copy. · Done when: each Objects sub-type has finished description copy.
- [ ] Publish at least one more Writings piece in The Path _(band: you-required)_ _(effort: moderate)_
  - What & why: keeps the Writings section alive and feeds SEO; needs your authored piece. · Done when: a new Writings entry is published.
- [ ] Review the SEO keyword strategy (Claude drafts, Adrian approves) _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: aligns page copy/meta to the keywords worth ranking for. · Done when: Claude drafts the strategy and you approve it.
- [ ] Add conversion tracking for inquiries and completed purchases _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: measures how many visitors inquire/buy, so marketing has signal. · Done when: inquiry + purchase events fire into analytics.
- [ ] Add a cookie consent mechanism if needed for GDPR/CCPA _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: legal requirement if analytics/marketing cookies are used for EU/CA visitors. · Done when: a consent banner gates non-essential cookies (or it's confirmed not needed).
- [ ] Cross-browser testing across Safari, Firefox, Chrome, and mobile browsers _(band: you-required)_ _(effort: moderate)_
  - What & why: catches rendering/behavior bugs before real buyers hit them. · Done when: the key flows are verified across the four browsers.
- [ ] Run a full accessibility audit (color contrast, screen reader, keyboard navigation) _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: ensures the site is usable for everyone and avoids a11y legal risk. · Done when: an audit runs and P0/P1 issues are fixed.
- [ ] Add Teajia integration points (Spaces page, Tables page, spatial commissions in Inquire) _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: cross-links the art site to Teajia where spatial/furniture work overlaps. · Done when: the named pages link/embed the Teajia touchpoints.
- [ ] Add route-based code splitting and self-host Google Fonts _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: shrinks the initial bundle and removes a third-party font request for speed + privacy. · Done when: routes lazy-load and fonts are self-hosted.
- [ ] Decide where the newsletter signup lives _(band: you-required)_ _(effort: quick)_
  - What & why: placement decision (footer, modal, dedicated page) gates building it. · Done when: you pick the location.
- [ ] Add friendly error-state messaging _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: replaces raw/empty error states with on-brand messaging. · Done when: the main failure paths show friendly copy.
- [ ] Motion polish: cart drawer swipe-to-close, page transitions, pause the background when offscreen _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: small motion refinements that make the site feel finished and save battery. · Done when: the three named interactions are implemented.
- [ ] Image performance: blur-up placeholders, responsive images, targeted re-renders _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: faster perceived load and less layout shift on image-heavy pages. · Done when: images blur-up, serve responsive sizes, and avoid needless re-renders.

### Optional polish (Claude-side, non-blocking)

- [ ] Surface the Save-to-Collection button on artwork pages and Store cards _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: the collections feature exists but the save button isn't shown where users browse. · Done when: the button appears on piece pages + Store cards for signed-in users.
- [ ] Thread configurator state through the cart sync if configured options ship in the cart _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: keeps a piece's chosen size/finish attached to it through the synced cart. · Done when: configured options persist in the cart across devices.
- [ ] Lazy-load the sign-in SDK so the home page bundle stays light while accounts are off _(band: agent-runnable)_ _(effort: quick)_
  - What & why: the Clerk SDK adds weight even when sign-in isn't shown; defer it. · Done when: the home page bundle no longer eagerly loads Clerk.
- [ ] Expand the cities index from a fresh GeoNames extract _(band: agent-runnable)_ _(effort: quick)_
  - What & why: the birth-location city picker uses a limited city list; a fresh extract widens coverage. · Done when: the cities index is regenerated from current GeoNames data.

### PiecePage / Store design improvements

- [ ] Work through the 50 PiecePage and Store design suggestions from the April 2026 audit _(band: agent-runnable)_ _(effort: deep)_
  - What & why: a 50-item design audit catalogued concrete improvements to the two highest-traffic commerce pages. · Done when: the audit items are triaged and the accepted ones shipped. → Plan: [docs/piece-page-design-audit.md](docs/piece-page-design-audit.md)

### Architecture, AI, and SEO roadmap

- [ ] Repair the verification baseline so typecheck, tests, and build all pass _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: a clean tsc/test/build baseline is the precondition for safely doing the rest of this roadmap. · Done when: all three pass green. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] Build a central route metadata registry feeding sitemap and page SEO from one source _(band: agent-runnable)_ _(effort: deep)_
  - What & why: SEO meta + sitemap are currently scattered; one registry stops them drifting apart. · Done when: sitemap and per-page meta both read from the single registry. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] Consolidate Universal Language card metadata into one source for names, images, canonicals, and OG pages _(band: agent-runnable)_ _(effort: deep)_
  - What & why: UL piece data is duplicated across surfaces, risking mismatched names/images/canonicals. · Done when: all UL surfaces read from one metadata source. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] Rebuild the content model around validated source data split into domain modules _(band: agent-runnable)_ _(effort: deep)_
  - What & why: the single `mockData.ts` is becoming unmaintainable; domain modules with validation scale better. · Done when: content is split into validated domain modules. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] Add JSON-LD structured data across the site (Person, VisualArtwork, CollectionPage, Article, ImageObject, BreadcrumbList) _(band: agent-runnable)_ _(effort: deep)_
  - What & why: structured data helps search engines and AI crawlers understand the art catalogue. · Done when: the named schema types are emitted on the right pages and validate. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] Build the mandala search-growth cluster (collection page, artwork descriptions, supporting writings, image SEO) _(band: agent-runnable)_ _(effort: deep)_
  - What & why: a coordinated content cluster to grow mandala-related search traffic. · Done when: the cluster's pages, descriptions, and image SEO are published. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] Set up crawl and index hygiene (robots policy, AI crawler decisions, sitemap from launch flags) _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: controls what search/AI crawlers index, and keeps the sitemap honest to launch flags. · Done when: robots + sitemap reflect the intended index policy. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] Decompose the oversized feature components (UniversalLanguageCard, PiecePage, Store, Inquire) _(band: agent-runnable)_ _(effort: deep)_
  - What & why: these components are too large to maintain or test safely. · Done when: each is broken into smaller, testable pieces without behavior change. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)

### Image workflow

- [ ] Replace placeholder photos with real artwork imagery once photos are prepped and uploaded to Cloudinary _(band: you-required)_ _(effort: deep)_
  - What & why: placeholders remain across the site; real imagery is needed before launch and depends on the photography task. · Done when: every live piece shows its real Cloudinary image. → Plan: [docs/IMAGE-WORKFLOW-PLAN.md](docs/IMAGE-WORKFLOW-PLAN.md)

### Larger features (no commitment yet)

- [ ] Re-add the featured creations, Selected Works, and Available Now homepage sections _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: homepage merchandising sections that were removed; bring them back when content's ready. · Done when: the three sections render with real content.
- [ ] Add global site search _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: lets visitors find pieces/writings directly. · Done when: a search box returns relevant results across content types.
- [ ] Add a Recently Viewed pieces strip (localStorage) _(band: agent-runnable)_ _(effort: quick)_
  - What & why: helps returning browsers pick up where they left off. · Done when: recently viewed pieces show from localStorage.
- [ ] Add a day-vs-night comparison slider for Illuminated Works _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: shows the lit vs unlit state that makes Illuminated Works special. · Done when: a before/after slider works on those pieces.
- [ ] Build a pricing explorer tool with sliders for size and finish _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: lets buyers see how size/finish change price before inquiring. · Done when: the sliders compute live prices.
- [ ] Add a currency selector for international visitors _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: shows prices in the visitor's currency to reduce friction. · Done when: prices convert and display in the chosen currency.
- [ ] Add progressive-web-app capabilities (service worker plus manifest) _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: enables install-to-home-screen and offline shell. · Done when: the site is installable with a working manifest + service worker.
- [ ] Add a print stylesheet for collectors _(band: agent-runnable)_ _(effort: quick)_
  - What & why: lets collectors print a clean piece page. · Done when: a print stylesheet produces a tidy printout.
- [ ] Add a Save for Later wishlist _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: lets buyers bookmark pieces they're not ready to purchase. · Done when: items can be saved to and removed from a wishlist.
- [ ] Add a Notify Me option for sold-out pieces _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: captures demand on sold-out work for restocks/editions. · Done when: visitors can leave their email on a sold-out piece.
- [ ] Re-enable the custom laser-cut frame add-on once pricing is set _(band: you-required)_ _(effort: moderate)_
  - What & why: a frame upsell that's disabled pending price decisions. · Done when: pricing is set and the add-on is re-enabled.
- [ ] Add Apple Pay and Google Pay express checkout _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: one-tap wallets reduce checkout friction. · Done when: both wallets work in Stripe checkout.
- [ ] Add a made-to-order deposit structure (50% upfront, 50% on completion) _(band: you-required)_ _(effort: moderate)_
  - What & why: commission pieces need split payments; needs your pricing/policy call. · Done when: the deposit flow is defined and built.
- [ ] Add order lifecycle features: abandoned cart recovery, order tracking, Stripe inventory sync, real-time edition counts _(band: agent-runnable)_ _(effort: deep)_
  - What & why: the post-purchase/inventory machinery a real shop needs as volume grows. · Done when: the four named capabilities are live.
- [ ] Deepen SEO metadata: per-artwork share images, more structured data, per-category meta descriptions _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: richer metadata improves search + social sharing. · Done when: artworks/categories carry the deeper metadata.
- [ ] Add quality infrastructure: end-to-end tests, error monitoring, heat mapping _(band: agent-runnable)_ _(effort: deep)_
  - What & why: catches regressions and reveals how visitors actually use the site. · Done when: e2e tests run in CI and monitoring/heatmaps report live.
- [ ] Migrate content to a headless CMS when the data file becomes unmaintainable _(band: agent-runnable)_ _(effort: deep)_
  - What & why: `mockData.ts` won't scale forever; a CMS lets non-devs edit content. · Done when: content is served from a CMS and the data file is retired.
- [ ] Migrate images to Cloudflare Images if outgrowing the Cloudinary free tier _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: a cost/scale fallback if Cloudinary's free tier is exceeded. · Done when: images serve from Cloudflare Images with no visible regression.
- [ ] Add route-level error boundaries and infinite scroll for the Store _(band: agent-runnable)_ _(effort: moderate)_
  - What & why: isolates per-route failures and smooths browsing a large catalogue. · Done when: routes have error boundaries and the Store paginates by scroll.
- [ ] Set up a backup strategy for content, images, and order data _(band: you-required)_ _(effort: moderate)_
  - What & why: protects against data loss once real orders exist. · Done when: a documented, tested backup runs on a schedule.
- [ ] Populate the works registry as pieces are engraved/printed _(band: you-required)_ _(effort: moderate)_
  - What & why: each physical piece's QR code must be registered in `data/qrRegistry.ts` or its plaque won't resolve; provenance events come later when the model supports them. · Done when: every issued QR is registered. → File: [data/qrRegistry.ts](data/qrRegistry.ts)
- [ ] Larger experiences: virtual tours, commission client portal, events calendar, press section, process videos _(band: you-required)_ _(effort: deep)_
  - What & why: a parking lot of bigger future surfaces, none yet scoped. · Done when: any one is picked up and shaped into its own item.

## Operational notes (not TODOs: context for future-you)

- The QR Function at `functions/qr/[number].js` is a universal redirect: numbers 1-64 go to mandalacodes.com oracle cards, "oracle" goes to the oracle deck home, everything else goes to `/works/:code` on this domain. Treat it as permanent infrastructure: printed plaques and engraved QR codes in the wild depend on it. Rules, routing, and the full registry of issued codes live in `data/qrRegistry.ts`. Max code length: 11 characters (keeps QR at Version 3, 29x29 grid). The private index at `/qr` shows every registered code.

- Oracle code (`OracleGateway`, `UniversalLanguageCard`, oracle data files, vite OG plugin) was intentionally left in place when mandalacodes split off. It can be removed in a future PR after the redirect has been live long enough to confirm no traffic relies on the in-site oracle pages.

- `/atlas` and `/atlas/*` hard-redirect to `mandalacodes.com/atlas`. The atlas implementation was removed from Adrian-Website on 2026-05-23 (PR #111 + #112).

- A bunch of pre-launch code work shipped in March-April 2026 (PiecePage redesign, lightbox, share, breadcrumbs, accessibility, focus states, shared `formatPrice`, etc.). Pre-cleanup snapshot is preserved at [docs/claude-tasks-archive-2026-05.md](docs/claude-tasks-archive-2026-05.md) for the record.

- The Cloudinary pipeline is built end-to-end. `utils/cloudinary.ts` handles responsive srcSet automatically; `ArtImage.tsx` accepts both `publicId` (Cloudinary) and `src` (plain URL); ArtImage has a styled fallback for missing images.

- The cart system and checkout flow are already built. Stripe webhooks for fulfillment notifications are wired (see `docs/oracle-accounts-implementation.md` for the per-file detail). Cart persists via localStorage.

- Accounts/login: shared Clerk app + shared D1 (`adrian-website`) with mandalacodes.com — one collector identity across both sites, dev login live as of 2026-06-09. Production launch is tracked in Pre-launch above. No Clerk Pro / no paid satellite (each site gets its own free prod instance on the same DB).
