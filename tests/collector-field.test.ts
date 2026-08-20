import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { onRequest as atlasRequest } from '../functions/api/atlas.js';
import { projectCollectorField } from '../functions/api/_lib/collectorField.js';
import { buildLineageEvent } from '../functions/api/_lib/lineage.js';

const migrationNames = [
  '001_init.sql', '003_atlas_legacy.sql', '005_atlas_legacy.sql',
  '006_better_auth.sql', '008_living_legacy.sql', '009_keeper_register.sql',
  '010_artwork_plate_identity.sql', '011_piece_fulfillments.sql',
  '012_piece_fulfillment_guards.sql', '013_artwork_lineage.sql',
  '014_artwork_lineage_anchor.sql', '015_registry_artworks.sql',
  '016_keeper_piece_edition_kind_guard.sql',
  '017_creator_registry_maintenance.sql', '018_registry_plate_lifecycle.sql',
  '019_registry_creator_history.sql', '020_registry_recovery_qualification.sql',
  '021_registry_plate_backup_digest.sql', '022_registry_fulfillment_detachment.sql',
  '023_collector_registry_merge.sql', '024_ownership_foundation.sql',
  '025_artwork_registration.sql', '026_artwork_invitations.sql',
  '027_certificate_templates.sql', '028_collector_privacy.sql',
  '029_collector_dreams.sql', '035_city_floor_removal.sql',
];

function migration(name: string) {
  return readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
}

function databaseThroughPrivacy() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  for (const name of migrationNames) database.exec(migration(name));
  return database;
}

function insertKeeper(database: DatabaseSync, id: string, artworkId: string) {
  database.prepare(`
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, recovery_code_hash, plate_status)
    VALUES (?1, ?2, 0, ?3, 'legacy')
  `).run(id, artworkId, `recovery-${id}`);
}

function insertFirstBound(
  database: DatabaseSync,
  keeperPieceId: string,
  eventId: string,
  eventAt: string,
  eventHash: string,
) {
  database.prepare(`
    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json)
    VALUES (?1, ?2, 1, 'first_bound', ?3, NULL, ?4, '{}')
  `).run(eventId, keeperPieceId, eventAt, eventHash);
  database.prepare(`
    UPDATE keeper_pieces
       SET lineage_event_count = 1, lineage_head_hash = ?1
     WHERE id = ?2
  `).run(eventHash, keeperPieceId);
}

function applyCollectorFieldMigration(database: DatabaseSync) {
  const path = new URL('../migrations/030_collector_field.sql', import.meta.url);
  assert.equal(existsSync(path), true, 'collector field migration must exist');
  database.exec(readFileSync(path, 'utf8'));
}

function databaseThroughCollectorField() {
  const database = databaseThroughPrivacy();
  applyCollectorFieldMigration(database);
  return database;
}

