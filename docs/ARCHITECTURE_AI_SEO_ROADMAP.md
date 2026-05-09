# Adrian Website Architecture, AI, and SEO Roadmap

Last updated: 2026-05-09

This document is a durable implementation guide for future agents working on the Adrian Rasmussen Art website. It consolidates the architecture review, AI discoverability plan, SEO strategy, and prioritized to-do list into one actionable reference.

## Purpose

The goal is to move the website from a visually strong static portfolio into a more robust discovery system:

- Search engines should understand Adrian Rasmussen as an artist entity.
- AI search systems should be able to cite the site accurately.
- Each artwork should be independently discoverable.
- The Universal Language art series and Universal Language oracle experience must remain distinct.
- Future content, commerce, and SEO work should be safer and faster because metadata, data, routes, and validation have one clear structure.

## Current System Snapshot

Stack:
- Vite
- React 18
- TypeScript
- Tailwind CSS v4
- React Router v7
- Cloudflare Pages
- Cloudflare Pages Functions
- Stripe Checkout Session path, currently disabled behind launch flags

Important current files:
- `App.tsx`, route definitions and app shell
- `data/mockData.ts`, main artwork, category, collection, inventory, and legacy story data
- `data/generatedStories.ts`, generated from `content/stories/*.md`
- `types.ts`, domain types
- `useSeoMeta.ts`, route-level SEO defaults
- `hooks/useMetaTags.ts`, page-level dynamic metadata
- `utils/universalLanguage.ts`, Universal Language art-series SEO helpers
- `components/PiecePage.tsx`, artwork detail page
- `components/UniversalLanguageCard.tsx`, oracle card reader
- `components/Store.tsx`, shop/catalog UI
- `CartContext.tsx`, cart state
- `components/CartDrawer.tsx`, checkout initiation
- `functions/api/checkout.js`, Stripe Checkout Session Worker endpoint
- `vite.config.ts`, story generation and oracle OG page generation
- `public/_redirects`, Cloudflare redirects and oracle OG rewrites
- `public/robots.txt`, crawler access
- `scripts/generate-sitemap.ts`, sitemap generation
- `tests/e2e.spec.ts`, Playwright smoke tests

Important documentation drift:
- Existing project instructions mention `src/App.tsx` and `src/data/mockData.ts`, but the actual application source currently lives mostly at repo root: `App.tsx`, `components/`, `data/`, `hooks/`, `utils/`.
- Future agents should treat the actual filesystem as source of truth and update docs when doing architecture cleanup.

## Non-Negotiable Site Rules

These rules come from project instructions and must be preserved:

- Preserve the project-level banned phrase rule for generic decorative-art wording.
- Never use `oracle` in SEO, alt text, or metadata for art-series routes under `/creations/multidimensional-art/*`.
- Universal Language art-series alt text must follow:
  `[Piece Name], Universal Language [Number]. Original multi-dimensional wooden sculpture by Adrian Rasmussen.`
- Universal Language pieces are multi-dimensional wooden sculptures.
- Preserve the distinction between:
  - Art series: `/creations/multidimensional-art/universal-language`
  - Oracle deck/reader: `/oracle/universal-language`
- No em dash in site copy or generated docs intended for the repo.
- Design system uses paper, wood, stone, bronze colors.

## Verification Baseline From Review

Commands run during review:

- `npm run build`
  - Result: passes.
  - Build generated 64 oracle OG pages.
  - Large chunk warning exists, especially `UniversalLanguageCard`, `KeystaticRoute`, `oracleData`, and root index chunk.

- `npm run typecheck`
  - Result: fails.
  - Primary blocker: `scripts/generated-artworks.ts` is a paste-fragment file with invalid top-level object literals, but TypeScript currently includes it.

- `npm test -- --reporter=list`
  - Result: fails before test collection.
  - Primary blocker: `tests/e2e.spec.ts` uses `__dirname` in an ESM package.

These are not product regressions, but they reduce deployment confidence and should be fixed early.

## Priority Architecture Recommendations

