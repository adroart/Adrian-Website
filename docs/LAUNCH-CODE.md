# What Needs to Be Coded

Everything that can be done by a developer/AI without Adrian's direct involvement, plus items waiting on Adrian's input. Organized by priority.

---

## STATUS: Already Complete

These items from the original checklist and planning docs are **done**:

- [x] Cloudinary pipeline: `utils/cloudinary.ts` with `img()` and `srcset()` helpers
- [x] `ArtImage.tsx` updated with `publicId` prop and responsive srcsets
- [x] All picsum.photos URLs replaced with Cloudinary public IDs (mockData + all components)
- [x] Hero video migrated from Wix to Cloudinary
- [x] Cart system: CartContext, CartDrawer, CartIcon in Navigation
- [x] Stripe Checkout Sessions API: `functions/api/checkout.js`
- [x] Checkout success/cancel handling (inline in Store.tsx)
- [x] Inquire form: Location, Size range, Image upload fields added
- [x] Inquire form: submits to `/api/inquire` (Cloudflare Function)
- [x] Newsletter: ConvertKit/Kit integration in Footer
- [x] Analytics: Cloudflare Web Analytics enabled via dashboard
- [x] SEO: robots.txt, sitemap.xml, canonical URLs, per-page meta descriptions
- [x] SEO: Open Graph + Twitter Card meta tags
- [x] SEO: BreadcrumbList + Person structured data
- [x] SEO: Image alt text standards implemented
- [x] Accessibility: skip-to-content, prefers-reduced-motion, focus trapping, aria attributes
- [x] Edition display logic with progressive scarcity rules
- [x] Sold piece behavior (commission link)
- [x] Share button on piece pages + writings
- [x] Sticky bottom bar on mobile piece pages
- [x] 404 page
- [x] Image lazy loading
- [x] Store search visible on mobile
- [x] Dismissable Teajia promo bar
- [x] Desktop hero CTA
- [x] "Enter" scroll indicator clickable
- [x] Nav active state prefix matching
- [x] Global scroll-to-top on route change
- [x] Dead footer links removed
- [x] Larger hamburger tap target
- [x] Silent form early-submit removed
- [x] TODO_REPLACE badge removed from About
- [x] Duplicate footer Commissions/Contact removed

---

## BEFORE LAUNCH: Can do now (no Adrian input needed)

These are code improvements I can make right now without waiting for anything:

