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
        ['Artwork', ['Registry and plates', 'Private viewings', 'Artwork stories']],
        ['Publishing', ['Stories', 'Poetry', 'Media']],
        ['Sales', ['Pricing', 'Invoices']],
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
      'AdminPieces.tsx', 'PricingCalculator.tsx',
    ]) {
      assert.doesNotMatch(source(`components/${file}`), /<AdminLayout>/);
    }
  });

  it('uses one page and control vocabulary across every admin tool', () => {
    const primitives = source('components/admin/AdminPage.tsx');
    for (const name of ['AdminPage', 'AdminPageHeader', 'AdminSection', 'AdminAlert', 'AdminEmptyState']) {
      assert.match(primitives, new RegExp(`export (?:const|function) ${name}`));
    }
    for (const file of [
      'AdminDashboard.tsx', 'AdminFileUpload.tsx', 'AdminPoetry.tsx',
      'AdminBookEditor.tsx', 'AdminInvoices.tsx', 'AdminViewings.tsx',
      'AdminPieces.tsx', 'PricingCalculator.tsx',
    ]) {
      assert.match(source(`components/${file}`), /<AdminPage/);
    }
  });
});
