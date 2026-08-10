# Collector journey — design handoff

> **What this is.** Everything a fresh chat needs to design the collector flow's screens, one at a
> time, without re-reading the long conversation that produced it. Open this, do one screen, stop.
>
> **The Claude Design project already exists.** Do not create a second one.
> `f563165e-cc1a-4f62-a412-f92a2267dac0` · https://claude.ai/design/p/f563165e-cc1a-4f62-a412-f92a2267dac0
>
> **Read `the-collector-journey.md` for what each screen is for.** This file is HOW to design them.
> That one is WHAT they must accomplish. Build order is in `the-collector-build.md`.

---

## Status — 2026-08-09

**The wording outranks this file's screen list now.** Adrian worked the opening line by line
in conversation: the single opening screen became a locked sequence (code entry → code
confirmed → four introduction screens), with the project publicly named and the copy settled
in his voice. **`collector-screen-wording.md` (same folder) is the ongoing record**: every
screen in walking order, marked locked or proposed, exact wording. Design sessions take the
locked copy verbatim; do not redesign the old single-screen opening.

**Round 1 in the Claude Design project** (four options of the old single-screen opening,
verified clean) survives as the visual-direction reference only: espresso grounds, CAD line
drawing, brass pill, type scale. Adrian still picks a direction among 1a to 1d; the chosen
look then dresses the locked sequence.

**Adrian does not want to interact with Claude Design in the early rounds.** Drive it yourself,
including the verify loop, and bring him finished screens to look at. He looks at results, not
process. He will step in when he wants to redirect.

**One screen per session.** This handoff exists because the planning conversation got too long to
carry. Do not batch screens. Open this file, design one screen, verify it, show him, stop.

---

## Stage 1 — Adrian's answers, VERBATIM

**Paste these into Claude Design as written. Do not paraphrase them into design language — the
paraphrase is where the direction gets lost.**

**What it should feel like to open:**

> "I like that apple side simplicity, how polished everything is. How responsive everything is,
> however I'm a bigger fan of the dark mode and meditative so instead of Apple's icons you would
> use high polished vectors instead of the bright apple colors you would use the elegant metallic
> or brass and dark espresso and blacks When you're on dark mode. Light mode is more gallery type
> style."

**Who opens it:**

> "anyone can buy my art. This is why we are going with Apple type simplicity. Since it is built
> for anyone."

**The reference — this is the load-bearing one, given as a correction to an earlier answer:**

> "I'm actually looking for Apple's setup screens like when you just install a new iPad and you
> have to walk through it. This is more of the direction."

**On the ten reference sites originally proposed (Apple, Leica, Vitsœ, Zwirner, etc.) — WITHDRAWN:**

> "I like the things that you said about the different 10 Especially the CAD style line drawings
> of Number four however the sites aren't designed exactly how I like them so though you understand
> conceptually the actual sites are not fully imagined."

**What it must not do:**

> "it needs to match the clean aesthetic design. And as they are saying, things like Icons should
> be vector instead. It's okay if there is UI or UX. It just needs to be clean, elegant, minimal
> But I am a fan of clarity and layout. So not at the expense of that. Some of what is already in
> the sight are also things to pull from."

**How to read that last one:** minimal never wins over clarity. If a screen must choose between
fewer elements and being obvious, it chooses obvious. This inverts the usual minimalism failure
and it is the sentence to check every design against.

---

## The shape — Apple's first-run setup flow

Twelve real screenshots were collected and read. They live in the session scratchpad
(`apple-setup-refs/`, with a `NOTES.md`). **If that folder is gone, re-collect them** — an agent
brief that worked is at the bottom of this file.

**The observed pattern, from the actual screenshots:**

- No navigation chrome of any kind. No tab bar, no progress bar, no step counter. At most a plain
  text back link in the corner.
- One line-drawn illustration in the upper third, centred. Single motif, never photographic,
  never filled — outline only, thin uniform stroke.
- Headline of two to four words, large, centred, directly under the illustration.
- One to three short plain sentences, centred, roughly 80% width. Never more than about twenty
  words total.
