# The Collector Journey — the acceptance spec

> **What this is.** The customer flow, written as the thing the build gets checked against.
> Adrian described this flow in his own words on 2026-08-09. Every step below is checkable:
> a person can walk it, or they can't. When a step can't be walked, this document says why
> and what is missing.
>
> **This file outranks feature lists.** If a built feature doesn't serve a step here, it is
> decoration. If a step here has no feature, that is the work.
>
> **Companion documents.** `artwork-registry-finish-and-handover.md` is the registry's own
> build plan (the eight tasks). `living-legacy.md` is the older reconciled plan written when
> the ledger was assumed to live on mandalacodes — **its Decision A is now overturned, see
> below.** `mandalacodes/todo/plans/living-art-legacy.md` holds the ceremony, consent, and
> dream design that is being rehomed here.
>
> **The build order lives in `the-collector-build.md`.** This file says what must be true.
> That one says what to do next, in order, including the visual design stages.

---

## Two words used throughout, defined once

**Rings** are the privacy model — four levels of who can see what. They are not letters,
not stages, and not a sequence a person moves through. Each opens on its own; none opens
because another did. Full detail at step 7.

**Letters** are messages the piece writes to its holder — when a related piece is claimed
somewhere, when a year has passed, when the piece changes hands. The return loop that keeps
a piece speaking to its holder rather than being a form filled in once. Full detail at step 14.

**The one place they touch:** a letter may only mention what a ring has made visible. A piece
can say a related piece lit up in Buenos Aires because that holder opened ring two. It may
never name them unless they opened ring four.

---

## Decision A, overturned — the registry on this site is the ownership record

`living-legacy.md` recommended the opposite: keep the ledger on mandalacodes, make this site
the front door. **Adrian ratified the reverse on 2026-08-09.** That earlier recommendation was
correct for what it knew; two facts changed it.

**Fact one — the Atlas is not a mandala system.** It holds every artwork Adrian has ever sold,
filterable by series, of which the 64 Universal Language pieces are one series among five.
The catalog already carries 173 pieces: 64 Universal Language, 42 Mandala, 34 Light Codes,
21 Objects, 12 Signature. Filing all of it under a mandala-branded domain is a scope inversion.
The succession letter in `mandalacodes/docs/ledger-successor.md` already opens by calling the
Atlas "the living history system for every piece of physical art that has left Adrian
Rasmussen's studio" — the intent was always general; only the hosting was specific.

**Fact two: there are two ownership implementations, not two populated account stores.** This
was not visible when `living-legacy.md` was written. Both code paths can write ownership, but both
deployments already share the same account database. The configured Atlas ledger object was absent
and its public response was empty when Phase 0 audited it:

| | mandalacodes Atlas | this site's registry |
|---|---|---|
| Record | hash chain in R2 JSON | hash chain in D1, append-only enforced by triggers |
| Person | `StewardRecord` in `stewards.json` | `keeper_pieces.keeper_user_id` |
| Proof | printed QR + account binding | `AR-XXXXXXXX` public code + encrypted Ownership Code |
| Depends on payment | sale bridge is the primary entry | **explicitly severed** (migration 022) |
| Lives with the person | no | yes |

**Why this site's registry survives.** The ownership record belongs where the owner lives, and
the owner lives here: the shared accounts database, the birth details, the catalog, the sale,
the login. Its history log is protected at the database level (`013_artwork_lineage.sql` raises
`ABORT` on any UPDATE or DELETE) which is a stronger guarantee than a mutable JSON file whose
tamper-evidence depends on an external mirror. And it already made the harder architectural
choice: migration 022 cut its dependency on commerce entirely, so a piece can be registered
with no sale, and the record survives with no payment provider in existence. That is what
Adrian asked for on 2026-08-09 and it is already true here.

**What moves here from mandalacodes.** The ceremony and the meaning layer, which is the better
half of that system: the four-ring consent model, the dream and its yearly ritual, letters from
the piece, the claim-as-ritual first inscription, Founding Lights ordinals, the globe. Adrian's
words: *"all the writing and the dreams and all of that, the way that it is displayed is very
good, but it needs to live with the art registry."*

**What mandalacodes keeps.** The oracle, the 64 as a deck, and the kinship between them. It
becomes a portal into the registry, not a holder of records. Kinship threads stay there because
they match on trigram, which only the 64 carry — a painting has no trigram. That boundary was
already ratified as permanent and it stays permanent; it is a boundary, not a gap.

**What does not survive the move.** The hexagram ring as the way to browse. It is the index of
the 64. All other work needs a different way in, by series or year or where it lives. That is
new design, called out in Missing below.

