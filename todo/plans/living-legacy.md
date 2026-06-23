# Living Legacy — Build Plan (reconciled with the actual code)

> **What this is.** The execution plan for the Living Legacy layer: a QR on every physical
> piece that turns it into a doorway — certificate + provenance, a yearly fused intention,
> and one living constellation of keepers. Spec/soul lives in the Obsidian vault:
> `1 Projects/adrian-website/copy/Living Legacy — Build Handoff.md` and `… — Vision.md`.
> **This file is the buildable plan; the vault docs are the soul.** Where they conflict with
> the code, the code wins and this file records the reconciliation.

---

## The one thing the handoff doc got wrong (read this first)

The handoff was written **without surveying the code**, and its central placement assumption is
inverted from reality:

| Handoff said | Reality in the code |
|---|---|
| "Atlas already exists — verify location (Adrian's note)" | **Atlas lives on mandalacodes**, not Adrian-Website. It was deliberately moved there 2026-05-23 (PR #111/#112). Adrian-Website `/atlas/*` hard-redirects to mandalacodes.com/atlas. |
| "Records live on adrianrasmussen.com = single source of truth: keeper accounts, intentions, lineage" (§12) | **The keeper/steward/ledger/intention system already exists on mandalacodes**, in R2 (`atlas/ledger.json`, `stewards.json`, `claimRequests.json`, `letters.json`) + D1 `atlas_inscriptions`. With unit tests (ledger/consent/inscriptions/privacy/claimRequests). |
| "Phase 1 = build certificate + intention + keeper account + claim safety from scratch" | **~60% of Phase 1–2 is already built on mandalacodes**: claimed/inscribed/transferred ledger events, transferKind = sale/gift/inheritance/artist-rebind, steward binding (verified email), claim-request resolve flow, sale→ledger bridge, holder-chart consent, the globe Atlas with codon/ring/region filters. |
| "Astrology must be drawn from Mandala Codes — don't rebuild" (§12) | **Correct, and easy.** `buildHologeneticProfile({utcBirth})` in `mandalacodes/lib/astrology/` is pure, deterministic, client-side, JSON-serializable. Extractable as a shared package or callable directly. |

**Consequence for the plan:** This is **not a greenfield build**. It is mostly **(a) finishing and
launching the steward system that already exists on mandalacodes, and (b) building the Phase-1
SELLING + SCAN-ARRIVAL surface on Adrian-Website that feeds it.** The two sites already share one
D1 database and one Better Auth identity, so a keeper is already the same person on both sites.

**The decision this forces (settle before building):** the handoff says records live on Adrian;
the code says they live on mandalacodes. **Recommendation: keep the steward ledger on mandalacodes
(it's built and tested there), and make Adrian-Website the SELL + SCAN-ARRIVAL front door that
writes into it.** This matches the existing sale-event bridge and the shared D1. Adrian to ratify —
this is the load-bearing call and everything below assumes it. (See Decision A.)

---

## Where each capability lives (the reconciled map)

```
ADRIAN-WEBSITE (sell + scan front door)        MANDALACODES (the ledger + the lenses)
──────────────────────────────────────         ──────────────────────────────────────
QR redirect infra        functions/qr/          Atlas globe          components/AtlasPage.tsx
  /qr/:n live; artwork      [number].js           codon/ring/region    + GlobeGL/Globe3D
  slots empty                                     filters, kinship
Artwork + provenance     types.ts / mockData    Steward ledger (R2)  utils/ledger.ts
  /works/:id record                               claimed/inscribed/   functions/api/atlas/*
Shop / Stripe checkout   functions/api/           transferred
  (gated shopEnabled:false) checkout.js          Claim-request flow   utils/claimRequests.ts
Better Auth (shared)     lib/account/            Hologenetic profile  lib/astrology/profile.ts
Sale→ledger bridge       migrations/005_         Consent / holder     utils/consent.ts
  atlas_sale_events        atlas_legacy.sql        chart
                         ──────── SHARED ────────
                 D1 db `adrian-website` · Better Auth identity · Stripe account · QR plaque contract
```

---

## Open decisions (settle these first — they gate the build)

**Decision A — Where the canonical record lives.** Pick: **mandalacodes ledger stays canonical;
Adrian-Website is the sell + scan front door that writes into it via the existing sale bridge.**
Alternatives: (a) migrate ledger to Adrian-Website per handoff §12 — costly, throws away tested
code, breaks the Atlas that already reads R2 there; (b) split — Adrian owns piece+cert, mandalacodes
owns intention+constellation — duplicates identity and lineage across two stores, the exact drift
the handoff warns against. **Why the recommendation:** it's built and tested where it is, the sites
already share identity, and the handoff's own §12 keeps the Atlas as "one source, two lenses."

**Decision B — Claim-block window length + warning count.** The handoff's #2 open question.
**Logic now ENCODED + tested** (2026-06-23) in `mandalacodes/utils/claimWindow.ts` — pure
`evaluateClaimWindow()` plus `CLAIM_WINDOW_DAYS = 30` and `CLAIM_WARNING_DAYS = [0, 7, 21, 30]`
(4 warnings). The three load-bearing rules hold in code: a holder's "no" stops it cold forever,
any holder engagement keeps the piece blocked, and ONLY full-window silence with every warning
delivered frees the piece (mere inactivity never does). Pinned by 4 assertions in
`tests/living-legacy.test.ts`. **Still ops, not code:** the escalation job that delivers the four
warnings on a schedule and calls `evaluateClaimWindow` to free a piece is not yet wired (needs a
cron + email delivery — Phase 2 ops). The decision and its math are settled; the runner is the
remaining work.

**Decision C — Recovery-code format + tamper-evident packaging** (handoff #3). Pieces need this
**printed before sale**, so it blocks any physical run. Need: code charset/length (QR registry caps
at 11 chars, A–Z/0–9/hyphen), and the scratch-panel method per piece type. **Recommendation:** a
distinct recovery code (not the public QR number), 10-char, under a scratch sticker on the back +
a convenience copy on the certificate card.

**Decision D — Object vs person on the map** (handoff #1). Show the *person* (pieces as facets),
each *piece* keeps its own lineage. The steward records already key by userId, so this is mostly a
projection/UI choice in the Atlas. Low risk; confirm and move on.

---

## CRITICAL: an M0–M5 plan for this ALREADY EXISTS on mandalacodes

The steward survey turned up `mandalacodes/todo/plans/living-art-legacy.md` —
**status `built-pending-ops`, built on branch `origin/claude/gallant-faraday-kb2y28`,
v2 after a six-agent adversarial review (security/privacy red-team, product/UX, architecture,
strategy).** The handoff doc didn't know this existed. It is the *implementation* of what the
handoff describes, and it is further along and more rigorously reviewed than the handoff. Its
milestones:

- **M0** — ledger hardening (concurrency-safe R2, multi-piece claim fix, tests)
- **M1** — public zero-signup QR piece page + **Founding Lights** (permanent claim-order ordinal; Adrian is light #1)
- **M2+M3** — consent capture (active opt-in, GDPR-safe) + holder-authored `inscribed` entries (bodies in D1, salted commitments on chain, exportable book)
- **M4** — HMAC sale bridge from adrianrasmussen.com → admin-confirmed queue + self-serve claim requests
- **M5** — Ring 3 chart presence + the piece writes back (kin-claim letters)

**Key invariant from their review (load-bearing): the chain NEVER contains personal data** —
only opaque IDs, event types, dates, cityIds, salted content commitments. Free text/names/birth
data live in mutable D1 rows that can be erased. Any Adrian-Website work must respect this.

**So the real plan is three streams, not "build Phase 1 from scratch":**
1. **Ship the existing M0–M5 branch** (merge `claude/gallant-faraday-kb2y28` + ops) → that IS most
   of the handoff's Phase 1–2 backend. Owned by mandalacodes; tracked in their TODO.
2. **Build the Adrian-Website sell + scan-arrival front door** (below) that feeds the M4 sale bridge.
3. **Add the handoff's NEW vision layers** that M0–M5 does *not* yet cover (next section).

### What the handoff adds that M0–M5 does NOT yet have (the genuinely new work)

- **Yearly birthday-locked motivation ritual** — M2/M3 allow inscriptions anytime; the handoff's
  once-a-year-around-your-birthday *motivation lock* (journaling stays anytime) is new state.
- **Confirm-before-it-sets + short grace window** — the conscious "this is what I set into motion"
  gate before an inscription reaches the field. New UX gate on top of the inscription write.
- **The field's-message prose** — evolving true-prose paragraph(s) describing what the field is
  collectively birthing this season. New; must derive from real inscriptions, never invent.
- **Gift sealed hand-off ceremony** — giver seals a wish → recipient activates → wish unlocks first.
  `transferKind: 'gift'` exists; the sealed-wish ceremony does not.
- **Artist's + field's yearly letters + the reunion moment** — `LetterKind` has `anniversary`, but
  the artist's annual letter to the whole constellation and "here is who you were last year" are new.
- **Claim-block window length + warning schedule** — Decision B; logic now coded + tested in
  `mandalacodes/utils/claimWindow.ts`. Remaining: the scheduled escalation job that delivers warnings.
- **The certificate as a substantive resale/insurance artifact** — M1 has the public piece page;
  the formal certificate framing + display-history editing is a presentation layer to add.

---

## PHASE 1 — Minimum to sell pieces NOW (mostly Adrian-Website)

Goal: a piece is sellable today with an honest, complete, elegant scan experience. No constellation
required (it needs many keepers to feel alive — switch it on in Phase 2).

**1.1 — Register an artwork QR (Adrian-Website).** Today `functions/qr/[number].js` routes 1–64 to
mandalacodes oracle and everything else to `/works/:code`. Add real artwork QR entries to
`data/qrRegistry.ts` (the `artwork` type + scratch-panel recovery code per Decision C). One QR per
physical piece.

**1.2 — The scan → arrival ceremony (Adrian-Website, `/works/:id`).** Build the "piece wakes up"
moment ahead of any form: image, where made, wood, crystals, year — temple pacing, not an app. This
is new UI on the existing `WorksPage.tsx`. Pull from the `Artwork` + `BookContent` + `ProvenanceEvent`
types that already exist.

**1.3 — Certificate + provenance panel (Adrian-Website).** `Artwork.provenance` (ProvenanceEvent[])
and `createdLocation` already exist. Render the substantive certificate (resale/insurance-grade):
where made, wood, crystals, year, display history. Add keeper-editable current-display-location.

**1.4 — Two front doors from the scan.** (a) Register/certify — the universal door; (b) Begin your
intention — the deep door. Nobody pushed. A 60-second path must feel complete.

**1.5 — Set ONE intention + confirm-before-it-sets.** Inscription write already exists on mandalacodes
(`utils/inscriptions.ts`, `atlas_inscriptions` D1 table, `inscribed` ledger event with salted
commitment). Wire Adrian-Website's intention UI to write through the existing inscription path. Add
the **confirm step + short grace window + yearly-birthday lock** (the motivation lock is the new
state; journaling stays anytime).

**1.6 — Keeper account + sealed recovery code.** Better Auth identity already spans both sites and
steward binding already requires a verified email (`findStewardsForUser`). Wire claim-on-scan to
bind the scanning user as steward of that piece. Recovery code per Decision C.

**1.7 — Basic claim/transfer safety.** The `transferred` ledger event + claim-request resolve flow
exist. Add the **multi-warning block window** (Decision B) so resale/inheritance are honest. This is
the one piece of safety logic genuinely missing.

**1.8 — Daily payoff.** Scan anytime → see your intention. Trivial once 1.5 lands.

**Phase-1 prerequisites already on the board (don't duplicate):** shop launch (Stripe price IDs,
`shopEnabled` flag) is its own TODO — Phase 1 *selling* depends on it. See `shop-launch.md`.

---

## PHASE 2 — The field comes alive (mostly mandalacodes, reuse what's built)

- **Atlas/constellation as two lenses.** Already on mandalacodes with codon/ring/region/recency
  filters + kinship arcs + depth-tier sizing (`claimOrdinal`, size-band). Add the **Adrian lens**
  (collectors + dreams, keeper's home from a scan) reading the *same* R2 `public.json`. Do NOT
  rebuild — point Adrian-Website at the existing `/api/atlas`.
- **Sharing-on-by-default + consent gradient.** `utils/consent.ts` + holder-chart consent exist.
  Add the planetary-shared-by-default rule and the friction-to-go-private (handoff §4, open Q #5).
- **The immersive browse + the field's-message prose** (handoff §4). New. The field message must
  read as TRUE — derived from real inscriptions, never invented.
- **Astrology resonance + depth-tier lights.** Profile math is pure and extractable
  (`lib/astrology/profile.ts`). Extract to a shared package OR call client-side; draw the reading
  into the piece. Don't rebuild on Adrian's side (handoff §12).
- **Gift sealed hand-off ceremony.** `transferKind: 'gift'` + sealed-blessing-on-transfer concept
  exist in the ledger types. Build the giver-seals-a-wish → recipient-activates flow.
- **Yearly letters (field + artist) + the reunion moment.** `LetterKind` already has
  `anniversary`/`transfer`/`kin-claim`. Build the artist's annual letter + "here is who you were
  last year."

---

## PHASE 3 — Depth & permanence (later, much already scaffolded)

- **Oracle codon anchor** — waits for the deck anyway; codon-as-address already in the Atlas.
- **Endowment + named steward + death-liberation plan** — the permanence promise; structural/legal,
  not just code. Handoff §9. The ledger is append-only and R2-durable, which is the technical half.
- **Depth touches** — intention-came-true, witnessing ("I see you"), shared dream across two pieces
  (linked lights), time-as-pilgrimage. All additive on the existing ledger.

---

## First concrete moves for the next build session

1. **Ratify Decisions A–D** (above). A is load-bearing; nothing should be built until it's settled.
2. **Phase 1 vertical slice on Adrian-Website:** register one real artwork QR (1.1) → scan-arrival
   ceremony on `/works/:id` (1.2) → certificate panel (1.3). This ships value with zero mandalacodes
   changes and proves the front door.
3. **Wire intention write-through** (1.5) to the existing mandalacodes inscription path; add the
   confirm + yearly-lock state.
4. ~~**Encode the claim-block window** (1.7 / Decision B)~~ — DONE 2026-06-23 in
   `mandalacodes/utils/claimWindow.ts` (pure logic + tests). Next: wire the scheduled escalation job.
5. **Lock the recovery-code format** (Decision C) — it blocks any physical print run.

---

## Don't-rebuild list (verified in code 2026-06-23)

- Atlas globe + filters + kinship → `mandalacodes/components/AtlasPage.tsx`, `utils/kinship.ts`
- Ledger (claimed/inscribed/transferred, append-only, R2) → `mandalacodes/utils/ledger.ts`
- Claim requests + resolve → `mandalacodes/utils/claimRequests.ts`, `functions/api/atlas/claim-requests/`
- Claim-escalation window (Decision B, patient/no-frees-on-silence) → `mandalacodes/utils/claimWindow.ts` (pure; escalation job not yet wired)
- Inscriptions (salted commitment, D1 body) → `mandalacodes/utils/inscriptions.ts` + `atlas_inscriptions`
- Steward binding (verified email) → `mandalacodes/functions/api/atlas/_helpers.ts`
- Sale→ledger bridge → `Adrian-Website/migrations/005_atlas_legacy.sql` (`atlas_sale_events`)
- Hologenetic profile math → `mandalacodes/lib/astrology/profile.ts` (pure, extractable)
- Consent / holder chart → `mandalacodes/utils/consent.ts`
- QR redirect infra → `Adrian-Website/functions/qr/[number].js` (permanent contract)
- Shared D1 + Better Auth identity across both sites
```
