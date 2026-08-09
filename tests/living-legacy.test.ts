import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it, mock } from 'node:test';
import { createHash } from 'node:crypto';
import jsQR from 'jsqr';
import sharp from 'sharp';

import {
  generateRecoveryCode,
  normalizeRecoveryCode,
  hashRecoveryCode,
  isWellFormedRecoveryCode,
} from '../utils/recoveryCode';
import {
  decryptOwnershipCode,
  encryptOwnershipCode,
} from '../utils/ownershipCodeCrypto';
import {
  buildArtworkPlatePackage,
  generatePublicPlateCode,
  isPublicPlateCode,
  publicPlateUrl,
} from '../utils/artworkPlate';
import {
  activationChecklistComplete,
  beginIssuanceAttempt,
  clearSensitivePlateState,
  projectPlateDownloads,
  projectIssuedPlateResponse,
  type SensitivePlateState,
} from '../utils/adminArtworkRegistry';
import {
  birthdayWindowState,
  canSetMotivation,
  canConfirmMotivation,
  intentionState,
  projectIntention,
  computeContentHash,
  generateSaltHex,
  parseIntentionInput,
  CONFIRM_GRACE_MS,
  BIRTHDAY_WINDOW_DAYS,
  IntentionRow,
} from '../utils/intentions';

import { CLAIM_REQUEST_NOTE_MAX } from '../functions/api/_lib/claimRequests.js';

import { buildLineageEvent, prepareNextLineageEvent } from '../functions/api/_lib/lineage.js';
import { applyOrderStatusEvent, upsertCheckoutOrder } from '../functions/api/stripe/webhook.js';
import {
  backupDocumentSha256,
  backupPlateEnvelope,
  buildBackupDocument,
  parseBackupDocument,
  recordPlateBackupResult,
} from '../functions/api/_lib/plateBackup.js';
import { onRequest as resolveArtworkQr } from '../functions/qr/[number].js';
import { LAUNCH_FLAGS } from '../launchFlags';

const ADMIN_SECRET = 'test-admin-secret';
const ADMIN_IDENTITY = {
  userId: 'admin-user', email: 'artist@example.com',
  user: { id: 'admin-user', email: 'artist@example.com', emailVerified: true },
  session: { id: 'admin-session' },
};
let CURRENT_AUTH: { userId: string; email: string | null; emailVerified?: boolean } | null = null;

mock.module('../functions/api/_lib/auth.js', {
  namedExports: {
    requireUser: async () => {
      if (!CURRENT_AUTH) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
      }
      return {
        userId: CURRENT_AUTH.userId,
        email: CURRENT_AUTH.email,
        user: { emailVerified: CURRENT_AUTH.emailVerified === true },
      };
    },
    requireAdmin: async (request: Request) => {
      if (!request.headers.get('Cookie')?.includes('better-auth.session_token=admin-session')) {
        return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
      }
      if (request.method !== 'GET' && request.headers.get('Origin') !== new URL(request.url).origin) {
        return new Response(JSON.stringify({ ok: false, error: 'origin_forbidden' }), { status: 403 });
      }
      return ADMIN_IDENTITY;
    },
  },
});

const { createRegistryUnlockToken } = await import('../functions/api/_lib/admin.js');
const REGISTRY_UNLOCK_TOKEN = await createRegistryUnlockToken(
  { REGISTRY_STEP_UP_SECRET: ADMIN_SECRET },
  ADMIN_IDENTITY,
);
const ADMIN_COOKIES = `better-auth.session_token=admin-session; registry_unlock=${REGISTRY_UNLOCK_TOKEN}`;
const { onRequest: adminPieces } = await import('../functions/api/admin/pieces.js');
const { onRequest: adminArtworks } = await import('../functions/api/admin/artworks.js');
const { onRequest: bindKeeper } = await import('../functions/api/keeper/bind.js');
const { findStaticArtwork } = await import('../functions/api/_lib/artworkCatalog.js');
const { onRequest: readClaimEvidence } = await import('../functions/api/admin/pieces/[id]/claim-evidence.js');
const { onRequest: revealArtworkPlate } = await import('../functions/api/admin/pieces/[id]/reveal.js');
const { onRequest: retryArtworkPlateBackup } = await import('../functions/api/admin/pieces/[id]/backup.js');
const { onRequest: activateArtworkPlate } = await import('../functions/api/admin/pieces/[id]/activate.js');

const migrationUrl = (name: string) => new URL(`../migrations/${name}`, import.meta.url);
const readMigration = (name: string) => readFileSync(migrationUrl(name), 'utf8');
const legacyKeeperSchema = () =>
  ['001_init.sql', '008_living_legacy.sql', '009_keeper_register.sql']
    .map(readMigration)
    .join('\n');
const registrySchema = () =>
  `${legacyKeeperSchema()}\n${readMigration('010_artwork_plate_identity.sql')}\n${readMigration('011_piece_fulfillments.sql')}\n${readMigration('012_piece_fulfillment_guards.sql')}\n${readMigration('013_artwork_lineage.sql')}\n${readMigration('014_artwork_lineage_anchor.sql')}`;
const sqliteJson = (sql: string) => {
  const output = execFileSync('sqlite3', ['-json', ':memory:'], {
    encoding: 'utf8',
    input: `PRAGMA foreign_keys = ON;\n${sql}`,
  }).trim();
  return output ? JSON.parse(output) : [];
};
const sqliteResult = (sql: string) =>
  spawnSync('sqlite3', [':memory:'], {
    encoding: 'utf8',
    input: `PRAGMA foreign_keys = ON;\n${sql}`,
  });

const legacyPieceInsert = `
  INSERT INTO keeper_pieces
    (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
     current_display_location, registered_at, claimed_at, released_at)
  VALUES
    ('kp-legacy', 'UL-001', 0, 'keeper-legacy', 'legacy-hash',
     'Bali', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', NULL);
`;

describe('artwork registry admin helpers', () => {
  it('keeps one issuance key stable for a retry and replaces it for the next attempt', () => {
    const first = beginIssuanceAttempt(null, () => 'issue-a');
    assert.equal(beginIssuanceAttempt(first, () => 'issue-b'), 'issue-a');
    assert.equal(beginIssuanceAttempt(null, () => 'issue-b'), 'issue-b');
  });

  it('projects exact private fabrication downloads with safe filenames', () => {
    const downloads = projectPlateDownloads({
      publicCode: 'AR-ABCDEFGH',
      frontSvg: '<svg>front</svg>',
      undersideSvg: '<svg>private</svg>',
      manifest: {
        schemaVersion: 1,
        publicCode: 'AR-ABCDEFGH',
        artworkId: 'UL-100',
        editionNumber: 2,
        publicUrl: 'https://adrianrasmussen.com/qr/AR-ABCDEFGH',
        ownershipCode: 'K7QM-9XTR-2PHV-N4WB',
        frontSha256: 'front-hash',
        undersideSha256: 'back-hash',
        generatedAt: '2026-07-13T00:00:00.000Z',
      },
    });
    assert.deepEqual(downloads.map(({ filename, mimeType }) => ({ filename, mimeType })), [
      { filename: 'AR-ABCDEFGH-front.svg', mimeType: 'image/svg+xml' },
      { filename: 'AR-ABCDEFGH-underside-private.svg', mimeType: 'image/svg+xml' },
      { filename: 'AR-ABCDEFGH-manifest-private.json', mimeType: 'application/json' },
    ]);
    assert.equal(downloads[0].content, '<svg>front</svg>');
    assert.equal(downloads[2].content.includes('K7QM-9XTR-2PHV-N4WB'), true);
  });

  it('projects only the expected private issuance package fields from an API response', () => {
    const projected = projectIssuedPlateResponse({
      ownershipCode: 'K7QM-9XTR-2PHV-N4WB',
      publicCode: 'AR-ABCDEFGH',
      publicUrl: 'https://adrianrasmussen.com/qr/AR-ABCDEFGH',
      frontSvg: '<svg>front</svg>',
      undersideSvg: '<svg>private</svg>',
      frontSha256: 'front-hash',
      undersideSha256: 'back-hash',
      manifest: {
        schemaVersion: 1,
        publicCode: 'AR-ABCDEFGH',
        artworkId: 'UL-100',
        editionNumber: 2,
        publicUrl: 'https://adrianrasmussen.com/qr/AR-ABCDEFGH',
        ownershipCode: 'K7QM-9XTR-2PHV-N4WB',
        frontSha256: 'front-hash',
        undersideSha256: 'back-hash',
        generatedAt: '2026-07-13T00:00:00.000Z',
        internalEnvelope: 'nested-must-not-pass-through',
      },
      backupStatus: 'verified',
      internalEnvelope: 'must-not-pass-through',
    });
    assert.equal('internalEnvelope' in projected, false);
    assert.equal('internalEnvelope' in projected.manifest, false);
    assert.deepEqual(Object.keys(projected).sort(), [
      'backupStatus', 'frontSha256', 'frontSvg', 'manifest', 'ownershipCode',
      'publicCode', 'publicUrl', 'undersideSha256', 'undersideSvg',
    ]);
    for (const field of ['publicCode', 'publicUrl', 'ownershipCode', 'frontSha256', 'undersideSha256'] as const) {
      assert.throws(
        () => projectIssuedPlateResponse({ ...projected, [field]: `mismatched-${field}` }),
        /mismatch/i,
      );
    }
    assert.throws(() => projectIssuedPlateResponse({ publicCode: 'AR-ABCDEFGH' }), /incomplete/i);
  });

  it('requires every physical confirmation and the exact stored hashes', () => {
    const complete = {
      realMetalQrScanned: true,
      artworkEditionPublicCodeMatch: true,
      undersideOwnershipCodeMatch: true,
      attachmentAndAbrasionInspected: true,
      frontSha256: 'front-hash',
      undersideSha256: 'back-hash',
    };
    assert.equal(activationChecklistComplete(complete, 'front-hash', 'back-hash'), true);
    assert.equal(activationChecklistComplete({ ...complete, realMetalQrScanned: false }, 'front-hash', 'back-hash'), false);
    assert.equal(activationChecklistComplete(complete, 'different', 'back-hash'), false);
  });

  it('clears all immediate Ownership Code and step-up state after activation or dismissal', () => {
    const sensitive: SensitivePlateState = {
      issuanceKey: 'issue-a',
      package: {
        ownershipCode: 'K7QM-9XTR-2PHV-N4WB',
        publicCode: 'AR-ABCDEFGH',
        publicUrl: 'https://adrianrasmussen.com/qr/AR-ABCDEFGH',
        frontSvg: '<svg/>',
        undersideSvg: '<svg/>',
        frontSha256: 'front-hash',
        undersideSha256: 'back-hash',
        manifest: {} as NonNullable<SensitivePlateState['package']>['manifest'],
      },
      revealedForPieceId: 'kp-1',
      revealedOwnershipCode: 'K7QM-9XTR-2PHV-N4WB',
      revealedUndersideSvg: '<svg/>',
      stepUpSecret: 'admin-secret',
    };
    assert.deepEqual(clearSensitivePlateState(sensitive), {
      issuanceKey: null,
      package: null,
      revealedForPieceId: null,
      revealedOwnershipCode: null,
      revealedUndersideSvg: null,
      stepUpSecret: '',
    });
  });
});

describe('artwork plate fabrication package', () => {
  it('generates stateless public-code candidates from the human-safe alphabet', () => {
    for (let index = 0; index < 100; index += 1) {
      const code = generatePublicPlateCode();
      assert.match(code, /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
      assert.equal(isPublicPlateCode(code), true);
      assert.doesNotMatch(code, /[OI01]/);
    }

    const fixedRandom = {
      getRandomValues<T extends ArrayBufferView>(array: T): T {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(0);
        return array;
      },
    };
    assert.equal(generatePublicPlateCode(fixedRandom), 'AR-AAAAAAAA');
    assert.equal(generatePublicPlateCode(fixedRandom), 'AR-AAAAAAAA');
  });

  it('uses the exact permanent Adrian URL and rejects invalid public codes', () => {
    assert.equal(
      publicPlateUrl('AR-7KQ9M2WX'),
      'https://adrianrasmussen.com/qr/AR-7KQ9M2WX',
    );
    assert.throws(() => publicPlateUrl('AR-O0000000'), /invalid public plate code/i);
  });

  it('renders engraving-ready QR and underside SVGs with safe text', async () => {
    const plate = await buildArtworkPlatePackage({
      publicCode: 'AR-7KQ9M2WX',
      ownershipCode: 'k7qm 9xtr 2phv n4wb',
      artworkId: ' sig-100 ',
      editionNumber: 2,
      generatedAt: '2026-07-13T10:20:30.000Z',
    });

    assert.equal(plate.publicUrl, 'https://adrianrasmussen.com/qr/AR-7KQ9M2WX');
    assert.match(plate.frontSvg, /width="50mm" height="62mm"/);
    assert.match(plate.frontSvg, /data-error-correction="Q"/);
    assert.match(plate.frontSvg, /data-quiet-zone="4"/);
    assert.match(plate.frontSvg, />AR-7KQ9M2WX</);
    assert.match(
      plate.frontSvg,
      />https:\/\/adrianrasmussen\.com\/qr\/AR-7KQ9M2WX</,
    );
    assert.match(plate.frontSvg, />SIG-100 · edition 2</);
    assert.match(plate.frontSvg, /<path fill="#000000"/);
    assert.doesNotMatch(plate.frontSvg, /stroke=/);
    assert.doesNotMatch(plate.frontSvg, /K7QM-9XTR/);
    assert.match(plate.undersideSvg, /width="50mm" height="62mm"/);
    assert.match(plate.undersideSvg, />OWNERSHIP CODE</);
    assert.match(plate.undersideSvg, /Register or transfer at adrianrasmussen\.com/);
    assert.match(plate.undersideSvg, /K7QM-9XTR-2PHV-N4WB/);
    assert.match(plate.undersideSvg, /SIG-100/);
    assert.equal(plate.manifest.ownershipCode, 'K7QM-9XTR-2PHV-N4WB');
    assert.equal(plate.manifest.artworkId, 'SIG-100');
  });

  it('renders both faces at the exact same 50 mm by 62 mm plate geometry', async () => {
    const plate = await buildArtworkPlatePackage({
      publicCode: 'AR-7KQ9M2WX',
      ownershipCode: 'K7QM-9XTR-2PHV-N4WB',
      artworkId: 'UL-100',
      editionNumber: 2,
      generatedAt: '2026-07-13T10:20:30.000Z',
    });

    const physicalGeometry = /width="(\d+)mm" height="(\d+)mm" viewBox="([^"]+)"/;
    assert.deepEqual(plate.frontSvg.match(physicalGeometry)?.slice(1), [
      '50',
      '62',
      '0 0 500 620',
    ]);
    assert.deepEqual(plate.undersideSvg.match(physicalGeometry)?.slice(1), [
      '50',
      '62',
      '0 0 500 620',
    ]);
  });

  it('rasterizes to a QR that decodes to the exact permanent URL', async () => {
    const plate = await buildArtworkPlatePackage({
      publicCode: 'AR-7KQ9M2WX',
      ownershipCode: 'K7QM-9XTR-2PHV-N4WB',
      artworkId: 'UL-100',
      editionNumber: 2,
      generatedAt: '2026-07-13T10:20:30.000Z',
    });
    const { data, info } = await sharp(Buffer.from(plate.frontSvg))
      .resize({ width: 1000 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const decoded = jsQR(
      new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
      info.width,
      info.height,
    );

    assert.equal(decoded?.data, 'https://adrianrasmussen.com/qr/AR-7KQ9M2WX');
  });

  it('rejects malformed or unbounded engraving inputs', async () => {
    const valid = {
      publicCode: 'AR-7KQ9M2WX',
      ownershipCode: 'K7QM-9XTR-2PHV-N4WB',
      artworkId: 'UL-100',
      editionNumber: 2,
      generatedAt: '2026-07-13T10:20:30.000Z',
    };

    await assert.rejects(
      () => buildArtworkPlatePackage({ ...valid, ownershipCode: 'K7QM-9XTR-2PHV-N4WO' }),
      /invalid ownership code/i,
    );
    const widestAccepted = await buildArtworkPlatePackage({ ...valid, artworkId: 'SIG-999' });
    assert.match(widestAccepted.frontSvg, />SIG-999 · edition 2</);

    for (const artworkId of ['', 'LONG-999', 'UL-10A', 'UL_100', 'UL-100\nFORGED']) {
      await assert.rejects(
        () => buildArtworkPlatePackage({ ...valid, artworkId }),
        /invalid artwork ID/i,
      );
    }
    for (const generatedAt of ['', 'not-a-date', '2026-07-13T10:20:30Z']) {
      await assert.rejects(
        () => buildArtworkPlatePackage({ ...valid, generatedAt }),
        /invalid generation time/i,
      );
    }
  });

  it('hashes exact SVG bytes and returns a complete deterministic private manifest', async () => {
    const input = {
      publicCode: 'AR-7KQ9M2WX',
      ownershipCode: 'K7QM-9XTR-2PHV-N4WB',
      artworkId: 'UL-100',
      editionNumber: 2,
      generatedAt: '2026-07-13T10:20:30.000Z',
    };
    const first = await buildArtworkPlatePackage(input);
    const second = await buildArtworkPlatePackage(input);

    assert.deepEqual(first, second);
    assert.equal(
      first.frontSha256,
      createHash('sha256').update(Buffer.from(first.frontSvg, 'utf8')).digest('hex'),
    );
    assert.equal(
      first.undersideSha256,
      createHash('sha256').update(Buffer.from(first.undersideSvg, 'utf8')).digest('hex'),
    );
    assert.deepEqual(first.manifest, {
      schemaVersion: 1,
      publicCode: input.publicCode,
      artworkId: input.artworkId,
      editionNumber: input.editionNumber,
      publicUrl: 'https://adrianrasmussen.com/qr/AR-7KQ9M2WX',
      ownershipCode: input.ownershipCode,
      frontSha256: first.frontSha256,
      undersideSha256: first.undersideSha256,
      generatedAt: input.generatedAt,
    });
  });
});

function plateLookupDb(
  row: { piece_id: string; edition_number: number } | null,
  error?: Error,
) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  return {
    calls,
    DB: {
      prepare(sql: string) {
        let values: unknown[] = [];
        const statement = {
          bind(...bound: unknown[]) {
            values = bound;
            return statement;
          },
          async first() {
            calls.push({ sql, values });
            if (error) throw error;
            return row;
          },
        };
        return statement;
      },
    },
  };
}

