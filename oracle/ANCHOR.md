# Universal Language Oracle — Anchor & Hand-off

A clean-start anchor. The working conversation grew very long and accumulated
assumptions; this document is the honest, current record so the next session
begins from truth, not from a tangle.

**Read this first.** It states what genuinely exists, what is decided, what is
**not** decided, and the open questions. It deliberately does **not** invent a
plan for the parts Adrian has not approved.

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
- `CONCEPT.md` — what the deck is.
- `00`–`06` — the guide set (master, description, invocation, I-Ching,
  translation method, keywords, connections).
- `SCHEMA.md` — the card-data shape.
- `PROJECT_PLAN.md` — the build plan.
- `RECONCILIATION.md` — historical; the template/live-card reconciliation,
  now done. Treat as a record, not a live doc.

Caveat: these guides were written across the long session. Some encode
assumptions Adrian has not signed off (lengths, the "voices" framing). They
are a strong *draft* of the standards, not gospel. The writing-method work in
§1 may revise them.

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

### The generator (half-built, not wired)
- `scripts/generate-oracle-cards.mjs` — reads a vault `_hexagram-NN.md`,
  parses `## Synthesis` + `## Correlation`, emits `oracle/generated/NN.json`
  in the `SCHEMA.md` shape. Works on Hexagram 1.
- It is **not wired to the card** — no adapter, the renderer still reads old
  data. Building further on this was paused, correctly, pending §1.

---

## 3. Decisions that ARE settled

These came up in the session and Adrian confirmed them:
- The deck teaches the 64 system; it is an oracle that also teaches.
- The connections panel is named **Relations** (not "Web" — reads as internet).
- The casting is a **ritual the reader performs** — not pre-loaded; the reader
  throws and watches it unfold. (UI built.)
- The invocation is **optional** and fills in over time; a card is complete
  without one.
- Copyright: teach the systems freely in original words, never reproduce a
  source's prose, name the lineages where the deck is teaching.
- The moving lines are part of the deck (core, not an extra).
- The Eight Immortals / trigrams / Golden Dawn material is in scope as a
  deeper correlation layer.

---

## 4. Open questions — NOT decided

- **The whole writing method** (§1) — the biggest one.
- The generator's render target — a "B via adapter" approach was discussed
  but nothing is built or approved.
- Whether the guide set's lengths/voice-framing survive the §1 method work.
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

Start a fresh session. The first real work is **§1 — design the writing
method** — and it begins by Adrian and the assistant reading the actual vault
source material for one sample hexagram, *together*, so the method is grounded
in the real collective and not in assumptions. Adrian sets the structure,
the length, the do's and don'ts. Only then does any card get written, and
only then does the generator/adapter/render pipe get finished.

Nothing about card content or the writing method should be assumed from this
document. It records the situation; Adrian directs what happens next.
