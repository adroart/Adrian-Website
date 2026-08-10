import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('verified sales admin workspace', () => {
  it('is a lazy private admin route and primary Sales navigation destination', () => {
    const app = source('App.tsx');
    const navigation = source('components/admin/AdminNavigation.ts');
    assert.match(app, /lazy\(\(\) => import\('\.\/components\/admin\/CollectorSales'\)\)/);
    assert.match(app, /path="collector-sales" element=\{<CollectorSales\s*\/>\}/);
    assert.match(navigation, /label:\s*'Verified sales',\s*href:\s*'\/admin\/collector-sales'/);
    assert.ok(navigation.indexOf("label: 'Verified sales'") < navigation.indexOf("label: 'Pricing'"));
  });

  it('offers equal reconnection and sale starting points with private, manual framing', () => {
    const component = source('components/admin/CollectorSales.tsx');
    for (const phrase of [
      'Verified sales', 'Start a reconnection', 'Record a verified sale',
      'Email is the only required fact', 'The site does not send email',
      'Private buyer and price evidence', 'Save and add another',
    ]) assert.match(component, new RegExp(phrase, 'i'), phrase);
    assert.doesNotMatch(component, /inbox sync|automated reminders|public price|publish price/i);
  });

  it('supports occurrence precision and repeatable unresolved multi-artwork sales', () => {
    const component = source('components/admin/CollectorSales.tsx');
    for (const phrase of [
      'Exact date', 'Month', 'Year', 'Unknown', 'Artwork not identified yet',
      'Add another artwork', 'Remove artwork', 'Price, optional', 'Currency',
    ]) assert.match(component, new RegExp(phrase, 'i'), phrase);
    assert.match(component, /type="date"/);
    assert.match(component, /type="month"/);
    assert.match(component, /artworks\.map/);
  });

  it('keeps retry attempts frozen and private data out of browser persistence', () => {
    const component = source('components/admin/CollectorSales.tsx');
    assert.match(component, /beginArtistSaleAttempt/);
    assert.match(component, /finishArtistSaleAttempt/);
    assert.match(component, /credentials:\s*'same-origin'/);
    assert.match(component, /AbortController/);
    assert.doesNotMatch(component, /localStorage|sessionStorage|window\.history|history\.(?:push|replace)|console\.(?:log|warn|error)/);
    assert.doesNotMatch(component, /FormData|\.arrayBuffer\s*\(/);
  });

  it('renders durable detail actions without automatic ownership side effects', () => {
    const component = source('components/admin/CollectorSales.tsx');
    for (const phrase of [
      'Original sale facts', 'Correction reason', 'Identify artwork',
      'Identification evidence', 'Certificate image', 'Select as certificate image',
      'Shared sealed message', 'Artwork-specific sealed message',
      'Register artwork', 'Create invitation', 'Dismiss Ownership Code',
      'Dismiss invitation token', 'Add private note', 'Record email sent',
      'Back to records',
    ]) assert.match(component, new RegExp(phrase, 'i'), phrase);
    assert.doesNotMatch(component, /useEffect[\s\S]{0,500}(?:\/api\/admin\/registrations|createInvitation)/);
    assert.match(component, /only when that artwork is claimed/i);
  });

  it('includes accessible loading, error, empty, success, and one-heading states', () => {
    const component = source('components/admin/CollectorSales.tsx');
    assert.match(component, /<AdminPage/);
    assert.match(component, /<AdminPageHeader/);
    assert.match(component, /<AdminAlert/);
    assert.match(component, /<AdminEmptyState/);
    assert.match(component, /Loading verified sales/);
    assert.match(component, /Retry/);
    assert.match(component, /No records yet/);
    assert.match(component, /role="status"/);
    assert.equal((component.match(/<h1\b/g) || []).length, 0);
  });
});
