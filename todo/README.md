# Todo

Everything left to do, in one place. Updated March 2026.

Detailed task files:
- [claude-tasks.md](claude-tasks.md) - Code tasks (Claude can do independently)
- [adrian-tasks.md](adrian-tasks.md) - Content, decisions, accounts (only Adrian)
- [future.md](future.md) - Post-launch and long-term ideas

---

## Summary

### Bugs (fix now)
- [ ] Newsletter "Join the Inner Circle" subscribe fails — ad blockers block `api.convertkit.com`. Proxy via `/api/subscribe` CF Function added but needs `KIT_FORM_ID` + `KIT_PUBLIC_API_KEY` env vars set correctly in Cloudflare Pages dashboard (no `VITE_` prefix)

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
- [ ] Shipping policy page component (once Adrian writes content)

### First Week After Launch
- **Adrian:** Finishes modal images, post-purchase copy, review analytics, Kit welcome sequence
- **Claude:** Finishes/Options modal, "Available Now" section, rate limiting, post-purchase page

### First Month
- **Adrian:** Category intro text, Objects descriptions, more Writings, SEO review, newsletter placement decisions
- **Claude:** Dedicated category pages, category/series filters, mobile filter bottom sheet, two-tap hero grid, conversion tracking, cookie consent, cross-browser testing, WCAG audit, Teajia integration points, code splitting, self-host fonts

### Future
- See [future.md](future.md) for full list (search, wishlist, Apple Pay, CMS, etc.)
