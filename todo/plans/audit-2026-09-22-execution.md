# 22 September artist audit execution

Source: `/Users/adrianrasmussen/.codex/worktrees/e649/Coding/audit-2026-09-22/artist-audit.md`. Baseline freshly fetched `origin/main` `be723b6`. Work occurs only in the supplied isolated worktree, branch `codex/artist-audit-2026-09-22`.

Locked authority: [collector wording](collector-screen-wording.md), especially sections 7–8; companion flow preview/chart. Existing shop and collector launch flags remain unchanged. This checklist tracks audit execution and links to existing plans rather than replacing their decisions.

- [x] Sale confirmation preserves canonical issuance or honestly waits for registration; retained UI result; full-migration synthetic proof.
- [x] Damaged plate re-engraving preserves public number, secret and existing history; compromised-secret recovery remains distinct.
- [x] Physical title/edition identity agrees across registry, Atlas, work and Piece Record without rewriting snapshots or Oracle names.
- [x] Latest public record revalidates after rebuild/privacy changes.
- [x] Seeded collector review harness is separated from public production entry, preserving local review.
- [x] Explicit sculpture/card crossings and validated external contextual return, coordinated centrally.
- [x] Caretaker passing waits for verified matching recipient, with cancel/expiry/idempotence behind flag.
- [x] Held-piece resolution executes reliably with bounded clock, truthful notification failure/idempotence; unresolved irreversible policy goes centrally.
- [x] Seal/with-piece/shine honor latest rules without deleting stored content or changing historical records; preserve profile privacy.
- [x] Recovery scope wording and synthetic restore rehearsal; follow-up full-schema acceptance found the migration-043 omission documented below. Actual physical/private archive access remains unproved.
- [x] Operational failure boundaries: manual payments, viewing invoices, webhook enrichment/enqueue and concurrent/corrupt R2 indexes.
- [ ] Focused regressions, full relevant project checks, actual ego-browser visual validation using synthetic/metered-service stubs.
- [ ] Integrate current main, rerun checks, publish/attach evidence-backed PR and deliver under branch protections.

## Evidence and limits

No production database mutation, provider purchase, real secret access, account takeover or launch-flag enablement is authorized by these checks. Synthetic evidence does not establish production bindings, live email delivery, physical fabrication, payment settlement or complete successor operation.

## 22 September ruling reconciliation

The sealed-author defect inference is superseded by more specific approved evidence. [Wording workbook](collector-wording-workbook.md:637) expressly excludes `tierSealWriterNote` because it contains Adrian’s words read back and confirmed. [Locked copy](../../components/collector/copy.ts:518) records the writer-access/publication exception from the 20 August session. The coordinator confirmed that authority on 22 September: retain writer access, including after transfer; only the writer may publish sealed words; other caretakers/heirs remain excluded and public words cannot become private. No stored body, historical record or locked screen prose was rewritten.

Stage-one focused proof: 46/46 tests for sale lifecycle/UI contract, snapshot/public identity/Atlas precedence, record freshness and all 64 companion-card links. Plate lifecycle/maintenance/UI: 74/74. Typecheck and build pass after generating story data. Production and complete browser proof remain separate.

## Verified increment and local continuation

`154851959541d9fd6affae7ea16aa01e86061461` contains the first six repairs and recovery-scope wording. Immutable snapshot: `/tmp/artist-audit-1548519`. On that snapshot: 1,223 unit tests, TypeScript and production build passed. Logs: `/tmp/artist-1548519-unit.log`, `/tmp/artist-1548519-types.log`, `/tmp/artist-1548519-build.log`.

Synthetic browser served from `http://127.0.0.1:58804`, through `/tmp/artist-audit-proxy.mjs` into this worktree's Vite on port 5566. All API/media data is local and synthetic. Semantic browser checks proved retained sale outcome, physical identity/title and canonical card return after reload, with no horizontal overflow at desktop and 390px widths. Both screenshot mechanisms timed out, so pixel visual approval remains unproved. These are worktree observations, separate from the immutable snapshot's automated proof.

Recovery schema 10 preserves authenticated schema 9 provenance and adds caretaker passing plus silence windows/reminders/delivery evidence, which earlier recovery manifests omitted. The fresh SQLite export/decrypt/restore rehearsal includes accepted and pending passing, terminal refusal, reminders and notification evidence; verifies exact rows, foreign keys and live guard SQL; and rejects a second restore into a populated target. All 45 recovery tests pass (`/tmp/artist-recovery-v10.log`). This proves synthetic registry restoration, not physical possession of private archives, external media, real keys, invoice recovery, bank settlement or provider delivery.

