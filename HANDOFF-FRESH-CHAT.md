# Handoff to fresh chat — design the collector journey's opening screen

Open a new chat in this workspace and paste the block below. The copy button on the code fence grabs it cleanly without picking up surrounding markdown.

```
Design the opening screen of the collector journey, using Claude Design. Drive it yourself — Adrian does not want to interact with Claude Design in the early rounds. Bring him finished screens to look at, not process.

Before touching anything, read in this order:
1. Adrian-Website/todo/plans/collector-design-handoff.md — this is the primary document. It carries Adrian's Stage 1 answers verbatim, the Apple setup-flow layout pattern, the site's real design tokens, and how Claude Design wants to be briefed.
2. Adrian-Website/todo/plans/the-collector-journey.md — the spec. Step 5 is the opening screen. Read the whole thing once so you know what the flow is for.
3. Adrian-Website/todo/plans/the-collector-build.md — the ordered work. The opening screen is item 1.3. The visual design production section carries the six stages.

You do not need to re-survey any of this — verified 2026-08-09:
- The ownership record was ratified to Adrian-Website. The ceremony layer rehomes here from mandalacodes. This is settled, do not reopen it.
- The site's real fonts are Cormorant Garamond for titles at 20px and up, Lora for all body under 20px, Karla for uppercase labels only. The project CLAUDE.md says Cinzel and Lato — that is stale and wrong.
- Both light and dark palettes already exist in src/index.css. Dark mode is genuinely espresso, not grey.
- Twelve real Apple setup-flow screenshots were collected and their layout pattern is written into the design handoff file. If the scratchpad folder is gone, the re-collection brief is at the bottom of that file.
- Adrian withdrew all ten third-party site references. Do not send Claude Design any site references.

The Claude Design project already exists. Use get_project on f563165e-cc1a-4f62-a412-f92a2267dac0. Do not create a second one.

Three things that will go wrong if you do not handle them explicitly:
- Claude Design's default instructions say never to hand-draw SVG imagery and to use striped placeholders instead. Override this. Adrian specifically wants precise CAD-style line drawings: outline only, uniform thin stroke, no fill, no shading, single motif per screen, in the manner of a technical drawing. This was the one thing he singled out from the entire reference sweep.
- Brass appears only on the thing you can act on. Everywhere else is espresso and black. Strict adherence is what makes it read as expensive rather than decorated. This is the single highest-leverage rule in the brief.
- Design dark mode first. Adrian described dark and light as different characters, not a colour swap. Light follows once dark is locked.

Call create_support_js once in the directory before writing any design file. Read the hifi-design skill before starting. Give Claude Design real content, never placeholder text. Ask for all three states: loaded, empty, error. Do not specify a variation count.

Run the verify loop yourself — render, screenshot, check, fix. Do not show Adrian a screen you have not looked at.

Hard rails:
- No popup questions. In-chat labelled options with your lean, never a dialog.
- No em-dashes anywhere.
- No file paths, line numbers, or hex codes in anything Adrian reads. Plain visual language only.
- No icons, no emoji, no symbol glyphs. Text and colour only for states.
- Send a clickable link when there is something to look at.

When the screen is designed and verified, stop and report. Do not move on to the next screen. One screen per session is deliberate — the planning conversation got too long to carry and this is the fix.
```

---

## Context for after (Adrian's reference only, not for the fresh chat)

Screen order after the opening screen: arrival, the privacy screen, the invitation, the piece page after registration, the dream, the globe, the yearly ritual.

Still waiting on Adrian, and none of it blocks the design work: the per-piece materials (wood, stones, makers, origin), and four calls — what video actually promises, whether a spouse is a holder or a contributor, what makes a light brighter without being gameable, and what the invitation carries as proof for someone with no printed code.

Phase 0 of the build list is the migration that merges the two ownership systems. It is independent of the design work and can run in parallel in its own session.
