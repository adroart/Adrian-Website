# 12-Month SEO And AI Search Execution Plan

Last updated: 2026-05-20

## Goal

Make Adrian Rasmussen discoverable and citable for Mandala, original Mandala art, sacred geometry Mandala art, laser-cut wood art, layered wood art, and related commission searches.

## Strategic Ladder

1. Win narrow, high-fit terms first.
2. Build topical authority across Mandala, sacred geometry, and laser-cut wood art.
3. Build image visibility from individual artwork pages.
4. Build entity authority through off-site mentions.
5. Move gradually toward broad terms such as `mandala art`, `sacred geometry art`, and `laser cut art`.

## Current Site Baseline

Local archive:

- 173 artworks.
- 42 Mandala artworks.
- 33 available Mandala artworks.
- 129 laser-cut wood artworks.
- 120 available laser-cut wood artworks.

Main technical gaps found before this implementation pass:

- Route metadata was split across multiple files and updated client-side.
- `/shop` appeared in the sitemap even though the shop is disabled.
- No dedicated Laser-Cut Wood Art hub existed.
- Mandala collection copy was too thin for the target term.
- Individual Mandala pages included one repeated description across ten pieces. This was corrected during this pass.
- Artwork image metadata could be stronger.
- Sitemap did not include image entries.

## Work Completed In This Pass

Implemented now:

- Created `utils/seoMetadata.ts` as the central route metadata registry.
- Updated `useSeoMeta.ts` to use the central metadata registry.
- Added `/creations/laser-cut-wood-art`.
- Added `components/LaserCutWoodArtPage.tsx`.
- Added Laser-Cut Wood Art to the Creations landing page.
- Added a link to Laser-Cut Wood Art from the Multidimensional Art page.
- Strengthened Mandala collection metadata and visible content.
- Added Mandala `CollectionPage` schema.
- Added Laser-Cut Wood Art `CollectionPage` schema.
- Added `ImageObject` schema to artwork pages.
- Added Mandala and laser-cut wood alt text helpers.
- Rewrote ten duplicated Mandala artwork descriptions so all 42 Mandala pages now have unique descriptions.
- Updated sitemap generation to use route metadata and launch flags.
- Removed disabled `/shop` from generated sitemap while `shopEnabled` is false.
- Added image sitemap entries inside `public/sitemap.xml`.
- Added `scripts/validate-seo.ts`.
- Added `npm run seo:check`.
- Added static route HTML generation for 196 routes during `npm run build`.
- Added generated per-route title, description, canonical, Open Graph, and Twitter metadata for priority routes and artwork pages.
- Added global `WebSite` schema in `index.html`.
- Strengthened global and About-page `Person` schema around Mandala, sacred geometry, laser-cut wood art, and layered wooden sculpture.
- Strengthened About-page visible copy with Mandala, sacred geometry, and laser-cut wood language.
- Added Playwright coverage for the Mandala and Laser-Cut Wood Art SEO routes.
- Added internal links from eligible artwork pages to the Laser-Cut Wood Art hub.
- Saved research files under `docs/research/seo/`.

Verification already run:

- `npm run seo:check`
- `npm run typecheck`
- `npm run build`
- `npx playwright test tests/e2e.spec.ts -g "SEO page" --project=chromium --reporter=list`
- `git diff --check`

Domain note:

- `https://adrianrasmussen.com` is the permanent canonical domain and is used by existing schema, robots, QR links, functions, generated route HTML, and generated sitemap.
- If another domain is used later, it should redirect to `https://adrianrasmussen.com` rather than becoming canonical.

## Month 1, Technical Foundation

Objective: Make the site technically legible to Google and AI retrieval systems.

Completed now:

- Central route metadata registry.
- Mandala route metadata.
- Laser-Cut Wood Art route metadata.
- Sitemap generated from metadata and launch flags.
- Image entries in sitemap.
- Artwork `ImageObject` schema.
- Mandala `CollectionPage` schema.
- Laser-Cut Wood Art route and `CollectionPage` schema.

Completed now:

- Added global `WebSite` schema.
- Strengthened `Person` schema in `index.html` and `components/About.tsx`.
- Added visible About-page language for sacred geometry, mandala art, laser-cut wood art, and multidimensional wooden sculpture.
- Added static route HTML generation so high-value route metadata exists in built HTML before React hydrates.
- Added a validation check that requires route HTML and sitemap generation in the production build.

