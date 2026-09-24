import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { LAUNCH_FLAGS } from '../launchFlags.ts';
import {
  CollectorApiNetworkError,
  PUBLIC_CODE_PATTERN,
  bindKeeper,
  getLineage,
  getRegistryIdentity,
  inspectFirstBindInvitation,
  redeemFirstBindInvitation,
  isValidPublicCode,
} from '../components/collector/api.ts';

const originalFetch = globalThis.fetch;
const originalLivingLegacy = LAUNCH_FLAGS.livingLegacy;

interface Captured {
  input: string | URL | Request;
  init?: RequestInit;
}

let calls: Captured[] = [];
let respond: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

before(() => {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return respond(input, init);
  }) as typeof fetch;
});

beforeEach(() => {
  calls = [];
  LAUNCH_FLAGS.livingLegacy = originalLivingLegacy;
  respond = async () => new Response(JSON.stringify({ ok: false, error: 'unset' }), { status: 500 });
});

after(() => {
  globalThis.fetch = originalFetch;
  LAUNCH_FLAGS.livingLegacy = originalLivingLegacy;
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('PUBLIC_CODE_PATTERN / isValidPublicCode', () => {
  it('accepts the documented shape and rejects the excluded glyphs', () => {
    assert.equal(PUBLIC_CODE_PATTERN.source, '^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$');
    assert.equal(isValidPublicCode('AR-7K9QMX2P'), true);
    assert.equal(isValidPublicCode('AR-7K9QMX2'), false); // too short
    assert.equal(isValidPublicCode('AR-7K9QMX2O'), false); // O excluded
    assert.equal(isValidPublicCode('AR-7K9QMX01'), false); // 0 and 1 excluded
    assert.equal(isValidPublicCode('ar-7k9qmx2p'), false); // lowercase rejected
    assert.equal(isValidPublicCode('not-a-code'), false);
  });
});

describe('getRegistryIdentity', () => {
  it('short-circuits an invalid code without calling fetch', async () => {
    const outcome = await getRegistryIdentity('nope');
    assert.deepEqual(outcome, { ok: false, status: 404, error: 'not_found' });
    assert.equal(calls.length, 0);
  });

  it('unwraps {ok:true, identity} into ApiOutcome<PublicPlateIdentity>', async () => {
    const identity = { artworkId: 'UL-105', publicCode: 'AR-7K9QMX2P' };
    respond = async () => jsonResponse({ ok: true, identity });
    const outcome = await getRegistryIdentity('AR-7K9QMX2P');
    assert.equal(outcome.ok, true);
    if (outcome.ok) assert.deepEqual(outcome.data, identity);
    assert.equal(calls.length, 1);
    assert.match(String(calls[0].input), /\/api\/registry\/AR-7K9QMX2P$/);
    assert.equal(calls[0].init?.credentials, 'same-origin');
  });

  it('surfaces a documented error status without throwing', async () => {
    respond = async () => jsonResponse({ ok: false, error: 'registry_unavailable' }, 503);
    const outcome = await getRegistryIdentity('AR-7K9QMX2P');
    assert.deepEqual(outcome, { ok: false, status: 503, error: 'registry_unavailable', message: undefined });
  });

  it('throws CollectorApiNetworkError only when fetch itself rejects', async () => {
    respond = async () => {
      throw new TypeError('network down');
    };
    await assert.rejects(() => getRegistryIdentity('AR-7K9QMX2P'), CollectorApiNetworkError);
  });
});

describe('first-bind invitation proof transport', () => {
  it('sends only fixed POST URLs with a token in each JSON body', async () => {
    const token = 'private-invitation-proof';
    respond = async input => jsonResponse(String(input).endsWith('/inspect')
      ? { ok: true, invitationId: 'inv-1', status: 'available', artwork: { artworkId: 'MD-905', publicCode: 'AR-7K9QMX2P' } }
      : { ok: true, keeper: { pieceId: 'MD-905', editionNumber: 1, claimedAt: '2026-09-23' } });
    await inspectFirstBindInvitation(` ${token} `);
    await redeemFirstBindInvitation(token);
    assert.deepEqual(calls.map(call => String(call.input)), ['/api/invitations/inspect', '/api/invitations/redeem']);
    for (const call of calls) {
      assert.equal(call.init?.method, 'POST');
      assert.deepEqual(JSON.parse(String(call.init?.body)), { token });
      assert.equal(String(call.input).includes(token), false);
    }
  });
});

describe('getLineage — dark state (contract §7)', () => {
  it('reports kind:"dark" without a network call while livingLegacy is off', async () => {
    LAUNCH_FLAGS.livingLegacy = false;
    const outcome = await getLineage('AR-7K9QMX2P');
    assert.deepEqual(outcome, { kind: 'dark' });
    assert.equal(calls.length, 0);
  });

  it('reports a real not_found once the flag is on and the server 404s', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    respond = async () => jsonResponse({ ok: false, error: 'not_found' }, 404);
    const outcome = await getLineage('AR-7K9QMX2P');
    assert.deepEqual(outcome, { kind: 'not_found' });
    assert.equal(calls.length, 1);
  });
});

describe('bindKeeper', () => {
  it('never sends the ownership code in the URL, and normalizes it in the body', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    respond = async () => jsonResponse({
      ok: true,
      keeper: { pieceId: 'UL-105', editionNumber: 3, claimedAt: '2026-01-01T00:00:00.000Z' },
    });
    const outcome = await bindKeeper({
      publicCode: 'AR-7K9QMX2P',
      ownershipCode: ' k7qm-9xtr 2phv-n4wb ',
    });
    assert.equal(outcome.kind, 'bound');
    assert.equal(calls.length, 1);
    const [{ input, init }] = calls;
    assert.match(String(input), /^\/api\/keeper\/bind$/);
    assert.doesNotMatch(String(input), /9XTR|K7QM/);
    const sentBody = JSON.parse(String(init?.body));
    assert.equal(sentBody.ownershipCode, 'K7QM9XTR2PHVN4WB');
    assert.equal(sentBody.publicCode, 'AR-7K9QMX2P');
    assert.equal(Object.keys(sentBody).sort().join(','), 'ownershipCode,publicCode');
  });

  it('reports the dark gate as an error outcome without a network call', async () => {
    LAUNCH_FLAGS.livingLegacy = false;
    const outcome = await bindKeeper({ publicCode: 'AR-7K9QMX2P', ownershipCode: 'AAAA-BBBB-CCCC-DDDD' });
    assert.deepEqual(outcome, { kind: 'error', status: 404, error: 'not_found' });
    assert.equal(calls.length, 0);
  });

  const cases: Array<{
    name: string;
    status: number;
    body: unknown;
    expectKind: string;
  }> = [
    { name: 'not_registered', status: 404, body: { ok: false, error: 'not_registered', message: 'nope' }, expectKind: 'not_registered' },
    { name: 'code_mismatch', status: 403, body: { ok: false, error: 'code_mismatch', message: 'nope' }, expectKind: 'mismatch' },
    { name: 'verified_email_required', status: 403, body: { ok: false, error: 'verified_email_required', message: 'nope' }, expectKind: 'needs_verified_email' },
    { name: 'plate_not_ready', status: 409, body: { ok: false, error: 'plate_not_ready', message: 'nope' }, expectKind: 'not_ready' },
    { name: 'plate_recovery_not_qualified', status: 409, body: { ok: false, error: 'plate_recovery_not_qualified', message: 'nope' }, expectKind: 'not_ready' },
    { name: 'identity_recovery_not_qualified', status: 409, body: { ok: false, error: 'identity_recovery_not_qualified', message: 'nope' }, expectKind: 'not_ready' },
    { name: 'already_current_steward', status: 409, body: { ok: false, error: 'already_current_steward', message: 'nope' }, expectKind: 'conflict' },
    { name: 'bind_conflict', status: 409, body: { ok: false, error: 'bind_conflict', message: 'nope' }, expectKind: 'conflict' },
    { name: 'claim_rate_limited', status: 429, body: { ok: false, error: 'claim_rate_limited', message: 'nope' }, expectKind: 'rate_limited' },
  ];
  for (const testCase of cases) {
    it(`maps ${testCase.name} (${testCase.status}) to kind:'${testCase.expectKind}'`, async () => {
      LAUNCH_FLAGS.livingLegacy = true;
      respond = async () => jsonResponse(testCase.body, testCase.status);
      const outcome = await bindKeeper({ publicCode: 'AR-7K9QMX2P', ownershipCode: 'AAAA-BBBB-CCCC-DDDD' });
      assert.equal(outcome.kind, testCase.expectKind);
    });
  }

  it('maps 202 claim_requested (opened) to kind:"pending"', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    respond = async () => jsonResponse({
      ok: true,
      status: 'claim_requested',
      message: 'recorded',
      claim: { pieceId: 'UL-105', editionNumber: 3, outcome: 'opened' },
    }, 202);
    const outcome = await bindKeeper({ publicCode: 'AR-7K9QMX2P', ownershipCode: 'AAAA-BBBB-CCCC-DDDD' });
    assert.deepEqual(outcome, { kind: 'pending', outcome: 'opened', message: 'recorded' });
  });

  it('sends the optional note only when non-empty', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    respond = async () => jsonResponse({
      ok: true,
      keeper: { pieceId: 'UL-105', editionNumber: 3, claimedAt: '2026-01-01T00:00:00.000Z' },
    });
    await bindKeeper({ publicCode: 'AR-7K9QMX2P', ownershipCode: 'AAAA-BBBB-CCCC-DDDD', note: '  ' });
    const sentBody = JSON.parse(String(calls[0].init?.body));
    assert.equal('note' in sentBody, false);
  });
});

describe('inspectFirstBindInvitation', () => {
  it('posts trimmed private proof to the fixed endpoint body and never places it in the URL', async () => {
    const token = 'private-first-bind-proof';
    respond = async () => jsonResponse({
      ok: true,
      invitationId: 'iv-one',
      artwork: {
        artworkId: 'UL-105', title: "Earth's Breath", publicCode: 'AR-7K9QMX2P',
        edition: { kind: 'unique' },
      },
      status: 'available',
    });

    const outcome = await inspectFirstBindInvitation(`  ${token}  `);

    assert.equal(outcome.ok, true);
    assert.equal(String(calls[0].input), '/api/invitations/inspect');
    assert.equal(String(calls[0].input).includes(token), false);
    assert.equal(calls[0].init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { token });
    assert.equal(calls[0].init?.credentials, 'same-origin');
    assert.equal(calls[0].init?.cache, 'no-store');
  });
});
