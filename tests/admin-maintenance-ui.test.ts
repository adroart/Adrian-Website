import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it, mock } from 'node:test';
import type { MaintenanceAcquisitionInput } from '../utils/adminRegistryMaintenance.ts';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('registry Maintenance client contract', () => {
  afterEach(() => mock.restoreAll());

  it('offers only custody defaults and keeps legacy sales out of correction flow', async () => {
    const writeTypeContract: Record<MaintenanceAcquisitionInput['acquisitionType'], true> = {
      retained: true, loan: true, consignment: true,
      gift: true, inheritance: true, other: true,
    };
    const {
      DEFAULT_MAINTENANCE_ACQUISITION_TYPE,
      MAINTENANCE_CUSTODY_ACQUISITION_TYPES,
      canCorrectMaintenanceAcquisition,
      isLegacySaleAcquisition,
    } = await import('../utils/adminRegistryMaintenance.ts');

    assert.equal(DEFAULT_MAINTENANCE_ACQUISITION_TYPE, 'retained');
    assert.deepEqual(Object.keys(writeTypeContract), MAINTENANCE_CUSTODY_ACQUISITION_TYPES);
    assert.deepEqual(MAINTENANCE_CUSTODY_ACQUISITION_TYPES, [
      'retained', 'loan', 'consignment', 'gift', 'inheritance', 'other',
    ]);
    assert.equal(MAINTENANCE_CUSTODY_ACQUISITION_TYPES.includes('sale' as never), false);
    assert.equal(isLegacySaleAcquisition({ acquisitionType: 'sale' }), true);
    assert.equal(canCorrectMaintenanceAcquisition({ acquisitionType: 'sale' }), false);
    assert.equal(canCorrectMaintenanceAcquisition({ acquisitionType: 'gift' }), true);
  });

  it('puts only explicitly public search fields in the URL', async () => {
    const { buildMaintenanceSearchPath } = await import('../utils/adminRegistryMaintenance.ts');
    const path = buildMaintenanceSearchPath({
      publicCode: ' AR-7KQ9M2WX ',
      artworkId: 'UL-100',
      title: 'Art of Living',
      editionNumber: 0,
      holderName: 'Mira Collector',
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
    assert.doesNotMatch(path, /private|acquired|amount|currency|notes|hasAcquisition|987654321|XTS|Mira|holder/i);
  });

  it('searches by collector name through POST and keeps names out of list results', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      return new Response(JSON.stringify({
        ok: true,
        pieces: [{
          id: 'kp-1',
          artworkId: 'UL-100',
          title: 'Art of Living',
          editionNumber: 0,
          publicCode: 'AR-7KQ9M2WX',
          plateStatus: 'active',
          holderName: 'Mira Collector',
          stewardEmail: 'mira@example.com',
        }],
      }), { status: 200 });
    });

    const { searchMaintenance } = await import('../utils/adminRegistryMaintenance.ts');
    const results = await searchMaintenance({
      title: 'Art of Living',
      holderName: ' Mira ',
    });
    assert.deepEqual(results, [{
      id: 'kp-1',
      artworkId: 'UL-100',
      title: 'Art of Living',
      editionNumber: 0,
      publicCode: 'AR-7KQ9M2WX',
      plateStatus: 'active',
    }]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/api/admin/maintenance');
    assert.equal(requests[0].init?.method, 'POST');
    assert.doesNotMatch(String(requests[0].init?.body), /mira@example\.com/i);
    assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
      title: 'Art of Living',
      holderName: 'Mira',
    });
  });

  it('builds a legacy sale handoff URL from stable identifiers only', async () => {
    const { buildLegacyAcquisitionSalesPath } = await import('../utils/adminRegistryMaintenance.ts');
    const path = buildLegacyAcquisitionSalesPath({
      acquisitionId: ' acq-legacy-1 ',
      artworkId: ' UL-100 ',
      keeperPieceId: ' kp-1 ',
      collectorReference: 'private@example.com',
      privateNotes: 'never in the URL',
      amountMinor: 125000,
    } as never);

    const url = new URL(path, 'https://adrianrasmussen.com');
    assert.equal(url.pathname, '/admin/collector-sales');
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      source: 'legacy_acquisition',
      acquisitionId: 'acq-legacy-1',
      artworkId: 'UL-100',
      keeperPieceId: 'kp-1',
    });
    assert.doesNotMatch(path, /private|example|notes|125000/i);
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

  it('reuses one key after a lost response, expired unlock, and successful replay', async () => {
    const createKey = mock.fn(() => 'attempt-lost-response');
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const records = new Map<string, { acquisitionId: string; recordVersion: number }>();
    let loseFirstResponse = true;
    let registryUnlocked = true;
    mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      const body = JSON.parse(String(init?.body));
      if (!registryUnlocked) {
        return new Response(JSON.stringify({ ok: false, error: 'registry_locked' }), { status: 403 });
      }
      const existing = records.get(body.idempotencyKey);
      if (!existing) records.set(body.idempotencyKey, { acquisitionId: 'acq-1', recordVersion: 1 });
      if (loseFirstResponse) {
        loseFirstResponse = false;
        registryUnlocked = false;
        throw new TypeError('The response was lost after the server committed.');
      }
      return new Response(JSON.stringify({
        ok: true,
        replayed: Boolean(existing),
        acquisition: records.get(body.idempotencyKey),
      }), { status: 200 });
    });

    const {
      beginMaintenanceSaveRequestAttempt,
      discardMaintenanceSaveAttempt,
      saveMaintenanceAcquisition,
      shouldRetainMaintenanceSaveAttempt,
    } = await import('../utils/adminRegistryMaintenance.ts');
    const acquisition = {
      acquisitionType: 'consignment' as const,
      acquiredAt: '2026-07-30',
      amountMinor: 125000,
      currency: 'IDR',
      acquirerReference: 'private collector reference',
      privateNotes: 'private note',
      documentReference: 'private receipt',
      publicProvenance: 'Acquired from the artist.',
    };
    const request = {
      keeperPieceId: 'kp-1', reason: 'Record acquisition.', acquisition,
    };
    const attempt = beginMaintenanceSaveRequestAttempt(null, request, createKey);
    const afterAttemptedNavigation = discardMaintenanceSaveAttempt(attempt, true);
    assert.strictEqual(afterAttemptedNavigation, attempt);
    request.reason = 'A later mutable value must not alter the attempt.';
    acquisition.privateNotes = 'A later mutable note must not alter the attempt.';
    assert.equal(attempt.request.reason, 'Record acquisition.');
    assert.equal(attempt.request.acquisition.privateNotes, 'private note');
    let lostResponse: unknown;
    await assert.rejects(
      saveMaintenanceAcquisition(attempt.request),
      error => {
        lostResponse = error;
        return error instanceof TypeError;
      },
    );
    assert.equal(shouldRetainMaintenanceSaveAttempt(lostResponse), true);

    let lockedResponse: unknown;
    await assert.rejects(
      saveMaintenanceAcquisition(attempt.request),
      error => {
        lockedResponse = error;
        return error instanceof Error && error.message === 'registry_locked';
      },
    );
    assert.equal(shouldRetainMaintenanceSaveAttempt(lockedResponse), true);

    registryUnlocked = true;
    const replay = await saveMaintenanceAcquisition(attempt.request);

    assert.equal(createKey.mock.callCount(), 1);
    assert.equal(records.size, 1);
    assert.equal(replay.acquisitionId, 'acq-1');
    assert.deepEqual(requests.map(request => JSON.parse(String(request.init?.body)).idempotencyKey), [
      'attempt-lost-response', 'attempt-lost-response', 'attempt-lost-response',
    ]);
    assert.doesNotMatch(requests.map(request => request.url).join(' '), /125000|IDR|collector|receipt/i);
  });

  it('accepts only the latest search or detail generation', async () => {
    const { createMaintenanceRequestGate } = await import('../utils/adminRegistryMaintenance.ts');
    const gate = createMaintenanceRequestGate();
    const first = gate.next();
    const second = gate.next();
    assert.equal(gate.isCurrent(first), false);
    assert.equal(gate.isCurrent(second), true);
    gate.invalidate();
    assert.equal(gate.isCurrent(second), false);
  });

  it('clears attempts only for definitive success or client rejection', async () => {
    const { MaintenanceRequestError, shouldRetainMaintenanceSaveAttempt } = await import('../utils/adminRegistryMaintenance.ts');
    assert.equal(shouldRetainMaintenanceSaveAttempt(new TypeError('network lost')), true);
    assert.equal(shouldRetainMaintenanceSaveAttempt(new MaintenanceRequestError(500, 'maintenance_write_failed')), true);
    assert.equal(shouldRetainMaintenanceSaveAttempt(new MaintenanceRequestError(503, 'maintenance_write_failed')), true);
    assert.equal(shouldRetainMaintenanceSaveAttempt(new MaintenanceRequestError(401, 'unauthorized')), true);
    assert.equal(shouldRetainMaintenanceSaveAttempt(new MaintenanceRequestError(403, 'registry_locked')), true);
    assert.equal(shouldRetainMaintenanceSaveAttempt(new MaintenanceRequestError(403, 'forbidden')), true);
    assert.equal(shouldRetainMaintenanceSaveAttempt(new MaintenanceRequestError(409, 'version_conflict')), false);
    assert.equal(shouldRetainMaintenanceSaveAttempt(new MaintenanceRequestError(422, 'invalid_acquisition')), false);
  });

  it('freezes one exact steward action and sends private values only in the POST body', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      return new Response(JSON.stringify({
        ok: true,
        replayed: false,
        eventId: 'rme-steward-1',
        steward: {
          keeperPieceId: 'kp-1', artworkId: 'UL-100', keeperUserId: 'verified-user',
          claimedAt: '2026-07-31T00:00:00.000Z', releasedAt: null,
          currentDisplayLocation: null, stewardVersion: 4,
        },
      }), { status: 200 });
    });

    const {
      beginMaintenanceStewardActionAttempt,
      saveMaintenanceStewardAction,
    } = await import('../utils/adminRegistryMaintenance.ts');
    const draft = {
      keeperPieceId: 'kp-1',
      action: 'transfer_steward' as const,
      targetEmail: ' verified@example.test ',
      transferKind: 'gift' as const,
      reason: ' Transfer to the verified account. ',
      expectedStewardVersion: 3,
    };
    const attempt = beginMaintenanceStewardActionAttempt(null, draft, () => 'steward-attempt-1');
    draft.targetEmail = 'changed@example.test';
    draft.reason = 'Changed later.';

    const result = await saveMaintenanceStewardAction(attempt.request);
    assert.equal(result.stewardVersion, 4);
    assert.equal(Object.isFrozen(attempt), true);
    assert.equal(Object.isFrozen(attempt.request), true);
    assert.equal(attempt.request.targetEmail, 'verified@example.test');
    assert.equal(attempt.request.reason, 'Transfer to the verified account.');
    assert.equal(requests[0].url, '/api/admin/maintenance/kp-1/actions');
    assert.doesNotMatch(requests[0].url, /verified|reason|target/i);
    assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
      action: 'transfer_steward',
      targetEmail: 'verified@example.test',
      transferKind: 'gift',
      reason: 'Transfer to the verified account.',
      idempotencyKey: 'steward-attempt-1',
      expectedStewardVersion: 3,
    });
  });

  it('preserves the complete transfer request and retry key after ambiguity', async () => {
    const createKey = mock.fn(() => 'steward-transfer-attempt');
    const bodies: Array<Record<string, unknown>> = [];
    let loseFirstResponse = true;
    mock.method(globalThis, 'fetch', async (_input: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      if (loseFirstResponse) {
        loseFirstResponse = false;
        throw new TypeError('Response lost after commit.');
      }
      return new Response(JSON.stringify({
        ok: true, replayed: true, eventId: 'rme-transfer-1',
        steward: {
          keeperPieceId: 'kp-1', artworkId: 'UL-100', keeperUserId: 'next-user',
          claimedAt: '2026-08-09T00:00:00.000Z', releasedAt: null,
          currentDisplayLocation: null,
          stewardVersion: 2,
        },
      }), { status: 200 });
    });

    const {
      beginMaintenanceStewardActionAttempt,
      saveMaintenanceStewardAction,
      shouldRetainMaintenanceSaveAttempt,
    } = await import('../utils/adminRegistryMaintenance.ts');
    const attempt = beginMaintenanceStewardActionAttempt(null, {
      keeperPieceId: 'kp-1', action: 'transfer_steward',
      targetEmail: 'next@example.test', transferKind: 'inheritance',
      reason: 'Record the inherited stewardship.', expectedStewardVersion: 1,
    }, createKey);
    let ambiguous: unknown;
    await assert.rejects(saveMaintenanceStewardAction(attempt.request), error => {
      ambiguous = error;
      return error instanceof TypeError;
    });
    assert.equal(shouldRetainMaintenanceSaveAttempt(ambiguous), true);
    await saveMaintenanceStewardAction(attempt.request);

    assert.equal(createKey.mock.callCount(), 1);
    assert.deepEqual(bodies, [
      {
        action: 'transfer_steward', targetEmail: 'next@example.test',
        transferKind: 'inheritance', reason: 'Record the inherited stewardship.',
        idempotencyKey: 'steward-transfer-attempt', expectedStewardVersion: 1,
      },
      {
        action: 'transfer_steward', targetEmail: 'next@example.test',
        transferKind: 'inheritance', reason: 'Record the inherited stewardship.',
        idempotencyKey: 'steward-transfer-attempt', expectedStewardVersion: 1,
      },
    ]);
  });

  it('freezes exact plate-repair bodies and projects a one-time replacement package', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    mock.method(globalThis, 'fetch', async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      if (body.action === 'correct_link') {
        return new Response(JSON.stringify({
          ok: true,
          record: {
            keeperPieceId: 'kp-1', pieceId: 'UL-101', editionNumber: 2,
            recordVersion: 5,
          },
        }), { status: 200 });
      }
      const manifest = {
        schemaVersion: 1,
        publicCode: 'AR-REPLACE1', artworkId: 'UL-101', editionNumber: 2,
        publicUrl: 'https://adrianrasmussen.com/r/AR-REPLACE1',
        ownershipCode: 'AAAA-BBBB-CCCC-DDDD',
        frontSha256: 'a'.repeat(64), undersideSha256: 'b'.repeat(64),
        generatedAt: '2026-07-31T00:00:00.000Z',
      };
      return new Response(JSON.stringify({
        ok: true,
        replacement: {
          ...manifest, frontSvg: '<svg>front</svg>', undersideSvg: '<svg>back</svg>',
          manifest, backupStatus: 'verified',
        },
      }), { status: 201 });
    });
    const {
      beginMaintenancePlateActionAttempt,
      saveMaintenancePlateAction,
    } = await import('../utils/adminRegistryMaintenance.ts');
    const correction = beginMaintenancePlateActionAttempt(null, {
      keeperPieceId: 'kp-1', action: 'correct_link', artworkId: ' ul-101 ',
      editionNumber: 2, physicalEngravingMatches: true,
      reason: ' Correct the digital link to match the metal. ', expectedRecordVersion: 4,
    }, () => 'plate-correct-1');
    assert.equal(Object.isFrozen(correction.request), true);
    await saveMaintenancePlateAction(correction.request);
    assert.deepEqual(bodies[0], {
      action: 'correct_link', artworkId: 'UL-101', editionNumber: 2,
      physicalEngravingMatches: true,
      reason: 'Correct the digital link to match the metal.',
      idempotencyKey: 'plate-correct-1', expectedRecordVersion: 4,
    });

    const replacement = beginMaintenancePlateActionAttempt(null, {
      keeperPieceId: 'kp-1', action: 'replace_plate',
      physicalDisposition: 'Original plate destroyed and photographed.',
      reason: 'Replace metal engraved with the wrong edition.', expectedRecordVersion: 5,
    }, () => 'plate-replace-1');
    const result = await saveMaintenancePlateAction(replacement.request);
    assert.equal(result.replacement?.ownershipCode, 'AAAA-BBBB-CCCC-DDDD');
    assert.deepEqual(bodies[1], {
      action: 'replace_plate',
      physicalDisposition: 'Original plate destroyed and photographed.',
      reason: 'Replace metal engraved with the wrong edition.',
      idempotencyKey: 'plate-replace-1', expectedRecordVersion: 5,
    });
  });

  it('freezes exact creator-history create, correction, and removal bodies', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    mock.method(globalThis, 'fetch', async (_input: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ ok: true, provenance: { recordVersion: 2 } }), { status: 200 });
    });
    const {
      beginMaintenanceProvenanceActionAttempt,
      saveMaintenanceProvenanceAction,
    } = await import('../utils/adminRegistryMaintenance.ts');
    const entry = {
      entryType: 'contributor' as const,
      title: 'Mira S.', detail: 'Joined the assembly.', role: 'Studio collaborator',
      occurredAt: '2026-01', visibility: 'public' as const,
    };
    const created = beginMaintenanceProvenanceActionAttempt(null, {
      keeperPieceId: 'kp-1', action: 'create', entry,
      reason: ' Record collaborator. ',
    }, () => 'prov-create-1');
    entry.title = 'Changed later';
    await saveMaintenanceProvenanceAction(created.request);
    assert.equal(Object.isFrozen(created.request.entry), true);
    assert.deepEqual(bodies[0], {
      action: 'create',
      entry: {
        entryType: 'contributor', title: 'Mira S.', detail: 'Joined the assembly.',
        role: 'Studio collaborator', occurredAt: '2026-01', visibility: 'public',
      },
      reason: 'Record collaborator.', idempotencyKey: 'prov-create-1',
    });

    const removed = beginMaintenanceProvenanceActionAttempt(null, {
      keeperPieceId: 'kp-1', action: 'remove', provenanceId: 'prov-1',
      expectedVersion: 4, reason: 'Remove from the current view.',
    }, () => 'prov-remove-1');
    await saveMaintenanceProvenanceAction(removed.request);
    assert.deepEqual(bodies[1], {
      action: 'remove', provenanceId: 'prov-1', expectedVersion: 4,
      reason: 'Remove from the current view.', idempotencyKey: 'prov-remove-1',
    });
  });

  it('converts familiar currency amounts to exact integer minor amounts', async () => {
    const {
      currencyAmountToInput,
      formatMaintenanceCurrencyAmount,
      maintenanceCurrencyAmountToDraft,
      parseMaintenanceCurrencyAmount,
    } = await import('../utils/adminRegistryMaintenance.ts');

    assert.equal(parseMaintenanceCurrencyAmount('1250.00', 'USD'), 125000);
    assert.equal(parseMaintenanceCurrencyAmount('0.01', 'USD'), 1);
    assert.equal(currencyAmountToInput(125000, 'USD'), '1250.00');
    assert.equal(formatMaintenanceCurrencyAmount(125000, 'USD'), 'USD 1,250.00');
    assert.throws(() => parseMaintenanceCurrencyAmount('1.005', 'USD'), /two decimal places/i);

    assert.equal(parseMaintenanceCurrencyAmount('125000', 'IDR'), 125000);
    assert.equal(currencyAmountToInput(125000, 'IDR'), '125000');
    assert.equal(formatMaintenanceCurrencyAmount(125000, 'IDR'), 'IDR 125,000');
    assert.throws(() => parseMaintenanceCurrencyAmount('125000.5', 'IDR'), /whole amount/i);

    assert.equal(parseMaintenanceCurrencyAmount('1.234', 'KWD'), 1234);
    assert.equal(currencyAmountToInput(1234, 'KWD'), '1.234');
    assert.equal(formatMaintenanceCurrencyAmount(1234, 'KWD'), 'KWD 1.234');

    for (const code of ['CHF', 'NZD', 'CNY']) {
      assert.equal(parseMaintenanceCurrencyAmount('1250.50', code), 125050);
      assert.equal(currencyAmountToInput(125050, code), '1250.50');
      assert.equal(formatMaintenanceCurrencyAmount(125050, code), `${code} 1,250.50`);
    }

    const existingServerRecord = { amountMinor: 98765, currency: 'CHF' };
    assert.equal(currencyAmountToInput(existingServerRecord.amountMinor, existingServerRecord.currency), '987.65');
    assert.throws(() => parseMaintenanceCurrencyAmount('10', 'XTS'), /unsupported currency/i);

    const supportedValuesOf = Object.getOwnPropertyDescriptor(Intl, 'supportedValuesOf');
    try {
      Object.defineProperty(Intl, 'supportedValuesOf', { configurable: true, value: undefined });
      assert.equal(parseMaintenanceCurrencyAmount('2.50', 'CHF'), 250);
      assert.throws(() => parseMaintenanceCurrencyAmount('2.50', 'ZZZ'), /unsupported currency/i);
      assert.throws(() => parseMaintenanceCurrencyAmount('2.50', 'XTS'), /unsupported currency/i);
    } finally {
      if (supportedValuesOf) Object.defineProperty(Intl, 'supportedValuesOf', supportedValuesOf);
      else delete (Intl as typeof Intl & { supportedValuesOf?: unknown }).supportedValuesOf;
    }

    assert.deepEqual(maintenanceCurrencyAmountToDraft(54321, 'ZZZ'), {
      amount: '54321',
      currency: 'ZZZ',
      preservedUnsupported: { amountMinor: 54321, currency: 'ZZZ' },
    });
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
    assert.match(component, /Transfer steward/);
    assert.doesNotMatch(component, /Reset steward/);
    assert.doesNotMatch(component, /Assign steward/);
    assert.match(component, /permanent public lineage event/i);
    assert.match(component, /selected\.stewardVersion/);
    assert.match(component, /Correct digital link/);
    assert.match(component, /Void generated plate/);
    assert.match(component, /Replace physical plate/);
    assert.match(component, /If the engraving itself is wrong, never relink it/i);
    assert.match(component, /Clear one-time package from this screen/);
    assert.match(component, /projectPlateDownloads/);
    assert.match(component, /Creator history and intention/);
    assert.match(component, /Add creator-history entry/);
    assert.match(component, /Private, administrator only/);
    assert.match(component, /Steward, not public/);
    assert.match(component, /Public scanned record/);
    assert.match(component, /prior values.*remain in append-only maintenance history/i);
    assert.match(component, /verified account email/i);
    assert.match(component, /Unclaimed/);
    assert.match(component, /display location.*clear/i);
  });

  it('shows legacy sale history as read-only with an exact verified-sales handoff', () => {
    const component = source('components/AdminMaintenance.tsx');
    const acquisitionOptions = component.slice(
      component.indexOf('const acquisitionTypes'),
      component.indexOf('const inputClass'),
    );

    assert.match(component, /Legacy sale record/);
    assert.doesNotMatch(acquisitionOptions, /value:\s*['"]sale['"]/);
    assert.match(component, /isLegacySaleAcquisition/);
    assert.match(component, /canCorrectMaintenanceAcquisition/);
    assert.match(component, /<Link[\s\S]*buildLegacyAcquisitionSalesPath/);
    assert.match(component, /Open verified sales/);
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
    assert.match(component, /saveAttemptRef/);
    assert.match(component, /beginMaintenanceSaveRequestAttempt/);
    assert.match(component, /shouldRetainMaintenanceSaveAttempt/);
    assert.match(component, /createMaintenanceRequestGate/);
    assert.match(component, /discardMaintenanceSaveAttempt/);
    assert.match(component, /disabled=\{saving/);
    assert.match(component, /latest detail could not be reloaded/i);
    assert.match(component, /throw error/);
    assert.match(component, /saved, but the private detail could not be refreshed/i);
    assert.ok(
      component.indexOf('await saveMaintenanceAcquisition')
        < component.indexOf('saved, but the private detail could not be refreshed'),
    );
  });

  it('freezes every ambiguous maintenance request until its exact replay resolves', () => {
    const component = source('components/AdminMaintenance.tsx');
    assert.match(component, /type AmbiguousMaintenanceAttempt/);
    assert.match(component, /setAmbiguousAttempt\('plate'\)/);
    assert.match(component, /setAmbiguousAttempt\('provenance'\)/);
    assert.match(component, /setAmbiguousAttempt\('acquisition'\)/);
    assert.match(component, /setAmbiguousAttempt\('steward'\)/);
    assert.match(component, /beforeunload/);
    assert.match(component, /Retry the unchanged request before editing, cancelling, searching, or leaving this record/i);
    assert.match(component, /disabled=\{plateSaving \|\| ambiguousAttempt === 'plate'\}/);
    assert.match(component, /disabled=\{provenanceSaving \|\| ambiguousAttempt === 'provenance'\}/);
    assert.match(component, /const transitionBusy =[\s\S]*Boolean\(ambiguousAttempt\)/);
  });

  it('keeps the development unlock mock exact and rejects extra fields', () => {
    const vite = source('vite.config.ts');
    assert.match(vite, /body\.secret !== 'local-development-secret'/);
    assert.match(vite, /Object\.keys\(body\).*secret/);
  });

  it('labels every control and provides live loading, error, and status feedback', () => {
    const component = source('components/AdminMaintenance.tsx');
    for (const id of [
      'maintenance-public-code',
      'maintenance-artwork-id',
      'maintenance-title',
      'maintenance-edition',
      'maintenance-holder-name',
      'maintenance-acquisition-type',
      'maintenance-acquired-at',
      'maintenance-amount',
      'maintenance-currency',
      'maintenance-reason',
      'maintenance-steward-target-email',
      'maintenance-steward-reason',
      'maintenance-plate-artwork-id',
      'maintenance-plate-edition-number',
      'maintenance-plate-engraving-match',
      'maintenance-plate-disposition',
      'maintenance-plate-reason',
      'maintenance-provenance-type',
      'maintenance-provenance-visibility',
      'maintenance-provenance-title',
      'maintenance-provenance-role',
      'maintenance-provenance-date',
      'maintenance-provenance-detail',
      'maintenance-provenance-reason',
    ]) {
      assert.match(component, new RegExp(`htmlFor=["']${id}["']`));
      assert.match(component, new RegExp(`id=["']${id}["']`));
    }
    assert.match(component, /aria-live=["']polite["']/);
    assert.match(component, /role=["']status["']/);
    assert.match(component, /role=["']alert["']/);
    assert.match(component, /Loading|Searching/);
    assert.match(component, /familiar amount|normally write/i);
    assert.doesNotMatch(component, /minor units|smallest units/i);
    assert.match(component, /list=["']maintenance-currency-options["']/);
    assert.match(component, /id=["']maintenance-currency-options["']/);
  });
});
