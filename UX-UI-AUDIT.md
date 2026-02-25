# UX/UI Audit Report: Adrian Rasmussen Art Website

**Audit Date:** February 25, 2026
**Auditor Perspective:** High-end design, fine art marketing, artist business strategy
**Scope:** Full site, every page, every component, all data, all styles
**Stack:** Vite + React 18 + React Router v7 + Tailwind CSS 4.2 + TypeScript

---

## Executive Summary

This site has genuine bones. The color palette is refined, the typography carries weight, and the philosophical voice is unlike anything else in art e-commerce. Adrian's positioning as a "Technician of the Sacred" is distinctive and defensible.

But the site is not ready to sell to serious collectors. Placeholder images destroy credibility on contact. The commerce flow is broken at checkout. Several pages have unfinished copy flagged with TODO markers. And there are dozens of smaller UX friction points that, taken together, erode the feeling of craftsmanship that the brand promises.

Below are 85 specific findings, organized by severity and area. Each one is actionable.

---

## I. FIRST IMPRESSIONS AND TRUST (Items 1 to 12)

### 1. Every single artwork image is a placeholder
All `coverImage` and `galleryImages` fields in `mockData.ts` point to `picsum.photos` or Unsplash randoms. A collector arriving at the site sees stock photography where sacred geometry should be. This is the single most damaging issue. Nothing else matters until real images are in place.

### 2. Open Graph preview image is a random Unsplash photo
The `<meta property="og:image">` in `index.html` links to an external Unsplash URL. When someone shares the site on Instagram, LinkedIn, or iMessage, the preview shows a generic landscape, not Adrian's work. This is a missed branding moment on every share.

### 3. Hero video is hosted on Wix
The full-viewport hero loads a video from `video.wixstatic.com`. This introduces a third-party dependency for the single most important visual moment on the site. If Wix throttles bandwidth or changes URLs, the hero breaks silently. The video should be self-hosted on Cloudflare or converted to an optimized MP4/WebM.

### 4. No video fallback
If the hero video fails to load (slow connection, blocked CDN, mobile data saver), users see a black void. There is no `<img>` poster fallback. On a high-end art site, this first impression gap is severe.

### 5. Hero tagline is abstract without context
"Bringing the formless into form" is poetic but tells a first-time visitor nothing about what Adrian makes or sells. A collector who lands here from a Google search or Instagram link has no immediate signal that this is a fine art studio offering sacred geometry, illuminated works, and custom commissions. The subhead helps, but it appears smaller and lower.

### 6. No social proof above the fold
The About page mentions 120+ exhibitions since 2009, collaborations with festivals, and decades of practice. None of this appears on the homepage. A single line of credibility ("120+ exhibitions worldwide since 2009") near the hero would ground the mystical positioning in real-world authority.

### 7. The `/welcome` page exists but is orphaned
`Welcome.tsx` provides an alternative landing with a dark, minimal card layout and navigation buttons. But no route in the main navigation links to it, and no external campaign points to it. It is dead weight or an unreferenced experiment.

### 8. Teajia top banner lacks context
The fixed banner above the navigation links to teajia.com but provides no explanation of what Teajia is or why a visitor should care. For anyone who is not already familiar with Adrian's tea practice, this is a mysterious distraction from the art site.

### 9. The `/teajia` route is declared but has no component
The route exists in `App.tsx` but renders the Welcome page or nothing meaningful. If someone clicks through expecting tea culture content, they hit a dead end.

### 10. No favicon or touch icon visible in config
The `index.html` has no `<link rel="icon">` tag. Browsers show a generic blank tab icon. For a visual artist, the browser tab is a micro-branding opportunity.

### 11. Page title is good but static
`<title>Adrian Rasmussen | Resonant Artifacts</title>` is well-crafted, but the `useSeoMeta` hook updates `document.title` per route. Verify that the fallback title loads correctly on direct navigation and that each route title is distinct for search engines.

### 12. No loading or transition state between routes
When navigating between pages, there is no visual indicator that the next page is loading. On slower connections, the site appears frozen. A minimal page transition (fade, progress bar, or skeleton) would preserve the feeling of responsiveness.

---