Remaining work:

- Add a release check that validates public route metadata in built HTML.
- Keep `Article` schema on writing pages aligned with generated story data.
- Add automated checks for Universal Language art-series versus oracle route separation.

Recommended command sequence after future changes:

```bash
npm run seo:check
npm run typecheck
npm run sitemap
npm run build
```

## Month 2, Mandala Hub

Objective: Make `/creations/multidimensional-art/mandala` a serious answer for original Mandala art.

Completed now:

- Stronger Mandala title and description.
- Visible section explaining original Mandala art in layered laser-cut wood.
- Structured facts for primary search, technique, availability, and commission path.
- `CollectionPage` and `BreadcrumbList` schema.

Remaining work:

- Add internal links from Mandala page to at least three future writings.
- Add a more explicit commission section after the artwork grid.
- Add a short material/process section with photos or process images.
- Add a visible "available Mandala artworks" filter state link from Inquire or About.

## Month 3, Individual Mandala Artwork Pages

Objective: Make every Mandala page unique, useful, and image-search eligible.

Original issue:

- 10 Mandala pieces shared one repeated description.

Affected titles:

- Green Gold
- Blue gold
- Red gold
- Blue White
- Blue-pink-white
- Brown Gold
- Green
- Green-blue-gold
- Midnight Sunrise - Black Gold
- Red

Completed now:

- All 42 Mandala pieces have unique descriptions.
- The ten duplicate descriptions were replaced with conservative, title-specific copy using color, material, process, and Mandala series language.

Recommended next improvements for each Mandala:

- One unique paragraph about the visible pattern and color.
- One unique paragraph about process, materials, crystal, or construction.
- Dimensions.
- Material.
- Year.
- Availability.
- Series link back to Mandala.
- Inquiry link.
- Alt text matching the pattern in `utils/artworkFilters.ts`.

Example description pattern:

```text
[Title] is an original mandala artwork by Adrian Rasmussen, created through layered laser-cut wood, sacred geometry, and hand-finished surface work. The piece uses [color/material/crystal detail] to create a field of [visual quality], inviting attention toward the center of the form.
```

## Month 4, First Article Cluster

Objective: Build first-hand content that supports both search rankings and AI citations.

Create these writings:

1. `What Is Mandala Art?`
2. `How I Create Laser-Cut Wooden Mandalas`
3. `Sacred Geometry Mandala Art`
4. `Commissioning A Custom Mandala Artwork`

Each article must include:

- A direct answer in the opening section.
- Adrian's first-hand process.
- Links to Mandala hub, Laser-Cut Wood Art hub, Inquire, and relevant artwork pages.
- At least three images.
- Article schema.
- No generic filler.

## Month 5, Laser-Cut Wood Art Hub Expansion

Objective: Use `/creations/laser-cut-wood-art` to compete for material and process terms.

Completed now:

- New route.
- New collection page.
- Internal links to Mandala, Universal Language, and Inquire.
- Structured facts and artwork grid.
- Internal links from eligible artwork pages back to the Laser-Cut Wood Art hub.

Remaining work:

- Add process images or video embeds.
- Add a section explaining the difference between digital precision and hand finishing.
- Add a writing titled `Layered Laser-Cut Wood Art As Sculpture`.

## Month 6, About And Entity Authority

Objective: Make Adrian's entity clear.

Update About page to explicitly support:

- Adrian Rasmussen.
- Multidimensional artist.
- Bali-based artist.
- Sacred geometry artist.
- Mandala artist.
- Laser-cut wood artist.
- Layered wooden sculpture.

Add:

- Stronger `Person` schema.
- SameAs links where real profiles exist.
- Links to Mandala, Laser-Cut Wood Art, Universal Language, and Inquire.

## Month 7, Image Search And Visual Discovery

Objective: Make artwork images work harder.

Actions:

- Confirm all key images have stable Cloudinary public IDs.
- Rename future uploaded assets with descriptive filenames.
- Add captions or nearby text for important images.
- Keep using image sitemap entries.
- Add process images to Mandala and Laser-Cut Wood Art hubs.
- Review Search Console image impressions monthly.

## Month 8, Commission Funnel

Objective: Capture commercial intent.

Build or strengthen:

