# Studio finishing pass, 19 November 2026

## Released baseline

Review sale is independently live at e72a551372bb3592a835949ab821a6298b2a84f2, Cloudflare build e7a149cd-d57f-4b8d-b5e2-4b1a141ce5f0. Migration 050 is confirmed in the production migration journal and exact schema. Certificate template selection and recovery are also released. Do not revive these as pending work.

## Owner decisions in this conversation

Accepted quote: Adrian approved “Yes, preserve the agreement” to creating one invoice with the agreed size, artwork price and payment terms preserved, explicitly including migration 051. This does not authorize sending an invoice or taking a payment. Migration 051 is rehearsed locally in this finishing candidate; this document does not claim production application.

Private history: Adrian said, “When it is handed off, the previous owner who sells it gets to decide if it comes with it. If later on he wants it to transfer, he can also decide that.” He further clarified that the artwork keeps the record of everyone who held it, their interactions and what they chose to share. The history persists across handoffs.

Apply this as an access decision, not deletion: the permanent artwork history survives; private entries are withheld from successor access unless their author permits it; an author can allow access after a passing. Former keepers retain control over their own contributions’ sharing, not the artwork or another keeper’s entries. A successor read grant does not imply permission to publish. Current Atlas location consent remains separate. This supersedes the older automatic transfer of private place memories and the earlier recommendation to choose between all-private-with-author and all-private-with-piece. Migration 052 and keeper rollout remain local and gated.

## Finishing candidate

Local preview: http://127.0.0.1:8892/admin . This runs disposable development fixtures, not production customer records.

Scope: grouped Studio navigation and resumable work, exact-edition artwork workspace and recovery links, invoice privacy and saved-version sharing, payment and accepted-agreement integrity, truthful pricing save/retry, publishing failure recovery, compatible rich story generation and artwork links, collections recovery, and the local private-history permission prototype.

No live customer data, outgoing invoice, payment, keeper activation or cross-site publication is part of these checks. The original shared checkout and preserved invoice drafts remain untouched.

## Verified local result

Core Studio candidate: `31e252d`, branch `codex/studio-finish-20261119`, based on released `e72a5513`. The collector prototype is committed separately on that branch. Neither candidate is published.

Final checks passed: 1,397 unit tests, typecheck, production frontend build and guarded Pages worker build, 48 production-built desktop/390px browser checks, and 61 source-fixture desktop/390px checks. Eleven mobile duplicates of development mutation contracts are intentionally skipped; their desktop cases passed. Tests cover retained failed edits, exact selector recovery, no serious accessibility violations in the Studio shell/workspace, accepted quote replay/private provenance, permission controls before and after a real simulated passing, and city opt-in/revocation.

The public portable record now includes published reflections and deliberately public place milestones in JSON and offline HTML. Explicit successor reading grants never make private entries public. Existing v1 exports retain their bytes and hashes; the gated extension uses v2. Public writes refresh exports; storage failure leaves the write committed and offers an honest retry. No private content is deleted at passing.

Browser verification uses a local preview with hot reload disabled, so unrelated file saves cannot reset a user's open form. The durable launchd preview runner and evidence live under `~/.codex/releases/studio-finish-20261119`.

## Work requiring real choices or material

- Certificate facts: approve the actual materials, makers, techniques, origin, year and edition wording before issuing a certificate. Software cannot establish authenticity facts.
- Editorial content: select an approved AR Create article and cover for the real publishing handoff. Fixture proof does not approve an article for publication.
- Sale reconciliation: identify an existing completed invoice and external receipt before any read-only private reconciliation. Carrier quotes require actual origin, destination, packed size/weight and insurance/import-fee agreement.
- Commercial exceptions: keep multi-artwork sales and refunds/amendments in the existing manual workflow until their allocation/correction behavior is chosen.
- Keeper launch: separate readiness remains for staging restore of the complete private record, authorized notice delivery and deployed cross-domain account/Atlas proof. Public export generation, replay and storage-failure recovery are now verified locally. Keep rollout off until those proofs and release approval exist.

Validation evidence is recorded alongside the candidate under ~/.codex/releases/studio-finish-20261119. A local passing check is not a live release claim.
