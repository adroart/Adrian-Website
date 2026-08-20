// Thirty-day passing via lazy silence windows on contested claims
// (migration 037 + functions/api/_lib/claimSilence.js + the keeper/bind
// integration). Runs against real in-memory SQLite through migrations
// 001-037 so migration 024's governed-receipt triggers actually govern the
// silence pass. Email traffic is captured by stubbing the global fetch the
// house Resend mechanism uses.
//
// Run note: uses node:test's mock.module, so invoke with
// `npx tsx --test --experimental-test-module-mocks tests/claim-silence.test.ts`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, describe, it, mock } from 'node:test';

import {
  SILENCE_PASS_ACTOR,
  SILENCE_REMINDER_SCHEDULE,
  evaluateSilence,
  openSilenceWindow,
  refuseSilencePass,
} from '../functions/api/_lib/claimSilence.js';
import { openContestedClaim } from '../functions/api/_lib/claimRequests.js';
import { hashRecoveryCode } from '../functions/api/_lib/keeper.js';
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

// ── email capture: the house mechanism is a fetch to api.resend.com ─────────
const sentEmails: Array<{ to: string[]; subject: string; html: string }> = [];
const emailBehavior = { ok: true };
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  if (String(input).includes('api.resend.com')) {
    if (!emailBehavior.ok) return new Response('{"error":"down"}', { status: 502 });
    sentEmails.push(JSON.parse(init?.body ?? '{}'));
    return new Response('{"id":"email"}', { status: 200 });
  }
  return originalFetch(input as any, init);
}) as typeof fetch;

after(() => {
  globalThis.fetch = originalFetch;
  mock.reset();
});

const readMigration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);
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
  '035_artwork_catalog_snapshots.sql', '036_piece_records.sql',
  '037_transfer_silence.sql',
].map(readMigration).join('\n');

