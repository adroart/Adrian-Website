# Collector wording workbook

> **What this is.** Adrian: *"Let's create a separate document for everything that needs to
> be worked through so I don't have to do it on the spot. Then we'll go through it all... Any
> notes about why it needs to be rewrote that I put in there and the things to rewrite so it
> could all be done at once."* Every entry below is one piece of copy he flagged on his
> second walkthrough, 2026-08-20, with his note verbatim, why it needs a rewrite, and two
> genuinely different drafted options for him to choose between, edit, or reject outright.
>
> **Nothing here is locked.** Options are drafts in Adrian's register, built from the pillar
> in `collector-screen-wording.md` and the voice rules (caretaker, the Resonant Grid, no em
> dashes, middle dots for inline detail, "forever" permitted, outcomes not mechanics). Once
> he rules on an entry, its answer moves into `collector-screen-wording.md` as locked copy
> and out of `components/collector/copy.ts`'s placeholder set.
>
> **"Now" quotes** are pulled verbatim from `git show HEAD:components/collector/copy.ts` (or
> the named file) as it stood at the start of this session, 2026-08-20. Locked lines are
> marked **(LOCKED)**; drafted-not-yet-Adrian's lines are marked **(placeholder)**.

---

## Part 1 · Direct rewrites

The screens Adrian flagged by name on the walkthrough.

### 1. Gift · "Leave your wishes" head and body
**Where** `components/collector/copy.ts`, `threshold.giftHead` / `threshold.giftBody`
**Now** (LOCKED) "Leave your wishes with it" / "Write what you wish for the one who will
hold this piece. Your words seal into it, greet them the day they make it theirs, and live
with the piece forever."
**Adrian's note** "change the leave your wishes to permentaly inscribe your A message for the
person you are giving this to into the history of the artwork."
**Why it needs rewriting** "Wishes" reads soft and temporary, like a birthday card. Adrian
wants the weight to land on permanence: this is not a note tucked inside, it is inscribed
into the piece's history, the same history that survives every caretaker after this one.

**Option A**
Head: "Inscribe your message into its history"
Body: "Write what you want the one who will hold this piece to know. Your words are
inscribed into its history, read once when it becomes theirs, and carried by the piece
forever."

**Option B**
Head: "Give it your words, permanently"
Body: "What you write here becomes part of Earth's Breath, the same as the wood and the
hands that made it. It waits sealed until they make the piece theirs, then it is theirs to
read, and it never leaves the piece's story."

---

### 2. Gift fork context · the choice between giving and selling
**Where** `components/collector/copy.ts`, `threshold.forkHead` / `forkGift` / `forkGiftNote`
/ `forkPass` / `forkPassNote`
**Now** (LOCKED) Head: "For someone else". Rows: "Giving it as a gift" / "leave your wishes
with the piece; they are sealed until its new caretaker unlocks it" and "Passing on my own
piece" / "begin handing your caretakership to another"
**Adrian's note** "As far as passing the other thing, I think that's a good idea. People need
to know this is how you sell it. So they are beginning the process of giving this to the next
owner or selling this. Think about it and then suggest what I would write here. It's not
clear enough."
**Why it needs rewriting** The screen has to do two jobs the current copy hides: tell someone
who wants to *sell* their piece that this fork is where that starts (nothing on the screen
says "sell" or "buyer" anywhere), and separate that from the loved-one gift path clearly
enough that nobody picks the wrong row by accident.

**Option A**
Head: "How is it leaving your hands"
Rows: "As a gift" / "you choose who receives it, and leave words that greet them" ·
"To a new owner" / "this is where a sale begins: the piece is passed to whoever is buying it"

**Option B**
Head: "For someone else"
Rows: "Giving it as a gift" / "leave your wishes with the piece; they are sealed until its new
caretaker unlocks it" · "Selling it, or passing it to someone buying it" / "this begins the
transfer to its next owner; the piece and its record travel with it"

---

### 3. "Something was left for you" (the sealed gift, receiver's side)
**Where** `components/collector/copy.ts`, `threshold.sealedHead` / `sealedBody` / `sealedOpen`
**Now** (LOCKED) "Something was left for you" / "Whoever gave you this piece placed words
inside it, sealed until this moment." / "Open them"
**Adrian's note** "This needs to be rewrote."
**Why it needs rewriting** No specific direction was given beyond "rewrite it," so this is
a genuine open pass. Candidates for what might be weak: "something" is vague where the
piece already knows it holds words, not an object, and the screen could name the giver's
intimacy more directly, matching the new permanence framing from entry 1.