**The source chain keeps its identity in a separate envelope.** Its hashes are content-based over
canonicalized source events, with no domain or bucket in the hash, so the original source evidence
survives relocation. The local registry uses a different hash envelope and event vocabulary, so
source events must not be inserted as native lineage. They remain an append-only source chain
linked to the local keeper record. The public mirror still matters as historical evidence, but the
planned 18-piece export was not present in the configured object or available recovery copies.

---

## The three boxes — where every piece of data goes

The rule that prevents the two-systems problem from recurring. Everything belongs to exactly one
box. When a new feature needs to store something, this decides where without a fresh argument.

**The person.** Name, contact, birth details, links, business, privacy choices, which pieces they
hold. Lives once, in the shared accounts database on this site. Both sites read it; neither keeps
a second copy. Private by default.

**The piece.** Its history, makers, materials, transfers, and whatever its holders have stored in
it. Lives with the piece forever and survives every change of owner. This is the registry.

**A reading, or a moment.** An oracle draw, a chart cast, one interpretation. Derived from the
person and the piece, never the source of either. Disposable — delete one and nothing is lost.

The birth date sits in the first box. The chart derived from it sits in the third. That is why
the date stays private forever while what it produces can be shared if the person chooses. Same
rule settles the map: the piece's location is box two; the person's home address is not on the
map at all.

**Test for the seam being right: a person is never asked the same question twice.** Enter a birth
date for a reading on Monday, register a piece on Friday, and Friday says "we have your birth
details, is this still right?" — never an empty field. If it asks twice, the two sites are two
systems wearing a shared login, and everything built on top is sand.

---

## Three doors, one registration

Adrian's flow began at a QR code on a new purchase. Two more doors are equally first-class, and
one of them is how the system actually starts.

**Door one — Adrian registers it.** He registers a piece and hands it over in person. No sale
record, no payment provider. This is the default at launch.

**Door two — the invitation.** Someone who bought a piece years ago is invited to bring it onto
the system. They have no printed code, so the invitation itself carries the proof. Their piece
has a history that predates the system. This is a first-class flow, not an edge case, and it is
how the map gets populated.

**Door three — the sale.** A purchase starts the registration automatically. **Not built at
launch, and must not be built in a way that blocks it later.** The sale becomes one more way a
piece gets registered, never the way. Migration 022 already establishes this correctly: the
registry does not read from commerce, so adding a sale trigger later is additive and touches
nothing already built.

All three doors land on the same registration flow and produce the same record.

---

## The journey — step by step, each one checkable

Status on each step: **Built** (works here now) · **Elsewhere** (works, but on mandalacodes,
needs rehoming) · **Missing** (does not exist anywhere).

### 1. The piece carries a way in
The physical piece carries a QR code or a written address. Scanning or typing it opens the
piece's page.

**Built.** The QR redirect is permanent infrastructure and every issued code is recorded in one
place. The public code format is minted and reserved against collision with catalog identifiers.
Note: the printed QR is a pointer, never a credential — this is ratified and must hold.

### 2. Arrival, before any sign-in
The page opens with no login wall. The artwork, its story, where it was made, its materials, its
year, and the public spine of its history. A person who wants nothing more than to look has a
complete experience.

**Elsewhere.** The zero-signup arrival page is built on mandalacodes, where a formal review named
a login wall here "the single biggest missing artifact." The corresponding page here is a public
record page. Rehome the arrival treatment onto it.

### 3. Two doors from arrival
Two choices, nobody pushed: **register and certify this piece**, or **begin your dream**. The
short path must feel complete on its own.

**Elsewhere.** Designed on the mandalacodes side, not built here.

### 4. The ownership code
The second code, from the underside of the piece, proves possession. Entering it begins
registration.

**Built, and stronger here.** The code is stored encrypted with a versioned key, never in plain
text. Revealing it requires admin sign-in plus a separate registry unlock, and every reveal is
recorded. The claim endpoint enforces the full state machine: unregistered returns not-found,
first bind stamps the holder, a wrong code is refused, the same person re-scanning is harmless,
and a piece already held by someone else is routed to a contested-claim path rather than silently
overwritten. **For door two, the invitation must carry this proof instead of the printed code —
Missing.**

### 5. What is about to happen, said plainly
Before anything is asked: you are registering this piece to you, certifying it as authentic,
storing your intentions in it, and connecting it to the map of collectors. The piece lasts
forever. The code lasts forever. Whoever holds the code holds the access. Keep it safe.

**Missing.** No such screen exists on either side. This is the Apple-style opening and it is the
first thing a person reads. It is also where the promise gets made, so its wording is load-bearing
— see the honesty note below.

