# TODO: Adrian-Website

Living list of outstanding work on the artist portfolio + shop. See `CLAUDE.md` for the project's intent and constraints. Each item is a cold-start work surface: the title says what it is, the sub-line says why + done-when, and links carry the detail.

## Soon

- [ ] Give "When Poetry Becomes Sound" a picture, if you want one _(band: you-required | effort: quick)_
  It is the only writing with no `image:` field, so its card renders as text alone. That now looks deliberate rather than broken (the frame is omitted, not left empty), so this is optional. Add one to `content/stories/when-poetry-becomes-sound.md` if the piece deserves a picture.

- [ ] Answer "where does this ship from and how long does it take" per piece, before the shop can ever open _(band: you-required | effort: deep)_
  The shop stays OFF on purpose. Decided 2026-09-02: stock sits in several places, some pieces ship from Bali and some from the US, many are made to order, so shipping cost and lead time depend on the piece, the size and the buyer's location. A cart cannot answer that; a conversation can. "Request to Purchase" leading into the enquiry form is the intended path, not a shortfall — and the enquiry already carries piece, price, size, add-ons and availability across, so the conversation opens with the facts in hand. Nothing is blocked on code: `scripts/stripe-sync-prices.ts` will create all 291 prices whenever the logistics question has an answer, and nothing has been created in Stripe yet. The real work here is the inventory model, not the checkout.
  Smallest useful step, if it helps the direct conversations: the catalog has no field for where a piece lives, so no page can say "ships from Bali, allow three weeks" and every enquiry starts by asking. Adding an origin and lead-time field per piece would take that question off your plate without opening a cart.

- [ ] Photograph detail shots: only 31 of 173 pieces have one _(band: you-required | effort: deep)_
  141 sellable pieces have a single cover shot and nothing else. For layered, carved work sold at four figures, the detail shot is the argument — depth, edge, the way light sits in the cuts. The piece page already renders a thumbnail strip and a lightbox, so this is a camera job, not a build one. Order by what the missing photo costs: Mystics Journey - Framed ($9,000) and Path of the Ordinary ($4,000) are both Ready to Ship with zero detail images, then the three $1,111 pieces and the four at $969. Metamorphosis ($9,000) and We Rise ($5,000) already have 3 and 5, so the bar is set.

- [ ] 72 pieces share a description with another piece _(band: you-required | effort: deep)_
  Four paragraphs cover 72 of the 173 pieces. One paragraph ("Mandalas are an expression of infinite awareness…") is on 42 pieces; the crystal-stand paragraph is on 21; the "As the mind quiets and the pencil flows…" paragraph is on 7; one more is on 2. Now that every page carries its own meta description, those 72 pages present duplicate text to search engines and to any reader who opens two of them. The 7-piece group also had a wrong material field, corrected to "Laser Cut Wood, Acrylic" to match what its own description says. The words are yours. Highest value first: the 8 most expensive pieces with a shared description are Mystics Journey - Framed ($9,000), Path of the Ordinary ($4,000), Communion and Communion - Gold, Blue, Red and Rise Of The Buffalo ($1,111 each), then Creation Unfolding, Winged Spirit Wood and Circle Of Existance - Blue ($969 each).

- [ ] Decide the six launch flags that are still dark _(band: you-required | effort: quick)_
  `furniture`, `installations`, `spaces`, `aboutMeaning`, `pricingExplorer` and `livingLegacy` are all still false. Each is either close to shipping or dead weight, and the code for all of them is carried on every build either way. A decision each, then ship or delete.

