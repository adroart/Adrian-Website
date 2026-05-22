# Work Index

Last updated: 2026-05-22

This is the durable map for the recent SEO, AI search, mandala, laser-cut art, glowing crystal, and Universal Language oracle work. Use this before digging through the commit history.

## Fast Paths

- SEO and AI-search dashboard: `docs/research/seo/index.html`
- SEO research index: `docs/research/seo/README.md`
- Keyword map: `docs/research/seo/2026-05-20-keyword-map-mandala-laser-cut.md`
- 12-month execution plan: `docs/research/seo/2026-05-20-12-month-execution-plan.md`
- AI citation playbook: `docs/research/seo/2026-05-20-ai-citation-and-brand-presence-playbook.md`
- Google AI search guidance notes: `docs/research/seo/2026-05-20-google-ai-search-guidance.md`
- Collaboration page spec: `docs/research/seo/2026-05-22-collaboration-page-spec.md`
- Oracle handoff: `oracle/ANCHOR.md`
- Oracle intent: `oracle/VISION.md`
- Oracle writing method: `oracle/WRITING_METHOD.md`
- Oracle market positioning: `oracle/MARKETING_POSITIONING.md`

## SEO Work

The SEO research is centered on building from high-fit specific terms into broader authority terms.

Primary clusters:
- Mandala art, original mandala art, sacred geometry mandala art, laser-cut mandala art.
- Laser-cut art, laser-cut wood art, layered wood art, geometric wood art.
- Yemingzhu, ye ming zhu, night shining pearl, glowing crystal, glowing crystal art, crystal light art, illuminated crystal sculpture.
- High-value commission and collector intent around custom, original, large-format, and gallery-grade work.

Important implementation files:
- `components/LaserCutWoodArtPage.tsx`
- `utils/seoMetadata.ts`
- `utils/artworkFilters.ts`
- `scripts/validate-seo.ts`
- `scripts/generate-sitemap.ts`
- `public/sitemap.xml`
- `useSeoMeta.ts`
- `hooks/useMetaTags.ts`
- `App.tsx`

Raw research exports are under `.firecrawl/`. They are evidence files, not the canonical strategy layer. The cleaned decision-ready layer lives under `docs/research/seo/`.

Canonical public domain: `https://adrianrasmussen.com`.

## Local Dashboard

Open the dashboard directly in a browser:

```text
file:///Users/adrianrasmussen/Documents/Files/2%20Areas/Coding/Adrian-Website/docs/research/seo/index.html
```

The dashboard contains:
- Strategy overview.
- Keyword map.
- Route map.
- Source file map.
- Agent runbook.
- Links to the Markdown research files.

It is local-only unless deliberately moved into the public app.

## Oracle Work

The Universal Language oracle work is tracked separately from the art-series SEO work.

Start with:
- `oracle/ANCHOR.md`, current state and handoff.
- `oracle/VISION.md`, what the deck is for and the six-section card structure.
- `oracle/WRITING_METHOD.md`, the locked writing method.
- `oracle/MARKETING_POSITIONING.md`, product ladder, language rules, and positioning.

Important implementation files:
- `components/UniversalLanguageCard.tsx`
- `components/oracle/ChapterWordmark.tsx`
- `components/oracle/CoinCast.tsx`
- `components/oracle/ReadingStage.tsx`
- `data/synthesisData.ts`
- `oracle/sections/keys/`
- `oracle/sections/design/`
- `oracle/sections/relations/`
- `oracle/generated/`

Keep the two Universal Language surfaces distinct:
- Art series: `/creations/multidimensional-art/universal-language`
- Oracle experience: `/oracle/universal-language`

## Commit Trail

Recent commits that contain the work:

- `2c5ccc9` Oracle: synthesis foundation, guides, vault wiring, UI rework, generator.
- `873fa09` docs(oracle): add `VISION.md` intent doc, lock six-section card structure.
- `f59546d` oracle: Stage A2 writing method plus KEYS section for all 64 cards.
- `56cfb6f` oracle(keys): diversify opening sentences across scaffold cards.
- `dfd2b0e` oracle: DESIGN section for all 64 cards plus brief and diversification pass.
- `80c9a6a` oracle(design): bridge-rewrite all 64 cards.
- `626f70d` oracle(card): RELATIONS as TCG-style correspondence sheet plus reading-stage band.
- `668b6ce` Expand SEO research with Yemingzhu and crystal keyword clusters.
- `0489352` oracle: refine card actions and anchor handoff.
- `4e63920` docs: refresh agent review date.
- `8b63b09` Refine chapter strip widths and labels.

## Verification Commands

Use these before committing related changes:

```bash
npm run typecheck
npm run seo:check
npm run build
git diff --check
```

For SEO-only dashboard edits, also verify the local HTML links and mobile/desktop rendering if the HTML changed.