- Mandala commission section on `/inquire`.
- Laser-cut wood commission section on `/inquire`.
- Inquiry prefill from artwork pages.
- Clear language around custom work, process, timeline, scale, and materials.

Target terms:

- `custom mandala artwork`
- `mandala art commission`
- `custom sacred geometry artwork`
- `laser cut wood commission`

## Month 9, Off-Site Authority

Objective: Build the broader web presence AI systems can recognize.

Publish or update:

- YouTube process videos.
- Pinterest boards and artwork pins.
- Instagram captions with concrete process language.
- Artist directory profiles.
- Bali artist profile.
- Interview pages.
- Gallery or exhibition pages.
- Podcast pages if available.

Every off-site profile should link to the relevant page:

- Mandala content links to `/creations/multidimensional-art/mandala`.
- Laser-cut content links to `/creations/laser-cut-wood-art`.
- Artist bio content links to `/about`.
- Commission content links to `/inquire`.

## Month 10, AI Citation Tracking

Objective: Measure the answer layer directly.

Monthly process:

1. Run the prompt set from `2026-05-20-ai-citation-and-brand-presence-playbook.md`.
2. Save responses in a spreadsheet.
3. Record whether Adrian appears.
4. Record whether adrianrasmussen.com is cited.
5. Record competitors.
6. Record source URLs.
7. Correct inaccurate entity language on the site and off-site profiles.

## Month 11, Consolidation And Refresh

Objective: Improve the pages that are getting impressions but not enough clicks, citations, or inquiries.

Use Search Console to identify:

- Queries with high impressions and low CTR.
- Pages ranking between positions 4 and 20.
- Images with impressions but few visits.
- Mandala or laser-cut queries emerging unexpectedly.

Then update:

- Titles.
- Meta descriptions.
- Opening sections.
- Internal links.
- Images near text.
- Schema if visible facts changed.

## Month 12, Broad-Term Push

Objective: Move from niche wins toward broad category visibility.

Focus terms:

- `mandala art`
- `sacred geometry art`
- `laser cut art`
- `layered wood art`

Actions:

- Publish a definitive Mandala article.
- Publish a definitive Sacred Geometry Art article.
- Publish a definitive Laser-Cut Wood Art process article.
- Pitch interviews or features around Adrian's unique medium.
- Compare AI citation share against the start of the year.
- Decide whether to invest in more content, PR, video, or shop infrastructure.

## Manual Work Adrian Should Do

These require Adrian's voice, access, or real-world relationships:

- Record process videos.
- Approve or write first-hand essays.
- Provide exact commission process details.
- Choose which off-site profiles matter.
- Provide real Stripe data before shop Product schema is enabled.
- Verify exact keyword volumes with Google Search Console, Google Ads Keyword Planner, Ahrefs, or Semrush.
- Review AI answers for accuracy and tone.

## Agent Work That Can Continue Without Adrian

Safe autonomous work:

- Extend Article schema checks for writing pages.
- Add internal links between existing pages.
- Add more validation scripts for SEO rules.
- Add Playwright checks for Mandala and Laser-Cut Wood Art routes.
- Add a release check that reads generated `dist` HTML for priority route metadata.

## 2026-05-22 Update — Research Corpus, Outreach Strategy, And Collaboration Framework

This section was added on 2026-05-22 after a deep-research pass produced a 482-file corpus and a synthesized strategy across writing, press, collaborations, expert participation, and multimedia.

### What now exists

Built and ready to use:

- **Research corpus** in `~/Documents/Obsidian Vault/5 Sources/mandalas/` — 482 markdown files across 20 working subtopics covering all 8 priority SEO targets, historical and cultural depth, artist positioning, and adjacent authority. Master index at `_README.md`.
- **Master plan** at `~/Documents/Obsidian Vault/4 Outputs/mandalas/_master-plan.md` — connects this execution plan with the keyword map, AI citation playbook, the corpus, and the new outreach and collaboration layers into one five-layer plan.
- **Outreach intelligence** at `~/Documents/Obsidian Vault/4 Outputs/mandalas/_outreach-intelligence.md` — six tiers (0-5) of outreach targets surfaced from the corpus's domain frequency, with Tier 1 (Smithsonian, Rubin Museum, Getty, Royal Academy), Tier 2 (Colossal, MyModernMet, Hyperallergic), Tier 3 (invaluable, dailyartmagazine), and the new Tier 0 (peer-artist collaborations).
- **Curated source picks** at `~/Documents/Obsidian Vault/4 Outputs/mandalas/_top-sources-for-writing.md` — the five best sources to read per Month-4 article, filtered from the corpus.
- **Collaboration outreach templates** at `~/Documents/Obsidian Vault/4 Outputs/mandalas/_collaboration-outreach-templates.md` — DM and email templates for each of five collaboration shapes, plus the scoring framework.
- **Collaboration page spec** at `docs/research/seo/2026-05-22-collaboration-page-spec.md` — route, data model, component structure, schema, sitemap integration, and value-capture checklist.
- **Reproducible research pipeline** at `~/builds/mandala-research.sh` — runs Tavily + Firecrawl over any subtopic and writes to the Obsidian vault. Reusable for any future topic, not just mandalas.

### Gaps remaining (blocked on Adrian)

These are real blockers — Claude Code agents cannot proceed without input:

1. **Adrian drops collaboration names.** Instagram handles, URLs, or names with a one-line context for each. Agent then scores them on the five criteria (authority, distinctiveness, niche access, topic credibility, accessibility), assigns a collaboration shape (1-5), and drafts a tailored DM for each.
2. **Adrian provides CV and exhibition history.** Required before any Tier 2 or Tier 1 press pitch goes out. Without it, the press kit is incomplete.
3. **Adrian shoots or compiles process documentation.** Photos and short video of laser-cut → layering → hand-finish. Required for Tier 2 editorial pitches (Colossal, MyModernMet are image-led).
4. **Adrian writes or approves the first-person essays.** "How I Create Laser-Cut Wooden Mandalas" requires Adrian's actual process narrative, not synthesis. Same for "Commissioning A Custom Mandala Artwork" — needs his real timelines, materials, sizes, price ranges, approval steps.
5. **Adrian provides real commission process details.** Pricing tiers, timeline ranges (rough), accepted scopes, lead time, deposit terms.
6. **Adrian decides which existing profiles to claim or build.** Saatchi Art, Artsy, Singulart, Bali gallery directories, Instagram bio, LinkedIn — each needs a decision on whether it's worth the effort.
7. **Adrian reviews AI answers monthly for accuracy and tone.** The 12-prompt set from the AI citation playbook is the measurement layer — needs human judgment, not just automation.

### Gaps remaining (corpus deepening, agent can do)

These are research-only and an agent can fire on demand without Adrian input:

1. **Tibetan Kalachakra mandala** — partially covered under `tibetan-buddhist-mandalas`, but Kalachakra specifically (the most iconographically complex mandala tradition) deserves a targeted top-up.
2. **Islamic geometric patterns** — almost no coverage in the current corpus. Valuable for the "Sacred Geometry Mandala Art" article and as adjacent authority. Trigger: ~5 min, fires `~/builds/mandala-research.sh "Islamic geometric patterns sacred art history"`.
3. **Carl Jung's Red Book and the personal mandala** — the `jungian-mandalas` folder has 28 sources but quality unverified. Worth a focused re-read or top-up with the specific query `Jung Red Book mandala individuation imagery`.
4. **Indus Valley and pre-Vedic origins of the mandala symbol** — partial coverage. Strengthens Article 1's historical anchor.
5. **Mandala iconography (deity placement, colors, directions)** — important for Article 1 depth, partial in `tibetan-buddhist-mandalas`. Worth a focused top-up.
6. **Five empty subtopics from overnight run** — `wood-sculpture-artists` (only 2 sources), `crystal-art-illuminated-sculpture` (0), `ye-ming-zhu-luminous-pearl` (0), `i-ching-art` (0), `gene-keys-archetypes` (0). All four were Tier 4 adjacent topics; not blocking but worth rerunning when Firecrawl credits reset (likely already reset).

### Gaps remaining (assets agent can produce on trigger)

Agent can produce these immediately on Adrian's request:

