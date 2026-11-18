import { expect, test } from './fixtures';

test('a workspace link selects the registry-only catalog artwork and its shared certificate', async ({ page }) => {
  const artworkId = 'SIG-999';
  const label = 'Registry-only fixture · SIG-999';
  let registryToolsGated = false;
  let workspaceReads = 0;

  await page.route('/api/admin/verify', route => route.fulfill({
    json: { ok: true, admin: { id: 'admin-1', email: 'artist@example.test' } },
  }));
  await page.route('/api/admin/artworks', route => route.fulfill({
    status: registryToolsGated ? 404 : 200,
    json: registryToolsGated ? { ok: false, error: 'not_found' }
      : { ok: true, artworks: [{ id: artworkId, title: 'Registry-only fixture', series: null, editionKind: 'numbered', editionSize: 4 }] },
  }));
  await page.route('/api/admin/artwork-workspace?artworkId=' + artworkId, route => {
    workspaceReads += 1;
    return route.fulfill({ json: {
      ok: true,
      workspace: {
        catalog: { artworkId, title: 'Registry-only fixture' },
        salesRecord: null, identity: null, certificate: { state: 'incomplete', missingFields: ['origin'] },
        invitation: null, caretaker: { state: 'not_registered' }, plate: null, sale: null, nextAction: null, activity: [],
      },
    } });
  });
  await page.route('/api/admin/certificate-templates', route => route.fulfill({
    json: { ok: true, templates: [{ templateId: 'template-fixture', name: 'Studio template', content: { origin: 'Inherited origin' }, version: 1 }] },
  }));
  await page.route('**/api/admin/certificate-overrides?*', route => {
    const requested = new URL(route.request().url()).searchParams.get('artworkId');
    return route.fulfill({ json: {
      ok: true,
      state: {
        artworkId: requested,
        assignment: { templateId: 'template-fixture', version: 1 },
        overrides: requested === artworkId ? { materials: { mode: 'override', version: 2, value: ['Fixture birch'] } } : {},
        effective: requested === artworkId ? { materials: ['Fixture birch'] } : { origin: 'Another artwork' },
      },
    } });
  });
  let updated: Record<string, unknown> | undefined;
  await page.route('/api/admin/certificate-overrides', route => {
    updated = route.request().postDataJSON();
    return route.fulfill({ json: { ok: true, override: { version: 3 } } });
  });

  await page.goto('/admin/certificates?artworkId=' + artworkId);
  const artwork = page.getByRole('heading', { name: label });
  await expect(artwork).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByText('Applies to all editions of this artwork.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Public certificate' }).getByText('Fixture birch')).toBeVisible();
  await page.getByRole('link', { name: /Materials.*Fixture birch/ }).click();
  await expect(page.getByRole('radio', { name: 'Use a custom value' })).toBeChecked();
  await expect(page.getByLabel('Replacement value')).toHaveValue('Fixture birch');
  await page.getByLabel('Replacement value').fill('Fixture walnut');
  await page.getByRole('button', { name: 'Save field' }).click();
  await expect.poll(() => updated).toEqual({
    artworkId, field: 'materials', override: { mode: 'override', value: ['Fixture walnut'] }, expectedVersion: 2,
  });
  await expect(page.getByText('Artwork override saved.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);

  expect(workspaceReads).toBe(0);
  registryToolsGated = true;
  await page.reload();
  await expect(artwork).toBeVisible();
  await expect(page.getByRole('region', { name: 'Public certificate' }).getByText('Fixture birch')).toBeVisible();
  expect(workspaceReads).toBe(1);
  await page.getByRole('link', { name: 'Change artwork' }).click();
  await page.getByLabel('Find artworks').fill('UL-101');
  await page.getByRole('link', { name: /Crystal Creation.*UL-101/ }).click();
  await expect(page).toHaveURL(/artworkId=UL-101$/);
  await expect(page.getByRole('region', { name: 'Public certificate' }).getByText('Another artwork')).toBeVisible();
});

