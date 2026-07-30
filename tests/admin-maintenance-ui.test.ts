import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it, mock } from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('registry Maintenance client contract', () => {
  afterEach(() => mock.restoreAll());

  it('puts only explicitly public search fields in the URL', async () => {
    const { buildMaintenanceSearchPath } = await import('../utils/adminRegistryMaintenance.ts');
    const path = buildMaintenanceSearchPath({
      publicCode: ' AR-7KQ9M2WX ',
      artworkId: 'UL-100',
      title: 'Art of Living',
      editionNumber: 0,
      hasAcquisition: true,
      stewardEmail: 'private@example.com',
      acquiredFrom: '2026-07-01',
      amountMinor: 987654321,
      currency: 'XTS',
      privateNotes: 'never in a URL',
    } as never);

    const url = new URL(path, 'https://adrianrasmussen.com');
    assert.equal(url.pathname, '/api/admin/maintenance');
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      publicCode: 'AR-7KQ9M2WX',
      artworkId: 'UL-100',
      title: 'Art of Living',
      editionNumber: '0',
    });
    assert.doesNotMatch(path, /private|acquired|amount|currency|notes|hasAcquisition|987654321|XTS/i);
  });

  it('projects search responses onto the public-only result shape', async () => {
    mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
      ok: true,
      pieces: [{
        id: 'kp-1',
        artworkId: 'UL-100',
        title: 'Art of Living',
        editionNumber: 0,
        publicCode: 'AR-7KQ9M2WX',
        plateStatus: 'active',
        stewardEmail: 'private@example.com',
        acquisitionCount: 1,
        acquisitionType: 'sale',
        acquiredAt: '2026-07-30',
      }],
    }), { status: 200 }));

    const { searchMaintenance } = await import('../utils/adminRegistryMaintenance.ts');
    assert.deepEqual(await searchMaintenance(), [{
      id: 'kp-1',
      artworkId: 'UL-100',
      title: 'Art of Living',
      editionNumber: 0,
      publicCode: 'AR-7KQ9M2WX',
      plateStatus: 'active',
    }]);
  });

  it('uses one in-memory idempotency key for each confirmed create or correction', async () => {
    const keys = ['attempt-create', 'attempt-correct'];
    const randomUUID = mock.fn(() => keys.shift() || 'unexpected');
    mock.method(globalThis.crypto, 'randomUUID', randomUUID as typeof crypto.randomUUID);
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      return new Response(JSON.stringify({
        ok: true,
        acquisition: { acquisitionId: 'acq-1', recordVersion: requests.length },
      }), { status: requests.length === 1 ? 201 : 200 });
    });

    const { saveMaintenanceAcquisition } = await import('../utils/adminRegistryMaintenance.ts');
    const acquisition = {
      acquisitionType: 'sale' as const,
      acquiredAt: '2026-07-30',
      amountMinor: 125000,
      currency: 'IDR',
      acquirerReference: 'private collector reference',
      privateNotes: 'private note',
      documentReference: 'private receipt',
      publicProvenance: 'Acquired from the artist.',
    };
    await saveMaintenanceAcquisition({ keeperPieceId: 'kp-1', reason: 'Record acquisition.', acquisition });
    await saveMaintenanceAcquisition({
      keeperPieceId: 'kp-1',
      acquisitionId: 'acq-1',
      expectedVersion: 1,
      reason: 'Correct amount.',
      acquisition,
    });

    assert.equal(randomUUID.mock.callCount(), 2);
    assert.deepEqual(requests.map(request => [request.url, request.init?.method]), [
      ['/api/admin/maintenance/kp-1/acquisitions', 'POST'],
      ['/api/admin/maintenance/kp-1/acquisitions/acq-1', 'PUT'],
    ]);
    const createBody = JSON.parse(String(requests[0].init?.body));
    const correctionBody = JSON.parse(String(requests[1].init?.body));
    assert.deepEqual(createBody, {
      idempotencyKey: 'attempt-create',
      reason: 'Record acquisition.',
      acquisition,
    });
    assert.deepEqual(correctionBody, {
      idempotencyKey: 'attempt-correct',
      reason: 'Correct amount.',
      expectedVersion: 1,
      acquisition,
    });
    assert.doesNotMatch(requests.map(request => request.url).join(' '), /125000|IDR|collector|receipt/i);
  });
});

describe('registry Maintenance workspace wiring', () => {
  it('uses the authenticated admin route and shared page primitives', () => {
    const app = source('App.tsx');
    assert.match(app, /const AdminMaintenance = lazy/);
    assert.match(app, /<Route path=["']maintenance["'] element=\{<AdminMaintenance\s*\/>\}/);

    const component = source('components/AdminMaintenance.tsx');
    assert.match(component, /<AdminPage/);
    assert.match(component, /<AdminPageHeader/);
    assert.match(component, /<AdminSection/);
    assert.match(component, /<AdminAlert/);
    assert.match(component, /<AdminEmptyState/);
  });

  it('shows the five required detail sections and an explicit reasoned review gate', () => {
    const component = source('components/AdminMaintenance.tsx');
    for (const title of [
      'Current public truth',
      'Physical plate',
      'Private acquisition',
      'Current steward',
      'Maintenance history',
    ]) {
      assert.match(component, new RegExp(`title=["']${title}["']`));
    }
    assert.match(component, />Before</);
    assert.match(component, />After</);
    assert.match(component, /htmlFor=["']maintenance-reason["']/);
    assert.match(component, /id=["']maintenance-reason["']/);
    assert.match(component, /reason\.trim\(\)/);
    assert.match(component, /Confirm (?:creation|correction)|Confirm save/);
  });

  it('keeps private state in memory, gates writes on unlock, and reloads stale detail', () => {
    const component = source('components/AdminMaintenance.tsx');
    const client = source('utils/adminRegistryMaintenance.ts');
    const combined = `${component}\n${client}`;
    assert.doesNotMatch(combined, /localStorage|sessionStorage|useNavigate|navigate\(|location\.state/);
    assert.match(component, /\/api\/admin\/registry-unlock/);
    assert.match(component, /registry_locked/);
    assert.match(component, /version_conflict/);
    assert.match(component, /loadDetail/);
    assert.ok(component.indexOf('version_conflict') < component.lastIndexOf('loadDetail'));
    assert.match(client, /crypto\.randomUUID\(\)/);
  });

  it('labels every control and provides live loading, error, and status feedback', () => {
    const component = source('components/AdminMaintenance.tsx');
    for (const id of [
      'maintenance-public-code',
      'maintenance-artwork-id',
      'maintenance-title',
      'maintenance-edition',
      'maintenance-acquisition-type',
      'maintenance-acquired-at',
      'maintenance-amount',
      'maintenance-currency',
      'maintenance-reason',
    ]) {
      assert.match(component, new RegExp(`htmlFor=["']${id}["']`));
      assert.match(component, new RegExp(`id=["']${id}["']`));
    }
    assert.match(component, /aria-live=["']polite["']/);
    assert.match(component, /role=["']status["']/);
    assert.match(component, /role=["']alert["']/);
    assert.match(component, /Loading|Searching/);
    assert.match(component, /smallest unit/);
  });
});
