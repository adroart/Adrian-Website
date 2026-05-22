# Universal Language Oracle — Anchor & Hand-off

The honest, current record of where the work stands. Read this with
`VISION.md` (the *intent* — what the deck is for and the six-section card
structure) and `WRITING_METHOD.md` (the *method* — every text slot, locked
voice rules, Hexagram 1 worked samples). Together they are the working spine.
This document records the *situation*: what exists, what is decided, what is
not, and what comes next.

Last revised: 2026-05-22. Earlier drafts of this anchor described Stage A as
the starting point — Stage A has run. The frontier has moved.

---

## 1. Where the work actually stands

The card *structure* (six sections, `UL N · ICHING · KEYS · DESIGN · BODY ·
RELATIONS`) is locked in `VISION.md`.

The *writing method* is locked in `WRITING_METHOD.md` — field-by-field, with
Hexagram 1 worked samples drawn from the real vault source. The voice
("intimate teacher"), the §1.5 "reads-as-human" cuts (no symmetry, no summary
sentence, plain vocabulary, end a beat early), the no-em-dash rule, the
"writing IS the information" / click-glossary rule, and the UL N opening as
2–3 clusters with empty-line breaks are all decided.

Writing for the deck has started. Section by section:

| Section | Status | Where |
|---|---|---|
| UL N (opening reading + invocation) | UL 1 locked. UL 2–64 invocations not yet written. | `oracle/generated/01.json` (only 01 exists) |
| ICHING | Not yet started under the locked method (some legacy synthesis prose exists in `oracle/synthesis/key_*.json`). | — |
| KEYS (Gene Keys) | **All 64 written.** UL 1 final, UL 2–64 scaffold. | `oracle/sections/keys/01.json … 64.json` |
| DESIGN (Human Design) | **All 64 written** in the bridge-rewritten standard (no HD jargon in prose). UL 1 + UL 2 final, UL 3–64 scaffold. | `oracle/sections/design/01.json … 64.json` |
| BODY | Not yet written as overlays (the legacy synthesis files carry some body prose). | — |
| RELATIONS | UL 1 locked as the reference. UL 2–64 not written. Brief is `_BRIEF.md`. | `oracle/sections/relations/01.json` |

A separate strategic document, `MARKETING_POSITIONING.md` (2026-05-22, ~33KB),
now exists as the spine for mission, product ladder, pricing, network logic,
and language rules (no scarcity, no ecommerce-coded copy, honest production
credit, "wisdom is free, objects are art"). It is *not* card-writing — it is
the project's positioning.

A separate UI hand-off, `HANDOFF.md` (2026-05-22), tracks the live card
component work: small fixes already shipped, the `CardIdentityHeader` refactor
agreed but not yet built, and the per-panel artwork strategy.

The legacy `oracle/synthesis/key_*.json` files (all 64 present) carry an
older synthesis shape. The card reads them via `data/synthesisData.ts` with
the `sections/keys/` and `sections/design/` overlays on top. RELATIONS is the
next overlay to wire in.

The live card (`components/UniversalLanguageCard.tsx`) renders all six section
panels with the locked KEYS + DESIGN overlays. The Relations panel renders
the TCG-style correspondence sheet for UL 1 only; UL 2–64 still need their
prose written.

---

## 2. The source vault

`~/Documents/Obsidian Vault/oracle/` — ~2,460 files, verified earlier and
still the source corpus. The Stage A2 method was built from reading this
vault for Hexagram 1. The same vault feeds any future writing.

---

## 3. What is still open

- **UL 2–64 invocations** — only UL 1 has an invocation written. Needs a
  brief for the invocation voice, then the 63 remaining files dropped in
  `oracle/generated/`. Loader (`getInvocation()` in `data/synthesisData.ts`)
  already supports any file that lands.
- **UL 2–64 RELATIONS prose** — brief is locked (`sections/relations/_BRIEF.md`),
  reference card is UL 1, per-card metadata is pre-computed in
  `_per_card_reference.json`. The 63 cards have not been drafted. Once
  written, an overlay loader must be wired into `data/synthesisData.ts`
  parallel to the KEYS / DESIGN overlays, and the Relations panel pointed at it.
- **ICHING section overlay** — has not been built. Either the legacy
  synthesis prose is reconciled to the locked method, or a `sections/iching/`
  pass is run the way KEYS and DESIGN were.
- **BODY section overlay** — same story as ICHING. Legacy prose exists in
  synthesis files; a clean per-section pass under `WRITING_METHOD.md` §5 has
  not happened.
- **KEYS and DESIGN scaffold → final pass** — 63 of the 64 cards in each are
  scaffold (Phase 1 AI draft, on-standard). Adrian Phase 2 (per-card refining
  to "final") is the deck's main writing labour ahead.
- **Older guide set (`00`–`06`, `SCHEMA.md`)** — predates the six-section
  structure and the locked method. They are not actively misleading because
  `WRITING_METHOD.md` is canonical, but they have not been edited to point at
  the new method. Light reconciliation outstanding.
- **The live card UI refactor** — `CardIdentityHeader` (artwork + Acquire / glyph /
  Share row + framed title block at the top of every reading panel), and
  per-panel artwork sizing. See `HANDOFF.md` for the full UI punch list.