### 1. Rebuild The Content Model Around Validated Source Data

Current limitation:
- `data/mockData.ts` is over 3,500 lines and mixes artwork data, categories, collections, commerce placeholders, series copy, add-on pricing, inventory derivation, and legacy stories.
- Several concepts are loosely typed, including category strings, series strings, Stripe IDs, variants, slugs, and Universal Language numbering.
- `INVENTORY` is derived from `FULL_ARCHIVE`, but commerce readiness is not strongly validated.

Evidence:
- `data/mockData.ts`
- `types.ts`
- `components/PiecePage.tsx`
- `components/Store.tsx`
- `components/UniversalLanguageIndex.tsx`

Why it matters:
- SEO, commerce, filtering, related content, image metadata, sitemap generation, and AI discoverability all depend on reliable content.
- If data is inconsistent, every downstream feature inherits the inconsistency.

Smallest useful version:
- Add a validation script that checks:
  - unique artwork IDs
  - unique story slugs
  - valid categories and series
  - valid Universal Language numbering
  - no forbidden SEO terms
  - no `oracle` in art-series SEO fields
  - placeholder Stripe IDs are not allowed when `shopEnabled` is true
  - all `coverImage` values exist in expected format
  - all public routes in sitemap resolve to real pages

Ideal version:
- Split content into domain modules:
  - `data/artworks.ts`
  - `data/series.ts`
  - `data/collections.ts`
  - `data/commerce.ts`
  - `data/oracleCards.ts`
  - `data/stories.ts`
- Use generated or validated content from canonical JSON or Markdown sources.
- Remove legacy duplicate `STORIES` from `mockData.ts` once generated stories are fully authoritative.

Expected payoff:
- Correctness
- SEO safety
- Maintainability
- Developer velocity

Risk:
- Medium. Many components import `FULL_ARCHIVE`, so refactor incrementally.

How to verify:
- `npm run typecheck`
- `npm run build`
- content validation script passes
- Playwright checks for major route groups pass

### 2. Unify Routing, Canonicals, Metadata, Sitemap, and OG Generation

Current limitation:
- Route and SEO knowledge is duplicated across:
  - `App.tsx`
  - `useSeoMeta.ts`
  - `hooks/useMetaTags.ts`
  - `vite.config.ts`
  - `public/_redirects`
  - `functions/oracle/universal-language/[number].js`
  - `scripts/generate-sitemap.ts`
- Universal Language card names and image IDs are repeated in multiple places.

Why it matters:
- Search and AI systems need clean, consistent identity.
- Duplicate metadata paths create high risk for stale titles, incorrect canonicals, and Universal Language art/oracle confusion.

Smallest useful version:
- Create one route metadata registry that exports:
  - route path
  - canonical URL
  - title
  - description
  - OG image
  - sitemap inclusion
  - page type
  - public or hidden status
  - SEO rules
- Use this registry in sitemap generation and React metadata first.

Ideal version:
- Generate `_redirects` oracle card rewrite entries from the same metadata.
- Generate oracle OG HTML pages from the same source.
- Remove duplicated card name/image lookup tables from Vite config and Cloudflare Functions.
- Add tests that snapshot metadata for important routes.

Expected payoff:
- SEO safety
- AI discoverability
- Deployment confidence
- Long-term velocity

Risk:
- Medium to high because Cloudflare routing, OG previews, and SPA behavior need careful verification.

How to verify:
- `npm run build`
- inspect `dist/oracle/universal-language/1.html`
- verify card OG tags with curl or a social preview debugger
- verify `/creations/multidimensional-art/universal-language` contains no oracle SEO terms
- verify `/oracle/universal-language` has oracle framing
- verify sitemap contains only active canonical routes

### 3. Harden Commerce Before Enabling Stripe

Current limitation:
- Shop is disabled in `launchFlags.ts` because Stripe IDs are placeholders.
- Client sends raw Stripe price IDs to `/api/checkout`.
- Server validates shape and prefix, but does not yet prove that requested prices belong to an allowed product/configuration.
- Cart stores product snapshots in localStorage.

