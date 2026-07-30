import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, before, describe, it, mock } from 'node:test';

import {
  buildMaintenanceEventStatement,
  canonicalMaintenanceJson,
  classifyMaintenanceIdempotency,
  commitAcquisitionCreate,
  commitMaintenanceMutation,
  normalizeAcquisitionInput,
  normalizeReason,
  replayMaintenanceEvent,
} from '../functions/api/_lib/registryMaintenance.js';
import {
  buildLineageEvent,
  lineageAnchorStatement,
  lineageStatement,
} from '../functions/api/_lib/lineage.js';
import { LAUNCH_FLAGS } from '../launchFlags.ts';

let maintenanceSession: {
  session: { id: string };
  user: { id: string; email: string; emailVerified: boolean };
} | null = null;

before(() => {
  mock.module('../lib/account/auth.server.js', {
    namedExports: {
      createAuth: () => ({ api: { getSession: async () => maintenanceSession } }),
    },
  });
});

after(() => mock.reset());

const readMigration = (name: string) =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');

const registryMigrations = [
  '001_init.sql',
  '006_better_auth.sql',
  '008_living_legacy.sql',
  '009_keeper_register.sql',
  '010_artwork_plate_identity.sql',
  '011_piece_fulfillments.sql',
  '012_piece_fulfillment_guards.sql',
  '013_artwork_lineage.sql',
  '014_artwork_lineage_anchor.sql',
  '015_registry_artworks.sql',
  '016_keeper_piece_edition_kind_guard.sql',
  '017_creator_registry_maintenance.sql',
  '018_registry_plate_lifecycle.sql',
  '019_registry_creator_history.sql',
].map(readMigration).join('\n');

const keeperInsert = `
  INSERT INTO keeper_pieces
    (id, piece_id, edition_number, recovery_code_hash, public_code,
     plate_status, registered_at)
  VALUES
    ('kp-maint', 'UL-100', 0, 'maintenance-hash', 'AR-7KQ9M2WX',
     'active', '2026-07-30T00:00:00.000Z');
`;

function sqliteJson(sql: string) {
  const output = execFileSync('sqlite3', ['-json', ':memory:'], {
    encoding: 'utf8',
    input: `PRAGMA foreign_keys = ON;\n${sql}`,
  }).trim();
  return output ? JSON.parse(output) : [];
}

function sqliteResult(sql: string) {
  return spawnSync('sqlite3', [':memory:'], {
    encoding: 'utf8',
    input: `PRAGMA foreign_keys = ON;\n${sql}`,
  });
}

const eventInsert = `
  INSERT INTO registry_maintenance_events
    (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
     administrator_user_id, administrator_email, reason, before_json,
     after_json, outcome, related_record_id, mutation_fingerprint, created_at)
  VALUES
    ('rme-1', 'idem-1', 'acquisition_created', 'kp-maint', 'UL-100',
     'admin-1', 'admin@example.com', 'Record the studio acquisition.',
     '{}', '{"id":"acq-1"}', 'succeeded', 'acq-1', '${'a'.repeat(64)}',
     '2026-07-30T01:00:00.000Z');
`;

describe('creator registry maintenance migration', () => {
  it('stores typed creator history with explicit visibility and guarded current-state removal', () => {
    const rows = sqliteJson(`
      ${registryMigrations}
      ${keeperInsert}
      INSERT INTO artwork_provenance_entries
        (id, keeper_piece_id, entry_type, title, detail, role, occurred_at,
         visibility, created_at, updated_at)
      VALUES
        ('prov-1', 'kp-maint', 'contributor', 'Mira S.', 'Joined the wood assembly.',
         'Studio collaborator', '2026-01-15', 'public',
         '2026-07-30T00:00:00.000Z', '2026-07-30T00:00:00.000Z'),
        ('prov-2', 'kp-maint', 'creation_place', 'Ubud, Bali', NULL, NULL,
         NULL, 'private', '2026-07-30T00:00:00.000Z',
         '2026-07-30T00:00:00.000Z');
      UPDATE artwork_provenance_entries
         SET title = 'Ubud studio, Bali', updated_at = '2026-07-30T01:00:00.000Z'
       WHERE id = 'prov-2';
      UPDATE artwork_provenance_entries
         SET removed_at = '2026-07-30T02:00:00.000Z',
             updated_at = '2026-07-30T02:00:00.000Z',
             record_version = record_version + 1
       WHERE id = 'prov-2';
      SELECT id, entry_type, title, role, visibility, record_version,
             removed_at IS NOT NULL AS removed
        FROM artwork_provenance_entries ORDER BY id;
    `);

    assert.deepEqual(rows, [
      {
        id: 'prov-1', entry_type: 'contributor', title: 'Mira S.',
        role: 'Studio collaborator', visibility: 'public', record_version: 1,
        removed: 0,
      },
      {
        id: 'prov-2', entry_type: 'creation_place', title: 'Ubud studio, Bali',
        role: null, visibility: 'private', record_version: 3, removed: 1,
      },
    ]);

    const indexNames = sqliteJson(`
      ${registryMigrations}
      SELECT name FROM sqlite_master
       WHERE type = 'index' AND name IN (
         'idx_artwork_provenance_piece_current',
         'idx_artwork_provenance_piece_visibility'
       ) ORDER BY name;
    `).map((row: { name: string }) => row.name);
    assert.deepEqual(indexNames, [
      'idx_artwork_provenance_piece_current',
      'idx_artwork_provenance_piece_visibility',
    ]);
  });

  it('rejects invalid creator-history types, visibility, blank titles and hard deletion', () => {
    const invalidInserts = [
      "('bad-type','kp-maint','price','Value',NULL,NULL,NULL,'private','x','x')",
      "('bad-visibility','kp-maint','note','Note',NULL,NULL,NULL,'world','x','x')",
      "('blank-title','kp-maint','note','   ',NULL,NULL,NULL,'private','x','x')",
      "('missing-role','kp-maint','contributor','Mira',NULL,NULL,NULL,'public','x','x')",
    ];
    for (const values of invalidInserts) {
      const result = sqliteResult(`
        ${registryMigrations}
        ${keeperInsert}
        INSERT INTO artwork_provenance_entries
          (id, keeper_piece_id, entry_type, title, detail, role, occurred_at,
           visibility, created_at, updated_at)
        VALUES ${values};
      `);
      assert.notEqual(result.status, 0, values);
    }

    const deletion = sqliteResult(`
      ${registryMigrations}
      ${keeperInsert}
      INSERT INTO artwork_provenance_entries
        (id, keeper_piece_id, entry_type, title, visibility, created_at, updated_at)
      VALUES ('prov-delete', 'kp-maint', 'note', 'Keep history', 'private', 'x', 'x');
      DELETE FROM artwork_provenance_entries WHERE id = 'prov-delete';
    `);
    assert.notEqual(deletion.status, 0);
    assert.match(deletion.stderr, /remove from current view/i);
  });

  it('applies after the complete registry chain with version columns and private history tables', () => {
    const columns = sqliteJson(`
      ${registryMigrations}
      ${keeperInsert}
      INSERT INTO artwork_acquisitions
        (id, keeper_piece_id, acquisition_type, acquired_at, amount_minor,
         currency, acquirer_reference, private_notes, document_reference,
         public_provenance, created_at, updated_at)
      VALUES
        ('acq-1', 'kp-maint', 'sale', '2026-07-29T00:00:00.000Z',
         125000, 'USD', 'collector-ref', 'Private note', 'r2://document',
         'Acquired from the artist', '2026-07-30T00:00:00.000Z',
         '2026-07-30T00:00:00.000Z');
      ${eventInsert}
      SELECT
        keeper_pieces.record_version AS keeper_record_version,
        keeper_pieces.steward_version,
        artwork_acquisitions.record_version AS acquisition_record_version,
        artwork_acquisitions.amount_minor,
        artwork_acquisitions.currency,
        registry_maintenance_events.outcome,
        registry_maintenance_events.before_json,
        registry_maintenance_events.after_json,
        registry_maintenance_events.mutation_fingerprint
      FROM keeper_pieces
      JOIN artwork_acquisitions
        ON artwork_acquisitions.keeper_piece_id = keeper_pieces.id
      JOIN registry_maintenance_events
        ON registry_maintenance_events.keeper_piece_id = keeper_pieces.id
      WHERE keeper_pieces.id = 'kp-maint';
    `);

    assert.deepEqual(columns, [{
      keeper_record_version: 0,
      steward_version: 0,
      acquisition_record_version: 1,
      amount_minor: 125000,
      currency: 'USD',
      outcome: 'succeeded',
      before_json: '{}',
      after_json: '{"id":"acq-1"}',
      mutation_fingerprint: 'a'.repeat(64),
    }]);

    const indexNames = sqliteJson(`
      ${registryMigrations}
      SELECT name FROM sqlite_master
       WHERE type = 'index' AND name IN (
         'idx_registry_maintenance_piece_created',
         'idx_registry_maintenance_type_created'
       ) ORDER BY name;
    `).map((row: { name: string }) => row.name);
    assert.deepEqual(indexNames, [
      'idx_registry_maintenance_piece_created',
      'idx_registry_maintenance_type_created',
    ]);

    const strictTables = sqliteJson(`
      ${registryMigrations}
      SELECT name, strict FROM pragma_table_list
       WHERE name IN ('artwork_acquisitions', 'registry_maintenance_events')
       ORDER BY name;
    `);
    assert.deepEqual(strictTables, [
      { name: 'artwork_acquisitions', strict: 1 },
      { name: 'registry_maintenance_events', strict: 1 },
    ]);
  });

  it('requires a nonnegative integer amount and paired uppercase ISO currency', () => {
    const base = `
      ${registryMigrations}
      ${keeperInsert}
      INSERT INTO artwork_acquisitions
        (id, keeper_piece_id, acquisition_type, acquired_at, amount_minor,
         currency, created_at, updated_at)
    `;
    const invalidValues = [
      "('a1','kp-maint','sale','2026-01-01',-1,'USD','x','x')",
      "('a2','kp-maint','sale','2026-01-01',1.5,'USD','x','x')",
      "('a3','kp-maint','sale','2026-01-01',100,NULL,'x','x')",
      "('a4','kp-maint','sale','2026-01-01',NULL,'USD','x','x')",
      "('a5','kp-maint','sale','2026-01-01',100,'usd','x','x')",
      "('a6','kp-maint','sale','2026-01-01',100,'US','x','x')",
    ];
    for (const values of invalidValues) {
      const result = sqliteResult(`${base} VALUES ${values};`);
      assert.notEqual(result.status, 0, values);
    }

    const accepted = sqliteJson(`
      ${base} VALUES
        ('a7','kp-maint','gift',NULL,NULL,NULL,'x','x'),
        ('a8','kp-maint','sale','2026-01-01',0,'IDR','x','x');
      SELECT id, amount_minor, currency FROM artwork_acquisitions ORDER BY id;
    `);
    assert.deepEqual(accepted, [
      { id: 'a7', amount_minor: null, currency: null },
      { id: 'a8', amount_minor: 0, currency: 'IDR' },
    ]);
  });

  it('rejects binary or numeric values in text-only persistence fields', () => {
    const invalidAcquisitions = [
      `INSERT INTO artwork_acquisitions
        (id, keeper_piece_id, acquisition_type, created_at, updated_at)
       VALUES (1.5, 'kp-maint', 'gift', 'x', 'x');`,
      `INSERT INTO artwork_acquisitions
        (id, keeper_piece_id, acquisition_type, acquired_at, created_at, updated_at)
       VALUES ('blob-date', 'kp-maint', 'gift', X'00', 'x', 'x');`,
      `INSERT INTO artwork_acquisitions
        (id, keeper_piece_id, acquisition_type, private_notes, created_at, updated_at)
       VALUES ('blob-note', 'kp-maint', 'gift', X'00', 'x', 'x');`,
      `INSERT INTO artwork_acquisitions
        (id, keeper_piece_id, acquisition_type, document_reference, created_at, updated_at)
       VALUES ('real-reference', 'kp-maint', 'gift', 4.25, 'x', 'x');`,
    ];
    const invalidEvents = [
      `INSERT INTO registry_maintenance_events
        (id, idempotency_key, event_type, administrator_user_id,
         administrator_email, reason, before_json, after_json, outcome,
         mutation_fingerprint, created_at)
       VALUES (2.5, 'real-id', 'test', 'admin', 'admin@example.com', 'Reason',
               '{}', '{}', 'failed', '${'c'.repeat(64)}', 'x');`,
      `INSERT INTO registry_maintenance_events
        (id, idempotency_key, event_type, administrator_user_id,
         administrator_email, reason, before_json, after_json, outcome,
         mutation_fingerprint, created_at)
       VALUES ('blob-event', 'blob-event', X'00', 'admin', 'admin@example.com', 'Reason',
               '{}', '{}', 'failed', '${'c'.repeat(64)}', 'x');`,
      `INSERT INTO registry_maintenance_events
        (id, idempotency_key, event_type, administrator_user_id,
         administrator_email, reason, before_json, after_json, outcome,
         mutation_fingerprint, created_at)
       VALUES ('blob-time', 'blob-time', 'test', 'admin', 'admin@example.com', 'Reason',
               '{}', '{}', 'failed', '${'c'.repeat(64)}', X'00');`,
    ];

    for (const insert of [...invalidAcquisitions, ...invalidEvents]) {
      const result = sqliteResult(`${registryMigrations}\n${keeperInsert}\n${insert}`);
      assert.notEqual(result.status, 0, insert);
    }
  });

  it('advances keeper versions for current mutation paths without double counting', () => {
    const rows = sqliteJson(`
      ${registryMigrations}
      ${keeperInsert}

      UPDATE keeper_pieces
         SET keeper_user_id = 'keeper-1', claimed_at = '2026-07-30T03:00:00.000Z',
             released_at = NULL
       WHERE id = 'kp-maint';
      UPDATE keeper_pieces
         SET current_display_location = 'Ubud studio'
       WHERE id = 'kp-maint';
      UPDATE keeper_pieces
         SET plate_status = 'active', plate_activated_at = '2026-07-30T04:00:00.000Z'
       WHERE id = 'kp-maint';
      UPDATE keeper_pieces
         SET backup_status = 'verified', backup_reference = 'plates/AR-7KQ9M2WX.json',
             backup_at = '2026-07-30T05:00:00.000Z'
       WHERE id = 'kp-maint';
      UPDATE keeper_pieces
         SET backup_status = 'pending', record_version = record_version + 1
       WHERE id = 'kp-maint';
      UPDATE keeper_pieces
         SET lineage_head_hash = 'lineage-only', lineage_event_count = 1
       WHERE id = 'kp-maint';

      SELECT record_version, steward_version FROM keeper_pieces WHERE id = 'kp-maint';
    `);
    assert.deepEqual(rows, [{ record_version: 3, steward_version: 2 }]);
  });

  it('makes maintenance events append-only', () => {
    for (const mutation of [
      "UPDATE registry_maintenance_events SET reason = 'Changed' WHERE id = 'rme-1';",
      "DELETE FROM registry_maintenance_events WHERE id = 'rme-1';",
    ]) {
      const result = sqliteResult(`
        ${registryMigrations}
        ${keeperInsert}
        ${eventInsert}
        ${mutation}
      `);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /append-only/i);
    }
  });

  it('requires unique maintenance idempotency keys', () => {
    const result = sqliteResult(`
      ${registryMigrations}
      ${keeperInsert}
      ${eventInsert}
      INSERT INTO registry_maintenance_events
        (id, idempotency_key, event_type, administrator_user_id,
         administrator_email, reason, before_json, after_json, outcome,
         mutation_fingerprint, created_at)
      VALUES
        ('rme-2', 'idem-1', 'acquisition_created', 'admin-1',
         'admin@example.com', 'Retry.', '{}', '{}', 'succeeded', '${'b'.repeat(64)}',
         '2026-07-30T01:01:00.000Z');
    `);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unique/i);
  });

  it('requires a lowercase SHA-256 mutation fingerprint', () => {
    for (const fingerprint of [
      'a'.repeat(63),
      'A'.repeat(64),
      `${'a'.repeat(63)}g`,
    ]) {
      const result = sqliteResult(`
        ${registryMigrations}
        INSERT INTO registry_maintenance_events
          (id, idempotency_key, event_type, administrator_user_id,
           administrator_email, reason, before_json, after_json, outcome,
           mutation_fingerprint, created_at)
        VALUES
          ('rme-bad-fingerprint', 'bad-fingerprint', 'acquisition_corrected',
           'admin-1', 'admin@example.com', 'Reason.', '{}', '{}', 'failed',
           '${fingerprint}', '2026-07-30T01:01:00.000Z');
      `);
      assert.notEqual(result.status, 0, fingerprint);
    }
  });
});

