# Complete UI & Design Audit — Adrian Rasmussen Art Website

## Context

This is a comprehensive graphic and user interface audit of adrianrasmussen.com — a multidisciplinary artist portfolio built with React, Tailwind CSS 4, and Cloudinary. The site is **mobile-first** with occasional desktop visitors. Every recommendation below is evaluated through that lens: mobile impact comes first, desktop enhancements are marked clearly.

The site has strong foundations (warm palette, Cormorant Garamond typography, `touch-active` press feedback, solid accessibility). These refinements elevate it from "well-built" to "gallery-grade luxury experience."

Each item includes a **Mobile** tag:
- **[Mobile: Critical]** — directly improves the phone experience
- **[Mobile: Beneficial]** — helps mobile, also helps desktop
- **[Mobile: Neutral]** — no mobile impact, purely desktop
- **[Mobile: Caution]** — could hurt mobile if done wrong (performance, battery, viewport)

---

## Tier 1: High-Impact Visual Upgrades (1–15)

### ~~1. Hero Scroll Performance — Add `requestAnimationFrame` Throttling~~ DONE
**[Mobile: Critical]**
~~**Why:** The hero parallax fires `setScrollY` on every pixel scrolled. On mobile, this causes jank and battery drain. The scroll listener already uses `{ passive: true }` but the state update on every frame is expensive. This is the single biggest mobile performance issue.~~
**File:** `components/Hero.tsx`
**Applied:** rAF throttling added + parallax fully disabled on touch devices via `matchMedia('(pointer: coarse)')`.

### ~~2. Cart Drawer Touch Targets — Fix Undersized Quantity Buttons~~ DONE
**[Mobile: Critical]**
~~**Why:** The +/- quantity buttons in CartDrawer are `w-8 h-8` (32px), well below the WCAG minimum of 44px. On phones, users will mis-tap constantly. This is a conversion-killing usability bug.~~
**File:** `components/CartDrawer.tsx`
**Applied:** Increased to `w-11 h-11` (44px) with larger icon sizes (14px).

### ~~3. Navigation Scroll Listener — Add Passive Flag~~ DONE
**[Mobile: Critical]**
~~**Why:** The nav's scroll listener (detecting scroll > 20px to toggle style) is missing `{ passive: true }`. On mobile browsers, this blocks the compositor thread and causes scroll jank, especially on older Android devices.~~
**File:** `components/Navigation.tsx`
**Applied:** Added `{ passive: true }` to scroll listener.

### 4. Mobile Typography — Reduce Oversized Headings on Small Screens
**[Mobile: Critical]**
**Why:** Several headings render at `text-5xl` (3rem / 48px) on mobile, which is too large on a 375px viewport. The hero h1 at `text-5xl` works because of the dramatic context, but section headings on Creations and Store pages at that size waste vertical space and look cramped.
**Files:** All page components
**How:** Audit every heading. Mobile baseline: h1 = `text-3xl` to `text-4xl`, h2 = `text-2xl`, h3 = `text-xl`. Use responsive prefixes (`md:text-5xl`) for desktop scaling. The hero is an exception.

### 5. Add Skeleton Loading States for Images
**[Mobile: Critical]**
**Why:** On mobile networks (3G/4G), images load slowly. Currently users see nothing or a beige box. Skeleton shimmer placeholders communicate that content is coming and prevent layout shift (CLS), which also affects Core Web Vitals.
**Files:** `components/ArtImage.tsx`, `src/index.css`
**How:** Before `loaded` state flips, render a `bg-wood-100 animate-pulse` placeholder matching the image's aspect ratio. Already have `VARIANT_ASPECT` defined — use it.

### 6. Introduce Scroll-Triggered Entrance Animations Site-Wide
**[Mobile: Beneficial]**
**Why:** The About page has beautiful `Reveal` animations, but Home, Creations, Store, and Writings pages lack them. The inconsistency makes the About page feel polished while other pages feel flat. `IntersectionObserver` (which Reveal uses) is cheap on mobile.
**Files:** `components/Home.tsx`, `components/Creations.tsx`, `components/Store.tsx`, `components/Writings.tsx`
**How:** Wrap key sections with the existing `<Reveal>` component (already built in `components/shared/Reveal.tsx`). No new code needed — just apply it. Respect `prefers-reduced-motion`.

