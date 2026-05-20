# DESIGN section — generation brief

You are writing the **DESIGN section** for one card of the Universal Language
Oracle. DESIGN is the Human Design voice: the code in the energy body. This
brief is the locked standard. Follow it exactly.

## Your task

For the assigned card number, read this card's Human Design source from the
Obsidian vault and write a DESIGN section JSON file.

**Per-card data** is in `_per_card_reference.json` at this folder. Look up
your card number to get: gate number, keyword, centre name, centre slug, and
channel partner(s).

**Source files to read** (in `~/Documents/Obsidian Vault/oracle/human-design/`):
- `gates/gate-NN.md` — your card's gate
- `centers/center-<slug>.md` — the centre your gate sits in (use the
  centre_slug from the reference file)
- `channels/channel-A-B.md` — your card's channel(s) — there may be 1 to 3 of
  them. Read each one referenced in the reference file.

Read all of them. The source is verbose and SEO-templated (don't reproduce
its prose), but the *structural information* is reliable: what the gate
carries, what the centre is for, what each channel is named and what it
forms. Mine the information, write the teaching in our own voice.

**Output:** write `oracle/sections/design/NN.json`.

---

## What DESIGN does and does not cover

DESIGN teaches the gate's anatomy in the energy body. RELATIONS will later
teach the channel-as-bond to other cards. Strict split:

**DESIGN covers:**
- The gate itself: what this code IS as a gate, what it carries
- The centre: where the gate sits in the body-map and why that placement is
  the teaching