function d1(database: DatabaseSync, writes: string[] = []) {
  return {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      return {
        bind(...next: SQLInputValue[]) { values = next; return this; },
        async first() { return database.prepare(sql).get(...values) ?? null; },
        async all() { return { results: database.prepare(sql).all(...values) }; },
        async run() {
          writes.push(sql);
          const result = database.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
    },
  };
}

function insertCatalog(
  database: DatabaseSync,
  artworkId: string,
  series: string | null,
  category = 'Multidimensional Art',
) {
  database.prepare(`
    INSERT INTO registry_catalog_membership
      (artwork_id, series, category, catalog_digest, first_seeded_at)
    VALUES (?1, ?2, ?3, ?4, '2026-08-09T00:00:00.000Z')
  `).run(artworkId, series, category, 'a'.repeat(64));
}

async function insertRegisteredIdentity(database: DatabaseSync, input: {
  id: string;
  artworkId: string;
  editionNumber?: number;
  keeperUserId?: string | null;
  currentDisplayLocation?: string | null;
  eventAt: string;
  eventHashSeed: string;
}) {
  const publicCode = `AR-${input.eventHashSeed.toUpperCase().repeat(8).slice(0, 8)}`;
  const backupHash = input.eventHashSeed.repeat(64).slice(0, 64);
  database.prepare(`
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       current_display_location, registered_at, claimed_at, public_code,
       issuance_key, plate_status, ownership_code_ciphertext,
       ownership_code_nonce, ownership_code_key_version, registration_status,
       registered_by_user_id, identity_backup_status,
       identity_backup_reference, identity_backup_sha256, identity_backup_at)
    VALUES
      (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8, ?9, 'legacy', 'ciphertext',
       'nonce', 1, 'registered', 'artist-admin', 'verified', ?10, ?11, ?7)
  `).run(
    input.id,
    input.artworkId,
    input.editionNumber ?? 0,
    input.keeperUserId ?? null,
    `recovery-${input.id}`,
    input.currentDisplayLocation ?? null,
    input.eventAt,
    publicCode,
    `issuance-${input.id}`,
    `identities/${publicCode}/${backupHash}.json`,
    backupHash,
  );
  const event = await buildLineageEvent({
    keeperPieceId: input.id,
    sequence: 1,
    eventType: 'first_bound',
    eventAt: input.eventAt,
    previousHash: null,
    publicPayload: {},
  });
  database.prepare(`
    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json)
    VALUES (?1, ?2, 1, 'first_bound', ?3, NULL, ?4, '{}')
  `).run(`lineage-${input.id}`, input.id, input.eventAt, event.eventHash);
  database.prepare(`
    UPDATE keeper_pieces
       SET lineage_event_count = 1, lineage_head_hash = ?1
     WHERE id = ?2
  `).run(event.eventHash, input.id);
}

describe('collector field claim ordinals', () => {
  it('backfills every first bind in deterministic event-time, hash, and identity order', () => {
    const database = databaseThroughPrivacy();
    try {
      insertKeeper(database, 'kp-z', 'UL-102');
      insertKeeper(database, 'kp-a', 'UL-100');
      insertKeeper(database, 'kp-b', 'UL-101');
      insertFirstBound(database, 'kp-z', 'event-z', '2026-08-09T02:00:00.000Z', 'c'.repeat(64));
      insertFirstBound(database, 'kp-b', 'event-b', '2026-08-09T01:00:00.000Z', 'b'.repeat(64));
      insertFirstBound(database, 'kp-a', 'event-a', '2026-08-09T01:00:00.000Z', 'a'.repeat(64));

      applyCollectorFieldMigration(database);

      assert.deepEqual(database.prepare(`
        SELECT keeper_piece_id, first_bound_event_id, claim_ordinal
          FROM collector_claim_ordinals ORDER BY claim_ordinal
      `).all().map((row) => ({ ...row })), [
        { keeper_piece_id: 'kp-a', first_bound_event_id: 'event-a', claim_ordinal: 1 },
        { keeper_piece_id: 'kp-b', first_bound_event_id: 'event-b', claim_ordinal: 2 },
        { keeper_piece_id: 'kp-z', first_bound_event_id: 'event-z', claim_ordinal: 3 },
      ]);
    } finally {
      database.close();
    }
  });

  it('assigns every future first bind atomically and makes the ordinal permanent', () => {
    const database = databaseThroughPrivacy();
    try {
      insertKeeper(database, 'kp-existing', 'UL-100');
      insertFirstBound(
        database, 'kp-existing', 'event-existing',
        '2026-08-09T01:00:00.000Z', 'a'.repeat(64),
      );
      applyCollectorFieldMigration(database);
      insertKeeper(database, 'kp-future', 'UL-101');
      insertFirstBound(
        database, 'kp-future', 'event-future',
        '2020-01-01T00:00:00.000Z', 'b'.repeat(64),
      );

      assert.equal(database.prepare(`
        SELECT claim_ordinal FROM collector_claim_ordinals
         WHERE keeper_piece_id = 'kp-future'
      `).get()?.claim_ordinal, 2);
      database.prepare(`
        INSERT INTO artwork_lineage_events
          (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
           event_hash, public_payload_json)
        VALUES
          ('event-transfer', 'kp-future', 2, 'transferred',
           '2026-08-10T00:00:00.000Z', ?1, ?2,
           '{"fromRef":"tp-00000000-0000-4000-8000-000000000000","toRef":"tp-11111111-1111-4111-8111-111111111111","transferKind":"gift"}')
      `).run('b'.repeat(64), 'c'.repeat(64));
      assert.equal(database.prepare(`
        SELECT claim_ordinal FROM collector_claim_ordinals
         WHERE keeper_piece_id = 'kp-future'
      `).get()?.claim_ordinal, 2);
      assert.throws(() => database.prepare(`
        INSERT INTO artwork_lineage_events
          (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
           event_hash, public_payload_json)
        VALUES ('event-impossible-second-bind', 'kp-future', 3, 'first_bound',
          '2026-08-11T00:00:00.000Z', ?1, ?2, '{}')
      `).run('c'.repeat(64), 'd'.repeat(64)), /UNIQUE/);
      assert.equal(database.prepare(`
        SELECT COUNT(*) AS count FROM artwork_lineage_events
         WHERE id = 'event-impossible-second-bind'
      `).get()?.count, 0);
      assert.throws(
        () => database.exec("UPDATE collector_claim_ordinals SET claim_ordinal = 9 WHERE keeper_piece_id = 'kp-existing'"),
        /permanent/,
      );
      assert.throws(
        () => database.exec("DELETE FROM collector_claim_ordinals WHERE keeper_piece_id = 'kp-existing'"),
        /permanent/,
      );
      assert.equal(database.prepare(`
        SELECT claim_ordinal FROM collector_claim_ordinals
         WHERE keeper_piece_id = 'kp-existing'
      `).get()?.claim_ordinal, 1);
    } finally {
      database.close();
    }
  });
});

describe('canonical collector field projection', () => {
  it('keeps an administrator-registered identity dim until its first collector bind', () => {
    const state = projectCollectorField({
      generatedAt: '2026-08-10T00:00:00.000Z',
      catalogRows: [{ artwork_id: 'UL-100', series: 'Universal Language' }],
      identityRows: [{
        id: 'kp-unclaimed', piece_id: 'UL-100', edition_number: 1,
        public_code: 'AR-UNCLAIM1', registration_status: 'registered',
        claim_ordinal: null, lineage_head_hash: 'a'.repeat(64),
      }],
      consentRows: [],
      metadataByArtworkId: new Map([['UL-100', { title: 'Unclaimed', year: 2026 }]]),
      sourceEventsByPiece: new Map(),
    });
    assert.deepEqual(state.lights[0]?.identity[0], {
      publicCode: 'AR-UNCLAIM1', editionLabel: 'Edition 1', status: 'unregistered',
      ordinal: null, city: null, brightness: 0.24, markerSize: 1,
    });
  });

  it('projects the whole catalog, registered identities, equal light, and only current consented cities', async () => {
    const database = databaseThroughCollectorField();
    const writes: string[] = [];
    try {
      insertCatalog(database, 'UL-100', 'Universal Language');
      insertCatalog(database, 'SIG-101', null);
      await insertRegisteredIdentity(database, {
        id: 'kp-ul', artworkId: 'UL-100', keeperUserId: 'auth-adult',
        currentDisplayLocation: 'Private studio note',
        eventAt: '2026-08-09T01:00:00.000Z', eventHashSeed: 'a',
      });
      await insertRegisteredIdentity(database, {
        id: 'kp-signature', artworkId: 'SIG-100', keeperUserId: 'auth-other',
        eventAt: '2026-08-09T02:00:00.000Z', eventHashSeed: 'b',
      });
      database.exec(`
        INSERT INTO users (clerk_user_id, auth_user_id, email)
        VALUES
          ('auth-adult', 'auth-adult', 'private-adult@example.com'),
          ('auth-other', 'auth-other', 'private-other@example.com');
        INSERT INTO profiles
          (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id,
           computed_json)
        VALUES
          (1, '1980-01-01', '12:00', 'Private birthplace', -8.65, 115.21,
           'Asia/Makassar', '{}');
        INSERT INTO collector_curated_cities (id, label, population, active)
        VALUES ('denpasar-id', 'Changed database label', 725000, 1);
        INSERT INTO collector_piece_privacy
          (keeper_piece_id, user_id, share_city, city_id, policy_version, updated_at)
        VALUES
          ('kp-ul', 1, 1, 'denpasar-id', 'collector-privacy-v1',
           '2026-08-09T03:00:00.000Z');
      `);

      const response = await atlasRequest({
        request: new Request('https://adrianrasmussen.com/api/atlas'),
        env: { DB: d1(database, writes) },
      });
      assert.equal(response.status, 200);
      const body = await response.json() as any;
      assert.equal(body.state.schemaVersion, 3);
      assert.deepEqual(body.state.lights.map((artwork: any) => artwork.artworkId), [
        'SIG-100', 'SIG-101', 'UL-100',
      ]);
      const catalogOnly = body.state.lights.find((artwork: any) => artwork.artworkId === 'SIG-101').identity[0];
      assert.equal(catalogOnly.status, 'unregistered');
      assert.equal(catalogOnly.brightness, 0.24);
      const registered = body.state.lights
        .flatMap((artwork: any) => artwork.identity)
        .filter((identity: any) => identity.status !== 'unregistered');
      assert.equal(registered.length, 2);
      assert.deepEqual(new Set(registered.map((identity: any) => identity.brightness)), new Set([1]));
      assert.deepEqual(new Set(body.state.lights.flatMap((artwork: any) => artwork.identity)
        .map((identity: any) => identity.markerSize)), new Set([1]));
      const ulIdentity = body.state.lights.find((artwork: any) => artwork.artworkId === 'UL-100').identity[0];
      assert.deepEqual(ulIdentity.city, {
        id: 'denpasar-id',
        label: 'Denpasar, Indonesia',
        country: 'Indonesia',
        lat: -8.65,
        lng: 115.2167,
      });
      assert.deepEqual(body.state.facets.places, [{ id: 'denpasar-id', label: 'Denpasar, Indonesia' }]);
      assert.ok(body.state.facets.series.includes('Universal Language'));
      assert.ok(body.state.facets.years.includes(2024));
      assert.deepEqual(registered.map((identity: any) => identity.ordinal), [2, 1]);
      const nativeTips = Object.fromEntries(database.prepare(`
        SELECT piece_id || ':' || edition_number || ':native' AS key,
               lineage_head_hash AS hash
          FROM keeper_pieces
         WHERE registration_status = 'registered'
         ORDER BY key
      `).all().map((row) => [String(row.key), String(row.hash)]));
      assert.deepEqual(body.state.chainTips, nativeTips);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal(writes.length, 0);
      assert.doesNotMatch(JSON.stringify(body), /Private studio|Private birthplace|private-adult|private-other|keeper|email|auth|birth|template|cipher|nonce/i);
    } finally {
      database.close();
    }
  });

  it('omits revoked, retired-city, minor, inactive, and former-keeper city choices', async () => {
    const database = databaseThroughCollectorField();
    try {
      const cases = [
        ['kp-revoked', 'UL-100', 'auth-revoked', 'a'],
        ['kp-retired', 'UL-101', 'auth-retired', 'b'],
        ['kp-minor', 'UL-102', 'auth-minor', 'c'],
        ['kp-inactive', 'UL-103', 'auth-inactive', 'd'],
        ['kp-former', 'UL-104', 'auth-current', 'e'],
      ] as const;
      for (const [index, [id, artworkId, keeperUserId, seed]] of cases.entries()) {
        await insertRegisteredIdentity(database, {
          id, artworkId, keeperUserId,
          eventAt: `2026-08-${String(index + 1).padStart(2, '0')}T01:00:00.000Z`,
          eventHashSeed: seed,
        });
      }
      database.exec(`
        INSERT INTO users (clerk_user_id, auth_user_id, email) VALUES
          ('auth-revoked', 'auth-revoked', 'revoked@example.com'),
          ('auth-retired', 'auth-retired', 'retired@example.com'),
          ('auth-minor', 'auth-minor', 'minor@example.com'),
          ('auth-inactive', 'auth-inactive', 'inactive@example.com'),
          ('auth-former', 'auth-former', 'former@example.com'),
          ('auth-current', 'auth-current', 'current@example.com');
        INSERT INTO profiles
          (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id,
           computed_json)
        VALUES
          (1, '1980-01-01', '12:00', 'Private', 0, 0, 'UTC', '{}'),
          (2, '1980-01-01', '12:00', 'Private', 0, 0, 'UTC', '{}'),
          (3, '2012-01-01', '12:00', 'Private', 0, 0, 'UTC', '{}'),
          (4, '1980-01-01', '12:00', 'Private', 0, 0, 'UTC', '{}'),
          (5, '1980-01-01', '12:00', 'Private', 0, 0, 'UTC', '{}'),
          (6, '1980-01-01', '12:00', 'Private', 0, 0, 'UTC', '{}');
        INSERT INTO collector_curated_cities (id, label, population, active) VALUES
          ('revoked-city', 'Revoked', 100000, 1),
          ('retired-city', 'Retired', 100000, 0),
          ('minor-city', 'Minor', 100000, 1),
          ('inactive-city', 'Inactive', 100000, 0),
          ('former-city', 'Former', 100000, 1);
        DROP TRIGGER collector_adult_piece_privacy_insert_guard;
        DROP TRIGGER collector_active_city_piece_privacy_insert_guard;
        DROP TRIGGER collector_piece_privacy_current_keeper_insert_guard;
        INSERT INTO collector_piece_privacy
          (keeper_piece_id, user_id, share_city, city_id, policy_version, updated_at)
        VALUES
          ('kp-revoked', 1, 0, NULL, 'collector-privacy-v1', '2026-08-09T00:00:00.000Z'),
          ('kp-retired', 2, 1, 'retired-city', 'collector-privacy-v1', '2026-08-09T00:00:00.000Z'),
          ('kp-minor', 3, 1, 'minor-city', 'collector-privacy-v1', '2026-08-09T00:00:00.000Z'),
          ('kp-inactive', 4, 1, 'inactive-city', 'collector-privacy-v1', '2026-08-09T00:00:00.000Z'),
          ('kp-former', 5, 1, 'former-city', 'collector-privacy-v1', '2026-08-09T00:00:00.000Z');
      `);

      const response = await atlasRequest({
        request: new Request('https://adrianrasmussen.com/api/atlas'),
        env: { DB: d1(database) },
      });
      assert.equal(response.status, 200);
      const body = await response.json() as any;
      assert.deepEqual(body.state.facets.places, []);
      assert.equal(body.state.lights.flatMap((artwork: any) => artwork.identity)
        .every((identity: any) => identity.city === null), true);
    } finally {
      database.close();
    }
  });

  it('keeps an active unpinned city completely private', async () => {
    const database = databaseThroughCollectorField();
    try {
      insertCatalog(database, 'UL-100', 'Universal Language');
      await insertRegisteredIdentity(database, {
        id: 'kp-unpinned', artworkId: 'UL-100', keeperUserId: 'auth-adult',
        eventAt: '2026-08-09T01:00:00.000Z', eventHashSeed: 'f',
      });
      database.exec(`
        INSERT INTO users (clerk_user_id, auth_user_id, email)
        VALUES ('auth-adult', 'auth-adult', 'private@example.com');
        INSERT INTO profiles
          (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id,
           computed_json)
        VALUES (1, '1980-01-01', '12:00', 'Private', 0, 0, 'UTC', '{}');
        INSERT INTO collector_curated_cities (id, label, population, active)
        VALUES ('denpasar-id-extra', 'Near Denpasar', 100000, 1);
        INSERT INTO collector_piece_privacy
          (keeper_piece_id, user_id, share_city, city_id, policy_version, updated_at)
        VALUES ('kp-unpinned', 1, 1, 'denpasar-id-extra',
          'collector-privacy-v1', '2026-08-09T03:00:00.000Z');
      `);

      const response = await atlasRequest({
        request: new Request('https://adrianrasmussen.com/api/atlas'),
        env: { DB: d1(database) },
      });
      assert.equal(response.status, 200);
      const state = (await response.json() as any).state;
      assert.deepEqual(state.facets.places, []);
      assert.equal(state.lights[0].identity[0].city, null);
      assert.equal(state.lights[0].identity[0].status, 'private');
    } finally {
      database.close();
    }
  });

  it('shows a consented city under 50k population now that the floor is removed', async () => {
    const database = databaseThroughCollectorField();
    try {
      insertCatalog(database, 'UL-100', 'Universal Language');
      await insertRegisteredIdentity(database, {
        id: 'kp-ubud', artworkId: 'UL-100', keeperUserId: 'auth-adult',
        eventAt: '2026-08-09T01:00:00.000Z', eventHashSeed: 'f',
      });
      database.exec(`
        INSERT INTO users (clerk_user_id, auth_user_id, email)
        VALUES ('auth-adult', 'auth-adult', 'private@example.com');
        INSERT INTO profiles
          (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id,
           computed_json)
        VALUES (1, '1980-01-01', '12:00', 'Private', 0, 0, 'UTC', '{}');
        INSERT INTO collector_curated_cities (id, label, population, active)
        VALUES ('ubud-id', 'Ubud, Indonesia', 35000, 1);
        INSERT INTO collector_piece_privacy
          (keeper_piece_id, user_id, share_city, city_id, policy_version, updated_at)
        VALUES ('kp-ubud', 1, 1, 'ubud-id',
          'collector-privacy-v1', '2026-08-09T03:00:00.000Z');
      `);

      const response = await atlasRequest({
        request: new Request('https://adrianrasmussen.com/api/atlas'),
        env: { DB: d1(database) },
      });
      assert.equal(response.status, 200);
      const state = (await response.json() as any).state;
      assert.deepEqual(state.facets.places, [{ id: 'ubud-id', label: 'Ubud, Indonesia' }]);
      assert.deepEqual(state.lights[0].identity[0].city, {
        id: 'ubud-id',
        label: 'Ubud, Indonesia',
        country: 'Indonesia',
        lat: -8.5069,
        lng: 115.2625,
      });
    } finally {
      database.close();
    }
  });

  it('fails closed when native lineage is tampered after registration', async () => {
    const database = databaseThroughCollectorField();
    try {
      await insertRegisteredIdentity(database, {
        id: 'kp-tampered', artworkId: 'UL-100', keeperUserId: 'auth-holder',
        eventAt: '2026-08-09T01:00:00.000Z', eventHashSeed: 'a',
      });
      database.exec(`
        DROP TRIGGER artwork_lineage_no_update;
        UPDATE artwork_lineage_events
           SET public_payload_json = '{"tampered":true}'
         WHERE keeper_piece_id = 'kp-tampered';
      `);
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

  it('fails closed when a permanent ordinal is detached from its first bind', async () => {
    const database = databaseThroughCollectorField();
    try {
      await insertRegisteredIdentity(database, {
        id: 'kp-detached-ordinal', artworkId: 'UL-100', keeperUserId: 'auth-holder',
        eventAt: '2026-08-09T01:00:00.000Z', eventHashSeed: 'a',
      });
      database.exec(`
        DROP TRIGGER collector_claim_ordinals_no_delete;
        DELETE FROM collector_claim_ordinals
         WHERE keeper_piece_id = 'kp-detached-ordinal';
      `);
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

  it('keeps the empty field truthful and the public endpoint GET-only', async () => {
    const database = databaseThroughCollectorField();
    try {
      const response = await atlasRequest({
        request: new Request('https://adrianrasmussen.com/api/atlas'),
        env: { DB: d1(database) },
      });
      assert.equal(response.status, 200);
      const body = await response.json() as any;
      assert.deepEqual(body.state.lights, []);
      assert.deepEqual(body.state.facets, { series: [], years: [], places: [] });

      const post = await atlasRequest({
        request: new Request('https://adrianrasmussen.com/api/atlas', { method: 'POST' }),
        env: { DB: d1(database) },
      });
      assert.equal(post.status, 405);
    } finally {
      database.close();
    }
  });
});

describe('collector field client contract', () => {
  it('publishes a strict state parser and response parser for schema v3', async () => {
    await assert.doesNotReject(async () => {
      const contract = await import('../utils/collectorField.ts');
      assert.equal(typeof contract.parseCollectorFieldState, 'function');
      assert.equal(typeof contract.parseCollectorFieldResponse, 'function');
      assert.equal(typeof contract.fetchCollectorField, 'function');
    });
  });

  it('accepts only the exact schema v3 allowlist and returns deterministic data', async () => {
    const contract = await import('../utils/collectorField.ts');
    const state = {
      generatedAt: '2026-08-09T04:00:00.000Z',
      schemaVersion: 3,
      lights: [{
        artworkId: 'UL-100',
        title: 'Art of Living - 32',
        series: 'Universal Language',
        year: 2024,
        identity: [{
          publicCode: 'AR-ABCDEFGH',
          editionLabel: 'Original',
          status: 'registered',
          ordinal: 1,
          city: {
            id: 'denpasar-id', label: 'Denpasar, Indonesia', country: 'Indonesia',
            lat: -8.65, lng: 115.2167,
          },
          brightness: 1,
          markerSize: 1,
        }],
      }],
      facets: {
        series: ['Universal Language'],
        years: [2024],
        places: [{ id: 'denpasar-id', label: 'Denpasar, Indonesia' }],
      },
      chainTips: { 'UL-100:0:native': 'a'.repeat(64) },
    };

    assert.deepEqual(contract.parseCollectorFieldState(state), state);
    assert.deepEqual(contract.parseCollectorFieldResponse({ ok: true, state }), state);
    assert.deepEqual(await contract.fetchCollectorField(
      new URL('https://adrianrasmussen.com/api/atlas'),
      async () => new Response(JSON.stringify({ ok: true, state }), { status: 200 }),
    ), state);
  });

  it('rejects unknown fields, private identifiers, brightness drift, and unstable ordering', async () => {
    const { parseCollectorFieldState } = await import('../utils/collectorField.ts');
    const empty = {
      generatedAt: '2026-08-09T04:00:00.000Z',
      schemaVersion: 3,
      lights: [],
      facets: { series: [], years: [], places: [] },
      chainTips: {},
    };
    assert.throws(
      () => parseCollectorFieldState({ ...empty, keeperId: 'private-keeper' }),
      /collector_field_invalid/,
    );
    assert.throws(
      () => parseCollectorFieldState({
        ...empty,
        lights: [{
          artworkId: 'UL-100', title: 'One', series: null, year: null,
          identity: [{
            publicCode: null, editionLabel: null, status: 'unregistered', ordinal: null,
            city: null, brightness: 1, markerSize: 1,
          }],
        }],
      }),
      /collector_field_invalid/,
    );
    assert.throws(
      () => parseCollectorFieldState({
        ...empty,
        facets: { series: ['Z', 'A'], years: [2025, 2024], places: [] },
      }),
      /collector_field_invalid/,
    );
    assert.throws(
      () => parseCollectorFieldState({
        ...empty,
        facets: { series: ['Universal Language'], years: [], places: [] },
      }),
      /collector_field_invalid/,
    );
    assert.throws(
      () => parseCollectorFieldState({
        ...empty,
        lights: [{
          artworkId: 'UL-100', title: 'One', series: null, year: null,
          identity: [
            {
              publicCode: 'AR-BBBBBBBB', editionLabel: 'Edition 2',
              status: 'private', ordinal: 2, city: null, brightness: 1,
              markerSize: 1,
            },
            {
              publicCode: 'AR-AAAAAAAA', editionLabel: 'Edition 1',
              status: 'private', ordinal: 1, city: null, brightness: 1,
              markerSize: 1,
            },
          ],
        }],
      }),
      /collector_field_invalid/,
    );
    assert.throws(
      () => parseCollectorFieldState({
        ...empty,
        generatedAt: '2026-02-30T04:00:00.000Z',
      }),
      /collector_field_invalid/,
    );
    assert.throws(
      () => parseCollectorFieldState({
        ...empty,
        chainTips: { 'UL-100:0:native': 'a'.repeat(64) },
      }),
      /collector_field_invalid/,
    );
    assert.throws(
      () => parseCollectorFieldState({
        ...empty,
        lights: [{
          artworkId: 'UL-100', title: 'One', series: null, year: null,
          identity: [{
            publicCode: 'AR-AAAAAAAA', editionLabel: 'Original',
            status: 'private', ordinal: '1', city: null, brightness: 1,
            markerSize: 1,
          }],
        }],
      }),
      /collector_field_invalid/,
    );
  });
});
