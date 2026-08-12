# Artist-Verified Sales and Collector Reconnection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private artist-controlled workspace that preserves uncertain and verified historical sales, resolves one or many artworks later, stores permanent creator messages and authenticity pictures, reveals those public artifacts only after claim, and gives the current keeper a private complete price history.

**Architecture:** Introduce a commerce-neutral private artwork record that can exist before catalog identification, registration, or ownership. Verified sales, price entries, media, and append-only ledger entries attach to that record. Existing registration, invitation, claim, and transfer modules remain the only authorities for those state transitions; the new module links to them explicitly and projects public or current-keeper views from live registry state.

**Tech Stack:** Cloudflare Pages Functions, D1 SQLite migrations and triggers, R2 content-addressed media, Better Auth and registry step-up, React 18, TypeScript, Vite, Node test runner with real SQLite, Playwright.

---

## File map and execution graph

Create focused modules instead of extending the already large registration and certificate modules:

- `migrations/032_artist_verified_sales.sql`: private records, reconnection cases, sales, correction events, sale items, media, ledger entries, price entries, and append-only guards.
- `functions/api/_lib/artistSales.js`: validation, exact idempotency, atomic sale and reconnection writes, resolution, identity linking, and read projections.
- `functions/api/_lib/artworkLedgerMedia.js`: immutable content-addressed R2 storage and verification.
- `functions/api/admin/collector-sales.js`: list and create reconnection cases and sales.
- `functions/api/admin/collector-sales/[id].js`: detail, append correction, add artwork, resolve artwork, and link registered identity.
- `functions/api/admin/collector-ledger.js`: append message, select an image, and list the private ledger.
- `functions/api/admin/collector-ledger/media.js`: authenticated media upload.
- `functions/api/artwork-ledger/media/[id].js`: claimed-artwork public certificate image delivery.
- `functions/api/keeper/certificate-ledger.js`: current-keeper private historical price ledger.
- `utils/artistSales.ts`: strict admin request and response contracts with frozen retry attempts.
- `utils/artworkLedger.ts`: strict public and private ledger projectors.
- `components/admin/CollectorSales.tsx`: reconnection, verified-sale, artwork, ledger, registration, and invitation workspace.
- `components/collector/CertificateLedger.tsx`: public creator entries and signed-in price history.
- `tests/artist-sales.test.ts`: migration, core behavior, privacy, replay, races, and recovery seams.
- `tests/artist-sales-admin.test.ts`: route and client contracts.
- `tests/artist-sales-ui.test.ts`: component source and rendering contracts.
- `tests/artist-sales.spec.ts`: real desktop and mobile administrator and collector journeys.

Task 1 is the foundation. Tasks 2 and 3 can proceed in parallel after Task 1. Task 4 depends on Tasks 2 and 3. Tasks 5 and 6 can then proceed in parallel. Task 7 depends on the frozen schema. Task 8 is the integrated acceptance gate.

## Task 1: Permanent private artwork and sale schema

**Files:**
- Create: `migrations/032_artist_verified_sales.sql`
- Create: `tests/artist-sales.test.ts`

- [ ] **Step 1: Write the failing migration contract**

Create `tests/artist-sales.test.ts` with a real SQLite fixture that applies migrations through 032. Assert exact columns and foreign keys for:

~~~ts
const EXPECTED_TABLES = [
  'artist_reconnection_cases',
  'artist_reconnection_events',
  'artist_artwork_records',
  'artist_artwork_record_events',
  'artist_verified_sales',
  'artist_verified_sale_events',
  'artist_verified_sale_items',
  'artist_artwork_media',
  'artist_artwork_ledger_entries',
  'artist_artwork_price_entries',
];

for (const table of EXPECTED_TABLES) {
  assert.equal(tableExists(database, table), true, `${table} must exist`);
}
~~~

Add failing behavior tests for one sale with three artwork records, an unresolved record with no catalog or keeper identity, exact/month/year/unknown occurrence precision, optional prices, and append-only event, ledger, media, and price tables.

- [ ] **Step 2: Run the migration test and verify RED**

Run:

~~~bash
npx tsx --test --experimental-test-module-mocks tests/artist-sales.test.ts
~~~

Expected: FAIL because migration 032 and all ten tables are absent.

- [ ] **Step 3: Add the schema with structural privacy and permanence**

