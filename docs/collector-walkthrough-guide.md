# The collector walkthrough — guided tour of every screen in order

This guide walks you through every real screen of the collector journey in sequence. A caption rail keeps you oriented: chapter name, station name, what to notice, and your place in the walk (Station N of M).

## How to open it

**Artifact** (interactive clickable walk): [link kept in the conversation]

**Build the prototype locally**:
- `npm run collector:prototype` builds the single-file prototype.
- Open `collector-prototype.html` in your browser. Default mode is the interactive walkthrough.
- `?chrome=full` opens the plain review shell (no caption rail) if you want to examine screens without guidance.

**Dev server** (dev builds only):
- Run `npm run dev`.
- Visit `/dev/walkthrough` to walk the screens with the caption rail, same as the artifact.

## What the demo shows

The walkthrough runs against sample data. Every collector story is seeded with the same sixteen-`1` code (the successful bind path). Enter `sixteen 9`s to see the wrong-code state. The demo registration produces a demo Ownership Code and the ceremony screens run against a small in-browser stub registry.

The ceremony chapters advance only through their real buttons. The caption rail cannot skip into accumulated form state, so stepping forward always requires the button press you would see in production.

## How to run the rehearsal (the real walk)

The rehearsal at `/admin/rehearsal` walks eight real steps of the artist side, each handing to the next. Sign in with admin credentials to begin.

- **Steps 1–4**: Registration ceremony and foundational flows work without preview flags.
- **Steps 5–7**: These need the `livingLegacy` preview flag on. Rehearse on a preview deployment or dev server, not on main.
- **Step 8**: The final confirmation step.

Each step leads directly into the next. You cannot skip or reorder.

## Three deliberate limitations (by design)

The following are not bugs. They are intentional simplifications for this walkthrough:

1. **The garden holds its own state.** The Ask, Index, and Write steps live inside one station because the garden room maintains its own internal state. You cannot jump into the middle of garden choices from the caption rail. This reflects how the production flow works: the garden is a single integrated room, not separate screens.

2. **The ceremony chapters advance only by button.** The caption rail displays the current chapter but cannot jump forward to a later chapter or jump backward. You must press the real Next or Continue button to advance. This ensures you encounter every screen and button in the order a real collector would.

3. **The gathering is self-reported.** Step 6 of the rehearsal (the gathering, where the collector signs the record) has no admin-visible signal. You report completion when you have walked through it. The ceremony state stays private on the collector side, so there is no "gathering complete" webhook or admin readout. You verify manually.

## Cross-reference

The collector journey's locked wording, privacy model, passing mechanics, and rules live in `todo/plans/collector-screen-wording.md`. The two visual companions are `todo/plans/collector-flow-preview.html` (every screen as a phone card) and `todo/plans/collector-flow-chart.html` (the journey with all branches). Read all three before touching any collector code.
