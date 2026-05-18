# Universal Language Oracle — The Complete Plan

The full map from where the project stands to a finished 64-card deck.
Grounded in an **exhaustive, verified audit** of every folder and file in the
Obsidian vault and the project repo.

**Read order:** `CONCEPT.md` (what the deck is) → `00`–`06` (how each part is
written) → this document (what to do, in what order).

**Last synced:** 2026-05-17, after the vault reorganization, the guide-set
completion, and the foundation-work pass.

---

## PART I — THE VERIFIED STATE

### The source of truth: the Obsidian vault

`~/Documents/Obsidian Vault/oracle/` — ~2,460 files, the project's source
corpus. Front door: its `_INDEX.md`. Every folder has an `_index.md`.

The vault was **reorganized 2026-05-17** so its structure is self-describing
and nothing gets missed again. Current structure:

```
oracle/
  _INDEX.md                    the front door — every folder and file type
  hexagrams/
    _index.md
    01/ … 64/                  one folder per hexagram (~28 files each)
  gene-keys/
    _index.md
    codon-rings/                22 codon-ring files
  human-design/
    _index.md
    gates/                      gate-01 … gate-64 (renamed from hd-gate.md)
    channels/                   36 channels, channel-A-B (deduped from 72)
    centers/                    9 centers + _index-centers.md
  systems/                      cross-system & correlation material
    _index.md
    trigrams/                   8 trigrams + master ref + trigram-tarot map
    eight-immortals/            8 immortals + master ref + spirit helpers
    tarot/                      ring↔Tarot map, keywords ref, Xuan intro
    deck/                       intro, back-matter, card-names, wilhelm-intro
```

### What each hexagram folder holds (all 64 complete)

- `_hexagram-NN.md` — master index: structural frontmatter (trigrams, binary,
  nuclear/inverse/opposite, line-change targets, codon ring, amino acid,
  `hd_center`), source links, and a **`## Synthesis` placeholder — empty in
  all 64.**
- Six I-Ching translations — `legge-`, `wilhelm-`, `huang-`, `deng-`,
  `cleary-buddhist-`, `cleary-taoist-`.
