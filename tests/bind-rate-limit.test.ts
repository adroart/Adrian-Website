// Rate limiting + audit on the ownership-code mismatch path of
// functions/api/keeper/bind.js (security-review finding 1). Runs against real
// in-memory SQLite through the same migration set claim-silence.test.ts uses,
// so the endpoint sees the real ownership_code_audit table, the real
// registry_recovery_qualifications guard, and the real rate limiter in
// functions/api/_lib/ratelimit.js (a process-wide in-memory Map). Every test
// below uses its own piece ids / public codes / user ids so that shared
// limiter state never leaks between tests.
//
// Run note: uses node:test's mock.module, so invoke with
// `npx tsx --test --experimental-test-module-mocks tests/bind-rate-limit.test.ts`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, describe, it, mock } from 'node:test';

import { hashRecoveryCode } from '../functions/api/_lib/keeper.js';
import {
  recoveryDependenciesForRow,
  recoveryQualificationStatement,
} from '../functions/api/_lib/recoveryQualification.js';
import { LAUNCH_FLAGS } from '../launchFlags.ts';

// ── auth mock so the bind endpoint can be driven without Better Auth ────────
let CURRENT_AUTH: { userId: string; email: string } | null = null;
mock.module('../functions/api/_lib/auth.js', {
  namedExports: {
    requireUser: async () => (CURRENT_AUTH
      ? {
        userId: CURRENT_AUTH.userId,
        email: CURRENT_AUTH.email,
        user: { emailVerified: true },
      }
      : new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })),
    requireAdmin: async () => new Response(
      JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 },
    ),
  },
});
const { onRequest: bindKeeper } = await import('../functions/api/keeper/bind.js');

after(() => {
  mock.reset();
});

const readMigration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);
// Same set as tests/claim-silence.test.ts: everything bind.js's dependencies
// (readiness guard, lineage, contested claims, silence windows) can touch.
const migrationsThroughSilence = [
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
  '036_artwork_catalog_snapshots.sql', '037_piece_records.sql',
  '038_transfer_silence.sql',
].map(readMigration).join('\n');

