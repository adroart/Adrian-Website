# Todo

Everything left to do, in one place. Updated March 2026.

Detailed task files:
- [claude-tasks.md](claude-tasks.md) - Code tasks (Claude can do independently)
- [adrian-tasks.md](adrian-tasks.md) - Content, decisions, accounts (only Adrian)
- [future.md](future.md) - Post-launch and long-term ideas

---

## Summary

### Bugs (fix now)
- [x] ~~`getIlluminationTier` thresholds wrong for cm sizes (pricing bug)~~ FIXED
- [x] ~~Inquire `isDirty` false positive from pre-fill~~ FIXED
- [x] ~~Lightbox has no body scroll lock on mobile~~ FIXED

### Blocks Launch (Adrian only)
- [ ] Photography: 40+ site images + all artwork
- [ ] Stripe: activate live mode, create Products/Prices, replace placeholder IDs
- [ ] Env vars: set `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY` in Cloudflare
- [ ] Pricing: finalize all piece prices, add-on prices, size tier prices
- [ ] Shipping policy: rates, returns, customs decisions
- [ ] Favicon source image (512x512)
- [ ] OG share image (1200x630)
- [ ] Write real descriptions for 22 UL pieces (currently placeholders)
- [ ] Illuminated Works: 2-3 sentences in your voice
- [ ] About page "The Root": review for accuracy
- [ ] Curate Selected Works for homepage (10-20 pieces)
- [ ] At least one series fully populated with real images, descriptions, pricing

### Before Launch (Claude, no Adrian input needed)
- [x] ~~3 bugs (illumination tiers, isDirty, lightbox scroll lock)~~ FIXED
- [x] ~~Privacy Policy: update third-party services (Formspree → Resend + Kit)~~ FIXED
- [x] ~~CSP header: replace formspree.io with api.convertkit.com~~ FIXED
- [x] ~~Remove console.log debug statements from index.tsx~~ FIXED
- [x] ~~Gate localhost origins in checkout.js and inquire.js for production~~ FIXED
- [x] ~~Fix Instagram link in Footer.tsx (was href="#")~~ FIXED
- [x] ~~Back navigation history fallback~~ DONE (Phase 3A)
- [x] ~~Hero video poster fallback~~ DONE (Phase 3B)
- [x] ~~Cart minus-to-zero trash icon~~ DONE (Phase 3D)
- [x] ~~Image error handling with styled fallback~~ DONE (Phase 1)
- [x] ~~Consolidate price formatting~~ DONE (Phase 1)
- [x] ~~Lighten GenerativeBackground particles~~ DONE
- [x] ~~Availability text WCAG contrast~~ DONE (Phase 4F)
- [x] ~~Move inline styles to index.css~~ DONE (Phase 1)
- [x] ~~Extract shared hooks to hooks/~~ DONE (Phase 1)
- [x] ~~Consistent CTA text across site~~ DONE (Phase 4A)
- [x] ~~Shared BackToTop component~~ DONE (Phase 4B)
- [x] ~~Two-column mobile gallery~~ DONE (Phase 4D)
- [x] ~~Filter pill touch targets~~ DONE (Phase 4E)
- [x] ~~Category tile descriptions visible~~ DONE (Phase 4C)
- [x] ~~System dark mode preference detection~~ DONE (Phase 5A)
- [x] ~~Favicon + OG image markup prep~~ DONE (favicon links + webmanifest + useMetaTags hook)
- [x] ~~Deterministic "Continue the Journey" sorting~~ DONE (already deterministic)
- [x] ~~Loading indicator during inquiry submit~~ DONE (fieldset disables all fields)
- [x] ~~Store "Configure" uses Link not anchor~~ DONE (already used Link)
- [x] ~~Inquiry completion bar starts at 0%~~ DONE (already started at 0%)
- [x] ~~Cart: persist in localStorage~~ DONE (already persisted)
- [x] ~~PiecePage thumbnails keyboard accessible~~ DONE (already buttons)
- [x] ~~Sticky bars, nav glass, card overlays: contrast review~~ DONE (all opacities bumped)
- [x] ~~Breadcrumbs, active states, Add to Cart confirmation, hover underlines~~ DONE
- [ ] Shipping policy page component (once Adrian writes content)

### First Week After Launch
- **Adrian:** Finishes modal images, post-purchase copy, review analytics, Kit welcome sequence
- **Claude:** Finishes/Options modal, "Available Now" section, rate limiting, post-purchase page

### First Month
- **Adrian:** Category intro text, Objects descriptions, more Writings, SEO review, newsletter placement decisions
- **Claude:** Dedicated category pages, category/series filters, mobile filter bottom sheet, two-tap hero grid, conversion tracking, cookie consent, cross-browser testing, WCAG audit, Teajia integration points, code splitting, self-host fonts

### Future
- See [future.md](future.md) for full list (search, wishlist, Apple Pay, CMS, etc.)
