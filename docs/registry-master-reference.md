# Artwork Registry — master reference

A single place to understand, cross-check, and prepare the QR / Ownership Code /
permanent-storage system for Adrian Rasmussen's art. This is the map; the deeper
operational procedure is in `docs/lineage-plate-runbook.md` and the one-time
account setup is in `docs/registry-activation-checklist.md`.

- Repo: `technicianofthesacred/Adrian-Website`
- Everything below is on `main` (commits `85a4579`, `a2b2f30`, `19bdb39`,
  `0ceb0a1`, on top of `bbc7dd6`).
- Public exposure is OFF by design until you provision secrets. It fails closed.

---

## Contents

1. The idea in one screen
2. The two identifiers
3. End-to-end flow, step by step
4. Where everything lives (file / route / endpoint map)
5. The admin tools
6. The offline master ledger + CLI
7. Permanence and security guarantees
8. Who can create codes (access control)
9. What is built vs what only you can do
10. Verification status
11. Go deeper / cross-check list

---

## 1. The idea in one screen

Each physical piece carries a small metal plate. The **front** has a QR code the
world can scan; it only ever shows a look-only certificate page. The **underside**
carries a secret **Ownership Code**. Whoever physically holds the piece can read
that code and, signed in with a verified email, bind themselves as its steward.

The registry that ties a public code to an artwork, and holds the recoverable
(encrypted) Ownership Code, is governed **offline-master, online-mirror**: the
canonical record is a file you hold; the online database is a mirror you can
rebuild from it. Nothing depends on any AI assistant or hosted third party at
runtime.

## 2. The two identifiers

| | Public QR code | Ownership Code |
|---|---|---|
| Looks like | `AR-7K9QMX2P` | `K7QM-9XTR-2PHV-N4WB` |
| Where | Front plate, scannable | Underside, under a panel |
| Secrecy | Look-only, binds nobody | The secret that proves ownership |
| In a URL? | Yes (`/qr/AR-…`) | **Never** |
| Stored as | plaintext (it is public) | SHA-256 **hash** + AES-GCM **encrypted** envelope |

Alphabet excludes O/0/I/1 so both read cleanly when laser-etched small.

## 3. End-to-end flow, step by step

1. **Mint** — in the admin, pick artwork + edition, issue. The server generates
   the public `AR-…` code and a random Ownership Code, stores only the code's
   hash + an encrypted envelope, renders two etch SVGs, records their hashes,
   writes the `issued` lineage event, and backs the envelope up to R2.
2. **Etch files** — download the front SVG (QR), underside SVG (Ownership Code),
   and the private manifest JSON. Send the two SVGs to the laser etcher. The
   manifest is private; it holds the code and is not the buyer's certificate.
3. **Encrypted backup** — confirm the R2 backup shows **Verified** (retry if not).
4. **Prove recovery** — the R2 drill rebuilds the plate from the encrypted backup
   alone, before any metal is cut.
5. **Activate** — after the metal returns, run the physical checklist (scan the
   real QR, compare codes, paste both stored hashes) → permanent one-way lock.
6. **Assign** — tie the exact active, backed-up plate to a paid Stripe order or an
   opaque manual handoff, at packing time.
7. **Ship** — final physical comparison, then mark shipped (immutable after).
8. **Claim** — the collector scans the front QR, signs in with a verified email,
   and types the underside code to bind as steward. First valid code binds; after
   that the code is never a bearer override — a second claimant enters a governed
   30-day process.

## 4. Where everything lives

Routes:
- `/admin/pieces/wizard` — guided one-piece wizard (`components/AdminPlateWizard.tsx`)
- `/admin/pieces` — flat plate + fulfillment desk (`components/AdminPieces.tsx`)
- `/qr` — private QR index page (`components/QRIndex.tsx`)
- `/works/:id` — public artwork record / arrival page (`components/WorksPage.tsx`)
- `/qr/:code` — QR redirect **function** (`functions/qr/[number].js`)

Admin endpoints (all under `functions/api/admin/`):
- `pieces.js` — GET list, POST mint
- `pieces/[id]/activate.js` · `package.js` · `reveal.js` · `verify-recovery.js` ·
  `backup.js` · `claim-evidence.js`
- `piece-fulfillments.js` — assign / correct / ship
- `registry-unlock.js` — the step-up unlock (GET status, POST unlock, DELETE lock)
- `registry-ledger.js` — GET export the offline ledger, POST sync it to Drive

Steward endpoint: `functions/api/keeper/bind.js`

Core libraries:
- `utils/recoveryCode.ts` — generate / normalize / hash the Ownership Code
- `utils/artworkPlate.ts` — render the front + underside SVGs, public `AR-…` code
- `utils/ownershipCodeCrypto.ts` — AES-256-GCM encrypt / decrypt of the code
- `utils/registryLedger.ts` — offline master ledger (hash chain, verify, diff, rebuild SQL)
- `utils/plateWizard.ts` — wizard stage logic
- `functions/api/_lib/keeper.js` · `admin.js` · `lineage.js` · `plateBackup.js` ·
  `driveSync.js` · `registryLedgerExport.js`
- `data/qrRegistry.ts` — the QR rules + registered codes (single source of truth)
- `migrations/008`–`014` — D1 schema (keeper_pieces, lineage, plate identity, etc.)

## 5. The admin tools

