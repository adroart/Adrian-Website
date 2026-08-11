---
name: adrian-website
status: active
stack: [Vite, React 18, TypeScript, Tailwind v4, React Router v7, Cloudflare Pages, Stripe]
deploy: https://adrianrasmussen.com
family: art
last_reviewed: 2026-08-11
---

# Adrian Rasmussen Art Website — personal portfolio + shop

## What this is
Personal art website for Adrian Rasmussen, a multidisciplinary artist. Showcases creations, writings, a shop, and commission inquiries. No backend — all data lives in `src/data/mockData.ts`. Stripe for payments via Checkout Sessions.

## Stack & constraints
- Vite + React 18 + TypeScript + Tailwind CSS 4.2 + React Router v7
- No backend — all content in `src/data/mockData.ts`
- Cloudflare Pages (merging to `main` triggers deploy)
- Stripe Checkout Sessions (payment links currently placeholders)

## Entry points
- `src/main.tsx` — app bootstrap
- `src/App.tsx` — route definitions (static routes BEFORE `:id` catch-alls — order matters)
- `src/data/mockData.ts` — ALL artwork, writing, and product data lives here
- `src/types.ts` — TypeScript type definitions

## Where to look for…
- **Collector journey — the settled flow (READ BEFORE BUILDING ANY OF IT)** → `todo/plans/collector-screen-wording.md` is the master record: every screen's locked wording in Adrian's voice, the privacy model, the passing mechanic, the rules. Its two companions render the flow visually: `todo/plans/collector-flow-preview.html` (every screen as a phone card) and `todo/plans/collector-flow-chart.html` (the whole journey with branches). Open all three before touching registration, the piece page, unlock, transfer, or onboarding. The wording is locked; do not paraphrase it.
- **QR registry and rules** → `data/qrRegistry.ts` (single source of truth for every issued QR code)
- **Works page (permanent artwork record)** → `components/WorksPage.tsx` at `/works/:id`
- **QR index (private registry)** → `components/QRIndex.tsx` at `/qr`
- **QR redirect function** → `functions/qr/[number].js` (Cloudflare Function, permanent infrastructure)
- **Artwork / product data** → `data/mockData.ts`
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
- Fonts: Cormorant Garamond (serif body), Lato (sans), Cinzel (titles)
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
