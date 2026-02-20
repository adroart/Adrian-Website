# Website Improvement Audit: 100 Suggested Improvements

Comprehensive audit of Adrian Rasmussen's artist portfolio and e-commerce site. Improvements are grouped by category and ordered from highest to lowest impact within each group.

---

## A. Performance & Core Web Vitals (1-12)

1. **Replace placeholder images with optimized real artwork photography** --- Every image currently loads from `picsum.photos`. Real, professionally shot artwork images in WebP/AVIF format with proper `srcset` and `sizes` attributes would dramatically improve perceived quality, load time, and SEO (Google Images traffic).

2. **Implement responsive image `srcset` with multiple resolutions** --- Currently images load at a single resolution. Serve 400w, 800w, 1200w, and 1600w variants so mobile users don't download desktop-sized images, cutting payload by 60-80% on phones.

3. **Add route-based code splitting with `React.lazy` and `Suspense`** --- The entire app bundles into one chunk. Lazy-load routes like `/writings/:slug`, `/shop`, `/privacy`, `/terms` so the initial bundle only contains the landing page, reducing first-load JS by ~40%.

4. **Replace the Wix-hosted hero video with a self-hosted, compressed MP4 with poster frame** --- The hero video loads from an external Wix domain, adding DNS lookup time, losing cache control, and risking breakage. A locally hosted, H.265/VP9-compressed video with a static poster image would load faster and be more reliable.

5. **Add a Service Worker for offline support and asset precaching** --- Artwork images, fonts, and static pages could be cached locally after first visit. Returning visitors would see near-instant page loads, and the site would work partially offline (important for art fairs with spotty WiFi).

6. **Implement image lazy loading with blur-up placeholders (LQIP)** --- While `loading="lazy"` is used, there's no visual placeholder. A 20px blurred thumbnail that transitions to the full image creates a polished loading experience and eliminates layout shift (CLS).

7. **Preload critical above-the-fold fonts** --- Five Google Font families are loaded via stylesheets. Preloading Cormorant Garamond and Cinzel (the hero fonts) with `<link rel="preload">` would eliminate the flash of unstyled text (FOUT) on first visit.

8. **Reduce the GenerativeBackground particle count on low-end devices** --- The canvas animation runs the same particle count regardless of device capability. Use `navigator.hardwareConcurrency` or frame-rate detection to reduce particles on weaker devices, preventing janky scrolling.

9. **Add `will-change` and GPU-composited layers for animated elements** --- The sticky nav, cart drawer slide, and image zoom transitions could benefit from `will-change: transform` hints, promoting them to compositor layers for smoother 60fps animations.

10. **Implement `content-visibility: auto` on below-fold sections** --- The Home page renders all sections (hero, selected works, writings, pathways) eagerly. Using `content-visibility: auto` on off-screen sections would skip their rendering until scroll, improving initial paint.

11. **Bundle and self-host Google Fonts** --- Five font families loaded from Google Fonts means extra DNS lookups and render-blocking requests. Self-hosting the subset WOFF2 files eliminates third-party dependency and enables aggressive caching.

12. **Add HTTP caching headers for static assets via Cloudflare** --- Configure `Cache-Control: public, max-age=31536000, immutable` for hashed assets in `wrangler.toml` so returning visitors load from cache instantly.

---

## B. Mobile Experience (13-25)

13. **Add a persistent mobile bottom navigation bar** --- On mobile, the hamburger menu requires two taps to reach any page. A fixed bottom bar with icons for Home, Creations, Shop, Inquire, and Cart would match modern mobile app conventions and reduce navigation friction.

14. **Implement pull-to-refresh on gallery and shop pages** --- Mobile users expect pull-to-refresh behavior. Adding this interaction (even if it just re-filters/re-renders) provides tactile feedback and familiarity.

15. **Optimize touch targets to minimum 48x48px consistently** --- While some buttons meet the 44px minimum, several filter chips, thumbnail selectors, and footer links are smaller. Google's mobile-friendly test recommends 48px with 8px spacing between targets.

16. **Add haptic feedback on add-to-cart actions (Vibration API)** --- A subtle vibration pulse when adding items to the cart provides satisfying tactile confirmation on supported devices, reinforcing the action without requiring visual attention.

17. **Implement swipe-to-dismiss on the cart drawer** --- The cart drawer opens from the right but can only be closed by tapping the X or overlay. Swipe-right-to-close is the natural mobile gesture for drawers.

