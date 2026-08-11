import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, beforeEach, describe, it, mock } from 'node:test';

import {
  beginArtistSaleAttempt,
  finishArtistSaleAttempt,
  parseArtistSaleDetailResponse,
  parseArtistLedgerMediaResponse,
  parseArtistSaleMutationResponse,
  parseArtistSaleWorkspaceResponse,
  uploadArtistLedgerMedia,
  type CreateArtistSaleRequest,
} from '../utils/artistSales.ts';

const ORIGIN = 'https://adrianrasmussen.com';
const administrator = {
  userId: 'admin-user', email: 'artist@example.com',
  user: { id: 'admin-user', email: 'artist@example.com', emailVerified: true },
  session: { id: 'admin-session' },
};
let coreCalls: Array<{ operation: string; input: Record<string, unknown> }> = [];
let mediaStoreCalls = 0;
let detailSequence = 0;
let detailErrorCode: string | null = null;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

mock.module('../functions/api/_lib/admin.js', {
  namedExports: {
    jsonResponse,
    requireDb: (env: Record<string, unknown>) => env.DB
      ? null : jsonResponse({ ok: false, error: 'db_not_configured' }, 503),
    requireRegistryUnlock: async () => administrator,
  },
});

function operation(name: string, result: Record<string, unknown>) {
  return async (_env: unknown, input: Record<string, unknown>) => {
    coreCalls.push({ operation: name, input });
    return result;
  };
}

mock.module('../functions/api/_lib/artistSales.js', {
  namedExports: {
    createReconnectionCase: operation('createReconnectionCase', {
      reconnectionCaseId: 'case-one', recipientEmail: 'collector@example.com',
      status: 'open', replayed: false,
    }),
    createVerifiedSale: operation('createVerifiedSale', {
      saleId: 'sale-one', itemIds: ['item-one'], artworkRecordIds: ['record-one'],
      priceEntryIds: [], replayed: false,
    }),
    listArtistSaleWorkspace: async (_env: unknown, input: Record<string, unknown>) => {
      coreCalls.push({ operation: 'listArtistSaleWorkspace', input });
      return { sales: [], reconnectionCases: [], pagination: {
        limit: 25, offset: 0,
        sales: { hasMore: false, nextOffset: null },
        reconnectionCases: { hasMore: false, nextOffset: null },
      } };
    },
    getArtistSaleDetail: async (_env: unknown, saleId: string) => {
      coreCalls.push({ operation: 'getArtistSaleDetail', input: { saleId } });
      if (detailErrorCode) throw Object.assign(new Error('private detail failure'), {
        code: detailErrorCode,
      });
      const sale = {
        saleId, reconnectionCaseId: 'case-one',
        occurrence: { precision: 'year', value: '2020' },
        buyerEmail: 'collector@example.com', total: null,
        privateReference: null, privateNotes: null,
        recordedAt: '2026-08-10T00:00:00.000Z', sequence: detailSequence,
      };
      return {
        sale, originalSale: { ...sale, sequence: 0 }, effectiveSale: sale,
        corrections: [], items: [], events: [],
      };
    },
    appendReconnectionEvent: operation('appendReconnectionEvent', {
      reconnectionEventId: 'event-one', eventType: 'email_sent', replayed: false,
    }),
    correctVerifiedSale: operation('correctVerifiedSale', {
      saleEventId: 'event-one', saleId: 'sale-one', sequence: 1,
      reason: 'Correction', replayed: false,
    }),
    identifyArtworkRecord: operation('identifyArtworkRecord', {
      artworkRecordId: 'record-one', identificationStatus: 'identified',
      artworkId: 'UL-100', edition: { kind: 'unique', number: null, size: null },
      keeperPieceId: null, recordVersion: 2, replayed: false,
    }),
    linkArtworkIdentity: operation('linkArtworkIdentity', {
      artworkRecordId: 'record-one', identificationStatus: 'identity_linked',
      artworkId: 'UL-100', edition: { kind: 'unique', number: null, size: null },
      keeperPieceId: 'keeper-one', recordVersion: 3, replayed: false,
    }),
    appendArtworkLedgerEntry: operation('appendArtworkLedgerEntry', {
      ledgerEntryId: 'ledger-one', artworkRecordId: 'record-one', saleId: null,
      message: null, mediaId: 'media-one', replayed: false,
    }),
    appendSharedSaleMessage: operation('appendSharedSaleMessage', {
      saleEventId: 'event-one', saleId: 'sale-one', sequence: 1,
      entries: [{ ledgerEntryId: 'ledger-one', artworkRecordId: 'record-one' }],
      replayed: false,
    }),
  },
});

