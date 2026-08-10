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

> **Superseded in part by section 6 (2026-08-10).** The resting state below still holds for
> a registered piece's public face, but the foot of the page has changed: the single Unlock
> pill is replaced by state-dependent arrival (a lit **Begin** when unclaimed, two peer
> doors when registered, neither when it is yours), and the main dream now leads the page
> above the rows. The fifth row, *Into the artist's website*, is a text link below the list
> rather than a row, because rows open in place and links travel.

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

*(No "where is my code" on the resting page, Adrian 2026-08-09: that guidance lives on the
morphed unlock state, where the turn-it-over instruction already answers it.)*

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
  piece's line drawing with a quiet plus; the caretaker uploads their own photograph. Adding
  one is a caretaker act, behind their login; a visitor only ever sees the drawing standing
  in. The page never shows a broken or blank image.
- **Admin can edit or remove an uploaded photograph, or any shining content, on abuse
  (Adrian, 2026-08-09).** Same shape as the tending model: nothing waits on approval before
  it shows, and Adrian sweeps when needed, quality assurance after publication, never a gate
  before it.
- **The registered line reads the truth:** "Registered · a light in the Resonant Grid" or
  "Not yet registered."
- **Rows expand in place, not navigate away.** Tapping a row animates it open until it is the
  full surface: the row's title at the top, its content beneath, the rest of the page giving
  way. Closing returns to the page. One motion vocabulary for all five rows; simple React,
  nothing heavier.

## 2. The unlock — its own page. Copy LOCKED, shape revised 2026-08-10

> **Revised by section 6 (2026-08-10).** The code entry is no longer the same page morphed;
> it is **its own page**, reached by pressing Begin, and the code is **sixteen characters in
> two rows of eight**. There is no Unlock button on it: the last character is the press. The
> copy below is unchanged and still locked.

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

**The code is not true — LOCKED 2026-08-09, the wrong-code state:**

> **The code is not true**
>
> It did not match this piece. Turn it over and look again; if it still will not open,
> Adrian will help.
>
> [ Try again ] · Contact Adrian

**The passing confirmation — SETTLED 2026-08-09, Adrian's mechanic, replaces the dispute
limbo.** Walking the claim IS the claim. When someone claims a held piece: email goes to the
registered caretaker's account; logging in is the identity proof; they confirm the letting
go. Silence for thirty days, with more than one reminder across it, passes the piece to the
claimant, both sides notified. This is the death-and-lost-account rescue: a piece is never
orphaned. Only an active refusal reaches Adrian, the one genuinely human case.

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

**No setup screen ever scrolls (Adrian, 2026-08-09).** If a screen would scroll, it splits.
One breath, one idea, one tap. Taps are cheap; scrolls are expensive. This split "Who you
are" into three: born, where it lives, your links.

**The map — onboarding collects, the piece page keeps. Five quick screens:**

1. **Sign its record** — full name, email, password.
2. **Who you are** — born: date, time, place; the never-shown line; Why we ask.
3. **Where it lives** — the art's city, required; widen to region. The shortest screen in
   the flow, deliberately.
4. **Your links** — the grid with the dotted plus; fully skippable, its own temperature.
5. **What shows** — the shines-by-default page.

**The earlier three-screen map below is superseded by the split above; the wording per
block is unchanged, only the screen boundaries moved.**

1. **Sign its record** — full name, email, password; the account born as a signature.
   **Recovery (Adrian, 2026-08-09):** a forgotten password is recovered by email, "Enter
   your email and we will send you a way back in." The sign-in screen ("Welcome back") for a
   returning caretaker carries the "I forgot my password" link. Recovery touches only the
   account; the record and the piece are untouched, recovery is never an edit to history.
2. **Who you are** — birth date, time, and place (a full astrology reading needs all three),
   plus links; gathered while momentum is high.
3. **What shows** — the shines-by-default page, right after collection, concrete because the
   data now exists.

**Final development wording (worked with Adrian 2026-08-09, his spec):**

**Sign its record:**

> **Sign its record**
>
> Earth's Breath will carry your name from today. Your email is where the piece will write
> to you.
>
> [ first name ] [ last name ] · [ email ] · [ create a password ]
>
> [ Sign ]

