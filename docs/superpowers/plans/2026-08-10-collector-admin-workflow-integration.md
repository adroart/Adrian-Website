# Collector and Admin Workflow Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development`
> (recommended) or `executing-plans` to implement this plan task by task.

**Goal:** Join the active collector build to the existing studio tools through one artwork-centered admin workspace and persistent handoffs, without creating a second registry, sales history, collector journey, or ownership writer.

**Architecture:** The active collector branch remains the owner of permanent artwork identity, invitations, claims, certificates, private verified sales, and collector records. Existing pricing, viewing, invoice, plate, and maintenance modules stay specialized. Two read-oriented modules compose them: `ArtworkWorkspace` for Adrian and `PieceExperience` for collectors. Mutations continue through the existing protected modules.

**Tech Stack:** Vite, React 18, TypeScript, React Router 7, Cloudflare Pages Functions, D1 SQLite, Node test runner, Playwright.

---

## Current truth

The integration snapshot is anchored to the clean final collector foundation commit `d5b10fa1cf7a05577c72a1a87e51f017b5e82b99` from `codex/collector-phase-1`. Any later external work on that branch must be merged into this integration branch before anyone touches overlapping collector files here.

| Capability | Status | Decision |
|---|---|---|
| Permanent artwork identity and optional plate | Built locally on collector branch | Reuse |
| Ownership Code, invitation, claim, governed transfer | Built locally on collector branch | Reuse as the only writers |
| Certificate templates and effective certificate | Built locally on collector branch | Reuse |
| Verified sales, reconnections, artwork ledger, price history | Built locally at the snapshot commit | Reuse as canonical sale history |
| Registration, invitations, certificates, verified-sales admin pages | Built locally as separate tools | Compose inside an artwork workspace |
| Plate, recovery, registry maintenance | Built on main and collector branch | Keep specialized and admin-only |
| Pricing, private viewings, invoices | Built on main | Connect with persistent artwork context |
| Current collector React flow | Partly built under an older model | Replace where it conflicts with the August 10 master |
| Garden, household, heirs, gift wishes, new passing UI | Interactive specification only | Build later against settled shared seams |
| Video | Deferred | Do not include in this integration |

## Ownership boundaries

These rules prevent the integration from creating a second system.

1. `artwork_id` identifies a catalog design. It never proves possession or caretaking.
2. `keeper_piece_id` identifies one permanent physical instance. It is the sole authority for registration, claim, caretaker, transfer, plate, and recovery state.
3. `artist_artwork_record_id` represents an unresolved or identified sales record. It may link once to `keeper_piece_id`; it never replaces it.
4. Better Auth and the shared profile remain the only person and birth record.
5. `artist_verified_sales` owns verified sale facts and permanent artwork-level price history.
6. Invoices are receivables. A paid invoice is evidence to review, not a verified sale and never an ownership mutation.
7. `artwork_acquisitions` stops accepting new `sale` entries after this integration. Existing sale entries remain readable as legacy records until Adrian verifies them. It remains available for retained work, loans, consignments, gifts, inheritance, and other custody context.
8. Collector-facing language uses “caretaker.” Internal `keeper_*` names remain unchanged to avoid a risky storage migration.
9. The locked collector wording is copied exactly. It is not rewritten inside implementation tasks.

## Explicit non-goals

- Do not rebuild the collector screens on `main`.
- Do not extend `components/legacy/KeeperPanel.tsx` or preserve a second collector journey.
- Do not create another registration, invitation, claim, transfer, certificate, media, or price-history store.
- Do not merge pricing logic, viewing curation, invoice mechanics, recovery, and collector ritual into one large module.
- Do not enable `livingLegacy` during integration.
- Do not auto-create a verified sale, register an artwork, invite a caretaker, claim a piece, or transfer ownership from payment state.

## Task 1: Stabilize and reconcile the active collector branch

**Files:**

- Review active worktree: `components/admin/CollectorSales.tsx`
- Review active worktree: `functions/api/_lib/certificateContent.js`
- Review active worktree: `functions/api/artwork-ledger/media/[id].js`
- Review active worktree: `tests/artist-sales-ui.test.ts`
- Review active worktree: `tests/artist-sales.spec.ts`
- Review active worktree: `tests/artist-sales.test.ts`
- Modify after active work finishes: `todo/plans/the-collector-build.md`
- Modify after active work finishes: `todo/plans/the-collector-execution.md`
- Modify after active work finishes: `TODO.md`
- Preserve: `todo/plans/collector-screen-wording.md`
- Preserve: `todo/plans/collector-flow-preview.html`
- Preserve: `todo/plans/collector-flow-chart.html`
- Preserve: `todo/plans/collector-primitives.html`
- Preserve: `todo/plans/collector-build-prompt.md`