Why it matters:
- Once payments are live, checkout payloads must not be trusted from the browser.
- Server-side validation protects pricing, product availability, and configuration integrity.

Smallest useful version:
- Add a server-side allowlist of valid Stripe Price IDs generated from current inventory.
- Reject placeholder IDs and unknown IDs.
- Reject shop route from sitemap while `shopEnabled` is false.

Ideal version:
- Client sends `{ artworkId, variantId, addOns, quantity }`.
- Worker derives Stripe line items server-side.
- Add Stripe webhook handling for fulfillment or studio notification.
- Add order metadata to Stripe Checkout Session.
- Add product and offer schema only when shop is live and data is real.

Expected payoff:
- Commerce correctness
- Deployment confidence
- Buyer trust
- Easier shop launch

Risk:
- Medium. Requires careful staging/test Stripe validation.

How to verify:
- Stripe test checkout succeeds with real test price IDs.
- Tampered unknown price ID fails.
- Placeholder ID fails.
- Disabled shop is absent from sitemap.
- Cart restore handles stale product snapshots safely.

### 4. Decompose Large Feature Components

Current limitation:
- Several components own too many responsibilities:
  - `components/UniversalLanguageCard.tsx`, over 2,000 lines
  - `components/PiecePage.tsx`, over 1,200 lines
  - `components/Store.tsx`, over 1,000 lines
  - `components/Inquire.tsx`, over 1,100 lines

Why it matters:
- Large components make future changes slower and riskier.
- They hide reusable domain logic inside UI files.
- They are hard to test meaningfully.

Smallest useful version:
- Extract pure helpers first:
  - artwork lookup helpers
  - commerce configuration calculation
  - schema builders
  - Universal Language card metadata builders
  - share URL/story image helpers
  - route/canonical helpers

Ideal version:
- Feature folder structure:
  - `features/artwork/`
  - `features/oracle/`
  - `features/shop/`
  - `features/inquire/`
- Each feature has:
  - `data`
  - `hooks`
  - `schema`
  - `sections`
  - `components`
  - tests

Expected payoff:
- Maintainability
- Developer velocity
- Lower regression risk
- Better code splitting

Risk:
- Medium. UI regressions are possible, so do after verification is repaired.

How to verify:
- Screenshots before and after match core routes.
- Playwright route smoke tests pass.
- Unit tests cover extracted pure helpers.
- Bundle chunks shrink or become better isolated.

### 5. Restore CI-Grade Verification

Current limitation:
- Typecheck currently fails due `scripts/generated-artworks.ts`.
- Playwright tests fail before running due `__dirname` in ESM.
- Tests are useful but broad and do not yet protect key SEO or data invariants.

Why it matters:
- This codebase has high SEO, routing, and content safety requirements.
- Future agents need reliable guardrails before making deep changes.

Smallest useful version:
- Exclude migration/paste-fragment scripts from TypeScript.
- Fix `tests/e2e.spec.ts` ESM path handling.
- Ensure `npm run typecheck && npm test && npm run build` can pass locally.

Ideal version:
- Add tests for:
  - all public routes
  - all artwork detail pages
  - sitemap route validity
  - metadata snapshots
  - Universal Language forbidden terms
  - checkout payload tampering
  - generated OG pages
  - image alt text rules

Expected payoff:
- Deployment confidence
- SEO safety
- Correctness
- Faster future agent work

Risk:
- Low to medium.

How to verify:
- `npm run typecheck`
- `npm test`
- `npm run build`
- validation scripts run in CI or predeploy

## AI and SEO Exposure Plan

### Strategic Principle

The site should make every important page answer these questions clearly:

- What is this?
- Who made it?
- What entity does it represent?
- What is it connected to?
- Why does it matter?
- What should the visitor do next?

This should be true for visible content and machine-readable metadata.

### Core AI/SEO Constructs

#### Entity Graph

Build an explicit graph of:

- Adrian Rasmussen, artist
- Individual artworks
- Art series
- Universal Language art series
- Universal Language oracle experience
- Writings/articles
- Commissions
- Products/offers when shop is enabled
- Images

Benefits:
- AI systems can cite the site more accurately.
- Search systems can understand relationships between pages.
- Related content becomes easier to generate and maintain.

#### Structured Data Layer

Use JSON-LD schema:

- `Person` for Adrian
- `WebSite` for the site
- `VisualArtwork` for artwork pages
- `CollectionPage` for series/category pages
- `Article` for writings
- `BreadcrumbList` for navigational hierarchy
- `ImageObject` for major artwork images
- `Product` and `Offer` only when commerce is real and enabled

Benefits:
- Better search interpretation.
- Rich result eligibility where supported.
- Better AI citation context.

#### AI-Readable Page Blocks

Add concise visible explanation blocks on important pages:

- What is multidimensional art?
- What is Universal Language as an art series?
- What is Universal Language as an oracle reader?
- How are the sculptures made?
- How do commissions work?
- What materials are used?
- Where is Adrian based?

Benefits:
- AI search can summarize and cite the site more accurately.
- Visitors understand the work faster.
- Long-tail search queries have stronger page matches.

#### Image Discovery System

Build:

- consistent artwork alt text
- image sitemap entries
- `ImageObject` schema
- artwork-specific OG images
- clean Cloudinary public IDs where possible
- responsive image metadata

Benefits:
- Better Google Images exposure.
- Better social previews.
- Stronger visual AI search identity.

### Highest-Value Search Intents To Support

Build pages and internal links around these discovery themes:

- Adrian Rasmussen artist
- Bali multidimensional artist
- sacred geometry art
- sacred geometry wooden sculpture
- laser cut wood sculpture
- multi-dimensional wooden sculpture
- mandala art
- illuminated sculpture
- Light Codes art
- Universal Language art series
- Universal Language oracle
- I Ching inspired artwork
- Gene Keys inspired artwork
- commissioned sacred geometry artwork
- spiritual art commissions
- custom multidimensional art

## AI and SEO To-Do List

### Phase 1: Crawl And Index Hygiene

- [ ] Update `public/robots.txt` with explicit crawler policy.
- [ ] Confirm `OAI-SearchBot` is allowed if ChatGPT search visibility is desired.
- [ ] Decide whether `GPTBot` should be allowed or disallowed separately from search crawlers.
- [ ] Keep `/admin`, `/api`, `/keystatic`, and preview routes blocked.
- [ ] Remove `/shop` from sitemap while `shopEnabled` is false.
- [ ] Generate sitemap from route metadata and launch flags.
- [ ] Add sitemap verification to a script or test.

### Phase 2: Metadata Registry

- [ ] Create a central route metadata file.
- [ ] Include title, description, canonical, OG image, page type, sitemap status, and route status.
- [ ] Migrate `useSeoMeta.ts` to use the registry.
- [ ] Migrate `scripts/generate-sitemap.ts` to use the registry.
- [ ] Add metadata for dynamic artwork routes.
- [ ] Add metadata for dynamic writing routes.
- [ ] Add metadata for oracle card routes.
- [ ] Add tests for canonical URLs and page titles.

### Phase 3: Universal Language SEO Safety

- [ ] Create a single Universal Language card metadata source.
- [ ] Generate oracle OG pages from that source.
- [ ] Generate Cloudflare rewrite entries from that source or replace manual rewrite maintenance.
- [ ] Ensure art-series pages never use oracle framing.
- [ ] Ensure oracle pages can use oracle framing.
- [ ] Add forbidden-term validation for art-series SEO.
- [ ] Add snapshot tests for:
  - `/creations/multidimensional-art/universal-language`
  - `/oracle/universal-language`
  - `/oracle/universal-language/1`
  - `/creations/UL-100`

### Phase 4: Structured Data

