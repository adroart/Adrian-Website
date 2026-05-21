# Atlas Style Notes

Visual and language conventions for the `/atlas` page and any surface
that reads from the ledger. Parallel agents building the UI, the
admin tooling, and the steward claim flow must all follow this.

## Color palette

Use the existing tokens from `src/index.css`:

- `paper` for backgrounds in the side panel and modal surfaces
- `wood` for dividers and secondary text
- `stone` for body text on light surfaces
- `bronze` for accent: the breathing nodes on the globe, hover states, links

The globe itself sits on a darker variant of `paper` (or pure black if
contrast demands it). Continent outlines are a faint, low-opacity `stone`,
sketched not solid. Nothing should compete with the bronze points.

## Globe direction

Constellation star chart via [cobe](https://github.com/shuding/cobe).

- Dark background, faint silver continent outlines, soft golden bronze
  nodes that breathe slightly via cobe's `mapBrightness` / phi rotation.
- Pieces feel like stars. The globe is a quiet companion, not the hero.
- Slow auto-rotate by default. Pause on hover or drag.
- Tap a point to open the side panel with that piece's metadata; never
  open a modal that covers the globe.

## Typography

- Cormorant Garamond for body copy (already loaded).
- Lato for UI chrome (already loaded).
- Cinzel for the `Atlas` title and section headers (already loaded).

Letter-spacing on Cinzel is generous; mirror the conventions from
existing series pages (`/creations/multidimensional-art/universal-language`).

## No decorations

- No icons, no SVG glyphs in copy, no badges, no stickers, no emoji.
- Status is text. Examples:
  - "seeking ground" (piece created, not yet placed)
  - "placed in Lisbon" (piece located in a city)
  - never "located", never "lives in", never use the word "current"
- Privacy is text. The withdrawn state is never shown publicly — those
  pieces simply don't appear.

## Punctuation

- No em dashes. Use commas, periods, or `to` for ranges.
- Middle dot `·` for inline piece details:
  `Earth's Breath · Universal Language 01 · placed in Lisbon`
- Sentence case for everything except piece titles.

## Labels on the globe

- City labels live in the side panel only, never floating on the globe.
- The point hover affordance is a subtle ring expansion, no tooltip.
- Selected piece shows a slightly larger ring with a faint pulse.

## Route and navigation

- Page lives at `/atlas` as a top-level route. Add a single nav entry
  reading `Atlas` (no subtitle, no count). The nav order is the main
  agent's call; suggest placing it between `Writings` and `Shop`.
- Atlas is cross-series — it spans every category of work, not a single
  series. SEO copy should reflect that ("a world map of where every
  piece by Adrian Rasmussen has come to rest", or similar).

## SEO copy rules

These are inherited from the site-wide rules in `CLAUDE.md`:

- Never use "wall art" anywhere on the page.
- Never use "oracle" in the page meta. Even though Universal Language
  pieces appear here, Atlas is the art-series side, not the oracle deck.
- Never name a steward or expose anything below city level. The page is
  about places, not people.
- Adrian's framing is "where the work has come to rest" — keep that
  voice. Avoid logistics language ("shipped to", "delivered to").

## Steward flow language

- The claim screen says "claim your piece", not "log in" or "sign in".
- The update screen says "update where it lives" or "where it rests".
- The privacy toggle says "show on the atlas" / "keep this private",
  never "publish" or "hide".
- Confirmation copy is short, one sentence. Adrian's voice is restrained.
