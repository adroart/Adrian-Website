# The prompt — paste this to start building

> Copy everything inside the block below into a fresh session, in this repo.

---

```
Read these four files before writing any code, in this order:

  HANDOFF-COLLECTOR.md
  todo/plans/collector-screen-wording.md
  todo/plans/collector-primitives.html
  todo/plans/collector-flow-chart.html

You are building the collector journey for Adrian Rasmussen's art site: a person
buys a physical artwork, scans the code on its underside, registers it, and from
then on the piece carries their intentions and history and passes to whoever holds
it next.

WHAT IS ALREADY DECIDED, AND IS NOT YOURS TO CHANGE

The wording record is the master. Section 6 of it carries the most recent
decisions and wins wherever it disagrees with anything earlier in that file. Copy
marked LOCKED is used verbatim; do not paraphrase it, tighten it, or improve it.

The interactive spec is the behaviour: 46 screens, six interaction primitives,
with durations, easings and three states each. Open it and use it. It has a jump
list under the phone that reaches any screen in one press. Where the spec and
your instinct disagree, the spec wins; where the spec and the wording record
disagree, the wording record wins.

WHAT YOU ARE BUILDING

Real React components in this codebase, matching the spec's behaviour and the
locked copy. Vite, React 18, TypeScript, Tailwind v4, React Router v7. Tokens are
in src/index.css and are real; do not invent new ones. Cormorant Garamond at 20px
and up only, Lora for body, Karla for uppercase labels only.

Start with the piece page, because everything else is reached from it, and it is
the one surface every visitor sees. Build it as ONE body with a foot that reads
relationship, not as separate pages per state. The spec proves this works: the
drawing, name and dream sit at identical positions across all four relationships.

THE LAWS THAT BREAK THE DESIGN IF YOU MISS THEM

  Rows open in place; links travel. Nothing navigates away from the piece page.
  Brass appears only on something you can act on, and never shifts with season.
  No icons, no emoji, no glyphs. Text and colour only for states.
  No em dashes anywhere.
  No count, bar, streak, badge, or any line that asks the caretaker for anything.
  Every CAD drawing is authored as ordered stroke paths, never a flat export, or
    the motion layer dies silently.
  Birth details are shown to nobody, ever. Price is caretaker-only. The
    provenance chain is public.
  Registration is binary: name and where it lives. Everything else is an add-on.

WHAT IS NOT READY, AND MUST NOT BE INVENTED

  The dream's prompt, and the garden's questions. Placeholders are in the spec
  showing the intended shape. Leave them as placeholders and flag them.

  Per-piece materials data, and what proof the pre-registry invitation carries.
  Both are Adrian's.

  The video capsule's wording, which waits on cost research. No promise about it
  appears anywhere until that lands.

HOW TO WORK

Build one surface at a time and show it running. Verify in a real browser at 390
wide and at desktop, and check nothing overflows the frame in any state, because
"no setup screen ever scrolls" is a law here and the phone is the primary target.
Ask before replacing any factual copy. Do not add features the spec does not
show.
```

---

## The files, and what each one is for

| File | What it is |
|---|---|
| [HANDOFF-COLLECTOR.md](../../HANDOFF-COLLECTOR.md) | The manual. Laws, what is open, where things run. |
| [collector-screen-wording.md](collector-screen-wording.md) | The master record. Locked copy, and section 6 for the recent decisions. |
| [collector-primitives.html](collector-primitives.html) | The behaviour, live. 46 screens, six primitives, jump list. |
| [collector-flow-chart.html](collector-flow-chart.html) | The whole journey with its branches, on one page. |
| [collector-flow-preview.html](collector-flow-preview.html) | The original 23 screens as cards. Source of the locked copy. |
| [collector-design-handoff.md](collector-design-handoff.md) | How to brief Claude Design, and the real tokens. |
| [src/index.css](../../src/index.css) | The tokens themselves. Dark mode is genuinely espresso. |

## If you are briefing a designer rather than a builder

Send them the interactive spec and the design handoff, and say: the wording is
locked and the behaviour is specified, what is yours is how it looks. Point them
at the jump list so they can walk every screen without pressing through the flow.
