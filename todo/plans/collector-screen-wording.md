# Collector journey — the flow and its wording

> **What this is.** The ongoing record of every screen in the collector flow, in walking order,
> with its exact wording. Worked line by line with Adrian in conversation, 2026-08-09. Each
> screen is marked **LOCKED** (Adrian's words, settled) or **PROPOSED** (drafted, not yet worked
> through with him). Locked copy is used verbatim in design and build; do not paraphrase it.
>
> Companion to `collector-design-handoff.md` (how to brief Claude Design) and
> `the-collector-journey.md` (what each step must accomplish).

---

## The pillar — why any of this moves a person. SETTLED

Every screen's copy hangs off this paragraph; when a line drifts from it, the line is wrong.

> We are drawn to these pieces by resonance. The people who hold them are connected by
> something that cannot be spoken, and the globe is where that shows: a resonant grid across
> the planet, people who cherish what these pieces hold. Meaning is made by putting love into
> something. When you feed the fire, the fire grows. And everything placed inside a piece
> lives with it beyond any of our lives. What you choose to put in it, and why you brought it
> into your life, belongs to its whole story: whoever holds it hundreds of years from now
> inherits what you placed there. So give this process a minute. It will live with the piece
> forever.

**The audience is warm, not cold.** Nobody reaches this flow by accident; they paid real money
for a physical piece. The screens recognize a member, they do not persuade a stranger.

**The honest scale is earliness.** Never claim a crowd. Claim the pieces, which exist in the
hundreds across the world; the crowd of registrants is still forming, and being early is the
privilege.

**The daily gaze (added 2026-08-09).** Everything placed in the piece is connected to it.
Every time the caretaker looks at it, on their wall, in their home, they feel what is in
there, and what is important to them is reinforced. The piece practices their intentions back
at them, daily, whether they think about it or not. This is the strongest personal reason to
write carefully, and the writing screens should reprise it in one clause.

---

## The flow at a glance

1. **The piece page** — the QR landing, one page for everyone: the piece shown publicly, the
   Unlock door at the bottom. SHAPE LOCKED 2026-08-09, row wording proposed.
2. **The unlock** — the same page, morphed: the pill becomes the code field. Copy LOCKED.
3. **Code confirmed** — the threshold crossed; the project introduced; the fork. LOCKED.
4. **The four screens** — the pull · the grid · the love · it carries on. LOCKED.
5. **The writing** — name, story, privacy, birthday, the registration itself. NOT YET WORKED.

The same unlock door serves first registration, transfer, gift, and dispute; the system
routes behind it after the code. There is no separate transfer entrance: the piece carries
its own door on its body, forever. **The old separate arrival screen and code-entry screen
are superseded by the two-state piece page; the two-doors question (register or dream) died
with them.**

---

## 1. The piece page — the QR landing. SHAPE LOCKED, row wording proposed

One page for everyone who scans or types the piece's address. The piece shows itself
publicly; the code is the deeper door on the same page. Replaces the separate arrival and
code-entry screens (Adrian, 2026-08-09: "I like this better").

**Resting state:**

> *(photograph of the piece, leading)*
>
> UNIVERSAL LANGUAGE 1
>
> **Earth's Breath**
>
> Registered · a light in the Resonant Grid *(or: Not yet registered)*
>
> The story
> The certificate
> The history
> The dreams
> Into the artist's website
>
> **[ Unlock ]**
>
> Where is my code?

The rows are a hairline list, each a click deeper into the public layers: story, materials
and making, the public history spine, the dreams their caretakers chose to share, and the
road into the full site. The registration line is the authenticity, visible to anyone. A
visitor with no code gets a complete experience; this is also what a guest who scans the
piece on a caretaker's wall sees.

**What was paid lives behind the code, always.** Public rows carry story, materials, year,
history, shared dreams. Price and the private record belong to the caretaker's side, after
the unlock.

**Page behaviors (Adrian, 2026-08-09):**
- **The photograph slot has an empty state.** When no photograph exists, the slot shows the
  piece's line drawing and a place to add a photograph. Adding one is a caretaker act, behind
  the unlock; a visitor only ever sees the drawing standing in. The page never shows a broken
  or blank image.
- **The registered line reads the truth:** "Registered · a light in the Resonant Grid" or
  "Not yet registered."
