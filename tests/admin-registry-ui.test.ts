import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { before, describe, it, mock } from 'node:test';

import { mergeRecordRebuildResults, summarizeRecordRebuildAll, type RecordRebuildResult } from '../utils/adminPieces.ts';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const readMigration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);

// This admin desk's own migration set, through piece_records (037) and
// legacy_sections (043). No shared "every migration in order" list exists
// anywhere in this repo -- every fixture file that needs a real D1 shape
// keeps its own array (see tests/piece-record-refresh.test.ts,
// tests/registry-plate-lifecycle.test.ts, and others). That is the actual
// gap: a migration added to functions/api/admin/pieces.js's dependencies
// has no single place to register it, so each fixture array has to be kept
// in sync by hand. Fixing that would mean touching a dozen test files this
// task does not own; the record-generation write path was made to degrade
// gracefully instead (see pieceRecord.js's insertPieceRecordRow), which is
// what actually kept the wider suite green after 043 landed. This array is
// noted here as its own copy on purpose, matching the established pattern.
const MIGRATIONS_THROUGH_LEGACY_SECTIONS = [
  '001_init.sql', '003_atlas_legacy.sql', '006_better_auth.sql',
  '008_living_legacy.sql', '009_keeper_register.sql',
  '010_artwork_plate_identity.sql', '011_piece_fulfillments.sql',
  '012_piece_fulfillment_guards.sql', '013_artwork_lineage.sql',
  '014_artwork_lineage_anchor.sql', '015_registry_artworks.sql',
  '016_keeper_piece_edition_kind_guard.sql',
  '017_creator_registry_maintenance.sql', '018_registry_plate_lifecycle.sql',
  '019_registry_creator_history.sql', '020_registry_recovery_qualification.sql',
  '021_registry_plate_backup_digest.sql',
  '022_registry_fulfillment_detachment.sql', '023_collector_registry_merge.sql',
  '024_ownership_foundation.sql', '025_artwork_registration.sql',
  '026_artwork_invitations.sql', '027_certificate_templates.sql',
  '028_collector_privacy.sql', '029_collector_dreams.sql',
  '030_collector_field.sql', '031_collector_letters.sql',
  '032_artist_verified_sales.sql', '033_artwork_contributors.sql',
  '034_artwork_contributor_invite_rate_limit.sql',
  '036_artwork_catalog_snapshots.sql', '037_piece_records.sql',
  '042_collector_dream_tiers.sql', '043_piece_record_sections.sql',
].map(readMigration).join('\n');

// The same set, stopped before 037: no piece_records table exists at all.
// Proves the admin list survives a database that predates the Piece Record
// feature entirely, not just one that predates 043's column.
const MIGRATIONS_BEFORE_PIECE_RECORDS = [
  '001_init.sql', '003_atlas_legacy.sql', '006_better_auth.sql',
  '008_living_legacy.sql', '009_keeper_register.sql',
  '010_artwork_plate_identity.sql', '011_piece_fulfillments.sql',
  '012_piece_fulfillment_guards.sql', '013_artwork_lineage.sql',
  '014_artwork_lineage_anchor.sql', '015_registry_artworks.sql',
  '016_keeper_piece_edition_kind_guard.sql',
  '017_creator_registry_maintenance.sql', '018_registry_plate_lifecycle.sql',
  '019_registry_creator_history.sql', '020_registry_recovery_qualification.sql',
  '021_registry_plate_backup_digest.sql',
  '022_registry_fulfillment_detachment.sql', '023_collector_registry_merge.sql',
  '024_ownership_foundation.sql', '025_artwork_registration.sql',
  '026_artwork_invitations.sql', '027_certificate_templates.sql',
  '028_collector_privacy.sql', '029_collector_dreams.sql',
  '030_collector_field.sql', '031_collector_letters.sql',
  '032_artist_verified_sales.sql', '033_artwork_contributors.sql',
  '034_artwork_contributor_invite_rate_limit.sql',
  '036_artwork_catalog_snapshots.sql',
].map(readMigration).join('\n');

