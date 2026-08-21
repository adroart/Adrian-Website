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
          'Rehearsal',
          'Maintenance',
          'Private viewings',
          'Artwork stories',
        ]],
        ['Publishing', ['Stories', 'Poetry', 'Media']],
        // Where the collector journey is looked at while it is being built.
        // The address lives on a permanent branch and nowhere else, so this
        // entry is the only place it is written down.
        ['Workshop', ['Screen development system']],
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
    // The registration form moved from an inline App.tsx component to the
    // ceremony at components/registry/RegisterCeremony.tsx; the exactly-once
    // Ownership Code semantics moved with it.
    const ceremony = source('components/registry/RegisterCeremony.tsx');
    assert.match(ceremony, /editionLabel:\s*string/);
    assert.match(ceremony, /ownershipCode\?:\s*string/);
    assert.match(ceremony, /ownershipCode:\s*undefined/);
    assert.match(ceremony, /Register another artwork/);
    // The old address keeps working, query string and all, so verified-sale
    // deep links still land on the ceremony.
    const app = source('App.tsx');
    assert.match(app, /path="register" element=\{<RegisterCeremony/);
    assert.match(app, /\/admin\/register\$\{location\.search\}/);
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

  it('makes the item queue and recent relationships the admin home hierarchy', () => {
    const dashboard = source('components/AdminDashboard.tsx');
    assert.match(dashboard, /\/api\/admin\/overview/);
    assert.match(dashboard, /Work that needs you/);
    assert.match(dashboard, /Recent artworks/);
    assert.match(dashboard, /Recent collectors or reconnections/);
    assert.match(dashboard, /Start new/);
    assert.match(dashboard, /Issue a plate/);
    assert.match(dashboard, /Create invoice/);
    assert.match(dashboard, /Build a viewing/);
    assert.ok(dashboard.indexOf('Work that needs you') < dashboard.indexOf('Start new'));
    assert.doesNotMatch(dashboard, /Quick actions|All tools/);
    assert.doesNotMatch(dashboard, /title:\s*['"]Keystatic['"]/);
    assert.doesNotMatch(dashboard, /fulfillment|shipment/i);
  });

  it('connects stable creation links and visible workflow stages', async () => {
    const { adminMode, exactAdminPageSelection } = await import('../components/admin/adminMode.ts');
    const { poetryCreatePath } = await import('../components/AdminFileUpload.tsx');
    assert.equal(adminMode(new URLSearchParams('mode=create')), 'create');
    assert.equal(adminMode(new URLSearchParams('mode=issue')), 'issue');
    assert.equal(adminMode(new URLSearchParams('mode=unknown')), null);
    assert.deepEqual(exactAdminPageSelection(new URLSearchParams(), 'invoiceId'), { kind: 'list' });
    assert.deepEqual(exactAdminPageSelection(new URLSearchParams('mode=create'), 'invoiceId'), { kind: 'create' });
    assert.deepEqual(exactAdminPageSelection(new URLSearchParams('invoiceId=17'), 'invoiceId'), { kind: 'exact', id: 17 });
    for (const query of [
      'mode=create&invoiceId=17', 'unexpected=1', 'invoiceId=17&invoiceId=18',
      'invoiceId=017', 'invoiceId=%2017', 'mode=create&mode=create', 'mode=issue',
    ]) assert.deepEqual(exactAdminPageSelection(new URLSearchParams(query), 'invoiceId'), { kind: 'invalid' }, query);
    assert.deepEqual(exactAdminPageSelection(new URLSearchParams('viewingId=9'), 'viewingId'), { kind: 'exact', id: 9 });
    assert.equal(
      poetryCreatePath('https://files.example/audio.mp3'),
      '/admin/poetry?mode=create&audio=https%3A%2F%2Ffiles.example%2Faudio.mp3',
    );

    // Issuing a plate identity moved to the registration ceremony at
    // /admin/register; the desk only tracks lifecycle stages that remain
    // here: encrypted backup, recovery proof, and activation.
    for (const label of ['Retry backup', 'Prove copied-file recovery', 'Physical checks']) {
      assert.match(source('components/AdminPieces.tsx'), new RegExp(label));
    }
    assert.doesNotMatch(source('components/AdminPieces.tsx'), /fulfillment|shipping/i);
    for (const label of ['Intake', 'Curate', 'Preview', 'Send']) {
      assert.match(source('components/AdminViewings.tsx'), new RegExp(label));
    }
  });
});
