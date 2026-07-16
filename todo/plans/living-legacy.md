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

## THE DREAM — what people actually enter (the heart of the project)

> Added 2026-06-24 from a long design conversation with Adrian. The plan above is the *mechanism*.
> This section is the *soul of the content*: what a keeper places in their piece, how it stays alive
> over the years without becoming a chore, and how dreams connect without becoming social media.
> This is content/experience design, not code yet. It refines the Vision doc's three-phase cycle.

### It is a DREAM, not an intention

A keeper places a **dream** in their piece — what they wish for. Not an "intention" (the will trying
to *make* something). A dream invites the imagination back in. Most people have a full to-do list and
a starved imagination; they have traded their dreams for goals. The quiet gift of this project is
permission to dream again at all. So the word is **dream** everywhere, and the whole experience
protects wishing, wonder, and co-creation over productivity.

A dream is held at one of **four scopes** — for the **self**, for **family / loved ones**, for the
**community**, or for the **planet**. These are not four boxes to fill. They are four doorways, and
most people have never once been asked "what do you dream for the earth?" Being *asked* is the gift.

### What a person enters — three things, only the first is required

1. **The dream itself.** A sentence or a paragraph, at one scope. For most keepers this is the whole
   thing, and it is complete and dignified on its own. A busy collector can set one dream and leave,
   and it feels finished, never a lesser version. This is the existing inscription write on
   mandalacodes (`utils/inscriptions.ts` → `atlas_inscriptions` + the `inscribed` ledger event with a
   salted commitment), now carrying a **scope** and read as a *dream*.

2. **The living thread — mile-markers, never a diary.** Over the year, when something *real* happens,
   the keeper may add to the dream: a sign of progress, a thought, an inspiration, a photo, a small
   amendment. Adrian's own example: someone dreaming of growing a community adds a marker each time
   the community actually grows. The dream visibly grows because life moved it forward. **The
   iron rule: nothing is ever owed.** No empty slots, no streaks, no "you haven't added anything,"
   no nudge to engage. A quiet dream is not behind — it is simply resting. Adding is always a joy you
   *choose*, never a task you are failing. This is the line between devotion and gamification: a
   system that *nudges you to engage* is the gimmick the Vision bans; *you choosing to return because
   the dream is alive in your life* is the practice it's built for. The thread is the everyday pulse.

3. **The yearly moment — the ritual, around your birthday.** Once a year, never a blank form: one of
   three choices — **reinforce** the dream you hold, **plant a new** dream, or **mark one fulfilled**.
   Plus the option to do something special that one time a year. This is the scarcity that makes it a
   ritual not a feed (Vision §yearly ritual), the cedar into the fire, confirm-before-it-sets. Old
   dreams never vanish; they accumulate as a record of who you have been becoming.

**Two cadences, no longer fighting.** The thread is the *everyday* (joy, never owed). The yearly
moment is the *ceremony* (rare, sacred, deliberate). The earlier worry — "is it a daily journal or a
yearly lock?" — dissolves once the thread is understood as mile-markers you place when life gives you
one, not a diary you owe entries to.

### Inscription roles and birthday-linked chart consent — deferred design

> Added 2026-07-13. Record the product decisions now; Adrian will design the actual inscription
> language, prompts, and ceremony in a later pass.

- **Creator's Inscription:** Adrian's permanent message placed into the work as its maker.
- **Origin Inscription:** the first keeper's permanent inscription. They are the person who first
  brought the finished work into its life with a keeper. This is distinct from the Creator's
  Inscription and from later yearly inscriptions.
- **Annual Inscription:** after ownership transfer is confirmed, the new keeper's verified account
  receives the piece and its birthday-based annual inscription cycle. One account may hold multiple
  pieces and manages each piece's inscriptions from the same collection view.
- The keeper's birth date remains private and is never displayed publicly. It powers the private
  chart and birthday ritual. It may later support consent-based chart coherence between keepers and
  pieces without exposing the underlying birth date.
- Chart-coherence participation is a clearly disclosed, preselected choice during signup. The signup
  flow explains what the birth-chart connection allows; the person can uncheck it before registering
  and can disable it later from their account. It is never hidden. Describe this accurately as
  **default-on participation with a clear consent control**, not as opt-in. Review the final wording,
  data use, and default against applicable privacy requirements before launch.
- Every sealed inscription remains part of the piece's permanent lineage across all later transfers.
  The exact drafting window, sealing moment, visibility choices, and yearly ritual remain intentionally
  unresolved until Adrian's dedicated inscription-design pass.

### The third phase is fulfillment / transformation, NOT destruction

