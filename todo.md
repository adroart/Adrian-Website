# Adrian Art Website - Plan Review: Gaps, Inconsistencies & Missing Pieces

Review of the Complete Master Document against itself (internal consistency) and against the current codebase implementation.

---

## 1. Major Plan-to-Codebase Misalignments

These are significant contradictions between what the plan states and what the code actually does.

### 1.1 Tech Stack is Wrong in the Plan
- **Plan (Section 1.5):** "Custom HTML/CSS/JS. No framework dependency."
- **Reality:** React 18 + TypeScript + Vite + Tailwind CSS 4 + React Router v7 + Lucide React.
- **Action:** Update Section 1.5 tech stack table to reflect the actual stack. The "Why this stack" rationale also needs rewriting since it references "no CMS dependency, full design control" which is still true, but "no framework dependency" is false.

### 1.2 Newsletter Service Mismatch
- **Plan (Sections 1.5, 3.7, 15.1):** ConvertKit for newsletter, welcome sequence, Inner Circle.
- **Reality:** Formspree handles newsletter signups (Footer.tsx, env var `VITE_FORMSPREE_NEWSLETTER_ID`).
- **Action:** Decide: migrate to ConvertKit as planned, or update the plan to reflect Formspree. ConvertKit offers welcome sequences and segmentation that Formspree does not. If ConvertKit is the goal, the integration needs to be built. If Formspree stays, remove ConvertKit references from the plan and acknowledge the loss of welcome sequence capability.

### 1.3 Shop Includes Made-to-Order (Should Be Ready-to-Ship Only)
- **Plan (Section 2.3):** "Shop is the clean transactional space. Only ready-to-ship pieces. No sold items. No made-to-order complexity."
- **Reality:** Store.tsx shows both ready-to-ship AND made-to-order items (INVENTORY filters for both). Made-to-order items get "Made to Order" badges and link to /inquire.
- **Action:** Either update the shop implementation to only show ready-to-ship items, or update the plan to acknowledge made-to-order in the shop with the current approach.

### 1.4 Category URLs Don't Exist as Separate Routes
- **Plan (Section 2.2):** Dedicated URLs like `/creations/multidimensional-art`, `/creations/jewelry`, `/creations/oracle-cards`, etc.
- **Reality:** Categories are handled via client-side filtering on `/creations`. Clicking a category sets a filter state, not a route change.
- **Action:** Either implement dedicated category routes (better for SEO and shareability) or update the plan to reflect the filter-based approach. Dedicated routes are better for AEO/SEO strategy described in Section 12.7.

### ~~1.5 Writings Don't Have Individual URLs~~ RESOLVED
~~Writings now have individual routes at `/writings/:slug`.~~

### 1.6 Welcome Page Links Don't Match Plan
- **Plan (Section 12.6):** Links should be: New Pieces > Shop, The Story > About, Writings > Writings, Work With Me > Inquire, Inner Circle > ConvertKit signup.
- **Reality (Welcome.tsx):** Creations, Shop, Commission a Piece, Writings, Teajia. Missing Inner Circle/newsletter signup entirely. Labels differ.
- **Action:** Update Welcome.tsx to match the plan's link structure, or update the plan.

---

## 2. Missing Implementations (Described in Plan, Not Built)

### 2.1 Finishes/Options Modal (Section 8)
The entire modal system with tabs for Finishes, Crystals, Illumination, and Framing is described in detail but has no implementation. The "See what's possible" trigger from piece pages doesn't exist.

### 2.2 Made-to-Order Configuration UI (Section 7.2)
Plan describes: size selection with prices, add-on checkboxes (crystals, wood frame, illumination, custom frame), dynamic total updates, and conditional CTA changes. PiecePage.tsx only has a static "Configure Design" button that does nothing.

### ~~2.3 Sold Piece Behavior (Section 7.6)~~ RESOLVED
~~Sold pieces now show "Commission a new original on this form" linking to /inquire.~~