18. **Add a "sticky add-to-cart" bar on product pages that appears on scroll** --- The current bottom bar is good but could be enhanced: show the product thumbnail, price, and CTA button in a compact strip that slides up once the main CTA scrolls out of view.

19. **Support landscape orientation for image galleries** --- Many users rotate their phones to view art in landscape. The gallery should adapt, showing the image full-width in landscape with controls overlaid rather than stacked below.

20. **Add pinch-to-zoom with momentum on gallery images** --- The current zoom is click-based (2.5x fixed). Native-feeling pinch-to-zoom with momentum physics and min/max bounds would feel more intuitive for examining artwork detail.

21. **Implement "Save for Later" with local storage** --- Mobile shoppers often browse and return later. A heart/bookmark icon that saves pieces to a persistent wishlist (localStorage) lets them pick up where they left off.

22. **Optimize form inputs for mobile keyboards** --- Set `inputMode="email"` on email fields, `inputMode="tel"` on phone fields, and `inputMode="numeric"` on budget/quantity fields so the correct mobile keyboard appears automatically.

23. **Add scroll-snap to the category tiles on the Creations page** --- The horizontal-scrollable category tiles would benefit from CSS `scroll-snap-type: x mandatory` so they snap cleanly to each tile rather than stopping mid-card.

24. **Reduce the mobile hamburger menu to a single-level flat list** --- The current mobile menu has nested navigation that requires multiple taps. A flat, full-screen overlay with large touch targets and clear hierarchy would be faster to use.

25. **Implement iOS safe-area insets for notched devices** --- Use `env(safe-area-inset-bottom)` on the fixed bottom bar and `env(safe-area-inset-top)` on the sticky header to prevent content from being obscured by iPhone notches and home indicators.

---

## C. User Experience & Interaction Design (26-42)

26. **Add a global search with instant results** --- There's no search functionality outside the shop filter. A global search (triggered by `/` key or search icon) that searches across artworks, writings, and the shop would help users find specific pieces quickly.

27. **Implement a lightbox/fullscreen image viewer** --- Clicking artwork images should open a fullscreen, edge-to-edge lightbox with navigation arrows, zoom, and a dark background. The current inline zoom is functional but doesn't give the art the visual space it deserves.

28. **Add "View in Room" AR or size-comparison visualization** --- Art buyers need to understand scale. An overlay showing the artwork at actual dimensions against a wall mockup (or simple silhouette comparison) would dramatically increase purchase confidence.

29. **Create smooth page transitions between routes** --- Navigation between pages is an abrupt swap. Adding a subtle fade or slide transition (via Framer Motion or View Transitions API) would make the site feel more cohesive and app-like.

30. **Add a "Quick View" modal on gallery cards** --- In the Creations grid, hovering/tapping a piece currently navigates to a full new page. A quick-view modal showing the key image, price, and "View Full Details" link would let browsers scan faster.

31. **Implement scroll-triggered reveal animations for content sections** --- The Home page and Writings page have `fadeIn` and `slideUp` animations, but they fire on mount, not on scroll visibility. Using `IntersectionObserver` to trigger animations as sections enter the viewport would create a more dynamic storytelling experience.

32. **Add a "Recently Viewed" section on product/piece pages** --- Track the last 5-8 pieces a user has viewed (via localStorage) and display them at the bottom of each piece page, making it easy to compare and return to items.

33. **Implement keyboard shortcuts for power users** --- Arrow keys for gallery navigation, `Esc` to close modals/drawers, `/` for search, `?` for a shortcuts cheat sheet. These are zero-cost additions that delight repeat visitors.

34. **Add a reading progress bar on Writings articles** --- A thin progress bar at the top of the page (or subtle side indicator) showing how far the reader has scrolled through a writing piece encourages completion and provides spatial orientation.

35. **Create an "Explore by Mood/Energy" discovery path** --- Beyond category filters, let users browse by aesthetic feeling (e.g., "Meditative," "Dynamic," "Luminous," "Grounding"). Tag existing pieces with mood attributes and create a curated entry point.

36. **Add micro-interactions to buttons and CTAs** --- The "Add to Cart" and "Inquire" buttons could use subtle animations --- a ripple effect, a brief scale pulse, or a checkmark morph --- to provide satisfying feedback when clicked.

37. **Implement a "Compare Pieces" feature for similar artworks** --- Let users select 2-3 pieces and view them side by side with dimensions, pricing, and materials compared in a table format. Useful for collectors deciding between similar works.

