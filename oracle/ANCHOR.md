# Universal Language Oracle — Anchor & Hand-off

A clean-start anchor. The working conversation grew very long and accumulated
assumptions; this document is the honest, current record so the next session
begins from truth, not from a tangle.

**Read `VISION.md` first, then this.** `VISION.md` holds the *intent* — what
the deck is for, who it is for, and the six-section card structure Adrian has
set. This document holds the *situation* — what exists, what is decided, what
is not, and the open questions. Together they are the hand-off. Neither alone
is enough: VISION is the why, ANCHOR is the where-things-stand.

This document deliberately does **not** invent a plan for the parts Adrian has
not approved.

---

## 1. The single most important thing

**The writing method for the cards is NOT decided. It is Adrian's to set.**

In the working session, the assistant drafted a prototype synthesis for
Hexagram 1 and a casting layout, and treated them as progress. Adrian did not
approve a writing method, was not asked, and the draft (e.g. one-sentence
voice readings) is **not** what he wants. That prototype is set aside.

Before any card is written, Adrian and the assistant **design the writing
method together** — anchored in the real source material — and Adrian locks
it. Specifically still to be decided by Adrian:

- How long a card's reading is, overall and per voice.
- How "assimilatable" / accessible vs. deep the writing should be.
- What each voice should and should not contain.
- Concrete things to do and not do (example Adrian gave: the Human Design
  source material starts every gate description with "Gate 1 …" / a fixed
  template — that is a *not-do*; the writing should not inherit that).
- The structure and shape of a card overall.

The assistant must not draft card content until this is set.

---

## 2. What genuinely exists (verified)

### The standards (written, in `Adrian-Website/oracle/`)
- `VISION.md` — **the intent.** Why the deck exists, who it is for, the
  six-section card structure. Adrian-set. Read first.
- `CONCEPT.md` — what the deck is (the older vision document; VISION.md is the
  current, Adrian-confirmed intent and supersedes it where they differ).
- `00`–`06` — the guide set (master, description, invocation, I-Ching,
  translation method, keywords, connections).
- `SCHEMA.md` — the card-data shape.
- `PROJECT_PLAN.md` — the build plan.
- `RECONCILIATION.md` — historical; the template/live-card reconciliation,
  now done. Treat as a record, not a live doc.

Caveat: the guide set was written across the long session. Some of it encodes
assumptions Adrian had not signed off (lengths, exact section framing). It is a
strong *draft* of the standards, not gospel. The Stage A writing-method work,
and the six-section structure in `VISION.md`, may revise it.

### The source corpus — the Obsidian vault
`~/Documents/Obsidian Vault/oracle/` — ~2,460 files, verified complete:
- 64 hexagrams, each with 6 I-Ching translations (Legge, Wilhelm, Huang,
  Deng, Cleary ×2), the Eranos translation, Rudd's *64 Ways*, two Gene Keys
  files, the HD gate, the channel, a practical reading, Tarot correspondences,
  and the 6 moving-line files.
- `human-design/` — 64 gates, 36 channels, 9 centers.
- `gene-keys/codon-rings/` — 22 codon rings.
- `systems/` — 8 trigrams, the 8 Eight Immortals, 3 Tarot reference files
  (codon-ring↔Tarot mapping, Golden Dawn keywords, Xuan system).
- Each hexagram's `_hexagram-NN.md` has a master index, a `## Correlation`
  section (wired this session — links trigrams, immortals, ring Tarot), and a
  `## Synthesis` section.

**This is the real "collective" of source material.** Any writing-method
design should begin by Adrian and the assistant actually reading across these
sources for a sample hexagram, together.

### The deck content — almost entirely unwritten
- **63 of 64** `## Synthesis` sections are empty placeholders.
- Hexagram 1 has a draft synthesis — **set aside** (see §1), not approved.

### The website / card UI
- The live oracle card (`UniversalLanguageCard.tsx`) had a UI pass this
  session — labels, the casting ritual, the Relations panel, all reworked and
  folded in. It builds and type-checks.
- It still renders the **old** data (`oracle_cards_complete.json`), not the
  vault. The vault→card pipe does not fully exist.
