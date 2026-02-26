# UI/UX Implementation Audit: 120 Items

**Scope:** Flow, navigation, graphics, and implementation quality.
**Out of scope:** Missing content, placeholder images, unbuilt backend features.

**Effort key:** `[S]` = Small (< 1 hour) | `[M]` = Medium (1-4 hours) | `[L]` = Large (4+ hours)

---

## TIER 1: CRITICAL (Biggest impact on user experience)

### Navigation & Wayfinding

**1. `[S]` Nav active state only matches exact path** - `location.pathname === item.path` means browsing `/creations/some-piece` doesn't highlight "Creations" in the nav. Users lose orientation. Use `startsWith` matching so the correct nav item always lights up.

**2. `[S]` No global scroll-to-top on route change** - Only a few pages manually call `window.scrollTo(0, 0)` (SubcategoryPage, OracleCards). Other route transitions carry forward the previous scroll position. Users land mid-page when clicking nav links. Add one global scroll reset in `App.tsx`.

**3. `[M]` Teajia promo bar eats 32px of viewport permanently** - The fixed `top-0` bar pushes nav to `top-8` on every page. On a 667px mobile screen, that's 5% of the viewport permanently consumed by an external brand link with no close button. Make it dismissable or collapse on scroll.

**4. `[S]` Desktop hero has no CTA** - The "Explore the Work" button is `md:hidden`, meaning desktop visitors see the hero video and text but have zero interactive affordance. The largest screen gets the least guidance. Show a CTA on desktop too.

**5. `[M]` Breadcrumbs are inconsistent** - MultidimensionalArt, SubcategoryPage, and IlluminatedWorks have breadcrumbs. Creations, Store, Writings, About, and PiecePage do not. Extract a shared `<Breadcrumb>` component and use it everywhere.

**6. `[S]` Back navigation hardcoded instead of using history** - PiecePage links back to `/creations` regardless of where the user came from. If they arrived from `/shop`, `/`, or a subcategory, they're sent somewhere unexpected. Use `navigate(-1)` with a sensible fallback.

**7. `[S]` Footer "Information" links are dead** - "Shipping & Returns", "Care Guide", and "Authenticity" are `<button>` elements that do nothing. Broken links on an art site destroy credibility. Either build the pages or remove the links.

**8. `[M]` No page transition animation** - Route changes are instant with no exit animation. The `animate-fade-in` class handles entrance but exit is abrupt. A shared crossfade or slide transition would make navigation feel intentional.

**9. `[S]` "Enter" scroll indicator on hero looks clickable but isn't** - The "Enter" label with vertical line at the bottom of the hero has hover styles but no `onClick`. Either make it scroll to the first content section, or remove the interactive styling.

**10. `[S]` Mobile hamburger tap target too small** - The menu toggle uses `p-2` giving roughly 40x40px. Apple and Google both recommend 44x44px minimum. Increase padding.

### Mobile Experience

**11. `[M]` Single-column gallery on mobile wastes space** - `columns-1 sm:columns-2` in SubcategoryPage and Creations means mobile users see one giant card at a time. For a visual art gallery, two columns on mobile shows twice the work and feels more like a gallery.

**12. `[S]` Filter pill touch targets too small** - SubcategoryPage pill buttons are `px-3 py-1.5` with `text-[11px]`. That's roughly 28px tall, well below the 44px minimum. Increase padding to at least `py-2.5`.

**13. `[S]` Store search completely hidden on mobile** - The search input has `hidden sm:flex`, meaning mobile users literally cannot search. Add a search toggle icon or always-visible input.

**14. `[M]` Cart drawer has no swipe-to-close** - The cart slides in from the right. On mobile, swiping right to close is the natural gesture. Currently only the X button or backdrop tap works.

**15. `[S]` About/OracleCards side-nav dots hidden on mobile** - Both long-form pages (About, OracleCards) have sticky dot navigation for section-jumping, but only on `lg:` screens. Mobile users scrolling 5000+ pixels of content have no quick-jump navigation.

