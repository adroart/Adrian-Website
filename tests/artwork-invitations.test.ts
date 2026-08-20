import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { FULL_ARCHIVE } from '../data/mockData.ts';
import { registerArtwork } from '../functions/api/_lib/artworkRegistration.js';
import {
  createArtworkInvitation,
  inspectArtworkInvitation,
  redeemArtworkInvitation,
  revokeArtworkInvitation,
} from '../functions/api/_lib/artworkInvitations.js';
import { prepareFirstKeeperBind } from '../functions/api/_lib/keeperClaim.js';
import { onRequest as inspectInvitationRequest } from '../functions/api/invitations/[token].js';
import {
  identityRecoveryDependenciesForRow,
  identityRecoveryQualificationStatement,
} from '../functions/api/_lib/recoveryQualification.js';

const migrationNames = [
  '001_init.sql', '003_atlas_legacy.sql', '006_better_auth.sql',
  '008_living_legacy.sql', '009_keeper_register.sql',
  '010_artwork_plate_identity.sql', '011_piece_fulfillments.sql',
  '012_piece_fulfillment_guards.sql', '013_artwork_lineage.sql',
  '014_artwork_lineage_anchor.sql', '015_registry_artworks.sql',
  '016_keeper_piece_edition_kind_guard.sql',
  '017_creator_registry_maintenance.sql', '018_registry_plate_lifecycle.sql',
  '019_registry_creator_history.sql', '020_registry_recovery_qualification.sql',
  '021_registry_plate_backup_digest.sql', '022_registry_fulfillment_detachment.sql',
  '023_collector_registry_merge.sql', '024_ownership_foundation.sql',
  '025_artwork_registration.sql', '026_artwork_invitations.sql',
];

function invitationEnvironment(options: { staleIdentityBeforeRedemption?: boolean } = {}) {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  for (const name of migrationNames) {
    database.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
  database.exec(`
    INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
    VALUES
      ('SIG-100', 'Amphibian Dream', 'Signature', NULL,
       '2026-08-09T00:00:00.000Z'),
      ('SIG-101', 'Autumn Paladin', 'Signature', 7,
       '2026-08-09T00:00:00.000Z');
  `);
  const DB = {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...bound: SQLInputValue[]) { values = bound; return statement; },
        first() { return database.prepare(sql).get(...values) ?? null; },
        all() { return { results: database.prepare(sql).all(...values) }; },
        run() {
          const result = database.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
        get sql() { return sql; },
        get values() { return values; },
      };
      return statement;
    },
    async batch(statements: Array<{ sql: string; values: SQLInputValue[] }>) {
      if (
        options.staleIdentityBeforeRedemption
        && statements[0]?.sql.includes('INSERT INTO artwork_invitation_redemptions')
      ) {
        database.exec(`
          UPDATE keeper_pieces
             SET identity_backup_sha256 = '${'c'.repeat(64)}',
                 identity_backup_reference =
                   'identities/' || public_code || '/${'c'.repeat(64)}.json'
           WHERE keeper_user_id IS NULL AND registration_status = 'registered';
        `);
      }
      database.exec('BEGIN IMMEDIATE;');
      try {
        const results = statements.map((statement) => {
          const result = database.prepare(statement.sql).run(...statement.values);
          return { success: true, meta: { changes: Number(result.changes) } };
        });
        database.exec('COMMIT;');
        return results;
      } catch (error) {
        database.exec('ROLLBACK;');
        throw error;
      }
    },
  };
  const objects = new Map<string, Uint8Array>();
  return {
    database,
    env: {
      DB,
      ARTWORK_REGISTRY_BACKUP: {
        async put(key: string, value: Uint8Array) { objects.set(key, new Uint8Array(value)); },
        async get(key: string) {
          const bytes = objects.get(key);
          return bytes ? { async arrayBuffer() { return bytes.slice().buffer; } } : null;
        },
      },
      OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
      OWNERSHIP_CODE_KEY_V1: Buffer.alloc(32, 7).toString('base64'),
    },
  };
}