1. **Press kit bios** at 250 / 500 / 1000 words. Drafts from existing About page material; Adrian voice-passes.
2. **Cold-pitch email templates** for Tier 2 and Tier 3 editorial outlets. One per outlet shape (art editorial, spiritual media, auction-house editorial, museum education).
3. **Pitch tracking sheet** structure — outlet, contact, date sent, follow-up date, response, outcome, lessons. Markdown or Linear project.
4. **Reddit and Quora playbook** — specific subreddits, first 10 Quora questions to target, response templates, do-and-don't list. Partial in chat history, not yet a document.
5. **YouTube video scripts** for the six process videos in the AI citation playbook off-site authority plan.
6. **Pinterest board structure** — board names, descriptions, image-pin SEO conventions, link-back patterns.
7. **Monthly AI citation tracking template** — spreadsheet structure for the 12-prompt set, scored response, source URLs cited.
8. **Article draft of "What Is Mandala Art?"** — agent can produce a first draft from the corpus immediately. Adrian voice-passes; agent then ports to `/writings/what-is-mandala-art`.

## To-Do List — How To Build And Grow

This list is the operational layer. Each item has an owner, a status, and a trigger. Update statuses as work completes.

### Now — Week 1 (highest priority, foundational)

- [ ] **Adrian** — Read [`_top-sources-for-writing.md`](../../../../Documents/Obsidian%20Vault/4%20Outputs/mandalas/_top-sources-for-writing.md). Pick which Month-4 article to start with (recommendation: Article 1, "What Is Mandala Art?").
- [ ] **Adrian** — Open the article's 5 curated sources in Obsidian and read them. Take notes on what's unique, what to cite, what to push against. 2-3 hours.
- [ ] **Agent** — On Adrian's request: produce a first draft of "What Is Mandala Art?" from the corpus. 30-45 min.
- [ ] **Adrian** — Voice-pass the draft. Remove em dashes, add personal perspective, ensure no "wall art" phrasing. 1-2 hours.
- [ ] **Agent** — On Adrian's request: port the finalized draft to `/writings/what-is-mandala-art` with full SEO metadata, Article schema, OG image, sitemap entry, static route HTML. 30-45 min.
- [ ] **Adrian** — Drop collaboration names with Instagram handles or URLs and one-line context per artist.
- [ ] **Agent** — On Adrian's drop: score each artist, assign collaboration shape, draft tailored DM/email. ~30 min.

### Week 2

- [ ] **Adrian** — Send the first 3-5 collaboration DMs from the drafted set.
- [ ] **Adrian** — Read curated sources for Article 3 ("Sacred Geometry Mandala Art").
- [ ] **Agent** — On Adrian's request: draft Article 3 from corpus.
- [ ] **Adrian** — Voice-pass Article 3.
- [ ] **Agent** — Port Article 3 to `/writings/sacred-geometry-mandala-art`.
- [ ] **Agent** — On request: run targeted corpus top-up for Islamic geometric patterns + Jung Red Book + Kalachakra (the three highest-value gaps).

### Weeks 3-4 — Press kit assembly

- [ ] **Agent** — On request: draft 250 / 500 / 1000 word artist bios from existing About content.
- [ ] **Adrian** — Provide CV and exhibition history (typed list, any format).
- [ ] **Adrian** — Compile high-res image library — 10-15 hero images, gallery-style, 3000px minimum.
- [ ] **Adrian** — Shoot or compile process documentation (laser → layering → hand-finish). Photos minimum, short video ideal.
- [ ] **Agent** — On request: build pitch tracking sheet structure (Markdown table or Linear project).
- [ ] **Agent** — On request: draft Tier 3 cold-pitch email templates (one per outlet — invaluable, dailyartmagazine, artzolo, gaia/buddhagroove, rareearthgallerycc).

### Weeks 3-4 — Tier 3 outreach wave

- [ ] **Adrian** — Read and personalize each pitch template. Send to invaluable.com.
- [ ] **Adrian** — Send to dailyartmagazine.com.
- [ ] **Adrian** — Send to artzolo.com (guest contribution angle).
- [ ] **Adrian** — Send to gaia.com or buddhagroove.com (pick one based on alignment).
- [ ] **Adrian** — Send to rareearthgallerycc.com.
- [ ] **Adrian** — Log each in the pitch tracking sheet. Set follow-up reminders for day 10.

### Month 2 — Article cluster completion + Tier 2 outreach