- [x] **Step 1: Wait for the active sales workspace to reach a clean commit**

Do not edit the active sales files from another worktree. Record the final collector commit and confirm its worktree is clean before integration begins.

- [x] **Step 2: Preserve the August 10 authority files**

The active branch currently removes several master and prototype documents while project instructions still identify them as authoritative. Keep the locked wording, flow chart, flow preview, primitives, and build prompt until a separate approved archival change updates every reference to them.

- [x] **Step 3: Add a semantic migration table to the collector progress record**

Mark each existing collector surface as one of:

- `reuse`: identity, invitations, governed claim and transfer, certificate resolver, verified sales, media integrity, recovery.
- `adapt`: public projections, dream persistence, letters scheduling, field data.
- `replace`: the old Register-or-Dream fork, combined privacy and birth flow, legacy keeper panels, equal-brightness semantics where they conflict with the master.
- `later`: garden, household, collaborators, heirs, gift wishes, passing UI, video.

- [x] **Step 4: Reconcile progress language without changing locked copy**

Update `the-collector-build.md`, `the-collector-execution.md`, and `TODO.md` so they distinguish local implementation, active refinement, superseded presentation, and production rollout. Do not mark a surface complete merely because its earlier version exists.

- [x] **Step 5: Verify the truth pass**

Run:

```bash
rg -n "collector-screen-wording|collector-flow-preview|collector-flow-chart|collector-primitives|collector-build-prompt" CLAUDE.md TODO.md todo docs
git diff --check
git status --short
```

Expected: every authority reference resolves, locked files remain present, and only intentional documentation changes are listed.

## Task 2: Integrate the collector foundation without launching it

**Files:**

- Merge surface: `App.tsx`
- Merge surface: `launchFlags.ts`
- Merge surface: `components/WorksPage.tsx`
- Merge surface: `components/admin/AdminNavigation.ts`
- Merge surface: `functions/api/_lib/registryRecoveryExport.js`
- Merge surface: `utils/registryRecoveryArchive.ts`
- Merge surface: `migrations/023_collector_registry_merge.sql` through `migrations/032_artist_verified_sales.sql`
- Verify: `tests/collector-phase-zero.test.ts`
- Verify: `tests/collector-phase-two-integration.test.ts`
- Verify: `tests/artist-sales.test.ts`
- Verify: `tests/registry-recovery.test.ts`

- [x] **Step 1: Create one integration branch from the finished collector branch**

Bring current `main` into the finished collector branch. Resolve the planning-document overlap by preserving the August 10 authority files and the collector branch’s truthful progress record.

- [x] **Step 2: Keep production closed**

Assert `LAUNCH_FLAGS.livingLegacy === false`. Do not apply remote migrations, fabricate a plate, seed production membership, or change production bindings in this task.

- [x] **Step 3: Run the collector foundation gate**