### ~~2.4 Share Button on Piece Pages (Section 12.6)~~ RESOLVED
~~Share button implemented using `navigator.share` API with fallback detection.~~

### ~~2.5 Sticky Bottom Bar on Mobile Piece Pages (Section 12.5)~~ RESOLVED
~~Sticky bottom bar with price + CTA now shows on mobile (below lg breakpoint).~~

### 2.6 Dedicated "Available Now" Section on Creations Landing (Section 5.4)
Plan describes a separate "Available Now" section with its own heading and grid, distinct from "Selected Works." Creations.tsx has a toggle filter but not a separate section.

### ~~2.7 Image Lazy Loading (Section 12.5)~~ RESOLVED
~~`loading="lazy"` added to all below-fold images across all components.~~

### 2.8 Category Page Templates (Sections 5.5, 5.6)
Plan describes dedicated pages for each category (Jewelry, Tables, Installations, Spaces) with category-specific intro text. These don't exist as separate pages or components.

### 2.9 Teajia Integration Points Missing
Plan (Section 1.4) defines 6 contextual placement points for Teajia:
1. ~~Footer~~ RESOLVED - Now includes "Global tea culture. Ceremony and treasures."
2. About Page / The Path - Done (Teajia link in The Path section)
3. Spaces Category Page - Not built (no Spaces page)
4. Tables Category Page - Not built (no Tables page)
5. Living Knowledge - Future
6. Inquire Page / Spatial Commissions - Not implemented (no Teajia link under spatial commissions)

---

## 3. Plan Internal Inconsistencies

### 3.1 Category Count Mismatch (Section 2.2 vs 5.1)
- Section 5.1 hero grid lists **9 categories**: Multidimensional Art, Light Codes, Jewelry, Oracle Cards, Tables, Installations, Illuminated Works, Objects, Spaces.
- Section 2.2 page hierarchy only lists **6 category subpages**: multidimensional-art, jewelry, oracle-cards, tables, installations, spaces.
- **Missing from hierarchy:** Light Codes, Illuminated Works, Objects.
- **Action:** Clarify where these 3 categories live. Light Codes appears to be a series under Multidimensional Art, but it's also a standalone category in the grid. Illuminated Works and Objects need hierarchy entries or should be removed from the grid.

### 3.2 Light Codes: Series or Category?
Light Codes appears as:
- A **series** under Multidimensional Art (Section 2.2, Section 6, Section 11)
- A standalone **category** in the Creations hero grid (Section 5.1)
- A **category** in mockData.ts CREATION_CATEGORIES

These are contradictory. Is Light Codes its own category (with its own page), or a series within Multidimensional Art? The plan needs a clear decision here.

### 3.3 "Illuminated Works" - Undefined
Listed as a category in Section 5.1 hero grid ("Paintings with light and projection") but never mentioned again in the plan. No page hierarchy entry, no category page description, no further detail. Is this a subcategory? A filter? A standalone category?

### 3.4 "Objects" Category - Underdeveloped
Listed in Section 5.1 hero grid ("Sphere holders, incense, dimensional pieces") but has no page hierarchy entry, no dedicated description anywhere, and no category page template content.

### ~~3.5 About Page Section Numbering Jumps~~ RESOLVED
~~"The Team" (4.6) and "What Art Can Mean" (4.7) sections added to About.tsx with verbatim copy from the plan.~~

### 3.6 About Page Text Deviations
Several sections have condensed or modified text compared to the plan:
- "The Root" (4.2): Final sentence about "what I wish for people to feel in the presence of my creations" is truncated.
- "Connection" (4.4): Omits First Friday details, Tannery Lofts specifics ("100 units of housing for artists"), Arise festival name, and "150-foot stage" detail. Also omits "Designed the 150-foot stage for Arise" and "Over 120 exhibitions and live paintings since 2009."
- Need to decide: is the plan the source of truth (restore full text) or has the code been intentionally condensed?