### 7. Add Page Transition Animations Between Routes
**[Mobile: Beneficial]**
**Why:** Currently pages pop in with a basic `animate-fade-in`. A subtle cross-fade gives the site a native-app feel on phones, which is where users are most accustomed to transitions. Keep it CSS-only (no framer-motion) to avoid bundle bloat on mobile.
**Files:** `App.tsx`, new `PageTransition.tsx` wrapper component
**How:** Use CSS `@starting-style` + View Transitions API (supported in Chrome/Safari mobile) with a fallback `animate-fade-in`. Keep duration under 300ms — mobile users are impatient. Avoid `framer-motion` (50KB+ gzipped).

### 8. Hero Section — Add Staggered Text Reveal
**[Mobile: Beneficial]**
**Why:** The hero's text over video is functional but the text just appears. A staggered word-by-word reveal on the h1 creates a cinematic first impression. CSS-only, no performance cost. Skip the "split-screen" layout suggestion — on mobile, split-screen means tiny text and tiny video.
**File:** `components/Hero.tsx`
**How:** Wrap each word in a `<span>` with incremental `animation-delay` and a `@keyframes` fade-up. Use `animation-fill-mode: backwards` so words start invisible. Respect `prefers-reduced-motion` — show all text immediately.

### ~~9. Stagger Animation Timing — Reduce Max Delay~~ DONE
**[Mobile: Critical]**
~~**Why:** Card stagger delays reach 700ms+ (13+ items). On mobile where the viewport shows 2-4 cards, users stare at blank space for nearly a second. The first visible card should animate within 100ms.~~
**File:** `src/index.css` (`.card-stagger` rules)
**Applied:** Reduced increment from 60ms to 40ms, capped at 400ms (11th+ child).

### 10. Gallery Card — Improve Touch Interaction
**[Mobile: Beneficial]**
**Why:** The `touch-active` scale-down already exists (good), but the hover overlay with "View" text is invisible on touch devices since there's no hover state. Mobile users get no indication that cards are tappable beyond the general image-as-link convention.
**File:** `components/GalleryTileCard.tsx`
**How:** On touch devices (`@media (pointer: coarse)`), always show the title/info band at the bottom of the card instead of relying on hover reveal. Desktop keeps the hover-reveal behavior. This is more informative on mobile without adding visual clutter.

### 11. Typography Scale Refinement — Define a Modular Scale
**[Mobile: Beneficial]**
**Why:** Headings jump erratically: `text-5xl` to `text-3xl` to `text-xl` with no consistent system. A tighter modular scale (Major Third 1.25) creates visual rhythm across all viewports.
**Files:** All page components
**How:** Define the scale as CSS custom properties. Mobile base sizes: h1=`text-3xl`, h2=`text-2xl`, h3=`text-xl`, body=`text-base`/`text-lg`. Desktop scales up with `md:` and `lg:` prefixes.

### ~~12. Teajia Bar — Make It Dismissible or Remove~~ DONE (pre-existing)
**[Mobile: Critical]**
~~**Why:** A fixed bar at the top that pushes down the nav steals precious vertical space on mobile.~~
**File:** `components/Navigation.tsx`
**Applied:** Already implemented — dismiss button saves to `sessionStorage`, nav adjusts position accordingly.

### 13. Footer — Reduce Visual Weight on Mobile
**[Mobile: Beneficial]**
**Why:** The 4-column footer grid collapses into a long vertical stack on mobile, creating excessive scroll. Newsletter, status line, and bottom bar all compete for attention on a small screen.
**File:** `components/Footer.tsx`
**How:** On mobile: collapse footer columns into an accordion or hide secondary links behind a "More" toggle. Reduce vertical padding (`pt-12` not `pt-24` on mobile). Keep newsletter CTA compact — single line with inline button.

### ~~14. Hero "Enter" Button — Enlarge Touch Target and Add Bounce~~ DONE
**[Mobile: Critical]**
~~**Why:** The current "Enter" button is text + a thin gradient line. The tap target is narrow (the text "Enter" plus a 1px-wide line). On mobile, a thumb-friendly target with a clear "scroll down" affordance matters more than decorative animation.~~
**File:** `components/Hero.tsx`
**Applied:** Added `p-4 min-w-[48px] min-h-[48px]` for touch target + `animate-hero-bounce` CSS animation on the line. Respects `prefers-reduced-motion`.

### 15. Improve the Category Tile Grid on Creations Page
**[Mobile: Beneficial]**
**Why:** All 8 category tiles look identical — same placeholder images, same layout. On mobile's 2-column grid, visual monotony is amplified because you see 4 identical-looking tiles at once.
**File:** `components/Creations.tsx`
**How:** Add unique subtle gradient overlays per category using the category accent colors. On mobile, avoid varying tile sizes (spanning 2 columns breaks the 2-col grid) — instead differentiate through color/typography. On desktop (`lg:+`), the first tile can span 2 columns.

---

