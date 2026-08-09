import { expect, test, type Page } from '@playwright/test';

const PUBLIC_CODE = 'AR-7KQ9M2WX';
const SECOND_PUBLIC_CODE = 'AR-ABCDEFGH';
const WORK_PATH = `/works/MD-905?instance=${PUBLIC_CODE}&ref=qr`;
const CLAIM_PATH = `${WORK_PATH}&claim=1`;
const SECOND_CLAIM_PATH = `/works/MD-905?instance=${SECOND_PUBLIC_CODE}&ref=qr&claim=1`;
const OWNERSHIP_CODE = 'K7QM-9XTR-2PHV-N4WB';

const identity = {
  artworkId: 'MD-905',
  title: 'Registry Draft Study',
  series: 'Studio Works',
  edition: { kind: 'numbered', number: 1, size: 3, label: 'Edition 1 of 3' },
  publicCode: PUBLIC_CODE,
  artistName: 'Adrian Rasmussen',
  plateStatus: 'active',
  publicProvenance: [],
  creatorHistory: [],
};

const secondIdentity = {
  artworkId: 'MD-905',
  title: 'Second Registry Study',
  series: 'Studio Works',
  edition: { kind: 'numbered', number: 2, size: 3, label: 'Edition 2 of 3' },
  publicCode: SECOND_PUBLIC_CODE,
  artistName: 'Adrian Rasmussen',
  plateStatus: 'active',
  publicProvenance: [],
  creatorHistory: [],
};

async function mockWork(page: Page) {
  await page.route(`**/api/registry/${PUBLIC_CODE}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, identity }),
  }));
  await page.route('**/api/works/MD-905', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      artwork: { id: 'MD-905', title: identity.title, series: identity.series, editionSize: 3 },
    }),
  }));
  await page.route(`**/api/lineage/${PUBLIC_CODE}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, artwork: { pieceId: 'MD-905', editionNumber: 1, publicCode: PUBLIC_CODE }, events: [] }),
  }));
  await page.route(`**/api/registry/${SECOND_PUBLIC_CODE}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, identity: secondIdentity }),
  }));
  await page.route(`**/api/lineage/${SECOND_PUBLIC_CODE}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, artwork: { pieceId: 'MD-905', editionNumber: 2, publicCode: SECOND_PUBLIC_CODE }, events: [] }),
  }));
}

async function openWithLivingLegacy(page: Page, path: string) {
  await page.goto('/');
  await page.evaluate(async (nextPath) => {
    const loadModule = Function('return import("/launchFlags.ts")');
    const module = await loadModule();
    module.LAUNCH_FLAGS.livingLegacy = true;
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

test('scanned sign-in returns to the canonical public claim URL without the Ownership Code', async ({ page }) => {
  await mockWork(page);
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: 'null',
  }));
  await page.route('**/api/auth/config', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ google: false }),
  }));
  let callbackURL = '';
  await page.route('**/api/auth/sign-in/email', async route => {
    callbackURL = (route.request().postDataJSON() as { callbackURL?: string }).callbackURL ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'requester', email: 'requester@example.com', emailVerified: true },
        session: { id: 'session-one' },
      }),
    });
  });

  await openWithLivingLegacy(page, WORK_PATH);
  await page.getByRole('button', { name: 'Register and certify this piece' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Sign in to continue' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign in' });
  await dialog.getByLabel('Email').fill('requester@example.com');
  await dialog.getByLabel('Password').fill('correct horse battery staple');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL(CLAIM_PATH);
  expect(callbackURL).toBe(CLAIM_PATH);
  expect(page.url()).not.toContain(OWNERSHIP_CODE);
});

test('a signed-in return with claim context automatically exposes registration', async ({ page }) => {
  await mockWork(page);
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: { id: 'requester', email: 'requester@example.com', emailVerified: true },
      session: { id: 'session-one' },
    }),
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }));
  await page.route('**/api/keeper/piece?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, kept: false, byYou: false }),
  }));

  await openWithLivingLegacy(page, CLAIM_PATH);
  await expect(page.getByRole('form', { name: 'Register Registry Draft Study' })).toBeVisible();
  await expect(page).toHaveURL(CLAIM_PATH);
});

