# Collector wording proposals — 2026-08-12

> Two alternatives per screen, for the three unlocked areas named in `HANDOFF-COLLECTOR.md`:
> the passing, the household, the arrivals. Current copy is the placeholder already built
> in `todo/plans/collector-primitives.html` and recorded in `collector-screen-wording.md`
> section 6 ("None of the copy below is locked"). Nothing here is applied to code. Pick a
> letter per screen, or say "keep the placeholder," and it gets locked and wired in.
>
> Voice sources: `i64os/substrate/directions/voice-profile.md` and `body-of-work.md` — no
> em-dashes, taste stated flat, "but" as pivot not negation, name the object bare, no
> repeating sentence-frame across screens, quality words (sharp, precise, cohesive) over
> vague praise.

---

## The passing

**Current placeholder** (`passfork` in collector-primitives.html):

> **Passing it on**
> Two ways a piece moves, and they are not the same act.
>
> To someone you love — they are already on the piece, and it stays inside the house
> To someone buying it — a stranger receives it, and what travels is decided now
>
> *Not now*

### Option A — closer to the placeholder, tightened

> **Passing it on**
> A piece moves in one of two ways, and they are not the same act.
>
> To someone you love — already on the piece; it stays inside the house
> To someone buying it — a stranger receives it, and what travels is stated now, not decided later
>
> *Not now*

*One-line preview: same shape, sharper — "stated now, not decided later" replaces the
vaguer "decided now" with the actual promise (the sale screen states what travels, it
doesn't triage it).*

### Option B — leans on the weight of the act

> **Who receives it**
> The piece is leaving your hands. Where it goes changes what happens next.
>
> To someone you love — already on the piece, and nothing about this is new to them
> To someone buying it — a stranger, and what travels with it is theirs to know before they hold it
>
> *Not now*

*One-line preview: names the moment first ("leaving your hands") before naming the choice,
more grave, matches the "does not soften" instruction already locked for the transfer path
elsewhere in the flow.*

---

## The household

**Current placeholder** (`ritualfamily`, "The people you love"):

> **The people you love**
> Each person you have invited is asked near their own birthday, and each places one thing
> for the year. Theirs pass through you once before they show, for typos and judgement,
> never for permission.
>
> *Anything not passed simply does not show this year. Nothing is lost; it waits. A
> child's words never carry a name, whatever is chosen.*

### Option A — trimmed, same register

> **The people you love**
> Everyone you have invited is asked at their own birthday, and each places one thing for
> the year. What they write passes through you once, for typos, never for permission.
>
> *Nothing not passed this year is lost, only waiting. A child's words never carry a name.*

*One-line preview: cuts "judgement" (redundant beside typos, reads corporate-adjacent) and
tightens the note to one sentence, same meaning, less scaffolding.*

### Option B — bare, leads with what the screen is

> **Who else is in it**
> The people you have invited place their own words, each at their own birthday. You read
> what they write once, for typos, and nothing more.
>
> *Skipped this year is not lost. A child's words carry no name, ever.*

*One-line preview: material-first heading ("who else is in it" names the object, not a
feeling) and drops "judgement" and "permission" as a pair, since "nothing more" already
says the caretaker's role stops at typos.*

---

## The arrivals

The button labels themselves ("Begin," "Look through it," "Sign in to tend it," "I hold
this piece") are already SETTLED in `collector-screen-wording.md`. What is genuinely open
is the short line that sits with them: today the unclaimed state has none beyond the
status text, and the registered states only carry the status line, not a line explaining
what the two doors are for. Two spots, two options each.

**Spot 1 — beneath Begin, unclaimed state.** Currently nothing sits here beyond "Not yet
registered."

- **Option A:** *One piece, one place, forever. Begin gives it its own.*
- **Option B:** *This piece has no home yet. Begin gives it one.*

*One-line preview: A is more abstract/system-level (echoes "one page, one address,
forever" from the handoff itself); B is more concrete/object-level (names the piece, not
the system). Lean B — it keeps the material-first rule and doesn't reach for the
capital-letter system language a first-time scanner hasn't earned yet.*

**Spot 2 — beneath the two doors, registered-not-yours state.** Currently nothing beyond
the status line ("Registered · a light in the Resonant Grid").

- **Option A:** *Someone already tends this piece. Look through it, or say it is yours.*
- **Option B:** *This one already has a caretaker. You can still look, or step in as
  yours.*

*One-line preview: A is shorter and more declarative; B softens "step in as yours" as an
option rather than a claim. Lean A — matches the "neither door above the other" rule more
plainly, and "say it is yours" mirrors the doors' own verbs (look / tend) without adding a
third verb.*

---

## The two small UX calls

Both are named as open in the handoff. Stating each crisply with a lean, per the recommend-
don't-ask convention.

**1. The photograph: shrink to an anchor, or collapse when a row promotes.**
Built as shrinking. **Lean: keep shrinking.** A row that fully replaces the photograph on
open (collapse) breaks the "the drawing/photo leads" rule that holds on every other screen
in the flow — the piece itself should stay visible as the anchor while a row opens beneath
it, not vanish the moment someone reads. Shrinking is also cheaper motion: one property
(size) animates instead of a layout reflow, consistent with the "simple React, nothing
heavier" instruction already given for row-opening.

**2. Link services: three plus an add-another tile, or five fixed slots.**
Built as three plus an add-another. **Lean: keep three plus add-another.** Five fixed
slots (Instagram/X/Facebook/YouTube/website) means four are usually empty for anyone who
only uses one or two platforms, which reads as orientation tax on a screen already marked
"fully skippable, its own temperature." Three most-common plus an open slot covers the
common case without the empty-row wallpaper, and it matches the "add anything more" tile
already specified for this exact screen in the wording doc.