async function registeredPiece(
  fixture: ReturnType<typeof invitationEnvironment>,
  artworkId = 'SIG-100',
) {
  const edition = artworkId === 'SIG-100'
    ? { kind: 'unique' as const }
    : { kind: 'numbered' as const, number: 2, size: 7 };
  const registration = await registerArtwork(fixture.env, {
    artworkId,
    edition,
    authorization: {
      userId: 'admin-one',
      email: 'artist@example.com',
      registryUnlockExpiresAt: Math.floor(Date.now() / 1000) + 600,
    },
    idempotencyKey: `register-${artworkId}`,
    registeredAt: '2026-08-09T01:00:00.000Z',
  });
  const piece = fixture.database.prepare(
    'SELECT * FROM keeper_pieces WHERE id = ?1',
  ).get(registration.keeperPieceId) as Record<string, unknown>;
  await identityRecoveryQualificationStatement(fixture.env.DB, {
    keeperPieceId: registration.keeperPieceId,
    result: 'passed',
    copiedArtifact: true,
    dependencies: identityRecoveryDependenciesForRow(piece, fixture.env),
    administrator: { userId: 'admin-one', email: 'artist@example.com' },
    qualifiedAt: '2026-08-09T01:01:00.000Z',
    id: `irq-${artworkId}`,
  }).run();
  return registration;
}

function invitationInput(keeperPieceId: string, overrides: Record<string, unknown> = {}) {
  return {
    keeperPieceId,
    intendedRecipientEmail: 'Collector@Example.com',
    createdBy: 'admin-one',
    expiresAt: '2126-08-20T00:00:00.000Z',
    idempotencyKey: `invite-${keeperPieceId}`,
    createdAt: '2026-08-09T02:00:00.000Z',
    ...overrides,
  };
}