- [x] A test asserts a cron schedule that was deliberately removed _(band: agent-runnable | effort: quick)_
  `tests/collector-letter-schedule.test.ts` already asserts the deliberate absence of the `schedule:` block (and that the workflow's own explanation is still there); confirmed green on a clean checkout, nothing left to change.

- [ ] Look at how the 173 undrawn collector screens sit on a desktop screen _(band: you-required | effort: quick)_
  The design file draws one screen for a desk (the piece page) and 173 for a phone only. Rather than invent a desktop layout nobody approved, the ground now fills the screen and the words hold a 520 column inside it, which is the same rule the one desk drawing states. It is live and unreviewed. Open the review link, press "Use it", and say whether the column is right. → Back end: Workshop → Screen development system
- [ ] Put the full-screen collector display on the page a plate actually opens _(band: agent-runnable | effort: deep)_
  The full-screen display exists and is live, but only reachable at `/collector?frame=full`. The address an engraved plate lands on is still the older, separate page. Moving that page onto the collector body is the pass the shell's own header names as next, and it was deliberately not started while the look was still settling.
- [ ] Let the screenshot browser run without switching the safety sandbox off _(band: agent-runnable | effort: moderate)_
  Chromium fails to start under the sandbox: it registers a private service and the sandbox denies it. The existing allowance covers finding a service, not registering one, which is a different permission and may not be exposed as a setting at all. Every screenshot and push this session ran with the sandbox off as a workaround. Likely fix: excuse the browser test commands from the sandbox by name.

- [ ] Finish the remaining registry activation steps _(band: you-required | effort: moderate)_
  The auto-deploy is fixed and verified: a push to main built and deployed on its own on 2026-08-21, and the built site was confirmed to carry the new work. Still open from the original item: Google Drive sync, the missing `STRIPE_WEBHOOK_SECRET`, and the proof-before-engraving gate. → Detail: [registry-activation-checklist.md](docs/registry-activation-checklist.md)
  For a release that also needs a production backup and migrations, run `awgolive`, which does both around the deploy.
- [ ] **Walk the collector click-through and settle the open wording.** _(band: you-required)_ The collector journey is wired to the live registry end to end and the registration ceremony, Piece Records, continuity archive, and Successor's Handbook are built, all dark behind `livingLegacy`. The three wording proposals from 2026-08-12 are settled (passing A, household A, both arrival leans) and being wired in. Done when every box in the checklist is walked, the remaining wording items are settled, and you say the flag can flip. → Gate: [collector-click-through-checklist.md](docs/collector-click-through-checklist.md) · Walkthrough: [collector-walkthrough-guide.md](docs/collector-walkthrough-guide.md) · Master: [collector-screen-wording.md](todo/plans/collector-screen-wording.md)
- [ ] **Collector journey later passes.** _(band: agent-runnable)_ Next-wave items: the safe pending-passing backend (email read-back, verified-account acceptance, 30-day expiry, sender-cancellable), plate permanence plus the elevated-claim override, giver's gift-wishes store, guardian-lit child model, per-person birthday windows, collaborator accounts, region floor backend, real household data model with names and relations (blocks approval pair, succession store, household words on page), links visibility backend, letters authoring, video capture UI, the interface inversion, seeding What-shows lamps from stored state on revisit, and heirs changeable after first placement. → Master: [collector-screen-wording.md](todo/plans/collector-screen-wording.md) · Chart: [collector-flow-chart.html](todo/plans/collector-flow-chart.html)
  Design and wording for the passing/plate mechanics, and the deferred What-shows redesign, live in the workbook's Part 2 and Part 3: [collector-wording-workbook.md](todo/plans/collector-wording-workbook.md)
- [ ] Record and refine what each artwork is made of, who made it, where it was made, and its wording _(band: you-required | effort: deep)_ → Spec: [the-collector-journey.md](todo/plans/the-collector-journey.md)
  The certificate editor now provides reusable templates with per-artwork overrides. Fill the desired factual fields gradually; incomplete entries stay hidden until then.
- [ ] **Finish the artwork registry rollout and handover.** _(band: you-required)_ The Register an artwork ceremony at `/admin/register` (plate optional, everything additive after), the fabrication-only wizard, the desk, Piece Records with the continuity archive, the Successor's Handbook, and the one-passkey custody envelope are built. Remaining work is yours: fill the handbook's custody placeholder lines, create the custody envelope offline (`npx tsx scripts/custody-envelope.ts create`), seal the passkey on paper away from the files, run the catalog-snapshot backfill (`npx tsx scripts/backfill-catalog-snapshots.ts`) once against production, approve the plate design in Illustrator, and run the non-production canary. → Plan: [artwork-registry-finish-and-handover.md](todo/plans/artwork-registry-finish-and-handover.md) · Guide: [registry-custodian-guide.md](docs/registry-custodian-guide.md)
- [ ] Check the register ceremony is not stretched on a wide screen _(band: you-required | effort: quick)_
  On a wide desk the registration card grew to fill the space, leaving the words at the top and the button at the bottom with a gap between them. You said this was fixed in another branch, but no open pull request or unmerged branch on the remote contains it, so it may still be sitting in a session that never pushed. Worth opening the page once to see which is true.
- [x] The registry's own reference guide has never heard of Piece Records _(band: agent-runnable | effort: quick)_
  `docs/registry-master-reference.md` now documents Piece Records, the piece-records archive, the capped rebuild, and the succession page, cross-checked against the actual code.
- [ ] The collector journey is on the live site while the checklist says it is not _(band: you-required | effort: quick)_
  `/collector` is routed unconditionally, so the half-built review journey is reachable on adrianrasmussen.com by anyone who types the address. Nothing links to it and nothing there is real, but the click-through checklist tells you it opens in dev builds only, which is not true. Either gate the route or correct the sentence.
- [ ] Delete or merge the leftover deploy-scripts branch _(band: you-required | effort: quick)_
  `claude/collector-piece-flow-design-szc3vs` is the only branch not merged into main. It holds a pinned wrangler version and self-serve deploy and migration scripts, and it has been waiting on a Cloudflare token since 2026-08-20. The `awgolive` script now covers the same ground, so this is probably a delete rather than a merge.
- [x] The old todo folder still has a readme that lies _(band: agent-runnable | effort: quick)_
  `todo/README.md` is deleted; the plan docs in `todo/plans/` are untouched.
- [ ] Give the permanent record a door on the collector journey too _(band: agent-runnable | effort: quick)_
  A collector who scans a plate can now reach the file written to outlive the site, but only on the pre-launch page. Once the Living Legacy flag is on, scans route past it to the newer arrival screens, which have no link to the record at all. That surface belongs to another session, so the link needs adding there before the flag flips.
- [x] Cap or page the bulk record rebuild before the registry gets large _(band: agent-runnable | effort: quick)_
  `POST /api/admin/records/rebuild` now returns a capped page (`RECORDS_REBUILD_BATCH_LIMIT`) plus `hasMore`/`nextCursor`, and the desk's "Rebuild all records" pages through automatically; covered by `tests/records-rebuild-paging.test.ts`.
- [x] Settle what red becomes on the dark desk _(band: agent-runnable | effort: quick)_
  The delete/remove controls across `AdminFileUpload`, `AdminBookEditor`, `AdminPoetry`, and `AdminInvoices` now use the desk's existing `#e0a08a` "wrong" tone instead of Tailwind red.
- [ ] Find a piece by who holds it _(band: agent-runnable | effort: moderate)_
  Searching the registry works by code, title, artwork or edition number. There is no way to search by the collector, which is often the only thing you remember. This never existed; it is new work, not a regression.
- [ ] **Enter historical verified sales.** _(band: you-required)_ After the private workspace is rolled out, add known buyer emails, dates, private prices, artwork mappings, pictures, and optional creator messages gradually. Unknown artworks may remain email-only reconnection cases until Adrian and the collector identify them together.

### Recent decisions to watch

- [ ] **Bali in bio** — decide whether to strip Bali from the About bio and Writings stories _(you · moderate)_
  The no-business-location SEO rule applies to marketing copy, but the bio and stories are autobiographical and exempt, so this is a judgment call rather than a rule. Done when you decide keep-or-strip and the About + Writings copy reflects it.
- [ ] **SEO watch** — track the search ranking shift over the next month after removing Bali _(you · moderate)_
  Bali was removed from business-facing copy, so confirm rankings hold rather than drop. Done when a month of Search Console data is reviewed and the call to keep or revert is made.

## Pre-launch

- [ ] **Rerun the broad browser smoke gate with network access.** _(band: routine)_ The Phase 3 desktop and mobile journeys pass, but ten existing site-wide smoke checks logged `net::ERR_INTERNET_DISCONNECTED` for external resources. Rerun them in an online browser environment before rollout.

### Adrian-only: blocks launch

- [ ] **Collector registry rollout rehearsal.** _(band: you-required)_ Run the ownership damage detector against a fresh read-only production copy, then rehearse migration and encrypted restore on copies.
  The reusable local foundation has a passing baseline, but the collector presentation is still being reconciled with the master. The journey intentionally remains off. Done when integration is verified, the detector finds no damaged ownership state, migration and clean restore including the private media manifest succeed on copies, required production bindings are confirmed, the letter runner secret and disabled-by-default schedule are configured, and a canary proves the journey can be enabled without seeding or changing production during rehearsal.
  **Progress 2026-08-19:** detector run clean on fresh production copies before and after; the full migration (through 034) rehearsed clean on copies and then **applied to production** (unblocking the public Atlas, which was down). Pre-apply export saved. Still open from this item: encrypted restore rehearsal incl. private media manifest, letter runner secret + disabled schedule, and the enable-journey canary.
  **Progress 2026-08-20:** city-floor removal (migration 035) rehearsed and applied to production per Adrian's ruling; curated cities seeded (98, incl. Ubud/Tulum/Sayulita) and catalog roster seeded (173) — live feed now serves the full field. First claim ceremony still lights the first marker.
- [ ] **Collector facts and verified-sale review.** _(band: you-required)_ Add the real materials and wording for each artwork, then review historical sale facts and exact artwork links in the verified-sales workspace.
  Missing certificate facts stay hidden and can be filled gradually. Verified sales and artwork-level price history are built locally as the canonical record, while source facts still need Adrian's confirmation before production rollout.

- [ ] **Commit Bali edits** — commit the staged Bali-to-studio wording change (8 files already edited, on their own branch) _(you · quick)_
  The edits exist on a branch but aren't committed, so they're invisible until you commit. Done when the branch is committed and merged.
- [ ] **Stray doc** — review the untracked planning doc in the working tree and decide whether to keep or delete it _(you · quick)_
  An untracked phase-2 doc sits in the tree; decide if it's still wanted. Done when it's kept (committed) or deleted. → File: [docs/phase-2-mandala-split.md](docs/phase-2-mandala-split.md)
- [ ] **Photography** — photograph the site and the artworks _(you · deep)_
  Real photography replaces placeholders before launch, and the shop can't look credible without it. Done when every live piece has real imagery shot and prepped. → Plan: [photography.md](todo/plans/photography.md)
- [ ] **Shop launch** — turn the shop on: Stripe, pricing, env vars, and launch content _(you · deep)_
  The shop is gated off because all Stripe price IDs are `price_REPLACE` placeholders, so real products and keys are needed to sell. Done when real prices are set, env vars are in place, the `shopEnabled` flag is flipped, and a test purchase succeeds. → Plan: [shop-launch.md](todo/plans/shop-launch.md)
- [ ] **Pricing tool: apply migration** — create the D1 tables for the pricing calculator _(you · quick)_
  Run `npx wrangler d1 migrations apply adrian-website --remote`. Until then the tools fall back to local cache/defaults. → Doc: [docs/pricing-tool.md](docs/pricing-tool.md)
- [ ] **Pricing tool: tune the model** — calibrate anchors and multipliers against real pieces at `/admin/pricing` _(you · moderate)_
  The defaults are plan estimates; no real art-pricing data was available to calibrate. Load real pieces, set Settings to match your intuition, save pieces to Reference with their actual prices, and recenter. → Doc: [docs/pricing-tool.md](docs/pricing-tool.md)
- [ ] **Pricing tool: flip the explorer on** — make the public Pricing Explorer live once the model reads true _(you · quick)_
  Set `LAUNCH_FLAGS.pricingExplorer` to `true`. It lives on the Multidimensional Art page. → Doc: [docs/pricing-tool.md](docs/pricing-tool.md)
### Adrian-only: backend security pass (waiting on you to verify before it goes live)

- [ ] **Backend security hardening** — review, verify, and merge the open security pass, and rotate the live Stripe key _(you · deep)_
  A 47-file hardening of sign-in, abuse limits, and payment handling is built and waiting in an open request, but it was only syntax-checked, never run, and it touches live payments — so it can't go live unverified. Rotate the live Stripe key regardless (a key was exposed). Then build it, smoke-test sign-in + checkout + a payment notification, and merge or discard. The request also carries a few stray local cache files to drop before merge. Done when the Stripe key is rotated, the pass is verified working, and it's merged or dropped. → Request: open PR #124 on Adrian-Website (`claude/optimistic-albattani-0cou9s`)

### Adrian-only: the art-sale → atlas sale bridge (corrected 2026-09-08 — the shared-secret step below is stale, do not do it)

> This item used to say "set `SALE_WEBHOOK_SECRET` and the oracle side is already configured." That was wrong: mandalacodes moved the Atlas collector record to this site on 2026-08-09, and its middleware (`functions/api/atlas/_middleware.ts`) now answers every non-read request — including the sale webhook this site posted to — with 410 `atlas_moved` (probed live 2026-09-08). The webhook retried three times and gave up silently, so setting the secret would have signed a request nothing was listening for. The same middleware also blocks GET `/api/atlas/sales`, so the mandalacodes admin's Pending Sales list has been unreachable too, independent of anything here.
>
> Fixed 2026-09-08: the Stripe webhook (`functions/api/stripe/webhook.js`) now writes the pending sale directly into `atlas_sale_events` in this site's own D1 (the same physical database mandalacodes' admin queue always read via a shared binding) instead of calling out over HTTP. No secret, no network call, no retries — a same-process D1 insert either lands or it doesn't, and Stripe's own webhook retries cover that case. Proven by `tests/atlas-sale-pending.test.ts` (feeds the handler a fake signed `checkout.session.completed` event, no Stripe call, asserts the pending row exists, asserts idempotency, asserts no network call is made).