// Same D1 stand-in as tests/claim-silence.test.ts: statements execute
// synchronously inside one transaction per batch, mirroring D1 atomicity.
function d1(database: DatabaseSync) {
  const prepare = (sql: string) => {
    let values: SQLInputValue[] = [];
    const statement = {
      bind(...next: SQLInputValue[]) { values = next; return statement; },
      async first() { return database.prepare(sql).get(...values) ?? null; },
      async all() { return { results: database.prepare(sql).all(...values) }; },
      async run() {
        const result = database.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
      runSync() {
        const result = database.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
    return statement;
  };
  return {
    prepare,
    async batch(statements: Array<ReturnType<typeof prepare>>) {
      database.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map((statement) => statement.runSync());
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

async function fixture() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    PRAGMA foreign_keys = ON;
    ${migrationsThroughSilence}
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES
      ('user-a', 'Collector A', 'a@example.com', 1, 1, 1),
      ('user-b', 'Collector B', 'b@example.com', 1, 1, 1),
      ('user-c', 'Collector C', 'c@example.com', 1, 1, 1),
      ('user-d', 'Collector D', 'd@example.com', 1, 1, 1);
    INSERT INTO users (auth_user_id, clerk_user_id, email)
    VALUES
      ('user-a', 'user-a', 'a@example.com'),
      ('user-b', 'user-b', 'b@example.com'),
      ('user-c', 'user-c', 'c@example.com'),
      ('user-d', 'user-d', 'd@example.com');
  `);
  const db = d1(database);
  const env = { DB: db };
  return { database, db, env };
}

// A piece whose readiness guard is the physical-plate path (registration_status
// left NULL so the registered-identity guard never engages), matching
// seedReadyPhysicalBindPiece in tests/living-legacy.test.ts but against real
// SQLite. Each piece gets its own recovery-code hash and issuance key so
// multiple pieces can coexist in one database (UNIQUE constraints).
async function seedBindReadyPiece(
  fx: Awaited<ReturnType<typeof fixture>>,
  { id, pieceId, publicCode, ownershipCode }: {
    id: string; pieceId: string; publicCode: string; ownershipCode: string;
  },
) {
  const backupSha256 = 'a'.repeat(64);
  const backupReference = `plates/${publicCode}/${backupSha256}.json`;
  fx.database.prepare(`
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       public_code, issuance_key, plate_status, backup_status,
       backup_reference, backup_sha256, ownership_code_key_version, registered_at)
    VALUES (?1, ?2, 0, NULL, ?3, ?4, ?5, 'active', 'verified', ?6, ?7, 1, ?8)
  `).run(
    id, pieceId, await hashRecoveryCode(ownershipCode), publicCode, `issuance-${id}`,
    backupReference, backupSha256, '2026-07-01T00:00:00.000Z',
  );
  const dependencies = recoveryDependenciesForRow(
    { ownership_code_key_version: 1, backup_reference: backupReference, backup_sha256: backupSha256 },
    fx.env,
  );
  await recoveryQualificationStatement(fx.db, {
    keeperPieceId: id,
    result: 'passed',
    copiedArtifacts: true,
    dependencies,
    administrator: { userId: 'admin-1', email: 'admin@example.com' },
  }).run();
  return { id, pieceId, publicCode };
}

function bindRequest(body: unknown) {
  return new Request('https://adrianrasmussen.com/api/keeper/bind', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function attempt(
  fx: Awaited<ReturnType<typeof fixture>>,
  publicCode: string,
  ownershipCode: string,
) {
  return bindKeeper({
    request: bindRequest({ publicCode, ownershipCode }),
    env: fx.env,
  });
}

function auditRows(fx: Awaited<ReturnType<typeof fixture>>, keeperPieceId: string) {
  return fx.database.prepare(
    `SELECT action, outcome FROM ownership_code_audit
      WHERE keeper_piece_id = ? ORDER BY created_at ASC`,
  ).all(keeperPieceId) as Array<{ action: string; outcome: string }>;
}

const OWNERSHIP_CODE_ONE = 'K7QM-9XTR-2PHV-N4WB';
const OWNERSHIP_CODE_TWO = 'L8RN-0YUS-3QIW-M5XC';
const OWNERSHIP_CODE_THREE = 'P9SO-1ZVT-4RJX-N6YD';
const WRONG_CODE = 'WRONG-CODE-0000-0000';

describe('bind rate limiting and audit on ownership-code mismatch', () => {
  it('throttles repeated wrong codes at the 10/hour per (user, piece) limit, and audits every mismatch', async () => {
    const fx = await fixture();
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    const piece = await seedBindReadyPiece(fx, {
      id: 'kp-rl-1', pieceId: 'UL-200', publicCode: 'AR-7KQ9M2WX',
      ownershipCode: OWNERSHIP_CODE_ONE,
    });
    CURRENT_AUTH = { userId: 'user-a', email: 'a@example.com' };
    try {
      // The first 10 wrong guesses stay under the limit: ordinary 403
      // code_mismatch, response body byte-for-byte the pre-change shape.
      for (let attemptNumber = 1; attemptNumber <= 10; attemptNumber += 1) {
        const response = await attempt(fx, piece.publicCode, WRONG_CODE);
        assert.equal(response.status, 403, `attempt ${attemptNumber} should still be under the limit`);
        assert.deepEqual(await response.json(), {
          ok: false,
          error: 'code_mismatch',
          message: 'That Ownership Code did not match. Check the code on the underside of the art.',
        });
        assert.equal(response.headers.get('Retry-After'), null);
      }

      // The 11th and 12th wrong guesses are throttled with a distinct code.
      for (let extra = 0; extra < 2; extra += 1) {
        const response = await attempt(fx, piece.publicCode, WRONG_CODE);
        assert.equal(response.status, 429);
        assert.deepEqual(await response.json(), {
          ok: false,
          error: 'bind_rate_limited',
          message: 'Too many attempts. Please wait before trying again.',
        });
        assert.ok(Number(response.headers.get('Retry-After')) > 0);
      }

      // Every mismatch is audited, including the throttled ones.
      const rows = auditRows(fx, piece.id);
      assert.equal(rows.length, 12);
      for (const row of rows) {
        assert.equal(row.action, 'bind_mismatch');
        assert.equal(row.outcome, 'mismatch');
      }

      // The steward, lineage, and silence machinery were never touched: a
      // mismatch never reaches the exact-match-only silence evaluation.
      const piece_row = fx.database.prepare(
        'SELECT keeper_user_id, claimed_at FROM keeper_pieces WHERE id = ?',
      ).get(piece.id) as any;
      assert.equal(piece_row.keeper_user_id, null);
      assert.equal(piece_row.claimed_at, null);
      assert.equal(fx.database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_claim_requests',
      ).get()?.n, 0);
      assert.equal(fx.database.prepare(
        'SELECT COUNT(*) AS n FROM claim_silence_windows',
      ).get()?.n, 0);
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
      fx.database.close();
    }
  });

  it('lets a correct code bind after wrong guesses under the limit, and idempotent re-scans never consume attempts', async () => {
    const fx = await fixture();
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    const piece = await seedBindReadyPiece(fx, {
      id: 'kp-rl-2', pieceId: 'UL-201', publicCode: 'AR-8LR3N5XY',
      ownershipCode: OWNERSHIP_CODE_TWO,
    });
    CURRENT_AUTH = { userId: 'user-b', email: 'b@example.com' };
    try {
      // A few wrong guesses, well under the 10/hour budget.
      for (let i = 0; i < 3; i += 1) {
        const response = await attempt(fx, piece.publicCode, WRONG_CODE);
        assert.equal(response.status, 403);
      }

      // The correct code still binds (first bind) after those misses.
      const bound = await attempt(fx, piece.publicCode, OWNERSHIP_CODE_TWO);
      assert.equal(bound.status, 200);
      const boundBody = await bound.json() as { ok: boolean; keeper: { pieceId: string } };
      assert.equal(boundBody.ok, true);
      assert.equal(boundBody.keeper.pieceId, 'UL-201');

      // The now-current steward's re-scans never touch the mismatch limiter,
      // even run far more times than the mismatch budget would allow.
      for (let i = 0; i < 15; i += 1) {
        const response = await attempt(fx, piece.publicCode, OWNERSHIP_CODE_TWO);
        assert.equal(response.status, 200, `re-scan ${i + 1} should never be rate limited`);
      }

      // The idempotent re-scans left the mismatch budget exactly where the 3
      // initial wrong guesses left it: 7 more mismatches still fit under the
      // 10/hour cap, and the 8th (the 11th mismatch overall) is throttled.
      for (let attemptNumber = 1; attemptNumber <= 7; attemptNumber += 1) {
        const response = await attempt(fx, piece.publicCode, WRONG_CODE);
        assert.equal(response.status, 403, `post-bind mismatch ${attemptNumber} should still be under budget`);
      }
      const overLimit = await attempt(fx, piece.publicCode, WRONG_CODE);
      assert.equal(overLimit.status, 429);
      assert.equal((await overLimit.json()).error, 'bind_rate_limited');
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
      fx.database.close();
    }
  });

  it('scopes the mismatch limit per (user, piece): a different user or a different piece has a fresh budget', async () => {
    const fx = await fixture();
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    const pieceOne = await seedBindReadyPiece(fx, {
      id: 'kp-rl-3a', pieceId: 'UL-202', publicCode: 'AR-9MS4P6YZ',
      ownershipCode: OWNERSHIP_CODE_ONE,
    });
    const pieceTwo = await seedBindReadyPiece(fx, {
      id: 'kp-rl-3b', pieceId: 'UL-203', publicCode: 'AR-3ND6Q8ZA',
      ownershipCode: OWNERSHIP_CODE_THREE,
    });
    try {
      CURRENT_AUTH = { userId: 'user-c', email: 'c@example.com' };
      for (let attemptNumber = 1; attemptNumber <= 10; attemptNumber += 1) {
        const response = await attempt(fx, pieceOne.publicCode, WRONG_CODE);
        assert.equal(response.status, 403);
      }
      const blocked = await attempt(fx, pieceOne.publicCode, WRONG_CODE);
      assert.equal(blocked.status, 429);

      // Same user, a different piece: a fresh budget (piece is part of the key).
      const otherPieceStillOk = await attempt(fx, pieceTwo.publicCode, WRONG_CODE);
      assert.equal(otherPieceStillOk.status, 403);

      // A different user against the now-blocked piece: also a fresh budget
      // (user is part of the key, so one collector cannot get another rate
      // limited).
      CURRENT_AUTH = { userId: 'user-d', email: 'd@example.com' };
      const otherUserStillOk = await attempt(fx, pieceOne.publicCode, WRONG_CODE);
      assert.equal(otherUserStillOk.status, 403);

      const auditForPieceOne = auditRows(fx, pieceOne.id);
      const auditForPieceTwo = auditRows(fx, pieceTwo.id);
      assert.equal(auditForPieceOne.length, 12); // 10 + blocked + user-d's one
      assert.equal(auditForPieceTwo.length, 1);
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
      fx.database.close();
    }
  });
});
