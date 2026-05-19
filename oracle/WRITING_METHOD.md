# Universal Language Oracle — The Writing Method

> The field-by-field standard for writing a card. Designed with Adrian from the
> real Hexagram 1 source material (Stage A2). This document is **canonical**: it
> defines every text slot a card has, what each slot does, how long it runs,
> and the do's and don'ts. Where it conflicts with the older anatomy in
> `00_MASTER_WRITING_GUIDE.md` §4–§5.4 (the pre-six-section "GLANCE + voices"
> model), **this document wins**. The master guide's two-phase model (§1),
> terms (§3), copyright line (§6), voice rules (§7), and status system (§10)
> all still hold and are not repeated here.

Read this after `VISION.md` and `00_MASTER_WRITING_GUIDE.md`.

---

## 0. The decisions this method is built on

Settled with Adrian in the Stage A design session. Do not re-litigate.

1. **Six sections.** The nav bar shows the short labels, in this order:
   `UL 1 · ICHING · KEYS · DESIGN · BODY · RELATIONS`
   (`UL 1` is per-card — `UL 14`, `UL 37`, …) The full section names used in
   this document are: **UL N**, **ICHING**, **GENE KEYS** (bar label `KEYS`),
   **HUMAN DESIGN** (bar label `DESIGN`), **BODY**, **RELATIONS**.
   The inward journey deepens UL N → systems → BODY; RELATIONS turns the reader
   back outward and is the true final section.
2. **UL N is a real section** — first in the nav bar, a tappable destination
   like the others. It holds the art, the name, the keywords, the invocation,
   and the opening reading. It is the card's home and is complete on its own.
3. **"UL N" everywhere** — the bar's home slot, kin links, URLs. Never "Code N".
4. **The field spec drives the data shape.** This document is the single source
   of truth for the JSON schema. `SCHEMA.md` and the generator are reconciled to
   it, not the reverse.
5. **The trigram selector stays.** The I-Ching section keeps its interactive
   Hex / Upper / Lower selector; this method specs all three readings.

### The voice (locked)

- **Intimate teacher.** Warm, direct, speaks to "you". Names the felt
  experience. Accessible without being shallow. The register of the locked
  UL N sample below is the reference for the whole deck.
- **No em dashes.** Anywhere on a card. Commas, periods, line breaks. (This
  document uses them; it is an internal working doc, not card copy.)
- **The writing IS the information, never an entrance to it.** Start on the
  first true sentence about *this code*. See §1.
- All shared voice rules in `00` §7 still bind — no adjective triads, "not X,
  it is Y" once per card maximum, vary sentence length, ground the abstract,
  lived particularity over category.

---

## 1. The two rules that fix the mistakes this method was made to fix

### 1.1 No entrances. The writing is the information.

A card section never opens by explaining what its system *is*. Banned openings:

- "The I-Ching, the oldest book of the Chinese tradition, ..."
- "The Gene Keys, a modern transmission, reads each code as a spectrum ..."
- "Human Design maps the 64 codes onto the body ..."

That is meta-text. It frames the information instead of being it. Every section
opens **on the teaching of this specific code** — the first sentence is already
about *this* hexagram, *this* shadow, *this* gate.

The reader who needs to know what the I-Ching is gets it from the **glossary**
(see §1.2), not from a paragraph re-narrated on all 64 cards.

### 1.2 Context lives in the click-glossary

System terms — *hexagram, trigram, moving line, Shadow / Gift / Siddhi, codon,
codon ring, gate, centre, channel, Arcana* — are quietly tappable on first use
in a card. A tap opens a one or two sentence definition. That is the **only**
place a system gets explained. The card body never defines its own terms.

Glossary entries are written once, shared across all 64 cards, and kept
minimal. A glossary entry is a definition, not a teaching.

### 1.3 No oracle throat-clearing

Banned: "You have drawn the first code", "the cards reveal", "the oracle speaks",
"as you turn this card". The reading begins on its first true sentence about the
code. The reader knows they cast a card; the writing does not announce it.

### 1.4 The first line names the thing — with no scaffold

The card is an oracle **and** a teacher. The most valuable line in the deck is
the first line of the UL N reading — the one line every reader sees and many
read alone. It must **land the code**: name what this force is, so a reader who
reads only that line already knows what they are holding.

