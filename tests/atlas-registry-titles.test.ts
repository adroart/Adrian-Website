/**
 * A light on the map carries the artwork's real name.
 *
 * Measured on 2026-09-02: the feed named every light by its bare identifier
 * with no series. The projection reads titles from the published archive
 * only, and an artwork registered through the wizard lives in the registry's
 * own catalogue instead, so nothing the wizard registers had a name on the
 * map. Downstream the damage compounds: Mandala Codes types a piece by its
 * series, so a Universal Language work crossed the seam as "other", and the
 * feed's series filter had nothing to filter by.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { onRequest as atlasRequest } from '../functions/api/atlas.js';
import { buildLineageEvent } from '../functions/api/_lib/lineage.js';
import { ensureCatalogSnapshot } from '../functions/api/_lib/catalogSnapshot.js';

const migration = (name: string) =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');

const schema = [
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
  '023_collector_registry_merge.sql',
  '024_ownership_foundation.sql',
  '025_artwork_registration.sql',
  '026_artwork_invitations.sql',
  '027_certificate_templates.sql',
  '028_collector_privacy.sql',
  '029_collector_dreams.sql',
  '030_collector_field.sql',
  '035_city_floor_removal.sql',
].map(migration).join('\n');

function d1(database: DatabaseSync) {
  return {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      return {
        bind(...args: SQLInputValue[]) { values = args; return this; },
        async all() { return { results: database.prepare(sql).all(...values) }; },
        async first() { return database.prepare(sql).get(...values) ?? null; },
        async run() { return database.prepare(sql).run(...values); },
      };
    },
  };
}

/** One registered identity for an artwork the published archive never heard
 *  of, which is exactly what the registration wizard creates. */
async function databaseWithRegisteredArtwork(withCatalogueRow: boolean) {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(schema);
  if (withCatalogueRow) {
    database.exec(`
      INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
      VALUES ('UL-777', 'Universal Language 77', 'Universal Language', 9,
        '2026-09-02T00:00:00.000Z');
    `);
  }
  const eventAt = '2026-09-02T00:00:00.000Z';
  const event = await buildLineageEvent({
    keeperPieceId: 'kp-titles',
    sequence: 1,
    eventType: 'migration_baseline',
    eventAt,
    previousHash: null,
    publicPayload: {},
  });
  // A complete registered identity: the registry's own insert guard
  // refuses anything less, so the fixture has to be the real thing.
  const digest = 'a'.repeat(64);
  database.exec(`
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, recovery_code_hash, plate_status,
       registration_status, public_code, issuance_key, registered_at,
       ownership_code_ciphertext, ownership_code_nonce, ownership_code_key_version,
       identity_backup_status, identity_backup_reference, identity_backup_sha256,
       identity_backup_at, lineage_head_hash, lineage_event_count)
    VALUES ('kp-titles', 'UL-777', 1, '${'b'.repeat(64)}', 'legacy',
      'registered', 'AR-TITLES77', 'issuance-titles', '${eventAt}',
      'ciphertext', 'nonce', 1,
      'verified', 'identities/AR-TITLES77/${digest}.json', '${digest}',
      '${eventAt}', '${event.eventHash}', 1);
    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json)
    VALUES ('lineage-titles', 'kp-titles', 1, 'migration_baseline',
      '${eventAt}', NULL, '${event.eventHash}', '{}');
  `);
  return database;
}

async function lightFor(database: DatabaseSync) {
  const response = await atlasRequest({
    request: new Request('https://adrianrasmussen.com/api/atlas'),
    env: { DB: d1(database) },
  });
  const body = await response.json() as any;
  assert.equal(body.ok, true, JSON.stringify(body));
  return {
    light: body.state.lights.find((candidate: any) => candidate.artworkId === 'UL-777'),
    facets: body.state.facets,
  };
}

describe('a light carries the artwork name the registry holds', () => {
  it('prefers the newest explicit snapshot while preserving historical snapshots', async () => {
    const database = await databaseWithRegisteredArtwork(true);
    try {
      database.exec(migration('036_artwork_catalog_snapshots.sql'));
      const env = { DB: d1(database) };
      await ensureCatalogSnapshot(env, { id: 'UL-777', title: 'Original registered title', series: 'Universal Language', editionSize: 7 }, { source: 'admin', createdAt: '2026-08-01T00:00:00Z' });
      await ensureCatalogSnapshot(env, { id: 'UL-777', title: 'Explicit corrected title', series: 'Universal Language', editionSize: 7 }, { source: 'admin', createdAt: '2026-08-02T00:00:00Z' });
      const { light } = await lightFor(database);
      assert.equal(light.title, 'Explicit corrected title');
      assert.equal(database.prepare('SELECT count(*) AS n FROM artwork_catalog_snapshots').get()?.n, 2);
    } finally { database.close(); }
  });
  it('names and serieses an artwork the published archive does not carry', async () => {
    const database = await databaseWithRegisteredArtwork(true);
    try {
      const { light, facets } = await lightFor(database);
      assert.equal(light.title, 'Universal Language 77');
      assert.equal(light.series, 'Universal Language');
      // and the feed's own series filter now has something to offer
      assert.deepEqual(facets.series, ['Universal Language']);
    } finally {
      database.close();
    }
  });

  it('still answers, naming the light by its identifier, when no catalogue row exists', async () => {
    const database = await databaseWithRegisteredArtwork(false);
    try {
      const { light } = await lightFor(database);
      assert.equal(light.title, 'UL-777');
      assert.equal(light.series, null);
    } finally {
      database.close();
    }
  });

  it('reads the catalogue on its own so one absent table cannot darken the map', () => {
    const source = readFileSync(new URL('../functions/api/atlas.js', import.meta.url), 'utf8');
    assert.match(source, /SELECT id, title, series FROM registry_artworks/);
    assert.match(source, /registryArtworkRows = \[\];\s*\n\s*\}/);
  });
});
