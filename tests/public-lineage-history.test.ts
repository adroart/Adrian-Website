import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';

import { buildLineageEvent, projectLineagePublicPayload } from '../functions/api/_lib/lineage.js';
import { onRequest } from '../functions/api/lineage/[publicCode].js';
import { LAUNCH_FLAGS } from '../launchFlags';
import {
  formatLineageEventLabel,
  publicLineageDetails,
  shouldLoadPublicLineage,
  validatePublicLineageResponse,
} from '../utils/publicLineage';

const PUBLIC_CODE = 'AR-7KQ9M2WX';
const originalLegacyFlag = LAUNCH_FLAGS.livingLegacy;

before(() => { LAUNCH_FLAGS.livingLegacy = true; });
after(() => { LAUNCH_FLAGS.livingLegacy = originalLegacyFlag; });

async function lineageRows() {
  const first = await buildLineageEvent({
    keeperPieceId: 'kp-1',
    sequence: 1,
    eventType: 'issued',
    eventAt: '2026-07-13T00:00:00.000Z',
    previousHash: null,
    publicPayload: { pieceId: 'UL-100', editionNumber: 2, publicCode: PUBLIC_CODE },
  });
  const second = await buildLineageEvent({
    keeperPieceId: 'kp-1',
    sequence: 2,
    eventType: 'activated',
    eventAt: '2026-07-14T00:00:00.000Z',
    previousHash: first.eventHash,
    publicPayload: { plateStatus: 'active' },
  });
  return [first, second].map((event) => ({
    sequence: event.sequence,
    event_type: event.eventType,
    event_at: event.eventAt,
    previous_hash: event.previousHash,
    event_hash: event.eventHash,
    public_payload_json: event.publicPayloadJson,
  }));
}

function environment(options: {
  piece?: Record<string, unknown> | null;
  events?: Record<string, unknown>[];
  schemaFailure?: boolean;
} = {}) {
  const piece = options.piece === undefined
    ? {
      id: 'kp-1', piece_id: 'UL-100', edition_number: 2, public_code: PUBLIC_CODE,
      lineage_event_count: options.events?.length ?? 0,
      lineage_head_hash: options.events?.at(-1)?.event_hash ?? null,
    }
    : options.piece;
  const statements: string[] = [];
  return {
    statements,
    env: {
      DB: {
        prepare(sql: string) {
          const normalized = sql.replace(/\s+/g, ' ').trim();
          statements.push(normalized);
          if (options.schemaFailure) throw new Error('no such table: keeper_pieces');
          if (/SELECT plate\.id, plate\.piece_id, plate\.edition_number, plate\.public_code/i.test(normalized)) {
            return {
              bind(value: string) {
                assert.equal(value, PUBLIC_CODE);
                return this;
              },
              async first() { return piece; },
            };
          }
          if (/SELECT sequence, event_type, event_at, previous_hash, event_hash, public_payload_json FROM artwork_lineage_events/i.test(normalized)) {
            return {
              bind(value: string) {
                assert.equal(value, 'kp-1');
                return this;
              },
              async all() { return { results: options.events || [] }; },
            };
          }
          throw new Error(`Unexpected SQL: ${sql}`);
        },
      },
    },
  };
}

function request(method = 'GET') {
  return new Request(`https://adrianrasmussen.com/api/lineage/${PUBLIC_CODE}`, { method });
}