The coordinator confirmed historical author seal→shine is required by the approved writer exception. The additive authored-record publication gateway is implemented and tested, with original-body and custody preservation. No current holder or heir receives the writer's private rights.

## Rollout boundaries

New additive migrations 046 (passing), 047 (notice evidence), 048 (manual payment receipts) and 049 (historical author publication) are local only. Recovery export schema 11 requires its corresponding registry tables; the original v10 manifest omitted migration-043 legacy sections and is superseded for current exports. Do not apply these migrations or enable collector/shop flags as part of synthetic checks. The existing letters runner remains manually dispatched and launch gated; restoring a bounded clock, at most twice daily, is an explicit launch dependency. Passing-token signing configuration, provider delivery, shared-D1 migration state, real private backups and physical fabrication need separate authorized proof.

Publication is blocked by automatic approval review: two pushes to the verified existing private origin were rejected because the reviewer did not accept trusted ownership/export authorization. No push or pull request exists. The coordinator is awaiting the user's answer; no further push attempt is authorized until that answer is forwarded.

## Second immutable increment

`5de7b2ad811c4e0fb4737c9e9df05b06bcd7a393` contains the bounded commerce/content integrity repairs. Exact snapshot `/tmp/artist-audit-5de7b2a`: 1,240/1,240 unit tests, TypeScript and production build pass. Logs `/tmp/artist-5de7b2a-{unit,types,build}.log`.

| Audit finding | Committed proof |
| --- | --- |
| AR18 viewing invoice concurrency/orphans | `tests/viewing-request-atomic.test.ts`, atomic insert/link and retry |
| AR19 manual partial payment duplicates/lost updates | `tests/invoice-payment-events.test.ts`, real migrated SQLite concurrency/replay/overpayment; `tests/invoice-payment-ui.test.ts` retained attempt |
| AR20 webhook enrichment/enqueue acknowledgement | `tests/stripe-webhook-retry.test.ts`, forced upstream/truncated/queue failure and atomic item replacement |
| AR22 R2 lost updates/corrupt index | `tests/r2-json-index.test.ts`, conditional retries/concurrent edits/corrupt fail-closed; updated real-metadata security fixture in `tests/privileged-endpoints.test.ts` |

Remaining local integration: AR8 elevated-code differentiation; passing (accept/cancel/expiry/private declaration/sender notice); silence runner; historical-author publication reachability; recovery schema 10 including all new state; closed-shop checkout gate; broken legacy QR command disposition; bounded resumable record rebuild and truthful annual-upkeep documentation. Final browser checks will run on a frozen snapshot. Six public-registry browser failures reproduce on untouched `be723b6`, see `/tmp/artist-baseline-public-e2e.log`; those legacy-layout assertions are not evidence of a new regression.

Model assignments: SOL `sale_registration` completed canonical sale/passing/manual payments, now owns bounded record rebuild; SOL `plate_permanence` completed plate permanence/silence/webhook/viewing/elevated-code and now finishes historical-author UI and closed-shop/QR disposition; Terra `record_freshness` completed stable-record cache revalidation. Manager owns integration, recovery, R2 integrity and actual browser verification. No Luna workstream was needed. At this milestone the remaining integration estimate is 25–35 minutes; additional work came from the approved historical-author right and concrete notification/reachability gaps, not launch enablement.

## Final custody and recovery increment

Implemented passing with verified recipient acceptance, cancel/expiry and concurrent retry safety; optional private value declaration; durable sender notices and bounded retry. Elevated true-code proof distinguishes non-code custody, without allowing a second claimant to reuse consumed proof. Silence keeps actual sent-notice evidence and completes only after the required deadlines. Historical sealed writing has an additive original-author publication event and an authenticated route back to its exact words. Body, authorship and custody remain immutable.

Recovery v10 was designed to restore passing, silence, historical publication and permanent removal evidence. Independent acceptance subsequently found that its test fixture omitted migration 043 and its manifest could not export fully migrated piece_records. The earlier passing fixture is not proof of full current-schema recovery; the v11 correction below supersedes that claim. The real migrated SQLite rehearsal regenerates Piece Record JSON/HTML: published historical words survive, removed words and private removal reasons do not. Authenticated v9 provenance remains inspectable; SQL generation and the offline CLI refuse potentially republishing old archives before producing output. Safe legacy archives remain restorable. Documentation matches these executable boundaries.