**16. `[M]` No swipe gesture on PiecePage image gallery** - The image gallery requires tapping thumbnails. On mobile, swiping left/right between images is expected behavior for any gallery.

**17. `[S]` Sticky filter bars don't account for Teajia bar** - Filter bars use `top-[70px]` or `top-[72px]` which assumes the nav is at the top. The 32px Teajia bar pushes everything down, causing overlap on some scroll positions.

### Accessibility

**18. `[M]` No skip-to-content link** - Keyboard and screen reader users must tab through Teajia bar, navigation, and cart icon before reaching page content. Add a visually hidden skip link as the first focusable element.

**19. `[M]` No `prefers-reduced-motion` support** - All animations (parallax, scroll reveals, canvas particles, card staggers, hover transitions) run unconditionally. Users with vestibular disorders get no relief. Wrap animations in `@media (prefers-reduced-motion: reduce)` to disable them.

**20. `[S]` Hero video missing `aria-hidden`** - The hero video is decorative (muted, autoplay, no controls) but has no `aria-hidden="true"`. Screen readers will try to announce it.

**21. `[S]` Mobile menu missing ARIA attributes** - No `aria-expanded` on the toggle button, no `aria-controls` pointing to the menu panel, no focus management when the menu opens.

**22. `[S]` Form errors not connected to inputs** - In Inquire.tsx, validation error messages are sibling elements but not connected via `aria-describedby`. Screen readers won't announce what's wrong.

**23. `[S]` Budget slider lacks value announcements** - The dual range slider has `aria-label` but no `aria-valuenow` or `aria-valuetext`. Screen reader users can't tell the current budget range.

**24. `[S]` Cart and InspectionDrawer have no focus trap** - When either drawer opens, focus isn't trapped inside. Tab key moves to elements behind the overlay, which is disorienting.

**25. `[S]` No Escape key handler on drawers** - Neither CartDrawer nor Store's InspectionDrawer can be closed with Escape. This is expected behavior for any modal/drawer.

---

## TIER 2: HIGH IMPACT (Polishing the core experience)

### Interaction Design

**26. `[S]` Hover states invisible on touch devices** - Nearly every interactive element uses hover for visual feedback. Touch devices get zero response. Add `:active` states with brief transforms or color shifts.

**27. `[M]` Gallery card "View" overlay obscures the art** - On hover, a dark overlay with "View" text covers the image. For an art site, this fights the user's desire to see the work. Replace with a subtle corner indicator or border treatment.

**28. `[S]` Clicking a collection card doesn't scroll to results** - When toggling a collection filter in Creations, the grid re-filters but the viewport stays put. If the user is viewing collection cards, the filtered results below may be out of view.

**29. `[S]` PiecePage "Add to Cart" confirmation too subtle** - After adding, the button changes text and color. There's no animation, toast, or cart drawer opening. On a page full of rich content, this confirmation is easy to miss.

**30. `[S]` Gallery tile keyboard focus has no visual change** - The "View" overlay appears on hover but not on focus. Keyboard users tabbing through the grid see no visual feedback on the focused card. Add `:focus-within` styles.

**31. `[M]` Image lightbox in Store has no swipe-to-dismiss** - `ZoomableImage` supports pinch-zoom and drag but not swipe-down-to-dismiss, which is the expected mobile gesture for closing an overlaid image.

**32. `[S]` Category tile descriptions hidden on desktop** - `sm:opacity-0 sm:group-hover:opacity-100` on MultidimensionalArt subcategory tiles means descriptions are invisible until hover. Touch-device users and non-hovering users never see them. Show by default.

**33. `[S]` "Continue the Journey" uses random sorting** - `nextReadings` in WritingArticle calls `.sort(() => 0.5 - Math.random())` producing different recommendations on every render. This is disorienting. Use deterministic recommendations based on category or adjacency.

**34. `[M]` Inquiry form silently submits before user clicks Send** - The `coreSubmitted` useEffect sends data to `/api/inquire` as soon as required fields are valid, before the user takes any explicit submit action. This is a dark pattern. Remove the silent early submit or at minimum disclose it.

