/**
 * The two breaks that stopped the collector journey end to end, measured by
 * walking it on 2026-09-02.
 *
 * 1. Nobody could claim a piece. Binding requires an IDENTITY recovery proof,
 *    and producing one requires the encrypted identity copy. The only download
 *    the site offered served the PLATE copy and refused outright before a
 *    plate existed, so the proof the claim gates on could never be made and
 *    every claim was refused.
 *
 * 2. Placing a dream failed while telling the collector the piece could not be
 *    reached. The server had answered, and refused, because the caretaker has
 *    no birth profile on file. The database enforces the same rule with a
 *    trigger whose abort arrived as a raw driver string, so no client could
 *    classify it and the honest refusal never rendered.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, describe, it, mock } from 'node:test';

import { encryptOwnershipCode } from '../utils/ownershipCodeCrypto';
import {
  buildIdentityBackupDocument,
  identityBackupSha256,
} from '../functions/api/_lib/identityBackup.js';
import { hashRecoveryCode } from '../functions/api/_lib/keeper.js';
import { clientErrorCode } from '../functions/api/_lib/clientError.js';

const ADMIN_SECRET = 'registry-admin-secret';
const ADMIN_IDENTITY = {
  userId: 'admin-user',
  email: 'artist@example.com',
  user: { id: 'admin-user', email: 'artist@example.com', emailVerified: true },
  session: { id: 'admin-session' },
};

mock.module('../functions/api/_lib/auth.js', {
  namedExports: {
    requireAdmin: async (request: Request) => {
      if (!request.headers.get('Cookie')?.includes('better-auth.session_token=admin-session')) {
        return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
      }
      return ADMIN_IDENTITY;
    },
  },
});

const { onRequest: backupEndpoint } = await import('../functions/api/admin/pieces/[id]/backup.js');
const { createRegistryUnlockToken } = await import('../functions/api/_lib/admin.js');
const REGISTRY_UNLOCK_TOKEN = await createRegistryUnlockToken(
  { REGISTRY_STEP_UP_SECRET: ADMIN_SECRET },
  ADMIN_IDENTITY,
);

const KEY = Buffer.alloc(32, 9).toString('base64');
const OWNERSHIP_CODE = 'K7QM-9XTR-2PHV-N4WB';
const PUBLIC_CODE = 'AR-IDENTITY1';

let identityDocument: string;
let identityDigest: string;
let registeredRow: Record<string, unknown>;

function readSource(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

before(async () => {
  const identity = { publicCode: PUBLIC_CODE, pieceId: 'UL-200', editionNumber: 1 };
  const envelope = await encryptOwnershipCode(OWNERSHIP_CODE, identity, {
    OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
    OWNERSHIP_CODE_KEY_V1: KEY,
  });
  identityDocument = JSON.stringify(buildIdentityBackupDocument({
    publicCode: PUBLIC_CODE,
    artworkId: identity.pieceId,
    edition: { kind: 'numbered', number: 1, size: 9 },
    registeredAt: '2026-09-02T00:00:00.000Z',
    verifier: await hashRecoveryCode(OWNERSHIP_CODE),
    envelope,
  }));
  identityDigest = await identityBackupSha256(identityDocument);
  registeredRow = {
    id: 'kp-identity-1',
    piece_id: identity.pieceId,
    edition_number: 1,
    public_code: PUBLIC_CODE,
    // A registered identity with no plate. This is the state every piece is
    // in the moment it is issued, and the state in which no claim could be
    // made until the identity copy became reachable.
    plate_status: 'legacy',
    registration_status: 'registered',
    identity_backup_status: 'verified',
    identity_backup_reference: `identities/${PUBLIC_CODE}/${identityDigest}.json`,
    identity_backup_sha256: identityDigest,
    backup_status: null,
    backup_reference: null,
    backup_sha256: null,
    ownership_code_key_version: envelope.keyVersion,
  };
});

function request(url: string) {
  return new Request(url, {
    method: 'GET',
    headers: {
      Cookie: `better-auth.session_token=admin-session; registry_unlock=${REGISTRY_UNLOCK_TOKEN}`,
    },
  });
}

function environment(row: Record<string, unknown> | null) {
  return {
    DB: {
      prepare(sql: string) {
        if (/^SELECT \* FROM keeper_pieces/i.test(sql.trim())) {
          return { bind() { return this; }, async first() { return row; } };
        }
        if (/^INSERT INTO ownership_code_audit/i.test(sql.trim())) {
          return { bind() { return this; }, async run() { return { success: true }; } };
        }
        throw new Error(`Unexpected statement: ${sql}`);
      },
    },
    ARTWORK_REGISTRY_BACKUP: {
      async get(key: string) {
        if (key !== `identities/${PUBLIC_CODE}/${identityDigest}.json`) return null;
        return { async text() { return identityDocument; } };
      },
    },
    REGISTRY_STEP_UP_SECRET: ADMIN_SECRET,
    OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
    OWNERSHIP_CODE_KEY_V1: KEY,
  };
}

describe('the identity recovery copy is reachable', () => {
  it('serves the identity copy for a registered identity that has no plate', async () => {
    const response = await backupEndpoint({
      request: request(`https://adrianrasmussen.com/api/admin/pieces/kp-identity-1/backup?kind=identity`),
      env: environment(registeredRow),
      params: { id: 'kp-identity-1' },
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), identityDocument);
    assert.equal(response.headers.get('X-Backup-Sha256'), identityDigest);
    assert.match(
      response.headers.get('Content-Disposition') || '',
      /encrypted-identity-recovery\.json/,
    );
  });

  it('defaults to the identity copy while no plate exists, so the claim proof is makeable', async () => {
    const response = await backupEndpoint({
      request: request('https://adrianrasmussen.com/api/admin/pieces/kp-identity-1/backup'),
      env: environment(registeredRow),
      params: { id: 'kp-identity-1' },
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), identityDocument);
  });

  it('refuses a plate copy that does not exist rather than serving the wrong artifact', async () => {
    const response = await backupEndpoint({
      request: request('https://adrianrasmussen.com/api/admin/pieces/kp-identity-1/backup?kind=plate'),
      env: environment(registeredRow),
      params: { id: 'kp-identity-1' },
    });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { ok: false, error: 'plate_not_found' });
  });

  it('rejects an unknown copy kind', async () => {
    const response = await backupEndpoint({
      request: request('https://adrianrasmussen.com/api/admin/pieces/kp-identity-1/backup?kind=other'),
      env: environment(registeredRow),
      params: { id: 'kp-identity-1' },
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error: 'invalid_backup_kind' });
  });
});

describe('a refused dream says what is missing', () => {
  it('answers the database trigger with the same code the request-time check uses', () => {
    // The rule itself, and its own tests, live in client-error-code.test.ts.
    // What matters here is that the dream path goes through it rather than
    // handing a caller whatever was thrown.
    const source = readSource('functions/api/collector/dreams.js');
    assert.match(source, /clientErrorCode\(error, 'collector_dream_failed'\)/);
    assert.doesNotMatch(source, /error instanceof Error \? error\.message/);
    assert.equal(
      clientErrorCode(
        new Error('D1_ERROR: public dream requires established adult: SQLITE_CONSTRAINT'),
        'collector_dream_failed',
      ),
      'adult_status_required',
    );
  });

  it('separates a refusal the caretaker can resolve from an unreachable piece', () => {
    const live = readSource('components/collector/live.ts');
    assert.match(live, /'landed' \| 'held' \| 'locked' \| 'unready'/);

    const wired = readSource('components/collector/wired.tsx');
    assert.match(wired, /adult_status_required/);
    assert.match(wired, /minor_publicity_forbidden/);
    assert.match(wired, /name_consent_required/);
    assert.match(wired, /user_not_synced/);
    assert.match(wired, /function placementRefusal/);

    const review = readSource('components/collector/gardenReview.tsx');
    // the honest line, and the offline wording kept for actual network drops
    assert.match(review, /GARDEN_UNREADY_LINE/);
    assert.match(review, /birth day, time and place/);
    assert.match(review, /COPY\.states\.offlineBody/);
  });
});