## Tier 2: Layout & Spacing Polish (16–30)

### 16. PiecePage Gallery — Add Swipe Hints
**[Mobile: Critical]**
**Why:** The piece page has swipe navigation (good), but there's no visual indicator that swiping is possible. Users may not discover the gesture. The dot indicators exist but are tiny and easy to miss.
**File:** `components/PiecePage.tsx`
**How:** On first visit (or first multi-image piece), show a brief "swipe" animation hint — the image shifts 20px left and bounces back over 1s. Save to `sessionStorage` so it only plays once. Make dot indicators slightly larger (`w-2.5 h-2.5` instead of `w-2 h-2`).

### 17. Cart Drawer — Add Swipe-to-Dismiss
**[Mobile: Critical]**
**Why:** Mobile users expect to swipe right to close a drawer. Currently only the X button and overlay click close it. This is a learned behavior from every mobile app.
**File:** `components/CartDrawer.tsx`
**How:** Add `touchstart`/`touchmove`/`touchend` listeners on the drawer panel. If horizontal swipe distance > 80px and velocity exceeds threshold, close the drawer with a slide-right animation. Use `touch-action: pan-y` on the drawer body to avoid conflicts with vertical scrolling.

### 18. Standardize Section Spacing to a Rhythm System
**[Mobile: Beneficial]**
**Why:** Sections alternate between `py-16`, `py-20`, `py-24`, `py-28`, `py-32` with no clear system. On mobile, oversized padding (`py-32` = 128px each side) creates dead space between sections.
**Files:** All page components
**How:** Define 3 sizes: `section-sm` = `py-10 md:py-16`, `section-md` = `py-14 md:py-24`, `section-lg` = `py-20 md:py-32`. Apply consistently. Mobile gets tighter spacing, desktop gets breathing room.

### 19. Add Horizontal Scroll Gallery for "Selected Works" on Homepage
**[Mobile: Beneficial]**
**Why:** Masonry grids work but horizontal scroll with snap points feels native on mobile — it's the gesture users are most comfortable with (Instagram stories, app carousels). It also lets users see one piece at a time with full visual attention.
**File:** `components/Home.tsx`
**How:** Use `overflow-x-auto scroll-snap-type-x-mandatory` with `scroll-snap-align: center` on each card. Add `scrollbar-hide` class (already defined). Show partial next card (peek) to signal scrollability. Desktop can keep the masonry grid.

### 20. Navigation Mobile Menu — Add Staggered Item Entrance
**[Mobile: Beneficial]**
**Why:** Mobile menu items all appear at once with `animate-fade-in`. Staggered entrance (each item slides in 50ms after the previous) feels more crafted and is one of the most visible mobile-only interactions.
**File:** `components/Navigation.tsx`
**How:** Apply `animation-delay` per menu item: 0ms, 50ms, 100ms, 150ms, 200ms. Use `@keyframes slide-in-right` with a slight translateX. Total entrance: ~350ms. Respect `prefers-reduced-motion`.

### 21. Writings Cards — Make Layout More Editorially Distinct
**[Mobile: Beneficial]**
**Why:** Writing cards look like product cards. On mobile (single column), editorial cards should feel like a magazine feed — large image, dramatic serif title below, minimal meta.
**File:** `components/Writings.tsx`
**How:** On mobile: full-width image (16:9 aspect), large `text-2xl` serif title below, category as a subtle label above title. On desktop: stacked layout or side-by-side with larger image.

### 22. Add Micro-Interactions to Form Inputs (Inquire Page)
**[Mobile: Beneficial]**
**Why:** The commission form is long on mobile where scrolling through many fields feels tedious. Subtle feedback (smooth label float, green check on valid fields) reassures users they're making progress.
**File:** `components/Inquire.tsx`
**How:** Float labels with CSS `::placeholder-shown` + `::focus` transitions. Add a checkmark icon that fades in when field validates. Consider a step-by-step wizard layout for mobile instead of one long scroll.

### 23. Add a "Back to Collection" Contextual Breadcrumb on Piece Pages
**[Mobile: Critical]**
**Why:** On mobile, the back button goes to browser history which may not be the collection. Users get lost. A persistent breadcrumb like "Jewelry > Ring of Resonance" at the top of piece pages provides clear wayfinding.
**File:** `components/PiecePage.tsx`
**How:** Use `location.state` to pass the collection name/path when navigating to a piece. Render a breadcrumb above the gallery. Keep it compact: category name as a link, truncated if needed.

