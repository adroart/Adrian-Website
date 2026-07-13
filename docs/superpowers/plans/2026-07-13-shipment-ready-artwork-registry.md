# Shipment-Ready Artwork Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one Adrian Rasmussen artwork safely issuable, engravable, recoverable, assignable to a paid sale or manual handoff, activatable after physical testing, shippable, and claimable by its authenticated recipient.

**Architecture:** Adrian Rasmussen D1 owns each immutable physical instance and its current keeper binding. The backend generates a public `AR-XXXXXXXX` QR identity and permanent Ownership Code, stores a normal verifier plus an AES-256-GCM encrypted recoverable copy, mirrors only the encrypted envelope to an online R2 backup, and locks the identity after physical activation. A separate fulfillment row links exactly one active plate to exactly one paid order item or manual handoff; checkout never chooses ownership automatically.

**Tech Stack:** Cloudflare Pages Functions, D1, R2, Web Crypto AES-GCM, TypeScript/JavaScript, React, `qrcode`, Node test runner through `tsx`, Vite.

---

## Scope boundary

This plan includes plate issuance, encrypted recovery, online backup, activation, QR resolution, sale/manual assignment, shipment status, first keeper binding integration, tests, and the physical runbook.

It does not enable the public Stripe shop, invent products or prices, migrate the Mandala ledger, implement ordinary transfers, automate 30-day claims, design inscriptions, redesign certificates/maps, or implement museum succession. Public checkout remains gated until real Stripe products, prices, policies, environment values, and a live test purchase exist.

## File structure

- Create `migrations/010_artwork_plate_identity.sql`: additive plate, encryption, backup, idempotency, and audit schema.
- Create `migrations/011_piece_fulfillments.sql`: exact physical-instance assignment and shipment schema.
- Create `utils/ownershipCodeCrypto.ts`: versioned AES-GCM envelope and stable authenticated context.
- Create `utils/artworkPlate.ts`: public-code generation, QR/underside SVGs, manifest, and hashes.
- Create `functions/api/_lib/plateBackup.js`: R2 encrypted-envelope backup and verification.
- Modify `functions/api/admin/pieces.js`: safe listing and idempotent issuance.
- Create `functions/api/admin/pieces/[id]/reveal.js`: audited single-code recovery.
- Create `functions/api/admin/pieces/[id]/backup.js`: retry encrypted backup.
- Create `functions/api/admin/pieces/[id]/activate.js`: conditional physical activation.
- Modify `functions/qr/[number].js`: D1 lookup for `AR-` identities and legacy preservation.
- Create `functions/api/admin/piece-fulfillments.js`: paid/manual assignment and shipment transitions.
- Modify `functions/api/keeper/bind.js`: close the matching fulfillment on first authenticated bind without weakening contested claims.
- Modify `components/AdminPieces.tsx`: issuance package downloads, recovery, backup, activation, and fulfillment desk.
- Modify `wrangler.toml`: bind the encrypted plate-backup bucket.
- Extend `tests/living-legacy.test.ts`: end-to-end behavior and privacy regression coverage.
- Create `docs/lineage-plate-runbook.md`: environment, migration, backup restore, fabrication, activation, packing, and first-shipment procedure.

### Task 1: Add the registry and fulfillment schema

**Files:**
- Create: `migrations/010_artwork_plate_identity.sql`
- Create: `migrations/011_piece_fulfillments.sql`
- Test: `tests/living-legacy.test.ts`

- [ ] Add failing migration-fixture assertions proving legacy `keeper_pieces` rows remain readable and new columns/tables are absent before 010/011.
- [ ] Run `npm run test:unit` and confirm the new schema assertions fail for the missing migration definitions.
- [ ] Add nullable `public_code`, unique `issuance_key`, `plate_status DEFAULT 'legacy'`, generation/activation timestamps, front/back SHA-256 hashes, Ownership Code ciphertext/nonce/key version, and backup status/reference/timestamp to `keeper_pieces`; add a partial unique public-code index.
- [ ] Create `ownership_code_audit` with piece reference, action, request ID, outcome, and timestamp. It must contain no secret field.
- [ ] Create `piece_fulfillments` with unique `keeper_piece_id`, nullable unique `order_item_id`, `stripe_order|manual` assignment type, non-sensitive recipient reference, lifecycle timestamps, and immutable-after-shipment constraints enforced by API transitions.
- [ ] Re-run the focused migration tests, then the complete unit suite.

### Task 2: Implement Ownership Code authenticated encryption

