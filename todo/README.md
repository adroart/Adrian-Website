# Todo

Everything left to do, in one place. Updated March 2026.

Detailed task files:
- [claude-tasks.md](claude-tasks.md) - Code tasks (Claude can do independently)
- [adrian-tasks.md](adrian-tasks.md) - Content, decisions, accounts (only Adrian)
- [future.md](future.md) - Post-launch and long-term ideas
- [oracle-accounts-implementation.md](oracle-accounts-implementation.md) - **Oracle Hologenetic Profile + unified accounts** (6 phases, all code-complete in `main` via PR #107; waiting on Adrian-side provisioning before the accounts flag flips on)
- [accounts-provisioning-prompt.md](accounts-provisioning-prompt.md) - Drop-in prompt to hand to a fresh Claude session (or teammate) when ready to do the Clerk + D1 + Stripe webhook provisioning

---

## In flight

**Oracle birthdate + accounts** — branch `claude/oracle-energy-birthdate-4HS3f`. Today's + year's energy panels on `/oracle`, full Hologenetic Profile at `/oracle/profile`, in-card "Your position" callout, unified Clerk sign-in, D1-backed orders + synced cart + saved collections. All six phases committed and pushed; details and outstanding handoff items in [oracle-accounts-implementation.md](oracle-accounts-implementation.md). The `accounts` launch flag stays off until Adrian provisions Clerk, D1, and the Stripe webhook (see that file's "Adrian to provision" section).

---

## Summary

### Bugs (fix now)
- [ ] **Configurator duplication** — `PieceConfigurator` (used in oracle BuySheet) duplicates the same wizard state + pricing logic that's still inline in `PiecePage`. Pricing change today means two edits. Single source of truth before launch: refactor PiecePage to use `PieceConfigurator`. Blocker is rewiring the sticky mobile bottom bar's live total readout — it currently reads the local PiecePage state.
- [ ] **Edition-closed gate missing in `PieceConfigurator`** — when `shopEnabled` flips to true, a piece whose edition has fully sold (`editionSold >= editionSize`) can still be purchased via the BuySheet. PiecePage already has an `editionClosed` branch that hides the buy CTA; the extracted component doesn't carry that guard. Mirror the same check before shop launches.
- [ ] **No auto-scroll on configurator step 1 → 2** — inside the BuySheet on short phones, tapping "Continue to options" leaves the new step below the fold. Same in PiecePage. Add a scroll-into-view on step change.
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
