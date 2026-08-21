# Admin consolidation: nine Artwork links become two, and Continuity gets a home

Status: plan, not started. Written 2026-08-21.

This is not a new design. It finishes two decisions that were already made and
then drifted apart, and it adds the one surface the system needs but has never
had: a place where Adrian can see and maintain the succession itself.

## The three facts this plan rests on

**1. The approved navigation says the Artwork group is three links.**
`docs/superpowers/specs/2026-07-17-admin-studio-workspace-design.md` (status
"Approved direction") states the purpose as "Turn the Adrian Rasmussen admin
from eight separate tools into one dependable studio workspace," and names the
Artwork group as exactly: Registry and plates · Private viewings · Artwork
stories. The July plan encodes that same three-item group twice, once as the
navigation constant and once as a contract test.

It is nine today. Every link after July was added by a different feature plan
as it shipped, and none of them revisited the approved shape:

| Added by | Link |
|---|---|
| plate wizard (2026-07-21) | Optional plate wizard |
| maintenance workspace (2026-07-30) | Maintenance |
| registration walkable (2026-08-09) | Artwork registration, Collector invitations, Certificate editor |
| rehearsal rail (2026-08-19) | Rehearsal |

**2. The per-artwork page was built on purpose as the hub, and adding it to
the navigation was simply missed.** Task 5 of
`docs/superpowers/plans/2026-08-10-collector-admin-workflow-integration.md`
specifies `/admin/artworks/:artworkId` with exactly the six sections it has
today. It is complete and unreachable from the sidebar; you can only arrive
from a deep link inside one of the other nine screens.

**3. The plan explicitly forbids absorbing the specialists into it.** Same
document, non-goals: "Do not merge pricing logic, viewing curation, invoice
mechanics, recovery, and collector ritual into one large module." Task 5 Step 3:
"The workspace calls existing routes and writers rather than embedding copies of
their forms."

So the artwork page **links out**. It does not swallow. This makes the work
smaller and safer than a rewrite, and it is a deliberate safety property: the
protected mutation paths stay where they are.

This consolidation is Tasks 6 and 7 of that eleven-task plan. Tasks 1 to 5 are
done. Tasks 6 to 11 are not.

## The target navigation

```
Home        Studio overview

Artwork     Register an artwork          the ceremony, creates records
            Artworks                     list, then one artwork's whole state

Continuity  Succession                   NEW, see below

Publishing  Stories · Poetry · Media

Sales       Verified sales · Private viewings · Pricing · Invoices
```

Private viewings moves to Sales: it curates for a person, not an artwork.
Rehearsal leaves the navigation entirely. The walkthrough guide already calls
it a rehearsal of the real steps, not a tool. It stays at its address for
running the canary.

Registry and plates, the plate wizard, certificates, invitations and
maintenance stop being destinations. They keep their addresses and stay
reachable from the artwork page, which is where you will already be standing
when you need them.

## Continuity: the part that is missing

The Successor's Handbook (`docs/registry-custodian-guide.md`, written
2026-08-19) is the reason the whole registry exists. Its own words:

> One passphrase, one envelope file, and the folder above: that is everything
> a museum or a family member needs to take the registry on.

**Today it is invisible inside the admin.** The handbook is generated into the
export archive and can only be read by downloading a zip. Nothing in the
interface tells Adrian the succession exists, whether it is in good order, or
what it is still waiting on. That is the gap this plan closes.

A Continuity page holds four things, and nothing else:

**a. The state of the succession, honestly.** When the archive was last taken.
When the ledger last synced to the mirror. Whether the custody envelope has
been created. Whether the yearly drill has been run, and when. Every one of
these is either a real read or it says it does not know. No green ticks that
mean nothing.

**b. The three blanks, fillable here.** The handbook has three lines waiting
for Adrian's handwriting, and until they are filled the handbook cannot do its
job:

> - Written and sealed at: ______
> - A second sealed copy at: ______
> - Family contact for the registry / Technical helper who knows this system

These are typed here and travel into the generated handbook. The physical act
stays physical, paper and seal, but the interface stops being silent about the
fact that it is waiting.

**c. Take the folder.** One button that produces the level-one folder the
handbook describes: the record pages, the ledger, the encrypted archive, the
handbook itself. The export already exists as an address with no page in front
of it. Give it a page, and print beside it the handbook's own instruction to
keep the folder in two places and the passkey somewhere else.

**d. The handbook, readable in place.** Not a download. The page itself, so it
can be read, checked, and corrected without leaving the admin.

## What is broken and must be fixed as part of this

**Records written before launch stay wrong forever.** A record generated while
the collector surface is dark carries "The living record of this piece is not
yet published," and nothing ever rewrites it. Of the eight events that are
supposed to trigger a fresh record, only three have a caller: registration,
attachment, on demand. Claiming a piece, passing it on, activation, a yearly
refresh and a new contribution all do nothing.

The rebuild path exists at `POST /api/admin/records/rebuild` and **has no
button anywhere in the interface.** Grep confirms it is referenced only by its
own tests.

Consequence: every piece registered before the flag flips will serve a
placeholder record to its collector, and the only fix is an endpoint Adrian
cannot reach. This must not ship in that state. Wiring the missing triggers is
larger work; giving the rebuild a button on the artwork page and on Continuity
is small and closes the hole immediately.

## Steps

**1. Put the artwork page in the navigation and shrink the group.**
Add an artwork list at `/admin/artworks` that opens into the existing per-piece
page. Rewrite the navigation constant to the shape above. Move Private viewings
to Sales. Drop Rehearsal from the navigation. Update the contract test in
`tests/admin-studio-shell.test.ts`, which currently locks the nine labels in
order. Every old address keeps working.
_Half a day. After this, the relief is real even if nothing else is done._

**2. Build Continuity.**
New page and navigation group. Reads its state honestly, holds the three blanks,
fronts the archive export, renders the handbook in place.
_A day and a half. Needs a small store for the handbook's filled-in lines and
the drill date._

**3. Give the record rebuild a button.**
On the artwork page and on Continuity. Show, per piece, whether its current
record is a placeholder.
_Half a day. This is the one that stops a real defect reaching collectors._

**4. Make the artwork page the arrival point everywhere.**
Task 5 Step 4 of the integration plan is partly done. Finish it: every
artwork-bearing screen ends with a way back to the artwork.
_Half a day._

**5. Simplify the home screen.**
Task 6 Step 3, still open, verbatim: replace duplicate Quick actions and All
tools grids with work that needs you, recent artworks, recent collectors, and a
small Start new group.
_A day._

Roughly four days. Steps 1 and 3 are the two that matter most and cost one day
together.

## Deliberately not doing

- Not merging the specialist tools into the artwork page. The plan forbids it
  and the reason is sound.
- Not wiring the five missing record triggers. Real work, its own item, and
  step 3 removes the urgency.
- Not touching the collector-facing side. This is the artist's desk only.

## Open question for Adrian

Maintenance has standalone value as a search surface: "which piece was that, I
only remember the collector's name." This plan removes it from the navigation
on the assumption you arrive from the artwork list instead. If you want to keep
a slim search, it belongs in Continuity or as a second tab on the artwork list.
