# Concept ↔ Live Card — Reconciliation

Written after reading the full `UniversalLanguageCard.tsx` (every panel,
`CoinCast`, `PlateExpand`). The purpose: bring `CONCEPT.md` and the **card
Adrian already built** into harmony — card first, concept bends to it where
the card is right. (Per Adrian's instruction; CONCEPT changes only after
trying to reconcile.)

The editing happens on a **template copy**:
`components/UniversalLanguageCardTemplate.tsx`, route `/oracle/template/:number`.
The live card is untouched.

---

## 1. The honest finding

**The live card already embodies most of the concept.** Earlier plan drafts
treated it as a rough draft to redesign. It is not — it is a working,
thought-through instrument. The concept was, in places, written *ahead of*
and *in different words than* what was already built. Where they seem to
disagree, it is usually vocabulary, not substance.

The biggest single correction: **the panel currently named "Tarot" is, in
substance, the concept's "Relations."** It already holds the Paired Hexagram, the
Programming Partner, and the **Codon Ring rendered as a navigable grid of
sibling cards** — the concept's "deck as a living field," already built. It is
simply *named* Tarot because the Tarot resonance also lives there.

---

## 2. The live card — what is actually there

Five panels in the reading stage, each a museum-plate section:

| Panel | Contents (verified in code) |
|---|---|
| **FIELD / Glance** | Art · acquire-share strip · title block (name + keyword row) · `EssenceBlock` (the brief synthesis reading) · optional "from the creator" panel |
| **I Ching** | Hexagram/Upper/Lower selector with a live reading zone · **`CoinCast`** (the changing-oracle ritual) · "The reading" · "Classical text" (Judgement + Image) |
| **Gene Keys** | Three tone plates — Shadow / Gift / Siddhi — Repressive/Reactive nested in Shadow, Programming Partner nested in Gift |
| **Human Design** | The Gate · The Channel · The Circuit · the codon-ring↔Tarot plate |
| **Tarot** *(= Relations)* | Paired Hexagram · Programming Partner · **Codon Ring sibling grid** · Tarot resonance |
| **Body** | Physiology · Amino Acid |

It has two data paths: a `synthesis` path and an `expanded` fallback. It has a
sliding contextual header and a `ChapterWordmark` for navigation. The
`SystemOverlay` (opened from each panel's glyph) is the "about the systems"
teaching layer.

---

## 3. Concept ↔ card — point by point

### Already in harmony ✓

- **Voice-led, glance above.** The FIELD is the Glance; the five panels are
  the voices. Built. (CONCEPT §4)
- **The brief synthesis reading.** `EssenceBlock` on the FIELD. Built. (§4)
- **Optional fields.** "From the creator" is already a conditional field —
  the exact pattern the optional invocation needs. Built. (§4)
- **The moving lines as a *reading*, not a label.** `CoinCast` — the reader
  casts coins, lines brighten and flip, the becoming-hexagram resolves. The
  concept's "change" *is already a performed ritual.* This is better than
  what the concept described. (§4, the moving lines)
- **The over/under teaching.** The Hexagram/Upper/Lower selector teaches what
  each trigram *is*, on tap. Built.
- **The three kinships.** Paired hexagram, programming partner, codon-ring
  grid — all in the "Tarot" panel. Built. (§7, Relations)
- **The classical text set apart.** "Classical text" plate, Judgement + Image.
  Built. (guide `03`)
- **System overlays = the "about the systems" layer.** Built. (§9)

### Genuinely just mis-ordered / mis-named

1. **"Tarot" panel should be named, and understood as, Relations.** Its
   substance is the connection layer. The Tarot resonance is one element
   *within* it — exactly as CONCEPT §7/guide `06` say (Tarot rides at the ring
   level inside Relations). *Fix: rename the panel "Relations" (or similar); the
   Tarot resonance stays inside it.*
2. **"Body" — its own panel, or folded into Human Design?** The concept folds
   the HD center into the Human Design voice. The card has Body (physiology +
   amino acid) as its own panel. Body is *adjacent* to Human Design but is its
   own content (the physical/codon layer). **Open question for the template —
   try both: Body as a section at the end of the Human Design panel, vs. its
   own panel. Decide by feel on the live template.**
3. **Five panels vs. four voices.** With "Tarot"→"Relations", the panels are:
   I Ching · Gene Keys · Human Design · Relations — *plus* Body. That is the four
   voices of the concept, plus Body. So the concept's "four voices" is right
   for the four *systems*; Body is a fifth thing, and the concept should
   simply name it (a short physical-layer panel or a Human Design section).
   *Not a merge of stubs — a naming and a placement.*
4. **The recursive anchor.** The concept wants each opened voice to show the
   card's one-line anchor. The card has the contextual header (carrying the
   card *name*). Close, but the one-line essence anchor is not yet there.
   *Minor addition on the template.*

### Where the concept may need to bend (later, not now)

- The concept's "four voices" language is slightly too clean — the real card
  has four system voices **plus Body**. CONCEPT §4 should acknowledge Body as
  a real, small fifth panel (the physical/codon layer), not pretend it folds
  away. Decide on the template first, then correct CONCEPT.
- The schema (`SCHEMA.md`) put Body inside `human_design`. If Body stays its
  own panel, the schema gets a small `body` block. Decide with the template.

---

## 4. What to actually do on the template

Small, ordered changes — not a redesign:

1. **Rename "Tarot" panel → "Relations".** Keep all its content; the Tarot
   resonance stays as one element inside it.
2. **Decide Body's home** — own panel vs. tail of Human Design. Try it live.
3. **Glance order** — confirm the synthesis reading leads; the invocation,
   when it exists, sits below it as an optional block (like "from the
   creator").
4. **Add the one-line anchor** to each opened panel (small).
5. **The moving lines** — `CoinCast` already does the work. Confirm nothing is
   needed beyond what is built; possibly surface the cast line *readings* more
   fully (the line text exists via `getLineText`).

Everything else the card already does. The reconciliation is naming, ordering,
and two small additions — not a rebuild.

---

## 5. Then — fold back

When the template is right and Adrian approves it, the changes fold back into
`UniversalLanguageCard.tsx`, and `CONCEPT.md` / `SCHEMA.md` are corrected to
match what the template proved. Card and concept, brought into harmony.
