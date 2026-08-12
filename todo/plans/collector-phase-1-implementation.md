# Collector Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development`
> (recommended) or `executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver artwork-first registration, invitations, editable certificate templates,
privacy choices, birth onboarding, and a non-destructive catalog registry seed.

**Architecture:** Four isolated backend lanes publish narrow, tested interfaces. A single
integration owner connects them into the collector flow after the ownership foundation is green.
Artwork identity remains independent of optional plate fabrication, and no public projection reads
private profile or consent storage directly.

**Tech Stack:** Vite, React 18, TypeScript, Cloudflare Pages Functions, D1 SQLite, R2 recovery,
Node test runner, Playwright.

---

## Reserved ownership

The ownership-foundation lane reserves migration `024`. Phase 1 reserves:

- `025` for artwork registration and catalog membership.
- `026` for artwork invitations.
- `027` for certificate templates.
- `028` for collector privacy.

Only the named lane may edit its migration. Only the integration owner may edit application routes,
the parent artwork page, launch flags, shared navigation, global styles, browser journey tests, and
the recovery archive table manifest.

### Task 1: Worktree browser baseline

**Files:**
- Modify: `vite.config.ts`
- Create: `tests/vite-worktree.test.ts`

- [x] **Step 1: Write the failing worktree-path test**

```ts
import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfigFromFile } from 'vite';

describe('Vite worktree filesystem access', () => {
  it('allows the real dependency directory when node_modules is a worktree symlink', async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const loaded = await loadConfigFromFile(
      { command: 'serve', mode: 'test' },
      path.join(root, 'vite.config.ts'),
      root,
    );
    assert.ok(loaded);

    const allow = loaded.config.server?.fs?.allow ?? [];
    assert.ok(allow.includes(realpathSync(path.join(root, 'node_modules'))));
  });
});
```

- [x] **Step 2: Run the test and observe the missing allowlist**

Run:

```bash
npx tsx --test tests/vite-worktree.test.ts
```

Expected: FAIL because `server.fs.allow` is absent.

- [x] **Step 3: Allow the worktree and resolved dependency roots**

Add `realpathSync` to the existing `fs` import and configure:

```ts
fs: {
  allow: [
    __dirname,
    realpathSync(path.resolve(__dirname, 'node_modules')),
  ],
},
```

- [x] **Step 4: Verify unit and browser baseline**

```bash
npx tsx --test tests/vite-worktree.test.ts
npm run test:e2e
```

Observed: the focused test passes and the browser suite has no font-resource 403 failures. A
separate administrator mobile-navigation test failed while its UI files were being edited by the
ownership lane, so that spec remains part of the ownership boundary rerun.

- [x] **Step 5: Commit the harness repair**

```bash
git add vite.config.ts tests/vite-worktree.test.ts
git commit -m "test(collector): support browser checks in worktrees"
```

### Task 2: Register artwork independently of plate fabrication

**Files:**
- Create: `migrations/025_artwork_registration.sql`
- Create: `functions/api/_lib/artworkRegistration.js`
- Create: `functions/api/_lib/keeperClaim.js`
- Create: `functions/api/_lib/identityBackup.js`
- Create: `functions/api/admin/registrations.js`
- Modify: `functions/api/_lib/plateBackup.js`
- Modify: `functions/api/_lib/recoveryQualification.js`
- Modify: `functions/api/_lib/registryPlateIssuance.js`
- Modify: `functions/api/admin/pieces/[id]/verify-recovery.js`
- Modify: `functions/api/admin/pieces/[id]/reveal.js`
- Modify: `functions/api/keeper/bind.js`
- Modify: `functions/api/registry/[publicCode].js`
- Modify: `functions/qr/[number].js`
- Modify: `utils/publicRegistry.ts`
- Create: `tests/artwork-registration.test.ts`
- Create: `tests/admin-artwork-registration.test.ts`
- Modify: `tests/living-legacy.test.ts`
- Modify: `tests/registry-artworks.test.ts`
- Modify: `tests/registry-maintenance.test.ts`
- Modify: `tests/registry-plate-lifecycle.test.ts`
- Modify: `tests/registry-recovery-qualification.test.ts`
- Modify: `tests/artwork-package-recovery.test.ts`
- Modify: `tests/public-registry-identity.test.ts`

The stable interface is:

```ts
registerArtwork(env, {
  artworkId,
  edition: { kind: 'unique' } | { kind: 'numbered'; number: number; size: number | null },
  authorization: { userId: string; email: string; registryUnlockExpiresAt: number },
  idempotencyKey,
  registeredAt,
}): Promise<{
  keeperPieceId: string;
  publicCode: string;
  ownershipCode?: string;
  codeAccess: 'created' | 'active-unlock-replay' | 'audited-reveal-required';
  registrationStatus: 'registered';
  backupStatus: string;
}>