**Files:**
- Create: `utils/ownershipCodeCrypto.ts`
- Test: `tests/living-legacy.test.ts`

- [ ] Write failing tests for AES-GCM round trip, random 96-bit nonces, wrong key, ciphertext tampering, authenticated-context mismatch, malformed keys, and decryption through an older configured key version.
- [ ] Run the focused tests and confirm failure because the module does not exist.
- [ ] Implement base64 import/export, `OWNERSHIP_CODE_KEY_V<version>` lookup, AES-256-GCM encrypt/decrypt, and stable AAD bound to `publicCode|pieceId|editionNumber|keyVersion` using Web Crypto.
- [ ] Ensure returned envelopes contain only ciphertext, nonce, and key version; verifier generation continues through the existing normalized Ownership Code hash.
- [ ] Run focused tests and the complete unit suite.

### Task 3: Generate deterministic fabrication packages

**Files:**
- Create: `utils/artworkPlate.ts`
- Test: `tests/living-legacy.test.ts`

- [ ] Write failing tests for `AR-XXXXXXXX` format, human-safe alphabet, collision retry contract, exact Adrian URL, QR error correction Q, four-module margin, explicit millimetre dimensions, XML escaping, underside `OWNERSHIP CODE` labeling, stable asset hashes, and a complete private manifest.
- [ ] Run focused tests and confirm the missing-module failure.
- [ ] Implement public-code generation using Web Crypto randomness and the existing safe alphabet.
- [ ] Generate a vector QR containing only `https://adrianrasmussen.com/qr/<publicCode>` and an underside vector containing the existing permanent Ownership Code plus concise registration instructions.
- [ ] Hash the exact SVG bytes and return a manifest that binds public code, artwork, edition, URL, Ownership Code, hashes, and generation time.
- [ ] Run focused tests and the complete unit suite.

### Task 4: Implement idempotent issuance and safe listing

**Files:**
- Modify: `functions/api/admin/pieces.js`
- Create: `functions/api/_lib/plateBackup.js`
- Modify: `wrangler.toml`
- Test: `tests/living-legacy.test.ts`

- [ ] Write failing API tests for known-artwork validation, non-negative integer edition validation, duplicate artwork/edition rejection, issuance-key replay returning the same package, atomic persistence of public identity/verifier/encrypted envelope/hashes, safe list shape, public-code collision retry, and missing encryption configuration.
- [ ] Write failing backup tests proving only ciphertext metadata reaches R2, a failed backup leaves the plate generated but non-activatable, and retry copies the stored envelope without decrypting it.
- [ ] Run focused tests and confirm expected failures.
- [ ] Replace re-registration semantics with idempotent issuance: the client supplies an issuance key; a retry returns the same generated package by decrypting the existing code and regenerating deterministic assets rather than minting another permanent identity.
- [ ] Validate `pieceId` against `FULL_ARCHIVE`; reject duplicates and invalid editions conservatively when edition bounds are absent.
- [ ] Store the verifier and encrypted envelope atomically with public identity and hashes. Never put plaintext, SVG bodies, ciphertext, nonce, verifier, or keys in GET lists or logs.
- [ ] Bind `ARTWORK_REGISTRY_BACKUP` in `wrangler.toml`; mirror the encrypted envelope and non-secret identity metadata to `plates/<publicCode>.json`, recording verified/failed state.
- [ ] Return `Cache-Control: no-store` for all issuance responses.
- [ ] Run focused tests and the complete unit suite.

### Task 5: Add audited recovery, backup retry, and irreversible activation

**Files:**
- Create: `functions/api/admin/pieces/[id]/reveal.js`
- Create: `functions/api/admin/pieces/[id]/backup.js`
- Create: `functions/api/admin/pieces/[id]/activate.js`
- Modify: `functions/api/_lib/admin.js`
- Test: `tests/living-legacy.test.ts`

- [ ] Write failing tests requiring admin authentication, same-origin POST, explicit secret re-entry as step-up authentication, one-piece-only reveal, audit-required reveal, no-store responses, backup retry, conditional `generated → active`, verified backup, matching asset hashes, and idempotent activation.
- [ ] Run focused tests and confirm missing-route failures.
- [ ] Add a constant-time step-up verifier against `UPLOAD_SECRET`; never send it in a URL or store it in an audit row.
- [ ] Implement recovery so authorization and audit insertion occur before decryption; if the audit write fails, reveal fails. Return the existing code and regenerated underside SVG only for the requested row.
- [ ] Implement backup retry from stored ciphertext without decryption.
- [ ] Implement activation requiring explicit confirmations for real-metal scan, identity/edition match, underside match, asset-hash match, and verified online backup. Active rows may never change either code.
- [ ] Run focused tests and the complete unit suite.