- [ ] **Adrian + Agent** — Article 2 ("How I Create Laser-Cut Wooden Mandalas"). Adrian writes the process narrative; agent integrates corpus context; both iterate.
- [ ] **Adrian + Agent** — Article 4 ("Commissioning A Custom Mandala Artwork"). Adrian provides real commission process details; agent drafts; both iterate.
- [ ] **Agent** — On request: draft Tier 2 pitch templates (Colossal, MyModernMet, Hyperallergic).
- [ ] **Adrian** — Send 3 Tier 2 pitches, citing any Tier 3 wins from previous wave.
- [ ] **Adrian** — Follow up on first collaboration DMs after 10 days.
- [ ] **Agent** — On confirmed collaboration: build `CollaborationPage.tsx` per the [collaboration page spec](2026-05-22-collaboration-page-spec.md). ~3 hours.

### Month 3 — Tier 1 prep + always-on layers begin

- [ ] **Agent** — Identify the right contact email/form at Rubin Museum education arm.
- [ ] **Agent** — Identify the right contact at Asian Art Museum education arm (education.asianart.org).
- [ ] **Agent** — Identify the right contact at Mia (new.artsmia.org) online editorial.
- [ ] **Adrian** — Begin Reddit participation. Pick 3-4 subreddits (r/Art, r/SacredGeometry, r/woodworking, r/buddhism, r/Bali). 2-4 weeks of genuine engagement, no self-promo.
- [ ] **Adrian** — Begin Quora answering. Start with 5 high-traffic questions where current top answers are weak.
- [ ] **Agent** — On request: produce Reddit and Quora playbook document with specific subreddit norms and Quora question targets.

### Months 4-6 — Article cluster expansion + always-on outreach

- [ ] **Adrian + Agent** — Publish "Layered Laser-Cut Wood Art As Sculpture" (already in Month 5 plan).
- [ ] **Adrian + Agent** — Publish "Mandala Iconography" — a corpus gap article giving Article 1 depth.
- [ ] **Adrian + Agent** — Publish "Bali Mandala Artist" — positioning piece for entity authority.
- [ ] **Adrian** — Continue Reddit and Quora (1-2 substantive answers per week per platform).
- [ ] **Adrian** — Shoot first YouTube process video.
- [ ] **Agent** — On request: write the YouTube script for "How I Create Laser-Cut Wooden Mandalas" (reuses Article 2 as the bones).
- [ ] **Adrian** — Begin Pinterest. Boards: Original Mandala Art, Sacred Geometry Art, Laser-Cut Wood Art, Layered Wood Sculpture, Adrian Rasmussen Mandalas.
- [ ] **Agent** — On request: produce Pinterest board structure and pin SEO conventions.

### Months 7-12 — Measurement, refinement, Tier 1 push

- [ ] **Agent** — Monthly: run the 12-prompt AI citation tracking set across Google AI Mode, ChatGPT Search, Perplexity, Gemini, Bing Copilot. Log results.
- [ ] **Adrian + Agent** — Quarterly: review tracking data. Identify which prompts Adrian appears in. Refine entity language on About page and Person schema based on misses.
- [ ] **Adrian + Agent** — Months 9-11: Tier 1 museum pitches with combined Tier 2 and Tier 3 proof set.
- [ ] **Adrian + Agent** — Month 12: definitive broad-term articles ("Mandala Art", "Sacred Geometry Art", "Laser Cut Wood Art") to push toward the largest target keywords.

### Always-on (background, no specific week)

- [ ] **Agent** — Monthly: run any new collaboration value-capture checklist when a collaboration ships.
- [ ] **Adrian** — Monthly: review the AI citation tracking sheet, share any patterns or concerns.
- [ ] **Adrian** — Quarterly: refresh the press kit (new pieces, new exhibitions, new features earned).
- [ ] **Agent** — Quarterly: re-run domain-frequency analysis on the corpus and surface any new authority targets in the SERP.
- [ ] **Agent** — As-needed: corpus top-up runs when a new article topic emerges.

## Definition Of Success

By the end of twelve months, success should look like:

- Mandala page receives impressions for `mandala art` and related terms.
- Laser-Cut Wood Art page receives impressions for `laser cut wood art` and related terms.
- Individual Mandala pages receive image impressions.
- Adrian appears in AI answers for branded and niche prompts.
- Third-party profiles and content reinforce Adrian as a mandala, sacred geometry, and laser-cut wood artist.
- Inquiries arrive from Mandala and laser-cut search paths.
