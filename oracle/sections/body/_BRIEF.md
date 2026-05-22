# BODY section — generation brief

You are writing the **BODY section** for one card of the Universal Language
Oracle, a 64-card deck. BODY is the biological layer: the codon, the codon
ring as living chemistry, where the code is seated in the physical body.
This is the deepest *inward* point of the card. It is written as a layer of
the oracle, spoken poetically, **never as a biology explainer.** UL 1 worked
samples in `oracle/WRITING_METHOD.md` §5 are the level to hit.

## Your task

For the assigned hexagram number, read the vault's body and codon-ring source
material for that hexagram, then write the BODY section and save it as JSON.

**Source to read** (in `~/Documents/Obsidian Vault/oracle/`):
- `hexagrams/NN/_hexagram-NN.md` — frontmatter carries `amino_acid` and
  `codon_ring`.
- `gene-keys/codon-rings/<ring-slug>.md` — the codon ring file. Lists the
  amino acid and the ring's member hexagrams.
- `hexagrams/NN/gene-key-NN-<slug>.md` and `gk-64ways-NN-<slug>.md` — Rudd's
  Gene Keys texts. These sometimes carry physiology references (organ system,
  body location, gland) for the gate.
- `hexagrams/NN/practical-NN-<slug>.md` — practical reading, occasionally
  carries body image.
- The KEYS section already written for this card (`oracle/sections/keys/NN.json`)
  — read it so the body imagery sits coherently with the Shadow/Gift/Siddhi
  voice you already established.

Read enough to know two things:
1. **Where in the body** this code is seated (organ, organ system, gland,
   region). Use what the vault carries. If the vault is thin, work from the
   Gene Keys' usual mapping (gates map to specific physiology via Rudd's
   correspondence) — the codon ring file is usually enough to anchor it.
2. **What the amino acid is** (already in the hexagram frontmatter), and
   what its role in the body's chemistry is. You do not need to teach the
   biochemistry; you need a true, short factual anchor about the amino acid,
   so the prose can rest on something real.

**Output:** write `oracle/sections/body/NN.json` (zero-padded).

## The voice (locked, non-negotiable)

- **Intimate teacher.** Same voice as KEYS, ICHING, RELATIONS.
- **Poetic, never a biology lesson.** This is the part of the card that
  treats the body as the literal floor the other four systems were always
  describing. Speak the organ, name the amino acid, but the register is
  oracular and grounded, not pedagogical. The reader should feel their own
  body in the prose, not be lectured to.
- **NO EM DASHES. NO EN DASHES.** Anywhere. Absolute.
- **Open on the body, not on the system.** First sentence is already about
  this code's bodily seat. No "the body is..." preamble. No "the Gene Keys
  map each code to..." preamble.
- **Land the inward journey.** This is the last *inward* section before
  Relations turns the reader outward. The writing should feel like arrival
  at the floor of the card. Quiet. Solid.
- **Carry the same shadow/gift movement that KEYS established, but in the
  body.** When KEYS spoke of numbness, BODY speaks of the bodily floor of
  that numbness, and the bodily climbing-out. The body is the same
  teaching, one level deeper.

## The four "reads-as-human" cuts (audit every paragraph)

1. **No symmetry.** No balanced pairs, no tidy triads.
2. **No summary sentence.** Never the line announcing what the paragraph
   meant.
3. **Plain vocabulary.** Avoid "profound", "journey", "embrace", "navigate",
   "essence", "transformative". Plain words.
4. **End a beat early.** No neat bow.

## Internal vs outward relating

BODY is inward. The codon ring's *siblings* (the other hexagrams sharing the
same ring/amino acid) are outward kin and belong in RELATIONS, not here.
This section establishes the **chemical seat** of this code. The naming of
the kin that share it belongs to the next section. Tarot, Immortals, Hebrew
letter, paired hexagram — all RELATIONS.

What you *can* name here:
- The organ / organ system / body region (e.g. liver, lungs, lymphatic
  system).
- The codon ring's name (e.g. Ring of Fire) once, if it earns its place —
  but RELATIONS will name it again, so don't lean on it.
- The amino acid (e.g. Lysine, Tryptophan).
- The Gene Keys' frequency names (Shadow / Gift / Siddhi) from the KEYS
  section — but only if the bodily teaching naturally calls them by name.

What you can*not* name here:
- Other hexagrams in the same ring.
- The hexagram's pair, the Tarot, the Immortals, the Hebrew letter.
- The trigrams (unless the trigram is structurally relevant to the bodily
  seat, e.g. the Lake trigram and the mouth).
- HD gate/centre/channel/circuit (those are DESIGN's vocabulary).

## Structure and length

**Two fields. Hold the word counts.**

- `physiology` — where the code is seated in the physical body. The organ
  or system, written as a felt, poetic truth. The shadow-side has a bodily
  floor; the gift-side has a bodily climb. Carry both. **150-250 words,
  hard ceiling 260.**
- `amino_acid` — the amino acid the code answers to, and what it means
  that the code runs this deep into the body's chemistry. One true fact
  about the amino acid is enough to ground the poetry. **120-200 words,
  hard ceiling 210.**

If a field runs long, cut. Tight writing.

## Output JSON shape

```json
{
  "number": NN,
  "section": "body",
  "status": "scaffold",
  "physiology": "<~150-250 words>",
  "amino_acid": "<~120-200 words>",
  "meta": {
    "source": "vault hexagrams/NN + codon-rings",
    "generated": "body-brief-v1",
    "organ": "<short label for UI metadata>",
    "amino_acid_name": "<e.g. Lysine>",
    "codon_ring": "<e.g. Ring of Fire>"
  }
}
```

Plain strings. No markdown markers. No em dashes. Multi-paragraph uses
`\n\n`.

## The reference — UL 1 (Hexagram 1), the locked standard

From `WRITING_METHOD.md` §5. Match this level.

**physiology:**
> The traditions place this code's seat in the liver, the body's quiet engine
> of renewal, the organ that takes what is spent and remakes it into what can
> be used again. It is fitting. This is the code of originating force, and
> the liver is where the body, out of sight and without being asked, performs
> its own daily act of creation: breaking down, rebuilding, beginning again.
> The numbness of the shadow has a bodily floor here too. When vitality
> leaks, when the days go flat, the body feels it as a kind of heaviness, a
> fire banked low. And the catching of the gift is also bodily, the return
> of appetite, of warmth, of the wish to move. The code is not only
> something you think or feel. It is metabolic. It runs in the part of you
> that renews itself while you sleep.

**amino_acid:**
> Deeper still, this code answers to a single amino acid, Lysine, one of the
> small set of letters the body cannot make for itself and must take in from
> the world. There is a teaching in that. The very first code, the origin of
> all the others, is built on an element that does not originate within. It
> has to be received. Even pure creative force is not self-made. It is
> carried in, taken from outside, and only then put to work. The code runs
> all the way down to this: a chemistry that must be fed before it can
> create.

## Before you finish

1. Re-read your text. Remove every em dash and en dash.
2. Run the four cuts.
3. Confirm: the writing does not lecture biology; it speaks the body as a
   layer of the oracle.
4. Confirm the organ / system claim is consistent with what the vault
   carries (or with the codon ring's Gene Keys correspondence).
5. Confirm no outward-relating content leaked in.
6. Write the JSON file. Report card number, organ, amino acid name, word
   counts for both fields, and confirm "no em dashes".
