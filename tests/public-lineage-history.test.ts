import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildLineageEvent } from '../functions/api/_lib/lineage.js';
import { onRequest } from '../functions/api/lineage/[publicCode].js';
import { formatLineageEventLabel, publicLineageDetails } from '../utils/publicLineage';

const PUBLIC_CODE = 'AR-7KQ9M2WX';

async function lineageRows() {
  const first = await buildLineageEvent({
    keeperPieceId: 'kp-1',
    sequence: 1,
    eventType: 'issued',
    eventAt: '2026-07-13T00:00:00.000Z',
    previousHash: null,
    publicPayload: { editionNumber: 2 },
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
    ? { id: 'kp-1', piece_id: 'UL-100', edition_number: 2, public_code: PUBLIC_CODE }
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
          if (/SELECT id, piece_id, edition_number, public_code FROM keeper_pieces/i.test(normalized)) {
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
    assert.match(statements[0], /plate_status = 'active'/);
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
  it('uses friendly labels for registry lifecycle events', () => {
    assert.equal(formatLineageEventLabel('issued'), 'Plate issued');
    assert.equal(formatLineageEventLabel('activated'), 'Plate activated');
    assert.equal(formatLineageEventLabel('fulfillment_assign'), 'Assigned for sale');
    assert.equal(formatLineageEventLabel('fulfillment_correct'), 'Assignment corrected');
    assert.equal(formatLineageEventLabel('fulfillment_correction_out'), 'Assignment corrected');
    assert.equal(formatLineageEventLabel('fulfillment_correction_in'), 'Assignment corrected');
    assert.equal(formatLineageEventLabel('fulfillment_ship'), 'Shipped');
    assert.equal(formatLineageEventLabel('first_bound'), 'First keeper registered');
  });

  it('presents only shallow simple public payload values', () => {
    assert.deepEqual(publicLineageDetails({ editionNumber: 2, plateStatus: 'active', confirmed: true }), [
      ['Edition number', '2'],
      ['Plate status', 'active'],
      ['Confirmed', 'Yes'],
    ]);
    assert.deepEqual(publicLineageDetails({ nested: { email: 'hidden@example.com' }, list: ['private'], empty: null }), []);
  });
});
