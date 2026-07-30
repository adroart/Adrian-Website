import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
     after_json, outcome, related_record_id, created_at)
  VALUES
    ('rme-1', 'idem-1', 'acquisition_created', 'kp-maint', 'UL-100',
     'admin-1', 'admin@example.com', 'Record the studio acquisition.',
     '{}', '{"id":"acq-1"}', 'succeeded', 'acq-1',
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
        registry_maintenance_events.after_json
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
         administrator_email, reason, before_json, after_json, outcome, created_at)
      VALUES
        ('rme-2', 'idem-1', 'acquisition_created', 'admin-1',
         'admin@example.com', 'Retry.', '{}', '{}', 'succeeded',
         '2026-07-30T01:01:00.000Z');
    `);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unique/i);
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
  eventType: 'acquisition_updated',
  keeperPieceId: 'kp-maint',
  artworkId: 'UL-100',
  authorization: { userId: 'admin-1', email: 'admin@example.com' },
  reason: 'Correct the acquisition date.',
  before: { acquiredAt: '2026-01-01T00:00:00.000Z' },
  after: { acquiredAt: '2026-02-01T00:00:00.000Z' },
  outcome: 'succeeded',
  relatedRecordId: 'acq-1',
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
    created_at: expectedEvent.createdAt,
    ...overrides,
  };
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

  it('reports optimistic conflicts and cannot append false success after a zero-row mutation', async () => {
    const eventRows: unknown[][] = [];
    const env = {
      DB: {
        prepare(sql: string) {
          return {
            bind(...values: unknown[]) { return { kind: 'event', sql, values }; },
          };
        },
        async batch(statements: Array<Record<string, unknown>>) {
          const mutation = statements[0] as { changes: number };
          if (mutation.changes === 1) eventRows.push((statements[1].values ?? []) as unknown[]);
          return [
            { success: true, meta: { changes: mutation.changes } },
            { success: true, meta: { changes: mutation.changes === 1 ? 1 : 0 } },
          ];
        },
      },
    };

    const conflict = await commitMaintenanceMutation(env, {
      statements: [{ kind: 'mutation', changes: 0 }],
      event: expectedEvent,
      expectedVersion: 2,
    });
    assert.deepEqual(conflict, { ok: false, error: 'optimistic_conflict' });
    assert.equal(eventRows.length, 0);

    const success = await commitMaintenanceMutation(env, {
      statements: [{ kind: 'mutation', changes: 1 }],
      event: expectedEvent,
      expectedVersion: 2,
    });
    assert.equal(success.ok, true);
    assert.equal(success.eventId.startsWith('rme-'), true);
    assert.equal(eventRows.length, 1);
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
      statements: [{ kind: 'mutation', changes: 1 }],
      event: expectedEvent,
      expectedVersion: 2,
    }), { ok: false, error: 'maintenance_write_failed' });
  });
});