### 3.7 Form Fields Don't Match Plan (Section 9.4 vs Inquire.tsx)
- **Plan fields:** Name, Email, Vision (required) + Location, Size range, Budget, Timeline, Image upload (optional, collapsed).
- **Code fields:** Name, Email, Vision (required) + Budget, Timeline, Referral (optional, collapsed).
- **Missing from code:** Location, Approximate size range, Image upload.
- **Added in code but not in plan:** Referral source ("How did you find me?").
- **Action:** Align the plan and code. Referral is a useful addition; add to plan. Missing fields should either be added to code or removed from plan.

### 3.8 Button Text Inconsistency
- Plan (Section 9.4): Button says "Start the conversation"
- Inquire.tsx: Button says "Send Transmission"
- Plan Commission Paths (Section 9.3): Links say "Begin here"
- These should be consistent with the site's voice.

---

## 4. Content That Needs Creating (From Plan, Acknowledged but Empty)

### 4.1 Pricing Placeholders
These appear throughout the plan with placeholder values:
- [ ] LED starting prices per size tier (Section 8.3: $[X], $[Y], $[Z])
- [ ] Crystal add-on pricing (Section 12.1: +$X)
- [ ] Wood frame add-on pricing (Section 12.1: +$X)
- [ ] All individual piece final pricing
- [ ] Stripe Payment Links for each ready-to-ship piece (currently all use `PLACEHOLDER` URL)

### 4.2 Missing Written Content
- [ ] Universal Language series hook (Section 6.3: "Adrian: Write hooks when ready")
- [ ] Mandala series hook (Section 6.3: "Adrian: Write hooks when ready")
- [ ] Framing descriptions for Finishes modal (Section 8.2: "Adrian: Add descriptions for framing when ready")

### 4.3 Image Assets
- [ ] All images are placeholders (picsum.photos/unsplash). Every component needs real photography.
- [ ] Hero grid: 9 specific images representing each category (Section 5.1)
- [ ] Finishes modal: images for Natural, Painted, Crystal, LED, Framing states (Section 8.2)
- [ ] Inquire hero: split image (intimate piece + large installation)
- [ ] About page: portrait photo

---

## 5. Missing from the Plan Entirely

These topics are not addressed anywhere in the master document but are needed for a production website.

### 5.1 Analytics
No analytics tool mentioned. Options: Google Analytics 4, Plausible, Fathom, Cloudflare Web Analytics (free with Cloudflare Pages). Without analytics, there's no way to measure traffic, understand visitor behavior, or validate the AEO strategy.

### 5.2 Accessibility (a11y)
No WCAG guidelines, screen reader considerations, alt text standards, keyboard navigation requirements, or color contrast rules. Given the art-focused audience and potential gallery/museum connections, accessibility matters both ethically and for SEO.

### 5.3 Content Management Workflow
With no CMS, how does Adrian add new pieces or publish new writings after launch? Currently requires code changes (editing mockData.ts, creating new components). The plan should address:
- Who makes these changes? (Adrian, a developer, a CMS later?)
- What's the process for adding a new piece?
- What's the process for publishing a new writing?