- **Rows expand in place, not navigate away.** Tapping a row animates it open until it is the
  full surface: the row's title at the top, its content beneath, the rest of the page giving
  way. Closing returns to the page. One motion vocabulary for all five rows; simple React,
  nothing heavier.

## 2. The unlock — same page, morphed. Copy LOCKED

Tapping Unlock melts the pill into the code field; the keyboard rises; the instruction
appears. The locked "Turn the piece over" copy lives here, compressed to the moment it
serves:

> *[ code field ]*
>
> Turn the piece over. The code is written on its underside, and only its caretaker can see
> it.
>
> Whoever holds the code holds access. Keep it safe.
>
> **[ Unlock ]**
>
> I don't have a code

**The motion — LOCKED, Adrian's spec.** On Unlock the characters resolve one at a time, like
tumblers finding their places, a pause, one soft click as the last one seats. Then the screen
itself opens like a vault: the dark ground parts and warm light comes through the opening,
and the light carries you onto the next page, which is "The code is true." No button press
after the click; being carried through is the reward. The whole passage two to four seconds,
never longer. This is the biggest moment of motion in the flow: it is the threshold, and
nothing after it competes with its scale. Plays as a gentle fade for anyone with motion
turned down.

**Motion everywhere else — subtle payoffs, Adrian's call 2026-08-09.** Small animations
between and inside screens keep the walk engaging; each one enacts its screen's meaning,
never decorates:
- Screen one, the pull: the line drawing draws itself, the stroke tracing the piece into
  existence over about a second and a half.
- Screen two, the grid: the globe arrives dark; lights come on one by one and thin lines
  weave between them as the word "grid" is read.
- Screen three, the love: the drawing's glow swells once, softly, as the screen settles.
- Screen four, it carries on: the words arrive line by line in reading order, like being
  written, ending on the Begin pill.
- Between screens: slight upward drift and crossfade, under half a second, pages lifting.

Rules protecting it: every animation plays once, on entry, then stillness, nothing loops; a
tap always interrupts, completing the animation instantly and advancing; the vault stays the
only big one, payoffs live under a second and a half; reduced motion gets clean fades
everywhere.

**Approved but never blocking (Adrian, 2026-08-09).** The payoffs are additive: the screens
ship with plain fades first if that is faster, and each animation layers in afterwards
without changing any copy or layout. Only the vault threshold is worth holding a ship for,
and even it can arrive one release later than the screens.

**Why the warning lives here.** "Whoever holds the code holds access" was cut from the opening
sequence; it belongs on the one screen where the code is in the person's hand.

---

## 3. Code confirmed — LOCKED (first caretaker); passing variant PROPOSED

**Drawing.** The piece, face on, whole again: they just saw its underside, turning it back
over completes the gesture the entry screen opened.

**First caretaker:**

> **The code is true**
>
> Earth's Breath is real, and it is in your hands. It is one light in the Resonant Grid: a
> living artwork spread across the world. The next few minutes register it as authentic and
> as yours, and give it its place.
>
> **[ Continue ]**
>
> This piece is for someone else

**The fork (Adrian, 2026-08-09).** Continue registers it to you; the quiet link serves
whoever holds a piece meant for another: the gift buyer, the seller, the inheritor helping a
parent. It opens the passing: name the person, they receive an invitation carrying the proof,
and the piece registers to them. One brass pill, one text link; the hierarchy carries the
meaning.

**"The code is true" belongs to first registration only.** Every other situation behind the
unlock has its own screen and its own temperature; see the fork below.

**The fork — LOCKED 2026-08-09.** Tapping "This piece is for someone else" opens one choice,
two hairline rows, two intentions separated before either begins:

> **For someone else**
>
> **Giving it as a gift** · leave your wishes with the piece; they are sealed until its new
> caretaker unlocks it
>
> **Passing on my own piece** · begin handing your caretakership to another

**The gift path — LOCKED. No ownership moves.** The giver writes wishes; they seal into the
piece; the record stays untouched. The wishes live with the piece forever: opened once by
the receiver, then part of its story permanently.

Giver's side:

> **Leave your wishes with it**
>
> Write what you wish for the one who will hold this piece. Your words seal into it, greet
> them the day they make it theirs, and live with the piece forever.
>
> **[ Seal your wishes ]**

Receiver's side, shown right after the vault opens, before everything else:

> **Something was left for you**
>
> Whoever gave you this piece placed words inside it, sealed until this moment.
>
> **[ Open them ]**