**35. `[S]` No loading indicator on inquiry form submission** - The submit button text changes to "Sending..." but the form stays interactive. Disable form fields during submission to prevent double-send.

### Visual Consistency

**36. `[S]` Three different back-to-top implementations** - Footer has a circle button, Creations has a square button, WritingArticle has both a text link AND a floating button. Consolidate to one shared component used everywhere.

**37. `[S]` Commission CTA text varies wildly** - "Begin an Inquiry" (Home), "Begin the conversation" (SubcategoryPage, IlluminatedWorks), "Work together" (About), "Commission a Piece" (Welcome), "Start the conversation" (Inquire submit). Pick 1-2 consistent phrases.

**38. `[S]` Border radius inconsistent** - Most elements are sharp-cornered (on-brand), but cart badges use `rounded-full`, some filter buttons have rounding, social icons in Footer are rounded. Either commit to sharp edges everywhere or define where curves are used.

**39. `[S]` Hover underline mechanics differ** - Nav links use bottom-border. Footer links use `::after` pseudo-elements. Some links use `border-b` Tailwind classes. All three produce visually different underline animations. Unify.

**40. `[S]` Dark mode toggle buried in footer** - Users who want dark mode must scroll to the very bottom of any page to find a text link. Consider adding it to the nav, or a floating corner toggle.

**41. `[S]` Footer "Commissions" and "Contact" link to same page** - Both `/inquire`. Remove one or differentiate them.

### Performance & Loading

**42. `[M]` GenerativeBackground runs continuously on every page** - The canvas particle system runs `requestAnimationFrame` on every route. On `/` it skips drawing but still runs the frame loop. On scroll-heavy pages like About, it competes with scroll-linked animations. Pause when not visible or on pages that don't benefit.

**43. `[S]` No image placeholder in gallery cards** - Gallery variant images don't fade in (excluded from `FADE_ON_LOAD`). Images pop in abruptly after download. Add a background color or aspect-ratio placeholder.

**44. `[S]` Store skeleton always shows 6 items** - When filtering, the skeleton grid always renders 6 cards regardless of expected results. If only 2 items match, 6 skeletons create false expectations.

**45. `[S]` Scroll listeners not consolidated** - About, Footer, Creations, Hero, and Writings each register their own scroll listeners. While `passive: true` is used, multiple listeners per frame add up. Use more IntersectionObserver or a single scroll manager.

---

## TIER 3: IMPORTANT (Quality-of-life improvements)

### Navigation Refinements

**46. `[M]` Creations category tiles should show piece count** - Users can't gauge category size before clicking. Add a count like "12 pieces" under each tile.

**47. `[S]` Subcategory "Explore more" section uses plain text links** - The other subcategories at the bottom of SubcategoryPage are minimal text links. Using the same tile card format would make them more discoverable and visually consistent.

**48. `[S]` No "back to writings" link at bottom of articles** - After reading an article, the user sees "Continue the Journey" and "Return to Top" but no direct path back to `/writings`. The top "Return to Index" is scrolled out of view.

**49. `[S]` Creations "Selected Works" label is confusing** - When landing on `/creations` unfiltered, the sticky bar says "Selected Works" with no explanation. Users expect to see all creations. Clarify this is a curated selection or change the label.

**50. `[M]` Writing categories need piece counts** - The Writings page has category tabs, but if some categories have only 1-2 stories, the page feels empty. Show a counter next to each category label.

**51. `[S]` Sort options hidden until category is selected** - On Creations, the sort dropdown only appears after filtering by category. Sorting should always be available.

### Typography & Readability

**52. `[S]` Writing article body too wide on large screens** - Articles use `max-w-3xl` (768px) with `prose-xl` text, which can exceed 75 characters per line. Consider `max-w-2xl` for better readability.

**53. `[S]` Drop cap breaks with leading punctuation** - The `::first-letter` CSS captures the first character. If a paragraph starts with a quotation mark, only the quote mark gets styled as the drop cap, not the first letter. Add a workaround.

