---
version: alpha
name: Adrian Rasmussen
description: >-
  Personal artist portfolio for sacred-geometry sculpture and immersive
  installations. Wood, bronze, and stone warmth; classical serif; poetic and
  meditative. Bringing the formless into form.
colors:
  primary: "#c4aa7c"          # bronze — the accent
  primary-hover: "#9e8459"    # warm gold hover
  background: "#262321"       # darkest wood — hero ground
  surface: "#3d3226"          # wood-800
  surface-elevated: "#524330" # wood-700
  on-background: "#f2efe9"    # cream — text on dark
  on-surface-secondary: "#c2beb8"
  on-surface-dim: "#8a857c"
  # Light variant (paper / gallery wall)
  background-light: "#f5f4f0" # paper-50
  surface-light: "#ebe8e1"
  surface-elevated-light: "#e0dbcf"
  on-background-light: "#23201e" # stone-950
  primary-light: "#725d3d"    # bronze-600 (darkened 2026-09-01 for AA)
typography:
  display:
    fontFamily: Cormorant Garamond
    fontSize: 4.5rem
    fontWeight: 400
    lineHeight: 1.08
  heading:
    fontFamily: Cormorant Garamond
    fontSize: 1.75rem
    fontWeight: 400
    lineHeight: 1.2
  subhead:
    fontFamily: Cormorant Garamond
    fontSize: 1.375rem
    fontWeight: 400
  lead:
    fontFamily: Lora
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: Lora
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.7
  meta:
    fontFamily: Lora
    fontSize: 0.875rem
    fontWeight: 400
  eyebrow:
    fontFamily: Karla
    fontSize: 0.6875rem
    fontWeight: 500
    letterSpacing: 1.5px
  monogram:
    fontFamily: Cinzel
    fontSize: 1.5rem
    fontWeight: 400
# Every value here mirrors src/master.css, the one master style file.
# If this file and master.css disagree, master.css wins.
rounded:
  none: 0px        # the house shape: buttons, inputs, cards
  soft: 2px
  round: 9999px    # icon buttons only
spacing:           # 4px base
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  6: 24px
  8: 32px
  12: 48px
controls:
  height-sm: 28px
  height: 32px     # desktop default for buttons, inputs, tabs, chips
  height-touch: 44px  # touch screens only (pointer: coarse)
  padding-x: 12px
components:
  button-primary:
    backgroundColor: "{colors.background}"   # wood-900; bronze in dark mode
    textColor: "{colors.background-light}"
    typography: "{typography.eyebrow}"       # Karla 11px, 600, uppercase, 0.12em
    rounded: "{rounded.none}"
    height: 32px
    padding: 0 12px
  button-outline:
    border: 1px wood-700
    rounded: "{rounded.none}"
    height: 32px
  card:
    padding: 16px   # 12 to 20px
  section-gap: 32px # 24 to 48px
---

## Overview

This is Adrian Rasmussen's personal artist portfolio and shop — multidimensional
wooden sculptures, sacred geometry, jewelry, oracle cards, and immersive
installations. The signature line is **"Bringing the formless into form."** The
feel is poetic and meditative: warm wood and bronze, classical serif type, and
intimate, unhurried space. The work is about presence and connection more than
intellect — the design should make a viewer feel rather than analyze. Dark wood
is the default hero ground; a paper-light gallery variant exists for daylight.

## Colors

A warm natural range — wood, stone, bronze — pulled straight from the material of
the sculptures.

- **Bronze (#c4aa7c dark / #8a744e light):** The single accent. The call to
  action and key emphasis, echoing the metal in the work.
- **Darkest wood (#262321):** The hero ground and default canvas.
- **Cream (#f2efe9):** Primary text and headlines on the dark ground.
- **Wood surface steps (800 to 700):** Quiet depth for raised elements.
- **Paper set (light variant):** Paper #f5f4f0 ground with deepened bronze, for
  bright/gallery contexts.

## Typography

A classical serif voice with one sans label and a monogram face.

- **Cormorant Garamond** — display and headings, the brand's voice. Large,
  elegant, set at regular weight. Use 20px and up.
- **Lora** — all reading text, leads, body, captions. Generous line height for a
  contemplative read.
- **Karla** — small uppercase eyebrows and labels with wide tracking. Never body.
- **Cinzel** — the "A" monogram and rare special headers only.

## Layout

Slim and streamlined: well spaced, never spacious. Adrian wants to see more on
screen. Section gaps are 24 to 48px, card padding 12 to 20px, and nothing on the
site uses 96px. The art is still the hero; the room it gets comes from the image
size, not from empty bands around it. Type recedes and frames it, never competes.

## Elevation & Depth

Depth is felt, not drawn. Step the surface color up and use a soft shadow to
raise an element. No hard borders or outlines around content.

## Shapes

Square. Buttons, inputs, tabs and cards have no radius. The only round thing is
an icon button (play, close). No pills.

## Components

Buttons come only from the set in src/master.css. Every button is `.btn` plus
one variant, all 32px tall on desktop (28px with `.btn-sm`, 44px on touch),
square, Karla 11px uppercase at 0.12em:

- **`.btn-primary`:** wood-900 fill, paper text; bronze fill in dark mode. One
  per screen: the action the screen is for.
- **`.btn-outline`:** 1px edge, no fill. Every other action.
- **`.btn-ghost`:** text only. Inline actions and back links.
- **`.btn-icon`:** round, one glyph.
- **`.tab` / `.chip`:** a choice among siblings; underline or border when chosen.
- **Card:** 16px padding, a step of surface colour, hairline rule where needed.

## Do's and Don'ts

- **Do** lead with a Cormorant line and let the artwork dominate.
- **Do** write in poetic, meditative, intimate language — feeling over intellect.
- **Do** keep one bronze accent per composition; let wood and cream carry the rest.
- **Do** keep the page dense enough to see the work and its details together.
- **Don't** add a second accent, bright red, or pure black/white.
- **Don't** use the sans family for headlines or body — labels only.
- **Don't** crowd or over-explain; the work speaks through stillness.
- **Don't** draw borders to separate things; use a step of surface color instead.
