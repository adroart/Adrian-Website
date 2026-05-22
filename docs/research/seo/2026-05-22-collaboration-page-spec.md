# Collaboration Page Spec

Last updated: 2026-05-22

Companion to: `~/Documents/Obsidian Vault/4 Outputs/mandalas/_outreach-intelligence.md` (Tier 0 — Collaborations) and `_collaboration-outreach-templates.md`.

## Purpose

When Adrian collaborates with another artist, the collaboration must produce a permanent, SEO-optimized page on `adrianrasmussen.com`. Most artists do collaborations and capture none of the SEO value. This spec ensures the structured page, schema, and outreach exist before the collaboration ships, so the value-capture takes 10 minutes, not 2 days.

## Route

```
/writings/collaborations/<collaborator-slug>-<theme-slug>
```

Examples:
- `/writings/collaborations/jane-smith-living-mandalas`
- `/writings/collaborations/alex-grey-sacred-geometry-conversation`

These live under `/writings/` because they are editorial content, not artwork pages. Use a `collaborations` sub-segment so they're URL-distinguishable and a future hub page at `/writings/collaborations/` can list them all.

## Data model

Add a `Collaboration` type to `types.ts`:

```ts
export interface Collaboration {
  slug: string;                      // e.g. "jane-smith-living-mandalas"
  collaboratorName: string;          // "Jane Smith"
  collaboratorSite?: string;         // "https://janesmithart.com"
  collaboratorInstagram?: string;    // "janesmith.art"
  collaboratorBio: string;           // 1-2 sentences for context
  shape: 'co-created' | 'joint-show' | 'in-conversation' | 'mutual-essay';
  theme: string;                     // "Living Mandalas", "Sacred Geometry Now"
  date: string;                      // ISO YYYY-MM-DD
  status: 'upcoming' | 'live' | 'archive';

  // Editorial content
  title: string;                     // page title — should include collaborator name + theme
  description: string;               // 150-160 char meta description
  excerpt: string;                   // 1-2 sentence hook on the collaboration listing page
  bodyMarkdown: string;              // the actual collaboration story / essay / interview transcript

  // Mutual quote (per outreach checklist — get a 2-sentence quote from them)
  collaboratorQuote?: string;
  adrianQuote?: string;

  // Media
  heroImage: string;                 // Cloudinary public ID
  gallery: string[];                 // additional Cloudinary IDs
  videoUrl?: string;                 // YouTube embed if applicable

  // Related work
  relatedArtworkIds: string[];       // ids from mockData.ts pointing to artworks featured
  relatedWritingSlugs: string[];     // other /writings/ slugs that link this collaboration

  // SEO
  seoKeywords: string[];             // 3-5 target keywords for this page
}
```

Store collaborations in `data/mockData.ts` as a new exported array `COLLABORATIONS: Collaboration[]`.

## Component

New file: `components/CollaborationPage.tsx`

Structure:

1. **Breadcrumb**: Home → Writings → Collaborations → [Theme]
2. **Hero**: full-width hero image, collaboration title, "Adrian Rasmussen × [Collaborator Name]", date
3. **Intro paragraph**: 2-3 sentences framing the collaboration
4. **Collaborator bio block**: photo (small), name as a link to their site, 1-2 sentence bio, IG handle
5. **The story / essay / transcript**: the bodyMarkdown rendered
6. **Mutual quote block**: side-by-side or stacked. Collaborator's quote about Adrian on the left, Adrian's quote about them on the right.
7. **Gallery**: grid of additional images from the collaboration
8. **Video embed** (if applicable)
9. **Related work block**: cards linking to:
   - The collaborator's site (external)
   - Adrian's related artworks (internal)
   - Adrian's other related writings (internal)
10. **Footer CTA**: "Interested in commissioning a collaboration like this?" → /inquire

## SEO requirements

Each collaboration page must include:

### Meta tags (via `useSeoMeta`)

- `title`: `[Collaboration Title] · Adrian Rasmussen × [Collaborator Name]`
- `description`: from `description` field
- `og:image`: the hero image at 1200x630
- `og:type`: `article`
- `article:author`: Adrian Rasmussen
- `article:section`: Collaborations

### Structured data (JSON-LD)

Two schema blocks per page:

**1. `Article` schema** (the editorial wrapper):
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "[title]",
  "description": "[description]",
  "image": "[heroImage Cloudinary URL]",
  "datePublished": "[date]",
  "author": [
    {
      "@type": "Person",
      "name": "Adrian Rasmussen",
      "url": "https://adrianrasmussen.com/about"
    },
    {
      "@type": "Person",
      "name": "[Collaborator Name]",
      "url": "[collaboratorSite]",
      "sameAs": ["[collaboratorInstagram URL]"]
    }
  ],
  "publisher": {
    "@type": "Person",
    "name": "Adrian Rasmussen",
    "url": "https://adrianrasmussen.com"
  }
}
```

**2. `CreativeWork` schema** (for co-created object shape):
```json
{
  "@context": "https://schema.org",
  "@type": "CreativeWork",
  "name": "[piece title]",
  "creator": [
    { "@type": "Person", "name": "Adrian Rasmussen", "url": "https://adrianrasmussen.com" },
    { "@type": "Person", "name": "[Collaborator Name]", "url": "[collaboratorSite]" }
  ],
  "dateCreated": "[date]",
  "image": "[heroImage URL]",
  "about": ["[seoKeyword 1]", "[seoKeyword 2]"]
}
```

### Update About-page `Person` schema

Each collaboration adds to Adrian's `Person` schema `knowsAbout` and indirectly to the entity graph. Add the collaborator's site to Adrian's `Person.knows` array:

```json
"knows": [
  { "@type": "Person", "name": "[Collaborator Name]", "url": "[collaboratorSite]" }
]
```

This is a literal Google-readable signal that Adrian's entity is connected to theirs.

## Sitemap integration

`scripts/generate-sitemap.ts` must include collaboration pages with image entries. Pattern matches what's done for artwork pages.

## Static HTML generation

`scripts/generate-static-route-html.ts` must generate static HTML for each collaboration page with all metadata and schema baked in *before* React hydrates. This is the most important SEO step — Google AI Overviews and AI crawlers may not execute JavaScript.

## Internal linking obligations

Whenever a collaboration page goes live:

1. Add a "Selected Collaborations" section to the About page with a link
2. Add a link from each `relatedArtworkId` artwork page back to the collaboration
3. Add a link from any `relatedWritingSlugs` writing back to the collaboration
4. If the collaboration touches Mandala work, link from the Mandala hub page
5. If the collaboration touches sacred-geometry work, link from any sacred-geometry article
6. Add a link from `/writings/` listing page

## Listing / hub page

A `/writings/collaborations/` route lists all collaborations, sortable by date, with:
- Hero image thumbnail
- Title
- Collaborator name (linking to their site)
- Excerpt
- Date

Use the existing `Writings.tsx` patterns as a starting structure.

## Value capture checklist (per Tier 0 in outreach intelligence doc)

When a collaboration ships, this is the agent-friendly checklist:

- [ ] Add Collaboration entry to `data/mockData.ts`
- [ ] Create hero image + gallery in Cloudinary with descriptive public IDs (`collaboration-[slug]-hero`, `collaboration-[slug]-detail-01`, etc.)
- [ ] Get a 2-sentence quote from the collaborator → `collaboratorQuote`
- [ ] Adrian writes a 2-sentence quote about them → `adrianQuote`
- [ ] Add the collaborator to About-page `Person.knows` schema
- [ ] Run `npm run sitemap` to regenerate sitemap with the new page
- [ ] Run `npm run build` to generate static HTML
- [ ] Verify the page renders with: title, description, OG image, both schema blocks
- [ ] Pitch the collaboration as a press story to Tier 3 outlets (`_outreach-intelligence.md`)
- [ ] Tag the collaborator on Instagram with link to the new page
- [ ] Add the collaboration to the next monthly mailing-list send
- [ ] Track the collaboration in `_outreach-intelligence.md` collaboration target list (status: Live)

## When to actually build this

Don't build the component until the first collaboration is confirmed. Premature abstraction is worse than ad-hoc the first time. The first one teaches us what the real fields and edge cases are. Generalize on the second.

**Trigger to build**: Adrian says "[collaborator name] said yes."

At that point: Claude Code agent reads this spec, implements `CollaborationPage.tsx`, adds the type to `types.ts`, adds the first entry to `mockData.ts`, generates the static HTML, and ships.

## Estimated build time when triggered

- Component + type + first entry: 60-90 min
- SEO + schema: 30 min
- Sitemap + static HTML integration: 30 min
- Playwright test for the route: 30 min
- **Total**: ~2.5-3 hours of focused work, one PR
