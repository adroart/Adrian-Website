import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import {
  acceptArtworkContributorInvitation,
  inspectArtworkContributorInvitation,
  inviteArtworkContributor,
  listArtworkContributors,
  requireContributorAccess,
  requireKeeperAuthority,
  revokeArtworkContributor,
} from '../functions/api/_lib/artworkContributors.js';
import { openContestedClaim } from '../functions/api/_lib/claimRequests.js';

const readMigration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);
const migrationsThroughContributors = [
  '001_init.sql', '002_invoices.sql',
  '003_atlas_legacy.sql', '003_viewings.sql',
  '004_invoice_payment_choice.sql', '004_piece_content.sql',
  '005_atlas_legacy.sql', '005_invoice_amount_paid.sql',
  '006_better_auth.sql', '007_pricing.sql',
  '008_living_legacy.sql', '009_keeper_register.sql',
  '010_artwork_plate_identity.sql', '011_piece_fulfillments.sql',
  '012_piece_fulfillment_guards.sql', '013_artwork_lineage.sql',
  '014_artwork_lineage_anchor.sql', '015_registry_artworks.sql',
  '016_keeper_piece_edition_kind_guard.sql',
  '017_creator_registry_maintenance.sql', '018_registry_plate_lifecycle.sql',
  '019_registry_creator_history.sql', '020_registry_recovery_qualification.sql',
  '021_registry_plate_backup_digest.sql',
  '022_registry_fulfillment_detachment.sql', '023_collector_registry_merge.sql',
  '024_ownership_foundation.sql', '025_artwork_registration.sql',
  '026_artwork_invitations.sql', '027_certificate_templates.sql',
  '028_collector_privacy.sql', '029_collector_dreams.sql',
  '030_collector_field.sql', '031_collector_letters.sql',
  '032_artist_verified_sales.sql', '033_artwork_contributors.sql',
].map(readMigration).join('\n');

const invitedAt = '2026-08-10T10:00:00.000Z';
const acceptedAt = '2026-08-10T11:00:00.000Z';
const expiresAt = '2026-08-17T10:00:00.000Z';
const verifiedContributor = {
  userId: 'contributor-one',
  verifiedEmail: 'contributor@example.com',
};

function fixture() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    PRAGMA foreign_keys = ON;
    ${migrationsThroughContributors}
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES
      ('keeper-one', 'Keeper One', 'keeper@example.com', 1, 1, 1),
      ('keeper-next', 'Keeper Next', 'next@example.com', 1, 1, 1),
      ('contributor-one', 'Contributor One', 'contributor@example.com', 1, 1, 1),
      ('contributor-two', 'Contributor Two', 'second@example.com', 1, 1, 1),
      ('unverified-one', 'Unverified', 'unverified@example.com', 0, 1, 1),
      ('ambiguous-a', 'Ambiguous A', 'Twin@Example.com', 1, 1, 1),
      ('ambiguous-b', 'Ambiguous B', 'twin@example.com', 1, 1, 1);
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       claimed_at, registered_at)
    VALUES
      ('kp-one', 'UL-100', 0, 'keeper-one', '${'a'.repeat(64)}',
       '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
      ('kp-two', 'UL-101', 2, 'keeper-one', '${'b'.repeat(64)}',
       '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');
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
      database.exec('BEGIN IMMEDIATE;');
      try {
        const result = statements.map((statement) => {
          const outcome = database.prepare(statement.sql).run(...statement.values);
          return { success: true, meta: { changes: Number(outcome.changes) } };
        });
        database.exec('COMMIT;');
        return result;
      } catch (error) {
        database.exec('ROLLBACK;');
        throw error;
      }
    },
  };
  return { database, env: { DB } };
}

function inviteInput(overrides: Record<string, unknown> = {}) {
  return {
    keeperPieceId: 'kp-one',
    keeperUserId: 'keeper-one',
    intendedRecipientEmail: 'Contributor@Example.com',
    expiresAt,
    idempotencyKey: 'invite-contributor-one',
    invitedAt,
    ...overrides,
  };
}

function acceptInput(token: string, overrides: Record<string, unknown> = {}) {
  return {
    token,
    claimant: verifiedContributor,
    idempotencyKey: 'accept-contributor-one',
    acceptedAt,
    ...overrides,
  };
}

