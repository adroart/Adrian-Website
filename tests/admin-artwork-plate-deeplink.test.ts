import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('artwork plate deep links', () => {
  it('accepts one exact keeper piece selection for the full registry desk', async () => {
    const { registryKeeperPieceSelection } = await import('../components/AdminPieces.tsx');

    assert.equal(registryKeeperPieceSelection(new URLSearchParams('keeperPieceId=kp-2')), 'kp-2');
    assert.equal(registryKeeperPieceSelection(new URLSearchParams()), null);
    assert.equal(registryKeeperPieceSelection(new URLSearchParams('keeperPieceId=')), null);
    assert.equal(registryKeeperPieceSelection(new URLSearchParams('keeperPieceId=%20kp-2')), null);
    assert.equal(
      registryKeeperPieceSelection(new URLSearchParams('keeperPieceId=kp-1&keeperPieceId=kp-2')),
      null,
    );
  });

  it('opens and focuses the exact physical row selected by keeperPieceId', () => {
    const pieces = source('components/AdminPieces.tsx');

    assert.match(pieces, /registryKeeperPieceSelection\(searchParams\)/);
    assert.match(pieces, /rowRefs\.current\.get\(linkedKeeperPieceId\)/);
    assert.match(pieces, /selectedRow\.scrollIntoView/);
    assert.match(pieces, /selectedRow\.focus/);
    assert.match(pieces, /aria-current=\{linkedKeeperPieceId === row\.id \? 'true' : undefined\}/);
  });

  it('uses the wizard only when its lifecycle can resume the exact piece', async () => {
    const { artworkPlateDestination } = await import('../components/admin/ArtworkWorkspace.tsx');

    assert.deepEqual(
      artworkPlateDestination('kp-generated', { state: 'generated', recoveryState: 'plate_backup_missing' }),
      {
        href: '/admin/pieces/wizard?keeperPieceId=kp-generated',
        label: 'Open plate and recovery wizard',
      },
    );
    assert.deepEqual(
      artworkPlateDestination('kp-repair', { state: 'active', recoveryState: 'plate_recovery_stale' }),
      {
        href: '/admin/pieces/wizard?keeperPieceId=kp-repair',
        label: 'Open plate and recovery wizard',
      },
    );
  });

  it('sends legacy and completed active identities to the exact registry row', async () => {
    const { artworkPlateDestination } = await import('../components/admin/ArtworkWorkspace.tsx');
    const wizard = source('components/AdminPlateWizard.tsx');

    for (const plate of [
      { state: 'legacy' as const, recoveryState: 'not_required' as const },
      { state: 'active' as const, recoveryState: 'current' as const },
      { state: 'active' as const, recoveryState: 'identity_stale' as const },
      { state: 'superseded' as const, recoveryState: 'not_required' as const },
    ]) {
      assert.deepEqual(artworkPlateDestination('kp-exact', plate), {
        href: '/admin/pieces?keeperPieceId=kp-exact',
        label: 'Open exact piece in plate registry',
      });
    }
    assert.equal(artworkPlateDestination(null, null), null);
    assert.match(wizard, /navigate\(`\/admin\/pieces\?\$\{new URLSearchParams\(\{ keeperPieceId: row\.id \}\)\}`/);
  });
});