Run the focused ownership, invitation, registration, certificate, privacy, field, letters, verified-sales, and recovery suites listed by the collector execution record, followed by:

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
git diff --check
```

Expected: the collector branch is integrated locally, its recovery archive covers every new permanent table, and the collector launch flag remains false.

- [x] **Step 4: Review ownership boundaries once**

Review only for P0 and P1 defects in identity, claim, transfer, privacy projection, encrypted recovery, and media access. Fix those before adding workflow composition.

## Task 3: Make verified sales the only new sale and price history

**Files:**

- Modify: `components/AdminMaintenance.tsx`
- Modify: `functions/api/_lib/registryMaintenance.js`
- Modify: `functions/api/admin/maintenance/[id]/actions.js`
- Modify: `utils/adminRegistryMaintenance.ts`
- Modify: `tests/registry-maintenance.test.ts`
- Modify: `tests/admin-maintenance-ui.test.ts`
- Modify: `tests/admin-studio-navigation.spec.ts` (guarded legacy-sale navigation)
- Reuse: `functions/api/_lib/artistSales.js`
- Reuse: `components/admin/CollectorSales.tsx`

- [x] **Step 1: Write the failing maintenance contract tests**

Prove that a new maintenance acquisition cannot write `acquisition_type = 'sale'`, while retained work, loan, consignment, gift, inheritance, and other custody records still work.

- [x] **Step 2: Preserve legacy sale records as read-only**

The maintenance reader continues to show existing `sale` acquisitions with a “Legacy sale record” label. The editor does not offer `sale` for new entries and does not silently convert old records.

- [x] **Step 3: Hand sale work to the verified-sales workspace**

Add an exact link from a legacy sale record or paid invoice to `/admin/collector-sales` with stable source context. Adrian must confirm the artwork and facts before the verified-sale writer runs.

- [x] **Step 4: Verify no dual writes**

Test that creating or correcting a verified sale never writes `artwork_acquisitions`, and maintenance acquisition changes never write `artist_verified_sales` or the private price ledger.

## Task 4: Build the read-only ArtworkWorkspace projection

**Files:**

- Create: `functions/api/_lib/artworkWorkspace.js`
- Create: `functions/api/admin/artwork-workspace.js`
- Create: `utils/artworkWorkspace.ts`
- Create: `tests/artwork-workspace.test.ts`
- Reuse: `functions/api/_lib/artworkRegistration.js`
- Reuse: `functions/api/_lib/certificateContent.js`
- Reuse: `functions/api/_lib/artistSales.js`
- Reuse: `functions/api/_lib/artworkInvitations.js`
- Reuse: `functions/api/_lib/registryMaintenance.js`

- [x] **Step 1: Define the response contract in a failing test**

The endpoint accepts one or more stable selectors:

```ts
type ArtworkWorkspaceSelector = {
  artworkId?: string;
  keeperPieceId?: string;
  artistArtworkRecordId?: string;
};
```

It resolves them into one workspace:

```ts
type ArtworkWorkspace = {
  catalog: { artworkId: string; title: string };
  salesRecord: { artworkRecordId: string; state: string } | null;
  identity: { keeperPieceId: string; publicCode: string; state: string } | null;
  certificate: { state: string; missingFields: string[] };
  invitation: { state: string; invitationId: string | null };
  caretaker: { state: string };
  plate: { state: string; recoveryState: string } | null;
  sale: { state: string; verifiedSaleId: string | null };
  nextAction: { label: string; href: string; reason: string } | null;
  activity: Array<{ kind: string; occurredAt: string; label: string }>;
};
```

- [x] **Step 2: Resolve identifiers without inventing identity**

An unresolved sales record may have no `artworkId`. An identified record may have no `keeperPieceId`. Only `identity_linked` may expose all three identifiers. Conflicting selectors return a 409 response instead of merging two artworks.

- [x] **Step 3: Reuse existing projections**

Call the effective certificate, invitation, verified-sale, identity, and maintenance readers. Do not copy their mutation rules into `artworkWorkspace.js`.

- [x] **Step 4: Derive one next action**

Use an ordered rule set, beginning with data integrity and moving toward optional work:

1. Resolve conflicting or unresolved identity.
2. Complete required recovery or plate safety work.
3. Register an identified exact artwork when Adrian chooses.
4. Complete missing certificate facts.
5. Create or resolve an invitation.
6. Verify a paid invoice or legacy sale candidate.
7. Open the public or caretaker experience for review.

- [x] **Step 5: Prove privacy and secret exclusion**

The response may include private admin facts needed for the workspace, but it must never contain plaintext ownership codes, invitation tokens, code verifiers, ciphertext, nonces, recovery keys, raw media storage keys, or birth data.

- [x] **Step 6: Run focused verification**

```bash
npx tsx --test --experimental-test-module-mocks tests/artwork-workspace.test.ts tests/artist-sales.test.ts tests/certificate-content.test.ts tests/registry-maintenance.test.ts
npm run typecheck
git diff --check
```

## Task 5: Add the artwork-centered admin screen

**Files:**

- Create: `components/admin/ArtworkWorkspace.tsx`
- Create: `components/admin/ArtworkWorkspaceHeader.tsx`
- Modify: `App.tsx`
- Modify: `components/admin/AdminNavigation.ts`
- Modify: `components/admin/CollectorSales.tsx`
- Modify: `components/AdminPieces.tsx`
- Modify: `components/AdminMaintenance.tsx`
- Modify: `components/AdminPlateWizard.tsx`
- Modify: `tests/admin-studio-navigation.spec.ts`
- Create: `tests/admin-artwork-workspace.test.ts`

- [ ] **Step 1: Add the route**

Add `/admin/artworks/:artworkId`. Accept `instance` and `record` query parameters for `keeperPieceId` and `artistArtworkRecordId`. The route renders a stable workspace header even while details load.

- [ ] **Step 2: Build the header around identity and next action**

Show title, catalog ID, public code when present, relationship state, and exactly one next meaningful action. Do not put mutation forms in the header.

- [ ] **Step 3: Compose existing specialist tools**

The first version contains summaries and deep links for:

- Record and certificate
- Verified sale and artwork ledger
- Invitation and caretaker state
- Public piece preview
- Plate and recovery
- Maintenance and custody history

The links carry stable IDs. The workspace calls existing routes and writers rather than embedding copies of their forms.

- [ ] **Step 4: Link every artwork-bearing admin surface back to the workspace**

Add “Open artwork” links to registration results, verified-sale artwork rows, registry pieces, maintenance details, and plate completion. Fix the existing `/admin/plate-wizard` dead link by using `/admin/pieces/wizard`.

- [ ] **Step 5: Test desktop, mobile, keyboard, and missing-state behavior**

The screen must remain useful for unresolved, identified, registered, invited, claimed, plate-free, and legacy records. Verify 390px and desktop layouts and ensure focus moves to status and conflict messages.

## Task 6: Replace dashboard counts with an item-level work queue

**Files:**

- Create: `functions/api/_lib/adminWorkQueue.js`
- Modify: `functions/api/admin/overview.js`
- Modify: `components/AdminDashboard.tsx`
- Create: `tests/admin-work-queue.test.ts`
- Modify: `tests/admin-studio-navigation.spec.ts`

- [ ] **Step 1: Write failing queue tests**

Cover at least:

- recovery proof missing or stale;
- identified sale artwork ready for optional registration;
- paid invoice waiting for sale verification;
- draft viewing;
- requested viewing with linked invoice;
- open, partial, or overdue invoice;
- invitation ready, expired, or unresolved;
- legacy sale acquisition awaiting verification.

- [ ] **Step 2: Return action items, not category counts**

Each item includes domain, object title, state, age or due signal, one action label, and one exact link. A clean queue is only returned after all supported sources were successfully checked.

- [ ] **Step 3: Simplify the home screen**

Replace duplicate Quick actions and All tools grids with:

- Work that needs you
- Recent artworks
- Recent collectors or reconnections
- A small “Start new” group

- [ ] **Step 4: Verify truthful calm**

Test that “Nothing is waiting” cannot appear when any supported queue source contains actionable work or when one source failed to load.

## Task 7: Persist artwork context across pricing, viewings, and invoices

**Files:**

- Create: `migrations/033_admin_workflow_context.sql`
- Modify: `utils/pricing/types.ts`
- Modify: `utils/pricing/api.ts`
- Modify: `functions/api/_lib/pricing.js`
- Modify: `functions/api/pricing/quotes.js`
- Modify: `functions/api/pricing/quotes/[id].js`
- Modify: `components/PricingCalculator.tsx`
- Modify: `components/viewing/viewingTypes.ts`
- Modify: `components/viewing/curationEngine.ts`
- Modify: `functions/api/admin/viewings.js`
- Modify: `functions/api/viewings/[token]/request.js`
- Modify: `components/invoices/invoiceTypes.ts`
- Modify: `functions/api/_lib/invoices.js`
- Modify: `functions/api/admin/invoices.js`
- Modify: `components/AdminInvoices.tsx`
- Modify: `tests/invoice-utils.test.mjs`
- Modify: `tests/invoice-ui.test.ts`
- Modify: `tests/public-registry-ui.test.ts`
- Create: `tests/admin-workflow-context.test.ts`

- [ ] **Step 1: Add a narrow context model**

Persist context separately from customer-facing descriptions:

```ts
type ArtworkContext = {
  artworkId: string;
  artistArtworkRecordId?: string;
  keeperPieceId?: string;
};