async function acceptedAccess(target = fixture()) {
  const invitation = await inviteArtworkContributor(target.env, inviteInput());
  const accepted = await acceptArtworkContributorInvitation(
    target.env,
    acceptInput(invitation.token),
  );
  return { ...target, invitation, accepted };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: Error & { code?: string }) => error.code === code);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function canonicalTransfer(
  database: DatabaseSync,
  { suffix, from, to, version, previousHash, hash }: {
    suffix: string;
    from: string;
    to: string;
    version: number;
    previousHash: string | null;
    hash: string;
  },
) {
  const at = `2026-08-${version + 11}T00:00:00.000Z`;
  const sequence = version + 1;
  const previousSql = previousHash === null ? 'NULL' : `'${previousHash}'`;
  database.exec(`
    INSERT INTO registry_maintenance_events
      (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
       administrator_user_id, administrator_email, reason, before_json,
       after_json, outcome, related_record_id, mutation_fingerprint, created_at)
    VALUES
      ('rme-${suffix}', 'rme-${suffix}', 'steward_transferred', 'kp-one', 'UL-100',
       'admin', 'admin@example.com', 'Governed transfer.',
       '{"keeperUserId":"${from}","claimedAt":"2026-08-01T00:00:00.000Z","releasedAt":null,"currentDisplayLocation":null,"stewardVersion":${version}}',
       '{"keeperUserId":"${to}","claimedAt":"${at}","releasedAt":null,"currentDisplayLocation":null,"stewardVersion":${version + 1}}',
       'succeeded', 'kp-one', '${String(version + 3).repeat(64).slice(0, 64)}', '${at}');
    INSERT INTO artwork_transfer_intents
      (id, keeper_piece_id, expected_from_user_id, target_user_id,
       target_email_commitment, expected_steward_version, expected_lineage_count,
       expected_lineage_hash, transfer_kind, maintenance_event_id,
       lineage_event_id, created_at)
    VALUES
      ('transfer-${suffix}', 'kp-one', '${from}', '${to}', '${'f'.repeat(64)}',
       ${version}, ${version}, ${previousSql}, 'gift', 'rme-${suffix}',
       'lineage-${suffix}', '${at}');
    INSERT INTO artwork_transfer_parties
      (id, transfer_intent_id, party_role, user_id, public_ref, created_at)
    VALUES
      ('party-${suffix}-from', 'transfer-${suffix}', 'from', '${from}',
       'tp-00000000-0000-4000-8000-00000000000${sequence * 2 - 1}', '${at}'),
      ('party-${suffix}-to', 'transfer-${suffix}', 'to', '${to}',
       'tp-00000000-0000-4000-8000-00000000000${sequence * 2}', '${at}');
    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json)
    VALUES
      ('lineage-${suffix}', 'kp-one', ${sequence}, 'transferred', '${at}',
       ${previousSql}, '${hash}',
       '{"fromRef":"tp-00000000-0000-4000-8000-00000000000${sequence * 2 - 1}","toRef":"tp-00000000-0000-4000-8000-00000000000${sequence * 2}","transferKind":"gift"}');
    INSERT INTO artwork_transfer_receipts (id, transfer_intent_id, committed_at)
    VALUES ('receipt-${suffix}', 'transfer-${suffix}', '${at}');
  `);
}