38. **Show a toast notification when items are added to cart** --- Currently adding to cart updates the badge count silently (unless the drawer is open). A brief toast ("Added to cart") with an "Undo" option confirms the action without disrupting browsing.

39. **Add cursor-aware parallax on hero section** --- The hero section could have subtle depth with the background video/image shifting slightly based on mouse position, creating an immersive entrance that matches the "multidimensional" brand.

40. **Create an onboarding tooltip tour for first-time visitors** --- A subtle, dismissible set of 3-4 tooltips highlighting key features (filtering, made-to-order configuration, the writings section) would help new visitors discover the site's depth.

41. **Add a "Back to Top" floating button on long pages** --- The Creations, Shop, and Writings pages can get very long with loaded content. A subtle floating button (appearing after scrolling past 2 viewport heights) saves users from manual scrolling.

42. **Implement URL-based filter state for shareable gallery views** --- Category filters and sort selections on the Creations and Shop pages should update the URL query parameters (`?category=mandala&sort=newest`) so filtered views can be bookmarked and shared.

---

## D. E-Commerce & Conversion (43-57)

43. **Replace all mock Stripe Price IDs with real ones** --- The entire shop and made-to-order system uses `[DUMMY]` placeholder IDs. No actual purchases can be completed until real Stripe Products and Prices are configured.

44. **Add trust signals near the checkout CTA** --- Display "Secure Checkout," a lock icon, accepted payment method logos (Visa, Mastercard, Apple Pay), and "Free Shipping on orders over $X" near the Add to Cart button to reduce purchase anxiety.

45. **Implement abandoned cart recovery via email** --- When a user adds items to their cart but doesn't check out within a session, offer to email them their cart contents (via a subtle modal before they leave, or a newsletter-linked reminder).

46. **Add a "Notify Me" feature for sold-out pieces** --- Sold works currently show a static "Sold" badge. Let interested buyers enter their email to be notified if a similar piece becomes available or the artist creates a new edition.

47. **Show estimated shipping cost and delivery timeline before checkout** --- Buyers want to know shipping costs before clicking "Checkout." Display estimated shipping based on detected location (via IP geolocation or country selector) on the cart drawer.

48. **Add product reviews or collector testimonials** --- Social proof is the single strongest conversion driver for high-value art purchases. Even 3-5 curated testimonials from collectors, displayed on relevant piece pages, would build trust.

49. **Implement a "Gift This" option** --- Art makes a popular gift. Add a gift-wrapping option and the ability to include a personal message, with a separate shipping address for the recipient.

50. **Create urgency indicators for limited editions** --- For pieces with editions (e.g., "3 of 10 remaining"), show a visual progress bar and messaging like "Only 3 left" in a warm accent color. This exists partially but could be more visually prominent.

51. **Add Apple Pay / Google Pay express checkout** --- Stripe supports Payment Request API. Adding express checkout buttons reduces the purchase flow from ~8 clicks to 2, dramatically improving mobile conversion rates.

52. **Implement a commission quote calculator** --- The Inquire form collects budget information but doesn't give users a sense of pricing. An interactive calculator ("Select size + material + features = estimated range") would set expectations and qualify leads.

53. **Add "Frequently Bought Together" or "Collectors Also Viewed" recommendations** --- Cross-reference purchase and viewing data (or manually curate) related pieces shown on each product page. The "Related Pieces" section exists but could be more commercial.

54. **Create a loyalty/VIP collector program** --- Repeat buyers could earn early access to new pieces, studio visit invitations, or a discount on their next purchase. Even a simple "Join the Collector's Circle" email signup creates exclusivity.

55. **Add order tracking post-purchase** --- After checkout, redirect to a confirmation page with order details and a link to track shipping. Currently, Stripe handles this, but a branded experience builds trust.

56. **Implement quantity discounts or bundle pricing** --- For smaller shop items (if applicable), show savings when buying multiples. "Buy 2, save 10%" encourages higher cart values.

57. **Add a "Request Custom Size" option on made-to-order pieces** --- The current size selector offers fixed options. A "Need a different size? Contact us" link connected to the Inquire form (pre-filled with the piece name) would capture leads for custom work.

---

## E. Content & Storytelling (58-68)

58. **Add a studio/process video or photo series** --- Showing the artist at work --- laser cutting, assembling, illuminating --- builds emotional connection and justifies premium pricing. A dedicated "Process" section or embedded videos on piece pages would be powerful.

59. **Create an "Artist's Journal" blog format with regular updates** --- The Writings section has thoughtful content but feels static. Adding dates, an RSS feed, and a cadence of new posts keeps visitors returning and improves SEO with fresh content.