- [ ] Add `Person` schema for Adrian globally or on About.
- [ ] Add `WebSite` schema on homepage.
- [ ] Expand `VisualArtwork` schema on piece pages.
- [ ] Add `ImageObject` schema for artwork images.
- [ ] Add `CollectionPage` schema for category and series pages.
- [ ] Add `Article` schema for writings.
- [ ] Add `BreadcrumbList` consistently.
- [ ] Add `Product` and `Offer` schema only when shop is enabled and Stripe/product data is real.
- [ ] Validate generated schema with Google Rich Results Test or schema validator during release checks.

### Phase 5: Content Clusters

- [ ] Strengthen `/creations/multidimensional-art`.
- [ ] Strengthen `/creations/multidimensional-art/universal-language`.
- [ ] Strengthen `/oracle/universal-language`.
- [ ] Strengthen `/creations/multidimensional-art/mandala`.
- [ ] Strengthen `/creations/multidimensional-art/light-codes`.
- [ ] Add or strengthen commission explanation on `/inquire`.
- [ ] Add visible, concise answer blocks to major pages.
- [ ] Add internal links from writings to relevant artworks.
- [ ] Add internal links from artworks to relevant writings.
- [ ] Add related artwork and related story metadata.

### Phase 6: Artwork Page Improvements

- [ ] Ensure every artwork has a useful visible description.
- [ ] Add structured facts for dimensions, material, year, series, availability.
- [ ] Add image metadata for cover image.
- [ ] Add related series link.
- [ ] Add related writing link where available.
- [ ] Add commission or purchase next step.
- [ ] Confirm all Universal Language alt text follows the required pattern.
- [ ] Add validation for empty descriptions on important artworks.

### Phase 7: Commerce Readiness

- [ ] Keep shop disabled until Stripe IDs are real.
- [ ] Add server-side checkout allowlist.
- [ ] Reject placeholder Stripe IDs.
- [ ] Reject unknown Stripe IDs.
- [ ] Move from client-sent price IDs to server-derived line items if possible.
- [ ] Add Stripe test checkout verification.
- [ ] Add checkout tamper tests.
- [ ] Add product schema only after data is real.
- [ ] Add clear fulfillment and shipping expectations.

### Phase 8: Testing And Monitoring

- [ ] Fix TypeScript project boundaries.
- [ ] Fix Playwright ESM path issue.
- [ ] Make `npm run typecheck` pass.
- [ ] Make `npm test` pass.
- [ ] Make `npm run build` pass.
- [ ] Add metadata snapshot tests.
- [ ] Add sitemap tests.
- [ ] Add content validation tests.
- [ ] Add Google Search Console.
- [ ] Add Bing Webmaster Tools.
- [ ] Track ChatGPT and AI referral traffic where analytics exposes it.
- [ ] Review top search queries monthly.
- [ ] Review indexed pages monthly.
- [ ] Review structured data errors monthly.

## Mandala Search Growth Plan

This section captures the specific strategy for becoming significantly more discoverable for mandala-related searches.

### Strategic Goal

The long-term ambition is to rank strongly for broad mandala searches, especially `mandala art`, while first winning more specific buyer and artist-intent searches that fit Adrian's work more precisely.

Broad searches such as `mandala` are high-volume but mostly informational. They are dominated by encyclopedic, cultural, tutorial, and image-browsing intent. The better path is to build authority around commercial and differentiated searches, then use that authority to move upward toward broader terms over time.

### Core Positioning

The site should not try to compete as a generic mandala site.

The more ownable position is:

Original sacred geometry mandala art made as layered, laser-cut wooden sculpture by Adrian Rasmussen.

Supporting language:

- original mandala artwork
- sacred geometry mandala art
- custom mandala artwork
- laser-cut mandala art
- wooden mandala sculpture
- layered mandala artwork
- contemporary mandala artist
- Bali-based sacred geometry artist

Avoid flattening the work into generic decorative language. The value is in originality, process, materiality, contemplative purpose, and the fact that the pieces are physical layered wooden sculptures.

### Keyword Tiers

Use this table as the starting keyword map. Validate and refine monthly with Google Search Console, Bing Webmaster Tools, and live search results.