But name it *bare*. Do **not** use a fixed frame to do it — "This is the code
of...", "The energy of this card is...", "You know this one". Across 64 cards
any fixed opening frame becomes a formula, which is the AI-symmetry tell §1.5
bans. The reader already knows it is a code; saying so wastes the line.

Start on the substance itself, often as a fragment. ("Pure beginning. The force
that arrives before the thing it will make.") Each card's opening is its own
words, sharing only the *move* — name the thing first — never a template.

Recognition belongs in the deck, woven *through* the body of the reading ("you
carry it already", "most people never learn"), never as the opening hook.

### 1.4b The reading is 2–3 clusters — and the breaks are part of the writing

The UL N reading is **2 to 3 clusters, maximum.** Each cluster is one solid
block of flowing sentences. A **full empty line** — a whole line of blank
vertical space — separates each cluster.

Not a wall of prose. Not chopped into seven fragments. Two or three real
blocks.

For Hexagram 1 the three clusters are the reading's three genuine movements:
**what the force is → its hidden face → what it asks.** That is the model: a
cluster is one movement of the meaning.

**The breaks are part of the writing, not formatting.** A break falls only
where the reading truly turns — where the thought moves to a new place. The
reader should feel the empty line as an earned beat, never as a gap dropped in
at random or by word count. Write the clusters as real movements first; the
breaks then fall by themselves, on the turns.

In the data, `ul.reading` is an **array of 2–3 strings**, one per cluster. The
card renders a full blank line between them. See §5.

### 1.5 The "reads-as-human" cuts — enforceable on every section

The deck must read as written by a person, not assembled by a system. AI prose
has four tells; cutting them is a rule, applied to every text slot on the card.

1. **No symmetry.** Cut balanced pairs, tidy triads, "not just X but Y", and
   paragraphs of even length. Real writing is lopsided — one paragraph long,
   the next two lines. Vary it on purpose.
2. **No summary sentence.** Cut the line that steps back and tells the reader
   what the paragraph meant ("This card is about creativity"). Trust the
   reader; the meaning is already in the prose.
3. **Plain vocabulary by default.** Reach for the plain word. "Profound,"
   "journey," "embrace," "navigate," "essence," "transformative" are defaults
   to avoid; go up only when nothing plain will carry it.
4. **End a beat early.** No neat bow, no resolving flourish. End on a small
   plain clause or an open one, and stop slightly before the reader expects.

A useful texture, not a tell: the lopsided, slightly clumsy human rhythm — a
run-on with a doubled "and", a fragment, a sentence that lands a little rough.
Do not smooth these into elegant defaults. The clumsiness is the human in it.

---

## 2. Internal vs. outward relating — the strict rule (from VISION.md)

Two kinds of relating; they must never overlap.

- **Internal relating** — the moving lines, Shadow→Gift→Siddhi, a gate inside
  its channel. The code relating *to itself*. Taught **only inside that
  system's own section**.
- **Outward relating** — the paired hexagram, the programming partner, the
  codon-ring siblings, the Tarot correspondence. The code relating *to other
  codes*. Lives **only in RELATIONS**.

Strict: internal relating is never repeated in RELATIONS; RELATIONS never
re-teaches a system. This is what keeps "completion at every layer" true.

---

## 3. The field-by-field spec

Every text slot, in section order. Each entry gives: the **JSON field**, the
slot's **job**, its **length** (a typical target, not a hard gate — see `00`
§ on length), and **do/don't** notes. The Hexagram 1 sample after each section
is the worked reference, drawn from the real vault source.

Length figures exist so the 64 cards sit evenly together. Far outside a range
is a signal to ask why, not an automatic error.

---

### SECTION 1 — UL N (the opening face)

The card's home. Complete on its own: a reader who only ever reads this has had
a real reading. No system is named here; no structure is explained. It carries
the spine of the code as a reading for *now*.

| Field | Job | Length |
|---|---|---|
| `ul.card_name` | The poetic title. Holds the code as one image. | 2–4 words |
| `ul.keywords` | 5–7 brief words that pinpoint the code at a glance. No system jargon. Governed by `05_KEYWORDS_GUIDE.md`. | 5–7 items |
| `ul.reading` | The opening oracle reading. An array of 2–3 cluster strings (§1.4b), each a genuine movement of the meaning. The first words name the force bare, no scaffold (§1.4). The clusters: the lit face — what it feels like awake; the other face — the shadow-side as a *felt* thing, named as the same force; what the code asks of the reader now. | ~200–260 words total |
| `ul.invocation` | The spoken alignment passage — first person, what the reader briefly becomes. Optional; a card is complete without one. Governed by `02_INVOCATION_GUIDE.md`. | ~6–10 short lines |

**Do:** name the force in the first line, bare, no frame (§1.4); break the
reading for the eye with short paragraphs and stand-alone lines (§1.4b); speak
to "you"; weave recognition through the body, not as the opening hook; name
both faces as the same force; instruct as well as mirror — it is oracle *and*
teacher; end on the code's ask, a beat early (§1.5).
**Don't:** open with a fixed frame ("This is the code of...", "You know this
one"); write the reading as one block; name a system; explain the hexagram
structure or the Shadow/Gift/Siddhi mechanism (those are ICHING and GENE KEYS);
use oracle throat-clearing.

**Hexagram 1 — `ul.reading` (LOCKED SAMPLE):**

Three clusters — what the force is, its hidden face, what it asks. Each a solid
block; a full empty line between. The breaks fall on the two real turns.

> Pure beginning. The force that arrives before the thing it will make. You
> carry it already. It is what wants to start, to make, to put something into
> the world that was not there an hour ago. When it is awake in you, it feels
> like appetite. You begin things. You want to.

*(full empty line)*

> It has another face, and most people never learn it is the same force. The
> flat weeks. The mornings when nothing pulls at you, when the days run
> together and you cannot remember the last time you wanted to make anything.
> That is not the fire failing. That is the fire low, and low is one of its two
> seasons.

*(full empty line)*

> What this asks of you is small, and it takes a long life to learn. You carry
> the fire. You do not make it. It rises on its own schedule and sinks on its
> own schedule, and the work is to stop arguing with which one is happening.
> When it is low, let it be low. The numb stretch is the fire gathering, and it
> cannot be hurried. When it climbs, go with it before you feel ready. Ready is
> not a thing it waits for. Let it move through you, let it do what it came to
> do, and let it go when it goes.

---

### SECTION 2 — ICHING

The hexagram's situation and its natural image, plus the trigram selector and
the moving lines. The moving lines are *internal relating* and live only here.

#### The trigram selector

Three short readings, switched by the Hex / Upper / Lower selector.

| Field | Job | Length |
|---|---|---|
| `iching.hexagram_name` | The hexagram's name (e.g. "The Creative"). | 1–4 words |
| `iching.combination` | The "Combination" reading: what the two trigrams make *together* — the situation of the whole hexagram. The selector's default view. | ~60–90 words |
| `iching.upper_nature` | The upper trigram's own nature, briefly. May reuse shared trigram text — the 8 trigrams recur across the 64. | ~30–50 words |
| `iching.lower_nature` | The lower trigram's own nature, briefly. Same. | ~30–50 words |

**Do:** in `combination`, teach the *image* — what sits over what, what moves
toward what. **Don't:** restate the UL N reading; drift into Shadow/Gift/Siddhi.

#### The reading and the classic

| Field | Job | Length |
|---|---|---|
| `iching.reading` | The main I-Ching teaching of this code: the life-situation it names and how the natural image unlocks it. The section's centre of gravity. | ~200–320 words |
| `iching.judgement_lines[]` | The Judgement, freshly rendered — the oracle's verdict on the moment. An array of short lines. Original wording, never a source's prose. Governed by `04_TRANSLATION_METHOD.md`. | 2–5 short lines |
| `iching.image_lines[]` | The Image, freshly rendered — the picture from nature that mirrors the energy. An array of short lines. | 2–4 short lines |

#### The moving lines

| Field | Job | Length |
|---|---|---|
| `iching.lines[]` | Six entries. Each: the line's image, what it counsels, and the hexagram it transforms into when it moves. Internal relating — stays here. | ~50–70 words each |

Per line: `{ line: N, image: "...", reading: "...", becomes: { hexagram: N, name: "..." } }`.

**Do:** keep each line a self-contained micro-reading; name the becoming
hexagram plainly. **Don't:** let the lines re-teach the whole hexagram.

**Hexagram 1 — `iching.combination` (sample):**

> Heaven sits over Heaven, the same force doubled, with no earth beneath it to
> receive it and no water to cool it. This is the one hexagram made entirely of
> unbroken lines, and it is first because it is pure beginning: the charged
> moment before the first move, when the energy is wholly active and wholly
> originating, and nothing has yet taken form.

**Hexagram 1 — `iching.reading` (sample):**

> The situation this code names is the moment before. Before the first word,
> before the first move, when there is only the force that will make the thing
> and not yet the thing. It is a situation of immense available power and no
> finished shape, and that is exactly its difficulty. A force this strong, left
> unchecked, burns through its own creations before they have had time to set.
>
> The picture the hexagram gives is the dragon, and the dragon is shown moving
> through six positions, from hidden in the deep to flying in the heights to
> risen one step too far. That arc is the teaching. Originating power is not a
> thing you hold; it is a motion you are briefly inside of. The counsel is not
> to make more, push harder, create faster. It is to become strong and
> untiring, the way the motion of heaven is untiring: it never strains, and it
> never stops. You ride the force. You do not mistake yourself for it.

**Hexagram 1 — `iching.judgement_lines[]` (sample):**

> - The Creative originates, and reaches through everything.
> - It serves what is true, and holds.
> - Kept steady, it carries the deepest fortune.

**Hexagram 1 — `iching.image_lines[]` (sample):**

> - Heaven moves, and does not stop.
> - So the one who would grow makes the self strong, and does not tire.

**Hexagram 1 — `iching.lines[0]` (sample, line 1):**

> *image:* the dragon still hidden under the water.
> *reading:* The power is real, but the season has not come. This is not
> failure; it is the deep, the kindling before the spark. Build strength where
> no one is watching, and do not move yet.
> *becomes:* Hexagram 44, Coming to Meet. The hidden thing makes its first
> contact with the world.

---

### SECTION 3 — GENE KEYS  (bar label: `KEYS`)

The Shadow / Gift / Siddhi spectrum — the inner movement of the code. Three
tone plates; the Shadow plate carries a nested repressed/reactive detail. This
section already has a strong companion spec, `01_DESCRIPTION_SPEC.md`; this is
the field map that places it in the six-section card.

| Field | Job | Length |
|---|---|---|
| `gene_keys.shadow_name` / `gift_name` / `siddhi_name` | The three frequency names (e.g. Entropy / Freshness / Beauty). Kept — they are the deck's spine (`00` §6). | 1–2 words each |
| `gene_keys.shadow` | The low frequency. Describe it as *energy*, never as the reader's diagnosis. Names the common misread, and carries the way through woven in (the low fire is not a dead fire). | ~180–200 words |
| `gene_keys.repressive` | The Shadow's inward face. One real person who goes still. A visible labelled line under the Shadow, not a hidden panel. | ~30–45 words |
| `gene_keys.reactive` | The Shadow's outward face. A different real person who speeds up. Visible labelled line under the Shadow. | ~30–45 words |
| `gene_keys.gift` | The Gift, opening from the turn out of the Shadow. Carries its own reach toward the Siddhi. | ~180–200 words |
| `gene_keys.siddhi` | The highest frequency. Present tense, spacious; closes the loop back to the Shadow as belonging, not a flaw. | ~150–180 words |

**The KEYS standard (locked with the UL 1 build):**
- **Describe the energy, never diagnose the reader.** Not "you are numb" but
  "numbness is...". A reader living in the Gift and a reader in a flat stretch
  must both be reached. Name the *misread* ("most people treat this as a
  fault"), not the reader's failure.
- **Each frequency carries its own resolution.** The Shadow shows the door out
  *inside itself*; the Gift leans toward Beauty; the Siddhi carries the dark
  back as belonging. The way through is woven in, never a tacked-on solution.
- **Catch the Gene Keys aliveness in our own voice.** Commit to an image and
  carry it (low coals, the floor, the road). Write with conviction and warmth.
  Never reproduce the source's prose or coinages — the architecture and the
  three names are the kept lineage; the body is ours.
- **Run the §1.5 audit.** Cut triads, summary sentences, elevated-default
  vocabulary, tidy bows. Keep deliberate unevenness — fragments, blunt short
  sentences, a clumsy tack-on left clumsy.

**Don't:** re-explain the hexagram; restate the UL N reading; pull the partner
code in (that is RELATIONS); diagnose the reader's state.

**Hexagram 1 — `gene_keys.shadow` (LOCKED SAMPLE):**

> Things run down. The coffee goes cold. The room you cleaned does not stay
> clean. Nobody is surprised by this, it is just how the world is, and a life
> is not exempt from it. In a person it shows up as numbness.
>
> Numbness is quieter than sadness. Sadness has a reason and a shape. This does
> not. It is more like a slow loss of colour. You keep doing the things, and
> you do them more or less right, and one day you notice you have not actually
> felt any of them in a while. The work happens at a small distance. So does
> the food, the talk, the morning.
>
> Most people treat this as a fault and try to get rid of it. That is the
> mistake. A low fire is not a dead fire. Something is happening down in the
> coals that the bright flame could never do, and it needs the dark to do it.
> The numb season is not the end of your creative life. It is the part of it
> that grows roots. You do not break out of it. You wait it out, and you trust
> it while you wait, which is harder.

**Hexagram 1 — `gene_keys.repressive` (LOCKED SAMPLE):**

> Some people meet the numbness by going still. They stop reaching for
> anything, decide this flatness is simply who they are, and let the fire bank
> down further. It looks like calm. It is not calm.

**Hexagram 1 — `gene_keys.reactive` (LOCKED SAMPLE):**

> Others meet it by speeding up. They fill the calendar, stay in motion, keep
> the noise high enough that the silence underneath cannot be heard. They look
> productive. Inside, nothing has warmed.

**Hexagram 1 — `gene_keys.gift` (LOCKED SAMPLE):**

> Something turns when a person stops fighting the flat season. The numbness
> they were braced against opens, and what is on the other side of it is the
> nerve to start something before they are ready.
>
> That nerve is freshness. It is being willing to do the thing badly rather
> than not do it. It is taking a step onto ground you have not tested, because
> you have worked out, somewhere below thinking, that the roads you envy were
> all made by people walking who did not know where they were headed either.
>
> It is not optimism. Optimism makes up its mind early that things will go
> well, and it flinches when they do not. Freshness has not made up its mind
> about anything. It starts, it gets things wrong quickly, it stays curious
> about what it does not know yet. That last part matters more than it sounds.
> The not knowing is not a gap to be filled. It is the only place a genuinely
> new thing has ever come from. And each time a person begins like this,
> without clutching at the outcome, the beginning does something back to them.
> It works on them. The maker gets made.

**Hexagram 1 — `gene_keys.siddhi` (LOCKED SAMPLE):**

> Far enough along, this stops being a thing a person does and becomes a thing
> a person is. The one who used to stand over the work, checking it, asking if
> it was good enough, is just not there anymore. There is the making, and there
> is the life it runs through, and you cannot find the seam between them.
>
> A life lived that way comes out beautiful. Not pretty, not polished for
> looking at. Beautiful the way fire is, or a tide, by being completely the
> thing it is and nothing else. From here a person can look back down the whole
> road. The numbness at the start, the long colourless stretch that felt like
> failing, was not failing. It was the floor. It was the dark the rest of it
> grew up from.

---

### SECTION 4 — HUMAN DESIGN  (bar label: `DESIGN`)

The code in the energy body: the gate, the centre it sits in, the channel it
forms. Three plates. **The rejected source template — opening every entry with
"Gate N is the Gate of ..." — is a not-do.** Open from the body, from
experience, from the image.

| Field | Job | Length |
|---|---|---|
| `human_design.keyword` | The gate's name/keyword (e.g. "Self-Expression"). Metadata + section title. | 1–3 words |
| `human_design.gate` | What this code *is* as a gate — the drive it carries, written from felt experience, not from the gate's label. | ~120–200 words |
| `human_design.centre` | The centre the gate sits in, and why that placement is the teaching — what it binds this code's energy to. | ~120–200 words |
| `human_design.channel` | The channel the gate forms with its partner gate — the circuit, what completes it, what the code lacks alone. Internal relating (a gate within its channel) — stays here. | ~120–200 words |

**Do:** open `gate` on the drive itself; make `centre` about the *meaning of
the placement*; treat `channel` as circuitry. **Don't:** use the "Gate N is
the Gate of..." template; name the partner *card* (the channel names the
partner *gate*; the partner *card* belongs to RELATIONS).

**Hexagram 1 — `human_design.gate` (sample):**

> As a gate, this code is the pressure to put what is genuinely yours into the
> world. Not originality strained for, not difference performed, but the simple
> outward movement of something that is already, particularly, inside you. A
> person carrying this gate feels it as an itch toward expression: the thing
> wants out, in its own form, and will not be content to stay unspoken or to
> come out as a copy of someone else's voice.

**Hexagram 1 — `human_design.centre` (sample):**

> This gate sits in the centre of identity, the part of the body-map that
> holds who you are and which direction your life faces. That placement is the
> whole teaching. Here, the creative force is not a free-floating talent you
> could aim anywhere. It is wired to the sense of self. To express this code is
> to articulate who you actually are, which means the creativity and the
> identity are not two things. They are one movement, and the expression
> falters whenever it tries to come from anywhere but the true self.

**Hexagram 1 — `human_design.channel` (sample):**

> A gate is only half a circuit. This one reaches toward the gate of
> contribution, and the two together form the channel of inspiration. The
> reach matters: the creative force, on its own, has no way out. It is an
> impulse with no delivery. The contribution is what carries it across to other
> people, shapes it into something they can actually receive. Alone, this code
> is a fire in a closed room. Joined, it becomes inspiration. The code is
> built to need its other half.

---

### SECTION 5 — BODY

The biological layer — the deepest *inward* point of the card. The DNA codon,
the codon ring as living chemistry, where the code is seated in the physical
body. **Written as a layer of the oracle, spoken poetically — never as a
biology explainer.** This section is new in VISION.md; it had no prior guide.

| Field | Job | Length |
|---|---|---|
| `body.physiology` | Where the code is seated in the physical body — the organ or system — written as a felt, poetic truth, not an anatomy lesson. | ~150–250 words |
| `body.amino_acid` | The amino acid / codon the code answers to, and what it means that the code runs this deep — into the body's own chemistry. | ~120–200 words |

**Do:** treat the body as the literal floor the other four systems were always
describing; keep it poetic and grounded; let it land the card's inward journey.
**Don't:** explain genetics or biochemistry as science; name the ring's
*siblings* (that is RELATIONS — BODY establishes the chemical seat, RELATIONS
names the kin).

**Hexagram 1 — `body.physiology` (sample):**

> The traditions place this code's seat in the liver, the body's quiet engine
> of renewal, the organ that takes what is spent and remakes it into what can
> be used again. It is fitting. This is the code of originating force, and the
> liver is where the body, out of sight and without being asked, performs its
> own daily act of creation: breaking down, rebuilding, beginning again. The
> numbness of the shadow has a bodily floor here too. When vitality leaks, when
> the days go flat, the body feels it as a kind of heaviness, a fire banked
> low. And the catching of the gift is also bodily, the return of appetite,
> of warmth, of the wish to move. The code is not only something you think or
> feel. It is metabolic. It runs in the part of you that renews itself while
> you sleep.

**Hexagram 1 — `body.amino_acid` (sample):**

> Deeper still, this code answers to a single amino acid, Lysine, one of the
> small set of letters the body cannot make for itself and must take in from
> the world. There is a teaching in that. The very first code, the origin of
> all the others, is built on an element that does not originate within. It
> has to be received. Even pure creative force is not self-made. It is carried
> in, taken from outside, and only then put to work. The code runs all the way
> down to this: a chemistry that must be fed before it can create.

---

### SECTION 6 — RELATIONS

The doorway out. Outward relating only — how this code is kin to the other 63
and to the other systems. The card's true final section. Tarot nests *inside*
here. Uses "UL N" for every kin link.

| Field | Job | Length |
|---|---|---|
| `relations.paired_hexagram` | The I-Ching opposite — every line reversed — and what the two form together. Links to the kin card as "UL N". | ~80–130 words |
| `relations.programming_partner` | The Gene Keys partner code and the polarity it makes with this one. Links as "UL N". | ~80–130 words |
| `relations.codon_ring` | The codon-ring family this code belongs to, and its siblings. Links each sibling as "UL N". | ~80–130 words |
| `relations.tarot` | The Tarot resonance — the ring's archetypal face. *One element within* RELATIONS, not its own section. | ~80–130 words |
| `relations.deeper_correlation` | A quiet nested door: the trigrams, the Eight Immortals, the Golden Dawn correspondences. Optional study depth, never imposed. | ~60–120 words per part |

**Do:** keep every entry about *outward kinship*; use "UL N" naming
consistently. **Don't:** re-teach any system; repeat internal relating (moving
lines, Shadow→Gift→Siddhi, the channel).

