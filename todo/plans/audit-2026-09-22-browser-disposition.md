# Artist audit browser verification disposition

Product revision: `13e61ed54d5726212cf9582d4b2de8e20bf82cb0`. This is verification debt, not product authorization or launch approval.

The original 248-case attempt had 170 passes, 32 failures and 46 cases blocked by the admin suite's serial fail-fast behavior. The 46 were exercised separately: 30 passed, 5 failed, and 11 retain existing mobile-only skips because their mutation flows run on desktop. Thus the combined diagnostic disposition is **200 passed, 37 failed, 11 existing skips**; this is not a green committed-suite result. No test case remains merely unexecuted by that serial failure.

To exercise the remaining cases, the temporary snapshot changed admin scheduling from `serial` to `default`, with one worker. Assertions and timeouts were unchanged. These standalone diagnostic passes do not prove shared-state/order correctness in the committed serial suite. The final aligned suite must run under its committed scheduling.

Independently, the frozen current registry/sales/collector/contrast subset passed **106/106**. Unit tests passed **1266/1266**, plus typecheck and build. No production calls or launches were used.

| Test | Failure case | Projects | Initial classification |
| --- | --- | --- | --- |
| `tests/admin-studio-navigation.spec.ts:241` | admin artwork navigation exposes registration, invitations, certificates, and optional plates | Mobile Chrome, chromium | Baseline-observed on Chromium; same Mobile symptom inferred |
| `tests/artwork-contributor-ui.spec.ts:144` | keeper manages one-time invitations and contributor access without keeper control leakage | Mobile Chrome, chromium | Baseline-observed on Chromium; same Mobile symptom inferred |
| `tests/steward-registration.spec.ts:122` | a signed-in return with claim context automatically exposes registration | Mobile Chrome, chromium | Baseline-observed on Chromium; same Mobile symptom inferred |
| `tests/steward-registration.spec.ts:148` | a current keeper never sees registration doors or a claim-return proof form | Mobile Chrome, chromium | Baseline-observed on Chromium; same Mobile symptom inferred |
| `tests/steward-registration.spec.ts:83` | scanned sign-in returns to the canonical public claim URL without the Ownership Code | Mobile Chrome, chromium | Baseline-observed on Chromium; same Mobile symptom inferred |
| `tests/steward-registration.spec.ts:231` | signing out clears private registration state before another account can use it | Mobile Chrome, chromium | Baseline-observed on Chromium; same Mobile symptom inferred |
| `tests/steward-registration.spec.ts:272` | an account switch cannot inherit another collector private state | Mobile Chrome, chromium | Baseline-observed on Chromium; same Mobile symptom inferred |
| `tests/steward-registration.spec.ts:314` | a signed-in return stays in onboarding after ownership proof succeeds | Mobile Chrome, chromium | Unresolved; old-layout cause inferred, not independently baseline-proved |
| `tests/steward-registration.spec.ts:426` | a contested request stays pending and keeps the current steward visible | Mobile Chrome, chromium | Unresolved; old-layout cause inferred, not independently baseline-proved |
| `tests/steward-registration.spec.ts:388` | successful binding clears the Ownership Code before a failed status refresh | Mobile Chrome, chromium | Unresolved; old-layout cause inferred, not independently baseline-proved |
| `tests/steward-registration.spec.ts:527` | a late status response from the prior publicCode cannot overwrite the current piece | Mobile Chrome, chromium | Unresolved; old-layout cause inferred, not independently baseline-proved |
| `tests/steward-registration.spec.ts:568` | walks from a neutral registration door through proof, private choices, certificate, and dream | Mobile Chrome, chromium | Unresolved; old-layout cause inferred, not independently baseline-proved |
| `tests/steward-registration.spec.ts:497` | navigation clears the prior piece Ownership Code, note, and outcome | Mobile Chrome, chromium | Unresolved; old-layout cause inferred, not independently baseline-proved |
| `tests/steward-registration.spec.ts:748` | reveals claimed creator notes publicly and keeps price history current-keeper only | Mobile Chrome, chromium | Unresolved; old-layout cause inferred, not independently baseline-proved |
| `tests/steward-registration.spec.ts:861` | saving a missing adult birth profile reloads privacy before the certificate | Mobile Chrome, chromium | Unresolved; old-layout cause inferred, not independently baseline-proved |
| `tests/steward-registration.spec.ts:992` | uses an artwork invitation as memory-only proof for the server-authoritative piece | Mobile Chrome, chromium | Unresolved; old-layout cause inferred, not independently baseline-proved |
| `tests/admin-studio-navigation.spec.ts:442` | registration nextAction verifies and locks the exact catalog sales record | Mobile Chrome, chromium | Unresolved; old-layout cause inferred, not independently baseline-proved |
| `tests/admin-studio-navigation.spec.ts:1089` | opens Maintenance from Artwork and renders the private five-section detail accessibly | Mobile Chrome, chromium | Unresolved; old-layout cause inferred, not independently baseline-proved |
| `tests/admin-studio-navigation.spec.ts:1588` | reviews plate replacement and keeps its one-time secret package only in memory | chromium | Expected contract changed by permanent-number repair; obsolete action/secret assertions need alignment |

