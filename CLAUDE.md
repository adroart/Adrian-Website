# Adrian Rasmussen Art Website

## Project Overview
Personal art website for Adrian Rasmussen, a multidisciplinary artist based in Bali. The site showcases creations, writings, a shop, and commission inquiries.

## Tech Stack
- Vite + React 18 + React Router v7 + Tailwind CSS 4.2 + TypeScript
- No backend — all data lives in `src/data/mockData.ts`
- Deployed on Cloudflare Pages (merging to `main` triggers deploy)
- Stripe for payments (Checkout Sessions)

## Design System
- **Color palette:** paper / wood / stone / bronze (defined in `src/index.css`)
- **Fonts:** Cormorant Garamond (serif body), Lato (sans), Cinzel (titles)
- **No icons, no badges, no stickers** — text and color only for states
- **No em dashes** in any copy — use commas, periods, or "to" for ranges

## Site Architecture

### Pages & Routes
- `/` — Homepage with hero, Selected Works, about preview
- `/creations` — 8 category tiles (Multi Art, Illuminated Works, Jewelry, Oracle Cards, Tables, Installations, Objects, Spaces)
- `/creations/multidimensional-art` — Hub page with subcategory tiles
- `/creations/multidimensional-art/:subcategory` — Subcategory pages (universal-language, mandala, light-codes, signature-pieces)
- `/creations/illuminated-works` — Experiential page about illuminated art
- `/creations/:id` — Individual piece pages
- `/writings` — Stories, essays, explorations
- `/writings/:slug` — Individual writing pages
- `/shop` — Ready-to-ship and made-to-order items
- `/inquire` — Commission inquiry form
- `/about` — Artist bio and philosophy
- `/teajia` — Tea culture project

### Key Components
- `src/components/` — All React components
- `src/data/mockData.ts` — All artwork, writing, and product data
- `src/types.ts` — TypeScript type definitions

## Voice & Tone
- Personal, mystical, but non-prescriptive
- Never pushy or commercial-feeling
- Use middle dot separator (·) for inline piece details (dimensions · material · year)

## Current Status
- Site is functional but uses placeholder images (Cloudinary placeholders)
- Stripe payment links are placeholders
- See `todo/README.md` for all remaining work (split into Claude tasks, Adrian tasks, and future items)

## Working With This Codebase
- When editing components, check `mockData.ts` for data structure
- Route order in `App.tsx` matters — static routes before `:id` catch-all
- Categories with a `link` property in `CREATION_CATEGORIES` use Router navigation; others use filter state
- Bidirectional story linking: pieces have `relatedStorySlug`, writings check `location.state.openStory`
