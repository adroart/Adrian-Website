---
name: adrian-website
status: active
stack: [Vite, React 18, TypeScript, Tailwind v4, React Router v7, Cloudflare Pages, Stripe]
deploy: https://adrianrasmussen.com
family: art
last_reviewed: 2026-05-16
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
- **Artwork / product data** → `src/data/mockData.ts`
- **Oracle card pages** → `src/pages/oracle/` (route `/oracle/universal-language/*`)
- **Creations / category pages** → `src/pages/creations/`
- **Shop** → `src/pages/ShopPage.tsx`
- **QR / oracle image generation** → `tsx scripts/` at repo root
- **SEO utilities for Universal Language** → `utils/universalLanguage.ts`

## Critical distinction: "Universal Language"
Two separate products share the same 64 artwork images:
1. **Art series** at `/creations/multidimensional-art/universal-language` — fine art, NO oracle framing in SEO
2. **Oracle deck** at `/oracle/universal-language` — interactive card reader, oracle framing correct here
Never conflate them. Never use "oracle" in alt text or meta for art-series routes.

## Design system
- Color palette: `paper / wood / stone / bronze` (defined in `src/index.css`)
- Fonts: Cormorant Garamond (serif body), Lato (sans), Cinzel (titles)
- No icons, no badges, no stickers — text and color only for states
- No em dashes — use commas, periods, or "to" for ranges
- Middle dot separator (·) for inline piece details

## SEO rules (enforced — do not override)
- Never use "wall art" anywhere on the site
- Never use "oracle" in SEO for art-series pages (`/creations/multidimensional-art/*`)
- UL alt text: `[Piece Name], Universal Language [Number]. Original multi-dimensional wooden sculpture by Adrian Rasmussen.`
- UL Cloudinary filename: `universal-language-[number]-[piece-name-slug]`
- UL pieces are multi-dimensional wooden sculptures — use that term in marketing and oracle contexts

## Deploy
Push to `main` → Cloudflare Pages auto-deploys. See `todo/README.md` for remaining tasks split into Claude tasks, Adrian tasks, and future items.