- **Guided wizard** (`/admin/pieces/wizard`) — walks one piece through unlock →
  issue → etch files → backup → prove recovery → activate → assign → ship, and
  will not advance past a stage before its safeguard is met. Resumes any piece
  mid-flow at its earliest incomplete step.
- **Flat desk** (`/admin/pieces`) — the power view: issue, per-piece actions
  (retry backup, verify R2 recovery, reveal code, recover full package,
  activate), and the fulfillment desk (assign / correct / ship).
- Both require the **private registry unlock** (step-up secret) for sensitive
  actions, and both have **Download offline ledger** and **Sync to Google Drive**.

## 6. The offline master ledger + CLI

`registry-ledger.jsonl` is a deterministic, hash-chained export of every plate
identity (recovery-code **hash** + **encrypted** envelope, never plaintext) and
its append-only lineage. No steward identity, email, IP, or location.

Get it: **Download offline ledger** on the desk or wizard, or, when Drive is
configured, it syncs automatically after every issue / activation / shipment.

Work with it offline (`npm run ledger`):

```bash
npm run ledger verify ./registry-ledger.jsonl          # chain intact + unaltered
npm run ledger diff   ./held.jsonl ./fresh.jsonl        # detect out-of-band drift
npm run ledger to-sql ./registry-ledger.jsonl out.sql   # rebuild the online mirror
```

`to-sql` restores `keeper_pieces` + `artwork_lineage_events` from the hash and
envelope exactly as the live mint stored them — which is why the online copy is
disposable as long as you hold an intact ledger and the escrowed key.

## 7. Permanence and security guarantees

- **Plaintext code is never stored** — only a SHA-256 hash + AES-256-GCM
  envelope (recoverable only with your escrowed key).
- **Lineage is append-only at the database level** — SQL triggers (migration
  013) abort any UPDATE or DELETE on `artwork_lineage_events`.
- **Migrations are additive-only** — no down-migrations; later work cannot drop
  your columns.
- **Three independent copies** — the D1 row, the R2 encrypted envelope, the
  escrowed key. The runbook's canary drill proves all three reconstruct a piece
  before you engrave one.
- **Activation is one-way**; the public code + URL scheme are permanent
  infrastructure (`functions/qr/[number].js`, `data/qrRegistry.ts`).
- **Offline master ledger** — the record is a file you hold; online is a
  rebuildable mirror; Google Drive keeps revision history of every export.

Honest limit: the URL scheme + code format live in code that *could* be edited.
A standalone permanence contract test is recommended (see §11) so any such change
fails the build.

## 8. Who can create codes (access control)

Minting requires **all** of, at once:
1. a signed-in account with a **verified email**,
2. that email in the `ADMIN_EMAILS` allowlist (Cloudflare env — only you set it),
3. the **registry step-up unlock** (`REGISTRY_STEP_UP_SECRET`),
plus the **encryption key** `OWNERSHIP_CODE_KEY_V1` (without it, mint fails
closed with 503).

Keep `ADMIN_EMAILS` to just your address and the two secrets + key private, and
minting is yours alone.

## 9. What is built vs what only you can do

**Built, tested, on `main`:** issue, etch-file export, encrypted recovery, R2
backup, activation, fulfillment, QR resolver, steward bind, the guided wizard,
the offline ledger + CLI, and Google Drive sync.

**Only you can do (account provisioning — see `registry-activation-checklist.md`):**
generate + escrow `OWNERSHIP_CODE_KEY_V1`, set `REGISTRY_STEP_UP_SECRET`,
`ADMIN_EMAILS`, and `ARTWORK_REGISTRY_ADMIN_ENABLED=true`, create the R2 bucket,
apply D1 migrations, mint the Google Drive refresh token, and configure Stripe
reversal webhooks. Then issue a canary and pass the restore drill before
engraving.

## 10. Verification status (at handoff)

- Unit tests: **155 / 156 pass**. The one failure is `tests/living-legacy.test.ts`,
  which imports from the sibling `mandalacodes` repo not present in the CI
  sandbox — not a defect in this repo.
- Typecheck: clean for all registry code (the only errors are a generated file
  and that same cross-repo import).
- Production build: succeeds.

## 11. Go deeper / cross-check list

Open, honest items to look at next:

- [ ] **Provision and run a canary.** Nothing is real until the activation
      checklist is done and one canary passes the restore + decrypt drill.
- [ ] **Claim-evidence viewer.** The `claim-evidence` endpoint records who
      attempted a claim, but has no admin UI button yet. Add one if you want to
      review it from the desk.
- [ ] **Standalone permanence contract test.** Today the URL-scheme / code-format
      locks live only in `living-legacy.test.ts`, which does not run without the
      `mandalacodes` sibling checkout. A zero-dependency test that fails the build
      on any change to the domain, `/qr/` path, `AR-` format, or resolver routing
      would make "never change" self-enforcing.
- [ ] **Public launch gate.** `LAUNCH_FLAGS.livingLegacy` stays `false` until the
      runbook's three gates pass (copied-artifact R2 recovery canary, real
      engraved-metal phone tests, physical activation).
- [ ] **Drive sync is a convenience, not the only copy.** Keep the ledger with the
      escrowed key + R2 envelopes and run `npm run ledger verify` on the copy you
      rely on.
- [ ] **Custody checks.** Quarterly D1 export, verify new R2 objects, one scratch
      restore/decrypt canary, review audit events (runbook "Routine custody
      checks").
