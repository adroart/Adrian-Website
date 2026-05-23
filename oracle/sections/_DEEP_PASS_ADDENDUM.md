# Deep-pass addendum — ICHING + BODY

> Read after the section's own `_BRIEF.md`. This applies to the **deep-pass**
> rewrite only. The earlier scaffold pass treated the vault material as
> reference. The deep pass treats it as *source*. The scaffold pass was
> on-standard but tonally even and surface-anchored. The deep pass carries
> the philology, the historical and mythological figures, the per-line
> imagery, and the cosmology that the vault actually contains. The reading
> should *teach the I-Ching's own language*, not translate the situation
> into plain English.

---

## 1. The vault read (do this before writing)

For an ICHING card on hexagram NN, read in this order, all the way through:

1. `~/Documents/Obsidian Vault/oracle/hexagrams/NN/oracle-NN-<slug>.md` —
   the **Eranos**. This is the richest single file. It carries ideogram-by-
   ideogram philology of the Chinese: every word in the Judgement and the
   Image is broken into its component characters and root meanings. Read
   every "Fields of meaning" block. **This is the most important read.**
2. `wilhelm-NN-N-<slug>.md` — Wilhelm/Baynes. The most discursive English
   rendering. Quotable judgement/image, six line readings, "the superior man"
   commentary.
3. `huang-NN-<slug>.md`, `legge-NN-<slug>.md`, `deng-NN-<slug>.md`,
   `cleary-taoist-NN-<slug>.md`, `cleary-buddhist-NN-<slug>.md` — five more
   translations. Skim these for divergences: where do they disagree on a
   line image, on a piece of counsel, on a tone?
4. `practical-NN-<slug>.md` — the Practical Guide. Often carries the Chinese
   character for each line, the historical context (which dynasty, which
   custom), and the mythological figure connected to the hexagram (Houtu the
   earth goddess, Yu the Great, etc.). Read carefully.
5. `oracle-NN-<slug>.md` again — go back and re-read with the translations in
   mind. The Eranos's ideogram breakdowns now mean more.
6. The six `line-NN-1.md` through `line-NN-6.md` files. Each is a complete
   line-by-line reading with its own image and counsel.

For a BODY card on hexagram NN, read:

1. `hexagrams/NN/_hexagram-NN.md` — frontmatter has `amino_acid` and
   `codon_ring`.
2. `gene-keys/codon-rings/<ring-slug>.md` — the ring file.
3. `hexagrams/NN/gene-key-NN.md` — Rudd's **full 14-page Gene Keys chapter**.
   Read the whole thing. The physiology references, the body-location, the
   mythological framing of the shadow and gift, the cosmology — all here.
4. `gk-64ways-NN-<slug>.md` — Rudd's contemplative 64-Ways version. Often
   has a sharper image than the long Gene Key.
5. `practical-NN-<slug>.md` — sometimes carries the organ system or
   body-location for the hexagram.
6. The KEYS section for this card (`oracle/sections/keys/NN.json`) — read
   it so the body imagery sits coherent with the established
   Shadow/Gift/Siddhi voice.

**You may not skim. You read all of the above to completion. The whole point
of the deep pass is that the prose carries what is genuinely in the vault.**

---

## 2. What "deep" actually means in the prose

### 2.1 Carry the philology *inside* the teaching

The Chinese ideograms in the Eranos file contain the actual ancient image.
**Use them.** But carry them inside the teaching, never as a frame around
it.

GOOD:
> Not just a stone. A soapnut tree, the post that stands at a grave, a thing
> that does not move. The first move is not a move. It is the planting of
> something that will not be shifted.

BAD (banned — "entrance"):
> The Chinese teach this code through one image: the sprout piercing hard
> soil. The character is built from earth and cavity...

The first version *uses* the philology. The second version *announces* it.
The first version trusts the reader. The second version frames.

### 2.2 No bare Mandarin in the body of the reading

The vault gives Chinese transliterations (*Zhèn*, *jun zi*, *Huán*). The
reader does not know these terms. **They cannot stand alone.** Either:

- Translate the meaning and drop the transliteration entirely:
  > "The one ordering their life by the way." (not "the *jun zi*.")
- Or carry the transliteration *as the name of a specific image*, immediately
  glossed:
  > "Not just a stone. *Huán* — a soapnut tree, the post that stands at a
  > grave."

The transliteration may appear at most once or twice per card, only when it
adds a specific image the English word would lose. Most cards will not need
it at all.

### 2.3 Carry the mythological figures and historical resonance

The Practical Guide often names the deity, the historical custom, the
medicinal use of a plant. **Carry it.** If hexagram 3's line 2 is the
not-bandits-but-suitors marriage custom, name it. If hexagram 2 invokes
Houtu, the earth goddess, weave her into the reading.

But: never *credit* a tradition. Don't write "the practical guide says..."
or "in the old commentary..." Name the image, name the figure, name the
custom — let the reader meet it as part of the teaching.

### 2.4 Per-line imagery comes from the *line files*

The previous pass treated the six lines as variations on a theme. The line
files in the vault have a specific image per line, with the original
character often given in the Practical Guide. The deep pass reads each
line file in full and writes from the image, not from the position.

### 2.5 BODY: carry Rudd's cosmology, but in lived terms

Rudd's Gene Keys text is expansive — he runs from cell biology to Einstein
to genetic determinism in a single section. **You don't reproduce his
philosophy.** You read him to find the *bodily anchor* he names (organ,
gland, body region, amino-acid mechanism), and you carry his framing of
the shadow/gift movement at the body level. Stay grounded. Stay in the
body.

If Rudd names a specific physiology mechanism (e.g. "this amino acid is
the signal to build new tissue"), use it as the factual anchor. One real
fact about the chemistry is enough to ground the poetry.

---

## 3. Accessibility rules (locked, all sections)

These extend the master writing-method's anti-jargon rules to specifically
guard against the deep-pass risk of becoming arcane:

1. **No bare Mandarin** in the body. See §2.2.
2. **No naked Chinese commentary phrases** ("The judgement says X", "The
   image says Y"). The card has its own `judgement_lines[]` and
   `image_lines[]` fields for those; the prose doesn't need to announce
   them.
3. **No technical I-Ching vocabulary** without immediate gloss: words like
   "nuclear hexagram", "trigram correspondence", "moving line" must be
   either translated or simply not used. The card's UI handles the
   structural metadata; the prose teaches the *meaning*.
4. **No banned openers** (from `_BRIEF.md`s) AND no "entrance" openers:
   - "The Chinese teach..."
   - "The character is..."
   - "The traditions place..."
   - "The old commentary..."
   - "In the original..."
   - "Wilhelm/Eranos/Rudd writes..."
   Every section opens on the teaching itself, in the writer's own voice.
5. **Plain vocabulary still wins.** Even when carrying philology, the
   sentence that contains the philology must be in plain English. A
   sentence reading "the ideogram of *XIAN* — interspace, vacant, empty,
   moonlight through a door ajar" is more accessible than "*XIAN*: 間,
   the philosophical concept of vacancy through liminal threshold."

---

## 4. Length budget

Same as the scaffold pass. The deep pass is **denser**, not longer.
Stay inside every hard ceiling in `_BRIEF.md`. If the philology pushes a
field over the ceiling, cut the weaker sentence first, not the philology.

For ICHING: keep `combination` at 60-90, `reading` at 200-300, each line
at 40-60.

For BODY: keep `physiology` at 150-250, `amino_acid` at 120-200.

---

## 5. Output

Save to `oracle/sections/iching/NN.deep.json` (or `body/NN.deep.json`) —
the `.deep` suffix keeps it separate from the existing scaffold so Adrian
can compare. Same JSON shape as the scaffold.

After writing, report:
- Card number, section name
- Word counts per field
- The two or three vault images/figures/philological elements that
  landed in the prose (this is the test of "did I actually read the vault")
- Confirm: no em dashes, no banned openers, no bare Mandarin, no entrance
  openers
- One short paragraph: what you found in the vault that the scaffold
  version missed