describe('maintenance input normalization', () => {
  it('serializes stable canonical JSON recursively without mutating input', () => {
    const input = { z: 1, a: { y: 2, b: [{ d: 4, c: 3 }] } };
    assert.equal(canonicalMaintenanceJson(input), '{"a":{"b":[{"c":3,"d":4}],"y":2},"z":1}');
    assert.deepEqual(input, { z: 1, a: { y: 2, b: [{ d: 4, c: 3 }] } });
    assert.equal(
      canonicalMaintenanceJson(JSON.parse('{"__proto__":{"polluted":true},"a":1}')),
      '{"__proto__":{"polluted":true},"a":1}',
    );
    assert.throws(() => canonicalMaintenanceJson({ amount: Number.NaN }), /canonical_json_invalid/);
    assert.throws(() => canonicalMaintenanceJson({ private: undefined }), /canonical_json_invalid/);
  });

  it('requires a trimmed bounded reason', () => {
    assert.deepEqual(normalizeReason('  Correct catalog title  '), {
      ok: true,
      reason: 'Correct catalog title',
    });
    assert.deepEqual(normalizeReason('   '), { ok: false, error: 'reason_required' });
    assert.deepEqual(normalizeReason('x'.repeat(501)), {
      ok: false,
      error: 'reason_too_long',
    });
  });

  it('normalizes an allowlisted acquisition and rejects unknown or oversized input', () => {
    assert.deepEqual(normalizeAcquisitionInput({
      acquisitionType: 'sale',
      acquiredAt: '2026-07-29T12:30:00Z',
      amountMinor: 125000,
      currency: ' idr ',
      acquirerReference: ' collector-12 ',
      privateNotes: ' private ',
      documentReference: ' r2://receipt ',
      publicProvenance: ' Acquired directly from the artist. ',
    }), {
      ok: true,
      acquisition: {
        acquisitionType: 'sale',
        acquiredAt: '2026-07-29T12:30:00.000Z',
        amountMinor: 125000,
        currency: 'IDR',
        acquirerReference: 'collector-12',
        privateNotes: 'private',
        documentReference: 'r2://receipt',
        publicProvenance: 'Acquired directly from the artist.',
      },
    });

    assert.deepEqual(normalizeAcquisitionInput({
      acquisitionType: 'gift', acquiredAt: '2026-07-29T00:00:00Z',
      amountMinor: null, currency: null,
    }), {
      ok: true,
      acquisition: {
        acquisitionType: 'gift',
        acquiredAt: '2026-07-29T00:00:00.000Z',
        amountMinor: null,
        currency: null,
        acquirerReference: null,
        privateNotes: null,
        documentReference: null,
        publicProvenance: null,
      },
    });

    assert.deepEqual(normalizeAcquisitionInput({ acquisitionType: 'retained' }), {
      ok: true,
      acquisition: {
        acquisitionType: 'retained',
        acquiredAt: null,
        amountMinor: null,
        currency: null,
        acquirerReference: null,
        privateNotes: null,
        documentReference: null,
        publicProvenance: null,
      },
    });

    for (const [input, error] of [
      [{ acquisitionType: 'sale', acquiredAt: '2026-01-01', extra: true }, 'unknown_field'],
      [{ acquisitionType: 'purchase', acquiredAt: '2026-01-01' }, 'invalid_acquisition_type'],
      [{ acquisitionType: 'sale', acquiredAt: 'not-a-date' }, 'invalid_acquired_at'],
      [{ acquisitionType: 'sale', acquiredAt: '2026-02-30' }, 'invalid_acquired_at'],
      [{ acquisitionType: 'sale', acquiredAt: '0' }, 'invalid_acquired_at'],
      [{ acquisitionType: 'sale', acquiredAt: '2026-01-01', amountMinor: 10 }, 'currency_required'],
      [{ acquisitionType: 'sale', acquiredAt: '2026-01-01', currency: 'USD' }, 'amount_required'],
      [{ acquisitionType: 'sale', acquiredAt: '2026-01-01', amountMinor: -1, currency: 'USD' }, 'invalid_amount'],
      [{ acquisitionType: 'sale', acquiredAt: '2026-01-01', privateNotes: 'x'.repeat(5001) }, 'private_notes_too_long'],
    ] as const) {
      const result = normalizeAcquisitionInput(input);
      assert.equal(result.ok, false);
      assert.equal(result.error, error);
    }
  });
});

const expectedEvent = {
  idempotencyKey: 'maintenance-request-1',
  eventType: 'acquisition_corrected',
  keeperPieceId: 'kp-maint',
  artworkId: null,
  authorization: { userId: 'admin-1', email: 'admin@example.com' },
  reason: 'Correct the acquisition date.',
  before: {
    acquisitionId: 'acq-1',
    keeperPieceId: 'kp-maint',
    acquiredAt: '2026-01-01T00:00:00.000Z',
    recordVersion: 2,
  },
  after: {
    acquisitionId: 'acq-1',
    keeperPieceId: 'kp-maint',
    acquiredAt: '2026-02-01T00:00:00.000Z',
    recordVersion: 3,
  },
  outcome: 'succeeded',
  relatedRecordId: 'acq-1',
  mutationFingerprint: 'a'.repeat(64),
  createdAt: '2026-07-30T02:00:00.000Z',
};

function storedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rme-stored',
    idempotency_key: expectedEvent.idempotencyKey,
    event_type: expectedEvent.eventType,
    keeper_piece_id: expectedEvent.keeperPieceId,
    artwork_id: expectedEvent.artworkId,
    administrator_user_id: expectedEvent.authorization.userId,
    administrator_email: expectedEvent.authorization.email,
    reason: expectedEvent.reason,
    before_json: canonicalMaintenanceJson(expectedEvent.before),
    after_json: canonicalMaintenanceJson(expectedEvent.after),
    outcome: expectedEvent.outcome,
    related_record_id: expectedEvent.relatedRecordId,
    mutation_fingerprint: expectedEvent.mutationFingerprint,
    created_at: expectedEvent.createdAt,
    ...overrides,
  };
}

function createSqliteD1() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  const DB = {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...bound: SQLInputValue[]) { values = bound; return statement; },
        first() { return database.prepare(sql).get(...values) ?? null; },
        all() { return { results: database.prepare(sql).all(...values) }; },
        run() {
          const result = database.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
        get sql() { return sql; },
        get values() { return values; },
      };
      return statement;
    },
    async batch(statements: Array<{ sql: string; values: SQLInputValue[] }>) {
      database.exec('BEGIN IMMEDIATE;');
      try {
        const results = statements.map((statement) => {
          const result = database.prepare(statement.sql).run(...statement.values);
          return { success: true, meta: { changes: Number(result.changes) } };
        });
        database.exec('COMMIT;');
        return results;
      } catch (error) {
        database.exec('ROLLBACK;');
        throw error;
      }
    },
  };
  return { database, env: { DB } };
}