**Hexagram 1 — `relations.paired_hexagram` (sample):**

> The I-Ching opens with a pair. This code and its opposite, every line
> reversed: UL 1 and UL 2, Beyond the Shell. UL 1 is pure originating force
> with no direction of its own. UL 2 is pure receptive direction with no force
> of its own. Neither is whole alone. The force with nowhere to go, the
> direction with nothing to move it. Together they are the first complete
> creative act, and the whole deck is built outward from their meeting.

**Hexagram 1 — `relations.codon_ring` (sample):**

> At the chemical root, this code belongs to the Ring of Fire, a family of
> codes bonded in the body before they are ever bonded in meaning. It is a
> small family, only two: UL 1 and UL 14, Ancestors Bloom. Their shared theme
> is the creative flame and its harvest. UL 1 is the spark, the first catching.
> UL 14 is that same fire grown into fullness, into abundance held and passed
> on. To travel from one to the other is to follow a single fire across its
> whole life.

**Hexagram 1 — `relations.tarot` (sample):**

> The Ring of Fire carries, in the Tarot, the card of Temperance: the patient
> tending of fire, the alchemy that does not force a flame but lets it ripen at
> its own rate. It is the right face for this code. Everything UL 1 teaches,
> to wait through the numbness, to not push the spark, to move only when the
> season turns, is Temperance's discipline, the slow art of working with fire
> instead of against it.

