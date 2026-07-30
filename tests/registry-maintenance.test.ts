import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import {
  buildMaintenanceEventStatement,
  canonicalMaintenanceJson,
  classifyMaintenanceIdempotency,
  commitMaintenanceMutation,
  normalizeAcquisitionInput,
  normalizeReason,
  replayMaintenanceEvent,
} from '../functions/api/_lib/registryMaintenance.js';

const readMigration = (name: string) =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');

const registryMigrations = [
  '001_init.sql',
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
  artworkId: 'UL-100',
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
      target: { type: 'keeper_record', id: 'kp-maint' },
      changes: { pieceId: 'UL-101', editionNumber: 1 },
      event: {
        ...expectedEvent,
        idempotencyKey: 'keeper-record-update',
        eventType: 'link_corrected',
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
      target: { type: 'keeper_steward', id: 'kp-maint' },
      changes: { currentDisplayLocation: 'Ubud studio' },
      event: {
        ...expectedEvent,
        idempotencyKey: 'keeper-steward-update',
        eventType: 'steward_transferred',
        relatedRecordId: 'kp-maint',
        before: { keeperPieceId: 'kp-maint', currentDisplayLocation: null, stewardVersion: 1 },
        after: {
          keeperPieceId: 'kp-maint', currentDisplayLocation: 'Ubud studio', stewardVersion: 2,
        },
      },
      expectedVersion: 1,
    });
    assert.match(prepared[4].sql, /^UPDATE keeper_pieces/i);
    assert.match(prepared[4].sql, /current_display_location = \?1/);
    assert.match(prepared[4].sql, /steward_version = steward_version \+ 1/);
    assert.deepEqual(prepared[4].values, ['Ubud studio', 'kp-maint', 1, null]);

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
        target: { type: 'keeper_record', id: 'kp-maint' },
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
        target: { type: 'keeper_record', id: 'kp-maint' },
        changes: { pieceId: 'UL-101' },
        event: {
          ...expectedEvent,
          eventType: 'steward_transferred',
          before: { keeperUserId: null },
          after: { keeperUserId: 'keeper-2' },
        },
      },
      {
        target: { type: 'keeper_record', id: 'kp-maint' },
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
        target: { type: 'keeper_steward', id: 'kp-maint' },
        changes: { currentDisplayLocation: 'Ubud studio' },
        event: {
          ...expectedEvent,
          eventType: 'steward_transferred',
          relatedRecordId: 'kp-maint',
          before: {
            keeperPieceId: 'kp-maint', currentDisplayLocation: null, stewardVersion: 2,
          },
          after: {
            keeperPieceId: 'kp-maint', currentDisplayLocation: 'Ubud studio', stewardVersion: 4,
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
        target: { type: 'keeper_record', id: 'kp-maint' },
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
