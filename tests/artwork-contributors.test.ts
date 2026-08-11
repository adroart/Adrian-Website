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
  '034_artwork_contributor_invite_rate_limit.sql',
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

function interceptNextRun(
  env: ReturnType<typeof fixture>['env'],
  sqlFragment: string,
  beforeRun: () => void,
) {
  const originalPrepare = env.DB.prepare.bind(env.DB);
  let intercepted = false;
  env.DB.prepare = (sql: string) => {
    const statement = originalPrepare(sql);
    if (!intercepted && sql.includes(sqlFragment)) {
      const originalRun = statement.run.bind(statement);
      statement.run = () => {
        intercepted = true;
        beforeRun();
        return originalRun();
      };
    }
    return statement;
  };
}

function synchronizeNextFirsts(
  env: ReturnType<typeof fixture>['env'],
  sqlFragment: string,
  count: number,
) {
  const originalPrepare = env.DB.prepare.bind(env.DB);
  let arrivals = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  env.DB.prepare = (sql: string) => {
    const statement = originalPrepare(sql);
    if (sql.includes(sqlFragment) && arrivals < count) {
      const originalFirst = statement.first.bind(statement);
      statement.first = async () => {
        const result = originalFirst();
        arrivals += 1;
        if (arrivals === count) release?.();
        await gate;
        return result;
      };
    }
    return statement;
  };
}

