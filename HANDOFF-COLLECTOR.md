# Collector journey: the manual

> **For the next session, human or AI.** Everything about the collector flow: where it
> lives, what is settled, and what is still open. Rewritten 2026-08-10 at the close of the
> structure sessions. To start a fresh chat, say: *"Read HANDOFF-COLLECTOR.md in
> Adrian-Website and pick up where it says."*

---

## What this is

A person buys a piece of art, scans the code on its underside, and registers it. From then
on the piece carries their intentions, their history, and eventually their family's, and it
passes to whoever holds it next. It is one page, one address, forever.

**The flow is fully structured: 46 screens, every one reachable, verified in a browser.**
What remains is wording and two research questions.

## The documents, in reading order

1. **[The interactive spec](todo/plans/collector-primitives.html)** START HERE. Six
   interaction primitives rendered live and touchable, plus all 46 screens walkable. A jump
   list under the phone reaches any screen in one press. This is the thing to open.
2. **[The wording record](todo/plans/collector-screen-wording.md)** THE MASTER. Every
   locked line, plus **section 6**, which carries everything decided 2026-08-10 and wins
   wherever it disagrees with anything earlier in the file.
3. **[The flow chart](todo/plans/collector-flow-chart.html)**, the whole journey with its
   branches, rebuilt from the verified graph.
4. **[The screen cards](todo/plans/collector-flow-preview.html)**, the original 23 screens
   as phone cards. Still the source of truth for the locked copy.
5. **[The design handoff](todo/plans/collector-design-handoff.md)**, how to brief Claude
   Design: the Apple setup shape, the real tokens, the CAD line-drawing rule.
6. **[The journey spec](todo/plans/the-collector-journey.md)** and
   **[the build plan](todo/plans/the-collector-build.md)**, the original acceptance spec
   and ordered work. Both predate the 2026-08-10 sessions.

## The flow in one breath

Scan → the piece page, dressed by relationship → Begin → the code page, sixteen characters
in two rows of eight, and the last one is the press → the vault → the code is true → four
screens → two required screens → You are Light 47 → home, which is the same page warmed.
Then it accumulates for as long as it is held, and passes on.

## The laws (do not relitigate)

**The page**
- **One page, one body.** The body is identical for everyone; only the foot and which rows
  exist change. Verified: the drawing, name and dream sit at identical positions in all
  four relationships.
- **Four relationships:** unclaimed (a lit *Begin*, the only bright thing) · registered
  (two peer doors, neither above the other) · signed in but not yours (an account is not a
  claim) · yours (no pill, no doors, nothing left to claim).
- **Rows open in place, links travel.** Anything that leaves the page is a link.
- **Brass only on what you can act on**, and brass never shifts with the season.

**The light**
- **Two parts.** The long glow holds everything ever placed and never fades. The near light
  brightens when something is placed and dims over months of quiet. Nobody who was ever
  devoted looks abandoned.
- **Two axes that never combine into a score.** Years held deepen the ground; what is
  placed brightens the light. A ten-year-old quiet piece reads old and quiet; a new
  well-tended one reads bright and new. Neither is ahead.
- **Never** a count, bar, streak, badge, or a line asking for anything. The invitation is
  that the page visibly comes alive, never a prompt.

**Privacy**
- **Three tiers:** *Let it shine* (public, and once it shines it always shines) · *Keep it
  with the piece* (holder-only, **and they may publish it one day**, that clause is on the
  control) · *Seal it* (nobody, ever). Shining is the default.
- **The heirs' right is ON by default**, hidden when sealed. The writer decides in advance,
  because only the writer knows which thing is which.
- **Publishing is a per-item act wherever the item lives.** There is no triage screen at
  transfer, deliberately.
- **Birth details are shown to nobody, ever.** Price is caretaker-only; the provenance
  chain is public.

**Registration and people**
- **Registration is binary.** Three required screens: your name (Sign its record), where it lives, and what shows.
  Everything else is an add-on reachable forever.
- **One account across the ecosystem**, Mandala Codes, the ledger, ordering already signed
  in.
- **The household is the people whose love is in the piece**, not an invite list. Being on
  it promises nothing.
- **Succession is a private mark one tap inside a person**, never on the row: adding
  someone is warm, naming them next is a will.
- **Thirty silent days** with reminders passes a claimed piece; only active refusal reaches
  Adrian.

## What is still open

**Wording, and it is all Adrian's**
- **The dream's prompt.** The highest-stakes line in the flow: every guest reads it, and it
  locks for a year once placed.
- **The garden's questions.** Eight samples are in place showing the intended shape.
- **Placeholder copy** across the screens built 2026-08-10 (the passing, the household, the
  arrivals). None of it is locked.

**Research, named by Adrian**
- **Which garden questions wait for the birthday** and which stay open all year, and what
  the birthday moment actually is (a rewrite, a check-in, an amendment). Constraint: *"You
  don't want to be hit with ten questions on your birthday."* Depends on his study of
  gratitude and retrospective practices.
- **The video capsule's costs.** Storage per short recording, per-piece economics across
  years, what a solo artist can underwrite. No promise appears in any wording until this
  lands.

**Two small calls**
- The photograph shrinking to an anchor versus collapsing when a row promotes (built as
  shrinking).
- Three link services versus five (built as three plus an add-another tile).

**Still needs Adrian from the original spec**
- Per-piece materials data. The certificate is placeholder without it.
- What proof the invitation carries, which blocks the pre-registry door.

## Where things run

- The plan files open directly in any browser. During sessions they are served locally from
  the plans folder.
- The site deploys from `main` via Cloudflare Pages: pushing is shipping. These files live
  under `todo/plans/` and are not routed pages, so they ride along without changing the
  live site.