**Who you are:**

> **Who you are**
>
> For the piece's astrology, and for the ones who will find you through it.
>
> BORN — [ date ] [ time ] on one row, [ place of birth ] full width beneath (the place
> field must never be cramped)
> A full reading needs all three. They are never shown to anyone; only what they produce can
> be, and only if you choose.
> *Why we ask*
>
> WHERE THE ART LIVES — [ city ] full width. REQUIRED, the one field skip cannot skip: a
> light must live somewhere.
> Its light shows at city level at most, never an address. If even the city feels close, you
> can widen it to the region: the light stays true but cannot be pinpointed.
>
> YOUR LINKS — Instagram · X · Facebook · YouTube · Your website, each tappable to add;
> beneath them a small dotted tile with a plus for anything more. Choose which ones people
> see (per-link visibility).
>
> [ Continue ] · Skip for now

**The art-location rule (Adrian, 2026-08-09, requirement):** the city is always entered and
the record always knows it. What the caretaker controls is the display grain, city or
region, chosen here or in What shows. Display may widen; the data never coarsens.

**"Why we ask" (Adrian, same day).** A quiet two-word text link under the born fields, italic
body face, no icon, no badge: *Why we ask.* It opens the same sheet the skip shows. One
explainer, two doors: the curious reach it by choice, the hesitant meet it on their way out.

**The skip explainer** — the same small sheet, also shown if skip is tapped, never a blocker:

> **What this is for**
>
> Your birthday ties your piece to your astrology, and it lets the piece mark your day: once
> a year, near your birthday, it asks for a moment with you. Your links are for the people
> your piece moves, so they can find who holds it. Nothing here is shown without your
> choice, and everything can be added later.
>
> [ Add it now ] · Skip anyway

**Guard:** all three birth details, date, time, and place, fall under never-shown equally;
the birthplace is as identifying as the date. Only what they produce, the chart and the
reading, can shine, and only by choice.

Then you are logged in. **You are Light 47** plays as the closing moment, ignition, and it
opens onto the piece page: home.

**The garden does not live in onboarding. It lives on the piece page, always.** The
questions are accessible from the first page from the day of registration onward: fill one
now, five next month, the rest over years. **The video capsule lives there too** when the
cost research clears it.

**The glowing meter (Adrian, 2026-08-09).** The caretaker's piece page carries a glow that
deepens with every question answered: the piece's own light, made visible at home. Rule from
the house: the meter is never wallpaper, tapping the glow opens the garden. The meter is the
door to making it brighter.

**One page, ever (Adrian, 2026-08-09): "We don't need two different home places."** There is
no separate caretaker home. The piece page is the only page, one QR address forever, dressed
by relationship: a stranger sees the public face with Unlock; the piece's own caretaker,
logged in, sees the same page warmed, meter, Add to your piece, the garden, and no Unlock;
anyone else logged in sees the public face with Unlock, because unlocking is about whose
hands hold this piece, not about having an account.

**Home's interior (Adrian, 2026-08-09): the doors inside the caretaker's page, all to be
built.** Each opens with the same slide-open-in-place motion the public rows use, one motion
vocabulary everywhere:
- **The garden** — the questions, opened by the glowing meter or Add to your piece.
- **Record a video** — the capsule, once the cost research clears it.
- **Piece information** — the full certificate and facts: made when, materials, elements,
  what was paid (caretaker-only), the complete record.
- **The rows the public sees** — story, certificate, history, dreams — same page, editable
  where the caretaker owns the content.
- **Your account (Adrian, 2026-08-09)** — the door where signing in lives, on the piece
  page. Two rules: any caretaker-only door reached while signed out automatically takes you
  to sign-in and then straight back to where you were headed, never to a dead end. And
  nothing from onboarding is frozen: where the art lives (you move, the light moves with
  you), your links, your name, email, password, and what shows are all changeable here, any
  day.

