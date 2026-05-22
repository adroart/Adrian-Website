# Atlas — what's done, what's left, where to find it

This is the working notes for the `/atlas` feature. Branch: `claude/world-map-language-pieces-PLWWR`.

## Status at a glance

- Phase 1 is built and pushed. After deploy, the page is live at `/atlas`, intentionally **unlinked** from site nav and **hidden from search engines** via `robots: noindex, nofollow`. Only people you give the URL to can find it.
- All atlas routes (`/atlas`, `/atlas/claim`, `/atlas/edit`, `/admin/atlas`) are noindex. When you're ready for the public reveal, flip those flags in [`useSeoMeta.ts`](../useSeoMeta.ts) and add a link from Navigation.
- No content has been seeded yet. Until you seed, the page will render an empty globe with the "seeking ground" count showing the full archive.

---

## What's done

### Foundation (data + types)
- [`types.ts`](../types.ts) — `CityCentroid`, `LedgerEvent`, `PieceRecord`, `StewardRecord`, `PublicAtlasState`
- [`data/cities.ts`](../data/cities.ts) — ~100 curated city centroids with stable kebab-case ids, `getCityById` helper
- [`utils/ledger.ts`](../utils/ledger.ts) — `canonicalize`, `computeHash`, `appendEvent`, `verifyChain`, `groupChains`
- [`utils/ledgerProjection.ts`](../utils/ledgerProjection.ts) — `projectPiece`, `projectAll`, `toPublicState`
- [`utils/stewardKey.ts`](../utils/stewardKey.ts) — `generateStewardKey` (95-bit, no look-alikes), `hashStewardKey`, `verifyStewardKey`

### Backend (Cloudflare Functions)
- [`functions/api/atlas/_helpers.ts`](../functions/api/atlas/_helpers.ts) — shared auth, R2 read/write, public-state regeneration
- [`functions/api/atlas/_mirror.ts`](../functions/api/atlas/_mirror.ts) — GitHub mirror, disabled by default
- [`functions/api/atlas/index.ts`](../functions/api/atlas/index.ts) — `GET /api/atlas` (public state, 60s cache)
- [`functions/api/atlas/event.ts`](../functions/api/atlas/event.ts) — `POST /api/atlas/event` (admin)
- [`functions/api/atlas/stewards/index.ts`](../functions/api/atlas/stewards/index.ts) — `GET /api/atlas/stewards` (admin, keyHash redacted)
- [`functions/api/atlas/stewards/issue.ts`](../functions/api/atlas/stewards/issue.ts) — `POST /api/atlas/stewards/issue` (admin)
- [`functions/api/atlas/steward/claim.ts`](../functions/api/atlas/steward/claim.ts) — `POST /api/atlas/steward/claim` (public)
- [`functions/api/atlas/steward/update.ts`](../functions/api/atlas/steward/update.ts) — `POST /api/atlas/steward/update` (steward auth)

### Visitor surface
- [`components/AtlasPage.tsx`](../components/AtlasPage.tsx) — the main `/atlas` page (hero, filters, globe, side panel, seeking-ground section)
- [`components/atlas/Globe.tsx`](../components/atlas/Globe.tsx) — constellation-style cobe globe with breathing continents
- [`components/atlas/AtlasFilters.tsx`](../components/atlas/AtlasFilters.tsx) — series + status filter bar
- [`components/atlas/PieceSidePanel.tsx`](../components/atlas/PieceSidePanel.tsx) — selected-piece detail panel
- [`components/atlas/SeekingGround.tsx`](../components/atlas/SeekingGround.tsx) — unplaced count + list

### Collector surface
- [`components/atlas/StewardClaim.tsx`](../components/atlas/StewardClaim.tsx) — `/atlas/claim` (single key input, navigates to `/atlas/edit` on success)
- [`components/atlas/StewardEdit.tsx`](../components/atlas/StewardEdit.tsx) — `/atlas/edit` (searchable city combobox, "Show on the atlas / Keep this private" toggle, transient "Saved." flash)

