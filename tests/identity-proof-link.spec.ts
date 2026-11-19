import { expect, test } from './fixtures';

test('opens exact identity proof without entering the fabrication or activation flow', async ({ page }) => {
  let unlocked = false;
  let proved = false;
  const done: unknown[] = [];
  const fixtures = [
    { id: 'piece-active', plateStatus: 'active', editionNumber: 7, publicCode: 'AR-7KQ8M2WX' },
    { id: 'piece-legacy', plateStatus: 'legacy', editionNumber: 8, publicCode: 'AR-8KQ8M2WX' },
    { id: 'piece-void', plateStatus: 'void', editionNumber: 9, publicCode: 'AR-9KQ8M2WX' },
  ];
  await page.route('**/api/admin/verify', route => route.fulfill({
    json: { ok: true, admin: { id: 'artist-admin', email: 'artist@example.test' } },
  }));
  await page.route('**/api/admin/registry-unlock', route => {
    const get = route.request().method() === 'GET';
    if (!get) unlocked = route.request().postDataJSON().secret === 'fixture-only';
    return route.fulfill({ json: { ok: get || unlocked, unlocked } });
  });
  await page.route('**/api/admin/pieces', route => route.fulfill({
    json: { ok: true, pieces: fixtures.map(piece => ({
      ...piece, pieceId: 'UL-101', registrationStatus: 'registered',
      backupStatus: piece.plateStatus === 'active' ? 'verified' : null,
      identityRecoveryQualification: { status: proved && piece.id === 'piece-active' ? 'current' : 'missing' },
      recoveryQualification: { status: piece.plateStatus === 'active' ? 'current' : 'missing' },
    })) },
  }));
  await page.route('**/api/admin/pieces/piece-active/verify-recovery', route => {
    expect(unlocked).toBe(true);
    done.push(route.request().postDataJSON());
    proved = true;
    return route.fulfill({ json: { ok: true, keyVersion: 1 } });
  });

  await page.goto('/admin/pieces/wizard?keeperPieceId=piece-active&proof=identity');
  const download = page.getByRole('button', { name: 'Download the identity copy' });
  await expect(page.getByRole('heading', { name: 'Unlock the private registry' })).toBeVisible();
  await expect(download).toHaveCount(0);
  await page.getByLabel('Registry unlock secret').fill('fixture-only');
  await page.getByRole('button', { name: 'Unlock registry' }).click();
  await expect(page.getByRole('heading', { name: 'Prove the identity copy' })).toBeVisible();
  await expect(page.getByText(/edition 7 · AR-7KQ8M2WX/)).toBeVisible();
  await expect(download).toBeEnabled();
  await expect(page.getByRole('list', { name: 'Plate stages' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next step' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /activate|generate plate|the plate copy/i })).toHaveCount(0);
  await page.getByLabel('Choose archived copy').setInputFiles({
    name: 'archived-identity.json', mimeType: 'application/json', buffer: Buffer.from('{}'),
  });
  await page.getByRole('button', { name: 'Verify copied recovery file' }).click();
  await expect(page.getByText('The archived identity copy was verified. Identity recovery proof is current.')).toBeVisible();
  expect(done).toEqual([{ backupDocument: '{}', qualificationKind: 'identity' }]);
  await expect(page.getByRole('button', { name: 'Next step' })).toHaveCount(0);

  await page.goto('/admin/pieces/wizard?keeperPieceId=piece-legacy&proof=identity');
  await expect(download).toBeVisible();
  await expect(page.getByText(/edition 8 · AR-8KQ8M2WX/)).toBeVisible();
  await expect(page.getByRole('button', { name: /activate|generate plate/i })).toHaveCount(0);

  await page.goto('/admin/pieces/wizard?keeperPieceId=piece-void&proof=identity');
  await expect(page.getByRole('alert')).toHaveText('Identity recovery proof is unavailable for this piece.');
  await expect(download).toHaveCount(0);
});