Open shape calls: the dream as the garden's most honored question versus its own screen
(lean: inside the garden); privacy as the one rings page after collection versus per-field
switches at collection (lean: one page, the spec's long rule).

**The privacy model — SETTLED 2026-08-09, supersedes the off-by-default ring model.**
Adrian's frame: "Part of this is about being seen. If you don't want to be seen, you can
uncheck it." The reconciliation, confirmed: **the piece shines by default; the person opts
in.**

- **What is placed in the piece shines by default, as words with no name.** Story, dreams,
  answers: shared anonymously unless withheld. Each garden card carries a small lit mark
  meaning "this will shine"; unchecking is the act of withholding.
- **The light on the map is on by default, and city is the ceiling.** Never an address,
  never a neighborhood. Adrian: "The maximum detail you can get is the city. Never the
  address. It makes it safe."
- **Small-town floor stays.** Where a city is too small to be anonymous, the light shows at
  the wider region instead. This is what keeps the city ceiling true to its promise.
- **Who you are stays opt-in.** Name, face, links, business: each its own tick, off until
  ticked. And identity and city never appear together on one surface unless both were
  explicitly opened; the join is the danger, not either half.
- **The birthday is never shown to anyone, ever.** No switch exists.
- **A child's words: guardian-lit, anonymous, revocable — SETTLED 2026-08-09, replaces the
  hard lock.** The caretaker may add a child's words and let them shine, but they shine as
  words alone: no child's name, no age, ever. Withdrawable from display any time. On
  adulthood the switch passes to the grown person, who may withdraw or keep them. The
  protections that matter survived: nameless, reversible, eventually their own.
- **The caretaker is the one approver of what shines from their piece (Adrian,
  2026-08-09).** Invited loved-ones' words pass through the caretaker once, for typos and
  judgment, before they glow. The caretaker's own words shine unapproved; the system
  approves nothing; Adrian is never the editor of anyone's piece.

**Video — the capsule, DEFERRED pending cost research (Adrian, 2026-08-09).** The sketch:
possibly one video at purchase, another at the yearly ritual, like time capsules. Before any
of it is promised or worded, research the data costs and feasibility: storage per short
video, per-piece economics over years, what a solo artist can underwrite. No video promise
appears in any screen wording until that research lands. Wording rule whenever it does: the
video lives with the piece and can always be exported and held; never the word "forever" for
hosting. The sealing question (sealed forward, open album, per-video choice) waits with it.

The "What shows" page's copy flips accordingly: it is no longer "everything is private until
you open it" but "your piece shines; here is what shows, and anything you would rather keep
quiet, uncheck." Wording to be worked when that screen is written.

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

> **Superseded by section 6 (2026-08-10).** The dream is no longer one quiet thing planted
> at registration and kept private by default. It **leads the piece page as the first thing
> every guest reads**, placing it is itself the choice to show it (no switch, ever), and it
> can be changed once a year on the birthday. The four scopes and the drawing question below
> are still open; everything about its privacy and placement is not.

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

### Inviting loved ones — the family of the piece. DECIDED 2026-08-09, extended 2026-08-10

> **Extended by section 6 (2026-08-10).** An invited person now **gets an account of their
> own** and supplies **their own birthday**, so the piece asks each of them at their own
> moment. The account is not per piece: it is the same one that opens their readings on
> Mandala Codes. Everything below about ownership still holds without change.

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

> **Extended by section 6 (2026-08-10).** The ritual is now the same occasion as the
> dream's yearly unlock, and it is not only the caretaker's: **every invited person has
> their own birthday window** and places their own words for the year. The three choices
> below still hold for the dream itself.

Once a year, near the caretaker's birthday. Three choices, never a blank form. No counts, no
streaks, nothing accumulates in public.

- Eyebrow: A YEAR WITH EARTH'S BREATH
- Headline: The year turns
- Body: Near your birthday, the piece asks once. Three ways to answer, none required.
- The three choices: Reinforce the dream it holds · Plant a new dream · Mark it fulfilled
- Secondary: Not this year
- Drawing: the piece with a single orbit line around it: one year, drawn.

---

---

## 6. The living page — decided 2026-08-10

Everything below was worked in conversation with Adrian on 2026-08-10 and is built in
`collector-primitives.html`. It changes the shape of section 1 and section 2; where it
disagrees with anything earlier in this file, this section wins.

### What the public sees, and what belongs to the account. SETTLED 2026-08-10

One page, one address, forever. What differs is not the page but which rows are on it. The
split is the answer to "what was paid lives behind the code, always."

**The public face — anyone who scans, including a guest looking at it on a wall:**

> *the piece, and the ground and light it has earned*
>
> **the main dream** *(the first thing read, words with no name)*
>
> The story
> The certificate *(made when, materials, year, series. NOT what was paid)*
> The history *(the public spine; names only where a caretaker opened them)*
> The dreams *(what caretakers chose to share, words with no name)*
>
> *Into the artist's website* — a text link, not a row
>
> **the way in, by state:** a lit **Begin** if unclaimed · two peer doors if registered

A visitor with no code gets a complete experience and never sees a locked door, an empty
slot, or a prompt to sign in. **Nothing on the public face is a teaser for the private one.**

**The caretaker's face — the same page, signed in as the person who holds it:**

Everything above, still public and still first, plus these rows, which **exist only when
signed in** and are never visible, greyed, or hinted at otherwise:

> Add to your piece *(the garden, also opened by the light)*
> Record a video *(when the cost research clears it)*
> Piece information *(the full record, including **what was paid**)*
> The people you love *(invite, and approve what shines)*
> Passing it on *(the transfer, from the inside)*
> Your account *(name, email, password, where it lives, links, what shows)*

And the Unlock door is **gone** for them, because unlocking is about whose hands hold the
piece, and theirs do.

**The rules that keep the split honest:**

- **Price and the private record are caretaker-only, always.** The certificate shows
  materials and making to everyone; what was paid is inside Piece information.
- **Birth details are shown to nobody, ever.** Not to the public, not on the caretaker's own
  page. Only what they produce can be shown, and only by choice.
- **A caretaker door reached while signed out** goes to sign-in and then straight back to
  where the person was headed. Never a dead end, and never a locked-door message.
- **Someone signed in who is not this piece's caretaker** sees the public face with the way
  in, exactly like a stranger. Having an account is not the same as holding this piece.
- **The light and the ground are public.** A guest scanning a loved piece sees that it has
  been loved. That visibility is the point, and it is why nothing about the light is behind
  the account.

### The invitation is the page itself, never a prompt. SETTLED

An earlier proposal put a line on the page reading "one more thing it would like to hold."
**Rejected, and the reasoning matters more than the line.** It makes the piece a creditor
and the caretaker a debtor. Adrian: *"You feel something with your love, not because it
wants something from you. This is something that I never want in my wording. Feeding your
love into it is not any management thing."*

The correct frame is his: **you feel something, you place it in the piece, it glows
brighter.** Cause and effect, never a request. So there is no prompt anywhere. The
invitation is that the page visibly becomes more alive, and a person wants to add to that.

**What that rules out permanently:** counts, bars, streaks, badges, percentages, "x of y
complete," notification marks, and any line that asks. Adrian: *"the person should never
feel less than others that glow brighter."*

### Growth has no ceiling, and runs on two axes. SETTLED

A finite ceiling would mean the piece is eventually finished, which contradicts an object
meant to outlive everyone who holds it. There is no full, no completion, and no way to
fall behind.

Two axes, deliberately different materials so they can never combine into one score:

- **Years held — the GROUND.** Patina, settling, the frame warming, hairlines softening.
  It accrues to everyone at the same rate simply by holding the piece. Nobody can buy it,
  rush it, or fall behind on it.
- **What is placed — the LIGHT.** Brightness, the words, their presence on the page.

A ten-year-old piece with little written reads *old and quiet*. A new piece written into
deeply reads *bright and new*. Both are obviously good and neither is ahead, because
there is no shared scale on which one beats the other. Adrian's test, which any future
threshold must pass: could two caretakers compare pieces and one feel behind? If yes, it
is a level, and it is wrong.

**Deep in, the interface inverts.** Early on the page is the piece with a little of the
person in it. Far along, the page is the person and everyone who has loved it, with the
piece as the frame: the words become the body and the rows recede. This is unbounded and
qualitative; **no stage is ever named or numbered on screen.**

### Season, hour, and the birthday month. SETTLED

The page carries a tint so the piece belongs to the time it is being looked at: the ground
warms toward amber in autumn, cools in winter, darkens at night. **The birthday month is
the warmest the piece ever gets.**

**Hard rule: the tint moves the GROUND ONLY. Brass never shifts.** "Brass means you can
act on this" is what keeps every screen legible, and an accent that drifts stops being a
signal. Season is a tint over the whole surface; years are a depth in the ground. Different
properties, so they compose instead of muddying.

### The dream leads the page. SETTLED

The main dream is **the first thing any guest reads**, above the rows, in the piece's voice.

- **Placing it IS the choice to show it.** There is no switch for it anywhere, and none is
  ever added. The screen must say so before the field, not after.
- **The words show; who wrote them does not.** Identity stays opt-in tick by tick, exactly
  as the privacy model already holds. This keeps the rule intact rather than punching a
  hole in it.
- **It can be changed once a year, on the birthday.** The lock is what makes it worth
  reading: a line anyone can edit at any time carries no weight, and knowing the date is
  coming is what produces the intentionality.
- **Caretakers with no birth details** fall back to the registration anniversary, silently.
  They never see a difference.
- **A transfer moves the date** to the new caretaker's birthday. The old dream stays with
  the piece as its story, per the locked transfer rule.

The prompt wording is **NOT YET WRITTEN** and is the highest-stakes line in the flow: every
guest reads it, and it is locked for a year once placed.

### Two doors, neither above the other. SETTLED

A guest is here to look. The caretaker is here to tend. Both scan the same code and land on
the same page, and Adrian's rule is that neither path is diminished by the other's.

**On a registered piece there is no pill at all** — two peers at the foot, equal weight,
differing only in what they say: *Look through it* · *Sign in to tend it*.

This is the one screen in the flow with two peer actions. It is bent here and nowhere else,
because it is the only screen where the system genuinely does not know who is holding the
phone. Any hierarchy would pick a winner, and on a registered piece the loser would be the
caretaker, on their own piece.

### Arrival, dressed by relationship. SETTLED

One page, three states, and the page reads its own state rather than showing everything to
everyone:

- **Unclaimed** — a lit **Begin**, the only bright thing on an otherwise quiet page. No
  sign-in link, because nobody has an account for an unregistered piece.
- **Registered, not you** — no brass anywhere. The code door drops to a quiet line and
  *Sign in to tend it* becomes the obvious move.
- **Registered, and you are signed in but it is not yours** — the same as above, minus the
  sign-in they no longer need. The code door reads *I hold this piece*. **Having an account
  is not the same as holding this piece**, so an account-holder sees what a stranger sees.
- **Registered to you, signed in** — no pill and no doors, because there is nothing left to
  claim and nothing to sign into. The light and your rows.

**Begin replaces Unlock as the first-arrival label.** Unlock names the mechanism; Begin
names what happens. It also covers both openings honestly, because behind it sits
registering it to yourself **or** leaving sealed words for whoever you bought it for.

### The code: sixteen characters, and it checks itself. SETTLED

- **Sixteen characters, shown as two rows of eight.** An unbroken run of sixteen is
  unreadable and, more importantly, unproofable: a person is copying it off the underside
  of a physical object and needs to check their work by eye.
- **The unlock is its own page**, reached by pressing Begin. The rows, the dream, and the
  status give way; the field is what the page is for.
- **The last character is the press.** No second button. The code is either true or it is
  not, so there is nothing to confirm; the piece answers the moment it has enough to know.
- **A deliberate pause before it fires.** At sixteen characters a mistype is likely, and
  firing the instant the last character lands would reject someone mid-correction, before
  they had seen what they typed.
- **The tumblers accelerate.** Sixteen at the six-character pace would spend two and a half
  seconds before the vault even started, breaking the two-to-four-second bound on the whole
  passage.

### A question, opened. STRUCTURE SETTLED 2026-08-10, wording pending

The garden is a list of questions, and **each question is its own small screen**, not a
field in a form. Opening one gives:

- **the question**, in the piece's voice, one line long
- **a little guidance** on how to answer it: what it is reaching for, and permission to
  answer it badly
- **the field**
- **the share choice**
- **Place it** · *Not now*

**Sharing is the default; the button is how you withhold.** This follows the settled
privacy model exactly: the piece shines, the person opts in. So the control is never a
permission request, only a way to keep something back. Lit reads *"This will shine with the
piece · words with no name."* Tapped, it reads *"This stays yours alone · nobody sees it
but you."*

**Three states per question, and none of them is a failure:** answered (readable, still
openable), waiting (never overdue, nothing expires), and answered-and-shining.

**The lock — MECHANIC STILL OPEN (Adrian, 2026-08-10).** A placed answer settles until the
birthday, when it opens again. What is genuinely undecided is *what that opening is*:
a rewrite, a check-in, an amendment, or an addition. Adrian's constraint on it: **"You
don't want to be hit with ten questions on your birthday."** So whatever it becomes, the
yearly moment cannot be a queue of everything at once. The screen is built with the lock
as a single line so the mechanic can change without touching anything else.

### The passing, the household, the collaborator, the heir. STRUCTURE BUILT 2026-08-10

All four are built in `collector-primitives.html` with placeholder wording in Adrian's
register. **None of the copy below is locked**; it exists so the structure can be seen.

**The passing forks first, because the two exits are not the same act.**

- **To someone you love** — they are already on the piece, and it stays inside the house.
  The line the caretaker set privately is what this reads from.
- **To someone buying it** — a stranger receives it, and what travels is stated in one
  line rather than triaged: what shines stays shining, what was kept private travels
  holder-only, what was sealed stays sealed. A way back to the garden for anyone who meant
  to publish something first.

Then *Let it go* (their email, and nothing moves until they accept) and *It is waiting for
them*.

**The household is the people whose love is in the piece**, not an invite list. They live
on it, named, with their words beside the caretaker's. **Being on it promises nothing** and
most people on it will never carry the piece.

**The succession mark is private and sits one tap deeper, inside a person, never on the
row.** Adding someone is warm; naming them next is a will, and the two must not share a
styling. Nobody is told where they stand or that they were moved.

**Removing someone is total**: access ends, their unshone words stop shining, and they come
out of the line. Anything of theirs that already shines stays shining, because it always
does, with their name on it. They keep their own copy; it simply leaves the piece.

**The collaborator's arrival is two screens, never five.** She is not registering the piece
and not receiving it. Name, so the piece knows whose words these are, and birthday, so it
asks her at her own moment rather than the caretaker's. Where the art lives, what shows,
and the record itself belong to whoever carries it.

**The heir's arrival is the payoff of the three tiers.** They open what was kept with the
piece, read it, and decide what the world learns. What was sealed stays sealed and is never
shown to them: that was the writer's to decide, and they did.

### The install, and one account across everything. SETTLED 2026-08-10

**Registration is binary. Incomplete means not registered.** There is no half-registered
state to design for, and therefore no resumable wizard and no progress to track.

**Three of the five gathering screens are required**, and each says so plainly: *"The piece
is not registered until this is placed. Leaving now leaves it unregistered; nothing you
have written is lost."*

- **Sign its record** — required. The account.
- **Who you are** — optional, *Skip for now* stays.
- **Where it lives** — required. A light must live somewhere.
- **Your links** — optional, *Skip for now* stays.
- **What shows** — required. Nothing shines until this is answered.

**The questions were never part of registration and never become part of it.** Adrian:
*"If you don't complete registration, it's not registered. It doesn't mean you have to
answer questions. Those are optional."* This resolves the apparent conflict with the
earlier locked rule that the story must never gate registration: the *gathering* is
structural, the *garden* is not.

**One account across the whole ecosystem.** The account created here is not this piece's
and not this site's. The same name and password open Mandala Codes readings, the ledger,
and ordering from Adrian, already signed in. Adrian's reason is commercial as well as tidy:
*"it makes people have an easy time ordering as well."*

This is the first place the identity direction becomes real, and it carries that
direction's clock: moving real customer accounts off a vendor after launch is risky, doing
it now while the sites are on test accounts is clean. See
`i64os/substrate/directions/identity.md`.

### Three tiers, and what outlives you. SETTLED 2026-08-10

Every private thing placed in a piece needs a destination, because the piece travels and
private things cannot float. There are **three tiers, named for what they actually do**:

- **Let it shine** — anyone who meets the piece reads it, as words with no name. **Once it
  shines it stays shining, always.** Other people have already read it; the piece's history
  is a public record, and retroactive deletion would let someone rewrite what a hundred
  people already saw.
- **Keep it with the piece** — it travels forever and only whoever holds it can open it.
  **They may choose to let it shine one day.** That clause must appear on the control. It
  is not "private," and calling it private would be a lie that makes someone write a thing
  they would never have written had they understood.
- **Seal it** — nobody opens it again. Not the next caretaker, not family, not ever. The
  piece still holds it; sealing is not deletion.

**Shining is the default**, per the settled model: the piece shines, the person opts in.

**Publishing is a per-item act, wherever the item already lives. There is NO triage screen
at transfer.** Adrian asked directly whether this would ever be used. The honest answer:
rarely, and it is still worth building, because the *rule* is doing the work rather than
the interface. Publishing something private is a deliberate act needing a reason, and those
reasons arrive on their own schedule, never at the moment of a sale. A triage screen would
catch people at their least reflective and be skipped by everyone. So the share choice
lives on the question's own screen, changeable on any ordinary day, and the passing screen
carries one line naming what travels rather than a task list.

### The heirs' right. SETTLED 2026-08-10

**"Keep it with the piece" carries one quiet sub-choice: *the ones who come after may share
this*, ON by default.** Hidden entirely when the tier is Seal it, which already answers the
question.

Adrian's frame, and the reason for the default: *"Wouldn't it be heartwarming if your child
could post something you never shared, but it moved him to tears after he passed."* The
father who wrote freely and never thought about it leaves his words openable to his
children. That scene is what the piece exists to make possible, and it only happens by
default.

**The cost, accepted knowingly.** The same feature that lets a son publish his father's
words lets a grieving son publish something the father wrote precisely because the box was
closed. Both scenes come from one mechanism, so the question is only ever *who decides*,
and there are two honest answers: the writer in advance, or the heir afterward. **The
writer decides**, because the writer is the only person who knows which thing is which, and
the only one who can be asked.

Most people will never touch the control, which means most private writing becomes
shareable by heirs. **That is the intended outcome, not a leak** — the same reason the light
shines by default — and it is why the label at writing time must be plain.

**Superseded:** an earlier position in this file held that no future caretaker could ever
make a holder-only thing public. That is replaced by the three tiers above. The absolute
protection now lives in **Seal it**, which is the tier that exists so there is somewhere to
put a thing you truly do not want read. Without it people would write nothing rather than
risk everything.

### The year turns: one occasion, each person at their own birthday. SETTLED

The yearly ritual and the dream's unlock are **one occasion, not two**. Near the birthday
the piece asks once, and both the caretaker's dream and each invited person's words open
for placing.

- **Every person has their own birthday window.** The piece asks each of them at their own
  moment, not all at the caretaker's. Which means **each invited person supplies their own
  birthday.**
- **Family words pass through the caretaker once** before they show, for typos and
  judgement, never for permission. Because a line now displays publicly for a whole year,
  this approval matters more, not less, and it happens inside the same yearly window.
- **Anything not passed simply does not show that year.** Nothing is lost; it waits.
- **A child's words never carry a name**, whatever else is chosen.

### The account is not per piece. DECIDED, and larger than this flow

**Each invited family member gets an account of their own.** And the account is not scoped
to a piece or to this site: **it is the same account that opens their readings on Mandala
Codes.**

This reaches past the collector flow into the identity layer across all of Adrian's
properties, and it should be decided there rather than here. See
`i64os/substrate/directions/identity.md`. **It carries a real clock:** moving real customer
accounts off a vendor after launch is risky; doing it now while the sites are still on test
accounts is clean.

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
