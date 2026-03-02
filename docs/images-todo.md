# Images To-Do: Full Site Audit

Every image currently on the site is a Cloudinary placeholder (uploaded to `adrian-website/placeholders/`). This file tracks every real image needed, organized by page. Check off each item as you source or shoot the image. The Cloudinary pipeline, `img()` helper, and `srcset()` helper are fully built. You just need to upload real images and update the public IDs in `mockData.ts` and components.

---

## Homepage

- [x] ~~**Hero background video**~~ DONE. Uploaded to Cloudinary at `adrian-website/site/hero/studio-creation-process` (18s, 960x720, 3.5MB). Hero.tsx references it directly.
- [ ] **Commission detail photo** — Close-up or detail shot of a commissioned piece. Portrait orientation (roughly 9:11 ratio). Used in the "Commission an Original" section.

---

## About Page

- [ ] **Portrait of Adrian** — Primary portrait photo. 3:4 ratio (portrait). Appears with parallax scroll on the opening section.
- [ ] **Tea ceremony / travels photo** — You in a tea setting or travel context. 3:4 ratio (portrait). Appears in "The Path" timeline section.
- [ ] **Creation in studio photo** — Working in the studio, hands on materials. 1:1 ratio (square). Appears in "Creation as Practice" section.
- [ ] **Interstitial: Studio atmosphere** — Wide atmospheric shot of the studio or workspace. 16:9 ratio (landscape, full-bleed). Appears between "Origin" and "The Path" sections.
- [ ] **Interstitial: Immersive installation space** — Wide shot of an installation or immersive environment. 16:9 ratio (landscape, full-bleed). Appears between "The Path" and "Creation as Practice" sections.

---

## Creations Page — Category Tiles

These 8 tiles are the main entry points to your work. Each needs one strong representative square image (1:1 ratio).

- [ ] **Multidimensional Art** — Representative piece from the multi-art body of work
- [ ] **Illuminated Works** — A piece shown in its illuminated/glowing state, or transitioning between day and dark
- [ ] **Jewelry** — A wearable piece or talisman, styled or on the body
- [ ] **Oracle Cards** — A spread, a single card, or the decks together
- [ ] **Tables** — A functional art table, ideally in a real space
- [ ] **Installations** — An immersive environment or large-scale work
- [ ] **Objects** — An altar object, ritual bowl, or functional art piece
- [ ] **Spaces** — A tea house, designed environment, or space for presence

> **Shop page note:** The Shop uses 4 of these same categories (Multidimensional Art, Jewelry, Oracle Cards, Objects). Once you have the above images, they can be reused for the Shop category tiles.

---

## Multidimensional Art Hub — Subcategory Tiles

4 square tiles (1:1 ratio) for each subcategory within Multidimensional Art.

- [ ] **Universal Language** — One of the 64 hexagram-based wooden sculptures
- [ ] **Mandala** — A sacred geometry mandala piece
- [ ] **Light Codes** — A Light Code drawing or engraving
- [ ] **Signature Pieces** — A one-off piece outside of any series

> The 5th tile ("Illuminated Works") links to the shared Illuminated Works page and uses the same image sourced for that category tile above.

---

## Subcategory Page Hero Images

Each subcategory page has a wide hero image at the top. Landscape orientation (roughly 3:2 ratio).

- [ ] **Universal Language series hero** — A wide, atmospheric shot of one or more Universal Language pieces
- [ ] **Light Codes series hero** — A wide shot showcasing Light Codes work
- [ ] **Mandala series hero** — A wide shot showcasing Mandala work

> Signature Pieces currently shares data with the general archive and does not have a dedicated series hero, but consider adding one.

---

## Illuminated Works Page

- [ ] **Illuminated Works hero** — Wide cinematic image (or ideally a video) of a piece transitioning from daylight to dark / glowing state. 2:1 ratio (landscape). This is the most important image for conveying what makes illuminated works special.

---

## Oracle Cards Page

### Deck Cover Images
Portrait orientation (roughly 9:11 ratio). One per deck, showing the deck cover, packaging, or a styled product shot.

- [ ] **Reflect deck** — "A Journey of Self-Inquiry. 64 Questions of Light and Shadow."
- [ ] **Connect deck** — "A Journey of Coming Together. 64 Cards of Connection and Discovery."
- [ ] **Universal Language oracle deck** — "The sixty-four expressions of the cycle of changes."
- [ ] **Light Codes oracle deck** — "Anchorings of unseen realms. Frequencies made portable."

### Sample Card Images
Portrait orientation (2:3 ratio). A single card from each deck, showing the card face design.

