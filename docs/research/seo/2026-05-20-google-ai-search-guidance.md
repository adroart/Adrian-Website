# Google AI Search Guidance, Interpretation For Adrian Rasmussen

Last updated: 2026-05-20

Primary source reviewed: <https://developers.google.com/search/docs/fundamentals/ai-optimization-guide>. Google's guide was last updated on 2026-05-15 UTC.

Related official Google sources reviewed:

- <https://developers.google.com/search/docs/appearance/ai-features>
- <https://developers.google.com/search/blog/2025/05/succeeding-in-ai-search>
- <https://developers.google.com/search/docs/fundamentals/using-gen-ai-content>
- <https://developers.google.com/search/docs/essentials>
- <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>
- <https://developers.google.com/search/docs/appearance/google-images>
- <https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data>
- <https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics>

## Core Interpretation

Google is not saying there is a separate hack for AI visibility. Google is saying AI visibility in Google Search is built from the same foundations as search visibility:

- Pages must be crawlable, renderable, indexable, and eligible for snippets.
- Content must be useful, original, non-commodity, and satisfying for human visitors.
- Structured data helps Google understand page meaning, but it must match visible page content.
- High-quality images and video matter more now because AI search is multimodal.
- AI Overviews and AI Mode may use query fan-out, meaning one user question can cause Google to retrieve pages across several related subtopics.
- Search visibility is still important, but clicks may be lower when AI answers satisfy the user on the results page.

## What This Means For This Site

The website should not chase a separate "AI SEO" system. It should make the best possible public body of work around Adrian's real art practice:

- Strong canonical pages for Mandala and Laser-Cut Wood Art.
- Individual artwork pages with unique descriptions, image metadata, schema, and visible facts.
- Process writing that shows first-hand experience.
- Clear internal links between series pages, artwork pages, writings, and inquiry pages.
- Off-site proof that Adrian is a real artist associated with mandala art, sacred geometry, layered wood sculpture, and laser-cut wood art.

## Technical Requirements From Google

Google emphasizes the crawl, render, index, and serve pipeline. For this Vite React site, the practical requirements are:

- Use stable URLs.
- Provide canonical URLs.
- Keep meaningful content in text, not only images.
- Ensure JavaScript-rendered content is visible to Google.
- Prefer pre-rendered or server-renderable metadata for important pages when possible.
- Keep important pages linked internally.
- Include sitemap entries for all canonical public routes.
- Add image entries to the sitemap for artwork pages.
- Use structured data that matches visible page content.

## Content Requirements From Google

Google's useful-content guidance maps strongly to Adrian's situation. The winning content should show:

- First-hand artistic practice.
- Original analysis of mandala, sacred geometry, wood, light, and process.
- Clear authorship by Adrian Rasmussen.
- Substantial descriptions, not generic product blurbs.
- Pages that a collector, curator, writer, or serious searcher would bookmark or cite.
- No mass-produced keyword pages for every minor search variation.

## Image Requirements From Google

Image search is central because this is a visual art site. The site should prioritize:

- Descriptive alt text.
- Descriptive image filenames where possible.
- Relevant text near each image.
- Artwork image entries in the sitemap.
- `ImageObject` structured data on piece pages.
- High-resolution, fast-loading Cloudinary images.
- Captions or visible details for materials, dimensions, process, year, and series.

## Structured Data Requirements

The site should use structured data to clarify page type and entity relationships:

- `Person` for Adrian.
- `WebSite` on the home page.
- `CollectionPage` on Mandala, Laser-Cut Wood Art, Universal Language art-series, Light Codes, Signature Pieces, and Creations routes.
- `VisualArtwork` on individual artwork pages.
- `ImageObject` on individual artwork pages.
- `BreadcrumbList` on collection and artwork pages.
- `Article` on writings.
- `Product` and `Offer` only when commerce data is real and shop purchase flows are enabled.

Current implementation added or improved:

- Central route metadata registry in `utils/seoMetadata.ts`.
- Mandala route metadata.
- Laser-Cut Wood Art route metadata.
- Universal Language art-series metadata that avoids oracle framing.
- Static sitemap entries generated from metadata and launch flags.
- Image entries in `public/sitemap.xml` for artwork pages.
- `ImageObject` schema on artwork pages.
- `CollectionPage` schema on Mandala subcategory pages and the new Laser-Cut Wood Art page.

## AI Search Behavior Implications

Google AI features may answer the user's first question directly, but they still show links when pages support the answer. This changes the value of pages:

- A page can influence brand discovery even when it does not receive a click.
- A page can be cited for a sub-question generated by query fan-out.
- A page can support image, video, and entity understanding even when it is not the top classic blue link.
- A broad page should answer the central intent clearly, while supporting pages should answer narrower questions in depth.

## What Not To Do

Do not build low-value pages for every autocomplete variation.

Do not create artificial "AI files" as a substitute for crawlable content.

Do not use generic AI-written filler.

Do not hide important artwork facts inside images only.

Do not block snippets if the goal is AI-search visibility.

Do not use Product or Offer schema for placeholder Stripe data.

Do not conflate Universal Language art-series SEO with the Universal Language oracle route.

## Best Immediate Moves

1. Make `/creations/multidimensional-art/mandala` the strongest page on the site for original mandala art.
2. Build `/creations/laser-cut-wood-art` as the strongest page on the site for the process and material category.
3. Improve all Mandala artwork pages so they stop relying on repeated descriptions.
4. Create an article cluster that is genuinely first-hand:
   - What Is Mandala Art?
   - How I Create Laser-Cut Wooden Mandalas
   - Sacred Geometry Mandala Art
   - Commissioning A Custom Mandala Artwork
   - Why Make Mandalas In Wood?
   - Layered Laser-Cut Wood Art As Sculpture
5. Build off-site proof through interviews, videos, directories, process posts, community mentions, gallery pages, and artist features.