describe('public artwork lineage history', () => {
  it('accepts only transfer-scoped opaque references in a transferred event', () => {
    assert.deepEqual(projectLineagePublicPayload('transferred', {
      fromRef: 'tp-00000000-0000-4000-8000-000000000001',
      toRef: 'tp-00000000-0000-4000-8000-000000000002',
      transferKind: 'gift',
    }), {
      fromRef: 'tp-00000000-0000-4000-8000-000000000001',
      toRef: 'tp-00000000-0000-4000-8000-000000000002',
      transferKind: 'gift',
    });
    assert.throws(() => projectLineagePublicPayload('transferred', {
      fromRef: 'user-current', toRef: 'user-target', transferKind: 'other',
    }));
  });

  it('stays invisible and never queries D1 while the public flag is off', async () => {
    LAUNCH_FLAGS.livingLegacy = false;
    try {
      const { env, statements } = environment();
      for (const method of ['GET', 'POST']) {
        const response = await onRequest({
          request: request(method), env, params: { publicCode: PUBLIC_CODE },
        });
        assert.equal(response.status, 404);
        assert.deepEqual(await response.json(), { ok: false, error: 'not_found' });
      }
      assert.equal(statements.length, 0);
    } finally {
      LAUNCH_FLAGS.livingLegacy = true;
    }
  });

  it('returns a verified, ordered, secret-free public chain', async () => {
    const events = await lineageRows();
    const { env, statements } = environment({ events });
    const response = await onRequest({ request: request(), env, params: { publicCode: PUBLIC_CODE } });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), {
      ok: true,
      artwork: { pieceId: 'UL-100', editionNumber: 2, publicCode: PUBLIC_CODE },
      events: events.map((event) => ({
        sequence: event.sequence,
        eventType: event.event_type,
        eventAt: event.event_at,
        previousHash: event.previous_hash,
        eventHash: event.event_hash,
        publicPayload: JSON.parse(String(event.public_payload_json)),
      })),
    });
    assert.match(statements[0], /plate\.plate_status IN \('active', 'superseded'\)/);
    assert.equal(statements.join(' ').match(/email|ip_address|user_agent|order_ref|keeper_user_id/gi), null);
  });

  it('fails closed when any event hash or chain link is broken', async () => {
    const events = await lineageRows();
    for (const changed of [
      events.map((event, index) => index === 0 ? { ...event, event_hash: '0'.repeat(64) } : event),
      events.map((event, index) => index === 1 ? { ...event, previous_hash: 'f'.repeat(64) } : event),
      events.map((event, index) => index === 1 ? { ...event, sequence: 3 } : event),
      events.map((event, index) => index === 1 ? { ...event, public_payload_json: '{broken' } : event),
    ]) {
      const response = await onRequest({
        request: request(),
        env: environment({ events: changed }).env,
        params: { publicCode: PUBLIC_CODE },
      });
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { ok: false, error: 'lineage_integrity_error' });
    }
  });

  it('keeps a superseded code resolvable and gates its successor code explicitly', async () => {
    const activeEvents = await lineageRows();
    const final = await buildLineageEvent({
      keeperPieceId: 'kp-1', sequence: 3, eventType: 'superseded',
      eventAt: '2026-07-30T00:00:00.000Z', previousHash: activeEvents[1].event_hash,
      publicPayload: { plateStatus: 'superseded' },
    });
    const events = [...activeEvents, {
      sequence: final.sequence, event_type: final.eventType, event_at: final.eventAt,
      previous_hash: final.previousHash, event_hash: final.eventHash,
      public_payload_json: final.publicPayloadJson,
    }];
    const piece = {
      id: 'kp-1', piece_id: 'UL-100', edition_number: 2, public_code: PUBLIC_CODE,
      plate_status: 'superseded', current_public_code: 'AR-ABCDEFGH',
      lineage_event_count: 3, lineage_head_hash: final.eventHash,
    };
    const withheldEnv = environment({ piece, events }).env;
    const withheld = await onRequest({
      request: request(), env: withheldEnv, params: { publicCode: PUBLIC_CODE },
    });
    assert.equal(withheld.status, 200);
    assert.deepEqual((await withheld.json()).artwork, {
      pieceId: 'UL-100', editionNumber: 2, publicCode: PUBLIC_CODE,
      plateStatus: 'superseded', successorDisclosure: 'withheld',
    });

    const disclosedFixture = environment({ piece, events });
    const disclosedEnv = {
      ...disclosedFixture.env,
      ARTWORK_REGISTRY_SUCCESSOR_DISCLOSURE: 'disclosed',
    };
    const disclosed = await onRequest({
      request: request(), env: disclosedEnv, params: { publicCode: PUBLIC_CODE },
    });
    assert.equal(disclosed.status, 200);
    assert.equal((await disclosed.json()).artwork.currentPublicCode, 'AR-ABCDEFGH');
    assert.match(disclosedFixture.statements[0], /WITH RECURSIVE successor_chain/i);
  });

  it('fails closed on an active empty chain or a chain truncated before its anchor', async () => {
    const empty = await onRequest({
      request: request(),
      env: environment({ events: [] }).env,
      params: { publicCode: PUBLIC_CODE },
    });
    assert.equal(empty.status, 409);

    const events = await lineageRows();
    const anchoredPiece = {
      id: 'kp-1', piece_id: 'UL-100', edition_number: 2, public_code: PUBLIC_CODE,
      lineage_event_count: 2, lineage_head_hash: events[1].event_hash,
    };
    const truncated = await onRequest({
      request: request(),
      env: environment({ piece: anchoredPiece, events: events.slice(0, 1) }).env,
      params: { publicCode: PUBLIC_CODE },
    });
    assert.equal(truncated.status, 409);
    assert.deepEqual(await truncated.json(), { ok: false, error: 'lineage_integrity_error' });
  });

  it('does not reveal unknown or inactive artwork identities', async () => {
    for (const piece of [null, undefined]) {
      const response = await onRequest({
        request: request(),
        env: environment({ piece: piece === undefined ? null : piece }).env,
        params: { publicCode: PUBLIC_CODE },
      });
      assert.equal(response.status, 404);
    }
  });

  it('rejects malformed codes before querying D1', async () => {
    const { env, statements } = environment();
    const response = await onRequest({ request: request(), env, params: { publicCode: 'AR-I0O1BAD!' } });
    assert.equal(response.status, 404);
    assert.equal(statements.length, 0);
  });

  it('returns service unavailable when D1 or its schema is missing', async () => {
    const missing = await onRequest({ request: request(), env: {}, params: { publicCode: PUBLIC_CODE } });
    assert.equal(missing.status, 503);
    assert.equal(missing.headers.get('Cache-Control'), 'no-store');

    const schema = await onRequest({
      request: request(),
      env: environment({ schemaFailure: true }).env,
      params: { publicCode: PUBLIC_CODE },
    });
    assert.equal(schema.status, 503);
  });

  it('allows GET only', async () => {
    const response = await onRequest({
      request: request('POST'),
      env: environment().env,
      params: { publicCode: PUBLIC_CODE },
    });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'GET');
  });
});