- `oracle-NN` — the Eranos (Ritsema/Sabbadini) translation.
- `practical-NN` — a practical-guide reading.
- Three Gene Keys sources — `gk-64ways-NN` (Rudd's *64 Ways*), `gene-key-NN`
  (the full GK chapter), `gene-key-NN-cardname` (structured reference).
- `line-NN-1..6` — the six moving lines (384 files total; each gathers all
  five translators on that line, plus metadata).
- `tarot-*` — Tarot correspondences for that hexagram (Major Arcana + the
  minor/court correspondences, each with zodiac/Hebrew/Golden-Dawn attributes).

### What the vault confirms about project phase

- **Phase 1 — extraction — is complete.** Source corpus organized, attributed,
  complete across all 64, all systems including the correlation layer.
- **Phase 2 — synthesis — has not started.** All 64 `## Synthesis` sections
  are empty placeholders. This is the core remaining work.

### Other data sources (downstream, not source-of-truth)

| Source | What it is | Verdict |
|---|---|---|
| Obsidian vault | Source corpus + synthesis placeholders | **The foundation.** |
| `synthesis/*.json` (×64) | A generated draft of the synthesis layer | Reference only. Not the base. |
| `oracle_cards_complete.json` | Old flat data, **live** (`oracleData.ts`) | To be replaced. |
| `cards/`, `ul-cards/` | Earlier partial structures | Archive. |

### The architecture

```
VAULT (corpus + synthesis)  →  source of truth; writing happens here
        │  governed by CONCEPT.md + guides 00–06
        ▼
CARD DATA (JSON)            →  generated FROM the finished vault
        ▼
THE WEBSITE                 →  renders the JSON
```

### Already done ✓

- `CONCEPT.md` — written, corrected, extended (§8 the correlation layer).
- Guide set `00`–`06` — **all written and closed.** `06` covers the
  correlation layer.
- Vault Phase-1 extraction — complete, all systems.
- Human Design centers — extracted from the source book; all 64 gates mapped
  to their center.
- Vault **reorganized and fully indexed** — self-describing structure, an
  index in every folder, cross-repo pointer in `CONCEPT.md`.
- Vault **content-quality audit** — done; corpus confirmed strong and genuine.
- Vault **wikilinks** — 379 broken links found and fixed; now zero broken.
- **Doctrine data verified** — channels (36) and centers (9, all 64 mapped)
  correct; one conflict found and flagged (see Part VI).
- The website UI — built, sound; voice-led structure most of the way there.

---

## PART II — SCOPE: WHAT THE DECK INCLUDES

Settled by `CONCEPT.md`:

**The four primary voices** (CONCEPT §2–4): I-Ching, Gene Keys, Human Design,
Tarot. Each a full voice on the card.

**The three kinships** (CONCEPT §6): codon ring, channel, programming partner.

**The deeper correlation layer** (CONCEPT §8) — *in scope, not central*: the
eight trigrams, the Eight Immortals, and the Tarot's Golden Dawn
correspondences (zodiac, Hebrew letters — the depth of the Tarot voice, not a
separate system). Optional study depth, built expandable.

**Out of scope** (vault reference only): the Golden Path sequence guides
(Activation/Venus/Pearl), Human Design profiles/types/authority.

---

## PART III — THE WORK REMAINING

- **Stream A — Synthesis.** Fill the 64 `## Synthesis` sections in the vault,
  to the guide standard, assimilating each hexagram's many sources.
- **Stream B — Generation.** Schema; generator (vault → JSON); rewire the site.
- **Stream C — Connections & correlation.** Relations on each card; the
  correlation layer; the whole-system map.
- **Stream D — UI & surface.** Voice-led UI adjustment; lineage page; polish.

---

## PART IV — THE SEQUENCE

Steps 1–2 and the foundation work are **done**. The live sequence starts at
Step 3. Hard rule: do not scale the 64-card synthesis (Step 7) until one card
is proven end to end (Step 6).

### Step 1 — Close the standards ✓ DONE
`06_CONNECTIONS_GUIDE.md` extended to cover the correlation layer. Guide set
closed.

### Step 2 — Foundation: audit, links, doctrine ✓ DONE
Vault content-quality audit done (corpus strong). 379 broken links fixed.
Doctrine data verified. Astrology/Kabbalah audited and placed (Part VI).

### Step 3 — Design the canonical card-data schema ✓ DONE
`SCHEMA.md` written — the generation target the website renders. Holds the
Glance, the four voices, the six moving lines (nested in the I-Ching voice),
Relations, the correlation layer, per-layer `essence` anchors, and internal
status. Shared reference files (rings, channels, centers, trigrams, immortals)
generated once and referenced by slug.

### Step 4 — Resolve the synthesis-JSON question
The existing `synthesis/*.json` becomes consultable reference only — not
source, not edited further. Archive `cards/`, `ul-cards/`; archive
`oracle_cards_complete.json` after Step 8.

### Step 5 — Settle the correlation-layer mappings
The trigram↔Immortal and ring↔Tarot correspondences. `tarot-codon-rings-mapping`
and `trigram-tarot-mapping` already exist in the vault — review and confirm
(the ring↔Tarot assignment is authored, not doctrine; CONCEPT §10). Also
resolve the GK 12 ring conflict (Part VI).

### Step 6 — Synthesize ONE card, end to end (the prototype)
Pick one hexagram. Write its full `## Synthesis` in the vault — all voices, the
Relations, the correlation layer — to the guide standard. Generate its card JSON.
See it whole on the site. Proves the synthesis process, schema, generator, and
guides together. *Do not skip. Do not scale before this card is right.*

### Step 7 — Stream A at scale: synthesize the complete system
Two-phase (`00` §1): Phase 1 scaffold all 64 hexagram syntheses **and all 384
moving-line syntheses** in the vault to the guides — a complete, working deck
Adrian can begin to study and train on; Phase 2 Adrian's per-card art pass.
The lines are core, synthesized as part of the system, not deferred. Status
`scaffold` → `in-progress` → `final`, internal only. This step needs its own
production plan — see Part VIII.

### Step 8 — Stream B: generate and rewire
Build the generator (vault synthesis → card JSON). Generate all 64. Rewire
`oracleData.ts`. Retire `oracle_cards_complete.json`. The site renders the
real work.

### Step 9 — Stream D: UI to the voice-led model
Adjust the card renderer per `CONCEPT.md` §4: shared Glance, each voice opening
fully, Relations as a real voice, the correlation layer as optional depth. An
adjustment of a sound UI, not a rebuild.

### Step 10 — Stream C: the whole-system map
Design and build the map — all 64, all three kinships, the correlation layer,
seen at once (`CONCEPT.md` §7).

### Step 11 — Lineage page, polish, pre-launch
Rework `OracleSystems.tsx`. Full review against `CONCEPT.md` and the guides.
Human Design rights check (`CONCEPT.md` §10). Confirm all statuses `final`.

---

## PART V — DEPENDENCIES

- Step 3 (schema) blocks Steps 6, 8 — the generation target must exist.
- Step 5 (correlation mappings) blocks the correlation synthesis in Steps 6–7.
- Step 6 (prototype) blocks Step 7 — never scale an unproven process.
- Step 7 (synthesis) blocks Step 8 — the generator needs finished vault input.
- Step 8 (generate/rewire) blocks Steps 9–10 — UI and map render real data.

---

## PART VI — OPEN DECISIONS & FLAGS

### Open decisions

- **Tarot depth on the card.** Major Arcana sits at the ring level. The vault
  also has minor/court correspondences. How much Tarot reaches the card vs.
  lives in the correlation layer? Decide with Step 5.
- **The path.** The optional deliberate learning sequence (`CONCEPT.md` §10).
  Can come late.

### Flags to resolve

- **Huang OCR.** The `huang-NN` translation files have minor OCR garble in
  places (scan artifacts). Usable, but worth a cleanup pass before they feed
  final synthesis.

### Resolved

- **The six moving lines.** Decided 2026-05-17 — the lines *are* part of the
  deck, as core, not an extra. The I-Ching is the Book of Changes; the moving
  line is change, and it names the transition to the next hexagram. The lines
  are an **optional deeper layer nested inside the I-Ching voice** (CONCEPT §4,
  §6), and a sixth kind of card-to-card connection. The schema holds six line
  entries per hexagram (see `SCHEMA.md` §4). All 64 hexagrams **and** all 384
  lines are treated as one complete system — the lines are synthesized as part
  of the deck, not deferred as a lesser phase. The prototype card (Step 6)
  includes its six lines so the nested-line layer is proven whole.

- **GK 12 ring conflict.** Verified 2026-05-17 against genekeys.com — *not a
  conflict.* The Ring of Trials is the three terminator/"stop" codons (Gene
  Keys 12, 33, 56). The Ring of Secrets is a *ring within a ring* — GK 12
  alone, nested inside the Ring of Trials, titled "A Pure Heart." GK 12
  legitimately belongs to both; this is intentional Gene Keys structure. Both
  ring files now carry an accurate note. (The verification script's
  one-ring-per-key assumption was the only thing wrong.)

- **Astrology / Kabbalah / Golden Dawn.** Audited 2026-05-17. The Tarot
  correspondence files carry zodiac/planet/element, Hebrew letter, and Golden
  Dawn attribution — but these are *attributes of the Tarot*, not a separate
  fifth system. They are the Golden Dawn correspondence *depth of the Tarot
  voice*, folded into the correlation layer (`CONCEPT.md` §8). No separate
  astrology layer. Source is one document — verify in Step 5.

---

## PART VII — STATUS SNAPSHOT

| Item | State |
|---|---|
| `CONCEPT.md` | Written, corrected, extended ✓ |
| Guides `00`–`06` | All written and closed ✓ |
| Vault Phase-1 extraction | Complete, all systems ✓ |
| HD centers + gate→center mapping | Done ✓ |
| Vault reorganized + fully indexed | Done ✓ |
| Vault content-quality audit | Done — corpus strong ✓ |
| Vault wikilinks | 379 fixed; zero broken ✓ |
| Doctrine data verified | Done — GK 12 verified, no conflict ✓ |
| Canonical card-data schema (`SCHEMA.md`) | Done ✓ |
| Moving-lines decision | Resolved — lines are core (Part VI) ✓ |
| Synthesis-JSON resolved / old data archived | Not done — Step 4 |
| Correlation-layer mappings settled | Not done — Step 5 |
| Prototype card | Not built — Step 6 |
| 64 syntheses + 384 line syntheses | Not started — Step 7 (needs Part VIII plan) |
| Generator (vault → JSON) + site rewired | Not done — Step 8 |
| UI voice-led adjustment | Not done — Step 9 |
| Whole-system map | Not designed — Step 10 |
| Lineage page / HD rights check | Not done — Step 11 |

**Immediate next action: Step 4 — resolve the synthesis-JSON question and
archive the superseded data sources. Then Step 5 (correlation mappings), then
Step 6 (the prototype card).** Step 7 — the full synthesis of 64 hexagrams +
384 lines — needs its own production plan (Part VIII, to be written).