prepareOptionalPlate(env, {
  keeperPieceId,
  idempotencyKey,
  authorization: { userId: string; email: string; registryUnlockExpiresAt: number },
  preparedAt?: string,
}): Promise<IssuedPlatePackage>

prepareFirstKeeperBind(env, {
  piece,
  claimant: { userId: string; verifiedEmail: string },
  proof: { kind: 'ownership_code' | 'invitation'; reference: string },
  evidence: { ipAddress: string | null; userAgent: string | null },
  boundAt,
}): Promise<{ statements: D1PreparedStatement[]; result: object }>
```

- [x] **Step 1: Write a failing registration test**

Assert that registering one known catalog artwork returns a permanent public identity and a
one-time Ownership Code while every plate artifact, keeper, order, fulfillment, and shipment field
remains absent.

- [x] **Step 2: Run the focused test and observe that issuance requires plate generation**

```bash
npx tsx --test --experimental-test-module-mocks tests/artwork-registration.test.ts
```

Expected: FAIL because the digital-only registration interface does not exist.

- [x] **Step 3: Add the registered identity state and minimal registration module**

The migration must preserve every existing keeper row, dependent foreign key, index, trigger, and
uniqueness guarantee, then finish with a clean foreign-key check. It makes `registered` a valid
public identity state without requiring SVG hashes or plate timestamps. The permanent issuance key
becomes the registration key. A private maintenance event stores the registering administrator,
and optional plate preparation gets its own maintenance-event idempotency key. This reuses the
existing encrypted recovery boundary rather than creating another operation table. The module must
mint and encrypt the Ownership Code through the existing key-versioned implementation and return
plaintext only once.

- [x] **Step 4: Add idempotency tests and implementation**

Test exact replay for the same key and input, conflict for a reused key with changed identity, and
no identity row or lineage event when backup persistence fails. Persist the immutable,
content-addressed identity backup before the atomic D1 insert. A later D1 race may leave an
unreferenced identical backup object, never a partial registry identity. At rest, the Ownership
Code remains encrypted only. An exact retry may reveal the same code only to the same administrator
while the registry step-up is still active, and every replay reveal is audited. After step-up
expiry, replay returns the stored identity without plaintext and directs the administrator through
the existing audited reveal path.

- [x] **Step 5: Add public resolution tests and implementation**

Assert that public registry lookup and QR resolution accept a registered identity and reveal no
Ownership Code verifier, ciphertext, nonce, keeper identity, or backup reference.

- [x] **Step 6: Extract the canonical first-bind preparation**

Write a failing test proving an ownership code can bind a registered identity after its identity
backup is qualified, without plate activation. Identity qualification and physical-plate
qualification remain distinct, so identity proof can never activate a plate. Move the shared bind
statements behind `prepareFirstKeeperBind` and make the existing keeper endpoint consume it while
preserving the existing private request evidence.

- [x] **Step 7: Separate optional plate preparation**

Write a failing test proving plate preparation preserves the same keeper-piece identity, public
code, encrypted Ownership Code, and lineage head. Then adapt the existing plate issuance module to
add fabrication to the registered identity. The audited reveal route returns only the Ownership
Code for a registered identity, while generated and active plates retain exact SVG verification.

- [x] **Step 8: Verify the registration lane**

```bash
npx tsx --test --experimental-test-module-mocks \
  tests/artwork-registration.test.ts \
  tests/living-legacy.test.ts \
  tests/admin-plate-wizard.test.ts \
  tests/admin-registry-ui.test.ts \
  tests/registry-artworks.test.ts \
  tests/registry-commerce-neutral.test.ts \
  tests/registry-plate-lifecycle.test.ts \
  tests/registry-recovery-qualification.test.ts \
  tests/artwork-package-recovery.test.ts \
  tests/registry-recovery.test.ts \
  tests/public-registry-identity.test.ts