The shop checkout endpoint now enforces the existing closed launch flag. The dead QR generation command is removed in favor of canonical per-instance preparation. Bulk record rebuild has bounded pages, explicit continuation and retained per-piece failures. The annual snapshot remains a distinct operational responsibility.

Product-source snapshot: `/tmp/artist-audit-final`. It matched the product files in `13e61ed54d5726212cf9582d4b2de8e20bf82cb0`; it is not an immutable whole-tree acceptance archive. Subsequent diagnostic changes affected Playwright port and admin test scheduling, and the committed milestone report differs. Independent acceptance uses a fresh Git archive. All 1,266 unit tests, typecheck and production build pass: `/tmp/artist-frozen-{unit,types,build}.log`. Current UI regression subset: **106/106 passed**, `/tmp/artist-frozen-focused-e2e.log`, covering public registry, verified sales, collector walkthrough/field and contrast. Snapshot Playwright port was changed only for isolated test serving.

The complete browser attempt is **not green**: 170 passed, 32 failed and 46 were not reached after a serial-suite failure (`/tmp/artist-final-e2e.log`). Representative baseline failures reproduce in each affected unchanged suite; that does not prove every failing case is baseline. Existing assertions are retained, with no blanket skips or raised timeouts. The 46 initially unreached admin cases were then exercised separately: 30 passed, 5 failed and 11 retained pre-existing mobile skips for flows exercised on desktop. The temporary single-worker mode-default harness changes isolation assumptions, so this is diagnostic evidence rather than a green committed serial suite. See [per-case disposition](audit-2026-09-22-browser-disposition.md).

Actual Ego task 10 on frozen source and entirely synthetic API/media responses reached: sender choice and exact email readback, pending waiting state, cancellation returning to the held piece, recipient acceptance and completed passing, and former-author garden access showing the exact historical seal with Let it shine. No horizontal overflow was observed. These are UI wiring observations; migrated SQLite tests establish persistence/security. Screenshot mechanisms timed out, so pixel visual approval remains unproved. Task 10 was closed. Ego reported an available update; no upgrade was performed.

The remaining verification tranche aligns removed-layout tests to the supported approved interface without changing product UX. Production migrations, collector/shop enablement, provider delivery, actual private-key/media custody, physical QR/plate proof, publication and deployment remain unperformed.

Additional AR17 proof: `tests/purchase-inquiry.spec.ts` follows actual catalogue selection (58 cm), request payload, simulated delivery failure with preserved draft, and identical retry to confirmed receipt. Desktop and mobile pass; provider calls are locally stubbed. Screenshots were inspected at `/tmp/artist-inquiry-results/`. This confirms request handling only, not delivered email, payment, registration or custody.

## Bounded acceptance repairs

Independent acceptance of `13e61ed` exposed the migration-043 `piece_records.legacy_sections` manifest omission. Recovery v10 decoding remains frozen; new exports use v11. Focused recovery tests cover every real migration in filename order, all exported-table schemas checked against the manifest, legacy values 0 and 1 preserved through restoration, authenticated v10 compatibility, and retention of authenticated v9 source provenance through a v10 intermediate archive. This is archive evolution, not a new database migration.

Mounted account changes now destroy account-owned rooms and drafts while preserving the intentional anonymous sign-in bridge. Delayed private reads and invitation completions cannot replace a later account's state, including A→B→A. Same-user session refresh preserves the draft. Focused actual-auth-store tests: 12/12 desktop/mobile across the new boundary suite and contributor suite (`/tmp/artist-account-race-e2e.log`).

The Letters room displays the authorized literal body with its existing kind/date, preserving line breaks and HTML escaping. The collector page uses the measured navigation height to keep its title and Back action below the fixed header; loading, error and loaded state checks pass on desktop/mobile, 6/6 (`/tmp/artist-header-final-e2e.log`). No locked wording, permissions or launch flags changed.

Acceptance also identified live garden state falling into preview answers after publishing the last historical seal. The bounded repair distinguishes live empty/loading/failed states from the explicit development preview and guards the adjacent preview-only save path. The real publication response/refetch flow has focused browser coverage. Final committed-ref results are recorded in the task handoff after verification.