- [ ] **Nothing displays the pending sale queue anywhere yet** — build the missing viewer _(you decide, agent runs · moderate)_
  The row lands in D1 correctly, but no page reads it: mandalacodes' `/admin/atlas` → Pending Sales is 410'd by its own middleware regardless of this fix, and this site has no equivalent admin surface yet. Until one exists, check by hand: `wrangler d1 execute adrian-website --remote --command "SELECT sale_id, buyer_email, sale_date, status FROM atlas_sale_events WHERE status = 'pending' ORDER BY received_at DESC"`. This is the same gap named as B2 ("my pieces" surface) in `mandalacodes/todo/plans/overarching-plan.md` — build it there rather than as a one-off here.
- [ ] **Flip `livingLegacy` after walking the collector journey once behind the flag** — the actual remaining switch _(you · quick)_
  Not the shared secret — that step is gone. `LAUNCH_FLAGS.livingLegacy` on this site is what makes registration, claim, and the intention ritual visible to a real collector; the sale bridge fixed above works whether the flag is on or off (it only enqueues an admin-review row). Flip it once you're satisfied the D1 hand-off manual check above matches a real test purchase.

### Claude-side: code bugs to fix before shop launch

- [ ] **Configurator bugs** — fix the piece configurator before the shop launches (three bugs) _(agent · deep)_
  The size/finish configurator has three known bugs that would break the buy flow. Done when all three are fixed and the configurator round-trips into the cart correctly. → Plan: [configurator-fixes.md](todo/plans/configurator-fixes.md)