describe('public lineage presentation', () => {
  it('does not fetch or render registry history while the public flag is off', () => {
    assert.equal(shouldLoadPublicLineage(false, PUBLIC_CODE, 'UL-100'), false);
    assert.equal(shouldLoadPublicLineage(true, PUBLIC_CODE, 'UL-100'), true);

    const worksPage = readFileSync(new URL('../components/WorksPage.tsx', import.meta.url), 'utf8');
    assert.match(worksPage, /shouldLoadPublicLineage\(legacyOn, instanceCode, id\)/);
    assert.match(worksPage, /showPublicLineage\s*&&\s*instanceCode\s*&&\s*\(/);
  });

  it('uses friendly labels for registry lifecycle events', () => {
    assert.equal(formatLineageEventLabel('issued'), 'Plate issued');
    assert.equal(formatLineageEventLabel('activated'), 'Plate activated');
    assert.equal(formatLineageEventLabel('fulfillment_assign'), 'Assigned for sale');
    assert.equal(formatLineageEventLabel('fulfillment_correct'), 'Assignment corrected');
    assert.equal(formatLineageEventLabel('fulfillment_correction_out'), 'Assignment corrected');
    assert.equal(formatLineageEventLabel('fulfillment_correction_in'), 'Assignment corrected');
    assert.equal(formatLineageEventLabel('fulfillment_ship'), 'Shipped');
    assert.equal(formatLineageEventLabel('first_bound'), 'First steward registered');
  });

  it('presents only shallow simple public payload values', () => {
    assert.deepEqual(publicLineageDetails({ editionNumber: 2, plateStatus: 'active', confirmed: true }), [
      ['Edition number', '2'],
      ['Plate status', 'active'],
      ['Confirmed', 'Yes'],
    ]);
    assert.deepEqual(publicLineageDetails({ nested: { email: 'hidden@example.com' }, list: ['private'], empty: null }), []);
  });

  it('validates API responses before the Works page renders them', () => {
    const value = {
      ok: true,
      artwork: { pieceId: 'UL-100', editionNumber: 2, publicCode: PUBLIC_CODE },
      events: [{
        sequence: 1,
        eventType: 'issued',
        eventAt: '2026-07-13T00:00:00.000Z',
        previousHash: null,
        eventHash: 'a'.repeat(64),
        publicPayload: { pieceId: 'UL-100', editionNumber: 2, publicCode: PUBLIC_CODE },
      }],
    };
    assert.deepEqual(validatePublicLineageResponse(value, PUBLIC_CODE, 'UL-100'), value);
    assert.equal(validatePublicLineageResponse({ ...value, artwork: { ...value.artwork, pieceId: 'UL-999' } }, PUBLIC_CODE, 'UL-100'), null);
    assert.equal(validatePublicLineageResponse({ ...value, events: [{ ...value.events[0], eventHash: 'bad' }] }, PUBLIC_CODE, 'UL-100'), null);
  });
});

describe('lineage public payload allowlist', () => {
  it('accepts only the documented exact payload for each event type', () => {
    assert.deepEqual(projectLineagePublicPayload('issued', {
      pieceId: 'UL-100', editionNumber: 2, publicCode: PUBLIC_CODE,
    }), { pieceId: 'UL-100', editionNumber: 2, publicCode: PUBLIC_CODE });
    assert.deepEqual(projectLineagePublicPayload('activated', { plateStatus: 'active' }), { plateStatus: 'active' });
    assert.deepEqual(projectLineagePublicPayload('link_corrected', {
      pieceId: 'UL-101', editionNumber: 0,
    }), { pieceId: 'UL-101', editionNumber: 0 });
    assert.deepEqual(projectLineagePublicPayload('voided', { plateStatus: 'void' }), { plateStatus: 'void' });
    assert.deepEqual(projectLineagePublicPayload('superseded', {
      plateStatus: 'superseded',
    }), { plateStatus: 'superseded' });
    assert.deepEqual(projectLineagePublicPayload('first_bound', {}), {});

    for (const payload of [
      { holderName: 'A Collector' },
      { contact: '+1 555 0100' },
      { phone: '+1 555 0100' },
      { address: 'Private studio' },
      { nested: { note: 'private' } },
    ]) {
      assert.throws(() => projectLineagePublicPayload('first_bound', payload), /payload/i);
    }
    assert.throws(() => projectLineagePublicPayload('activated', { plateStatus: 'active', contact: 'private' }), /payload/i);
    assert.throws(() => projectLineagePublicPayload('issued', { pieceId: 'UL-100', editionNumber: 2, publicCode: PUBLIC_CODE, phone: 'private' }), /payload/i);
    assert.throws(() => projectLineagePublicPayload('issued', { pieceId: 'buyer@example.com', editionNumber: 2, publicCode: PUBLIC_CODE }), /payload/i);
    assert.throws(() => projectLineagePublicPayload('issued', { pieceId: '+15550100', editionNumber: 2, publicCode: PUBLIC_CODE }), /payload/i);
  });
});

describe('registry rollout boundary', () => {
  it('keeps scratch admin explicit and delays the public flip until after metal qualification', () => {
    const runbook = readFileSync(new URL('../docs/lineage-plate-runbook.md', import.meta.url), 'utf8');
    const adminGate = runbook.indexOf('ARTWORK_REGISTRY_ADMIN_ENABLED=true');
    const scratchStart = runbook.indexOf('## First non-production canary');
    const prototypeStart = runbook.indexOf('## Material prototype qualification');
    const activationGate = runbook.indexOf('## Activate only the real metal', prototypeStart);
    const publicFlip = runbook.indexOf('set `LAUNCH_FLAGS.livingLegacy` to `true`');

    assert.ok(adminGate >= 0 && scratchStart > adminGate && prototypeStart > scratchStart);
    assert.ok(activationGate >= 0);
    assert.ok(publicFlip > activationGate);

    const qrResolver = readFileSync(new URL('../functions/qr/[number].js', import.meta.url), 'utf8');
    assert.doesNotMatch(qrResolver, /legacyEnabled|livingLegacy/);
  });
});