Then the walk begins, with the giver's love already in the room.

**The transfer path — LOCKED. Weighted like it deserves, it does not soften:**

> **Passing it on**
>
> You are releasing Earth's Breath to its next caretaker. Everything you placed in it stays
> with the piece forever, as its story. When they accept, your hold ends and theirs begins.
>
> **[ Begin the passing ]**
>
> Not now

**The receiving side of a held piece — LOCKED.** No duplicate headline; patient, not
grasping:

> **A passing begins**
>
> Earth's Breath is real, and it is in your hands. But it is held by another caretaker, and
> nothing moves without them. We will ask them to let go; when they do, it becomes yours to
> carry.

**Dispute (both claim, nobody confirms):** one honest line, no pretending: "This needs a
person. Adrian will be in touch."

**Four temperatures, held deliberately:** the fork neutral, the gift warm, the release
grave, the receiving patient.

**Sacred rule.** The code alone never transfers ownership. The screens may say "it is in your
hands" because that is physically true, but becoming caretaker of a held piece always waits
for the current one to let go. Silence is never consent; no copy may imply the piece can be
taken.

**Why this screen exists.** Adrian split the code moment in two: entry stays ritual,
confirmation introduces the project. "The code is true" is the one thing that just happened,
stated bare. Then the project gets its name, the scale gets stated, the time gets promised:
three jobs, three sentences.

---

## 4. The four screens — LOCKED, Adrian's words, verbatim

One idea per screen, nearly empty, walked in fifteen seconds. A welcome to a confirmed
caretaker, never a pitch: by this point the code has already proven the piece is in their
hands.

**One · the pull** (drawing: the piece, face on; no eyebrow, no label)

> **You felt the pull**
>
> Perhaps it was beauty. Or the story. Or just a feeling beyond words. There was a connection.

**Two · the grid** (drawing: the globe, lights across it)

> **The resonant grid**
>
> The ones who hold these creations feel it too. They weave a grid across the planet. And you
> are a part of that.

**Three · the love** (drawing: open call, possibly none)

> **When you focus your love, it grows**
>
> Infuse your love into this art and its light shines brighter. Every time you see it, you
> will feel everything it holds, and the resonance you have placed within it.

*(Adrian's line, extended 2026-08-09 with the daily gaze: the piece on the wall returns what
was placed in it every time eyes cross it. If he prefers the double echo, the last clause
reads "the resonance you have infused it with.")*

**Four · it carries on** (no drawing: the only screen without one, the words alone)

> **It carries on**
>
> Hundreds of years from now, whoever is fortunate enough to caretake this art will feel the
> love you have infused it with today. Everything you enter now will live with it forever.
>
> So take a moment, and write your story.
>
> **[ Begin ]**

**Attention mechanics, analyzed and settled:**
- Fifteen words per screen defeats skimming: the glance is the read, there is nothing to skip past.
- The headlines alone tell the whole story for the fast reader: *You felt the pull · The
  resonant grid · When you focus your love, it grows · It carries on.*
- Nothing is asked on any of the four: pure receiving. People abandon forms, not stories.
- **No skip link. Tap anywhere advances.** The fast lane is built in: four taps in four
  seconds still delivers the arc. A skip link would cost more attention than it saves and
  teach everyone the screens are optional filler.
- The button is **Begin**, not "Write your story": the press must deliver exactly what it
  promises. The body sets the heart; the button stays honest.
- No consent language anywhere in the sequence. "If you choose to be seen" was cut; the
  privacy screen makes that offer on its own terms, without implying the light glows more if
  you go public.

---

## Vocabulary — decisions carried by every screen

- **Caretaker / caretake.** LOCKED, Adrian confirmed 2026-08-09. The word for the person, on
  every screen, everywhere. Not holder, not keeper, not steward. Arrived unprompted in his
  most emotional sentence, which is why it is the true one.
- **The Resonant Grid.** LOCKED, Adrian confirmed 2026-08-09. The proper name of the living
  artwork, elevated from his own phrase. Named twice before it is unfolded: once on arrival,
  once on code confirmed; screen two of the four is then recognition, not surprise. Permanent
  public vocabulary.
- **Unlock.** LOCKED, Adrian confirmed 2026-08-09. The code button. One word, physical,
  matches the tumblers, promises exactly what happens.
