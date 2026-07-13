import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
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

// Admin piece-registration endpoint + the launch flag it hides behind. We flip
// the flag on inside the registration suite (and restore it) so the same handler
// can be exercised; with the flag off it correctly 404s, which we also assert.
import { onRequest as adminPieces } from '../functions/api/admin/pieces.js';
import { backupPlateEnvelope } from '../functions/api/_lib/plateBackup.js';
import { onRequest as revealArtworkPlate } from '../functions/api/admin/pieces/[id]/reveal.js';
import { onRequest as retryArtworkPlateBackup } from '../functions/api/admin/pieces/[id]/backup.js';
import { onRequest as activateArtworkPlate } from '../functions/api/admin/pieces/[id]/activate.js';
import { LAUNCH_FLAGS } from '../launchFlags';

const migrationUrl = (name: string) => new URL(`../migrations/${name}`, import.meta.url);
const readMigration = (name: string) => readFileSync(migrationUrl(name), 'utf8');
const legacyKeeperSchema = () =>
  ['001_init.sql', '008_living_legacy.sql', '009_keeper_register.sql']
    .map(readMigration)
    .join('\n');
const registrySchema = () =>
  `${legacyKeeperSchema()}\n${readMigration('010_artwork_plate_identity.sql')}\n${readMigration('011_piece_fulfillments.sql')}`;
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
    assert.match(plate.undersideSvg, /width="70mm" height="25mm"/);
    assert.match(plate.undersideSvg, />OWNERSHIP CODE</);
    assert.match(plate.undersideSvg, /Register or transfer at adrianrasmussen\.com/);
    assert.match(plate.undersideSvg, /K7QM-9XTR-2PHV-N4WB/);
    assert.match(plate.undersideSvg, /SIG-100/);
    assert.equal(plate.manifest.ownershipCode, 'K7QM-9XTR-2PHV-N4WB');
    assert.equal(plate.manifest.artworkId, 'SIG-100');
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

  it('adds plate identity fields while preserving legacy keeper rows', () => {
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
    const past = new Date(
      Date.parse(baseRequest.createdAt) + CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const freed = evaluateClaimWindow({
      request: baseRequest,
      holderResponded: false,
      nowIso: past,
      warningsSent: CLAIM_WARNING_DAYS.length, // all four delivered
    });
    assert.equal(freed.status, 'frees-to-requester');
  });

  it('mere inactivity never frees: full window but warnings undelivered stays blocked', () => {
    const past = new Date(
      Date.parse(baseRequest.createdAt) + CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const notFreed = evaluateClaimWindow({
      request: baseRequest,
      holderResponded: false,
      nowIso: past,
      warningsSent: 0, // nothing actually delivered to the keeper yet
    });
    assert.notEqual(notFreed.status, 'frees-to-requester');
  });

  it('any keeper response keeps the piece blocked (engagement never frees)', () => {
    const past = new Date(
      Date.parse(baseRequest.createdAt) + CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const held = evaluateClaimWindow({
      request: baseRequest,
      holderResponded: true,
      nowIso: past,
      warningsSent: CLAIM_WARNING_DAYS.length,
    });
    assert.equal(held.status, 'blocked-active');
  });
});

// ── Admin piece registration endpoint ────────────────────────────────────────
// A tiny in-memory D1 stand-in. It understands only the few statement shapes the
// handler issues (a SELECT-by-piece, an INSERT, an UPDATE-of-hash, a list
// SELECT), keyed by piece_id + edition_number. Enough to exercise the
// show-code-once and refuse-overwrite rules without a real database.
function makeIssuanceDb(options: { collideOnce?: boolean } = {}) {
  const rows: any[] = []; // keeper_pieces
  let collisionPending = Boolean(options.collideOnce);

  function find(pieceId: string, edition: number) {
    return rows.find(
  let backupStatusFailurePending = Boolean(options.failBackupStatusOnce);
      (r) => r.piece_id === pieceId && r.edition_number === edition && !r.released_at,
    );
  }

  function exec(sql: string, params: any[]) {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (/^SELECT .* FROM keeper_pieces WHERE issuance_key = \?1/i.test(s)) {
      return { kind: 'first', row: rows.find((row) => row.issuance_key === params[0]) || null };
    }
    if (/^SELECT id FROM keeper_pieces WHERE piece_id = \?1 AND edition_number = \?2/i.test(s)) {
      return { kind: 'first', row: find(params[0], params[1]) || null };
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
      });
      return { kind: 'run' };
    }
    if (/^UPDATE keeper_pieces SET backup_status = \?1/i.test(s)) {
      const [status, reference, backupAt, id] = params;
      const row = rows.find((r) => r.id === id);
      if (row) {
      if (backupStatusFailurePending) {
        backupStatusFailurePending = false;
        throw new Error('D1 status update unavailable');
      }
        row.backup_status = status;
        row.backup_reference = reference;
        row.backup_at = backupAt;
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

  return { DB, rows };
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
    UPLOAD_SECRET: ADMIN_SECRET,
    DB,
    OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
    OWNERSHIP_CODE_KEY_V1: OWNERSHIP_TEST_KEY,
    ARTWORK_REGISTRY_BACKUP: makeBackupBucket({ fail: failBackup }),
  };
}

// A request carrying the admin cookie that requireAdmin() checks against
// env.UPLOAD_SECRET. This is the same gate every admin endpoint uses.
const ADMIN_SECRET = 'test-admin-secret';
function adminReq(method: string, body?: unknown) {
  return new Request('https://adrianrasmussen.com/api/admin/pieces', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: `admin_session=${ADMIN_SECRET}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('admin piece registration', () => {
  it('404s while the livingLegacy flag is off (surface stays invisible)', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = false;
    try {
      const { DB } = makeIssuanceDb();
      const res = await adminPieces({
        request: adminReq('POST', { pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'request-1' }),
        env: { UPLOAD_SECRET: ADMIN_SECRET, DB },
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
      const res = await adminPieces({ request: noCookie, env: { UPLOAD_SECRET: ADMIN_SECRET, DB } });
      assert.equal(res.status, 401);
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

  it('persists an issuance atomically and GET exposes only safe plate metadata', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB, rows } = makeIssuanceDb();
      const bucket = makeBackupBucket();
      const env = { ...issuanceEnv(DB), ARTWORK_REGISTRY_BACKUP: bucket };
      const post = await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'issue-atomic' }), env });
      const created = await post.json();
      assert.equal(post.status, 201);
      assert.ok(isWellFormedRecoveryCode(created.ownershipCode));
      assert.equal(rows.length, 1);
      assert.equal(rows[0].recovery_code_hash, await hashRecoveryCode(created.ownershipCode));
      assert.equal(rows[0].plate_status, 'generated');
      assert.equal(rows[0].front_svg_sha256, created.frontSha256);
      assert.equal(rows[0].back_svg_sha256, created.undersideSha256);
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
      const body = { pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'same-request' };
      const first = await (await adminPieces({ request: adminReq('POST', body), env })).json();
      const secondRes = await adminPieces({ request: adminReq('POST', body), env });
      const second = await secondRes.json();
      assert.equal(secondRes.status, 200);
      assert.deepEqual(second, first);
      assert.equal(rows.length, 1);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('rejects a different issuance key for the same artwork edition', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
  it('rejects issuance-key reuse for a different artwork identity without revealing a code', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB } = makeIssuanceDb();
      const env = issuanceEnv(DB);
      await adminPieces({
        request: adminReq('POST', { pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'identity-bound' }),
        env,
      });
      const conflict = await adminPieces({
        request: adminReq('POST', { pieceId: 'UL-101', editionNumber: 0, issuanceKey: 'identity-bound' }),
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
        pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'locked-after-activation',
      });
      await adminPieces({ request, env });
      rows[0].plate_status = 'active';
      rows[0].ownership_code_ciphertext = 'not-valid-base64';

      const locked = await adminPieces({
        request: adminReq('POST', {
          pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'locked-after-activation',
        }),
        env,
      });
      assert.equal(locked.status, 409);
      assert.deepEqual(await locked.json(), { ok: false, error: 'plate_identity_locked' });
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

    try {
      const { DB } = makeIssuanceDb();
      const env = issuanceEnv(DB);
      await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'one' }), env });
      const res = await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'two' }), env });
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
      const res = await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'collision' }), env });
      assert.equal(res.status, 201);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].backup_status, 'failed');
      assert.equal(rows[0].plate_status, 'generated');
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('returns a safe 503 when ownership-code crypto is not configured', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
  it('returns the committed package when backup status recording fails and repairs it on replay', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const { DB, rows } = makeIssuanceDb({ failBackupStatusOnce: true });
      const env = issuanceEnv(DB);
      const body = { pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'repair-status' };

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
          pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'failed-backup-state',
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

    try {
      const { DB, rows } = makeIssuanceDb();
      const res = await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'no-key' }), env: { UPLOAD_SECRET: ADMIN_SECRET, DB } });
      assert.equal(res.status, 503);
      assert.equal(rows.length, 0);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });
});

// ── Keeper bind: the full register → first-bind → contested lifecycle ─────────

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
// These exercise functions/api/keeper/bind.js against the SAME in-memory D1
// stand-in the admin suite uses, extended to the few extra statement shapes
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
    backup_status: options.backupStatus || 'verified',
    backup_reference: 'plates/AR-7KQ9M2WX.json', backup_at: generatedAt,
  }, {
    id: 'kp-other', piece_id: 'UL-101', edition_number: 1,
    public_code: 'AR-ABCDEFGH', plate_status: 'generated',
    plate_generated_at: generatedAt, plate_activated_at: null,
    front_svg_sha256: 'other-front', back_svg_sha256: 'other-back',
    ownership_code_ciphertext: 'other-ciphertext', ownership_code_nonce: 'other-nonce',
    ownership_code_key_version: 1, backup_status: 'verified',
    backup_reference: 'plates/AR-ABCDEFGH.json', backup_at: generatedAt,
  }];
  const audits: any[] = [];
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
        if (/^UPDATE keeper_pieces SET backup_status = \?1/i.test(normalized)) {
          const [status, reference, at, id] = params;
          const row = rows.find((item) => item.id === id);
          if (!row) return { success: true, meta: { changes: 0 } };
          Object.assign(row, { backup_status: status, backup_reference: reference, backup_at: at });
          return { success: true, meta: { changes: 1 } };
        }
        if (/^UPDATE keeper_pieces SET plate_status = 'active'/i.test(normalized)) {
          const [activatedAt, id] = params;
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

  const DB = { prepare: statement };
  return { DB, rows, audits, operations, ownershipCode, plate };
}

function lifecycleRequest(path: string, method: string, body?: unknown, options: {
  cookie?: boolean; origin?: string;
} = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.cookie !== false) headers.Cookie = `admin_session=${ADMIN_SECRET}`;
  if (options.origin !== '') headers.Origin = options.origin || 'https://adrianrasmussen.com';
  return new Request(`https://adrianrasmussen.com${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function lifecycleEnv(DB: any, bucket: any = makeBackupBucket()) {
  return {
    UPLOAD_SECRET: ADMIN_SECRET,
    DB,
    OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
    OWNERSHIP_CODE_KEY_V1: OWNERSHIP_TEST_KEY,
    ARTWORK_REGISTRY_BACKUP: bucket,
  };
}

const validActivation = (plate: { frontSha256: string; undersideSha256: string }) => ({
  adminSecret: ADMIN_SECRET,
  frontSha256: plate.frontSha256,
  undersideSha256: plate.undersideSha256,
  realMetalQrScanned: true,
  artworkEditionPublicCodeMatch: true,
  undersideOwnershipCodeMatch: true,
  attachmentAndAbrasionInspected: true,
});

describe('admin artwork plate lifecycle', () => {
  it('allows POST only and requires cookie auth, same origin, and constant-time step-up input', async () => {
    const fixture = await makePlateLifecycleFixture();
    const env = lifecycleEnv(fixture.DB);
    const path = '/api/admin/pieces/kp-one/reveal';

    const method = await revealArtworkPlate({ request: lifecycleRequest(path, 'GET'), env, params: { id: 'kp-one' } });
    assert.equal(method.status, 405);
    assert.equal(method.headers.get('Cache-Control'), 'no-store');
    assert.equal((await revealArtworkPlate({
      request: lifecycleRequest(path, 'POST', { adminSecret: ADMIN_SECRET }, { cookie: false }),
      env, params: { id: 'kp-one' },
    })).status, 401);
    assert.equal((await revealArtworkPlate({
      request: lifecycleRequest(path, 'POST', { adminSecret: ADMIN_SECRET }, { origin: '' }),
      env, params: { id: 'kp-one' },
    })).status, 403);
    assert.equal((await revealArtworkPlate({
      request: lifecycleRequest(path, 'POST', { adminSecret: 'wrong-secret' }),
      env, params: { id: 'kp-one' },
    })).status, 401);
    assert.equal(fixture.audits.length, 0);
  });

  it('audits before decrypting and reveals only the requested existing identity package', async () => {
    const fixture = await makePlateLifecycleFixture();
    const response = await revealArtworkPlate({
      request: lifecycleRequest('/api/admin/pieces/kp-one/reveal', 'POST', { adminSecret: ADMIN_SECRET }),
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

  it('refuses recovery when the required pre-decryption audit cannot be written', async () => {
    const fixture = await makePlateLifecycleFixture({ failAudit: true });
    fixture.rows[0].ownership_code_ciphertext = 'malformed-ciphertext';
    const response = await revealArtworkPlate({
      request: lifecycleRequest('/api/admin/pieces/kp-one/reveal', 'POST', { adminSecret: ADMIN_SECRET }),
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
    const request = () => lifecycleRequest('/api/admin/pieces/kp-one/backup', 'POST', { adminSecret: ADMIN_SECRET });

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
    assert.equal(fixture.audits.at(-1).outcome, 'activated');

    const repeated = await call(validActivation(fixture.plate));
    assert.equal(repeated.status, 200);
    assert.equal((await repeated.json()).idempotent, true);
    const mismatch = await call({ ...validActivation(fixture.plate), undersideSha256: 'wrong' });
    assert.equal(mismatch.status, 409);
    assert.equal(fixture.rows[0].plate_status, 'active');
  });
});

// ── Keeper bind: the full register → first-bind → contested lifecycle ─────────
// These exercise functions/api/keeper/bind.js against the SAME in-memory D1
// stand-in the admin suite uses, extended to the few extra statement shapes
// bind issues (the no-released-filter SELECT, the keeper UPDATE, and the users
// lookup getUserByClerkId runs). The session layer (requireUser) is module-
// mocked so we can drive distinct signed-in users without a real Better Auth
// cookie; the contested-claim bridge fetch is stubbed at globalThis.fetch.
//
// Run note: this section uses node:test's mock.module, so the suite is invoked
// with `npx tsx --test --experimental-test-module-mocks tests/living-legacy.test.ts`.
// The flag is benign for every other test in this file.

import { mock } from 'node:test';

// The signed-in identity bind sees. Mutated per-test before each call so one
// suite can play several different users (registrant never binds; first keeper;
// a second, contesting user).
let CURRENT_AUTH: { userId: string; email: string | null } | null = null;

mock.module('../functions/api/_lib/clerk.js', {
  namedExports: {
    requireUser: async () => {
      if (!CURRENT_AUTH) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
      }
      return { userId: CURRENT_AUTH.userId, email: CURRENT_AUTH.email };
    },
  },
});

// getUserByClerkId is satisfied by the fake DB's users SELECT below, so we do
// not mock db.js; we just make the fake DB answer that statement.

// A fuller fake D1 that serves BOTH the admin registration statements and the
// keeper-bind statements, plus the users lookup. Same key (piece_id +
// edition_number); UNIQUE(piece_id, edition_number) is honoured.
function makeKeeperDb() {
  const pieces: any[] = [];
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

    // users lookup (getUserByClerkId)
    if (/^SELECT \* FROM users WHERE clerk_user_id = \?1/i.test(s)) {
      const u = users.find((r) => r.clerk_user_id === params[0]) || null;
      return { kind: 'first', row: u };
    }

    // bind SELECT: the row regardless of released_at (no released filter)
    if (
      /^SELECT id, keeper_user_id, recovery_code_hash, claimed_at, released_at FROM keeper_pieces WHERE piece_id = \?1 AND edition_number = \?2$/i.test(
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

    // admin INSERT: fresh registration (no keeper yet)
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
      });
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

    // bind UPDATE: first bind / re-bind a released piece (guarded WHERE)
    if (
      /^UPDATE keeper_pieces SET keeper_user_id = \?1, claimed_at = \?2, released_at = NULL WHERE id = \?3 AND \(keeper_user_id IS NULL OR released_at IS NOT NULL\)/i.test(
        s,
      )
    ) {
      const [keeperUserId, claimedAt, id] = params;
      const row = pieces.find((r) => r.id === id);
      const guardPasses = row && (row.keeper_user_id == null || row.released_at != null);
      if (row && guardPasses) {
        row.keeper_user_id = keeperUserId;
        row.claimed_at = claimedAt;
        row.released_at = null;
        return { kind: 'run', meta: { changes: 1 } };
      }
      return { kind: 'run', meta: { changes: 0 } };
    }

    // list
    if (/^SELECT .* FROM keeper_pieces ORDER BY/i.test(s)) {
      return { kind: 'all', results: pieces.slice() };
    }
    throw new Error(`fake D1: unhandled statement: ${s}`);
  }

  const DB = {
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

  return { DB, pieces, users };
}

function bindReq(body: unknown) {
  return new Request('https://adrianrasmussen.com/api/keeper/bind', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('keeper bind lifecycle (register → first-bind → contested)', () => {
  it('walks the full happy path and the contested handoff', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    const origFetch = globalThis.fetch;
    try {
      // Imported AFTER the requireUser mock is installed.
      const { onRequest: bind } = await import('../functions/api/keeper/bind.js');

      const { DB, pieces, users } = makeKeeperDb();
      const adminEnv = issuanceEnv(DB);

      // 1) Admin registers the piece → we capture the printed recovery code.
      const reg = await adminPieces({ request: adminReq('POST', { pieceId: 'UL-100', editionNumber: 0, issuanceKey: 'keeper-lifecycle' }), env: adminEnv });
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

      // 2) FIRST BIND: the holder scans, enters the printed code → they bind.
      CURRENT_AUTH = { userId: 'user-first', email: 'first@example.com' };
      const firstRes = await bind({ request: bindReq({ recoveryCode, pieceId: 'UL-100' }), env: bindEnv });
      assert.equal(firstRes.status, 200);
      const firstJson = await firstRes.json();
      assert.equal(firstJson.ok, true);
      assert.equal(firstJson.keeper.pieceId, 'UL-100');
      assert.ok(firstJson.keeper.claimedAt);
      // The row now carries the first keeper; still the SAME row (UPDATE, not INSERT).
      assert.equal(pieces.length, 1);
      assert.equal(pieces[0].keeper_user_id, 'user-first');
      assert.ok(pieces[0].claimed_at);

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
      CURRENT_AUTH = { userId: 'user-second', email: 'second@example.com' };

      const contestRes = await bind({ request: bindReq({ recoveryCode, pieceId: 'UL-100' }), env: bindEnv });
      assert.equal(contestRes.status, 202);
      const contestJson = await contestRes.json();
      assert.equal(contestJson.ok, true);
      assert.equal(contestJson.status, 'claim_requested');
      assert.equal(contestJson.claim.outcome, 'opened');
      assert.equal(bridgeCalled, 1);
      // The binding was NOT stolen: user-first is still the keeper.
      assert.equal(pieces[0].keeper_user_id, 'user-first');

      // 4) WRONG code on an unclaimed piece is rejected (register a fresh piece).
      const reg2 = await adminPieces({ request: adminReq('POST', { pieceId: 'UL-101', editionNumber: 0, issuanceKey: 'keeper-negative' }), env: adminEnv });
      await reg2.json();
      CURRENT_AUTH = { userId: 'user-first', email: 'first@example.com' };
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
