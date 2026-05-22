# SEO AI Mandala Laser-Cut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the technical, content, and research foundation for ranking and AI citation visibility around Mandala, original Mandala art, sacred geometry art, and laser-cut wood art.

**Architecture:** Centralize SEO route metadata, generate sitemap entries from the same registry, add high-fit landing pages, strengthen collection and image schema, and save decision-ready research files. Keep Universal Language art-series SEO separate from oracle route SEO.

**Tech Stack:** Vite, React 18, TypeScript, React Router v7, Tailwind CSS, Cloudflare Pages, Cloudinary, JSON-LD, Playwright, Node scripts with `tsx`.

---

## File Structure

- Create `utils/seoMetadata.ts`: central route metadata, canonical URL helper, sitemap route helper, forbidden SEO terms.
- Create `utils/artworkFilters.ts`: shared artwork filters and alt text helpers for Mandala and laser-cut wood art.
- Create `components/LaserCutWoodArtPage.tsx`: dedicated collection page for laser-cut wood art.
- Modify `useSeoMeta.ts`: consume central metadata registry.
- Modify `App.tsx`: add `/creations/laser-cut-wood-art`.
- Modify `data/mockData.ts`: add Creations tile for Laser-Cut Wood Art.
- Modify `components/MultidimensionalArt.tsx`: add internal link to Laser-Cut Wood Art.
- Modify `components/SubcategoryPage.tsx`: strengthen Mandala copy and add collection schema.
- Modify `components/PiecePage.tsx`: add image schema and stronger alt text.
- Modify `scripts/generate-sitemap.ts`: generate static routes from metadata and include image entries.
- Create `scripts/generate-static-route-html.ts`: generate route-specific built HTML metadata for crawlers and social previews.
- Create `scripts/validate-seo.ts`: validate metadata, sitemap flags, target route presence, and forbidden phrase safety.
- Create `docs/research/seo/*.md`: save official guidance, keyword map, AI citation playbook, and 12-month plan.

## Task 1: SEO Validation Script

**Files:**
- Create: `scripts/validate-seo.ts`
- Modify: `package.json`

- [x] **Step 1: Write the failing validation script**

```bash
npx tsx scripts/validate-seo.ts
```

Expected first failure: missing `utils/seoMetadata`.

- [x] **Step 2: Add npm script**

```json
"seo:check": "tsx scripts/validate-seo.ts"
```

- [x] **Step 3: Re-run after implementation**

```bash
npm run seo:check
```

Expected final output:

```text
SEO validation passed.
```

## Task 2: Central Metadata Registry

**Files:**
- Create: `utils/seoMetadata.ts`
- Modify: `useSeoMeta.ts`

- [x] **Step 1: Add route metadata**

Include canonical entries for:

- `/`
- `/creations`
- `/creations/laser-cut-wood-art`
- `/creations/illuminated-works`
- `/creations/multidimensional-art`
- `/creations/multidimensional-art/universal-language`
- `/creations/multidimensional-art/mandala`
- `/creations/multidimensional-art/light-codes`
- `/creations/multidimensional-art/signature-pieces`
- `/oracle/universal-language`
- `/oracle/the-systems`
- `/writings`
- `/about`
- `/inquire`
- `/shop`
- `/privacy`
- `/terms`

- [x] **Step 2: Preserve Universal Language safety**

Art-series metadata for `/creations/multidimensional-art/universal-language` must describe multi-dimensional wooden sculptures and must not use oracle framing.

- [x] **Step 3: Wire registry into `useSeoMeta.ts`**

`useSeoMeta.ts` must call:

```ts
resolveSeoConfig(pathname)
resolveCanonicalUrl(pathname)
```

## Task 3: Laser-Cut Wood Art Page

**Files:**
- Create: `components/LaserCutWoodArtPage.tsx`
- Create: `utils/artworkFilters.ts`
- Modify: `App.tsx`
- Modify: `data/mockData.ts`
- Modify: `components/MultidimensionalArt.tsx`

- [x] **Step 1: Add shared artwork filter**

```ts
export function isLaserCutWoodArtwork(art: Artwork): boolean {
  const searchable = [art.material, art.description, art.longDescription, art.seriesDescription]
    .filter(Boolean)
    .join(' ');

  return /laser[-\s]?cut/i.test(searchable) && /wood/i.test(searchable);
}
```

- [x] **Step 2: Add route**

```tsx
<Route path="/creations/laser-cut-wood-art" element={<LaserCutWoodArtPage />} />
```

- [x] **Step 3: Add internal links**

Add the page to the Creations tile set and link to it from Multidimensional Art.

- [x] **Step 4: Add schema**

The page must emit `CollectionPage` schema with an `ItemList` of eligible artworks.

## Task 4: Mandala Hub Strengthening

**Files:**
- Modify: `components/SubcategoryPage.tsx`
- Modify: `utils/seoMetadata.ts`

- [x] **Step 1: Improve Mandala metadata**

Title target:

```text
Mandala Art | Adrian Rasmussen
```

Description target:

```text
Original mandala art by Adrian Rasmussen, created as layered laser-cut wood sculptures with sacred geometry, hand-finished color, and contemplative form.
```

- [x] **Step 2: Add visible explanatory block**

The Mandala page must state that Adrian creates original Mandala art as layered laser-cut wood sculpture, with sacred geometry and hand-finished surfaces.

- [x] **Step 3: Add collection schema**

Subcategory pages must emit `CollectionPage` and `BreadcrumbList` schema.

## Task 5: Artwork Image Schema And Alt Text

**Files:**
- Modify: `components/PiecePage.tsx`
- Modify: `utils/artworkFilters.ts`

- [x] **Step 1: Add Mandala alt helper**

```ts
export function mandalaAltText(title: string): string {
  return `${title} by Adrian Rasmussen. Original sacred geometry mandala artwork in layered laser-cut wood.`;
}
```

- [x] **Step 2: Add laser-cut wood alt helper**

```ts
export function laserCutWoodAltText(title: string): string {
  return `${title} by Adrian Rasmussen. Layered laser-cut wood artwork with hand-finished surface work.`;
}
```

- [x] **Step 3: Add `ImageObject` schema**

Each artwork page must emit `ImageObject` schema for the primary image.

## Task 6: Sitemap And Image Entries

**Files:**
- Modify: `scripts/generate-sitemap.ts`
- Modify: `public/sitemap.xml`

- [x] **Step 1: Generate static routes from metadata**

`scripts/generate-sitemap.ts` must use `getStaticSitemapEntries(LAUNCH_FLAGS)`.

- [x] **Step 2: Respect launch flags**

`/shop` must be excluded while `LAUNCH_FLAGS.shopEnabled` is false.

- [x] **Step 3: Add image entries**

Artwork URLs must include image entries for the cover image and up to four additional images.

- [x] **Step 4: Generate sitemap**

```bash
npm run sitemap
```

Expected output includes:

```text
Sitemap written to ... public/sitemap.xml
```

## Task 7: Research Files

**Files:**
- Create: `docs/research/seo/README.md`
- Create: `docs/research/seo/2026-05-20-google-ai-search-guidance.md`
- Create: `docs/research/seo/2026-05-20-keyword-map-mandala-laser-cut.md`
- Create: `docs/research/seo/2026-05-20-ai-citation-and-brand-presence-playbook.md`
- Create: `docs/research/seo/2026-05-20-12-month-execution-plan.md`

- [x] **Step 1: Save official Google interpretation**

Include the Google AI guide, AI features, AI content, Search Essentials, helpful content, image SEO, structured data, and JavaScript SEO implications.

- [x] **Step 2: Save keyword map**

Include impression-potential tiers, high-fit terms, page mapping, and terms to avoid as primary targets.

- [x] **Step 3: Save AI citation playbook**

Include prompt set, source types, off-site strategy, and metrics.

- [x] **Step 4: Save 12-month execution plan**

Include completed work, remaining work, monthly phases, manual work, autonomous work, and definition of success.

## Task 8: Static Route HTML Metadata

**Files:**
- Create: `scripts/generate-static-route-html.ts`
- Modify: `package.json`
- Modify: `scripts/validate-seo.ts`

- [x] **Step 1: Generate route-specific HTML files after Vite build**

`npm run build` must run:

```bash
vite build && tsx scripts/generate-static-route-html.ts && tsx scripts/generate-sitemap.ts
```

- [x] **Step 2: Cover static routes, artwork pages, and writing pages**

Generated files must include route-specific title, description, canonical, Open Graph, and Twitter metadata.

- [x] **Step 3: Validate the build script**

`npm run seo:check` must fail if static route HTML or sitemap generation is removed from the production build.

## Task 9: Internal Links From Artwork Pages

**Files:**
- Modify: `components/PiecePage.tsx`

- [x] **Step 1: Add Laser-Cut Wood Art hub links**

Eligible laser-cut wood artwork pages link back to `/creations/laser-cut-wood-art`.

## Task 10: Verification

**Files:**
- Verify current workspace.

- [x] **Step 1: Run SEO validation**

```bash
npm run seo:check
```

- [x] **Step 2: Run TypeScript validation**

```bash
npm run typecheck
```

- [x] **Step 3: Regenerate sitemap**

```bash
npm run sitemap
```

- [x] **Step 4: Run production build**

```bash
npm run build
```

- [x] **Step 5: Inspect the new route**

Start the local server and inspect:

```text
http://localhost:8888/creations/laser-cut-wood-art
http://localhost:8888/creations/multidimensional-art/mandala
```

## Remaining Safe Autonomous Tasks

- [x] Rewrite repeated Mandala artwork descriptions.
- [x] Confirm Article schema exists on writing pages.
- [x] Add WebSite schema on the home page.
- [x] Strengthen About page entity schema and copy.
- [x] Add Playwright coverage for Mandala and Laser-Cut Wood Art pages.
- [x] Add internal links from piece pages to Laser-Cut Wood Art where applicable.
- [x] Investigate and implement static route HTML generation for priority SEO routes.