type ArtifactSource = {
  kind: 'pricing_quote' | 'viewing' | 'verified_sale';
  id: string;
};
```

Add valid JSON context columns to pricing quotes, viewings, and invoices. Add source kind and source ID to invoices. Keep every field optional for legacy records.

- [ ] **Step 2: Give viewing pieces canonical catalog IDs**

Keep `ViewingPiece.id` for selection compatibility and add `artworkId`. Map Universal Language gate 1 to `UL-100`, gate 2 to `UL-101`, through gate 64 to `UL-163`. Store those IDs in the viewing’s persisted context.

- [ ] **Step 3: Replace the one-shot pricing handoff**

When a catalog artwork was selected, persist its `artworkId` on the saved quote. “Draft invoice” first persists the quote, then opens `/admin/invoices?mode=create&quote=<id>`. The invoice tool fetches that quote by ID and keeps the source after the invoice is saved. Session storage may remain only as a temporary fallback for unsaved legacy use, then be removed after migration verification.

- [ ] **Step 4: Carry viewing context into the draft invoice**

The viewing request copies exact selected artwork contexts and the viewing source ID into the invoice. It does not infer identity from title, image, code number, or line-item description.

- [ ] **Step 5: Preserve context through invoice edits and payment**

Invoice normalization and serialization retain the context and source while preventing it from appearing on the public invoice. Paying or marking the invoice paid does not write a verified sale or acquisition.

- [ ] **Step 6: Offer an explicit verification continuation**

A paid invoice with artwork context shows “Verify sale details.” It opens the existing verified-sales workspace with source context. Adrian confirms occurrence, buyer, exact artwork, and artwork-level price before any verified sale or price entry is appended.

- [ ] **Step 7: Verify old and new records**

Prove legacy rows with no context still open, multi-artwork viewings remain multi-artwork invoices, public responses contain no private context, and retries cannot duplicate links.

## Task 8: Make delivery states honest

**Files:**

- Modify: `components/viewing/viewingTypes.ts`
- Modify: `functions/api/admin/viewings.js`
- Modify: `components/AdminViewings.tsx`
- Modify: `components/invoices/invoiceTypes.ts`
- Modify: `functions/api/admin/invoices/[id]/send.js`
- Modify: `components/AdminInvoices.tsx`
- Modify: `tests/invoice-ui.test.ts`
- Modify: `tests/admin-studio-navigation.spec.ts`

- [ ] **Step 1: Add `ready` as a local preparation state**

`draft` means still being prepared. `ready` means the private link is ready to deliver. `sent` means Adrian explicitly recorded that delivery happened. Copying a link never sets `sent`.

- [ ] **Step 2: Separate actions in the UI**

Use distinct actions:

- Save draft
- Copy private link
- Record as sent

Do not label a copy action as email delivery.

- [ ] **Step 3: Preserve sent timestamps**

Set `sent_at` only on the explicit “Record as sent” transition. Retrying the same transition is idempotent.

- [ ] **Step 4: Verify queue behavior**

Draft and ready items remain actionable. Sent items leave the delivery queue but remain available in the artwork workspace and source history.

## Task 9: Build PieceExperience and replace the superseded collector shell

**Files:**

- Create: `functions/api/_lib/pieceExperience.js`
- Modify: `functions/api/registry/[publicCode].js`
- Create: `utils/pieceExperience.ts`
- Create: `components/collector/PieceExperience.tsx`
- Modify: `components/WorksPage.tsx`
- Retire after replacement: `components/collector/CollectorFlow.tsx`
- Retire after replacement: `components/legacy/KeeperPanel.tsx`
- Retire after replacement: `components/legacy/PieceConstellation.tsx`
- Retire after replacement: `components/legacy/ArrivalGate.tsx`
- Create: `tests/piece-experience.test.ts`
- Modify: `tests/public-registry-ui.spec.ts`
- Modify: `tests/steward-registration.spec.ts`

- [ ] **Step 1: Write the four-relationship projection tests**

Cover:

- unregistered piece;
- registered piece, signed out;
- registered piece, signed in as someone else;
- registered piece, signed in as current caretaker.

The response contains safe public rows and caretaker-only rows as defined by the master. It never exposes birth data, private buyer data, prices to a non-caretaker, ownership secrets, or private evidence.

- [ ] **Step 2: Build one body with a relationship-aware foot**

Replace the old Register-or-Dream fork. Rows open in place, links travel, and the code field follows the locked 16-character behavior. Copy every screen and row label from `collector-screen-wording.md`.

- [ ] **Step 3: Reuse existing writers**

Registration uses the existing claim and invitation paths. Certificate, public ledger, and current-caretaker price data use the existing projections. No collector component writes ownership state directly.

- [ ] **Step 4: Replace one surface at a time behind the existing flag**

Start with the piece page and relationship foot. Then replace code entry and registration. Do not begin garden, household, heirs, or passing until Task 10 settles their shared privacy and contribution model.

- [ ] **Step 5: Verify exact wording and behavior**

Run browser checks at 390px and desktop. Add source tests that reject the old Register-or-Dream fork, old “steward” wording, icon glyphs, badges, counts, and em dashes in the collector surface.

## Task 10: Reconcile privacy and contribution semantics before extending them

**Files:**

- Review: `migrations/028_collector_privacy.sql`
- Review: `migrations/029_collector_dreams.sql`
- Review: `migrations/030_collector_field.sql`
- Review: `migrations/031_collector_letters.sql`
- Create: `migrations/034_collector_visibility_reconciliation.sql`
- Modify: `functions/api/_lib/collectorPrivacy.js`
- Modify: `functions/api/_lib/collectorDreams.js`
- Modify: `functions/api/_lib/collectorField.js`
- Modify: `functions/api/_lib/collectorLetters.js`
- Modify: `utils/collectorPrivacy.ts`
- Modify: `utils/collectorDreams.ts`
- Modify: `utils/collectorField.ts`
- Modify: `utils/collectorLetters.ts`
- Modify: `tests/collector-privacy.test.ts`
- Modify: `tests/collector-dreams.test.ts`
- Modify: `tests/collector-field.test.ts`
- Modify: `tests/collector-letters.test.ts`

- [ ] **Step 1: Write a migration matrix from old semantics to the locked master**

Resolve the current default-closed rings, equal field brightness, one-dream assumptions, and combined privacy/birth onboarding against the August 10 rules. Preserve valid data, audit history, and consent withdrawals.

- [ ] **Step 2: Implement the three-tier per-item privacy model**

Visibility belongs to individual contributions and permitted facts, not one broad profile switch. Default behavior follows the locked “shining” state while retaining explicit private and visible-without-name choices.

- [ ] **Step 3: Keep birth private and separate from piece registration**

Birth remains in the shared profile and is optional. It never enters public lineage or the piece’s public projection.

- [ ] **Step 4: Build later screens only after the model is green**

Garden, household, collaborators, heirs, gift wishes, and ordinary passing become separate bounded plans after this migration. They reuse canonical accounts, `keeper_piece_id`, and governed transfer. Exceptional administrator reassignment remains visually separated from ordinary passing.

## Task 11: Final integrated verification and canary gate

**Files:**

- Modify: `tests/admin-studio-navigation.spec.ts`
- Modify: `tests/public-registry-ui.spec.ts`
- Modify: `tests/steward-registration.spec.ts`
- Modify: `docs/lineage-plate-runbook.md`
- Modify: `TODO.md`

- [ ] **Step 1: Run the complete local gate**

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
git diff --check
```

