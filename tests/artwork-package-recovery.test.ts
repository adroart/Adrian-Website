import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, describe, it } from 'node:test';

import { buildArtworkPlatePackage } from '../utils/artworkPlate';
import { encryptOwnershipCode } from '../utils/ownershipCodeCrypto';
import { onRequest as recoverArtworkPackage } from '../functions/api/admin/pieces/[id]/package.js';
import { onRequest as verifyR2Recovery } from '../functions/api/admin/pieces/[id]/verify-recovery.js';
import { hashRecoveryCode } from '../functions/api/_lib/keeper.js';

const ADMIN_SECRET = 'registry-admin-secret';
const KEY = Buffer.alloc(32, 7).toString('base64');
const OWNERSHIP_CODE = 'K7QM-9XTR-2PHV-N4WB';

let fixtureRow: Record<string, unknown>;

before(async () => {
  const identity = {
    publicCode: 'AR-ABCDEFGH',
    pieceId: 'UL-100',
    editionNumber: 2,
  };
  const generatedAt = '2026-07-13T00:00:00.000Z';
  const [plate, envelope] = await Promise.all([
    buildArtworkPlatePackage({
      publicCode: identity.publicCode,
      ownershipCode: OWNERSHIP_CODE,
      artworkId: identity.pieceId,
      editionNumber: identity.editionNumber,
      generatedAt,
    }),
    encryptOwnershipCode(OWNERSHIP_CODE, identity, {
      OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
      OWNERSHIP_CODE_KEY_V1: KEY,
    }),
  ]);
  fixtureRow = {
    id: 'kp-package-1',
    piece_id: identity.pieceId,
    edition_number: identity.editionNumber,
    public_code: identity.publicCode,
    plate_status: 'generated',
    plate_generated_at: generatedAt,
    front_svg_sha256: plate.frontSha256,
    back_svg_sha256: plate.undersideSha256,
    ownership_code_ciphertext: envelope.ciphertext,
    ownership_code_nonce: envelope.nonce,
    ownership_code_key_version: envelope.keyVersion,
    recovery_code_hash: await hashRecoveryCode(OWNERSHIP_CODE),
  };
});