**Option A**
Head: "A message was inscribed for you"
Body: "Whoever gave you this piece wrote something into its history before you held it.
It has waited, sealed, for this moment."
Button: "Read it"

**Option B**
Head: "Words were left in this piece for you"
Body: "Before it reached you, someone sealed a message inside Earth's Breath. It is yours
alone to open."
Button: "Open them"

---

### 4. "Sign its record" prose, streamlined
**Where** `components/collector/copy.ts`, `gathering.signHead` / `signBody` / `signNote`,
and `gathering.required`
**Now** (LOCKED) Head: "Sign its record". Body: "Earth's Breath will carry your name from
today. Your email is where the piece will write to you." Note: "One account, and it is not
only this piece's. The same name and password open your readings on Mandala Codes, the
ledger, and anything you order from Adrian, already signed in." Required note (shared across
all three required screens): "The piece is not registered until this is placed. Leaving now
leaves it unregistered; nothing you have written is lost."
**Adrian's note** "there's too many paragraphs, With redundancies, this is meant to be
streamlined and clean."
**Why it needs rewriting** As built this screen carries three separate blocks: the body, the
one-account note, and the shared "required" line, and all three land on the same idea from
slightly different angles (this account is yours, it is one account, it must be completed).
Adrian wants one body and one short note, not three passes at the same thought.

**Option A** — one body, one note
Body: "Earth's Breath will carry your name from today, and your email is where it will write
to you. This is the one account that opens everything of Adrian's, your readings on Mandala
Codes included."
Note: "Not placed yet, not registered. Nothing you write here is lost if you leave."

**Option B** — one body, one note
Body: "Sign, and Earth's Breath carries your name from today. This account is not only for
this piece: the same sign-in reaches your readings on Mandala Codes and anything you order
from Adrian."
Note: "This step is required. Leave before signing and the piece stays unregistered, but
nothing you have typed is lost."

---

### 5. "Where it lives," city only
**Where** `components/collector/copy.ts`, `gathering.livesNote` (and `livesHead` /
`livesBody`, unchanged, for context)
**Now** (LOCKED) Head: "Where it lives". Body: "A light must live somewhere." Note: "Its
light shows at city level at most, never an address. If even the city feels close, you can
widen it to the region: the light stays true but cannot be pinpointed."
**Adrian's note** "this should be the city, not the area, and we should rewrite the text."
**Why it needs rewriting** The "widen to the region" escape hatch is being removed by another
lane per §7 (city only, no area). The note as written spends most of its words explaining a
choice that no longer exists on this screen.

**Option A**
Note: "Its light shows at city level, never an address, never anything closer. That is the
most anyone ever sees."

**Option B**
Note: "The city is as close as anyone can get. No street, no neighborhood, nothing more
precise, ever."

---

### 6. Passing · "Two exits" fork
**Where** `components/collector/copy.ts`, `passing.forkHead` / `forkBody` / `forkLove` /
`forkLoveNote` / `forkSell` / `forkSellNote`
**Now** (LOCKED) Head: "Passing it on". Body: "A piece moves in one of two ways, and they are
not the same act." Rows: "To someone you love" / "already on the piece; it stays inside the
house" and "To someone buying it" / "a stranger receives it, and what travels is stated now,
not decided later"
**Adrian's note** "The first option is handing ownership over to a loved one inside of you're
a family, or a trusted friend. The other one is more commercial. This needs to be rewrote."
**Why it needs rewriting** Adrian's own description is warmer and more specific than the
current copy: family, or a trusted friend, versus something explicitly commercial. "To
someone buying it" undersells that this is the sale path; the current row notes also read
slightly clinical for a fork this consequential.

**Option A**
Head: "How is it moving on"
Body: "There are two ways this piece changes hands, and they ask different things of you."
Rows: "To family, or someone you trust" / "already part of the household; it stays close, and
the order you set decides who is next" · "To a sale" / "a new owner, likely a stranger; what
travels with the piece is decided now"

**Option B**
Head: "Passing it on"
Body: "A piece leaves your hands one of two ways."
Rows: "To someone you love" / "family, or a trusted friend already close to the piece" ·
"Through a sale" / "to whoever is buying it; what they receive is settled before they do"

