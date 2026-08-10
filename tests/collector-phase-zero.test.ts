import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { onRequest as atlasRequest } from '../functions/api/atlas.js';
import { buildLedgerFile } from '../functions/api/_lib/registryLedgerExport.js';
import { buildLineageEvent } from '../functions/api/_lib/lineage.js';
import {
  ATLAS_SOURCE_MOVE_DATE,
  buildAtlasSourceImportSql,
  canonicalizeAtlasSourceEvent,
  computeAtlasSourceEventHash,
  verifyAtlasSourceChains,
  type AtlasSourceCity,
  type AtlasSourceEvent,
} from '../utils/atlasSourceImport.ts';
import { REGISTRY_RECOVERY_TABLES } from '../utils/registryRecoveryArchive.ts';
import {
  REGISTRY_LEDGER_SCHEMA_VERSION,
  computeLedgerLines,
  parseLedgerJsonl,
  verifyLedgerFile,
  type LedgerRecord,
} from '../utils/registryLedger.ts';

const migration = (name: string) =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');

const registrySchema = [
  '001_init.sql',
  '003_atlas_legacy.sql',
  '005_atlas_legacy.sql',
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
  '020_registry_recovery_qualification.sql',
  '021_registry_plate_backup_digest.sql',
  '022_registry_fulfillment_detachment.sql',
].map(migration).join('\n');

const mergedSchema = [
  registrySchema,
  '023_collector_registry_merge.sql',
  '024_ownership_foundation.sql',
  '025_artwork_registration.sql',
  '026_artwork_invitations.sql',
  '027_certificate_templates.sql',
  '028_collector_privacy.sql',
  '029_collector_dreams.sql',
  '030_collector_field.sql',
].map((entry, index) => index === 0 ? entry : migration(entry)).join('\n');

function databaseWithSchema(includeMerge = true) {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(includeMerge ? mergedSchema : registrySchema);
  return database;
}