- [ ] **Reflect sample card**
- [ ] **Connect sample card**
- [ ] **Universal Language sample card**
- [ ] **Light Codes sample card**

### Oracle Page Interstitial
- [ ] **Oracle ceremony interstitial** — Wide atmospheric shot of cards in use, in a ceremony or tea setting. 16:9 ratio (landscape, full-bleed). Appears between the deck sections and the related pieces section.

---

## Writings / Stories

Each story has a featured hero image. Landscape orientation (3:2 ratio). These appear as cards on the Writings page and as the hero image on each individual story page.

- [ ] **"Ye Ming Zhu: The Glowing Crystal"** — A Ye Ming Zhu crystal glowing, or styled with ceremony objects. This is the featured story, so this image carries extra weight.
- [ ] **"The Mandala Series: Windows Inward"** — A mandala piece, ideally showing painted detail and laser-cut geometry together.
- [ ] **"The Universal Language: 64 Expressions"** — One or several Universal Language pieces, possibly showing the layers of wood and gemstone detail.
- [ ] **"Light Codes: Anchorings of Unseen Realms"** — A Light Code drawing or engraving, perhaps in the studio context where they were created.
- [ ] **"How I Create: From Formless to Form"** — Process shot. You in the studio, painting, airbrushing, or working with the laser. Something that shows the making.
- [ ] **"The Way of Tea: Twenty Years of Culture"** — Tea ceremony setting, tea ware, or a moment from your tea practice.