---

### 7. Household · "It stays in the house"
**Where** `components/collector/copy.ts`, `passing.nameBody` / `nameNote`
**Now** (LOCKED) Head: "It stays in the house". Body: "They already place their love in this
piece, so nothing about it is new to them. What changes is that it becomes theirs to carry."
Note: "The order is yours and it is private. Nobody on this list is told where they stand, or
that they were moved."
**Adrian's note** "These are drag and droppable. And you can order who has control of this I
don't think this is written clearly enough."
**Why it needs rewriting** The current copy never says the list can be reordered by dragging,
or that the order is what decides who carries the piece next. "The order is yours and it is
private" implies an order exists without ever explaining what sets it.

**Option A**
Body: "Everyone here already places their love in this piece; nothing about that changes. Drag
to set the order they stand in, and whoever is first when you pass it becomes its next
caretaker."
Note: "Only you see this order, and only you can change it. Nobody on the list is told where
they stand, or that they were moved."

**Option B**
Body: "This list is who the piece already knows. Drag a name to move it, and the order you set
is the order that decides who carries the piece next."
Note: "Private, always. No one here sees their place in line, or knows if it changed."

---

### 8. Selling · "What travels"
**Where** `components/collector/copy.ts`, `passing.sellBody` / `sellNote` (`sellHead`
unchanged, for context)
**Now** (LOCKED) Head: "What travels with it". Body: "Everything you let shine stays shining,
always. What you kept private travels with the piece, and only whoever holds it can open it."
Note: "Anything you sealed stays sealed, from them and from everyone after them. If there is
something you meant to let shine first, the garden is still open."
**Adrian's note** "The wording is not right."
**Why it needs rewriting** No specific direction beyond "not right." The body currently packs
two of the three tiers into one sentence each with no visual or verbal separation, and reads
more like a rules recitation than a reassurance to someone about to hand off a piece they have
written into for years.

**Option A**
Body: "The piece carries everything you placed in it. What shines keeps shining for whoever
meets it next. What you kept private goes with the piece too, unopenable except by whoever
holds it."
Note: "What you sealed stays sealed, for them and for everyone after them. Still something you
meant to share? The garden is open until the moment you let go."

**Option B**
Body: "Nothing you wrote is left behind. What already shines keeps shining. What you kept
private travels with the piece, closed to everyone but its next caretaker."
Note: "Sealed stays sealed, permanently, no matter who holds the piece after this. There is
still time in the garden if something should shine before you pass it on."

---

### 9. "Being asked onto a piece" — all three screens
**Where** `components/collector/copy.ts`, `people.joinLetterHead` / `joinLetterBody`,
`joinHelloHead` / `joinHelloBody` / `joinHelloNote`, `joinWhoHead` / `joinWhoBody` /
`joinWhoNote`
**Now** (LOCKED)
- Letter: "A piece has asked for you" / "Sara holds Earth's Breath, and she has asked you to
  place your love in it. The piece is hers to carry; what you put in it is yours."
- Hello: "You have been added to a piece" / "Sara has placed Earth's Breath in your hands to
  write into. The piece is hers to carry; what you put in it is yours." / "You are not
  registering it and you are not receiving it. You are being asked to add your love to
  something she holds."
- Who: "Who you are" / "Your name, so the piece knows whose words these are. Your birthday,
  so it asks you at your own moment rather than hers." / "This is the whole of it. Where the
  art lives, what shows, and the record itself belong to whoever carries the piece."
**Adrian's note** "Wording is not right" (letter and hello screens), and for the who screen,
his direction: they create their own account with password and exact birth date, time, and
location for the Oracle, partial okay.
**Why it needs rewriting** The letter and hello screens repeat almost the same two sentences
twice across two screens with no note beyond "not right," which suggests trimming the overlap
is part of the fix. The who screen is the bigger gap: it says "your birthday" when Adrian
wants the real ask stated, an account with a password plus exact birth date, time, and place
for the Oracle reading, with partial answers accepted.

**Option A**
Letter: "You've been asked onto a piece" / "Sara holds Earth's Breath and has asked you to
place your love in it. Hers to carry; what you write is yours."
Hello (drop, folded into the letter; skip this screen)
Who: "Make your account" / "A name and a password, so the piece knows these words are yours.
Then your birth date, time, and place, as exactly as you have them: this is what feeds your
Oracle reading. Partial is fine; more can be added later." / "That's everything needed. Where
the art lives, what shows, and the record itself stay with whoever carries the piece."