test('a current keeper never sees registration doors or a claim-return proof form', async ({ page }) => {
  await mockWork(page);
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: { id: 'current-keeper', email: 'keeper@example.com', emailVerified: true },
      session: { id: 'session-current' },
    }),
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/keeper/piece?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      kept: true,
      byYou: true,
      keeperPieceId: 'kp-current',
      currentDisplayLocation: 'Private studio',
      stewardHistory: [],
    }),
  }));

  await openWithLivingLegacy(page, CLAIM_PATH);
  await expect(page.getByText('You are the current steward')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Register and certify this piece' })).toHaveCount(0);
  await expect(page.getByRole('form', { name: 'Register Registry Draft Study' })).toHaveCount(0);
});

test('signing out clears private registration state before another account can use it', async ({ page }) => {
  await mockWork(page);
  let signedIn = true;
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: signedIn ? JSON.stringify({
      user: { id: 'first-collector', email: 'first@example.com', emailVerified: true },
      session: { id: 'session-first' },
    }) : 'null',
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/keeper/piece?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, kept: false, byYou: false }),
  }));
  await page.route('**/api/admin/registry-unlock', route => route.fulfill({ status: 204, body: '' }));
  await page.route('**/api/auth/sign-out', route => {
    signedIn = false;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await openWithLivingLegacy(page, CLAIM_PATH);
  await page.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('button', { name: 'Use invitation' }).click();
  await page.getByLabel('Invitation', { exact: true }).fill('private-token-for-first-collector');

  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByLabel('Invitation', { exact: true })).toHaveCount(0);
  await expect(page.getByText('private-token-for-first-collector')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Register and certify this piece' })).toBeVisible();
});

test('an account switch cannot inherit another collector private state', async ({ page }) => {
  await mockWork(page);
  let accountId = 'first-collector';
  await page.route('**/__test/switch-collector-account', route => {
    accountId = 'second-collector';
    return route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: { id: accountId, email: `${accountId}@example.com`, emailVerified: true },
      session: { id: `session-${accountId}` },
    }),
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/keeper/piece?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(accountId === 'first-collector'
      ? { ok: true, kept: false, byYou: false }
      : { ok: true, kept: true, byYou: true, keeperPieceId: 'kp-second', stewardHistory: [] }),
  }));

  await openWithLivingLegacy(page, CLAIM_PATH);
  await page.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('button', { name: 'Use invitation' }).click();
  await page.getByLabel('Invitation', { exact: true }).fill('private-token-for-first-collector');

  await page.evaluate(async () => {
    await fetch('/__test/switch-collector-account');
    const loadModule = Function('return import("/lib/account/authClient.ts")');
    const module = await loadModule();
    module.authClient.$store.notify('$sessionSignal');
  });

  await expect(page.getByText('You are the current steward')).toBeVisible();
  await expect(page.getByLabel('Invitation', { exact: true })).toHaveCount(0);
  await expect(page.getByText('private-token-for-first-collector')).toHaveCount(0);
  await expect(page.getByRole('form', { name: 'Register Registry Draft Study' })).toHaveCount(0);
});

test('a signed-in return stays in onboarding after ownership proof succeeds', async ({ page }) => {
  await mockWork(page);
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: { id: 'requester', email: 'requester@example.com', emailVerified: true },
      session: { id: 'session-one' },
    }),
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({ status: 200, body: '{}' }));
  let bound = false;
  let bindRequests = 0;
  await page.route('**/api/keeper/piece?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(bound
      ? { ok: true, kept: true, byYou: true, keeperPieceId: 'kp-returned' }
      : { ok: true, kept: false, byYou: false }),
  }));
  await page.route('**/api/keeper/bind', async route => {
    bindRequests += 1;
    bound = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, keeper: { pieceId: 'MD-905', editionNumber: 1 } }),
    });
  });
  let onboardingLoads = 0;
  await page.route('**/api/collector/onboarding', route => {
    onboardingLoads += 1;
    return route.fulfill({
      status: onboardingLoads === 1 ? 503 : 200,
      contentType: 'application/json',
      body: JSON.stringify(onboardingLoads === 1
        ? { ok: false, error: 'temporarily_unavailable' }
        : { status: 'skipped' }),
    });
  });
  await page.route('**/api/collector/privacy?view=cities', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ cities: [] }),
  }));
  await page.route('**/api/collector/privacy?piece=**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ring1: { privateRecord: true },
      ring2: { shareCity: false, cityId: null },
      ring3: { shareDerivedChart: false },
      ring4: {
        shareFace: false, shareName: false, shareIntention: false,
        shareBusiness: false, shareMission: false,
      },
      policyVersion: null,
    }),
  }));

  await openWithLivingLegacy(page, CLAIM_PATH);
  const form = page.getByRole('form', { name: 'Register Registry Draft Study' });
  await form.getByLabel('Ownership Code').fill(OWNERSHIP_CODE);
  await form.getByRole('button', { name: 'Register' }).click();

  const privateLoadError = page.getByRole('region', { name: 'Your private choices are still closed' });
  await expect(privateLoadError.getByRole('alert')).toContainText('could not be opened');
  await expect(privateLoadError.getByRole('button', { name: 'Back to this piece' })).toBeVisible();
  await privateLoadError.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Privacy and birth details' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Register and certify this piece' })).toHaveCount(0);
  expect(bindRequests).toBe(1);
});

