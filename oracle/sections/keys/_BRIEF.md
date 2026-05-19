# KEYS section — generation brief

You are writing the **KEYS section** for one card of the Universal Language
Oracle, a 64-card deck. KEYS is the Gene Keys voice: the Shadow / Gift / Siddhi
spectrum of one of the 64 codes. This brief is the locked standard. Follow it
exactly. Card 1 (UL 1, "Earth's Breath") was written with Adrian line by line
and is the reference; match its level.

## Your task

For the assigned hexagram number, read that hexagram's Gene Keys source from
the Obsidian vault, then write the KEYS section and save it as JSON.

**Source to read** (in `~/Documents/Obsidian Vault/oracle/hexagrams/NN/`):
- `gene-key-NN.md` — the full Gene Key chapter (Rudd's long text)
- `gene-key-NN-<slug>.md` — structured reference: the card name, the
  Shadow/Gift/Siddhi names, repressed/reactive, codon ring. Use this for the
  exact names.
- `gk-64ways-NN-<slug>.md` — Rudd's "64 Ways" contemplative version

Read all three before writing.

**Output:** write `oracle/sections/keys/NN.json` (zero-padded, e.g. `07.json`).

## The voice (locked, non-negotiable)

- **Intimate teacher.** Warm, direct, speaks to a reader. Alive on the page.
- **NO EM DASHES. NO EN DASHES.** Anywhere. Ever. Commas, periods, line breaks
  only. This is absolute. Check every sentence.
- **Describe the energy, never diagnose the reader.** Never "you are numb."
  Write "numbness is..." A reader living in the Gift and a reader in a flat
  stretch must both be reached. Name the *misread* ("most people treat this as
  a fault"), never the reader's failure.
- **Each frequency carries its own resolution.** The Shadow shows the door out
  woven inside itself (the low fire is not a dead fire). The Gift leans toward
  the Siddhi. The Siddhi closes the loop back to the Shadow as belonging, not a
  flaw. The way through is woven in, never a tacked-on solution.
- **Catch the Gene Keys aliveness in original words.** Commit to an image and
  carry it through the frequency. Write with conviction and warmth. NEVER
  reproduce Rudd's prose or his coined phrases. The architecture (Shadow / Gift
  / Siddhi) and the three frequency names are the kept lineage; every sentence
  of the body is yours.
- **No system jargon as scaffold.** Do not explain "what the Gene Keys are."
  Open on the teaching itself.

## The four "reads-as-human" cuts (audit every paragraph)

AI prose has four tells. Cut all four:
1. **No symmetry.** No balanced pairs, no "not just X but Y", no tidy triads
   (three adjectives/phrases in a row). Paragraphs uneven in length on purpose.
2. **No summary sentence.** Never the line that steps back and announces what
   the paragraph meant. State it plain and move on.
3. **Plain vocabulary.** Avoid "profound", "journey", "embrace", "navigate",
   "essence", "transformative", "at its furthest reach". Reach for the plain
   word.
4. **End a beat early.** No neat bow, no resolving flourish. End on a small,
   plain, or slightly rough clause. Stop before the reader expects.

Keep deliberate human unevenness: fragments, blunt short sentences, a clumsy
tack-on left clumsy ("which is harder").

## Structure and length

Five fields. **Hold the word counts. They are real limits, not minimums.**
Adrian set 180-200 specifically so the writing depicts clearly without padding.
Going over 200 means cutting, not "the card needed room." If you land at 230,
trim it to 200 before you save. Tight writing is the standard.

- `shadow` — the low frequency. **180-200 words, hard ceiling 205.** Describe
  it as energy. Name the misread. Carry the way through woven in.
- `repressive` — the Shadow's inward face: one real person who goes still.
  30-45 words.
- `reactive` — the Shadow's outward face: a different real person who speeds
  up or grasps outward. 30-45 words.
- `gift` — the Gift, opening from the turn out of the Shadow, carrying its own
  reach toward the Siddhi. **180-200 words, hard ceiling 205.**
- `siddhi` — the highest frequency, present tense, spacious, closing the loop
  back to the Shadow as belonging. **150-180 words, hard ceiling 185.**

If a frequency runs long, the fix is never to keep it. Cut the weakest
sentence, tighten the rest. A card that holds 190 words beats one that sprawls
to 240.

## Output JSON shape

```json
{
  "number": NN,
  "section": "keys",
  "status": "scaffold",
  "shadow_name": "<exact name from the vault reference file>",
  "gift_name": "<exact name>",
  "siddhi_name": "<exact name>",
  "shadow": "<~180-200 words>",
  "repressive": "<~30-45 words>",
  "reactive": "<~30-45 words>",
  "gift": "<~180-200 words>",
  "siddhi": "<~150-180 words>",
  "meta": { "source": "vault gene-key-NN", "generated": "keys-brief-v1" }
}
```

Plain strings. No markdown markers (`**`, `*`) inside the string values. No em
dashes inside the string values. Multi-paragraph text uses `\n\n` between
paragraphs.

## The reference — UL 1 (Hexagram 1), the locked standard

This is the level to hit. Shadow: Entropy, Gift: Freshness, Siddhi: Beauty.

**shadow:**
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

**repressive:**
> Some people meet the numbness by going still. They stop reaching for
> anything, decide this flatness is simply who they are, and let the fire bank
> down further. It looks like calm. It is not calm.

**reactive:**
> Others meet it by speeding up. They fill the calendar, stay in motion, keep
> the noise high enough that the silence underneath cannot be heard. They look
> productive. Inside, nothing has warmed.

**gift:**
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

**siddhi:**
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

## Before you finish

1. Re-read your text. Find and remove every em dash and en dash.
2. Run the four cuts: kill any triad, any summary sentence, any elevated
   default word, any tidy bow.
3. Confirm each frequency resolves (carries its way through), and that the
   writing describes the energy without diagnosing the reader.
4. Confirm the three names match the vault reference file exactly.
5. Write the JSON file. Report the card number, the three names, and confirm
   "no em dashes" when done.