### 24. Sticky Filter Bar — Add Shadow on Scroll
**[Mobile: Beneficial]**
**Why:** The Creations page sticky filter bar uses `backdrop-blur` but no shadow, making it hard to tell it's floating above content on mobile where the blur effect is subtle.
**File:** `components/Creations.tsx`
**How:** Track scroll position (reuse existing listener) and add `shadow-sm` class when scrolled past threshold. Or use `box-shadow` in a `@supports (backdrop-filter: blur(8px))` to only add shadow when blur is active.

### 25. Cart Drawer — Animate Items In/Out
**[Mobile: Beneficial]**
**Why:** Items appear/disappear instantly. On mobile where the drawer is full-width, this feels abrupt. A slide + fade makes the cart feel polished and confirms the action visually.
**File:** `components/CartDrawer.tsx`
**How:** Wrap items in a height-collapsing transition. On add: slide down + fade in (200ms). On remove: slide up + fade out (150ms). Use `max-height` transition, not `height`, to avoid layout recalculation.

### 26. Writings Article — Optimize Reading Line Length
**[Mobile: Neutral]**
**Why:** `max-w-3xl` works fine on mobile (screen width constrains it naturally). On desktop, lines run too wide. This is a desktop readability fix.
**File:** `components/Writings.tsx` (WritingArticle)
**How:** Add `max-w-[65ch]` on the prose container. On mobile, the viewport width already constrains to ~40-50 characters which is comfortable.

### 27. Lightbox — Improve Mobile Navigation
**[Mobile: Critical]**
**Why:** The lightbox shows "1 of 5" text. On mobile, swipe between images should feel instant, and navigation should use swipe gestures with momentum, not arrow buttons.
**File:** `components/VisualLightbox.tsx`
**How:** Add touch swipe handling (same pattern as PiecePage). Replace arrow buttons with edge-tap zones (tap left 30% = prev, right 30% = next). Show dot indicators at the bottom for position awareness.

### 28. Writings Landing — Add a Featured Hero Story
**[Mobile: Beneficial]**
**Why:** All writing entries look the same. On mobile, the first story should get a full-width hero treatment — large image with overlaid text — creating hierarchy and a strong entry point.
**File:** `components/Writings.tsx`
**How:** First story card: full-width image, `aspect-[16/9]`, title overlaid at bottom with gradient scrim. Subsequent stories use the standard card layout.

### 29. Add Scroll-Snap Horizontal Gallery to About Page Interstitials
**[Mobile: Beneficial]**
**Why:** Full-bleed photos on the About page are static. On mobile, making them horizontally scrollable with snap points turns them into an engaging mini-gallery — a natural mobile gesture.
**File:** `components/About.tsx`
**How:** Group interstitial photos into a horizontal `scroll-snap` container with `overflow-x-auto`. Show partial peek of next image. Add dot indicators.

### 30. Consistent Border Radius Strategy
**[Mobile: Neutral]**
**Why:** Sharp corners are used everywhere (intentional and elegant), but `rounded-full` appears on newsletter badges, lightbox buttons, and footer elements, breaking the design language.
**Files:** `components/Writings.tsx`, `components/VisualLightbox.tsx`, `components/Footer.tsx`
**How:** Pick one: sharp everywhere (remove `rounded-full` outliers) or allow `rounded-full` only on small interactive elements (dots, badges). Recommend sharp — it's the stronger aesthetic choice.

---

## Tier 3: Interaction & Motion Polish (31–45)

### 31. Button Hover/Press States — Unify the Pattern
**[Mobile: Beneficial]**
**Why:** Buttons use inconsistent patterns: `border-b` underlines, `bg` fills, `border` outlines. On mobile, hover doesn't exist, so the **active/pressed** state is what matters. Unify that.
**Files:** All components with CTAs
**How:** Define 3 button variants: primary (filled, `active:brightness-90`), secondary (outlined, `active:bg-wood-50`), ghost (text-only, `active:underline`). Apply consistently. Add `touch-active` to all interactive buttons.

### 32. Touch Press Feedback — Extend to All Interactive Elements
**[Mobile: Critical]**
**Why:** `touch-active` (scale 0.98 on press) exists on gallery cards but not on nav links, buttons, or other interactive elements. Mobile users need tactile feedback everywhere.
**Files:** `components/Navigation.tsx`, button elements globally
**How:** Add `touch-active` class to all buttons, links, and interactive elements. Consider a global rule: `@media (pointer: coarse) { button:active, a:active { transform: scale(0.98); } }`.

### 33. Dark Mode Transition — Add Smooth Color Crossfade
**[Mobile: Beneficial]**
**Why:** Only `background-color` transitions on toggle. Text, borders, and cards snap instantly, creating a jarring flash.
**Files:** `src/index.css`
**How:** Apply a `.transitioning` class to `<html>` for 400ms on toggle: `.transitioning * { transition: color 0.3s, background-color 0.3s, border-color 0.3s; }`. Remove class after transition completes to avoid performance drag from permanent transition on every element.