## II. NAVIGATION AND INFORMATION ARCHITECTURE (Items 13 to 24)

### 13. No clear call-to-action hierarchy
The homepage presents "Explore the Work," "Begin an Inquiry," "Explore All," and "Read" as concurrent CTAs. There is no visual weight distinguishing the primary action (likely "Shop" or "Inquire") from secondary browsing. A serious buyer does not know where to click first.

### 14. "Creations" is ambiguous as a nav label
For someone unfamiliar with the brand, "Creations" could mean blog posts, courses, or anything else. "Work" or "Gallery" would be more immediately understood while still feeling elevated.

### 15. Mobile hamburger menu is small
The hamburger icon is 24px. Apple Human Interface Guidelines recommend 44x44px minimum touch targets. On a phone, this is easy to miss or mis-tap.

### 16. Mobile menu auto-closes on navigation with no transition
When a user taps a link in the mobile menu, the menu vanishes instantly and the new page appears. There is no closing animation or scroll-to-top confirmation. It feels abrupt.

### 17. Active nav state is too subtle on mobile
On desktop, the active page gets an underline. On mobile, only the text color changes slightly. In the mobile menu, the active page should be clearly distinguished (bold, underline, or background highlight).

### 18. Category routing is inconsistent
Multidimensional Art and Illuminated Works have dedicated route pages (`/creations/multidimensional-art`, `/creations/illuminated-works`). The other six categories (Jewelry, Oracle Cards, Tables, Installations, Objects, Spaces) use query-string filtering (`/creations?category=Jewelry`). Users experience two different UI patterns for the same conceptual action.

### 19. No breadcrumbs on the main Creations page
Subcategory pages and piece pages have breadcrumbs, but the main `/creations` gallery does not. When a user filters by category, they lose context of where they are in the hierarchy.

### 20. Back-to-top button appears at inconsistent scroll depths
Multiple components (Footer, Creations, Writings, Store) each implement their own back-to-top button with a 600px scroll threshold. Some pages are short enough that the button appears almost immediately; on longer pages it takes significant scrolling. The behavior should be unified and proportional to page length.

### 21. About page has no section navigation on mobile
The About page is 8 long sections (5000px+ of scroll). On desktop, a sticky side nav with dot indicators lets users jump between sections. On mobile, this navigation is completely hidden. Mobile users must scroll the entire page linearly.

### 22. Writings page has no search
There are 6+ stories with more planned. The sticky category nav helps, but there is no text search. As the writing catalog grows, discoverability will degrade.

### 23. Footer navigation duplicates header but with different labels
The footer has four columns (Index, Studio, Information, Connect) with links that partially overlap the header navigation but use different naming. "Index" contains "Selected Works" (which links to `/creations`). In the header, the same page is called "Creations." Consistent labeling builds trust.

### 24. Cart badge caps at "9+"
The cart icon shows a count badge, but at 9 items it displays "9+" regardless of actual count. For a collector building a large order, this feels imprecise. Show the real number, or at least cap at "99+."

---

## III. GALLERY AND BROWSING EXPERIENCE (Items 25 to 38)

### 25. Masonry layout causes column-jumping on load
The CSS Columns masonry in Creations and SubcategoryPage starts at 1 column and snaps to 3 or 4 as the viewport is measured. This causes a visible layout shift on page load. Consider using a fixed initial column count or a skeleton loader to prevent the jump.

### 26. Filter bar appears only after scrolling past the category grid
On the main Creations page, the sticky filter bar with sort, availability toggle, and breadcrumb only becomes visible after the user scrolls past the initial category tiles. New visitors may not realize filtering exists.

### 27. Active filters are not persistently visible
When a user applies filters (category, availability, collection), the filter panel collapses. There is no persistent chip or tag showing what filters are active. Users forget what they have filtered by and see unexpected results.

### 28. Sort options only appear when a category is selected
The sort dropdown (Default, Price ascending, Price descending, Newest) is hidden until the user filters by category. This is unexpected. Sorting should be available at all times.

### 29. "Selected Works" label is ambiguous
When viewing the unfiltered Creations page, the heading says "Selected Works." This could mean curated highlights or all works. It actually shows the first 12 featured pieces. The distinction is unclear to visitors.