test('creates a template, then selects artworks across filtered assignment results', async ({ page }) => {
  await page.route('/api/admin/verify', route => route.fulfill({
    json: { ok: true, admin: { id: 'admin-1', email: 'artist@example.test' } },
  }));
  await page.route('/api/admin/artworks', route => route.fulfill({ json: { ok: true, artworks: [] } }));
  await page.route('/api/admin/certificate-templates', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { ok: true, templates: [] } });
    expect(route.request().postDataJSON()).toEqual({
      name: 'Wood sculpture', content: { materials: ['Birch', 'Walnut'], origin: 'Bali' },
    });
    return route.fulfill({ json: { ok: true, template: {
      templateId: 'test-wood', name: 'Wood sculpture', version: 1,
      content: { materials: ['Birch', 'Walnut'], origin: 'Bali' },
    } } });
  });
  const assignments: Record<string, unknown>[] = [];
  await page.route('/api/admin/certificate-assignments', route => {
    assignments.push(route.request().postDataJSON());
    return route.fulfill(assignments.length === 1
      ? { status: 503, json: { ok: false } }
      : { json: { ok: true } });
  });

  await page.goto('/admin/certificates');
  await expect(page.getByRole('heading', { name: 'New template' })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('link', { name: 'Templates', exact: true }).click();
  await page.getByRole('link', { name: 'New template' }).click();
  await page.getByLabel('Template name').fill('Wood sculpture');
  await page.getByLabel('Materials').fill('Birch\nWalnut');
  await page.getByLabel('Origin').fill('Bali');
  await expect(page.getByRole('region', { name: 'Template preview' }).getByText('Birch, Walnut')).toBeVisible();
  await page.getByRole('button', { name: 'Create template' }).click();
  await expect(page.getByRole('heading', { name: 'Saved templates' })).toBeVisible();
  await page.getByRole('link', { name: 'Assign this template' }).click();

  await expect(page.getByRole('checkbox')).toHaveCount(6);
  await expect(page.getByText('Wood sculpture', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Change template' }).click();
  await page.getByRole('button', { name: 'Wood sculpture' }).click();
  await expect(page.getByRole('heading', { name: 'Assign a template' })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  const find = page.getByLabel('Find artworks');
  await find.fill('UL-101');
  await page.getByRole('checkbox', { name: /Crystal Creation/ }).check();
  await find.fill('Doorways');
  await page.getByRole('checkbox', { name: /Doorways Of The Unknown/i }).check();
  await find.clear();
  await page.getByRole('button', { name: 'Selected only' }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(2);
  await expect(page.getByRole('status').filter({ hasText: '2 selected' })).toBeVisible();

  const assign = page.getByRole('button', { name: 'Assign to selected artwork' });
  await assign.click();
  await expect(page.getByRole('alert')).toContainText('Retry without changing the selection');
  await assign.click();
  await expect(page.getByRole('status').filter({ hasText: 'Template assigned' })).toBeVisible();
  expect(assignments).toHaveLength(2);
  expect(assignments[0]).toEqual({
    templateId: 'test-wood', artworkIds: ['UL-101', 'UL-102'], idempotencyKey: expect.any(String),
  });
  expect(assignments[1]).toEqual(assignments[0]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});

test('retries a failed template load without losing artwork selection or a template draft', async ({ page }) => {
  await page.route('/api/admin/verify', route => route.fulfill({
    json: { ok: true, admin: { id: 'admin-1', email: 'artist@example.test' } },
  }));
  await page.route('/api/admin/artworks', route => route.fulfill({ json: { ok: true, artworks: [] } }));
  let attempts = 0;
  await page.route('/api/admin/certificate-templates', route => route.fulfill(++attempts < 3
    ? { status: 503, json: { ok: false } }
    : { json: { ok: true, templates: [{ templateId: 'recovered', name: 'Recovered template', content: {}, version: 1 }] } }));

  await page.goto('/admin/certificates?view=choose-template');
  await expect(page.getByRole('alert')).toContainText('Certificate templates could not be loaded');
  await expect(page.getByText('No templates yet.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry loading templates' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('link', { name: 'Back to assignment', exact: true }).click();
  await page.getByLabel('Find artworks').fill('UL-101');
  await page.getByRole('checkbox', { name: /Crystal Creation/ }).check();
  await page.getByRole('link', { name: 'Templates', exact: true }).click();
  await expect(page.getByText('Create a template for facts that apply to more than one artwork.')).toHaveCount(0);
  await page.getByRole('link', { name: 'New template', exact: true }).click();
  await page.getByLabel('Template name').fill('Unsaved template name');
  await page.getByLabel('Materials', { exact: true }).fill('Fixture material');
  await page.getByRole('button', { name: 'Retry loading templates' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Template name')).toHaveValue('Unsaved template name');
  await expect(page.getByLabel('Materials', { exact: true })).toHaveValue('Fixture material');
  await page.getByRole('link', { name: 'Assign template', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Crystal Creation/ })).toBeChecked();
  await page.getByRole('link', { name: 'Choose template', exact: true }).click();
  await page.getByRole('button', { name: 'Recovered template', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Assign to selected artwork' })).toBeEnabled();
  expect(attempts).toBe(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});
