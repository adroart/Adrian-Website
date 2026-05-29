# PiecePage (Store) Design Improvements

Audited April 2026 — 50 design suggestions organized by theme. Pulled out of `todo/future.md` during the 2026-05-29 TODO cleanup. Live PiecePage entry in `TODO.md` (under Future) points here.

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
- [ ] "Ships from Bali" — expand to two lines with bronze rule above (per the no-business-location rule, drop "Bali" reference; "Ships internationally" is fine)
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
- [ ] For UL pieces: add bridge link to oracle card page on mandalacodes.com (`mandalacodes.com/oracle/universal-language/:number`)
- [ ] Add `<figcaption>` below main image: "Detail · Studio Rasmussen, [year]"

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