### 30. Collection cards have no keyboard alternative
Within a filtered category, collection cards (series groups) can be toggled by clicking. There is a visual ring + scale effect, but no explicit keyboard focus or ARIA toggle state for screen reader users.

### 31. Gallery tile aspect ratios are wildly inconsistent
Because placeholder images have random dimensions, the masonry grid looks chaotic. Even with real images, there is no aspect-ratio enforcement. Consider standardizing image crops or using a controlled set of aspect ratios (4:5, 1:1, 5:4) so the grid feels curated rather than random.

### 32. No hover preview or quick-view on gallery tiles
Gallery tiles show title and category on hover, but no price, availability, or quick-view option. In the Store, hovering shows "View Piece." In Creations, it does not. The interaction model differs between the two grids.

### 33. Illuminated Works gallery shows only 5 pieces
The Illuminated Works experiential page displays a small gallery at the bottom with only 5 pieces. There is no "View all illuminated works" link that filters the main gallery. Users who want to browse more are stuck.

### 34. Multidimensional Art subcategory tiles hide descriptions on mobile
The 4 subcategory tiles on `/creations/multidimensional-art` show descriptions only on hover (opacity transition). On mobile, there is no hover. The descriptions are invisible, and users only see the subcategory names over images.

### 35. Subcategory filter bar uses horizontal scroll with hidden scrollbar
On mobile, the filter chips in SubcategoryPage overflow horizontally with `scrollbar-hide`. There is no visual indicator that more filters exist off-screen. Users may not realize they can scroll.

### 36. Empty filter states could be more helpful
When filters return no results, the empty state says something like "No pieces match your filters" with a "Clear all filters" button. It could additionally suggest related categories or show the closest matches.

### 37. No "back to results" state after viewing a piece
When a user clicks into a piece from a filtered gallery and then hits the browser back button, filter state is preserved via URL params (good), but scroll position is lost. The user lands at the top of the gallery instead of where they left off.

### 38. Image lazy loading has no blur-up or skeleton
Images use `loading="lazy"` but have no placeholder shimmer, blur-up effect, or aspect-ratio container. As images load, the layout shifts and white gaps flash in.

---

## IV. INDIVIDUAL PIECE PAGES (Items 39 to 48)

### 39. Made-to-order configuration modal is not implemented
PiecePage has state management for size selection, add-ons (crystals, wood frame, illumination, custom frame), and dynamic pricing. But the "Configure Design" button is a stub. Clicking it does nothing. This is a broken conversion path for the highest-value items.

### 40. Add-on pricing is defined but has no UI
`MADE_TO_ORDER_ADD_ONS` in `mockData.ts` defines crystals ($150), wood frame ($200), illumination ($250 to $600 by size), and custom frame ($400). None of this is surfaced in a configuration interface. Buyers cannot see or select these options.

### 41. Edition scarcity messaging needs real data
The progressive scarcity system ("Final one available," "Few remaining," "Limited edition") is well-designed in code, but all edition numbers are mock data. If launched with fake scarcity, it damages trust permanently when collectors compare notes.

### 42. No "Finishes" showcase modal
The piece page references a "See what's possible" link for finishes (Natural, Painted, Gold Leaf, LED) but the modal is not built. Customization is a key selling point and has no visual representation.

### 43. Related pieces algorithm is basic
Related pieces are pulled from the same series and same category, then shuffled. There is no weighting by price range, availability, or visual similarity. A collector viewing a $2,400 mandala might see a $180 oracle card as "related."

### 44. No "Read the story behind this piece" link on PiecePage
The data model supports `relatedStorySlug` for bidirectional linking between pieces and writings. But the piece page does not render a prominent link to the related story. The narrative-to-art connection, one of the site's strongest differentiators, is invisible.

### 45. Image gallery has no swipe gesture on mobile
The piece page image gallery likely requires tap-to-advance. On mobile, users expect swipe gestures for image galleries. Without them, the gallery feels static.

### 46. Lightbox has no visible close affordance
When the image lightbox opens (full viewport), the close mechanism is not immediately visible. Users unfamiliar with the pattern may feel trapped.

