# Artwork Registry Finish and Handover Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the artwork registry understandable and operable by Adrian first, then transferable to a future custodian without requiring them to reconstruct the system from code or scattered files.

**Architecture:** Separate the permanent digital artwork identity from the optional physical plate. Adrian should be able to register an artwork directly, inspect and securely save its codes, and decide later whether to fabricate a plate. Keep one encrypted master archive for the whole registry, while retaining a small per-object fabrication package only when a physical object is actually being made.

**Tech Stack:** React 18, TypeScript, Cloudflare Pages Functions, D1, private R2, Infisical, optional Google Drive mirror, SVG fabrication files.

---

## Current state

The registry backend is substantially built. It can issue permanent identities, encrypt Ownership Codes, create private R2 backups, export a full encrypted recovery archive, record lineage and maintenance events, and generate SVG fabrication files. The V3 Ownership Code key is active and escrowed, and no production artwork identities were known to exist when this plan was written.

The unfinished part is not primarily more cryptography. It is making the product match Adrian's actual mental model and making its custody understandable:

- Creating a registry identity currently feels like creating and shipping a metal plate.
- The admin flow overemphasizes fulfillment and commerce even though Adrian must be able to register an object independently of Shopify, Stripe, or an order.
- The generated plate has not been visually approved or designed in Illustrator by Adrian.
- The download exposes three loose files without adequately explaining which are permanent records, fabrication inputs, or private secrets.
- The master archive, per-object package, Drive mirror, key escrow, and succession procedure are not presented as one coherent custody system.
- A non-production canary and physical prototype should wait until the creator flow and plate design are approved. Testing an unclear or visually unapproved object would only qualify the wrong design.

Stripe is deliberately outside this plan. The artwork registry must work without Stripe, and Adrian currently uses Shopify. A Shopify connection can be shaped separately if automatic sale-to-registry assignment becomes useful.

## Product decisions already made

1. **Registering an artwork is the primary action.** It creates the permanent digital identity and codes. It does not require an order, buyer, shipment, or physical plate.
2. **Fabricating a plate is optional and later.** A registered artwork may remain digital-only, receive a printed certificate, or receive a physical plate after Adrian approves its design.
3. **Adrian can reveal a code he created.** The Ownership Code remains protected behind sign-in and the registry unlock, but the creator is never conceptually locked out of it.
4. **One master archive represents the whole registry.** It is the succession and disaster-recovery object. It contains encrypted Ownership Codes, not readable ones.
5. **Each physical object still needs a small per-object package.** Its QR, public code, edition, private Ownership Code, and exact fabrication hashes are unique. This package is temporary/private working material, not the master registry.
6. **The per-object manifest stays for machine verification but should stop feeling like a mysterious user document.** It should live inside a clearly named package and be explained in plain language.
7. **No production plate is issued or engraved until Adrian approves the visual design and the non-production canary passes.**

## Target custody model

### One whole-registry archive

The primary handover object is a dated encrypted registry recovery archive, accompanied by its human-readable operations guide. It carries every artwork identity, encrypted Ownership Code envelope, lineage event, creator correction, fulfillment state, and recovery qualification needed to restore the registry.

The archive key must remain separate from the archive itself. A future custodian needs both, plus access to the repository or a packaged restore tool. The public-safe `registry-ledger.jsonl` is useful for inspection and integrity history, but it is not a substitute for the private encrypted recovery archive.

### One package only when fabricating an object

Every physical object has unique codes, so fabrication cannot safely use one shared JSON file for all objects. Instead, generate one clearly named package such as:

```text
AR-XXXXXXXX_artwork-id_edition-1/
  READ-ME-FIRST.txt
  plate-front.svg
  ownership-code.svg
  private-manifest.json
```

`READ-ME-FIRST.txt` explains what to send to the fabricator, what must remain private, and what can be discarded after the plate and collector handoff are complete. `private-manifest.json` remains because the system needs exact hashes and identity metadata, but it is no longer presented as something Adrian must interpret manually.

## Task 1: Redesign the creator flow around registering an artwork

