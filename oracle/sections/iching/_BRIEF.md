# ICHING section — generation brief

You are writing the **ICHING section** for one card of the Universal Language
Oracle, a 64-card deck. ICHING is the I-Ching voice: the hexagram's situation
and its natural image, the trigram pair, the Judgement and Image freshly
rendered, and the six moving lines. This brief is the locked standard. UL 1
worked samples in `oracle/WRITING_METHOD.md` §3 ICHING are the level to hit.

## Your task

For the assigned hexagram number, read the vault's I-Ching source for that
hexagram, then write the ICHING section and save it as JSON.

**Source to read** (in `~/Documents/Obsidian Vault/oracle/hexagrams/NN/`):
- `_hexagram-NN.md` — the master index with the hexagram name, trigrams, and
  cross-source pointers.
- `legge-NN-<slug>.md` — Legge translation.
- `wilhelm-NN-NN-<slug>.md` — Wilhelm translation (the most discursive).
- `huang-NN-<slug>.md` — Huang translation.
- `deng-NN-<slug>.md` — Deng translation.
- `cleary-taoist-NN-<slug>.md` and `cleary-buddhist-NN-<slug>.md` — the two
  Cleary translations.
- `practical-NN-<slug>.md` — Eranos / practical reading.
- `oracle-NN-<slug>.md` — Rudd's *64 Ways* oracle voice.
- `line-NN-1.md` through `line-NN-6.md` — the six moving lines, one file each.

Read the master index first. Skim all six translations to triangulate the
hexagram's life-situation. Then read the six line files for the moving lines.

For trigram material, also read (when needed):
- `~/Documents/Obsidian Vault/oracle/systems/trigrams/` — the eight trigrams
  as standalone files.

**Output:** write `oracle/sections/iching/NN.json` (zero-padded).

## The voice (locked, non-negotiable)

- **Intimate teacher.** Warm, direct, speaks to a reader. Same voice as the
  KEYS and RELATIONS sections.
- **NO EM DASHES. NO EN DASHES.** Anywhere in any prose field. Commas,
  periods, line breaks. This is absolute.
- **Teach the situation, not the system.** This section does not explain what
  the I-Ching is, what a hexagram is, or what a trigram is. Those live in the
  click-glossary (a UI feature, not your concern). Open every field on the
  teaching of *this* code.
- **The image is the teaching.** The I-Ching teaches through natural image
  (heaven, earth, water, fire, wind, thunder, mountain, lake). Carry the
  image. Do not paraphrase the situation; show the image and let it carry the
  meaning.
- **Never reproduce a translator's prose.** The six translations are source
  triangulation. The Judgement and Image are freshly rendered in your own
  words. The combination, reading, and moving-line readings are entirely
  yours. The hexagram name and trigram names are the kept lineage; everything
  else is original.

## The four "reads-as-human" cuts (audit every paragraph)

1. **No symmetry.** No balanced pairs, no "not just X but Y", no tidy triads.
   Lopsided paragraphs on purpose.
2. **No summary sentence.** Never the line that announces what the paragraph
   meant.
3. **Plain vocabulary.** Avoid "profound", "journey", "embrace", "navigate",
   "essence", "transformative". Plain words.
4. **End a beat early.** No neat bow. Stop slightly before the reader expects.

Keep deliberate unevenness: fragments, blunt short sentences, a clumsy
tack-on left clumsy.

## Internal vs outward relating

This section is the I-Ching voice. The six moving lines are **internal
relating** and belong here. Each moving line names the hexagram it becomes
when it moves (e.g. "Hexagram 44, Coming to Meet"). That naming is internal
to ICHING. Do not pull in:

- The paired hexagram (the inverse / opposite). That is RELATIONS.
- The codon ring, Tarot, Immortals, Hebrew letter. RELATIONS.
- The Gene Keys Shadow/Gift/Siddhi names or content. KEYS.
- The Human Design gate/centre/channel names or content. DESIGN.

Stay in the I-Ching's own teaching.

## Structure and length

**Fields and word counts (hard ceilings):**

- `hexagram_name` — the hexagram's name (e.g. "The Creative", "The
  Receptive"). 1-4 words.
- `combination` — what the two trigrams make *together*. The situation of the
  whole hexagram, seen through the image of one over the other. The trigram
  selector's default view. **60-90 words, hard ceiling 100.**
- `upper_nature` — the upper trigram's own nature, briefly. May reuse shared
  trigram phrasing (the eight trigrams recur across the 64). **30-50 words,
  hard ceiling 55.**
- `lower_nature` — the lower trigram's own nature, briefly. Same. **30-50
  words, hard ceiling 55.**