### High Priority
- [ ] **Favicon implementation** (need Adrian's image, but can prep the markup and sizes)
- [ ] **OG image per page** (need real images, but can prep the dynamic og:image meta tag system)
- [ ] **Back navigation uses history with fallback** (UX audit #6: PiecePage hardcodes `/creations`)
- [ ] **Deterministic "Continue the Journey" sorting** (UX audit #33: random sort on every render)
- [ ] **Loading indicator / disable fields during inquiry submit** (UX audit #35)
- [ ] **Store "Configure" uses `<Link>` not `<a>`** (UX audit #68: prevents full page reload)
- [ ] **Form errors connected via `aria-describedby`** (UX audit #22)
- [ ] **Budget slider `aria-valuenow` / `aria-valuetext`** (UX audit #23)
- [ ] **Inquiry completion bar starts at 0%** (UX audit #62: currently 14% before user input)
- [ ] **Cart minus-to-zero shows trash icon** (UX audit #64)
- [ ] **Persist cart in localStorage** (UX audit #65: cart lost on page refresh)
- [ ] **PiecePage thumbnails keyboard accessible** (UX audit #58: divs instead of buttons)
- [ ] **Hero video poster fallback** (UX audit #59: dark void if video fails)
- [ ] **Image error handling with styled fallback** (UX audit #57)
- [ ] **Consolidate price formatting functions** (UX audit #54: three different implementations)
- [ ] **Availability text colors WCAG contrast fix** (UX audit #55)
- [ ] **Move inline styles from About/OracleCards to index.css** (UX audit #56)
- [ ] **Extract shared hooks to `hooks/` directory** (UX audit #85: duplicated between About/OracleCards)
- [ ] **PiecePage share copy-to-clipboard fallback** (UX audit #76: desktop Chrome has no Web Share)

### Medium Priority
- [ ] **Consistent breadcrumbs across all pages** (UX audit #5)
- [ ] **Two-column mobile gallery** (UX audit #11)
- [ ] **Filter pill touch targets larger** (UX audit #12)
- [ ] **Category tile descriptions visible by default** (UX audit #32: hidden until hover)
- [ ] **Gallery hover: replace overlay with subtle indicator** (UX audit #27)
- [ ] **`:active` states for touch devices** (UX audit #26)
- [ ] **Gallery tile keyboard focus visual** (UX audit #30)
- [ ] **Collection card click scrolls to results** (UX audit #28)
- [ ] **PiecePage "Add to Cart" confirmation more visible** (UX audit #29: toast or drawer open)
- [ ] **Consistent commission CTA text** (UX audit #37)
- [ ] **Consolidate back-to-top implementations** (UX audit #36)
- [ ] **Unified hover underline mechanics** (UX audit #39)
- [ ] **Inquiry form warns on unsaved navigation** (UX audit #66)
- [ ] **PiecePage related pieces fallback** (UX audit #67: abrupt end if no related)

---

## BEFORE LAUNCH: Waiting on Adrian

These need Adrian's input before I can code them:

- [ ] **Replace Cloudinary placeholder images with real ones** (waiting on photography)
- [ ] **Replace `_REPLACE_WITH_REAL_ID` Stripe Price IDs** in mockData.ts (waiting on Stripe setup)
- [ ] **Add favicon `<link>` tags** (waiting on favicon image)
- [ ] **Set OG share image** (waiting on image)
- [ ] **Shipping & Returns page** (waiting on policy decisions)

---

## FIRST WEEK AFTER LAUNCH

- [ ] **Finishes/Options modal** (needs Adrian's images for Natural, Painted, Crystal, LED, Framing)
- [ ] **Made-to-order configuration UI** (size selection, add-on checkboxes, dynamic totals, needs pricing)
- [ ] **"Available Now" dedicated section on Creations landing** (can build anytime)
- [ ] **Cookie consent** (only needed if adding third-party analytics beyond Cloudflare)
- [ ] **Post-purchase flow** (confirmation page with warm messaging, needs copy direction)
- [ ] **Rate limiting on `/api/checkout`** (Cloudflare rate limiting rules)

---

## FIRST MONTH (Polish)

- [ ] Dedicated category pages for Jewelry, Oracle Cards, Tables, Installations, Objects, Spaces (needs intro text from Adrian)
- [ ] Edition tracking system (real-time count updates)
- [ ] Full color contrast audit (WCAG AA)
- [ ] Screen reader end-to-end testing
- [ ] Keyboard navigation audit
- [ ] Content management workflow documentation (how to add new pieces/writings)
- [ ] Route-based code splitting with React.lazy
- [ ] Self-host Google Fonts (eliminate third-party dependency)
- [ ] Service Worker for offline asset caching
- [ ] Image LQIP blur-up placeholders
- [ ] Dark mode system preference detection
- [ ] Cart drawer swipe-to-close
- [ ] Page transition animations
- [ ] Responsive image srcset on all non-ArtImage images

---

## FUTURE (Not for launch, not for first month)

### Features
- [ ] Global site search
- [ ] "Recently Viewed" pieces (localStorage)
- [ ] Image comparison slider for Illuminated Works (day vs night)
- [ ] Pricing explorer tool
- [ ] Currency selector for international visitors
- [ ] PWA capabilities (Service Worker + manifest)
- [ ] Print stylesheet for collectors
- [ ] Writing card reading time display
- [ ] Route-level error boundaries
- [ ] Intersection-based infinite scroll for Store
- [ ] "Save for Later" / wishlist
- [ ] "Notify Me" for sold-out pieces

### E-Commerce
- [ ] Apple Pay / Google Pay express checkout
- [ ] Made-to-order deposit structure (50% upfront, 50% on completion)
- [ ] Abandoned cart recovery
- [ ] Order tracking post-purchase
- [ ] Inventory management synced with Stripe

### SEO
- [ ] Dynamic og:image per artwork page (show actual piece when shared)
- [ ] Additional structured data (ImageGallery, FAQ)
- [ ] Keyword strategy execution for primary opportunities
- [ ] Per-category/series meta descriptions

### Infrastructure
- [ ] End-to-end tests (Playwright/Cypress for checkout flow)
- [ ] Error monitoring (Sentry)
- [ ] Headless CMS migration (when mockData.ts becomes unmaintainable)
- [ ] Cloudflare Images migration (if outgrowing Cloudinary free tier)
