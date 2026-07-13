# Adrian Rasmussen artwork plate generator

**Status:** Approved for implementation

**Date:** 2026-07-13

## Canonical ownership

`adrianrasmussen.com` owns the permanent physical-art identity system:

- Public artwork QR namespace and resolver.
- Physical-instance registry.
- Permanent Lineage Codes.
- Keeper registration and private contact records.
- Fabrication manifests and plate lifecycle.
- The public certificate/provenance arrival page.

Mandala Codes may display a read-only constellation or interpretation of Adrian's artworks, but it does not define the permanent code engraved into a physical artwork.

The existing historical hash ledger remains on Mandala Codes during this shipment-critical build. Moving canonical lineage events into Adrian Rasmussen is a separate migration requiring record reconciliation and must not delay plate production.

## Existing implementation to preserve

- `functions/qr/[number].js` permanently resolves `adrianrasmussen.com/qr/:code`.
- `functions/api/admin/pieces.js` registers a piece and returns one plaintext recovery code once.
- `utils/recoveryCode.ts` generates the existing 16-character, human-safe, approximately 80-bit code.
- D1 `keeper_pieces` stores only the recovery-code digest and keeper binding.
- `components/AdminPieces.tsx` is the artist's registration desk.
- `/works/:id` is the public artwork/certificate page.

The existing recovery code becomes the permanent **Lineage Code**. It does not rotate during ordinary ownership transfers. It proves physical access and begins a governed claim; it is not legal title or an instant bearer transfer.

## Physical-instance identity

An archive artwork ID such as `UL-100` identifies the artwork record but may not uniquely identify every physical edition. Every physical object therefore receives an immutable public plate code:

`AR-XXXXXXXX`

The eight characters use the recovery-code alphabet without ambiguous glyphs. The public code is not secret; randomness provides collision-resistant issuance without a centralized sequence. It always remains within the existing 11-character QR contract.

The D1 registration maps:

`public plate code -> artwork ID + edition number -> keeper binding + Lineage Code verifier`

Renaming an artwork or changing its web presentation never changes the public plate code.

## Generated fabrication package

The admin registers an exact artwork and edition. The backend atomically generates and stores:

- Immutable public plate code.
- Public URL: `https://adrianrasmussen.com/qr/AR-XXXXXXXX`.
- Permanent Lineage Code verifier.
- Plate status and generation timestamp.
- SHA-256 digests of the generated fabrication assets.

The one-time response returns:

- Plaintext Lineage Code.
- Front QR SVG.
- Underside Lineage Code SVG.
- Private fabrication manifest JSON.

The front asset contains a standards-compliant QR at error correction Q with a four-module quiet zone, plus the public URL and physical-instance identity. The underside asset contains the Lineage Code and the sentence that it begins a stewardship request but does not itself establish ownership.

Assets are content blocks with explicit millimetre dimensions and scalable vector paths/text. They do not assume the outer dimensions or hinge hardware of the final metal plate.

## Activation

New registrations begin as `generated`. Adrian downloads both SVGs and the manifest, fabricates the plate, scans the real metal QR, checks the underside code, and then marks the registration `active`.

Before activation, Adrian may regenerate an unclaimed piece if fabrication failed. Activation permanently locks its public plate code and Lineage Code. An active plate cannot be silently regenerated, even before the first keeper claim.

## Resolver

Legacy QR behavior remains permanent:

- `1` through `64` continue to Mandala Codes oracle cards.
- `oracle` continues to the Mandala Codes oracle home.
- Existing static artwork IDs remain supported.

New `AR-XXXXXXXX` codes resolve through D1 to the correct `/works/:artworkId` page with the physical instance and edition in the query string. Unknown `AR-` codes return 404 instead of redirecting to a nonexistent work.

## Shipment boundary

This implementation delivers only what is required to create and verify permanent metal plates:

- Physical-instance issuance.
- Public QR generation and resolution.
- Permanent Lineage Code generation.
- Fabrication downloads.
- Activation and per-piece preflight.

The following remain separate projects:

- Moving the full event ledger from Mandala Codes to Adrian Rasmussen.
- The complete 30-day email scheduler and automatic-transfer worker.
- Founder Succession Key and museum custodial relay.
- Redesigning the public certificate page.

Those future systems consume the immutable plate code and permanent Lineage Code created here, so no physical plate must change later.

## Acceptance criteria

1. Every physical edition receives a unique immutable `AR-XXXXXXXX` code.
2. Registration rejects unknown artworks, invalid editions, and duplicate artwork/edition pairs.
3. The backend returns the plaintext Lineage Code and fabrication files exactly once.
4. D1 never stores plaintext Lineage Codes or SVGs containing them.
5. Activated registrations cannot be regenerated.
6. The public QR resolves through Adrian Rasmussen to the correct work and edition.
7. Legacy QR routes remain unchanged.
8. Generated QR SVG uses error correction Q and a four-module quiet zone.
9. The real fabricated plate is scan-tested before activation.
10. Tests prove code uniqueness, privacy, resolver behavior, activation locking, and unchanged legacy redirects.