- `reading` — the main I-Ching teaching: the life-situation this code names
  and how the natural image unlocks it. The section's centre of gravity.
  **200-300 words, hard ceiling 320.**
- `judgement_lines` — the Judgement, freshly rendered. An array of short
  lines, original wording, never a translator's prose. **2-5 lines, each
  short.**
- `image_lines` — the Image, freshly rendered. An array of short lines.
  **2-4 lines, each short.**
- `lines` — six entries, one per moving line. Each entry: the line's image,
  what it counsels, and the hexagram it transforms into when it moves. Each
  entry **50-70 words, hard ceiling 80.**

Per moving line, the shape:
```json
{
  "line": 1,
  "image": "<a short phrase, the line's natural image>",
  "reading": "<the counsel, 40-60 words>",
  "becomes": { "hexagram": NN, "name": "<the hexagram it becomes>" }
}
```

**The `becomes` field:** when line N is the moving line, the hexagram changes
to a new hexagram. The vault's line files name the becoming hexagram. Use
that. Get the number and the canonical name right (a quick check against
`~/Documents/Obsidian Vault/oracle/hexagrams/NN-target/_hexagram-NN-target.md`
confirms the name).

## Output JSON shape

```json
{
  "number": NN,
  "section": "iching",
  "status": "scaffold",
  "hexagram_name": "<from vault>",
  "combination": "<60-90 words>",
  "upper_nature": "<30-50 words>",
  "lower_nature": "<30-50 words>",
  "reading": "<200-300 words>",
  "judgement_lines": [ "<line>", "<line>", "<line>" ],
  "image_lines": [ "<line>", "<line>" ],
  "lines": [
    { "line": 1, "image": "<short>", "reading": "<40-60 words>",
      "becomes": { "hexagram": NN, "name": "<canonical>" } },
    { "line": 2, ... },
    { "line": 3, ... },
    { "line": 4, ... },
    { "line": 5, ... },
    { "line": 6, ... }
  ],
  "meta": { "source": "vault hexagrams/NN", "generated": "iching-brief-v1" }
}
```

Plain strings. No markdown markers. No em dashes. Multi-paragraph fields use
`\n\n` between paragraphs.

## The reference — UL 1 (Hexagram 1), the locked standard

These are the UL 1 samples from `WRITING_METHOD.md` §3. Match this level.

**hexagram_name:**
> "The Creative"

**combination:**
> Heaven sits over Heaven, the same force doubled, with no earth beneath it
> to receive it and no water to cool it. This is the one hexagram made
> entirely of unbroken lines, and it is first because it is pure beginning:
> the charged moment before the first move, when the energy is wholly active
> and wholly originating, and nothing has yet taken form.

**reading:**
> The situation this code names is the moment before. Before the first word,
> before the first move, when there is only the force that will make the
> thing and not yet the thing. It is a situation of immense available power
> and no finished shape, and that is exactly its difficulty. A force this
> strong, left unchecked, burns through its own creations before they have
> had time to set.
>
> The picture the hexagram gives is the dragon, and the dragon is shown
> moving through six positions, from hidden in the deep to flying in the
> heights to risen one step too far. That arc is the teaching. Originating
> power is not a thing you hold; it is a motion you are briefly inside of.
> The counsel is not to make more, push harder, create faster. It is to
> become strong and untiring, the way the motion of heaven is untiring: it
> never strains, and it never stops. You ride the force. You do not mistake
> yourself for it.

**judgement_lines:**
> - The Creative originates, and reaches through everything.
> - It serves what is true, and holds.
> - Kept steady, it carries the deepest fortune.

**image_lines:**
> - Heaven moves, and does not stop.
> - So the one who would grow makes the self strong, and does not tire.

**lines[0] (line 1):**
> image: the dragon still hidden under the water.
> reading: The power is real, but the season has not come. This is not
> failure; it is the deep, the kindling before the spark. Build strength
> where no one is watching, and do not move yet.
> becomes: Hexagram 44, Coming to Meet. The hidden thing makes its first
> contact with the world.

## Before you finish

1. Re-read every prose field. Find and remove every em dash and en dash.
2. Run the four cuts.
3. Confirm the moving-line `becomes` numbers and names are correct (verify
   against the vault's target hexagram master index).
4. Confirm no system-from-another-section content leaked in (no Tarot, no
   Gene Keys names, no HD jargon, no codon ring).
5. Write the JSON file. Report the card number, the hexagram name, word
   counts for `combination` / `reading` / each `lines[i].reading`, and
   confirm "no em dashes".
