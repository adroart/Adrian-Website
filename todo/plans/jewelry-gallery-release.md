# Jewelry gallery release candidate

Status: local candidate ready for selection and publication approval. Do not merge or upload recovered photos until approval is recorded.

## Candidate

Branch: `codex/jewelry-restoration-20261118`, based on main `e89ed8e`.

The actual application source replaces the broken legacy gallery references with six ring photographs and five pendant photographs. Photos use immutable content-derived media IDs, grouped as Pendants and Rings. The UI uses neutral accessible labels and no camera filenames, unapproved poetic titles, materials, prices, availability or claims of physical identity. Existing jewelry inquiry and full-photograph enlargement remain available. Compact framing and layout styles apply only to Jewelry; other galleries retain their current layout.

[Local candidate](http://127.0.0.1:49231/creations?category=Jewelry).

## Exact media package and authority

The adjacent `jewelry-gallery-media.json` records all eleven source IDs, source filenames, SHA-256 hashes, dimensions, byte sizes, future R2 keys and the one proven old photo mapping. These are edited Lightroom cache JPEGs, all with a 1280-pixel longest side. They are not described as original camera files.

The private staged package is under `/Users/adrianrasmussen/.codex/visualizations/2026/11/17/01a1e929-688b-7521-9f46-9377de18c24e/art-direction/jewelry-recovery/release-candidate/`. Its `media/` files are exact recovered JPEG bytes and are not copied into public/, dist/ or Git. The preview's external Vite configuration serves only this package's exact eleven IDs locally, without transforming application code.

No copyright or creator metadata was found in the recovered files. This does not establish or deny rights. Adrian has requested a restored gallery and naming suggestions, but has not yet approved this exact new selection or publishing these recovered versions. No production media upload, push, merge or deployment was performed.

One combined decision remains: approve these eleven photographs as the new jewelry selection and confirm permission to publish these recovered versions on Adrian's website. Proposed public titles remain separate until accepted. Ten photographs have no verified old catalog mapping and must not be silently assigned old identities.

## Verification, November 18, 2026

- `npm run typecheck` passed.
- `npm run build` passed, including prerendering and the guarded Pages worker. Existing large-chunk and astronomy import warnings remain.
- `node --import tsx --test tests/media-delivery.test.ts tests/media-worker.test.ts` passed, six tests.
- All eleven staged files matched their SHA-256 and local HTTP response bytes.
- At 1280-pixel desktop and 390-pixel phone widths, Day and Night gallery images loaded, with no horizontal overflow. Group navigation worked. Ring enlargement showed the uncropped photograph with contain framing; the sixth ring opened on phone.
- Proof: `release-candidate/desktop-phone-proof.jpg` beside the private staged media package.

## After approval

Record the approval and exact media manifest. Upload only the eleven approved JPEGs to their new R2 keys through the site's established media workflow, then verify returned bytes and resized delivery. Do not overwrite legacy objects or upload any other Lightroom files. Rebase the candidate if main has advanced and run affected checks. Use the normal serialized PR and background release process, pinned to the exact candidate revision. Production proof must be recorded before calling it shipped.