- **Outcomes, never mechanics.** Screens name what the journey does (certify, register, give
  it its place), never the steps (privacy settings, birthday, email). Each screen explains
  only itself when it arrives.
- **"Forever" is permitted.** It is Adrian's voice and the record travels with the piece. The
  one bound honored: never promise permanent hosting of heavy media in copy; that constraint
  bites at the video step, not here.

---

### Superseded: the standalone arrival screen (2026-08-09, same day)

An earlier draft had arrival as its own screen with a "Register and certify this piece" pill
and a possible dream door. Adrian replaced it with the two-state piece page above: the public
showcase and the unlock live on one page, and the dream door question died. Kept here only so
the reasoning survives; do not design the standalone version. One line from it worth
reusing somewhere on the piece page or its story row: **Part of the Resonant Grid: every
piece Adrian has released into the world belongs to one living artwork. Each piece is a
light. Each caretaker feeds it.**

---

## 5. After Begin — data first, the garden of questions, the light

**Structural rules — LOCKED 2026-08-09, Adrian's words:**

- **The unlock code is for claiming and transferring only.** It is used at first claim and
  when the piece changes hands, and otherwise sleeps. "We want people to keep that key really
  safe." The daily return is through the account: a logged-in caretaker who scans their piece
  lands on the piece page with a quiet Add to your piece; the garden reopens from there. No
  code for everyday life.
- **Data first, story later.** Name, email, birthday, socials are gathered right after Begin
  while momentum is high. The story takes long and is returnable forever; it must never gate
  registration.
- **The writing is a garden of chosen questions, never a blank page.** A set of questions;
  the caretaker picks which to answer, in any order, now or across years.
- **Brightness is defined: the more questions answered, the brighter the light.** This
  resolves the long-open brightness question. Contribution is answering; the light warms with
  each answer, at ignition or a year later.

**The map (shape proposed, wording to be worked screen by screen):**

1. **Sign its record** — name and email; the account born as a signature.
2. **Who you are** — birthday, socials, business; every field private by default, said
   quietly as it collects.
3. **What shows** — the rings page, right after collection, concrete because the data now
   exists.
4. **The questions** — the garden: why this piece found you, what you wish over it, the
   dream, what it should tell the next caretaker. Answer any, none required, waits forever.
   Each answer brightens the light.
5. **You are Light 47** — ignition; the light appears dim and warms with answers.
6. **Home** — the piece page as caretaker, with Add to your piece from then on.