function claimant(email = 'collector@example.com', userId = 'collector-one') {
  return { userId, verifiedEmail: email };
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

describe('artwork invitation proof', () => {
  it('publishes the invitation and first-bind interfaces', () => {
    assert.equal(typeof createArtworkInvitation, 'function');
    assert.equal(typeof inspectArtworkInvitation, 'function');
    assert.equal(typeof redeemArtworkInvitation, 'function');
    assert.equal(typeof prepareFirstKeeperBind, 'function');
  });

  it('returns a plaintext token once and persists only its SHA-256 hash', async () => {
    const fixture = invitationEnvironment();
    try {
      const registration = await registeredPiece(fixture);
      const created = await createArtworkInvitation(
        fixture.env,
        invitationInput(registration.keeperPieceId),
      );
      assert.match(created.invitationId, /^iv-[0-9a-f-]{36}$/);
      assert.match(created.token, /^[A-Za-z0-9_-]{43}$/);

      const columns = fixture.database.prepare(
        "SELECT name FROM pragma_table_info('artwork_invitations') ORDER BY cid",
      ).all().map((row) => row.name);
      assert.equal(columns.includes('token'), false);
      assert.equal(columns.includes('token_plaintext'), false);

      const stored = fixture.database.prepare(
        'SELECT * FROM artwork_invitations WHERE id = ?1',
      ).get(created.invitationId) as Record<string, unknown>;
      assert.equal(stored.token_hash, await sha256Hex(created.token));
      assert.doesNotMatch(JSON.stringify(stored), new RegExp(created.token));

      await assert.rejects(
        createArtworkInvitation(fixture.env, invitationInput(registration.keeperPieceId)),
        (error: Error & { code?: string }) => error.code === 'invitation_already_created',
      );
      assert.equal(fixture.database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_invitations',
      ).get().n, 1);
    } finally {
      fixture.database.close();
    }
  });

  it('inspects only a public artwork summary and safe invitation status', async () => {
    const fixture = invitationEnvironment();
    try {
      const registration = await registeredPiece(fixture, 'SIG-101');
      const created = await createArtworkInvitation(
        fixture.env,
        invitationInput(registration.keeperPieceId),
      );
      const inspection = await inspectArtworkInvitation(
        fixture.env,
        created.token,
        '2026-08-10T00:00:00.000Z',
      );
      assert.deepEqual(inspection, {
        invitationId: created.invitationId,
        artwork: {
          artworkId: 'SIG-101',
          title: FULL_ARCHIVE.find((artwork) => artwork.id === 'SIG-101')?.title,
          publicCode: registration.publicCode,
          edition: { kind: 'numbered', number: 2, size: 7 },
        },
        status: 'available',
      });
      assert.doesNotMatch(JSON.stringify(inspection), /collector@|token|createdBy|admin-one|audit/i);

      await assert.rejects(
        inspectArtworkInvitation(fixture.env, 'not-a-real-token', '2026-08-10T00:00:00.000Z'),
        (error: Error & { code?: string }) => error.code === 'invitation_not_found',
      );
    } finally {
      fixture.database.close();
    }
  });

  it('inspects through an exact POST body without placing proof in the request URL', async () => {
    const fixture = invitationEnvironment();
    try {
      const registration = await registeredPiece(fixture);
      const created = await createArtworkInvitation(
        fixture.env,
        invitationInput(registration.keeperPieceId),
      );
      const url = 'https://adrianrasmussen.com/api/invitations/inspect';
      assert.equal(url.includes(created.token), false);
      const response = await inspectInvitationRequest({
        request: new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: created.token }),
        }),
        env: fixture.env,
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).status, 'available');

      const pathProof = await inspectInvitationRequest({
        request: new Request(`${url}/${created.token}`),
        env: fixture.env,
      });
      assert.equal(pathProof.status, 405);
      const extraAuthority = await inspectInvitationRequest({
        request: new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: created.token, artworkId: 'SIG-100' }),
        }),
        env: fixture.env,
      });
      assert.equal(extraAuthority.status, 400);
    } finally {
      fixture.database.close();
    }
  });

  it('resolves compiled catalog artwork without requiring a duplicate draft row', async () => {
    const fixture = invitationEnvironment();
    try {
      const artwork = FULL_ARCHIVE[0];
      assert.ok(artwork);
      assert.equal(fixture.database.prepare(
        'SELECT COUNT(*) AS n FROM registry_artworks WHERE id = ?1',
      ).get(artwork.id).n, 0);
      const keeperPieceId = 'kp-compiled-catalog';
      const publicCode = 'AR-ABCDEFGH';
      const backupHash = 'b'.repeat(64);
      fixture.database.prepare(
        `INSERT INTO keeper_pieces
           (id, piece_id, edition_number, recovery_code_hash, public_code,
            issuance_key, plate_status, ownership_code_ciphertext,
            ownership_code_nonce, ownership_code_key_version, registered_at,
            registration_status, registered_by_user_id, identity_backup_status,
            identity_backup_reference, identity_backup_sha256, identity_backup_at)
         VALUES (?1, ?2, 0, ?3, ?4, 'compiled-registration', 'legacy',
                 'ciphertext', 'nonce', 1, '2026-08-09T01:00:00.000Z',
                 'registered', 'admin-one', 'verified', ?5, ?6,
                 '2026-08-09T01:00:00.000Z')`,
      ).run(
        keeperPieceId, artwork.id, 'a'.repeat(64), publicCode,
        `identities/${publicCode}/${backupHash}.json`, backupHash,
      );
      const created = await createArtworkInvitation(
        fixture.env,
        invitationInput(keeperPieceId),
      );
      const inspected = await inspectArtworkInvitation(
        fixture.env, created.token, '2026-08-10T00:00:00.000Z',
      );
      assert.equal(inspected.artwork.artworkId, artwork.id);
      assert.equal(inspected.artwork.title, artwork.title);
      assert.deepEqual(inspected.artwork.edition, { kind: 'unique' });
    } finally {
      fixture.database.close();
    }
  });

  it('does not consume proof for the wrong verified recipient, expiry, or revocation', async () => {
    const fixture = invitationEnvironment();
    try {
      const registration = await registeredPiece(fixture);
      const wrongRecipient = await createArtworkInvitation(
        fixture.env,
        invitationInput(registration.keeperPieceId),
      );
      await assert.rejects(
        redeemArtworkInvitation(fixture.env, {
          token: wrongRecipient.token,
          claimant: claimant('someone-else@example.com', 'collector-two'),
          redeemedAt: '2026-08-10T00:00:00.000Z',
        }),
        (error: Error & { code?: string }) => error.code === 'invitation_recipient_mismatch',
      );
      assert.equal(fixture.database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_invitation_redemptions',
      ).get().n, 0);

      const expired = await createArtworkInvitation(fixture.env, invitationInput(
        registration.keeperPieceId,
        { idempotencyKey: 'expired-invitation', expiresAt: '2026-08-09T03:00:00.000Z' },
      ));
      assert.equal((await inspectArtworkInvitation(
        fixture.env, expired.token, '2026-08-10T00:00:00.000Z',
      )).status, 'expired');
      await assert.rejects(
        redeemArtworkInvitation(fixture.env, {
          token: expired.token,
          claimant: claimant(),
          redeemedAt: '2026-08-10T00:00:00.000Z',
        }),
        (error: Error & { code?: string }) => error.code === 'invitation_expired',
      );

      const revoked = await createArtworkInvitation(fixture.env, invitationInput(
        registration.keeperPieceId,
        { idempotencyKey: 'revoked-invitation' },
      ));
      await revokeArtworkInvitation(fixture.env, {
        invitationId: revoked.invitationId,
        revokedBy: 'admin-one',
        revokedAt: '2026-08-10T01:00:00.000Z',
      });
      assert.equal((await inspectArtworkInvitation(
        fixture.env, revoked.token, '2026-08-10T02:00:00.000Z',
      )).status, 'revoked');
      await assert.rejects(
        redeemArtworkInvitation(fixture.env, {
          token: revoked.token,
          claimant: claimant(),
          redeemedAt: '2026-08-10T02:00:00.000Z',
        }),
        (error: Error & { code?: string }) => error.code === 'invitation_revoked',
      );
    } finally {
      fixture.database.close();
    }
  });

  it('atomically consumes one invitation and first-binds with opaque public proof', async () => {
    const fixture = invitationEnvironment();
    try {
      const registration = await registeredPiece(fixture);
      const created = await createArtworkInvitation(
        fixture.env,
        invitationInput(registration.keeperPieceId),
      );
      const result = await redeemArtworkInvitation(fixture.env, {
        token: created.token,
        claimant: claimant(),
        evidence: { ipAddress: '203.0.113.8', userAgent: 'Invitation test' },
        redeemedAt: '2026-08-10T00:00:00.000Z',
      });
      assert.deepEqual(result, {
        keeper: {
          pieceId: 'SIG-100',
          editionNumber: 0,
          claimedAt: '2026-08-10T00:00:00.000Z',
        },
      });

      const bound = fixture.database.prepare(
        'SELECT keeper_user_id, claimed_at FROM keeper_pieces WHERE id = ?1',
      ).get(registration.keeperPieceId);
      assert.deepEqual({ ...bound }, {
        keeper_user_id: 'collector-one',
        claimed_at: '2026-08-10T00:00:00.000Z',
      });
      const receipt = fixture.database.prepare(
        'SELECT * FROM artwork_invitation_redemptions WHERE invitation_id = ?1',
      ).get(created.invitationId) as Record<string, unknown>;
      assert.equal(receipt.redeemed_by_user_id, 'collector-one');
      assert.equal(receipt.proof_reference, created.invitationId);
      assert.doesNotMatch(JSON.stringify(receipt), new RegExp(created.token));

      const lineage = fixture.database.prepare(
        "SELECT public_payload_json FROM artwork_lineage_events WHERE event_type = 'first_bound'",
      ).get();
      assert.deepEqual(JSON.parse(String(lineage.public_payload_json)), {});
      assert.doesNotMatch(JSON.stringify(lineage), /collector@|admin-one|token|203\.0\.113/);
      assert.equal((await inspectArtworkInvitation(
        fixture.env, created.token, '2026-08-10T00:01:00.000Z',
      )).status, 'used');
      await assert.rejects(
        redeemArtworkInvitation(fixture.env, {
          token: created.token,
          claimant: claimant(),
          redeemedAt: '2026-08-10T00:02:00.000Z',
        }),
        (error: Error & { code?: string }) => error.code === 'invitation_used',
      );
    } finally {
      fixture.database.close();
    }
  });

  it('rolls back invitation consumption and every bind surface when the guarded bind is stale', async () => {
    const fixture = invitationEnvironment({ staleIdentityBeforeRedemption: true });
    try {
      const registration = await registeredPiece(fixture);
      const created = await createArtworkInvitation(
        fixture.env,
        invitationInput(registration.keeperPieceId),
      );
      await assert.rejects(redeemArtworkInvitation(fixture.env, {
        token: created.token,
        claimant: claimant(),
        redeemedAt: '2026-08-10T00:00:00.000Z',
      }));

      assert.equal(fixture.database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_invitation_redemptions',
      ).get().n, 0);
      assert.equal(fixture.database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_invitation_redemption_completions',
      ).get().n, 0);
      assert.equal(fixture.database.prepare(
        "SELECT COUNT(*) AS n FROM artwork_lineage_events WHERE event_type = 'first_bound'",
      ).get().n, 0);
      assert.equal(fixture.database.prepare(
        "SELECT COUNT(*) AS n FROM artwork_claim_evidence WHERE outcome = 'first_bound'",
      ).get().n, 0);
      assert.deepEqual({ ...fixture.database.prepare(
        'SELECT keeper_user_id, claimed_at FROM keeper_pieces WHERE id = ?1',
      ).get(registration.keeperPieceId) }, {
        keeper_user_id: null,
        claimed_at: null,
      });
      assert.equal((await inspectArtworkInvitation(
        fixture.env, created.token, '2026-08-10T00:01:00.000Z',
      )).status, 'available');
    } finally {
      fixture.database.close();
    }
  });

  it('allows exactly one winner when two redemptions race', async () => {
    const fixture = invitationEnvironment();
    try {
      const registration = await registeredPiece(fixture);
      const created = await createArtworkInvitation(
        fixture.env,
        invitationInput(registration.keeperPieceId),
      );
      const attempts = await Promise.allSettled([
        redeemArtworkInvitation(fixture.env, {
          token: created.token,
          claimant: claimant(),
          redeemedAt: '2026-08-10T00:00:00.000Z',
        }),
        redeemArtworkInvitation(fixture.env, {
          token: created.token,
          claimant: claimant('collector@example.com', 'collector-two'),
          redeemedAt: '2026-08-10T00:00:00.001Z',
        }),
      ]);
      assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
      assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 1);
      assert.equal(fixture.database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_invitation_redemptions',
      ).get().n, 1);
      assert.equal(fixture.database.prepare(
        "SELECT COUNT(*) AS n FROM artwork_lineage_events WHERE event_type = 'first_bound'",
      ).get().n, 1);
    } finally {
      fixture.database.close();
    }
  });

  it('keeps an already-held piece governed instead of treating an invitation as transfer proof', async () => {
    const fixture = invitationEnvironment();
    try {
      const registration = await registeredPiece(fixture);
      const ownershipCode = (registration as typeof registration & {
        ownershipCode?: string;
      }).ownershipCode;
      assert.equal(typeof ownershipCode, 'string');
      const created = await createArtworkInvitation(
        fixture.env,
        invitationInput(registration.keeperPieceId),
      );
      const piece = fixture.database.prepare(
        'SELECT * FROM keeper_pieces WHERE id = ?1',
      ).get(registration.keeperPieceId);
      const bind = await prepareFirstKeeperBind(fixture.env, {
        piece,
        claimant: claimant('holder@example.com', 'current-holder'),
        proof: { kind: 'ownership_code', reference: ownershipCode },
        evidence: { ipAddress: null, userAgent: null },
        boundAt: '2026-08-09T03:00:00.000Z',
      });
      await fixture.env.DB.batch(bind.statements);

      await assert.rejects(
        redeemArtworkInvitation(fixture.env, {
          token: created.token,
          claimant: claimant(),
          redeemedAt: '2026-08-10T00:00:00.000Z',
        }),
        (error: Error & { code?: string }) => error.code === 'piece_already_held',
      );
      assert.equal(fixture.database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_invitation_redemptions',
      ).get().n, 0);
      assert.equal(fixture.database.prepare(
        'SELECT keeper_user_id FROM keeper_pieces WHERE id = ?1',
      ).get(registration.keeperPieceId).keeper_user_id, 'current-holder');
    } finally {
      fixture.database.close();
    }
  });
});