### 5.4 Shipping, Returns, and Customs
"Ships from Bali" is mentioned, but nowhere does the plan address:
- Shipping cost calculation or flat rates
- Customs and import duties (buyer's responsibility?)
- Insurance for high-value pieces
- Return policy
- Damage during shipping
- The Footer.tsx has "Shipping & Returns" and "Care Guide" buttons that don't link anywhere.

### 5.5 Edition Tracking System
Section 12.3 describes sophisticated display rules (0-40% sold shows one thing, 40-70% another, etc.) but there's no system for tracking actual edition counts. Currently, edition info is a static string in mockData.ts. Need a data source for real-time edition tracking.

### 5.6 Inventory Management
No system described for:
- Marking pieces as sold after purchase
- Updating availability from ready-to-ship to sold
- Tracking stock of multiple editions
- Syncing with Stripe payment status

### ~~5.7 404 / Error Page~~ RESOLVED
~~Dedicated NotFound component created. Catch-all route now renders proper 404 page instead of homepage.~~

### 5.8 Cookie Consent
Privacy Policy page exists but no cookie consent mechanism is described. If using analytics, font services, or any third-party tracking, GDPR/CCPA compliance may require consent.

### 5.9 Testing Strategy
No mention of:
- Cross-browser testing (Safari, Firefox, Chrome, mobile browsers)
- Device testing beyond "test on real phone"
- Automated tests
- Performance testing/benchmarks

### 5.10 Deployment Pipeline
No CI/CD described. How are changes deployed? Manual push to Cloudflare Pages? GitHub integration? Preview deployments for review?

### 5.11 Backup Strategy
No backup plan for content, images, or order data.

### 5.12 Email Domain
Inquire.tsx fallback uses `hello@adrianrasmussen.art` but the plan says the domain is `adrianrasmussen.com`. Which email domain is correct? Is the .art domain also owned?

---

## 6. Document Quality Issues

### 6.1 Character Encoding Corruption
The entire plan document has UTF-8 double-encoding issues. All special characters are garbled:
- Em dashes appear as "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â" instead of "—"
- Arrows appear as "ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢" instead of "→"
- Bullet separators appear as "Ãƒâ€šÃ‚Â·" instead of "·"
- Copyright symbol appears as "Ãƒâ€šÃ‚Â©" instead of "©"
- "Teajia" sometimes appears with diacritical corruption

The plan should be re-exported with proper UTF-8 encoding.

### 6.2 Copy Guidelines Self-Violation
Section 13.2 says "Avoid em dashes." However, multiple sections of the plan's own copy use em dashes (encoded or not). Review all copy for compliance with stated guidelines.

### 6.3 Referenced Companion Documents Not in Repository
Section 16 references: "Launch and Beyond (06-launch-and-beyond.md), Content Planning Guide, Items to Develop, Audience Understanding, Collected Words." None of these files exist in the repository.

---

## 7. Prioritized Action Items

### Critical (Blocks Launch)
1. Resolve tech stack description in plan (Section 1.5)
2. ~~Implement individual writing routes (/writings/[slug]) for SEO/AEO~~ DONE
3. Implement category routes or update plan to reflect filter approach
4. ~~Fix sold piece behavior (add commission link)~~ DONE
5. ~~Add image lazy loading~~ DONE
6. Replace all placeholder images with real photography
7. Replace Stripe PLACEHOLDER URLs with real Payment Links
8. Decide and resolve ConvertKit vs Formspree for newsletter
9. Add shipping/returns policy content (Footer links are dead)

### Important (First Week After Launch)
10. Build Finishes/Options modal
11. Build made-to-order configuration UI on piece pages
12. ~~Implement share functionality on piece pages~~ DONE
13. ~~Add sticky bottom bar on mobile piece pages~~ DONE
14. Align form fields between plan and implementation
15. ~~Add missing About page sections (The Team, What Art Can Mean)~~ DONE
16. Implement "Available Now" as dedicated section on Creations landing
17. Add analytics

### Should Have (First Month)
18. Clarify Light Codes / Illuminated Works / Objects category hierarchy
19. Build dedicated category pages
20. ~~Implement Teajia footer copy~~ DONE
21. Build edition tracking system
22. ~~Add 404 page~~ DONE
23. Add accessibility guidelines and implement
24. Fix character encoding in plan document
25. Create/locate companion documents referenced in plan
26. Define content management workflow
27. Align all copy with Copy Guidelines (Section 13)
28. Update Welcome page links to match plan

---

## 8. Technical Specs Review - Additional Items

Items identified from the Technical Specs document (file 16) that are not yet captured above. Grouped by domain. Future to-do items are marked explicitly at the end.

### 8.1 Design System

- [ ] Implement availability state colors per spec: #1A1A1A (near black, weight 500) for "Ready to ship," #6B6B6B (medium gray, weight 400) for "Made to order," #9A9A9A (light gray, weight 400) for "Sold." These hex values are not currently in the CSS theme.
- [ ] Enforce middle dot separator (·) format for inline piece details across all components (e.g., `24" diameter · 5 layers · Painted with crystals · LEDs · Plywood`).
- [ ] Audit and enforce "no icons, no badges, no stickers" rule. Availability states should use text plus color only.
- [ ] Audit all site copy for em dashes and replace with periods, commas, or separate sentences per spec.

### 8.2 Edition Display Logic

- [ ] Implement progressive scarcity display rules. Currently editions are static text strings. The spec defines percentage-based thresholds:
  - 0 to 40% sold: "Limited edition of X" (no count)
  - 40 to 70% sold: "Edition of X · Y remaining"
  - 70 to 90% sold: "Edition of X · Few remaining"
  - 90 to 99% sold: "Edition of X · Final one available"
  - 100% sold: "Edition closed"
- [ ] Implement edition format differences: ready-to-ship shows "Edition of X · #Y · Signed and numbered"; made-to-order shows "Edition of X" only (no number until created).
- [ ] When an edition closes, change CTA to "Edition closed" with link: "Commission a new original on this form" routing to Inquire page.

### 8.3 Add-ons Logic

- [ ] Implement add-on checkboxes on made-to-order piece pages: Crystals (+$X), Wood frame (+$X), Illuminate this piece (size-based starting price), Custom laser cut frame ("We'll design this together").
- [ ] No add-on checkboxes on ready-to-ship pieces (piece is complete as shown).
- [ ] Implement illumination tier logic: not offered for small (under 12"); starting price varies for medium (12-24"), large (24-36"), major (36"+). Copy: "The work comes alive in the dark. Starting at $[X]. Options range from subtle glow to custom programming."
- [ ] Implement conversation item flow: when illumination or custom frame is checked, redirect to a pre-filled inquiry form instead of standard checkout. Adrian confirms details and pricing before payment link is sent manually.

### 8.4 Filter System

- [ ] Implement series-specific filters per spec:
  - Universal Language: Availability, Finish, Size
  - Mandala: Availability, Finish, Size
  - Light Codes: Availability, Category (Frequency Foundations / Embodied Vibrations / Resonant Formations), Size
- [ ] Implement category-specific filters per spec:
  - Multidimensional Art: Availability, Series, Finish, Size, Illuminated (yes/no), Story piece (yes/no)
  - Jewelry: Availability, Type (pendant/ring/bracelet/earring), Material, Price range
  - Oracle Cards: Availability, Deck type
  - Tables: Availability, Size, Material
  - Installations: Project type, Scale
  - Spaces: Project type
- [ ] Finalize filter UX decisions (spec marks these "To Finalize"):
  - Single select vs. multi-select per filter type
  - Active filter display style (pills, inline text, or sidebar)
  - Clear all vs. clear individual filters
  - Whether to show result counts per filter option
  - Empty state messaging when no results match
  - URL structure for filtered views (for sharing and bookmarking)
- [x] Sticky filter bar on scroll. DONE (Creations.tsx, sticky top-[70px]).

### 8.5 Mobile Experience

- [ ] Implement two-tap pattern on mobile hero grid: tap once reveals category name and one-line description; tap again navigates to category page. Keeps grid clean until visitor engages.
- [ ] Implement bottom sheet filter overlay for mobile: "Filter" button in sticky position, tapping opens bottom sheet with large touch targets, dismiss on apply or swipe down.
- [ ] Implement horizontal swipe image galleries with dot indicators on piece pages. Full-width images. No pinch-to-zoom required (images large enough by default).
- [ ] Implement "See What's Possible" modal as full-screen overlay on mobile (not centered modal). Tab navigation via horizontal scrollable tabs at top for Finishes, Crystals, Illumination, Framing.
- [ ] Replace spinner-style loading (sacred geometry loader) with skeleton screens for image grids. Subtle pulse animation. No spinners per spec.
- [ ] Define and implement friendly error state messaging. Light touch, brief. Refer to Copy Guidelines for tone.
- [ ] Decide newsletter signup placement within mobile hamburger menu.
- [ ] Sticky bottom bar on mobile piece pages with price and primary CTA. DONE (PiecePage.tsx).

### 8.6 Desktop Experience

- [ ] Implement page transition animations per spec:
  - Page loads: quick fade-in
  - Modals: slide-up from bottom or fade-in with backdrop dim
  - Filter changes: grid items animate smoothly (no hard reload)
  - Keep transitions fast and unobtrusive
- [ ] Verify max content width for text-heavy pages (About, Writings) is approximately 720 to 800px per spec.
- [ ] Verify piece cards have subtle scale or shadow shift on hover. Partially done (scale-105 on hover exists), confirm shadow behavior.
- [ ] Evaluate optional subtle parallax on homepage hero. Hero.tsx has some parallax effect already; confirm it meets spec ("never distracting").
- [ ] Confirm simple grid layout for category pages and shop. Masonry layout for Selected Works (Home.tsx uses CSS columns, which provides masonry). Confirm editorial feel.

### 8.7 E-Commerce

- [ ] Implement cart drawer sliding from right side (spec recommends drawer over full page for small catalog). Currently no cart; Store.tsx uses an inspection drawer pattern that links directly to Stripe.
- [ ] Define and implement checkout flow: Review cart, shipping info, payment.
- [ ] Implement shipping calculation based on Bali origin. International shipping normalized as standard.
- [ ] Enable Apple Pay and Google Pay through Stripe.
- [ ] Implement made-to-order deposit structure: 50% upfront, 50% on completion.
- [ ] Build post-purchase flow: order confirmation page with warm messaging, confirmation email with timeline expectations, progress update emails at key milestones for made-to-order pieces.
- **Future to-do:** Plan Snipcart upgrade path when order volume warrants a more integrated cart experience.

### 8.8 SEO Strategy

- [ ] Build keyword targeting strategy for primary opportunities:
  - "Ye Ming Zhu" (highest priority, Living Knowledge as anchor content)
  - "Glowing crystal" / "glow in dark crystal" / "luminous crystal jewelry" (high)
  - "Sacred geometry art" (high, competitive)
  - "Laser cut art" (medium, differentiate through painted finish)
  - "I Ching art" / "Gene Keys art" (medium, niche but aligned)
  - "Mandala art" / "mandala wall art" (medium, very competitive, use for long-tail)
  - "Custom sacred art" (medium, commission-focused)
- [ ] Implement remaining schema markup: Person (About page), BreadcrumbList (navigation), ImageObject (gallery images with alt text). Product and Article schemas already exist on piece and writing pages.
- [ ] Write unique meta descriptions (150-160 characters) for all primary pages: Homepage, About, Creations, Multidimensional Art, Jewelry, Oracle Cards, Tables, Installations, Spaces, Universal Language series, Mandala series, Light Codes series, Writings, Living Knowledge, Beneath the Surface, The Practice, The Path, Inquire, Shop.
- [ ] Implement image alt text standards per spec: "[What is shown] by Adrian Rasmussen" or "[Description of piece], [materials], [size if relevant]." Include keywords naturally, never keyword-stuff.
- [ ] Add share buttons to Writings pages. Currently share functionality only exists on piece pages (PiecePage.tsx).
- [x] Open Graph meta tags. DONE (index.html).
- [x] Twitter/X card meta tags. DONE (index.html).

### 8.9 Photography and Video

- [ ] Define and communicate standard shot list to photographer: hero front view (required), detail shot 1 (required), detail shot 2 (optional), scale on wall (required), scale with human (optional), illuminated day (if LEDs), illuminated dark (if LEDs), back/mounting (optional), process shot (optional).
- [ ] Implement responsive image serving (srcset/sizes) for different screen sizes and resolutions. Not currently implemented; all images use simple src attributes.
- [ ] Confirm homepage hero video specs: length, format, autoplay behavior, loop, muted by default. Mobile: poster image fallback if autoplay not supported.
- [ ] Create illumination demo videos (15-30 seconds, loop-friendly) showing LED pieces transitioning from ambient to dark. For use in the Finishes/Options modal.
- [ ] Ensure all source photography is minimum 2000px on longest side. Serve optimized responsive versions.

### 8.10 Integrations

- [ ] Build newsletter welcome sequence (3 emails): welcome, story, invitation to explore. Requires ConvertKit or similar ESP with automation capability. Formspree cannot do this.
- [ ] Define newsletter frequency approach: "as inspired, not scheduled. Quality over consistency."
- [ ] Select and install analytics platform. Spec suggests Google Analytics or privacy-focused alternative like Plausible. Track: page views, time on page, inquiry form submissions, cart additions, purchases.
- [ ] Implement conversion tracking: inquiry submissions, completed purchases.
- **Future to-do:** Heat mapping for post-launch optimization (optional).

### 8.11 Pricing (To Be Finalized by Adrian)

- [ ] Finalize base pricing by size tier for natural and painted finishes:
  - Small (under 12"): $TBD / $TBD
  - Medium (12-24"): $TBD / $TBD
  - Large (24-36"): $TBD / $TBD
  - Major (36"+): $TBD / $TBD
- [ ] Finalize add-on pricing: Crystals (+$TBD), Wood frame (+$TBD), Illumination medium (starting $TBD), Illumination large (starting $TBD), Illumination major (starting $TBD).
- [ ] Finalize category pricing ranges: Light Codes ($TBD-$TBD), Jewelry ($TBD-$TBD), Tables ($TBD-$TBD), Oracle Cards ($TBD-$TBD).

### 8.12 Launch Checklist (Items Not Already Captured Above)

**Must Have:**
- [ ] Format homepage hero video for web (video exists, needs formatting)
- [ ] Prepare hero grid images (9 images, one per category)
- [ ] Curate Selected Works for homepage (10-20 pieces)
- [ ] Adrian hand-edits About page (final review)
- [ ] At least one series fully populated with pieces
- [ ] Core product photography complete (hero + detail for each listed piece)
- [ ] Finishes modal images (Natural, Painted, Crystals, LEDs, Framing)
- [ ] Complete mobile responsive testing
- [ ] Test Stripe payment integration end-to-end

**Should Have:**
- [ ] Publish at least one Living Knowledge presentation (Ye Ming Zhu)
- [ ] Write series hooks and essays for Universal Language, Mandala, Light Codes
- [ ] Publish at least one piece in The Path (Writings section)
- [ ] Configure Open Graph and social meta tags for all pages (base tags done, per-page needed)

**Nice to Have:**
- [ ] Create process videos for The Practice (Writings section)
- [ ] Document 2-3 installation projects for Installations portfolio
- [ ] Build and activate welcome email sequence for Inner Circle

---

## 9. Future To-Do (Discussed But Not Prioritized)

These features have been discussed in the Technical Specs but are explicitly not prioritized for initial launch. Revisit as the site matures and demand warrants.

### 9.1 Features
- [ ] NFT integration for legacy documentation of commissioned pieces
- [ ] QR codes on physical plaques linking to digital story pages
- [ ] Virtual tours or 3D piece viewing
- [ ] Client portal for commission progress tracking
- [ ] Community features (forum, member area)
- [ ] Artist residency and Labyrinth Bali / Nuanu connection page
- [ ] Events calendar
- [ ] Press and media section

### 9.2 Pricing Explorer Tool
Not yet designed. Recommended progression:
1. **Simple (first version):** Static examples at price tiers. "See what's possible at $500, $1,000, $2,500, $5,000+"
2. **Interactive (upgrade):** Sliders for size and finish with dynamic price updates.
3. **Guided (final):** "Share your budget and vision, we'll show what's possible." Routes to inquiry.

### 9.3 Search Functionality
Not yet designed. Considerations for future implementation:
- Search bar location (header or dedicated page)
- What is searchable (pieces, writings, both)
- Results display format
- Empty state messaging
- Autocomplete suggestions

### 9.4 SEO Long-Tail
- [ ] "Tea house design" keyword targeting (build as Spaces portfolio grows)