Open shape calls: the dream as the garden's most honored question versus its own screen
(lean: inside the garden); privacy as the one rings page after collection versus per-field
switches at collection (lean: one page, the spec's long rule).

## The earlier writing-screen sketches — superseded shape, kept for the wording

The registration steps themselves: name, the first words placed in the piece, privacy, birth
details. The screens below are early proposals from before the conversation reshaped the
opening; they need the same line-by-line pass with Adrian before any design. Vocabulary
updated to caretaker/grid; nothing here is locked.

### Privacy — the four rings on one page

Decided once, one page, plain words. Everything starts private; each ring opens on its own
and none opens because another did.

Drawing: four concentric rings around a small piece, drawn as orbits.

- Eyebrow: YOUR PRIVACY
- Headline: You choose what shows
- Body: Everything is private until you open it. Each choice stands alone, and you can change
  any of them later.
- The four rings as a hairline list, plainest words: your private record (always private, no
  switch, the row states itself) · a dot on the map (your city, never an address, off until
  you open it) · your chart (what your birth details produce, never the details, off) · you
  (name, face, intention, business, mission: five switches, each off).
- Primary: Keep these choices
- No skip link: continuing with everything closed is the skip.
- Open call: whether ring four's five switches sit on this page or one tap deeper. Lean: one
  tap deeper, the page stays four calm rows.

### Birth details

Asked during registration, framed as connection to the wider system, never displayed,
skippable, addable later. Adrian's rule overrides all earlier positions. Wording not yet
worked; it must follow the four screens' emotional case, which is what earns the ask.

### The invitation (door two, no printed code)

Reads as a letter from Adrian, not a form. Drawing: the sealed letter.

- Eyebrow: AN INVITATION FROM ADRIAN
- Headline: Earth's Breath is waiting
- Body: You have held this piece since before its record began. This invitation brings it
  onto the registry, with its history yours to complete.
- Primary: Accept the invitation · Secondary: This is not my piece
- Error includes expired or already used: "This invitation has already been answered. If that
  was not you, contact Adrian."
- Open call: what proof the invitation carries. Blocks the build, not the wording.

### The piece page after registration

The room the flow opens into; the densest screen; locks the look for everything outside the
setup flow. Reading order: the artwork, the certificate block, the public history spine, your
private record, what shows (the rings, changeable here), your dream, letters from the piece,
the ordinal with its map dot. Section titles one or two words: Certificate · History · Your
record · What shows · Your dream · Letters. Empty sections carry one quiet line: "Nothing
written yet."

### The dream

One dream at registration, planted, not filled in. Never work, always a gift. Skippable
without cost. No approval gate ever; nothing counts, scores, or ranks it.

- Headline: Plant a dream in it
- Body: One dream, held by the piece. Yours alone unless you choose to share it, in words
  with no name.
- The four scopes as a hairline list; names are Adrian's call. Proposal: For me · For someone
  I love · For my work · For the world.
- Primary: Plant it · Secondary: Not yet
- Sorting, not rejection: words about a business, a place, or a person are offered their
  right home, never refused.
- Drawing: open call. Everything else is a real object; the dream is the first screen that
  wants a metaphor. Candidates: a seed drawn as a technical drawing, or the piece with an
  empty inscription line beneath. Adrian's pick.

### The globe

The moment the piece becomes a light. A confirmation, not a map to browse. Two loaded states:

- Map ring open: headline "You are Light 47" · body: Earth's Breath now shines at city level
  from where you are. Never an address, never your name unless you opened them.
- Map ring closed: same headline · body: Earth's Breath is registered to you and recorded. No
  light shows on the map; that choice stays yours.
- The ordinal is permanent and belongs to the claim order across all pieces and all series.
- Drawing: the globe as a wireframe, one point lit. The lit point is ink, not brass; it is
  not something you act on.

### Inviting loved ones — the family of the piece. DECIDED 2026-08-09

The caretaker can invite others, a spouse, children, to place their love into the piece.

- **When: a letter from the piece, weeks after registration**, plus a standing quiet door on
  the piece page from day one. Registration itself stays solitary: one voice, one story. The
  letter makes the offer feel like the piece asking, not the app upselling, and it is the
  return loop working. Letter wording to be worked when letters are worked.
- **Placing love is never ownership (locked).** An invited loved one is known by name and
  relation; they gain no code, no transfer right, no inheritance. An invitation to love is
  never an invitation to inherit.
- **The family is the caretaker's domain (Adrian's rule).** Who they invite, who writes,
  whether a child's words go in: their call, and the system never plays chaperone inside a
  family's private record. One narrow rail only: a child's words cannot be switched public
  until that person is grown and chooses it themselves. Private is untouched; the rail bites
  only on publishing, and it protects Adrian as the publisher.

### The yearly ritual

Once a year, near the caretaker's birthday. Three choices, never a blank form. No counts, no
streaks, nothing accumulates in public.

- Eyebrow: A YEAR WITH EARTH'S BREATH
- Headline: The year turns
- Body: Near your birthday, the piece asks once. Three ways to answer, none required.
- The three choices: Reinforce the dream it holds · Plant a new dream · Mark it fulfilled
- Secondary: Not this year
- Drawing: the piece with a single orbit line around it: one year, drawn.

---

## Design rules shared by every screen

- **Shape:** one line drawing in the upper third, headline short, body brief, one brass pill
  in the lower third, skips as plain text links, no navigation beyond a quiet back link.
  Choice screens use a hairline-divided list, not buttons.
- **Brass only on the thing you can act on.** Everywhere else is espresso and black.
- **The drawing is a real object from this system**, drawn as a technical line drawing:
  outline only, uniform thin stroke, no fill, no shading, one motif per screen.
- **Every screen carries three states:** loaded, empty, error.
- **Walking example:** Earth's Breath, Universal Language 1. Every screen swaps in the real
  piece at runtime. Ordinals shown are samples.
- **Dark first, light follows.** Dark is metallic and meditative; light is the same screen
  hung in a lit room: paper grounds, the same drawings in darker ink, brass unchanged.

---

## Status of the visual round

Round 1 in the Claude Design project (four options of the old single-screen opening) predates
the conversation that produced this flow. It is the visual-direction reference only: espresso
grounds, CAD line drawing, brass pill, type scale. The next design session builds the locked
screens above in whichever direction Adrian picks, one screen per session.
