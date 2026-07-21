import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildFindFileUrl,
  buildMediaUpdate,
  buildMultipartCreate,
  buildTokenRequest,
  isDriveSyncConfigured,
  syncLedgerToDrive,
} from '../functions/api/_lib/driveSync.js';

const configured = {
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  GOOGLE_DRIVE_REFRESH_TOKEN: 'refresh-token',
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
    async text() { return JSON.stringify(body); },
  };
}

describe('drive sync configuration gate', () => {
  it('is off unless all three credentials are present', () => {
    assert.equal(isDriveSyncConfigured(undefined), false);
    assert.equal(isDriveSyncConfigured({}), false);
    assert.equal(isDriveSyncConfigured({ GOOGLE_CLIENT_ID: 'a', GOOGLE_CLIENT_SECRET: 'b' }), false);
    assert.equal(isDriveSyncConfigured(configured), true);
  });
});

describe('drive request builders', () => {
  it('builds a refresh-token grant', () => {
    const req = buildTokenRequest(configured);
    assert.equal(req.url, 'https://oauth2.googleapis.com/token');
    assert.match(req.body, /grant_type=refresh_token/);
    assert.match(req.body, /refresh_token=refresh-token/);
    assert.match(req.body, /client_id=client-id/);
  });

  it('scopes the file lookup to the canonical name and optional folder', () => {
    const withoutFolder = buildFindFileUrl(configured);
    assert.match(decodeURIComponent(withoutFolder), /name = 'registry-ledger\.jsonl' and trashed = false/);
    assert.doesNotMatch(decodeURIComponent(withoutFolder), /in parents/);

    const withFolder = buildFindFileUrl({ ...configured, GOOGLE_DRIVE_FOLDER_ID: 'folder-123' });
    assert.match(decodeURIComponent(withFolder), /'folder-123' in parents/);
  });

  it('creates a multipart upload with metadata and media parts', () => {
    const op = buildMultipartCreate({ ...configured, GOOGLE_DRIVE_FOLDER_ID: 'folder-123' }, 'LEDGER-BODY');
    assert.equal(op.method, 'POST');
    assert.match(op.url, /uploadType=multipart/);
    assert.match(op.contentType, /multipart\/related; boundary=/);
    assert.match(op.body, /"name":"registry-ledger\.jsonl"/);
    assert.match(op.body, /"parents":\["folder-123"\]/);
    assert.match(op.body, /LEDGER-BODY/);
  });

  it('updates an existing file in place by id', () => {
    const op = buildMediaUpdate('file-abc', 'LEDGER-BODY');
    assert.equal(op.method, 'PATCH');
    assert.match(op.url, /files\/file-abc\?uploadType=media/);
    assert.equal(op.body, 'LEDGER-BODY');
  });
});

describe('drive sync orchestration', () => {
  it('returns not_configured without touching the network', async () => {
    let called = false;
    const result = await syncLedgerToDrive({}, 'body', (async () => { called = true; }) as unknown as typeof fetch);
    assert.deepEqual(result, { ok: false, reason: 'not_configured' });
    assert.equal(called, false);
  });

  it('refreshes a token, finds the file, and updates it in place', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init?: { method?: string }) => {
      calls.push(`${init?.method || 'GET'} ${url}`);
      if (url.includes('oauth2.googleapis.com/token')) return jsonResponse(200, { access_token: 'at-1' });
      if (url.startsWith('https://www.googleapis.com/drive/v3/files?')) return jsonResponse(200, { files: [{ id: 'file-abc' }] });
      if (url.includes('/upload/drive/v3/files/file-abc')) return jsonResponse(200, { id: 'file-abc', webViewLink: 'https://drive/x' });
      throw new Error(`unexpected ${url}`);
    }) as unknown as typeof fetch;

    const result = await syncLedgerToDrive(configured, 'LEDGER-BODY', fetchImpl);
    assert.deepEqual(result, { ok: true, fileId: 'file-abc', webViewLink: 'https://drive/x', updated: true });
    assert.equal(calls[0], 'POST https://oauth2.googleapis.com/token');
    assert.ok(calls.some((c) => c.startsWith('PATCH https://www.googleapis.com/upload/drive/v3/files/file-abc')));
  });

  it('creates the file when none exists yet', async () => {
    const fetchImpl = (async (url: string) => {
      if (url.includes('oauth2.googleapis.com/token')) return jsonResponse(200, { access_token: 'at-1' });
      if (url.startsWith('https://www.googleapis.com/drive/v3/files?')) return jsonResponse(200, { files: [] });
      if (url.includes('/upload/drive/v3/files?')) return jsonResponse(200, { id: 'file-new', webViewLink: null });
      throw new Error(`unexpected ${url}`);
    }) as unknown as typeof fetch;

    const result = await syncLedgerToDrive(configured, 'LEDGER-BODY', fetchImpl);
    assert.equal(result.ok, true);
    assert.equal(result.fileId, 'file-new');
    assert.equal(result.updated, false);
  });

  it('fails softly when the token cannot be refreshed', async () => {
    const fetchImpl = (async () => jsonResponse(401, { error: 'invalid_grant' })) as unknown as typeof fetch;
    const result = await syncLedgerToDrive(configured, 'body', fetchImpl);
    assert.deepEqual(result, { ok: false, reason: 'token_failed' });
  });
});