Evidence: `/tmp/artist-final-e2e.log`, `/tmp/artist-frozen-admin-unreached.log`, `/tmp/artist-frozen-admin-remaining.log`, `/tmp/artist-frozen-focused-e2e.log`, `/tmp/artist-baseline-other-e2e.log`. Steward baseline evidence: `/tmp/artist-baseline-steward-representative.log`; exactly five Chromium cases completed and failed at the same obsolete controls, while the next case was interrupted and is not classified as independently reproduced. The initial classifications above intentionally do not call every failure baseline-proved. Follow-on test alignment preserves authentication, ownership, privacy, confirmation, destination health and negative paths; unsupported current capability must remain an explicit residual.

Actual Ego synthetic flow reached exact recipient readback, pending, cancellation, recipient acceptance/completion and former-author historical sealed words with the publication control. No backend persistence claim derives from synthetic UI responses. Migrated SQLite tests establish those invariants. Ego screenshots timed out; actual full-run Playwright verified-sales desktop/mobile screenshots were visually inspected and preserved under `/tmp/artist-13e61ed-browser-evidence/`, with no visible horizontal clipping. Their product source matches this revision.

## Follow-up disposition

The subsequent bounded increment preserves the old failures as explicit verification debt. Three steward cases now follow the actual approved interface: canonical sign-in return without code leakage; deliberate `claim=1` entry; and ordinary QR recognition of a current holder, letter kind/date/body, and year eligibility. These pass 6/6 across desktop/mobile. The same-number plate replacement contract passes its desktop case. Contributor invitation/revocation and mounted account change checks pass 4/4. These targeted reruns do not make the entire serial suite green or prove the remaining old scenarios equivalent.

New focused coverage includes eight account-boundary project cases, six fixed-header loading/error/content cases, and two purchase-inquiry failure/retry cases. The privacy tests use the actual auth store without remounting the outer app and include delayed A reads, A→B→A read and mutation completion, same-user refresh, logout and pending-proof clearing. Remaining legacy failures are eleven unaligned steward scenarios across both projects and three admin scenarios across both projects. Their status remains unresolved unless independently baseline-observed in the table above; no blanket skips or timeout increases were added.

## Contract-by-contract handoff

The names below identify the original failing cases; line numbers above refer to the original revision. “Verification gap” means the exact current mounted-browser scenario has not been proved. It does not assert a policy conflict or a product defect. Preview walkthrough tests establish the review interface only and are not substitutes for authenticated live wiring.