### ~~34. Smooth Scroll Behavior for All Anchor Links~~ DONE
**[Mobile: Beneficial]**
~~**Why:** Some scroll actions use `behavior: 'smooth'` and some don't. Inconsistent.~~
**File:** `src/index.css`
**Applied:** Added `html { scroll-behavior: smooth; }` wrapped in `@media (prefers-reduced-motion: no-preference)`.

### 35. Cart Badge Animation — Bounce on Item Add
**[Mobile: Critical]**
**Why:** When adding to cart on mobile, the badge count changes silently. Users need visual confirmation that the tap worked — especially important because mobile taps can feel unresponsive without feedback.
**File:** `components/Navigation.tsx`
**How:** On cart count change, apply a `scale(1.3)` → `scale(1)` CSS transition (200ms spring) to the badge. Use a `key` prop or CSS animation class toggle.

### 36. Add Custom Cursor Effects for Gallery Browsing
**[Mobile: Neutral — Desktop only]**
**Why:** Custom cursors (e.g., "View" text cursor on hover, directional arrows in lightbox) are a signature luxury portfolio move. Gagosian, Pace, and David Zwirner all use them. Irrelevant on touch devices but a strong desktop differentiator.
**Files:** `components/GalleryTileCard.tsx`, `components/VisualLightbox.tsx`, `src/index.css`
**How:** Use CSS `cursor: url(...)` or a JS-driven cursor follower. Wrap in `@media (pointer: fine)` so it only applies to mouse users.

### 37. Masonry Grid — Add Responsive Column Transitions
**[Mobile: Neutral]**
**Why:** When resizing the browser, columns snap between 2/3/4. Mobile users don't resize their browser, so this is desktop-only polish.
**Files:** `components/Home.tsx`, `components/Creations.tsx`
**How:** Detect column breakpoint changes and briefly apply `opacity-0` → `opacity-1` fade. Only fires on window resize, which is desktop-only.

### 38. Navigation Active-Link Indicator — Sliding Animation
**[Mobile: Neutral — Desktop only]**
**Why:** The active nav underline snapping between links is only visible in the desktop horizontal nav. Mobile uses a full-screen menu where the active item is highlighted differently. Good desktop polish but zero mobile impact.
**File:** `components/Navigation.tsx`
**How:** Use a positioned `<span>` that measures active link offset/width via `ref` and animates `left` + `width`. Only render on `lg:` breakpoint.

### 39. Reading Progress Bar — Thicker and More Visible
**[Mobile: Beneficial]**
**Why:** The 2px bronze bar is easy to miss on mobile where it competes with the browser's own UI chrome. A 3px bar is more noticeable.
**File:** `components/Writings.tsx`, `components/shared/ProgressBar.tsx`
**How:** Increase from 2px to 3px. Add a subtle gradient (bronze to warm gold). Keep it at the very top of the viewport.

### 40. Commission Section — Add Scroll-Triggered Reveal
**[Mobile: Beneficial]**
**Why:** The commission invitation on the Home page just sits there. A scroll-triggered reveal using the existing `<Reveal>` component adds life with zero performance cost.
**File:** `components/Home.tsx`
**How:** Wrap the commission section in `<Reveal>`. Image fades up from left, text from right. Use `threshold: 0.2` so it triggers early on mobile scroll.

### 41. Sort Dropdown — Keep Native on Mobile, Style on Desktop
**[Mobile: Caution]**
**Why:** The native `<select>` element looks jarring on desktop, but on mobile it triggers the **native OS picker** (iOS wheel picker, Android dropdown) which is faster and more accessible than any custom dropdown. Don't replace this on mobile.
**File:** `components/Creations.tsx` (SortDropdown)
**How:** On desktop (`@media (pointer: fine)`), render a custom styled dropdown with the site's typography. On mobile, keep the native `<select>` but style its resting appearance (font, color, border) to match the site.

### 42. Add Hover "Tilt" Effect on Category Tiles
**[Mobile: Neutral — Desktop only]**
**Why:** 3D perspective tilt on hover adds tactile depth to the category grid. Mouse-dependent — ignore on touch devices.
**File:** `components/Creations.tsx` (CreationCategoryCard)
**How:** Track mouse position relative to card, apply `transform: perspective(800px) rotateX(Ydeg) rotateY(Xdeg)`. Wrap in `@media (pointer: fine)`. Max rotation: 3 degrees.