function d1(database: DatabaseSync) {
  const prepare = (sql: string) => {
    let values: SQLInputValue[] = [];
    return {
      bind(...next: SQLInputValue[]) { values = next; return this; },
      async first() { return database.prepare(sql).get(...values) || null; },
      async all() { return { results: database.prepare(sql).all(...values) }; },
      async run() {
        const result = database.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
  };
  return { prepare };
}

const ADMIN_IDENTITY = {
  userId: 'admin-user', email: 'artist@example.com',
  user: { id: 'admin-user', email: 'artist@example.com', emailVerified: true },
  session: { id: 'admin-session' },
};

/**
 * Import functions/api/admin/pieces.js's GET handler with central admin
 * auth mocked open, exactly as tests/living-legacy.test.ts does for the same
 * module. Each admin-registry-ui.test.ts test that needs it calls this
 * itself rather than sharing one module-scoped import, so the mock is
 * installed fresh and node's per-file process isolation keeps it from
 * leaking into any other test file.
 */
async function importAdminPiecesGet() {
  mock.module('../functions/api/_lib/auth.js', {
    namedExports: {
      requireUser: async () => ADMIN_IDENTITY,
      requireAdmin: async () => ADMIN_IDENTITY,
    },
  });
  const { onRequest } = await import('../functions/api/admin/pieces.js');
  return onRequest;
}

function adminGetRequest() {
  return new Request('https://example.test/api/admin/pieces', {
    method: 'GET',
    headers: { Cookie: 'better-auth.session_token=admin-session' },
  });
}

function baseEnv(database: DatabaseSync) {
  return {
    DB: d1(database),
    ARTWORK_REGISTRY_ADMIN_ENABLED: 'true',
  };
}

describe('central admin registry UI', () => {
  it('uses the shared sign-in modal with a safe admin destination', async () => {
    const login = source('components/AdminLogin.tsx');
    assert.match(login, /SignInModal/);
    assert.match(login, /useLocation/);
    assert.doesNotMatch(login, /api\/admin\/login/);

    const { safeAdminDestination } = await import('../components/AdminLogin.tsx');
    assert.equal(safeAdminDestination('/admin'), '/admin');
    assert.equal(safeAdminDestination('/admin/pieces'), '/admin/pieces');
    for (const hostile of [undefined, null, '/', '/administrator', '/admin/../account', '/admin/%2e%2e/account', '//evil.example/admin', 'https://evil.example/admin', '/admin\\evil', '/admin\u0000/evil']) {
      assert.equal(safeAdminDestination(hostile), '/admin');
    }
  });

  it('verifies the allowlisted identity and signs out through Better Auth', async () => {
    const shell = source('components/admin/AdminShell.tsx');
    assert.match(shell, /\/api\/admin\/verify/);
    assert.match(shell, /response\.status === 401/);
    assert.match(shell, /response\.status === 403/);
    assert.match(shell, /admin\.email/);
    assert.match(shell, /signOut/);
    assert.doesNotMatch(shell, /registry-unlock/);
    assert.doesNotMatch(shell, /api\/admin\/logout/);

    const client = source('lib/account/authClient.ts');
    assert.match(client, /\/api\/admin\/registry-unlock/);
    assert.match(client, /method:\s*['"]DELETE['"]/);

    const { adminReturnDestination } = await import('../components/admin/AdminShell.tsx');
    assert.equal(adminReturnDestination({
      pathname: '/admin/pieces',
      search: '?tab=active',
      hash: '#latest',
    }), '/admin/pieces?tab=active#latest');
  });

  it('submits the registry secret only to unlock and never forwards it to registry operations', () => {
    const pieces = source('components/AdminPieces.tsx');
    assert.match(pieces, /\/api\/admin\/registry-unlock/);
    assert.match(pieces, /JSON\.stringify\(\{ secret:/);
    assert.doesNotMatch(pieces, /sensitive\.stepUpSecret|setStepUpSecret/);
    assert.doesNotMatch(pieces, /adminSecret/);
    assert.doesNotMatch(pieces, /localStorage|sessionStorage/);
    assert.match(pieces, /message === 'registry_locked'/);
    assert.match(pieces, /setRegistryUnlocked\(false\)/);
    assert.match(pieces, /method: 'DELETE'/);
    assert.match(pieces, /Lock registry/);
    const lockAction = pieces.slice(pieces.indexOf('const lockRegistry'), pieces.indexOf('const [driveStatus'));
    assert.ok(lockAction.indexOf('setRegistryUnlocked(false)') < lockAction.indexOf("await fetch('/api/admin/registry-unlock'"));
  });

  it('is the desk and ledger only: no inline issuance or edition-structure panel', () => {
    const pieces = source('components/AdminPieces.tsx');
    assert.doesNotMatch(pieces, /Issue a plate identity/);
    assert.doesNotMatch(pieces, /const issuePlate/);
    assert.doesNotMatch(pieces, /const saveEditionStructure/);
    assert.doesNotMatch(pieces, /Save edition structure/);
    assert.doesNotMatch(pieces, /issueEditionKind|newPieceEditionKind/);
    assert.doesNotMatch(pieces, /go use the wizard|guided plate wizard/);
    assert.match(pieces, /\/admin\/register/);
    assert.match(pieces, /Register an artwork/);
    // Every remaining per-row lifecycle action stays.
    assert.match(pieces, /Retry backup/);
    assert.match(pieces, /Reveal Ownership Code/);
    assert.match(pieces, /Recover full fabrication package/);
    assert.match(pieces, /Physical checks/);
    assert.match(pieces, /Prove copied-file recovery in wizard/);
    assert.match(pieces, /Download offline ledger/);
    assert.match(pieces, /Sync to Google Drive/);
  });

  it('keeps local Vite admin mocks aligned with central auth and registry unlock', () => {
    const vite = source('vite.config.ts');
    assert.doesNotMatch(vite, /\/api\/admin\/login|\/api\/admin\/logout|admin_session/);
    assert.match(vite, /\/api\/admin\/verify/);
    assert.match(vite, /admin:\s*\{\s*id:/);
    assert.match(vite, /status === 'guest'.*401/s);
    assert.match(vite, /status === 'forbidden'.*403/s);
    assert.match(vite, /\/api\/admin\/registry-unlock/);
    assert.match(vite, /req\.method === 'GET'/);
    assert.match(vite, /req\.method === 'POST'/);
    assert.match(vite, /req\.method === 'DELETE'/);
  });

  it('removes the legacy password and admin-session helper surface', () => {
    const admin = source('functions/api/_lib/admin.js');
    assert.doesNotMatch(admin, /admin_session|createAdminSessionToken|verifyAdminPassword|isAdminAuthed|requireAdminPostStepUp|adminSecret/);
    assert.match(admin, /registryStepUpSecret/);
    assert.match(admin, /env\?\.UPLOAD_SECRET/);
  });
});

describe('migration 043: piece_records.legacy_sections', () => {
  const MIGRATIONS_THROUGH_037 = [
    '001_init.sql', '003_atlas_legacy.sql', '006_better_auth.sql',
    '008_living_legacy.sql', '009_keeper_register.sql',
    '010_artwork_plate_identity.sql', '011_piece_fulfillments.sql',
    '012_piece_fulfillment_guards.sql', '013_artwork_lineage.sql',
    '014_artwork_lineage_anchor.sql', '015_registry_artworks.sql',
    '016_keeper_piece_edition_kind_guard.sql',
    '017_creator_registry_maintenance.sql', '018_registry_plate_lifecycle.sql',
    '019_registry_creator_history.sql', '020_registry_recovery_qualification.sql',
    '021_registry_plate_backup_digest.sql',
    '022_registry_fulfillment_detachment.sql', '023_collector_registry_merge.sql',
    '024_ownership_foundation.sql', '025_artwork_registration.sql',
    '026_artwork_invitations.sql', '027_certificate_templates.sql',
    '028_collector_privacy.sql', '029_collector_dreams.sql',
    '030_collector_field.sql', '031_collector_letters.sql',
    '032_artist_verified_sales.sql', '033_artwork_contributors.sql',
    '034_artwork_contributor_invite_rate_limit.sql',
    '036_artwork_catalog_snapshots.sql', '037_piece_records.sql',
  ].map(readMigration).join('\n');

  it('is additive over an existing row, backfills a truthful default of 0, and leaves the append-only guards intact', () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec(MIGRATIONS_THROUGH_037);
    database.exec(`
      INSERT INTO keeper_pieces
        (id, piece_id, edition_number, recovery_code_hash, registered_at, public_code, plate_status)
      VALUES ('kp-043', 'UL-043', 0, '${'a'.repeat(64)}', '2026-01-01T00:00:00.000Z', 'AR-TESTTEST', 'active');
      INSERT INTO piece_records (id, public_code, record_hash, r2_key, trigger_event, created_at)
      VALUES ('pr-existing', 'AR-TESTTEST', '${'b'.repeat(64)}',
        'records/AR-TESTTEST/${'b'.repeat(64)}.html', 'registration', '2026-01-02T00:00:00.000Z');
    `);

    // The additive migration itself. Applying it must not raise, even
    // though 037's piece_records_no_update / piece_records_no_delete
    // triggers already guard this table -- they are BEFORE UPDATE / BEFORE
    // DELETE row triggers, and ALTER TABLE ADD COLUMN is DDL, not a row
    // event, so they do not fire for it.
    database.exec(readMigration('043_piece_record_sections.sql'));

    const existing = database.prepare(
      'SELECT legacy_sections FROM piece_records WHERE id = ?',
    ).get('pr-existing') as { legacy_sections: number };
    assert.equal(existing.legacy_sections, 0, 'the backfilled default must be the truthful 0 for pre-043 rows');

    assert.throws(() => database.exec(
      `INSERT INTO piece_records (id, public_code, record_hash, r2_key, trigger_event, created_at, legacy_sections)
       VALUES ('pr-bad', 'AR-TESTTEST', '${'c'.repeat(64)}',
         'records/AR-TESTTEST/${'c'.repeat(64)}.html', 'on_demand', '2026-01-03T00:00:00.000Z', 2)`,
    ), /CHECK/i, 'legacy_sections must reject anything outside 0/1');

    database.exec(
      `INSERT INTO piece_records (id, public_code, record_hash, r2_key, trigger_event, created_at, legacy_sections)
       VALUES ('pr-full', 'AR-TESTTEST', '${'d'.repeat(64)}',
         'records/AR-TESTTEST/${'d'.repeat(64)}.html', 'on_demand', '2026-01-04T00:00:00.000Z', 1)`,
    );
    const full = database.prepare(
      'SELECT legacy_sections FROM piece_records WHERE id = ?',
    ).get('pr-full') as { legacy_sections: number };
    assert.equal(full.legacy_sections, 1);

    assert.throws(() => database.exec(
      "UPDATE piece_records SET legacy_sections = 1 WHERE id = 'pr-existing'",
    ), /append-only/);
    assert.throws(() => database.exec(
      "DELETE FROM piece_records WHERE id = 'pr-existing'",
    ), /append-only/);

    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
    database.close();
  });
});

describe('GET /api/admin/pieces surfaces permanent record state (migrations 037, 043)', () => {
  let getPieces: (context: { request: Request; env: unknown }) => Promise<Response>;

  before(async () => {
    getPieces = await importAdminPiecesGet();
  });

  it('reports newest-per-code record state: full vs placeholder, staleness by age and by newer lineage, and none at all', async () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec(MIGRATIONS_THROUGH_LEGACY_SECTIONS);
    const hash = (n: number) => String(n).repeat(64).slice(0, 64);

    database.exec(`
      INSERT INTO keeper_pieces
        (id, piece_id, edition_number, recovery_code_hash, registered_at, public_code, plate_status)
      VALUES
        ('kp-multi', 'UL-901', 0, '${'a'.repeat(64)}', '2026-01-01T00:00:00.000Z', 'AR-MULTITST', 'active'),
        ('kp-age', 'UL-902', 0, '${'b'.repeat(64)}', '2026-01-01T00:00:00.000Z', 'AR-AGESTAL1', 'active'),
        ('kp-lineage', 'UL-903', 0, '${'c'.repeat(64)}', '2026-01-01T00:00:00.000Z', 'AR-LINEAGE1', 'active'),
        ('kp-none', 'UL-904', 0, '${'d'.repeat(64)}', '2026-01-01T00:00:00.000Z', 'AR-NORECRD1', 'active');

      -- kp-multi: an older placeholder record, then a newer full one. The
      -- newest-per-code query must surface the newer, full record.
      INSERT INTO piece_records (id, public_code, record_hash, r2_key, trigger_event, created_at, legacy_sections)
      VALUES
        ('pr-multi-old', 'AR-MULTITST', '${hash(1)}', 'records/AR-MULTITST/${hash(1)}.html',
         'registration', '2026-01-05T00:00:00.000Z', 0),
        ('pr-multi-new', 'AR-MULTITST', '${hash(2)}', 'records/AR-MULTITST/${hash(2)}.html',
         'on_demand', '2026-06-01T00:00:00.000Z', 1);

      -- kp-age: one full record generated in 2015. Stale by age alone.
      INSERT INTO piece_records (id, public_code, record_hash, r2_key, trigger_event, created_at, legacy_sections)
      VALUES ('pr-age', 'AR-AGESTAL1', '${hash(3)}', 'records/AR-AGESTAL1/${hash(3)}.html',
        'registration', '2015-01-01T00:00:00.000Z', 1);

      -- kp-lineage: a recent full record, then a lineage event after it.
      -- Stale by "the registry moved since", not by age.
      INSERT INTO piece_records (id, public_code, record_hash, r2_key, trigger_event, created_at, legacy_sections)
      VALUES ('pr-lineage', 'AR-LINEAGE1', '${hash(4)}', 'records/AR-LINEAGE1/${hash(4)}.html',
        'activation', '2026-01-10T00:00:00.000Z', 1);
      INSERT INTO artwork_lineage_events
        (id, keeper_piece_id, sequence, event_type, event_at, previous_hash, event_hash, public_payload_json)
      VALUES ('lineage-after', 'kp-lineage', 1, 'issued', '2026-02-01T00:00:00.000Z', NULL,
        '${hash(5)}', '{}');
    `);

    const response = await getPieces({
      request: adminGetRequest(),
      env: baseEnv(database),
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.ok, true);
    const byCode = new Map(
      (data.pieces as Array<{ publicCode: string }>).map((piece) => [piece.publicCode, piece]),
    );

    const multi = byCode.get('AR-MULTITST') as any;
    assert.ok(multi.record, 'the piece with two records must still carry one');
    assert.equal(multi.record.hash, hash(2));
    assert.equal(multi.record.generatedAt, '2026-06-01T00:00:00.000Z');
    assert.equal(multi.record.trigger, 'on_demand');
    assert.equal(multi.record.legacySections, true);

    const age = byCode.get('AR-AGESTAL1') as any;
    assert.ok(age.record.ageDays > 365);
    assert.equal(age.record.stale, true);

    const lineage = byCode.get('AR-LINEAGE1') as any;
    assert.equal(lineage.record.legacySections, true);
    assert.equal(lineage.record.stale, true);
    assert.ok(lineage.record.ageDays < 365, 'the lineage piece is not old enough to be stale by age alone');

    const none = byCode.get('AR-NORECRD1') as any;
    assert.equal(none.record, null);

    database.close();
  });

  it('lists pieces from a database that predates migration 037, with record: null throughout', async () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec(MIGRATIONS_BEFORE_PIECE_RECORDS);
    database.exec(`
      INSERT INTO keeper_pieces
        (id, piece_id, edition_number, recovery_code_hash, registered_at, public_code, plate_status)
      VALUES ('kp-pre037', 'UL-905', 0, '${'a'.repeat(64)}', '2026-01-01T00:00:00.000Z', 'AR-PREMIGRT', 'active');
    `);

    const response = await getPieces({
      request: adminGetRequest(),
      env: baseEnv(database),
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.ok, true);
    assert.equal(data.pieces.length, 1);
    assert.equal(data.pieces[0].publicCode, 'AR-PREMIGRT');
    assert.equal(data.pieces[0].record, null);

    database.close();
  });
});

describe('POST /api/admin/records/rebuild 207 partial outcomes render honestly', () => {
  it('summarizeRecordRebuildAll counts every outcome and names every failing piece with its own error', () => {
    const result: RecordRebuildResult = {
      ok: false,
      generatedAt: '2026-08-14T00:00:00.000Z',
      trigger: 'on_demand',
      total: 12,
      generated: 3,
      unchanged: 8,
      failed: 1,
      outcomes: [
        { publicCode: 'AR-AAAAAAA1', status: 'generated', recordHash: 'x'.repeat(64) },
        { publicCode: 'AR-FAILEDONE', status: 'failed', error: 'lineage_integrity_error' },
      ],
      cursor: null, nextCursor: 'AR-FAILEDONE', hasMore: true,
    };
    const summary = summarizeRecordRebuildAll(result);
    assert.match(summary, /^12 records: 3 rebuilt, 8 unchanged, 1 failed\./);
    assert.match(summary, /AR-FAILEDONE/);
    assert.match(summary, /lineage_integrity_error/);
  });

  it('reports a clean run with no failed clause at all, never a generic "succeeded"', () => {
    const result: RecordRebuildResult = {
      ok: true,
      generatedAt: '2026-08-14T00:00:00.000Z',
      trigger: 'on_demand',
      total: 4,
      generated: 1,
      unchanged: 3,
      failed: 0,
      outcomes: [],
      cursor: null, nextCursor: null, hasMore: false,
    };
    assert.equal(summarizeRecordRebuildAll(result), '4 records: 1 rebuilt, 3 unchanged.');
  });

  it('AdminPieces.tsx renders the real per-piece outcome, gated on the unlock, with a confirm step before the bulk loop', () => {
    const pieces = source('components/AdminPieces.tsx');
    assert.match(pieces, /summarizeRecordRebuildAll/);
    assert.match(pieces, /requestRecordRebuild/);
    assert.match(pieces, /window\.confirm/);
    assert.match(pieces, /Rebuild all records/);
    assert.match(pieces, /Continue rebuild/);
    assert.match(pieces, /Retry failed records/);
    assert.match(pieces, /limit: 25/);
    assert.match(pieces, /disabled=\{!registryUnlocked \|\| recordsBusy\}/);
  });

  it('keeps failures across pages and replaces only the piece that is retried', () => {
    const first: RecordRebuildResult = {
      ok: false, generatedAt: '2026-08-14T00:00:00.000Z', trigger: 'on_demand',
      total: 2, generated: 1, unchanged: 0, failed: 1,
      outcomes: [
        { publicCode: 'AR-AAAAAAA1', status: 'generated' },
        { publicCode: 'AR-BBBBBBB2', status: 'failed', error: 'storage_failed' },
      ],
      cursor: null, nextCursor: 'AR-BBBBBBB2', hasMore: true,
    };
    const second: RecordRebuildResult = {
      ok: true, generatedAt: '2026-08-14T00:01:00.000Z', trigger: 'on_demand',
      total: 1, generated: 0, unchanged: 1, failed: 0,
      outcomes: [{ publicCode: 'AR-CCCCCCC3', status: 'unchanged' }],
      cursor: 'AR-BBBBBBB2', nextCursor: null, hasMore: false,
    };
    const accumulated = mergeRecordRebuildResults(first, second);
    assert.equal(accumulated.total, 3);
    assert.equal(accumulated.failed, 1);
    assert.match(summarizeRecordRebuildAll(accumulated), /AR-BBBBBBB2/);

    const retry: RecordRebuildResult = {
      ...second, outcomes: [{ publicCode: 'AR-BBBBBBB2', status: 'generated' }],
      generated: 1, unchanged: 0,
    };
    const repaired = mergeRecordRebuildResults(accumulated, retry);
    assert.equal(repaired.total, 3);
    assert.equal(repaired.failed, 0);
    assert.equal(repaired.generated, 2);
  });
});