**Option B**
Letter: "A piece has asked for you" / "Sara holds Earth's Breath, and she has asked you to add
your love to it."
Hello: "You've been invited to write into it" / "Sara has placed Earth's Breath in your hands
to write into; the piece stays hers." / "You are not registering it and not receiving it, only
adding to what it holds."
Who: "Set up your account" / "Choose a password, then give your birth date, time, and place of
birth, as exactly as you can. This is what the Oracle reads; anything partial is welcome." /
"Nothing else is asked of you. The piece, where it lives, and what shows all stay with whoever
carries it."

---

### 10. Inheriting · "What he kept"
**Where** `components/collector/copy.ts`, `heir.keptHead` / `keptBody` / `keptNote`
**Now** (LOCKED) Head: "What he kept". Body: "Earth's Breath is yours to carry now. He wrote
things into it that nobody has read, and they are yours to open." Note: "You can let any of it
shine, and once it shines it stays shining. What he sealed is sealed, and you will not see it:
that was his to decide, and he did."
**Adrian's note** "Wording is a bit too hippy, let's also rewrite this."
**Why it needs rewriting** Adrian's shorthand points at a register mismatch: this is a grief
screen, and language like "yours to open" risks sliding toward new-age softness rather than
the grave, matter-of-fact voice the pillar calls for elsewhere (see the release screen's "it
does not soften").

**Option A**
Body: "Earth's Breath is yours now. He left things in it that no one has read yet. They are
here, waiting for you."
Note: "You decide what shines from here forward, and once it shines, it stays. What he sealed
stays sealed; he chose that, and it holds."

**Option B**
Body: "The piece is yours to carry. Inside it are words he wrote that nobody has read."
Note: "You can let any of it shine, permanently, once you do. What he sealed, he sealed for
good reason, and it stays closed to you as it did to everyone else."

---

### 13. "Ask them onto the piece" (invitation, plus its management)
**Where** `components/collector/copy.ts`, `people.inviteHead` / `inviteBody` / `inviteNote`
**Now** (LOCKED) Head: "Ask them onto the piece". Body: "They will be able to place their
love in it, and nothing else. No code, no transfer, no inheritance." Note: "They receive a
letter from the piece rather than from an app. What they place passes through you once before
it shines, for typos and judgement, never for permission."
**Adrian's note** "Wording is not right of this. Needs to be some sort of management of your
invitations as well in case there's a problem."
**Why it needs rewriting** Beyond the wording, Adrian wants a way to see and act on
invitations already sent, which does not exist on this screen today. The management piece is
being built separately; this entry drafts both the screen words and the cancel/resend labels
it will need.

**Option A**
Body: "Invite them to place their love in this piece, and nothing more: no code, no transfer,
no inheritance."
Note: "The invitation arrives as a letter from the piece, not from an app. What they write
passes through you once before it shines, for typos and judgment, never as a gate on
permission."
Management labels: "Waiting on them" (row state) · "Resend it" · "Cancel this invitation"

**Option B**
Body: "This asks someone to add their love to the piece. It gives them nothing else: not the
code, not a claim, not a place in line to inherit it."
Note: "They hear from the piece itself, by letter. Anything they write reaches you first, once,
so you can catch a typo or a bad moment before it shines, never to say no on your own terms."
Management labels: "Sent, not yet answered" · "Send it again" · "Take back this invitation"

---

### 14. People room notes
**Where** `components/collector/copy.ts`, `rooms.familyNote` / `familyPromise`
**Now** (LOCKED) "They are known by name and relation. Placing love in a piece is never
ownership of it." / "Being on it promises nothing and most people on it will never carry the
piece."
**Adrian's note** "the writing needs to be adjusted."
**Why it needs rewriting** No specific complaint given; the two lines currently do slightly
redundant work (both say, in different words, that being listed here carries no claim), which
is worth tightening into one clear statement plus one clear caveat rather than two versions of
the same reassurance.

**Option A**
familyNote: "Everyone here is known by name and how they relate to you. Adding love to a piece
is not the same as owning it."
familyPromise: "Nothing here is a promise of the piece itself. Most of the people on this list
will never carry it."

**Option B**
familyNote: "Each person is named, with their relation to you beside them. None of this hands
over the piece."
familyPromise: "Being on this list guarantees nothing. Most of these people never will carry
Earth's Breath, and that is by design."

---

### 15. Dreams room notes
**Where** `components/collector/copy.ts`, `rooms.dreamsNote` / `dreamsFoot`
**Now** (LOCKED) "What other caretakers chose to let shine. Words with no name." / "Every one
of these was placed by someone who chose to let it shine. None of them carries a name."
**Adrian's note** "The writing in here should encourage people to share because of the power
with it."
**Why it needs rewriting** The current lines only describe the mechanic (anonymous, opted in).
Adrian wants them to also carry the emotional case: reading what others have placed should
make someone want to add their own, without turning into a pitch or a count.

**Option A**
dreamsNote: "What other caretakers chose to let shine, words with no name, and every one of
them makes the piece a little more alive."
dreamsFoot: "Each of these was placed by someone who wanted it read. Yours can join them,
whenever you are ready."

**Option B**
dreamsNote: "Other caretakers' words, shared without a name attached. This is what it looks
like when love is placed in a piece."
dreamsFoot: "None of these carries a name, only the choice to let it be read. The piece holds
more of these every year."

---

### 16. The vault-arrival, and the piece-page dot
**Where** new lines; no `copy.ts` key exists yet. Context: `todo/plans/collector-screen-wording.md`
§7 "The unlock arrives and stays" (the vault opens directly onto the destination) and the §8
ruling that the piece page's center is a glowing dot, not a vector, and the dot is the
caretaker's interactions with the art.
**Adrian's note** From the walkthrough directives: the vault must open directly onto the
destination itself; separately, the center of the piece page is a glowing dot standing for the
caretaker's interactions with the art, not a decorative graphic.
**Why it needs rewriting** These are new lines, not rewrites: a short line for what the dot
means the first time someone sees it arrive, so it reads as meaningful rather than
ornamental.

**Option A**
"The dot arrives, and it stays. It is everything you have placed in this piece, made visible."

**Option B**
"That light is you: every word you have placed in this piece, gathered into one point that
stays."

---

### 18. The Unlock press label
**Where** `components/collector/CodePage.tsx`, the sixteenth-character brass press
**Now** (placeholder) `placeholder('Unlock')`
**Adrian's note** Carried over from wave one, awaiting his word: the §7 ruling retired the
auto-fire on the last keystroke and replaced it with a deliberate press, but "the exact word on
that press is still mine to choose" (§7).
**Why it needs rewriting** It is not wrong so much as unconfirmed; "Unlock" matches the
code-page vocabulary everywhere else, but Adrian reserved the final word for himself.

**Option A** — "Unlock" (matches the door metaphor used everywhere else on this screen; no
change needed if he confirms it)

**Option B** — "Open it" (matches "Begin" and "Open them" elsewhere in the flow, and reads
as an action on the piece rather than a mechanism)

---

### 19. The birthday privacy line
**Where** `components/collector/walk.tsx`, `WHO_BIRTHDAY_NOTE` (the "who you are" page,
beneath the birth fields)
**Now** (placeholder) "Private, always. Never shown, never sold. It quietly feeds the Oracle
and the Dream."
**Adrian's note** Carried over from wave one, awaiting his word; flagged inline in the file
itself ("Flagged for Adrian").
**Why it needs rewriting** Not confirmed wrong, just never reviewed. Worth a second option
since "sold" is a strong word to introduce this early in the flow, before anyone has asked
whether their data could be.

**Option A** — "Private, always. Never shown, never sold. It quietly feeds the Oracle and
the Dream." (as drafted; confirm as-is)

**Option B** — "This never leaves your record and it is never shown to anyone. It only feeds
your Oracle reading and the piece's Dream, quietly, in the background."

---

### 20. The dream reminder pair
**Where** `components/collector/rooms.tsx`, demo history entries: `WRITTEN_SHINES_TEXT`
("A dream was placed in it") and the second entry's inline text "The dream was placed again"
**Now** (placeholder) "A dream was placed in it" / "The dream was placed again"
**Adrian's note** Carried over from wave one, awaiting his word.
**Why it needs rewriting** These are the history-log labels for the first time a dream shines
on a piece and every time after; "was placed again" reads slightly flat next to the rest of
the history spine's voice ("Still held," "The plate was replaced").

**Option A** — "A dream was placed in it" / "Another dream was placed"

**Option B** — "It was given a dream" / "It was given a dream again"

---

### 21. GARDEN_HELD_LINE
**Where** `components/collector/gardenReview.tsx`, exported `GARDEN_HELD_LINE`, shown when
a standing dream's body is outside its yearly edit window
**Now** (placeholder) "It is held until its day. Nothing you wrote is lost."
**Adrian's note** Carried over from wave one, awaiting his word.
**Why it needs rewriting** Reads fine but is unconfirmed; worth a second option that names
the birthday explicitly rather than "its day," since the birthday is already a named concept
elsewhere in the flow.

**Option A** — "It is held until its day. Nothing you wrote is lost." (as drafted; confirm
as-is)

**Option B** — "This waits for your next birthday to open again. What you wrote stays exactly
as you left it."

---

### 22. The review page strings
**Where** `components/collector/gardenReview.tsx`, `REVIEW_HEAD` / `REVIEW_WARN` /
`REVIEW_HONESTY` / `REVIEW_COMMIT`
**Now** (placeholder) Head: "Read it back". Warning: "Placing it sets these words into the
record, and the record keeps them." Honesty: "The way placed words open again for changing is
still being decided." Commit: "Place it, truly"
**Adrian's note** Carried over from wave one, awaiting his word. (`tierSealWriterNote`, the
neighboring line on this same page, is already LOCKED and is not part of this entry.)
**Why it needs rewriting** Unconfirmed rather than flagged wrong. "Place it, truly" reads
oddly next to the garden's plain "Place it" elsewhere; worth testing an alternative that keeps
the gravity without the awkward adverb.

