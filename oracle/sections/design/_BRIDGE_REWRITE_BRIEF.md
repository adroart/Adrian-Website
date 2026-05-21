# DESIGN bridge-rewrite brief

The first DESIGN pass assumed the reader knew Human Design. Adrian's
correction:

> "Let's assume everyone is a newcomer. This oracle is a bridge. We don't
> have to explain the system, but we have to share something in the oracle
> that you don't have to know the whole system to understand."

This pass rewrites DESIGN so every card teaches its code through felt truth
and function, never through HD framework. The architecture (gate number,
centre name, channel name) stays in the JSON as quiet metadata, but the
prose itself works for someone who has never heard of Human Design.

## Your task

Rewrite the THREE prose fields (gate, centre_field, channel) for the assigned
card. Keep all metadata (gate_number, gate_keyword, centre, channel_keywords)
untouched. The reader-facing field names DO NOT change in the JSON — they
remain `gate`, `centre_field`, `channel` so the card UI can still render
them; how the card UI labels them is a downstream decision.

## The bridge rule (the spine)

A newcomer to Human Design must be able to read this card and get the whole
teaching. The system terms (gate, centre, channel) and the chart shapes
(diamond, upside-down triangle, small red triangle, square at the base of the
spine) do not appear in the prose. Ever.

**Forbidden in the prose** (any field):
- The words "gate", "centre" (or "center"), "channel" — except as glossary
  taps the card UI will style; you write plain English. (Where the original
  prose said "This gate sits in the centre of identity," rewrite to "This
  drive is wired to the part of you that holds who you are.")
- Chart shapes: diamond, upside-down triangle, small red triangle, square
  at the base, the body-map, the chart, the design.
- HD-specific framework references: "the body-graph", "the chart", "the
  design", "Human Design".
- Mid-conversation framing: "Half a circuit", "A gate is only half...",
  "As a gate, this code is..." Open from the felt truth of what this code
  does in a person.

**Allowed** (carefully):
- The gate's keyword (e.g. "Self-Expression", "Direction of the Self") if it
  is needed once to name what the code is about.
- The channel's lineage name (e.g. "the channel of inspiration") if needed
  once, framed as something the lineage calls this connection — not as a
  technical term the reader is expected to recognise.
- Body language: liver, heart, breath, gut, throat (as the throat, not as
  "the throat centre"). The body is the bridge; the chart of the body is
  not.

## The three fields, rewritten as the bridge

Each field still does its original job. Only the framing changes.

| Field | Old role | New role (bridge) |
|---|---|---|
| `gate` | What this code IS as a gate, the felt drive | The drive itself, named and described. What it feels like in a person carrying it. The misread of what it is. |
| `centre_field` | The centre this gate sits in and why placement is the teaching | Where this drive lives in you, described by what that part of you DOES (holds your identity, drives most of what gets done, listens for safety, etc.) — never by chart-shape or HD-term. |
| `channel` | The structural fact that this gate is half a circuit | What this code needs to come alive in a life. The other half it reaches for, named by function, not by gate-number or "circuit". |

## Length

Same ceilings as before: each field 130-180 words, hard ceiling 185.

## Voice (locked, unchanged)

- Intimate teacher, plain, warm
- No em dashes, no en dashes
- No banned KEYS openers (no "There is a...", no "Something + verb when...",
  no "At some point/Eventually/Far enough/One day...")
- No previous DESIGN drift formulas (no "The centre this gate sits in...",
  no "Half a circuit...", no "As a gate, this code is...")
- Read the three opening sentences in a row; if any two share an opening
  word or syntactic shape, rewrite one

## The reference — UL 2, rewritten to the bridge (Adrian-locked)

This is the level. Read it as someone who has never heard of Human Design.

**gate (~155 words):**
> Underneath any life that looks chosen, there is a quieter pull underneath
> the choosing. This is that pull. It is the slow magnetic tug toward the
> direction that is actually yours, the one you did not pick from a menu so
> much as recognise when it appeared. The drive is receptive, not assertive.
> It listens for what wants to come through and lets that set the heading.
>
> The misread is to call this passivity, or indecision, or a lack of
> ambition. It is none of those. It is a kind of attentive waiting that
> knows the right course will arrive and refuses to fake one in the
> meantime. A person carrying this often looks aimless from the outside,
> and feels, on the inside, like they are doing nothing while doing the
> most important thing. The pointing is happening underneath. They are
> being aimed.

**centre_field (~125 words):**
> This drive is wired to the part of you that holds *who you are* and
> *which way your life faces*. That is the whole teaching. Direction here
> is not a strategic decision laid out from the head. It is a property of
> selfhood itself. The course your life is meant to take is bound to who
> you are, not to what you choose, and the choosing only ever works when
> it follows the deeper aim.
>
> When the listening is honest, the path appears. When it is hijacked by
> ambition borrowed from elsewhere, the body keeps walking and the life
> keeps drifting.

**channel (~165 words):**
> Direction alone is a heading with nothing under it. This code knows where
> life is meant to go, but knowing the heading is not the same as moving.
> The body still has to walk it. The aim still has to find an engine, the
> responsive kind that gets up in the morning and does the next thing.
>
> That engine lives in another part of you, the part that drives most of
> what gets done day to day. The pull of true direction reaches for it, and
> when the two connect, the inner heading becomes a working rhythm. The
> direction gets metabolised into action that has stamina, and the action
> gets steered by something truer than ambition. Without the engine, the
> pointing stays a pointing, never quite arriving in a life. Joined, the
> heading and the rhythm become a person walking the road that was actually
> theirs.

Notice: no "gate", no "centre", no "channel", no chart shape. The architecture
(Gate 2, G Center, Channel 2-14, Channel of the Beat) stays in metadata. The
reader gets the teaching whole without needing to know any of it.

## Per-card data

Look up your card in `_per_card_reference.json` for the metadata (gate
number, keyword, centre name, channel partner(s), channel keyword). You may
read the vault gate / centre / channel files for context but DO NOT
reproduce their language. Translate every HD term in the source into the
felt/functional equivalent.

For Integration cluster cards (gates 10, 20, 34, 57) the channel field still
teaches the multi-reach nature, but in plain English: "this code reaches for
three different partners rather than one, an unusually woven situation."

## Output

Save back to the existing `oracle/sections/design/NN.json`. Update the
three prose fields. Leave metadata fields untouched. Set
`meta.generated` to `"design-bridge-rewrite-v1"`.

## When done

Report card number, the three new opening sentences, word counts, and confirm
"no HD jargon, no em dashes, no chart shapes, openers vary".
