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

import {
  buildClaimBridgePayload,
  requestContestedClaim,
  CLAIM_REQUEST_NOTE_MAX,
} from '../functions/api/_lib/claimBridge.js';

import { buildLineageEvent, prepareNextLineageEvent } from '../functions/api/_lib/lineage.js';
import { applyOrderStatusEvent, upsertCheckoutOrder } from '../functions/api/stripe/webhook.js';
import { backupPlateEnvelope } from '../functions/api/_lib/plateBackup.js';
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

function plateLookupDb(row: { piece_id: string; edition_number: number } | null) {
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
  it('resolves an issued AR code through D1 with encoded instance and edition values', async () => {
    const lookup = plateLookupDb({ piece_id: 'UL 100/α', edition_number: 2 });
    const response = await qrRequest('AR-7KQ9M2WX', { DB: lookup.DB });

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get('location'),
      'https://adrianrasmussen.com/works/UL%20100%2F%CE%B1?instance=AR-7KQ9M2WX&edition=2&ref=qr',
    );
    assert.equal(lookup.calls.length, 1);
    assert.deepEqual(lookup.calls[0].values, ['AR-7KQ9M2WX']);
    assert.match(lookup.calls[0].sql, /SELECT\s+piece_id,\s*edition_number\s+FROM/i);
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
    assert.doesNotMatch(guard, /DROP TABLE|ALTER TABLE keeper_pieces/i);

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

// The contested-claim handoff opens a request on mandalacodes' SINGLE shared
// store, then leans on the escalation logic merged there. These pure modules
// are the contract Adrian-Website depends on; we import them across the repo
// boundary to lock that contract (skips cleanly if the sister repo is absent).
import {
  planClaimRequest,
  MAX_OPEN_REQUESTS_PER_REQUESTER,
} from '../../mandalacodes/utils/claimRequests.ts';
import {
  evaluateClaimWindow,
  CLAIM_WINDOW_DAYS,
  CLAIM_WARNING_DAYS,
  FINAL_WARNING_GRACE_DAYS,
} from '../../mandalacodes/utils/claimWindow.ts';

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

// ── Contested-claim handoff: Adrian-side bridge payload ──────────────────────

describe('claim bridge payload (Adrian side, whitelist)', () => {
  it('builds exactly the fields the receiver accepts, edition 0 always sent', () => {
    const p = buildClaimBridgePayload({
      pieceId: 'UL-100',
      editionNumber: 0,
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
    });
    assert.deepEqual(Object.keys(p).sort(), [
      'editionNumber',
      'pieceId',
      'requesterEmail',
      'requesterRef',
    ]);
    // edition 0 is the chain-key default and must travel (not dropped as falsy).
    assert.equal(p.editionNumber, 0);
  });

  it('defaults a missing/invalid editionNumber to 0', () => {
    const p = buildClaimBridgePayload({
      pieceId: 'UL-100',
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
    });
    assert.equal(p.editionNumber, 0);
  });

  it('includes a trimmed note and caps it at CLAIM_REQUEST_NOTE_MAX', () => {
    const long = 'x'.repeat(CLAIM_REQUEST_NOTE_MAX + 200);
    const p = buildClaimBridgePayload({
      pieceId: 'UL-100',
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
      note: `   bought at auction lot 12   `,
    });
    assert.equal(p.note, 'bought at auction lot 12');

    const capped = buildClaimBridgePayload({
      pieceId: 'UL-100',
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
      note: long,
    });
    assert.equal(capped.note?.length, CLAIM_REQUEST_NOTE_MAX);

    // An empty/whitespace note is omitted entirely (never an empty string).
    const blank = buildClaimBridgePayload({
      pieceId: 'UL-100',
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
      note: '   ',
    });
    assert.equal('note' in blank, false);
  });
});

describe('requestContestedClaim (Adrian side, transport)', () => {
  it('no-ops with secret_unset when CLAIM_BRIDGE_SECRET is not provisioned', async () => {
    const r = await requestContestedClaim({}, {
      pieceId: 'UL-100',
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'secret_unset');
  });

  it('reports missing required fields without calling out', async () => {
    const r = await requestContestedClaim({ CLAIM_BRIDGE_SECRET: 's' }, {
      pieceId: 'UL-100',
      // requesterRef / requesterEmail missing
    } as never);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'missing_required_fields');
  });

  it('passes through the receiver status on a 200 (opened / duplicate)', async () => {
    const calls: string[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: { headers: Record<string, string> }) => {
      calls.push(init.headers['X-Claim-Signature']);
      return new Response(JSON.stringify({ ok: true, status: 'opened', request: { id: 'req-1' } }), {
        status: 200,
      });
    }) as typeof fetch;
    try {
      const r = await requestContestedClaim({ CLAIM_BRIDGE_SECRET: 'shared-secret' }, {
        pieceId: 'UL-100',
        editionNumber: 0,
        requesterRef: 'user-asker',
        requesterEmail: 'asker@example.com',
      });
      assert.equal(r.ok, true);
      assert.equal(r.status, 'opened');
      assert.equal(r.request?.id, 'req-1');
      // The call was signed (an HMAC hex of length 64 went out).
      assert.match(calls[0], /^[0-9a-f]{64}$/);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('does NOT retry a 400 (our payload is wrong)', async () => {
    let n = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      n++;
      return new Response(JSON.stringify({ ok: false, error: 'bad' }), { status: 400 });
    }) as typeof fetch;
    try {
      const r = await requestContestedClaim({ CLAIM_BRIDGE_SECRET: 'shared-secret' }, {
        pieceId: 'UL-100',
        requesterRef: 'user-asker',
        requesterEmail: 'asker@example.com',
      });
      assert.equal(r.ok, false);
      assert.equal(r.reason, 'rejected_400');
      assert.equal(n, 1); // no retry
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

// ── Contested-claim handoff: shared escalation contract (mandalacodes) ────────
// These pin the rules Adrian-Website hands the claim into. They live on the
// mandalacodes side (one source of truth); we assert the contract here so a
// drift on either side is caught.

describe('contested claim opens a request (not a 409)', () => {
  const boundSteward = {
    pieceId: 'UL-100',
    clerkUserId: 'user-holder',
    email: 'holder@example.com',
    issuedAt: '2026-01-01T00:00:00Z',
    outreachStatus: 'claimed' as const,
  };

  it('a bound piece routes the request to the HOLDER, pending, never binding', () => {
    const plan = planClaimRequest([], {
      input: { pieceId: 'UL-100' },
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
      steward: boundSteward,
      now: '2026-06-23T00:00:00Z',
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.value?.status, 'pending'); // not bound, not 409
    assert.equal(plan.value?.routedTo, 'holder'); // anti-takeover: the holder decides
    assert.equal(plan.value?.requesterRef, 'user-asker');
  });

  it('the bound holder cannot request their own piece (self-guard)', () => {
    const plan = planClaimRequest([], {
      input: { pieceId: 'UL-100' },
      requesterRef: 'user-holder',
      requesterEmail: 'holder@example.com',
      steward: boundSteward,
      now: '2026-06-23T00:00:00Z',
    });
    assert.equal(plan.ok, false);
  });
});

describe('dedupe + rate limit (shared store guardrails)', () => {
  const steward = {
    pieceId: 'UL-100',
    clerkUserId: 'user-holder',
    email: 'holder@example.com',
    issuedAt: '2026-01-01T00:00:00Z',
    outreachStatus: 'claimed' as const,
  };

  it('a second request for the same piece by the same requester is one open request', () => {
    const first = planClaimRequest([], {
      input: { pieceId: 'UL-100' },
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
      steward,
      now: '2026-06-23T00:00:00Z',
    });
    assert.equal(first.ok, true);
    const second = planClaimRequest([first.value!], {
      input: { pieceId: 'UL-100' },
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
      steward,
      now: '2026-06-23T01:00:00Z',
    });
    assert.equal(second.ok, false); // dedupe → no duplicate open request
  });

  it('caps a requester at MAX_OPEN_REQUESTS_PER_REQUESTER open requests', () => {
    const open = [];
    for (let i = 0; i < MAX_OPEN_REQUESTS_PER_REQUESTER; i++) {
      const r = planClaimRequest(open, {
        input: { pieceId: `UL-10${i}` },
        requesterRef: 'user-asker',
        requesterEmail: 'asker@example.com',
        steward: undefined,
        now: '2026-06-23T00:00:00Z',
      });
      assert.equal(r.ok, true);
      open.push(r.value!);
    }
    const overflow = planClaimRequest(open, {
      input: { pieceId: 'UL-999' },
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
      steward: undefined,
      now: '2026-06-23T00:00:00Z',
    });
    assert.equal(overflow.ok, false); // rate limited
  });
});

describe('escalation outcomes (run on the mandalacodes side)', () => {
  const baseRequest = {
    id: 'req-1',
    pieceId: 'UL-100',
    requesterRef: 'user-asker',
    requesterEmail: 'asker@example.com',
    createdAt: '2026-06-01T00:00:00Z',
    status: 'pending' as const,
    routedTo: 'holder' as const,
  };
  const dayMs = 24 * 60 * 60 * 1000;
  const isoDaysAfterRequest = (days: number) =>
    new Date(Date.parse(baseRequest.createdAt) + days * dayMs).toISOString();
  const deliveredWarnings = () =>
    CLAIM_WARNING_DAYS.map((day, index) => ({
      ordinal: index + 1,
      sentAt: isoDaysAfterRequest(day),
    }));

  it("a holder's NO stops the claim cold, regardless of elapsed time", () => {
    const declined = { ...baseRequest, status: 'declined' as const };
    // Even far past the full window, a decline never frees the piece.
    const r = evaluateClaimWindow({
      request: declined,
      holderResponded: false,
      nowIso: '2027-01-01T00:00:00Z',
    });
    assert.equal(r.status, 'declined');
  });

  it('only unanswered silence across the FULL window, every warning delivered, frees the piece', () => {
    const past = isoDaysAfterRequest(CLAIM_WINDOW_DAYS + FINAL_WARNING_GRACE_DAYS);
    const freed = evaluateClaimWindow({
      request: baseRequest,
      holderResponded: false,
      nowIso: past,
      warnings: deliveredWarnings(), // all four delivered
    });
    assert.equal(freed.status, 'frees-to-requester');
  });

  it('mere inactivity never frees: full window but warnings undelivered stays blocked', () => {
    const past = isoDaysAfterRequest(CLAIM_WINDOW_DAYS);
    const notFreed = evaluateClaimWindow({
      request: baseRequest,
      holderResponded: false,
      nowIso: past,
      warnings: [], // nothing actually delivered to the steward yet
    });
    assert.notEqual(notFreed.status, 'frees-to-requester');
  });

  it('any steward response keeps the piece blocked (engagement never frees)', () => {
    const past = isoDaysAfterRequest(CLAIM_WINDOW_DAYS);
    const held = evaluateClaimWindow({
      request: baseRequest,
      holderResponded: true,
      nowIso: past,
      warnings: deliveredWarnings(),
    });
    assert.equal(held.status, 'blocked-active');
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
      const [status, reference, backupAt, id] = params;
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.backup_status = status;
        row.backup_reference = reference;
        row.backup_at = backupAt;
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
          exec(sql, bound);
          return { success: true };
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
  const objects = new Map<string, string>();
  return {
    objects,
    async put(key: string, value: string) {
      if (fail) throw new Error('backup unavailable');
      objects.set(key, value);
    },
    async get(key: string) {
      const value = objects.get(key);
      return value === undefined ? null : { text: async () => value };
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
  it('stores an explicit static-catalog edition structure with canonical metadata', async () => {
    const stored: any[] = [];
    const DB = {
      prepare(sql: string) {
        const statement = {
          values: [] as any[],
          bind(...values: any[]) { statement.values = values; return statement; },
          async run() {
            if (!/^INSERT INTO registry_artworks/i.test(sql.trim())) throw new Error(`unexpected SQL: ${sql}`);
            const [id, title, series, edition_size, created_at] = statement.values;
            stored.push({ id, title, series, edition_size, created_at });
            return { success: true };
          },
        };
        return statement;
      },
    };
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

  it('rejects unknown artworks, invalid editions, and missing issuance keys', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB } = makeIssuanceDb();
      const env = issuanceEnv(DB);
      assert.equal((await adminPieces({ request: adminReq('POST', { pieceId: 'NOPE', editionNumber: 0, issuanceKey: 'a' }), env })).status, 400);
      assert.equal((await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionNumber: -1, issuanceKey: 'b' }), env })).status, 400);
      assert.equal((await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionNumber: 1.5, issuanceKey: 'c' }), env })).status, 400);
      assert.equal((await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionNumber: 0 }), env })).status, 400);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('requires the exact explicit edition identity before issuance', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const unique = makeIssuanceDb({
        draftArtworks: [{ id: 'MD-906', title: 'Unique Study', edition_size: null }],
      });
      const uniqueEnv = issuanceEnv(unique.DB);

      const missingEdition = await adminPieces({
        request: adminReq('POST', {
          pieceId: 'UL-100',
          editionKind: 'unique',
          uniqueConfirmed: true,
          issuanceKey: 'missing-edition',
        }),
        env: uniqueEnv,
      });
      assert.deepEqual(await missingEdition.json(), {
        ok: false,
        error: 'edition_number_required',
      });

      const missingMetadata = await adminPieces({
        request: adminReq('POST', {
          pieceId: 'UL-100',
          editionNumber: 0,
          uniqueConfirmed: true,
          issuanceKey: 'missing-kind',
        }),
        env: uniqueEnv,
      });
      assert.deepEqual(await missingMetadata.json(), {
        ok: false,
        error: 'edition_metadata_required',
      });

      const unconfirmedUnique = await adminPieces({
        request: adminReq('POST', {
          pieceId: 'MD-906',
          editionNumber: 0,
          issuanceKey: 'unconfirmed-unique',
        }),
        env: uniqueEnv,
      });
      assert.deepEqual(await unconfirmedUnique.json(), {
        ok: false,
        error: 'unique_confirmation_required',
      });

      const numberedUnique = await adminPieces({
        request: adminReq('POST', {
          pieceId: 'MD-906',
          editionNumber: 1,
          uniqueConfirmed: true,
          issuanceKey: 'numbered-unique',
        }),
        env: uniqueEnv,
      });
      assert.deepEqual(await numberedUnique.json(), {
        ok: false,
        error: 'invalid_edition_number',
      });

      const numbered = makeIssuanceDb({
        draftArtworks: [{ id: 'MD-905', title: 'Edition Study', edition_size: 3 }],
      });
      const numberedEnv = issuanceEnv(numbered.DB);
      for (const editionNumber of [0, 4]) {
        const response = await adminPieces({
          request: adminReq('POST', {
            pieceId: 'MD-905',
            editionNumber,
            issuanceKey: `numbered-${editionNumber}`,
          }),
          env: numberedEnv,
        });
        assert.deepEqual(await response.json(), {
          ok: false,
          error: 'invalid_edition_number',
        });
      }

      const validNumbered = await adminPieces({
        request: adminReq('POST', {
          pieceId: 'MD-905',
          editionNumber: 3,
          issuanceKey: 'numbered-3',
        }),
        env: numberedEnv,
      });
      assert.equal(validNumbered.status, 201);
      assert.equal(numbered.rows[0].edition_number, 3);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('preserves a preexisting numbered canary identity and rejects mixing in edition zero', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const registry = makeIssuanceDb({
        draftArtworks: [{ id: 'UL-162', title: 'Canary', edition_size: null }],
      });
      const env = issuanceEnv(registry.DB);
      registry.rows.push({
        id: 'kp-canary',
        piece_id: 'UL-162',
        edition_number: 1,
        issuance_key: 'ul-162-canary',
      });

      const mixed = await adminPieces({
        request: adminReq('POST', {
          pieceId: 'UL-162',
          editionKind: 'unique',
          editionNumber: 0,
          uniqueConfirmed: true,
          issuanceKey: 'ul-162-unique',
        }),
        env,
      });
      assert.equal(mixed.status, 409);
      assert.deepEqual(await mixed.json(), {
        ok: false,
        error: 'artwork_edition_kind_conflict',
      });
      assert.equal(registry.rows.length, 1);
      assert.equal(registry.rows[0].edition_number, 1);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('replays an exact issuance before mutable artwork metadata is consulted', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const draftArtworks = [{ id: 'MD-905', title: 'Edition Study', edition_size: 3 as number | null }];
      const registry = makeIssuanceDb({ draftArtworks });
      const env = issuanceEnv(registry.DB);
      const requestBody = {
        pieceId: 'MD-905',
        editionNumber: 3,
        issuanceKey: 'stable-across-drift',
      };
      const first = await adminPieces({ request: adminReq('POST', requestBody), env });
      assert.equal(first.status, 201);
      const firstBody = await first.json();

      draftArtworks[0].edition_size = null;
      const replay = await adminPieces({ request: adminReq('POST', requestBody), env });
      assert.equal(replay.status, 200);
      assert.deepEqual(await replay.json(), firstBody);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('persists an issuance atomically and GET exposes only safe plate metadata', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB, rows, lineage } = makeIssuanceDb();
      const bucket = makeBackupBucket();
      const env = { ...issuanceEnv(DB), ARTWORK_REGISTRY_BACKUP: bucket };
      const post = await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionKind: 'unique', editionNumber: 0, uniqueConfirmed: true, issuanceKey: 'issue-atomic' }), env });
      const created = await post.json();
      assert.equal(post.status, 201);
      assert.ok(isWellFormedRecoveryCode(created.ownershipCode));
      assert.equal(rows.length, 1);
      assert.equal(rows[0].recovery_code_hash, await hashRecoveryCode(created.ownershipCode));
      assert.equal(rows[0].plate_status, 'generated');
      assert.equal(rows[0].front_svg_sha256, created.frontSha256);
      assert.equal(rows[0].back_svg_sha256, created.undersideSha256);
      assert.equal(lineage.length, 1);
      assert.equal(lineage[0][3], 'issued');
      assert.doesNotMatch(JSON.stringify(lineage), /ownership|cipher|nonce|buyer@/i);
      assert.ok(rows[0].ownership_code_ciphertext);
      assert.ok(rows[0].ownership_code_nonce);
      assert.equal(JSON.stringify(rows[0]).includes(normalizeRecoveryCode(created.ownershipCode)), false);
      const backup = JSON.parse(bucket.objects.get(`plates/${created.publicCode}.json`)!);
      assert.equal(backup.publicCode, created.publicCode);
      assert.equal(backup.envelope.ciphertext, rows[0].ownership_code_ciphertext);
      assert.equal(backup.envelope.nonce, rows[0].ownership_code_nonce);
      const backupBlob = JSON.stringify(backup);
      assert.equal(backupBlob.includes(created.ownershipCode), false);
      assert.equal(backupBlob.includes(rows[0].recovery_code_hash), false);
      assert.equal(backupBlob.includes(created.frontSvg), false);

      const res = await adminPieces({ request: adminReq('GET'), env });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.equal(json.pieces.length, 1);
      const listed = json.pieces[0];
      assert.equal(listed.pieceId, 'UL-100');
      assert.equal(listed.publicCode, created.publicCode);
      assert.equal(listed.plateStatus, 'generated');
      assert.equal(listed.backupStatus, 'verified');
      assert.equal(listed.frontSha256, created.frontSha256);
      const blob = JSON.stringify(json);
      for (const secret of ['ownershipCode', 'recovery_code_hash', 'ownership_code_ciphertext', 'ownership_code_nonce', 'ownership_code_key_version', 'frontSvg', 'undersideSvg']) {
        assert.equal(secret in listed, false);
      }
      assert.equal(blob.includes(created.ownershipCode), false);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('replays the exact deterministic package for the same issuance key', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB, rows } = makeIssuanceDb();
      const env = issuanceEnv(DB);
      const body = { pieceId: 'UL-100', editionKind: 'unique', editionNumber: 0, uniqueConfirmed: true, issuanceKey: 'same-request' };
      const first = await (await adminPieces({ request: adminReq('POST', body), env })).json();
      const secondRes = await adminPieces({ request: adminReq('POST', body), env });
      const second = await secondRes.json();
      assert.equal(secondRes.status, 200);
      assert.deepEqual(second, first);
      assert.equal(rows.length, 1);

      const wrongKind = await adminPieces({
        request: adminReq('POST', { ...body, editionKind: 'numbered' }),
        env,
      });
      assert.equal(wrongKind.status, 409);
      assert.deepEqual(await wrongKind.json(), { ok: false, error: 'idempotency_conflict' });
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('rejects issuance-key reuse for a different artwork identity without revealing a code', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB } = makeIssuanceDb();
      const env = issuanceEnv(DB);
      await adminPieces({
        request: adminReq('POST', { pieceId: 'UL-100', editionKind: 'unique', editionNumber: 0, uniqueConfirmed: true, issuanceKey: 'identity-bound' }),
        env,
      });
      const conflict = await adminPieces({
        request: adminReq('POST', { pieceId: 'UL-101', editionKind: 'unique', editionNumber: 0, uniqueConfirmed: true, issuanceKey: 'identity-bound' }),
        env,
      });
      assert.equal(conflict.status, 409);
      const body = await conflict.json();
      assert.deepEqual(body, { ok: false, error: 'idempotency_conflict' });
      assert.equal('ownershipCode' in body, false);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('never decrypts or replays a package after the plate leaves generated state', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB, rows } = makeIssuanceDb();
      const env = issuanceEnv(DB);
      const request = adminReq('POST', {
        pieceId: 'UL-100', editionKind: 'unique', editionNumber: 0, uniqueConfirmed: true, issuanceKey: 'locked-after-activation',
      });
      await adminPieces({ request, env });
      rows[0].plate_status = 'active';
      rows[0].ownership_code_ciphertext = 'not-valid-base64';

      const locked = await adminPieces({
        request: adminReq('POST', {
          pieceId: 'UL-100', editionKind: 'unique', editionNumber: 0, uniqueConfirmed: true, issuanceKey: 'locked-after-activation',
        }),
        env,
      });
      assert.equal(locked.status, 409);
      assert.deepEqual(await locked.json(), { ok: false, error: 'plate_identity_locked' });
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('rejects a different issuance key for the same artwork edition', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB } = makeIssuanceDb();
      const env = issuanceEnv(DB);
      await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionKind: 'unique', editionNumber: 0, uniqueConfirmed: true, issuanceKey: 'one' }), env });
      const res = await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionKind: 'unique', editionNumber: 0, uniqueConfirmed: true, issuanceKey: 'two' }), env });
      assert.equal(res.status, 409);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('retries a public-code collision and marks backup failures safely', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB, rows } = makeIssuanceDb({ collideOnce: true });
      const env = issuanceEnv(DB, true);
      const res = await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionKind: 'unique', editionNumber: 0, uniqueConfirmed: true, issuanceKey: 'collision' }), env });
      assert.equal(res.status, 201);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].backup_status, 'failed');
      assert.equal(rows[0].plate_status, 'generated');
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('returns the committed package when backup status recording fails and repairs it on replay', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB, rows } = makeIssuanceDb({ failBackupStatusOnce: true });
      const env = issuanceEnv(DB);
      const body = { pieceId: 'UL-100', editionKind: 'unique', editionNumber: 0, uniqueConfirmed: true, issuanceKey: 'repair-status' };

      const issued = await adminPieces({ request: adminReq('POST', body), env });
      assert.equal(issued.status, 201);
      const issuedBody = await issued.json();
      assert.equal(issuedBody.backupStatus, 'pending');
      assert.equal(issuedBody.warning, 'backup_status_record_failed');
      assert.ok(issuedBody.ownershipCode);
      assert.equal(rows[0].backup_status, 'pending');

      const replayed = await adminPieces({ request: adminReq('POST', body), env });
      assert.equal(replayed.status, 200);
      const replayedBody = await replayed.json();
      assert.equal(replayedBody.backupStatus, 'verified');
      assert.equal('warning' in replayedBody, false);
      assert.equal(replayedBody.ownershipCode, issuedBody.ownershipCode);
      assert.equal(rows[0].backup_status, 'verified');
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('returns an honest failed backup state while keeping the committed plate generated', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB, rows } = makeIssuanceDb();
      const env = issuanceEnv(DB, true);
      const issued = await adminPieces({
        request: adminReq('POST', {
          pieceId: 'UL-100', editionKind: 'unique', editionNumber: 0, uniqueConfirmed: true, issuanceKey: 'failed-backup-state',
        }),
        env,
      });
      assert.equal(issued.status, 201);
      const body = await issued.json();
      assert.equal(body.backupStatus, 'failed');
      assert.equal(body.warning, 'online_backup_failed');
      assert.equal(rows[0].backup_status, 'failed');
      assert.equal(rows[0].plate_status, 'generated');
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
  it('retries the identical stored envelope without a decryption path', async () => {
    const writes: Array<{ key: string; value: string }> = [];
    const bucket = {
      async put(key: string, value: string) {
        writes.push({ key, value });
      },
      async get(key: string) {
        const stored = [...writes].reverse().find((write) => write.key === key);
        return stored ? { text: async () => stored.value } : null;
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

    assert.deepEqual(await backupPlateEnvelope(bucket, encryptedRow), {
      status: 'verified', reference: 'plates/AR-ABCDEFGH.json',
    });
    assert.deepEqual(await backupPlateEnvelope(bucket, encryptedRow), {
      status: 'verified', reference: 'plates/AR-ABCDEFGH.json',
    });
    assert.equal(writes.length, 2);
    assert.equal(writes[0].value, writes[1].value);
    assert.deepEqual(JSON.parse(writes[1].value).envelope, {
      ciphertext: 'stored-ciphertext', nonce: 'stored-nonce', keyVersion: '7',
    });
  });
});