test('successful binding clears the Ownership Code before a failed status refresh', async ({ page }) => {
  await mockWork(page);
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: { id: 'requester', email: 'requester@example.com', emailVerified: true },
      session: { id: 'session-one' },
    }),
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({ status: 200, body: '{}' }));
  let statusLoads = 0;
  await page.route('**/api/keeper/piece?**', route => {
    statusLoads += 1;
    return route.fulfill({
      status: statusLoads === 1 ? 200 : 503,
      contentType: 'application/json',
      body: JSON.stringify(statusLoads === 1
        ? { ok: true, kept: false, byYou: false }
        : { ok: false, error: 'temporarily_unavailable' }),
    });
  });
  await page.route('**/api/keeper/bind', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, keeper: { pieceId: 'MD-905', editionNumber: 1 } }),
  }));

  await openWithLivingLegacy(page, CLAIM_PATH);
  const form = page.getByRole('form', { name: 'Register Registry Draft Study' });
  const input = form.getByLabel('Ownership Code');
  await input.fill(OWNERSHIP_CODE);
  await form.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByText('Stewardship could not be checked right now.')).toBeVisible();
  await expect(input).toHaveValue('');
});

test('a contested request stays pending and keeps the current steward visible', async ({ page }) => {
  await mockWork(page);
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: { id: 'requester', email: 'requester@example.com', emailVerified: true },
      session: { id: 'session-one' },
    }),
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }));
  await page.route('**/api/keeper/piece?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, kept: true, byYou: false }),
  }));

  const bindBodies: Array<Record<string, unknown>> = [];
  await page.route('**/api/keeper/bind', async route => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    bindBodies.push(body);
    if (body.ownershipCode !== OWNERSHIP_CODE) {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'code_mismatch', message: 'That Ownership Code did not match.' }),
      });
      return;
    }
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        status: 'claim_requested',
        message: 'Your request is recorded for manual review. The current steward and registration remain unchanged.',
        claim: { outcome: 'opened' },
      }),
    });
  });

  await openWithLivingLegacy(page, CLAIM_PATH);
  const form = page.getByRole('form', { name: 'Request stewardship' });
  await expect(form).toBeVisible();
  await expect(page.getByText('This piece already has a steward.')).toBeVisible();

  await form.getByLabel('Ownership Code').fill('AAAA-BBBB-CCCC-DDDD');
  await form.getByRole('button', { name: 'Request stewardship' }).click();
  await expect(form.getByRole('alert')).toContainText('did not match');
  expect(bindBodies).toHaveLength(1);

  await form.getByLabel('Ownership Code').fill(OWNERSHIP_CODE);
  await form.getByLabel('Evidence note (optional)').fill('Auction receipt available');
  await form.getByRole('button', { name: 'Request stewardship' }).click();

  await expect(form.getByRole('status')).toContainText('recorded for manual review');
  await expect(form.getByRole('status')).toContainText('remain unchanged');
  await expect(form.getByRole('status')).not.toContainText(/notified|silence|window/i);
  await expect(page.getByText('This piece already has a steward.')).toBeVisible();
  expect(bindBodies).toEqual([
    { publicCode: PUBLIC_CODE, ownershipCode: 'AAAA-BBBB-CCCC-DDDD' },
    { publicCode: PUBLIC_CODE, ownershipCode: OWNERSHIP_CODE, note: 'Auction receipt available' },
  ]);
  expect(page.url()).toBe(`http://localhost:5555${CLAIM_PATH}`);
  expect(page.url()).not.toContain(OWNERSHIP_CODE);
});

