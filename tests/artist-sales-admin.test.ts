import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  beginArtistSaleAttempt,
  finishArtistSaleAttempt,
  parseArtistLedgerMediaResponse,
  parseArtistSaleMutationResponse,
  parseArtistSaleWorkspaceResponse,
  uploadArtistLedgerMedia,
  type CreateArtistSaleRequest,
} from '../utils/artistSales.ts';

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
  });
});
