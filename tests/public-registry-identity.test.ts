import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { onRequest } from '../functions/api/registry/[publicCode].js';
import {
  isPublicRegistryCode,
  projectPublicPlateIdentity,
  validatePublicPlateIdentity,
} from '../utils/publicRegistry.ts';

const PUBLIC_CODE = 'AR-7KQ9M2WX';

type DbOptions = {
  plate?: Record<string, unknown> | null;
  artwork?: Record<string, unknown> | null;
  creatorHistory?: Record<string, unknown>[];
  error?: Error;
};

function registryDb(options: DbOptions = {}) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const DB = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) {
          values = bound;
          return statement;
        },
        async first() {
          calls.push({ sql, values });
          if (options.error) throw options.error;
          if (/FROM keeper_pieces/i.test(sql)) return options.plate ?? null;
          if (/FROM registry_artworks/i.test(sql)) return options.artwork ?? null;
          throw new Error(`Unexpected query: ${sql}`);
        },
        async all() {
          calls.push({ sql, values });
          if (options.error) throw options.error;
          if (/FROM artwork_provenance_entries/i.test(sql)) {
            return { results: options.creatorHistory ?? [] };
          }
          throw new Error(`Unexpected query: ${sql}`);
        },
      };
      return statement;
    },
  };
  return { DB, calls };
}

const request = (method = 'GET') => new Request(
  `https://adrianrasmussen.com/api/registry/${PUBLIC_CODE}`,
  { method },
);

async function lookup(options: DbOptions, publicCode = PUBLIC_CODE, method = 'GET') {
  const db = registryDb(options);
  const response = await onRequest({
    request: request(method),
    env: { DB: db.DB },
    params: { publicCode },
  });
  return { response, calls: db.calls };
}