> **Consider adding more stories:** The Writings section could benefit from additional essays to give the page more depth. Potential topics based on your existing work:
> - A story about Jewelry and talismans (what they carry, how they're made)
> - A story about Tables and functional art (the philosophy of gathering)
> - A story about Installations and immersive environments
> - A story about Spaces and tea houses (designing for presence)
> - A story about the commissioning process (what it's like to create something for someone)
> - A story about Bali and how place shapes your work
>
> Each additional story would need its own featured image.

---

## Inquire (Commission) Page

- [ ] **Inquire hero** — Wide shot of the studio, your workspace, or a piece in progress. 16:9 ratio (landscape). Appears at the top of the page with parallax scroll.
- [ ] **Personal commission path image** — A personal/wearable/wall piece that was commissioned or exemplifies personal commissions. Portrait orientation (roughly 5:6 ratio).
- [ ] **Spatial commission path image** — An installation, environment, or spatial project. Landscape orientation (roughly 6:5 ratio).

---

## Artwork Images by Category

Every piece needs at minimum a **cover image** (the primary photo shown in galleries and tiles, recommend at least 1000px on the shortest side). Ideally each piece also gets **additional gallery images** (detail shots, alternate angles, in-context shots, process photos).

Fill in your actual piece count per category below, then multiply to get total images needed.

### Multidimensional Art: Universal Language
- [ ] **___ pieces** to photograph (up to 64 works, each connected to a hexagram)
- Each needs: 1 cover image + gallery images showing layers, gemstone details, and scale

### Multidimensional Art: Mandala
- [ ] **___ pieces** to photograph
- Each needs: 1 cover image + gallery images showing painted detail and laser-cut geometry together

### Multidimensional Art: Light Codes — Frequency Foundations
- [ ] **___ pieces** to photograph
- Each needs: 1 cover image + gallery images (consider both flat detail and angled shots to show depth)

### Multidimensional Art: Light Codes — Embodied Vibrations
- [ ] **___ pieces** to photograph
- Each needs: 1 cover image + gallery images

### Multidimensional Art: Light Codes — Resonant Formations
- [ ] **___ pieces** to photograph
- Each needs: 1 cover image + gallery images

### Multidimensional Art: Signature Pieces
- [ ] **___ pieces** to photograph (one-off works outside any series)
- Each needs: 1 cover image + gallery images

### Illuminated Works (day + night versions)
- [ ] **___ pieces** to photograph in their illuminated state
- These are existing pieces from the categories above that also glow after dark
- Each illuminated piece needs: 1 daylight cover image + 1 glowing/night image (at minimum), ideally also a transition video or GIF

### Jewelry
- [ ] **___ pieces** to photograph
- Each needs: 1 cover image (styled or on body) + gallery images showing detail, clasp, scale on skin

### Oracle Cards
- [ ] **___ decks** to photograph (deck covers and sample cards are tracked separately above in Oracle Cards Page section)
- Consider also: spread shots, cards in ceremony context, packaging shots

### Tables
- [ ] **___ pieces** to photograph
- Each needs: 1 cover image (ideally in a real space) + gallery images showing surface detail, joinery, scale

### Installations
- [ ] **___ pieces** to photograph
- Each needs: 1 cover image (wide shot of full installation) + gallery images showing detail, people for scale, different lighting conditions

### Objects
- [ ] **___ pieces** to photograph
- Each needs: 1 cover image + gallery images showing the object in use or on an altar/table

### Spaces
- [ ] **___ pieces** to photograph
- Each needs: 1 cover image (wide establishing shot) + gallery images showing interior, details, atmosphere at different times of day

---

## Summary Count

| Section | Images Needed |
|---|---|
| Homepage | 1 (video done, 1 photo remaining) |
| About Page | 5 |
| Creations Category Tiles | 8 |
| Multidimensional Art Subcategory Tiles | 4 |
| Subcategory Page Heroes | 3 |
| Illuminated Works Hero | 1 |
| Oracle Cards (covers + samples + interstitial) | 9 |
| Writings (story images) | 6 |
| Inquire Page | 3 |
| **Total site-level images** | **41** |
| | |
| **Artwork (per piece, fill in counts)** | |
| Universal Language | ___ pieces x (1 cover + gallery) |
| Mandala | ___ pieces x (1 cover + gallery) |
| Light Codes: Frequency Foundations | ___ pieces x (1 cover + gallery) |
| Light Codes: Embodied Vibrations | ___ pieces x (1 cover + gallery) |
| Light Codes: Resonant Formations | ___ pieces x (1 cover + gallery) |
| Signature Pieces | ___ pieces x (1 cover + gallery) |
| Illuminated Works (day + night) | ___ pieces x (2 images minimum) |
| Jewelry | ___ pieces x (1 cover + gallery) |
| Oracle Cards (individual cards/spreads) | ___ items x (1 cover + gallery) |
| Tables | ___ pieces x (1 cover + gallery) |
| Installations | ___ pieces x (1 cover + gallery) |
| Objects | ___ pieces x (1 cover + gallery) |
| Spaces | ___ pieces x (1 cover + gallery) |

---
---

# Ideal / Future Images

Beyond the essential images above, these are additional images that would strengthen the storytelling on each page. Not required for launch, but would elevate the experience significantly.

---

## Homepage — Storytelling Additions

- [ ] **Commission process sequence** — 2 to 3 images showing the journey of a commission: initial conversation or sketch, in-progress creation, and the finished piece in its home. Would transform the commission section from a single static photo into a narrative.
- [ ] **Piece in a real home/space** — A lifestyle shot showing one of your works hanging on a wall, sitting on a shelf, or integrated into someone's living space. Brings the work out of the studio and into lived context.

---

## About Page — Storytelling Additions

- [ ] **Bali landscape / surroundings** — Where you live and create. The environment that shapes the work. Could be used as an additional interstitial.
- [ ] **Materials and tools close-up** — Wood grain, laser bed, brushes, airbrush, crystals laid out. The raw ingredients before they become art.
- [ ] **Adrian with a finished piece** — You holding or standing beside a completed work. Connects the artist to the object.

---

## Subcategory Pages (Universal Language, Mandala, Light Codes, Signature Pieces) — Storytelling Additions

These pages currently go straight from the hero image and series description into the gallery grid. Each would benefit from visual storytelling in between.

### Universal Language
- [ ] **Process: Laser cutting a hexagram** — The precision side of the work. Laser in action on wood.
- [ ] **Process: Painting / airbrushing layers** — The organic, intuitive side. Hands, paint, the moment of creating.
- [ ] **Detail: Wood layers and gemstone placement** — Macro shot revealing how layers stack and where gemstones sit at energetic points.
- [ ] **In context: A Universal Language piece in a meditation space or on a wall** — Shows scale and atmosphere.

### Mandala
- [ ] **Process: The geometry stage** — Laser-cut mandala before painting. The precise underlying form.
- [ ] **Process: Painting the mandala** — Splatter, color, the "analog chaos" meeting digital precision.
- [ ] **Detail: Close-up of painted surface on laser-cut geometry** — Where the brush meets the cut edge.
- [ ] **In context: A mandala in a room** — Showing it as "a place to sit with," not decoration.

### Light Codes
- [ ] **Process: Drawing a Light Code** — The stream-of-consciousness pen work. Hands, paper, the flow state.
- [ ] **Process: Engraving in wood** — A Light Code being etched by laser into basswood.
- [ ] **Detail: Macro of sigils and patterns** — Revealing the layered symbols within a Light Code drawing.
- [ ] **In context: A Light Code piece in a ceremonial or personal setting**

### Signature Pieces
- [ ] **Process: One-off creation** — Something showing the unique, non-series nature of these works.
- [ ] **In context: A signature piece installed in a space** — How these singular works live in the world.

---

## Illuminated Works Page — Storytelling Additions

This page has the biggest storytelling gap. The entire concept hinges on the transformation between daylight and dark.

- [ ] **Video: Daylight to dark transition** — The single most important piece of media for this page. A short loop showing a piece in natural light, then darkness falling, then the LEDs revealing the second life of the work. This could replace the hero image.
- [ ] **Ambient illumination lifestyle shot** — A piece glowing softly in a bedroom, meditation space, or quiet corner. Soft, warm, lived-in feeling.
- [ ] **Living light / dynamic illumination shot** — A piece with programmable or responsive light in a more dramatic setting. Gallery, gathering space, or ceremony.
- [ ] **Detail: Light through wood grain** — Macro shot showing how embedded LEDs reveal the layers and grain of the wood from behind.
- [ ] **Adrian with an illuminated piece** — Personal connection. You in the studio or a dark room with one of these works glowing. The "what this means to me" moment.
- [ ] **Before and after pair** — Same piece, same angle: one in daylight, one in darkness. Side by side tells the whole story instantly.

---

## Oracle Cards Page — Storytelling Additions

- [ ] **Hero image: Cards in ceremony** — Wide atmospheric shot for the top of the page. Hands drawing a card, cards spread on cloth, candlelight, tea. Sets the tone immediately.
- [ ] **Hands shuffling or drawing a card** — Close, personal, human. Shows these are tools, not collectibles.
- [ ] **Cards in a real ceremony or circle setting** — Group context. People sitting with cards. The communal aspect.
- [ ] **Detail: Card printing quality** — Close-up showing heavyweight stock, color fidelity, edge detail. Communicates craftsmanship.
- [ ] **Philosophy section companion image** — Something evocative alongside the dense philosophical text. Historical oracle tools (bones, shells, coins), or the lineage of divination objects leading to these cards.
- [ ] **Packaging / unboxing** — How the decks arrive. Wrapping, box, presentation. The first moment of receiving.

---

## Individual Piece Pages — Storytelling Additions

These apply across all pieces and would be added to the gallery images array per artwork.

- [ ] **Scale reference shots** — Hand next to piece, piece on wall with furniture visible, person standing beside an installation. Every piece benefits from at least one scale reference.
- [ ] **In-situ / lifestyle context** — The piece in a real room, on a real wall, in a real space. Not studio-white, but lived-in.
- [ ] **Process documentation** — At least 1 to 2 process shots per piece: design stage, cutting, painting, assembly. Adds value and depth to the story of each work.
- [ ] **Material close-ups** — Wood grain, brass inlay, crystal placement, paint texture. The sensory details that can't be seen from gallery distance.

---

## Inquire Page — Storytelling Additions

- [ ] **Commission conversation moment** — You with a client, looking at materials or sketches together. Shows the collaborative nature of the process.
- [ ] **Commissioned piece in its final home** — The end result of the inquiry process. A piece installed in the space it was designed for.
- [ ] **Materials spread / mood board** — Wood samples, crystal options, color swatches. What the client gets to choose from.
- [ ] **Sketch to finished piece sequence** — 2 to 3 images showing the evolution from initial concept to completed work.

---

## Writings Page — Storytelling Additions

- [ ] **Inline images within story content** — Currently stories are text-only in the body. Each essay could benefit from 1 to 3 images woven into the text:
  - "Ye Ming Zhu" — Glowing crystals in different states, dragon/phoenix symbolism
  - "The Mandala Series" — Process sequence, geometry close-ups
  - "The Universal Language" — I Ching connection, layers of wood being assembled
  - "Light Codes" — The original drawings from the dream period, Ithaca reference imagery
  - "How I Create" — Studio documentation, tools, the dance between digital and analog
  - "The Way of Tea" — Tea ware, ceremony moments, the connection between tea patience and art patience

---

## General Studio / Process Library

These are not tied to a specific page but would be reusable across the site wherever a storytelling moment calls for it.

- [ ] **The laser in action** — Cutting, etching, the light and smoke of precision
- [ ] **Airbrushing / painting** — The organic counterpart to the laser
- [ ] **Wood selection and preparation** — Raw materials before they become art
- [ ] **Crystal and gemstone sourcing** — The stones before placement
- [ ] **The studio space itself** — Wide establishing shot of where everything happens
- [ ] **Hands at work** — Close-up, no face, just hands and material. The universal artist image.
- [ ] **Tea in the studio** — The practice that runs through everything. A kettle, a cup, a pause.