npm run typecheck
git diff --check
```

- [x] **Step 9: Commit the registration seam**

```bash
git add migrations/025_artwork_registration.sql functions/api/_lib/artworkRegistration.js \
  functions/api/_lib/keeperClaim.js functions/api/admin/registrations.js \
  functions/api/_lib/identityBackup.js functions/api/_lib/plateBackup.js \
  functions/api/_lib/recoveryQualification.js \
  functions/api/_lib/registryPlateIssuance.js functions/api/keeper/bind.js \
  functions/api/admin/pieces/[id]/verify-recovery.js \
  functions/api/admin/pieces/[id]/reveal.js \
  functions/api/registry/[publicCode].js functions/qr/[number].js utils/publicRegistry.ts \
  tests/artwork-registration.test.ts tests/admin-artwork-registration.test.ts \
  tests/admin-plate-wizard.test.ts \
  tests/admin-registry-ui.test.ts tests/registry-artworks.test.ts \
  tests/registry-commerce-neutral.test.ts tests/living-legacy.test.ts \
  tests/registry-maintenance.test.ts \
  tests/registry-plate-lifecycle.test.ts tests/registry-recovery-qualification.test.ts \
  tests/artwork-package-recovery.test.ts \
  tests/public-registry-identity.test.ts
git commit -m "feat(collector): register artwork before optional plates"
```

### Task 3: Seed catalog registry membership without minting identities

**Files:**
- Create: `functions/api/_lib/registryMembership.js`
- Create: `scripts/seed-registry-membership.ts`
- Create: `tests/registry-membership-seed.test.ts`

The stable interface is:

```ts
planCatalogMembership(env, catalog): Promise<{
  catalogCount: 173;
  inserts: Array<{ artworkId: string; series: string | null; category: string }>;
  unchanged: string[];
  conflicts: Array<{ artworkId: string; reason: string }>;
}>

applyCatalogMembership(env, plan): Promise<{
  inserted: number;
  unchanged: number;
  conflicts: number;
}>
```

Migration `025` also owns `registry_catalog_membership`. Each row contains an artwork ID, a
deterministic catalog digest, and the first seed time. It contains no edition claim, ownership code,
keeper, person data, or public identity. Task 2 creates the table and Task 3 is its only writer.

- [x] **Step 1: Write the failing dry-run test**

Assert an exact catalog count of 173, deterministic ordering, zero writes, and no generated public
codes or keeper-piece rows.

- [x] **Step 2: Implement deterministic membership planning**

Membership is artwork-level discoverability only. It records no edition claim and issues no
physical-instance identity.

- [x] **Step 3: Write replay and preservation tests**

Assert that apply is idempotent, preserves the existing live keeper identity and lineage, and
reports conflicts instead of overwriting divergent membership.

- [x] **Step 4: Implement apply behind an explicit write flag**

The command defaults to dry-run. A write requires `--write` and aborts when the plan contains a
conflict.

- [x] **Step 5: Verify and commit**

```bash
npx tsx --test tests/registry-membership-seed.test.ts
npm run typecheck
git diff --check
git add functions/api/_lib/registryMembership.js scripts/seed-registry-membership.ts \
  tests/registry-membership-seed.test.ts