### 6. The certificate
Who made it, who designed it, what wood, what stones, where it was manufactured, the year, the
edition.

**Missing, and it is a data problem before a design problem.** Every one of the 64 pieces carries
the identical material string "Laser Cut Wood, Acrylic." No wood species, no stones, no maker
names, no manufacture location exists anywhere in either project. The place to hold it exists —
this site has a provenance table with typed entries for contributor, creation place, material,
technique, and intention, each with its own private/steward/public visibility. It is empty. Only
Adrian has the answers.

### 7. Privacy, decided once, on one screen
Clear, simple, on a single page: your privacy is respected, and you choose what to show and what
to keep.

**Elsewhere, and it is the best thinking in either system.** The four rings, in plain terms:

- **Ring one — your private record.** Always on, no switch. Nobody else ever sees it. What you
  write for yourself and for whoever inherits the piece. Content by or about a child is locked
  here permanently — no switch exists to make it public until that person is an adult and says so.
- **Ring two — the dot on the map.** City level only, never an address, with a population floor
  so a small town cannot identify a home. **Off by default; you tick it on.**
- **Ring three — your chart.** Off by default, offered later on the piece's own page, never
  pushed. Only what is derived from your birth details, never the details themselves.
- **Ring four — you.** Face, name, intention, business, mission. Five separate switches, each
  off, so you can show your name without your face.

**Why rings rather than one switch.** A review found default-on location consent both legally
noncompliant and genuinely unsafe: location joined with identity tells a stranger where a
valuable object sits in a named person's home. So each layer opens on its own and none opens
because another did. Identity and city must never appear on one surface without a separate,
explicit opt-in.

Consent is versioned, timestamped, and appended to a history. It is stored mutably, never in the
chain, because consent must be revocable and the chain is not.

### 8. Your name and how people can find you
Name, links, business, what you want other collectors to be able to learn about you.

**Elsewhere in schema, deliberately not surfaced.** The per-field flags exist. The public gallery
is cut from the roadmap until at least 25 people have opted in, because five faces read as a ghost
town. That gate is correct and stays.

### 9. Birth details
Asked during registration, framed as connecting to the wider system and to other collectors.
**The date itself is never shown to anyone.** Skippable, and addable later through the oracle.

**Conflict to resolve, and Adrian's rule wins.** Three positions currently exist: mandalacodes
defers birth data entirely out of the claim screen as "far too heavy"; a later addendum describes
a default-on preselected choice at signup; Adrian's rule on 2026-08-09 is asked-at-onboarding,
never-displayed, skippable, addable-later. His rule is the spec. It also resolves the tension,
because it separates the fact from what is derived: the date is private always, and only the chart
derived from it can ever be shown, and only on opt-in.

**Also Missing structurally.** Birth details are stored twice, once per site, computed separately —
same shape, two databases, no shared row. The three-boxes rule says one field on the person. This
is a real migration and it blocks the never-asked-twice test.

### 10. The dot appears
Registration completes and the piece becomes a light on the map. Size reflects the piece. Brightness
reflects how much the holder puts in and chooses to share.

**Elsewhere, and one part needs design.** The globe, the ignition on first inscription, and the
permanent claim-order ordinal all exist. Founding Lights is already ratified as all pieces, all
series — it never assumed the 64. **Brightness as a function of what a holder contributes is
Missing.** It needs a definition that cannot be farmed: brightness should follow real contribution
and real sharing, not visit count or word count.

### 11. Feeding the piece
Multiple prompts, choose one, fill it in. Each with its own private-or-public gate. Never work,
always a gift.

**Elsewhere.** The dream model: one dream at registration placed at one of four scopes, an optional
thread of markers added only when something real happens, and a once-yearly ritual near the holder's
birthday offering three choices — reinforce, plant new, or mark fulfilled. Two explicit rules survive
the move: **no approval gate on a shared dream** (Adrian: an approval step demotes the project) and
**no visible support counts ever** (the fastest path to becoming social media for prayers).

### 12. Video
A recorded message sealed with the piece. Doubles as a testimonial displayable with the work.

**Missing, entirely new, and the one place the promise can break.** What exists is a sealed *text*
letter, which is the same shape at a thousandth of the cost. Video needs decisions on where it
lives, what "forever" means when a video costs real money every year, and how additional uploads
are paid for. The existing plan's honesty is the right frame and should govern this: *"the product
promise is a record that travels with the piece and that you can always export and hold yourself,
not forever. Forever is a claim a solo artist on rented infrastructure cannot underwrite."*
**Do not promise permanent video hosting in step 5's wording.**

### 13. More than one holder
A spouse, a partner, children — each able to add their own material, each with their own access.