**54. `[S]` Price formatting uses three different functions** - GalleryTileCard uses inline `toLocaleString`, PiecePage uses `formatCurrency`, Store uses `formatPrice`. Consolidate to one utility.

**55. `[S]` Availability text colors too low contrast** - `text-avail-order` (#6B6B6B) and `text-avail-sold` (#767676) may fail WCAG AA on white backgrounds. Darken these values.

**56. `[S]` About and OracleCards inject large inline `<style>` blocks** - Both components embed ~60 lines of CSS in `<style>` tags inside the JSX. This causes style recalculation on re-render and duplicates identical rules. Move to `index.css`.

### Image & Media

**57. `[M]` No image error handling** - If an image fails to load, `<img>` shows a broken icon. Add an `onError` fallback in ArtImage to show a styled placeholder matching the design system.

**58. `[S]` PiecePage image thumbnails not keyboard accessible** - The thumbnails are clickable divs, not buttons. Keyboard users can't reach or activate them. Change to `<button>` elements.

**59. `[M]` Hero video has no poster fallback** - If the video fails to load, users see a dark void. Add a `poster` attribute with a static image.

**60. `[S]` Parallax images can show gaps on short viewports** - The `-15% inset` and `130% height` approach sometimes still shows background edges on very short browser windows.

**61. `[S]` Store lightbox has no loading indicator** - When opening fullscreen lightbox view, the image may take time to load. No spinner is shown.

### Form & Commerce UX

**62. `[S]` Inquiry completion bar starts at 14% before user input** - `completionCount` always counts commission type as true (it's pre-selected). The progress bar appears partially filled before the user does anything.

**63. `[S]` Budget slider has no intermediate tick marks** - Only start ($500) and end ($100,000+) are labeled. No visual markers at $5K, $10K, $25K etc. Add subtle ticks or a tooltip showing current value.

**64. `[S]` Cart minus-to-zero removes item without warning** - Clicking minus when quantity is 1 immediately removes the item. Show a trash icon instead of minus, or add a brief confirmation.

**65. `[M]` Cart not persisted across page refreshes** - Cart state lives in React context only. Refreshing the page loses everything. Use `localStorage` to persist.

**66. `[S]` Inquiry form doesn't warn on navigation with unsaved data** - Half-filled forms are lost silently on route change. Add a `beforeunload` listener or React Router's `useBlocker`.

**67. `[S]` PiecePage related pieces section has no fallback** - If no related pieces or stories exist, the page ends abruptly. Add a generic "Browse more" link.

**68. `[S]` Store "Configure" uses `<a>` instead of `<Link>`** - In InspectionDrawer, "Configure" and "Made to Order" buttons use raw `<a href=...>` causing full page reload. Use `<Link>` for SPA navigation.

---

## TIER 4: NICE-TO-HAVE (Elevated experience)

### Micro-interactions & Polish

**69. `[S]` No animation on cart item removal** - Items disappear instantly from the cart. A slide-out or fade would feel polished.

**70. `[S]` Cart badge doesn't animate on add** - The nav badge number changes without visual feedback. A brief scale pulse would draw attention to the update.

**71. `[S]` Newsletter success state is permanent** - After subscribing, "You're on the list" stays forever with no dismiss option. If the user wants to subscribe a different email, they can't.

**72. `[S]` `animate-ripple` defined but never used** - The CSS keyframe exists in `index.css` but no button uses it. Either apply it to primary CTAs or remove the dead code.

**73. `[S]` Cart item remove button too subtle** - The X button is `text-wood-300`, nearly invisible on the light background. Make it visible on row hover.

**74. `[S]` Footer newsletter floating label has a visual jump** - The label transitions between sizes, causing a layout shift. Use `transform: scale()` for smoother animation.

**75. `[S]` No ripple or pressed feedback on primary buttons** - The big "Proceed to Purchase" and "Submit Inquiry" buttons have hover states but no click/active feedback.

**76. `[S]` PiecePage share button only works with Web Share API** - Desktop Chrome doesn't support Web Share. Those users see no share option at all. Add a copy-to-clipboard fallback.

### Layout Enhancements

**77. `[M]` Homepage lacks art category orientation** - New visitors see a quote, creations grid, and commission block but get no quick overview of what Adrian creates. A compact "what I make" summary before the gallery would help first-time visitors orient.

**78. `[S]` Writing landing page cards all look the same** - Every story card uses identical layout. Alternating image sides or featuring one story larger would create visual rhythm.

**79. `[S]` 404 page has no personality** - NotFound is functional but plain. For an art site, this is a missed opportunity for a memorable moment.

**80. `[S]` Store empty search state feels generic** - Just a magnifying glass at 40px. A warmer, on-brand empty state message would be better.

### Dark Mode Refinements

**81. `[S]` No system preference detection** - Dark mode is manual-only via footer toggle. Auto-detect `prefers-color-scheme: dark` on first visit.

**82. `[S]` Dark mode transition incomplete** - Body background transitions, but some individual elements may flash when toggling. Ensure CSS variable remapping transitions smoothly for all elements.

**83. `[S]` Some inline styles use hardcoded colors** - About.tsx and OracleCards.tsx use inline `style` with hex colors like `#ab9266` that won't respond to dark mode CSS variable changes.

**84. `[S]` Dark mode progress bar contrast** - The reading progress bar uses `bg-bronze-400`. Verify it's visible against dark backgrounds.

### Code Quality (UX-Impacting)

**85. `[S]` Duplicated hooks: useScrollProgress, useReveal, useParallax** - Copy-pasted between About.tsx and OracleCards.tsx. If one gets a bug fix, the other doesn't. Extract to shared `hooks/` directory.

**86. `[S]` Duplicated CSS across inline style blocks** - `.reveal-block`, `.drop-cap`, `.pg-*` rules are identically defined in both About and OracleCards `<style>` tags. Move to `index.css`.

**87. `[S]` DarkModeContext re-renders entire app on toggle** - The provider wraps `AppInner`, meaning toggle causes a full re-render tree. Memoize children or use a more targeted state approach.

**88. `[S]` TODO_REPLACE badge visible in production** - About.tsx renders a yellow "Replace this story" badge with dashed outline on the "What Art Can Mean" section. This dev annotation should not be visible to users.

**89. `[S]` Cart context accepts any Product without validation** - `addToCart` doesn't validate price, availability, or required fields. Invalid products could cause checkout errors.

---

## TIER 5: FUTURE ENHANCEMENTS

**90. `[L]` Page-level loading skeletons** - Show content skeletons during page transitions instead of blank pages while components mount.

**91. `[L]` Responsive images with srcset** - All images load at full size. Add `srcset` and `sizes` for proper responsive delivery.

**92. `[L]` Global site search** - Search only exists in the Store. A universal search covering creations, writings, and products would be very useful.

**93. `[M]` "Recently Viewed" pieces** - Track piece views and show a small carousel on Creations or PiecePage.

**94. `[M]` Print stylesheet** - Footer has `print:hidden` but no other print consideration. Collectors may want to print piece details.

**95. `[L]` Image comparison slider for illuminated pieces** - IlluminatedWorks talks about day vs. night appearance but has no interactive comparison. A before/after slider would be compelling.

**96. `[M]` Currency selector for international visitors** - All prices in USD. Even approximate conversion would help international collectors.

**97. `[S]` Add favicons and app icons** - No favicon is set in `index.html`. Add proper favicon, apple-touch-icon, and manifest icons.

**98. `[M]` Route-level error boundaries** - The global ErrorBoundary catches everything. Per-route boundaries would allow graceful fallbacks for individual pages.

**99. `[M]` Writing card reading time display** - Stories have `readMinutes` in data but the landing page cards don't show it.

**100. `[S]` PiecePage structured data inconsistency** - PiecePage uses `safeJsonLd` for JSON-LD but About uses raw `JSON.stringify`. Use the safe version consistently.

**101. `[M]` Intersection-based infinite scroll for Store** - The manual "Load More" button could be replaced with auto-loading when the button enters the viewport.

**102. `[M]` Welcome page needs its own OG meta** - If `/welcome` is meant as a link-in-bio page, it needs its own social card and meta.

**103. `[S]` OracleCards page too long with no mobile quick-nav** - Four deck sections + philosophy + gallery. Mobile users scrolling this have no section jump mechanism.

**104. `[S]` Collection card hover should show piece count more prominently** - The count is small text at the bottom. Make it more visible.

**105. `[S]` Footer "Currently" status could link to inquire** - "Currently taking commissions for Spring 2026" is purely informational. Making it a link adds a conversion path.

**106. `[M]` Sticky mobile CTA bar on PiecePage may obscure content** - The sticky bottom bar with price and buy button may overlap the last paragraph of piece descriptions.

**107. `[S]` Category routing is inconsistent** - Multi Art and Illuminated Works have dedicated pages. Other categories use query-string filtering. Two different patterns for the same action.

**108. `[L]` Proper analytics event tracking** - Key interactions (category clicks, piece views, add-to-cart, inquiry submit, newsletter signup) should fire tracking events.

**109. `[M]` Add PWA capabilities** - Service worker and manifest for offline browsing of previously viewed pieces.

**110. `[S]` Z-index scale undocumented** - Nav uses z-100/101, Teajia bar z-101, cart drawer z-3000, modals z-2000/9999. No documented scale. Future features will inevitably conflict.

**111. `[S]` Active filter chips not visible on Creations** - When filters are applied, there's no persistent chip/tag showing what's active. Users may forget their filters.

**112. `[M]` Store philosophy interstitials break scanning** - Every 5th item in the Store grid inserts a text block. This breaks the visual rhythm of browsing. Move philosophy content above or below the grid.

**113. `[S]` Modal drawers missing Escape key handler** - Neither cart nor inspection drawer responds to Escape. Standard modal UX expects this.

**114. `[S]` Scroll position lost on back navigation from piece pages** - Returning from a piece page to a filtered gallery resets scroll to top instead of where the user left off.

**115. `[S]` Commission path cards have odd shrink effect** - Unselected cards scale to 0.98x, which reads as a rendering glitch rather than intentional. Make unselected state neutral.

**116. `[S]` Mobile menu has no backdrop/scrim** - Menu opens over content with no dark overlay behind it. Tapping outside doesn't close it.

**117. `[S]` Cart badge caps at "9+"** - Show the real number for collectors building large orders.

**118. `[S]` Subcategory filter bar uses hidden scrollbar on mobile** - Horizontal pills overflow with `scrollbar-hide` but no visual indicator that more options exist off-screen.

**119. `[S]` No visible sort control in subcategory pages** - SubcategoryPage has filters but no sort option (price, newest). Users can't reorder results.

**120. `[M]` Creations page should remember last-used category** - When returning to `/creations` after viewing a piece, the page resets to the default "Selected Works" view instead of remembering the category the user was browsing.

---

## IMPLEMENTATION CHECKLIST

### TIER 1: CRITICAL

#### Navigation & Wayfinding
- [x] **1.** `[S]` Nav active state prefix matching
- [x] **2.** `[S]` Global scroll-to-top on route change
- [x] **3.** `[M]` Dismissable Teajia promo bar
- [x] **4.** `[S]` Desktop hero CTA
- [ ] **5.** `[M]` Consistent breadcrumbs across all pages
- [ ] **6.** `[S]` Back navigation uses history with fallback
- [x] **7.** `[S]` Remove dead footer links
- [ ] **8.** `[M]` Page transition animation
- [x] **9.** `[S]` "Enter" scroll indicator clickable
- [x] **10.** `[S]` Larger hamburger tap target

#### Mobile Experience
- [ ] **11.** `[M]` Two-column mobile gallery
- [ ] **12.** `[S]` Filter pill touch targets too small
- [x] **13.** `[S]` Store search visible on mobile
- [ ] **14.** `[M]` Cart drawer swipe-to-close
- [ ] **15.** `[S]` About/OracleCards side-nav dots on mobile
- [ ] **16.** `[M]` Swipe gesture on PiecePage image gallery
- [ ] **17.** `[S]` Sticky filter bars account for Teajia bar

#### Accessibility
- [ ] **18.** `[M]` Skip-to-content link
- [ ] **19.** `[M]` `prefers-reduced-motion` support
- [x] **20.** `[S]` Hero video `aria-hidden`
- [x] **21.** `[S]` Mobile menu ARIA attributes
- [ ] **22.** `[S]` Form errors connected via `aria-describedby`
- [ ] **23.** `[S]` Budget slider `aria-valuenow` / `aria-valuetext`
- [ ] **24.** `[S]` Focus trap on drawers
- [x] **25.** `[S]` Escape key handler on drawers

### TIER 2: HIGH IMPACT

#### Interaction Design
- [ ] **26.** `[S]` `:active` states for touch devices
- [ ] **27.** `[M]` Gallery hover: replace overlay with subtle indicator
- [ ] **28.** `[S]` Collection card click scrolls to results
- [ ] **29.** `[S]` PiecePage "Add to Cart" confirmation more visible
- [ ] **30.** `[S]` Gallery tile keyboard focus visual
- [ ] **31.** `[M]` Image lightbox swipe-to-dismiss
- [ ] **32.** `[S]` Category tile descriptions visible by default
- [ ] **33.** `[S]` Deterministic "Continue the Journey" sorting
- [x] **34.** `[M]` Remove silent form early-submit
- [ ] **35.** `[S]` Loading indicator / disable fields during inquiry submit

#### Visual Consistency
- [ ] **36.** `[S]` Consolidate back-to-top implementations
- [ ] **37.** `[S]` Consistent commission CTA text
- [ ] **38.** `[S]` Consistent border radius policy
- [ ] **39.** `[S]` Unified hover underline mechanics
- [ ] **40.** `[S]` Dark mode toggle more discoverable
- [x] **41.** `[S]` Remove duplicate footer Commissions/Contact

#### Performance & Loading
- [ ] **42.** `[M]` Pause GenerativeBackground when not visible
- [ ] **43.** `[S]` Image placeholder in gallery cards
- [ ] **44.** `[S]` Store skeleton count matches expected results
- [ ] **45.** `[S]` Consolidate scroll listeners

### TIER 3: IMPORTANT

#### Navigation Refinements
- [ ] **46.** `[M]` Creations category tiles show piece count
- [ ] **47.** `[S]` Subcategory "Explore more" uses tile cards
- [ ] **48.** `[S]` "Back to writings" link at bottom of articles
- [ ] **49.** `[S]` Clarify "Selected Works" label on Creations
- [ ] **50.** `[M]` Writing categories show piece counts
- [ ] **51.** `[S]` Sort options always available on Creations

#### Typography & Readability
- [ ] **52.** `[S]` Writing article max-width for readability
- [ ] **53.** `[S]` Drop cap handles leading punctuation
- [ ] **54.** `[S]` Consolidate price formatting functions
- [ ] **55.** `[S]` Availability text colors meet WCAG AA contrast
- [ ] **56.** `[S]` Move inline styles from About/OracleCards to index.css

#### Image & Media
- [ ] **57.** `[M]` Image error handling with styled fallback
- [ ] **58.** `[S]` PiecePage thumbnails keyboard accessible
- [ ] **59.** `[M]` Hero video poster fallback
- [ ] **60.** `[S]` Parallax images gap fix on short viewports
- [ ] **61.** `[S]` Store lightbox loading indicator

#### Form & Commerce UX
- [ ] **62.** `[S]` Inquiry completion bar starts at 0%
- [ ] **63.** `[S]` Budget slider intermediate tick marks
- [ ] **64.** `[S]` Cart minus-to-zero shows trash icon
- [ ] **65.** `[M]` Persist cart in localStorage
- [ ] **66.** `[S]` Inquiry form warns on unsaved navigation
- [ ] **67.** `[S]` PiecePage related pieces fallback
- [ ] **68.** `[S]` Store "Configure" uses `<Link>` not `<a>`

### TIER 4: NICE-TO-HAVE

#### Micro-interactions & Polish
- [ ] **69.** `[S]` Cart item removal animation
- [ ] **70.** `[S]` Cart badge pulse on add
- [ ] **71.** `[S]` Newsletter success state dismissable
- [ ] **72.** `[S]` Remove or use `animate-ripple`
- [ ] **73.** `[S]` Cart item remove button more visible
- [ ] **74.** `[S]` Footer newsletter label smooth animation
- [ ] **75.** `[S]` Active/pressed feedback on primary buttons
- [ ] **76.** `[S]` PiecePage share copy-to-clipboard fallback

#### Layout Enhancements
- [ ] **77.** `[M]` Homepage art category orientation section
- [ ] **78.** `[S]` Writing cards visual rhythm variation
- [ ] **79.** `[S]` 404 page personality
- [ ] **80.** `[S]` Store empty search state on-brand

#### Dark Mode Refinements
- [ ] **81.** `[S]` System preference detection for dark mode
- [ ] **82.** `[S]` Dark mode transition completeness
- [ ] **83.** `[S]` Replace hardcoded inline colors with CSS vars
- [ ] **84.** `[S]` Dark mode progress bar contrast

#### Code Quality (UX-Impacting)
- [ ] **85.** `[S]` Extract shared hooks to `hooks/` directory
- [ ] **86.** `[S]` Move duplicated CSS to index.css
- [ ] **87.** `[S]` DarkModeContext targeted re-renders
- [x] **88.** `[S]` Remove TODO_REPLACE badge from About
- [ ] **89.** `[S]` Cart context product validation

### TIER 5: FUTURE ENHANCEMENTS

- [ ] **90.** `[L]` Page-level loading skeletons
- [ ] **91.** `[L]` Responsive images with srcset
- [ ] **92.** `[L]` Global site search
- [ ] **93.** `[M]` "Recently Viewed" pieces
- [ ] **94.** `[M]` Print stylesheet
- [ ] **95.** `[L]` Image comparison slider for illuminated pieces
- [ ] **96.** `[M]` Currency selector
- [ ] **97.** `[S]` Add favicons and app icons
- [ ] **98.** `[M]` Route-level error boundaries
- [ ] **99.** `[M]` Writing card reading time display
- [ ] **100.** `[S]` PiecePage structured data consistency
- [ ] **101.** `[M]` Intersection-based infinite scroll for Store
- [ ] **102.** `[M]` Welcome page OG meta
- [ ] **103.** `[S]` OracleCards mobile quick-nav
- [ ] **104.** `[S]` Collection card piece count prominence
- [ ] **105.** `[S]` Footer "Currently" links to inquire
- [ ] **106.** `[M]` Sticky mobile CTA bar content overlap
- [ ] **107.** `[S]` Consistent category routing pattern
- [ ] **108.** `[L]` Analytics event tracking
- [ ] **109.** `[M]` PWA capabilities
- [ ] **110.** `[S]` Document z-index scale
- [ ] **111.** `[S]` Active filter chips on Creations
- [ ] **112.** `[M]` Store philosophy interstitials placement
- [ ] **113.** `[S]` ~~Modal drawers Escape key~~ (done via #25)
- [ ] **114.** `[S]` Scroll position preserved on back navigation
- [ ] **115.** `[S]` Commission path cards neutral unselected state
- [ ] **116.** `[S]` Mobile menu backdrop/scrim
- [ ] **117.** `[S]` Cart badge shows real number
- [ ] **118.** `[S]` Subcategory filter scroll indicator
- [ ] **119.** `[S]` Sort control in subcategory pages
- [ ] **120.** `[M]` Creations remembers last-used category
