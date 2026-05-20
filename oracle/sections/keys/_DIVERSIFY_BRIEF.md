# KEYS opening-diversification brief

The 64 KEYS files have all the right content, but a survey of opening
sentences revealed a formulaic drift the brief was meant to prevent. Three
patterns dominate:

- 27 / 64 Shadow openings start "There is a..."
- 57 / 64 Gift openings start "Something..." (shifts / loosens / changes)
- 45 / 64 Siddhi openings start "Far enough..."

Read four cards in a row and the formula is obvious. This task fixes it.

## Your job

For the assigned card, rewrite the **first sentence** of each over-formulaic
field. Do not touch anything else in the field. Do not touch any other field.

If the existing opening for a field already varies cleanly, leave that field
alone. The brief tells you which fields to change per card.

## How to rewrite an opening

The new opening must:

1. **Do the same work** the old opening did. (Name the energy, set up the
   paragraph, point the reader at the right thing.) If the second sentence
   depended on the first, adjust the second sentence minimally so the
   paragraph still flows.
2. **Not match the banned patterns above.** No "There is a...", no
   "Something + verb + when...", no "Far enough...".
3. **Stay in voice** — intimate teacher, plain, no em dashes, no triads, no
   summary sentences.
4. **Match the rest of the paragraph in tone and image.** Read the whole
   paragraph first, then write an opener that fits *that* paragraph
   specifically — not a generic one.

Some genuinely varied opening *moves* (the move is the shape; the words are
yours every time):

- Start in concrete physical detail. "The coffee cools. The room you cleaned
  gathers dust again."
- Start with a small observation about people. "People sort themselves into
  ranks the moment they walk into a room."
- Start with the felt experience as a statement. "Numbness is quieter than
  sadness."
- Start with an imperative or invitation. "Watch a street of houses at dusk."
- Start with the misread named. "Most people read the unsettled feeling as
  proof something outside needs fixing. They are wrong."
- Start with a fragment that names the thing. "Pure beginning. The force
  before the form."
- Start with a question (sparingly, max 1 per 64). "Why does the same
  argument keep coming back?"

These are not a template list. Use them as proof that there are many ways in.
**Each card finds its own way in, suited to its own paragraph.**

## Don't change

- The architecture (Shadow/Gift/Siddhi structure)
- The frequency names (shadow_name, gift_name, siddhi_name)
- repressive, reactive, status, meta
- The central image carried through the frequencies
- The misread sentence, the way-through, the closing-loop
- Word count must stay within ceiling (shadow/gift ≤205, siddhi ≤185).
  Verify with:
  ```
  python3 -c "import json; d=json.load(open('NN.json')); print('shadow', len(d['shadow'].split()), 'gift', len(d['gift'].split()), 'siddhi', len(d['siddhi'].split()))"
  ```

## Hard rules

- **No em dashes. No en dashes.**
- No new triads, no summary sentences.
- Valid JSON.

## When done

Report: card number, which fields had their opener rewritten, the old first
sentence and new first sentence for each, verified word counts, and confirm
"no em dashes".