function d1(database: DatabaseSync) {
  return {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      return {
        bind(...next: SQLInputValue[]) {
          values = next;
          return this;
        },
        async first() {
          return database.prepare(sql).get(...values) || null;
        },
        async all() {
          return { results: database.prepare(sql).all(...values) };
        },
        async run() {
          const result = database.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
    },
  };
}

async function sourceEvent(
  fields: Omit<AtlasSourceEvent, 'hash'>,
): Promise<AtlasSourceEvent> {
  return { ...fields, hash: await computeAtlasSourceEventHash(fields) };
}

async function changedSourceEvent(
  event: AtlasSourceEvent,
  changes: Partial<Omit<AtlasSourceEvent, 'hash'>>,
): Promise<AtlasSourceEvent> {
  const { hash: _hash, ...payload } = event;
  return sourceEvent({ ...payload, ...changes });
}

const denpasar: AtlasSourceCity = {
  id: 'denpasar-id',
  city: 'Denpasar',
  country: 'Indonesia',
  countryCode: 'ID',
  lat: -8.65,
  lng: 115.2167,
};

const approvedSourceReference = 'https://mandalacodes.com/api/atlas';

async function validSourceExport() {
  const created = await sourceEvent({
    id: 'evt-m0abc123-00000000000000000001',
    pieceId: 'UL-100',
    editionNumber: 0,
    type: 'created',
    date: '2024-01-01T00:00:00.000Z',
    actor: 'admin',
    series: 'Universal Language',
    category: 'Multidimensional Art',
    prevHash: null,
  });
  const placed = await sourceEvent({
    id: 'evt-m0abc124-00000000000000000002',
    pieceId: 'UL-100',
    editionNumber: 0,
    type: 'placed',
    date: '2024-01-02T00:00:00.000Z',
    cityId: denpasar.id,
    actor: 'admin',
    prevHash: created.hash,
  });
  const second = await sourceEvent({
    id: 'evt-m0abc125-00000000000000000003',
    pieceId: 'UL-101',
    editionNumber: 0,
    type: 'created',
    date: '2024-02-01T00:00:00.000Z',
    actor: 'admin',
    series: 'Universal Language',
    category: 'Multidimensional Art',
    prevHash: null,
  });
  return { events: [second, placed, created], cities: [denpasar] };
}

describe('collector registry merge migration', () => {
  it('backfills vendor-neutral auth ids and keeps both columns synchronized during rollout', () => {
    const database = databaseWithSchema(false);
    try {
      database.exec(`
        INSERT INTO users (clerk_user_id, email) VALUES ('auth-existing', 'a@example.com');
        INSERT INTO atlas_inscriptions
          (id, piece_id, edition_number, author_clerk_id, kind, body_hash, created_at)
        VALUES ('ins-existing', 'UL-100', 0, 'auth-existing', 'story', '${'a'.repeat(64)}',
          '2024-01-01T00:00:00.000Z');
        INSERT INTO profiles
          (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id, computed_json)
        VALUES (1, '1980-01-01', '12:30', 'Denpasar, Bali, Indonesia', -8.65, 115.2167,
          'Asia/Makassar', '{}');
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, plate_status,
           lineage_head_hash, lineage_event_count)
        VALUES ('kp-existing', 'UL-100', 0, '${'b'.repeat(64)}', 'legacy', '${'c'.repeat(64)}', 1);
        INSERT INTO artwork_lineage_events
          (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
           event_hash, public_payload_json)
        VALUES ('lineage-existing', 'kp-existing', 1, 'migration_baseline',
          '2026-08-01T00:00:00.000Z', NULL, '${'c'.repeat(64)}', '{}');
      `);

      database.exec(migration('023_collector_registry_merge.sql'));

      assert.deepEqual({ ...database.prepare(
        'SELECT auth_user_id, clerk_user_id FROM users WHERE id = 1',
      ).get() }, { auth_user_id: 'auth-existing', clerk_user_id: 'auth-existing' });
      assert.deepEqual({ ...database.prepare(
        'SELECT author_user_id, author_clerk_id FROM atlas_inscriptions WHERE id = ?1',
      ).get('ins-existing') }, {
        author_user_id: 'auth-existing',
        author_clerk_id: 'auth-existing',
      });

      database.exec("INSERT INTO users (clerk_user_id, email) VALUES ('auth-old-runtime', 'b@example.com')");
      assert.equal(database.prepare(
        "SELECT auth_user_id FROM users WHERE clerk_user_id = 'auth-old-runtime'",
      ).get()?.auth_user_id, 'auth-old-runtime');
      database.exec("UPDATE users SET auth_user_id = 'auth-new-runtime-2' WHERE clerk_user_id = 'auth-old-runtime'");
      assert.equal(database.prepare(
        "SELECT clerk_user_id FROM users WHERE auth_user_id = 'auth-new-runtime-2'",
      ).get()?.clerk_user_id, 'auth-new-runtime-2');

      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM profiles').get()?.count, 1);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM keeper_pieces').get()?.count, 1);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM artwork_lineage_events').get()?.count, 1);
    } finally {
      database.close();
    }
  });

  it('makes imported source evidence append-only without changing local lineage', () => {
    const database = databaseWithSchema();
    try {
      database.exec(`
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, plate_status)
        VALUES ('kp-source', 'UL-100', 0, '${'a'.repeat(64)}', 'legacy');
        INSERT INTO atlas_source_chains
          (id, keeper_piece_id, source_system, source_reference, moved_on,
           source_event_count, source_head_hash)
        VALUES ('source-chain', 'kp-source', 'mandalacodes-atlas',
          'https://example.com/historical/ledger.json', '${ATLAS_SOURCE_MOVE_DATE}', 1,
          '${'b'.repeat(64)}');
        INSERT INTO atlas_source_chain_events
          (id, source_chain_id, source_sequence, source_event_id, source_event_type,
           source_event_at, source_previous_hash, source_event_hash, source_event_json)
        VALUES ('source-event', 'source-chain', 1, 'legacy-event', 'created',
          '2024-01-01T00:00:00.000Z', NULL, '${'b'.repeat(64)}',
          '{"id":"legacy-event"}');
      `);
      assert.throws(() => database.exec(
        "UPDATE atlas_source_chain_events SET source_event_type = 'placed' WHERE id = 'source-event'",
      ), /append-only/);
      assert.throws(() => database.exec(
        "DELETE FROM atlas_source_chains WHERE id = 'source-chain'",
      ), /append-only/);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM artwork_lineage_events').get()?.count, 0);
    } finally {
      database.close();
    }
  });
});