---

## 4. The per-card field checklist

Run after writing a card, alongside the `00` §7 voice rules.

- [ ] **UL N reading** — two paragraphs, opens on the code (no entrance, no
      throat-clearing), names both faces as felt things, ends on what the code
      asks. ~200–280 words.
- [ ] **No section explains its own system.** Every section opens on the
      teaching of this code. System terms are glossary taps, not body text.
- [ ] **ICHING** — combination reading teaches the image; main reading is the
      situation + image; six moving lines each self-contained with a becoming
      hexagram; Judgement/Image freshly rendered, never a source's prose.
- [ ] **GENE KEYS** — Shadow ends on the root belief; repressed/reactive are
      two distinct real people; Gift names the same-energy turn; Siddhi shorter,
      ends on an image.
- [ ] **HUMAN DESIGN** — no "Gate N is the Gate of..." template; gate opens on
      the drive, centre on the meaning of placement, channel on circuitry.
- [ ] **BODY** — poetic, not a biology lesson; lands the inward journey.
- [ ] **RELATIONS** — outward kinship only; "UL N" naming throughout; no
      system re-taught; no internal relating repeated.
- [ ] **Internal vs outward relating** (§2) is not violated in either direction.
- [ ] **Copyright** (`00` §6) — no source named, no borrowed prose, no
      unverified flourishes.
