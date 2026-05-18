# Universal Language Oracle — Canonical Card Schema

The data structure the website renders. Every card is **generated** into this
shape from its finished vault synthesis (PROJECT_PLAN Step 8). Writing happens
in the vault; this is the compiled target.

Read `CONCEPT.md` first. This schema is the structural expression of the
concept — the Glance, the four voices, the moving lines, Relations, the
correlation layer, all per CONCEPT §3–9.

**Format:** one JSON file per card, `cards/NN.json` (NN = 01–64). The 64 files
plus shared reference files (rings, channels, centers, trigrams, immortals)
are the complete data set.

---

## 1. Design principles the schema obeys

- **Every layer is a complete, finishable unit** (CONCEPT §6). Each voice, each
  line, Relations — each is its own bounded object with its own content.
- **Layers nest** (CONCEPT §6). The structure is hierarchical: lines nest
  inside the I-Ching voice; the correlation layer nests inside Relations.
- **Each layer carries its own one-line anchor** — the context line shown when
  the reader descends past it (CONCEPT §6, recursive anchoring). On the
  `glance` block this field is `anchor_line` (to distinguish it from the
  Glance's multi-paragraph `reading`); on each voice it is `essence`.
- **No voice is a compression of another** (CONCEPT §3). Each voice field
  holds that voice's full teaching; there is no shared "summary" field that
  voices echo.
- **Status is internal** (`00` §10). Every card and every voice carries a
  `status` field; it never renders to the reader.
- **The schema is the complete system.** All 64 hexagrams and all 384 moving
  lines are first-class — the lines are not an optional extra appended later.

---

## 2. Top-level card object

```jsonc
{
  "number": 1,                     // 1–64
  "status": "scaffold",            // scaffold | in-progress | final (internal)

  "glance":        { ... },        // §3 — the threshold
  "iching":        { ... },        // §4 — the I-Ching voice (contains lines)
  "gene_keys":     { ... },        // §5 — the Gene Keys voice
  "human_design":  { ... },        // §6 — the Human Design voice
  "relations":           { ... },        // §7 — Relations (connections + correlation)

  "structure":     { ... },        // §8 — structural facts (non-prose)
  "meta":          { ... }         // §9 — provenance, not reader-facing
}
```

Each of the five content blocks (`glance`, `iching`, `gene_keys`,
`human_design`, `relations`) is a **layer** in the CONCEPT §6 sense — complete,
finishable, carrying its own `essence`.

---

## 3. `glance` — the threshold

The shared, system-agnostic layer. A complete reading on its own (CONCEPT §4).

```jsonc
"glance": {
  "card_name":   "Earth's Breath",       // the poetic title (guide 00 §9)
  "anchor_line": "...",                  // ONE line — the code in a breath.
                                         // the recursive anchor (CONCEPT §6)
  "keywords":    ["...", "...", "..."],  // 5–7, plain, all-systems (guide 05)
  "reading":     "...",                  // THE BRIEF SYNTHESIS READING —
                                         // multi-paragraph; the heart of the
                                         // Glance; a real reading of the code,
                                         // all systems woven, none named.
  "invocation":  null,                   // OPTIONAL — a spoken passage placed
                                         // below the reading. null until one
                                         // exists; fills in over time. A card
                                         // is complete without it (CONCEPT §4).
  "image":       { "id": "...", "alt": "..." }
}
```

Two distinct fields, not to be confused:

- **`reading`** — the brief synthesis reading. Multi-paragraph. The *content*
  of the Glance, the front-of-card reading a seeker actually receives. Always
  present.
- **`anchor_line`** — a single line, the code in one breath. Not shown as
  Glance content; it is the *recursive anchor* (CONCEPT §6) — the quiet
  context line pinned at the top of any voice the reader opens.
- **`invocation`** — optional. `null` on a card that does not yet have one;
  the deck does not have invocations for all 64 at first, and a card without
  one is whole. When present, it renders below `reading`.

---

## 4. `iching` — the I-Ching voice

The ancient situation, in three layers (guide `03`), plus the six moving
lines nested within.

```jsonc
"iching": {
  "status":  "scaffold",
  "essence": "...",                  // ONE line — anchors the lines below

  "intro":          "...",           // layer 1 — the life-situation (plain)
  "classic": {                       // layer 2 — the rendered classic text
    "judgment": "...",               //   the Judgment (freshly rendered, 04)
    "image":    "..."                //   the Image
  },
  "interpretation": "...",           // layer 3 — unlocks the natural image

  "hexagram_name":    "The Creative",
  "chinese_name":     "Qian",
  "trigrams": {
    "upper": { "name": "Heaven", "glyph": "☰" },
    "lower": { "name": "Heaven", "glyph": "☰" }
  },

  "lines": [                         // the six moving lines — nested layer
    {
      "line":            1,          // 1–6 (bottom to top)
      "status":          "scaffold",
      "line_type":       "yang",     // yang | yin
      "reading":         "...",      // synthesized line teaching
      "essence":         "...",      // ONE line — this line in a breath
      "transition_to":   44,         // the hexagram this line changes into
      "transition_note": "..."       // what the change means — the movement
    }
    // ... lines 2–6
  ]
}
```

The `lines` array is the nested optional layer (CONCEPT §4). Each line is a
complete unit with its own `essence` and a `transition_to` — the sixth kind
of card-to-card link (CONCEPT §7). `transition_to` values come from the
vault's `line_change_targets`.

---

## 5. `gene_keys` — the Gene Keys voice

The Shadow → Gift → Siddhi journey, taught in full (guide `01`).

```jsonc
"gene_keys": {
  "status":  "scaffold",
  "essence": "...",                  // ONE line — anchors anything below

  "opening_line": "...",             // the threshold line (guide 01 §2)
  "shadow": {
    "name":      "Entropy",
    "paragraph": "...",              // the Shadow teaching
    "repressed": "...",              // the repressed pole (one clause/line)
    "reactive":  "..."               // the reactive pole
  },
  "gift": {
    "name":      "Freshness",
    "paragraph": "..."
  },
  "siddhi": {
    "name":      "Beauty",
    "paragraph": "..."
  }
}
```

The Shadow/Gift/Siddhi *names* are kept (CONCEPT §10, copyright); the prose is
the deck's own (guide `01`).

---

## 6. `human_design` — the Human Design voice

The body the code sits in, and its bonds (CONCEPT §4).

```jsonc
"human_design": {
  "status":  "scaffold",
  "essence": "...",                  // ONE line

  "gate":    { "number": 1, "teaching": "..." },
  "center":  {
    "name":     "Identity Center (G Center)",
    "slug":     "identity",
    "teaching": "..."                // the body-seat of the code
  },
  "channels": [                      // the code's channel bonds
    {
      "channel":      "1-8",
      "name":         "Channel of Inspiration",
      "partner_gate": 8,
      "teaching":     "..."          // what the two codes form together
    }
    // a gate may sit on more than one channel
  ]
}
```

Channels are also Relations connections — `relations.kinships` references them (§7).

---

## 7. `relations` — connections and the correlation layer

How the code touches the other 63, and the deeper correlations (guide `06`).

```jsonc
"relations": {
  "status":  "scaffold",
  "essence": "...",                  // ONE line

  "kinships": {
    "programming_partner": {
      "card":     2,
      "teaching": "..."              // the polarity, in plain relationship terms
    },
    "channels": [                    // mirrors human_design.channels, as kinship
      { "card": 8, "channel": "1-8", "name": "Channel of Inspiration",
        "teaching": "..." }
    ],
    "codon_ring": {
      "name":     "Codon Ring of Fire",
      "siblings": [14],              // other cards in the ring
      "teaching": "...",             // the family theme
      "tarot": {                     // the ring's Arcana (CONCEPT §7, guide 06 §5)
        "arcana":    "Temperance",
        "resonance": "..."           // one quiet image, not explained
      }
    }
  },

  "correlation": {                   // the deeper layer — nested, optional (06 §7)
    "status": "scaffold",
    "trigrams": {                    // the code's two component forces
      "upper": { "name": "Heaven", "teaching": "..." },
      "lower": { "name": "Heaven", "teaching": "..." }
    },
    "eight_immortals": {             // trigram-correlated immortal(s)
      "immortal":  "...",
      "resonance": "..."
    },
    "tarot_golden_dawn": {           // the Tarot's Golden Dawn depth (06 §7.3)
      "zodiac":            "Sagittarius",
      "hebrew_letter":     "Samech",
      "golden_dawn_note":  "..."
    }
  }
}
```

The `correlation` block is a layer nested inside Relations (CONCEPT §8) — a door
within a door. The lines also belong to Relations but live under
`iching` because the reader meets them while studying the hexagram.

---

## 8. `structure` — structural facts (non-prose)

Verified doctrine data. Drives navigation, the map, and relationships. Not
reader-facing prose; the UI may surface pieces of it.

```jsonc
"structure": {
  "king_wen_binary":   "111111",
  "inverse_hexagram":  1,
  "opposite_hexagram": 2,
  "nuclear_hexagram":  1,
  "codon_ring":        "Codon Ring of Fire",
  "amino_acid":        "Lysine",
  "hd_center":         "identity",
  "hd_gate":           1
}
```

All values are carried from the verified vault `_hexagram-NN.md` frontmatter.

---

## 9. `meta` — provenance (never reader-facing)

```jsonc
"meta": {
  "generated_from": "vault: hexagrams/01/_hexagram-01.md",
  "generated_at":   "2026-...",
  "schema_version": "1.0"
}
```

---

## 10. Shared reference files

Not every fact is duplicated into 64 card files. Shared objects are generated
once, from the vault, and referenced by slug:

- `reference/codon-rings.json` — the 22 rings, members, amino acids, Arcana.
- `reference/channels.json` — the 36 channels.
- `reference/centers.json` — the 9 centers (full teachings).
- `reference/trigrams.json` — the 8 trigrams.
- `reference/eight-immortals.json` — the 8 immortals.

A card references these (e.g. `human_design.center.slug` → `centers.json`)
rather than embedding the full teaching. This keeps card files focused and
the shared teachings single-sourced.

---

## 11. Status and the two phases

Every `status` field (card-level and per-voice) is one of: `scaffold`,
`in-progress`, `final` (`00` §10). It is **internal** — the generator never
emits it to a reader-facing surface. It exists so Phase 1 scaffold and Phase 2
finished work are never confused, and so progress across 64 cards × 6 voices ×
6 lines is trackable.

---

## 12. What is complete

A card is structurally complete when every block is present and every `status`
is `final`:
- `glance` — name, anchor_line, 5–7 keywords, the brief synthesis `reading`,
  image. `invocation` is **optional** — its absence does not make a card
  incomplete; it fills in over time.
- `iching` — intro, classic (judgment + image), interpretation, all six lines.
- `gene_keys` — opening line, shadow (+ repressed/reactive), gift, siddhi.
- `human_design` — gate, center, channel(s).
- `relations` — programming partner, channels, codon ring (+ Arcana), correlation.
- `structure` and `meta` — carried from the verified vault data.

All 64 cards and all 384 lines at `final` is the deck.