### Interconnection layer
- [`utils/kinship.ts`](../utils/kinship.ts) — pure functions: `buildKinshipIndex`, `isKin`, `trigramsFor`, `projectPoint`, `arcControlPoint`, `greatCircleDistance`. Mirrors the orthographic projection math from `Globe.tsx` so the SVG overlay tracks the cobe canvas exactly.
- [`components/atlas/KinshipLayer.tsx`](../components/atlas/KinshipLayer.tsx) — SVG overlay drawing bronze quadratic-Bezier arcs between Universal Language pieces whose hexagrams share at least one trigram. Defaults to opacity 0.15, lifts to 0.6 on selection of either endpoint, dims to 0.05 for non-selected arcs. Back-hemisphere endpoints are culled.
- `components/atlas/Globe.tsx` — added `onFrame` callback so parents can subscribe to each frame's `phi`/`theta`/`width`/`height` without owning the rotation state. Single optional prop, no behavioural change.
- `components/atlas/AtlasFilters.tsx` — added "Show kinship threads" toggle (default on). When off, no arcs render globally, but selecting a node still highlights its kin.
- `components/atlas/PieceSidePanel.tsx` — added Kin section. For Universal Language selections, lists up to six kindred pieces sorted by great-circle distance; each clickable.
- `components/AtlasPage.tsx` — composes everything: builds the kinship index from placed UL pieces only, caps it at 200 pairs, surfaces a console note when the cap engages, and pipes the projection ref between Globe and KinshipLayer.

### Admin surface
- [`components/AdminAtlas.tsx`](../components/AdminAtlas.tsx) — three sections: seed event, issue steward key, steward roster
- [`components/AdminDashboard.tsx`](../components/AdminDashboard.tsx) — added Atlas tile linking to `/admin/atlas`
- [`scripts/seed-atlas.ts`](../scripts/seed-atlas.ts) — generates `/tmp/atlas-seed.json` of `created` events for every non-SOLD piece in `FULL_ARCHIVE`

### Routes + SEO
- [`App.tsx`](../App.tsx) — registers `/atlas`, `/atlas/claim`, `/atlas/edit`, `/admin/atlas` as lazy routes
- [`useSeoMeta.ts`](../useSeoMeta.ts) — atlas routes have `robots: noindex, nofollow`. Default for all other routes is `index, follow`.

### Durability
- [`docs/ledger-api.md`](./ledger-api.md) — API contract
- [`docs/atlas-style-notes.md`](./atlas-style-notes.md) — visual brief
- [`docs/ledger-architecture.md`](./ledger-architecture.md) — decision log (why append-only, why hash chain, why not blockchain, why city centroids only, etc.)
- [`docs/ledger-successor.md`](./ledger-successor.md) — handoff document for a literary executor (credentials, R2 layout, the annual print ritual, what to do if maintenance stops)
- GitHub mirror module wired but disabled until you set env vars on Cloudflare Pages

---

## What's left to do

Designed-for and discussed, intentionally **not** built yet. Listed in suggested order.

### Phase 2 — Engagement layer (ship after seeding stabilises)
- [ ] **Public intentions display.** Stewards currently have no place to write or share an intention. Design call: private to steward only, or curated public by you? My recommendation: keep private. The map shows the act of anchoring; the content stays sacred.
- [ ] **Richer steward dashboard.** Today `/atlas/edit` only does city + privacy. Could show piece history, kinship hints, nearby pieces.
- [ ] **Synchronicity surfacing.** Small typographic notes when patterns emerge ("three pieces in the same trigram family lit up this week"). Compute server-side; surface quietly.
- [ ] **Retroactive outreach tooling.** Admin has a roster but no "issue invite" flow with a templated email body. Add a per-row "send invite" button that copies an email template to clipboard with the raw key embedded once.