git commit -m "feat(collector): plan registry membership from catalog"
```

Do not run the write mode against production in Phase 1 development.

### Task 4: Build intended-recipient invitation proof

**Files:**
- Create: `migrations/026_artwork_invitations.sql`
- Create: `functions/api/_lib/artworkInvitations.js`
- Create: `functions/api/admin/invitations.js`
- Create: `functions/api/invitations/[token].js`
- Create: `functions/api/invitations/redeem.js`
- Create: `utils/artworkInvitations.ts`
- Create: `components/collector/InvitationDoor.tsx`
- Create: `components/admin/ArtworkInvitations.tsx`
- Create: `tests/artwork-invitations.test.ts`
- Create: `tests/artwork-invitation-ui.test.ts`

The stable interfaces are:

```ts
createArtworkInvitation(env, {
  keeperPieceId,
  intendedRecipientEmail,
  createdBy,
  expiresAt,
  idempotencyKey,
}): Promise<{ invitationId: string; token: string }>

inspectArtworkInvitation(env, token): Promise<{
  invitationId: string;
  artwork: PublicArtworkSummary;
  status: 'available' | 'used' | 'expired' | 'revoked';
}>

redeemArtworkInvitation(env, {
  token,
  claimant: { userId: string; verifiedEmail: string },
  redeemedAt,
}): Promise<KeeperBindResult>
```

- [x] **Step 1: Write the failing token-storage test**

Assert that creation returns plaintext once and persistence contains only its SHA-256 hash.

- [x] **Step 2: Implement invitation creation and safe inspection**

Inspection may reveal the artwork and invitation status. It must not reveal recipient email, token
hash, creator identity, or audit history.

- [x] **Step 3: Write recipient, expiry, revoke, and reuse tests**

Wrong verified recipients must not consume the invitation. Used, expired, and revoked invitations
must never bind.

- [x] **Step 4: Implement atomic redemption through `prepareFirstKeeperBind`**

Invitation consumption and first bind execute in one database batch. The browser never submits an
artwork ID or edition as authority.

- [x] **Step 5: Add race and already-held tests**

Exactly one concurrent redemption succeeds. An already-held piece stays governed and the
invitation is not treated as a transfer.

- [x] **Step 6: Add privacy tests**

Lineage and public claim evidence contain only opaque proof references. Email and token material
remain outside permanent history.

- [x] **Step 7: Verify and commit**

```bash
npx tsx --test --experimental-test-module-mocks \
  tests/artwork-invitations.test.ts \
  tests/artwork-invitation-ui.test.ts \
  tests/customer-account-security.test.ts
npm run typecheck
git diff --check
git add migrations/026_artwork_invitations.sql functions/api/invitations/[token].js \
  functions/api/invitations/redeem.js \
  functions/api/admin/invitations.js functions/api/_lib/artworkInvitations.js \
  utils/artworkInvitations.ts components/collector/InvitationDoor.tsx \
  components/admin/ArtworkInvitations.tsx tests/artwork-invitations.test.ts \
  tests/artwork-invitation-ui.test.ts
git commit -m "feat(collector): add artwork invitation proof"
```

### Task 5: Build certificate templates and artwork overrides

**Files:**
- Create: `migrations/027_certificate_templates.sql`
- Create: `functions/api/_lib/certificateContent.js`
- Create: `functions/api/admin/certificate-templates.js`
- Create: `functions/api/admin/certificate-assignments.js`
- Create: `functions/api/admin/certificate-overrides.js`
- Create: `functions/api/certificates/[artworkId].js`
- Create: `utils/certificateContent.ts`
- Create: `components/admin/CertificateEditor.tsx`
- Create: `tests/certificate-content.test.ts`
- Create: `tests/certificate-admin-ui.test.ts`

The effective public type is:

```ts
type Override<T> =
  | { mode: 'inherit' }
  | { mode: 'override'; value: T }
  | { mode: 'suppress' };

type EffectiveCertificate = {
  materials?: string[];
  makers?: Array<{ name: string; role: string }>;
  origin?: string;
  techniques?: string[];
  yearWording?: string;
  editionWording?: string;
  certificateWording?: string;
  openingWording?: string;
};

