import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  ARTWORK_ID_PATTERN,
  findStaticArtwork,
  resolveArtwork,
  validateDraftInput,
} from '../functions/api/_lib/artworkCatalog.js';
import { issueRegistryPlate } from '../functions/api/_lib/registryPlateIssuance.js';

function fakeEnv(row: unknown, opts: { throwMissing?: boolean } = {}) {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => {
            if (opts.throwMissing) throw new Error('D1_ERROR: no such table: registry_artworks');
            return row;
          },
        }),
      }),
    },
  } as never;
}

// A DB fake that answers the catalog-snapshot query and the draft-row query
// with independent rows, keyed off the SQL text each caller prepares — the
// same distinction a real D1 connection makes by running different SQL.
function fakeSnapshotEnv(options: { snapshotRow?: unknown; draftRow?: unknown } = {}) {
  return {
    DB: {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => {
            if (/artwork_catalog_snapshots/.test(sql)) return options.snapshotRow ?? null;
            if (/registry_artworks/.test(sql)) return options.draftRow ?? null;
            return null;
          },
        }),
      }),
    },
  } as never;
}

function snapshotRow(metadata: Record<string, unknown>) {
  return {
    snapshot_hash: 'a'.repeat(64),
    canonical_json: JSON.stringify(metadata),
    source: 'admin',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('draft artwork validation', () => {
  it('accepts a numbered draft and normalizes its explicit edition identity', () => {
    const result = validateDraftInput({
      id: 'ul-105',
      title: '  A Study  ',
      series: ' Universal Language ',
      editionKind: 'numbered',
      editionSize: '10',
    });
    assert.deepEqual(result, {
      id: 'UL-105',
      title: 'A Study',
      series: 'Universal Language',
      editionKind: 'numbered',
      editionSize: 10,
    });
  });

  it('accepts a confirmed unique draft and normalizes its edition size to null', () => {
    assert.deepEqual(
      validateDraftInput({
        id: 'MD-007',
        title: 'One',
        editionKind: 'unique',
        uniqueConfirmed: true,
        editionSize: 12,
      }),
      {
        id: 'MD-007',
        title: 'One',
        series: null,
        editionKind: 'unique',
        editionSize: null,
      },
    );
  });

  it('requires an explicit edition kind and unique confirmation', () => {
    assert.equal(
      validateDraftInput({ id: 'MD-007', title: 'One' }).error,
      'edition_required',
    );
    assert.equal(
      validateDraftInput({ id: 'MD-007', title: 'One', editionKind: '' }).error,
      'edition_required',
    );
    assert.equal(
      validateDraftInput({ id: 'MD-007', title: 'One', editionKind: 'unique' }).error,
      'unique_confirmation_required',
    );
  });

  it('requires a size for numbered editions', () => {
    assert.equal(
      validateDraftInput({ id: 'MD-007', title: 'One', editionKind: 'numbered' }).error,
      'edition_size_required',
    );
    assert.equal(
      validateDraftInput({ id: 'MD-007', title: 'One', editionKind: 'numbered', editionSize: '' }).error,
      'edition_size_required',
    );
  });

  it('rejects bad ids, the reserved AR- prefix, empty titles, and bad editions', () => {
    assert.equal(validateDraftInput({ id: 'ul-1', title: 'x' }).error, 'invalid_id');
    assert.equal(validateDraftInput({ id: 'UL-1005', title: 'x' }).error, 'invalid_id');
    assert.equal(validateDraftInput({ id: 'AR-123', title: 'x' }).error, 'reserved_prefix');
    assert.equal(validateDraftInput({ id: 'UL-105', title: '   ' }).error, 'invalid_title');
    assert.equal(validateDraftInput({ id: 'UL-105', title: 'x', editionKind: 'other' }).error, 'invalid_edition_kind');
    assert.equal(validateDraftInput({ id: 'UL-105', title: 'x', editionKind: 'numbered', editionSize: '0' }).error, 'invalid_edition_size');
    assert.equal(validateDraftInput({ id: 'UL-105', title: 'x', editionKind: 'numbered', editionSize: '2.5' }).error, 'invalid_edition_size');
    assert.equal(validateDraftInput({ id: 'UL-105', title: 'x', editionKind: 'numbered', editionSize: '10000' }).error, 'invalid_edition_size');
  });

  it('the id pattern matches 2 to 3 letters, a dash, and 3 digits', () => {
    assert.ok(ARTWORK_ID_PATTERN.test('UL-105'));
    assert.ok(ARTWORK_ID_PATTERN.test('MDA-042'));
    assert.ok(!ARTWORK_ID_PATTERN.test('U-105'));
    assert.ok(!ARTWORK_ID_PATTERN.test('ULMD-105'));
  });
});

describe('artwork resolution for minting', () => {
  it('represents a static catalog piece without edition metadata as unspecified', async () => {
    const staticPiece = findStaticArtwork('UL-100');
    assert.ok(staticPiece, 'UL-100 should exist in the static catalog');
    const resolved = await resolveArtwork(fakeEnv(null), 'UL-100');
    assert.equal(resolved?.source, 'catalog');
    assert.equal(resolved?.id, 'UL-100');
    assert.equal(resolved?.title, staticPiece!.title);
    assert.equal(resolved?.editionKind, 'unspecified');
  });

  it('uses registry edition metadata when an overlapping static entry has none', async () => {
    const resolved = await resolveArtwork(
      fakeEnv({ id: 'UL-100', title: 'Older Draft Title', edition_size: 7 }),
      'UL-100',
    );
    assert.equal(resolved?.source, 'catalog');
    assert.equal(resolved?.title, findStaticArtwork('UL-100')?.title);
    assert.equal(resolved?.editionKind, 'numbered');
    assert.equal(resolved?.editionSize, 7);
  });

  it('fails closed when overlapping static and registry edition sizes conflict', async () => {
    const staticPiece = findStaticArtwork('UL-100');
    assert.ok(staticPiece);
    const originalEditionSize = staticPiece!.editionSize;
    staticPiece!.editionSize = 5;
    try {
      await assert.rejects(
        () => resolveArtwork(
          fakeEnv({ id: 'UL-100', title: 'Older Draft Title', edition_size: 4 }),
          'UL-100',
        ),
        /artwork_edition_metadata_conflict/,
      );
    } finally {
      staticPiece!.editionSize = originalEditionSize;
    }
  });

  it('falls back to a draft piece in the database', async () => {
    const resolved = await resolveArtwork(
      fakeEnv({ id: 'UL-905', title: 'Draft Study', edition_size: 5 }),
      'UL-905',
    );
    assert.deepEqual(resolved, {
      id: 'UL-905',
      title: 'Draft Study',
      editionKind: 'numbered',
      editionSize: 5,
      source: 'registry',
    });
  });

  it('infers a unique edition identity from a legacy null edition size', async () => {
    const resolved = await resolveArtwork(
      fakeEnv({ id: 'MD-905', title: 'Unique Study', edition_size: null }),
      'MD-905',
    );
    assert.equal(resolved?.editionKind, 'unique');
    assert.equal(resolved?.editionSize, null);
  });

  it('returns null for an unknown id and when the table is missing', async () => {
    assert.equal(await resolveArtwork(fakeEnv(null), 'ZZ-999'), null);
    assert.equal(await resolveArtwork(fakeEnv(null, { throwMissing: true }), 'ZZ-999'), null);
  });

  it('does not confuse the reserved plate prefix for an artwork', () => {
    assert.equal(findStaticArtwork('AR-ABCDEFGH'), null);
  });
});

describe('snapshot precedence for a registered piece', () => {
  it('the newest snapshot wins over conflicting static and draft edition metadata, without throwing', async () => {
    const staticPiece = findStaticArtwork('UL-100');
    assert.ok(staticPiece);
    const originalEditionSize = staticPiece!.editionSize;
    staticPiece!.editionSize = 5; // static says 5
    try {
      const env = fakeSnapshotEnv({
        snapshotRow: snapshotRow({
          id: 'UL-100',
          title: 'Snapshot Title',
          series: 'Universal Language',
          category: 'sculpture',
          year: '2024',
          dimensions: '12 x 12 x 4 in',
          materials: ['walnut', 'brass'],
          description: 'A frozen record of this exact registration.',
          edition: { kind: 'numbered', size: 9 }, // snapshot says 9
        }),
        draftRow: { id: 'UL-100', title: 'Older Draft Title', edition_size: 4 }, // draft says 4
      });
      const resolved = await resolveArtwork(env, 'UL-100');
      assert.deepEqual(resolved, {
        id: 'UL-100',
        title: 'Snapshot Title',
        editionKind: 'numbered',
        editionSize: 9,
        source: 'snapshot',
        series: 'Universal Language',
        category: 'sculpture',
        year: '2024',
        dimensions: '12 x 12 x 4 in',
        materials: ['walnut', 'brass'],
        description: 'A frozen record of this exact registration.',
      });
    } finally {
      staticPiece!.editionSize = originalEditionSize;
    }
  });

  it('a unique-edition snapshot resolves with a null edition size and materials default to an empty list', async () => {
    const env = fakeSnapshotEnv({
      snapshotRow: snapshotRow({
        id: 'MD-905',
        title: 'One of One',
        series: null,
        category: null,
        year: null,
        dimensions: null,
        materials: [],
        description: null,
        edition: { kind: 'unique', size: null },
      }),
    });
    const resolved = await resolveArtwork(env, 'MD-905');
    assert.equal(resolved?.source, 'snapshot');
    assert.equal(resolved?.editionKind, 'unique');
    assert.equal(resolved?.editionSize, null);
    assert.deepEqual(resolved?.materials, []);
  });

  it('falls back past a missing or malformed snapshot without disturbing static/draft resolution', async () => {
    // No snapshot table at all — the classic missing-table failure.
    const missingTable = await resolveArtwork(
      fakeSnapshotEnv({ draftRow: { id: 'UL-905', title: 'Draft Study', edition_size: 5 } }),
      'UL-905',
    );
    assert.equal(missingTable?.source, 'registry');
    assert.equal(missingTable?.title, 'Draft Study');

    // A malformed snapshot row (unparsable JSON) is treated the same as "no snapshot".
    const malformed = await resolveArtwork(
      fakeSnapshotEnv({
        snapshotRow: { snapshot_hash: 'a'.repeat(64), canonical_json: 'not json', source: 'admin', created_at: '2026-01-01T00:00:00.000Z' },
        draftRow: { id: 'UL-905', title: 'Draft Study', edition_size: 5 },
      }),
      'UL-905',
    );
    assert.equal(malformed?.source, 'registry');
    assert.equal(malformed?.title, 'Draft Study');
  });
});

describe('mint + admin wiring', () => {
  it('the legacy mint endpoint only replays an issuance key and requires artwork registration otherwise', async () => {
    const pieces = readFileSync(new URL('../functions/api/admin/pieces.js', import.meta.url), 'utf8');
    const queries: string[] = [];
    const env = {
      OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
      OWNERSHIP_CODE_KEY_V1: Buffer.alloc(32, 7).toString('base64'),
      DB: {
        prepare(sql: string) {
          queries.push(sql.replace(/\s+/g, ' ').trim());
          return {
            bind(issuanceKey: string) {
              assert.equal(issuanceKey, 'existing-registration-only');
              return { first: async () => null };
            },
          };
        },
      },
    };

    const response = await issueRegistryPlate(new Request('https://example.test/api/admin/pieces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pieceId: 'UL-100',
        editionNumber: 0,
        issuanceKey: 'existing-registration-only',
      }),
    }), env);

    assert.match(pieces, /issueRegistryPlate/);
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: 'artwork_registration_required',
    });
    assert.deepEqual(queries, ['SELECT * FROM keeper_pieces WHERE issuance_key = ?1']);
  });

  it('the draft admin endpoint gates create behind the registry unlock', () => {
    const artworks = readFileSync(new URL('../functions/api/admin/artworks.js', import.meta.url), 'utf8');
    assert.match(artworks, /requireRegistryUnlock/);
    assert.match(artworks, /findStaticArtwork/);
    assert.match(artworks, /staticArtwork\.title/);
    assert.match(artworks, /staticArtwork\.series/);
    assert.match(artworks, /editionKind/);
  });

  it('reserves migration 016 for the durable edition guard and advances later plans', () => {
    const guard = readFileSync(new URL('../migrations/016_keeper_piece_edition_kind_guard.sql', import.meta.url), 'utf8');
    assert.match(guard, /keeper_piece_edition_kind_conflict/);

    const maintenance = readFileSync(new URL('../docs/superpowers/plans/2026-07-30-registry-maintenance-and-acquisitions.md', import.meta.url), 'utf8');
    assert.match(maintenance, /017_creator_registry_maintenance\.sql/);
    assert.match(maintenance, /018_registry_plate_lifecycle\.sql/);
    assert.match(maintenance, /019_registry_creator_history\.sql/);
    assert.doesNotMatch(maintenance, /016_creator_registry_maintenance\.sql|017_registry_plate_lifecycle\.sql|018_registry_creator_history\.sql/);

    const recovery = readFileSync(new URL('../docs/superpowers/plans/2026-07-30-registry-recovery-hardening.md', import.meta.url), 'utf8');
    assert.match(recovery, /020_registry_recovery_qualification\.sql/);
    assert.doesNotMatch(recovery, /019_registry_recovery_qualification\.sql/);
  });

  it('the public draft record appears for any registered identity, not only a fabricated plate', () => {
    const works = readFileSync(new URL('../functions/api/works/[id].js', import.meta.url), 'utf8');
    assert.match(works, /FROM keeper_pieces/);
    assert.match(works, /registration_status = 'registered'/);
    assert.doesNotMatch(works, /plate_status/);
    // Metadata comes from the shared resolver so the snapshot wins over the
    // thinner draft row when one exists.
    assert.match(works, /resolveArtwork/);
  });
});