### 47. Sticky mobile CTA bar may obscure content
On mobile, a sticky bar at the bottom shows the price and purchase button. This is good for conversion, but if it overlaps the last paragraph of the piece description or the specs grid, content is hidden behind it.

### 48. JSON-LD structured data is present but needs real values
PiecePage embeds JSON-LD for SEO (good). But with placeholder images and mock prices, search engines will index incorrect data. This must be updated before launch.

---

## V. SHOP AND COMMERCE (Items 49 to 60)

### 49. Every Stripe Price ID is a placeholder
All 40+ `stripePriceId` values in `mockData.ts` follow the pattern `price_[PIECE_ID]_REPLACE_WITH_REAL_ID`. Checkout will fail for every item. This is the primary commerce blocker.

### 50. No Stripe API key configuration visible
There is no `VITE_STRIPE_PUBLIC_KEY` environment variable referenced in the visible codebase, and no `.env.example` documenting required variables. The Stripe integration is not wired up.

### 51. Cart has no persistence
The cart uses React context with no `localStorage` backup. If a user refreshes the page, adds items, and then navigates away, the cart is empty on return. For a considered purchase (art at $500+), session persistence is essential.

### 52. No shipping address collection
The checkout flow has no address form. Stripe Checkout can collect addresses, but the site does not pass that configuration. For physical art pieces, shipping destination affects cost and feasibility.

### 53. No tax calculation
There is no visible tax calculation logic. Depending on Adrian's business registration and the buyer's location, sales tax or VAT may be required. This is a legal compliance issue.

### 54. Inspection drawer body scroll lock can trap users
When the Store inspection drawer opens, `overflow: hidden` is applied to the body. If the drawer's close button fails or is not found, the user cannot scroll the page. There is no escape-key handler on the drawer.

### 55. Search placeholder is vague
The Store search input says "Search pieces..." but actually searches across title, category, material, and description. Communicating the breadth of search ("Search by title, material, or category...") would encourage more use.

### 56. "Curated philosophy" interstitial interrupts browsing
Every 5th item in the Store grid, a text block about the curation philosophy appears. While the sentiment is on-brand, it breaks the visual scanning rhythm. A collector scrolling through products has to parse unexpected text blocks. Consider placing philosophy content above or below the grid, not inside it.

### 57. Load More pagination loses context
The Store shows 12 items initially with a "Load More" button. After loading more, there is no scroll anchor. The page extends and the user must re-orient. Infinite scroll or a "page 2 of 4" indicator would be smoother.

### 58. Product availability badges use similar colors
"Ready to Ship" and "Made to Order" use `#1A1A1A` and `#6B6B6B` respectively. On a quick scan, these look nearly identical. More visual distinction (a warm bronze for ready, a neutral gray for made-to-order) would help buyers instantly sort what they can have now versus what requires waiting.

### 59. Archived/Sold items show in the grid with reduced opacity
Sold items appear grayed out in the shop. This signals scarcity (good) but also clutters the grid with items that cannot be purchased. A toggle to "Show sold pieces" (defaulting to hidden) would clean up the browsing experience.

### 60. Zoom interaction allows over-panning
The ZoomableImage component in the Store drawer zooms to 2.5x and allows drag panning, but there are no boundary constraints. Users can drag the image completely off-screen and see only white space.

---

## VI. INQUIRY AND FORMS (Items 61 to 68)

### 61. Silent early submission is invisible to the user
The Inquire form sends a "silent submit" as soon as name, email, and vision are filled in, before the user clicks the submit button. There is no toast, no confirmation, no indication this happened. If the user abandons the form thinking they have not submitted, Adrian already has their partial data. This is useful for lead capture but may feel invasive if discovered.

### 62. No spam protection on the inquiry form
There is no reCAPTCHA, honeypot field, or rate limiting visible. A public-facing form without spam protection will accumulate bot submissions quickly.

### 63. Missing form fields reduce inquiry quality
The Inquire form lacks Location and Size Range fields that were in the original specification. For commission pricing, knowing where the buyer is (shipping logistics, installation context) and what scale they are imagining is critical for Adrian to provide an accurate response.

### 64. "Specific date" timeline option has no date input
The timeline section offers pill options including "Specific date," but selecting it does not reveal a date picker. The user selects it and has nowhere to enter their actual date.

