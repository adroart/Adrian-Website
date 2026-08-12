import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PUBLIC_CODE = 'AR-7KQ9M2WX';
const WORK_PATH = `/works/MD-905?instance=${PUBLIC_CODE}&ref=qr`;
const TOKEN = 'correct-contributor-invitation-token-value-12345';

const identity = {
  artworkId: 'MD-905', title: 'Registry Draft Study', series: 'Studio Works',
  edition: { kind: 'numbered', number: 1, size: 3, label: 'Edition 1 of 3' },
  publicCode: PUBLIC_CODE, artistName: 'Adrian Rasmussen', plateStatus: 'active',
  publicProvenance: [], creatorHistory: [],
};

async function enableLegacy(page: Page, path: string) {
  await page.goto('/');
  await page.evaluate(async (nextPath) => {
    const loadModule = Function('return import("/launchFlags.ts")');
    const module = await loadModule();
    module.LAUNCH_FLAGS.livingLegacy = true;
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

async function remountLegacyAfterReload(page: Page, path: string) {
  await page.reload();
  await page.evaluate(async (nextPath) => {
    const loadModule = Function('return import("/launchFlags.ts")');
    const module = await loadModule();
    module.LAUNCH_FLAGS.livingLegacy = true;
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

async function mockSignedAccount(page: Page, account: () => { id: string; email: string }) {
  await page.route('**/api/auth/get-session', route => {
    const current = account();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: current.id, email: current.email, emailVerified: true },
        session: { id: `session-${current.id}` },
      }),
    });
  });
  await page.route('**/api/auth/sync-user', route => route.fulfill({ status: 200, body: '{}' }));
}

test('recipient proof stays memory-only across status checks, safe replay, and account switch', async ({ page }, testInfo) => {
  let account = { id: 'contributor-one', email: 'contributor@example.com' };
  await mockSignedAccount(page, () => account);
  const acceptanceKeys: string[] = [];
  let acceptRequests = 0;
  const logged: string[] = [];
  page.on('console', (message) => logged.push(message.text()));

  await page.route('**/__test/switch-contributor-account', route => {
    account = { id: 'contributor-two', email: 'second@example.com' };
    return route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/api/contributor-invitations', async route => {
    const body = route.request().postDataJSON() as Record<string, string>;
    if (body.action === 'accept') {
      acceptRequests += 1;
      acceptanceKeys.push(body.idempotencyKey);
      if (acceptRequests === 1) return route.abort('connectionfailed');
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, invitationId: 'aci-correct', status: 'replay' }),
      });
    }
    if (body.token.startsWith('wrong')) {
      return route.fulfill({
        status: 404, contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'contributor_invitation_not_available' }),
      });
    }
    const status = body.token.startsWith('expired') ? 'expired' : 'available';
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        ok: true, invitationId: `aci-${status}`, status,
        artwork: {
          artworkId: 'MD-905', publicCode: PUBLIC_CODE,
          edition: { kind: 'numbered', number: 1, size: 3 },
        },
      }),
    });
  });

  await enableLegacy(page, '/account/contributor-access');
  const proof = page.getByRole('textbox', { name: 'Contributor invitation' });

  await proof.fill(`wrong-${'x'.repeat(38)}`);
  await page.getByRole('button', { name: 'Check invitation' }).click();
  await expect(page.getByRole('alert')).toContainText('unavailable for this signed-in account');

  await proof.fill(`expired-${'x'.repeat(36)}`);
  await page.getByRole('button', { name: 'Check invitation' }).click();
  await expect(page.getByText('Identifier:').locator('..')).toContainText('MD-905');
  await expect(page.getByText('This invitation has expired')).toBeVisible();

  await proof.fill(TOKEN);
  await expect(page.getByRole('heading', { name: 'Invitation artwork' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Check invitation' }).click();
  await expect(page.getByText('This invitation is ready to accept.')).toBeVisible();
  if (process.env.CONTRIBUTOR_SCREENSHOTS) {
    await page.screenshot({
      path: `${process.env.CONTRIBUTOR_SCREENSHOTS}/account-${testInfo.project.name.replaceAll(' ', '-').toLowerCase()}.png`,
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: 'Accept contributor access' }).click();
  await expect(page.getByRole('alert')).toContainText('same safe acceptance attempt');
  await page.getByRole('button', { name: 'Accept contributor access' }).click();
  await expect(page.getByText('already accepted by this safe attempt')).toBeVisible();
  expect(acceptanceKeys).toHaveLength(2);
  expect(acceptanceKeys[0]).toBe(acceptanceKeys[1]);
  await expect(proof).toHaveValue('');

  await proof.fill(TOKEN);
  await page.evaluate(async () => {
    await fetch('/__test/switch-contributor-account');
    const loadModule = Function('return import("/lib/account/authClient.ts")');
    const module = await loadModule();
    module.authClient.$store.notify('$sessionSignal');
  });
  await expect(proof).toHaveValue('');
  expect(page.url()).not.toContain(TOKEN);
  expect(logged.join('\n')).not.toContain(TOKEN);
  const persisted = await page.evaluate((token) => ({
    local: Object.values(localStorage).some((value) => value.includes(token)),
    session: Object.values(sessionStorage).some((value) => value.includes(token)),
  }), TOKEN);
  expect(persisted).toEqual({ local: false, session: false });
});

test('keeper manages one-time invitations and contributor access without keeper control leakage', async ({ page }, testInfo) => {
  let account = { id: 'keeper-one', email: 'keeper@example.com' };
  let relationship: 'keeper' | 'contributor' | 'visitor' = 'keeper';
  let active = true;
  let pending = false;
  const oneTimeToken = 'one-time-secret-held-only-in-this-open-page';
  await mockSignedAccount(page, () => account);

  await page.route('**/__test/become-contributor', route => {
    account = { id: 'contributor-one', email: 'contributor@example.com' };
    relationship = 'contributor';
    return route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/__test/revoke-open-contributor', route => {
    relationship = 'visitor';
    return route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/__test/transfer-current-keeper', route => {
    relationship = 'visitor';
    return route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/__test/restore-current-keeper', route => {
    relationship = 'keeper';
    return route.fulfill({ status: 204, body: '' });
  });
  await page.route(`**/api/registry/${PUBLIC_CODE}`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, identity }),
  }));
  await page.route('**/api/works/MD-905', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, artwork: { id: 'MD-905', title: identity.title, series: identity.series, editionSize: 3 } }),
  }));
  await page.route(`**/api/lineage/${PUBLIC_CODE}`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, artwork: { pieceId: 'MD-905', editionNumber: 1, publicCode: PUBLIC_CODE }, events: [] }),
  }));
  await page.route('**/api/certificates/**', route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'unavailable' }),
  }));
  await page.route('**/api/collector/dreams/public/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ dream: null }),
  }));
  await page.route('**/api/collector/**', route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'unavailable' }),
  }));
  await page.route('**/api/keeper/certificate-ledger?**', route => route.fulfill({
    status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false, currentKeeper: false }),
  }));
  await page.route('**/api/keeper/piece?**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(relationship === 'keeper' ? {
      ok: true, kept: true, byYou: true, contributor: false,
      keeperPieceId: 'kp-one', currentDisplayLocation: 'Private studio', stewardHistory: [],
    } : relationship === 'contributor' ? {
      ok: true, kept: true, byYou: false, contributor: true,
    } : {
      ok: true, kept: true, byYou: false, contributor: false,
    }),
  }));
  await page.route('**/api/keeper/contributors?**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      invitations: pending ? [{
        invitationId: 'aci-pending', recipientEmail: 'pending@example.com',
        invitedAt: '2026-08-11T00:00:00.000Z', expiresAt: '2026-08-18T00:00:00.000Z', status: 'available',
      }] : [],
      contributors: active ? [{
        accessId: 'aci-active', recipientEmail: 'active@example.com',
        grantedAt: '2026-08-10T00:00:00.000Z', status: 'active',
      }] : [],
    }),
  }));
  await page.route('**/api/keeper/contributors', async route => {
    const body = route.request().postDataJSON() as Record<string, string>;
    if (body.action === 'invite') {
      pending = true;
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ ok: true, invitationId: 'aci-pending', status: 'created', token: oneTimeToken }),
      });
    }
    if (body.accessId === 'aci-active') active = false;
    if (body.invitationId === 'aci-pending') pending = false;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, invitationId: body.accessId || body.invitationId, status: 'revoked' }),
    });
  });

  await enableLegacy(page, WORK_PATH);
  await expect(page.getByRole('heading', { name: 'Artwork contributors' })).toBeVisible();
  await expect(page.getByText('active@example.com')).toBeVisible();
  await page.getByLabel('Verified account email').fill('pending@example.com');
  await page.getByRole('button', { name: 'Create invitation' }).click();
  await expect(page.getByText(oneTimeToken)).toBeVisible();
  if (process.env.CONTRIBUTOR_SCREENSHOTS) {
    await page.screenshot({
      path: `${process.env.CONTRIBUTOR_SCREENSHOTS}/keeper-${testInfo.project.name.replaceAll(' ', '-').toLowerCase()}.png`,
      fullPage: true,
    });
  }

  await page.evaluate(async () => {
    await fetch('/__test/transfer-current-keeper');
    window.dispatchEvent(new Event('focus'));
  });
  await expect(page.getByRole('heading', { name: 'Artwork contributors' })).toHaveCount(0);
  await expect(page.getByText(oneTimeToken)).toHaveCount(0);
  await page.evaluate(async (path) => {
    await fetch('/__test/restore-current-keeper');
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, WORK_PATH);
  await expect(page.getByRole('heading', { name: 'Artwork contributors' })).toBeVisible();

  await remountLegacyAfterReload(page, WORK_PATH);
  await expect(page.getByRole('heading', { name: 'Artwork contributors' })).toBeVisible();
  await expect(page.getByText(oneTimeToken)).toHaveCount(0);
  await expect(page.getByText('pending@example.com')).toBeVisible();

  await page.getByRole('button', { name: 'Revoke contributor access' }).click();
  await expect(page.getByRole('button', { name: 'Confirm revoke' })).toBeFocused();
  await page.getByRole('button', { name: 'Confirm revoke' }).click();
  await expect(page.getByText('active@example.com')).toHaveCount(0);

  await page.evaluate(async () => {
    await fetch('/__test/become-contributor');
    const loadModule = Function('return import("/lib/account/authClient.ts")');
    const module = await loadModule();
    module.authClient.$store.notify('$sessionSignal');
  });
  await expect(page.getByText('You are a contributor to this artwork')).toBeVisible();
  for (const privateControl of [
    'Artwork contributors', 'Where it lives now', 'Tend this dream', 'Price history',
  ]) await expect(page.getByText(privateControl, { exact: true })).toHaveCount(0);

  const accessibility = await new AxeBuilder({ page }).include('#main-content').analyze();
  expect(accessibility.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact || ''))).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.evaluate(async () => {
    await fetch('/__test/revoke-open-contributor');
    window.dispatchEvent(new Event('focus'));
  });
  await expect(page.getByText('You are a contributor to this artwork')).toHaveCount(0);
});