### Phase 3 — Web logic (ship when you have enough pieces to make it interesting)
- [ ] **Time scrubber.** Animate the map as events accumulate over time. Pilgrimage trails for moved pieces.
- [x] **Kinship threads (UL hexagram kinship).** Shipped as the interconnection layer above. Cross-series kinship (theme, year, material) still deferred.
- [ ] **Cross-series kinship threads.** For all series, theme/year/material kinship surfaced privately to stewards.
- [ ] **Hexagram grid sub-view.** Just for UL: the 8×8 grid filling in as pieces are placed across the world. Ties to your existing oracle data.
- [ ] **"Seeking ground" call to action.** When a piece is unplaced and a visitor lands on its detail, a quiet pull toward acquisition or inquiry.

### Phase 4 — Ritual + durability extensions
- [ ] **Annual letter to stewards.** Once a year on a fixed date (solstice or equinox), you write a summary; the admin tool collects steward email addresses; you send manually. Content + CRM in one ritual.
- [ ] **Annual print artifact.** Generate a typeset PDF from the public state. Print, bind, mail to stewards, deposit one with a library. See [`docs/ledger-successor.md`](./ledger-successor.md) for the ritual framing.
- [ ] **Optional yearly hash anchor.** Publish a hash of the year's public state to Bitcoin or Ethereum as a tamper-evident timestamp. $5 to $20 of gas. Totally optional. No NFTs.

### Phase 5 — Optional NFT mirror (only if asked)
Only build if a collector specifically requests it. Ledger stays canonical; NFT is a souvenir certificate that points to the ledger entry. Don't pre-build.

---

## Pre-launch checklist (things only you can do)

- [ ] **Deploy the branch.** Merge `claude/world-map-language-pieces-PLWWR` to main, or deploy a preview from the branch on Cloudflare Pages.
- [ ] **Visually verify the globe in a real browser.** Build is green and types check, but cobe rendering needs a browser. Hit `/atlas` on the preview.
- [ ] **Mobile check at 390px.** Confirm the globe fits, filters wrap, side panel stacks below.
- [ ] **Seed the ledger.** Sign in to `/admin/login`, go to `/admin/atlas`. Either add events one by one in the Seed Event form, or run [`scripts/seed-atlas.ts`](../scripts/seed-atlas.ts) locally to generate `/tmp/atlas-seed.json` and paste from it.
- [ ] **Issue your first steward key.** Pick one piece you've already placed with a collector you trust. Use the Issue Steward Key form. Save the raw key the moment it appears; it will never be shown again. Print on the certificate or send to the collector with a link to `/atlas/claim`.
- [ ] **(Optional) Configure the GitHub mirror.** Create a public GitHub repo (suggested name `adrian-atlas-mirror`). Generate a fine-grained PAT with Contents read/write. On the Cloudflare Pages project, set three env vars:
  - `GITHUB_MIRROR_TOKEN`
  - `GITHUB_MIRROR_REPO` (e.g. `technicianofthesacred/adrian-atlas-mirror`)
  - `GITHUB_MIRROR_PATH` (e.g. `atlas/public.json`)
- [ ] **(Optional) Write a longer intro paragraph** for the `/atlas` hero. Currently one sentence. The richer copy can land as part of the public reveal.

---

## Going from soft launch to public reveal

When you're ready to make the atlas discoverable:

1. [ ] Flip `robots` to `'index, follow'` (or just remove the field) on these entries in [`useSeoMeta.ts`](../useSeoMeta.ts):
   - `/atlas` — yes, make indexable
   - `/atlas/claim`, `/atlas/edit`, `/admin/atlas` — leave noindex (these are private flows)
2. [ ] Add an "Atlas" link to [`components/Navigation.tsx`](../components/Navigation.tsx).
3. [ ] (Optional) Add a footer link in [`components/Footer.tsx`](../components/Footer.tsx).
4. [ ] Consider an opening note on the homepage or a writing piece announcing the atlas.

---

## Quick operational guides

### Seed a piece location
1. Sign in at `/admin/login`.
2. Open `/admin/atlas`.
3. **Seed Event** form: pick the piece, set type to `placed` (for a first known location) or `created` (if you only know it exists), pick the city, add a private note.
4. Submit. The event appends to the ledger and the public state regenerates immediately.