test('navigation clears the prior piece Ownership Code, note, and outcome', async ({ page }) => {
  await mockWork(page);
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: { id: 'requester', email: 'requester@example.com', emailVerified: true },
      session: { id: 'session-one' },
    }),
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/keeper/piece?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, kept: true, byYou: false }),
  }));

  await openWithLivingLegacy(page, CLAIM_PATH);
  const firstForm = page.getByRole('form', { name: 'Request stewardship' });
  await firstForm.getByLabel('Ownership Code').fill(OWNERSHIP_CODE);
  await firstForm.getByLabel('Evidence note (optional)').fill('Private receipt for the first piece');

  await navigateInApp(page, SECOND_CLAIM_PATH);
  const secondForm = page.getByRole('form', { name: 'Request stewardship' });
  await expect(page.getByTestId('public-registry-identity')).toContainText('Second Registry Study');
  await expect(secondForm.getByLabel('Ownership Code')).toHaveValue('');
  await expect(secondForm.getByLabel('Evidence note (optional)')).toHaveValue('');
  await expect(secondForm.getByRole('status')).toHaveCount(0);
});

test('a late status response from the prior publicCode cannot overwrite the current piece', async ({ page }) => {
  await mockWork(page);
  let markFirstStatusStarted: (() => void) | null = null;
  const firstStatusStarted = new Promise<void>((resolve) => { markFirstStatusStarted = resolve; });
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: { id: 'requester', email: 'requester@example.com', emailVerified: true },
      session: { id: 'session-one' },
    }),
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/keeper/piece?**', async route => {
    const code = new URL(route.request().url()).searchParams.get('publicCode');
    if (code === PUBLIC_CODE) {
      markFirstStatusStarted?.();
      await new Promise(resolve => setTimeout(resolve, 400));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, kept: true, byYou: true, currentDisplayLocation: 'First piece' }),
      }).catch(() => undefined);
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, kept: true, byYou: false }),
    });
  });

  await openWithLivingLegacy(page, CLAIM_PATH);
  await firstStatusStarted;
  await navigateInApp(page, SECOND_CLAIM_PATH);
  await expect(page.getByRole('form', { name: 'Request stewardship' })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole('form', { name: 'Request stewardship' })).toBeVisible();
  await expect(page.getByText('You are the current steward')).toHaveCount(0);
});

