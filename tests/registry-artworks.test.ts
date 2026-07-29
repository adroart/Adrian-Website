import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  ARTWORK_ID_PATTERN,
  findStaticArtwork,
  resolveArtwork,
  validateDraftInput,
} from '../functions/api/_lib/artworkCatalog.js';

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

describe('mint + admin wiring', () => {
  it('the mint endpoint resolves an artwork from either source', () => {
    const pieces = readFileSync(new URL('../functions/api/admin/pieces.js', import.meta.url), 'utf8');
    assert.match(pieces, /resolveArtwork/);
    assert.match(pieces, /await validateNewIssuance\(env, basic\)/);
    const issuePiece = pieces.slice(pieces.indexOf('async function issuePiece'));
    assert.ok(issuePiece.indexOf('findByIssuanceKey') < issuePiece.indexOf('validateNewIssuance(env, basic)'));
    assert.doesNotMatch(pieces, /FULL_ARCHIVE/);
  });

  it('the draft admin endpoint gates create behind the registry unlock', () => {
    const artworks = readFileSync(new URL('../functions/api/admin/artworks.js', import.meta.url), 'utf8');
    assert.match(artworks, /requireRegistryUnlock/);
    assert.match(artworks, /findStaticArtwork/);
    assert.match(artworks, /already_in_catalog/);
    assert.match(artworks, /editionKind/);
  });

  it('the public draft record only appears once a plate exists', () => {
    const works = readFileSync(new URL('../functions/api/works/[id].js', import.meta.url), 'utf8');
    assert.match(works, /FROM keeper_pieces WHERE piece_id/);
    assert.match(works, /registry_artworks/);
  });
});