describe('public registry identity projection', () => {
  it('accepts only canonical ambiguity-safe AR codes', () => {
    assert.equal(isPublicRegistryCode(PUBLIC_CODE), true);
    for (const value of ['AR-I0O1BAD!', 'AR-abcdefgh', 'AR-TOO-SHORT', ` ${PUBLIC_CODE}`, null]) {
      assert.equal(isPublicRegistryCode(value), false, String(value));
    }
  });

  it('projects a strict public allowlist and formats a numbered edition', () => {
    const identity = projectPublicPlateIdentity({
      artworkId: 'UL-100',
      title: 'Art of Living - 32',
      series: 'Universal Language',
      editionKind: 'numbered',
      editionNumber: 2,
      editionSize: 7,
      publicCode: PUBLIC_CODE,
      plateStatus: 'generated',
      publicProvenance: [{ year: '2024', event: 'created', note: 'Bali' }],
      creatorHistory: [],
      amount: 1111,
      currency: 'USD',
      buyerEmail: 'private@example.com',
      ownershipCode: 'SECRET',
      recoveryCodeHash: 'SECRET',
      evidence: { private: true },
    });

    assert.deepEqual(identity, {
      artworkId: 'UL-100',
      title: 'Art of Living - 32',
      series: 'Universal Language',
      edition: { kind: 'numbered', number: 2, size: 7, label: 'Edition 2 of 7' },
      publicCode: PUBLIC_CODE,
      artistName: 'Adrian Rasmussen',
      plateStatus: 'generated',
      publicProvenance: [{ year: '2024', event: 'created', note: 'Bali' }],
      creatorHistory: [],
    });
    assert.equal(validatePublicPlateIdentity(identity), true);
    assert.equal(validatePublicPlateIdentity({
      publicProvenance: identity.publicProvenance,
      creatorHistory: identity.creatorHistory,
      plateStatus: identity.plateStatus,
      artistName: identity.artistName,
      publicCode: identity.publicCode,
      edition: { label: identity.edition.label, size: 7, number: 2, kind: 'numbered' },
      series: identity.series,
      title: identity.title,
      artworkId: identity.artworkId,
    }), true);
  });

  it('projects creator history through an exact public allowlist', () => {
    const identity = projectPublicPlateIdentity({
      artworkId: 'UL-100', title: 'Art of Living - 32', series: 'Universal Language',
      editionKind: 'numbered', editionNumber: 2, editionSize: 7,
      publicCode: PUBLIC_CODE, plateStatus: 'active', publicProvenance: [],
      creatorHistory: [{
        entryType: 'contributor',
        title: 'Mira Santoso',
        detail: 'Joined the final assembly.',
        role: 'Woodworker',
        occurredAt: '2025-04',
        provenanceId: 'private-row-id',
        visibility: 'public',
        recordVersion: 3,
        removedAt: null,
      }],
    });

    assert.deepEqual(identity.creatorHistory, [{
      entryType: 'contributor',
      title: 'Mira Santoso',
      detail: 'Joined the final assembly.',
      role: 'Woodworker',
      occurredAt: '2025-04',
    }]);
    assert.equal(validatePublicPlateIdentity(identity), true);
    assert.equal(validatePublicPlateIdentity({
      ...identity,
      creatorHistory: [{ ...identity.creatorHistory[0], visibility: 'public' }],
    }), false);
    assert.doesNotMatch(JSON.stringify(identity), /provenanceId|visibility|recordVersion|removedAt/);
  });

  it('fails closed on malformed creator history', () => {
    const base = {
      artworkId: 'UL-100', title: 'Art of Living - 32', series: 'Universal Language',
      editionKind: 'numbered', editionNumber: 2, editionSize: 7,
      publicCode: PUBLIC_CODE, plateStatus: 'active', publicProvenance: [],
      creatorHistory: [],
    };
    assert.throws(() => projectPublicPlateIdentity({
      ...base,
      creatorHistory: [{
        entryType: 'contributor', title: 'Mira', detail: null, role: null, occurredAt: null,
      }],
    }), /creator history/i);
    assert.throws(() => projectPublicPlateIdentity({
      ...base,
      creatorHistory: [{
        entryType: 'private_note', title: 'Hidden', detail: null, role: null, occurredAt: null,
      }],
    }), /creator history/i);
  });

  it('formats unique and legacy size-unknown numbered identities', () => {
    const unique = projectPublicPlateIdentity({
      artworkId: 'SIG-108', title: 'Winged Spirit Wood', series: null,
      editionKind: 'unique', editionNumber: 0, editionSize: null,
      publicCode: PUBLIC_CODE, plateStatus: 'active', publicProvenance: [],
      creatorHistory: [],
    });
    assert.deepEqual(unique.edition, {
      kind: 'unique', number: null, size: null, label: 'Unique work',
    });

    const historical = projectPublicPlateIdentity({
      artworkId: 'UL-100', title: 'Art of Living - 32', series: 'Universal Language',
      editionKind: 'numbered', editionNumber: 2, editionSize: null,
      publicCode: PUBLIC_CODE, plateStatus: 'active', publicProvenance: [],
      creatorHistory: [],
    });
    assert.deepEqual(historical.edition, {
      kind: 'numbered', number: 2, size: null, label: 'Edition 2',
    });
  });

  it('fails closed on invalid identity and provenance metadata', () => {
    const base = {
      artworkId: 'UL-100', title: 'Art of Living - 32', series: 'Universal Language',
      editionKind: 'numbered', editionNumber: 2, editionSize: 7,
      publicCode: PUBLIC_CODE, plateStatus: 'active', publicProvenance: [],
      creatorHistory: [],
    };
    assert.throws(() => projectPublicPlateIdentity({ ...base, editionNumber: 8 }), /identity/i);
    assert.throws(() => projectPublicPlateIdentity({ ...base, plateStatus: 'draft' }), /identity/i);
    assert.throws(() => projectPublicPlateIdentity({
      ...base,
      publicProvenance: [{ year: '2024', event: 'sold', note: 1111 }],
    }), /provenance/i);
    assert.equal(validatePublicPlateIdentity({ ...base, amount: 1111 }), false);
  });

  it('makes successor disclosure explicit and refuses malformed superseded identities', () => {
    const base = {
      artworkId: 'UL-100', title: 'Art of Living - 32', series: 'Universal Language',
      editionKind: 'numbered', editionNumber: 2, editionSize: 7,
      publicCode: PUBLIC_CODE, plateStatus: 'superseded', publicProvenance: [],
      creatorHistory: [],
    };
    const withheld = projectPublicPlateIdentity({
      ...base, successorDisclosure: 'withheld', currentPublicCode: 'AR-ABCDEFGH',
    });
    assert.equal(withheld.plateStatus, 'superseded');
    if (withheld.plateStatus !== 'superseded') assert.fail('expected superseded identity');
    assert.equal(withheld.successorDisclosure, 'withheld');
    assert.equal(Object.hasOwn(withheld, 'currentPublicCode'), false);
    assert.equal(validatePublicPlateIdentity(withheld), true);

    const disclosed = projectPublicPlateIdentity({
      ...base, successorDisclosure: 'disclosed', currentPublicCode: 'AR-ABCDEFGH',
    });
    assert.equal(disclosed.plateStatus, 'superseded');
    if (disclosed.plateStatus !== 'superseded') assert.fail('expected superseded identity');
    assert.equal(disclosed.successorDisclosure, 'disclosed');
    if (disclosed.successorDisclosure !== 'disclosed') assert.fail('expected disclosed successor');
    assert.equal(disclosed.currentPublicCode, 'AR-ABCDEFGH');
    assert.equal(validatePublicPlateIdentity(disclosed), true);
    assert.throws(() => projectPublicPlateIdentity({
      ...base, successorDisclosure: 'disclosed', currentPublicCode: null,
    }), /successor/i);
  });
});

