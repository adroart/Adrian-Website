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

  it('is a nested lazy route with a stable header and one meaningful action', () => {
    const app = source('App.tsx');
    const navigation = source('components/admin/AdminNavigation.ts');
    const screen = source('components/admin/ArtworkWorkspace.tsx');
    const header = source('components/admin/ArtworkWorkspaceHeader.tsx');

    assert.match(app, /lazy\(\(\) => import\('\.\/components\/admin\/ArtworkWorkspace'\)\)/);
    assert.match(app, /path="artworks\/:artworkId" element=\{<ArtworkWorkspace\s*\/>\}/);
    // The list at /admin/artworks is a menu destination, because opening one
    // artwork is how the desk begins. The workspace beneath it is per record,
    // so nothing in the menu ever names a single artwork.
    assert.match(navigation, /href: '\/admin\/artworks'/);
    assert.doesNotMatch(navigation, /\/admin\/artworks\//);
    assert.match(screen, /<ArtworkWorkspaceHeader/);
    assert.match(screen, /loadArtworkWorkspace\(selector, controller\.signal\)/);
    assert.match(screen, /new AbortController\(\)/);
    assert.match(header, /<AdminPageHeader/);
    assert.match(header, /workspace\?\.nextAction/);
    assert.equal((header.match(/workspace\?\.nextAction\?\.href/g) || []).length, 1);
    assert.doesNotMatch(screen, /<form\b|fetch\([^)]*,\s*\{\s*method:/);
  });

  it('renders six stable read-only summaries and exact specialist deep links', () => {
    const screen = source('components/admin/ArtworkWorkspace.tsx');
    for (const id of [
      'artwork-record-certificate',
      'artwork-sale-ledger',
      'artwork-invitation-caretaker',
      'artwork-public-preview',
      'artwork-plate-recovery',
      'artwork-maintenance-history',
    ]) assert.match(screen, new RegExp(`id=["']${id}["']`), id);

    for (const route of [
      '/admin/collector-sales', '/admin/certificates', '/admin/invitations',
      '/works/', '/admin/pieces/wizard', '/admin/maintenance',
    ]) assert.match(screen, new RegExp(route.replaceAll('/', '\\/')));
    assert.match(screen, /artistArtworkRecordId/);
    assert.match(screen, /keeperPieceId/);
    assert.match(screen, /encodeURIComponent/);
  });

  it('uses the admin state primitives and focuses missing or conflicting status', () => {
    const screen = source('components/admin/ArtworkWorkspace.tsx');
    for (const primitive of [
      'AdminPage', 'AdminPageHeader', 'AdminSection', 'AdminAlert', 'AdminEmptyState',
    ]) assert.match(
      `${screen}\n${source('components/admin/ArtworkWorkspaceHeader.tsx')}`,
      new RegExp(`<${primitive}`),
    );
    assert.match(screen, /statusRef/);
    assert.match(screen, /tabIndex=\{-1\}/);
    assert.match(screen, /requestAnimationFrame/);
    assert.match(screen, /workspace_not_found/);
    assert.match(screen, /workspace_selector_conflict/);
    assert.match(screen, /Loading artwork workspace/);
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