**Option A** (as drafted; confirm as-is)
Head: "Read it back"
Warning: "Placing it sets these words into the record, and the record keeps them."
Honesty: "The way placed words open again for changing is still being decided."
Commit: "Place it, truly"

**Option B**
Head: "Before it is placed"
Warning: "Once placed, these words enter the record, and the record does not let them go."
Honesty: "How a placed answer can be changed later is still being worked out."
Commit: "Place it for good"

---

## Part 2 · System rulings that need words

Not screens Adrian named directly, but mechanics he ruled on that still need their own copy.

### 11. The door · "Already held," the automated claim
**Where** new; the state that fires when someone claims a piece another caretaker already
holds. Related placeholders: `components/collector/copy.ts` `states.heldHead` / `heldBody` /
`heldBody2` / `heldWrite`, and `threshold.writtenHead` / `writtenBody` (LOCKED) /
`writtenReturn`, which already carry the mechanic in outline.
**The system, for Adrian.** This is fully automated end to end, no step needs him: claiming a
held piece with its true code notifies the registered caretaker by email; logging in is their
proof of identity and their chance to confirm the letting go; thirty days of silence, with more
than one reminder sent across that window, passes the piece to the claimant and both sides are
told; only an active refusal from the current caretaker reaches Adrian, because that is the one
case a machine cannot resolve on its own.
**Why it needs rewriting** The mechanic is settled (§3, §7) but the screen words for the
claimant, the person standing there with a true code and a piece they cannot yet carry, are
still placeholder. They need to state the wait plainly without sounding like an error or a
denial.