- The channel as anatomy: the structural fact that this gate is half a
  circuit, what it reaches toward, what it lacks alone — WITHOUT naming the
  partner card. (Say "reaches toward the gate of contribution," not "bonded
  to UL 8.")

**DESIGN does NOT cover:**
- The partner card by UL number (that's RELATIONS)
- What activating both cards together opens up (that's RELATIONS)
- The Shadow/Gift/Siddhi spectrum (that's KEYS)
- The hexagram structure or moving lines (that's ICHING)
- The codon ring or amino acid (that's BODY)

---

## The voice (locked, non-negotiable)

- **Intimate teacher.** Warm, direct, alive on the page.
- **NO EM DASHES. NO EN DASHES.** Anywhere. Ever. Commas, periods, line
  breaks only.
- **Describe the energy, never diagnose the reader.** Never "you have this
  gate." Write "this gate carries..." Name the misread, not the reader's
  failure.
- **Catch the lineage in original words.** Human Design's architecture (gate
  numbers, centre names, channel names, gate keywords) is kept. The body of
  the prose is ours.
- **No system jargon as scaffold.** Do not explain "what Human Design is."
  Open on the teaching itself.

## The rejected source template (THE not-do)

The vault's gate files all open with templates like:
- "Gate N is the Gate of [Keyword]"
- "Gate N, also called the Gate of X, is situated in..."
- "This gate carries the energy of..."

**Never reproduce these.** They are the templates Adrian explicitly rejected.
Open on the teaching itself, not on the gate's label-and-location.

---

## Opening-sentence diversification (the KEYS lesson)

When 63 KEYS files were written by parallel agents, 57 of 64 gifts opened
"Something + verb + when..." because the locked sample used that move. The
agents pattern-matched into a formula. We are not doing that here.

**Banned opening patterns for DESIGN** (any field, any card):
- "Gate N is..." / "Gate N carries..." / "Gate N sits..." — the rejected template
- "This gate..." / "This code..." — overused subject openings
- "There is a..." — banned KEYS shadow formula
- "Something + verb + when..." — banned KEYS gift formula
- "At some point..." / "Eventually..." / "Far enough..." / "One day..." —
  banned KEYS siddhi formulas (don't carry them in)

**Vary your openers.** Each card's openers should be its own move, fit to
its specific paragraph. Examples of varied moves (these are seeds, not a
template list — invent your own):

- Start on the felt drive: *"There is a pressure to put what is genuinely yours into the world."* (Don't start "There is a" literally — use the move, fresh words.)
- Concrete observation: *"A person carrying this code feels it as an itch."*
- Plain stative: *"Self-expression is wired to identity here."*
- Image-led: *"The gate is half a circuit."*
- Imperative or invitation: *"Watch how a person with this gate moves."*
- Misread named: *"Most people mistake this drive for originality strained for."*
- Centre-first: *"The centre this gate sits in is the body's seat of identity."*

After writing the three fields, **read your three opening sentences in a row.**
If two of them start with the same word or use the same syntactic shape,
rewrite one.

---

## The four "reads-as-human" cuts (apply to every paragraph)

1. **No symmetry.** No tidy triads, no balanced pairs, no paragraphs of
   matching length. Real writing is lopsided.
2. **No summary sentence.** Never the line that steps back and announces
   what the paragraph meant.
3. **Plain vocabulary.** Avoid "profound", "journey", "embrace", "navigate",
   "essence", "transformative". Reach for the plain word.
4. **End a beat early.** End on a small, plain, or slightly rough clause.

Keep deliberate human unevenness: fragments, blunt short sentences, a clumsy
tack-on left clumsy.

---

## Structure and length

Three fields. **Hold the word counts. These are real limits, not minimums.**

- `gate` — what this code IS as a gate. Open from the felt drive or the
  image, not from "Gate N is...". Name the misread of what this gate is.
  **130-180 words, hard ceiling 185.**
- `centre` — the centre the gate sits in, and why that placement is the
  teaching. The centre is the body of the code; the gate is the
  expression-point. **130-180 words, hard ceiling 185.**
- `channel` — the structural fact that this gate is half a circuit. What it
  reaches toward (named by gate-keyword, NOT by partner UL N). What this
  code lacks alone, what completes it as anatomy. For cards in the
  Integration cluster (gates 10, 20, 34, 57), teach the multi-channel
  nature: this gate is unusual, it reaches into three other gates, and the
  cluster forms an unusual web. **130-180 words, hard ceiling 185.**

Verify counts with:
```bash
python3 -c "import json; d=json.load(open('NN.json')); print('gate', len(d['gate'].split()), 'centre', len(d['centre'].split()), 'channel', len(d['channel'].split()))"
```

---

## Output JSON shape

```json
{
  "number": NN,
  "section": "design",
  "status": "scaffold",
  "gate_number": NN,
  "gate_keyword": "Self-Expression",
  "centre": "Identity Center",
  "channel_keywords": ["Channel of Inspiration"],
  "gate": "<130-180 words>",
  "centre_field": "<130-180 words>",
  "channel": "<130-180 words>",
  "meta": { "source": "vault gate-NN + centre + channels", "generated": "design-brief-v1" }
}
```

Note the field name is `centre_field` for the centre prose, since `centre`
is also the name of the metadata field for the centre name. No markdown
markers (`**`, `*`) inside string values. No em dashes inside values.
Multi-paragraph text uses `\n\n` between paragraphs.

---

## The reference — UL 1 (Hexagram 1), the locked standard

Gate 1, "Self-Expression", in the Identity Center (G), forming the Channel of
Inspiration (1-8) with Gate 8 (Contribution).

**gate (locked sample, 138 words):**
> As a gate, this code is the pressure to put what is genuinely yours into
> the world. Not originality strained for, not difference performed, but the
> simple outward movement of something that is already, particularly, inside
> you. A person carrying this gate feels it as an itch toward expression.
> The thing wants out, in its own form, and will not be content to stay
> unspoken or to come out as a copy of someone else's voice.

**centre_field (locked sample, 142 words):**
> This gate sits in the centre of identity, the part of the body-map that
> holds who you are and which direction your life faces. That placement is
> the whole teaching. Here, the creative force is not a free-floating talent
> you could aim anywhere. It is wired to the sense of self. To express this
> code is to articulate who you actually are, which means the creativity
> and the identity are not two things. They are one movement, and the
> expression falters whenever it tries to come from anywhere but the true
> self.

**channel (locked sample, 144 words):**
> A gate is only half a circuit. This one reaches toward the gate of
> contribution, and the two together form the channel of inspiration. The
> reach matters. The creative force, on its own, has no way out. It is an
> impulse with no delivery. The contribution is what carries it across to
> other people, shapes it into something they can actually receive. Alone,
> this code is a fire in a closed room. Joined, it becomes inspiration. The
> code is built to need its other half.

Notice: the channel sample says "the gate of contribution" (using the
*keyword* of the partner gate), not "Gate 8" or "UL 8". That's the level of
naming DESIGN allows. The actual partner card lives in RELATIONS.

---

## Before you finish

1. Verify the three openers. If any two share an opening word or shape,
   rewrite one.
2. Re-read for em dashes / en dashes — delete every one.
3. Verify word counts with the Python command.
4. Confirm no banned pattern was used.
5. Confirm the architecture (gate number, centre name, channel name) matches
   the reference data.
6. Write the JSON file. Report card number, the three opening sentences
   (full first sentence of each field), word counts, and confirm "no em
   dashes, openers vary".
