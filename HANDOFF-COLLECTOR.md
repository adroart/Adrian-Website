# Collector journey — the manual

> **For the next session, human or AI.** Everything about the collector flow, where it
> lives, what is locked, and what happens next. Written 2026-08-09 at the close of the
> wording sessions. To start a fresh chat on this work, say: *"Read HANDOFF-COLLECTOR.md in
> Adrian-Website and pick up where it says."*

---

## What this is

The collector journey: a person buys art, scans its code, registers it, and it becomes a
light on the Resonant Grid, the living artwork spanning every piece Adrian has released.
The entire flow is settled in wording, in Adrian's own voice, worked line by line on
2026-08-09. The wording is locked; nobody paraphrases it.

## The documents, in reading order

1. **[The wording record](todo/plans/collector-screen-wording.md)** — THE MASTER. Every
   screen's locked copy, the pillar, the privacy model, the passing mechanic, every rule
   with Adrian's words marked as his. Outranks every other document where they disagree.
2. **[The screen cards](todo/plans/collector-flow-preview.html)** — every screen as a
   phone card in walking order. Open in any browser, double-click works.
3. **[The flow chart](todo/plans/collector-flow-chart.html)** — the whole journey with its
   branches on one page.
4. **[The design handoff](todo/plans/collector-design-handoff.md)** — how to brief Claude
   Design when making the screens beautiful: the Apple setup shape, the site's real tokens,
   the CAD line-drawing rule, one screen per session.
5. **[The journey spec](todo/plans/the-collector-journey.md)** — the original fifteen-step
   acceptance spec. Still true for the deep system rules (the chain, transfer hardening,
   the three boxes).
6. **[The build plan](todo/plans/the-collector-build.md)** — the ordered work. Carries a
   banner deferring to the wording record; a reconcile task exists in
   [TODO.md](TODO.md).

## The flow in one breath

Scan → the piece page (public, one page ever) → Unlock morphs into the code field → the
vault opens → The code is true (or: not true · a passing begins · the fork: gift or
transfer) → the four screens (You felt the pull · The resonant grid · When you focus your
love, it grows · It carries on) → Begin → five quick gathering screens (sign · born · where
it lives · links · what shows) → You are Light 47 → the same piece page, now home: the
glowing meter, the garden, your account.

## The locked laws (do not relitigate)

- **Caretaker / caretake** is the word for the person. **The Resonant Grid** is the name of
  the artwork.
- **The code claims and transfers, then sleeps.** Daily life is the account. Password
  recovery by email; recovery never touches history.
- **The piece shines by default; the person opts in.** Words with no name, city at most,
  never an address; widen to region on request. Birth details never shown, ever.
- **Brightness = questions answered.** The garden lives on the piece page forever, opened
  by the glowing meter.
- **No setup screen ever scrolls.** If it would scroll, it splits.
- **One theatrical moment**: the vault. Everything else is subtle payoffs, additive, never
  blocking.
- **Brass only on the thing you can act on.** CAD line drawings, outline only. No icons, no
  emoji, no em dashes. Dark mode first.
- **The caretaker approves what shines from their piece.** The system approves nothing;
  admin sweeps abuse after publication.
- **Thirty silent days** with reminders passes a claimed piece; only active refusal reaches
  Adrian.

## What happens next, in order

1. **Design the screens** — follow [the design handoff](todo/plans/collector-design-handoff.md).
   Claude Design project exists (id in that file). Round 1 (four dark options of the old
   single opening) is the visual direction reference; Adrian picks a direction, then the
   locked screens get dressed in it, one screen per session.
2. **Write the garden's questions** — the prompts people answer over years. A wording
   session with Adrian, same method: propose, thumbs up or down. Not started.
3. **Build** — after design. Start from the wording record and the build plan. The
   reconcile task in TODO.md aligns the two first.

## Still needs Adrian (from the spec, unchanged)

- The per-piece materials data (the certificate is empty without it).
- What proof the invitation carries (blocks the passing build, door two).
- The video capsule waits on the cost research task in [TODO.md](TODO.md).

## Where things run

- Preview pages served locally during working sessions from the plans folder; the files
  open directly in a browser regardless.
- The site deploys from `main` via Cloudflare Pages: pushing is shipping.
