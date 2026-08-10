# The collector journey, as a shell

Built 2026-08-10 from two sources held together:

- **the look**: the Claude Design project `Collector Piece Page.dc.html`
  (project `bacd5df4-c158-4533-821e-115fbf528da4`), plus its `collector-gaps/`
  notes
- **the words and the behaviour**: `todo/plans/collector-screen-wording.md`
  (the master, section 6 winning) and `todo/plans/collector-primitives.html`

Where they disagreed on copy, the wording record won and the divergence is
listed at the bottom of this file.

## What this is, and what it is not

It **is** a look-and-navigation shell. Fifty-seven surfaces, all reachable, the
whole journey walking end to end at 390 wide.

It is **not** wired. No account, no database, no `/api/keeper/*`, no flag read,
nothing persisted. The code that opens the piece is **sixteen ones**; sixteen
nines runs the wrong-code state. Both are checked in the browser. Anything a
person types is thrown away on the next screen.

## Where it runs

`/collector`, which is chromeless and off the site's navigation. `?screen=<key>`
lands directly on one surface.

It also builds into **one self contained HTML file** that opens by double
clicking it, with React and the fonts inlined and no network request of any
kind, so it can be handed to anyone without a repo or a server:

```
npm run collector:prototype                    # writes collector-prototype.html
npm run collector:prototype -- out.html        # somewhere else
npm run collector:prototype -- out.html --fragment   # for publishing as an artifact
```

The chips under the phone are the review harness. One of them switches the
marking of unwritten copy on and off, so the same walk reads either as a
worklist or as a visitor would see it.

`components/WorksPage.tsx` at `/works/:code`, where the engraved QR actually
lands, is **untouched**. Folding this body into it is the next pass; doing it
before the look is settled would put an unfinished surface on live
infrastructure. `LAUNCH_FLAGS.livingLegacy` is still `false`.

## The files

| File | What it holds |
|---|---|
| `tokens.ts` | the espresso palette, the three type stacks, the laid-paper layers |
| `copy.ts` | every string, marked `locked()` or `placeholder()`, with provenance |
| `ui.tsx` | the six primitives: ground, rows, fields, capsule, lamps, brass |
| `drawings.tsx` | seven CAD motifs, ordered stroke paths, `pathLength={1}` |
| `Orbit.tsx` | the light: the star, the rings, the two axes |
| `ResonantGrid.tsx` | the map |
| `styles.tsx` | keyframes, hovers, focus, reduced motion, and the prose reset |
| `PiecePage.tsx` | one body, four relationships, a foot that reads relationship |
| `CodePage.tsx` | sixteen characters in two rows of eight, and the vault |
| `rooms.tsx` | the rooms behind the rows |
| `garden.tsx` | ask, index, write |
| `walk.tsx` | the screen registry and its renderer |
| `states.tsx` | the states the happy path does not walk |
| `letters.tsx` | what the piece writes |
| `CollectorShell.tsx` | the review harness: the phone, the chips, the jump list |

`CollectorShell.tsx`'s controls are scaffolding, not design. They come out when
this becomes the page.

## Verified

`npm run typecheck` clean. A Playwright pass walks all 57 surfaces at 390 wide:
no page errors, and nothing overflows its frame in any state.

The piece page's caretaker face is the one surface that scrolls, and only its
row list does: nine rows plus the dream cannot sit under a light that also
grows. The head, the dream and the light hold their positions. "No setup screen
ever scrolls" is a law about setup screens, and no setup screen does.

## Divergences, for Adrian to rule on

**Copy: the wording record won these.** The design file's line is in brackets.

1. **The wrong code.** Used: *"The code is not true / It did not match this
   piece. Turn it over and look again; if it still will not open, Adrian will
   help."* (Design: *"That is not the code / Read it off the underside once
   more, eight and then eight."*)
2. **The release.** Button reads **Begin the passing** with **Not now**.
   (Design: *Release it* / *Not yet*.) The body copy matches in both.
3. **The code warning.** Kept the full locked line, *"Whoever holds the code
   holds access. Keep it safe."* The design drops *"Keep it safe."*

**Structure: two real conflicts, neither silently resolved.**

4. **How many gathering screens are required.** Wording record §6 says three:
   Sign its record, Where it lives, What shows. `collector-primitives.html` says
   two, with What shows as an add-on. Built as **three**, per §6. Worth a
   sentence from Adrian either way.
5. **Three tiers, or two.** §6 settles on three named tiers: *Let it shine* ·
   *Keep it with the piece* (with the heirs' right on by default) and *Seal
   it*, while the design's control is a two-way capsule, *Shows on the page* /
   *Kept in the record*. Built as the design's two-way capsule, because the look is
   the design's, but **the third tier and the heirs' sub-choice are not on any
   screen yet**. This is the largest single gap between what is settled and what
   is drawn.

**Picks I made where the design offered options.**

6. **The orbit's sizing.** The design shows three (8a fills the band, 8b held in
   from the edges, 8c grows with the piece). Built as **8c**, whose own caption
   argues for it: an empty piece is a pinpoint, a full one fills the band, the
   size itself is the record.
7. **The garden's arrangement.** Built as **one at a time plus the index**
   (15g + 15e), which the design marks as picked. The card stack (14b) is marked
   superseded there and is not built.
8. **Drawing viewBox.** `0 0 100 100`, per every drawing in the design file. The
   gaps manifest proposes `0 0 240 240`. The design file won because every
   screen's sizing was drawn against it.

## Known gaps

- **The design file was truncated on read.** `get_file` caps at 256 KiB and the
  file is 262,109 bytes, so the tail of its final section (`2a`, the live piece
  page: the orbit's ring bodies, the row list, the four-relationship foot, and
  the dev chips) was never read. That foot was rebuilt from the wording record
  §6 and from screens `20a`/`20h`, which are the same design language. **To get
  the real thing, split that file in two in the design project.**
- **The Resonant Grid's coastlines are placeholder geometry.** The design
  renders real coastlines from d3 + topojson + world-atlas over a CDN, inside an
  iframe. None are dependencies here. The graticule, the light placement and
  every style value are the design's; the landmasses are hand-drawn and coarse.
  Adding the three dependencies is a decision, not a detail.
- **IBM Plex Mono** is specified by the design for the code cells and is not
  installed. Falls back to the platform mono.
- **The brass button's flat fallback** is not drawn. The design's own note:
  blur costs frames on old phones.

## Still open, and not to be invented

The dream's prompt. The garden's questions. Per-piece materials. What proof the
pre-registry invitation carries. The video capsule's wording, which waits on
cost research. Every one of these renders with a dashed underline in dev, from
`placeholder()` in `copy.ts`.
