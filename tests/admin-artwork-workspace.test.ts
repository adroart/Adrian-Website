import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('admin artwork workspace screen', () => {
  it('maps the catalog route and exact optional instance and record queries to the reader selector', async () => {
    const { artworkWorkspaceSelector } = await import('../components/admin/ArtworkWorkspace.tsx');

    assert.deepEqual(
      artworkWorkspaceSelector('UL-100', new URLSearchParams(
        'instance=keeper-1&record=record-1',
      )),
      {
        artworkId: 'UL-100',
        keeperPieceId: 'keeper-1',
        artistArtworkRecordId: 'record-1',
      },
    );
    assert.deepEqual(
      artworkWorkspaceSelector('UL-100', new URLSearchParams()),
      { artworkId: 'UL-100' },
    );
    assert.throws(() => artworkWorkspaceSelector(undefined, new URLSearchParams()));
    assert.throws(() => artworkWorkspaceSelector('UL-100', new URLSearchParams('instance=a&instance=b')));
    assert.throws(() => artworkWorkspaceSelector('UL-100', new URLSearchParams('record=a&record=b')));
    assert.throws(() => artworkWorkspaceSelector('UL-100', new URLSearchParams('private=hidden')));
  });

  it('retains the nested lazy route and keeps screen edits in specialist tools', () => {
    const app = source('App.tsx');
    const navigation = source('components/admin/AdminNavigation.ts');
    const screen = source('components/admin/ArtworkWorkspace.tsx');

    assert.ok(app.includes("lazy(() => import('./components/admin/ArtworkWorkspace'))"));
    assert.ok(app.includes('path="artworks/:artworkId" element={<ArtworkWorkspace'));
    assert.ok(navigation.includes("href: '/admin/artworks'"));
    assert.doesNotMatch(navigation, /\/admin\/artworks\//);
    assert.doesNotMatch(screen, /<form\b|fetch\([^)]*,\s*\{\s*method:/);
  });

  it('adds only identified artwork backlinks and preserves exact physical identity', () => {
    const app = source('App.tsx');
    const sales = source('components/admin/CollectorSales.tsx');
    const pieces = source('components/AdminPieces.tsx');
    const maintenance = source('components/AdminMaintenance.tsx');
    const wizard = source('components/AdminPlateWizard.tsx');

    // The registration flow moved from an inline App.tsx component to the
    // ceremony at components/registry/RegisterCeremony.tsx; its post-register
    // backlink still carries the exact physical identity.
    const ceremony = source('components/registry/RegisterCeremony.tsx');
    assert.match(ceremony, /View and save codes/);
    assert.match(ceremony, /instance: result\.keeperPieceId/);
    assert.match(app, /path="register" element=\{<RegisterCeremony/);
    assert.match(sales, /item\.identificationStatus !== 'unresolved'/);
    assert.match(sales, /record: item\.artworkRecordId/);
    assert.match(sales, /instance: item\.keeperPieceId/);
    assert.match(pieces, /encodeURIComponent\(row\.pieceId\)/);
    assert.match(pieces, /instance: row\.id/);
    assert.match(pieces, /pieces\/wizard\?\$\{new URLSearchParams\(\{ keeperPieceId: row\.id \}\)\}/);
    assert.doesNotMatch(pieces, /to="\/admin\/plate-wizard"/);
    assert.match(maintenance, /onClick=\{guardMaintenanceNavigation\}/);
    assert.match(maintenance, /encodeURIComponent\(selected\.public\.artworkId\)/);
    assert.match(maintenance, /instance: selected\.id/);
    assert.match(wizard, /encodeURIComponent\(piece\.pieceId\)/);
    assert.match(wizard, /instance: piece\.id/);
  });
});