### Task 6: Resolve permanent QR identities through Adrian

**Files:**
- Modify: `functions/qr/[number].js`
- Test: `tests/living-legacy.test.ts`

- [ ] Write failing tests for known `AR-` redirect, unknown valid `AR-` 404, missing D1 503, instance/edition query values, and unchanged behavior for `oracle`, `1..64`, and static artwork IDs.
- [ ] Run focused tests and confirm the AR lookup tests fail.
- [ ] Make the handler async. Resolve only strict `AR-[SAFE]{8}` values through D1 and redirect to `/works/:pieceId?instance=<publicCode>&edition=<n>&ref=qr`.
- [ ] Keep every legacy branch byte-for-byte compatible; do not send unknown AR values into `/works/AR-*`.
- [ ] Run focused tests and the complete unit suite.

### Task 7: Add exact sale/manual fulfillment assignment

**Files:**
- Create: `functions/api/admin/piece-fulfillments.js`
- Modify: `functions/api/keeper/bind.js`
- Test: `tests/living-legacy.test.ts`

- [ ] Write failing tests listing paid unassigned order items and active unassigned plates without leaking private code material.
- [ ] Write failing tests for one paid order item or manual reference linking to exactly one physical row, duplicate rejection, correction before shipment, immutable assignment after shipment, and shipment refusal for generated/unbacked plates.
- [ ] Write a failing bind test proving first authenticated claim stamps `claimed_at` on the matching fulfillment, while any piece that has ever had a keeper routes a copied permanent code into the contested-claim path rather than bearer rebinding.
- [ ] Run focused tests and confirm missing behavior.
- [ ] Implement audited assignment and shipment transitions. Checkout/webhook records commerce only; an administrator deliberately selects the exact physical plate during packing.
- [ ] On first successful keeper bind, update the matching fulfillment idempotently. Never pre-bind the buyer and never expose shipping address or buyer email through public registry APIs.
- [ ] Run focused tests and the complete unit suite.

### Task 8: Turn the existing admin page into the plate and fulfillment desk

**Files:**
- Modify: `components/AdminPieces.tsx`
- Test: `tests/living-legacy.test.ts`

- [ ] Add failing pure/helper tests for issuance-key persistence, SVG/manifest filenames, safe response projection, activation checklist completeness, and state clearing after activation.
- [ ] Run focused tests and confirm failures.
- [ ] Rename all UI language from recovery/Lineage Code to Ownership Code.
- [ ] Add issuance downloads for front SVG, underside SVG, and manifest; display backup and lifecycle status; add retry, step-up recovery, and activation actions.
- [ ] Add fulfillment controls for selecting a paid order item or manual handoff, assigning an active plate, marking it shipped, and displaying claimed state.
- [ ] Ensure secrets live only in the immediate issuance/recovery state, are not persisted to local storage, and are cleared on activation or dismissal.
- [ ] Run unit tests, `npm run typecheck`, and `npm run build`.

### Task 9: Write and verify the first-shipment runbook

**Files:**
- Create: `docs/lineage-plate-runbook.md`
- Modify: `docs/superpowers/plans/2026-07-13-artwork-plate-generator.md`

- [ ] Document creation of a 32-byte base64 AES key, Cloudflare secret configuration, separate online key escrow, R2 bucket provisioning, migration backup/apply/rollback, and a scratch restore/decrypt canary.
- [ ] Document prototype checks on iPhone and Android under bright, dim, and angled conditions; URL, public code, edition, Ownership Code, and asset-hash comparison; attachment/abrasion inspection; and pre/post-activation scans.
- [ ] Document packing: compare paid/manual assignment, exact plate, artwork, edition, shipping label, activation, verified backup, and final scan before `shipped`.
- [ ] Mark the old plate-generator plan superseded by this plan rather than leaving contradictory executable instructions.
- [ ] Run `git diff --check`, `npm run test:unit`, `npm run typecheck`, and `npm run build`.

### Task 10: Final integrated review

- [ ] Review the implementation against the amended plate specification and this plan, with special attention to plaintext leakage, immutable activation, idempotent issuance, exact sale assignment, and legacy QR behavior.
- [ ] Run the complete relevant verification once more and record exact outputs.
- [ ] Do not deploy or fabricate production plates until the required Cloudflare secrets/bucket exist and Adrian completes the physical prototype checklist.