describe('Mandala Atlas source import', () => {
  it('rejects a name hidden behind an event-id prefix', async () => {
    const input = await validSourceExport();
    const named = await changedSourceEvent(input.events[0], { id: 'evt_AdrianRasmussen' });
    await assert.rejects(
      buildAtlasSourceImportSql({
        ...input,
        events: [named, ...input.events.slice(1)],
        sourceReference: approvedSourceReference,
      }),
      /source_event_malformed/,
    );
  });

  it('rejects a name hidden behind an auth-id prefix', async () => {
    const input = await validSourceExport();
    const named = await changedSourceEvent(input.events[0], {
      actorRef: 'user_AdrianRasmussen',
    });
    await assert.rejects(
      buildAtlasSourceImportSql({
        ...input,
        events: [named, ...input.events.slice(1)],
        sourceReference: approvedSourceReference,
      }),
      /source_event_ref_invalid/,
    );
  });

  it('rejects personal data hidden in an approved-host source path', async () => {
    const input = await validSourceExport();
    await assert.rejects(
      buildAtlasSourceImportSql({
        ...input,
        sourceReference: 'https://mandalacodes.com/person@example.com',
      }),
      /source_reference_invalid/,
    );
  });

  it('accepts the real genesis, event, auth, and inscription identifier formats', async () => {
    const created = await sourceEvent({
      id: 'genesis-UL-102-1704067200000', pieceId: 'UL-102', editionNumber: 0,
      type: 'created', date: '2024-01-01T00:00:00.000Z', actor: 'admin',
      actorRef: 'BtrAuth7fGh8jKl9mNp0qRs1tUv2wXy3z', prevHash: null,
    });
    const inscribed = await sourceEvent({
      id: 'evt-m0abc12e-0000000000000000000c', pieceId: 'UL-102', editionNumber: 0,
      type: 'inscribed', date: '2024-01-02T00:00:00.000Z', actor: 'steward',
      actorRef: 'user_2aBc3dEf4gHi5jKl6mNo7pQr',
      inscriptionId: 'ins-first-UL-102-0-user_2aBc3dEf4gHi5jKl6mNo7pQr',
      contentHash: 'a'.repeat(64), inscriptionKind: 'story', prevHash: created.hash,
    });
    assert.equal(
      (await verifyAtlasSourceChains([created, inscribed], [])).chains[0].headHash,
      inscribed.hash,
    );
  });

  it('recomputes the exact canonical source hash with recursively sorted keys', async () => {
    const event = {
      z: { b: 2, a: 1 },
      a: 'first',
      prevHash: null,
    };
    assert.equal(
      canonicalizeAtlasSourceEvent(event),
      '{"a":"first","prevHash":null,"z":{"a":1,"b":2}}',
    );
    assert.equal(
      await computeAtlasSourceEventHash(event),
      '95058c89f8b7c5d462d7fcf056845cef17f46fc637972bf749ad54911d3cf83d',
    );
  });

  it('emits deterministic SQL that preserves existing registry and local lineage rows', async () => {
    const input = await validSourceExport();
    const configuration = {
      ...input,
      sourceReference: approvedSourceReference,
    };
    const first = await buildAtlasSourceImportSql(configuration);
    const second = await buildAtlasSourceImportSql(configuration);
    assert.equal(first, second);

    const database = databaseWithSchema();
    try {
      const local = await buildLineageEvent({
        keeperPieceId: 'kp-existing',
        sequence: 1,
        eventType: 'migration_baseline',
        eventAt: '2026-08-01T00:00:00.000Z',
      });
      database.prepare(`
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, plate_status,
           lineage_head_hash, lineage_event_count)
        VALUES (?, 'UL-100', 0, ?, 'legacy', ?, 1)
      `).run('kp-existing', 'a'.repeat(64), local.eventHash);
      database.prepare(`
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, plate_status,
           physical_disposition)
        VALUES ('kp-retired', 'UL-100', 0, ?, 'void', 'Historical plate retired')
      `).run('9'.repeat(64));
      database.prepare(`
        INSERT INTO artwork_lineage_events
          (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
           event_hash, public_payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        local.id, local.keeperPieceId, local.sequence, local.eventType, local.eventAt,
        local.previousHash, local.eventHash, local.publicPayloadJson,
      );

      database.exec(first);
      database.exec(first);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM keeper_pieces').get()?.count, 3);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM artwork_lineage_events').get()?.count, 1);
      assert.equal(database.prepare(
        "SELECT keeper_piece_id FROM atlas_source_chains WHERE source_head_hash = ?",
      ).get(input.events.find((event) => event.pieceId === 'UL-100' && event.type === 'placed')?.hash as string)?.keeper_piece_id, 'kp-existing');
      const imported = database.prepare(`
        SELECT keeper_user_id, recovery_code_hash, public_code,
               ownership_code_ciphertext, ownership_code_nonce, ownership_code_key_version
          FROM keeper_pieces WHERE piece_id = 'UL-101'
      `).get() as Record<string, unknown>;
      assert.equal(imported.keeper_user_id, null);
      assert.match(String(imported.recovery_code_hash), /^disabled-atlas:[a-f0-9]{64}$/);
      assert.equal(imported.public_code, null);
      assert.equal(imported.ownership_code_ciphertext, null);
      assert.equal(imported.ownership_code_nonce, null);
      assert.equal(imported.ownership_code_key_version, null);
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS count FROM atlas_source_chain_events',
      ).get()?.count, 3);
    } finally {
      database.close();
    }
  });

  it('rolls back on a same-key source collision with different content', async () => {
    const input = await validSourceExport();
    const database = databaseWithSchema();
    try {
      database.exec(`INSERT INTO atlas_source_cities
        (id, city, region, country, country_code, lat, lng)
        VALUES ('denpasar-id', 'Not Denpasar', 'Bali', 'Indonesia', 'ID', -8.65, 115.2167)`);
      const sql = await buildAtlasSourceImportSql({
        ...input,
        sourceReference: approvedSourceReference,
      });
      assert.throws(() => database.exec(sql), /atlas_source_import_collision/);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM keeper_pieces').get()?.count, 0);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM atlas_source_chains').get()?.count, 0);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM atlas_source_chain_events').get()?.count, 0);
    } finally {
      database.close();
    }
  });

  it('rejects tampering, broken links, malformed events, private fields, and missing cities', async () => {
    const input = await validSourceExport();
    const base = {
      ...input,
      sourceReference: approvedSourceReference,
    };
    await assert.rejects(
      buildAtlasSourceImportSql({
        ...base,
        events: input.events.map((event, index) => index === 0
          ? { ...event, date: '2025-01-01T00:00:00.000Z' }
          : event),
      }),
      /source_event_hash_mismatch/,
    );
    const brokenLinkEvents = await Promise.all(input.events.map(async (event) => {
      if (event.type !== 'placed') return event;
      const { hash: _hash, ...payload } = { ...event, prevHash: '0'.repeat(64) };
      return { ...payload, hash: await computeAtlasSourceEventHash(payload) };
    }));
    await assert.rejects(
      buildAtlasSourceImportSql({ ...base, events: brokenLinkEvents }),
      /source_chain_link_mismatch/,
    );
    await assert.rejects(
      buildAtlasSourceImportSql({
        ...base,
        events: [{ ...input.events[0], buyerEmail: 'private@example.com' } as AtlasSourceEvent],
      }),
      /source_event_private_or_unknown_field/,
    );
    const eventWithNote = await changedSourceEvent(input.events[0], {
      note: 'Known-key free text must not enter the canonical registry.',
    });
    await assert.rejects(
      buildAtlasSourceImportSql({ ...base, events: [eventWithNote, ...input.events.slice(1)] }),
      /source_event_private_or_unknown_field/,
    );
    const eventWithEmailRef = await changedSourceEvent(input.events[0], {
      actorRef: 'holder@example.com',
    });
    await assert.rejects(
      buildAtlasSourceImportSql({ ...base, events: [eventWithEmailRef, ...input.events.slice(1)] }),
      /source_event_ref_invalid/,
    );
    await assert.rejects(
      buildAtlasSourceImportSql({ ...base, cities: [] }),
      /source_city_missing/,
    );
    await assert.rejects(
      buildAtlasSourceImportSql({ ...base, sourceReference: 'file:///tmp/ledger.json' }),
      /source_reference_invalid/,
    );
    await assert.rejects(
      buildAtlasSourceImportSql({ ...base, sourceReference: 'https://example.com/atlas/public.json' }),
      /source_reference_invalid/,
    );
    await assert.rejects(
      buildAtlasSourceImportSql({
        ...base,
        sourceReference: 'https://mandalacodes.com/api/atlas?holder=person@example.com',
      }),
      /source_reference_invalid/,
    );
    for (const id of ['Collector Name', 'person@example.com']) {
      const invalidId = await changedSourceEvent(input.events[0], { id });
      await assert.rejects(
        buildAtlasSourceImportSql({ ...base, events: [invalidId, ...input.events.slice(1)] }),
        /source_event_malformed/,
      );
    }
    for (const actorRef of ['AdrianRasmussen', 'adrian-rasmussen']) {
      const nameRef = await changedSourceEvent(input.events[0], { actorRef });
      await assert.rejects(
        buildAtlasSourceImportSql({ ...base, events: [nameRef, ...input.events.slice(1)] }),
        /source_event_ref_invalid/,
      );
    }
    const placed = input.events.find((event) => event.type === 'placed')!;
    for (const field of ['fromRef', 'toRef'] as const) {
      const transfer = await sourceEvent({
        id: field === 'fromRef'
          ? 'evt-m0abc126-00000000000000000004'
          : 'evt-m0abc127-00000000000000000005', pieceId: placed.pieceId,
        editionNumber: placed.editionNumber, type: 'transferred',
        date: '2024-01-03T00:00:00.000Z', actor: 'admin',
        actorRef: 'user_2aBc3dEf4gHi5jKl6mNo7pQr',
        fromRef: field === 'fromRef' ? 'AdrianRasmussen' : 'user_3bCd4eFg5hIj6kLm7nOp8qRs',
        toRef: field === 'toRef' ? 'AdrianRasmussen' : 'user_4cDe5fGh6iJk7lMn8oPq9rSt',
        transferKind: 'gift', prevHash: placed.hash,
      });
      await assert.rejects(
        verifyAtlasSourceChains([...input.events, transfer], input.cities),
        /source_event_semantics_invalid/,
      );
    }
  });

  it('accepts a trusted city on created genesis and rejects altered city catalog data', async () => {
    const input = await validSourceExport();
    const genesis = input.events.find((event) => event.pieceId === 'UL-101')!;
    const locatedGenesis = await changedSourceEvent(genesis, { cityId: denpasar.id });
    const database = databaseWithSchema();
    try {
      database.exec(await buildAtlasSourceImportSql({
        ...input,
        events: input.events.map((event) => event.id === genesis.id ? locatedGenesis : event),
        sourceReference: approvedSourceReference,
      }));
      const response = await atlasRequest({
        request: new Request('https://adrianrasmussen.com/api/atlas'),
        env: { DB: d1(database) },
      });
      const body = await response.json() as any;
      const artwork = body.state.lights.find((candidate: any) => candidate.artworkId === 'UL-101');
      assert.equal(artwork.identity[0].city, null);
      assert.equal(artwork.identity[0].status, 'unregistered');
      assert.deepEqual(body.state.facets.places, []);
    } finally {
      database.close();
    }
    await assert.rejects(
      buildAtlasSourceImportSql({
        ...input,
        cities: [{ ...denpasar, lat: denpasar.lat + 0.0001 }],
        sourceReference: approvedSourceReference,
      }),
      /source_city_untrusted/,
    );
  });

  it('requires real canonical UTC timestamps and rejects normalized dates and backward steps', async () => {
    const input = await validSourceExport();
    const impossible = await changedSourceEvent(input.events[0], {
      date: '2024-02-30T00:00:00.000Z',
    });
    await assert.rejects(
      buildAtlasSourceImportSql({
        ...input,
        events: [impossible, ...input.events.slice(1)],
        sourceReference: approvedSourceReference,
      }),
      /source_event_malformed/,
    );
    const created = await sourceEvent({
      id: 'evt-m0abc128-00000000000000000006', pieceId: 'ZZ-998', editionNumber: 0, type: 'created',
      date: '2024-01-01T00:00:00.900Z', actor: 'admin', prevHash: null,
    });
    const backward = await sourceEvent({
      id: 'evt-m0abc129-00000000000000000007', pieceId: 'ZZ-998', editionNumber: 0, type: 'placed',
      date: '2024-01-01T00:00:00Z', cityId: denpasar.id, actor: 'admin',
      prevHash: created.hash,
    });
    await assert.rejects(
      verifyAtlasSourceChains([created, backward], input.cities),
      /source_(?:event_malformed|chain_date_order)/,
    );
  });

  it('refuses to attach source history to a claimed or issued current keeper row', async () => {
    const input = await validSourceExport();
    const database = databaseWithSchema();
    try {
      database.exec(`
        INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
        VALUES ('user_holder', 'Holder', 'holder@example.com', 1, 1, 1);
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, keeper_user_id, recovery_code_hash, claimed_at,
           public_code, issuance_key, plate_status, plate_generated_at, plate_activated_at,
           front_svg_sha256, back_svg_sha256, ownership_code_ciphertext,
           ownership_code_nonce, ownership_code_key_version)
        VALUES ('kp-issued', 'UL-100', 0, 'user_holder', '${'8'.repeat(64)}',
          '2024-01-01T00:00:00.000Z', 'AR-7KQ9M2WX', 'issuance-existing', 'active',
          '2024-01-01T00:00:00.000Z', '2024-01-02T00:00:00.000Z',
          '${'6'.repeat(64)}', '${'7'.repeat(64)}', 'ciphertext', 'nonce', 1);
      `);
      const sql = await buildAtlasSourceImportSql({
        ...input,
        sourceReference: approvedSourceReference,
      });
      assert.throws(() => database.exec(sql), /atlas_source_import_collision/);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM atlas_source_chains').get()?.count, 0);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM atlas_source_cities').get()?.count, 0);
    } finally {
      database.close();
    }
  });

  it('enforces genesis, event-specific fields, chronology, and one piece identity per chain', async () => {
    const input = await validSourceExport();
    const base = {
      ...input,
      sourceReference: approvedSourceReference,
    };
    const created = input.events.find((event) => event.pieceId === 'UL-100' && event.type === 'created')!;
    const invalidTransfer = await sourceEvent({
      id: 'evt-m0abc12a-00000000000000000008', pieceId: 'UL-100', editionNumber: 0,
      type: 'transferred', date: '2024-01-03T00:00:00.000Z', actor: 'admin',
      prevHash: input.events.find((event) => event.type === 'placed')!.hash,
    });
    await assert.rejects(
      verifyAtlasSourceChains([...input.events, invalidTransfer], input.cities),
      /source_event_semantics_invalid/,
    );
    const inconsistent = await changedSourceEvent(
      input.events.find((event) => event.type === 'placed')!, {
      pieceId: 'UL-999',
      prevHash: created.hash,
    });
    await assert.rejects(
      buildAtlasSourceImportSql({
        ...base,
        events: input.events.map((event) => event.type === 'placed' ? inconsistent : event),
      }),
      /source_chain_(?:genesis_invalid|link_mismatch)/,
    );
  });
});

describe('canonical public Atlas reader', () => {
  it('keeps withdrawn and retired source-only identities out of the public field', async () => {
    for (const terminalType of ['withdrawn', 'retired'] as const) {
      const created = await sourceEvent({
        id: terminalType === 'withdrawn'
          ? 'evt-m0abc130-00000000000000000010'
          : 'evt-m0abc132-00000000000000000012',
        pieceId: terminalType === 'withdrawn' ? 'UL-100' : 'UL-101',
        editionNumber: 0, type: 'created', date: '2024-01-01T00:00:00.000Z',
        actor: 'admin', prevHash: null,
      });
      const terminal = await sourceEvent({
        id: terminalType === 'withdrawn'
          ? 'evt-m0abc131-00000000000000000011'
          : 'evt-m0abc133-00000000000000000013',
        pieceId: created.pieceId, editionNumber: 0,
        type: terminalType, date: '2024-01-02T00:00:00.000Z', actor: 'admin',
        prevHash: created.hash,
      });
      const database = databaseWithSchema();
      try {
        database.exec(await buildAtlasSourceImportSql({
          events: [created, terminal], cities: [], sourceReference: approvedSourceReference,
        }));
        const response = await atlasRequest({
          request: new Request('https://adrianrasmussen.com/api/atlas'),
          env: { DB: d1(database) },
        });
        assert.equal(response.status, 200);
        const body = await response.json() as any;
        assert.deepEqual(body.state.lights, []);
        assert.deepEqual(body.state.chainTips, {});
      } finally {
        database.close();
      }
    }
  });

  it('returns the public Mandala contract from D1 with no holder data', async () => {
    const input = await validSourceExport();
    const database = databaseWithSchema();
    try {
      database.exec(await buildAtlasSourceImportSql({
        ...input,
        sourceReference: approvedSourceReference,
      }));
      const response = await atlasRequest({
        request: new Request('https://adrianrasmussen.com/api/atlas'),
        env: { DB: d1(database) },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      const body = await response.json() as any;
      assert.equal(body.ok, true);
      assert.equal(body.state.schemaVersion, 3);
      assert.equal(body.state.lights.length, 2);
      assert.deepEqual(body.state.facets.places, []);
      assert.equal(body.state.lights.find((artwork: any) => artwork.artworkId === 'UL-100')
        .identity[0].status, 'unregistered');
      assert.equal(body.state.lights.find((artwork: any) => artwork.artworkId === 'UL-101')
        .identity[0].status, 'unregistered');
      assert.deepEqual(body.state.chainTips, {
        'UL-100:0': input.events.find((event) => event.type === 'placed')!.hash,
        'UL-101:0': input.events.find((event) => event.pieceId === 'UL-101')!.hash,
      });
      assert.doesNotMatch(
        JSON.stringify(body),
        /keeper|email|authUser|clerk|recovery|ownership|cipher|nonce/i,
      );
    } finally {
      database.close();
    }
  });

  it('returns empty arrays for an empty registry and fails closed on source tampering', async () => {
    const empty = databaseWithSchema();
    try {
      const response = await atlasRequest({
        request: new Request('https://adrianrasmussen.com/api/atlas'),
        env: { DB: d1(empty) },
      });
      assert.equal(response.status, 200);
      const body = await response.json() as any;
      assert.deepEqual(body.state.lights, []);
      assert.deepEqual(body.state.facets, { series: [], years: [], places: [] });
    } finally {
      empty.close();
    }

    const tampered = databaseWithSchema();
    try {
      const input = await validSourceExport();
      tampered.exec(await buildAtlasSourceImportSql({
        ...input,
        sourceReference: approvedSourceReference,
      }));
      tampered.exec('DROP TRIGGER atlas_source_chain_events_no_update;');
      tampered.exec(`UPDATE atlas_source_chain_events
        SET source_event_json = '{"tampered":true}' WHERE source_sequence = 1`);
      const response = await atlasRequest({
        request: new Request('https://adrianrasmussen.com/api/atlas'),
        env: { DB: d1(tampered) },
      });
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { ok: false, error: 'atlas_integrity_error' });
    } finally {
      tampered.close();
    }
  });

  it('fails closed when a hash-valid source chain has invalid semantics or disagrees with its keeper row', async () => {
    for (const corruption of ['semantics', 'keeper'] as const) {
      const database = databaseWithSchema();
      try {
        const input = await validSourceExport();
        database.exec(await buildAtlasSourceImportSql({
          ...input,
          sourceReference: approvedSourceReference,
        }));
        const original = input.events.find((event) => event.pieceId === 'UL-101')!;
        const { hash: _hash, ...payload } = original;
        const changedPayload = corruption === 'semantics'
          ? { ...payload, type: 'retired' as const }
          : { ...payload, pieceId: 'UL-999' };
        const changed = { ...changedPayload, hash: await computeAtlasSourceEventHash(changedPayload) };
        database.exec(`
          DROP TRIGGER atlas_source_chain_events_no_update;
          DROP TRIGGER atlas_source_chains_no_update;
        `);
        database.prepare(`UPDATE atlas_source_chain_events
          SET source_event_type = ?, source_event_hash = ?, source_event_json = ?
          WHERE source_event_id = ?`).run(
          changed.type, changed.hash, canonicalizeAtlasSourceEvent(changed), original.id,
        );
        database.prepare(`UPDATE atlas_source_chains SET source_head_hash = ?
          WHERE source_head_hash = ?`).run(changed.hash, original.hash);
        const response = await atlasRequest({
          request: new Request('https://adrianrasmussen.com/api/atlas'),
          env: { DB: d1(database) },
        });
        assert.equal(response.status, 409, corruption);
        assert.deepEqual(await response.json(), { ok: false, error: 'atlas_integrity_error' });
      } finally {
        database.close();
      }
    }
  });

  it('fails closed when valid chains are mixed with an orphan source-event row', async () => {
    const database = databaseWithSchema();
    try {
      const input = await validSourceExport();
      database.exec(await buildAtlasSourceImportSql({
        ...input,
        sourceReference: approvedSourceReference,
      }));
      const orphan = await sourceEvent({
        id: 'evt-m0abc12b-00000000000000000009', pieceId: 'ZZ-997', editionNumber: 0, type: 'created',
        date: '2024-03-01T00:00:00.000Z', actor: 'admin', prevHash: null,
      });
      database.exec('PRAGMA foreign_keys = OFF;');
      database.prepare(`INSERT INTO atlas_source_chain_events
        (id, source_chain_id, source_sequence, source_event_id, source_event_type,
         source_event_at, source_previous_hash, source_event_hash, source_event_json)
        VALUES (?, 'missing-chain', 1, ?, 'created', ?, NULL, ?, ?)`
      ).run('atlas-source-event-orphan', orphan.id, orphan.date, orphan.hash,
        canonicalizeAtlasSourceEvent(orphan));
      const response = await atlasRequest({
        request: new Request('https://adrianrasmussen.com/api/atlas'),
        env: { DB: d1(database) },
      });
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { ok: false, error: 'atlas_integrity_error' });
    } finally {
      database.close();
    }
  });

  it('uses genesis metadata as fallback and preserves catalog Signature kind', async () => {
    const unknown = await sourceEvent({
      id: 'evt-m0abc12c-0000000000000000000a', pieceId: 'ZZ-999', editionNumber: 0, type: 'created',
      date: '2024-04-01T00:00:00.000Z', actor: 'admin', pieceType: 'mandala',
      series: 'Independent Study', category: 'Dimensional Sculpture', prevHash: null,
    });
    const signature = await sourceEvent({
      id: 'evt-m0abc12d-0000000000000000000b', pieceId: 'SIG-100', editionNumber: 0, type: 'created',
      date: '2024-04-02T00:00:00.000Z', actor: 'admin', prevHash: null,
    });
    const database = databaseWithSchema();
    try {
      database.exec(await buildAtlasSourceImportSql({
        events: [unknown, signature], cities: [], sourceReference: approvedSourceReference,
      }));
      const response = await atlasRequest({
        request: new Request('https://adrianrasmussen.com/api/atlas'),
        env: { DB: d1(database) },
      });
      const body = await response.json() as any;
      const fallback = body.state.lights.find((artwork: any) => artwork.artworkId === 'ZZ-999');
      assert.equal(fallback.series, 'Independent Study');
      assert.equal(fallback.title, 'ZZ-999');
      assert.equal(fallback.identity[0].status, 'unregistered');
      const catalogSignature = body.state.lights.find((artwork: any) => artwork.artworkId === 'SIG-100');
      assert.equal(catalogSignature.title, 'Amphibian Dream');
      assert.equal(catalogSignature.identity[0].status, 'unregistered');
    } finally {
      database.close();
    }
  });
});

describe('phase zero recovery and auth boundaries', () => {
  it('includes every imported source table in private recovery', () => {
    assert.equal(REGISTRY_RECOVERY_TABLES.includes('atlas_source_chains'), true);
    assert.equal(REGISTRY_RECOVERY_TABLES.includes('atlas_source_chain_events'), true);
    assert.equal(REGISTRY_RECOVERY_TABLES.includes('atlas_source_cities'), true);
  });

  it('retains exact source-chain evidence in the offline registry ledger', async () => {
    const records = [
      {
        kind: 'source-chain',
        sourceChainId: `atlas-source-${'a'.repeat(64)}`,
        keeperPieceId: 'kp-source',
        sourceSystem: 'mandalacodes-atlas',
        sourceReference: approvedSourceReference,
        movedOn: ATLAS_SOURCE_MOVE_DATE,
        eventCount: 1,
        headHash: 'a'.repeat(64),
      },
      {
        kind: 'source-event',
        sourceChainId: `atlas-source-${'a'.repeat(64)}`,
        sequence: 1,
        eventId: 'legacy-created',
        eventType: 'created',
        eventAt: '2024-01-01T00:00:00.000Z',
        previousHash: null,
        eventHash: 'a'.repeat(64),
      },
    ] as unknown as LedgerRecord[];
    const lines = await computeLedgerLines(records);
    assert.equal(lines.length, 2);
    const result = await verifyLedgerFile({
      header: {
        kind: 'header',
        schemaVersion: REGISTRY_LEDGER_SCHEMA_VERSION,
        exportedAt: '2026-08-09T00:00:00.000Z',
        recordCount: lines.length,
        headHash: lines.at(-1)?.hash || null,
        note: 'source evidence',
      },
      lines,
    });
    assert.equal(result.ok, true);
  });

  it('reads source chains and exact source events into the registry ledger export', async () => {
    const event = (await validSourceExport()).events.find((candidate) => candidate.pieceId === 'UL-101')!;
    const headHash = event.hash;
    const sourceChainId = `atlas-source-${headHash}`;
    const env = {
      DB: {
        prepare(sql: string) {
          return {
            async all() {
              if (/FROM keeper_pieces/.test(sql)) return { results: [] };
              if (/FROM artwork_lineage_events/.test(sql)) return { results: [] };
              if (/FROM atlas_source_chains/.test(sql)) return { results: [{
                id: sourceChainId,
                keeper_piece_id: 'kp-source',
                source_system: 'mandalacodes-atlas',
                source_reference: approvedSourceReference,
                moved_on: ATLAS_SOURCE_MOVE_DATE,
                source_event_count: 1,
                source_head_hash: headHash,
              }] };
              if (/FROM atlas_source_chain_events/.test(sql)) return { results: [{
                source_chain_id: sourceChainId,
                source_sequence: 1,
                source_event_id: event.id,
                source_event_type: event.type,
                source_event_at: event.date,
                source_previous_hash: event.prevHash,
                source_event_hash: event.hash,
                source_event_json: canonicalizeAtlasSourceEvent(event),
              }] };
              throw new Error(`unexpected query: ${sql}`);
            },
          };
        },
      },
    };
    const exported = await buildLedgerFile(env);
    const parsed = parseLedgerJsonl(exported.body);
    assert.deepEqual(parsed.lines.map((line) => line.record.kind), ['source-chain', 'source-event']);
    assert.equal((parsed.lines[1].record as any).eventHash, event.hash);
    assert.equal(Object.hasOwn(parsed.lines[1].record as object, 'event'), false);
    assert.doesNotMatch(exported.body, /actorRef|fromRef|toRef|holder@example.com/);
  });

  it('uses vendor-neutral auth names in active runtime', () => {
    for (const file of [
      'functions/api/_lib/db.js',
      'functions/api/auth/sync-user.js',
      'functions/api/checkout.js',
      'functions/api/keeper/bind.js',
      'functions/api/keeper/intention.js',
      'functions/api/keeper/piece.js',
      'functions/api/admin/maintenance/[id].js',
    ]) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      assert.doesNotMatch(source, /getUserByClerkId|clerkUserId|author_clerk_id/);
      if (file !== 'functions/api/_lib/db.js') assert.doesNotMatch(source, /clerk_user_id/);
    }
    const db = readFileSync(new URL('../functions/api/_lib/db.js', import.meta.url), 'utf8');
    assert.match(db, /getUserByAuthId/);
    assert.match(db, /authUserId/);
  });
});