**Files:**
- Modify: `components/AdminDashboard.tsx`
- Modify: `components/AdminPlateWizard.tsx`
- Modify: `components/AdminPieces.tsx`
- Modify: `utils/plateWizard.ts`
- Test: `tests/admin-plate-wizard.test.ts`
- Test: `tests/admin-studio-navigation.spec.ts`

- [ ] Rename the primary action from plate-centric language to **Register an artwork**.
- [ ] Make the opening screen explain, in one short paragraph, that registration creates a permanent digital identity and that a physical plate is optional.
- [ ] Let Adrian choose an existing catalogue artwork or create a private registry-only artwork without needing an order.
- [ ] End identity creation at a clear **Artwork registered** state before any fabrication or fulfillment steps begin.
- [ ] Offer separate next actions: **View and save codes**, **Prepare a physical plate**, **Assign to a keeper**, and **Finish for now**.
- [ ] Keep Shopify, Stripe, and paid-order concepts out of the core registration path.
- [ ] Update focused unit and browser tests to prove registration can complete without fabrication, assignment, or shipment.

## Task 2: Make creator access to codes explicit and safe

**Files:**
- Modify: `components/AdminPieces.tsx`
- Modify: `components/AdminPlateWizard.tsx`
- Review: `functions/api/admin/pieces/[id]/reveal.js`
- Review: `functions/api/_lib/admin.js`
- Test: `tests/admin-studio-navigation.spec.ts`
- Test: `tests/privileged-endpoints.test.ts`

- [ ] Add a clearly labelled **Reveal Ownership Code** action on each registered artwork.
- [ ] Explain that the public code may be shared, while the Ownership Code is private and should go only to the keeper.
- [ ] Keep reveal behind verified administrator sign-in and the registry unlock.
- [ ] Keep the revealed value in memory only, with copy and dismiss controls, and never write it to analytics, logs, URLs, or browser storage.
- [ ] Add a plain warning that revealing a code is normal creator access, not emergency recovery.
- [ ] Verify the existing reveal endpoint still enforces these boundaries and add regression coverage for the final UI.

## Task 3: Design the physical plate before qualifying it

**Files:**
- Modify after design approval: `utils/artworkPlate.ts`
- Modify after design approval: `utils/artworkPlateSvg.ts`
- Test: `tests/living-legacy.test.ts`
- Test: `tests/artwork-package-recovery.test.ts`
- Update: `docs/lineage-plate-runbook.md`

- [ ] Export one current sample SVG and open it in Illustrator at its native dimensions.
- [ ] Adrian decides whether a plate belongs on every object, only selected objects, or is replaced by a certificate for some work types.
- [ ] Adrian approves the plate's dimensions, material, attachment method, typography, front/back content, and visual relationship to the artwork.
- [ ] Save the approved Illustrator source or a clean SVG template as the visual source of truth in a documented repository location.
- [ ] Update the generator to place each object's unique QR and codes into the approved design without changing its visual system.
- [ ] Regenerate hash and QR tests against the approved dimensions and layout.
- [ ] Do not engrave production metal until this task is complete.

## Task 4: Replace loose downloads with an understandable package

**Files:**
- Modify: `utils/artworkPlate.ts`
- Modify: `components/AdminPlateWizard.tsx`
- Modify: `functions/api/admin/pieces/[id]/package.js`
- Test: `tests/artwork-package-recovery.test.ts`
- Test: `tests/admin-plate-wizard.test.ts`

- [ ] Download one named package rather than three unexplained loose files.
- [ ] Include `READ-ME-FIRST.txt` with object identity, edition, what each file does, privacy handling, and fabricator instructions.
- [ ] Keep `private-manifest.json` for hashes and recovery, but label it **private machine record, no editing needed** in the UI and readme.
- [ ] Make the public SVG and private Ownership Code artwork visually distinct so the wrong side cannot be sent or engraved accidentally.
- [ ] Add an explicit package-complete confirmation before leaving the one-time creation screen.
- [ ] Preserve deterministic regeneration and hash verification so changing the download experience does not weaken recovery.