resolveArtworkCertificate(env, artworkId): Promise<EffectiveCertificate>

resolveInstanceCertificate(env, {
  keeperPieceId,
}): Promise<EffectiveCertificate & {
  artworkId: string;
  edition: { kind: 'unique' } | { kind: 'numbered'; number: number; size: number | null };
  publicCode: string;
}>
```

- [x] **Step 1: Write the failing template-resolution tests**

Cover template inheritance, one-field override, explicit suppression, return to inheritance,
multiple makers with roles, and omission of missing values.

- [x] **Step 2: Implement the effective resolver as the single read seam**

`resolveArtworkCertificate` handles reusable facts and wording. `resolveInstanceCertificate`
composes those facts with the exact registered instance, edition, and public code. Public instance
routes resolve the keeper-piece ID server-side from the public code rather than accepting it as
browser authority.

Public output must not expose template IDs, version numbers, inheritance modes, editor history, or
suppressed values.

- [x] **Step 3: Write and implement bulk assignment tests**

Bulk assignment must update every selected artwork, preserve individual overrides, reject unknown
artwork IDs, and replay safely after an ambiguous response.

- [x] **Step 4: Write and implement optimistic override tests**

Stale versions conflict without partial writes. An override changes only its named field.

- [x] **Step 5: Build the admin editor against the tested contracts**

The editor supports template creation, artwork selection, bulk assignment, per-field inherit,
override, suppress, and an effective preview.

- [x] **Step 6: Verify and commit**

```bash
npx tsx --test --experimental-test-module-mocks \
  tests/certificate-content.test.ts \
  tests/certificate-admin-ui.test.ts \
  tests/registry-maintenance.test.ts \
  tests/public-registry-identity.test.ts
npm run typecheck
git diff --check
git add migrations/027_certificate_templates.sql functions/api/certificates/[artworkId].js \
  functions/api/admin/certificate-templates.js functions/api/admin/certificate-assignments.js \
  functions/api/admin/certificate-overrides.js functions/api/_lib/certificateContent.js \
  utils/certificateContent.ts components/admin/CertificateEditor.tsx \
  tests/certificate-content.test.ts tests/certificate-admin-ui.test.ts
git commit -m "feat(collector): add reusable certificate templates"
```

### Task 6: Build privacy rings and shared birth onboarding

**Files:**
- Create: `migrations/028_collector_privacy.sql`
- Create: `functions/api/_lib/collectorPrivacy.js`
- Create: `functions/api/_lib/collectorOnboarding.js`
- Create: `functions/api/collector/onboarding.js`
- Create: `functions/api/collector/privacy.js`
- Modify: `functions/api/profile/get.js`
- Modify: `functions/api/profile/put.js`
- Modify: `functions/api/profile/delete.js`
- Create: `utils/collectorPrivacy.ts`
- Create: `utils/collectorOnboarding.ts`
- Create: `lib/astrology/types.ts`
- Create: `lib/astrology/ephemeris.ts`
- Create: `lib/astrology/gates.ts`
- Create: `lib/astrology/places.ts`
- Create: `lib/astrology/profile.ts`
- Create: `components/collector/PrivacyAndBirth.tsx`
- Create: `tests/collector-privacy.test.ts`
- Create: `tests/collector-onboarding.test.ts`
- Create: `tests/hologenetic-profile.test.ts`

The storage split is fixed:

- person settings hold Ring 3 and the five Ring 4 switches;
- piece settings hold Ring 2 curated-city consent;
- append-only consent history records safe before and after decisions and policy version;
- Ring 1 is an invariant and has no stored switch.

- [x] **Step 1: Write shared-profile onboarding tests**

Missing profiles return `missing`. Existing shared profiles return current inputs rather than blank
fields. Skip performs no write and never blocks completion.

- [x] **Step 2: Implement the onboarding reader and birth adapter**

Port the pure astrology modules from the verified Mandala implementation into `lib/astrology/`.
The parity test uses the official chart fixture for 15 January 1982 at 23:39 in Santa Cruz and must
produce these exact gate and line values: life's work 61.6, evolution 62.6, radiance 50.2, purpose
3.2, attraction 33.6, IQ 41.3, EQ 48.4, SQ 5.3, core 59.1, culture 32.2, and pearl 44.1. Also test
timezone conversion across daylight-saving and date-boundary cases. Birth saving calls this local
verified adapter and persists through the existing shared profile writer. It must never create a
second birth-profile store or save fake computed data.

- [x] **Step 3: Write privacy-default tests**

All optional switches default off. Ring 1 cannot be submitted or disabled. Ring 2 rejects free
text and accepts only curated city IDs that meet the population rule.

- [x] **Step 4: Implement current privacy state and append-only history**

Every change writes current state and a timestamped policy-version record atomically. This lane
publishes and tests `projectPublicCollectorVisibility`; Phase 2's Atlas integration must consume
that interface. Revocation must disappear immediately from the safe projection.

- [x] **Step 5: Write independence and minor-protection tests**

City and identity require separate explicit choices. Content by or about a minor cannot be made
public. Birth input must not appear in consent history, invitation records, public output, or
lineage.

- [x] **Step 6: Build the combined privacy and birth step**

The UI explains the four rings, keeps optional choices off, shows existing birth details as already
present, and offers enter, update, or skip without a login-loop or blank re-entry.

- [x] **Step 7: Verify and commit**

```bash
npx tsx --test --experimental-test-module-mocks \
  tests/collector-privacy.test.ts \
  tests/collector-onboarding.test.ts \
  tests/hologenetic-profile.test.ts \
  tests/account-auth.test.ts \
  tests/customer-account-security.test.ts \
  tests/collector-phase-zero.test.ts
