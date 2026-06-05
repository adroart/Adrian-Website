# Phase 2 — Mandala Codes / Universal Language split

**Status as of 2026-05-28:** Phase 1 done. The visual polish landed on Adrian-Website's oracle reader, the routing tables and project memory have been updated to reflect that **mandalacodes.com** is the canonical home of the interactive deck, and the `.art` / `.com` domain typo is fixed.

This file is the scoped plan for Phase 2 — the actual structural split between the two sites. Pick it up in a fresh session when you're ready.

---

## What's done (Phase 1)

- `Adrian-Website/components/UniversalLanguageCard.tsx` got a museum-plate refinement (hairline border opacity unified to `/50`, codon-ring intro typography tightened to 14px context style). Visual polish only — no structural change.
- `CLAUDE.md` (both workspace and project) updated: domain `.art` → `.com`, routing table now sends "Mandala Codes / the oracle" to mandalacodes and keeps "Universal Language art series / the 64 sculptures" on Adrian-Website.
- Project memory saved:
  - `project_mandala_codes_split.md` — the business model (dual storefront, both can sell, no funnel-out)
  - `project_mandala_codes_visual_divergence.md` — the two `UniversalLanguageCard.tsx` files have diverged on purpose; mandalacodes uses a unified label-type system, full-width labels, always-visible Gene Keys readings, and a staged dark color progression. Do not cross-port visual changes blindly.

---

## What Phase 2 needs to do

The interactive oracle reader still exists in **two** places. The art series should live on Adrian-Website, the oracle reader should live on mandalacodes, and the two should cross-link as sister sites.

### 1. Remove the oracle reader from Adrian-Website

Files to delete (all in `Adrian-Website/`):

- `components/UniversalLanguageCard.tsx`
- `components/UniversalLanguageIndex.tsx`
- `components/OracleGateway.tsx`
- `components/OracleSystems.tsx`
- `components/OracleProfile.tsx`
- `components/OracleCardEntrance.tsx`
- `components/oracle/*` (whole directory — `ContinueRail`, `YourPositionCallout`, etc.)
- `components/account/SaveToCollectionButton.tsx` (only used by the oracle save flow — verify before deleting)

Routes to remove from `App.tsx`:

- `/oracle` (gateway)
- `/oracle/profile`
- `/oracle/the-systems`
- `/oracle/universal-language/:number`
- `/oracle/universal-language`
- `/universal-language/:number`
- `/universal-language` (redirect)
- `/creations/oracle-cards/universal-language/:number`
- `/creations/oracle-cards/universal-language` (redirect)
- `/creations/oracle-cards` (redirect)

Imports to clean up in `App.tsx`, `launchFlags.ts`, `data/profilePositions.ts`, `data/trigrams.ts`.

Data files that may be oracle-only and removable (verify each is not used by art-series pages first):
- `data/synthesisData.ts`
- `data/expandedData.ts` (or wherever Gene Keys / I Ching reading text lives)
- `data/profilePositions.ts`
- `data/trigrams.ts`
- `utils/universalLanguage.ts` — keep, this is SEO for the art series

**Keep** in Adrian-Website:
- The 64 Universal Language artworks in `data/mockData.ts`
- `/creations/multidimensional-art/universal-language` (the art-series subcategory page)
- Individual piece pages for each of the 64
- `utils/universalLanguage.ts` (SEO helpers for the art series)

### 2. Set up cross-links

**Adrian-Website → Mandala Codes:**
- The "Oracle Cards" tile on `/creations` links to `https://mandalacodes.com/oracle/universal-language` (or whatever the canonical Mandala Codes oracle URL is).
- Each piece page for a Universal Language artwork gets a small "Experience this in Mandala Codes" link to the matching card on mandalacodes by number (e.g. piece 14 → `mandalacodes.com/oracle/universal-language/14`).
- These are real links, not redirects. The visitor chooses to leave.