**Missing.** One holder per piece today. The nearest built thing is heirs, which are deliberately
hints only and never auto-bind — an email matching a registered heir grants nothing, and activation
is always a mediated transfer. That hardening is correct and must survive. Co-holding is named as
future work with the intent that widening stays cheap, so the schema does not block it. Two shapes
needed: roles (holder versus contributor) and holder type (person versus organization).

### 14. The yearly return
A yearly check-in and reminder, well thought through, that never feels like work.

**Elsewhere, partly.** Two separate things carry this, and they should not be conflated.

**The yearly ritual** is the holder's own moment, near their birthday: three choices, never a
blank form — reinforce the dream you hold, plant a new one, or mark one fulfilled. Once a year is
what makes it ceremony rather than a feed. Designed, not built.

**Letters** are what the piece sends unprompted. Built for three occasions: a related piece being
claimed somewhere in the world, the anniversary of the holder's own claim, and a transfer. The
voice is the piece's own — *"Tonight a piece sharing my Water trigram came to light in Buenos
Aires."* A letter may only mention what a ring has made visible; it names a city because that
holder opened ring two, and it may not name the person unless they opened ring four.

**Missing:** the artist's own annual letter to everyone, and the printed yearly addendum page.

### 15. Transfer
The piece sells. The new holder enters the code. Everything stays with the piece as part of its
history, and the process begins again for them.

**Built in structure, with a Phase 1 foundation repair required.** The canonical registry has the
keeper state, private maintenance history, recovery, and an append-only public lineage. The current
administrator transfer does not yet append the public `transferred` lineage event, and its reset
action can make a previously claimed piece directly bearer-bindable again. Both paths must be
replaced by one atomic governed transfer before new registration work relies on them. Contested
claims must also move off the frozen legacy writer into this registry. After that repair, transfer
carries an opaque kind such as sale, gift, inheritance, or artist rebind, and a claimed piece can
never rebind outside audited transfer. A contested claim can only resolve through a human. The
escalation path that could free a piece from an
unresponsive holder is **deliberately switched off** because it requires four warnings a person
actually received and there is no way to send them yet: *"Silence a keeper never heard is not
consent."* Leave it off until warnings can be delivered.

---

## What blocks a full walk today

**The ownership authority is now one system.** Phase 0 froze the legacy writer and retired its
holder-dependent readers. Before the registration experience builds on it, Phase 1 repairs the
canonical transfer path and moves contested claims into the canonical database. This is not a
second ownership merge.

**The catalog still needs registry identities.** The catalog already contains every artwork, so
seeding registry entries is agent-runnable implementation rather than Adrian's data entry.

**The certificate needs an editing workflow.** Materials, makers, origins, and wording use reusable
templates with per-artwork overrides. Unrecorded fields remain absent until Adrian fills them.

**Birth details already use one shared profile row.** Phase 1 only needs to make the onboarding
experience reuse that row so a person is never asked twice.

**The registration flow is still framed around making a metal plate.** The registry's own build
plan already diagnoses this and calls for reframing it as registering an artwork with the plate
as an optional step afterward. That reframe and the invitation door are the same work.

---

## The rules that survive the move

These were paid for with real review and must not be relitigated when the ceremony layer rehomes.

- Never put a name, email, free text, birth datum, or photo into a hashed event. The chain carries
  opaque identifiers, event types, dates, curated city identifiers, and salted commitments. Nothing else.
- The printed code is a pointer, not a credential.
- Recovery is an ownership operation, never an edit to history.
- No approval step between a person and their shared dream.
- No visible support counts, ever.
- Machine-asserted identity is never shown to a human as verified.
- Minors never hold their own accounts; a guardian authors on their behalf, recorded as such.
- Do not build a surface whose magic depends on a crowd that does not exist yet.
- A filter must dim, never empty, the map at low density.
- No physical plate is engraved and no production identity is issued until Adrian approves the
  design and one clearly-marked test piece proves the whole path.

---

## Tunable after the walk exists

1. **Factual content.** Adrian gradually fills materials, makers, manufacture location, and wording
   through templates and per-artwork overrides.
2. **Video.** Optional attached video, with no promise of a personal recording or permanent hosting.
3. **Holding roles.** One canonical keeper has authority; spouses and family are contributors unless
   a later reviewed ownership model deliberately changes that rule.
4. **Brightness.** Unregistered pieces are dim and registered pieces are equally lit. Engagement does
   not change brightness.
5. **Invitations.** A single-use, artwork-specific invitation tied to its intended recipient supplies
   the proof for a retroactive collector with no printed code.
6. **The plate registry's eight tasks.** Its first task is the same registration reframe this document
   needs; physical production still waits for Adrian's test-piece approval.