### 43. Newsletter Success State — Animate the Checkmark
**[Mobile: Beneficial]**
**Why:** Small delight that confirms newsletter signup worked. The draw-on animation is lightweight CSS.
**File:** `components/Footer.tsx`
**How:** SVG checkmark path with `stroke-dasharray` + `stroke-dashoffset` animation. Duration: 400ms.

### 44. Back-to-Top Button — Add Scroll Progress Ring
**[Mobile: Beneficial]**
**Why:** A circular SVG progress ring communicates scroll position. On long mobile pages (Store, Creations), this helps users understand how far they've scrolled.
**File:** `components/shared/BackToTop.tsx`
**How:** Wrap the button in a circular SVG with `stroke-dashoffset` tied to scroll percentage. Use the existing passive scroll listener.

### 45. Keyboard Arrow Navigation Between Pieces
**[Mobile: Neutral — Desktop only]**
**Why:** Arrow key navigation is a power-user desktop feature. Mobile has no keyboard.
**File:** `components/Creations.tsx`
**How:** Listen for ArrowLeft/ArrowRight on focused gallery items. Move focus and scroll into view.

---

## Tier 4: Typography & Content Refinements (46–55)

### 46. Drop Cap — Verify Dark Mode Contrast
**[Mobile: Beneficial]**
**Why:** Drop caps use `var(--color-bronze-500)` which may lack contrast in dark mode. Mobile OLED screens render dark mode differently than desktop LCDs.
**File:** `src/index.css`
**How:** Test bronze-500 against dark mode background. If contrast ratio < 4.5:1, use `bronze-400` in dark mode.

### 47. Price Display — Use Consistent Font Treatment
**[Mobile: Beneficial]**
**Why:** Prices use `font-serif` in some places and `font-label` in others. On mobile's smaller text sizes, inconsistency is more jarring because the viewport shows fewer elements to compare against.
**Files:** `components/GalleryTileCard.tsx`, `components/Store.tsx`, `components/PiecePage.tsx`, `components/CartDrawer.tsx`
**How:** Standardize to `font-label` for all prices. It's more scannable at small sizes.

### 48. Blockquote vs Pull Quote — Differentiate Styling
**[Mobile: Beneficial]**
**Why:** Both use similar left-border styling. On mobile where text fills the width, pull quotes should interrupt the flow more dramatically to create visual breathing room.
**File:** `src/index.css`
**How:** Pull quotes: `text-2xl font-serif text-center` with decorative quotation mark above. Blockquotes: keep left border, slightly indented. Different treatment creates pacing in long articles.

### 49. Availability Badges — Use Subtle Background Colors
**[Mobile: Beneficial]**
**Why:** "Ready to ship" and "Made to order" are text-only with color differences. On mobile, small colored text is hard to distinguish. A subtle background fill makes badges scannable at a glance.
**Files:** `components/GalleryTileCard.tsx`, `components/Store.tsx`
**How:** Add `bg-bronze-50 px-2 py-0.5` for ready-to-ship, `bg-wood-50 px-2 py-0.5` for made-to-order. No border-radius (matches sharp design language).

### 50. Add Proper Open Graph / Social Meta Images
**[Mobile: Critical]**
**Why:** Most social sharing happens from phones. When someone shares a piece or article from their phone, the OG image is the primary thing their audience sees. Bad or missing OG images mean fewer click-throughs.
**File:** `useSeoMeta.ts`
**How:** Generate per-page meta with Cloudinary transformations. Piece pages: use `coverImage` at 1200x630 crop. Writing pages: title card with brand styling. Fallback: site-wide default OG image.