Create `migrations/032_artist_verified_sales.sql`. Use these stable identities and constraints:

~~~sql
CREATE TABLE artist_reconnection_cases (
  id TEXT PRIMARY KEY,
  recipient_email TEXT NOT NULL CHECK (recipient_email = lower(trim(recipient_email))),
  recipient_name TEXT,
  private_context TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'partially_resolved', 'resolved', 'closed')),
  created_by_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_digest TEXT NOT NULL CHECK (length(request_digest) = 64),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE artist_verified_sales (
  id TEXT PRIMARY KEY,
  reconnection_case_id TEXT REFERENCES artist_reconnection_cases(id) ON DELETE RESTRICT,
  occurrence_precision TEXT NOT NULL CHECK (occurrence_precision IN ('exact', 'month', 'year', 'unknown')),
  occurred_on TEXT,
  buyer_email TEXT CHECK (buyer_email IS NULL OR buyer_email = lower(trim(buyer_email))),
  currency TEXT CHECK (currency IS NULL OR currency GLOB '[A-Z][A-Z][A-Z]'),
  total_minor INTEGER CHECK (total_minor IS NULL OR total_minor >= 0),
  private_reference TEXT,
  private_notes TEXT,
  verified_by_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_digest TEXT NOT NULL CHECK (length(request_digest) = 64),
  recorded_at TEXT NOT NULL,
  CHECK ((total_minor IS NULL AND currency IS NULL) OR (total_minor IS NOT NULL AND currency IS NOT NULL)),
  CHECK (
    (occurrence_precision = 'exact' AND occurred_on GLOB '????-??-??' AND date(occurred_on) = occurred_on)
    OR (occurrence_precision = 'month' AND occurred_on GLOB '????-??')
    OR (occurrence_precision = 'year' AND occurred_on GLOB '????')
    OR (occurrence_precision = 'unknown' AND occurred_on IS NULL)
  )
);