## Task 5: Make whole-registry custody and succession one coherent operation

**Files:**
- Update: `docs/registry-private-recovery.md`
- Update: `docs/registry-master-reference.md`
- Create after the product flow is stable: `docs/registry-custodian-guide.md`
- Review: `functions/api/admin/registry-recovery-export.js`
- Review: `scripts/registry-ledger.ts`
- Test: `tests/registry-recovery.test.ts`

- [ ] Confirm the independent registry recovery export key and key ID are configured and escrowed separately from the Ownership Code key.
- [ ] Produce one fresh encrypted whole-registry archive and verify it with the restore tooling without exposing any key or readable Ownership Code.
- [ ] Write the custodian guide for a nontechnical successor: what the registry is, where the archive lives, where each key is held, which accounts matter, how to reveal a code, how to restore, and whom to contact.
- [ ] Name a second custodian or sealed physical custody location for the required keys and account recovery information.
- [ ] Prove that losing Adrian's laptop alone does not lose the registry, and that the archive alone cannot reveal private codes.
- [ ] Keep secrets, session tokens, and plaintext Ownership Codes out of the guide.

## Task 6: Add Google Drive only after the custody model is settled

**Files:**
- Review: `functions/api/_lib/driveSync.js`
- Review: `functions/api/admin/registry-ledger.js`
- Test: `tests/drive-sync.test.ts`
- Update: `docs/registry-custodian-guide.md`

- [ ] Enable the Google Drive API and mint the least-privilege `drive.file` refresh token through Adrian's browser consent.
- [ ] Store the refresh token in Infisical and Cloudflare without printing it to a transcript or terminal output.
- [ ] Optionally set one clearly named Drive folder for registry continuity materials.
- [ ] Deploy and verify that `registry-ledger.jsonl` updates in place and retains Drive revision history.
- [ ] Explain in the custodian guide that Drive is a public-safe mirror, not the complete private recovery archive.

## Task 7: Qualify the finished design with one non-production canary

**Files:**
- Follow: `docs/registry-activation-checklist.md`
- Follow: `docs/lineage-plate-runbook.md`
- Update: `docs/registry-custodian-guide.md`

- [ ] Register one clearly marked non-production artwork using the redesigned creator flow.
- [ ] Verify the encrypted R2 backup, downloaded copied-recovery file, and persisted recovery qualification.
- [ ] Export and independently restore the full private registry archive into a scratch environment.
- [ ] Confirm the public QR resolves without exposing the Ownership Code.
- [ ] Fabricate one non-production plate from the approved Illustrator-derived design.
- [ ] Test readability, attachment, abrasion, iPhone scans, and Android scans under the conditions in the runbook.
- [ ] Record the qualification result without retaining plaintext codes in documentation.

## Task 8: Restore trustworthy deployment automation

**Files:**
- Review: Cloudflare Pages project build settings
- Review: `package.json`
- Review: `wrangler.toml`
- Update if needed: `CLAUDE.md`

- [ ] Reproduce and capture the current `main` deployment result before assuming the earlier failure still exists.
- [ ] If Git-triggered production builds still fail while local and direct uploads pass, inspect the Cloudflare build log and correct the project build settings or environment mismatch.
- [ ] Push a harmless verified change and prove one successful production deployment from `main` without a manual `wrangler pages deploy` workaround.
- [ ] Record the canonical deployment path in `CLAUDE.md`.

## Completion gate

This plan is complete when Adrian can register an artwork without a sale or plate, can securely view its codes, understands the one per-object package, has approved the physical design in Illustrator, and can hand one encrypted whole-registry archive plus a plain-language custodian guide to a successor. Google Drive mirrors the public-safe ledger, one non-production canary proves restoration and physical scanning, and pushes to `main` reliably deploy the site.

Until then:

- Do not engrave a production plate.
- Do not issue a production identity merely to test the current interface.
- Do not treat the Drive ledger as the private recovery archive.
- Do not connect Stripe merely to make the registry usable.
- Do not delete retired encryption-key versions or reuse their version numbers.