### Issue a key for a collector
1. Same page, **Issue Steward Key** form.
2. Pick the piece (and edition number if relevant). Add name/email for your roster.
3. Submit. The raw key shows once. Copy it now or it's gone.
4. Print on the certificate of authenticity, or send to the collector with a link to `/atlas/claim`.

### A collector onboards
They visit `/atlas/claim`, paste the key, land on `/atlas/edit`, pick their city, toggle visibility.

### A collector moves their piece
They go to `/atlas/edit` again and pick a new city. The system appends a `moved` event; the map updates.

### A collector loses their key
Re-issue from `/admin/atlas`. The new key overwrites the old hash in the steward record (one key per piece+edition).

### Verify the ledger integrity
The hash chain is self-checking. From any environment with access to `atlas/ledger.json`, run `verifyChain` from [`utils/ledger.ts`](../utils/ledger.ts) over a per-piece chain to confirm no event has been tampered with.

---

## Open decisions left for you

- **Unicode chevron in `AtlasFilters` select.** Kept in as form chrome (the dropdown affordance). Flag if you want a stricter "no glyphs anywhere" rule.
- **Public intentions: private to steward, or curated public?** Decide before Phase 2 starts. Strong recommendation: private. The map shows the act, not the content.
- **GitHub mirror repo name and account.** Pick whatever feels right. `adrian-atlas-mirror` under `technicianofthesacred` is a sensible default.
- **Public reveal timing.** No technical pressure. Seed at your own pace, share the URL with people you want, flip noindex when the page has enough on it to feel populated.

---

## File index (quick reference)

| Concern | Files |
|---|---|
| Data + types | [`types.ts`](../types.ts), [`data/cities.ts`](../data/cities.ts) |
| Ledger utils | [`utils/ledger.ts`](../utils/ledger.ts), [`utils/ledgerProjection.ts`](../utils/ledgerProjection.ts), [`utils/stewardKey.ts`](../utils/stewardKey.ts) |
| Kinship utils | [`utils/kinship.ts`](../utils/kinship.ts) |
| Backend | [`functions/api/atlas/`](../functions/api/atlas/) |
| GitHub mirror | [`functions/api/atlas/_mirror.ts`](../functions/api/atlas/_mirror.ts), [`wrangler.toml`](../wrangler.toml) |
| Public page | [`components/AtlasPage.tsx`](../components/AtlasPage.tsx) |
| Globe | [`components/atlas/Globe.tsx`](../components/atlas/Globe.tsx) |
| Atlas sub-components | [`components/atlas/AtlasFilters.tsx`](../components/atlas/AtlasFilters.tsx), [`components/atlas/PieceSidePanel.tsx`](../components/atlas/PieceSidePanel.tsx), [`components/atlas/SeekingGround.tsx`](../components/atlas/SeekingGround.tsx), [`components/atlas/KinshipLayer.tsx`](../components/atlas/KinshipLayer.tsx) |
| Collector flow | [`components/atlas/StewardClaim.tsx`](../components/atlas/StewardClaim.tsx), [`components/atlas/StewardEdit.tsx`](../components/atlas/StewardEdit.tsx) |
| Admin | [`components/AdminAtlas.tsx`](../components/AdminAtlas.tsx), [`components/AdminDashboard.tsx`](../components/AdminDashboard.tsx) |
| Scripts | [`scripts/seed-atlas.ts`](../scripts/seed-atlas.ts) |
| Routes + SEO | [`App.tsx`](../App.tsx), [`useSeoMeta.ts`](../useSeoMeta.ts) |
| Docs | [`docs/ledger-api.md`](./ledger-api.md), [`docs/atlas-style-notes.md`](./atlas-style-notes.md), [`docs/ledger-architecture.md`](./ledger-architecture.md), [`docs/ledger-successor.md`](./ledger-successor.md) |