- One filled pill-shaped primary button in the lower third, never touching the bottom edge.
- Skip and secondary options are ALWAYS plain text links, never buttons. **That contrast — one
  solid pill against plain text — is the entire hierarchy signal on the screen.**
- Very high empty space. The completion screen is headline plus one link and nothing else.
- Colour appears ONLY where something is tappable. All other text is neutral.

**Choice screens** (two to four options) use a plain hairline-divided list near the top rather
than a stack of buttons.

**Why this matters for the brief:** this is a flow, not a site. A person cannot browse, cannot
wander, cannot leave. That constraint is what makes it usable by "anyone," which is Adrian's
stated audience requirement.

**One screenshot is excluded**: `privacy-icon-explainer.png` is a settings page from an older
release, not the setup flow, and it is dense in exactly the way this flow must not be.

---

## The surface — the site's real design tokens

**These are verified from `src/index.css`, not from the project map, which is stale about fonts.**

**Fonts (the map says Cinzel/Lato — WRONG, do not use those):**
- **Cormorant Garamond** — titles and display, at 20px and above ONLY. Thin strokes vanish at
  body sizes. Italic under 20px is forbidden.
- **Lora** — all body, descriptions, captions, anything under 20px. Screen-tuned strokes.
- **Karla** — uppercase eyebrows and row labels only.

**Light mode:**
- paper `#f5f4f0` `#ebe8e1` `#e0dbcf`
- wood `#faf9f7` `#f0ece5` `#e0d8cc` `#a89070` `#8f7a5b` `#736046` `#524330` `#3d3226` `#262321`
- stone `#f7f6f4` `#ebe9e6` `#dcd9d4` `#8a857c` `#6f6a62` `#6b665f` `#524e49` `#3d3a36` `#2b2926` `#23201e`
- bronze `#faf6f0` `#f0e8d8` `#e6d9c3` `#c4aa7c` `#ab9266` `#8a744e` `#6d5a3c` `#453825`

**Dark mode** already exists and is genuinely espresso, not grey — paper inverts to `#171310`
`#1f1a15` `#29231c`, wood to `#181614` `#1f1d1a` `#3a3630` with light text tones above.

**The brass rule.** Apple gets away with one blue because everything else is neutral. Brass
(`#c4aa7c` / `#ab9266`) does the same job here: **it appears ONLY on the thing you can act on.**
Everywhere else is espresso and black. Strict adherence is what will make this feel expensive
rather than decorated.

**Standing site rules, already enforced elsewhere:** no icons, no badges, no stickers, no emoji.
No em dashes. Text and colour only for states. Middle dot for inline detail separators.

**Contrast rules that are already documented and must hold:** never wood-400/stone-400/paper-300
as body text on light paper backgrounds; labels no smaller than 11px; no wide letter-spacing under
12px.

---

## Dark leads, light follows

Adrian described the two modes as different characters, not a colour swap — dark is metallic and
meditative, light is gallery. Designing both at once produces a compromise that serves neither.

**Design dark first.** It is the mode he is "a bigger fan of" and has the more specific character.
Light follows from it once dark is locked.

---

## The illustrations — decided, and the make-or-break

**Claude Design draws them as vector.** Decided after ruling out the alternatives: ChatGPT Pro at
$200/month does NOT include API access (separate product, separate billing), Midjourney has no
official API and is the wrong tool anyway (it cannot hold a uniform stroke weight across a set of
eight, which is exactly what this needs), and automating either consumer interface violates their
terms and risks the account.

**Vector is arguably more correct than a generated raster for CAD-style line work** — it stays
crisp at any size and can be edited rather than regenerated.

**Note a conflict to handle explicitly:** Claude Design's default instructions say never to
hand-draw SVG imagery and to use striped placeholders instead. **Override this in the brief.**
Adrian specifically wants precise CAD-style line drawings and singled them out as the one thing he
liked from the entire reference sweep. Tell it: outline-only, uniform thin stroke, no fill, no
shading, single motif per screen, in the manner of a technical drawing.

**What each screen's drawing is of:** the piece itself, the code on its underside, the map, the
sealed letter. Real objects from this system, not generic symbols.