const qrRequest = (number: string, env: Record<string, unknown> = {}) =>
  resolveArtworkQr({
    params: { number },
    request: new Request(`https://adrianrasmussen.com/qr/${encodeURIComponent(number)}`),
    env,
  });

describe('permanent artwork QR resolver', () => {
  it('resolves an issued AR code through D1 with only the public instance and QR ref', async () => {
    const lookup = plateLookupDb({ piece_id: 'UL 100/α', edition_number: 2 });
    const response = await qrRequest('AR-7KQ9M2WX', { DB: lookup.DB });

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get('location'),
      'https://adrianrasmussen.com/works/UL%20100%2F%CE%B1?instance=AR-7KQ9M2WX&ref=qr',
    );
    assert.equal(lookup.calls.length, 1);
    assert.deepEqual(lookup.calls[0].values, ['AR-7KQ9M2WX']);
    assert.match(lookup.calls[0].sql, /SELECT\s+piece_id\s+FROM/i);
    assert.match(lookup.calls[0].sql, /plate_status IN \('generated', 'active', 'superseded'\)/i);
    assert.doesNotMatch(lookup.calls[0].sql, /edition_number/i);
    assert.doesNotMatch(
      lookup.calls[0].sql,
      /ownership|recovery|ciphertext|nonce|verifier|hash/i,
    );
  });

  it('returns 404 for an unknown valid AR code instead of inventing a work route', async () => {
    const lookup = plateLookupDb(null);
    const response = await qrRequest('AR-7KQ9M2WX', { DB: lookup.DB });

    assert.equal(response.status, 404);
    assert.equal(response.headers.get('location'), null);
  });

  it('returns 503 when the artwork registry binding is unavailable', async () => {
    const response = await qrRequest('AR-7KQ9M2WX');

    assert.equal(response.status, 503);
    assert.equal(response.headers.get('location'), null);
  });

  it('returns the safe 503 response when the artwork registry query fails', async () => {
    const lookup = plateLookupDb(null, new Error('D1_ERROR: database unavailable'));
    const response = await qrRequest('AR-7KQ9M2WX', { DB: lookup.DB });

    assert.equal(response.status, 503);
    assert.equal(await response.text(), 'Registry unavailable');
    assert.equal(response.headers.get('location'), null);
  });

  it('rejects malformed AR-like values without treating them as legacy artwork IDs', async () => {
    for (const code of ['AR-O0000000', 'AR-TOO-SHORT', 'AR-abcdefgh']) {
      const response = await qrRequest(code);
      assert.equal(response.status, 404, code);
      assert.equal(response.headers.get('location'), null, code);
    }
  });

  it('preserves oracle, numeric 1..64, and static artwork redirects', async () => {
    assert.equal(
      (await qrRequest('oracle')).headers.get('location'),
      'https://mandalacodes.com/oracle/universal-language?ref=qr',
    );
    assert.equal(
      (await qrRequest('1')).headers.get('location'),
      'https://mandalacodes.com/oracle/universal-language/1?ref=qr',
    );
    assert.equal(
      (await qrRequest('64')).headers.get('location'),
      'https://mandalacodes.com/oracle/universal-language/64?ref=qr',
    );
    assert.equal(
      (await qrRequest('UL-100')).headers.get('location'),
      'https://adrianrasmussen.com/works/UL-100?ref=qr',
    );
    assert.equal(
      (await qrRequest('01')).headers.get('location'),
      'https://adrianrasmussen.com/works/01?ref=qr',
    );
  });
});

describe('ownership code authenticated encryption', () => {
  const keyV1 = Buffer.from(Uint8Array.from({ length: 32 }, (_, index) => index + 1)).toString(
    'base64',
  );
  const keyV2 = Buffer.from(Uint8Array.from({ length: 32 }, (_, index) => 255 - index)).toString(
    'base64',
  );
  const env = {
    OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '2',
    OWNERSHIP_CODE_KEY_V1: keyV1,
    OWNERSHIP_CODE_KEY_V2: keyV2,
  };
  const context = {
    publicCode: 'AR-ABCDEFGH',
    pieceId: 'UL-001',
    editionNumber: 3,
  };

  it('round-trips with AES-GCM and exposes only a base64 envelope', async () => {
    const envelope = await encryptOwnershipCode('AAAA-BBBB-CCCC-DDDD', context, env);

    assert.deepEqual(Object.keys(envelope).sort(), ['ciphertext', 'keyVersion', 'nonce']);
    assert.equal(envelope.keyVersion, '2');
    assert.match(envelope.ciphertext, /^[A-Za-z0-9+/]+={0,2}$/);
    assert.match(envelope.nonce, /^[A-Za-z0-9+/]+={0,2}$/);
    assert.equal(Buffer.from(envelope.nonce, 'base64').byteLength, 12);
    assert.equal(
      await decryptOwnershipCode(envelope, context, env),
      'AAAA-BBBB-CCCC-DDDD',
    );
  });

  it('uses a fresh 96-bit nonce for every encryption', async () => {
    const first = await encryptOwnershipCode('AAAA-BBBB-CCCC-DDDD', context, env);
    const second = await encryptOwnershipCode('AAAA-BBBB-CCCC-DDDD', context, env);

    assert.equal(Buffer.from(first.nonce, 'base64').byteLength, 12);
    assert.equal(Buffer.from(second.nonce, 'base64').byteLength, 12);
    assert.notEqual(first.nonce, second.nonce);
    assert.notEqual(first.ciphertext, second.ciphertext);
  });

  it('rejects a wrong key and tampered ciphertext', async () => {
    const envelope = await encryptOwnershipCode('AAAA-BBBB-CCCC-DDDD', context, env);
    const wrongKeyEnv = {
      ...env,
      OWNERSHIP_CODE_KEY_V2: Buffer.alloc(32, 42).toString('base64'),
    };
    await assert.rejects(() => decryptOwnershipCode(envelope, context, wrongKeyEnv));

    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
    ciphertext[0] ^= 1;
    await assert.rejects(() =>
      decryptOwnershipCode(
        { ...envelope, ciphertext: ciphertext.toString('base64') },
        context,
        env,
      ),
    );
  });

  it('authenticates every identity field through stable AAD', async () => {
    const envelope = await encryptOwnershipCode('AAAA-BBBB-CCCC-DDDD', context, env);

    for (const mismatchedContext of [
      { ...context, publicCode: 'AR-ZZZZZZZZ' },
      { ...context, pieceId: 'UL-999' },
      { ...context, editionNumber: 4 },
    ]) {
      await assert.rejects(() => decryptOwnershipCode(envelope, mismatchedContext, env));
    }
    const sameKeyAcrossVersionsEnv = { ...env, OWNERSHIP_CODE_KEY_V1: keyV2 };
    await assert.rejects(() =>
      decryptOwnershipCode(
        { ...envelope, keyVersion: '1' },
        context,
        sameKeyAcrossVersionsEnv,
      ),
    );
  });

  it('rejects missing, malformed, and non-256-bit keys', async () => {
    await assert.rejects(
      () => encryptOwnershipCode('AAAA-BBBB-CCCC-DDDD', context, {}),
      /active ownership code key version/i,
    );
    await assert.rejects(
      () =>
        encryptOwnershipCode('AAAA-BBBB-CCCC-DDDD', context, {
          OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
          OWNERSHIP_CODE_KEY_V1: 'not-base64!',
        }),
      /base64/i,
    );
    await assert.rejects(
      () =>
        encryptOwnershipCode('AAAA-BBBB-CCCC-DDDD', context, {
          OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
          OWNERSHIP_CODE_KEY_V1: Buffer.alloc(16).toString('base64'),
        }),
      /32 bytes/i,
    );
  });

  it('accepts only canonical positive safe-integer key versions for issuance and recovery', async () => {
    const invalidVersions = ['01', '0', '-1', '1.5', '+1', '9007199254740992'];

    for (const keyVersion of invalidVersions) {
      const keyedEnv = {
        ...env,
        OWNERSHIP_CODE_ACTIVE_KEY_VERSION: keyVersion,
        [`OWNERSHIP_CODE_KEY_V${keyVersion}`]: keyV2,
      };
      await assert.rejects(
        () => encryptOwnershipCode('AAAA-BBBB-CCCC-DDDD', context, keyedEnv),
        /positive safe-integer/i,
      );
      await assert.rejects(
        () =>
          decryptOwnershipCode(
            { ciphertext: 'AA==', nonce: Buffer.alloc(12).toString('base64'), keyVersion },
            context,
            keyedEnv,
          ),
        /positive safe-integer/i,
      );
    }

    const maximumVersion = String(Number.MAX_SAFE_INTEGER);
    const maximumVersionEnv = {
      OWNERSHIP_CODE_ACTIVE_KEY_VERSION: maximumVersion,
      [`OWNERSHIP_CODE_KEY_V${maximumVersion}`]: keyV1,
    };
    const envelope = await encryptOwnershipCode(
      'AAAA-BBBB-CCCC-DDDD',
      context,
      maximumVersionEnv,
    );
    assert.equal(envelope.keyVersion, maximumVersion);
    assert.equal(
      await decryptOwnershipCode(envelope, context, maximumVersionEnv),
      'AAAA-BBBB-CCCC-DDDD',
    );

    const [stored] = sqliteJson(`
      CREATE TABLE version_round_trip (key_version INTEGER NOT NULL);
      INSERT INTO version_round_trip (key_version) VALUES ('${maximumVersion}');
      SELECT key_version, typeof(key_version) AS storage_type FROM version_round_trip;
    `);
    assert.deepEqual(stored, { key_version: Number.MAX_SAFE_INTEGER, storage_type: 'integer' });
  });

  it('decrypts stored envelopes with older configured key versions', async () => {
    const oldEnvelope = await encryptOwnershipCode(
      'AAAA-BBBB-CCCC-DDDD',
      context,
      env,
      '1',
    );
    assert.equal(oldEnvelope.keyVersion, '1');

    assert.equal(
      await decryptOwnershipCode(oldEnvelope, context, env),
      'AAAA-BBBB-CCCC-DDDD',
    );
  });
});