- **`oracle/generated/01.json`** — provisional, was built before the locked
  method; the part of it that drives the live invocation panel is fine, but
  the legacy `synthesis` shape is superseded by `sections/` overlays.
  Regenerate or retire as ICHING / BODY get rebuilt.

---

## 4. The standing decisions (settled, do not re-litigate)

From earlier sessions and `VISION.md` / `WRITING_METHOD.md`:

- Oracle first, teaching as the depth underneath. Serves system-experts,
  beginners, and people new to all four traditions at once.
- Six sections in the order `UL N · ICHING · KEYS · DESIGN · BODY · RELATIONS`.
  Nav bar lets a reader jump to any in one tap.
- "UL N" everywhere — bar's home slot, kin links, URLs. Never "Code N".
- BODY is the biological/DNA layer (codon, codon ring as living chemistry,
  the physical seat) — distinct from Human Design's energy body.
- RELATIONS is the true final section, the doorway out to kin cards. Tarot
  nests inside RELATIONS as one element; it does not get its own chapter.
- Internal relating (moving lines, Shadow/Gift/Siddhi, gate-in-channel) stays
  inside its system's own section. Outward relating lives only in RELATIONS.
- The casting is a ritual the reader performs — coin-cast, thrown and watched
  as it unfolds; not pre-loaded.
- Invocation is optional; a card is complete without one.
- Copyright: teach the four systems freely in original words, never reproduce
  a source's prose, name the lineages where the deck is teaching.
- DESIGN section follows the "bridge" rule: no HD jargon (gate/centre/channel/
  circuit) in the prose; architecture lives as quiet metadata for the UI.
- Voice: intimate teacher, warm, speaks to "you". No em dashes anywhere on a
  card. No oracle throat-clearing. The writing IS the information — system
  terms live only in the click-glossary.

---

## 5. The current roadmap — everything left to do, in order

Stage A (design the writing method) is **complete**. Stage B (prove it on one
card) is **substantially complete** — UL 1 is the locked reference across
KEYS, DESIGN, RELATIONS, BODY samples, and the live card renders it. The
remaining work is scaling that proof to the other 63 cards and finishing the
overlays that aren't yet built.

### Stage C — Write the deck (current stage)

C1. **UL 2–64 RELATIONS prose** to the locked brief. Wire the overlay into
    `data/synthesisData.ts`. (Briefs and metadata ready; nothing else blocks.)
C2. **UL 2–64 invocations.** Write the invocation brief, then the 63 files
    into `oracle/generated/`.
C3. **ICHING section pass** — either reconcile legacy synthesis prose to the
    method, or run a per-card sections/iching/ build like KEYS and DESIGN.
    Includes the trigram selector, the main reading, judgement and image
    lines, and the six moving lines per card.
C4. **BODY section pass** — same shape (physiology + amino acid prose per
    card).
C5. **KEYS and DESIGN: scaffold → final.** Adrian's Phase 2 personal pass on
    each card, updating `status: "scaffold"` → `"final"`. The deck's main
    writing labour. Tracked in each section's `_MANIFEST.md`.
C6. **Moving-line readings** — 384 micro-readings, internal relating per
    `WRITING_METHOD.md` §3 ICHING.

### Stage D — Wire, polish, ship

D1. RELATIONS overlay wired into the card.
D2. ICHING + BODY overlays wired into the card.
D3. `CardIdentityHeader` refactor — artwork + Acquire/glyph/Share row + title
    block at the top of every panel. See `HANDOFF.md` Priority 1.
D4. Per-panel artwork sizing strategy (UL full-size, others medium).
D5. The Acquire detail section / configurator (per
    `MARKETING_POSITIONING.md` §IV).
D6. Verify the 64 artwork images.
D7. Retire `oracle_cards_complete.json` and `expandedOracleData.ts` once the
    overlays cover everything they were serving.
D8. Light reconciliation of the older guide set (`00`–`06`, `SCHEMA.md`) to
    `WRITING_METHOD.md`.

### Stage E — Surface & launch

E1. Rework `OracleSystems.tsx` (the lineage / "about the systems" page).
E2. The map / network UI (planetary grid of placed sculptures + Pearl-holder
    profiles) — `HANDOFF.md` Priority 4 and `MARKETING_POSITIONING.md` §VIII–IX.
E3. Full review of all 64 against the locked method and positioning.
E4. The Human Design rights check before publishing (`CONCEPT.md` §9 / §10).
E5. Confirm every card's status is `final`. Launch.

### Stage F — Brand / domain (parked)

The Universal Language name itself, the domain, the i64 / i64os relationship,
and the painted-vs-unpainted finish strategy are open strategic questions —
parked, not blocking. See `HANDOFF.md` "Open strategic questions".

---

## 6. Standing notes

- The dev server (`npm run dev`, port 8888) stops on its own; restart when
  the page won't load.
- Verify visual changes with a screenshot, not by scraping page text — the
  reading-stage is a swipe-panel layout that defeats text probes.
- Work that is not trivial happens on a branch; commit at checkpoints.
- The current working branch is `oracle/synthesis-foundation`. Last commit:
  `668b6ce` (SEO research expansion). Uncommitted: `UniversalLanguageCard.tsx`
  has small in-progress edits; `oracle/HANDOFF.md` is untracked.