mock.module('../functions/api/_lib/artworkLedgerMedia.js', {
  namedExports: {
    storeArtworkLedgerMedia: async (_bucket: unknown, input: Record<string, unknown>) => {
      mediaStoreCalls += 1;
      const reader = (input.source as ReadableStream<Uint8Array>).getReader();
      const chunks: number[] = [];
      while (true) {
        const read = await reader.read();
        if (read.done) break;
        chunks.push(...read.value);
      }
      const seed = chunks.map((byte) => byte.toString(16).padStart(2, '0')).join('') || '00';
      const sha256 = seed.repeat(Math.ceil(64 / seed.length)).slice(0, 64);
      return {
        reference: `artwork-ledger/${String(input.artworkRecordId)}/${sha256}.png`,
        sha256, contentType: input.contentType, byteLength: chunks.length,
      };
    },
  },
});

beforeEach(() => {
  coreCalls = []; mediaStoreCalls = 0; detailSequence = 0; detailErrorCode = null;
});
after(() => mock.reset());

describe('artist sales frozen client attempts', () => {
  const input: Omit<CreateArtistSaleRequest, 'idempotencyKey'> = {
    action: 'createSale',
    occurrence: { precision: 'exact', value: '2026-08-10' },
    buyerEmail: 'collector@example.com',
    total: { amountMinor: 120_000, currency: 'USD' },
    privateReference: null,
    privateNotes: null,
    reconnectionCaseId: null,
    artworks: [
      { artworkRecordId: null, artworkId: 'SIG-100', edition: { kind: 'unique' }, price: null },
    ],
  };

  it('freezes an exact body and key across ambiguous retries', () => {
    const originalRandomUUID = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => 'retry-key' });
    try {
      const first = beginArtistSaleAttempt(null, input);
      const retry = beginArtistSaleAttempt(first, { ...input, buyerEmail: 'changed@example.com' });
      assert.equal(first, retry);
      assert.equal(first.request.idempotencyKey, 'retry-key');
      assert.equal(first.request.buyerEmail, 'collector@example.com');
      assert.equal(finishArtistSaleAttempt(first, { kind: 'network_error' }), first);
      assert.equal(finishArtistSaleAttempt(first, { kind: 'http', status: 503 }), first);
      assert.equal(finishArtistSaleAttempt(first, { kind: 'http', status: 409 }), null);
      assert.equal(finishArtistSaleAttempt(first, { kind: 'success' }), null);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: originalRandomUUID });
    }
  });

  it('rejects response extras and private storage fields', () => {
    const valid = {
      ok: true,
      result: {
        saleId: 'sale-1', itemIds: ['item-1'], artworkRecordIds: ['record-1'],
        priceEntryIds: [], replayed: false,
      },
    };
    assert.deepEqual(parseArtistSaleMutationResponse(valid), valid);
    assert.throws(() => parseArtistSaleMutationResponse({
      ...valid,
      storage_reference: 'artwork-ledger/private/file.jpg',
    }));
    assert.throws(() => parseArtistSaleMutationResponse({ ...valid, extra: true }));
  });

  it('strictly parses workspace pagination and nested sale values', () => {
    const response = {
      ok: true,
      sales: [{
        saleId: 'sale-1', reconnectionCaseId: null,
        occurrence: { precision: 'unknown', value: null }, buyerEmail: null, total: null,
        privateReference: null, privateNotes: null, recordedAt: '2026-08-10T00:00:00.000Z',
        sequence: 0, identificationStatuses: ['unresolved'],
      }],
      reconnectionCases: [],
      pagination: {
        limit: 25, offset: 0,
        sales: { hasMore: false, nextOffset: null },
        reconnectionCases: { hasMore: false, nextOffset: null },
      },
    };
    assert.deepEqual(parseArtistSaleWorkspaceResponse(response), response);
    assert.throws(() => parseArtistSaleWorkspaceResponse({
      ...response,
      sales: [{ ...response.sales[0], verifiedByUserId: 'private-user' }],
    }));
  });

  it('requires normalized non-null recipient emails in reconnection responses', () => {
    const workspace = {
      ok: true,
      sales: [],
      reconnectionCases: [{
        reconnectionCaseId: 'case-1', recipientEmail: 'collector@example.com',
        recipientName: null, privateContext: null, status: 'open',
        createdAt: '2026-08-10T00:00:00.000Z',
      }],
      pagination: {
        limit: 25, offset: 0,
        sales: { hasMore: false, nextOffset: null },
        reconnectionCases: { hasMore: false, nextOffset: null },
      },
    };
    const mutation = {
      ok: true,
      result: {
        reconnectionCaseId: 'case-1', recipientEmail: 'collector@example.com',
        status: 'open', replayed: false,
      },
    };
    assert.deepEqual(parseArtistSaleWorkspaceResponse(workspace), workspace);
    assert.deepEqual(parseArtistSaleMutationResponse(mutation), mutation);

    for (const recipientEmail of [
      null, 'Collector@example.com', ' collector@example.com',
      'collector@example.com ', 'collector-at-example.com',
    ]) {
      assert.throws(() => parseArtistSaleWorkspaceResponse({
        ...workspace,
        reconnectionCases: [{ ...workspace.reconnectionCases[0], recipientEmail }],
      }));
      assert.throws(() => parseArtistSaleMutationResponse({
        ...mutation, result: { ...mutation.result, recipientEmail },
      }));
    }
    assert.throws(() => parseArtistSaleWorkspaceResponse({
      ...workspace,
      reconnectionCases: [{ ...workspace.reconnectionCases[0], extra: true }],
    }));
    assert.throws(() => parseArtistSaleMutationResponse({
      ...mutation, result: { ...mutation.result, extra: true },
    }));
  });

  it('strictly parses immutable and effective sale facts without private correction fields', () => {
    const originalSale = {
      saleId: 'sale-1', reconnectionCaseId: null,
      occurrence: { precision: 'year', value: '2018' },
      buyerEmail: 'collector@example.com', total: { amountMinor: 900000, currency: 'USD' },
      privateReference: 'ledger-2018', privateNotes: null,
      recordedAt: '2026-08-10T00:00:00.000Z', sequence: 0,
    };
    const before = {
      reconnectionCaseId: null, occurrence: originalSale.occurrence,
      buyerEmail: originalSale.buyerEmail, total: originalSale.total,
      privateReference: originalSale.privateReference, privateNotes: null,
      recordedAt: originalSale.recordedAt,
    };
    const after = {
      ...before, occurrence: { precision: 'year', value: '2019' },
      privateReference: 'corrected-ledger',
    };
    const effectiveSale = { saleId: 'sale-1', ...after, sequence: 1 };
    const correction = {
      saleEventId: 'event-1', sequence: 1, reason: 'Corrected transcription.',
      createdAt: '2026-08-10T01:00:00.000Z', before, after,
    };
    const response = {
      ok: true, sale: effectiveSale, originalSale, effectiveSale,
      corrections: [correction], items: [], events: [{
        saleEventId: 'event-1', sequence: 1, eventType: 'corrected',
        reason: correction.reason, createdAt: correction.createdAt,
      }],
    };
    assert.deepEqual(parseArtistSaleDetailResponse(response), response);
    for (const invalid of [
      { ...response, originalSale: undefined },
      { ...response, corrections: [{ ...correction, actorUserId: 'admin-user' }] },
      { ...response, corrections: [{ ...correction, before: { ...before, requestDigest: 'private' } }] },
      { ...response, corrections: [{
        ...correction, before: { ...before, buyerEmail: 'other@example.com' },
      }] },
      { ...response, effectiveSale: { ...effectiveSale, storageReference: 'private/key' } },
      { ...response, sale: { ...effectiveSale, privateReference: 'different' } },
    ]) assert.throws(() => parseArtistSaleDetailResponse(invalid));
  });

  it('uploads a raw blob with private metadata only in exact headers', async () => {
    const file = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    let captured: [RequestInfo | URL, RequestInit | undefined] | null = null;
    const fetcher: typeof fetch = async (url, init) => {
      captured = [url, init];
      return new Response(JSON.stringify({
        media: {
          id: 'media-1', artworkRecordId: 'record-1', role: 'certificate_image',
          contentType: 'image/png', byteLength: 3, createdAt: '2026-08-10T00:00:00.000Z',
        },
        replayed: false,
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    };
    const result = await uploadArtistLedgerMedia({
      artworkRecordId: 'record-1', role: 'certificate_image',
      idempotencyKey: 'upload-1', file,
    }, fetcher);
    assert.equal(result.media.id, 'media-1');
    assert.ok(captured);
    const [url, init] = captured;
    assert.equal(url, '/api/admin/collector-ledger/media');
    assert.equal(init?.body, file);
    assert.equal((init?.headers as Record<string, string>)['X-Content-Length'], '3');
    assert.equal(Object.hasOwn(init?.headers as object, 'Content-Length'), false);
    assert.doesNotMatch(String(url), /record-1|certificate_image|upload-1/);
  });

  it('rejects media response hashes or storage references outside its allowlist', () => {
    const response = {
      media: {
        id: 'media-1', artworkRecordId: 'record-1', role: 'certificate_image',
        contentType: 'image/webp', byteLength: 42, createdAt: '2026-08-10T00:00:00.000Z',
      },
      replayed: true,
    };
    assert.deepEqual(parseArtistLedgerMediaResponse(response), response);
    assert.throws(() => parseArtistLedgerMediaResponse({
      ...response,
      media: { ...response.media, storage_reference: 'private/key.webp' },
    }));
    assert.throws(() => parseArtistLedgerMediaResponse({
      ...response,
      media: { ...response.media, sha256: 'a'.repeat(64) },
    }));
  });
});

describe('private artist sales route modules', () => {
  it('exposes the four Cloudflare route handlers', async () => {
    const modules = await Promise.all([
      import('../functions/api/admin/collector-sales.js'),
      import('../functions/api/admin/collector-sales/[id].js'),
      import('../functions/api/admin/collector-ledger.js'),
      import('../functions/api/admin/collector-ledger/media.js'),
    ]);
    for (const route of modules) assert.equal(typeof route.onRequest, 'function');
    assert.equal(typeof modules[1].resolveReconnectionCaseId, 'function');
    assert.equal(typeof modules[3].mediaIdentityId, 'function');
    const first = await modules[3].mediaIdentityId('admin-one', 'upload-key');
    assert.equal(await modules[3].mediaIdentityId('admin-one', 'upload-key'), first);
    assert.notEqual(await modules[3].mediaIdentityId('admin-two', 'upload-key'), first);
    assert.notEqual(await modules[3].mediaIdentityId('admin-one', 'other-key'), first);
  });

  it('accepts one exact reconnection selector and rejects mixed or duplicate selectors', async () => {
    const sales = await import('../functions/api/admin/collector-sales.js');
    const invoke = (query: string) => sales.onRequest({
      request: new Request(`${ORIGIN}/api/admin/collector-sales${query}`), env: { DB: {} },
    });
    const exact = await invoke('?reconnectionCaseId=case-one');
    assert.equal(exact.status, 200);
    assert.deepEqual(coreCalls.at(-1), {
      operation: 'listArtistSaleWorkspace', input: { reconnectionCaseId: 'case-one' },
    });
    for (const query of [
      '?reconnectionCaseId=case-one&limit=1',
      '?reconnectionCaseId=case-one&reconnectionCaseId=case-two',
      '?reconnectionCaseId=bad.id',
    ]) assert.equal((await invoke(query)).status, 400, query);
  });

  it('returns the explicit original/effective detail allowlist and fails corrupt chains closed', async () => {
    const detail = await import('../functions/api/admin/collector-sales/[id].js');
    const invoke = () => detail.onRequest({
      request: new Request(`${ORIGIN}/api/admin/collector-sales/sale-one`),
      env: { DB: {} }, params: { id: 'sale-one' },
    });
    const response = await invoke();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const body = await response.json() as Record<string, any>;
    assert.deepEqual(Object.keys(body).sort(), [
      'corrections', 'effectiveSale', 'events', 'items', 'ok', 'originalSale', 'sale',
    ]);
    assert.deepEqual(body.sale, body.effectiveSale);
    assert.equal(body.originalSale.sequence, 0);
    assert.doesNotMatch(JSON.stringify(body),
      /actorUserId|verifiedByUserId|requestDigest|storageReference|sha256/);

    detailErrorCode = 'integrity_error';
    const corrupt = await invoke();
    assert.equal(corrupt.status, 503);
    assert.deepEqual(await corrupt.json(), { ok: false, error: 'integrity_error' });
    assert.equal(corrupt.headers.get('Cache-Control'), 'no-store');
  });

  it('keeps uploads raw-streamed and private response projections explicit', () => {
    const media = readFileSync(new URL(
      '../functions/api/admin/collector-ledger/media.js', import.meta.url,
    ), 'utf8');
    assert.doesNotMatch(media, /\.formData\s*\(|\.arrayBuffer\s*\(/);
    assert.match(media, /source:\s*request\.body/);
    assert.match(media, /X-Content-Length/);
    assert.doesNotMatch(media, /console\.(?:log|error|warn)/);

    const sales = readFileSync(new URL(
      '../functions/api/admin/collector-sales.js', import.meta.url,
    ), 'utf8');
    assert.match(sales, /safeDetail/);
    assert.match(sales, /safeMutationResult/);
    assert.doesNotMatch(sales.slice(sales.indexOf('export function safeDetail')),
      /storageReference:\s*entry\.media\.storageReference/);
    assert.doesNotMatch(sales.slice(sales.indexOf('export function safeLedgerEntry')),
      /sha256:\s*entry\.media\.sha256/);

    const ledger = readFileSync(new URL(
      '../functions/api/admin/collector-ledger.js', import.meta.url,
    ), 'utf8');
    assert.doesNotMatch(ledger, /media\.sha256|sha256:\s*item\.sha256/);

    const client = readFileSync(new URL('../utils/artistSales.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(client, /sha256/);
  });

  it('rejects undocumented query strings on every non-filter route', () => {
    const files = [
      '../functions/api/admin/collector-sales.js',
      '../functions/api/admin/collector-sales/[id].js',
      '../functions/api/admin/collector-ledger.js',
      '../functions/api/admin/collector-ledger/media.js',
    ];
    for (const file of files) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      assert.match(source, /rejectUnexpectedSearch|requireZeroSearchParams/, file);
    }
  });

  it('returns 400 for arbitrary queries before any private write', async () => {
    const [sales, detail, ledger, media] = await Promise.all([
      import('../functions/api/admin/collector-sales.js'),
      import('../functions/api/admin/collector-sales/[id].js'),
      import('../functions/api/admin/collector-ledger.js'),
      import('../functions/api/admin/collector-ledger/media.js'),
    ]);
    const cases = [
      [sales.onRequest, '/api/admin/collector-sales?actor=spoofed', {}, 'POST'],
      [detail.onRequest, '/api/admin/collector-sales/sale-one?case=other', { id: 'sale-one' }, 'GET'],
      [ledger.onRequest, '/api/admin/collector-ledger?artworkRecordId=record-one&extra=1', {}, 'GET'],
      [media.onRequest, '/api/admin/collector-ledger/media?role=certificate_image', {}, 'POST'],
    ] as const;
    for (const [handler, path, params, method] of cases) {
      const response = await handler({
        request: new Request(`${ORIGIN}${path}`, { method }),
        env: { DB: {}, ARTWORK_REGISTRY_BACKUP: {} }, params,
      });
      assert.equal(response.status, 400, path);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
    assert.equal(coreCalls.length, 0);
    assert.equal(mediaStoreCalls, 0);
  });

  it('derives reconnection context from a sale or an email-only case and rejects body overrides', async () => {
    const detail = await import('../functions/api/admin/collector-sales/[id].js');
    const database = (saleCase: string | null | undefined, directCases: string[] = []) => ({
      prepare(sql: string) {
        let value = '';
        return {
          bind(bound: string) { value = bound; return this; },
          async first() {
            if (sql.includes('artist_verified_sales')) {
              return saleCase === undefined ? null : { reconnection_case_id: saleCase };
            }
            if (sql.includes('artist_reconnection_cases') && directCases.includes(value)) {
              return { id: value };
            }
            return null;
          },
        };
      },
    });
    const invoke = (pathId: string, body: unknown, DB: unknown) => detail.onRequest({
      request: new Request(`${ORIGIN}/api/admin/collector-sales/${pathId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
        body: JSON.stringify(body),
      }),
      env: { DB }, params: { id: pathId },
    });

    const sale = await invoke('sale-one', {
      action: 'recordReconnectionEmail', note: null, idempotencyKey: 'email-sale',
    }, database('case-one'));
    assert.equal(sale.status, 201);
    assert.equal(coreCalls.at(-1)?.input.reconnectionCaseId, 'case-one');
    assert.equal(coreCalls.at(-1)?.input.privateNote, null);

    const emailOnly = await invoke('case-email-only', {
      action: 'addReconnectionNote', note: 'Called the gallery.', idempotencyKey: 'case-note',
    }, database(undefined, ['case-email-only']));
    assert.equal(emailOnly.status, 201);
    assert.equal(coreCalls.at(-1)?.input.reconnectionCaseId, 'case-email-only');

    const before = coreCalls.length;
    const override = await invoke('sale-one', {
      action: 'recordReconnectionEmail', reconnectionCaseId: 'case-other',
      note: null, idempotencyKey: 'cross-case',
    }, database('case-one'));
    assert.equal(override.status, 400);
    assert.equal(coreCalls.length, before);

    const unassociated = await invoke('sale-one', {
      action: 'recordReconnectionEmail', note: null, idempotencyKey: 'no-case',
    }, database(null));
    assert.equal(unassociated.status, 400);
    assert.equal(coreCalls.length, before);
  });

  it('derives fresh server time and shared sequence without changing replay business bodies', async () => {
    const [sales, detail, ledger] = await Promise.all([
      import('../functions/api/admin/collector-sales.js'),
      import('../functions/api/admin/collector-sales/[id].js'),
      import('../functions/api/admin/collector-ledger.js'),
    ]);
    const NativeDate = Date;
    let current = Date.parse('2026-08-10T00:00:00.000Z');
    class ControlledDate extends NativeDate {
      constructor(value?: string | number) { super(value === undefined ? current : value); }
      static now() { return current; }
    }
    globalThis.Date = ControlledDate as DateConstructor;
    const post = (path: string, body: unknown) => new Request(`${ORIGIN}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify(body),
    });
    const pathDb = {
      prepare(sql: string) {
        return {
          bind() { return this; },
          async first() {
            return sql.includes('artist_verified_sales')
              ? { reconnection_case_id: 'case-one' } : null;
          },
        };
      },
    };
    try {
      const createBody = {
        action: 'createReconnection', recipientEmail: 'collector@example.com',
        recipientName: null, privateContext: null, idempotencyKey: 'case-retry',
      };
      await sales.onRequest({ request: post('/api/admin/collector-sales', createBody), env: { DB: {} } });
      current += 1_000;
      await sales.onRequest({ request: post('/api/admin/collector-sales', createBody), env: { DB: {} } });
      const caseInputs = coreCalls.filter((call) => call.operation === 'createReconnectionCase');
      assert.equal(caseInputs[0].input.createdAt, '2026-08-10T00:00:00.000Z');
      assert.equal(caseInputs[1].input.createdAt, '2026-08-10T00:00:01.000Z');

      const eventBody = { action: 'recordReconnectionEmail', note: null, idempotencyKey: 'email-retry' };
      await detail.onRequest({
        request: post('/api/admin/collector-sales/sale-one', eventBody),
        env: { DB: pathDb }, params: { id: 'sale-one' },
      });
      current += 1_000;
      await detail.onRequest({
        request: post('/api/admin/collector-sales/sale-one', eventBody),
        env: { DB: pathDb }, params: { id: 'sale-one' },
      });
      const eventInputs = coreCalls.filter((call) => call.operation === 'appendReconnectionEvent');
      assert.notEqual(eventInputs[0].input.createdAt, eventInputs[1].input.createdAt);
      assert.equal(eventInputs[1].input.privateNote, null);

      const sharedBody = {
        action: 'appendSharedSaleMessage', saleId: 'sale-one',
        artworkRecordIds: ['record-one'], message: 'Shared note.', idempotencyKey: 'shared-retry',
      };
      detailSequence = 0;
      await ledger.onRequest({ request: post('/api/admin/collector-ledger', sharedBody), env: { DB: {} } });
      current += 1_000;
      detailSequence = 1;
      await ledger.onRequest({ request: post('/api/admin/collector-ledger', sharedBody), env: { DB: {} } });
      const sharedInputs = coreCalls.filter((call) => call.operation === 'appendSharedSaleMessage');
      assert.equal(sharedInputs[0].input.expectedSequence, 0);
      assert.equal(sharedInputs[1].input.expectedSequence, 1);
      assert.notEqual(sharedInputs[0].input.createdAt, sharedInputs[1].input.createdAt);
      assert.deepEqual(
        { ...sharedInputs[0].input, expectedSequence: 1, createdAt: sharedInputs[1].input.createdAt },
        sharedInputs[1].input,
      );
    } finally {
      globalThis.Date = NativeDate;
    }
  });

  it('uses one media row per actor and key, preconflicts headers, and conflicts changed bytes', async () => {
    const mediaRoute = await import('../functions/api/admin/collector-ledger/media.js');
    type Row = Record<string, unknown>;
    let row: Row | null = null;
    const artworks = new Set(['record-one', 'record-two']);
    const DB = {
      prepare(sql: string) {
        let values: unknown[] = [];
        return {
          bind(...bound: unknown[]) { values = bound; return this; },
          async first() {
            if (sql.includes('FROM artist_artwork_media WHERE id')) {
              return row?.id === values[0] ? row : null;
            }
            if (sql.includes('WHERE id = ?1 OR storage_reference')) {
              return row && (row.id === values[0] || row.storage_reference === values[1]) ? row : null;
            }
            if (sql.includes('FROM artist_artwork_records')) {
              return artworks.has(String(values[0])) ? { id: values[0] } : null;
            }
            return null;
          },
          async run() {
            row = {
              id: values[0], artwork_record_id: values[1], media_role: values[2],
              storage_reference: values[3], sha256: values[4], content_type: values[5],
              byte_length: values[6], uploaded_by_user_id: values[7], created_at: values[8],
            };
            return { success: true, meta: { changes: 1 } };
          },
        };
      },
    };
    const upload = (bytes: number[], overrides: Record<string, string> = {}) => mediaRoute.onRequest({
      request: new Request(`${ORIGIN}/api/admin/collector-ledger/media`, {
        method: 'POST',
        headers: {
          Origin: ORIGIN, 'Content-Type': 'image/png',
          'X-Content-Length': String(bytes.length),
          'X-Artwork-Record-Id': 'record-one',
          'X-Artwork-Media-Role': 'certificate_image',
          'X-Idempotency-Key': 'stable-upload', ...overrides,
        },
        body: new Uint8Array(bytes),
      }),
      env: { DB, ARTWORK_REGISTRY_BACKUP: {} },
    });

    const created = await upload([1, 2, 3]);
    assert.equal(created.status, 201);
    const mediaId = (await created.json()).media.id;
    assert.equal(mediaStoreCalls, 1);
    const replay = await upload([1, 2, 3]);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).media.id, mediaId);
    assert.equal(mediaStoreCalls, 2);

    for (const headers of [
      { 'X-Artwork-Record-Id': 'record-two' },
      { 'X-Artwork-Media-Role': 'identification_evidence' },
      { 'Content-Type': 'image/webp' },
    ]) {
      const conflict = await upload([1, 2, 3], headers);
      assert.equal(conflict.status, 409);
      assert.deepEqual(await conflict.json(), { ok: false, error: 'idempotency_conflict' });
    }
    assert.equal(mediaStoreCalls, 2);

    const changedBytes = await upload([9, 9, 9]);
    assert.equal(changedBytes.status, 409);
    assert.equal(mediaStoreCalls, 3);
    assert.equal(row?.id, mediaId);
  });

  it('fails closed on thrown or malformed media metadata lookups before R2 work', async () => {
    const mediaRoute = await import('../functions/api/admin/collector-ledger/media.js');
    const upload = (DB: unknown) => mediaRoute.onRequest({
      request: new Request(`${ORIGIN}/api/admin/collector-ledger/media`, {
        method: 'POST',
        headers: {
          Origin: ORIGIN, 'Content-Type': 'image/png', 'X-Content-Length': '3',
          'X-Artwork-Record-Id': 'record-one',
          'X-Artwork-Media-Role': 'certificate_image',
          'X-Idempotency-Key': 'metadata-lookup',
        },
        body: new Uint8Array([1, 2, 3]),
      }),
      env: { DB, ARTWORK_REGISTRY_BACKUP: {} },
    });
    const database = ({ media, artwork }: {
      media: () => unknown | Promise<unknown>;
      artwork: () => unknown | Promise<unknown>;
    }) => ({
      prepare(sql: string) {
        return {
          bind() { return this; },
          first: sql.includes('artist_artwork_media') ? media : artwork,
          async run() { throw new Error('insert must not run'); },
        };
      },
    });
    const cases = [
      database({
        media: async () => { throw new Error('private media lookup failure'); },
        artwork: async () => ({ id: 'record-one' }),
      }),
      database({ media: async () => ({ id: 'malformed' }), artwork: async () => ({ id: 'record-one' }) }),
      database({
        media: async () => null,
        artwork: async () => { throw new Error('private artwork lookup failure'); },
      }),
      database({ media: async () => null, artwork: async () => ({}) }),
    ];

    for (const DB of cases) {
      mediaStoreCalls = 0;
      const response = await upload(DB);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.deepEqual(await response.json(), { ok: false, error: 'media_metadata_failed' });
      assert.equal(mediaStoreCalls, 0);
    }
  });

  it('requires one confirmed D1 metadata change and safely resolves insert races', async () => {
    const mediaRoute = await import('../functions/api/admin/collector-ledger/media.js');
    type RunnerResult = unknown | 'throw';
    type Reread = 'exact' | 'changed' | 'missing' | 'malformed' | 'throw';
    const database = (runnerResult: RunnerResult, reread: Reread) => {
      let insertValues: unknown[] | null = null;
      let mediaReads = 0;
      const stored = () => {
        assert.ok(insertValues);
        return {
          id: insertValues[0], artwork_record_id: insertValues[1], media_role: insertValues[2],
          storage_reference: insertValues[3], sha256: insertValues[4],
          content_type: insertValues[5], byte_length: insertValues[6],
          uploaded_by_user_id: insertValues[7], created_at: insertValues[8],
        };
      };
      return {
        prepare(sql: string) {
          let values: unknown[] = [];
          return {
            bind(...bound: unknown[]) { values = bound; return this; },
            async first() {
              if (sql.includes('artist_artwork_media')) {
                mediaReads += 1;
                if (mediaReads <= 2) return null;
                if (reread === 'throw') throw new Error('private reread failure');
                if (reread === 'missing') return null;
                if (reread === 'malformed') return { id: insertValues?.[0] };
                const row = stored();
                return reread === 'changed' ? { ...row, media_role: 'identification_evidence' } : row;
              }
              if (sql.includes('artist_artwork_records')) return { id: values[0] };
              return null;
            },
            async run() {
              insertValues = values;
              if (runnerResult === 'throw') throw new Error('private insert constraint');
              return runnerResult;
            },
          };
        },
      };
    };
    const upload = (DB: unknown, key: string) => mediaRoute.onRequest({
      request: new Request(`${ORIGIN}/api/admin/collector-ledger/media`, {
        method: 'POST',
        headers: {
          Origin: ORIGIN, 'Content-Type': 'image/png', 'X-Content-Length': '3',
          'X-Artwork-Record-Id': 'record-one',
          'X-Artwork-Media-Role': 'certificate_image', 'X-Idempotency-Key': key,
        },
        body: new Uint8Array([1, 2, 3]),
      }),
      env: { DB, ARTWORK_REGISTRY_BACKUP: {} },
    });

    const permissiveResults = [
      undefined, null, true, {}, { success: false, meta: { changes: 1 } },
      { success: true }, { success: true, meta: {} },
      { success: true, meta: { changes: 0 } }, { success: true, meta: { changes: 2 } },
    ];
    for (const [index, result] of permissiveResults.entries()) {
      const response = await upload(database(result, 'missing'), `invalid-runner-${index}`);
      assert.equal(response.status, 503, JSON.stringify(result));
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.deepEqual(await response.json(), { ok: false, error: 'media_metadata_failed' });
    }

    const created = await upload(
      database({ success: true, meta: { changes: 1 } }, 'missing'),
      'confirmed-insert',
    );
    assert.equal(created.status, 201);
    assert.equal((await created.json()).replayed, false);

    for (const runnerResult of [{ success: true, meta: { changes: 0 } }, 'throw'] as const) {
      const replay = await upload(database(runnerResult, 'exact'), `race-${String(runnerResult)}`);
      assert.equal(replay.status, 200);
      const body = await replay.json();
      assert.equal(body.replayed, true);
      assert.equal(Object.hasOwn(body.media, 'storage_reference'), false);
      assert.equal(Object.hasOwn(body.media, 'sha256'), false);
    }

    for (const reread of ['changed', 'missing', 'malformed', 'throw'] as const) {
      const response = await upload(database('throw', reread), `reread-${reread}`);
      const expectedStatus = reread === 'changed' ? 409 : 503;
      const expectedError = reread === 'changed' ? 'idempotency_conflict' : 'media_metadata_failed';
      assert.equal(response.status, expectedStatus, reread);
      const body = await response.json();
      assert.deepEqual(body, { ok: false, error: expectedError });
      assert.doesNotMatch(JSON.stringify(body), /storage_reference|sha256|private/);
    }
  });

  it('resolves duplicate content under distinct keys as definitive private conflicts', async () => {
    const mediaRoute = await import('../functions/api/admin/collector-ledger/media.js');
    type Row = Record<string, unknown>;
    const database = () => {
      const byId = new Map<unknown, Row>();
      const byReference = new Map<unknown, Row>();
      let referenceRead: 'normal' | 'throw' | 'malformed' = 'normal';
      return {
        setReferenceRead(value: typeof referenceRead) { referenceRead = value; },
        rowCount() { return byId.size; },
        prepare(sql: string) {
          let values: unknown[] = [];
          return {
            bind(...bound: unknown[]) { values = bound; return this; },
            async first() {
              if (sql.includes('FROM artist_artwork_media') && sql.includes('WHERE id = ?1')) {
                return byId.get(values[0]) || null;
              }
              if (sql.includes('FROM artist_artwork_media')
                && sql.includes('WHERE storage_reference = ?1')) {
                assert.doesNotMatch(sql, /SELECT\s+\*/i);
                assert.doesNotMatch(sql, /artwork-ledger\//);
                if (referenceRead === 'throw') throw new Error('private reference read failure');
                if (referenceRead === 'malformed') return { id: 'malformed-row' };
                return byReference.get(values[0]) || null;
              }
              if (sql.includes('FROM artist_artwork_records')) return { id: values[0] };
              return null;
            },
            async run() {
              const row = {
                id: values[0], artwork_record_id: values[1], media_role: values[2],
                storage_reference: values[3], sha256: values[4], content_type: values[5],
                byte_length: values[6], uploaded_by_user_id: values[7], created_at: values[8],
              };
              if (byReference.has(row.storage_reference)) {
                throw new Error('UNIQUE constraint failed: artist_artwork_media.storage_reference');
              }
              byId.set(row.id, row);
              byReference.set(row.storage_reference, row);
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    };
    const upload = (
      DB: ReturnType<typeof database>, key: string,
      role = 'certificate_image',
    ) => mediaRoute.onRequest({
      request: new Request(`${ORIGIN}/api/admin/collector-ledger/media`, {
        method: 'POST',
        headers: {
          Origin: ORIGIN, 'Content-Type': 'image/png', 'X-Content-Length': '3',
          'X-Artwork-Record-Id': 'record-one', 'X-Artwork-Media-Role': role,
          'X-Idempotency-Key': key,
        },
        body: new Uint8Array([1, 2, 3]),
      }),
      env: { DB, ARTWORK_REGISTRY_BACKUP: {} },
    });
    const assertConflict = async (response: Response) => {
      assert.equal(response.status, 409);
      const body = await response.json();
      assert.deepEqual(body, { ok: false, error: 'idempotency_conflict' });
      assert.doesNotMatch(JSON.stringify(body), /storage_reference|sha256|artwork-ledger/);
    };

    const DB = database();
    assert.equal((await upload(DB, 'first-key')).status, 201);
    const exactReplay = await upload(DB, 'first-key');
    assert.equal(exactReplay.status, 200);
    assert.equal((await exactReplay.json()).replayed, true);

    await assertConflict(await upload(DB, 'distinct-key'));
    await assertConflict(await upload(DB, 'distinct-key'));
    await assertConflict(await upload(DB, 'changed-role-key', 'identification_evidence'));
    assert.equal(DB.rowCount(), 1);

    for (const referenceRead of ['throw', 'malformed'] as const) {
      const failingDb = database();
      assert.equal((await upload(failingDb, `seed-${referenceRead}`)).status, 201);
      failingDb.setReferenceRead(referenceRead);
      const response = await upload(failingDb, `duplicate-${referenceRead}`);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { ok: false, error: 'media_metadata_failed' });
      assert.equal(failingDb.rowCount(), 1);
    }
  });
});