- **The live card does NOT yet match the structure Adrian set in `VISION.md`.**
  The intended structure is six sections with the bar
  `UL 1 · ICHING · KEYS · DESIGN · BODY · RELATIONS`. The live card currently:
  ends Relations → Body (VISION puts Body before Relations); shows full-word
  labels "I CHING / GENE KEYS / HUMAN DESIGN" (VISION shortens to
  ICHING / KEYS / DESIGN); has no `UL N` identity slot; labels kin-card links
  "Code N" (VISION: "UL N"). Reconciling the live card to `VISION.md` is a
  Stage B task — see §6.

### The generator (half-built, not wired)
- `scripts/generate-oracle-cards.mjs` — reads a vault `_hexagram-NN.md`,
  parses `## Synthesis` + `## Correlation`, emits `oracle/generated/NN.json`
  in the `SCHEMA.md` shape. Works on Hexagram 1.
- It is **not wired to the card** — no adapter, the renderer still reads old
  data. Building further on this was paused, correctly, pending §1.

---

## 3. Decisions that ARE settled

These came up in the session and Adrian confirmed them. The card-structure
decisions are recorded in full in `VISION.md`; summarised here:
- The deck is an **oracle first**, with the teaching as the depth underneath —
  it serves system-experts, beginners, and people new to all of it at once.
- The card is **six sections**, reached from a nav bar so a reader can skip to
  any one in a single tap:
  `UL 1 · ICHING · KEYS · DESIGN · BODY · RELATIONS`.
- **UL 1** is the card's identity/home slot (per-card label, e.g. "UL 1").
- **BODY** is the biological/DNA layer (the codon, the codon ring as living
  chemistry, the physical seat) — distinct from Human Design's energy body.
- **RELATIONS** is the true final section — the doorway out to kin cards.
  Named Relations (not "Web" — reads as internet).
- **Tarot is nested inside Relations** as the ring's archetypal face — not its
  own chapter.
- Internal relating (moving lines, Shadow/Gift/Siddhi, gate-in-channel) stays
  inside its own system's section; only outward relating lives in Relations.
- A single card is called **"UL N"** everywhere (bar, kin links, URLs).
- The casting is a **ritual the reader performs** — not pre-loaded; the reader
  throws and watches it unfold. (UI built.)
- The invocation is **optional** and fills in over time; a card is complete
  without one.
- Copyright: teach the systems freely in original words, never reproduce a
  source's prose, name the lineages where the deck is teaching.
- The moving lines are part of the deck (core, not an extra).
- The Eight Immortals / trigrams / Golden Dawn material is in scope as a
  deeper correlation layer, nested inside Relations.

---

## 4. Open questions — NOT decided

Resolved since the first draft of this anchor: the card *structure* (now
settled in `VISION.md` — six sections, the bar, Body as the DNA layer, Tarot
nested in Relations, "UL N" naming). What remains open:

- **The writing method** (Stage A) — the biggest one. The structure is set;
  the method that fills it is not.
- The generator's render target — a "B via adapter" approach was discussed
  but nothing is built or approved.
- Whether the guide set's lengths/section-framing survive the Stage A work.
- `SCHEMA.md` and the generator have **no `body` section and no `UL N`
  identity field** — VISION.md added both to the structure; they must be added
  to the schema/generator in Stage A3.
- The 64 artwork images — never verified to exist/be correct.
- `SCHEMA.md`'s `reading` vs `anchor_line` — the vault GLANCE has only one
  "Essence" field, so the generator duplicated them. Unresolved.
- Markdown markers (`**bold**`, `*italic*`) currently leak into generated JSON
  string values. Unresolved (strip in generator, or render in card).
- `oracle/generated/01.json` exists — the generator's output for Hexagram 1.
  It is **provisional**, built from the set-aside prototype synthesis. Not
  approved content. Delete or regenerate once the writing method is set.

---

## 5. The honest next step