### Claude-side: needs Adrian's content before it can ship

- [ ] **Shipping page** — build the shipping policy page once the policy content is written _(agent · moderate)_
  A shipping policy page is legally and UX expected at checkout, but it's blocked on your written policy copy. Done when copy is supplied and the page is built and linked from checkout/footer.

### Oracle accounts branch: decision pending

- [ ] **Oracle branch:** decide what happens to the old oracle accounts branch _(you · deep)_
  This branch predates the completed Better Auth migration, so its account work may now be redundant. Done when you decide to merge, salvage, or close it. → Plan: [oracle-accounts-decision.md](todo/plans/oracle-accounts-decision.md)

## Future

### Modernize the site + make it interactive

- [ ] **Modernize site** — explore modernizing the website and new ways to interact with it, including having i64os know the art business the way it knows the tea business _(you · deep)_
  Not yet shaped: the old HTTP "integration contract" approach is retired (archived at `i64os/_archive/adrian-website-int/`, kept only for its clean data shape of piece / edition / writing / inquiry / customer / order), and the live way is MCP, as Teajia uses. Done when a `/shape` session defines what "modern + interactive" means and whether i64os reading the art business is in scope.

### Shop launch

- [ ] **Flip shop on** — turn the shop on once Stripe price IDs are real _(you · deep)_
  Duplicate-facing reminder of the pre-launch shop item: the shop stays hidden until real Stripe prices replace the placeholders. Done when `shopEnabled` is true with real prices and a test sale clears. → Plan: [shop-launch.md](todo/plans/shop-launch.md)