60. **Add audio narration option for Writings articles** --- Let the artist record (or generate via text-to-speech) audio versions of the writings. An embedded player with play/pause lets visitors listen while browsing the gallery, deepening engagement.

61. **Write alt text that describes the art, not just "artwork image"** --- Current alt text is placeholder-based. Descriptive alt text ("Mandala sculpture in walnut with geometric laser-cut patterns and embedded LED lighting, 24 inches") serves blind users and boosts image SEO.

62. **Add an "Exhibitions & Events" page or section** --- If the artist shows work at galleries, fairs, or Burning Man, listing upcoming and past events creates urgency ("See these pieces in person at...") and establishes credibility.

63. **Create "The Story Behind This Piece" expandable sections on PiecePage** --- Each artwork has a `longDescription`, but it could be enriched with the artist's personal narrative: inspiration, challenges, materials sourcing. Make it an expandable section so it doesn't clutter the page.

64. **Add a press/media kit page** --- A simple page with high-resolution images, artist bio in multiple lengths, and key facts makes it easy for journalists, galleries, and curators to feature the work.

65. **Implement a visual timeline of the artist's creative journey** --- An interactive or scrollable timeline showing key milestones (first exhibition, series launches, residencies) provides context for the work and builds the artist's narrative.

66. **Add a "Collector's Guide" educational page** --- Content addressing "How to Care for Your Artwork," "Understanding Editions," "Commissioning Custom Work" educates buyers and reduces pre-purchase anxiety.

67. **Create video walkarounds for 3D sculptural pieces** --- Static images can't convey the dimensionality of layered wood sculptures. Short (10-15 second) rotating video clips or 360-degree viewers would showcase depth and light play.

68. **Add Instagram feed integration showing latest posts** --- An embedded Instagram grid (or manually curated recent works feed) on the homepage connects the social presence to the website and shows the artist is actively creating.

---

## F. Accessibility (69-78)

69. **Add ARIA live regions for dynamic content updates** --- When filters change the gallery, items are added to cart, or form submissions complete, screen readers receive no notification. `aria-live="polite"` regions would announce these changes.

70. **Implement focus trapping in modals and drawers** --- The cart drawer, mobile menu, and any lightbox should trap keyboard focus within the overlay, preventing users from tabbing to obscured background content.

71. **Add skip-to-content links** --- A hidden link at the top of every page ("Skip to main content") that becomes visible on focus lets keyboard users bypass the navigation on every page load.

72. **Ensure all interactive elements have visible focus indicators** --- Tailwind's default focus rings may be suppressed or invisible on dark backgrounds. Custom `:focus-visible` styles with sufficient contrast ensure keyboard navigability.

73. **Add `prefers-reduced-motion` support** --- The particle animation, fadeIn effects, and slide transitions should respect `@media (prefers-reduced-motion: reduce)` by disabling or simplifying animations for users who've requested it.

74. **Provide text alternatives for the hero video** --- The autoplaying hero video has no captions, transcript, or text alternative. A descriptive text overlay or aria-label ensures the content is accessible.

75. **Improve color contrast ratios on muted text** --- Some secondary text (e.g., "Edition 3 of 10", material descriptions) uses light gray on white backgrounds. Ensure all text meets WCAG AA contrast (4.5:1 for body text, 3:1 for large text).

76. **Add `aria-describedby` to form validation errors** --- When form fields have errors, the error message should be programmatically linked to the input via `aria-describedby` so screen readers announce the error in context.

77. **Make the particle canvas background `aria-hidden="true"`** --- The decorative GenerativeBackground provides no informational content. Marking it `aria-hidden` prevents screen readers from attempting to describe it.

78. **Add language attributes and landmark roles** --- Ensure `<html lang="en">` is set and all major sections use proper landmark roles (`<main>`, `<nav>`, `<aside>`, `<footer>`) consistently across all pages.

---

## G. SEO & Discoverability (79-87)

79. **Implement server-side rendering (SSR) or static site generation (SSG)** --- The site is a client-side SPA, meaning search engine crawlers see an empty `<div id="root">`. Migrating to Next.js, Remix, or Astro with SSR/SSG would ensure all content is indexable by default.

80. **Add a comprehensive XML sitemap** --- No `sitemap.xml` exists. An auto-generated sitemap listing all artwork pages, writings, shop items, and static pages would help search engines discover and index every page.

