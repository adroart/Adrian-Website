---
name: adrian-website
status: active
stack: [Vite, React 18, TypeScript, Tailwind v4, React Router v7, Cloudflare Pages Functions, D1, R2, Better Auth, Stripe]
deploy: https://adrianrasmussen.com
family: art
last_reviewed: 2026-08-28
---

# Adrian Rasmussen Art Website — personal portfolio + shop

## What this is
Personal art website for Adrian Rasmussen, a multidisciplinary artist. It showcases creations, writings, a shop, commission inquiries, customer accounts, and the canonical artwork registry. Catalog content is compiled from local data. Cloudflare Pages Functions, D1, and R2 provide the backend.

## Stack & constraints
- Vite + React 18 + TypeScript + Tailwind CSS 4.2 + React Router v7
- Cloudflare Pages Functions with shared D1 accounts and registry data, plus R2 backups
- Better Auth for customer and administrator sessions
- Cloudflare Pages (merging to `main` triggers deploy)
- Stripe Checkout Sessions (payment links currently placeholders)

## Entry points
- `src/main.tsx` — app bootstrap
- `src/App.tsx` — route definitions (static routes BEFORE `:id` catch-alls — order matters)
- `data/mockData.ts`: primary compiled artwork, writing, and product catalog
- `src/types.ts` — TypeScript type definitions

## Where to look for…
- **Collector journey — the settled flow (READ BEFORE BUILDING ANY OF IT)** → `todo/plans/collector-screen-wording.md` is the master record: every screen's locked wording in Adrian's voice, the privacy model, the passing mechanic, the rules. Its two companions render the flow visually: `todo/plans/collector-flow-preview.html` (every screen as a phone card) and `todo/plans/collector-flow-chart.html` (the whole journey with branches). Open all three before touching registration, the piece page, unlock, transfer, or onboarding. The wording is locked; do not paraphrase it.
- **QR registry and rules** → `data/qrRegistry.ts` (single source of truth for every issued QR code)
- **Works page (permanent artwork record)** → `components/WorksPage.tsx` at `/works/:id`
- **QR index (private registry)** → `components/QRIndex.tsx` at `/qr`
- **QR redirect function** → `functions/qr/[number].js` (Cloudflare Function, permanent infrastructure)
- **Artwork / product data** → `data/mockData.ts`
- **Accounts and registry data** → `functions/api/`, `migrations/`, and the shared D1 database
- **Registry source-chain import** → `utils/atlasSourceImport.ts` and `scripts/import-atlas-source.ts`
- **Public Atlas projection** → `functions/api/atlas.js` at `/api/atlas`
- **Creations / category pages** → `components/Creations.tsx`, `components/MultidimensionalArt.tsx`, `components/SubcategoryPage.tsx`
- **Shop** → `components/Store.tsx`
- **Oracle hub page (directory only)** → `components/OracleGateway.tsx` at `/oracle`
- **SEO utilities for Universal Language art series** → `utils/universalLanguage.ts`

## "Universal Language" — art series only on this site
The art series at `/creations/multidimensional-art/universal-language` is the
only Universal Language presence on this site. The companion *oracle deck* of
the same 64 pieces lives at **mandalacodes.com** as its own project. The
`/oracle` page on this site is a small directory that points there.

Old oracle URLs (`/oracle/universal-language/:n`, `/universal-language/:n`,
`/creations/oracle-cards/*`) redirect to the matching page on mandalacodes via
inline external-redirect components in `App.tsx`.

SEO copy on art-series pages cross-links to mandalacodes so the deeper project
remains discoverable; oracle framing belongs on mandalacodes, not here.

## Design system
- Color palette: `paper / wood / stone / bronze` (defined in `src/index.css`)
- Fonts, three roles, and nothing else: `--font-display` Cormorant Garamond (titles,
  headings, the brand name), `--font-body` Lora (running text), `--font-label` Karla
  (uppercase eyebrows, meta, data). `--font-tabular` for real monospace.
  Do NOT use `--font-sans` or `--font-mono`: they are Tailwind's built-in slot names,
  kept only so existing `font-sans` / `font-mono` classes keep rendering, and they are
  misleading — `--font-sans` resolves to Lora, a serif, and `--font-mono` to Karla, a
  sans. (This entry used to say "Lato"; Lato has not been loaded for some time, and six
  components referenced it and were silently falling back to Helvetica.)
- Text colour starts at the 600 step. The 300/400/500 steps of the wood and bronze
  scales fail WCAG AA on the light grounds (measured 1.52:1 to 3.91:1) and are border
  and background colours only. Inside a `.dark-preserve` band the scale is NOT
  inverted, so text there needs a LIGHT step instead — never blanket find-and-replace
  a text colour class across the codebase. `npm run test:e2e` covers this.
- No icons, no badges, no stickers — text and color only for states
- No em dashes — use commas, periods, or "to" for ranges
- Middle dot separator (·) for inline piece details

## SEO rules (enforced — do not override)
- Never use "wall art" anywhere on the site
- Never use "oracle" in SEO for art-series pages (`/creations/multidimensional-art/*`). The oracle framing belongs on mandalacodes.com, not here.
- UL meta descriptions should mention that the companion oracle deck lives at mandalacodes.com (one creator, two SEO surfaces)
- UL alt text: `[Piece Name], Universal Language [Number]. Original multi-dimensional wooden sculpture by Adrian Rasmussen.`
- UL Cloudinary filename: `universal-language-[number]-[piece-name-slug]`
- UL pieces are multi-dimensional wooden sculptures — use that term in marketing

## Deploy
Push to `main` → Cloudflare Pages auto-deploys. Remaining work lives in `TODO.md` at the project root (the old `todo/` folder was retired 2026-05-29).

## TODO format
`TODO.md` items follow the workspace convention: `- [ ] **Bold lead.** _(band: agent-runnable | you-required | routine)_ One descriptive sentence.` with an optional link/detail line underneath pointing to the full plan doc, PR, or referenced files. Group items under `## Soon` / `## Pre-launch` / `## Future` / `## Operational notes`. The band hint tells the i64os Temple page which lane to render the item in.