describe('artwork registry migrations', () => {
  it('leaves the pre-010 legacy schema readable without registry tables', () => {
    const registryColumns = sqliteJson(`
      ${legacyKeeperSchema()}
      SELECT name FROM pragma_table_info('keeper_pieces')
      WHERE name IN (
        'public_code', 'issuance_key', 'plate_status', 'plate_generated_at',
        'plate_activated_at', 'front_svg_sha256', 'back_svg_sha256',
        'ownership_code_ciphertext', 'ownership_code_nonce',
        'ownership_code_key_version', 'backup_status', 'backup_reference', 'backup_at'
      ) ORDER BY cid;
    `);
    const rows = sqliteJson(`
      ${legacyKeeperSchema()}
      ${legacyPieceInsert}
      SELECT id, piece_id, keeper_user_id, recovery_code_hash
      FROM keeper_pieces WHERE id = 'kp-legacy';
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN ('ownership_code_audit', 'piece_fulfillments');
    `);

    assert.deepEqual(registryColumns, []);
    assert.deepEqual(rows, [
      {
        id: 'kp-legacy',
        piece_id: 'UL-001',
        keeper_user_id: 'keeper-legacy',
        recovery_code_hash: 'legacy-hash',
      },
    ]);
  });

  it('adds plate identity fields while preserving legacy steward rows', () => {
    const [row] = sqliteJson(`
      ${legacyKeeperSchema()}
      ${legacyPieceInsert}
      ${readMigration('010_artwork_plate_identity.sql')}
      SELECT id, piece_id, public_code, issuance_key, plate_status,
             plate_generated_at, plate_activated_at, front_svg_sha256,
             back_svg_sha256, ownership_code_ciphertext, ownership_code_nonce,
             ownership_code_key_version, backup_status, backup_reference,
             backup_at
      FROM keeper_pieces WHERE id = 'kp-legacy';
    `);

    assert.deepEqual(row, {
      id: 'kp-legacy',
      piece_id: 'UL-001',
      public_code: null,
      issuance_key: null,
      plate_status: 'legacy',
      plate_generated_at: null,
      plate_activated_at: null,
      front_svg_sha256: null,
      back_svg_sha256: null,
      ownership_code_ciphertext: null,
      ownership_code_nonce: null,
      ownership_code_key_version: null,
      backup_status: null,
      backup_reference: null,
      backup_at: null,
    });
  });

  it('enforces unique issued identities and keeps ownership audit rows secret-free', () => {
    const columns = sqliteJson(`
      ${registrySchema()}
      SELECT name FROM pragma_table_info('ownership_code_audit') ORDER BY cid;
    `).map((column: { name: string }) => column.name);

    assert.deepEqual(columns, [
      'id',
      'keeper_piece_id',
      'action',
      'request_id',
      'outcome',
      'created_at',
    ]);
    assert.equal(columns.some((name: string) => /cipher|nonce|secret|plaintext/i.test(name)), false);

    const [publicCodeCount] = sqliteJson(`
        ${registrySchema()}
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key)
        VALUES ('kp-a', 'UL-010', 0, 'hash-a', 'AR-ABCDEFGH', 'issue-a');
        INSERT OR IGNORE INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key)
        VALUES ('kp-b', 'UL-011', 0, 'hash-b', 'AR-ABCDEFGH', 'issue-b');
        SELECT COUNT(*) AS count FROM keeper_pieces;
      `);
    assert.equal(publicCodeCount.count, 1);

    const [issuanceKeyCount] = sqliteJson(`
        ${registrySchema()}
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, issuance_key)
        VALUES ('kp-a', 'UL-010', 0, 'hash-a', 'issue-a');
        INSERT OR IGNORE INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, issuance_key)
        VALUES ('kp-b', 'UL-011', 0, 'hash-b', 'issue-a');
        SELECT COUNT(*) AS count FROM keeper_pieces;
      `);
    assert.equal(issuanceKeyCount.count, 1);
  });

  it('links each piece and paid order item to at most one fulfillment', () => {
    const [row] = sqliteJson(`
      ${registrySchema()}
      INSERT INTO keeper_pieces
        (id, piece_id, edition_number, recovery_code_hash)
      VALUES ('kp-sale', 'UL-020', 0, 'hash-sale');
      INSERT INTO orders
        (id, stripe_session_id, email, status, amount_total, currency)
      VALUES (1, 'cs_paid', 'buyer@example.com', 'paid', 10000, 'USD');
      INSERT INTO order_items
        (id, order_id, product_id, quantity, amount_subtotal)
      VALUES (1, 1, 'UL-020', 1, 10000);
      INSERT INTO piece_fulfillments
        (id, keeper_piece_id, order_item_id, assignment_type,
         intended_recipient_reference, assigned_at)
      VALUES
        ('pf-1', 'kp-sale', 1, 'stripe_order', 'order:1', '2026-07-13T00:00:00Z');
      SELECT keeper_piece_id, order_item_id, assignment_type,
             intended_recipient_reference, assigned_at, shipped_at, claimed_at,
             corrected_at, correction_reason
      FROM piece_fulfillments WHERE id = 'pf-1';
    `);

    assert.deepEqual(row, {
      keeper_piece_id: 'kp-sale',
      order_item_id: 1,
      assignment_type: 'stripe_order',
      intended_recipient_reference: 'order:1',
      assigned_at: '2026-07-13T00:00:00Z',
      shipped_at: null,
      claimed_at: null,
      corrected_at: null,
      correction_reason: null,
    });
    const [duplicateCount] = sqliteJson(`
        ${registrySchema()}
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash)
        VALUES ('kp-a', 'UL-020', 0, 'hash-a'), ('kp-b', 'UL-021', 0, 'hash-b');
        INSERT INTO piece_fulfillments
          (id, keeper_piece_id, assignment_type, intended_recipient_reference, assigned_at)
        VALUES ('pf-a', 'kp-a', 'manual', 'studio-handoff:one', '2026-07-13T00:00:00Z');
        INSERT OR IGNORE INTO piece_fulfillments
          (id, keeper_piece_id, assignment_type, intended_recipient_reference, assigned_at)
        VALUES ('pf-b', 'kp-a', 'manual', 'studio-handoff:two', '2026-07-13T00:00:00Z');
        SELECT COUNT(*) AS count FROM piece_fulfillments;
      `);
    assert.equal(duplicateCount.count, 1);

    const [duplicateOrderItemCount] = sqliteJson(`
      ${registrySchema()}
      INSERT INTO keeper_pieces
        (id, piece_id, edition_number, recovery_code_hash)
      VALUES ('kp-a', 'UL-030', 0, 'hash-a'), ('kp-b', 'UL-031', 0, 'hash-b');
      INSERT INTO orders
        (id, stripe_session_id, email, status, amount_total, currency)
      VALUES (1, 'cs_paid', 'buyer@example.com', 'paid', 10000, 'USD');
      INSERT INTO order_items
        (id, order_id, product_id, quantity, amount_subtotal)
      VALUES (1, 1, 'UL-030', 1, 10000);
      INSERT INTO piece_fulfillments
        (id, keeper_piece_id, order_item_id, assignment_type,
         intended_recipient_reference, assigned_at)
      VALUES ('pf-a', 'kp-a', 1, 'stripe_order', 'order:1', '2026-07-13T00:00:00Z');
      INSERT OR IGNORE INTO piece_fulfillments
        (id, keeper_piece_id, order_item_id, assignment_type,
         intended_recipient_reference, assigned_at)
      VALUES ('pf-b', 'kp-b', 1, 'stripe_order', 'order:1', '2026-07-13T00:00:00Z');
      SELECT COUNT(*) AS count FROM piece_fulfillments;
    `);
    assert.equal(duplicateOrderItemCount.count, 1);
  });

  it('rejects fulfillment references to missing pieces and order items', () => {
    const orphanPiece = sqliteResult(`
      ${registrySchema()}
      INSERT INTO piece_fulfillments
        (id, keeper_piece_id, assignment_type, intended_recipient_reference, assigned_at)
      VALUES ('pf-orphan', 'kp-missing', 'manual', 'studio-handoff:one', '2026-07-13T00:00:00Z');
    `);
    assert.notEqual(orphanPiece.status, 0);
    assert.match(orphanPiece.stderr, /FOREIGN KEY constraint failed/);

    const orphanOrderItem = sqliteResult(`
      ${registrySchema()}
      INSERT INTO keeper_pieces
        (id, piece_id, edition_number, recovery_code_hash)
      VALUES ('kp-sale', 'UL-040', 0, 'hash-sale');
      INSERT INTO piece_fulfillments
        (id, keeper_piece_id, order_item_id, assignment_type,
         intended_recipient_reference, assigned_at)
      VALUES ('pf-orphan', 'kp-sale', 999, 'stripe_order', 'order:999', '2026-07-13T00:00:00Z');
    `);
    assert.notEqual(orphanOrderItem.status, 0);
    assert.match(orphanOrderItem.stderr, /FOREIGN KEY constraint failed/);
  });

  it('makes an opaque manual handoff reference one-to-one', () => {
    const [row] = sqliteJson(`
      ${registrySchema()}
      INSERT INTO keeper_pieces
        (id, piece_id, edition_number, recovery_code_hash)
      VALUES ('kp-a', 'UL-050', 0, 'hash-a'), ('kp-b', 'UL-051', 0, 'hash-b');
      INSERT INTO piece_fulfillments
        (id, keeper_piece_id, assignment_type, intended_recipient_reference, assigned_at)
      VALUES ('pf-a', 'kp-a', 'manual', 'studio-handoff:one', '2026-07-13T00:00:00Z');
      INSERT OR IGNORE INTO piece_fulfillments
        (id, keeper_piece_id, assignment_type, intended_recipient_reference, assigned_at)
      VALUES ('pf-b', 'kp-b', 'manual', 'studio-handoff:one', '2026-07-13T00:00:00Z');
      SELECT COUNT(*) AS count FROM piece_fulfillments;
    `);
    assert.equal(row.count, 1);
  });

  it('separates private claim evidence from fork-resistant public lineage', () => {
    const evidenceColumns = sqliteJson(`${registrySchema()} SELECT name FROM pragma_table_info('artwork_claim_evidence') ORDER BY cid;`).map((row: any) => row.name);
    const lineageColumns = sqliteJson(`${registrySchema()} SELECT name FROM pragma_table_info('artwork_lineage_events') ORDER BY cid;`).map((row: any) => row.name);
    assert.ok(evidenceColumns.includes('verified_email'));
    assert.ok(evidenceColumns.includes('ip_address'));
    assert.equal(lineageColumns.some((name: string) => /email|ip|user_agent|ownership|cipher|nonce|key/i.test(name)), false);

    const [forkCount] = sqliteJson(`
      ${registrySchema()}
      INSERT INTO keeper_pieces (id, piece_id, edition_number, recovery_code_hash)
      VALUES ('kp-chain', 'UL-060', 0, 'hash');
      INSERT INTO artwork_lineage_events
        (id, keeper_piece_id, sequence, event_type, event_at, previous_hash, event_hash, public_payload_json)
      VALUES ('le-1', 'kp-chain', 1, 'issued', '2026-07-13T00:00:00Z', NULL, 'hash-1', '{}');
      INSERT OR IGNORE INTO artwork_lineage_events
        (id, keeper_piece_id, sequence, event_type, event_at, previous_hash, event_hash, public_payload_json)
      VALUES ('le-fork', 'kp-chain', 2, 'activated', '2026-07-13T01:00:00Z', NULL, 'fork', '{}');
      INSERT INTO artwork_lineage_events
        (id, keeper_piece_id, sequence, event_type, event_at, previous_hash, event_hash, public_payload_json)
      VALUES ('le-2', 'kp-chain', 2, 'activated', '2026-07-13T01:00:00Z', 'hash-1', 'hash-2', '{}');
      INSERT OR IGNORE INTO artwork_lineage_events
        (id, keeper_piece_id, sequence, event_type, event_at, previous_hash, event_hash, public_payload_json)
      VALUES ('le-fork-2', 'kp-chain', 3, 'shipped', '2026-07-13T02:00:00Z', 'hash-1', 'fork-2', '{}');
      SELECT COUNT(*) AS count FROM artwork_lineage_events;
    `);
    assert.equal(forkCount.count, 2);
  });

  it('adds a zero/null durable lineage anchor without inventing history', () => {
    const columns = sqliteJson(
      `${registrySchema()} SELECT name FROM pragma_table_info('keeper_pieces') ORDER BY cid;`,
    ).map((row: any) => row.name);
    assert.ok(columns.includes('lineage_head_hash'));
    assert.ok(columns.includes('lineage_event_count'));
    const [row] = sqliteJson(`
      ${registrySchema()}
      INSERT INTO keeper_pieces (id, piece_id, edition_number, recovery_code_hash)
      VALUES ('kp-anchor', 'UL-061', 0, 'hash-anchor');
      SELECT lineage_head_hash IS NULL AS head_is_null, lineage_event_count
        FROM keeper_pieces WHERE id = 'kp-anchor';
    `);
    assert.equal(row.head_is_null, 1);
    assert.equal(row.lineage_event_count, 0);
    assert.match(readMigration('014_artwork_lineage_anchor.sql'), /zero pre-existing registry events/i);
  });

  it('atomically rejects mixing unique and numbered identities on insert and update', () => {
    const guard = readMigration('016_keeper_piece_edition_kind_guard.sql');
    assert.match(guard, /BEFORE INSERT ON keeper_pieces/i);
    assert.match(guard, /BEFORE UPDATE OF piece_id, edition_number ON keeper_pieces/i);
    assert.match(guard, /keeper_piece_edition_range_violation/i);
    assert.doesNotMatch(guard, /DROP TABLE keeper_pieces|ALTER TABLE keeper_pieces/i);

    const preexistingNumbered = sqliteResult(`
      ${registrySchema()}
      INSERT INTO keeper_pieces (id, piece_id, edition_number, recovery_code_hash)
      VALUES ('kp-numbered', 'UL-162', 1, 'hash-numbered');
      ${guard}
      INSERT INTO keeper_pieces (id, piece_id, edition_number, recovery_code_hash)
      VALUES ('kp-unique', 'UL-162', 0, 'hash-unique');
    `);
    assert.notEqual(preexistingNumbered.status, 0);
    assert.match(preexistingNumbered.stderr, /keeper_piece_edition_kind_conflict/);

    const competingInsert = sqliteResult(`
      ${registrySchema()}
      ${guard}
      BEGIN IMMEDIATE;
      INSERT INTO keeper_pieces (id, piece_id, edition_number, recovery_code_hash)
      VALUES ('kp-unique', 'MD-900', 0, 'hash-unique');
      INSERT INTO keeper_pieces (id, piece_id, edition_number, recovery_code_hash)
      VALUES ('kp-numbered', 'MD-900', 1, 'hash-numbered');
      COMMIT;
    `);
    assert.notEqual(competingInsert.status, 0);
    assert.match(competingInsert.stderr, /keeper_piece_edition_kind_conflict/);

    const conflictingUpdate = sqliteResult(`
      ${registrySchema()}
      ${guard}
      INSERT INTO keeper_pieces (id, piece_id, edition_number, recovery_code_hash)
      VALUES
        ('kp-unique', 'MD-901', 0, 'hash-unique'),
        ('kp-numbered', 'MD-902', 1, 'hash-numbered');
      UPDATE keeper_pieces SET piece_id = 'MD-901' WHERE id = 'kp-numbered';
    `);
    assert.notEqual(conflictingUpdate.status, 0);
    assert.match(conflictingUpdate.stderr, /keeper_piece_edition_kind_conflict/);

    for (const edition of [-1, 10000]) {
      const invalidInsert = sqliteResult(`
        ${registrySchema()}
        ${guard}
        INSERT INTO keeper_pieces (id, piece_id, edition_number, recovery_code_hash)
        VALUES ('kp-range', 'MD-903', ${edition}, 'hash-range');
      `);
      assert.notEqual(invalidInsert.status, 0);
      assert.match(invalidInsert.stderr, /keeper_piece_edition_range_violation/);
    }

    const invalidUpdate = sqliteResult(`
      ${registrySchema()}
      ${guard}
      INSERT INTO keeper_pieces (id, piece_id, edition_number, recovery_code_hash)
      VALUES ('kp-range', 'MD-904', 1, 'hash-range');
      UPDATE keeper_pieces SET edition_number = 10000 WHERE id = 'kp-range';
    `);
    assert.notEqual(invalidUpdate.status, 0);
    assert.match(invalidUpdate.stderr, /keeper_piece_edition_range_violation/);

    const invalidPreexistingUpdate = sqliteResult(`
      ${registrySchema()}
      INSERT INTO keeper_pieces (id, piece_id, edition_number, recovery_code_hash)
      VALUES ('kp-range', 'MD-905', -1, 'hash-range');
      ${guard}
      UPDATE keeper_pieces SET current_display_location = 'Studio' WHERE id = 'kp-range';
    `);
    assert.notEqual(invalidPreexistingUpdate.status, 0);
    assert.match(invalidPreexistingUpdate.stderr, /keeper_piece_edition_range_violation/);
  });

  it('refuses to install the edition guard over preexisting mixed identity data', () => {
    const result = sqliteResult(`
      ${registrySchema()}
      INSERT INTO keeper_pieces (id, piece_id, edition_number, recovery_code_hash)
      VALUES
        ('kp-unique', 'UL-162', 0, 'hash-unique'),
        ('kp-numbered', 'UL-162', 1, 'hash-numbered');
      ${readMigration('016_keeper_piece_edition_kind_guard.sql')}
    `);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /keeper_piece_edition_existing_conflict|CHECK constraint failed/i);
  });
});

describe('artwork lineage commitments', () => {
  it('is deterministic, chained, and rejects private payload keys', async () => {
    const input = { keeperPieceId: 'kp-1', sequence: 2, eventType: 'activated', eventAt: '2026-07-13T00:00:00.000Z', previousHash: 'a'.repeat(64), publicPayload: { plateStatus: 'active' } };
    const first = await buildLineageEvent(input);
    const second = await buildLineageEvent(input);
    assert.deepEqual(first, second);
    assert.match(first.eventHash, /^[a-f0-9]{64}$/);
    await assert.rejects(() => buildLineageEvent({ ...input, publicPayload: { email: 'private@example.com' } }), /private lineage key/i);
  });

  it('preflights the event tail against the durable piece anchor', async () => {
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    const env = {
      DB: {
        prepare(sql: string) {
          const statement = {
            bind(...values: unknown[]) { statements.push({ sql, values }); return statement; },
            async first() {
              if (/lineage_head_hash/.test(sql)) return { lineage_head_hash: null, lineage_event_count: 0 };
              return null;
            },
          };
          return statement;
        },
      },
    };
    const prepared = await prepareNextLineageEvent(env, {
      keeperPieceId: 'kp-1', eventType: 'first_bound', eventAt: '2026-07-13T00:00:00Z', publicPayload: {},
    });
    assert.equal(prepared.event.sequence, 1);
    assert.match(String(prepared.anchorStatement), /./);

    const inconsistent = {
      DB: {
        prepare(sql: string) {
          return {
            bind() { return this; },
            async first() {
              if (/lineage_head_hash/.test(sql)) return { lineage_head_hash: 'a'.repeat(64), lineage_event_count: 2 };
              return { sequence: 1, event_hash: 'b'.repeat(64) };
            },
          };
        },
      },
    };
    await assert.rejects(() => prepareNextLineageEvent(inconsistent, {
      keeperPieceId: 'kp-1', eventType: 'first_bound', eventAt: '2026-07-13T00:00:00Z', publicPayload: {},
    }), /anchor/i);
  });
});

describe('Stripe order reversals', () => {
  it('moves paid orders to refunded, canceled, failed, or disputed idempotently', async () => {
    const orders = [{ stripe_session_id: 'cs_paid', stripe_payment_intent_id: 'pi_1', status: 'paid' }];
    const DB = { prepare(sql: string) { let values: any[] = []; const statement: any = { bind(...next: any[]) { values = next; return statement; }, async run() { if (/^INSERT INTO orders/i.test(sql.trim())) { const row = orders.find((item) => item.stripe_session_id === values[1]); const terminal = row && ['refunded', 'disputed', 'canceled', 'failed'].includes(row.status); const preservesTerminal = /WHEN orders\.status IN \('refunded', 'disputed', 'canceled', 'failed'\)/.test(sql); if (row && (!terminal || !preservesTerminal)) row.status = values[4]; return { success: true, meta: { changes: 1 } }; } const row = orders.find((item) => sql.includes('stripe_session_id') ? item.stripe_session_id === values[1] : item.stripe_payment_intent_id === values[1]); if (row) row.status = values[0]; return { success: true, meta: { changes: row ? 1 : 0 } }; } }; return statement; } };
    await applyOrderStatusEvent({ DB }, { type: 'charge.refunded', data: { object: { payment_intent: 'pi_1' } } });
    assert.equal(orders[0].status, 'refunded');
    await upsertCheckoutOrder({ DB }, { userId: null, sessionId: 'cs_paid', piId: 'pi_1', email: 'buyer@example.com', status: 'paid', amountTotal: 100, currency: 'usd' });
    assert.equal(orders[0].status, 'refunded');
    await applyOrderStatusEvent({ DB }, { type: 'payment_intent.canceled', data: { object: { id: 'pi_1' } } });
    assert.equal(orders[0].status, 'canceled');
    await applyOrderStatusEvent({ DB }, { type: 'payment_intent.payment_failed', data: { object: { id: 'pi_1' } } });
    assert.equal(orders[0].status, 'failed');
    await applyOrderStatusEvent({ DB }, { type: 'charge.dispute.created', data: { object: { charge: { payment_intent: 'pi_1' } } } });
    assert.equal(orders[0].status, 'disputed');
    await assert.rejects(
      () => applyOrderStatusEvent({ DB }, { type: 'charge.refunded', data: { object: {} } }),
      /unresolved/i,
    );
  });
});