test('walks from a neutral registration door through proof, private choices, birth, and certificate', async ({ page }) => {
  await mockWork(page);
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: { id: 'collector-1', email: 'collector@example.com', emailVerified: true },
      session: { id: 'session-one' },
    }),
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({ status: 200, body: '{}' }));

  let bound = false;
  const privateBodies: unknown[] = [];
  await page.route('**/api/keeper/piece?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(bound
      ? { ok: true, kept: true, byYou: true, keeperPieceId: 'kp-private-1', currentDisplayLocation: null }
      : { ok: true, kept: false, byYou: false }),
  }));
  await page.route('**/api/keeper/bind', async route => {
    privateBodies.push(route.request().postDataJSON());
    bound = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, keeper: { pieceId: 'MD-905', editionNumber: 1 } }),
    });
  });
  await page.route('**/api/collector/onboarding', async route => {
    if (route.request().method() === 'POST') privateBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'current',
        inputs: {
          date: '1990-06-12',
          time: '09:30',
          place: { label: 'Denpasar, Indonesia', lat: -8.65, lng: 115.22, tzId: 'Asia/Makassar' },
        },
        updatedAt: '2026-08-01T00:00:00.000Z',
      }),
    });
  });
  await page.route('**/api/collector/privacy?view=cities', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ cities: [{ id: 'denpasar', label: 'Denpasar' }] }),
  }));
  await page.route('**/api/collector/privacy?piece=**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ring1: { privateRecord: true },
      ring2: { shareCity: false, cityId: null },
      ring3: { shareDerivedChart: false },
      ring4: {
        shareFace: false, shareName: false, shareIntention: false,
        shareBusiness: false, shareMission: false,
      },
      policyVersion: null,
    }),
  }));
  await page.route('**/api/collector/privacy', async route => {
    if (route.request().method() === 'PUT') privateBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ring1: { privateRecord: true },
        ring2: { shareCity: false, cityId: null },
        ring3: { shareDerivedChart: false },
        ring4: {
          shareFace: false, shareName: false, shareIntention: false,
          shareBusiness: false, shareMission: false,
        },
        policyVersion: 'collector-privacy-v1',
      }),
    });
  });
  await page.route('**/api/certificates/MD-905?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      certificate: {
        artworkId: 'MD-905',
        edition: { kind: 'numbered', number: 1, size: 3 },
        publicCode: PUBLIC_CODE,
        materials: ['Teak', 'Acrylic'],
        makers: [{ name: 'Adrian Rasmussen', role: 'Artist and maker' }],
        origin: 'Bali, Indonesia',
        yearWording: 'Made in 2026',
        editionWording: 'Edition 1 of 3',
        certificateWording: 'This record certifies the authentic artwork instance.',
        openingWording: 'A personal studio greeting may appear here.',
      },
    }),
  }));

  await openWithLivingLegacy(page, WORK_PATH);
  await expect(page.getByRole('button', { name: 'Register and certify this piece' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin your dream' })).toBeVisible();
  await page.getByRole('button', { name: 'Register and certify this piece' }).click();

  await expect(page.getByRole('heading', { name: 'Register this piece to you' })).toBeVisible();
  await expect(page.getByText(/durable, exportable record/i)).toBeVisible();
  await expect(page.getByText(/personal studio greeting/i)).toBeVisible();
  await expect(page.getByText(/ownership code remains with the artwork/i)).toBeVisible();
  await expect(page.getByText(/whoever holds that code can use it to register the piece/i)).toBeVisible();
  await expect(page.getByText(/keep it safe and private/i)).toBeVisible();
  await expect(page.getByText(/attached video is optional/i)).toBeVisible();
  await expect(page.getByText(/permanent hosting/i)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Use Ownership Code' }).click();

  const form = page.getByRole('form', { name: 'Register Registry Draft Study' });
  await form.getByLabel('Ownership Code').fill(OWNERSHIP_CODE);
  await form.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByRole('heading', { name: 'Privacy and birth details' })).toBeVisible();
  for (const label of [
    'Show the piece at city level, never at an address',
    'Share what is derived from your birth details, never the details themselves',
    'Your face', 'Your name', 'Your intention', 'Your business', 'Your mission',
  ]) {
    await expect(page.getByLabel(label)).not.toBeChecked();
  }
  await expect(page.getByText(/birth details are already here/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update' })).toBeVisible();
  await page.getByRole('button', { name: 'Save privacy choices' }).click();
  await page.getByRole('button', { name: 'Continue to certificate' }).click();

  const certificate = page.getByTestId('collector-certificate');
  await expect(certificate).toContainText('Teak · Acrylic');
  await expect(certificate).toContainText('Adrian Rasmussen · Artist and maker');
  await expect(certificate).toContainText('Bali, Indonesia');
  await expect(certificate).not.toContainText('Techniques');
  await certificate.getByRole('button', { name: 'Complete registration' }).click();
  await expect(page.getByText('Your piece is registered')).toBeVisible();

  expect(page.url()).not.toContain(OWNERSHIP_CODE);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(OWNERSHIP_CODE);
  expect(privateBodies[0]).toEqual({ publicCode: PUBLIC_CODE, ownershipCode: OWNERSHIP_CODE });
});

test('saving a missing adult birth profile reloads privacy before the certificate', async ({ page }) => {
  await mockWork(page);
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: { id: 'new-adult', email: 'adult@example.com', emailVerified: true },
      session: { id: 'session-adult' },
    }),
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({ status: 200, body: '{}' }));
  let bound = false;
  await page.route('**/api/keeper/piece?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(bound
      ? { ok: true, kept: true, byYou: true, keeperPieceId: 'kp-new-adult' }
      : { ok: true, kept: false, byYou: false }),
  }));
  await page.route('**/api/keeper/bind', async route => {
    bound = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, keeper: { pieceId: 'MD-905', editionNumber: 1 } }),
    });
  });
  await page.route('**/api/collector/onboarding', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(route.request().method() === 'POST'
      ? {
          status: 'current',
          inputs: {
            date: '1990-06-12',
            time: '09:30',
            place: {
              label: 'Denpasar, Bali, Indonesia',
              lat: -8.65,
              lng: 115.22,
              tzId: 'Asia/Makassar',
            },
          },
          updatedAt: '2026-08-09T00:00:00.000Z',
        }
      : { status: 'missing' }),
  }));
  let privacyLoads = 0;
  const closedPrivacy = {
    ring1: { privateRecord: true },
    ring2: { shareCity: false, cityId: null },
    ring3: { shareDerivedChart: false },
    ring4: {
      shareFace: false, shareName: false, shareIntention: false,
      shareBusiness: false, shareMission: false,
    },
    policyVersion: null,
  };
  await page.route('**/api/collector/privacy?piece=**', route => {
    privacyLoads += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(closedPrivacy),
    });
  });
  await page.route('**/api/collector/privacy?view=cities', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ cities: [{ id: 'denpasar', label: 'Denpasar' }] }),
  }));
  let savedPrivacy: Record<string, unknown> | null = null;
  await page.route('**/api/collector/privacy', async route => {
    if (route.request().method() === 'PUT') savedPrivacy = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...closedPrivacy,
        ring4: { ...closedPrivacy.ring4, shareName: true },
        policyVersion: 'collector-privacy-v1',
      }),
    });
  });
  await page.route('**/data/cities-index.json', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      name: 'Denpasar', admin: 'Bali', country: 'Indonesia', cc: 'ID',
      lat: -8.65, lng: 115.22, tz: 'Asia/Makassar',
    }]),
  }));
  await page.route('**/api/certificates/MD-905?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      certificate: {
        artworkId: 'MD-905',
        edition: { kind: 'numbered', number: 1, size: 3 },
        publicCode: PUBLIC_CODE,
      },
    }),
  }));

  await openWithLivingLegacy(page, WORK_PATH);
  await page.getByRole('button', { name: 'Register and certify this piece' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Use Ownership Code' }).click();
  const proof = page.getByRole('form', { name: 'Register Registry Draft Study' });
  await proof.getByLabel('Ownership Code').fill(OWNERSHIP_CODE);
  await proof.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByLabel('Your name')).toBeDisabled();
  await page.getByLabel('Date').fill('1990-06-12');
  await page.getByLabel('Time').fill('09:30');
  await page.getByLabel('Birth place').fill('Denpasar');
  await page.getByRole('button', { name: 'Denpasar, Bali, Indonesia' }).click();
  await page.getByRole('button', { name: 'Save details' }).click();

  await expect(page.getByText(/birth details are already here/i)).toBeVisible();
  await expect(page.getByLabel('Your name')).toBeEnabled();
  expect(privacyLoads).toBe(2);
  await page.getByLabel('Your name').check();
  await page.getByRole('button', { name: 'Save privacy choices' }).click();
  await expect(page.getByText('Privacy choices saved.')).toBeVisible();
  expect(savedPrivacy).toMatchObject({ person: { shareName: true } });
  await page.getByRole('button', { name: 'Continue to certificate' }).click();
  await expect(page.getByTestId('collector-certificate')).toBeVisible();
});