### 51. Writing Tags — Add More Padding
**[Mobile: Beneficial]**
**Why:** Tag pills use `px-2 py-0.5` which feels cramped on mobile where fingers need to tap them (if they're interactive). Even if they're display-only, cramped pills look cheap.
**File:** `components/Writings.tsx`
**How:** Increase to `px-3 py-1`. If tags are tappable for filtering, ensure minimum 44px touch target height.

### 52. Form Labels — Unify to Floating Pattern
**[Mobile: Beneficial]**
**Why:** Mixed label patterns (floating vs static) create inconsistency. On mobile, floating labels save vertical space since the label lives inside the field until focused.
**Files:** `components/Footer.tsx`, `components/Inquire.tsx`
**How:** Use the floating label pattern everywhere. Label starts as placeholder, floats to top-left on focus/filled. Use `::placeholder-shown` pseudo-class for pure CSS implementation.

### 53. "Continue the Journey" Section — Add Visual Warmth
**[Mobile: Beneficial]**
**Why:** After reading a long article on mobile, the "next stories" section feels abrupt. A warm background band signals "you've reached a new section" and invites continued exploration.
**File:** `components/Writings.tsx`
**How:** Add `bg-wood-50 py-12` (light mode) or `bg-wood-900/30 py-12` (dark mode) wrapper around the section.

### 54. Optical Kerning on Display Headings
**[Mobile: Neutral]**
**Why:** Cinzel at very large sizes (`text-8xl`+) can have uneven letter spacing. Only relevant at desktop sizes.
**Files:** Page components using display font at large sizes
**How:** Add `tracking-[-0.02em]` to headings at `lg:text-7xl` and above.

### 55. Empty State Design — Add Brand Glyph
**[Mobile: Beneficial]**
**Why:** Empty cart and "no pieces found" states use only text. On mobile, a small centered illustration or brand mark prevents the screen from feeling broken.
**Files:** `components/CartDrawer.tsx`, `components/Creations.tsx`
**How:** Add a simple SVG glyph (sacred geometry mark from the brand) above the empty state text. Keep it subtle — 64x64px, `opacity-30`.

---

## Tier 5: Polish & Micro-Details (56–70)

### 56. Focus Ring Styling — Clean Up the Offset Gap
**[Mobile: Neutral]**
**Why:** `ring-offset-2` creates a visible gap between element and focus ring. Looks unpolished on keyboard navigation (primarily desktop, but also mobile accessibility switches).
**File:** `src/index.css`
**How:** Replace with `outline: 2px solid var(--color-bronze-400); outline-offset: 3px`. Cleaner, one rule.

### 57. Video Poster Image — Ensure High Quality
**[Mobile: Critical]**
**Why:** On mobile networks, the hero video may never load (data saver mode, slow connection, or iOS low-power mode disabling autoplay). The poster image IS the hero for many mobile users.
**File:** `components/Hero.tsx`
**How:** Use a high-quality, representative still from the video via Cloudinary (`f_auto,q_85,w_1200`). Test on iPhone with Low Power Mode — the poster is all users see.

### 58. Add Print Stylesheet for Writing Articles
**[Mobile: Neutral]**
**Why:** Desktop readers may print essays. Zero mobile impact but thoughtful touch.
**File:** `src/index.css`
**How:** `@media print { nav, footer, .back-to-top, .progress-bar { display: none; } .prose { max-width: 100%; font-size: 12pt; } }`.

### ~~59. Cart Drawer Duplicate Escape Handler (Bug Fix)~~ DONE
**[Mobile: Beneficial]**
~~**Why:** `CartDrawer.tsx` has two identical `useEffect` blocks for Escape key handling. Duplicate code is duplicate risk.~~
**File:** `components/CartDrawer.tsx`
**Applied:** Removed duplicate `useEffect` block, kept the original.

### 60. Add `:focus-visible` Styles to Budget Slider
**[Mobile: Neutral]**
**Why:** The custom range slider has no focus indicator for keyboard/switch users.
**File:** `src/index.css`
**How:** Add `input[type=range]:focus-visible { outline: 2px solid var(--color-bronze-400); outline-offset: 4px; }`.

### 61. Footer Bottom Bar — Add Separator Before Dark Mode Toggle
**[Mobile: Beneficial]**
**Why:** Copyright, privacy, terms, and dark mode toggle are crammed together. On mobile's narrow viewport, they wrap awkwardly.
**File:** `components/Footer.tsx`
**How:** Add a middle dot separator and `flex-wrap gap-3` to let items wrap cleanly on mobile.

### 62. Image Hover Scale — Desktop-Only Differentiation
**[Mobile: Neutral — Desktop only]**
**Why:** Everything scales at 1.03 on hover. Hover doesn't exist on mobile.
**File:** `components/ArtImage.tsx`
**How:** Product cards: `hover:scale-[1.05]`. Gallery images: `hover:scale-[1.03]`. Wrap in `@media (pointer: fine)`.

### 63. Add Subtle Paper Texture / Grain to Background
**[Mobile: Caution]**
**Why:** The footer already has a noise texture. Applying it site-wide adds warmth but beware: on mobile, CSS `background-image` noise textures increase GPU memory usage and can cause stutter during scroll on older phones.
**File:** `src/index.css`
**How:** Apply at `opacity: 0.012` only, and only to the `body` element (not every card/section). Use a tiny (200x200px) repeating PNG, not an inline SVG data URI (which forces re-rendering). Disable on `prefers-reduced-data` if supported.

### ~~64. Add Safe Area Insets for Notched/Dynamic Island Phones~~ DONE
**[Mobile: Critical]**
~~**Why:** iPhones with notch or Dynamic Island need `env(safe-area-inset-*)` to prevent content from being obscured.~~
**Files:** `src/index.css`, `index.html`
**Applied:** Added `viewport-fit=cover` to meta tag + `.safe-top` / `.safe-bottom` CSS utility classes with `env(safe-area-inset-*)`.

### ~~65. Disable Parallax on Low-End Mobile Devices~~ DONE
**[Mobile: Critical]**
~~**Why:** Not all phones are iPhone 15s. The parallax scroll effect in the hero fires state updates every frame. On budget Android devices, this causes visible jank and battery drain for an effect that's barely noticeable on a 6-inch screen.~~
**File:** `components/Hero.tsx`
**Applied:** Parallax disabled on all touch devices via `matchMedia('(pointer: coarse)')`. Combined with item #1.

### ~~66. Add `touch-action: manipulation` to Interactive Elements~~ DONE
**[Mobile: Critical]**
~~**Why:** Mobile browsers add a 300ms tap delay to detect double-tap zoom. `touch-action: manipulation` disables double-tap zoom on specific elements while preserving pinch zoom (important for images).~~
**File:** `src/index.css`
**Applied:** Added global rule for `button, a, [role="button"], input, select, textarea, label`.

### ~~67. Optimize Cloudinary Image Sizes for Mobile~~ DONE (pre-existing)
**[Mobile: Critical]**
~~**Why:** If gallery images are served at desktop resolution (1200px+) on a 375px mobile viewport, users download 3-4x more data than needed.~~
**File:** `utils/cloudinary.ts`, `components/ArtImage.tsx`
**Applied:** Already implemented — `ArtImage` uses `srcset()` with per-variant width breakpoints and `sizes` attributes. Browser picks appropriate size automatically.

### ~~68. Prevent Body Scroll When Mobile Menu Is Open~~ DONE
**[Mobile: Critical]**
~~**Why:** When the mobile nav menu opens, the page behind it should not scroll. CartDrawer already does this (`document.body.style.overflow = 'hidden'`), but verify the mobile menu does too.~~
**File:** `components/Navigation.tsx`
**Applied:** Added `document.body.style.overflow = 'hidden'` when menu opens, restored on close/unmount.

### ~~69. Add Scroll-to-Top on Route Change~~ DONE (pre-existing)
**[Mobile: Beneficial]**
~~**Why:** When navigating between pages on mobile, React Router preserves scroll position. Users end up in the middle of a new page.~~
**File:** `App.tsx`
**Applied:** Already implemented — global `useEffect` scrolls to top on every `location.pathname` change.

### 70. Lazy Load Below-the-Fold Components
**[Mobile: Beneficial]**
**Why:** Mobile users on slower connections should see the hero and first section as fast as possible. Components like Footer, Commission section, and Writings preview can load later.
**File:** `App.tsx` or route-level components
**How:** Use `React.lazy()` + `Suspense` for heavy below-the-fold sections. Or simpler: ensure images below the fold have `loading="lazy"` (check that `ArtImage` sets this).

---

## Implementation Strategy

Prioritized for **mobile-first** impact:

### Phase 1: Mobile Fixes — COMPLETE
~~Items 1, 2, 3, 14, 64, 65, 66, 67, 68~~ — All performance fixes and touch target issues applied.

### Phase 2: Mobile Experience (high ROI) — PARTIALLY COMPLETE
Items 4, 5, ~~9~~, ~~12~~, 16, 17, 32, 35, 57, ~~69~~ — Also completed: stagger timing (#9), Teajia bar (#12), scroll-to-top (#69), smooth scroll (#34), duplicate escape fix (#59).

### Phase 3: Visual Polish (both platforms)
Items 6, 7, 8, 10, 11, 15, 18, 19, 20, 21, 28, 33 — Visual upgrades that benefit everyone.

### Phase 4: Desktop Enhancements
Items 36, 37, 38, 42, 45, 62 — Desktop-only polish. Do when the mobile experience is solid.

### Phase 5: Details & Refinement
Everything else — cherry-pick based on your priorities.

## Verification
- Test every change on a **real phone first** (not just Chrome DevTools mobile view — it doesn't simulate touch, network, or GPU constraints)
- Test on both iOS Safari and Android Chrome (they handle scroll, video, and animation differently)
- Test with Low Power Mode on iOS (disables video autoplay and reduces animation)
- Test dark mode for every change
- Verify `prefers-reduced-motion` still disables animations
- Run Lighthouse mobile audit — target 90+ performance score
- Run `npm run build` to confirm no build errors
- Test keyboard navigation after any interactive changes