describe('GET /api/registry/:publicCode', () => {
  it('loads only current public creator history and exposes only public fields', async () => {
    const { response, calls } = await lookup({
      plate: {
        id: 'kp-public-history', piece_id: 'UL-100', edition_number: 2,
        public_code: PUBLIC_CODE, plate_status: 'active',
      },
      artwork: { id: 'UL-100', edition_size: 7 },
      creatorHistory: [{
        entry_type: 'creation_place', title: 'Bali studio', detail: 'Built near Ubud.',
        role: null, occurred_at: '2024', id: 'must-not-leak', visibility: 'public',
        record_version: 7, removed_at: null,
      }],
    });

    assert.equal(response.status, 200);
    const payload = await response.json() as { identity: Record<string, unknown> };
    assert.deepEqual(payload.identity.creatorHistory, [{
      entryType: 'creation_place', title: 'Bali studio', detail: 'Built near Ubud.',
      role: null, occurredAt: '2024',
    }]);
    const historyQuery = calls.find(call => /FROM artwork_provenance_entries/i.test(call.sql));
    assert.ok(historyQuery);
    assert.match(historyQuery.sql, /keeper_piece_id\s*=\s*\?1/i);
    assert.match(historyQuery.sql, /visibility\s*=\s*'public'/i);
    assert.match(historyQuery.sql, /removed_at\s+IS\s+NULL/i);
    assert.match(
      historyQuery.sql,
      /^\s*SELECT entry_type, title, detail, role, occurred_at\s+FROM/i,
    );
    assert.doesNotMatch(historyQuery.sql, /record_version|visibility\s*,|removed_at\s*,/i);
    assert.deepEqual(historyQuery.values, ['kp-public-history']);
    assert.doesNotMatch(JSON.stringify(payload), /must-not-leak|record_version|visibility|removed_at/);
  });

  it('fails closed when a stored public creator-history row is malformed', async () => {
    const { response } = await lookup({
      plate: {
        id: 'kp-public-history', piece_id: 'UL-100', edition_number: 2,
        public_code: PUBLIC_CODE, plate_status: 'active',
      },
      artwork: { id: 'UL-100', edition_size: 7 },
      creatorHistory: [{
        entry_type: 'contributor', title: 'Mira', detail: null,
        role: null, occurred_at: null,
      }],
    });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { ok: false, error: 'identity_integrity_error' });
  });

  it('resolves old superseded codes while disclosing the current code only by explicit policy', async () => {
    const db = registryDb({
      plate: {
        id: 'kp-generated', piece_id: 'UL-100', edition_number: 2, public_code: PUBLIC_CODE,
        plate_status: 'superseded', current_public_code: 'AR-ABCDEFGH',
      },
      artwork: { id: 'UL-100', edition_size: 7 },
    });
    const withheld = await onRequest({
      request: request(), env: { DB: db.DB }, params: { publicCode: PUBLIC_CODE },
    });
    assert.equal(withheld.status, 200);
    const withheldIdentity = (await withheld.json()).identity;
    assert.equal(withheldIdentity.plateStatus, 'superseded');
    assert.equal(withheldIdentity.successorDisclosure, 'withheld');
    assert.equal(Object.hasOwn(withheldIdentity, 'currentPublicCode'), false);

    const disclosed = await onRequest({
      request: request(),
      env: { DB: db.DB, ARTWORK_REGISTRY_SUCCESSOR_DISCLOSURE: 'disclosed' },
      params: { publicCode: PUBLIC_CODE },
    });
    assert.equal(disclosed.status, 200);
    const disclosedIdentity = (await disclosed.json()).identity;
    assert.equal(disclosedIdentity.successorDisclosure, 'disclosed');
    assert.equal(disclosedIdentity.currentPublicCode, 'AR-ABCDEFGH');
    assert.match(db.calls[0].sql, /WITH RECURSIVE successor_chain/i);
    assert.doesNotMatch(JSON.stringify(disclosedIdentity), /ownership|recovery|steward|amount|cipher|nonce/i);
  });

  it('resolves a generated numbered plate with canonical static metadata and overlay size', async () => {
    const { response, calls } = await lookup({
      plate: {
        id: 'kp-generated', piece_id: 'UL-100', edition_number: 2, public_code: PUBLIC_CODE,
        plate_status: 'generated', amount: 1111, currency: 'USD',
      },
      artwork: {
        id: 'UL-100', title: 'Stale private draft title', series: 'Wrong series',
        edition_size: 7, buyer_email: 'private@example.com',
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      identity: {
        artworkId: 'UL-100',
        title: 'Art of Living - 32',
        series: 'Universal Language',
        edition: { kind: 'numbered', number: 2, size: 7, label: 'Edition 2 of 7' },
        publicCode: PUBLIC_CODE,
        artistName: 'Adrian Rasmussen',
        plateStatus: 'generated',
        publicProvenance: [],
        creatorHistory: [],
      },
    });
    assert.equal(calls.length, 3);
    assert.deepEqual(calls.map((call) => call.values), [
      [PUBLIC_CODE], ['UL-100'], ['kp-generated'],
    ]);
  });

  it('keeps canonical static title and null series when an overlay supplies mutable metadata', async () => {
    const { response } = await lookup({
      plate: {
        piece_id: 'SIG-108', edition_number: 0, public_code: PUBLIC_CODE,
        plate_status: 'active',
      },
      artwork: {
        id: 'SIG-108', title: 'Mutable overlay title',
        series: 'Mutable overlay series', edition_size: null,
      },
    });

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      identity: { title: string; series: string | null; edition: unknown; plateStatus: string };
    };
    assert.equal(payload.identity.title, 'Winged Spirit Wood');
    assert.equal(payload.identity.series, null);
    assert.deepEqual(payload.identity.edition, {
      kind: 'unique', number: null, size: null, label: 'Unique work',
    });
    assert.equal(payload.identity.plateStatus, 'active');
  });

  it('resolves a registry-only draft after its plate is generated', async () => {
    const { response } = await lookup({
      plate: {
        piece_id: 'MD-905', edition_number: 0, public_code: PUBLIC_CODE,
        plate_status: 'generated',
      },
      artwork: {
        id: 'MD-905', title: 'Unique Study', series: 'Studio Works', edition_size: null,
      },
    });

    assert.equal(response.status, 200);
    const payload = await response.json() as { identity: Record<string, unknown> };
    assert.equal(payload.identity.title, 'Unique Study');
    assert.equal(payload.identity.series, 'Studio Works');
    assert.deepEqual(payload.identity.publicProvenance, []);
  });

  it('supports a legacy numbered static plate with no known edition size', async () => {
    const { response } = await lookup({
      plate: {
        piece_id: 'UL-100', edition_number: 2, public_code: PUBLIC_CODE,
        plate_status: 'active',
      },
      artwork: null,
    });

    assert.equal(response.status, 200);
    const payload = await response.json() as { identity: { edition: unknown } };
    assert.deepEqual(payload.identity.edition, {
      kind: 'numbered', number: 2, size: null, label: 'Edition 2',
    });
  });

  it('fails closed when overlay edition metadata contradicts the issued instance', async () => {
    const { response } = await lookup({
      plate: {
        piece_id: 'UL-100', edition_number: 5, public_code: PUBLIC_CODE,
        plate_status: 'active',
      },
      artwork: { id: 'UL-100', title: 'Ignored', series: null, edition_size: 4 },
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { ok: false, error: 'identity_integrity_error' });
  });

  it('fails closed when the selected row does not match the requested public code', async () => {
    const { response } = await lookup({
      plate: {
        piece_id: 'UL-100', edition_number: 2, public_code: 'AR-ABCDEFGH',
        plate_status: 'active',
      },
      artwork: null,
    });
    assert.equal(response.status, 409);
  });

  it('returns only the exact public keys and never selects private registry fields', async () => {
    const { response, calls } = await lookup({
      plate: {
        piece_id: 'SIG-108', edition_number: 0, public_code: PUBLIC_CODE,
        plate_status: 'active', keeper_user_id: 'secret-user', amount: 4000,
        currency: 'USD', ownership_code_ciphertext: 'secret', recovery_code_hash: 'secret',
      },
      artwork: {
        id: 'SIG-108', title: 'Ignored', series: null, edition_size: null,
        steward_email: 'secret@example.com', evidence: 'secret',
      },
    });
    const payload = await response.json() as { identity: Record<string, unknown> };

    assert.deepEqual(Object.keys(payload).sort(), ['identity', 'ok']);
    assert.deepEqual(Object.keys(payload.identity).sort(), [
      'artistName', 'artworkId', 'creatorHistory', 'edition', 'plateStatus',
      'publicCode', 'publicProvenance', 'series', 'title',
    ]);
    assert.deepEqual(Object.keys(payload.identity.edition as object).sort(), ['kind', 'label', 'number', 'size']);
    const sql = calls.map((call) => call.sql).join('\n');
    assert.doesNotMatch(
      sql,
      /amount|currency|buyer|steward|keeper_user|ownership|envelope|verifier|recovery|audit|evidence/i,
    );
  });

  it('returns 404 for malformed, unknown, and non-issued codes', async () => {
    const malformed = await lookup({}, 'AR-I0O1BAD!');
    assert.equal(malformed.response.status, 404);
    assert.equal(malformed.calls.length, 0);

    const unknown = await lookup({ plate: null });
    assert.equal(unknown.response.status, 404);

    const draft = await lookup({ plate: {
      piece_id: 'UL-100', edition_number: 2, public_code: PUBLIC_CODE, plate_status: 'draft',
    } });
    assert.equal(draft.response.status, 404);
  });

  it('returns 503 when D1 or its schema is unavailable', async () => {
    const missing = await onRequest({
      request: request(), env: {}, params: { publicCode: PUBLIC_CODE },
    });
    assert.equal(missing.status, 503);

    const unavailable = await lookup({ error: new Error('D1 unavailable') });
    assert.equal(unavailable.response.status, 503);
    assert.deepEqual(await unavailable.response.json(), { ok: false, error: 'registry_unavailable' });

    const missingSchema = await lookup({ error: new Error('D1_ERROR: no such table: keeper_pieces') });
    assert.equal(missingSchema.response.status, 503);
  });

  it('allows only GET', async () => {
    const { response, calls } = await lookup({}, PUBLIC_CODE, 'POST');
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET');
    assert.equal(calls.length, 0);
  });
});