### 65. Referral "Other" option has no free-text field
If a user selects "Other" for how they found Adrian, there is no text input to specify. This loses valuable marketing attribution data.

### 66. Budget ranges may not cover all buyers
The budget pills go up to a range and then "Let's discuss." For ultra-high-net-worth collectors commissioning large installations, the absence of higher ranges (or a custom input) may feel limiting. Consider adding an open field.

### 67. Commission path cards feel unresponsive
The two commission type cards (Personal / Spatial) scale to 0.98x when not selected. This subtle shrink feels like a rendering glitch rather than intentional design. An unselected state should feel neutral, not diminished.

### 68. Newsletter CTA copy is unclear
The footer newsletter section says "Share in Living Knowledge." This is poetic but does not tell users what they will receive. "Receive studio updates and new work announcements" would set clear expectations alongside the mystical branding.

---

## VII. CONTENT AND COPYWRITING (Items 69 to 76)

### 69. About page "The Root" section has a TODO_REPLACE flag
The About page contains a section marked with a TODO badge indicating the story "has inaccuracies that need correction from Adrian's actual memory." This is visible in the rendered page. Publishing unverified biographical content is a credibility risk.

### 70. Illuminated Works page has TODO comments in the source
Lines in `IlluminatedWorks.tsx` contain TODO markers for voice and narrative that need Adrian's personal language. The page structure is solid but reads as templated rather than authentic.

### 71. No series descriptions for Universal Language, Mandala, Light Codes, or Signature Pieces
Each subcategory page has a hero and gallery but the introductory copy is thin. These series represent Adrian's deepest artistic threads. Each deserves a paragraph of philosophy and process, written in Adrian's voice, not generic placeholder text.

### 72. Finish options have no descriptions
Natural, Painted, Gold Leaf, and LED finishes are data labels with no accompanying copy explaining what each finish looks like, feels like, or costs. For a collector choosing between a $200 and $600 option, descriptive context is essential.

### 73. No care guide or shipping policy
The footer references "Care Guide" and "Shipping" but these pages do not exist. For buyers of delicate sacred geometry pieces, knowing how to care for their purchase and what shipping looks like (crating, insurance, international) directly affects purchase confidence.

### 74. Writing articles have strong voice but pull quotes are hard to distinguish
Pull quotes (lines starting with `>`) render as italic blockquotes. In a page that already uses italic serif for body text, the pull quotes do not stand out enough. A larger size, different color, or left-border treatment would make them pop.

### 75. "Continue the Journey" section uses random story selection
At the bottom of writing articles, two stories are recommended via `Math.random()`. These are not contextually related to the current article. A reader finishing "The Mandala Series" should see "Light Codes" or "The Universal Language," not a random tea ceremony piece.

### 76. Homepage intro quote is three columns on desktop
"Art is the experience of listening..." is split across a 3-column layout on desktop. This works for visual rhythm but can feel cramped on tablets where columns narrow. On a 768px screen, each column is only ~200px wide, making the serif text feel squeezed.

---

## VIII. VISUAL DESIGN AND POLISH (Items 77 to 85)

### 77. Z-index values are inconsistent and fragile
Navigation uses z-100 and z-101. The Teajia banner is z-101. The cart drawer is z-3000. Modals use z-2000 or z-9999. There is no documented z-index scale. Overlapping elements will eventually conflict, especially as new features are added.

### 78. No `prefers-reduced-motion` support
The site has parallax effects, scroll reveals, canvas particle animations, and hover transitions. None of these respect the user's system preference for reduced motion. This is a WCAG 2.1 accessibility violation and excludes users with vestibular disorders.

### 79. GenerativeBackground canvas runs continuously
The particle animation in `GenerativeBackground.tsx` runs `requestAnimationFrame` on every frame regardless of visibility or user interaction. On mobile devices, this drains battery. On older hardware, it causes jank. There is no frame-rate throttling or visibility check.

### 80. Scroll event listeners are not consolidated
The About page, Footer, Creations page, Hero, and Writings each register their own scroll event listeners. While `passive: true` is used (good), multiple listeners on every scroll tick add up. A single scroll manager or more IntersectionObserver usage would be more efficient.