**Mandala Codes → Adrian-Website:**
- Each oracle card on mandalacodes gets a small "View the original artwork on adrianrasmussen.com" link to the matching piece page.
- Mandala Codes still sells the deck and likely the originals too. The cross-link is for art discovery, not the only purchase path.

### 3. Redirects from old Adrian-Website oracle URLs

For visitors with old bookmarks or external links pointing at `adrianrasmussen.com/oracle/*`, add a Cloudflare Pages `_redirects` file:

```
/oracle/universal-language/:number    https://mandalacodes.com/oracle/universal-language/:number    301
/oracle/universal-language            https://mandalacodes.com/oracle/universal-language            301
/oracle/the-systems                   https://mandalacodes.com/the-systems                          301
/oracle/profile                       https://mandalacodes.com/profile                              301
/oracle                               https://mandalacodes.com                                     301
/universal-language/:number           https://mandalacodes.com/oracle/universal-language/:number    301
/universal-language                   https://mandalacodes.com/oracle/universal-language            301
/creations/oracle-cards/universal-language/:number  https://mandalacodes.com/oracle/universal-language/:number  301
/creations/oracle-cards               https://mandalacodes.com/oracle/universal-language            301
```

Verify each target URL actually exists on mandalacodes before shipping — broken 301s are worse than 404s.

### 4. SEO cleanup

- `utils/universalLanguage.ts` — strip any leftover "oracle" framing from the art-series SEO helpers (per the existing CLAUDE.md rule: "never use oracle in SEO for art-series pages").
- Verify `mockData.ts` series description and creator-voice text still read sensibly when the oracle isn't on the same domain. The current text says "In the future all 64 will be a part of an oracle set" — that future has now arrived, on a different site. Update the wording.

### 5. Confirm Mandala Codes is ready to receive

Before flipping any redirects or removing Adrian-Website code:

- Mandala Codes oracle renders cleanly at 1440px and 390px (Playwright test, same four checks as the Adrian-Website convention: no overflow, no error boundary, no 404 text, no console errors).
- Mandala Codes has whatever purchase path it needs — at minimum the deck pre-order, possibly a path to acquire the original art.
- A canonical URL exists on mandalacodes for every redirect target above.

### 6. Documentation pass

- Update `Adrian-Website/CLAUDE.md` "What this is" to drop "oracle deck" from the description.
- Update `Adrian-Website/CLAUDE.md` "Critical distinction: Universal Language" section to note that the oracle deck now lives on mandalacodes.com.
- Update the workspace `CLAUDE.md` routing table: remove the "Adrian-Website still has a divergent older copy at `/oracle/*`, pending Phase 2 split" qualifier once it's no longer true.
- Update `project_mandala_codes_split.md` memory: mark Phase 2 as done, update `verified_at`.

---

## Order of operations (recommended)

1. Verify Mandala Codes is production-ready (item 5 above). If not, stop here.
2. Build the cross-links *first* — both directions. This is the visible improvement, and it lands risk-free because it's additive.
3. Add the `_redirects` file but don't enable it yet (commit, don't deploy).
4. Remove the Adrian-Website oracle reader code and routes.
5. Deploy Adrian-Website. Old oracle URLs now 301 to Mandala Codes.
6. Documentation pass.

## What could go wrong

- **Bundle bloat from unused data.** `synthesisData.ts` and the Gene Keys / I Ching expanded text could be megabytes. Verify they're actually removed from the build, not just dereferenced.
- **Lost SEO.** The Adrian-Website oracle pages may have backlinks. The 301s preserve link equity if mandalacodes URLs match exactly. Mismatch = lost equity.
- **Visitor confusion if Mandala Codes isn't ready.** If the deck isn't visibly for sale on mandalacodes, "go to mandalacodes to experience the oracle" is a worse pitch than the current state. Get the deck purchase path live before redirecting.
- **The dual-storefront promise is real.** Both sites must be able to sell the original art and the deck. If one of them can't, the cross-link feels broken.