The Vision's cycle is creation / maintenance / destruction. For *dreams*, the third phase is gentler
and stronger: a dream that **comes true blooms** — it stays in the field forever as proof the practice
works (Vision §"the intention that came true"). A dream you **outgrow is honored** as who you once
were, frozen and immortalized, never deleted. Nothing is destroyed; dreams are fulfilled or
transformed. This also removes the contradiction in promising both "release your dream" and "your
dreams live forever" — you don't abandon a dream, you complete it or let it become a chapter.

### Helping people find their dream (not coaching, never prescribing)

Sharing the totality of a dream is hard, and many people have lost touch with what they truly wish.
So the experience **helps a person find and anchor their own dream** — it draws the dream *out*, it
never puts one *in*. It asks, reflects, and helps them find their own words. The moment it suggests
*what* to dream, it becomes a guru and the spell breaks (Vision: "personal and mystical but
non-prescriptive"). A midwife, not an author. The four scopes are the doorways it can gently walk a
person through, one at a time, only as deep as they want, over time. A single question is too thin;
this wants room and warmth, and some people only meet their dreams at night. **This is the deepest
part of the project and the one to develop slowly over years** — built shallow it feels like a
personality quiz laid over someone's most intimate hopes, which is worse than nothing. Launch simple
and honest; deepen the guidance as real keepers show how they actually answer.

### The guided flow — how a dream is drawn out (sketch)

The flow exists for the person who says "I don't know, I haven't really thought about it." Its only
job is to help them arrive at words that feel *true to them* — never to supply the words. Build it
slowly over years; this sketch is the shape to grow into, not a launch spec. The launch can be far
simpler (one warm open invitation), and the guidance deepens as real keepers show how they answer.

**The shape, five gentle beats — each skippable, none required:**

1. **Arrival, not a form.** A breath first (Vision §every transition is a ceremony). No fields yet.
   "This piece will hold a dream for you. There's no rush, and no wrong answer." The tone sets that
   this is a sacred space, not an app onboarding.

2. **Choose a doorway, or be offered one.** The four scopes as an invitation, not a checklist:
   "What would you like to dream for — yourself, the people you love, your community, or the earth?"
   A person picks the one that's alive for them. Most pick *self* or *family* first; *planet* is the
   one almost no one has been asked, and being asked is itself the gift. Only one at a time.

3. **Draw it out with questions, never suggestions.** This is the heart, and the line that must never
   be crossed: **the prompts ask, reflect, and open — they never propose content.** Examples of the
   *kind* of prompt (open, personal, non-leading): "When you picture this going beautifully, what do
   you see?" · "What's already true that you'd want more of?" · "Who is this dream really for?" ·
   "If nothing were in the way, what would you wish?" The person answers in their own words, free
   text, any length. The system may *reflect back* what it heard ("so it sounds like it's about…")
   to help them feel it — reflection is allowed; suggestion is not. A guru hands you a dream; a
   midwife asks until your own dream is in your hands.

4. **Find the words together (optional depth).** For those who want it, a gentle back-and-forth that
   helps hone the phrasing — tighten, clarify, make it ring true — still only with *their* material,
   never new content. This is the part to develop most carefully and last; shallow here feels like a
   chatbot, and a chatbot over someone's deepest hope is a desecration. Until it's genuinely good,
   leave it out entirely — better no honing than clumsy honing.

5. **See it, then set it (confirm before it sets).** The person sees their dream the way the field
   will see it, and consciously confirms: *this is what I am setting into motion this year.* The
   cedar into the fire (Vision §confirm before it sets). A short grace window to fix a mistake, then
   it sets. Then the first sunrise — their light appearing in the field (Vision §first sunrise).

**The non-negotiable rule for the whole flow:** it draws *out*, it never puts *in*. The day it
suggests what to dream, it becomes prescriptive and the spell breaks. Test every prompt against this:
does it ask the person to look inward, or does it hand them a ready-made wish? Only the first ships.

**Where the MLK energy touches this, lightly:** the invitation to dream something beautiful — for
yourself and, especially, for the world — is the same energy of the day Adrian was born into. It can
breathe through the framing of the flow without ever being stated as a reference.

### Connecting dreams — witnessing, never applause

The most powerful layer and the most dangerous. People joining each other's dreams, sharing the
vision and passion, supporting one growing, is the Starry Night field made real (Vision §the
constellation). But the instant it has likes, comment threads, or visible supporter counts, it is
social media for prayers and the magic dies — the quiet keeper with a private dream for a dying
parent would feel like a failure beside a popular one.

**The rule: support is witnessing, not applause.** Three ways to connect, in order of preference:

- **Stand beside a dream (default).** You add your light to someone's shared dream; they feel they
  are not alone in it. No public count, no comments, no leaderboard. A dream with three witnesses is
  not lesser than one with three hundred. Quiet, sacred, impossible to turn into a contest. This is
  the Vision's wordless *I see you*, now landing on a *dream* rather than a person.
- **Co-hold a dream (families, couples).** Two people share one dream across their two pieces —
  linked lights in the constellation (Vision §"a shared dream between two people"). Powerful for a
  parent and child or a couple; only works between people who already know each other.
- **Open support with visible counts — explicitly rejected.** Most viral, fastest path to becoming
  social media, betrays the field. Do not build.

So: linking, yes; measuring, never. Shared dreams (community/planet) are browsable in the immersive
field so a stranger can wander, feel it, and want one — that immersive beauty is the recruitment, and
the storefront (Vision §the browse).

### Data-model sketch (reconcile with mandalacodes before building)

Honoring the load-bearing invariant — **the chain never holds personal data, only opaque IDs, types,
dates, cityIds, and salted commitments**; free text lives in mutable, erasable D1 rows:

```
dream            (D1, mutable/erasable — the soft body)
  id, keeperId, pieceId
  scope           self | family | community | planet
  body            the dream text
  state           living | bloomed (came true) | transformed (outgrown, honored)
  visibility      shared | anonymous | private   (planet/community shared by default; self/family private)
  bornYear, lastYearlyMoment
mile_marker      (D1, mutable — the living thread; added only when there's something true to add)
  id, dreamId, body, optional media, addedAt
witness          (D1 — "stand beside"; a keeper adds their light to a shared dream; NO public count surfaced)
  dreamId, witnessKeeperId, addedAt
co_hold          (links two pieces to one shared dream — the family/couple case)
ledger inscribed (chain, append-only — only a SALTED COMMITMENT of the yearly-set dream + scope + date)
```

Open reconciliations before writing code: whether the existing `inscribed` event already carries a
scope/ring field or needs one added; confirm mile-markers and witnesses **never** touch the chain
(recommendation: they stay fully mutable in D1 — only the yearly dream gets a salted commitment); and
how `bloomed` / `transformed` are represented (recommendation: a state on the D1 row, not a new chain
event, to keep the chain minimal).

### How this lands in Phase 1 (small, additive — no new mechanism)

Phase 1.5 below becomes: **set one dream — choose a scope, write it, confirm.** Still complete in 60
seconds. The living thread, the yearly three-choice moment, and connecting are depth that reveals
over Phase 2+, exactly as the two-front-doors principle demands. Same inscription write-through, now
carrying scope and read as a dream.

---

## ARTIST STORY — born into a day of collective dreaming

Adrian was born on **January 15**, the day the world (in the US) pauses to celebrate dreaming of
something beautiful together. Growing up, his birthday was every single year a public holiday about
exactly that: a shared dream, celebrated, that moves us somewhere. This is **not** about borrowing
Martin Luther King's fame — it is about the *energy of the day he was born into*. King is the
figurehead the holiday honors; the thing Adrian carries is the holiday's meaning: the power of
imagination to dream something greater that we can all celebrate and be moved toward.

Use it as **DNA, not a constant refrain**:

- It lives in the **artist story** as the origin truth — why this project is *his* to make. Present,
  honest, woven in, not leaned on as a hook line and not "born on MLK's birthday" as a tagline.
- A **light touch** can appear in the experience that helps people find their dream — the same energy
  of being invited to dream something beautiful together.
- King's name may appear once, softly, as the reason the day exists, with full respect. The weight
  sits on the *meaning of the day*, never on the man — that is what keeps it origin, not appropriation.

Voice constraints: no em dashes; personal and mystical but non-prescriptive. The story is
autobiographical, so it is exempt from the no-business-location rule.

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
dream — the deep door. Nobody pushed. A 60-second path must feel complete.

**1.5 — Set ONE dream + confirm-before-it-sets.** (See "THE DREAM" section above for the full content
model.) Inscription write already exists on mandalacodes (`utils/inscriptions.ts`, `atlas_inscriptions`
D1 table, `inscribed` ledger event with salted commitment). Wire Adrian-Website's dream UI to write
through the existing inscription path, now carrying a **scope** (self / family / community / planet).
Add the **confirm step + short grace window + yearly-birthday lock**. The living thread (mile-markers,
never owed) and the yearly three-choice moment are Phase 2+ depth.

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