type LifecycleFixtureOptions = {
  status?: 'generated' | 'active';
  backupStatus?: 'pending' | 'failed' | 'verified';
  failAudit?: boolean;
  raceActivation?: boolean;
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
    backup_reference: 'plates/AR-7KQ9M2WX.json', backup_at: generatedAt,
    lineage_head_hash: null, lineage_event_count: 0,
  }, {
    id: 'kp-other', piece_id: 'UL-101', edition_number: 1,
    public_code: 'AR-ABCDEFGH', plate_status: 'generated',
    plate_generated_at: generatedAt, plate_activated_at: null,
    front_svg_sha256: 'other-front', back_svg_sha256: 'other-back',
    ownership_code_ciphertext: 'other-ciphertext', ownership_code_nonce: 'other-nonce',
    ownership_code_key_version: 1, recovery_code_hash: 'other-verifier', backup_status: 'verified',
    backup_reference: 'plates/AR-ABCDEFGH.json', backup_at: generatedAt,
    lineage_head_hash: null, lineage_event_count: 0,
  }];
  const audits: any[] = [];
  const lineage: any[] = [];
  const operations: string[] = [];

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
          const [status, reference, at, id] = params;
          const row = rows.find((item) => item.id === id);
          if (!row) return { success: true, meta: { changes: 0 } };
          Object.assign(row, { backup_status: status, backup_reference: reference, backup_at: at });
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
  return { DB, rows, audits, lineage, operations, ownershipCode, plate };
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
      async put(_key: string, value: string) { if (fail) throw new Error('R2 down'); writes.push(value); },
      async get(key: string) {
        if (fail) throw new Error('R2 down');
        const value = writes.at(-1);
        return value ? { text: async () => value } : null;
      },
    };
    const env = lifecycleEnv(fixture.DB, bucket);
    const request = () => lifecycleRequest('/api/admin/pieces/kp-one/backup', 'POST', {});

    const verified = await retryArtworkPlateBackup({ request: request(), env, params: { id: 'kp-one' } });
    assert.equal(verified.status, 200);
    assert.equal((await verified.json()).backupStatus, 'verified');
    assert.equal(fixture.rows[0].backup_status, 'verified');
    assert.match(writes[0], /stored-ciphertext-without-a-valid-key-envelope/);

    fail = true;
    const failed = await retryArtworkPlateBackup({ request: request(), env, params: { id: 'kp-one' } });
    assert.equal(failed.status, 503);
    assert.equal((await failed.json()).backupStatus, 'failed');
    assert.equal(fixture.rows[0].backup_status, 'failed');
    assert.equal(failed.headers.get('Cache-Control'), 'no-store');
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
// lookup getUserByClerkId runs). The session layer (requireUser) is module-
// mocked so we can drive distinct signed-in users without a real Better Auth
// cookie; the contested-claim bridge fetch is stubbed at globalThis.fetch.
//
// Run note: this section uses node:test's mock.module, so the suite is invoked
// with `npx tsx --test --experimental-test-module-mocks tests/living-legacy.test.ts`.
// The flag is benign for every other test in this file.