### Mandala Codes split

- [ ] **Remove oracle code** — delete the leftover in-site oracle code once mandalacodes is sale-ready and redirects are proven _(agent · deep)_
  Oracle components and data were left in place during the split, and can be deleted once the redirects to mandalacodes have run long enough to confirm no traffic relies on them. Done when redirects are verified stable and the dead oracle code is removed in a PR. → Plan: [docs/phase-2-mandala-split.md](docs/phase-2-mandala-split.md)

### First week after launch

- [ ] **Finishes modal** — build the Finishes and Options modal _(you · moderate)_
  This shows collectors the finish/illumination options on a piece, and is blocked on your images plus illumination demo videos. Done when assets are supplied and the modal renders on piece pages.
- [ ] **Available Now** — add an "Available Now" section to the Creations landing page _(agent · moderate)_
  This surfaces in-stock pieces so buyers see what they can purchase immediately. Done when the section renders the currently-available pieces on /creations.
- [ ] **Checkout rate limit** — add rate limiting on the checkout endpoint _(you · moderate)_
  This protects the Stripe checkout Function from abuse and spam once the shop is live. Done when the checkout endpoint rejects excessive requests per IP.
- [ ] **Confirmation page** — build the post-purchase confirmation page _(you · moderate)_
  This is the page a buyer lands on after paying, and is blocked on your tone and copy. Done when copy is supplied and the page shows after a successful Stripe checkout.
- [ ] **Analytics check** — review the Cloudflare Web Analytics dashboard _(you · quick)_
  Confirm analytics are recording real traffic post-launch. Done when you've checked the dashboard shows live data.
- [ ] **Newsletter welcome** — build the newsletter welcome sequence in Kit (3 emails: welcome, story, invitation) _(you · moderate)_
  This onboards new subscribers and needs your voice across three emails. Done when the three-email sequence is live in Kit and triggers on signup.

### First month after launch

- [ ] **Category pages** — build dedicated category pages for Jewelry, Oracle Cards, Tables, Installations, Objects, Spaces _(agent · deep)_
  Each top-level category needs its own landing page; you write intros, Claude builds. Done when all six category pages exist with your intro copy.
- [ ] **Category filters** — build category-specific and series-specific filters per spec _(agent · moderate)_
  This lets visitors filter creations within a category or series. Done when filters work on the category and subcategory pages per the spec.