describe('maintenance idempotency and atomic writes', () => {
  it('looks up a bounded idempotency key without exposing private values', async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const row = storedEvent();
    const DB = {
      prepare(sql: string) {
        let values: unknown[] = [];
        const statement = {
          bind(...bound: unknown[]) { values = bound; return statement; },
          async first() { calls.push({ sql, values }); return row; },
        };
        return statement;
      },
    };

    assert.equal(await replayMaintenanceEvent({ DB }, expectedEvent.idempotencyKey), row);
    assert.deepEqual(calls[0].values, [expectedEvent.idempotencyKey]);
    assert.match(calls[0].sql, /FROM registry_maintenance_events/i);
    assert.doesNotMatch(calls[0].sql, /private_notes|document_reference|amount_minor|acquirer_reference/i);
    await assert.rejects(
      () => replayMaintenanceEvent({ DB }, 'x'.repeat(129)),
      /invalid_idempotency_key/,
    );
  });

  it('replays only an exact canonical request and conflicts on key reuse', () => {
    assert.deepEqual(classifyMaintenanceIdempotency(storedEvent(), expectedEvent), {
      kind: 'replay',
      event: storedEvent(),
    });
    assert.deepEqual(classifyMaintenanceIdempotency(null, expectedEvent), { kind: 'miss' });
    assert.equal(classifyMaintenanceIdempotency(
      storedEvent(),
      { ...expectedEvent, after: { acquiredAt: '2026-03-01T00:00:00.000Z' } },
    ).kind, 'conflict');
    assert.equal(classifyMaintenanceIdempotency(
      storedEvent(),
      { ...expectedEvent, reason: 'A different request.' },
    ).kind, 'conflict');
    assert.equal(classifyMaintenanceIdempotency(
      storedEvent(),
      { ...expectedEvent, mutationFingerprint: 'b'.repeat(64) },
    ).kind, 'conflict');
  });

  it('binds maintenance events to the unlocked administrator identity, never body identity', () => {
    const seen: Array<{ sql: string; values: unknown[] }> = [];
    const env = {
      DB: {
        prepare(sql: string) {
          return {
            bind(...values: unknown[]) {
              const statement = { sql, values };
              seen.push(statement);
              return statement;
            },
          };
        },
      },
    };
    buildMaintenanceEventStatement(env, {
      ...expectedEvent,
      administratorUserId: 'forged-user',
      administratorEmail: 'forged@example.com',
    });
    assert.ok(seen[0].values.includes('admin-1'));
    assert.ok(seen[0].values.includes('admin@example.com'));
    assert.equal(seen[0].values.includes('forged-user'), false);
    assert.equal(seen[0].values.includes('forged@example.com'), false);
    assert.match(seen[0].sql, /WHERE changes\(\) = 1/i);
  });

  it('allowlists event types and snapshots while recursively rejecting sensitive keys', () => {
    const env = {
      DB: {
        prepare(sql: string) {
          return { bind(...values: unknown[]) { return { sql, values }; } };
        },
      },
    };

    assert.doesNotThrow(() => buildMaintenanceEventStatement(env, {
      ...expectedEvent,
      before: { amountMinor: 100, currency: 'USD', privateNotes: 'private' },
      after: { amountMinor: 120, currency: 'USD', privateNotes: 'corrected' },
    }));
    for (const event of [
      { ...expectedEvent, eventType: 'arbitrary_event' },
      { ...expectedEvent, eventType: '__proto__' },
      { ...expectedEvent, before: { unknownField: 'value' } },
      {
        ...expectedEvent,
        eventType: 'metadata_corrected',
        after: { metadata: { evidence: { ownershipCode: 'forbidden' } } },
      },
      {
        ...expectedEvent,
        eventType: 'metadata_corrected',
        before: { amountMinor: 100 },
        after: { amountMinor: 120 },
      },
    ]) {
      assert.throws(() => buildMaintenanceEventStatement(env, event), /invalid_(event_type|snapshot)/);
    }
  });

  it('builds only allowlisted versioned target updates and rejects unknown descriptors before DB', async () => {
    const eventRows: unknown[][] = [];
    const prepared: Array<{ sql: string; values: unknown[] }> = [];
    let mutationChanges = 1;
    const env = {
      DB: {
        prepare(sql: string) {
          return { bind(...values: unknown[]) {
            const statement = { sql, values };
            prepared.push(statement);
            return statement;
          } };
        },
        async batch(statements: Array<Record<string, unknown>>) {
          if (mutationChanges === 1) eventRows.push((statements[1].values ?? []) as unknown[]);
          return [
            { success: true, meta: { changes: mutationChanges } },
            { success: true, meta: { changes: mutationChanges === 1 ? 1 : 0 } },
          ];
        },
      },
    };

    assert.deepEqual(await commitMaintenanceMutation(env, {
      target: { type: 'acquisition', id: 'acq-1', keeperPieceId: 'kp-maint' },
      changes: { acquiredAt: '2026-02-01T00:00:00.000Z' },
      event: expectedEvent,
    } as any), { ok: false, error: 'invalid_expected_version' });
    assert.equal(prepared.length, 0);

    const success = await commitMaintenanceMutation(env, {
      target: { type: 'acquisition', id: 'acq-1', keeperPieceId: 'kp-maint' },
      changes: { acquiredAt: '2026-02-01T00:00:00.000Z' },
      event: expectedEvent,
      expectedVersion: 2,
    });
    assert.equal(success.ok, true);
    assert.match(prepared[0].sql, /^UPDATE artwork_acquisitions/i);
    assert.match(prepared[0].sql, /record_version = record_version \+ 1/i);
    assert.match(
      prepared[0].sql,
      /WHERE id = \?2 AND record_version = \?3 AND keeper_piece_id = \?4\s+AND acquired_at IS \?5/i,
    );
    assert.deepEqual(prepared[0].values, [
      '2026-02-01T00:00:00.000Z', 'acq-1', 2, 'kp-maint',
      '2026-01-01T00:00:00.000Z',
    ]);
    assert.equal(eventRows.length, 1);

    await commitMaintenanceMutation(env, {
      target: { type: 'keeper_record', id: 'kp-maint', artworkId: 'UL-101' },
      changes: { pieceId: 'UL-101', editionNumber: 1 },
      event: {
        ...expectedEvent,
        idempotencyKey: 'keeper-record-update',
        eventType: 'link_corrected',
        artworkId: 'UL-101',
        relatedRecordId: 'kp-maint',
        before: {
          keeperPieceId: 'kp-maint', pieceId: 'UL-100', editionNumber: 0, recordVersion: 2,
        },
        after: {
          keeperPieceId: 'kp-maint', pieceId: 'UL-101', editionNumber: 1, recordVersion: 3,
        },
      },
      expectedVersion: 2,
    });
    assert.match(prepared[2].sql, /^UPDATE keeper_pieces/i);
    assert.match(prepared[2].sql, /piece_id = \?1/);
    assert.match(prepared[2].sql, /edition_number = \?2/);
    assert.match(prepared[2].sql, /record_version = record_version \+ 1/);
    assert.match(prepared[2].sql, /piece_id IS \?5 AND edition_number IS \?6/);
    assert.deepEqual(prepared[2].values, [
      'UL-101', 1, 'kp-maint', 2, 'UL-100', 0,
    ]);

    await commitMaintenanceMutation(env, {
      target: { type: 'keeper_steward', id: 'kp-maint', artworkId: 'UL-100' },
      changes: { currentDisplayLocation: 'Ubud studio' },
      event: {
        ...expectedEvent,
        idempotencyKey: 'keeper-steward-update',
        eventType: 'steward_transferred',
        artworkId: 'UL-100',
        relatedRecordId: 'kp-maint',
        before: {
          keeperPieceId: 'kp-maint', artworkId: 'UL-100',
          currentDisplayLocation: null, stewardVersion: 1,
        },
        after: {
          keeperPieceId: 'kp-maint', artworkId: 'UL-100',
          currentDisplayLocation: 'Ubud studio', stewardVersion: 2,
        },
      },
      expectedVersion: 1,
    });
    assert.match(prepared[4].sql, /^UPDATE keeper_pieces/i);
    assert.match(prepared[4].sql, /current_display_location = \?1/);
    assert.match(prepared[4].sql, /steward_version = steward_version \+ 1/);
    assert.match(prepared[4].sql, /piece_id IS \?4/);
    assert.deepEqual(prepared[4].values, ['Ubud studio', 'kp-maint', 1, 'UL-100', null]);

    const prepareCount = prepared.length;
    for (const request of [
      {
        target: { type: 'unknown', id: 'acq-1' },
        changes: { acquiredAt: '2026-02-01T00:00:00.000Z' },
      },
      {
        target: { type: '__proto__', id: 'acq-1' },
        changes: { acquiredAt: '2026-02-01T00:00:00.000Z' },
      },
      {
        target: { type: 'acquisition', id: 'acq-1', keeperPieceId: 'kp-maint' },
        changes: { ownershipCode: 'forbidden' },
      },
      {
        target: { type: 'keeper_record', id: 'kp-maint', artworkId: 'UL-100' },
        changes: { recoveryCodeHash: 'forbidden-generic-repair' },
      },
    ]) {
      assert.deepEqual(await commitMaintenanceMutation(env, {
        ...request,
        event: expectedEvent,
        expectedVersion: 2,
      }), { ok: false, error: 'invalid_maintenance_target' });
    }
    assert.equal(prepared.length, prepareCount);

    for (const request of [
      {
        target: { type: 'keeper_record', id: 'kp-maint', artworkId: 'UL-101' },
        changes: { pieceId: 'UL-101' },
        event: {
          ...expectedEvent,
          eventType: 'steward_transferred',
          before: { keeperUserId: null },
          after: { keeperUserId: 'keeper-2' },
        },
      },
      {
        target: { type: 'keeper_record', id: 'kp-maint', artworkId: 'UL-101' },
        changes: { pieceId: 'UL-101' },
        event: {
          ...expectedEvent,
          eventType: 'link_corrected',
          relatedRecordId: 'kp-fabricated',
          before: { keeperPieceId: 'kp-maint', pieceId: 'UL-100', recordVersion: 2 },
          after: { keeperPieceId: 'kp-maint', pieceId: 'UL-101', recordVersion: 3 },
        },
      },
      {
        target: { type: 'keeper_steward', id: 'kp-maint', artworkId: 'UL-100' },
        changes: { currentDisplayLocation: 'Ubud studio' },
        event: {
          ...expectedEvent,
          eventType: 'steward_transferred',
          artworkId: 'UL-100',
          relatedRecordId: 'kp-maint',
          before: {
            keeperPieceId: 'kp-maint', artworkId: 'UL-100',
            currentDisplayLocation: null, stewardVersion: 2,
          },
          after: {
            keeperPieceId: 'kp-maint', artworkId: 'UL-100',
            currentDisplayLocation: 'Ubud studio', stewardVersion: 4,
          },
        },
      },
      {
        target: { type: 'acquisition', id: 'acq-1', keeperPieceId: 'kp-maint' },
        changes: { acquiredAt: '2026-02-01T00:00:00.000Z' },
        event: { ...expectedEvent, before: {}, after: {} },
      },
      {
        target: { type: 'acquisition', id: 'acq-1', keeperPieceId: 'kp-maint' },
        changes: { acquiredAt: '2026-02-01T00:00:00.000Z' },
        event: {
          ...expectedEvent,
          before: { acquiredAt: '2026-01-01T00:00:00.000Z', amountMinor: 100 },
          after: { acquiredAt: '2026-02-01T00:00:00.000Z', amountMinor: 100 },
        },
      },
      {
        target: { type: 'acquisition', id: 'acq-1', keeperPieceId: 'kp-maint' },
        changes: { acquiredAt: '2026-02-01T00:00:00.000Z' },
        event: {
          ...expectedEvent,
          after: { acquiredAt: '2026-03-01T00:00:00.000Z' },
        },
      },
      {
        target: { type: 'acquisition', id: 'acq-1', keeperPieceId: 'kp-maint' },
        changes: { acquiredAt: '2026-02-01T00:00:00.000Z' },
        event: { ...expectedEvent, outcome: 'failed' },
      },
      {
        target: { type: 'keeper_record', id: 'kp-maint', artworkId: 'UL-101' },
        changes: { pieceId: 'UL-101' },
        event: {
          ...expectedEvent,
          eventType: 'metadata_corrected',
          before: { pieceId: 'UL-100' },
          after: { pieceId: 'UL-101' },
        },
      },
    ]) {
      assert.deepEqual(await commitMaintenanceMutation(env, {
        ...request,
        expectedVersion: 2,
      }), { ok: false, error: 'invalid_event_mutation' });
    }
    assert.equal(prepared.length, prepareCount);

    mutationChanges = 0;
    assert.deepEqual(await commitMaintenanceMutation(env, {
      target: { type: 'acquisition', id: 'acq-1', keeperPieceId: 'kp-maint' },
      changes: { acquiredAt: '2026-02-01T00:00:00.000Z' },
      event: {
        ...expectedEvent,
        idempotencyKey: 'new-stale-key',
        before: { ...expectedEvent.before, recordVersion: 1 },
        after: { ...expectedEvent.after, recordVersion: 2 },
      },
      expectedVersion: 1,
    }), { ok: false, error: 'version_conflict' });
  });

  it('requires successful D1 results in addition to one changed row', async () => {
    for (const results of [
      [
        { success: false, meta: { changes: 1 } },
        { success: true, meta: { changes: 1 } },
      ],
      [
        { success: true, meta: { changes: 1 } },
        { success: false, meta: { changes: 1 } },
      ],
    ]) {
      const env = {
        DB: {
          prepare(sql: string) {
            return { bind(...values: unknown[]) { return { sql, values }; } };
          },
          async batch() { return results; },
        },
      };
      assert.deepEqual(await commitMaintenanceMutation(env, {
        target: { type: 'acquisition', id: 'acq-1', keeperPieceId: 'kp-maint' },
        changes: { acquiredAt: '2026-02-01T00:00:00.000Z' },
        event: {
          ...expectedEvent,
          before: { ...expectedEvent.before, recordVersion: 3 },
          after: { ...expectedEvent.after, recordVersion: 4 },
        },
        expectedVersion: 3,
      }), { ok: false, error: 'maintenance_write_failed' });
    }
  });

  it('returns a safe write failure and never claims success when the atomic batch rejects', async () => {
    const env = {
      DB: {
        prepare(sql: string) {
          return { bind(...values: unknown[]) { return { sql, values }; } };
        },
        async batch() { throw new Error('private database detail'); },
      },
    };
    assert.deepEqual(await commitMaintenanceMutation(env, {
      target: { type: 'acquisition', id: 'acq-1', keeperPieceId: 'kp-maint' },
      changes: { acquiredAt: '2026-02-01T00:00:00.000Z' },
      event: expectedEvent,
      expectedVersion: 2,
    }), { ok: false, error: 'maintenance_write_failed' });
  });

  it('rejects fabricated audit identity and versions, and verifies prior values in SQLite', async () => {
    const { database, env } = createSqliteD1();
    try {
      database.exec(`${registryMigrations}\n${keeperInsert}\n
        INSERT INTO artwork_acquisitions
          (id, keeper_piece_id, acquisition_type, public_provenance, created_at, updated_at)
        VALUES
          ('acq-1', 'kp-maint', 'sale', 'Original', '2026-07-30T00:00:00.000Z',
           '2026-07-30T00:00:00.000Z');
      `);
      const event = {
        ...expectedEvent,
        idempotencyKey: 'audit-identity-base',
        before: {
          acquisitionId: 'acq-1', keeperPieceId: 'kp-maint',
          publicProvenance: 'Original', recordVersion: 1,
        },
        after: {
          acquisitionId: 'acq-1', keeperPieceId: 'kp-maint',
          publicProvenance: 'Corrected', recordVersion: 2,
        },
      };
      const request = {
        target: { type: 'acquisition', id: 'acq-1', keeperPieceId: 'kp-maint' },
        changes: { publicProvenance: 'Corrected' },
        event,
        expectedVersion: 1,
      };

      for (const [override, error] of [
        [{ target: { type: 'acquisition', id: 'acq-1' } }, 'invalid_maintenance_target'],
        [{ event: { ...event, artworkId: 'UL-fabricated' } }, 'invalid_event_mutation'],
        [{ event: { ...event, keeperPieceId: 'kp-fabricated' } }, 'invalid_event_mutation'],
        [{ event: { ...event, relatedRecordId: 'acq-fabricated' } }, 'invalid_event_mutation'],
        [{
          event: {
            ...event,
            before: { ...event.before, acquisitionId: 'acq-fabricated' },
          },
        }, 'invalid_event_mutation'],
        [{
          event: {
            ...event,
            before: { ...event.before, publicCode: 'AR-FABRICATED' },
          },
        }, 'invalid_event_mutation'],
        [{
          event: {
            ...event,
            after: { ...event.after, keeperPieceId: 'kp-fabricated' },
          },
        }, 'invalid_event_mutation'],
        [{
          event: {
            ...event,
            before: { ...event.before, recordVersion: 0 },
          },
        }, 'version_conflict'],
        [{
          event: {
            ...event,
            after: { ...event.after, recordVersion: 3 },
          },
        }, 'invalid_event_mutation'],
        [{
          event: {
            ...event,
            eventType: 'acquisition_created',
            before: null,
          },
        }, 'invalid_event_mutation'],
      ] as const) {
        assert.deepEqual(await commitMaintenanceMutation(env, {
          ...request,
          ...override,
        }), { ok: false, error });
      }

      assert.deepEqual(await commitMaintenanceMutation(env, {
        ...request,
        target: { type: 'acquisition', id: 'acq-1', keeperPieceId: 'kp-fabricated' },
        event: {
          ...event,
          idempotencyKey: 'fabricated-target-association',
          keeperPieceId: 'kp-fabricated',
          before: { ...event.before, keeperPieceId: 'kp-fabricated' },
          after: { ...event.after, keeperPieceId: 'kp-fabricated' },
        },
      }), { ok: false, error: 'version_conflict' });

      assert.deepEqual(await commitMaintenanceMutation(env, {
        ...request,
        event: {
          ...event,
          idempotencyKey: 'fabricated-prior-value',
          before: { ...event.before, publicProvenance: 'Fabricated' },
        },
      }), { ok: false, error: 'version_conflict' });
      assert.deepEqual({ ...database.prepare(
        "SELECT public_provenance, record_version FROM artwork_acquisitions WHERE id = 'acq-1'",
      ).get() }, { public_provenance: 'Original', record_version: 1 });
      assert.equal(database.prepare('SELECT count(*) AS count FROM registry_maintenance_events').get().count, 0);
    } finally {
      database.close();
    }
  });

  it('guards keeper artwork context and rejects unverified snapshot context in SQLite', async () => {
    const { database, env } = createSqliteD1();
    try {
      database.exec(`${registryMigrations}\n${keeperInsert}`);

      assert.deepEqual(await commitMaintenanceMutation(env, {
        target: { type: 'keeper_record', id: 'kp-maint', artworkId: 'UL-101' },
        changes: { pieceId: 'UL-101' },
        event: {
          ...expectedEvent,
          idempotencyKey: 'fabricated-public-code-context',
          eventType: 'link_corrected',
          artworkId: 'UL-101',
          relatedRecordId: 'kp-maint',
          before: {
            keeperPieceId: 'kp-maint', pieceId: 'UL-100',
            publicCode: 'AR-FABRICATED', recordVersion: 0,
          },
          after: { keeperPieceId: 'kp-maint', pieceId: 'UL-101', recordVersion: 1 },
        },
        expectedVersion: 0,
      }), { ok: false, error: 'invalid_event_mutation' });

      const stewardEvent = {
        ...expectedEvent,
        idempotencyKey: 'honest-steward-context',
        eventType: 'steward_transferred',
        artworkId: 'UL-100',
        relatedRecordId: 'kp-maint',
        before: {
          keeperPieceId: 'kp-maint', artworkId: 'UL-100',
          currentDisplayLocation: null, stewardVersion: 0,
        },
        after: {
          keeperPieceId: 'kp-maint', artworkId: 'UL-100',
          currentDisplayLocation: 'Ubud studio', stewardVersion: 1,
        },
      };
      assert.deepEqual(await commitMaintenanceMutation(env, {
        target: { type: 'keeper_steward', id: 'kp-maint', artworkId: 'UL-fabricated' },
        changes: { currentDisplayLocation: 'Ubud studio' },
        event: {
          ...stewardEvent,
          idempotencyKey: 'fabricated-artwork-context',
          artworkId: 'UL-fabricated',
          before: { ...stewardEvent.before, artworkId: 'UL-fabricated' },
          after: { ...stewardEvent.after, artworkId: 'UL-fabricated' },
        },
        expectedVersion: 0,
      }), { ok: false, error: 'version_conflict' });

      const honestRequest = {
        target: { type: 'keeper_steward', id: 'kp-maint', artworkId: 'UL-100' },
        changes: { currentDisplayLocation: 'Ubud studio' },
        event: stewardEvent,
        expectedVersion: 0,
      };
      assert.equal((await commitMaintenanceMutation(env, honestRequest)).ok, true);
      const replay = await commitMaintenanceMutation(env, honestRequest);
      assert.equal(replay.ok, true);
      assert.equal(replay.replayed, true);
      assert.deepEqual({ ...database.prepare(
        "SELECT piece_id, current_display_location, steward_version FROM keeper_pieces WHERE id = 'kp-maint'",
      ).get() }, {
        piece_id: 'UL-100', current_display_location: 'Ubud studio', steward_version: 1,
      });
    } finally {
      database.close();
    }
  });

  it('rolls back failed events and resolves retries as replay or idempotency conflict', async () => {
    const { database, env } = createSqliteD1();
    try {
      database.exec(`${registryMigrations}\n${keeperInsert}\n
        INSERT INTO artwork_acquisitions
          (id, keeper_piece_id, acquisition_type, public_provenance, created_at, updated_at)
        VALUES
          ('acq-1', 'kp-maint', 'sale', 'Original', '2026-07-30T00:00:00.000Z',
           '2026-07-30T00:00:00.000Z');
      `);
      const event = {
        ...expectedEvent,
        before: {
          acquisitionId: 'acq-1', keeperPieceId: 'kp-maint',
          publicProvenance: 'Original', recordVersion: 1,
        },
        after: {
          acquisitionId: 'acq-1', keeperPieceId: 'kp-maint',
          publicProvenance: 'Corrected', recordVersion: 2,
        },
      };
      const request = {
        target: { type: 'acquisition', id: 'acq-1', keeperPieceId: 'kp-maint' },
        changes: { publicProvenance: 'Corrected' },
        event,
        expectedVersion: 1,
      };

      const first = await commitMaintenanceMutation(env, request);
      assert.equal(first.ok, true);
      assert.equal(first.replayed, undefined);

      const replay = await commitMaintenanceMutation(env, request);
      assert.equal(replay.ok, true);
      assert.equal(replay.replayed, true);

      assert.deepEqual(await commitMaintenanceMutation(env, {
        ...request,
        event: {
          ...event,
          before: { ...event.before, publicProvenance: 'Corrected', recordVersion: 2 },
          after: { ...event.after, recordVersion: 3 },
        },
        expectedVersion: 2,
      }), { ok: false, error: 'idempotency_conflict' });

      const conflict = await commitMaintenanceMutation(env, {
        ...request,
        changes: { publicProvenance: 'Should roll back' },
        event: {
          ...event,
          reason: 'Different reuse of the same key.',
          before: { ...event.before, publicProvenance: 'Corrected', recordVersion: 2 },
          after: { ...event.after, publicProvenance: 'Should roll back', recordVersion: 3 },
        },
        expectedVersion: 2,
      });
      assert.deepEqual(conflict, { ok: false, error: 'idempotency_conflict' });

      const row = database.prepare(
        "SELECT public_provenance, record_version FROM artwork_acquisitions WHERE id = 'acq-1'",
      ).get();
      assert.deepEqual({ ...row }, { public_provenance: 'Corrected', record_version: 2 });

      assert.deepEqual(await commitMaintenanceMutation(env, {
        ...request,
        event: { ...event, idempotencyKey: 'stale-without-event' },
        expectedVersion: 1,
      }), { ok: false, error: 'version_conflict' });
    } finally {
      database.close();
    }
  });
});

