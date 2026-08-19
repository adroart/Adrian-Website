import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { findStaticArtwork, resolveArtwork } from '../functions/api/_lib/artworkCatalog.js';
import { ensureCatalogSnapshot } from '../functions/api/_lib/catalogSnapshot.js';
import { onRequest as worksOnRequest } from '../functions/api/works/[id].js';

const readMigration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);

// Everything through the catalog-snapshot migration this consolidation adds,
// following the same house pattern as tests/piece-record-privacy.test.ts.
const migrationsThroughCatalogSnapshots = [
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
  '035_artwork_catalog_snapshots.sql', '036_piece_records.sql',
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

function freshDb(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec(migrationsThroughCatalogSnapshots);
  return database;
}

/** A minimal, schema-valid 'registered' keeper_pieces row: a permanent
 *  identity with no plate ever fabricated (plate_status stays 'legacy'). */
function insertRegisteredIdentity(database: DatabaseSync, options: {
  keeperPieceId: string;
  artworkId: string;
  publicCode: string;
  issuanceKey: string;
  recoveryCodeHash: string;
  identityBackupSha256: string;
  registeredAt?: string;
}) {
  const registeredAt = options.registeredAt ?? '2026-01-01T00:00:00.000Z';
  const identityBackupReference =
    `identities/${options.publicCode}/${options.identityBackupSha256}.json`;
  database.prepare(`
    INSERT INTO keeper_pieces (
      id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key,
      registered_at, ownership_code_ciphertext, ownership_code_nonce,
      ownership_code_key_version, registration_status,
      identity_backup_status, identity_backup_reference, identity_backup_sha256,
      identity_backup_at
    ) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, 1, 'registered', 'verified', ?, ?, ?)
  `).run(
    options.keeperPieceId, options.artworkId, options.recoveryCodeHash,
    options.publicCode, options.issuanceKey, registeredAt,
    'ciphertext', 'nonce', identityBackupReference, options.identityBackupSha256,
    registeredAt,
  );
}

function hex(seed: string): string {
  return seed.repeat(64).slice(0, 64);
}

describe('resolveArtwork: catalog snapshot precedence (in-memory D1)', () => {
  it('the newest snapshot wins over conflicting static and draft edition metadata, without throwing', async () => {
    const database = freshDb();
    const env = { DB: d1(database) };
    const staticPiece = findStaticArtwork('UL-100');
    assert.ok(staticPiece, 'UL-100 should exist in the static catalog');
    const originalEditionSize = staticPiece!.editionSize;
    staticPiece!.editionSize = 5; // the static catalog says 5
    try {
      // The draft table separately disagrees, at 4.
      database.prepare(`
        INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
        VALUES ('UL-100', 'Older Draft Title', NULL, 4, '2026-01-01T00:00:00.000Z')
      `).run();

      // A snapshot recorded at registration time disagrees with both, at 9.
      await ensureCatalogSnapshot(env, {
        id: 'UL-100',
        title: 'Frozen Registration Title',
        series: 'Universal Language',
        editionKind: 'numbered',
        editionSize: 9,
      }, { source: 'admin', createdAt: '2026-02-01T00:00:00.000Z' });

      const resolved = await resolveArtwork(env, 'UL-100');
      assert.equal(resolved?.source, 'snapshot');
      assert.equal(resolved?.title, 'Frozen Registration Title');
      assert.equal(resolved?.editionKind, 'numbered');
      assert.equal(resolved?.editionSize, 9);
    } finally {
      staticPiece!.editionSize = originalEditionSize;
      database.close();
    }
  });

  it('without a snapshot, the same static/draft conflict still fails closed', async () => {
    const database = freshDb();
    const env = { DB: d1(database) };
    const staticPiece = findStaticArtwork('UL-100');
    assert.ok(staticPiece);
    const originalEditionSize = staticPiece!.editionSize;
    staticPiece!.editionSize = 5;
    try {
      database.prepare(`
        INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
        VALUES ('UL-100', 'Older Draft Title', NULL, 4, '2026-01-01T00:00:00.000Z')
      `).run();
      await assert.rejects(
        () => resolveArtwork(env, 'UL-100'),
        /artwork_edition_metadata_conflict/,
      );
    } finally {
      staticPiece!.editionSize = originalEditionSize;
      database.close();
    }
  });
});

describe('GET /api/works/:id — registered-but-uncataloged fallback (in-memory D1)', () => {
  it('serves the snapshot shape for a registered identity that has no fabricated plate', async () => {
    const database = freshDb();
    const env = { DB: d1(database) };
    insertRegisteredIdentity(database, {
      keeperPieceId: 'kp-registry-only',
      artworkId: 'ZZ-905',
      publicCode: 'AR-TESTPIEC',
      issuanceKey: 'issue-key-registry-only',
      recoveryCodeHash: hex('a'),
      identityBackupSha256: hex('b'),
    });
    await ensureCatalogSnapshot(env, {
      id: 'ZZ-905',
      title: 'Registry-Only Study',
      series: 'Field Notes',
      category: 'sculpture',
      year: '2026',
      dimensions: '10 x 8 x 3 in',
      materials: ['walnut', 'brass'],
      description: 'Typed in during registration, before any catalog entry existed.',
      editionKind: 'unique',
      editionSize: null,
    }, { source: 'admin', createdAt: '2026-01-01T00:00:00.000Z' });

    const response = await worksOnRequest({
      request: new Request('https://example.test/api/works/ZZ-905'),
      env,
      params: { id: 'ZZ-905' },
    } as never);

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, {
      ok: true,
      artwork: {
        id: 'ZZ-905',
        title: 'Registry-Only Study',
        series: 'Field Notes',
        year: '2026',
        dimensions: '10 x 8 x 3 in',
        materials: ['walnut', 'brass'],
        category: 'sculpture',
        description: 'Typed in during registration, before any catalog entry existed.',
        edition: { kind: 'unique', size: null },
      },
    });
    database.close();
  });

  it('serves the draft shape (no snapshot yet) for a registered identity from the older registration path', async () => {
    const database = freshDb();
    const env = { DB: d1(database) };
    insertRegisteredIdentity(database, {
      keeperPieceId: 'kp-registry-only-legacy',
      artworkId: 'ZZ-906',
      publicCode: 'AR-TESTPIED',
      issuanceKey: 'issue-key-registry-only-legacy',
      recoveryCodeHash: hex('c'),
      identityBackupSha256: hex('d'),
    });
    database.prepare(`
      INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
      VALUES ('ZZ-906', 'Draft Only Study', 'Field Notes', 3, '2026-01-01T00:00:00.000Z')
    `).run();

    const response = await worksOnRequest({
      request: new Request('https://example.test/api/works/ZZ-906'),
      env,
      params: { id: 'ZZ-906' },
    } as never);

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, {
      ok: true,
      artwork: {
        id: 'ZZ-906',
        title: 'Draft Only Study',
        series: null,
        year: null,
        dimensions: null,
        materials: [],
        category: null,
        description: null,
        edition: { kind: 'numbered', size: 3 },
      },
    });
    database.close();
  });

  it('404s for an id with no registered identity, even when a snapshot or draft row exists', async () => {
    const database = freshDb();
    const env = { DB: d1(database) };
    // A snapshot alone, with no keeper_pieces row at all, is not "registered".
    await ensureCatalogSnapshot(env, {
      id: 'ZZ-907',
      title: 'Never Registered',
      editionKind: 'unique',
      editionSize: null,
    }, { source: 'admin', createdAt: '2026-01-01T00:00:00.000Z' });
    database.prepare(`
      INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
      VALUES ('ZZ-907', 'Never Registered', NULL, NULL, '2026-01-01T00:00:00.000Z')
    `).run();

    const neverRegistered = await worksOnRequest({
      request: new Request('https://example.test/api/works/ZZ-907'),
      env,
      params: { id: 'ZZ-907' },
    } as never);
    assert.equal(neverRegistered.status, 404);
    assert.deepEqual(await neverRegistered.json(), { ok: false, error: 'not_found' });

    // An id absent everywhere is the same clean 404.
    const unknown = await worksOnRequest({
      request: new Request('https://example.test/api/works/ZZ-999'),
      env,
      params: { id: 'ZZ-999' },
    } as never);
    assert.equal(unknown.status, 404);
    assert.deepEqual(await unknown.json(), { ok: false, error: 'not_found' });

    database.close();
  });

  it('a piece already resolvable purely from the static catalog is not this endpoint\'s to serve', async () => {
    const database = freshDb();
    const env = { DB: d1(database) };
    insertRegisteredIdentity(database, {
      keeperPieceId: 'kp-static-registered',
      artworkId: 'UL-100',
      publicCode: 'AR-TESTPIEE',
      issuanceKey: 'issue-key-static-registered',
      recoveryCodeHash: hex('e'),
      identityBackupSha256: hex('f'),
    });
    // No snapshot recorded (as if registered before this consolidation) and
    // UL-100 has no draft row — resolveArtwork falls through to the static
    // catalog, which WorksPage already renders directly without this API.
    const response = await worksOnRequest({
      request: new Request('https://example.test/api/works/UL-100'),
      env,
      params: { id: 'UL-100' },
    } as never);
    assert.equal(response.status, 404);
    database.close();
  });
});
