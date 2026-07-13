# Adrian Rasmussen artwork plate generator

**Status:** Approved, amended for recoverable online Ownership Codes

**Date:** 2026-07-13

## Canonical ownership

`adrianrasmussen.com` owns the permanent physical-art identity system:

- Public artwork QR namespace and resolver.
- Physical-instance registry.
- Permanent Ownership Codes.
- Keeper registration and private contact records.
- Fabrication manifests and plate lifecycle.
- The public certificate/provenance arrival page.

Mandala Codes may display a read-only constellation or interpretation of Adrian's artworks, but it does not define the permanent code engraved into a physical artwork.

The existing historical hash ledger remains on Mandala Codes during this shipment-critical build. Moving canonical lineage events into Adrian Rasmussen is a separate migration requiring record reconciliation and must not delay plate production.

## Existing implementation to preserve

- `functions/qr/[number].js` permanently resolves `adrianrasmussen.com/qr/:code`.
- `functions/api/admin/pieces.js` registers a piece and currently returns one plaintext recovery code once.
- `utils/recoveryCode.ts` generates the existing 16-character, human-safe, approximately 80-bit code.
- D1 `keeper_pieces` currently stores only the recovery-code digest and keeper binding.
- `components/AdminPieces.tsx` is the artist's registration desk.
- `/works/:id` is the public artwork/certificate page.

The existing recovery code becomes the permanent **Ownership Code**. It does not rotate during ordinary ownership transfers. It is the physical ownership credential attached to the artwork. An existing registered keeper and the governed claim process prevent the code alone from silently overriding a current registration.

## Physical-instance identity

An archive artwork ID such as `UL-100` identifies the artwork record but may not uniquely identify every physical edition. Every physical object therefore receives an immutable public plate code:

`AR-XXXXXXXX`

The eight characters use the recovery-code alphabet without ambiguous glyphs. The public code is not secret; randomness provides collision-resistant issuance without a centralized sequence. It always remains within the existing 11-character QR contract.

The D1 registration maps:

`public plate code -> artwork ID + edition number -> keeper binding + Ownership Code verifier + encrypted recoverable code`

Renaming an artwork or changing its web presentation never changes the public plate code.

## Generated fabrication package

The admin registers an exact artwork and edition. The backend atomically generates and stores:

- Immutable public plate code.
- Public URL: `https://adrianrasmussen.com/qr/AR-XXXXXXXX`.
- Permanent Ownership Code verifier.
- Encrypted recoverable Ownership Code, with encryption-key version and nonce.
- Plate status and generation timestamp.
- SHA-256 digests of the generated fabrication assets.

The issuance response returns:

- Plaintext Ownership Code.
- Front QR SVG.
- Underside Ownership Code SVG.
- Private fabrication manifest JSON.

The front asset contains a standards-compliant QR at error correction Q with a four-module quiet zone, plus the public URL and physical-instance identity. The underside asset contains the Ownership Code and concise instructions for registration or transfer.

## Online code recovery and backup

Ownership Codes are recoverable online so Adrian can re-create a damaged plate and maintain the registry without an offline archive. They are never stored as unencrypted database text. The primary database stores an authenticated encrypted copy for recovery and a separate verifier for normal code checks. The encryption key lives outside the database, is versioned for future rotation, and is not included in database exports.

Revealing a code requires a fresh administrator authentication, records an audit event, and returns only the requested artwork's code. Normal piece lists, logs, public APIs, analytics, and error responses never contain readable codes.

An encrypted online backup is maintained in a separate storage account or provider. A compromise of only the database or only the backup must not reveal the codes without the separate encryption key. This is intentionally proportional security for the current stage and can later be strengthened without changing any physical plate.

Assets are content blocks with explicit millimetre dimensions and scalable vector paths/text. They do not assume the outer dimensions or hinge hardware of the final metal plate.

## Activation

New registrations begin as `generated`. Adrian downloads both SVGs and the manifest, fabricates the plate, scans the real metal QR, checks the underside code, and then marks the registration `active`.

Before activation, Adrian may regenerate an unclaimed piece if fabrication failed. Activation permanently locks its public plate code and Ownership Code. An active plate cannot be silently regenerated, even before the first keeper claim. An authorized recovery action may reproduce the existing code for a replacement plate but may not generate a different code.

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
- Permanent Ownership Code generation and encrypted online recovery.
- Fabrication downloads.
- Activation and per-piece preflight.

The following remain separate projects:

- Moving the full event ledger from Mandala Codes to Adrian Rasmussen.
- The complete 30-day email scheduler and automatic-transfer worker.
- Founder Succession Key and museum custodial relay.
- Redesigning the public certificate page.

Those future systems consume the immutable plate code and permanent Ownership Code created here, so no physical plate must change later.

## Acceptance criteria

1. Every physical edition receives a unique immutable `AR-XXXXXXXX` code.
2. Registration rejects unknown artworks, invalid editions, and duplicate artwork/edition pairs.
3. The backend returns the plaintext Ownership Code and fabrication files at issuance and can reproduce the same code only through an audited administrator recovery action.
4. D1 and online backups never store unencrypted Ownership Codes or SVGs containing them.
5. Activated registrations cannot be regenerated.
6. The public QR resolves through Adrian Rasmussen to the correct work and edition.
7. Legacy QR routes remain unchanged.
8. Generated QR SVG uses error correction Q and a four-module quiet zone.
9. The real fabricated plate is scan-tested before activation.
10. Tests prove code uniqueness, encryption and audited recovery, privacy, resolver behavior, activation locking, and unchanged legacy redirects.