const OWNERSHIP_CODE = 'K7QM-9XTR-2PHV-N4WB';
const PUBLIC_CODE = 'AR-7KQ9M2WX';
const OPENED = '2026-08-01T00:00:00.000Z';
const DEADLINE = '2026-08-31T00:00:00.000Z';
const DAY7 = '2026-08-08T12:00:00.000Z';
const DAY21 = '2026-08-22T12:00:00.000Z';
const DAY29 = '2026-08-30T06:00:00.000Z';
const DAY31 = '2026-09-01T12:00:00.000Z';

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
    // Statements execute synchronously inside one transaction so a concurrent
    // JS interleaving can never split a batch, mirroring D1 batch atomicity.
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
      ('user-steward', 'Registered Steward', 'steward@example.com', 1, 1, 1),
      ('user-claimant', 'Holding Claimant', 'claimant@example.com', 1, 1, 1),
      ('user-other', 'Someone Else', 'other@example.com', 1, 1, 1);
    INSERT INTO users (auth_user_id, clerk_user_id, email)
    VALUES
      ('user-steward', 'user-steward', 'steward@example.com'),
      ('user-claimant', 'user-claimant', 'claimant@example.com'),
      ('user-other', 'user-other', 'other@example.com');
  `);
  database.prepare(`
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       public_code, claimed_at, registered_at)
    VALUES ('kp-silence', 'UL-100', 1, 'user-steward', ?1, ?2,
       '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')
  `).run(await hashRecoveryCode(OWNERSHIP_CODE), PUBLIC_CODE);
  const db = d1(database);
  const env = {
    DB: db,
    RESEND_API_KEY: 're_test_silence',
    RESEND_FROM_EMAIL: 'noreply@adrianrasmussen.com',
  };
  sentEmails.length = 0;
  emailBehavior.ok = true;
  return { database, db, env };
}

async function contest(fx: Awaited<ReturnType<typeof fixture>>, openedAt = OPENED) {
  const claim = await openContestedClaim(fx.env, {
    keeperPieceId: 'kp-silence',
    requesterUserId: 'user-claimant',
    requesterEmail: 'claimant@example.com',
    expectedKeeperUserId: 'user-steward',
    openedAt,
  });
  assert.equal(claim.status, 'opened');
  const window = await openSilenceWindow(fx.db, {
    requestId: claim.requestId,
    keeperPieceId: 'kp-silence',
    createdAt: openedAt,
  }, openedAt);
  assert.equal(window.ok, true);
  return { claimId: claim.requestId as string, windowId: window.windowId as string };
}

function windowRow(fx: Awaited<ReturnType<typeof fixture>>, windowId: string) {
  return fx.database.prepare(
    'SELECT * FROM claim_silence_windows WHERE id = ?',
  ).get(windowId) as any;
}

function bindRequest(body: unknown) {
  return new Request('https://adrianrasmussen.com/api/keeper/bind', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('thirty-day passing via lazy silence windows', () => {
  it('applies every migration through 037 on real SQLite', async () => {
    const fx = await fixture();
    try {
      assert.deepEqual(fx.database.prepare('PRAGMA foreign_key_check').all(), []);
      for (const table of ['claim_silence_windows', 'claim_silence_reminders']) {
        assert.ok(fx.database.prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        ).get(table), table);
      }
    } finally {
      fx.database.close();
    }
  });

  it('opens the silence window when a contested bind opens a claim', async () => {
    const fx = await fixture();
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-claimant', email: 'claimant@example.com' };
    try {
      const response = await bindKeeper({
        request: bindRequest({ publicCode: PUBLIC_CODE, ownershipCode: OWNERSHIP_CODE }),
        env: fx.env,
      });
      assert.equal(response.status, 202);
      const body = await response.json();
      assert.equal(body.status, 'claim_requested');
      assert.equal(body.claim.outcome, 'opened');

      const window = fx.database.prepare(`
        SELECT window.*, claim.requester_user_id
          FROM claim_silence_windows window
          JOIN artwork_claim_requests claim ON claim.id = window.claim_request_id
         WHERE window.keeper_piece_id = 'kp-silence'
      `).get() as any;
      assert.ok(window, 'silence window opened with the contested claim');
      assert.equal(window.status, 'open');
      assert.equal(window.requester_user_id, 'user-claimant');
      assert.equal(
        Date.parse(window.deadline_at) - Date.parse(window.opened_at),
        30 * 86_400_000,
      );
      // The steward and registration are untouched.
      const piece = fx.database.prepare(
        "SELECT keeper_user_id, steward_version FROM keeper_pieces WHERE id = 'kp-silence'",
      ).get() as any;
      assert.equal(piece.keeper_user_id, 'user-steward');
      assert.equal(piece.steward_version, 0);
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
      fx.database.close();
    }
  });

  it('sends each reminder exactly once, at its due touch, to the registered steward', async () => {
    const fx = await fixture();
    try {
      const { windowId } = await contest(fx);
      const touch = (now: string) => evaluateSilence(fx.db, fx.env, {
        keeperPieceId: 'kp-silence', touchUserId: 'user-claimant',
      }, now);

      // Before day 7: nothing due.
      assert.deepEqual(await touch('2026-08-03T00:00:00.000Z'), {
        status: 'pending', remindersSent: 0,
      });
      assert.equal(sentEmails.length, 0);

      // Day 7 touch sends day7 once; a re-touch sends nothing more.
      assert.deepEqual(await touch(DAY7), { status: 'pending', remindersSent: 1 });
      assert.deepEqual(await touch(DAY7), { status: 'pending', remindersSent: 0 });
      assert.equal(sentEmails.length, 1);
      assert.deepEqual(sentEmails[0].to, ['steward@example.com']);
      assert.match(sentEmails[0].subject, /UL-100/);
      assert.equal(windowRow(fx, windowId).status, 'reminded');

      // Day 21 and day 29 touches send their reminders.
      assert.deepEqual(await touch(DAY21), { status: 'pending', remindersSent: 1 });
      assert.deepEqual(await touch(DAY29), { status: 'pending', remindersSent: 1 });
      const reminders = fx.database.prepare(
        'SELECT kind, sent_at FROM claim_silence_reminders WHERE window_id = ? ORDER BY sent_at',
      ).all(windowId) as any[];
      assert.deepEqual(
        reminders.map((row) => row.kind),
        SILENCE_REMINDER_SCHEDULE.map((entry) => entry.kind),
      );
      assert.equal(sentEmails.length, 3);
    } finally {
      fx.database.close();
    }
  });

  it('withdraws the window when the registered steward touches their own piece', async () => {
    const fx = await fixture();
    try {
      const { claimId, windowId } = await contest(fx);
      const result = await evaluateSilence(fx.db, fx.env, {
        keeperPieceId: 'kp-silence', touchUserId: 'user-steward',
      }, DAY7);
      assert.deepEqual(result, { status: 'withdrawn', windows: 1 });
      assert.equal(windowRow(fx, windowId).status, 'withdrawn');
      // The claim stays recorded for ordinary human resolution.
      assert.equal(fx.database.prepare(
        'SELECT status FROM artwork_claim_requests WHERE id = ?',
      ).get(claimId)?.status, 'pending');
      // The steward touch never emails anyone.
      assert.equal(sentEmails.length, 0);
    } finally {
      fx.database.close();
    }
  });

  it('records an active refusal for Adrian on the maintenance desk', async () => {
    const fx = await fixture();
    try {
      const { claimId, windowId } = await contest(fx);
      const result = await refuseSilencePass(fx.db, fx.env, {
        keeperPieceId: 'kp-silence',
        stewardUserId: 'user-steward',
        note: 'This piece never left my home.',
      }, DAY7);
      assert.deepEqual(result, { status: 'refused', windows: 1 });

      const window = windowRow(fx, windowId);
      assert.equal(window.status, 'refused');
      assert.equal(window.refused_at, DAY7);
      assert.equal(window.refusal_note, 'This piece never left my home.');
      assert.equal(fx.database.prepare(
        'SELECT status FROM artwork_claim_requests WHERE id = ?',
      ).get(claimId)?.status, 'declined');

      const review = fx.database.prepare(`
        SELECT * FROM registry_maintenance_events
         WHERE event_type = 'claim_refusal_review'
      `).all() as any[];
      assert.equal(review.length, 1);
      assert.equal(review[0].keeper_piece_id, 'kp-silence');
      assert.equal(review[0].related_record_id, claimId);
      assert.equal(review[0].administrator_user_id, 'user-steward');
      assert.match(review[0].reason, /refused the passing/);

      // Refusal is idempotent: a second call records nothing further.
      const again = await refuseSilencePass(fx.db, fx.env, {
        keeperPieceId: 'kp-silence', stewardUserId: 'user-steward',
      }, DAY21);
      assert.equal(again.status, 'none');
      assert.equal(fx.database.prepare(
        "SELECT COUNT(*) AS count FROM registry_maintenance_events WHERE event_type = 'claim_refusal_review'",
      ).get()?.count, 1);
      // A stranger can never refuse.
      await contest(fx, DAY21);
      const stranger = await refuseSilencePass(fx.db, fx.env, {
        keeperPieceId: 'kp-silence', stewardUserId: 'user-other',
      }, DAY21);
      assert.equal(stranger.status, 'not_steward');
    } finally {
      fx.database.close();
    }
  });

  it('executes the governed pass on a day-31 touch after all reminders soaked', async () => {
    const fx = await fixture();
    const { claimId, windowId } = await contest(fx);
    const touch = (now: string) => evaluateSilence(fx.db, fx.env, {
      keeperPieceId: 'kp-silence', touchUserId: 'user-claimant',
    }, now);
    try {
      await touch(DAY7);
      await touch(DAY21);
      await touch(DAY29);
      sentEmails.length = 0;

      const passed = await touch(DAY31) as {
        status: string; targetUserId?: string; claimedAt?: string;
      };
      assert.equal(passed.status, 'passed');
      assert.equal(passed.targetUserId, 'user-claimant');
      assert.equal(passed.claimedAt, DEADLINE);

      // The governed receipt exists and the 024 trigger moved the steward.
      const receipt = fx.database.prepare(`
        SELECT receipt.id, intent.id AS intent_id, intent.transfer_kind,
               intent.expected_from_user_id, intent.target_user_id
          FROM artwork_transfer_receipts receipt
          JOIN artwork_transfer_intents intent ON intent.id = receipt.transfer_intent_id
      `).get() as any;
      assert.ok(receipt, 'governed transfer receipt committed');
      assert.equal(receipt.expected_from_user_id, 'user-steward');
      assert.equal(receipt.target_user_id, 'user-claimant');

      const piece = fx.database.prepare(
        "SELECT * FROM keeper_pieces WHERE id = 'kp-silence'",
      ).get() as any;
      assert.equal(piece.keeper_user_id, 'user-claimant');
      assert.equal(piece.claimed_at, DEADLINE);
      assert.equal(piece.steward_version, 1);
      assert.equal(piece.last_transfer_id, receipt.intent_id);

      // Public lineage carries the canonical transferred event.
      const lineage = fx.database.prepare(`
        SELECT event_type, sequence, public_payload_json
          FROM artwork_lineage_events WHERE keeper_piece_id = 'kp-silence'
      `).all() as any[];
      assert.equal(lineage.length, 1);
      assert.equal(lineage[0].event_type, 'transferred');
      assert.equal(
        JSON.parse(lineage[0].public_payload_json).transferKind, 'inheritance',
      );
      assert.equal(piece.lineage_event_count, 1);

      // The maintenance record is marked as the silence pass, by the system actor.
      const maintenance = fx.database.prepare(`
        SELECT * FROM registry_maintenance_events WHERE event_type = 'steward_transferred'
      `).get() as any;
      assert.match(maintenance.reason, /silence_pass/);
      assert.equal(maintenance.administrator_user_id, SILENCE_PASS_ACTOR.userId);

      // Window passed, claim resolved, both sides notified.
      assert.equal(windowRow(fx, windowId).status, 'passed');
      assert.equal(fx.database.prepare(
        'SELECT status FROM artwork_claim_requests WHERE id = ?',
      ).get(claimId)?.status, 'approved');
      const recipients = sentEmails.map((mail) => mail.to[0]).sort();
      assert.deepEqual(recipients, ['claimant@example.com', 'steward@example.com']);
      for (const mail of sentEmails) assert.match(mail.subject, /passing is complete/);

      // A subsequent bind by the new steward is the normal bound outcome.
      const wasOn = LAUNCH_FLAGS.livingLegacy;
      LAUNCH_FLAGS.livingLegacy = true;
      CURRENT_AUTH = { userId: 'user-claimant', email: 'claimant@example.com' };
      try {
        const response = await bindKeeper({
          request: bindRequest({ publicCode: PUBLIC_CODE, ownershipCode: OWNERSHIP_CODE }),
          env: fx.env,
        });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
          ok: true,
          keeper: { pieceId: 'UL-100', editionNumber: 1, claimedAt: DEADLINE },
        });
      } finally {
        CURRENT_AUTH = null;
        LAUNCH_FLAGS.livingLegacy = wasOn;
      }
    } finally {
      fx.database.close();
    }
  });

  it('never passes on a day-31 touch when zero reminders were ever sent', async () => {
    const fx = await fixture();
    try {
      await contest(fx);

      // Email infrastructure unconfigured: reminders cannot send, nothing is
      // recorded, and the pass DOES NOT execute. The claimant sees only the
      // ordinary pending state.
      const unconfigured = { DB: fx.db } as any;
      const bare = await evaluateSilence(fx.db, unconfigured, {
        keeperPieceId: 'kp-silence', touchUserId: 'user-claimant',
      }, DAY31);
      assert.deepEqual(bare, { status: 'pending', remindersSent: 0 });
      assert.equal(sentEmails.length, 0);

      // Even with working email, a first touch on day 31 sends the reminders
      // but can never pass the piece in the same breath (the soak rule).
      const late = await evaluateSilence(fx.db, fx.env, {
        keeperPieceId: 'kp-silence', touchUserId: 'user-claimant',
      }, DAY31);
      assert.deepEqual(late, { status: 'pending', remindersSent: 3 });

      assert.equal(fx.database.prepare(
        'SELECT COUNT(*) AS count FROM artwork_transfer_receipts',
      ).get()?.count, 0);
      const piece = fx.database.prepare(
        "SELECT keeper_user_id, steward_version FROM keeper_pieces WHERE id = 'kp-silence'",
      ).get() as any;
      assert.equal(piece.keeper_user_id, 'user-steward');
      assert.equal(piece.steward_version, 0);
    } finally {
      fx.database.close();
    }
  });

  it('fails closed when a reminder email cannot be sent', async () => {
    const fx = await fixture();
    try {
      await contest(fx);
      emailBehavior.ok = false;
      const result = await evaluateSilence(fx.db, fx.env, {
        keeperPieceId: 'kp-silence', touchUserId: 'user-claimant',
      }, DAY7);
      assert.deepEqual(result, { status: 'pending', remindersSent: 0 });
      assert.equal(fx.database.prepare(
        'SELECT COUNT(*) AS count FROM claim_silence_reminders',
      ).get()?.count, 0);
    } finally {
      emailBehavior.ok = true;
      fx.database.close();
    }
  });

  it('keeps terminal windows and reminders structurally immutable', async () => {
    const fx = await fixture();
    try {
      const { windowId } = await contest(fx);
      const exec = (sql: string, ...params: SQLInputValue[]) => fx.database
        .prepare(sql).run(...params);

      // A pass without more than one reminder is impossible, even after the
      // deadline: "thirty days of silence, with more than one reminder" is
      // structural.
      assert.throws(
        () => exec(`UPDATE claim_silence_windows
                       SET status = 'passed', passed_at = ? WHERE id = ?`, DAY31, windowId),
        /more than one reminder/,
      );
      // A pass before the deadline is impossible even with reminders present.
      exec(`INSERT INTO claim_silence_reminders (id, window_id, kind, sent_at)
            VALUES ('csr-a', ?, 'day7', ?), ('csr-b', ?, 'day21', ?)`,
      windowId, DAY7, windowId, DAY21);
      assert.throws(
        () => exec(`UPDATE claim_silence_windows
                       SET status = 'passed', passed_at = ? WHERE id = ?`, DAY29, windowId),
        /deadline to have lapsed/,
      );
      // Identity is immutable while the window is active.
      assert.throws(
        () => exec('UPDATE claim_silence_windows SET deadline_at = ? WHERE id = ?',
          DAY31, windowId),
        /identity is immutable/,
      );
      // Reminders are append-only.
      assert.throws(
        () => exec("UPDATE claim_silence_reminders SET sent_at = ? WHERE id = 'csr-a'", DAY21),
        /append-only/,
      );
      assert.throws(
        () => exec("DELETE FROM claim_silence_reminders WHERE id = 'csr-a'"),
        /append-only/,
      );
      // Windows are never deleted, and terminal windows never change again.
      assert.throws(
        () => exec('DELETE FROM claim_silence_windows WHERE id = ?', windowId),
        /never deleted/,
      );
      exec("UPDATE claim_silence_windows SET status = 'withdrawn' WHERE id = ?", windowId);
      assert.throws(
        () => exec("UPDATE claim_silence_windows SET status = 'open' WHERE id = ?", windowId),
        /terminal silence window is immutable/,
      );
      // Reminders cannot land on a terminal window.
      assert.throws(
        () => exec(`INSERT INTO claim_silence_reminders (id, window_id, kind, sent_at)
                    VALUES ('csr-late', ?, 'day29', ?)`, windowId, DAY29),
        /active silence window/,
      );
    } finally {
      fx.database.close();
    }
  });

  it('a concurrent double-touch after the deadline executes exactly one pass', async () => {
    const fx = await fixture();
    try {
      await contest(fx);
      const touch = (now: string) => evaluateSilence(fx.db, fx.env, {
        keeperPieceId: 'kp-silence', touchUserId: 'user-claimant',
      }, now);
      await touch(DAY7);
      await touch(DAY21);
      await touch(DAY29);

      const [first, second] = await Promise.all([touch(DAY31), touch(DAY31)]);
      assert.equal(first.status, 'passed');
      assert.equal(second.status, 'passed');

      assert.equal(fx.database.prepare(
        'SELECT COUNT(*) AS count FROM artwork_transfer_receipts',
      ).get()?.count, 1);
      assert.equal(fx.database.prepare(
        "SELECT COUNT(*) AS count FROM registry_maintenance_events WHERE event_type = 'steward_transferred'",
      ).get()?.count, 1);
      assert.equal(fx.database.prepare(
        "SELECT COUNT(*) AS count FROM artwork_lineage_events WHERE keeper_piece_id = 'kp-silence'",
      ).get()?.count, 1);
      const piece = fx.database.prepare(
        "SELECT keeper_user_id, steward_version FROM keeper_pieces WHERE id = 'kp-silence'",
      ).get() as any;
      assert.equal(piece.keeper_user_id, 'user-claimant');
      assert.equal(piece.steward_version, 1);
    } finally {
      fx.database.close();
    }
  });
});