describe('private claim evidence pagination', () => {
  it('uses an id tiebreaker so equal timestamps are never skipped', async () => {
    const createdAt = '2026-07-13T00:00:00.000Z';
    const rows = ['evidence-c', 'evidence-b', 'evidence-a'].map((id) => ({
      id, actor_user_id: 'keeper', verified_email: 'verified@example.com',
      ip_address: null, user_agent: null, outcome: 'contested_attempt', created_at: createdAt,
    }));
    const DB = { prepare() { let values: any[] = []; const statement: any = { bind(...next: any[]) { values = next; return statement; }, async all() { const [, beforeAt, beforeId, limit] = values; return { results: rows.filter((row) => !beforeAt || row.created_at < beforeAt || (row.created_at === beforeAt && row.id < beforeId)).slice(0, limit) }; } }; return statement; } };
    const request = (before?: { createdAt: string; id: string }) => new Request('https://adrianrasmussen.com/api/admin/pieces/kp-one/claim-evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://adrianrasmussen.com', Cookie: ADMIN_COOKIES },
      body: JSON.stringify({ limit: 2, before }),
    });
    const first = await (await readClaimEvidence({ request: request(), env: { DB, REGISTRY_STEP_UP_SECRET: ADMIN_SECRET }, params: { id: 'kp-one' } })).json();
    assert.deepEqual(first.evidence.map((row: any) => row.id), ['evidence-c', 'evidence-b']);
    assert.deepEqual(first.nextBefore, { createdAt, id: 'evidence-b' });
    const second = await (await readClaimEvidence({ request: request(first.nextBefore), env: { DB, REGISTRY_STEP_UP_SECRET: ADMIN_SECRET }, params: { id: 'kp-one' } })).json();
    assert.deepEqual(second.evidence.map((row: any) => row.id), ['evidence-a']);
  });
});

// ── Recovery code ──────────────────────────────────────────────────────────

describe('recovery code', () => {
  it('generates a well-formed, grouped code from the safe alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRecoveryCode();
      assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      assert.ok(isWellFormedRecoveryCode(code));
      // No ambiguous glyphs (O, 0, I, 1) ever appear.
      assert.ok(!/[OI01]/.test(code));
    }
  });

  it('normalizes spacing, case, and hyphens to a single canonical form', () => {
    assert.equal(normalizeRecoveryCode('k7qm-9xtr-2phv-n4wb'), 'K7QM9XTR2PHVN4WB');
    assert.equal(normalizeRecoveryCode('K7QM 9XTR 2PHV N4WB'), 'K7QM9XTR2PHVN4WB');
    assert.equal(normalizeRecoveryCode('K7QM-9XTR2PHV-N4WB'), 'K7QM9XTR2PHVN4WB');
  });

  it('hashes the normalized form, so grouping is cosmetic', async () => {
    const a = await hashRecoveryCode('K7QM-9XTR-2PHV-N4WB');
    const b = await hashRecoveryCode('k7qm 9xtr2phv-n4wb');
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it('matches the worked-example hash committed in the QR registry', async () => {
    // The example plaintext lives only in the migration/doc note; the repo
    // stores only this hash. This pins the two in sync.
    const hash = await hashRecoveryCode('WORK-EDEX-AMPL-E000');
    assert.equal(
      hash,
      '4f7f0287d2909b11da94d68e90524cf37f5b93cbc77ebd28a1ab701a27d12c62',
    );
  });

  it('rejects malformed codes', () => {
    assert.equal(isWellFormedRecoveryCode('SHORT'), false);
    assert.equal(isWellFormedRecoveryCode('K7QM-9XTR-2PHV-N4W'), false); // 15 chars
    assert.equal(isWellFormedRecoveryCode('K0QM-9XTR-2PHV-N4WB'), false); // contains 0
  });
});

// ── Salted commitment (erasure-safe, matches mandalacodes) ──────────────────

describe('salted content commitment', () => {
  it('binds salt + body and is unrecomputable without the salt', async () => {
    const salt = generateSaltHex();
    assert.match(salt, /^[0-9a-f]{32}$/);
    const body = 'May this year deepen my patience.';
    const hash = await computeContentHash(salt, body);
    assert.match(hash, /^[0-9a-f]{64}$/);
    // Same salt + body → same commitment (deterministic).
    assert.equal(await computeContentHash(salt, body), hash);
    // Different salt → different commitment (erasure: drop salt, lose the link).
    assert.notEqual(await computeContentHash(generateSaltHex(), body), hash);
  });
});

// ── Birthday window gate ────────────────────────────────────────────────────

describe('birthday window', () => {
  it('opens within the window on either side of the birthday', () => {
    // Birthday June 23. Window is BIRTHDAY_WINDOW_DAYS (7) on each side.
    const onDay = birthdayWindowState('06-23', '2026-06-23T12:00:00Z');
    assert.equal(onDay.open, true);
    assert.equal(onDay.distanceDays, 0);

    const before = birthdayWindowState('06-23', '2026-06-17T00:00:00Z');
    assert.equal(before.open, true);
    assert.equal(before.distanceDays, 6);

    const after = birthdayWindowState('06-23', '2026-06-30T00:00:00Z');
    assert.equal(after.open, true);
    assert.equal(after.distanceDays, 7);
  });

  it('is closed outside the window', () => {
    const far = birthdayWindowState('06-23', '2026-09-01T00:00:00Z');
    assert.equal(far.open, false);
    const justOut = birthdayWindowState('06-23', '2026-07-01T00:00:00Z');
    assert.equal(justOut.open, false);
    assert.equal(justOut.distanceDays, BIRTHDAY_WINDOW_DAYS + 1);
  });

  it('handles the year wrap (Dec/Jan) by shortest distance', () => {
    const wrap = birthdayWindowState('12-31', '2027-01-03T00:00:00Z');
    assert.equal(wrap.distanceDays, 3);
    assert.equal(wrap.open, true);
  });

  it('fails closed on a missing or malformed birthday', () => {
    assert.equal(birthdayWindowState(null, '2026-06-23T00:00:00Z').open, false);
    assert.equal(birthdayWindowState('garbage', '2026-06-23T00:00:00Z').open, false);
    assert.equal(birthdayWindowState('13-40', '2026-06-23T00:00:00Z').open, false);
  });
});

// ── canSetMotivation gate ───────────────────────────────────────────────────

describe('canSetMotivation', () => {
  const open = { open: true, distanceDays: 0 };
  const closed = { open: false, distanceDays: 100 };

  it('allows a first motivation inside the window', () => {
    const d = canSetMotivation({ lockedYears: [], birthday: open, year: 2026 });
    assert.equal(d.ok, true);
  });

  it('blocks when the birthday window is closed', () => {
    const d = canSetMotivation({ lockedYears: [], birthday: closed, year: 2026 });
    assert.equal(d.ok, false);
    assert.equal(d.reason, 'birthday_window_closed');
  });

  it('blocks a second motivation in the same year, allows a new year', () => {
    const same = canSetMotivation({ lockedYears: [2026], birthday: open, year: 2026 });
    assert.equal(same.ok, false);
    assert.equal(same.reason, 'already_locked_this_year');

    const next = canSetMotivation({ lockedYears: [2026], birthday: open, year: 2027 });
    assert.equal(next.ok, true);
  });
});

// ── Confirm-lock state machine ──────────────────────────────────────────────

describe('confirm-before-it-sets', () => {
  it('blocks confirm until the grace floor elapses', () => {
    const created = '2026-06-23T12:00:00.000Z';
    const tooSoon = new Date(Date.parse(created) + CONFIRM_GRACE_MS - 1).toISOString();
    const ready = new Date(Date.parse(created) + CONFIRM_GRACE_MS).toISOString();

    const early = canConfirmMotivation({ createdAtIso: created, nowIso: tooSoon });
    assert.equal(early.ok, false);
    assert.equal(early.reason, 'grace_not_elapsed');
    assert.ok((early.waitMs ?? 0) > 0);

    const ok = canConfirmMotivation({ createdAtIso: created, nowIso: ready });
    assert.equal(ok.ok, true);
  });
});

describe('intentionState', () => {
  const base = { kind: 'motivation', body: 'x', confirmed_at: null, erased_at: null };
  it('derives pending → locked → erased for motivations', () => {
    assert.equal(intentionState(base), 'pending');
    assert.equal(intentionState({ ...base, confirmed_at: '2026-06-23T00:00:00Z' }), 'locked');
    assert.equal(intentionState({ ...base, erased_at: '2026-06-24T00:00:00Z' }), 'erased');
    assert.equal(intentionState({ ...base, body: null }), 'erased');
  });
  it('treats journals as open (never locking)', () => {
    assert.equal(intentionState({ ...base, kind: 'journal' }), 'open');
    assert.equal(intentionState({ ...base, kind: 'journal', confirmed_at: 'x' }), 'open');
  });
});

describe('projectIntention', () => {
  const row: IntentionRow = {
    id: 'int-1',
    piece_id: 'UL-100',
    edition_number: 0,
    author_user_id: 'user-a',
    kind: 'motivation',
    body: 'Patience.',
    body_hash: 'abc',
    content_salt: 'deadbeef',
    confirmed_at: '2026-06-23T00:00:00Z',
    sets_for_year: 2026,
    birthday_window: 1,
    created_at: '2026-06-23T00:00:00Z',
    erased_at: null,
  };

  it('returns the body to the author of a readable row', () => {
    const v = projectIntention(row, 'user-a');
    assert.equal(v.state, 'locked');
    assert.equal(v.body, 'Patience.');
    assert.equal(v.authoredByYou, true);
    assert.equal(v.setsForYear, 2026);
  });

  it('never leaks the body of an erased row', () => {
    const v = projectIntention({ ...row, erased_at: '2026-07-01T00:00:00Z', body: null }, 'user-a');
    assert.equal(v.state, 'erased');
    assert.equal(v.body, undefined);
    // The commitment is still exported for chain verification.
    assert.equal(v.contentHash, 'abc');
  });
});

describe('parseIntentionInput (whitelist)', () => {
  it('accepts a valid motivation', () => {
    const r = parseIntentionInput({ kind: 'motivation', body: '  hold steady  ' });
    assert.equal(r.ok, true);
    assert.equal(r.value?.body, 'hold steady');
  });
  it('rejects unknown fields and bad kinds', () => {
    assert.equal(parseIntentionInput({ kind: 'motivation', body: 'x', evil: 1 }).ok, false);
    assert.equal(parseIntentionInput({ kind: 'spell', body: 'x' }).ok, false);
    assert.equal(parseIntentionInput({ kind: 'journal', body: '   ' }).ok, false);
  });
});

// ── Admin piece registration endpoint ────────────────────────────────────────
// A tiny in-memory D1 stand-in. It understands only the few statement shapes the
// handler issues (a SELECT-by-piece, an INSERT, an UPDATE-of-hash, a list
// SELECT), keyed by piece_id + edition_number. Enough to exercise the
// show-code-once and refuse-overwrite rules without a real database.
function makeIssuanceDb(options: {
  collideOnce?: boolean;
  failBackupStatusOnce?: boolean;
  batchError?: string;
  draftArtworks?: Array<{ id: string; title: string; edition_size: number | null }>;
} = {}) {
  const rows: any[] = []; // keeper_pieces
  const lineage: any[] = [];
  const draftArtworks = options.draftArtworks ?? [
    { id: 'UL-100', title: 'Art of Living - 32', edition_size: null },
    { id: 'UL-101', title: 'Art of Living - 55', edition_size: null },
  ];
  let collisionPending = Boolean(options.collideOnce);
  let backupStatusFailurePending = Boolean(options.failBackupStatusOnce);

  function find(pieceId: string, edition: number) {
    return rows.find(
      (r) => r.piece_id === pieceId && r.edition_number === edition && !r.released_at,
    );
  }

  function exec(sql: string, params: any[]) {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (/^SELECT id, title, edition_size FROM registry_artworks WHERE id = \?1/i.test(s)) {
      return {
        kind: 'first',
        row: draftArtworks.find((artwork) => artwork.id === params[0]) || null,
      };
    }
    if (/^SELECT .* FROM keeper_pieces WHERE issuance_key = \?1/i.test(s)) {
      return { kind: 'first', row: rows.find((row) => row.issuance_key === params[0]) || null };
    }
    if (/^SELECT \* FROM keeper_pieces WHERE id = \?1/i.test(s)) {
      return { kind: 'first', row: rows.find((row) => row.id === params[0]) || null };
    }
    if (/^SELECT id FROM keeper_pieces WHERE piece_id = \?1 AND edition_number = \?2/i.test(s)) {
      return { kind: 'first', row: find(params[0], params[1]) || null };
    }
    if (/^SELECT id FROM keeper_pieces WHERE piece_id = \?1 AND edition_number (?:= 0|> 0)/i.test(s)) {
      const wantsUnique = /edition_number = 0/i.test(s);
      return {
        kind: 'first',
        row: rows.find((row) => (
          row.piece_id === params[0]
          && (wantsUnique ? row.edition_number === 0 : row.edition_number > 0)
        )) || null,
      };
    }
    if (/^INSERT INTO keeper_pieces/i.test(s)) {
      const [id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key,
        plate_status, plate_generated_at, front_svg_sha256, back_svg_sha256,
        ownership_code_ciphertext, ownership_code_nonce, ownership_code_key_version,
        backup_status, registered_at] = params;
      if (collisionPending) {
        collisionPending = false;
        throw new Error('UNIQUE constraint failed: keeper_pieces.public_code');
      }
      if (rows.some((r) => r.recovery_code_hash === recovery_code_hash)) {
        throw new Error('UNIQUE constraint failed: keeper_pieces.recovery_code_hash');
      }
      if (find(piece_id, edition_number)) {
        throw new Error('UNIQUE constraint failed: keeper_pieces.piece_id');
      }
      rows.push({
        id,
        piece_id,
        edition_number,
        keeper_user_id: null, recovery_code_hash, public_code, issuance_key, plate_status,
        plate_generated_at, front_svg_sha256, back_svg_sha256,
        ownership_code_ciphertext, ownership_code_nonce, ownership_code_key_version,
        backup_status,
        record_version: 0,
        current_display_location: null,
        registered_at,
        claimed_at: null,
        released_at: null,
        lineage_head_hash: null,
        lineage_event_count: 0,
      });
      return { kind: 'run' };
    }
    if (/^UPDATE keeper_pieces SET backup_status = \?1/i.test(s)) {
      if (backupStatusFailurePending) {
        backupStatusFailurePending = false;
        throw new Error('D1 status update unavailable');
      }
      const [status, reference, sha256, backupAt, id] = params;
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.backup_status = status;
        if (status === 'verified') {
          row.backup_reference = reference;
          row.backup_sha256 = sha256;
          row.backup_at = backupAt;
        }
        row.record_version += 1;
      }
      return { kind: 'run' };
    }
    if (/^INSERT INTO artwork_lineage_events/i.test(s)) {
      lineage.push(params);
      return { kind: 'run' };
    }
    if (/^UPDATE keeper_pieces SET lineage_head_hash = \?1/i.test(s)) {
      const row = rows.find((candidate) => candidate.id === params[2]);
      if (row) {
        row.lineage_head_hash = params[0];
        row.lineage_event_count = params[1];
      }
      return { kind: 'run' };
    }
    // List
    if (/^SELECT .* FROM keeper_pieces ORDER BY/i.test(s)) {
      return { kind: 'all', results: rows.slice() };
    }
    if (/^SELECT .* FROM registry_recovery_qualifications/i.test(s)) {
      return { kind: 'all', results: [] };
    }
    throw new Error(`fake D1: unhandled statement: ${s}`);
  }

  const DB = {
    async batch(statements: any[]) {
      if (options.batchError) throw new Error(options.batchError);
      return Promise.all(statements.map((statement) => statement.run()));
    },
    prepare(sql: string) {
      let bound: any[] = [];
      const stmt: any = {
        bind(...args: any[]) {
          bound = args;
          return stmt;
        },
        async first() {
          return exec(sql, bound).row ?? null;
        },
        async run() {
          exec(sql, bound);
          return { success: true, meta: { changes: 1 } };
        },
        async all() {
          return { results: exec(sql, bound).results || [] };
        },
      };
      return stmt;
    },
  };

  return { DB, rows, lineage };
}

function makeBackupBucket({ fail = false } = {}) {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
    async put(key: string, value: Uint8Array) {
      if (fail) throw new Error('backup unavailable');
      if (objects.has(key)) return null;
      objects.set(key, value.slice());
      return { key };
    },
    async get(key: string) {
      const value = objects.get(key);
      return value === undefined ? null : {
        text: async () => new TextDecoder().decode(value),
        arrayBuffer: async () => value.slice().buffer,
      };
    },
  };
}

const OWNERSHIP_TEST_KEY = Buffer.alloc(32, 23).toString('base64');
function issuanceEnv(DB: any, failBackup = false) {
  return {
    REGISTRY_STEP_UP_SECRET: ADMIN_SECRET,
    DB,
    OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
    OWNERSHIP_CODE_KEY_V1: OWNERSHIP_TEST_KEY,
    ARTWORK_REGISTRY_BACKUP: makeBackupBucket({ fail: failBackup }),
  };
}