### 81. Dark mode is implemented but not fully tested
The CSS variable system supports dark mode elegantly. However, several components use `dark-preserve` as a workaround, and some hardcoded colors (especially in inline styles on the About page) may not adapt. The dark mode toggle in the footer works, but no page provides a consistent dark experience end-to-end.

### 82. No skip-to-content link
There is no hidden "Skip to main content" link for keyboard and screen reader users. Every page requires tabbing through the Teajia banner, full navigation, and cart icon before reaching content.

### 83. Modal drawers do not trap focus
The cart drawer and store inspection drawer do not implement focus trapping. A keyboard user who opens the cart can Tab out of the drawer into the page behind it. The escape key does not close these drawers.

### 84. Drop cap rendering is fragile
The `::first-letter` pseudo-element used for drop caps in articles and the About page can break with smart quotes, non-ASCII characters, or certain punctuation as the first character. If a paragraph starts with a quotation mark, the drop cap captures only the quote mark.

### 85. Type scale has too many sizes without clear hierarchy
The site uses text sizes from `text-sm` through `text-8xl` with no documented scale or ratio. Headings on different pages use different sizes for equivalent hierarchy levels. An h2 on the About page is not the same size as an h2 on the Writings page. Establishing a consistent type scale (e.g., Major Third 1.25 ratio) would unify the visual rhythm.

---

## Priority Matrix

### Launch Blockers (Do These First)
| # | Item | Effort |
|---|------|--------|
| 1 | Replace all placeholder images with real artwork photography | High |
| 49 | Wire up real Stripe Price IDs | Medium |
| 50 | Configure Stripe API key and environment variables | Low |
| 39 | Build the made-to-order configuration modal | High |
| 69 | Fix or remove About page TODO_REPLACE content | Medium |
| 4 | Add hero video poster/fallback image | Low |
| 51 | Add cart persistence (localStorage) | Low |

### High Impact, Moderate Effort
| # | Item | Effort |
|---|------|--------|
| 13 | Establish clear CTA hierarchy on homepage | Medium |
| 44 | Add "Read the story" links on piece pages | Low |
| 18 | Unify category routing (dedicated pages or all filter-based) | High |
| 27 | Show active filters as persistent chips | Medium |
| 40 | Build add-on selection UI for MTO pieces | High |
| 42 | Build finishes showcase modal | Medium |
| 62 | Add spam protection to inquiry form | Low |
| 78 | Add `prefers-reduced-motion` media query | Medium |

### Quick Wins (Low Effort, Meaningful Impact)
| # | Item | Effort |
|---|------|--------|
| 2 | Replace OG image with real artwork | Low |
| 6 | Add social proof line to homepage | Low |
| 10 | Add favicon and touch icons | Low |
| 15 | Increase mobile hamburger touch target | Low |
| 24 | Show real cart count instead of capping at 9+ | Low |
| 55 | Improve Store search placeholder text | Low |
| 68 | Clarify newsletter CTA copy | Low |
| 82 | Add skip-to-content link | Low |

### Polish and Refinement (Post-Launch)
| # | Item | Effort |
|---|------|--------|
| 3 | Self-host hero video | Medium |
| 21 | Add mobile section nav to About page | Medium |
| 22 | Add search to Writings page | Medium |
| 31 | Standardize gallery image aspect ratios | Medium |
| 38 | Add blur-up image loading | Medium |
| 56 | Move philosophy content outside the shop grid | Low |
| 75 | Replace random story recommendations with contextual ones | Medium |
| 79 | Add visibility check to GenerativeBackground | Medium |
| 80 | Consolidate scroll event listeners | Medium |
| 85 | Establish and document a consistent type scale | Medium |

---

## Final Note

This site is closer to launch than it might feel from reading 85 items. The design system is genuinely sophisticated. The voice is authentic. The information architecture is sound. What is missing is the final layer: real images, real payment integration, and the handful of interaction flows that turn a beautifully designed portfolio into a functioning art business.

The highest-leverage move is getting real artwork photography into every image slot. That single change transforms the site from "promising template" to "serious artist studio." Everything else improves when the art is real.