test('uses an artwork invitation as memory-only proof for the server-authoritative piece', async ({ page }) => {
  await mockWork(page);
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: { id: 'invited-collector', email: 'invited@example.com', emailVerified: true },
      session: { id: 'session-invited' },
    }),
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/certificates/MD-905?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      certificate: {
        artworkId: 'MD-905',
        edition: { kind: 'numbered', number: 1, size: 3 },
        publicCode: PUBLIC_CODE,
      },
    }),
  }));
  let bound = false;
  await page.route('**/api/keeper/piece?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(bound
      ? { ok: true, kept: true, byYou: true, keeperPieceId: 'kp-invited' }
      : { ok: true, kept: false, byYou: false }),
  }));

  const proofBodies: unknown[] = [];
  let releaseRedemption: () => void = () => {};
  const redemptionGate = new Promise<void>((resolve) => { releaseRedemption = resolve; });
  let redemptionRequests = 0;
  await page.route('**/api/invitations/inspect', async route => {
    const requestBody = route.request().postDataJSON();
    proofBodies.push(requestBody);
    if (requestBody.token === 'stale_inspection_token') {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    const wrongPiece = requestBody.token === 'wrong_piece_invitation';
    const status = requestBody.token === 'used_invitation'
      ? 'used'
      : requestBody.token === 'expired_invitation'
        ? 'expired'
        : requestBody.token === 'revoked_invitation'
          ? 'revoked'
          : 'available';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        invitationId: 'invitation-private',
        status,
        artwork: {
          artworkId: wrongPiece ? 'UL-100' : 'MD-905',
          title: wrongPiece ? 'Another artwork' : 'Registry Draft Study',
          publicCode: wrongPiece ? SECOND_PUBLIC_CODE : PUBLIC_CODE,
          edition: { kind: 'numbered', number: 1, size: 3 },
        },
      }),
    });
  });
  await page.route('**/api/invitations/redeem', async route => {
    redemptionRequests += 1;
    proofBodies.push(route.request().postDataJSON());
    await redemptionGate;
    bound = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, keeper: { pieceId: 'MD-905', editionNumber: 1 } }),
    });
  });
  await page.route('**/api/collector/onboarding', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'skipped' }),
  }));
  await page.route('**/api/collector/privacy?view=cities', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ cities: [] }),
  }));
  await page.route('**/api/collector/privacy?piece=**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ring1: { privateRecord: true }, ring2: { shareCity: false, cityId: null },
      ring3: { shareDerivedChart: false },
      ring4: {
        shareFace: false, shareName: false, shareIntention: false,
        shareBusiness: false, shareMission: false,
      },
      policyVersion: null,
    }),
  }));

  const invitationToken = 'invite_private_token_123';
  await openWithLivingLegacy(page, WORK_PATH);
  await page.getByRole('button', { name: 'Register and certify this piece' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Use invitation' }).click();
  const form = page.getByRole('form', { name: 'Use artwork invitation' });
  await form.getByLabel('Invitation').fill('stale_inspection_token');
  await form.getByRole('button', { name: 'Open invitation' }).click();
  await form.getByLabel('Invitation').fill('edited_before_inspection_returned');
  await page.waitForTimeout(300);
  await expect(form.getByRole('button', { name: 'Register invited piece' })).toHaveCount(0);
  await expect(form.getByRole('button', { name: 'Open invitation' })).toBeEnabled();
  await form.getByLabel('Invitation').fill('wrong_piece_invitation');
  await form.getByRole('button', { name: 'Open invitation' }).click();
  await expect(form.getByRole('alert')).toContainText('belongs to Another artwork');
  await expect(form.getByRole('button', { name: 'Register invited piece' })).toHaveCount(0);
  for (const [token, message] of [
    ['used_invitation', 'already been used'],
    ['expired_invitation', 'has expired'],
    ['revoked_invitation', 'was revoked'],
  ] as const) {
    await form.getByLabel('Invitation').fill(token);
    await form.getByRole('button', { name: 'Open invitation' }).click();
    await expect(form.getByRole('alert')).toContainText(message);
    await expect(form.getByRole('button', { name: 'Register invited piece' })).toHaveCount(0);
  }
  await form.getByLabel('Invitation').fill(invitationToken);
  await form.getByRole('button', { name: 'Open invitation' }).click();
  await form.getByRole('button', { name: 'Register invited piece' }).click();
  await expect(form.getByLabel('Invitation')).toBeDisabled();
  await expect(form.getByLabel('Invitation')).toHaveValue(invitationToken);
  await expect.poll(() => redemptionRequests).toBe(1);
  releaseRedemption();

  await expect(page.getByRole('heading', { name: 'Privacy and birth details' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByTestId('collector-certificate')).toBeVisible();
  expect(proofBodies).toEqual([
    { token: 'stale_inspection_token' },
    { token: 'wrong_piece_invitation' },
    { token: 'used_invitation' },
    { token: 'expired_invitation' },
    { token: 'revoked_invitation' },
    { token: invitationToken },
    { token: invitationToken },
  ]);
  expect(redemptionRequests).toBe(1);
  expect(page.url()).not.toContain(invitationToken);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(invitationToken);
  await expect(page.locator('body')).not.toContainText(invitationToken);
});
