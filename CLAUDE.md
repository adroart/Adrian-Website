---
name: adrian-website
status: active
stack: [Vite, React 18, TypeScript, Tailwind v4, React Router v7, Cloudflare Pages, Stripe]
deploy: https://adrianrasmussen.art
family: art
last_reviewed: 2026-05-10
---

# Adrian Rasmussen Art Website — personal portfolio + shop

## What this is
Personal art website for Adrian Rasmussen, a multidisciplinary artist based in Bali. Showcases creations, writings, a shop, and commission inquiries. No backend — all data lives in `src/data/mockData.ts`. Stripe for payments via Checkout Sessions.

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
Push to `main` → Cloudflare Pages auto-deploys. See `todo/README.md` for remaining tasks split into Claude tasks, Adrian tasks, and future items.