- [ ] **Step 2: Walk the connected studio journey**

Verify these exact continuations:

1. Catalog artwork to pricing quote to invoice to paid to explicit verified-sale review.
2. Private viewing to selected artworks to linked invoice to explicit verified-sale review.
3. Historical reconnection to identified artwork to optional registration to optional invitation.
4. Registered artwork to workspace to certificate, public preview, plate, recovery, and maintenance.
5. Collector scan to relationship-aware piece page to code or invitation to caretaker view.

- [ ] **Step 3: Rehearse recovery on a copy**

Run the registry damage detector, migrate a fresh copy, create an encrypted recovery export, and restore into a clean database. Verify the new context data, sales ledger, selected media, and visibility state restore without publishing private material.

- [ ] **Step 4: Run one marked canary**

Use one clearly marked test artwork. No real collector, real payment, live invitation, or physical plate is touched during the canary.

- [ ] **Step 5: Require Adrian’s visual and rollout approval**

Show the living piece page, the artwork workspace, the action queue, and the two connected sales continuations on mobile and desktop. Only after approval may the production rollout checklist proceed. Enabling `livingLegacy` remains a separate explicit action.

## Recommended execution split

Tasks 1 through 4 are serial because they freeze authority and establish the shared read model. After Task 4, three workstreams may proceed independently:

1. Admin workspace and action queue, Tasks 5 and 6.
2. Commerce handoffs and delivery truth, Tasks 7 and 8.
3. Collector piece replacement, Task 9.

Task 10 begins only after the piece projection contract is stable. Task 11 integrates all workstreams once, with one recovery rehearsal and one canary.