Start a fresh session. Read `VISION.md` first — the intent and the six-section
structure are settled there. Then the first real work is **Stage A — design
the writing method** (§6), and it begins by Adrian and the assistant reading
the actual vault source material for one sample hexagram, *together*, so the
method is grounded in the real collective and not in assumptions. Adrian sets
the length, the depth, the do's and don'ts. The card *structure* is already
set (VISION.md); the writing *method that fills it* is not. Only then does any
card get written, and only then does the generator/adapter/render pipe get
finished.

Nothing about card content or the writing method should be assumed from this
document. It records the situation; Adrian directs what happens next.

---

## 6. The full roadmap — everything left to do, in order

The complete remaining path from here to a finished deck. Each step waits on
the one before it. Adrian directs the pace and approves each stage; the
assistant does not skip ahead or assume.

### Stage A — Design the writing method  ← START HERE
The card *structure* is already set in `VISION.md` (six sections). Stage A is
the writing *method* that fills that structure.
A1. Read one sample hexagram's full vault source *with Adrian* — the six
    translations, the Gene Keys text, the HD gate/channel/center, the moving
    lines, the trigrams, immortals, Tarot. See the real material.
A2. Adrian sets the writing method: per-section length, depth vs.
    accessibility, what each section does and does not contain, explicit
    do's and don'ts, the shape of each of the six sections.
A3. Reconcile the guide set (`CONCEPT.md`, `00`–`06`, `SCHEMA.md`) to both
    `VISION.md` (structure) and the method Adrian set — revise whatever those
    guides assumed that VISION or the method overrides. Note: `SCHEMA.md` and
    the generator currently have no `body` section and no `UL N` identity
    field — Stage A3 must add them. Lock the standards.

### Stage B — Prove it on one card
B1. Write ONE hexagram's full `## Synthesis` in the vault, to the locked
    method and the six-section structure. Adrian reviews and refines.
B2. Settle the open data questions surfaced by doing it: the
    `reading`/`anchor_line` duplication, markdown-in-JSON, the vault
    Synthesis template format the generator parses, the new `body` section.
B3. Update the generator to match the locked method/template; regenerate
    that one card's JSON. (Generator already parses `### RELATIONS`, fixed
    from the stale `### THE WEB`.)
B4. **Reconcile the live card (`UniversalLanguageCard.tsx`) to `VISION.md`:**
    six sections in the order UL 1 · ICHING · KEYS · DESIGN · BODY · RELATIONS;
    add the `UL N` identity slot; add the BODY section; move Body before
    Relations; shorten the bar labels; rename kin-card links "Code N" → "UL N".
B5. Build the adapter (or rewire the renderer) so the generated JSON renders
    on the restructured live card. Decide "adapter" vs. full-rewire.
B6. See the one card whole on the live site. This proves the entire pipe:
    vault writing → generator → JSON → card. Do not scale until it is right.

### Stage C — Write the deck
C1. Phase 1 — scaffold all 64 hexagram syntheses in the vault to the locked
    method (a complete, on-standard draft).
C2. Phase 1 — the 384 moving-line readings.
C3. Phase 2 — Adrian's per-card art pass: refine each card until it is
    genuinely his. Status tracked (`scaffold` → `in-progress` → `final`).

### Stage D — Generate, wire, ship
D1. Generate all 64 card JSONs from the finished vault.
D2. Rewire the live card fully to the new data; retire
    `oracle_cards_complete.json`.
D3. Verify the 64 artwork images exist and are correct.
D4. Build the whole-system map (all 64, the kinship webs seen at once —
    `CONCEPT.md` §7).

### Stage E — Surface & launch
E1. Rework the lineage / "about the systems" page (`OracleSystems.tsx`).
E2. Full review of all 64 against `CONCEPT.md` and the guide set.
E3. The Human Design rights check (`CONCEPT.md` §9 / §10) before publishing.
E4. Confirm every card's status is `final`. Launch.

### Standing notes for the next session
- The dev server (`npm run dev`, port 8888) stops on its own; restart when
  the page won't load.
- Verify visual changes with a screenshot, not by scraping page text — the
  reading-stage is a swipe-panel layout that defeats text probes.
- Work that is not trivial happens on a branch; commit at checkpoints.
- This whole session's work is committed on `oracle/synthesis-foundation`
  (commit `2c5ccc9`), not yet pushed.