function adminReq(method: string, body?: unknown) {
  return new Request('https://adrianrasmussen.com/api/admin/pieces', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: ADMIN_COOKIES,
      Origin: 'https://adrianrasmussen.com',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('admin artwork edition overlays', () => {
  function makeArtworkOverlayDb(keeperEditions: number[] = []) {
    const stored: any[] = [];
    const DB = {
      prepare(sql: string) {
        const statement = {
          values: [] as any[],
          bind(...values: any[]) { statement.values = values; return statement; },
          async first() {
            if (!/FROM keeper_pieces WHERE piece_id = \?1/i.test(sql.replace(/\s+/g, ' '))) {
              throw new Error(`unexpected first SQL: ${sql}`);
            }
            const positive = keeperEditions.filter((edition) => edition > 0);
            return {
              has_unique: keeperEditions.includes(0) ? 1 : 0,
              highest_numbered_edition: positive.length ? Math.max(...positive) : null,
            };
          },
          async run() {
            if (!/^INSERT INTO registry_artworks/i.test(sql.trim())) throw new Error(`unexpected run SQL: ${sql}`);
            const [id, title, series, edition_size, created_at] = statement.values;
            stored.push({ id, title, series, edition_size, created_at });
            return { success: true };
          },
        };
        return statement;
      },
    };
    return { DB, stored };
  }

  it('stores an explicit static-catalog edition structure with canonical metadata', async () => {
    const { DB, stored } = makeArtworkOverlayDb();
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const response = await adminArtworks({
        request: adminReq('POST', {
          id: 'UL-100',
          title: 'Forged title',
          series: 'Forged series',
          editionKind: 'numbered',
          editionSize: 12,
        }),
        env: { REGISTRY_STEP_UP_SECRET: ADMIN_SECRET, DB },
      });
      assert.equal(response.status, 201);
      const body = await response.json();
      assert.equal(body.artwork.title, 'Art of Living - 32');
      assert.equal(body.artwork.series, 'Universal Language');
      assert.equal(body.artwork.editionKind, 'numbered');
      assert.equal(body.artwork.editionSize, 12);
      assert.equal(stored[0].title, 'Art of Living - 32');
      assert.equal(stored[0].series, 'Universal Language');
      assert.equal(stored[0].edition_size, 12);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('rejects edition overlays that contradict already-issued identities or their maximum', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const cases = [
        { editions: [1], input: { editionKind: 'unique', uniqueConfirmed: true }, error: 'existing_numbered_editions' },
        { editions: [0], input: { editionKind: 'numbered', editionSize: 3 }, error: 'existing_unique_edition' },
        { editions: [1, 5], input: { editionKind: 'numbered', editionSize: 4 }, error: 'edition_size_below_issued' },
      ];
      for (const testCase of cases) {
        const { DB, stored } = makeArtworkOverlayDb(testCase.editions);
        const response = await adminArtworks({
          request: adminReq('POST', { id: 'UL-162', ...testCase.input }),
          env: { REGISTRY_STEP_UP_SECRET: ADMIN_SECRET, DB },
        });
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), { ok: false, error: testCase.error });
        assert.equal(stored.length, 0);
      }

      const maximum = makeArtworkOverlayDb([1, 5]);
      const accepted = await adminArtworks({
        request: adminReq('POST', { id: 'UL-162', editionKind: 'numbered', editionSize: 5 }),
        env: { REGISTRY_STEP_UP_SECRET: ADMIN_SECRET, DB: maximum.DB },
      });
      assert.equal(accepted.status, 201);
      assert.equal(maximum.stored[0].edition_size, 5);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('rejects a contradictory static overlay before persistence but permits an exact match', async () => {
    const staticArtwork = findStaticArtwork('UL-100');
    assert.ok(staticArtwork);
    const originalEditionSize = staticArtwork!.editionSize;
    staticArtwork!.editionSize = 12;
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const conflictDb = makeArtworkOverlayDb();
      const conflict = await adminArtworks({
        request: adminReq('POST', { id: 'UL-100', editionKind: 'numbered', editionSize: 11 }),
        env: { REGISTRY_STEP_UP_SECRET: ADMIN_SECRET, DB: conflictDb.DB },
      });
      assert.equal(conflict.status, 409);
      assert.deepEqual(await conflict.json(), { ok: false, error: 'artwork_edition_metadata_conflict' });
      assert.equal(conflictDb.stored.length, 0);

      const exactDb = makeArtworkOverlayDb();
      const exact = await adminArtworks({
        request: adminReq('POST', { id: 'UL-100', editionKind: 'numbered', editionSize: 12 }),
        env: { REGISTRY_STEP_UP_SECRET: ADMIN_SECRET, DB: exactDb.DB },
      });
      assert.equal(exact.status, 201);
      assert.equal(exactDb.stored[0].edition_size, 12);
    } finally {
      staticArtwork!.editionSize = originalEditionSize;
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });
});

describe('admin piece registration', () => {
  it('404s while the livingLegacy flag is off (surface stays invisible)', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = false;
    try {
      const { DB } = makeIssuanceDb();
      const res = await adminPieces({
        request: adminReq('POST', { pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'request-1' }),
        env: { REGISTRY_STEP_UP_SECRET: ADMIN_SECRET, DB },
      });
      assert.equal(res.status, 404);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('401s an unauthenticated caller before doing any work', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB } = makeIssuanceDb();
      const noCookie = new Request('https://adrianrasmussen.com/api/admin/pieces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pieceId: 'UL-100' }),
      });
      const res = await adminPieces({ request: noCookie, env: { REGISTRY_STEP_UP_SECRET: ADMIN_SECRET, DB } });
      assert.equal(res.status, 401);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('requires a recent identity-bound registry unlock before issuance', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB, rows } = makeIssuanceDb();
      const lockedRequest = adminReq('POST', {
        pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'locked-issuance',
      });
      lockedRequest.headers.set('Cookie', 'better-auth.session_token=admin-session');
      const response = await adminPieces({ request: lockedRequest, env: issuanceEnv(DB) });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { ok: false, error: 'registry_locked' });
      assert.equal(rows.length, 0);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('rejects invalid editions and missing issuance keys before replay lookup', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB } = makeIssuanceDb();
      const env = issuanceEnv(DB);
      assert.equal((await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionNumber: -1, issuanceKey: 'b' }), env })).status, 400);
      assert.equal((await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionNumber: 10000, issuanceKey: 'b-max' }), env })).status, 400);
      assert.equal((await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionNumber: 1.5, issuanceKey: 'c' }), env })).status, 400);
      assert.equal((await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionNumber: 0 }), env })).status, 400);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('routes every new identity through artwork registration without keeper, lineage, or backup writes', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      for (const testCase of [
        {
          label: 'unique catalog artwork',
          options: {},
          body: {
            pieceId: 'UL-100', editionKind: 'unique', editionNumber: 0,
            uniqueConfirmed: true, issuanceKey: 'retired-unique-mint',
          },
        },
        {
          label: 'numbered registry artwork',
          options: {
            draftArtworks: [{ id: 'MD-905', title: 'Edition Study', edition_size: 3 }],
          },
          body: {
            pieceId: 'MD-905', editionKind: 'numbered', editionNumber: 3,
            issuanceKey: 'retired-numbered-mint',
          },
        },
        {
          label: 'unknown artwork',
          options: {},
          body: {
            pieceId: 'NOPE', editionKind: 'unique', editionNumber: 0,
            uniqueConfirmed: true, issuanceKey: 'retired-unknown-mint',
          },
        },
      ]) {
        const registry = makeIssuanceDb(testCase.options);
        const bucket = makeBackupBucket();
        const response = await adminPieces({
          request: adminReq('POST', testCase.body),
          env: { ...issuanceEnv(registry.DB), ARTWORK_REGISTRY_BACKUP: bucket },
        });

        assert.equal(response.status, 409, testCase.label);
        assert.deepEqual(await response.json(), {
          ok: false, error: 'artwork_registration_required',
        });
        assert.equal(registry.rows.length, 0, testCase.label);
        assert.equal(registry.lineage.length, 0, testCase.label);
        assert.equal(bucket.objects.size, 0, testCase.label);
      }
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('replays and repairs only a seeded generated issuance with the exact issuance key', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const registry = makeIssuanceDb();
      const bucket = makeBackupBucket();
      const env = { ...issuanceEnv(registry.DB), ARTWORK_REGISTRY_BACKUP: bucket };
      const { createRegistryPlateCandidate } = await import(
        '../functions/api/_lib/registryPlateIssuance.js'
      );
      const candidate = await createRegistryPlateCandidate(env, {
        keeperPieceId: 'kp-existing-replay',
        pieceId: 'UL-100',
        editionNumber: 0,
        issuanceKey: 'existing-replay',
        publicCode: 'AR-7KQ9M2WX',
        ownershipCode: 'ABCD-EFGH-JKLM-NPQR',
        generatedAt: '2026-07-13T00:00:00.000Z',
      });
      registry.rows.push({
        id: candidate.id,
        piece_id: candidate.pieceId,
        edition_number: candidate.editionNumber,
        keeper_user_id: null,
        recovery_code_hash: candidate.verifier,
        public_code: candidate.publicCode,
        issuance_key: candidate.issuanceKey,
        plate_status: 'generated',
        plate_generated_at: candidate.generatedAt,
        front_svg_sha256: candidate.plate.frontSha256,
        back_svg_sha256: candidate.plate.undersideSha256,
        ownership_code_ciphertext: candidate.envelope.ciphertext,
        ownership_code_nonce: candidate.envelope.nonce,
        ownership_code_key_version: candidate.envelope.keyVersion,
        backup_status: 'pending',
        record_version: 0,
        registered_at: candidate.generatedAt,
        claimed_at: null,
        released_at: null,
        lineage_head_hash: candidate.lineageEvent.eventHash,
        lineage_event_count: 1,
      });

      const body = {
        pieceId: 'UL-100', editionKind: 'unique', editionNumber: 0,
        uniqueConfirmed: true, issuanceKey: 'existing-replay',
      };
      const replay = await adminPieces({ request: adminReq('POST', body), env });
      const replayBody = await replay.json();

      assert.equal(replay.status, 200);
      assert.equal(replayBody.ok, true);
      assert.equal(replayBody.ownershipCode, candidate.ownershipCode);
      assert.equal(replayBody.publicCode, candidate.publicCode);
      assert.equal(replayBody.backupStatus, 'verified');
      assert.equal(registry.rows.length, 1);
      assert.equal(registry.rows[0].backup_status, 'verified');
      assert.equal(registry.lineage.length, 0);
      assert.equal(bucket.objects.size, 1);

      const conflict = await adminPieces({
        request: adminReq('POST', { ...body, pieceId: 'UL-101' }),
        env,
      });
      assert.equal(conflict.status, 409);
      assert.deepEqual(await conflict.json(), {
        ok: false, error: 'idempotency_conflict',
      });
      assert.equal(registry.rows.length, 1);
      assert.equal(registry.lineage.length, 0);
      assert.equal(bucket.objects.size, 1);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('never decrypts or replays a seeded package after the plate leaves generated state', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const registry = makeIssuanceDb();
      registry.rows.push({
        id: 'kp-active-replay',
        piece_id: 'UL-100',
        edition_number: 0,
        issuance_key: 'locked-after-activation',
        plate_status: 'active',
        ownership_code_ciphertext: 'not-valid-base64',
      });

      const locked = await adminPieces({
        request: adminReq('POST', {
          pieceId: 'UL-100', editionKind: 'unique', editionNumber: 0,
          uniqueConfirmed: true, issuanceKey: 'locked-after-activation',
        }),
        env: issuanceEnv(registry.DB),
      });
      assert.equal(locked.status, 409);
      assert.deepEqual(await locked.json(), {
        ok: false, error: 'plate_identity_locked',
      });
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });
  it('returns a safe 503 when ownership-code crypto is not configured', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB, rows } = makeIssuanceDb();
      const res = await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'no-key' }), env: { REGISTRY_STEP_UP_SECRET: ADMIN_SECRET, DB } });
      assert.equal(res.status, 503);
      assert.equal(rows.length, 0);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('returns a safe 503 for malformed ownership-code keys before inserting', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      for (const key of ['not-base64!', Buffer.alloc(31).toString('base64')]) {
        const { DB, rows } = makeIssuanceDb();
        const env = {
          ...issuanceEnv(DB),
          OWNERSHIP_CODE_KEY_V1: key,
        };
        const response = await adminPieces({
          request: adminReq('POST', {
            pieceId: 'UL-100', editionNumber: 0, issuanceKey: `bad-key-${key.length}`,
          }),
          env,
        });
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), {
          ok: false, error: 'ownership_code_crypto_not_configured',
        });
        assert.equal(rows.length, 0);
      }
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('rejects non-canonical or non-round-trippable key versions before issuance', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      for (const version of ['01', '0', '-1', '1.5', '+1', '9007199254740992']) {
        const { DB, rows } = makeIssuanceDb();
        const response = await adminPieces({
          request: adminReq('POST', {
            pieceId: 'UL-100', editionNumber: 0, issuanceKey: `bad-version-${version}`,
          }),
          env: {
            ...issuanceEnv(DB),
            OWNERSHIP_CODE_ACTIVE_KEY_VERSION: version,
            [`OWNERSHIP_CODE_KEY_V${version}`]: OWNERSHIP_TEST_KEY,
          },
        });

        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), {
          ok: false, error: 'ownership_code_crypto_not_configured',
        });
        assert.equal(rows.length, 0);
      }
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });
});