- [ ] **Mobile filter sheet** — build a mobile bottom-sheet filter overlay for small screens _(agent · moderate)_
  The desktop filter UI doesn't fit mobile, and a bottom-sheet is the mobile pattern. Done when filters open as a bottom sheet on small screens.
- [ ] **Two-tap hero** — build the mobile two-tap hero grid (tap reveals name, tap again navigates) _(agent · moderate)_
  This lets mobile users preview a piece's name before committing to navigate. Done when the hero grid uses the two-tap interaction on mobile.
- [ ] **Possible modal** — render the "See What's Possible" modal as a full-screen overlay on mobile _(agent · moderate)_
  An existing modal is cramped on mobile, and full-screen makes it usable. Done when the modal renders full-screen on small viewports.
- [ ] **Objects copy** — flesh out the "Objects" category descriptions (sphere holders, incense, dimensional pieces) _(you · moderate)_
  The Objects category lacks real descriptive copy. Done when each Objects sub-type has finished description copy.
- [ ] **New Writing** — publish at least one more Writings piece in The Path _(you · moderate)_
  This keeps the Writings section alive and feeds SEO, and needs your authored piece. Done when a new Writings entry is published.
- [ ] **SEO keywords** — review the SEO keyword strategy (Claude drafts, Adrian approves) _(agent · moderate)_
  This aligns page copy and meta to the keywords worth ranking for. Done when Claude drafts the strategy and you approve it.
- [ ] **Conversion tracking** — add conversion tracking for inquiries and completed purchases _(agent · moderate)_
  This measures how many visitors inquire or buy, so marketing has signal. Done when inquiry and purchase events fire into analytics.
- [ ] **Cookie consent** — add a cookie consent mechanism if needed for GDPR/CCPA _(agent · moderate)_
  This is a legal requirement if analytics or marketing cookies are used for EU/CA visitors. Done when a consent banner gates non-essential cookies, or it's confirmed not needed.
- [ ] **Cross-browser test** — test across Safari, Firefox, Chrome, and mobile browsers _(you · moderate)_
  This catches rendering and behavior bugs before real buyers hit them. Done when the key flows are verified across the four browsers.
- [ ] **A11y audit** — run a full accessibility audit (color contrast, screen reader, keyboard navigation) _(agent · moderate)_
  This ensures the site is usable for everyone and avoids a11y legal risk. Done when an audit runs and P0/P1 issues are fixed.
- [ ] **Teajia links** — add Teajia integration points (Spaces page, Tables page, spatial commissions in Inquire) _(agent · moderate)_
  This cross-links the art site to Teajia where spatial and furniture work overlaps. Done when the named pages link or embed the Teajia touchpoints.
- [ ] **Code splitting** — add route-based code splitting and self-host Google Fonts _(agent · moderate)_
  This shrinks the initial bundle and removes a third-party font request for speed and privacy. Done when routes lazy-load and fonts are self-hosted.
- [ ] **Signup placement** — decide where the newsletter signup lives _(you · quick)_
  A placement decision (footer, modal, dedicated page) gates building it. Done when you pick the location.
- [ ] **Error messaging** — add friendly error-state messaging _(agent · moderate)_
  This replaces raw or empty error states with on-brand messaging. Done when the main failure paths show friendly copy.
- [ ] **Motion polish** — cart drawer swipe-to-close, page transitions, pause the background when offscreen _(agent · moderate)_
  These are small motion refinements that make the site feel finished and save battery. Done when the three named interactions are implemented.
- [ ] **Image performance** — blur-up placeholders, responsive images, targeted re-renders _(agent · moderate)_
  This gives faster perceived load and less layout shift on image-heavy pages. Done when images blur-up, serve responsive sizes, and avoid needless re-renders.

### Optional polish (Claude-side, non-blocking)

- [ ] **Save button** — surface the Save-to-Collection button on artwork pages and Store cards _(agent · moderate)_
  The collections feature exists but the save button isn't shown where users browse. Done when the button appears on piece pages and Store cards for signed-in users.
- [ ] **Configurator sync** — thread configurator state through the cart sync if configured options ship in the cart _(agent · moderate)_
  This keeps a piece's chosen size and finish attached to it through the synced cart. Done when configured options persist in the cart across devices.
- [ ] **Cities index** — expand the cities index from a fresh GeoNames extract _(agent · quick)_
  The birth-location city picker uses a limited city list, and a fresh extract widens coverage. Done when the cities index is regenerated from current GeoNames data.

### PiecePage / Store design improvements

- [ ] **Design audit** — work through the 50 PiecePage and Store design suggestions from the April 2026 audit _(agent · deep)_
  A 50-item design audit catalogued concrete improvements to the two highest-traffic commerce pages. Done when the audit items are triaged and the accepted ones shipped. → Plan: [docs/piece-page-design-audit.md](docs/piece-page-design-audit.md)