// getUserByClerkId is satisfied by the fake DB's users SELECT below, so we do
// not mock db.js; we just make the fake DB answer that statement.

// A fuller fake D1 that serves BOTH the admin registration statements and the
// steward-bind statements, plus the users lookup. Same key (piece_id +
// edition_number); UNIQUE(piece_id, edition_number) is honoured.
function makeKeeperDb() {
  const pieces: any[] = [];
  const lineage: any[] = [];
  const evidence: any[] = [];
  let loseNextFirstBind = false;
  let lastChanges = 0;
  const users: any[] = [{ id: 'row-1', clerk_user_id: 'user-first', email: 'first@example.com' }];

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

    // users lookup (getUserByClerkId)
    if (/^SELECT \* FROM users WHERE clerk_user_id = \?1/i.test(s)) {
      const u = users.find((r) => r.clerk_user_id === params[0]) || null;
      return { kind: 'first', row: u };
    }

    // bind SELECT: the row regardless of released_at (no released filter)
    if (
      /^SELECT id, keeper_user_id, recovery_code_hash, claimed_at, released_at(?:, public_code, plate_status, backup_status)? FROM keeper_pieces WHERE piece_id = \?1 AND edition_number = \?2$/i.test(
        s,
      )
    ) {
      return { kind: 'first', row: findAny(params[0], params[1]) || null };
    }

    if (/^SELECT .* FROM keeper_pieces WHERE issuance_key = \?1/i.test(s)) {
      return { kind: 'first', row: pieces.find((row) => row.issuance_key === params[0]) || null };
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
      const [status, reference, backupAt, id] = params;
      const row = pieces.find((r) => r.id === id);
      if (row) {
        row.backup_status = status;
        row.backup_reference = reference;
        row.backup_at = backupAt;
      }
      return { kind: 'run', meta: { changes: row ? 1 : 0 } };
    }

    // bind UPDATE: first bind only (guarded WHERE)
    if (
      /^UPDATE keeper_pieces SET keeper_user_id = \?1, claimed_at = \?2, released_at = NULL WHERE id = \?3 AND keeper_user_id IS NULL AND claimed_at IS NULL AND released_at IS NULL/i.test(
        s,
      )
    ) {
      const [keeperUserId, claimedAt, id] = params;
      const row = pieces.find((r) => r.id === id);
      if (loseNextFirstBind) {
        loseNextFirstBind = false;
        lastChanges = 0;
        return { kind: 'run', meta: { changes: 0 } };
      }
      const guardPasses = row && row.keeper_user_id == null && row.claimed_at == null && row.released_at == null;
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
    DB, pieces, users, lineage, evidence,
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

describe('steward bind lifecycle (register → first-bind → contested)', () => {
  it('walks the full happy path and the contested handoff', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    const origFetch = globalThis.fetch;
    try {
      // Imported AFTER the requireUser mock is installed.
      const { onRequest: bind } = await import('../functions/api/keeper/bind.js');

      const { DB, pieces, users, lineage, evidence, loseNextFirstBind } = makeKeeperDb();
      const adminEnv = issuanceEnv(DB);

      // 1) Admin registers the piece → we capture the printed recovery code.
      const reg = await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionKind: 'unique', editionNumber: 0, uniqueConfirmed: true, issuanceKey: 'keeper-lifecycle' }), env: adminEnv });
      assert.equal(reg.status, 201);
      const regJson = await reg.json();
      const recoveryCode: string = regJson.ownershipCode;
      assert.ok(isWellFormedRecoveryCode(recoveryCode));
      // Row exists, registered but unclaimed.
      assert.equal(pieces.length, 1);
      assert.equal(pieces[0].keeper_user_id, null);
      assert.equal(pieces[0].claimed_at, null);

      // Bind env: the bridge secret is set so the contested path actually fires.
      const bindEnv = { DB, CLAIM_BRIDGE_SECRET: 'shared-secret' };

      // A new registry identity is not bindable until physical activation and
      // verified online backup are both complete.
      CURRENT_AUTH = { userId: 'user-first', email: 'first@example.com', emailVerified: false };
      const unverifiedRes = await bind({ request: bindReq({ ownershipCode: recoveryCode, pieceId: 'UL-100' }), env: bindEnv });
      assert.equal(unverifiedRes.status, 403);
      assert.equal((await unverifiedRes.json()).error, 'verified_email_required');
      CURRENT_AUTH = { userId: 'user-first', email: 'first@example.com', emailVerified: true };
      const generatedRes = await bind({ request: bindReq({ ownershipCode: recoveryCode, pieceId: 'UL-100' }), env: bindEnv });
      assert.equal(generatedRes.status, 409);
      assert.equal((await generatedRes.json()).error, 'plate_not_ready');
      pieces[0].plate_status = 'active';
      pieces[0].backup_status = 'pending';
      const unbackedRes = await bind({ request: bindReq({ ownershipCode: recoveryCode, pieceId: 'UL-100' }), env: bindEnv });
      assert.equal(unbackedRes.status, 409);
      assert.equal((await unbackedRes.json()).error, 'plate_not_ready');

      // 2) FIRST BIND: active + verified, so the holder can bind.
      pieces[0].backup_status = 'verified';
      const fixtureState = { lineage: lineage.length, evidence: evidence.length };
      // Simulate a competing steward winning after the read but before UPDATE.
      // The losing batch must not stamp lineage or evidence.
      loseNextFirstBind();
      const lostRace = await bind({ request: bindReq({ recoveryCode, pieceId: 'UL-100' }), env: bindEnv });
      assert.equal(lostRace.status, 409);
      assert.equal(pieces[0].keeper_user_id, null);
      assert.equal(lineage.length, fixtureState.lineage);
      assert.equal(evidence.length, fixtureState.evidence);
      const firstRes = await bind({ request: bindReq({ recoveryCode, pieceId: 'UL-100' }), env: bindEnv });
      assert.equal(firstRes.status, 200);
      const firstJson = await firstRes.json();
      assert.equal(firstJson.ok, true);
      assert.equal(firstJson.keeper.pieceId, 'UL-100');
      assert.ok(firstJson.keeper.claimedAt);
      // The row now carries the first steward; still the SAME row (UPDATE, not INSERT).
      assert.equal(pieces.length, 1);
      assert.equal(pieces[0].keeper_user_id, 'user-first');
      assert.ok(pieces[0].claimed_at);
      assert.equal(lineage.at(-1)[3], 'first_bound');
      assert.equal(evidence.at(-1)[6], 'first_bound');
      assert.equal(evidence.at(-1)[3], 'first@example.com');
      assert.equal(evidence.at(-1)[4], '203.0.113.42');
      assert.doesNotMatch(lineage.at(-1)[7], /email|ip|ownership|cipher|nonce/i);

      // 2b) Re-scan by the SAME user is idempotent success, not a contested claim.
      const againRes = await bind({ request: bindReq({ recoveryCode, pieceId: 'UL-100' }), env: bindEnv });
      assert.equal(againRes.status, 200);
      const againJson = await againRes.json();
      assert.equal(againJson.ok, true);
      assert.equal('status' in againJson, false); // not a claim_requested envelope

      // 3) A DIFFERENT user now tries to bind → CONTESTED. Goes to a claim
      //    request (202), never a silent takeover. Stub the bridge fetch.
      let bridgeCalled = 0;
      globalThis.fetch = (async () => {
        bridgeCalled++;
        return new Response(JSON.stringify({ ok: true, status: 'opened', request: { id: 'req-1' } }), {
          status: 200,
        });
      }) as typeof fetch;
      // Seed the contesting user so getUserByClerkId resolves them, then bind AS
      // that user. user-first still holds the piece, so this is a genuine contest.
      users.push({ id: 'row-2', clerk_user_id: 'user-second', email: 'second@example.com' });
      CURRENT_AUTH = { userId: 'user-second', email: 'second@example.com', emailVerified: true };

      const contestRes = await bind({ request: bindReq({ recoveryCode, pieceId: 'UL-100' }), env: bindEnv });
      assert.equal(contestRes.status, 202);
      const contestJson = await contestRes.json();
      assert.equal(contestJson.ok, true);
      assert.equal(contestJson.status, 'claim_requested');
      assert.equal(contestJson.claim.outcome, 'opened');
      assert.match(contestJson.message, /current steward/i);
      assert.doesNotMatch(contestJson.message, /\bkeeper\b/i);
      assert.equal(bridgeCalled, 1);
      assert.equal(evidence.at(-1)[6], 'contested_attempt');
      // The binding was NOT stolen: user-first is still the steward.
      assert.equal(pieces[0].keeper_user_id, 'user-first');

      // Retries still reach the governed bridge, but private evidence is
      // atomically throttled for this piece/requester/outcome tuple.
      const evidenceCount = evidence.length;
      const repeatedContest = await bind({ request: bindReq({ recoveryCode, pieceId: 'UL-100' }), env: bindEnv });
      assert.equal(repeatedContest.status, 202);
      assert.equal(bridgeCalled, 2);
      assert.equal(evidence.length, evidenceCount);

      // A copied permanent code is not enough to open a governed claim.
      const wrongContest = await bind({ request: bindReq({ recoveryCode: 'AAAA-BBBB-CCCC-DDDD', pieceId: 'UL-100' }), env: bindEnv });
      assert.equal(wrongContest.status, 403);
      assert.equal(bridgeCalled, 2);

      // Once claimed, release never turns the permanent Ownership Code back
      // into a bearer instrument. A later holder enters the governed path.
      pieces[0].released_at = '2026-07-13T12:00:00Z';
      const releasedContest = await bind({ request: bindReq({ recoveryCode, pieceId: 'UL-100' }), env: bindEnv });
      assert.equal(releasedContest.status, 202);
      assert.equal(pieces[0].keeper_user_id, 'user-first');
      assert.equal(bridgeCalled, 3);

      // 4) WRONG code on an unclaimed piece is rejected (register a fresh piece).
      const reg2 = await adminPieces({ request: adminReq('POST', { pieceId: 'UL-101', editionKind: 'unique', editionNumber: 0, uniqueConfirmed: true, issuanceKey: 'keeper-negative' }), env: adminEnv });
      await reg2.json();
      CURRENT_AUTH = { userId: 'user-first', email: 'first@example.com', emailVerified: true };
      const wrongRes = await bind({
        request: bindReq({ recoveryCode: 'AAAA-BBBB-CCCC-DDDD', pieceId: 'UL-101' }),
        env: bindEnv,
      });
      assert.equal(wrongRes.status, 403);
      const wrongJson = await wrongRes.json();
      assert.equal(wrongJson.ok, false);
      assert.equal(wrongJson.error, 'code_mismatch');
      // Still unclaimed: a wrong code never binds.
      const row201 = pieces.find((r) => r.piece_id === 'UL-101');
      assert.equal(row201.keeper_user_id, null);

      // Legacy rows have no permanent public identity and remain compatible;
      // their pre-registry verifier is sufficient for a direct first bind.
      const legacyCode = 'ZZZZ-YYYY-XXXX-WWWW';
      pieces.push({
        id: 'kp-legacy-bind', piece_id: 'UL-103', edition_number: 0,
        keeper_user_id: null, recovery_code_hash: await hashRecoveryCode(legacyCode),
        claimed_at: null, released_at: null, public_code: null,
        plate_status: 'legacy', backup_status: null,
        lineage_head_hash: null, lineage_event_count: 0,
      });
      const legacyRes = await bind({ request: bindReq({ ownershipCode: legacyCode, pieceId: 'UL-103' }), env: bindEnv });
      assert.equal(legacyRes.status, 200);
      assert.equal(pieces.find((row) => row.id === 'kp-legacy-bind').keeper_user_id, 'user-first');

      // 5) Binding an UNREGISTERED piece is rejected (no row → not_registered).
      const unregRes = await bind({
        request: bindReq({ recoveryCode, pieceId: 'UL-999-never-registered' }),
        env: bindEnv,
      });
      assert.equal(unregRes.status, 404);
      const unregJson = await unregRes.json();
      assert.equal(unregJson.ok, false);
      assert.equal(unregJson.error, 'not_registered');
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
      globalThis.fetch = origFetch;
      CURRENT_AUTH = null;
    }
  });
});