CREATE TABLE artist_verified_sale_events (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES artist_verified_sales(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  event_type TEXT NOT NULL CHECK (event_type IN ('corrected', 'shared_message_appended')),
  before_json TEXT NOT NULL CHECK (json_valid(before_json)),
  after_json TEXT NOT NULL CHECK (json_valid(after_json)),
  actor_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_digest TEXT NOT NULL CHECK (length(request_digest) = 64),
  created_at TEXT NOT NULL,
  UNIQUE (sale_id, sequence)
);
~~~

Define private artwork identity and exact-application events:

~~~sql
CREATE TABLE artist_artwork_records (
  id TEXT PRIMARY KEY,
  artwork_id TEXT,
  edition_json TEXT CHECK (edition_json IS NULL OR json_valid(edition_json)),
  keeper_piece_id TEXT UNIQUE REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  identification_status TEXT NOT NULL
    CHECK (identification_status IN ('unresolved', 'identified', 'identity_linked')),
  record_version INTEGER NOT NULL DEFAULT 1 CHECK (record_version >= 1),
  last_event_id TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (identification_status = 'unresolved' AND artwork_id IS NULL AND edition_json IS NULL AND keeper_piece_id IS NULL)
    OR (identification_status = 'identified' AND artwork_id IS NOT NULL AND edition_json IS NOT NULL AND keeper_piece_id IS NULL)
    OR (identification_status = 'identity_linked' AND artwork_id IS NOT NULL AND edition_json IS NOT NULL AND keeper_piece_id IS NOT NULL)
  ),
  FOREIGN KEY (last_event_id) REFERENCES artist_artwork_record_events(id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE artist_artwork_record_events (
  id TEXT PRIMARY KEY,
  artwork_record_id TEXT NOT NULL REFERENCES artist_artwork_records(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('identified', 'identification_corrected', 'identity_linked')),
  before_json TEXT NOT NULL CHECK (json_valid(before_json)),
  after_json TEXT NOT NULL CHECK (json_valid(after_json)),
  resulting_version INTEGER NOT NULL CHECK (resulting_version >= 2),
  actor_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_digest TEXT NOT NULL CHECK (length(request_digest) = 64),
  created_at TEXT NOT NULL,
  UNIQUE (artwork_record_id, resulting_version)
);
~~~

Define reconnection progress and price-bearing sale lines:

~~~sql
CREATE TABLE artist_reconnection_events (
  id TEXT PRIMARY KEY,
  reconnection_case_id TEXT NOT NULL REFERENCES artist_reconnection_cases(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('note_added', 'email_sent', 'artwork_added', 'status_changed')),
  private_note TEXT,
  artwork_record_id TEXT REFERENCES artist_artwork_records(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_digest TEXT NOT NULL CHECK (length(request_digest) = 64),
  created_at TEXT NOT NULL
);

CREATE TABLE artist_verified_sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES artist_verified_sales(id) ON DELETE RESTRICT,
  artwork_record_id TEXT NOT NULL REFERENCES artist_artwork_records(id) ON DELETE RESTRICT,
  amount_minor INTEGER CHECK (amount_minor IS NULL OR amount_minor >= 0),
  currency TEXT CHECK (currency IS NULL OR currency GLOB '[A-Z][A-Z][A-Z]'),
  created_at TEXT NOT NULL,
  UNIQUE (sale_id, artwork_record_id),
  CHECK ((amount_minor IS NULL AND currency IS NULL) OR (amount_minor IS NOT NULL AND currency IS NOT NULL))
);

CREATE TABLE artist_artwork_price_entries (
  id TEXT PRIMARY KEY,
  artwork_record_id TEXT NOT NULL REFERENCES artist_artwork_records(id) ON DELETE RESTRICT,
  sale_item_id TEXT NOT NULL UNIQUE REFERENCES artist_verified_sale_items(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
  occurred_on TEXT,
  occurrence_precision TEXT NOT NULL CHECK (occurrence_precision IN ('exact', 'month', 'year', 'unknown')),
  recorded_at TEXT NOT NULL
);
~~~

Define immutable media and public-ledger candidates exactly:

~~~sql
CREATE TABLE artist_artwork_media (
  id TEXT PRIMARY KEY,
  artwork_record_id TEXT NOT NULL REFERENCES artist_artwork_records(id) ON DELETE RESTRICT,
  media_role TEXT NOT NULL CHECK (media_role IN ('identification_evidence', 'certificate_image')),
  storage_reference TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL CHECK (sha256 GLOB '[0-9a-f]*' AND length(sha256) = 64),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_length INTEGER NOT NULL CHECK (byte_length BETWEEN 1 AND 15728640),
  uploaded_by_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);

CREATE TABLE artist_artwork_ledger_entries (
  id TEXT PRIMARY KEY,
  artwork_record_id TEXT NOT NULL REFERENCES artist_artwork_records(id) ON DELETE RESTRICT,
  sale_id TEXT REFERENCES artist_verified_sales(id) ON DELETE RESTRICT,
  message TEXT,
  media_id TEXT REFERENCES artist_artwork_media(id) ON DELETE RESTRICT,
  created_by_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_digest TEXT NOT NULL CHECK (length(request_digest) = 64),
  created_at TEXT NOT NULL,
  CHECK (message IS NOT NULL OR media_id IS NOT NULL)
);
~~~

Add typed `artist_reconnection_events` and `artist_artwork_record_events` tables with actor, idempotency key, request digest, before and after snapshots, and creation time. Make cases, base sales, event, ledger, media, sale-item, and price tables reject UPDATE and DELETE. Sale corrections are complete replacement snapshots in `artist_verified_sale_events`; reads overlay the latest valid correction without mutating the base sale. Add a guarded artwork-record update trigger that accepts only an already-inserted matching record event, changes only identification fields, increments exactly one version, and sets `last_event_id`.

- [ ] **Step 4: Add adversarial schema tests**

Test raw SQL attempts to put private fields in `artwork_lineage_events`, update or delete old ledger rows, link one keeper identity to two private artwork records, write malformed date precision, write total without currency, mutate an artwork record without an event, and partially insert a three-artwork sale. Each attack must abort and leave every table unchanged.

- [ ] **Step 5: Run focused GREEN**

~~~bash
npx tsx --test --experimental-test-module-mocks tests/artist-sales.test.ts
~~~

Expected: all Task 1 tests PASS and `PRAGMA foreign_key_check` returns no rows.

- [ ] **Step 6: Commit the schema**

~~~bash
git add migrations/032_artist_verified_sales.sql tests/artist-sales.test.ts
git commit -m "feat(collector): add permanent private artwork sale records"
~~~

## Task 2: Exact sale, reconnection, and identification core

**Files:**
- Create: `functions/api/_lib/artistSales.js`
- Modify: `tests/artist-sales.test.ts`

- [ ] **Step 1: Write RED service contracts**

Import these missing exports before creating the module:

~~~js
createReconnectionCase(env, input)
createVerifiedSale(env, input)
appendReconnectionEvent(env, input)
identifyArtworkRecord(env, input)
linkArtworkIdentity(env, input)
appendArtworkLedgerEntry(env, input)
appendSharedSaleMessage(env, input)
correctVerifiedSale(env, input)
listArtistSaleWorkspace(env, filters)
getArtistSaleDetail(env, saleId)
~~~

Use this exact multi-artwork input:

~~~ts
const input = {
  occurrence: { precision: 'year', value: '2018' },
  buyerEmail: 'collector@example.com',
  total: { amountMinor: 900000, currency: 'USD' },
  privateReference: 'studio-ledger-2018-4',
  privateNotes: null,
  reconnectionCaseId: null,
  artworks: [
    { artworkRecordId: null, artworkId: 'UL-001', edition: { kind: 'unique' }, price: { amountMinor: 300000, currency: 'USD' } },
    { artworkRecordId: null, artworkId: 'UL-002', edition: { kind: 'unique' }, price: { amountMinor: 250000, currency: 'USD' } },
    { artworkRecordId: null, artworkId: null, edition: null, price: null },
  ],
  idempotencyKey: 'sale-create-2018-4',
  administrator: { userId: 'admin-1', email: 'artist@example.com' },
  recordedAt: '2026-08-10T01:00:00.000Z',
};
~~~

Assert exact replay returns the same IDs, changed replay returns `idempotency_conflict`, and all three sale items commit or roll back together.

- [ ] **Step 2: Run service RED**

~~~bash
npx tsx --test --experimental-test-module-mocks tests/artist-sales.test.ts
~~~

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `artistSales.js`.

- [ ] **Step 3: Implement strict normalization and request digests**

Create `functions/api/_lib/artistSales.js` with exact-key validation and these helpers:

~~~js
function codedError(code) {
  return Object.assign(new Error(code), { code });
}

async function digestRequest(value) {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeMoney(value, optional = true) {
  if (value == null && optional) return null;
  if (!value || !Number.isSafeInteger(value.amountMinor) || value.amountMinor < 0
      || !/^[A-Z]{3}$/.test(value.currency)) throw codedError('invalid_money');
  return { amountMinor: value.amountMinor, currency: value.currency };
}
~~~

Normalize emails, bound every private text field, require canonical Gregorian exact dates, accept unresolved artwork entries, and call `resolveArtwork` for identified catalog works. Use one `DB.batch` for the sale header, new artwork records, sale items, price entries, and creation events. Query the stored request digest before replay return.

- [ ] **Step 4: Implement event-gated identification and identity linking**

`identifyArtworkRecord` inserts the exact event first and lets the schema trigger apply only artwork ID and edition. `linkArtworkIdentity` requires the target keeper row's piece ID and edition number to match the identified record exactly, then inserts an `identity_linked` event whose trigger sets the keeper ID once. Neither function registers, invites, claims, or transfers an artwork.

`correctVerifiedSale` appends the complete corrected snapshot, reason, expected event sequence, and request digest to `artist_verified_sale_events`; it never updates the base sale. `appendSharedSaleMessage` validates that every target artwork belongs to the sale and inserts one ledger row per artwork plus one replay event in a single batch. It derives stable child keys from the parent idempotency key and artwork-record ID.

Return:

~~~js
{ artworkRecordId, identificationStatus, artworkId, edition, keeperPieceId, recordVersion }
~~~

- [ ] **Step 5: Add replay, race, and privacy tests**

Cover exact replay before and after a lost response, changed-body conflict, two admins racing to identify one record, mismatched registered edition, unknown catalog work, missing keeper, private email and notes absent from public lineage, and a record that remains unresolved indefinitely.

- [ ] **Step 6: Run focused GREEN and commit**

~~~bash
npx tsx --test --experimental-test-module-mocks tests/artist-sales.test.ts
git add functions/api/_lib/artistSales.js tests/artist-sales.test.ts
git commit -m "feat(collector): add artist-verified sale workflow"
~~~

## Task 3: Immutable authenticity media

**Files:**
- Create: `functions/api/_lib/artworkLedgerMedia.js`
- Modify: `tests/artist-sales.test.ts`

- [ ] **Step 1: Write media RED tests**

Test JPEG, PNG, and WebP uploads; unsupported MIME; empty and over-15 MB files; content-addressed replay; existing-object mismatch; R2 write failure; read-back mismatch; and a successful R2 write followed by failed D1 insertion that leaves one safe orphan object.

- [ ] **Step 2: Run RED**

~~~bash
npx tsx --test --experimental-test-module-mocks --test-name-pattern "authenticity media" tests/artist-sales.test.ts
~~~

Expected: FAIL because `artworkLedgerMedia.js` is absent.

- [ ] **Step 3: Implement verified content-addressed storage**

Create `functions/api/_lib/artworkLedgerMedia.js`:

~~~js
export async function storeArtworkLedgerMedia(bucket, { artworkRecordId, bytes, contentType }) {
  const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    throw codedError('unsupported_media_type');
  }
  if (body.byteLength < 1 || body.byteLength > 15 * 1024 * 1024) {
    throw codedError('invalid_media_size');
  }
  const sha256 = await sha256Hex(body);
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[contentType];
  const reference = `artwork-ledger/${artworkRecordId}/${sha256}.${extension}`;
  await bucket.put(reference, body, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType },
  });
  const stored = await bucket.get(reference);
  if (!stored || !bytesEqual(body, new Uint8Array(await stored.arrayBuffer()))) {
    throw codedError('media_backup_failed');
  }
  return { reference, sha256, contentType, byteLength: body.byteLength };
}
~~~

Handle an existing immutable object by reading and verifying its exact bytes. Never transform or re-encode collector evidence.

- [ ] **Step 4: Run media GREEN and commit**

~~~bash
npx tsx --test --experimental-test-module-mocks --test-name-pattern "authenticity media" tests/artist-sales.test.ts
git add functions/api/_lib/artworkLedgerMedia.js tests/artist-sales.test.ts
git commit -m "feat(collector): preserve authenticity pictures"
~~~

## Task 4: Authenticated admin APIs and strict client contracts

**Files:**
- Create: `functions/api/admin/collector-sales.js`
- Create: `functions/api/admin/collector-sales/[id].js`
- Create: `functions/api/admin/collector-ledger.js`
- Create: `functions/api/admin/collector-ledger/media.js`
- Create: `utils/artistSales.ts`
- Create: `tests/artist-sales-admin.test.ts`

- [ ] **Step 1: Write route and client RED tests**

Require central admin, exact same origin, active registry unlock, DB, and `ARTWORK_REGISTRY_BACKUP`. Assert private `no-store` responses, exact request keys, normalized idempotency keys, body limits, one-time upload attempts, and stable 400, 404, 409, and 503 errors.

Freeze these route actions:

~~~ts
type SaleCollectionAction =
  | { action: 'createReconnection'; recipientEmail: string; recipientName: string | null; privateContext: string | null; idempotencyKey: string }
  | { action: 'createSale'; occurrence: SaleOccurrence; buyerEmail: string | null; total: Money | null; privateReference: string | null; privateNotes: string | null; reconnectionCaseId: string | null; artworks: SaleArtworkInput[]; idempotencyKey: string };

type SaleDetailAction =
  | { action: 'addReconnectionNote'; note: string; idempotencyKey: string }
  | { action: 'correctSale'; expectedVersion: number; occurrence: SaleOccurrence; buyerEmail: string | null; total: Money | null; privateReference: string | null; privateNotes: string | null; reason: string; idempotencyKey: string }
  | { action: 'identifyArtwork'; artworkRecordId: string; artworkId: string; edition: Edition; expectedVersion: number; idempotencyKey: string }
  | { action: 'linkIdentity'; artworkRecordId: string; keeperPieceId: string; expectedVersion: number; idempotencyKey: string };

type LedgerAction =
  | { action: 'append'; artworkRecordId: string; saleId: string | null; message: string | null; mediaId: string | null; idempotencyKey: string }
  | { action: 'appendSharedSaleMessage'; saleId: string; artworkRecordIds: string[]; message: string; idempotencyKey: string }
  | { action: 'selectCertificateImage'; artworkRecordId: string; mediaId: string; idempotencyKey: string };
~~~

- [ ] **Step 2: Run RED**

~~~bash
npx tsx --test --experimental-test-module-mocks tests/artist-sales-admin.test.ts
~~~

Expected: FAIL because routes and `utils/artistSales.ts` do not exist.

- [ ] **Step 3: Implement the admin boundaries**

Use `requireRegistryUnlock`, `requireDb`, and server-derived administrator identity and timestamps. The client never submits actor, recorded time, storage reference, digest, price visibility, claim state, or public state.

The media route accepts `multipart/form-data` with exact fields `artworkRecordId`, `role`, and `file`. It verifies R2 before inserting immutable media metadata. Return media ID and role, never the private storage reference.

- [ ] **Step 4: Implement frozen retry attempts**

In `utils/artistSales.ts`:

~~~ts
export type FrozenArtistSaleAttempt<T> = {
  idempotencyKey: string;
  request: T & { idempotencyKey: string };
};

export function beginArtistSaleAttempt<T extends object>(
  current: FrozenArtistSaleAttempt<T> | null,
  input: T,
): FrozenArtistSaleAttempt<T> {
  if (current) return current;
  const idempotencyKey = crypto.randomUUID();
  return { idempotencyKey, request: { ...input, idempotencyKey } };
}
~~~

Clear attempts only after definitive success or a 4xx rejection. Preserve exact body and key after timeout, network failure, or ambiguous 5xx.

- [ ] **Step 5: Run route GREEN and commit**

~~~bash
npx tsx --test --experimental-test-module-mocks tests/artist-sales-admin.test.ts tests/admin-auth.test.ts tests/privileged-endpoints.test.ts
git add functions/api/admin/collector-sales.js 'functions/api/admin/collector-sales/[id].js' functions/api/admin/collector-ledger.js functions/api/admin/collector-ledger/media.js utils/artistSales.ts tests/artist-sales-admin.test.ts
git commit -m "feat(collector): add private verified-sales API"
~~~

## Task 5: Administrator reconnection and sale workspace

**Files:**
- Create: `components/admin/CollectorSales.tsx`
- Modify: `components/admin/AdminNavigation.ts`
- Modify: `App.tsx`
- Create: `tests/artist-sales-ui.test.ts`
- Create: `tests/artist-sales.spec.ts`

- [ ] **Step 1: Write UI RED tests**

Cover reconnection filters, email-only reconnection, historical sale precision, several artwork rows, unknown artwork without forced catalog selection, Save and add another, visibly private prices and notes, evidence and preferred-image roles, explicit registration, explicit invitation, and ledger additions available later. Assert there is no inbox thread, automated reminder, or public-price control.

Also cover one shared message applied atomically to every artwork in a sale, a later artwork-specific message, and a sale correction that preserves the original base facts plus its correction reason.

- [ ] **Step 2: Run UI RED**

~~~bash
npx tsx --test tests/artist-sales-ui.test.ts
npx playwright test tests/artist-sales.spec.ts --project=chromium --reporter=list
~~~

Expected: FAIL because route and component do not exist.

- [ ] **Step 3: Implement the workspace**

Create `CollectorSales.tsx` with existing admin primitives. Keep buyer email, price, notes, and evidence out of the URL. Use native file input and date-precision controls. Add:

~~~ts
{ label: 'Verified sales', href: '/admin/collector-sales' }
~~~

~~~tsx
<Route path="collector-sales" element={<CollectorSales />} />
~~~

For registration, call the existing `/api/admin/registrations` contract and keep the Ownership Code memory-only until dismissal. Then call the identity-link action. For invitation, call the existing artwork-specific invitation contract and keep its token memory-only.

- [ ] **Step 4: Add desktop and mobile journeys**

Cover:

1. Create a reconnection with only email.
2. Record a 2018 sale with three artworks, one unresolved.
3. Upload collector evidence, then upload and select a better certificate image.
4. Identify one exact artwork.
5. Register it through the existing endpoint.
6. Link the permanent identity.
7. Create but do not redeem an invitation.
8. Reload and confirm unresolved artwork, sale, media roles, and invitation state persist.

Run at desktop and 390 px, keyboard-only, no horizontal overflow, and zero serious or critical accessibility violations.

- [ ] **Step 5: Run UI GREEN and commit**

~~~bash
npx tsx --test tests/artist-sales-ui.test.ts
npx playwright test tests/artist-sales.spec.ts --project=chromium --project='Mobile Chrome' --reporter=list
git add components/admin/CollectorSales.tsx components/admin/AdminNavigation.ts App.tsx tests/artist-sales-ui.test.ts tests/artist-sales.spec.ts
git commit -m "feat(collector): add artist verified-sales workspace"
~~~

## Task 6: Public fortune reveal and private owner price certificate

**Files:**
- Create: `utils/artworkLedger.ts`
- Create: `functions/api/artwork-ledger/media/[id].js`
- Create: `functions/api/keeper/certificate-ledger.js`
- Modify: `functions/api/_lib/certificateContent.js`
- Modify: `functions/api/certificates/[artworkId].js`
- Create: `components/collector/CertificateLedger.tsx`
- Modify: `components/collector/CertificateScreen.tsx`
- Modify: `components/WorksPage.tsx`
- Modify: `tests/public-registry-ui.test.ts`
- Modify: `tests/steward-registration.spec.ts`
- Modify: `tests/artist-sales.test.ts`

- [ ] **Step 1: Write projection RED tests**

Seed an unclaimed registered identity with a message, certificate image, evidence image, buyer email, notes, shared total, and artwork price. Assert the public certificate returns none. Bind the artwork and assert only creator message and selected certificate image appear publicly. Assert no price, buyer, note, reference, evidence media ID, storage reference, or private artwork-record ID appears in public JSON.

Seed two prices and assert the current keeper sees both. Transfer the artwork and assert the former keeper gets 403 immediately while the new keeper sees the same history.

- [ ] **Step 2: Run RED**

~~~bash
npx tsx --test --experimental-test-module-mocks tests/artist-sales.test.ts tests/public-registry-ui.test.ts
~~~

Expected: FAIL because no public ledger or private price projection exists.

- [ ] **Step 3: Implement strict projectors**

Create `utils/artworkLedger.ts`:

~~~ts
export type PublicArtworkLedgerEntry = {
  id: string;
  message?: string;
  imageUrl?: string;
  createdAt: string;
};

export type PrivateArtworkPriceEntry = {
  amountMinor: number;
  currency: string;
  occurrence: { precision: 'exact' | 'month' | 'year' | 'unknown'; value: string | null };
  recordedAt: string;
};
~~~

Public resolution requires one exact linked keeper piece and a current claim. It selects creator message, ledger-selected media ID, and creation time only. Private price resolution authenticates the current keeper at read time and orders all prices by occurrence, recorded time, and ID.

- [ ] **Step 4: Implement media delivery and certificate UI**

The public media endpoint requires an exact linked, currently claimed keeper piece and an explicit `artist_artwork_ledger_entries.media_id` reference. That ledger reference is Adrian's deliberate promotion step, so collector evidence remains private until selected. The endpoint streams the immutable object with stored content type, digest ETag, `nosniff`, and bounded public cache. Unselected evidence returns 404.

Change the public certificate response to `Cache-Control: no-store` so claim visibility cannot stay stale. Add `publicLedger` to the certificate. Add a signed-in price section using `credentials: 'include'`; guests and non-keepers see no price placeholder or control.

- [ ] **Step 5: Run GREEN and commit**

~~~bash
npx tsx --test --experimental-test-module-mocks tests/artist-sales.test.ts tests/public-registry-ui.test.ts
npx playwright test tests/public-registry-ui.spec.ts tests/steward-registration.spec.ts --project=chromium --project='Mobile Chrome' --reporter=list
git add utils/artworkLedger.ts 'functions/api/artwork-ledger/media/[id].js' functions/api/keeper/certificate-ledger.js functions/api/_lib/certificateContent.js 'functions/api/certificates/[artworkId].js' components/collector/CertificateLedger.tsx components/collector/CertificateScreen.tsx components/WorksPage.tsx tests/artist-sales.test.ts tests/public-registry-ui.test.ts tests/steward-registration.spec.ts
git commit -m "feat(collector): reveal claimed artwork ledger safely"
~~~

## Task 7: Encrypted recovery schema v6

**Files:**
- Modify: `utils/registryRecoveryArchive.ts`
- Modify: `functions/api/_lib/registryRecoveryExport.js`
- Modify: `tests/registry-recovery.test.ts`

- [ ] **Step 1: Write recovery RED tests**

Freeze Phase 2 as explicit V5 tables and columns. Seed every new table, including an unresolved case, three-artwork sale, linked claimed artwork, public message, evidence image, certificate image, and two prices. Assert V1 through V5 upgrade with empty Phase 3 tables. Assert V6 one-batch export, deterministic typed ordering, actor dependency closure, clean restore, digest-equivalent re-export, and empty foreign-key check.

- [ ] **Step 2: Run recovery RED**

~~~bash
npx tsx --test --experimental-test-module-mocks tests/registry-recovery.test.ts
~~~

Expected: FAIL because schema version 5 omits the ten Phase 3 tables.

- [ ] **Step 3: Advance recovery without changing V1 through V5**

Set `PRIVATE_RECOVERY_SCHEMA_VERSION = 6`. Append new tables in dependency order:

~~~ts
artist_reconnection_cases,
artist_reconnection_events,
artist_artwork_records,
artist_artwork_record_events,
artist_verified_sales,
artist_verified_sale_events,
artist_verified_sale_items,
artist_artwork_media,
artist_artwork_ledger_entries,
artist_artwork_price_entries
~~~

Include all creator, verifier, and event actors in Better Auth discovery. Archive media references and digests, never bytes or public URLs. During trusted restore, suspend only artwork-record exact-application guards, restore in dependency order, and recreate guards byte-equivalent to migration 032. Before completion, verify every referenced R2 object exists and matches its digest; missing media aborts completion.

- [ ] **Step 4: Run recovery GREEN and commit**

~~~bash
npx tsx --test --experimental-test-module-mocks tests/registry-recovery.test.ts
npm run typecheck
git add utils/registryRecoveryArchive.ts functions/api/_lib/registryRecoveryExport.js tests/registry-recovery.test.ts
git commit -m "feat(collector): recover verified sales and artwork ledger"
~~~

## Task 8: Integrated acceptance and subproject boundary

**Files:**
- Modify: `TODO.md`
- Modify: `todo/plans/the-collector-execution.md`
- Test: `tests/artist-sales.test.ts`
- Test: `tests/artist-sales-admin.test.ts`
- Test: `tests/artist-sales-ui.test.ts`
- Test: `tests/artist-sales.spec.ts`

- [ ] **Step 1: Run focused security and journey gates**

~~~bash
npx tsx --test --experimental-test-module-mocks tests/artist-sales.test.ts tests/artist-sales-admin.test.ts tests/artwork-invitations.test.ts tests/artwork-registration.test.ts tests/registry-maintenance.test.ts tests/registry-recovery.test.ts tests/public-registry-ui.test.ts
npx playwright test tests/artist-sales.spec.ts tests/public-registry-ui.spec.ts tests/steward-registration.spec.ts --project=chromium --project='Mobile Chrome' --reporter=list
~~~

Expected: all focused tests PASS.

- [ ] **Step 2: Run one fresh independent P1/P2 review**

Review unregistered permanence, multi-art atomicity, uncertain identification, public reveal timing, current-keeper price access, former-keeper revocation, direct SQL bypasses, media recovery, and separation from registration and transfer authority. Repair every actionable P1/P2 with RED then GREEN.

- [ ] **Step 3: Run the complete project gate**

~~~bash
npm run test:unit
npm run test:e2e
npm run typecheck
npm run build
git diff --check
~~~

Expected: all tests, typecheck, and build PASS. The existing large admin bundle warning may remain; no new warning is accepted.

- [ ] **Step 4: Run content and launch guards**

Confirm `livingLegacy` remains false, no production binding or data changed, no public JSON contains buyer email or price, no new em dash or forbidden SEO phrase was added, and no browser artifact remains.

- [ ] **Step 5: Record truthful progress**

Update `todo/plans/the-collector-execution.md` with built behavior, exact verification counts, remaining production rehearsal, and the next unstarted Phase 3 subproject. Update `TODO.md` so historical sales and reconnection entry are built locally while inbound email automation remains future work.

- [ ] **Step 6: Commit the integrated subproject**

~~~bash
git add TODO.md todo/plans/the-collector-execution.md
git commit -m "docs(collector): record verified-sales completion"
~~~

Stop at the sale and reconnection subproject boundary. Do not begin contributor roles, video, warning delivery, inbound email automation, automated matching, or production rollout in this plan.