### Architecture, AI, and SEO roadmap

- [ ] **Verify baseline** — repair the verification baseline so typecheck, tests, and build all pass _(agent · moderate)_
  A clean tsc/test/build baseline is the precondition for safely doing the rest of this roadmap. Done when all three pass green. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] **Metadata registry** — build a central route metadata registry feeding sitemap and page SEO from one source _(agent · deep)_
  SEO meta and sitemap are currently scattered, and one registry stops them drifting apart. Done when sitemap and per-page meta both read from the single registry. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] **UL metadata source** — consolidate Universal Language card metadata into one source for names, images, canonicals, and OG pages _(agent · deep)_
  UL piece data is duplicated across surfaces, risking mismatched names, images, and canonicals. Done when all UL surfaces read from one metadata source. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] **Content model** — rebuild the content model around validated source data split into domain modules _(agent · deep)_
  The single `mockData.ts` is becoming unmaintainable, and domain modules with validation scale better. Done when content is split into validated domain modules. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] **JSON-LD schema** — add JSON-LD structured data across the site (Person, VisualArtwork, CollectionPage, Article, ImageObject, BreadcrumbList) _(agent · deep)_
  Structured data helps search engines and AI crawlers understand the art catalogue. Done when the named schema types are emitted on the right pages and validate. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] **Mandala cluster** — build the mandala search-growth cluster (collection page, artwork descriptions, supporting writings, image SEO) _(agent · deep)_
  This is a coordinated content cluster to grow mandala-related search traffic. Done when the cluster's pages, descriptions, and image SEO are published. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] **Crawl hygiene** — set up crawl and index hygiene (robots policy, AI crawler decisions, sitemap from launch flags) _(agent · moderate)_
  This controls what search and AI crawlers index, and keeps the sitemap honest to launch flags. Done when robots and sitemap reflect the intended index policy. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)
- [ ] **Decompose components** — break up the oversized feature components (UniversalLanguageCard, PiecePage, Store, Inquire) _(agent · deep)_
  These components are too large to maintain or test safely. Done when each is broken into smaller, testable pieces without behavior change. → Plan: [docs/ARCHITECTURE_AI_SEO_ROADMAP.md](docs/ARCHITECTURE_AI_SEO_ROADMAP.md)

### Image workflow

- [ ] **Real imagery** — replace placeholder photos with real artwork imagery once photos are prepped and uploaded to Cloudinary _(you · deep)_
  Placeholders remain across the site; real imagery is needed before launch and depends on the photography task. Done when every live piece shows its real Cloudinary image. → Plan: [docs/IMAGE-WORKFLOW-PLAN.md](docs/IMAGE-WORKFLOW-PLAN.md)

### Larger features (no commitment yet)

- [ ] **Homepage sections** — re-add the featured creations, Selected Works, and Available Now homepage sections _(agent · moderate)_
  These are homepage merchandising sections that were removed; bring them back when content's ready. Done when the three sections render with real content.
- [ ] **Site search** — add global site search _(agent · moderate)_
  This lets visitors find pieces and writings directly. Done when a search box returns relevant results across content types.
- [ ] **Recently Viewed** — add a Recently Viewed pieces strip (localStorage) _(agent · quick)_
  This helps returning browsers pick up where they left off. Done when recently viewed pieces show from localStorage.
- [ ] **Day/night slider** — add a day-vs-night comparison slider for Illuminated Works _(agent · moderate)_
  This shows the lit vs unlit state that makes Illuminated Works special. Done when a before/after slider works on those pieces.
- [x] **Pricing explorer** — built. Internal quoting calculator at `/admin/pricing` (size, layers, finish, crystals, lighting, frame, climate, projection, design value, margin; fully tunable settings; calibration reference tab) plus a customer-facing range tool sharing the same engine (`utils/pricing/*`). Public explorer is gated behind `LAUNCH_FLAGS.pricingExplorer` until the model is tuned against real pieces.
- [ ] **Currency selector** — add a currency selector for international visitors _(agent · moderate)_
  This shows prices in the visitor's currency to reduce friction. Done when prices convert and display in the chosen currency.
- [ ] **PWA support** — add progressive-web-app capabilities (service worker plus manifest) _(agent · moderate)_
  This enables install-to-home-screen and an offline shell. Done when the site is installable with a working manifest and service worker.
- [ ] **Print stylesheet** — add a print stylesheet for collectors _(agent · quick)_
  This lets collectors print a clean piece page. Done when a print stylesheet produces a tidy printout.
