import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('admin studio shell', () => {
  it('groups every admin tool in one persistent navigation', async () => {
    const { ADMIN_NAVIGATION } = await import('../components/admin/AdminNavigation.ts');
    assert.deepEqual(
      ADMIN_NAVIGATION.map(group => [group.label, group.items.map(item => item.label)]),
      [
        ['Home', ['Studio overview']],
        ['Artwork', [
          'Artwork registration',
          'Collector invitations',
          'Certificate editor',
          'Optional plate wizard',
          'Registry and plates',
          'Maintenance',
          'Private viewings',
          'Artwork stories',
        ]],
        ['Publishing', ['Stories', 'Poetry', 'Media']],
        ['Sales', ['Verified sales', 'Pricing', 'Invoices']],
      ],
    );
  });

  it('uses one nested authenticated shell instead of wrapping every tool', () => {
    const app = source('App.tsx');
    assert.match(app, /<Route path=["']\/admin["'] element=\{<AdminShell\s*\/>\}>/);
    assert.match(app, /<Route index element=\{<AdminDashboard\s*\/>\}/);
    for (const file of [
      'AdminDashboard.tsx', 'AdminFileUpload.tsx', 'AdminPoetry.tsx',
      'AdminBookEditor.tsx', 'AdminInvoices.tsx', 'AdminViewings.tsx',
      'AdminPieces.tsx', 'AdminMaintenance.tsx', 'PricingCalculator.tsx',
    ]) {
      assert.doesNotMatch(source(`components/${file}`), /<AdminLayout>/);
    }
  });

  it('keeps a registered instance associated with its one-time Ownership Code until an explicit reset', () => {
    const app = source('App.tsx');
    assert.match(app, /artworkTitle:\s*string/);
    assert.match(app, /editionLabel:\s*string/);
    assert.match(app, /Register another artwork/);
    assert.match(app, /!result\s*\?\s*\(/);
  });

  it('uses one page and control vocabulary across every admin tool', () => {
    const primitives = source('components/admin/AdminPage.tsx');
    for (const name of ['AdminPage', 'AdminPageHeader', 'AdminSection', 'AdminAlert', 'AdminEmptyState']) {
      assert.match(primitives, new RegExp(`export (?:const|function) ${name}`));
    }
    for (const file of [
      'AdminDashboard.tsx', 'AdminFileUpload.tsx', 'AdminPoetry.tsx',
      'AdminBookEditor.tsx', 'AdminInvoices.tsx', 'AdminViewings.tsx',
      'AdminPieces.tsx', 'AdminMaintenance.tsx', 'PricingCalculator.tsx',
    ]) {
      assert.match(source(`components/${file}`), /<AdminPage/);
    }
  });

  it('makes attention and quick actions the admin home hierarchy', () => {
    const dashboard = source('components/AdminDashboard.tsx');
    assert.match(dashboard, /\/api\/admin\/overview/);
    assert.match(dashboard, /Needs attention/);
    assert.match(dashboard, /Issue a plate/);
    assert.match(dashboard, /Create invoice/);
    assert.match(dashboard, /Build a viewing/);
    assert.match(dashboard, /Write a story/);
    assert.ok(dashboard.indexOf('Needs attention') < dashboard.indexOf('All tools'));
    assert.doesNotMatch(dashboard, /title:\s*['"]Keystatic['"]/);
    assert.doesNotMatch(dashboard, /fulfillment|shipment/i);
  });

  it('connects stable creation links and visible workflow stages', async () => {
    const { adminMode } = await import('../components/admin/adminMode.ts');
    const { poetryCreatePath } = await import('../components/AdminFileUpload.tsx');
    assert.equal(adminMode(new URLSearchParams('mode=create')), 'create');
    assert.equal(adminMode(new URLSearchParams('mode=issue')), 'issue');
    assert.equal(adminMode(new URLSearchParams('mode=unknown')), null);
    assert.equal(
      poetryCreatePath('https://files.example/audio.mp3'),
      '/admin/poetry?mode=create&audio=https%3A%2F%2Ffiles.example%2Faudio.mp3',
    );

    for (const label of ['Issue identity', 'Verify recovery copy', 'Activate plate']) {
      assert.match(source('components/AdminPieces.tsx'), new RegExp(label));
    }
    assert.doesNotMatch(source('components/AdminPieces.tsx'), /fulfillment|shipping/i);
    for (const label of ['Intake', 'Curate', 'Preview', 'Send']) {
      assert.match(source('components/AdminViewings.tsx'), new RegExp(label));
    }
  });
});