| Original failure | Current disposition and evidence |
| --- | --- |
| Admin artwork navigation | Baseline-observed obsolete navigation on Chromium. `artwork-workspace.test.ts` covers the current allowlisted artwork actions; the exact replacement browser navigation remains a verification gap. Mobile baseline attribution remains inferred. |
| Keeper contributor management | Supported live Family contract aligned and passed desktop/mobile, including exact invite payload, token exclusion, two-press revocation and mounted auth transition. `artwork-contributor-ui.spec.ts`. |
| Signed-in claim return | Supported explicit `claim=1` opens the empty code screen. Aligned desktop/mobile proof in `steward-registration.spec.ts`. |
| Current keeper claim return | Approved distinction: explicit claim opens code; ordinary QR recognizes the holder without code. Aligned live proof also covers letter body and yearly eligibility. No routing change was made. |
| Scanned sign-in | Supported Begin→code→account flow returns to the canonical QR URL without raw or normalized code in the URL. Aligned desktop/mobile proof. |
| Sign-out private state | Obsolete controls reproduced on baseline; a separate confirmed mounted-state defect was repaired. `collector-account-boundary.spec.ts` proves private draft/read/proof clearing on logout. |
| Account switch private state | Obsolete controls reproduced on baseline; account-owned state now tears down on identity change. New live auth-store tests prove A→B and A→B→A delayed read/mutation isolation and same-user refresh preservation. |
| Stay in onboarding after bind | Removed “Privacy and birth details” screen assertion. Current preview registration walkthrough passes, but the exact live bind→failed-private-read→retry sequence remains a verification gap, not independently baseline-proved. |
| Binding clears code before failed status refresh | Current `bindNow` settles pending proof on a terminal bind result; exact failed-status-refresh browser sequence remains a verification gap. The new account race cases do not claim to replace it. |
| Contested request remains pending | Old manual-review form and “no silence/window” expectation conflict with approved silence handling. `claim-silence.test.ts` and keeper binding tests cover current persistence; the corresponding mounted code→pending browser path remains a verification gap. No old evidence-note UI was restored. |
| Navigation clears prior piece proof/note | Current journey is keyed by canonical public code and account. The removed evidence-note form remains unaligned; exact cross-piece pending-proof browser sequence remains a verification gap. |
| Late prior-piece status | Public registry canonical identity tests pass; those are not the delayed private-status race. Exact cross-piece delayed keeper-status scenario remains a verification gap. |
| Neutral registration through privacy/certificate/dream | Old multi-screen walkthrough is unaligned. Current dev walkthrough and live QR identity/certificate checks pass separately; one end-to-end authenticated live registration path remains a verification gap. |
| Creator notes public / price history private | Old panel selectors remain unaligned. Existing public projection and private endpoint tests remain relevant; exact mounted viewer-role transition in this case remains a verification gap. |
| Missing adult birth profile | Old “Privacy and birth details” selector remains unaligned. Existing onboarding/privacy unit coverage and preview walkthrough are not proof of the live missing-birth→save→certificate sequence; that remains a verification gap. |
| Artwork invitation memory-only proof | `artwork-invitations.test.ts` proves matching recipient, atomic redemption, expiry/revocation and replay boundaries. The exact current live invitation→registration path remains a browser verification gap. |
| Admin registration nextAction | Current sales/registration unit tests preserve exact catalog identity; the old navigation/nextAction browser assertion remains unaligned and not independently baseline-proved. |
| Admin Maintenance navigation | Direct maintenance functionality and focused re-engraving pass, but the obsolete Artwork→Maintenance navigation assertion remains unaligned and not independently baseline-proved. |
| Plate replacement | Approved same-number re-engraving replaces the old identity-minting expectation. Aligned test preserves identical retry, disabled editing during uncertainty, private secret exclusion and explicit archive acknowledgement before clearing. |

Additional independently confirmed defects in the final repair increment are the fixed-header overlap, missing authorized letter body, live garden sample fallback, and full-migration recovery manifest/provenance gaps. Their focused tests are new evidence rather than retroactive claims that all original failures were harmless.

## Synthetic setup pointers for independent replay

- All new browser specs import `tests/fixtures.ts`, which stubs same-origin metered media. Keep API catch-all local and override only the contracts required by the case; do not rely on production or provider sends.
- Registration and invitation starting identities: `tests/steward-registration.spec.ts` (`mockWork`, `openWithLivingLegacy`, two canonical instance fixtures). Runtime launch-flag enablement is confined to the test browser module and must be repeated after document reload. Keep ordinary QR and explicit `claim=1` entry separate.
- Actual account transitions and delayed private reads: `tests/collector-account-boundary.spec.ts`. Mutable synthetic `/api/auth/get-session` plus `authClient.$store.notify('$sessionSignal')` changes the identity while the outer app stays mounted. The held read/mutation gates can be reused for cross-piece tests, but existing results do not prove those different races.
- Stateful former-author publication and empty/loading/failure garden: `tests/collector-garden-live-empty.spec.ts`. `tests/collector-header-layout.spec.ts` has source-shaped certificate contracts and a deliberately held loading response; the aligned keeper case in `tests/steward-registration.spec.ts` has letter and ritual eligibility contracts.
- Current administrative synthetic route shapes are in `tests/admin-studio-navigation.spec.ts`, including overview and maintenance. The existing Vite local middleware provides synthetic admin endpoints for local development; retain the explicit per-case mocked responses and shared-state limitations. That file remains serial in the committed suite.
- Use an external Playwright config importing the unchanged committed config, overriding only the snapshot's absolute test directory, loopback port and webserver working directory. Keep screenshots/results outside the Git archive. Do not edit tracked scheduling or assertions to obtain the final acceptance result.