describe('encrypted plate backup adapter', () => {
  it('demotes every pre-content-addressed verified backup during migration', () => {
    const migration = readMigration('021_registry_plate_backup_digest.sql');
    assert.match(migration, /UPDATE keeper_pieces[\s\S]*SET backup_status = 'pending', backup_reference = NULL, backup_at = NULL[\s\S]*WHERE backup_status = 'verified'/);
  });

  it('builds deterministic backup bytes and a content-addressed reference', async () => {
    const encryptedRow = {
      ownership_code_nonce: 'stored-nonce',
      public_code: 'AR-ABCDEFGH',
      ownership_code_key_version: 7,
      piece_id: 'UL-100',
      ownership_code_ciphertext: 'stored-ciphertext',
      plate_generated_at: '2026-07-13T00:00:00.000Z',
      edition_number: 0,
    };
    const document = buildBackupDocument(encryptedRow);
    const bytes = new TextEncoder().encode(JSON.stringify(document));
    const sha256 = createHash('sha256').update(bytes).digest('hex');

    assert.equal(await backupDocumentSha256(bytes), sha256);
    assert.deepEqual(parseBackupDocument(bytes), document);
    assert.deepEqual(parseBackupDocument(JSON.stringify(document)), document);
  });

  it('conditionally creates once and accepts only a byte-identical retry race', async () => {
    const writes: Array<{ key: string; value: string; options: any }> = [];
    const objects = new Map<string, string>();
    const bucket = {
      async put(key: string, value: Uint8Array, options: any) {
        const serialized = new TextDecoder().decode(value);
        writes.push({ key, value: serialized, options });
        if (objects.has(key)) return null;
        objects.set(key, serialized);
        return { key };
      },
      async get(key: string) {
        const stored = objects.get(key);
        return stored === undefined ? null : {
          text: async () => stored,
          arrayBuffer: async () => new TextEncoder().encode(stored).buffer,
        };
      },
    };
    const encryptedRow = {
      public_code: 'AR-ABCDEFGH',
      piece_id: 'UL-100',
      edition_number: 0,
      plate_generated_at: '2026-07-13T00:00:00.000Z',
      ownership_code_ciphertext: 'stored-ciphertext',
      ownership_code_nonce: 'stored-nonce',
      ownership_code_key_version: 7,
    };

    const first = await backupPlateEnvelope(bucket, encryptedRow);
    const second = await backupPlateEnvelope(bucket, encryptedRow);
    assert.equal(first.status, 'verified');
    assert.deepEqual(second, first);
    assert.match(first.reference, /^plates\/AR-ABCDEFGH\/[0-9a-f]{64}\.json$/);
    assert.equal(first.sha256, first.reference.split('/').at(-1)?.replace('.json', ''));
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[0].options.onlyIf, { etagDoesNotMatch: '*' });
    assert.equal(writes[0].value, writes[1].value);
    assert.deepEqual(JSON.parse(writes[1].value).envelope, {
      ciphertext: 'stored-ciphertext', nonce: 'stored-nonce', keyVersion: '7',
    });
  });

  it('refuses a pre-existing object whose bytes conflict with its digest address', async () => {
    const bucket = {
      async put() { return null; },
      async get() {
        return {
          arrayBuffer: async () => new TextEncoder().encode('{"conflict":true}').buffer,
        };
      },
    };
    const result = await backupPlateEnvelope(bucket, {
      public_code: 'AR-ABCDEFGH', piece_id: 'UL-100', edition_number: 0,
      plate_generated_at: '2026-07-13T00:00:00.000Z',
      ownership_code_ciphertext: 'stored-ciphertext', ownership_code_nonce: 'stored-nonce',
      ownership_code_key_version: 7,
    });
    assert.equal(result.status, 'failed');
    assert.match(result.reference, /^plates\/AR-ABCDEFGH\/[0-9a-f]{64}\.json$/);
    assert.match(result.sha256, /^[0-9a-f]{64}$/);
  });

  it('refuses to attach a completed backup after the registry row changed', async () => {
    let sql = '';
    const db = {
      prepare(statement: string) {
        sql = statement.replace(/\s+/g, ' ').trim();
        return {
          bind() { return this; },
          async run() { return { success: true, meta: { changes: 0 } }; },
        };
      },
    };
    await assert.rejects(
      recordPlateBackupResult(db, {
        id: 'kp-stale', record_version: 4, public_code: 'AR-ABCDEFGH',
        piece_id: 'UL-100', edition_number: 0,
        plate_generated_at: '2026-07-31T00:00:00.000Z',
        front_svg_sha256: 'a'.repeat(64), back_svg_sha256: 'b'.repeat(64),
        ownership_code_ciphertext: 'cipher', ownership_code_nonce: 'nonce',
        ownership_code_key_version: 1, recovery_code_hash: 'c'.repeat(64),
      }, {
        status: 'verified', reference: `plates/AR-ABCDEFGH/${'d'.repeat(64)}.json`,
        sha256: 'd'.repeat(64),
      }),
      /stale backup attempt/,
    );
    assert.match(sql, /record_version = \?6/);
    assert.match(sql, /ownership_code_ciphertext = \?13/);
    assert.match(sql, /recovery_code_hash = \?16/);
  });

  it('treats an identical concurrent backup status winner as success', async () => {
    const { backupRegistryPlate } = await import('../functions/api/_lib/registryPlateIssuance.js');
    const row: any = {
      id: 'kp-race', record_version: 4, public_code: 'AR-ABCDEFGH',
      piece_id: 'UL-100', edition_number: 0,
      plate_generated_at: '2026-07-31T00:00:00.000Z',
      front_svg_sha256: 'a'.repeat(64), back_svg_sha256: 'b'.repeat(64),
      ownership_code_ciphertext: 'cipher', ownership_code_nonce: 'nonce',
      ownership_code_key_version: 1, recovery_code_hash: 'c'.repeat(64),
      backup_status: 'pending', backup_reference: null, backup_sha256: null,
    };
    const current = { ...row };
    let reads = 0;
    const DB = {
      prepare(sql: string) {
        const statement: any = {
          values: [] as any[],
          bind(...values: any[]) { statement.values = values; return statement; },
          async first() {
            assert.match(sql, /SELECT \* FROM keeper_pieces WHERE id = \?1/);
            reads += 1;
            return reads === 1 ? { ...row } : { ...current };
          },
          async run() {
            assert.match(sql, /^UPDATE keeper_pieces/i);
            current.backup_status = 'verified';
            current.backup_reference = statement.values[1];
            current.backup_sha256 = statement.values[2];
            current.backup_at = statement.values[3];
            current.record_version += 1;
            return { success: true, meta: { changes: 0 } };
          },
        };
        return statement;
      },
    };
    const result = await backupRegistryPlate({
      DB,
      ARTWORK_REGISTRY_BACKUP: makeBackupBucket(),
    }, row);
    assert.deepEqual(result, { status: 'verified' });
    assert.equal(row.backup_status, 'verified');
    assert.match(row.backup_reference, /^plates\/AR-ABCDEFGH\/[0-9a-f]{64}\.json$/);
    assert.equal(reads, 2);
  });

  it('preserves a committed package outcome when the post-commit row reload is unavailable', async () => {
    const { backupRegistryPlate } = await import('../functions/api/_lib/registryPlateIssuance.js');
    let bucketTouched = false;
    const result = await backupRegistryPlate({
      DB: {
        prepare() {
          return {
            bind() { return this; },
            async first() { throw new Error('D1 read unavailable'); },
          };
        },
      },
      ARTWORK_REGISTRY_BACKUP: {
        async put() { bucketTouched = true; },
      },
    }, { id: 'kp-committed', backup_status: 'pending' });
    assert.deepEqual(result, {
      status: 'pending', warning: 'backup_status_record_failed',
    });
    assert.equal(bucketTouched, false);
  });
});

type LifecycleFixtureOptions = {
  status?: 'generated' | 'active';
  backupStatus?: 'pending' | 'failed' | 'verified';
  failAudit?: boolean;
  raceActivation?: boolean;
  raceBackup?: boolean;
};

async function makePlateLifecycleFixture(options: LifecycleFixtureOptions = {}) {
  const ownershipCode = 'K7QM-9XTR-2PHV-N4WB';
  const generatedAt = '2026-07-13T10:20:30.000Z';
  const plate = await buildArtworkPlatePackage({
    publicCode: 'AR-7KQ9M2WX',
    ownershipCode,
    artworkId: 'UL-100',
    editionNumber: 2,
    generatedAt,
  });
  const envelope = await encryptOwnershipCode(
    ownershipCode,
    { publicCode: 'AR-7KQ9M2WX', pieceId: 'UL-100', editionNumber: 2 },
    {
      OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
      OWNERSHIP_CODE_KEY_V1: OWNERSHIP_TEST_KEY,
    },
  );
  const rows: any[] = [{
    id: 'kp-one', piece_id: 'UL-100', edition_number: 2,
    public_code: 'AR-7KQ9M2WX', plate_status: options.status || 'generated',
    plate_generated_at: generatedAt,
    plate_activated_at: options.status === 'active' ? '2026-07-13T12:00:00.000Z' : null,
    front_svg_sha256: plate.frontSha256, back_svg_sha256: plate.undersideSha256,
    ownership_code_ciphertext: envelope.ciphertext,
    ownership_code_nonce: envelope.nonce,
    ownership_code_key_version: envelope.keyVersion,
    recovery_code_hash: await hashRecoveryCode(ownershipCode),
    backup_status: options.backupStatus || 'verified',
    backup_reference: null, backup_sha256: null, backup_at: null,
    record_version: 1,
    lineage_head_hash: null, lineage_event_count: 0,
  }, {
    id: 'kp-other', piece_id: 'UL-101', edition_number: 1,
    public_code: 'AR-ABCDEFGH', plate_status: 'generated',
    plate_generated_at: generatedAt, plate_activated_at: null,
    front_svg_sha256: 'other-front', back_svg_sha256: 'other-back',
    ownership_code_ciphertext: 'other-ciphertext', ownership_code_nonce: 'other-nonce',
    ownership_code_key_version: 1, recovery_code_hash: 'other-verifier', backup_status: 'verified',
    backup_reference: null, backup_sha256: null, backup_at: null,
    lineage_head_hash: null, lineage_event_count: 0,
  }];
  const audits: any[] = [];
  const lineage: any[] = [];
  const operations: string[] = [];
  const backupDocument = JSON.stringify({
    schemaVersion: 1,
    publicCode: rows[0].public_code,
    pieceId: rows[0].piece_id,
    editionNumber: rows[0].edition_number,
    plateGeneratedAt: rows[0].plate_generated_at,
    envelope: {
      ciphertext: rows[0].ownership_code_ciphertext,
      nonce: rows[0].ownership_code_nonce,
      keyVersion: String(rows[0].ownership_code_key_version),
    },
  });
  rows[0].backup_sha256 = createHash('sha256').update(backupDocument).digest('hex');
  rows[0].backup_reference = `plates/${rows[0].public_code}/${rows[0].backup_sha256}.json`;
  const qualifications: any[] = [{
    id: 'rq-current', keeper_piece_id: rows[0].id, result: 'passed', copied_artifacts: 1,
    schema_version: '1', build_version: 'registry-recovery-build-v1', key_version: 1,
    generator_version: 'artwork-plate-v1', verifier_version: 'copied-plate-v1',
    backup_reference: rows[0].backup_reference, backup_sha256: rows[0].backup_sha256,
    qualified_at: '2026-07-13T10:30:00.000Z',
  }];

  function statement(sql: string) {
    let params: any[] = [];
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const stmt: any = {
      bind(...values: any[]) { params = values; return stmt; },
      async first() {
        operations.push(normalized);
        if (/^SELECT \* FROM keeper_pieces WHERE id = \?1/i.test(normalized)) {
          return rows.find((row) => row.id === params[0]) || null;
        }
        if (/^SELECT id, result, copied_artifacts, schema_version/i.test(normalized)) {
          return qualifications.find((item) => item.keeper_piece_id === params[0]) || null;
        }
        if (/^SELECT lineage_head_hash, lineage_event_count FROM keeper_pieces/i.test(normalized)) {
          return rows.find((row) => row.id === params[0]) || null;
        }
        if (/^SELECT sequence, event_hash FROM artwork_lineage_events/i.test(normalized)) {
          const prior = lineage.filter((event) => event[1] === params[0]).at(-1);
          return prior ? { sequence: prior[2], event_hash: prior[6] } : null;
        }
        throw new Error(`lifecycle D1 first: ${normalized}`);
      },
      async run() {
        operations.push(normalized);
        if (/^INSERT INTO ownership_code_audit/i.test(normalized)) {
          if (options.failAudit) throw new Error('audit unavailable');
          const [id, keeper_piece_id, action, request_id, outcome, created_at] = params;
          audits.push({ id, keeper_piece_id, action, request_id, outcome, created_at });
          return { success: true, meta: { changes: 1 } };
        }
        if (/^INSERT INTO artwork_lineage_events/i.test(normalized)) {
          lineage.push(params);
          return { success: true, meta: { changes: 1 } };
        }
        if (/^UPDATE keeper_pieces SET lineage_head_hash = \?1/i.test(normalized)) {
          const row = rows.find((item) => item.id === params[2]);
          if (!row) return { success: true, meta: { changes: 0 } };
          row.lineage_head_hash = params[0];
          row.lineage_event_count = params[1];
          return { success: true, meta: { changes: 1 } };
        }
        if (/^UPDATE keeper_pieces SET backup_status = \?1/i.test(normalized)) {
          const [status, reference, sha256, at, id] = params;
          const row = rows.find((item) => item.id === id);
          if (!row) return { success: true, meta: { changes: 0 } };
          row.backup_status = status;
          if (status === 'verified') {
            Object.assign(row, {
              backup_reference: reference,
              backup_sha256: sha256,
              backup_at: at,
            });
          }
          if (options.raceBackup) {
            row.record_version += 1;
            return { success: true, meta: { changes: 0 } };
          }
          return { success: true, meta: { changes: 1 } };
        }
        if (/^UPDATE keeper_pieces SET plate_status = 'active'/i.test(normalized)) {
          const [activatedAt, id] = params;
          if (options.raceActivation) {
            const raced = rows.find((item) => item.id === id && item.plate_status === 'generated');
            if (raced) {
              raced.plate_status = 'active';
              raced.plate_activated_at = '2026-07-13T11:59:59.000Z';
            }
          }
          const row = rows.find((item) => item.id === id && item.plate_status === 'generated');
          if (!row) return { success: true, meta: { changes: 0 } };
          row.plate_status = 'active';
          row.plate_activated_at = activatedAt;
          return { success: true, meta: { changes: 1 } };
        }
        throw new Error(`lifecycle D1 run: ${normalized}`);
      },
    };
    return stmt;
  }

  const DB = {
    prepare: statement,
    async batch(statements: any[]) { return Promise.all(statements.map((item) => item.run())); },
  };
  return { DB, rows, audits, lineage, operations, ownershipCode, plate, qualifications, backupDocument };
}