const adminIdentity = {
  userId: 'admin-1',
  email: 'artist@example.com',
  session: { id: 'admin-session' },
};

function acquisitionInput(overrides: Record<string, unknown> = {}) {
  return {
    acquisitionType: 'sale',
    acquiredAt: '2026-07-29T12:30:00Z',
    amountMinor: 125000,
    currency: 'IDR',
    acquirerReference: 'collector-ref',
    privateNotes: 'Private acquisition note',
    documentReference: 'r2://private-receipt',
    publicProvenance: 'Acquired directly from the artist.',
    ...overrides,
  };
}

function adminRequest(path: string, method = 'GET', body?: unknown, cookie?: string) {
  const headers = new Headers({ Origin: 'https://adrianrasmussen.com' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('Cookie', cookie);
  return new Request(`https://adrianrasmussen.com${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function unlockedCookie(env: Record<string, unknown>) {
  const { createRegistryUnlockToken } = await import('../functions/api/_lib/admin.js');
  const token = await createRegistryUnlockToken(env, adminIdentity);
  return `registry_unlock=${token}`;
}

const ownershipCrypto = {
  OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
  OWNERSHIP_CODE_KEY_V1: Buffer.alloc(32, 42).toString('base64'),
};

async function seedGeneratedPlate(env: any, input: Record<string, unknown> = {}) {
  const {
    createRegistryPlateCandidate,
    registryPlateInsertStatement,
  } = await import('../functions/api/_lib/registryPlateIssuance.js');
  const candidate = await createRegistryPlateCandidate({ ...env, ...ownershipCrypto }, {
    keeperPieceId: 'kp-lifecycle',
    pieceId: 'UL-100',
    editionNumber: 0,
    issuanceKey: 'initial-lifecycle-issuance',
    publicCode: 'AR-7KQ9M2WX',
    ownershipCode: 'J4KM-7NQP-X2RD-9VTC',
    generatedAt: '2026-07-30T00:00:00.000Z',
    ...input,
  });
  await env.DB.batch([
    registryPlateInsertStatement(env, candidate),
    lineageStatement(env, candidate.lineageEvent, { onlyIfPreviousChanged: true }),
    lineageAnchorStatement(env, candidate.lineageEvent, { onlyIfPreviousChanged: true }),
  ]);
  return candidate;
}

describe('dedicated acquisition creation', () => {
  it('creates one private integer-minor record and event, replays exactly, and conflicts on reuse', async () => {
    const { database, env } = createSqliteD1();
    try {
      database.exec(`${registryMigrations}\n${keeperInsert}`);
      const request = {
        keeperPieceId: 'kp-maint',
        acquisition: acquisitionInput(),
        authorization: adminIdentity,
        reason: 'Record the original acquisition.',
        idempotencyKey: 'create-acquisition-1',
        acquisitionId: 'acq-created',
        eventId: 'rme-created',
        createdAt: '2026-07-30T06:00:00.000Z',
      };

      const created = await commitAcquisitionCreate(env, request);
      assert.equal(created.ok, true);
      assert.equal(created.replayed, false);
      assert.deepEqual(created.acquisition, {
        acquisitionId: 'acq-created',
        keeperPieceId: 'kp-maint',
        ...normalizeAcquisitionInput(acquisitionInput()).acquisition,
        recordVersion: 1,
        createdAt: '2026-07-30T06:00:00.000Z',
        updatedAt: '2026-07-30T06:00:00.000Z',
      });
      assert.deepEqual({ ...database.prepare(
        "SELECT amount_minor, typeof(amount_minor) AS amount_type, currency FROM artwork_acquisitions WHERE id = 'acq-created'",
      ).get() }, { amount_minor: 125000, amount_type: 'integer', currency: 'IDR' });
      assert.equal(database.prepare('SELECT count(*) AS count FROM registry_maintenance_events').get().count, 1);

      const replay = await commitAcquisitionCreate(env, request);
      assert.equal(replay.ok, true);
      assert.equal(replay.replayed, true);
      assert.deepEqual(replay.acquisition, created.acquisition);
      assert.equal(database.prepare('SELECT count(*) AS count FROM artwork_acquisitions').get().count, 1);

      assert.deepEqual(await commitAcquisitionCreate(env, {
        ...request,
        acquisition: acquisitionInput({ amountMinor: 125001 }),
      }), { ok: false, error: 'idempotency_conflict' });
      assert.deepEqual(await commitAcquisitionCreate(env, {
        ...request,
        keeperPieceId: 'kp-missing',
        idempotencyKey: 'missing-piece-create',
        acquisitionId: 'acq-missing',
        eventId: 'rme-missing',
      }), { ok: false, error: 'keeper_piece_not_found' });
    } finally {
      database.close();
    }
  });

  it('never reports success when either atomic write result fails', async () => {
    const request = {
      keeperPieceId: 'kp-maint', acquisition: acquisitionInput(), authorization: adminIdentity,
      reason: 'Record acquisition.', idempotencyKey: 'atomic-create',
    };
    for (const results of [
      [{ success: false, meta: { changes: 1 } }, { success: true, meta: { changes: 1 } }],
      [{ success: true, meta: { changes: 1 } }, { success: false, meta: { changes: 1 } }],
    ]) {
      const env = {
        DB: {
          prepare(sql: string) {
            return {
              bind(...values: unknown[]) { return { sql, values }; },
              first() { return null; },
            };
          },
          async batch() { return results; },
        },
      };
      assert.deepEqual(await commitAcquisitionCreate(env, request), {
        ok: false, error: 'maintenance_write_failed',
      });
    }
  });
});

describe('private maintenance APIs', () => {
  it('requires admin access and returns searchable summaries plus safe private detail', async () => {
    const { database, env: sqliteEnv } = createSqliteD1();
    try {
      database.exec(`${registryMigrations}\n${keeperInsert}\n
        UPDATE keeper_pieces SET keeper_user_id = 'keeper-1', claimed_at = '2026-07-20T00:00:00.000Z',
          backup_status = 'verified', backup_at = '2026-07-21T00:00:00.000Z',
          ownership_code_ciphertext = 'PRIVATE-CIPHERTEXT', ownership_code_nonce = 'PRIVATE-NONCE',
          ownership_code_key_version = 7, recovery_code_hash = 'PRIVATE-VERIFIER'
        WHERE id = 'kp-maint';
        INSERT INTO users (clerk_user_id, email) VALUES ('keeper-1', 'keeper@example.com');
        INSERT INTO artwork_acquisitions
          (id, keeper_piece_id, acquisition_type, acquired_at, amount_minor, currency,
           private_notes, created_at, updated_at)
        VALUES ('acq-private', 'kp-maint', 'sale', '2026-07-29T12:30:00.000Z',
          125000, 'IDR', 'Private acquisition note', '2026-07-30T06:00:00.000Z',
          '2026-07-30T06:00:00.000Z');
        INSERT INTO registry_maintenance_events
          (id, idempotency_key, event_type, keeper_piece_id, administrator_user_id,
           administrator_email, reason, before_json, after_json, outcome,
           related_record_id, mutation_fingerprint, created_at)
        VALUES ('rme-private', 'private-event', 'acquisition_created', 'kp-maint', 'admin-1',
          'artist@example.com', 'Record acquisition.', 'null',
          '{"acquisitionId":"acq-private"}', 'succeeded', 'acq-private',
          '${'d'.repeat(64)}', '2026-07-30T06:00:00.000Z');
        INSERT INTO registry_maintenance_events
          (id, idempotency_key, event_type, keeper_piece_id, administrator_user_id,
           administrator_email, reason, before_json, after_json, outcome,
           related_record_id, mutation_fingerprint, created_at)
        VALUES ('rme-malicious', 'malicious-event', 'acquisition_created', 'kp-maint', 'admin-1',
          'artist@example.com', 'Legacy direct row.',
          '{"recoveryCode":"LEAK-RECOVERY","nested":{"ciphertext":"LEAK-CIPHERTEXT"}}',
          '{"acquisitionId":"acq-private","nonce":"LEAK-NONCE","verifier":"LEAK-VERIFIER"}',
          'succeeded', 'acq-private', '${'e'.repeat(64)}', '2026-07-30T07:00:00.000Z');
      `);
      const env = {
        ...sqliteEnv,
        ADMIN_EMAILS: 'artist@example.com',
        REGISTRY_STEP_UP_SECRET: 'registry-secret',
      };
      const { onRequest: list } = await import('../functions/api/admin/maintenance.js');
      const { onRequest: detail } = await import('../functions/api/admin/maintenance/[id].js');

      maintenanceSession = null;
      assert.equal((await list({ request: adminRequest('/api/admin/maintenance'), env })).status, 401);
      maintenanceSession = {
        session: adminIdentity.session,
        user: { id: adminIdentity.userId, email: adminIdentity.email, emailVerified: true },
      };
      assert.equal((await list({
        request: adminRequest('/api/admin/maintenance?unknown=value'), env,
      })).status, 400);
      for (const removedFilter of [
        'stewardEmail=keeper%40example.com',
        'acquiredFrom=2026-07-01',
        'acquiredTo=2026-07-31',
        'hasAcquisition=true',
      ]) {
        const removedResponse = await list({
          request: adminRequest(`/api/admin/maintenance?${removedFilter}`), env,
        });
        assert.equal(removedResponse.status, 400, removedFilter);
        assert.deepEqual(
          await removedResponse.json(),
          { ok: false, error: 'unknown_filter' },
          removedFilter,
        );
      }
      for (const filter of [
        'publicCode=AR-7KQ9M2WX',
        'artworkId=UL-100',
      ]) {
        const filteredResponse = await list({
          request: adminRequest(`/api/admin/maintenance?${filter}`), env,
        });
        assert.equal(filteredResponse.status, 200, filter);
        const filtered = await filteredResponse.json();
        assert.equal(filtered.pieces.length, 1, filter);
        assert.equal(filtered.pieces[0].id, 'kp-maint', filter);
      }
      const listResponse = await list({
        request: adminRequest('/api/admin/maintenance?title=Art%20of%20Living&editionNumber=0'),
        env,
      });
      assert.equal(listResponse.status, 200);
      const listed = await listResponse.json();
      assert.equal(listed.pieces.length, 1);
      assert.equal(listed.pieces[0].title, 'Art of Living - 32');
      assert.deepEqual(Object.keys(listed.pieces[0]).sort(), [
        'artworkId', 'editionNumber', 'id', 'plateStatus', 'publicCode', 'title',
      ]);
      assert.doesNotMatch(
        JSON.stringify(listed.pieces),
        /keeper@example\.com|acquisition|backupStatus|registeredAt|steward|recordVersion/i,
      );

      const detailResponse = await detail({
        request: adminRequest('/api/admin/maintenance/kp-maint'), env, params: { id: 'kp-maint' },
      });
      assert.equal(detailResponse.status, 200);
      const detailed = await detailResponse.json();
      assert.equal(detailed.piece.public.title, 'Art of Living - 32');
      assert.deepEqual(detailed.piece.physical.recovery, {
        verifierPresent: true, envelopePresent: true, backupStatus: 'verified',
        backupAt: '2026-07-21T00:00:00.000Z',
      });
      assert.equal(detailed.piece.acquisitions[0].amountMinor, 125000);
      assert.equal(detailed.piece.maintenanceHistory[0].reason, 'Record acquisition.');
      const redactedHistory = detailed.piece.maintenanceHistory.find(
        (event: { id: string }) => event.id === 'rme-malicious',
      );
      assert.deepEqual({
        before: redactedHistory.before,
        after: redactedHistory.after,
        warning: redactedHistory.warning,
      }, {
        before: null,
        after: null,
        warning: 'unsafe_snapshots_redacted',
      });
      const serialized = JSON.stringify({ listed, detailed });
      const serializedHistory = JSON.stringify(detailed.piece.maintenanceHistory);
      assert.doesNotMatch(serialized, /PRIVATE-(?:CIPHERTEXT|NONCE|VERIFIER)/);
      assert.doesNotMatch(
        serializedHistory,
        /ownershipCode|recoveryCode|ciphertext|nonce|verifier|keyVersion/i,
      );
      assert.doesNotMatch(serializedHistory, /LEAK-(?:RECOVERY|CIPHERTEXT|NONCE|VERIFIER)/);
    } finally {
      maintenanceSession = null;
      database.close();
    }
  });

  it('requires registry unlock for create and correction, with exact replay and stale protection', async () => {
    const { database, env: sqliteEnv } = createSqliteD1();
    try {
      database.exec(`${registryMigrations}\n${keeperInsert}`);
      const env = {
        ...sqliteEnv,
        ADMIN_EMAILS: 'artist@example.com',
        REGISTRY_STEP_UP_SECRET: 'registry-secret',
      };
      maintenanceSession = {
        session: adminIdentity.session,
        user: { id: adminIdentity.userId, email: adminIdentity.email, emailVerified: true },
      };
      const cookie = await unlockedCookie(env);
      const { onRequest: create } = await import('../functions/api/admin/maintenance/[id]/acquisitions.js');
      const { onRequest: correct } = await import('../functions/api/admin/maintenance/[id]/acquisitions/[acquisitionId].js');
      const createBody = {
        idempotencyKey: 'api-create-acq', reason: 'Record the acquisition.',
        acquisition: acquisitionInput(),
      };
      assert.equal((await create({
        request: adminRequest('/api/admin/maintenance/kp-maint/acquisitions', 'POST', createBody),
        env, params: { id: 'kp-maint' },
      })).status, 403);

      const createdResponse = await create({
        request: adminRequest('/api/admin/maintenance/kp-maint/acquisitions', 'POST', createBody, cookie),
        env, params: { id: 'kp-maint' },
      });
      assert.equal(createdResponse.status, 201);
      const created = await createdResponse.json();
      assert.equal(created.acquisition.amountMinor, 125000);
      const acquisitionId = created.acquisition.acquisitionId;

      const replay = await create({
        request: adminRequest('/api/admin/maintenance/kp-maint/acquisitions', 'POST', createBody, cookie),
        env, params: { id: 'kp-maint' },
      });
      assert.equal(replay.status, 200);
      assert.equal((await replay.json()).replayed, true);
      const conflictingCreate = await create({
        request: adminRequest('/api/admin/maintenance/kp-maint/acquisitions', 'POST', {
          ...createBody, acquisition: acquisitionInput({ amountMinor: 125001 }),
        }, cookie),
        env, params: { id: 'kp-maint' },
      });
      assert.equal(conflictingCreate.status, 409);

      const correctionBody = {
        idempotencyKey: 'api-correct-acq', reason: 'Correct the private amount.', expectedVersion: 1,
        acquisition: acquisitionInput({ amountMinor: 130000 }),
      };
      const correctedResponse = await correct({
        request: adminRequest(`/api/admin/maintenance/kp-maint/acquisitions/${acquisitionId}`, 'PUT', correctionBody, cookie),
        env, params: { id: 'kp-maint', acquisitionId },
      });
      assert.equal(correctedResponse.status, 200);
      const corrected = await correctedResponse.json();
      assert.equal(corrected.acquisition.amountMinor, 130000);
      assert.equal(corrected.acquisition.recordVersion, 2);

      const correctionReplay = await correct({
        request: adminRequest(`/api/admin/maintenance/kp-maint/acquisitions/${acquisitionId}`, 'PUT', correctionBody, cookie),
        env, params: { id: 'kp-maint', acquisitionId },
      });
      assert.equal(correctionReplay.status, 200);
      assert.equal((await correctionReplay.json()).replayed, true);
      const stale = await correct({
        request: adminRequest(`/api/admin/maintenance/kp-maint/acquisitions/${acquisitionId}`, 'PUT', {
          ...correctionBody, idempotencyKey: 'api-stale-acq',
        }, cookie),
        env, params: { id: 'kp-maint', acquisitionId },
      });
      assert.equal(stale.status, 409);
      assert.deepEqual(await stale.json(), { ok: false, error: 'version_conflict' });
    } finally {
      maintenanceSession = null;
      database.close();
    }
  });

  it('fails closed when a stored correction replay snapshot contains private envelope fields', async () => {
    const { database, env: sqliteEnv } = createSqliteD1();
    try {
      database.exec(`${registryMigrations}\n${keeperInsert}`);
      const acquisitionId = 'acq-unsafe-replay';
      const beforeAcquisition = normalizeAcquisitionInput(acquisitionInput()).acquisition;
      const afterAcquisition = normalizeAcquisitionInput(
        acquisitionInput({ amountMinor: 130000 }),
      ).acquisition;
      const beforeSnapshot = {
        acquisitionId,
        keeperPieceId: 'kp-maint',
        ...beforeAcquisition,
        recordVersion: 1,
        updatedAt: '2026-07-30T06:00:00.000Z',
      };
      const unsafeAfterSnapshot = {
        acquisitionId,
        keeperPieceId: 'kp-maint',
        ...afterAcquisition,
        recordVersion: 2,
        updatedAt: '2026-07-30T07:00:00.000Z',
        nonce: 'LEAK-REPLAY-NONCE',
        verifier: 'LEAK-REPLAY-VERIFIER',
      };
      database.prepare(
        `INSERT INTO artwork_acquisitions
           (id, keeper_piece_id, acquisition_type, acquired_at, amount_minor, currency,
            acquirer_reference, private_notes, document_reference, public_provenance,
            record_version, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, ?11)`,
      ).run(
        acquisitionId,
        'kp-maint',
        beforeAcquisition.acquisitionType,
        beforeAcquisition.acquiredAt,
        beforeAcquisition.amountMinor,
        beforeAcquisition.currency,
        'collector-ref',
        'Private acquisition note',
        'r2://private-receipt',
        'Acquired directly from the artist.',
        beforeSnapshot.updatedAt,
      );
      database.prepare(
        `INSERT INTO registry_maintenance_events
           (id, idempotency_key, event_type, keeper_piece_id, administrator_user_id,
            administrator_email, reason, before_json, after_json, outcome,
            related_record_id, mutation_fingerprint, created_at)
         VALUES (?1, ?2, 'acquisition_corrected', ?3, ?4, ?5, ?6, ?7, ?8,
                 'succeeded', ?9, ?10, ?11)`,
      ).run(
        'rme-unsafe-replay',
        'api-unsafe-replay',
        'kp-maint',
        adminIdentity.userId,
        adminIdentity.email,
        'Correct the private amount.',
        JSON.stringify(beforeSnapshot),
        JSON.stringify(unsafeAfterSnapshot),
        acquisitionId,
        'f'.repeat(64),
        '2026-07-30T07:00:00.000Z',
      );

      const env = {
        ...sqliteEnv,
        ADMIN_EMAILS: 'artist@example.com',
        REGISTRY_STEP_UP_SECRET: 'registry-secret',
      };
      maintenanceSession = {
        session: adminIdentity.session,
        user: { id: adminIdentity.userId, email: adminIdentity.email, emailVerified: true },
      };
      const cookie = await unlockedCookie(env);
      const { onRequest: correct } = await import('../functions/api/admin/maintenance/[id]/acquisitions/[acquisitionId].js');
      const response = await correct({
        request: adminRequest(
          `/api/admin/maintenance/kp-maint/acquisitions/${acquisitionId}`,
          'PUT',
          {
            idempotencyKey: 'api-unsafe-replay',
            reason: 'Correct the private amount.',
            expectedVersion: 1,
            acquisition: acquisitionInput({ amountMinor: 130000 }),
          },
          cookie,
        ),
        env,
        params: { id: 'kp-maint', acquisitionId },
      });
      const responseText = await response.text();
      assert.equal(response.status, 503);
      assert.deepEqual(JSON.parse(responseText), { ok: false, error: 'maintenance_write_failed' });
      assert.doesNotMatch(responseText, /nonce|verifier|LEAK-REPLAY/i);
    } finally {
      maintenanceSession = null;
      database.close();
    }
  });

  it('resets steward state atomically with exact replay, conflict, and stale-version protection', async () => {
    const { database, env: sqliteEnv } = createSqliteD1();
    try {
      database.exec(`${registryMigrations}\n${keeperInsert}\n
        UPDATE keeper_pieces
           SET keeper_user_id = 'keeper-current',
               claimed_at = '2026-07-20T00:00:00.000Z',
               released_at = '2026-07-25T00:00:00.000Z',
               current_display_location = 'Ubud studio'
         WHERE id = 'kp-maint';
      `);
      const env = {
        ...sqliteEnv,
        ADMIN_EMAILS: 'artist@example.com',
        REGISTRY_STEP_UP_SECRET: 'registry-secret',
      };
      maintenanceSession = {
        session: adminIdentity.session,
        user: { id: adminIdentity.userId, email: adminIdentity.email, emailVerified: true },
      };
      const cookie = await unlockedCookie(env);
      const { onRequest: action } = await import('../functions/api/admin/maintenance/[id]/actions.js');
      const requestBody = {
        action: 'reset_steward',
        reason: 'Return this piece to the safe unclaimed state.',
        idempotencyKey: 'api-reset-steward',
        expectedStewardVersion: 1,
      };

      for (const invalidBody of [
        { ...requestBody, targetEmail: 'collector@example.com' },
        { ...requestBody, unexpected: true },
      ]) {
        const invalid = await action({
          request: adminRequest('/api/admin/maintenance/kp-maint/actions', 'POST', invalidBody, cookie),
          env,
          params: { id: 'kp-maint' },
        });
        assert.equal(invalid.status, 400);
      }

      const response = await action({
        request: adminRequest('/api/admin/maintenance/kp-maint/actions', 'POST', requestBody, cookie),
        env,
        params: { id: 'kp-maint' },
      });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.replayed, false);
      assert.deepEqual(result.steward, {
        keeperPieceId: 'kp-maint',
        artworkId: 'UL-100',
        keeperUserId: null,
        claimedAt: null,
        releasedAt: null,
        currentDisplayLocation: null,
        stewardVersion: 2,
      });
      assert.deepEqual({ ...database.prepare(
        `SELECT keeper_user_id, claimed_at, released_at, current_display_location,
                steward_version FROM keeper_pieces WHERE id = 'kp-maint'`,
      ).get() }, {
        keeper_user_id: null,
        claimed_at: null,
        released_at: null,
        current_display_location: null,
        steward_version: 2,
      });
      const event = database.prepare(
        `SELECT event_type, before_json, after_json, reason
           FROM registry_maintenance_events WHERE idempotency_key = 'api-reset-steward'`,
      ).get();
      assert.equal(event.event_type, 'steward_reset');
      assert.equal(event.reason, requestBody.reason);
      assert.equal(JSON.parse(String(event.before_json)).keeperUserId, 'keeper-current');
      assert.deepEqual(JSON.parse(String(event.after_json)), result.steward);
      assert.doesNotMatch(JSON.stringify(event), /ownership|recovery|ciphertext|nonce|verifier/i);

      const replay = await action({
        request: adminRequest('/api/admin/maintenance/kp-maint/actions', 'POST', requestBody, cookie),
        env,
        params: { id: 'kp-maint' },
      });
      assert.equal(replay.status, 200);
      assert.equal((await replay.json()).replayed, true);
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS count FROM registry_maintenance_events',
      ).get().count, 1);

      const keyConflict = await action({
        request: adminRequest('/api/admin/maintenance/kp-maint/actions', 'POST', {
          ...requestBody,
          reason: 'Reuse the key for a different request.',
        }, cookie),
        env,
        params: { id: 'kp-maint' },
      });
      assert.equal(keyConflict.status, 409);
      assert.deepEqual(await keyConflict.json(), { ok: false, error: 'idempotency_conflict' });

      const stale = await action({
        request: adminRequest('/api/admin/maintenance/kp-maint/actions', 'POST', {
          ...requestBody,
          idempotencyKey: 'api-reset-stale',
        }, cookie),
        env,
        params: { id: 'kp-maint' },
      });
      assert.equal(stale.status, 409);
      assert.deepEqual(await stale.json(), { ok: false, error: 'version_conflict' });
    } finally {
      maintenanceSession = null;
      database.close();
    }
  });

  it('transfers only to one verified Better Auth account without storing its email', async () => {
    const { database, env: sqliteEnv } = createSqliteD1();
    try {
      database.exec(`${registryMigrations}\n${keeperInsert}\n
        INSERT INTO user (id, email, emailVerified, createdAt, updatedAt) VALUES
          ('keeper-current', 'current@example.com', 1, 1, 1),
          ('keeper-target', 'target@example.com', 1, 1, 1),
          ('keeper-other', 'other@example.com', 1, 1, 1),
          ('keeper-unverified', 'unverified@example.com', 0, 1, 1),
          ('keeper-dupe-one', 'dupe@example.com', 1, 1, 1),
          ('keeper-dupe-two', 'DUPE@example.com', 1, 1, 1);
        UPDATE keeper_pieces
           SET keeper_user_id = 'keeper-current',
               claimed_at = '2026-07-20T00:00:00.000Z',
               current_display_location = 'Ubud studio'
         WHERE id = 'kp-maint';
      `);
      const env = {
        ...sqliteEnv,
        ADMIN_EMAILS: 'artist@example.com',
        REGISTRY_STEP_UP_SECRET: 'registry-secret',
      };
      maintenanceSession = {
        session: adminIdentity.session,
        user: { id: adminIdentity.userId, email: adminIdentity.email, emailVerified: true },
      };
      const cookie = await unlockedCookie(env);
      const { onRequest: action } = await import('../functions/api/admin/maintenance/[id]/actions.js');
      const baseBody = {
        action: 'transfer_steward',
        reason: 'Transfer stewardship to the verified recipient.',
        idempotencyKey: 'api-transfer-steward',
        expectedStewardVersion: 1,
      };
      for (const [targetEmail, status, error] of [
        [undefined, 400, 'target_email_required'],
        ['missing@example.com', 404, 'target_not_found'],
        ['unverified@example.com', 409, 'target_unverified'],
        ['dupe@example.com', 409, 'target_ambiguous'],
        ['current@example.com', 409, 'target_is_current_steward'],
      ] as const) {
        const validation = await action({
          request: adminRequest('/api/admin/maintenance/kp-maint/actions', 'POST', {
            ...baseBody,
            idempotencyKey: `validation-${error}`,
            ...(targetEmail === undefined ? {} : { targetEmail }),
          }, cookie),
          env,
          params: { id: 'kp-maint' },
        });
        assert.equal(validation.status, status, error);
        assert.deepEqual(await validation.json(), { ok: false, error }, error);
      }

      const requestBody = { ...baseBody, targetEmail: ' Target@Example.com ' };
      const response = await action({
        request: adminRequest('/api/admin/maintenance/kp-maint/actions', 'POST', requestBody, cookie),
        env,
        params: { id: 'kp-maint' },
      });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.replayed, false);
      assert.equal(result.steward.keeperUserId, 'keeper-target');
      assert.equal(result.steward.stewardVersion, 2);
      assert.equal(result.steward.releasedAt, null);
      assert.equal(result.steward.currentDisplayLocation, null);
      assert.equal(new Date(result.steward.claimedAt).toISOString(), result.steward.claimedAt);
      const stored = database.prepare(
        `SELECT keeper_user_id, claimed_at, released_at, current_display_location,
                steward_version FROM keeper_pieces WHERE id = 'kp-maint'`,
      ).get();
      assert.equal(stored.keeper_user_id, 'keeper-target');
      assert.equal(stored.claimed_at, result.steward.claimedAt);
      assert.equal(stored.released_at, null);
      assert.equal(stored.current_display_location, null);
      assert.equal(stored.steward_version, 2);
      const event = database.prepare(
        `SELECT event_type, before_json, after_json
           FROM registry_maintenance_events WHERE idempotency_key = 'api-transfer-steward'`,
      ).get();
      assert.equal(event.event_type, 'steward_transferred');
      assert.deepEqual(JSON.parse(String(event.after_json)), result.steward);
      const serializedEvent = JSON.stringify(event);
      assert.doesNotMatch(serializedEvent, /target@example\.com/i);
      assert.doesNotMatch(serializedEvent, /ownership|recovery|ciphertext|nonce|verifier/i);

      const replay = await action({
        request: adminRequest('/api/admin/maintenance/kp-maint/actions', 'POST', requestBody, cookie),
        env,
        params: { id: 'kp-maint' },
      });
      assert.equal(replay.status, 200);
      assert.equal((await replay.json()).replayed, true);
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS count FROM registry_maintenance_events',
      ).get().count, 1);

      const conflict = await action({
        request: adminRequest('/api/admin/maintenance/kp-maint/actions', 'POST', {
          ...requestBody,
          targetEmail: 'other@example.com',
        }, cookie),
        env,
        params: { id: 'kp-maint' },
      });
      assert.equal(conflict.status, 409);
      assert.deepEqual(await conflict.json(), { ok: false, error: 'idempotency_conflict' });

      const stale = await action({
        request: adminRequest('/api/admin/maintenance/kp-maint/actions', 'POST', {
          ...requestBody,
          idempotencyKey: 'api-transfer-stale',
          targetEmail: 'other@example.com',
        }, cookie),
        env,
        params: { id: 'kp-maint' },
      });
      assert.equal(stale.status, 409);
      assert.deepEqual(await stale.json(), { ok: false, error: 'version_conflict' });
    } finally {
      maintenanceSession = null;
      database.close();
    }
  });

  it('rolls back steward state when its maintenance event cannot be appended', async () => {
    const { database, env: sqliteEnv } = createSqliteD1();
    try {
      database.exec(`${registryMigrations}\n${keeperInsert}\n
        UPDATE keeper_pieces
           SET keeper_user_id = 'keeper-current', claimed_at = '2026-07-20T00:00:00.000Z'
         WHERE id = 'kp-maint';
        CREATE TRIGGER fail_steward_history
        BEFORE INSERT ON registry_maintenance_events
        BEGIN
          SELECT RAISE(ABORT, 'forced event failure');
        END;
      `);
      const env = {
        ...sqliteEnv,
        ADMIN_EMAILS: 'artist@example.com',
        REGISTRY_STEP_UP_SECRET: 'registry-secret',
      };
      maintenanceSession = {
        session: adminIdentity.session,
        user: { id: adminIdentity.userId, email: adminIdentity.email, emailVerified: true },
      };
      const cookie = await unlockedCookie(env);
      const { onRequest: action } = await import('../functions/api/admin/maintenance/[id]/actions.js');
      const response = await action({
        request: adminRequest('/api/admin/maintenance/kp-maint/actions', 'POST', {
          action: 'reset_steward',
          reason: 'Exercise atomic rollback.',
          idempotencyKey: 'api-reset-rollback',
          expectedStewardVersion: 1,
        }, cookie),
        env,
        params: { id: 'kp-maint' },
      });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { ok: false, error: 'maintenance_write_failed' });
      assert.deepEqual({ ...database.prepare(
        `SELECT keeper_user_id, claimed_at, steward_version
           FROM keeper_pieces WHERE id = 'kp-maint'`,
      ).get() }, {
        keeper_user_id: 'keeper-current',
        claimed_at: '2026-07-20T00:00:00.000Z',
        steward_version: 1,
      });
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS count FROM registry_maintenance_events',
      ).get().count, 0);
    } finally {
      maintenanceSession = null;
      database.close();
    }
  });

  it('corrects only digitally wrong links confirmed against truthful engraving', async () => {
    const { database, env: sqliteEnv } = createSqliteD1();
    try {
      database.exec(registryMigrations);
      const originalCandidate = await seedGeneratedPlate(sqliteEnv);
      database.prepare(
        `UPDATE keeper_pieces
            SET backup_status = 'verified', backup_reference = 'plates/AR-7KQ9M2WX.json',
                backup_at = '2026-07-30T01:00:00.000Z'
          WHERE id = 'kp-lifecycle'`,
      ).run();
      database.prepare(
        `UPDATE keeper_pieces SET record_version = 0 WHERE id = 'kp-lifecycle'`,
      ).run();
      database.prepare(
        `INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
         VALUES ('UL-101', 'Crystal Creation - 36', 'Universal Language', NULL,
                 '2026-07-30T00:00:00.000Z')`,
      ).run();
      const env = {
        ...sqliteEnv, ...ownershipCrypto,
        ADMIN_EMAILS: 'artist@example.com', REGISTRY_STEP_UP_SECRET: 'registry-secret',
      };
      maintenanceSession = {
        session: adminIdentity.session,
        user: { id: adminIdentity.userId, email: adminIdentity.email, emailVerified: true },
      };
      const cookie = await unlockedCookie(env);
      const { onRequest: action } = await import('../functions/api/admin/maintenance/[id]/actions.js');
      const prematureReplacement = await action({
        request: adminRequest('/api/admin/maintenance/kp-lifecycle/actions', 'POST', {
          action: 'replace_plate', physicalDisposition: 'Not yet active.',
          reason: 'Reject replacement before activation.',
          idempotencyKey: 'replace-generated-rejected', expectedRecordVersion: 0,
        }, cookie), env, params: { id: 'kp-lifecycle' },
      });
      assert.equal(prematureReplacement.status, 409);
      assert.deepEqual(await prematureReplacement.json(), { ok: false, error: 'plate_not_active' });
      const body = {
        action: 'correct_link', artworkId: 'UL-101', editionNumber: 0,
        physicalEngravingMatches: true,
        reason: 'Correct the digital record to match the engraved plate.',
        idempotencyKey: 'api-correct-link', expectedRecordVersion: 0,
      };
      database.prepare(
        `INSERT INTO keeper_pieces
           (id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key,
            plate_status, registered_at)
         VALUES ('kp-link-collision', 'UL-101', 0, 'collision-hash', 'AR-ABCDEFGH',
                 'collision-issuance', 'generated', '2026-07-30T00:00:00.000Z')`,
      ).run();
      const collision = await action({
        request: adminRequest('/api/admin/maintenance/kp-lifecycle/actions', 'POST', {
          ...body, idempotencyKey: 'correct-link-collision',
        }, cookie), env, params: { id: 'kp-lifecycle' },
      });
      assert.equal(collision.status, 409);
      assert.deepEqual(await collision.json(), { ok: false, error: 'link_collision' });
      database.prepare(
        `UPDATE keeper_pieces
            SET plate_status = 'void', physical_disposition = 'Unused collision fixture.'
          WHERE id = 'kp-link-collision'`,
      ).run();

      const missingConfirmation = await action({
        request: adminRequest('/api/admin/maintenance/kp-lifecycle/actions', 'POST', {
          ...body, physicalEngravingMatches: false, idempotencyKey: 'missing-confirmation',
        }, cookie), env, params: { id: 'kp-lifecycle' },
      });
      assert.equal(missingConfirmation.status, 400);
      assert.deepEqual(await missingConfirmation.json(), {
        ok: false, error: 'physical_engraving_confirmation_required',
      });

      const beforeFailedCorrection = {
        ...database.prepare(
          `SELECT piece_id, edition_number, ownership_code_ciphertext,
                  ownership_code_nonce, ownership_code_key_version,
                  front_svg_sha256, back_svg_sha256, backup_status,
                  backup_reference, backup_at, record_version
             FROM keeper_pieces WHERE id = 'kp-lifecycle'`,
        ).get(),
      };
      database.exec(`
        CREATE TRIGGER fail_correct_link_before_update
        BEFORE UPDATE OF piece_id ON keeper_pieces
        BEGIN
          SELECT RAISE(ABORT, 'forced_correct_link_failure');
        END;
      `);
      const failedCorrection = await action({
        request: adminRequest('/api/admin/maintenance/kp-lifecycle/actions', 'POST', {
          ...body, idempotencyKey: 'api-correct-link-forced-failure',
        }, cookie), env, params: { id: 'kp-lifecycle' },
      });
      database.exec('DROP TRIGGER fail_correct_link_before_update;');
      assert.equal(failedCorrection.status, 503);
      assert.deepEqual(await failedCorrection.json(), {
        ok: false, error: 'maintenance_write_failed',
      });
      assert.deepEqual({
        ...database.prepare(
          `SELECT piece_id, edition_number, ownership_code_ciphertext,
                  ownership_code_nonce, ownership_code_key_version,
                  front_svg_sha256, back_svg_sha256, backup_status,
                  backup_reference, backup_at, record_version
             FROM keeper_pieces WHERE id = 'kp-lifecycle'`,
        ).get(),
      }, beforeFailedCorrection);
      assert.equal(database.prepare(
        `SELECT COUNT(*) AS count FROM registry_maintenance_events
          WHERE idempotency_key = 'api-correct-link-forced-failure'`,
      ).get().count, 0);

      const response = await action({
        request: adminRequest('/api/admin/maintenance/kp-lifecycle/actions', 'POST', body, cookie),
        env, params: { id: 'kp-lifecycle' },
      });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.deepEqual(payload.record, {
        keeperPieceId: 'kp-lifecycle', pieceId: 'UL-101', editionNumber: 0, recordVersion: 1,
      });
      assert.equal(payload.replayed, false);
      const correctedRow = database.prepare(
        `SELECT * FROM keeper_pieces WHERE id = 'kp-lifecycle'`,
      ).get() as Record<string, unknown>;
      assert.equal(correctedRow.piece_id, 'UL-101');
      assert.equal(correctedRow.edition_number, 0);
      assert.equal(correctedRow.record_version, 1);
      assert.equal(correctedRow.backup_status, 'pending');
      assert.equal(correctedRow.backup_reference, null);
      assert.equal(correctedRow.backup_at, null);
      assert.notEqual(correctedRow.front_svg_sha256, originalCandidate.plate.frontSha256);
      assert.notEqual(correctedRow.back_svg_sha256, originalCandidate.plate.undersideSha256);
      const { packageFromStoredRegistryPlate } = await import(
        '../functions/api/_lib/registryPlateIssuance.js'
      );
      const recovered = await packageFromStoredRegistryPlate(correctedRow, env);
      assert.equal(recovered.frontSha256, correctedRow.front_svg_sha256);
      assert.equal(recovered.undersideSha256, correctedRow.back_svg_sha256);
      const { onRequest: recoverPackage } = await import(
        '../functions/api/admin/pieces/[id]/package.js'
      );
      const recoveredResponse = await recoverPackage({
        request: adminRequest('/api/admin/pieces/kp-lifecycle/package', 'POST', {}, cookie),
        env,
        params: { id: 'kp-lifecycle' },
      });
      assert.equal(recoveredResponse.status, 200);
      const recoveredBody = await recoveredResponse.json();
      assert.equal(recoveredBody.frontSha256, correctedRow.front_svg_sha256);
      assert.equal(recoveredBody.undersideSha256, correctedRow.back_svg_sha256);
      const { onRequest: verifyRecovery } = await import(
        '../functions/api/admin/pieces/[id]/verify-recovery.js'
      );
      const staleBackup = await verifyRecovery({
        request: adminRequest('/api/admin/pieces/kp-lifecycle/verify-recovery', 'POST', {}, cookie),
        env: { ...env, ARTWORK_REGISTRY_BACKUP: { get: async () => null } },
        params: { id: 'kp-lifecycle' },
      });
      assert.equal(staleBackup.status, 409);
      assert.deepEqual(await staleBackup.json(), { ok: false, error: 'backup_not_verified' });
      const event = database.prepare(
        "SELECT event_type, before_json, after_json FROM registry_maintenance_events WHERE idempotency_key = 'api-correct-link'",
      ).get();
      assert.equal(event.event_type, 'link_corrected');
      assert.doesNotMatch(JSON.stringify(event), /ownership|recovery|ciphertext|nonce|verifier/i);

      const replay = await action({
        request: adminRequest('/api/admin/maintenance/kp-lifecycle/actions', 'POST', body, cookie),
        env, params: { id: 'kp-lifecycle' },
      });
      assert.equal(replay.status, 200);
      assert.equal((await replay.json()).replayed, true);
    } finally {
      maintenanceSession = null;
      database.close();
    }
  });

  it('voids generated plates only, permanently retiring their public identity', async () => {
    const { database, env: sqliteEnv } = createSqliteD1();
    try {
      database.exec(registryMigrations);
      await seedGeneratedPlate(sqliteEnv);
      const env = {
        ...sqliteEnv, ...ownershipCrypto,
        ADMIN_EMAILS: 'artist@example.com', REGISTRY_STEP_UP_SECRET: 'registry-secret',
      };
      maintenanceSession = {
        session: adminIdentity.session,
        user: { id: adminIdentity.userId, email: adminIdentity.email, emailVerified: true },
      };
      const cookie = await unlockedCookie(env);
      const { onRequest: action } = await import('../functions/api/admin/maintenance/[id]/actions.js');
      const body = {
        action: 'void_plate', physicalDisposition: 'Engraving blank destroyed in studio.',
        reason: 'Retire the unused generated plate.', idempotencyKey: 'api-void-plate',
        expectedRecordVersion: 0,
      };
      const response = await action({
        request: adminRequest('/api/admin/maintenance/kp-lifecycle/actions', 'POST', body, cookie),
        env, params: { id: 'kp-lifecycle' },
      });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.deepEqual(payload.record, {
        keeperPieceId: 'kp-lifecycle', artworkId: 'UL-100', plateStatus: 'void',
        physicalDisposition: body.physicalDisposition, recordVersion: 1,
      });
      assert.equal(payload.replayed, false);
      assert.deepEqual({ ...database.prepare(
        "SELECT plate_status, physical_disposition, record_version FROM keeper_pieces WHERE id = 'kp-lifecycle'",
      ).get() }, {
        plate_status: 'void', physical_disposition: body.physicalDisposition, record_version: 1,
      });
      assert.throws(() => database.prepare(
        `INSERT INTO keeper_pieces
           (id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key, plate_status)
         VALUES ('reuse', 'UL-100', 0, 'different-hash', 'AR-7KQ9M2WX',
                 'initial-lifecycle-issuance', 'generated')`,
      ).run(), /unique/i);

      const replay = await action({
        request: adminRequest('/api/admin/maintenance/kp-lifecycle/actions', 'POST', body, cookie),
        env, params: { id: 'kp-lifecycle' },
      });
      assert.equal(replay.status, 200);
      assert.equal((await replay.json()).replayed, true);
    } finally {
      maintenanceSession = null;
      database.close();
    }
  });

  it('atomically supersedes an active plate and exactly replays its generated replacement', async () => {
    const { database, env: sqliteEnv } = createSqliteD1();
    try {
      database.exec(registryMigrations);
      const old = await seedGeneratedPlate(sqliteEnv);
      const activatedAt = '2026-07-30T01:00:00.000Z';
      const activated = await buildLineageEvent({
        keeperPieceId: old.id, sequence: 2, eventType: 'activated', eventAt: activatedAt,
        previousHash: old.lineageEvent.eventHash, publicPayload: { plateStatus: 'active' },
      });
      await sqliteEnv.DB.batch([
        sqliteEnv.DB.prepare(
          `UPDATE keeper_pieces SET plate_status = 'active', plate_activated_at = ?1
            WHERE id = ?2`,
        ).bind(activatedAt, old.id),
        lineageStatement(sqliteEnv, activated),
        lineageAnchorStatement(sqliteEnv, activated, {
          expectedCount: 1, expectedHash: old.lineageEvent.eventHash,
        }),
      ]);
      const env = {
        ...sqliteEnv, ...ownershipCrypto,
        ADMIN_EMAILS: 'artist@example.com', REGISTRY_STEP_UP_SECRET: 'registry-secret',
      };
      maintenanceSession = {
        session: adminIdentity.session,
        user: { id: adminIdentity.userId, email: adminIdentity.email, emailVerified: true },
      };
      const cookie = await unlockedCookie(env);
      const { onRequest: action } = await import('../functions/api/admin/maintenance/[id]/actions.js');
      const activeVoid = await action({
        request: adminRequest('/api/admin/maintenance/kp-lifecycle/actions', 'POST', {
          action: 'void_plate', physicalDisposition: 'Must not retire an active plate this way.',
          reason: 'Reject voiding an active plate.', idempotencyKey: 'void-active-rejected',
          expectedRecordVersion: 1,
        }, cookie), env, params: { id: 'kp-lifecycle' },
      });
      assert.equal(activeVoid.status, 409);
      assert.deepEqual(await activeVoid.json(), { ok: false, error: 'plate_not_generated' });
      const body = {
        action: 'replace_plate', physicalDisposition: 'Damaged metal plate retained in studio archive.',
        reason: 'Replace the physically incorrect engraved plate.',
        idempotencyKey: 'api-replace-plate', expectedRecordVersion: 1,
      };
      const response = await action({
        request: adminRequest('/api/admin/maintenance/kp-lifecycle/actions', 'POST', body, cookie),
        env, params: { id: 'kp-lifecycle' },
      });
      assert.equal(response.status, 201);
      const payload = await response.json();
      assert.equal(payload.replayed, false);
      assert.match(payload.replacement.publicCode, /^AR-/);
      assert.match(payload.replacement.ownershipCode, /^[A-Z0-9-]+$/);
      assert.notEqual(payload.replacement.publicCode, old.publicCode);

      const rows = database.prepare(
        `SELECT id, public_code, issuance_key, plate_status, supersedes_keeper_piece_id,
                superseded_by_keeper_piece_id, physical_disposition, replaced_at, record_version
           FROM keeper_pieces ORDER BY id`,
      ).all();
      const oldRow = rows.find((row: any) => row.id === old.id) as any;
      const newRow = rows.find((row: any) => row.id !== old.id) as any;
      assert.equal(oldRow.plate_status, 'superseded');
      assert.equal(oldRow.superseded_by_keeper_piece_id, newRow.id);
      assert.equal(oldRow.physical_disposition, body.physicalDisposition);
      assert.equal(newRow.plate_status, 'generated');
      assert.equal(newRow.supersedes_keeper_piece_id, old.id);
      assert.equal(oldRow.replaced_at, payload.replacement.generatedAt);
      const event = database.prepare(
        "SELECT before_json, after_json FROM registry_maintenance_events WHERE idempotency_key = 'api-replace-plate'",
      ).get();
      assert.doesNotMatch(JSON.stringify(event), /ownership|recovery|ciphertext|nonce|verifier/i);

      const replay = await action({
        request: adminRequest('/api/admin/maintenance/kp-lifecycle/actions', 'POST', body, cookie),
        env, params: { id: 'kp-lifecycle' },
      });
      assert.equal(replay.status, 200);
      const replayPayload = await replay.json();
      assert.equal(replayPayload.replayed, true);
      assert.deepEqual(replayPayload.replacement, payload.replacement);
      assert.equal(database.prepare('SELECT count(*) AS count FROM keeper_pieces').get().count, 2);

      database.prepare(
        `UPDATE keeper_pieces SET plate_status = 'active', plate_activated_at = ?1
          WHERE id = ?2`,
      ).run('2026-07-30T02:00:00.000Z', newRow.id);
      const lockedReplay = await action({
        request: adminRequest('/api/admin/maintenance/kp-lifecycle/actions', 'POST', body, cookie),
        env, params: { id: 'kp-lifecycle' },
      });
      assert.equal(lockedReplay.status, 409);
      assert.deepEqual(await lockedReplay.json(), { ok: false, error: 'plate_identity_locked' });
    } finally {
      maintenanceSession = null;
      database.close();
    }
  });

  it('keeps all acquisition fields out of public registry, lineage, and QR identity responses', async () => {
    const { database, env } = createSqliteD1();
    try {
      database.exec(`${registryMigrations}\n${keeperInsert}\n
        INSERT INTO artwork_acquisitions
          (id, keeper_piece_id, acquisition_type, amount_minor, currency, private_notes,
           created_at, updated_at)
        VALUES ('acq-public-check', 'kp-maint', 'sale', 987654321, 'XTS',
          'NEVER-PUBLIC-ACQUISITION', '2026-07-30T00:00:00.000Z',
          '2026-07-30T00:00:00.000Z');
      `);
      const lineageEvent = await buildLineageEvent({
        keeperPieceId: 'kp-maint',
        sequence: 1,
        eventType: 'issued',
        eventAt: '2026-07-30T00:00:00.000Z',
        publicPayload: {
          pieceId: 'UL-100', editionNumber: 0, publicCode: 'AR-7KQ9M2WX',
        },
      });
      database.prepare(
        `INSERT INTO artwork_lineage_events
           (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
            event_hash, public_payload_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      ).run(
        lineageEvent.id, lineageEvent.keeperPieceId, lineageEvent.sequence,
        lineageEvent.eventType, lineageEvent.eventAt, lineageEvent.previousHash,
        lineageEvent.eventHash, lineageEvent.publicPayloadJson,
      );
      database.prepare(
        'UPDATE keeper_pieces SET lineage_head_hash = ?1, lineage_event_count = 1 WHERE id = ?2',
      ).run(lineageEvent.eventHash, 'kp-maint');

      const { onRequest: registry } = await import('../functions/api/registry/[publicCode].js');
      const registryResponse = await registry({
        request: new Request('https://adrianrasmussen.com/api/registry/AR-7KQ9M2WX'),
        env,
        params: { publicCode: 'AR-7KQ9M2WX' },
      });
      const { onRequest: lineage } = await import('../functions/api/lineage/[publicCode].js');
      const { onRequest: qr } = await import('../functions/qr/[number].js');
      const previousFlag = LAUNCH_FLAGS.livingLegacy;
      LAUNCH_FLAGS.livingLegacy = true;
      try {
        const lineageResponse = await lineage({
          request: new Request('https://adrianrasmussen.com/api/lineage/AR-7KQ9M2WX'),
          env,
          params: { publicCode: 'AR-7KQ9M2WX' },
        });
        const qrResponse = await qr({
          request: new Request('https://adrianrasmussen.com/qr/AR-7KQ9M2WX'),
          env,
          params: { number: 'AR-7KQ9M2WX' },
        });
        assert.deepEqual(
          [registryResponse.status, lineageResponse.status, qrResponse.status],
          [200, 200, 302],
        );
        for (const [name, response] of [
          ['registry', registryResponse],
          ['lineage', lineageResponse],
          ['qr', qrResponse],
        ] as const) {
          const serialized = JSON.stringify({
            headers: Object.fromEntries(response.headers),
            body: await response.text(),
          });
          assert.doesNotMatch(
            serialized,
            /987654321|amountMinor|amount_minor|currency|XTS|NEVER-PUBLIC-ACQUISITION/i,
            name,
          );
        }

        database.exec(`BEGIN IMMEDIATE;
          UPDATE keeper_pieces
             SET plate_status = 'superseded', superseded_by_keeper_piece_id = 'kp-middle',
                 physical_disposition = 'First retired plate.', replaced_at = '2026-07-30T01:00:00.000Z'
           WHERE id = 'kp-maint';
          INSERT INTO keeper_pieces
            (id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key,
             plate_status, registered_at, supersedes_keeper_piece_id,
             superseded_by_keeper_piece_id, physical_disposition, replaced_at)
          VALUES
            ('kp-middle', 'UL-100', 0, 'middle-hash', 'AR-ABCDEFGH', 'middle-issue',
             'superseded', '2026-07-30T01:00:00.000Z', 'kp-maint', 'kp-current',
             'Second retired plate.', '2026-07-30T02:00:00.000Z');
          INSERT INTO keeper_pieces
            (id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key,
             plate_status, registered_at, supersedes_keeper_piece_id)
          VALUES
            ('kp-current', 'UL-100', 0, 'current-hash', 'AR-BCDEFGHJ', 'current-issue',
             'generated', '2026-07-30T02:00:00.000Z', 'kp-middle');
          COMMIT;
        `);
        const disclosedEnv = {
          ...env,
          ARTWORK_REGISTRY_SUCCESSOR_DISCLOSURE: 'disclosed',
        };
        const chainRegistry = await registry({
          request: new Request('https://adrianrasmussen.com/api/registry/AR-7KQ9M2WX'),
          env: disclosedEnv,
          params: { publicCode: 'AR-7KQ9M2WX' },
        });
        const chainLineage = await lineage({
          request: new Request('https://adrianrasmussen.com/api/lineage/AR-7KQ9M2WX'),
          env: disclosedEnv,
          params: { publicCode: 'AR-7KQ9M2WX' },
        });
        assert.equal((await chainRegistry.json()).identity.currentPublicCode, 'AR-BCDEFGHJ');
        assert.equal((await chainLineage.json()).artwork.currentPublicCode, 'AR-BCDEFGHJ');

        database.prepare(
          `UPDATE keeper_pieces SET superseded_by_keeper_piece_id = 'kp-maint'
            WHERE id = 'kp-current'`,
        ).run();
        const cyclic = await registry({
          request: new Request('https://adrianrasmussen.com/api/registry/AR-7KQ9M2WX'),
          env: disclosedEnv,
          params: { publicCode: 'AR-7KQ9M2WX' },
        });
        const cyclicIdentity = (await cyclic.json()).identity;
        assert.equal(cyclicIdentity.successorDisclosure, 'withheld');
        assert.equal(Object.hasOwn(cyclicIdentity, 'currentPublicCode'), false);
      } finally {
        LAUNCH_FLAGS.livingLegacy = previousFlag;
      }
    } finally {
      database.close();
    }
  });
});