81. **Implement canonical URLs on all pages** --- Prevent duplicate content issues (e.g., `/creations/mandala-1` vs. `/shop/mandala-1`) by adding `<link rel="canonical">` to every page head.

82. **Add structured data for FAQ, HowTo, or ImageGallery schemas** --- Beyond the existing Product and Article schemas, adding ImageGallery schema to the Creations page and FAQ schema to a collector's guide would earn rich snippets in search results.

83. **Create a `robots.txt` with proper directives** --- No `robots.txt` exists. Define crawl rules, point to the sitemap, and block irrelevant paths (e.g., `/api/`, cart pages).

84. **Optimize page titles and meta descriptions for click-through rate** --- Current titles are descriptive but could be more compelling. "Handcrafted Sacred Geometry Art | Adrian Rasmussen" is better than "Adrian Rasmussen | Creations" for attracting search clicks.

85. **Add Open Graph and Twitter Card images per page** --- Currently a single OG image is shared across all pages. Each artwork page should have its own OG image (the primary artwork photo) so social shares show the actual piece.

86. **Implement breadcrumb navigation on all pages** --- Breadcrumbs exist on PiecePage but not on Creations, Shop, Writings, or subcategory pages. Consistent breadcrumbs improve navigation and generate BreadcrumbList rich snippets.

87. **Add `hreflang` tags if the site will support multiple languages** --- If there's any plan for international audiences (the artist is based in Bali), `hreflang` tags and translated content would capture non-English search traffic.

---

## H. Visual Design & Polish (88-95)

88. **Design a custom 404 page that reflects the brand** --- The current 404 page is functional but generic. A branded 404 with an artwork background, a philosophical message ("This path has not yet been carved..."), and clear navigation back to key pages would turn errors into brand moments.

89. **Add a dark mode toggle that persists across sessions** --- The dark/light theme toggle exists but could be enhanced: persist the preference in localStorage, respect `prefers-color-scheme` on first visit, and add a smooth color transition animation.

90. **Create loading skeleton screens for all data-heavy pages** --- The Shop page has basic skeleton loaders, but the Creations gallery, Writings list, and PiecePage should also show content-shaped placeholders during load rather than blank space.

91. **Animate the logo/wordmark on hover or page entry** --- A subtle SVG animation on the "Adrian Rasmussen" wordmark (a gentle letter-spacing expansion, an underline draw, or a weight shift) would add refinement to the brand identity.

92. **Add a subtle grain or texture overlay to backgrounds** --- The clean white/dark backgrounds are polished but could feel more organic with a very subtle paper or linen texture overlay (CSS background-image with low opacity) that matches the "handcrafted" brand.

93. **Improve the visual hierarchy of the Creations category tiles** --- The current category tiles are uniformly sized. Making the primary categories (Multidimensional Art, Illuminated Works) larger than secondary ones creates a visual hierarchy that guides browsing.

94. **Add hover states showing piece titles on gallery grid images** --- In the Creations masonry grid, hovering over an artwork image could reveal the piece title, price, and availability as an overlay, reducing the need to click through for basic information.

95. **Refine the typography scale for better rhythm** --- While the font choices are excellent, the spacing between heading sizes could follow a more precise modular scale (e.g., 1.25 ratio) for more harmonious visual rhythm across the site.

---

## I. Technical & Infrastructure (96-100)

96. **Add analytics tracking (Plausible, Fathom, or privacy-respecting alternative)** --- There's no analytics integration. Understanding which pages visitors view, where they drop off, and which pieces get the most attention is essential for optimizing the site and informing the artist's business decisions.

97. **Implement rate limiting on the Cloudflare Workers checkout API** --- The `/api/checkout` endpoint has no rate limiting. An attacker could spam Stripe Checkout Session creation. Add Cloudflare rate limiting rules (e.g., 10 requests per minute per IP).

98. **Add end-to-end tests for the checkout flow** --- The most critical user journey (browse > add to cart > checkout) has no automated tests. Playwright or Cypress tests covering this flow would catch regressions before they cost sales.

99. **Migrate from mock data to a headless CMS** --- The 543-line `mockData.ts` file is unmaintainable at scale. A headless CMS (Sanity, Contentful, or Strapi) would let the artist manage artwork, writings, and shop items through a visual editor without developer involvement.

100. **Add error monitoring (Sentry or LogRocket)** --- Client-side errors currently fail silently. A monitoring service would capture JavaScript errors, failed API calls, and checkout failures in real-time, enabling quick diagnosis and fixes.