function request(method = 'POST', body: Record<string, unknown> = { adminSecret: ADMIN_SECRET }) {
  return new Request('https://adrianrasmussen.com/api/admin/pieces/kp-package-1/package', {
    method,
    headers: {
      Cookie: `admin_session=${ADMIN_SECRET}`,
      Origin: 'https://adrianrasmussen.com',
      'Content-Type': 'application/json',
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

function environment(options: {
  row?: Record<string, unknown> | null;
  failAudit?: boolean;
} = {}) {
  const operations: string[] = [];
  const row = options.row === undefined ? { ...fixtureRow } : options.row;
  const DB = {
    prepare(sql: string) {
      operations.push(sql.trim());
      if (/^SELECT \* FROM keeper_pieces/i.test(sql.trim())) {
        return {
          bind() { return this; },
          async first() { return row; },
        };
      }
      if (/^INSERT INTO ownership_code_audit/i.test(sql.trim())) {
        return {
          bind() { return this; },
          async run() {
            if (options.failAudit) throw new Error('audit unavailable');
            return { success: true };
          },
        };
      }
      throw new Error(`Unexpected database mutation: ${sql}`);
    },
  };
  return {
    env: {
      DB,
      UPLOAD_SECRET: ADMIN_SECRET,
      OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
      OWNERSHIP_CODE_KEY_V1: KEY,
    },
    operations,
  };
}

describe('audited fabrication-package recovery', () => {
  it('requires POST, admin cookie, same origin, step-up authentication, and D1', async () => {
    const { env } = environment();
    assert.equal((await recoverArtworkPackage({ request: request('GET'), env, params: { id: 'kp-package-1' } })).status, 405);
    const noCookie = request();
    noCookie.headers.delete('Cookie');
    assert.equal((await recoverArtworkPackage({ request: noCookie, env, params: { id: 'kp-package-1' } })).status, 401);
    const crossOrigin = request();
    crossOrigin.headers.set('Origin', 'https://example.com');
    assert.equal((await recoverArtworkPackage({ request: crossOrigin, env, params: { id: 'kp-package-1' } })).status, 403);
    assert.equal((await recoverArtworkPackage({ request: request('POST', { adminSecret: 'wrong' }), env, params: { id: 'kp-package-1' } })).status, 401);
    assert.equal((await recoverArtworkPackage({ request: request(), env: { ...env, DB: undefined }, params: { id: 'kp-package-1' } })).status, 503);
  });

  it('audits before decrypting and regenerates the exact immutable fabrication package', async () => {
    const { env, operations } = environment();
    const response = await recoverArtworkPackage({ request: request(), env, params: { id: 'kp-package-1' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), [
      'frontSha256', 'frontSvg', 'manifest', 'ok', 'ownershipCode', 'publicCode',
      'publicUrl', 'undersideSha256', 'undersideSvg',
    ]);
    assert.equal(body.ownershipCode, OWNERSHIP_CODE);
    assert.equal(body.manifest.artworkId, 'UL-100');
    assert.equal(body.manifest.editionNumber, 2);
    assert.match(operations[0], /^SELECT \*/);
    assert.match(operations[1], /^INSERT INTO ownership_code_audit/);
    assert.equal(operations.some((sql) => /UPDATE|INSERT INTO keeper_pieces/i.test(sql)), false);
  });

  it('fails closed when audit is unavailable or stored fabrication hashes differ', async () => {
    const auditFailure = environment({ failAudit: true });
    const blocked = await recoverArtworkPackage({ request: request(), env: auditFailure.env, params: { id: 'kp-package-1' } });
    assert.equal(blocked.status, 503);
    assert.deepEqual(await blocked.json(), { ok: false, error: 'audit_unavailable' });

    const mismatch = environment({ row: { ...fixtureRow, front_svg_sha256: 'wrong' } });
    const rejected = await recoverArtworkPackage({ request: request(), env: mismatch.env, params: { id: 'kp-package-1' } });
    assert.equal(rejected.status, 409);
    assert.deepEqual(await rejected.json(), { ok: false, error: 'fabrication_hash_mismatch' });
  });

  it('accepts only generated or active registry identities', async () => {
    const active = environment({ row: { ...fixtureRow, plate_status: 'active' } });
    const activeResponse = await recoverArtworkPackage({ request: request(), env: active.env, params: { id: 'kp-package-1' } });
    assert.equal(activeResponse.status, 200);
    assert.equal((await activeResponse.json()).ownershipCode, OWNERSHIP_CODE);

    const legacy = environment({ row: { ...fixtureRow, plate_status: 'legacy' } });
    assert.equal((await recoverArtworkPackage({ request: request(), env: legacy.env, params: { id: 'kp-package-1' } })).status, 404);
    const missing = environment({ row: null });
    assert.equal((await recoverArtworkPackage({ request: request(), env: missing.env, params: { id: 'kp-package-1' } })).status, 404);
  });

  it('fails closed when decrypted Ownership Code does not match its stored verifier', async () => {
    const mismatch = environment({ row: { ...fixtureRow, recovery_code_hash: '0'.repeat(64) } });
    const response = await recoverArtworkPackage({ request: request(), env: mismatch.env, params: { id: 'kp-package-1' } });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { ok: false, error: 'ownership_code_verifier_mismatch' });
  });
});

function r2RecoveryEnvironment(options: {
  row?: Record<string, unknown> | null;
  backup?: Record<string, unknown> | string | null;
  failAudit?: boolean;
  bucketMissing?: boolean;
} = {}) {
  const row = options.row === undefined
    ? {
      id: fixtureRow.id,
      piece_id: fixtureRow.piece_id,
      edition_number: fixtureRow.edition_number,
      public_code: fixtureRow.public_code,
      plate_status: fixtureRow.plate_status,
      plate_generated_at: fixtureRow.plate_generated_at,
      front_svg_sha256: fixtureRow.front_svg_sha256,
      back_svg_sha256: fixtureRow.back_svg_sha256,
      ownership_code_key_version: fixtureRow.ownership_code_key_version,
      recovery_code_hash: fixtureRow.recovery_code_hash,
      backup_status: 'verified',
      backup_reference: `plates/${fixtureRow.public_code}.json`,
    }
    : options.row;
  const defaultBackup = {
    schemaVersion: 1,
    publicCode: fixtureRow.public_code,
    pieceId: fixtureRow.piece_id,
    editionNumber: fixtureRow.edition_number,
    plateGeneratedAt: fixtureRow.plate_generated_at,
    envelope: {
      ciphertext: fixtureRow.ownership_code_ciphertext,
      nonce: fixtureRow.ownership_code_nonce,
      keyVersion: String(fixtureRow.ownership_code_key_version),
    },
  };
  const backup = options.backup === undefined ? defaultBackup : options.backup;
  const operations: string[] = [];
  const DB = {
    prepare(sql: string) {
      operations.push(sql.replace(/\s+/g, ' ').trim());
      if (/^SELECT /i.test(sql.trim())) {
        return {
          bind() { return this; },
          async first() { return row; },
        };
      }
      if (/^INSERT INTO ownership_code_audit/i.test(sql.trim())) {
        return {
          bind() { return this; },
          async run() {
            if (options.failAudit) throw new Error('audit unavailable');
            return { success: true };
          },
        };
      }
      throw new Error(`Unexpected database operation: ${sql}`);
    },
  };
  const bucket = options.bucketMissing ? undefined : {
    async get(reference: string) {
      operations.push(`R2 GET ${reference}`);
      if (backup === null) return null;
      const text = typeof backup === 'string' ? backup : JSON.stringify(backup);
      return { async text() { return text; } };
    },
  };
  return {
    operations,
    env: {
      DB,
      ARTWORK_REGISTRY_BACKUP: bucket,
      UPLOAD_SECRET: ADMIN_SECRET,
      OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
      OWNERSHIP_CODE_KEY_V1: KEY,
    },
  };
}

describe('R2 recovery canary', () => {
  it('reads the encrypted envelope from R2 and returns pass metadata only', async () => {
    const { env, operations } = r2RecoveryEnvironment();
    const response = await verifyR2Recovery({
      request: request(), env, params: { id: 'kp-package-1' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const body = await response.json();
    assert.deepEqual(body, {
      ok: true,
      recoveryStatus: 'passed',
      publicCode: 'AR-ABCDEFGH',
      pieceId: 'UL-100',
      editionNumber: 2,
      backupReference: 'plates/AR-ABCDEFGH.json',
      keyVersion: '1',
      frontSha256: fixtureRow.front_svg_sha256,
      undersideSha256: fixtureRow.back_svg_sha256,
    });
    assert.doesNotMatch(operations[0], /ownership_code_ciphertext|ownership_code_nonce/i);
    assert.match(operations[1], /^INSERT INTO ownership_code_audit/);
    assert.equal(operations[2], 'R2 GET plates/AR-ABCDEFGH.json');
    assert.equal(JSON.stringify(body).includes(OWNERSHIP_CODE), false);
  });

  it('requires admin step-up, D1, R2, and a successful pre-decryption audit', async () => {
    const { env } = r2RecoveryEnvironment();
    assert.equal((await verifyR2Recovery({ request: request('GET'), env, params: { id: 'kp-package-1' } })).status, 405);
    const noCookie = request();
    noCookie.headers.delete('Cookie');
    assert.equal((await verifyR2Recovery({ request: noCookie, env, params: { id: 'kp-package-1' } })).status, 401);
    assert.equal((await verifyR2Recovery({ request: request(), env: { ...env, DB: undefined }, params: { id: 'kp-package-1' } })).status, 503);
    assert.equal((await verifyR2Recovery({ request: request(), env: r2RecoveryEnvironment({ bucketMissing: true }).env, params: { id: 'kp-package-1' } })).status, 503);
    const failedAudit = r2RecoveryEnvironment({ failAudit: true });
    const blocked = await verifyR2Recovery({ request: request(), env: failedAudit.env, params: { id: 'kp-package-1' } });
    assert.equal(blocked.status, 503);
    assert.equal(failedAudit.operations.some((item) => item.startsWith('R2 GET')), false);
  });

  it('fails closed when the R2 reference, schema, or identity is not exact', async () => {
    const wrongReference = r2RecoveryEnvironment({
      row: {
        id: fixtureRow.id, piece_id: fixtureRow.piece_id, edition_number: fixtureRow.edition_number,
        public_code: fixtureRow.public_code, plate_status: 'generated', plate_generated_at: fixtureRow.plate_generated_at,
        front_svg_sha256: fixtureRow.front_svg_sha256, back_svg_sha256: fixtureRow.back_svg_sha256,
        ownership_code_key_version: 1, recovery_code_hash: fixtureRow.recovery_code_hash,
        backup_status: 'verified', backup_reference: 'plates/wrong.json',
      },
    });
    assert.equal((await verifyR2Recovery({ request: request(), env: wrongReference.env, params: { id: 'kp-package-1' } })).status, 409);

    for (const backup of [
      null,
      '{broken',
      { schemaVersion: 2 },
      {
        schemaVersion: 1, publicCode: 'AR-BCDEFGH', pieceId: 'UL-100', editionNumber: 2,
        plateGeneratedAt: fixtureRow.plate_generated_at,
        envelope: { ciphertext: fixtureRow.ownership_code_ciphertext, nonce: fixtureRow.ownership_code_nonce, keyVersion: '1' },
      },
    ]) {
      const fixture = r2RecoveryEnvironment({ backup });
      const response = await verifyR2Recovery({ request: request(), env: fixture.env, params: { id: 'kp-package-1' } });
      assert.notEqual(response.status, 200);
    }
  });

  it('constant-time verifies the code and exact regenerated SVG hashes', async () => {
    const verifierMismatch = r2RecoveryEnvironment({
      row: {
        id: fixtureRow.id, piece_id: fixtureRow.piece_id, edition_number: fixtureRow.edition_number,
        public_code: fixtureRow.public_code, plate_status: 'generated', plate_generated_at: fixtureRow.plate_generated_at,
        front_svg_sha256: fixtureRow.front_svg_sha256, back_svg_sha256: fixtureRow.back_svg_sha256,
        ownership_code_key_version: 1, recovery_code_hash: '0'.repeat(64),
        backup_status: 'verified', backup_reference: 'plates/AR-ABCDEFGH.json',
      },
    });
    const verifierResponse = await verifyR2Recovery({ request: request(), env: verifierMismatch.env, params: { id: 'kp-package-1' } });
    assert.equal(verifierResponse.status, 409);
    assert.deepEqual(await verifierResponse.json(), { ok: false, error: 'ownership_code_verifier_mismatch' });

    const hashMismatch = r2RecoveryEnvironment({
      row: {
        id: fixtureRow.id, piece_id: fixtureRow.piece_id, edition_number: fixtureRow.edition_number,
        public_code: fixtureRow.public_code, plate_status: 'generated', plate_generated_at: fixtureRow.plate_generated_at,
        front_svg_sha256: '0'.repeat(64), back_svg_sha256: fixtureRow.back_svg_sha256,
        ownership_code_key_version: 1, recovery_code_hash: fixtureRow.recovery_code_hash,
        backup_status: 'verified', backup_reference: 'plates/AR-ABCDEFGH.json',
      },
    });
    const hashResponse = await verifyR2Recovery({ request: request(), env: hashMismatch.env, params: { id: 'kp-package-1' } });
    assert.equal(hashResponse.status, 409);
    assert.deepEqual(await hashResponse.json(), { ok: false, error: 'fabrication_hash_mismatch' });
  });

  it('is wired into the admin desk and documented as a copied-artifact drill', () => {
    const adminSource = readFileSync(new URL('../components/AdminPieces.tsx', import.meta.url), 'utf8');
    assert.match(adminSource, /Verify R2 recovery/);
    assert.match(adminSource, /verify-recovery/);
    assert.match(adminSource, /R2 recovery passed/);

    const runbook = readFileSync(new URL('../docs/lineage-plate-runbook.md', import.meta.url), 'utf8');
    assert.match(runbook, /Verify R2 recovery/);
    assert.match(runbook, /copied R2 object/i);
    assert.match(runbook, /post-issuance D1 export/i);
    assert.match(runbook, /escrowed versioned key/i);
    assert.doesNotMatch(runbook, /Reveal exactly one non-production canary plate/);
  });
});
