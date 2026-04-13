# Future Development

Not for launch or first month. Revisit as the site matures.

---

## PiecePage (Store) Design Improvements
Audited April 2026 — 50 design suggestions organized by theme.

### Typography & Hierarchy
- [ ] Increase title size to `text-5xl md:text-6xl` — currently too small relative to the image
- [ ] Switch description to `font-serif italic` (Cormorant) — art writing voice, not product copy
- [ ] Push description `leading-[1.7]` to `leading-[2]` — more contemplative feel
- [ ] Breadcrumb: lighter weight (`font-normal`), `text-wood-400`, remove all-caps on piece name
- [ ] Apply `.drop-cap` to first paragraph of description (already in index.css, used in About)
- [ ] Price as a typographic moment: larger (`text-4xl`), own line, bronze accent under it

### Layout & Spatial Structure
- [ ] Full-bleed hero image on mobile (remove horizontal padding around image)
- [ ] Replace 5-column thumbnail row with vertical thumbnail strip on left side of main image
- [ ] Align image and details panel to same top baseline on desktop
- [ ] Set fixed `aspect-ratio: 4/5` or `aspect-square` container on image to prevent layout jumps
- [ ] Add faint `border-l border-wood-100` between columns on desktop (printed spread feel)
- [ ] Increase top padding to `pt-32 md:pt-40` — this is a destination, not a list item
- [ ] Remove box border from purchase section on desktop, use `border-t` + background only
- [ ] Metadata: label `text-[10px] uppercase wood-500`, value `text-lg font-serif wood-900`

### Color & Texture
- [ ] Add noise texture (from footer-noise SVG) to image background placeholder
- [ ] Upgrade description bronze border to `border-l-2 border-bronze-400 pl-6` (too thin currently)
- [ ] Breadcrumb separator: use `·` instead of `/`
- [ ] Add `bg-paper-100/60` wash behind right column on desktop (gallery vs reading space)
- [ ] Replace availability chip backgrounds with text + ink-rule treatment (no `bg-wood-100` chips)

### Motion & Interaction
- [ ] Cross-fade between thumbnail images (fade out → swap → fade in)
- [ ] Stagger entrance: left image and right column reveal independently (use reveal-block)
- [ ] Replace "Tap to enlarge" pill with cursor change + faint corner crosshair SVG on hover
- [ ] Share feedback: floating toast above button instead of replacing button label
- [ ] Smooth scroll to purchase section when sticky bar price is tapped

### Purchase / Configurator
- [ ] Size variant labels: reduce to `text-base`, sub-line for status in `text-sm text-wood-500`
- [ ] Add `border-t border-wood-100` between each add-on checkbox item
- [ ] Remove "Add to your piece" heading — the checkboxes are self-explanatory
- [ ] "Ships from Bali" — expand to two lines with bronze rule above
- [ ] Add `<figure>` + `<figcaption>` semantic wrapper around main image

### Related Works
- [ ] Replace generic related works subtext with series-voice copy (e.g. "Each piece carries a different frequency")
- [ ] Change `lg:grid-cols-4` to `lg:grid-cols-3` — more space, more contemplative
- [ ] Sold related pieces: remove `opacity-60`, add "In a private collection" caption instead
- [ ] Related cards: add `series name · medium` caption line below title

### Information Architecture
- [ ] Story link: remove box, use `border-l-2 border-bronze-300 pl-4` only (no background box)
- [ ] Add collapsible "Details" section with material process + creation notes
- [ ] Move category label to above title as eyebrow (not orphaned at bottom of right column)
- [ ] For UL pieces: add bridge link to oracle card page (`/oracle/universal-language/:number`)
- [ ] Add `<figcaption>` below main image: "Detail · Studio Rasmussen, Bali, [year]"

### Mobile
- [ ] Mobile breadcrumb: add piece title in `font-serif italic text-wood-700` below back button
- [ ] Mobile metadata block: remove border box, use dotted leader lines only
- [ ] Image swipe dots: increase to `w-3 h-3`, more spacing for touch targets
- [ ] Sticky bar: also hide when user scrolls into Related Works section
- [ ] Sticky bar price: use `text-lg font-medium` to prevent truncation at 320px

### Peripheral
- [ ] Bookmark/wishlist icon beside Share (highlights on click, stores to localStorage)
- [ ] Prev/next piece navigation within a series (at bottom of right column)
- [ ] Faint rotated series watermark text along left margin behind image (pure atmosphere)

---

## Features
- [ ] Re-add featured creations gallery to homepage (was "Selected Works" masonry grid with GalleryTileCard)
- [ ] Re-add "Selected Works" section to Creations page (was featured pieces grid shown when no category filter active)
- [ ] Re-add "Available Now" section to Creations page (was ready-to-ship pieces with link to Shop)
- [ ] Global site search
- [ ] "Recently Viewed" pieces (localStorage)
- [ ] Image comparison slider for Illuminated Works (day vs night)
- [ ] Pricing explorer tool (interactive sliders for size + finish)
- [ ] Currency selector for international visitors
- [ ] PWA capabilities (Service Worker + manifest)
- [ ] Print stylesheet for collectors
- [ ] "Save for Later" / wishlist
- [ ] "Notify Me" for sold-out pieces

## E-Commerce
- [ ] Re-enable custom laser cut frame add-on (temporarily disabled, needs pricing finalized)
- [ ] Apple Pay / Google Pay express checkout
- [ ] Made-to-order deposit structure (50% upfront, 50% on completion)
- [ ] Abandoned cart recovery
- [ ] Order tracking post-purchase
- [ ] Inventory management synced with Stripe
- [ ] Edition tracking system (real-time counts)

## SEO
- [ ] Dynamic og:image per artwork page (show actual piece when shared)
- [ ] Additional structured data (ImageGallery, FAQ)
- [ ] Keyword strategy execution for primary opportunities
- [ ] Per-category/series meta descriptions

## Infrastructure
- [ ] End-to-end tests (Playwright/Cypress)
- [ ] Error monitoring (Sentry)
- [ ] Heat mapping for post-launch optimization
- [ ] Headless CMS migration (when mockData.ts becomes unmaintainable)
- [ ] Cloudflare Images migration (if outgrowing Cloudinary free tier)
- [ ] Route-level error boundaries
- [ ] Intersection-based infinite scroll for Store
- [ ] Backup strategy for content, images, and order data

## Content (Adrian)
- [ ] NFT integration for legacy documentation
- [ ] QR codes on physical plaques
- [ ] Virtual tours / 3D piece viewing
- [ ] Client portal for commission progress tracking
- [ ] Events calendar
- [ ] Press / media section
- [ ] Process videos for The Practice (Writings)
- [ ] Installation project documentation (2-3 projects)