function pauseNextFirst(
  env: ReturnType<typeof fixture>['env'],
  sqlFragment: string,
) {
  const originalPrepare = env.DB.prepare.bind(env.DB);
  let intercepted = false;
  let markReached: (() => void) | undefined;
  let releaseGate: (() => void) | undefined;
  const reached = new Promise<void>((resolve) => { markReached = resolve; });
  const gate = new Promise<void>((resolve) => { releaseGate = resolve; });
  env.DB.prepare = (sql: string) => {
    const statement = originalPrepare(sql);
    if (!intercepted && sql.includes(sqlFragment)) {
      const originalFirst = statement.first.bind(statement);
      statement.first = async () => {
        intercepted = true;
        const result = originalFirst();
        markReached?.();
        await gate;
        return result;
      };
    }
    return statement;
  };
  return { reached, release: () => releaseGate?.() };
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
             intended_recipient_user_id, intended_recipient_email,
             token_hash, idempotency_key,
             request_fingerprint, invited_at, expires_at)
          VALUES (?, 'kp-one', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, keeper, version, recipient,
          recipient === 'unverified-one' ? 'unverified@example.com' : 'contributor@example.com',
          String(version + 3).repeat(64).slice(0, 64), `forged-${id}`,
          String(version + 6).repeat(64).slice(0, 64), invitedAt, expiresAt,
        ), /current keeper|verified recipient/i);
      }
    } finally { database.close(); }
  });

  it('keeps missing, unverified, and ambiguous recipient account state opaque', async () => {
    for (const email of [
      'missing@example.com',
      'unverified@example.com',
      'twin@example.com',
    ]) {
      const { database, env } = fixture();
      try {
        await expectCode(inviteArtworkContributor(env, inviteInput({
          intendedRecipientEmail: email,
        })), 'contributor_recipient_not_available');
        assert.equal(database.prepare(
          'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
        ).get().n, 0);
      } finally { database.close(); }
    }
  });

  it('keeps the current keeper self-invitation rejection typed', async () => {
    const { database, env } = fixture();
    try {
      await expectCode(inviteArtworkContributor(env, inviteInput({
        intendedRecipientEmail: 'keeper@example.com',
      })), 'contributor_cannot_be_keeper');
    } finally { database.close(); }
  });

  it('freezes a private keeper-scoped ten-per-hour attempt bucket', () => {
    const { database } = fixture();
    try {
      const table = database.prepare(
        `SELECT sql FROM sqlite_master
          WHERE type = 'table' AND name = 'artwork_contributor_invite_rate_limits'`,
      ).get() as { sql?: string } | undefined;
      assert.ok(table?.sql);
      assert.deepEqual(database.prepare(
        "SELECT name FROM pragma_table_info('artwork_contributor_invite_rate_limits') ORDER BY cid",
      ).all().map((row) => row.name), [
        'keeper_user_id', 'window_started_at', 'attempt_count', 'last_attempt_at',
      ]);
      assert.doesNotMatch(table.sql, /recipient|email|token|idempotency|keeper_piece/i);
      assert.match(table.sql, /attempt_count[\s\S]*between 1 and 10/i);
      const trigger = database.prepare(
        `SELECT sql FROM sqlite_master
          WHERE type = 'trigger'
            AND name = 'artwork_contributor_invite_rate_limit_guard'`,
      ).get() as { sql?: string } | undefined;
      assert.match(trigger?.sql || '', /BEFORE INSERT ON artwork_contributor_invitations/i);
      assert.match(trigger?.sql || '', /RAISE\(ABORT, 'contributor invite rate limited'\)/i);
    } finally { database.close(); }
  });

  it('atomically bounds attempts across different recipients and idempotency keys', async () => {
    const { database, env } = fixture();
    try {
      for (let index = 0; index < 10; index += 1) {
        await expectCode(inviteArtworkContributor(env, inviteInput({
          intendedRecipientEmail: `missing-${index}@example.com`,
          idempotencyKey: `invite-missing-${index}`,
        })), 'contributor_recipient_not_available');
      }
      await expectCode(inviteArtworkContributor(env, inviteInput({
        intendedRecipientEmail: 'second@example.com',
        idempotencyKey: 'invite-after-limit',
      })), 'contributor_invite_rate_limited');
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
      ).get().n, 0);
      assert.deepEqual({ ...database.prepare(
        `SELECT keeper_user_id, attempt_count
           FROM artwork_contributor_invite_rate_limits`,
      ).get() }, { keeper_user_id: 'keeper-one', attempt_count: 10 });
    } finally { database.close(); }
  });

  it('allows exactly one racing boundary attempt and keeps every rejection typed', async () => {
    const { database, env } = fixture();
    try {
      for (let index = 0; index < 9; index += 1) {
        await expectCode(inviteArtworkContributor(env, inviteInput({
          intendedRecipientEmail: `warmup-${index}@example.com`,
          idempotencyKey: `invite-warmup-${index}`,
        })), 'contributor_recipient_not_available');
      }
      const raced = await Promise.allSettled([
        inviteArtworkContributor(env, inviteInput({
          intendedRecipientEmail: 'race-missing-a@example.com',
          idempotencyKey: 'invite-race-limit-a',
        })),
        inviteArtworkContributor(env, inviteInput({
          intendedRecipientEmail: 'race-missing-b@example.com',
          idempotencyKey: 'invite-race-limit-b',
        })),
      ]);
      assert.deepEqual(raced.map((result) => result.status === 'rejected'
        ? (result.reason as { code?: string }).code
        : 'unexpected_success').sort(), [
        'contributor_invite_rate_limited',
        'contributor_recipient_not_available',
      ]);
      assert.equal(database.prepare(
        'SELECT attempt_count FROM artwork_contributor_invite_rate_limits',
      ).get().attempt_count, 10);
    } finally { database.close(); }
  });

  it('charges one synchronized exact invite race once at the bucket boundary', async () => {
    const { database, env } = fixture();
    try {
      for (let index = 0; index < 9; index += 1) {
        await expectCode(inviteArtworkContributor(env, inviteInput({
          intendedRecipientEmail: `exact-race-warmup-${index}@example.com`,
          idempotencyKey: `exact-race-warmup-${index}`,
        })), 'contributor_recipient_not_available');
      }
      synchronizeNextFirsts(
        env,
        'FROM artwork_contributor_invitations WHERE idempotency_key = ?1',
        4,
      );
      const results = await Promise.all(Array.from(
        { length: 4 },
        () => inviteArtworkContributor(env, inviteInput({
          idempotencyKey: 'invite-synchronized-exact-race',
        })),
      ));
      const created = results.filter((result) => result.status === 'created');
      const replayed = results.filter((result) => result.status === 'replay');
      assert.equal(created.length, 1);
      assert.equal(replayed.length, 3);
      assert.equal(typeof created[0].token, 'string');
      assert.equal(replayed.every((result) => !Object.hasOwn(result, 'token')), true);
      assert.equal(new Set(results.map((result) => result.invitationId)).size, 1);
      assert.equal(database.prepare(
        'SELECT attempt_count FROM artwork_contributor_invite_rate_limits',
      ).get().attempt_count, 10);
      assert.deepEqual({ ...database.prepare(
        `SELECT COUNT(*) AS invitations, COUNT(DISTINCT token_hash) AS proofs
           FROM artwork_contributor_invitations`,
      ).get() }, { invitations: 1, proofs: 1 });
    } finally { database.close(); }
  });

  it('replays a loser that reaches preflight only after the boundary winner commits', async () => {
    const { database, env } = fixture();
    try {
      for (let index = 0; index < 9; index += 1) {
        await expectCode(inviteArtworkContributor(env, inviteInput({
          intendedRecipientEmail: `delayed-race-warmup-${index}@example.com`,
          idempotencyKey: `delayed-race-warmup-${index}`,
        })), 'contributor_recipient_not_available');
      }
      const paused = pauseNextFirst(
        env,
        'FROM artwork_contributor_invitations WHERE idempotency_key = ?1',
      );
      const loserPromise = inviteArtworkContributor(env, inviteInput({
        idempotencyKey: 'invite-delayed-exact-race',
      }));
      await paused.reached;
      const winner = await inviteArtworkContributor(env, inviteInput({
        idempotencyKey: 'invite-delayed-exact-race',
      }));
      paused.release();
      const loser = await loserPromise;
      assert.equal(winner.status, 'created');
      assert.equal(typeof winner.token, 'string');
      assert.deepEqual(loser, {
        invitationId: winner.invitationId,
        status: 'replay',
      });
      assert.equal(database.prepare(
        'SELECT attempt_count FROM artwork_contributor_invite_rate_limits',
      ).get().attempt_count, 10);
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
      ).get().n, 1);
    } finally { database.close(); }
  });

  it('replays a loser that sees the boundary winner during relationship lookup', async () => {
    const { database, env } = fixture();
    try {
      for (let index = 0; index < 9; index += 1) {
        await expectCode(inviteArtworkContributor(env, inviteInput({
          intendedRecipientEmail: `relationship-race-warmup-${index}@example.com`,
          idempotencyKey: `relationship-race-warmup-${index}`,
        })), 'contributor_recipient_not_available');
      }
      const paused = pauseNextFirst(
        env,
        'FROM user\n      WHERE lower(email) = ?1',
      );
      const loserPromise = inviteArtworkContributor(env, inviteInput({
        idempotencyKey: 'invite-relationship-exact-race',
      }));
      await paused.reached;
      const winner = await inviteArtworkContributor(env, inviteInput({
        idempotencyKey: 'invite-relationship-exact-race',
      }));
      paused.release();
      const loser = await loserPromise;
      assert.equal(winner.status, 'created');
      assert.equal(typeof winner.token, 'string');
      assert.deepEqual(loser, {
        invitationId: winner.invitationId,
        status: 'replay',
      });
      assert.equal(database.prepare(
        'SELECT attempt_count FROM artwork_contributor_invite_rate_limits',
      ).get().attempt_count, 10);
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
      ).get().n, 1);
    } finally { database.close(); }
  });

  it('does not consume the bucket or mint another token for exact successful replay', async () => {
    const { database, env } = fixture();
    try {
      const created = await inviteArtworkContributor(env, inviteInput());
      for (let index = 1; index < 10; index += 1) {
        await expectCode(inviteArtworkContributor(env, inviteInput({
          intendedRecipientEmail: `missing-replay-${index}@example.com`,
          idempotencyKey: `invite-replay-limit-${index}`,
        })), 'contributor_recipient_not_available');
      }
      assert.deepEqual(await inviteArtworkContributor(env, inviteInput()), {
        invitationId: created.invitationId,
        status: 'replay',
      });
      assert.equal(database.prepare(
        'SELECT attempt_count FROM artwork_contributor_invite_rate_limits',
      ).get().attempt_count, 10);
      await expectCode(inviteArtworkContributor(env, inviteInput({
        intendedRecipientEmail: 'second@example.com',
        idempotencyKey: 'invite-post-replay-limit',
      })), 'contributor_invite_rate_limited');
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
      ).get().n, 1);
    } finally { database.close(); }
  });

  it('counts non-exact conflicts against the bucket before returning the conflict', async () => {
    const { database, env } = fixture();
    try {
      await inviteArtworkContributor(env, inviteInput());
      for (let index = 1; index < 10; index += 1) {
        await expectCode(inviteArtworkContributor(env, inviteInput({
          intendedRecipientEmail: 'second@example.com',
          expiresAt: `2026-08-${17 + index}T10:00:00.000Z`,
        })), 'contributor_idempotency_conflict');
      }
      await expectCode(inviteArtworkContributor(env, inviteInput({
        intendedRecipientEmail: 'second@example.com',
        expiresAt: '2026-08-27T10:00:00.000Z',
      })), 'contributor_invite_rate_limited');
      assert.equal(database.prepare(
        'SELECT attempt_count FROM artwork_contributor_invite_rate_limits',
      ).get().attempt_count, 10);
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
      ).get().n, 1);
    } finally { database.close(); }
  });

  it('rolls back a rejected boundary counter write without changing the bucket', async () => {
    const { database, env } = fixture();
    try {
      for (let index = 0; index < 10; index += 1) {
        await expectCode(inviteArtworkContributor(env, inviteInput({
          intendedRecipientEmail: `rollback-${index}@example.com`,
          idempotencyKey: `invite-rollback-${index}`,
        })), 'contributor_recipient_not_available');
      }
      const before = { ...database.prepare(
        'SELECT * FROM artwork_contributor_invite_rate_limits',
      ).get() };
      await expectCode(inviteArtworkContributor(env, inviteInput({
        intendedRecipientEmail: 'rollback-rejected@example.com',
        idempotencyKey: 'invite-rollback-rejected',
      })), 'contributor_invite_rate_limited');
      assert.deepEqual({ ...database.prepare(
        'SELECT * FROM artwork_contributor_invite_rate_limits',
      ).get() }, before);
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
      ).get().n, 0);
    } finally { database.close(); }
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

  it('replays a lost invitation success from immutable request facts after email change and transfer', async () => {
    const { database, env } = fixture();
    try {
      const created = await inviteArtworkContributor(env, inviteInput());
      database.prepare(
        "UPDATE user SET email = 'changed@example.com' WHERE id = 'contributor-one'",
      ).run();
      canonicalTransfer(database, {
        suffix: 'invite-replay-away', from: 'keeper-one', to: 'keeper-next', version: 0,
        previousHash: null, hash: '9'.repeat(64),
      });
      assert.deepEqual(await inviteArtworkContributor(env, inviteInput()), {
        invitationId: created.invitationId,
        status: 'replay',
      });
      assert.equal(database.prepare(
        'SELECT intended_recipient_email FROM artwork_contributor_invitations WHERE id = ?',
      ).get(created.invitationId).intended_recipient_email, 'contributor@example.com');
    } finally { database.close(); }
  });

  it('replays exact mutations when only the server recording time changes', async () => {
    const { database, env } = fixture();
    try {
      const invitation = await inviteArtworkContributor(env, inviteInput());
      assert.equal((await inviteArtworkContributor(env, inviteInput({
        invitedAt: '2026-08-18T10:00:00.000Z',
      }))).status, 'replay');
      assert.equal((await acceptArtworkContributorInvitation(env, acceptInput(
        invitation.token,
      ))).status, 'accepted');
      assert.equal((await acceptArtworkContributorInvitation(env, acceptInput(
        invitation.token,
        { acceptedAt: '2026-08-10T11:05:00.000Z' },
      ))).status, 'replay');
      const revoke = {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one',
        accessId: invitation.invitationId,
        idempotencyKey: 'revoke-time-replay', revokedAt: '2026-08-10T12:00:00.000Z',
      };
      assert.equal((await revokeArtworkContributor(env, revoke)).status, 'revoked');
      assert.equal((await revokeArtworkContributor(env, {
        ...revoke, revokedAt: '2026-08-10T12:05:00.000Z',
      })).status, 'replay');
    } finally { database.close(); }
  });

  it('types recipient deverification between invitation resolution and insertion', async () => {
    const { database, env } = fixture();
    try {
      interceptNextRun(
        env,
        'INSERT INTO artwork_contributor_invitations',
        () => database.prepare(
          "UPDATE user SET emailVerified = 0 WHERE id = 'contributor-one'",
        ).run(),
      );
      await expectCode(
        inviteArtworkContributor(env, inviteInput()),
        'contributor_recipient_not_available',
      );
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
      ).get().n, 0);
    } finally { database.close(); }
  });

  it('types recipient email mutation between invitation resolution and insertion', async () => {
    const { database, env } = fixture();
    try {
      interceptNextRun(
        env,
        'INSERT INTO artwork_contributor_invitations',
        () => database.prepare(
          "UPDATE user SET email = 'changed@example.com' WHERE id = 'contributor-one'",
        ).run(),
      );
      await expectCode(
        inviteArtworkContributor(env, inviteInput()),
        'contributor_recipient_not_available',
      );
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
      ).get().n, 0);
    } finally { database.close(); }
  });

  it('types a recipient ambiguity race opaquely without creating an invitation', async () => {
    const { database, env } = fixture();
    try {
      interceptNextRun(
        env,
        'INSERT INTO artwork_contributor_invitations',
        () => database.prepare(
          `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
           VALUES ('contributor-race-twin', 'Race Twin', 'Contributor@Example.com', 1, 1, 1)`,
        ).run(),
      );
      await expectCode(
        inviteArtworkContributor(env, inviteInput()),
        'contributor_recipient_not_available',
      );
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
      ).get().n, 0);
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
          recipientEmail: 'contributor@example.com',
          invitedAt,
          expiresAt,
          status: 'accepted',
        }],
        contributors: [{
          accessId: invitation.invitationId,
          recipientEmail: 'contributor@example.com',
          grantedAt: acceptedAt,
          status: 'active',
        }],
      });
      const revoked = await revokeArtworkContributor(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one',
        accessId: invitation.invitationId, idempotencyKey: 'revoke-access',
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
        invitationId: 'safe-id', recipientEmail: 'contributor@example.com',
        invitedAt, expiresAt, status: 'available',
      }]);
      assert.deepEqual(Object.keys(before.invitations[0]).sort(), [
        'expiresAt', 'invitationId', 'invitedAt', 'recipientEmail', 'status',
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

  it('lists normalized recipients so one of several pending invitations can be targeted', async () => {
    const { database, env } = fixture();
    try {
      await inviteArtworkContributor(env, inviteInput());
      await inviteArtworkContributor(env, inviteInput({
        intendedRecipientEmail: 'SECOND@EXAMPLE.COM',
        idempotencyKey: 'invite-second-recipient',
      }));
      const before = await listArtworkContributors(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one', at: acceptedAt,
      });
      assert.deepEqual(before.invitations.map((row: Record<string, unknown>) => ({
        recipientEmail: row.recipientEmail,
        status: row.status,
      })), [
        { recipientEmail: 'contributor@example.com', status: 'available' },
        { recipientEmail: 'second@example.com', status: 'available' },
      ]);
      const target = before.invitations.find(
        (row: Record<string, unknown>) => row.recipientEmail === 'second@example.com',
      );
      await revokeArtworkContributor(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one',
        invitationId: target.invitationId,
        idempotencyKey: 'revoke-second-recipient', revokedAt: acceptedAt,
      });
      const after = await listArtworkContributors(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one',
        at: '2026-08-10T12:00:00.000Z',
      });
      assert.deepEqual(after.invitations.map((row: Record<string, unknown>) => ({
        recipientEmail: row.recipientEmail,
        status: row.status,
      })), [
        { recipientEmail: 'contributor@example.com', status: 'available' },
        { recipientEmail: 'second@example.com', status: 'revoked' },
      ]);
    } finally { database.close(); }
  });

  it('lists the immutable invitation-time recipient email, not a later account address', async () => {
    const { database, env } = fixture();
    try {
      await inviteArtworkContributor(env, inviteInput());
      database.prepare(
        "UPDATE user SET email = 'changed@example.com' WHERE id = 'contributor-one'",
      ).run();
      const result = await listArtworkContributors(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one', at: acceptedAt,
      });
      assert.equal(result.invitations[0].recipientEmail, 'contributor@example.com');
    } finally { database.close(); }
  });

  it('types duplicate pending and active invitation attempts while preserving exact replay', async () => {
    const { database, env } = fixture();
    try {
      const first = await inviteArtworkContributor(env, inviteInput());
      assert.equal((await inviteArtworkContributor(env, inviteInput())).status, 'replay');
      await expectCode(inviteArtworkContributor(env, inviteInput({
        idempotencyKey: 'invite-duplicate-pending',
        invitedAt: '2026-08-10T10:05:00.000Z',
      })), 'contributor_already_invited');
      await acceptArtworkContributorInvitation(env, acceptInput(first.token));
      await expectCode(inviteArtworkContributor(env, inviteInput({
        idempotencyKey: 'invite-duplicate-active',
        invitedAt: '2026-08-10T12:00:00.000Z',
      })), 'contributor_already_active');
    } finally { database.close(); }
  });

  it('serializes different-key invitation races into one creation and one typed rejection', async () => {
    const { database, env } = fixture();
    try {
      const outcomes = await Promise.allSettled([
        inviteArtworkContributor(env, inviteInput({ idempotencyKey: 'invite-race-a' })),
        inviteArtworkContributor(env, inviteInput({ idempotencyKey: 'invite-race-b' })),
      ]);
      assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
      const rejection = outcomes.find((outcome) => outcome.status === 'rejected');
      assert.equal(rejection?.reason?.code, 'contributor_already_invited');
      assert.equal(database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
      ).get().n, 1);
    } finally { database.close(); }
  });

  it('classifies a legacy second proof as terminal after another proof creates access', async () => {
    const { database, env } = fixture();
    try {
      const first = await inviteArtworkContributor(env, inviteInput());
      database.exec('DROP TRIGGER artwork_contributor_invitation_insert_guard;');
      const secondToken = 'B'.repeat(43);
      database.prepare(`
        INSERT INTO artwork_contributor_invitations
          (id, keeper_piece_id, keeper_user_id, steward_version,
           intended_recipient_user_id, intended_recipient_email,
           token_hash, idempotency_key,
           request_fingerprint, invited_at, expires_at)
        VALUES ('aci-00000000-0000-4000-8000-000000000099', 'kp-one',
          'keeper-one', 0, 'contributor-one', 'contributor@example.com',
          ?, 'legacy-second-proof', ?, ?, ?)
      `).run(
        await sha256Hex(secondToken), '7'.repeat(64),
        '2026-08-10T10:05:00.000Z', expiresAt,
      );
      await acceptArtworkContributorInvitation(env, acceptInput(first.token));
      const inspection = await inspectArtworkContributorInvitation(env, {
        token: secondToken,
        claimant: verifiedContributor,
        inspectedAt: '2026-08-10T12:00:00.000Z',
      });
      assert.equal(inspection.status, 'already_active');
      await expectCode(acceptArtworkContributorInvitation(env, acceptInput(secondToken, {
        idempotencyKey: 'accept-legacy-second',
        acceptedAt: '2026-08-10T12:00:00.000Z',
      })), 'contributor_invitation_already_active');
    } finally { database.close(); }
  });

  it('types recipient deverification and stewardship transfer races during acceptance', async () => {
    const deverified = fixture();
    try {
      const created = await inviteArtworkContributor(deverified.env, inviteInput());
      interceptNextRun(
        deverified.env,
        'INSERT INTO artwork_contributor_invitation_acceptances',
        () => deverified.database.prepare(
          "UPDATE user SET emailVerified = 0 WHERE id = 'contributor-one'",
        ).run(),
      );
      await expectCode(acceptArtworkContributorInvitation(
        deverified.env, acceptInput(created.token),
      ), 'contributor_invitation_not_available');
    } finally { deverified.database.close(); }

    const transferred = fixture();
    try {
      const created = await inviteArtworkContributor(transferred.env, inviteInput());
      interceptNextRun(
        transferred.env,
        'INSERT INTO artwork_contributor_invitation_acceptances',
        () => canonicalTransfer(transferred.database, {
          suffix: 'accept-race-away', from: 'keeper-one', to: 'keeper-next', version: 0,
          previousHash: null, hash: '8'.repeat(64),
        }),
      );
      await expectCode(acceptArtworkContributorInvitation(
        transferred.env, acceptInput(created.token),
      ), 'contributor_invitation_stale');
    } finally { transferred.database.close(); }
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
      database.exec('DROP TRIGGER artwork_contributor_invitation_insert_guard;');
      const secondToken = 'C'.repeat(43);
      database.prepare(`
        INSERT INTO artwork_contributor_invitations
          (id, keeper_piece_id, keeper_user_id, steward_version,
           intended_recipient_user_id, intended_recipient_email,
           token_hash, idempotency_key,
           request_fingerprint, invited_at, expires_at)
        VALUES ('aci-00000000-0000-4000-8000-000000000098', 'kp-one',
          'keeper-one', 0, 'contributor-one', 'contributor@example.com',
          ?, 'legacy-revocation-proof', ?, ?, ?)
      `).run(
        await sha256Hex(secondToken), '6'.repeat(64),
        '2026-08-10T10:05:00.000Z', expiresAt,
      );
      await acceptArtworkContributorInvitation(env, acceptInput(first.token));
      await revokeArtworkContributor(env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one',
        contributorUserId: 'contributor-one', idempotencyKey: 'revoke-first-grant',
        revokedAt: '2026-08-10T12:00:00.000Z',
      });
      await expectCode(acceptArtworkContributorInvitation(env, acceptInput(secondToken, {
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

  it('replays revocation after transfer and types a transfer racing a new revocation', async () => {
    const replayed = fixture();
    try {
      const invitation = await inviteArtworkContributor(replayed.env, inviteInput());
      const request = {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one',
        invitationId: invitation.invitationId,
        idempotencyKey: 'revoke-lost-response', revokedAt: acceptedAt,
      };
      assert.equal((await revokeArtworkContributor(replayed.env, request)).status, 'revoked');
      canonicalTransfer(replayed.database, {
        suffix: 'revoke-replay-away', from: 'keeper-one', to: 'keeper-next', version: 0,
        previousHash: null, hash: '7'.repeat(64),
      });
      assert.equal((await revokeArtworkContributor(replayed.env, request)).status, 'replay');
    } finally { replayed.database.close(); }

    const raced = fixture();
    try {
      const invitation = await inviteArtworkContributor(raced.env, inviteInput());
      interceptNextRun(
        raced.env,
        'INSERT INTO artwork_contributor_revocations',
        () => canonicalTransfer(raced.database, {
          suffix: 'revoke-race-away', from: 'keeper-one', to: 'keeper-next', version: 0,
          previousHash: null, hash: '6'.repeat(64),
        }),
      );
      await expectCode(revokeArtworkContributor(raced.env, {
        keeperPieceId: 'kp-one', keeperUserId: 'keeper-one',
        invitationId: invitation.invitationId,
        idempotencyKey: 'revoke-transfer-race', revokedAt: acceptedAt,
      }), 'stale_keeper_authority');
    } finally { raced.database.close(); }
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