describe('artwork contributor access foundation', () => {
  it('publishes only the narrow contributor authority interfaces', () => {
    for (const method of [
      inviteArtworkContributor,
      inspectArtworkContributorInvitation,
      acceptArtworkContributorInvitation,
      listArtworkContributors,
      revokeArtworkContributor,
      requireContributorAccess,
      requireKeeperAuthority,
    ]) assert.equal(typeof method, 'function');
  });

  it('requires the current exact keeper and rejects stale or nonkeeper authority', async () => {
    const { database, env } = fixture();
    try {
      assert.deepEqual(await requireKeeperAuthority(env, {
        keeperPieceId: 'kp-one', userId: 'keeper-one', stewardVersion: 0,
      }), { keeperPieceId: 'kp-one', keeperUserId: 'keeper-one', stewardVersion: 0 });
      await expectCode(requireKeeperAuthority(env, {
        keeperPieceId: 'kp-one', userId: 'keeper-next', stewardVersion: 0,
      }), 'keeper_authority_required');
      await expectCode(requireKeeperAuthority(env, {
        keeperPieceId: 'kp-one', userId: 'keeper-one', stewardVersion: 1,
      }), 'stale_keeper_authority');
      await expectCode(requireKeeperAuthority(env, {
        keeperPieceId: 'unknown', userId: 'keeper-one', stewardVersion: 0,
      }), 'keeper_piece_not_found');
    } finally { database.close(); }
  });

  it('structurally rejects forged or unverified invitation bindings', () => {
    const { database } = fixture();
    try {
      for (const [id, keeper, version, recipient] of [
        ['aci-00000000-0000-4000-8000-000000000001', 'keeper-next', 0, 'contributor-one'],
        ['aci-00000000-0000-4000-8000-000000000002', 'keeper-one', 1, 'contributor-one'],
        ['aci-00000000-0000-4000-8000-000000000003', 'keeper-one', 0, 'unverified-one'],
      ] as const) {
        assert.throws(() => database.prepare(`
          INSERT INTO artwork_contributor_invitations
            (id, keeper_piece_id, keeper_user_id, steward_version,
             intended_recipient_user_id, token_hash, idempotency_key,
             request_fingerprint, invited_at, expires_at)
          VALUES (?, 'kp-one', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, keeper, version, recipient,
          String(version + 3).repeat(64).slice(0, 64), `forged-${id}`,
          String(version + 6).repeat(64).slice(0, 64), invitedAt, expiresAt,
        ), /current keeper|verified recipient/i);
      }
    } finally { database.close(); }
  });

  it('rejects self, unknown, unverified, and ambiguous intended recipients', async () => {
    for (const [email, code] of [
      ['keeper@example.com', 'contributor_cannot_be_keeper'],
      ['missing@example.com', 'contributor_recipient_not_found'],
      ['unverified@example.com', 'contributor_recipient_unverified'],
      ['twin@example.com', 'contributor_recipient_ambiguous'],
    ]) {
      const { database, env } = fixture();
      try {
        await expectCode(inviteArtworkContributor(env, inviteInput({
          intendedRecipientEmail: email,
        })), code);
      } finally { database.close(); }
    }
  });

  it('rejects noncanonical instants before persistence', async () => {
    const { database, env } = fixture();
    try {
      await expectCode(inviteArtworkContributor(env, inviteInput({
        invitedAt: '2026-08-10',
      })), 'invalid_invited_at');
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
      ).get().n, 0);
    } finally { database.close(); }
  });

  it('returns plaintext once, stores only SHA-256, and enforces exact replay or conflict', async () => {
    const { database, env } = fixture();
    try {
      const created = await inviteArtworkContributor(env, inviteInput());
      assert.match(created.invitationId, /^aci-[0-9a-f-]{36}$/);
      assert.match(created.token, /^[A-Za-z0-9_-]{43}$/);
      const stored = database.prepare(
        'SELECT * FROM artwork_contributor_invitations WHERE id = ?',
      ).get(created.invitationId) as Record<string, unknown>;
      assert.equal(stored.token_hash, await sha256Hex(created.token));
      assert.doesNotMatch(JSON.stringify(stored), new RegExp(created.token));
      const columns = database.prepare(
        "SELECT name FROM pragma_table_info('artwork_contributor_invitations')",
      ).all().map((row) => row.name);
      assert.equal(columns.some((name) => /plain|token_value/i.test(String(name))), false);

      assert.deepEqual(await inviteArtworkContributor(env, inviteInput()), {
        invitationId: created.invitationId,
        status: 'replay',
      });
      await expectCode(inviteArtworkContributor(env, inviteInput({
        intendedRecipientEmail: 'second@example.com',
      })), 'contributor_idempotency_conflict');
    } finally { database.close(); }
  });

  it('inspects only for the exact verified recipient and exposes no private identities', async () => {
    const { database, env } = fixture();
    try {
      const created = await inviteArtworkContributor(env, inviteInput());
      const inspection = await inspectArtworkContributorInvitation(env, {
        token: created.token,
        claimant: verifiedContributor,
        inspectedAt: acceptedAt,
      });
      assert.deepEqual(inspection, {
        invitationId: created.invitationId,
        artwork: {
          artworkId: 'UL-100',
          publicCode: null,
          edition: { kind: 'unique' },
        },
        status: 'available',
      });
      assert.equal('keeperPieceId' in inspection.artwork, false);
      assert.doesNotMatch(JSON.stringify(inspection), /kp-one|keeper-one|contributor@|token_hash|steward/i);
      await expectCode(inspectArtworkContributorInvitation(env, {
        token: created.token,
        claimant: { userId: 'contributor-two', verifiedEmail: 'second@example.com' },
        inspectedAt: acceptedAt,
      }), 'contributor_invitation_not_available');
    } finally { database.close(); }
  });

  it('projects a numbered edition with unknown size without inventing a value', async () => {
    const { database, env } = fixture();
    try {
      const created = await inviteArtworkContributor(env, inviteInput({
        keeperPieceId: 'kp-two',
        idempotencyKey: 'invite-numbered-piece',
      }));
      const inspection = await inspectArtworkContributorInvitation(env, {
        token: created.token,
        claimant: verifiedContributor,
        inspectedAt: acceptedAt,
      });
      assert.deepEqual(inspection.artwork, {
        artworkId: 'UL-101',
        publicCode: null,
        edition: { kind: 'numbered', number: 2, size: null },
      });
    } finally { database.close(); }
  });

  it('atomically consumes exact proof and creates one current access grant', async () => {
    const { database, env, invitation, accepted } = await acceptedAccess();
    try {
      assert.equal(accepted.status, 'accepted');
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_invitation_acceptances',
      ).get().n, 1);
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_access_grants',
      ).get().n, 1);
      assert.deepEqual(await requireContributorAccess(env, {
        keeperPieceId: 'kp-one', userId: 'contributor-one',
      }), {
        keeperPieceId: 'kp-one', contributorUserId: 'contributor-one',
        keeperUserId: 'keeper-one', stewardVersion: 0,
      });
      assert.equal((await acceptArtworkContributorInvitation(
        env, acceptInput(invitation.token),
      )).status, 'replay');
      await expectCode(acceptArtworkContributorInvitation(env, acceptInput(
        invitation.token,
        { idempotencyKey: 'accept-conflict', acceptedAt: '2026-08-10T11:01:00.000Z' },
      )), 'contributor_invitation_used');
    } finally { database.close(); }
  });

  it('refuses contributor access while the intended recipient has a pending ownership claim', async () => {
    const { database, env } = fixture();
    try {
      const created = await inviteArtworkContributor(env, inviteInput());
      assert.equal((await openContestedClaim(env, {
        keeperPieceId: 'kp-one', requesterUserId: 'contributor-one',
        requesterEmail: 'contributor@example.com', expectedKeeperUserId: 'keeper-one',
        openedAt: acceptedAt,
      })).status, 'opened');
      await expectCode(acceptArtworkContributorInvitation(
        env, acceptInput(created.token),
      ), 'contributor_invitation_claim_pending');
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_access_grants',
      ).get().n, 0);
    } finally { database.close(); }
  });

  it('fails wrong-recipient, expired, revoked, reused, and concurrent acceptance closed', async () => {
    const wrong = fixture();
    try {
      const created = await inviteArtworkContributor(wrong.env, inviteInput());
      await expectCode(acceptArtworkContributorInvitation(wrong.env, acceptInput(created.token, {
        claimant: { userId: 'contributor-two', verifiedEmail: 'second@example.com' },
      })), 'contributor_invitation_not_available');
      await expectCode(acceptArtworkContributorInvitation(wrong.env, acceptInput(created.token, {
        acceptedAt: expiresAt,
      })), 'contributor_invitation_expired');
    } finally { wrong.database.close(); }

    const revoked = fixture();
    try {
      const created = await inviteArtworkContributor(revoked.env, inviteInput());
      await revokeArtworkContributor(revoked.env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one',
        invitationId: created.invitationId, idempotencyKey: 'revoke-pending',
        revokedAt: acceptedAt,
      });
      await expectCode(acceptArtworkContributorInvitation(
        revoked.env, acceptInput(created.token),
      ), 'contributor_invitation_revoked');
    } finally { revoked.database.close(); }

    const raced = fixture();
    try {
      const created = await inviteArtworkContributor(raced.env, inviteInput());
      const outcomes = await Promise.allSettled([
        acceptArtworkContributorInvitation(raced.env, acceptInput(created.token)),
        acceptArtworkContributorInvitation(raced.env, acceptInput(created.token, {
          idempotencyKey: 'accept-concurrent-second',
        })),
      ]);
      assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
      assert.equal(raced.database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_access_grants',
      ).get().n, 1);
    } finally { raced.database.close(); }
  });

  it('lists current access privately and current keeper can revoke it append-only', async () => {
    const { database, env, invitation } = await acceptedAccess();
    try {
      assert.deepEqual(await listArtworkContributors(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one', at: acceptedAt,
      }), {
        invitations: [{
          invitationId: invitation.invitationId,
          invitedAt,
          expiresAt,
          status: 'accepted',
        }],
        contributors: [{
          contributorUserId: 'contributor-one',
          grantedAt: acceptedAt,
          status: 'active',
        }],
      });
      const revoked = await revokeArtworkContributor(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one',
        contributorUserId: 'contributor-one', idempotencyKey: 'revoke-access',
        revokedAt: '2026-08-10T12:00:00.000Z',
      });
      assert.equal(revoked.status, 'revoked');
      await expectCode(requireContributorAccess(env, {
        keeperPieceId: 'kp-one', userId: 'contributor-one',
      }), 'contributor_access_required');
      assert.throws(() => database.prepare(
        'DELETE FROM artwork_contributor_revocations',
      ).run(), /append-only|may not be deleted/i);
    } finally { database.close(); }
  });

  it('lists current-epoch invitation ids and statuses so a lost proof can be revoked', async () => {
    const { database, env } = fixture();
    try {
      await inviteArtworkContributor(env, inviteInput());
      const before = await listArtworkContributors(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one', at: acceptedAt,
      });
      assert.equal(before.contributors.length, 0);
      assert.deepEqual(before.invitations.map((invitation: Record<string, unknown>) => ({
        ...invitation,
        invitationId: typeof invitation.invitationId === 'string'
          ? 'safe-id'
          : invitation.invitationId,
      })), [{
        invitationId: 'safe-id', invitedAt, expiresAt, status: 'available',
      }]);
      assert.deepEqual(Object.keys(before.invitations[0]).sort(), [
        'expiresAt', 'invitationId', 'invitedAt', 'status',
      ]);

      await revokeArtworkContributor(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one',
        invitationId: before.invitations[0].invitationId,
        idempotencyKey: 'revoke-listed-invitation', revokedAt: acceptedAt,
      });
      const after = await listArtworkContributors(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one',
        at: '2026-08-10T12:00:00.000Z',
      });
      assert.equal(after.invitations[0].status, 'revoked');
    } finally { database.close(); }
  });

  it('keeps expired invitations stably expired and rejects app and database revocation', async () => {
    const { database, env } = fixture();
    try {
      const created = await inviteArtworkContributor(env, inviteInput());
      const expired = await listArtworkContributors(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one', at: expiresAt,
      });
      assert.equal(expired.invitations[0].status, 'expired');
      await expectCode(revokeArtworkContributor(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one',
        invitationId: created.invitationId,
        idempotencyKey: 'revoke-expired', revokedAt: expiresAt,
      }), 'contributor_invitation_expired');
      assert.throws(() => database.prepare(`
        INSERT INTO artwork_contributor_revocations
          (revocation_kind, invitation_id, revoked_by_keeper_user_id,
           steward_version, idempotency_key, request_fingerprint, revoked_at)
        VALUES ('invitation', ?, 'keeper-one', 0, 'raw-revoke-expired', ?, ?)
      `).run(created.invitationId, '4'.repeat(64), expiresAt), /cannot be revoked/i);
      const stable = await listArtworkContributors(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one',
        at: '2026-08-18T00:00:00.000Z',
      });
      assert.equal(stable.invitations[0].status, 'expired');
    } finally { database.close(); }
  });

  it('allows the same current keeper to grant fresh access after an explicit revocation', async () => {
    const { database, env } = await acceptedAccess();
    try {
      await revokeArtworkContributor(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one',
        contributorUserId: 'contributor-one', idempotencyKey: 'revoke-first-access',
        revokedAt: '2026-08-10T12:00:00.000Z',
      });
      const next = await inviteArtworkContributor(env, inviteInput({
        idempotencyKey: 'invite-contributor-again',
        invitedAt: '2026-08-10T13:00:00.000Z',
      }));
      const accepted = await acceptArtworkContributorInvitation(env, acceptInput(next.token, {
        idempotencyKey: 'accept-contributor-again',
        acceptedAt: '2026-08-10T14:00:00.000Z',
      }));
      assert.equal(accepted.status, 'accepted');
      assert.equal((await requireContributorAccess(env, {
        keeperPieceId: 'kp-one', userId: 'contributor-one',
      })).contributorUserId, 'contributor-one');
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_access_grants',
      ).get().n, 2);
    } finally { database.close(); }
  });

  it('does not let an older outstanding invitation restore explicitly revoked access', async () => {
    const { database, env } = fixture();
    try {
      const first = await inviteArtworkContributor(env, inviteInput());
      const second = await inviteArtworkContributor(env, inviteInput({
        idempotencyKey: 'invite-contributor-second-proof',
        invitedAt: '2026-08-10T10:05:00.000Z',
      }));
      await acceptArtworkContributorInvitation(env, acceptInput(first.token));
      await revokeArtworkContributor(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one',
        contributorUserId: 'contributor-one', idempotencyKey: 'revoke-first-grant',
        revokedAt: '2026-08-10T12:00:00.000Z',
      });
      await expectCode(acceptArtworkContributorInvitation(env, acceptInput(second.token, {
        idempotencyKey: 'accept-second-old-proof',
        acceptedAt: '2026-08-10T13:00:00.000Z',
      })), 'contributor_invitation_revoked');

      const fresh = await inviteArtworkContributor(env, inviteInput({
        idempotencyKey: 'invite-after-revocation',
        invitedAt: '2026-08-10T13:30:00.000Z',
      }));
      assert.equal((await acceptArtworkContributorInvitation(env, acceptInput(fresh.token, {
        idempotencyKey: 'accept-after-revocation',
        acceptedAt: '2026-08-10T14:00:00.000Z',
      }))).status, 'accepted');
    } finally { database.close(); }
  });

  it('enforces one global revocation idempotency namespace across pending and active access', async () => {
    const { database, env, invitation: activeInvitation } = await acceptedAccess();
    try {
      const pendingInvitation = await inviteArtworkContributor(env, inviteInput({
        keeperPieceId: 'kp-two',
        intendedRecipientEmail: 'second@example.com',
        idempotencyKey: 'invite-pending-second',
      }));
      database.prepare(`
        INSERT INTO artwork_contributor_revocations
          (revocation_kind, invitation_id, revoked_by_keeper_user_id, steward_version,
           idempotency_key, request_fingerprint, revoked_at)
        VALUES ('access', ?, 'keeper-one', 0, 'same-global-revoke-key', ?, ?)
      `).run(activeInvitation.invitationId, '8'.repeat(64), acceptedAt);
      assert.throws(() => database.prepare(`
        INSERT INTO artwork_contributor_revocations
          (revocation_kind, invitation_id, revoked_by_keeper_user_id, steward_version,
           idempotency_key, request_fingerprint, revoked_at)
        VALUES ('invitation', ?, 'keeper-one', 0, 'same-global-revoke-key', ?, ?)
      `).run(pendingInvitation.invitationId, '9'.repeat(64), acceptedAt), /unique/i);
    } finally { database.close(); }
  });

  it('invalidates pending and active access on transfer, preserves failed transfer, and never revives on return', async () => {
    const active = await acceptedAccess();
    try {
      active.database.exec(`
        INSERT INTO artwork_transfer_intents
          (id, keeper_piece_id, expected_from_user_id, target_user_id,
           target_email_commitment, expected_steward_version, expected_lineage_count,
           expected_lineage_hash, transfer_kind, maintenance_event_id,
           lineage_event_id, created_at)
        VALUES ('failed-transfer', 'kp-one', 'keeper-one', 'keeper-next', '${'e'.repeat(64)}',
          0, 0, NULL, 'gift', 'missing-maintenance', 'missing-lineage',
          '2026-08-11T00:00:00.000Z');
      `);
      assert.equal((await requireContributorAccess(active.env, {
        keeperPieceId: 'kp-one', userId: 'contributor-one',
      })).contributorUserId, 'contributor-one');

      canonicalTransfer(active.database, {
        suffix: 'away', from: 'keeper-one', to: 'keeper-next', version: 0,
        previousHash: null, hash: 'd'.repeat(64),
      });
      await expectCode(requireContributorAccess(active.env, {
        keeperPieceId: 'kp-one', userId: 'contributor-one',
      }), 'contributor_access_required');
      canonicalTransfer(active.database, {
        suffix: 'back', from: 'keeper-next', to: 'keeper-one', version: 1,
        previousHash: 'd'.repeat(64), hash: 'c'.repeat(64),
      });
      await expectCode(requireContributorAccess(active.env, {
        keeperPieceId: 'kp-one', userId: 'contributor-one',
      }), 'contributor_access_required');
    } finally { active.database.close(); }

    const pending = fixture();
    try {
      const created = await inviteArtworkContributor(pending.env, inviteInput());
      canonicalTransfer(pending.database, {
        suffix: 'pending-away', from: 'keeper-one', to: 'keeper-next', version: 0,
        previousHash: null, hash: 'b'.repeat(64),
      });
      await expectCode(acceptArtworkContributorInvitation(
        pending.env, acceptInput(created.token),
      ), 'contributor_invitation_stale');
    } finally { pending.database.close(); }
  });

  it('blocks an active contributor from opening a contested claim through raw SQL and the core seam', async () => {
    const { database, env } = await acceptedAccess();
    try {
      assert.throws(() => database.prepare(`
        INSERT INTO artwork_claim_requests
          (id, keeper_piece_id, requester_user_id, requester_email,
           routed_to_user_id, status, created_at)
        VALUES ('claim-raw', 'kp-one', 'contributor-one', 'contributor@example.com',
          'keeper-one', 'pending', '${acceptedAt}')
      `).run(), /contributor cannot claim/i);
      await assert.rejects(openContestedClaim(env, {
        keeperPieceId: 'kp-one', requesterUserId: 'contributor-one',
        requesterEmail: 'contributor@example.com', expectedKeeperUserId: 'keeper-one',
        openedAt: acceptedAt,
      }), /contributor cannot claim/i);
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_claim_requests',
      ).get().n, 0);
    } finally { database.close(); }
  });

  it('does not mutate keeper, lineage, privacy, dream, price, or public ledger state', async () => {
    const { database, env } = fixture();
    try {
      const before = {
        keeper: database.prepare('SELECT * FROM keeper_pieces WHERE id = ?').get('kp-one'),
        lineage: database.prepare('SELECT COUNT(*) AS n FROM artwork_lineage_events').get().n,
        privacy: database.prepare('SELECT COUNT(*) AS n FROM collector_piece_privacy').get().n,
        dreams: database.prepare('SELECT COUNT(*) AS n FROM collector_dreams').get().n,
        prices: database.prepare('SELECT COUNT(*) AS n FROM artist_artwork_price_entries').get().n,
      };
      const created = await inviteArtworkContributor(env, inviteInput());
      await acceptArtworkContributorInvitation(env, acceptInput(created.token));
      const after = {
        keeper: database.prepare('SELECT * FROM keeper_pieces WHERE id = ?').get('kp-one'),
        lineage: database.prepare('SELECT COUNT(*) AS n FROM artwork_lineage_events').get().n,
        privacy: database.prepare('SELECT COUNT(*) AS n FROM collector_piece_privacy').get().n,
        dreams: database.prepare('SELECT COUNT(*) AS n FROM collector_dreams').get().n,
        prices: database.prepare('SELECT COUNT(*) AS n FROM artist_artwork_price_entries').get().n,
      };
      assert.deepEqual(after, before);
      const publicTables = database.prepare(`
        SELECT name FROM sqlite_master
         WHERE type = 'view' AND lower(name) LIKE '%public%'
         ORDER BY name
      `).all();
      assert.equal(publicTables.some((row) => /contributor/i.test(String(row.name))), false);
    } finally { database.close(); }
  });
});
