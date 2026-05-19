# KEYS trim brief

You are trimming an existing KEYS section file to its word ceiling. The text
already exists. Your job is to make it shorter without losing the standard.

## The ceilings (HARD)

- `shadow` — max **205 words** (target 180-200)
- `gift` — max **205 words** (target 180-200)
- `siddhi` — max **185 words** (target 150-180)

Agents have been mis-counting words. **Verify with this exact command** before
saving:

```bash
python3 -c "import json; d=json.load(open('NN.json'));
print('shadow', len(d['shadow'].split()),
      'gift', len(d['gift'].split()),
      'siddhi', len(d['siddhi'].split()))"
```

`split()` on whitespace is the truth. If a field is over the ceiling, the trim
is not finished.

## How to trim well

The existing writing is good. Your only job is to find the weakest sentence
in each over-long paragraph and cut it. Then check counts. Repeat until within
the ceiling.

**Cut the weakest sentence, not load-bearing ones.** Load-bearing sentences:

- The opening sentence (names the energy)
- The misread sentence ("most people read this as...")
- The way-through sentence (the door inside the shadow / the reach in the
  gift / the closing-loop in the siddhi)
- Any sentence carrying the central image

**Weak sentences to cut first:**

- A sentence that paraphrases what was already said
- A second example where one example was enough
- A wrap-up clause that summarises the paragraph
- A clever flourish that is doing decoration, not work

## What must not change

- The three frequency names (shadow_name, gift_name, siddhi_name)
- The status, meta, repressive, reactive fields
- The core image carried through the three frequencies
- The intimate-teacher voice
- The "describe the energy, never diagnose the reader" stance
- The resolution woven into each frequency

## Hard rules

- **No em dashes. No en dashes.** None added, none kept. Replace with commas,
  periods, or line breaks.
- No new triads or summary sentences introduced by the cut.
- Keep paragraph breaks (`\n\n`) intact unless cutting a whole paragraph.
- Valid JSON. Preserve the exact JSON structure.

## When done

Report the card number, the three word counts (verified by the Python command),
and confirm "trimmed, no em dashes".