- [ ] **Wishlist** — add a Save for Later wishlist _(agent · moderate)_
  This lets buyers bookmark pieces they're not ready to purchase. Done when items can be saved to and removed from a wishlist.
- [ ] **Notify Me** — add a Notify Me option for sold-out pieces _(agent · moderate)_
  This captures demand on sold-out work for restocks and editions. Done when visitors can leave their email on a sold-out piece.
- [ ] **Frame add-on** — re-enable the custom laser-cut frame add-on once pricing is set _(you · moderate)_
  This is a frame upsell that's disabled pending price decisions. Done when pricing is set and the add-on is re-enabled.
- [ ] **Express wallets** — add Apple Pay and Google Pay express checkout _(agent · moderate)_
  One-tap wallets reduce checkout friction. Done when both wallets work in Stripe checkout.
- [ ] **Deposit structure** — add a made-to-order deposit structure (50% upfront, 50% on completion) _(you · moderate)_
  Commission pieces need split payments, and this needs your pricing and policy call. Done when the deposit flow is defined and built.
- [ ] **Order lifecycle** — add abandoned cart recovery, order tracking, Stripe inventory sync, and real-time edition counts _(agent · deep)_
  This is the post-purchase and inventory machinery a real shop needs as volume grows. Done when the four named capabilities are live.
- [ ] **Deeper SEO meta** — add per-artwork share images, more structured data, and per-category meta descriptions _(agent · moderate)_
  Richer metadata improves search and social sharing. Done when artworks and categories carry the deeper metadata.
- [ ] **Quality infra** — add end-to-end tests, error monitoring, and heat mapping _(agent · deep)_
  This catches regressions and reveals how visitors actually use the site. Done when e2e tests run in CI and monitoring/heatmaps report live.
- [ ] **Headless CMS** — migrate content to a headless CMS when the data file becomes unmaintainable _(agent · deep)_
  `mockData.ts` won't scale forever, and a CMS lets non-devs edit content. Done when content is served from a CMS and the data file is retired.
- [ ] **Cloudflare Images** — migrate images to Cloudflare Images if outgrowing the Cloudinary free tier _(agent · moderate)_
  This is a cost and scale fallback if Cloudinary's free tier is exceeded. Done when images serve from Cloudflare Images with no visible regression.
- [ ] **Store boundaries** — add route-level error boundaries and infinite scroll for the Store _(agent · moderate)_
  This isolates per-route failures and smooths browsing a large catalogue. Done when routes have error boundaries and the Store paginates by scroll.
- [ ] **Backup strategy** — set up a backup strategy for content, images, and order data _(you · moderate)_
  This protects against data loss once real orders exist. Done when a documented, tested backup runs on a schedule.
- [ ] **Bigger surfaces** — virtual tours, commission client portal, events calendar, press section, process videos _(you · deep)_
  This is a parking lot of bigger future surfaces, none yet scoped. Done when any one is picked up and shaped into its own item.

## Operational notes (not TODOs: context for future-you)

- The QR Function at `functions/qr/[number].js` is a universal redirect: numbers 1-64 go to mandalacodes.com oracle cards, "oracle" goes to the oracle deck home, everything else goes to `/works/:code` on this domain. Treat it as permanent infrastructure: printed plaques and engraved QR codes in the wild depend on it. Rules, routing, and the full registry of issued codes live in `data/qrRegistry.ts`. Max code length: 11 characters (keeps QR at Version 3, 29x29 grid). The private index at `/qr` shows every registered code.

- Oracle code (`OracleGateway`, `UniversalLanguageCard`, oracle data files, vite OG plugin) was intentionally left in place when mandalacodes split off. It can be removed in a future PR after the redirect has been live long enough to confirm no traffic relies on the in-site oracle pages.

- `/atlas` and `/atlas/*` hard-redirect to `mandalacodes.com/atlas`. The atlas implementation was removed from Adrian-Website on 2026-05-23 (PR #111 + #112).

- A bunch of pre-launch code work shipped in March-April 2026 (PiecePage redesign, lightbox, share, breadcrumbs, accessibility, focus states, shared `formatPrice`, etc.). Pre-cleanup snapshot is preserved at [docs/claude-tasks-archive-2026-05.md](docs/claude-tasks-archive-2026-05.md) for the record.

- The Cloudinary pipeline is built end-to-end. `utils/cloudinary.ts` handles responsive srcSet automatically; `ArtImage.tsx` accepts both `publicId` (Cloudinary) and `src` (plain URL); ArtImage has a styled fallback for missing images.

- The cart system and checkout flow are already built. Stripe webhooks for fulfillment notifications are wired (see `docs/oracle-accounts-implementation.md` for the per-file detail). Cart persists via localStorage.

- Accounts/login: both sites use Better Auth and the same D1 database, so one person has one account row and one birth-details row across both sites.