**Option A**
Head: "It answers to someone else, for now"
Body: "The code is true, and this piece is real. But someone already holds it, so we have
written to them. If thirty days pass without an answer, it becomes yours; if they say no, it
stays theirs."
Note: "Nothing here needs Adrian. This runs on its own, and you will hear the moment it
changes."

**Option B**
Head: "Held, and being asked to let go"
Body: "You have the true code, and this piece belongs to you the moment its current caretaker
releases it. We have already written to them. Thirty silent days passes it to you; a refusal
settles it the other way."
Note: "Either way, you will know. This is between you, them, and the piece, no one else."

---

### 12. The door · "A reissued plate" → permanence
**Where** `components/collector/copy.ts`, `states.plateHead` / `plateBody` / `plateNote`
**Now** (placeholder) "The plate on this piece was replaced in 2025." / "The code you scanned
belongs to the first plate and still leads here. One piece, one record, and both plates are
part of its story." / "Adrian's wording for why a plate is replaced goes here, and it is the
same for everyone who reads it."
**Adrian's ruling** "Plates are not replaced. It always keeps the same number. Maybe there is a
way to give higher level of access once you have a real claim so that the other person if
they've taken the number cannot claim again."
**Why it needs rewriting** The whole premise of the placeholder screen, that a plate gets
swapped for a new code, is retired by this ruling. The screen this becomes is about
permanence: a damaged plate is re-engraved with the *same* code, it never gets a new one, and
whoever holds the real Ownership Code outranks anyone who tries to squat on the number.