npm run typecheck
git diff --check
git add migrations/028_collector_privacy.sql functions/api/collector/onboarding.js \
  functions/api/collector/privacy.js \
  functions/api/_lib/collectorPrivacy.js functions/api/_lib/collectorOnboarding.js \
  functions/api/profile/get.js functions/api/profile/put.js functions/api/profile/delete.js \
  utils/collectorPrivacy.ts utils/collectorOnboarding.ts lib/astrology/types.ts \
  lib/astrology/ephemeris.ts lib/astrology/gates.ts lib/astrology/places.ts \
  lib/astrology/profile.ts \
  components/collector/PrivacyAndBirth.tsx tests/collector-privacy.test.ts \
  tests/collector-onboarding.test.ts tests/hologenetic-profile.test.ts
git commit -m "feat(collector): add privacy and birth onboarding"
```

### Task 7: Integrate the walkable collector flow

**Files:**
- Modify: `App.tsx`
- Modify: `components/WorksPage.tsx`
- Modify: `components/legacy/ArrivalGate.tsx`
- Modify: `components/legacy/KeeperPanel.tsx`
- Create: `components/collector/CollectorFlow.tsx`
- Create: `components/collector/OpeningScreen.tsx`
- Create: `components/collector/ArrivalScreen.tsx`
- Create: `components/collector/CertificateScreen.tsx`
- Modify: `components/admin/AdminNavigation.ts`
- Modify: `launchFlags.ts`
- Modify: `src/index.css`
- Modify: `utils/registryRecoveryArchive.ts`
- Modify: `functions/api/_lib/registryRecoveryExport.js`
- Modify: `tests/registry-recovery.test.ts`
- Modify: `tests/public-registry-ui.spec.ts`
- Modify: `tests/steward-registration.spec.ts`
- Modify: `tests/admin-studio-navigation.spec.ts`

- [x] **Step 1: Write the failing browser walk**

Cover public arrival, neutral register and dream doors, opening promise, code or invitation proof,
privacy, existing or skipped birth details, certificate, and completion. Assert keyboard access,
mobile layout, reduced motion, and no private data in requests or page text.

- [x] **Step 2: Build the collector state machine against lane fixtures**

The flow owns navigation only. It calls the registration, invitation, certificate, privacy, and
onboarding contracts without duplicating their validation.

- [x] **Step 3: Merge arrival and certificate projections**

Public arrival must remain complete without sign-in. Remove the timed inert gate. Render only
effective recorded facts, the exact issued identity, and public history.

- [x] **Step 4: Add opening and invitation screens**

Opening wording comes from the effective certificate contract. Default wording promises a durable,
exportable record and optional attached video, never permanent hosting.

- [x] **Step 5: Connect privacy and birth onboarding**

Existing birth details are recognized. Skipping remains possible. Consent choices stay off until
the person acts.

- [x] **Step 6: Connect admin surfaces**

Add registration, invitations, and certificate editing to the existing authenticated admin shell.
Plate fabrication remains a later optional action.

- [x] **Step 7: Extend encrypted recovery for every new table**

Advance the encrypted archive schema from 3 to 4 exactly once after all Phase 1 migrations merge.
Add catalog membership, invitations, certificate templates and assignments, artwork overrides,
current consent, consent history, and identity recovery qualifications to the exact table and
column manifest. Referenced-account
discovery includes invitation creators and redeemers plus consent authors, while unrelated accounts
remain excluded. Registration and plate-preparation audits already travel through the existing
private maintenance-event recovery boundary and must remain covered by its regression tests.
Add export, decrypt, clean restore, row-count, digest, and dependency-closure assertions for every
new table. Every older supported archive version upgrades with empty new tables and the same
verified legacy rows.

- [x] **Step 8: Run the Phase 1 gate**

```bash
npm run test:unit
npm run test:e2e
npm run typecheck
npm run build
git diff --check
```

Expected: all commands exit 0. Existing keeper identity and lineage fixtures remain unchanged.

The pre-acceptance gate passed before the final UI review. Acceptance gaps were then repaired:
the certificate now renders only the endpoint's exact server-resolved instance identity and fails
closed on mismatches, every Universal Language image on the record uses the required alt text, the
collector typography follows the site's readability guardrails, and invariant opening copy now
protects Ownership Code access independently of editable wording. Invitation proof also freezes its
memory-only token during irreversible redemption so an in-flight edit cannot discard a successful
single-use result. The final stable snapshot passes 540 unit tests, 84 browser tests with 10
intentional skips, typecheck, and the production build.

- [x] **Step 9: Perform recovery and canary checks**

Generate an encrypted registry export, restore it into a clean local database, and walk one clearly
marked non-production artwork through both ownership-code and invitation registration. Do not run
catalog seed write mode or issue a production identity.

- [x] **Step 10: Commit integration and update the standing progress record**

The standing record is updated and this integration commit closes the local Phase 1 boundary. No
deployment, production seed, or launch-flag enable is part of this step.

```bash
git add App.tsx components/WorksPage.tsx components/legacy/ArrivalGate.tsx \
  components/legacy/KeeperPanel.tsx components/collector/CollectorFlow.tsx \
  components/collector/OpeningScreen.tsx components/collector/ArrivalScreen.tsx \
  components/collector/CertificateScreen.tsx components/admin/AdminNavigation.ts \
  launchFlags.ts src/index.css functions/api/_lib/registryRecoveryExport.js \
  utils/registryRecoveryArchive.ts tests/registry-recovery.test.ts \
  tests/public-registry-ui.spec.ts tests/steward-registration.spec.ts \
  tests/admin-studio-navigation.spec.ts \
  todo/plans/the-collector-execution.md TODO.md
git commit -m "feat(collector): make artwork registration walkable"
```

## Parallel dispatch order

1. Complete Task 1 and the separate ownership-foundation plan.
2. Run Task 2 alone because it publishes the identity and first-bind interfaces.
3. Dispatch Tasks 4, 5, and 6 concurrently in isolated worktrees. Task 3 may run with them if a
   fourth worker is available and no worker needs the integration files.
4. Review each lane for spec compliance, then code quality.
5. Merge Task 2 first, then Tasks 3 through 6.
6. Run Task 7 with one integration owner.

No agent may solve an interface gap by editing another lane's files.