**If the drawings turn out weak, that is worth knowing early** — it is the difference between this
feeling made for these objects and feeling like a template with Adrian's colours on it.

---

## Screen order

**First: the opening screen** (build item 1.3) — the one that says what is about to happen.

Corrected from an earlier choice of the piece page. The piece page carries the most element types,
which is normally the right first pick, but setup screens are deliberately sparse — designing the
densest screen first would set the look from the screen least like the flow. The opening screen is
the purest example of the shape, it is the first thing a person reads, and its wording is already
load-bearing because it is where the promise gets made.

**Then, in this order:** arrival (1.4), the privacy screen (1.6), the invitation (1.2), the piece
page after registration, the dream (2.1), the globe (2.2), the yearly ritual (2.6).

---

## What the opening screen says

From the journey spec, step 5. This screen does not exist anywhere yet — no equivalent was built
on either side of the system.

The content, in substance: you are registering this piece to you · certifying it as authentic ·
storing your intentions in it · connecting it to the map of collectors. The piece lasts. The code
lasts. Whoever holds the code holds the access. Keep it safe.

**Its wording is constrained by what can honestly be promised.** The existing plan's own standard,
which governs: *"the product promise is a record that travels with the piece and that you can
always export and hold yourself, not forever. Forever is a claim a solo artist on rented
infrastructure cannot underwrite."*

**So: do not promise permanent video hosting, and be careful with the word "forever."** The piece
lasting and the code lasting are true. Unlimited free storage of video for all time is not.

---

## How to brief Claude Design (its own stated requirements)

- **The project exists.** Use `get_project` on the id above, never `create_project`.
- **Call `create_support_js` once** in the directory before writing any `.dc.html` file.
- **Read the `hifi-design` skill** before starting — it carries the multi-option canvas format.
- **Give it real content**, never placeholder text. Actual headlines, actual piece names, actual
  labels. Placeholder text produces placeholder-shaped design.
- **State the structural rules explicitly** — how sections nest, what sits at top level, what is
  held back to another screen, the intended reading order. Structure is not carried by anything
  else; it has to be said.
- **Ask for all three states**: loaded with real content, empty, error.
- **Do not specify a variation count** — the hi-fi process already gives three or more.
- **Do not specify colours, fonts, spacing, or aesthetic adjectives beyond the tokens above.**
- **Cap attachments at five or six.** One complete example beats three partial ones.
- **Run the verify loop yourself** — render, screenshot, check, fix. Do not hand Adrian a screen
  you have not looked at.

**Reference set for the brief:** the Apple setup screenshots for shape, and this site's tokens
above for the house it lives in. **No third-party site references** — Adrian withdrew all ten
explicitly.

---

## Stage 4 onward, once a direction is picked

When Adrian picks a direction, say plainly that it is locked. Every screen after names it as the
reference and states only what differs: what this screen is, its real content, its point, how its
structure differs. Short briefs from there — re-describing the direction invites drift.

Then have Claude Design record the locked look as the project's house style so later screens
inherit it. Review screens side by side, never one at a time — inconsistency is only visible
across a set. When the same correction is made twice, it belongs in the house style, not the next
brief.

---

## If the reference screenshots are missing

Dispatch an agent with this brief:

> Find and download real screenshots of Apple's iOS/iPadOS first-run Setup Assistant flow — the
> screens you walk through when switching on a new iPhone or iPad. Wanted: Hello/welcome, Quick
> Start, Data & Privacy, Face ID setup, Apple ID sign-in, and the completion screen. Not wanted:
> marketing pages, app store screenshots, third-party onboarding, settings pages. Sources that
> worked: support.apple.com, developer.apple.com/design, iMore, MacRumors, 9to5Mac, iDownloadBlog.
> Save to a scratch folder with descriptive kebab-case filenames. Verify each file is a real image
> over 10KB, not an HTML error page. Then write a NOTES.md recording, for each file, which screen
> it shows and its source, plus a concrete description of the recurring layout pattern: where the
> illustration sits, headline length, body copy length, button placement, how skip options are
> presented, what navigation chrome exists.

Note: the Firecrawl search tool was down during the original collection; plain web search plus
curl worked fine.