**Option A**
Head: "This plate was re-engraved, not replaced"
Body: "Its number never changes. If the original plate was damaged, a new one was cut, but it
carries the same code Earth's Breath has always had. One piece, one number, forever."
Note: "The true Ownership Code always outranks any other claim on this number. Nobody can take
it by getting here first."

**Option B**
Head: "One number, forever"
Body: "This piece has never had more than one code. A plate can be re-cut if it is damaged, but
what is written on it never changes."
Note: "Whoever holds the real code is the true claim, no matter who else has tried this number
before them."

**Record for Part 2, not a screen:** the elevated-claim idea Adrian raised, that binding a
piece with the true Ownership Code should outrank any prior squatter claim on that number, so
the number can never be permanently taken from its rightful caretaker. See "The plate ruling"
under the safe-passing design below.

---

### The safe-passing-by-email design, for Adrian's approval

Prose only, no code, no screen wording yet. This describes the mechanic entries 6, 7, and 8
assume; Adrian should rule on the mechanic before the screens above are finalized against it.

**Today:** transfer is admin-only and instant. Adrian moves a piece from one account to
another by hand; there is no self-serve passing yet.

**Proposed, modeled on the invitation system already built for entry 13:**
- A caretaker starts a passing by entering the receiver's email.
- That address is **read back to them before it sends**, the same confirm-before-commit
  pattern the code-entry vault already uses, so a mistyped email cannot send someone's piece
  to the wrong person.
- The receiver must **sign in with a verified account matching that exact email** to accept.
  A stranger who happens to see the email cannot claim the piece; the account and the address
  must match.
- The passing **expires after 30 days** if the receiver never accepts. The current caretaker
  keeps the piece and can start again.
- The **sender can cancel at any time until acceptance.** A mis-sent passing, a change of
  mind, a dispute mid-flight: all of it stops with one action on the sender's side, no waiting
  on the receiver, no writing to Adrian.
- **Nothing moves until acceptance.** Ownership, the household order, everything about the
  piece stays exactly where it is until the receiver actively accepts, which mirrors the
  already-held claim's own rule that silence is never consent.

**Contrast with today:** this replaces the admin-only instant transfer with a self-serve,
reversible, receiver-confirmed handoff. Adrian never has to be the one who moves a piece by
hand except in the genuinely disputed cases the already-held mechanic already routes to him.

**The plate ruling, restated as a system change:** retire the replace-plate mechanic that
mints a new public code for a re-cut plate. A damaged plate is re-engraved with the **same**
code it always had; the piece keeps one number, forever. To make that safe against someone who
scanned an old or copied code and tried to register first, **an elevated claim**, binding the
piece with the **true** Ownership Code, always outranks any earlier claim made without it, so
the rightful number can never be permanently taken by a squatter.

---

## Part 3 · Deferred

### 17. "What shows" — the redesign
**Where** `components/collector/copy.ts`, `gathering.showsHead` / `showsBody` and the whole
lamps screen (`walk.tsx` `SHOW_LAMPS`, `WHO_LAMPS`)
**Adrian's note, verbatim** "The design of this is not right. The graphics and the layout and
the buttons are not right. You need to clean them up. You can scroll in some setup like
something like this. The wording's not quite right and people don't know how to fill this out.
This is something to go into later."
**Status** Deferred, on Adrian's own instruction. No drafts here; this entry exists only so
the note is captured and not lost between now and whenever this screen is worked. When it
comes up: graphics, layout, and button treatment all need a pass, not just wording, and
scrolling is explicitly permitted on this one screen ("You can scroll in some setup like
something like this") where the rest of the flow forbids it (§5: "no setup screen ever
scrolls"), which is itself worth confirming with him rather than assuming, since it breaks a
rule locked everywhere else.

---

## Entries not included here

`tierSealWriterNote` (`components/collector/gardenReview.tsx`) is **LOCKED** — Adrian's own
words, read back and confirmed. It is deliberately not in this workbook.