- [ ] **No em dashes** anywhere on the card.
- [ ] **Status set** (`00` §10) — `scaffold` for AI Phase 1, `final` once
      Adrian has personally written or reworked the card.

---

## 5. The JSON shape this method defines

This is the schema `SCHEMA.md` and the generator are reconciled to (decision 4,
§0). One card:

```
{
  "number": 1,
  "status": "scaffold",
  "ul": {
    "card_name": "Earth's Breath",
    "keywords": [ ... 5-7 ... ],
    "reading": [ "...cluster 1...", "...cluster 2...", "...cluster 3..." ],
    "invocation": "..."        // optional
  },
  "iching": {
    "hexagram_name": "The Creative",
    "combination": "...",
    "upper_nature": "...",
    "lower_nature": "...",
    "reading": "...",
    "judgement_lines": [ "...", "..." ],
    "image_lines": [ "...", "..." ],
    "lines": [
      { "line": 1, "image": "...", "reading": "...",
        "becomes": { "hexagram": 44, "name": "Coming to Meet" } },
      ... 6 total
    ]
  },
  "gene_keys": {
    "shadow_name": "Entropy", "gift_name": "Freshness", "siddhi_name": "Beauty",
    "shadow": "...", "repressive": "...", "reactive": "...",
    "gift": "...", "siddhi": "..."
  },
  "human_design": {
    "keyword": "Self-Expression",
    "gate": "...", "centre": "...", "channel": "..."
  },
  "body": {
    "physiology": "...",
    "amino_acid": "..."
  },
  "relations": {
    "paired_hexagram": "...",
    "programming_partner": "...",
    "codon_ring": "...",
    "tarot": "...",
    "deeper_correlation": {
      "trigrams": "...", "immortals": "...", "golden_dawn": "..."
    }
  },
  "meta": { ... }
}
```

Markdown markers (`**bold**`, `*italic*`) do **not** belong in JSON string
values — emphasis is the card renderer's job, not the data's. The generator
strips them; the card styles structurally.