function lifecycleRequest(path: string, method: string, body?: unknown, options: {
  cookie?: boolean; unlock?: boolean; origin?: string;
} = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.cookie !== false) {
    headers.Cookie = options.unlock === false
      ? 'better-auth.session_token=admin-session'
      : ADMIN_COOKIES;
  }
  if (options.origin !== '') headers.Origin = options.origin || 'https://adrianrasmussen.com';
  return new Request(`https://adrianrasmussen.com${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function lifecycleEnv(DB: any, bucket: any = makeBackupBucket()) {
  return {
    REGISTRY_STEP_UP_SECRET: ADMIN_SECRET,
    DB,
    OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
    OWNERSHIP_CODE_KEY_V1: OWNERSHIP_TEST_KEY,
    ARTWORK_REGISTRY_BACKUP: bucket,
  };
}

const validActivation = (plate: { frontSha256: string; undersideSha256: string }) => ({
  frontSha256: plate.frontSha256,
  undersideSha256: plate.undersideSha256,
  realMetalQrScanned: true,
  artworkEditionPublicCodeMatch: true,
  undersideOwnershipCodeMatch: true,
  attachmentAndAbrasionInspected: true,
});

describe('admin artwork plate lifecycle', () => {
  it('allows POST only and requires central admin, same origin, and a recent registry unlock', async () => {
    const fixture = await makePlateLifecycleFixture();
    const env = lifecycleEnv(fixture.DB);
    const path = '/api/admin/pieces/kp-one/reveal';

    const method = await revealArtworkPlate({ request: lifecycleRequest(path, 'GET'), env, params: { id: 'kp-one' } });
    assert.equal(method.status, 405);
    assert.equal(method.headers.get('Cache-Control'), 'no-store');
    assert.equal((await revealArtworkPlate({
      request: lifecycleRequest(path, 'POST', {}, { cookie: false }),
      env, params: { id: 'kp-one' },
    })).status, 401);
    assert.equal((await revealArtworkPlate({
      request: lifecycleRequest(path, 'POST', {}, { origin: '' }),
      env, params: { id: 'kp-one' },
    })).status, 403);
    assert.equal((await revealArtworkPlate({
      request: lifecycleRequest(path, 'POST', {}, { unlock: false }),
      env, params: { id: 'kp-one' },
    })).status, 403);
    assert.equal(fixture.audits.length, 0);
  });

  it('audits before decrypting and reveals only the requested existing identity package', async () => {
    const fixture = await makePlateLifecycleFixture();
    const response = await revealArtworkPlate({
      request: lifecycleRequest('/api/admin/pieces/kp-one/reveal', 'POST', {}),
      env: lifecycleEnv(fixture.DB), params: { id: 'kp-one' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(Object.keys(body).sort(), ['ok', 'ownershipCode', 'undersideSvg']);
    assert.equal(body.ownershipCode, fixture.ownershipCode);
    assert.equal(body.undersideSvg, fixture.plate.undersideSvg);
    for (const forbidden of [
      'frontSvg', 'manifest', 'publicCode', 'publicUrl', 'frontSha256', 'undersideSha256',
    ]) {
      assert.equal(forbidden in body, false);
    }
    assert.equal(fixture.audits.length, 1);
    assert.equal(fixture.audits[0].keeper_piece_id, 'kp-one');
    assert.equal(fixture.audits[0].action, 'reveal');
    assert.equal(JSON.stringify(fixture.audits).includes(fixture.ownershipCode), false);
    assert.equal(fixture.rows[1].ownership_code_ciphertext, 'other-ciphertext');
  });

  it('fails closed when decrypted Ownership Code does not match the stored verifier', async () => {
    const fixture = await makePlateLifecycleFixture();
    fixture.rows[0].recovery_code_hash = await hashRecoveryCode('AAAA-BBBB-CCCC-DDDD');

    const response = await revealArtworkPlate({
      request: lifecycleRequest(
        '/api/admin/pieces/kp-one/reveal',
        'POST',
        {},
      ),
      env: lifecycleEnv(fixture.DB),
      params: { id: 'kp-one' },
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.deepEqual(body, { ok: false, error: 'ownership_code_verifier_mismatch' });
    assert.equal('ownershipCode' in body, false);
    assert.equal('undersideSvg' in body, false);
  });

  it('refuses recovery when the required pre-decryption audit cannot be written', async () => {
    const fixture = await makePlateLifecycleFixture({ failAudit: true });
    fixture.rows[0].ownership_code_ciphertext = 'malformed-ciphertext';
    const response = await revealArtworkPlate({
      request: lifecycleRequest('/api/admin/pieces/kp-one/reveal', 'POST', {}),
      env: lifecycleEnv(fixture.DB), params: { id: 'kp-one' },
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: 'audit_unavailable' });
  });

  it('retries R2 from the stored envelope without decrypting and records verified or failed honestly', async () => {
    const fixture = await makePlateLifecycleFixture({ backupStatus: 'failed' });
    fixture.rows[0].ownership_code_ciphertext = 'stored-ciphertext-without-a-valid-key-envelope';
    const writes: string[] = [];
    let fail = false;
    const bucket = {
      async put(_key: string, value: Uint8Array) {
        if (fail) throw new Error('R2 down');
        writes.push(new TextDecoder().decode(value));
        return { key: _key };
      },
      async get(key: string) {
        if (fail) throw new Error('R2 down');
        const value = writes.at(-1);
        return value ? {
          text: async () => value,
          arrayBuffer: async () => new TextEncoder().encode(value).buffer,
        } : null;
      },
    };
    const env = lifecycleEnv(fixture.DB, bucket);
    const request = () => lifecycleRequest('/api/admin/pieces/kp-one/backup', 'POST', {});

    const verified = await retryArtworkPlateBackup({ request: request(), env, params: { id: 'kp-one' } });
    assert.equal(verified.status, 200);
    assert.equal((await verified.json()).backupStatus, 'verified');
    assert.equal(fixture.rows[0].backup_status, 'verified');
    assert.match(writes[0], /stored-ciphertext-without-a-valid-key-envelope/);
    const knownGoodReference = fixture.rows[0].backup_reference;
    const knownGoodSha256 = fixture.rows[0].backup_sha256;
    assert.match(knownGoodReference, /^plates\/AR-7KQ9M2WX\/[0-9a-f]{64}\.json$/);
    assert.match(knownGoodSha256, /^[0-9a-f]{64}$/);

    const downloaded = await retryArtworkPlateBackup({
      request: lifecycleRequest('/api/admin/pieces/kp-one/backup', 'GET'),
      env,
      params: { id: 'kp-one' },
    });
    assert.equal(downloaded.status, 200);
    assert.match(downloaded.headers.get('Content-Disposition') || '', /encrypted-recovery\.json/);
    assert.equal(createHash('sha256').update(await downloaded.text()).digest('hex'), knownGoodSha256);

    fail = true;
    const failed = await retryArtworkPlateBackup({ request: request(), env, params: { id: 'kp-one' } });
    assert.equal(failed.status, 503);
    assert.equal((await failed.json()).backupStatus, 'failed');
    assert.equal(fixture.rows[0].backup_status, 'failed');
    assert.equal(fixture.rows[0].backup_reference, knownGoodReference);
    assert.equal(fixture.rows[0].backup_sha256, knownGoodSha256);
    assert.equal(failed.headers.get('Cache-Control'), 'no-store');
  });

  it('reports an identical concurrent manual backup retry as verified success', async () => {
    const fixture = await makePlateLifecycleFixture({ backupStatus: 'pending', raceBackup: true });
    const response = await retryArtworkPlateBackup({
      request: lifecycleRequest('/api/admin/pieces/kp-one/backup', 'POST', {}),
      env: lifecycleEnv(fixture.DB),
      params: { id: 'kp-one' },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.backupStatus, 'verified');
    assert.match(body.backupReference, /^plates\/AR-7KQ9M2WX\/[0-9a-f]{64}\.json$/);
    assert.equal(body.backupSha256, body.backupReference.split('/').at(-1).replace('.json', ''));
  });

  it('requires verified backup, exact hashes, and every physical inspection confirmation', async () => {
    const fixture = await makePlateLifecycleFixture({ backupStatus: 'failed' });
    const env = lifecycleEnv(fixture.DB);
    const path = '/api/admin/pieces/kp-one/activate';
    const call = (body: unknown) => activateArtworkPlate({
      request: lifecycleRequest(path, 'POST', body), env, params: { id: 'kp-one' },
    });

    assert.equal((await call(validActivation(fixture.plate))).status, 409);
    fixture.rows[0].backup_status = 'verified';
    assert.equal((await call({ ...validActivation(fixture.plate), frontSha256: 'wrong' })).status, 409);
    assert.equal((await call({ ...validActivation(fixture.plate), realMetalQrScanned: false })).status, 400);
    fixture.qualifications.length = 0;
    const unqualified = await call(validActivation(fixture.plate));
    assert.equal(unqualified.status, 409);
    assert.deepEqual(await unqualified.json(), {
      ok: false,
      error: 'recovery_qualification_required',
      reasons: ['qualification_missing'],
    });
    assert.equal(fixture.rows[0].plate_status, 'generated');
    assert.equal(fixture.audits.length, 0);
  });

  it('conditionally activates once, preserves both codes, audits activation, and is idempotent only for matching inputs', async () => {
    const fixture = await makePlateLifecycleFixture();
    const env = lifecycleEnv(fixture.DB);
    const path = '/api/admin/pieces/kp-one/activate';
    const before = {
      publicCode: fixture.rows[0].public_code,
      ciphertext: fixture.rows[0].ownership_code_ciphertext,
      nonce: fixture.rows[0].ownership_code_nonce,
    };
    const call = (body: unknown) => activateArtworkPlate({
      request: lifecycleRequest(path, 'POST', body), env, params: { id: 'kp-one' },
    });

    const activated = await call(validActivation(fixture.plate));
    assert.equal(activated.status, 200);
    assert.equal((await activated.json()).plateStatus, 'active');
    assert.equal(fixture.rows[0].plate_status, 'active');
    assert.ok(fixture.rows[0].plate_activated_at);
    assert.deepEqual({
      publicCode: fixture.rows[0].public_code,
      ciphertext: fixture.rows[0].ownership_code_ciphertext,
      nonce: fixture.rows[0].ownership_code_nonce,
    }, before);
    assert.equal(fixture.audits.at(-1).action, 'activate');
    assert.equal(fixture.audits.at(-1).outcome, 'activation_attempt');
    assert.equal(fixture.lineage.at(-1)[3], 'activated');

    const repeated = await call(validActivation(fixture.plate));
    assert.equal(repeated.status, 200);
    assert.equal((await repeated.json()).idempotent, true);
    const mismatch = await call({ ...validActivation(fixture.plate), undersideSha256: 'wrong' });
    assert.equal(mismatch.status, 409);
    assert.equal(fixture.rows[0].plate_status, 'active');
  });

  it('never activates when the required activation-attempt audit cannot be inserted', async () => {
    const fixture = await makePlateLifecycleFixture({ failAudit: true });
    const response = await activateArtworkPlate({
      request: lifecycleRequest('/api/admin/pieces/kp-one/activate', 'POST', validActivation(fixture.plate)),
      env: lifecycleEnv(fixture.DB), params: { id: 'kp-one' },
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: 'audit_unavailable' });
    assert.equal(fixture.rows[0].plate_status, 'generated');
    assert.equal(fixture.rows[0].plate_activated_at, null);
  });

  it('records only an activation attempt when a concurrent request wins the conditional update', async () => {
    const fixture = await makePlateLifecycleFixture({ raceActivation: true });
    const response = await activateArtworkPlate({
      request: lifecycleRequest('/api/admin/pieces/kp-one/activate', 'POST', validActivation(fixture.plate)),
      env: lifecycleEnv(fixture.DB), params: { id: 'kp-one' },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, plateStatus: 'active', idempotent: true });
    assert.equal(fixture.audits.length, 1);
    assert.equal(fixture.audits[0].outcome, 'activation_attempt');
    assert.equal(fixture.audits.some((audit) => audit.outcome === 'activated'), false);
    assert.equal(fixture.rows[0].plate_activated_at, '2026-07-13T11:59:59.000Z');
  });
});

// ── Steward bind: the full register → first-bind → contested lifecycle ─────────
// These exercise functions/api/keeper/bind.js against the SAME in-memory D1
// stand-in the admin suite uses, extended to the few extra statement shapes
// bind issues (the no-released-filter SELECT, the legacy keeper_user_id UPDATE, and the users
// lookup getUserByAuthId runs). The session layer (requireUser) is module-
// mocked so we can drive distinct signed-in users without a real Better Auth
// cookie; contested claims are stored in the same canonical D1 stand-in.
//
// Run note: this section uses node:test's mock.module, so the suite is invoked
// with `npx tsx --test --experimental-test-module-mocks tests/living-legacy.test.ts`.
// The flag is benign for every other test in this file.

// getUserByAuthId is satisfied by the fake DB's users SELECT below, so we do
// not mock db.js; we just make the fake DB answer that statement.

// A fuller fake D1 that serves BOTH the admin registration statements and the
// steward-bind statements, plus the users lookup. Same key (piece_id +
// edition_number); UNIQUE(piece_id, edition_number) is honoured.
function makeKeeperDb() {
  const pieces: any[] = [];
  const qualifications: any[] = [];
  const lineage: any[] = [];
  const evidence: any[] = [];
  const claimRequests: any[] = [];
  let loseNextFirstBind = false;
  let lastChanges = 0;
  const users: any[] = [
    { id: 'row-1', auth_user_id: 'user-first', email: 'first@example.com' },
    { id: 'row-2', auth_user_id: 'user-second', email: 'second@example.com' },
  ];

  function findActive(pieceId: string, edition: number) {
    return pieces.find(
      (r) => r.piece_id === pieceId && r.edition_number === edition && !r.released_at,
    );
  }
  function findAny(pieceId: string, edition: number) {
    return pieces.find((r) => r.piece_id === pieceId && r.edition_number === edition);
  }

  function exec(sql: string, params: any[]) {
    const s = sql.replace(/\s+/g, ' ').trim();

    if (/^SELECT id, title, edition_size FROM registry_artworks WHERE id = \?1/i.test(s)) {
      const overlays = [
        { id: 'UL-100', title: 'Art of Living - 32', edition_size: null },
        { id: 'UL-101', title: 'Art of Living - 55', edition_size: null },
      ];
      return { kind: 'first', row: overlays.find((row) => row.id === params[0]) || null };
    }

    // users lookup (getUserByAuthId)
    if (/^SELECT \* FROM users WHERE auth_user_id = \?1/i.test(s)) {
      const u = users.find((r) => r.auth_user_id === params[0]) || null;
      return { kind: 'first', row: u };
    }
    if (/^INSERT INTO artwork_claim_requests/i.test(s)) {
      const [id, keeperPieceId, requesterUserId, requesterEmail, note,
        expectedStewardUserId, createdAt, limit] = params;
      const piece = pieces.find((row) => row.id === keeperPieceId);
      const duplicate = claimRequests.some((row) => row.keeper_piece_id === keeperPieceId
        && row.requester_user_id === requesterUserId && row.status === 'pending');
      const openByUser = claimRequests.filter((row) => row.requester_user_id === requesterUserId
        && row.status === 'pending').length;
      const openByEmail = claimRequests.filter((row) => row.requester_email === requesterEmail
        && row.status === 'pending').length;
      if (!piece || piece.keeper_user_id !== expectedStewardUserId || !piece.claimed_at
        || piece.keeper_user_id === requesterUserId || duplicate
        || openByUser >= limit || openByEmail >= limit) {
        return { kind: 'run', meta: { changes: 0 } };
      }
      claimRequests.push({
        id, keeper_piece_id: keeperPieceId, requester_user_id: requesterUserId,
        requester_email: requesterEmail, note, routed_to_user_id: piece.keeper_user_id,
        status: 'pending', created_at: createdAt,
      });
      return { kind: 'run', meta: { changes: 1 } };
    }
    if (/^SELECT keeper_user_id, claimed_at FROM keeper_pieces WHERE id = \?1/i.test(s)) {
      return { kind: 'first', row: pieces.find((row) => row.id === params[0]) || null };
    }
    if (/^SELECT id FROM artwork_claim_requests/i.test(s)) {
      return { kind: 'first', row: claimRequests.find((row) => row.keeper_piece_id === params[0]
        && row.requester_user_id === params[1] && row.status === 'pending') || null };
    }

    // Public-code lookup: the row itself is the only source of artwork and
    // edition identity. Bind deliberately sees released rows as well.
    if (
      /^SELECT id, piece_id, edition_number, keeper_user_id, recovery_code_hash, claimed_at, released_at, public_code, plate_status, backup_status, backup_reference, backup_sha256, ownership_code_key_version, registration_status, identity_backup_status, identity_backup_reference, identity_backup_sha256 FROM keeper_pieces WHERE public_code = \?1$/i.test(
        s,
      )
    ) {
      return { kind: 'first', row: pieces.find((row) => row.public_code === params[0]) || null };
    }

    if (/^SELECT .* FROM keeper_pieces WHERE issuance_key = \?1/i.test(s)) {
      return { kind: 'first', row: pieces.find((row) => row.issuance_key === params[0]) || null };
    }
    if (/^SELECT \* FROM keeper_pieces WHERE id = \?1/i.test(s)) {
      return { kind: 'first', row: pieces.find((row) => row.id === params[0]) || null };
    }
    if (/^SELECT id, result, copied_artifacts, schema_version, build_version, key_version, generator_version, verifier_version, backup_reference, backup_sha256, qualified_at FROM registry_recovery_qualifications/i.test(s)) {
      return {
        kind: 'first',
        row: qualifications
          .filter((row) => row.keeper_piece_id === params[0] && row.result === 'passed' && row.copied_artifacts === 1)
          .sort((left, right) => `${right.qualified_at}:${right.id}`.localeCompare(`${left.qualified_at}:${left.id}`))[0] || null,
      };
    }
    if (/^SELECT id FROM keeper_pieces WHERE piece_id = \?1 AND edition_number = \?2/i.test(s)) {
      return { kind: 'first', row: findAny(params[0], params[1]) || null };
    }
    if (/^SELECT id FROM keeper_pieces WHERE piece_id = \?1 AND edition_number (?:= 0|> 0)/i.test(s)) {
      const looksForUnique = /edition_number = 0/i.test(s);
      return {
        kind: 'first',
        row: pieces.find(
          (row) => row.piece_id === params[0]
            && (looksForUnique ? row.edition_number === 0 : row.edition_number > 0),
        ) || null,
      };
    }

    // admin INSERT: fresh registration (no steward yet)
    if (
      /^INSERT INTO keeper_pieces/i.test(s)
    ) {
      const [id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key,
        plate_status, plate_generated_at, front_svg_sha256, back_svg_sha256,
        ownership_code_ciphertext, ownership_code_nonce, ownership_code_key_version,
        backup_status, registered_at] = params;
      if (pieces.some((r) => r.recovery_code_hash === recovery_code_hash)) {
        throw new Error('UNIQUE constraint failed: keeper_pieces.recovery_code_hash');
      }
      if (findActive(piece_id, edition_number)) {
        throw new Error('UNIQUE constraint failed: keeper_pieces.piece_id');
      }
      pieces.push({
        id,
        piece_id,
        edition_number,
        keeper_user_id: null,
        recovery_code_hash, public_code, issuance_key, plate_status, plate_generated_at,
        front_svg_sha256, back_svg_sha256, ownership_code_ciphertext,
        ownership_code_nonce, ownership_code_key_version, backup_status,
        current_display_location: null,
        registered_at,
        claimed_at: null,
        released_at: null,
        lineage_head_hash: null,
        lineage_event_count: 0,
      });
      lastChanges = 1;
      return { kind: 'run', meta: { changes: 1 } };
    }

    if (/^UPDATE keeper_pieces SET backup_status = \?1/i.test(s)) {
      const [status, reference, sha256, backupAt, id] = params;
      const row = pieces.find((r) => r.id === id);
      if (row) {
        row.backup_status = status;
        if (status === 'verified') {
          row.backup_reference = reference;
          row.backup_sha256 = sha256;
          row.backup_at = backupAt;
        }
      }
      return { kind: 'run', meta: { changes: row ? 1 : 0 } };
    }

    // bind UPDATE: first bind only (guarded WHERE)
    if (
      /^UPDATE keeper_pieces SET keeper_user_id = \?1, claimed_at = \?2, released_at = NULL WHERE id = \?3 AND keeper_user_id IS NULL AND claimed_at IS NULL AND released_at IS NULL/i.test(
        s,
      )
    ) {
      const [
        keeperUserId, claimedAt, id, backupReference, backupSha256,
        qualificationId, schemaVersion, buildVersion, keyVersion,
        generatorVersion, verifierVersion,
      ] = params;
      const row = pieces.find((r) => r.id === id);
      if (loseNextFirstBind) {
        loseNextFirstBind = false;
        lastChanges = 0;
        return { kind: 'run', meta: { changes: 0 } };
      }
      const qualification = qualifications.find((candidate) => candidate.id === qualificationId);
      const recoveryGuardPasses = row?.public_code == null || (
        row?.plate_status === 'active'
        && row?.backup_status === 'verified'
        && row?.backup_reference === backupReference
        && row?.backup_sha256 === backupSha256
        && Number(row?.ownership_code_key_version) === keyVersion
        && qualification?.keeper_piece_id === row?.id
        && qualification?.result === 'passed'
        && qualification?.copied_artifacts === 1
        && qualification?.schema_version === schemaVersion
        && qualification?.build_version === buildVersion
        && qualification?.key_version === keyVersion
        && qualification?.generator_version === generatorVersion
        && qualification?.verifier_version === verifierVersion
        && qualification?.backup_reference === backupReference
        && qualification?.backup_sha256 === backupSha256
      );
      const guardPasses = row && recoveryGuardPasses
        && row.keeper_user_id == null && row.claimed_at == null && row.released_at == null;
      if (row && guardPasses) {
        row.keeper_user_id = keeperUserId;
        row.claimed_at = claimedAt;
        row.released_at = null;
        lastChanges = 1;
        return { kind: 'run', meta: { changes: 1 } };
      }
      lastChanges = 0;
      return { kind: 'run', meta: { changes: 0 } };
    }

    if (/^SELECT sequence, event_hash FROM artwork_lineage_events/i.test(s)) {
      const rows = lineage.filter((row) => row[1] === params[0]);
      const last = rows.at(-1);
      return { kind: 'first', row: last ? { sequence: last[2], event_hash: last[6] } : null };
    }
    if (/^SELECT lineage_head_hash, lineage_event_count FROM keeper_pieces/i.test(s)) {
      return { kind: 'first', row: pieces.find((piece) => piece.id === params[0]) || null };
    }
    if (/^INSERT INTO artwork_lineage_events/i.test(s)) {
      if (params[8] === 1 && lastChanges === 0) return { kind: 'run', meta: { changes: 0 } };
      lineage.push(params);
      lastChanges = 1;
      return { kind: 'run', meta: { changes: 1 } };
    }
    if (/^UPDATE keeper_pieces SET lineage_head_hash = \?1/i.test(s)) {
      if (params[5] === 1 && lastChanges === 0) {
        return { kind: 'run', meta: { changes: 0 } };
      }
      const row = pieces.find((piece) => piece.id === params[2]);
      if (row) {
        row.lineage_head_hash = params[0];
        row.lineage_event_count = params[1];
      }
      lastChanges = row ? 1 : 0;
      return { kind: 'run', meta: { changes: lastChanges } };
    }
    if (/^INSERT INTO artwork_claim_evidence/i.test(s)) {
      const steward = pieces.find((piece) => piece.id === params[1]);
      if (params[8] && (steward?.keeper_user_id !== params[8] || steward?.claimed_at !== params[9])) return { kind: 'run', meta: { changes: 0 } };
      if (params[10]) {
        const cutoff = Date.parse(params[7]) - params[10] * 1000;
        const duplicate = evidence.some((prior) => prior[1] === params[1]
          && prior[2] === params[2] && prior[6] === params[6]
          && Date.parse(prior[7]) > cutoff);
        if (duplicate) return { kind: 'run', meta: { changes: 0 } };
      }
      evidence.push(params);
      return { kind: 'run', meta: { changes: 1 } };
    }

    // list
    if (/^SELECT .* FROM keeper_pieces ORDER BY/i.test(s)) {
      return { kind: 'all', results: pieces.slice() };
    }
    throw new Error(`fake D1: unhandled statement: ${s}`);
  }

  const DB = {
    async batch(statements: any[]) { return Promise.all(statements.map((statement) => statement.run())); },
    prepare(sql: string) {
      let bound: any[] = [];
      const stmt: any = {
        bind(...args: any[]) {
          bound = args;
          return stmt;
        },
        async first() {
          return exec(sql, bound).row ?? null;
        },
        async run() {
          const r = exec(sql, bound);
          return { success: true, meta: r.meta ?? { changes: 0 } };
        },
        async all() {
          return { results: exec(sql, bound).results || [] };
        },
      };
      return stmt;
    },
  };

  return {
    DB, pieces, users, lineage, evidence, claimRequests, qualifications,
    qualify(row: any) {
      qualifications.push({
        id: `qualification-${qualifications.length + 1}`,
        keeper_piece_id: row.id,
        result: 'passed',
        copied_artifacts: 1,
        schema_version: '1',
        build_version: 'registry-recovery-build-v1',
        key_version: Number(row.ownership_code_key_version),
        generator_version: 'artwork-plate-v1',
        verifier_version: 'copied-plate-v1',
        backup_reference: row.backup_reference,
        backup_sha256: row.backup_sha256,
        qualified_at: new Date().toISOString(),
      });
    },
    loseNextFirstBind() { loseNextFirstBind = true; },
  };
}

function bindReq(body: unknown) {
  return new Request('https://adrianrasmussen.com/api/keeper/bind', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.42',
      'User-Agent': 'registry-test-agent',
    },
    body: JSON.stringify(body),
  });
}

const BIND_OWNERSHIP_CODE = 'K7QM-9XTR-2PHV-N4WB';

async function seedReadyPhysicalBindPiece(
  fixture: ReturnType<typeof makeKeeperDb>,
  overrides: Record<string, unknown> = {},
) {
  const backupSha256 = 'a'.repeat(64);
  const row = {
    id: 'kp-bind',
    piece_id: 'UL-100',
    edition_number: 0,
    keeper_user_id: null,
    recovery_code_hash: await hashRecoveryCode(BIND_OWNERSHIP_CODE),
    public_code: 'AR-7KQ9M2WX',
    issuance_key: 'registered-bind-fixture',
    registration_status: 'registered',
    plate_status: 'active',
    backup_status: 'verified',
    backup_reference: `plates/AR-7KQ9M2WX/${backupSha256}.json`,
    backup_sha256: backupSha256,
    ownership_code_key_version: 1,
    registered_at: '2026-07-13T00:00:00.000Z',
    claimed_at: null,
    released_at: null,
    lineage_head_hash: null,
    lineage_event_count: 0,
    ...overrides,
  };
  fixture.pieces.push(row);
  fixture.qualify(row);
  return row;
}

describe('steward bind endpoint against registered artwork identities', () => {
  it('rejects the wrong Ownership Code without changing registry state', async () => {
    const fixture = makeKeeperDb();
    const row = await seedReadyPhysicalBindPiece(fixture);
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-first', email: 'first@example.com', emailVerified: true };
    try {
      const response = await bindKeeper({
        request: bindReq({ publicCode: row.public_code, ownershipCode: 'WRONG-CODE' }),
        env: { DB: fixture.DB },
      });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error, 'code_mismatch');
      assert.equal(row.keeper_user_id, null);
      assert.equal(fixture.lineage.length, 0);
      assert.equal(fixture.evidence.length, 0);
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('returns an idempotent keeper result when the current holder rescans', async () => {
    const claimedAt = '2026-07-14T00:00:00.000Z';
    const fixture = makeKeeperDb();
    const row = await seedReadyPhysicalBindPiece(fixture, {
      keeper_user_id: 'user-first',
      claimed_at: claimedAt,
    });
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-first', email: 'first@example.com', emailVerified: true };
    try {
      const response = await bindKeeper({
        request: bindReq({ publicCode: row.public_code, ownershipCode: BIND_OWNERSHIP_CODE }),
        env: { DB: fixture.DB },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        ok: true,
        keeper: { pieceId: 'UL-100', editionNumber: 0, claimedAt },
      });
      assert.equal(fixture.claimRequests.length, 0);
      assert.equal(fixture.lineage.length, 0);
      assert.equal(fixture.evidence.length, 0);
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('opens a contested claim without replacing the current keeper', async () => {
    const fixture = makeKeeperDb();
    const row = await seedReadyPhysicalBindPiece(fixture, {
      keeper_user_id: 'user-first',
      claimed_at: '2026-07-14T00:00:00.000Z',
    });
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-second', email: 'second@example.com', emailVerified: true };
    try {
      const response = await bindKeeper({
        request: bindReq({
          publicCode: row.public_code,
          ownershipCode: BIND_OWNERSHIP_CODE,
          note: 'Bought from the current holder.',
        }),
        env: { DB: fixture.DB },
      });
      assert.equal(response.status, 202);
      assert.equal((await response.json()).status, 'claim_requested');
      assert.equal(row.keeper_user_id, 'user-first');
      assert.equal(fixture.claimRequests.length, 1);
      assert.equal(fixture.claimRequests[0].routed_to_user_id, 'user-first');
      assert.equal(fixture.evidence.length, 1);
      assert.equal(fixture.evidence[0][6], 'contested_attempt');
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('keeps a released but previously governed identity in the contested path', async () => {
    const fixture = makeKeeperDb();
    const row = await seedReadyPhysicalBindPiece(fixture, {
      keeper_user_id: 'user-first',
      claimed_at: '2026-07-14T00:00:00.000Z',
      released_at: '2026-07-15T00:00:00.000Z',
    });
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-second', email: 'second@example.com', emailVerified: true };
    try {
      const response = await bindKeeper({
        request: bindReq({ publicCode: row.public_code, ownershipCode: BIND_OWNERSHIP_CODE }),
        env: { DB: fixture.DB },
      });
      assert.equal(response.status, 202);
      assert.equal((await response.json()).status, 'claim_requested');
      assert.equal(row.keeper_user_id, 'user-first');
      assert.equal(row.released_at, '2026-07-15T00:00:00.000Z');
      assert.equal(fixture.claimRequests.length, 1);
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('rejects forged artwork identity fields before binding', async () => {
    const fixture = makeKeeperDb();
    const row = await seedReadyPhysicalBindPiece(fixture);
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-first', email: 'first@example.com', emailVerified: true };
    try {
      const response = await bindKeeper({
        request: bindReq({
          publicCode: row.public_code,
          ownershipCode: BIND_OWNERSHIP_CODE,
          pieceId: 'UL-101',
          editionNumber: 9,
        }),
        env: { DB: fixture.DB },
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { ok: false, error: 'identity_fields_forbidden' });
      assert.equal(row.keeper_user_id, null);
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('returns not_registered for an unknown public code', async () => {
    const fixture = makeKeeperDb();
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-first', email: 'first@example.com', emailVerified: true };
    try {
      const response = await bindKeeper({
        request: bindReq({ publicCode: 'AR-Z8X7C6V5', ownershipCode: BIND_OWNERSHIP_CODE }),
        env: { DB: fixture.DB },
      });
      assert.equal(response.status, 404);
      assert.equal((await response.json()).error, 'not_registered');
      assert.equal(fixture.pieces.length, 0);
      assert.equal(fixture.lineage.length, 0);
      assert.equal(fixture.evidence.length, 0);
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('rolls back keeper, lineage, and evidence when a concurrent first bind wins', async () => {
    const fixture = makeKeeperDb();
    const row = await seedReadyPhysicalBindPiece(fixture);
    fixture.loseNextFirstBind();
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-first', email: 'first@example.com', emailVerified: true };
    try {
      const response = await bindKeeper({
        request: bindReq({ publicCode: row.public_code, ownershipCode: BIND_OWNERSHIP_CODE }),
        env: { DB: fixture.DB },
      });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error, 'bind_conflict');
      assert.equal(row.keeper_user_id, null);
      assert.equal(row.claimed_at, null);
      assert.equal(row.lineage_head_hash, null);
      assert.equal(row.lineage_event_count, 0);
      assert.equal(fixture.lineage.length, 0);
      assert.equal(fixture.evidence.length, 0);
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });
});

describe('steward status and display location by public identity', () => {
  it('treats a registered but unclaimed public code as not kept', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-first', email: 'first@example.com', emailVerified: true };
    const row = {
      id: 'kp-public-status', piece_id: 'MD-905', edition_number: 1,
      public_code: 'AR-7KQ9M2WX', keeper_user_id: null,
      current_display_location: null, released_at: null,
    };
    const seen: Array<{ sql: string; params: unknown[] }> = [];
    const DB = {
      prepare(sql: string) {
        let params: unknown[] = [];
        const normalized = sql.replace(/\s+/g, ' ').trim();
        const statement = {
          bind(...values: unknown[]) { params = values; return statement; },
          async first() {
            seen.push({ sql: normalized, params });
            if (/^SELECT \* FROM users WHERE auth_user_id = \?1/i.test(normalized)) {
              return { id: 'row-1', auth_user_id: 'user-first', email: 'first@example.com' };
            }
            if (/FROM keeper_pieces WHERE public_code = \?1/i.test(normalized)) {
              return params[0] === row.public_code ? row : null;
            }
            throw new Error(`unexpected status first: ${normalized}`);
          },
          async run() { throw new Error(`unexpected status run: ${normalized}`); },
        };
        return statement;
      },
    };

    try {
      const { onRequest: piece } = await import('../functions/api/keeper/piece.js');
      const response = await piece({
        request: new Request(`https://adrianrasmussen.com/api/keeper/piece?publicCode=${row.public_code}`),
        env: { DB },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true, kept: false, byYou: false });
      assert.ok(seen.some((entry) => entry.params[0] === row.public_code));
      assert.equal(seen.some((entry) => entry.params.includes(row.piece_id)), false);

      row.keeper_user_id = 'user-first';
      row.released_at = '2026-07-13T12:00:00Z';
      const released = await piece({
        request: new Request(`https://adrianrasmussen.com/api/keeper/piece?publicCode=${row.public_code}`),
        env: { DB },
      });
      assert.equal(released.status, 200);
      assert.deepEqual(await released.json(), { ok: true, kept: true, byYou: false });
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('shows steward-visible creator history only to the active steward', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-first', email: 'first@example.com', emailVerified: true };
    const row = {
      id: 'kp-steward-history', piece_id: 'MD-905', edition_number: 1,
      public_code: 'AR-7KQ9M2WX', keeper_user_id: 'user-first',
      current_display_location: 'Ubud studio', released_at: null,
    };
    let historyReads = 0;
    const DB = {
      prepare(sql: string) {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        const statement = {
          bind() { return statement; },
          async first() {
            if (/^SELECT \* FROM users WHERE auth_user_id = \?1/i.test(normalized)) {
              return { id: 'row-1', auth_user_id: 'user-first', email: 'first@example.com' };
            }
            if (/FROM keeper_pieces WHERE public_code = \?1/i.test(normalized)) return row;
            throw new Error(`unexpected steward-history first: ${normalized}`);
          },
          async all() {
            historyReads += 1;
            assert.match(normalized, /visibility = 'steward'/);
            assert.match(normalized, /removed_at IS NULL/);
            assert.doesNotMatch(normalized, /visibility = 'private'/);
            return { results: [{
              entryType: 'intention', title: 'For the steward',
              detail: 'Keep the work where changing light can reach it.',
              role: null, occurredAt: '2026-07',
            }] };
          },
        };
        return statement;
      },
    };

    try {
      const { onRequest: piece } = await import('../functions/api/keeper/piece.js');
      const response = await piece({
        request: new Request(`https://adrianrasmussen.com/api/keeper/piece?publicCode=${row.public_code}`),
        env: { DB },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        ok: true,
        kept: true,
        byYou: true,
        keeperPieceId: row.id,
        currentDisplayLocation: 'Ubud studio',
        stewardHistory: [{
          entryType: 'intention', title: 'For the steward',
          detail: 'Keep the work where changing light can reach it.',
          role: null, occurredAt: '2026-07',
        }],
      });
      assert.equal(historyReads, 1);

      row.keeper_user_id = 'someone-else';
      const outsider = await piece({
        request: new Request(`https://adrianrasmussen.com/api/keeper/piece?publicCode=${row.public_code}`),
        env: { DB },
      });
      assert.deepEqual(await outsider.json(), { ok: true, kept: true, byYou: false });
      assert.equal(historyReads, 1);
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('updates only the steward row resolved from publicCode', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-first', email: 'first@example.com', emailVerified: true };
    const row = {
      id: 'kp-public-location', piece_id: 'MD-905', edition_number: 1,
      public_code: 'AR-7KQ9M2WX', keeper_user_id: 'user-first',
      current_display_location: null, released_at: null,
    };
    const seen: Array<{ sql: string; params: unknown[] }> = [];
    const DB = {
      prepare(sql: string) {
        let params: unknown[] = [];
        const normalized = sql.replace(/\s+/g, ' ').trim();
        const statement = {
          bind(...values: unknown[]) { params = values; return statement; },
          async first() {
            seen.push({ sql: normalized, params });
            if (/^SELECT \* FROM users WHERE auth_user_id = \?1/i.test(normalized)) {
              return { id: 'row-1', auth_user_id: 'user-first', email: 'first@example.com' };
            }
            if (/FROM keeper_pieces WHERE public_code = \?1/i.test(normalized)) return row;
            throw new Error(`unexpected location first: ${normalized}`);
          },
          async run() {
            seen.push({ sql: normalized, params });
            if (!/^UPDATE keeper_pieces SET current_display_location = \?1 WHERE id = \?2/i.test(normalized)) {
              throw new Error(`unexpected location run: ${normalized}`);
            }
            if (params[1] !== row.id || params[2] !== 'user-first') {
              return { success: true, meta: { changes: 0 } };
            }
            row.current_display_location = params[0] as string | null;
            return { success: true, meta: { changes: 1 } };
          },
        };
        return statement;
      },
    };

    try {
      const { onRequest: piece } = await import('../functions/api/keeper/piece.js');
      const response = await piece({
        request: new Request('https://adrianrasmussen.com/api/keeper/piece', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicCode: row.public_code,
            currentDisplayLocation: '  Ubud studio  ',
            pieceId: 'UL-999',
            editionNumber: 0,
          }),
        }),
        env: { DB },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true, currentDisplayLocation: 'Ubud studio' });
      assert.equal(row.current_display_location, 'Ubud studio');
      assert.equal(seen.some((entry) => entry.params.includes('UL-999')), false);
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });
});