| Tier | Keyword | Intent | Priority | Best Page Type |
| --- | --- | --- | --- | --- |
| Broad awareness | `mandala` | informational, cultural, visual browsing | Long-term only | supporting article, not primary sales page |
| Broad art | `mandala art` | mixed inspiration, learning, buying | Long-term primary | Mandala collection page plus article cluster |
| Commercial | `mandala artwork` | art discovery and possible purchase | High | Mandala collection page |
| Commercial | `original mandala art` | buyer or collector intent | High | Mandala collection page and artwork pages |
| Commercial | `buy mandala art` | purchase intent | High | Mandala collection page, shop when enabled |
| Commercial | `mandala art for sale` | purchase intent | High | Mandala collection page, shop when enabled |
| Commission | `custom mandala artwork` | commission intent | Very high | Inquire page plus mandala commission section |
| Commission | `mandala art commission` | commission intent | Very high | Inquire page plus supporting article |
| Differentiated | `sacred geometry mandala art` | high fit, collector/spiritual intent | Very high | Mandala collection page plus article |
| Differentiated | `laser cut mandala art` | high fit, material/process intent | Very high | process article plus artwork pages |
| Differentiated | `wooden mandala sculpture` | high fit, buyer intent | Very high | artwork pages and collection page |
| Differentiated | `layered mandala art` | high fit, visual/material intent | High | artwork pages and process article |
| Artist/entity | `Adrian Rasmussen mandala` | branded discovery | Very high | Mandala collection page |
| Artist/entity | `Bali mandala artist` | artist/location discovery | High | About, Mandala page, Inquire |
| Artist/entity | `sacred geometry artist Bali` | artist/location discovery | High | About, Inquire, Multidimensional Art |

### What It Takes To Rank

Ranking highly for mandala-related terms requires a cluster, not a single page.

The cluster should include:

- A strong Mandala collection page.
- Individual mandala artwork pages with complete descriptions and image metadata.
- Supporting writings that answer common search and AI-search questions.
- Internal links between writings, the Mandala collection, and individual artworks.
- Structured data for collection, artwork, article, image, and breadcrumbs.
- External authority signals such as interviews, art profiles, press, gallery links, Pinterest/image sharing, and social profile consistency.

### Mandala Collection Page Requirements

Primary route:

- `/creations/multidimensional-art/mandala`

Primary target:

- `mandala art`

Secondary targets:

- `mandala artwork`
- `original mandala art`
- `sacred geometry mandala art`
- `laser cut mandala art`
- `wooden mandala sculpture`
- `custom mandala artwork`

The page should include:

- A clear first-screen statement of what Adrian's mandala work is.
- Visible explanation of materials and process.
- Available works and sold/reference works.
- A short commission path.
- Links to relevant writings.
- Links to individual artwork pages.
- `CollectionPage` schema.
- `BreadcrumbList` schema.
- Image metadata for the hero/collection image.

Recommended visible explanation block:

Adrian Rasmussen creates original mandala artworks as layered, laser-cut wooden sculptures. Each piece combines sacred geometry, hand-finished surfaces, and contemplative form, turning the mandala from an image into a physical object for presence, reflection, and space-making.

Keep the language natural and artistically true. Do not over-repeat keywords.

### Individual Mandala Artwork Page Requirements

Each mandala artwork page should include:

- Title.
- Original artwork description.
- Materials.
- Dimensions.
- Year.
- Availability.
- Series connection.
- Process note.
- Image alt text.
- `VisualArtwork` schema.
- `ImageObject` schema.
- Breadcrumbs.
- Link back to Mandala collection.
- Link to relevant writing.
- Inquiry or purchase CTA.

Minimum useful description pattern:

`[Title]` is an original mandala artwork by Adrian Rasmussen, created through layered laser-cut wood, sacred geometry, and hand-finished surface work. The piece is part of Adrian's mandala practice, where geometry becomes a physical object for stillness, center, and contemplation.

Customize each page so it does not become duplicate boilerplate.

### Supporting Writing Cluster

Create or strengthen these writings:

- `What Is Mandala Art?`
- `How I Create Laser-Cut Wooden Mandalas`
- `Mandala As A Place To Enter`
- `Sacred Geometry, Stillness, And Center`
- `Commissioning A Custom Mandala Artwork`
- `Original Mandala Art Versus Prints`
- `Why Make Mandalas In Wood?`

Each writing should:

- Answer one clear question.
- Link to the Mandala collection page.
- Link to at least one relevant artwork.
- Include `Article` schema.
- Include a short author/entity connection to Adrian.
- Avoid generic SEO filler.

### Image Search Plan For Mandalas

For mandala artworks, images are a major discovery channel.

Add:

- descriptive alt text
- image sitemap entries
- `ImageObject` schema
- clean Cloudinary public IDs where practical
- artwork-specific social preview images
- visible captions or nearby text that name the work, material, and series

Suggested alt text pattern for non-Universal Language mandalas:

`[Piece Title] by Adrian Rasmussen. Original sacred geometry mandala artwork in layered laser-cut wood.`

Use accurate material wording for each actual piece.

### Structured Data For Mandala Pages

Use:

- `CollectionPage` on the Mandala collection route.
- `VisualArtwork` on individual mandala piece routes.
- `ImageObject` for primary images.
- `Article` on mandala writings.
- `BreadcrumbList` across collection, article, and artwork pages.
- `Product` and `Offer` only once shop data is real.

Schema should match visible content. Do not claim purchasability, price, inventory, or availability unless the data is accurate.

### Authority Building

To rank for competitive mandala terms, the site needs signals beyond on-page SEO.

Build:

- consistent artist profiles linking to the site
- social profiles with same name and bio framing
- interviews or guest features
- gallery or publication links
- Pinterest boards or image discovery channels
- backlinks from art, sacred geometry, Bali, tea, installation, or spiritual art communities
- newsletter or writing references that get shared

The goal is to make search and AI systems see Adrian as a real artist entity associated with mandala, sacred geometry, and layered wooden sculpture.

### Measurement Plan

Set up or use:

- Google Search Console
- Bing Webmaster Tools
- analytics referral tracking
- structured data validation
- monthly live search checks

Track these queries monthly:

- `mandala art`
- `mandala artwork`
- `original mandala art`
- `buy mandala art`
- `mandala art for sale`
- `custom mandala artwork`
- `mandala art commission`
- `sacred geometry mandala art`
- `laser cut mandala art`
- `wooden mandala sculpture`
- `layered mandala art`
- `Bali mandala artist`
- `Adrian Rasmussen mandala`

Monthly review questions:

- Which mandala queries are generating impressions?
- Which pages receive impressions but low clicks?
- Which pages rank on page two or three and could be improved?
- Which images are appearing in image search?
- Which inquiries came from mandala-related pages?
- Which AI/search summaries describe Adrian inaccurately?

### Mandala Task List

- [ ] Audit current Mandala collection page copy.
- [ ] Add stronger visible explanation block to `/creations/multidimensional-art/mandala`.
- [ ] Add `CollectionPage` schema to the Mandala collection route.
- [ ] Improve all individual mandala artwork descriptions.
- [ ] Add `VisualArtwork` and `ImageObject` schema to mandala piece pages.
- [ ] Add image sitemap support.
- [ ] Add mandala-specific alt text validation.
- [ ] Create `What Is Mandala Art?` writing.
- [ ] Create `How I Create Laser-Cut Wooden Mandalas` writing.
- [ ] Create `Commissioning A Custom Mandala Artwork` writing.
- [ ] Add internal links from writings to Mandala collection and artworks.
- [ ] Add internal links from Mandala artworks to relevant writings.
- [ ] Add mandala commission CTA on Mandala collection page.
- [ ] Add Search Console tracking for mandala query set.
- [ ] Review rankings and impressions monthly.

### Suggested Agent Prompt For Mandala SEO Work

Use this prompt for a focused future implementation task:

Improve the Mandala SEO and AI discoverability cluster. Focus on `/creations/multidimensional-art/mandala`, individual mandala artwork pages, and supporting writing structure. Add or improve visible explanatory copy, internal links, structured data, image metadata, alt text patterns, and sitemap/image sitemap support. Preserve the site's design system and project SEO rules. Do not use generic decorative-art positioning. Verify with build, typecheck if available, metadata checks, and route/page inspection.

## Recommended Implementation Sequence

1. Repair verification.
   - Fix typecheck.
   - Fix Playwright.
   - Establish baseline checks.

2. Build the metadata registry.
   - Centralize route metadata.
   - Connect sitemap and React SEO to it.

3. Add validation.
   - Data validation.
   - SEO rule validation.
   - Universal Language forbidden-term checks.

4. Consolidate Universal Language metadata.
   - Single source for card names, numbers, images, canonicals, and OG pages.

5. Expand structured data.
   - Person, Website, VisualArtwork, CollectionPage, Article, BreadcrumbList, ImageObject.

6. Improve high-value content pages.
   - Multidimensional Art.
   - Universal Language art series.
   - Universal Language oracle.
   - Inquire/commissions.
   - Writings connected to artworks.

7. Harden commerce.
   - Only after verification and metadata structure are stable.

8. Refactor large components.
   - Extract domain logic from `UniversalLanguageCard`, `PiecePage`, `Store`, and `Inquire`.
   - Do this after tests can protect behavior.

## Suggested Agent Prompts For Future Work

Use these prompts to start focused agent tasks.

### Verification Prompt

Fix the project verification baseline. Make `npm run typecheck`, `npm test`, and `npm run build` pass without changing user-facing behavior. Preserve unrelated worktree changes. Start by addressing the invalid TypeScript inclusion of `scripts/generated-artworks.ts` and the ESM `__dirname` issue in `tests/e2e.spec.ts`.

### Metadata Registry Prompt

Create a central route metadata registry for the site. It should provide titles, descriptions, canonical URLs, OG images, sitemap inclusion, route status, and page type for static and dynamic routes. Migrate `useSeoMeta.ts` and `scripts/generate-sitemap.ts` to use it. Preserve Universal Language art-series versus oracle distinction.

### Universal Language SEO Safety Prompt

Consolidate Universal Language card metadata so card names, numbers, image IDs, canonical URLs, OG page generation, and Cloudflare route support all use one source of truth. Add tests that ensure art-series routes do not include oracle terminology in SEO, alt text, or structured data.

### Content Validation Prompt

Add a content validation script for artwork, stories, collections, and commerce data. Validate unique IDs, valid categories, valid series, Universal Language numbering, required alt text rules, missing descriptions, placeholder Stripe IDs, and forbidden terms. Add it to the verification workflow.

### Structured Data Prompt

Expand JSON-LD structured data across the site. Add or improve Person, WebSite, VisualArtwork, CollectionPage, Article, BreadcrumbList, ImageObject, and Product/Offer where appropriate. Ensure schema values match visible page content and canonical metadata.

### Commerce Hardening Prompt

Harden checkout before enabling shop. Add server-side validation for allowed product configurations and Stripe Price IDs. Reject placeholder or unknown IDs. Prefer sending product/variant/add-on selections to the Worker and deriving Stripe line items server-side.

### Component Decomposition Prompt

Refactor large feature components without changing behavior. Start with pure domain helpers for `PiecePage` commerce configuration, schema building, and artwork lookups. Then extract sections from `UniversalLanguageCard`, `Store`, and `Inquire`. Verify with existing and newly added tests.

## Definition Of Done For The Next Space

The website has reached the next architectural stage when:

- Verification is reliable.
- Metadata has one source of truth.
- Sitemap only lists real canonical public routes.
- Universal Language art and oracle SEO are safely separated.
- Artwork pages are individually discoverable with structured data.
- AI search crawlers can access public content intentionally.
- Major pages have visible answer blocks for AI and human comprehension.
- Commerce cannot be enabled with placeholder or unvalidated Stripe data.
- Future agents can extend content and SEO without duplicating route or metadata logic.
