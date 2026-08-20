// POST /api/keeper/claim-refusal (functions/api/keeper/claim-refusal.js +
// functions/api/_lib/claimSilence.js#refuseSilencePass): the registered
// steward's one HTTP door to refuse an open thirty-day silence-pass window.
// Runs against real in-memory SQLite through migrations 001-037, mirroring
// the harness in tests/claim-silence.test.ts, so migration 037's tables and
// triggers actually govern the endpoint.
//
// Run note: uses node:test's mock.module, so invoke with
// `npx tsx --test --experimental-test-module-mocks tests/keeper-claim-refusal.test.ts`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, describe, it, mock } from 'node:test';

import { openSilenceWindow } from '../functions/api/_lib/claimSilence.js';
import { openContestedClaim } from '../functions/api/_lib/claimRequests.js';
import { hashRecoveryCode } from '../functions/api/_lib/keeper.js';
import { LAUNCH_FLAGS } from '../launchFlags.ts';

// ── auth mock so the endpoint can be driven without Better Auth ────────────
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
const { onRequest: claimRefusal } = await import('../functions/api/keeper/claim-refusal.js');

after(() => {
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
    };
    return statement;
  };
  return { prepare };
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
    VALUES ('kp-refusal', 'UL-100', 1, 'user-steward', ?1, ?2,
       '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')
  `).run(await hashRecoveryCode(OWNERSHIP_CODE), PUBLIC_CODE);
  const db = d1(database);
  const env = { DB: db };
  return { database, db, env };
}

async function contest(fx: Awaited<ReturnType<typeof fixture>>, openedAt = OPENED) {
  const claim = await openContestedClaim(fx.env, {
    keeperPieceId: 'kp-refusal',
    requesterUserId: 'user-claimant',
    requesterEmail: 'claimant@example.com',
    expectedKeeperUserId: 'user-steward',
    openedAt,
  });
  assert.equal(claim.status, 'opened');
  const window = await openSilenceWindow(fx.db, {
    requestId: claim.requestId,
    keeperPieceId: 'kp-refusal',
    createdAt: openedAt,
  }, openedAt);
  assert.equal(window.ok, true);
  return { claimId: claim.requestId as string, windowId: window.windowId as string };
}

function refusalRequest(body: unknown, method = 'POST') {
  return new Request('https://adrianrasmussen.com/api/keeper/claim-refusal', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/keeper/claim-refusal', () => {
  it('stays invisible while the livingLegacy flag is off', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = false;
    try {
      const response = await claimRefusal({
        request: refusalRequest({ publicCode: PUBLIC_CODE }),
        env: { DB: { prepare: () => assert.fail('database work before launch guard') } },
      });
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { ok: false, error: 'not_found' });
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('rejects any method beyond POST', async () => {
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const response = await claimRefusal({
        request: refusalRequest(undefined, 'GET'),
        env: { DB: { prepare: () => assert.fail('database work before method guard') } },
      });
      assert.equal(response.status, 405);
      assert.deepEqual(await response.json(), { ok: false, error: 'method_not_allowed' });
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('the steward refuses an open claim: 200, window closed, maintenance event recorded', async () => {
    const fx = await fixture();
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-steward', email: 'steward@example.com' };
    try {
      const { claimId, windowId } = await contest(fx);

      const response = await claimRefusal({
        request: refusalRequest({ publicCode: PUBLIC_CODE, note: 'This piece never left my home.' }),
        env: fx.env,
      });
      assert.equal(response.status, 200);
      const body = await response.json() as any;
      assert.equal(body.ok, true);
      assert.equal(body.refused.publicCode, PUBLIC_CODE);
      assert.equal(body.refused.windows, 1);
      assert.equal(typeof body.refused.refusedAt, 'string');
      // Never leaks claimant identity in the response.
      assert.doesNotMatch(JSON.stringify(body), /user-claimant|claimant@example\.com/);

      const window = fx.database.prepare(
        'SELECT status, refusal_note FROM claim_silence_windows WHERE id = ?',
      ).get(windowId) as any;
      assert.equal(window.status, 'refused');
      assert.equal(window.refusal_note, 'This piece never left my home.');

      const claim = fx.database.prepare(
        'SELECT status FROM artwork_claim_requests WHERE id = ?',
      ).get(claimId) as any;
      assert.equal(claim.status, 'declined');

      const review = fx.database.prepare(`
        SELECT * FROM registry_maintenance_events WHERE event_type = 'claim_refusal_review'
      `).all() as any[];
      assert.equal(review.length, 1);
      assert.equal(review[0].keeper_piece_id, 'kp-refusal');
      assert.equal(review[0].related_record_id, claimId);
      assert.equal(review[0].administrator_user_id, 'user-steward');
      assert.match(review[0].reason, /refused the passing/);

      // Steward's own piece stays theirs; the endpoint never transfers.
      const piece = fx.database.prepare(
        "SELECT keeper_user_id FROM keeper_pieces WHERE id = 'kp-refusal'",
      ).get() as any;
      assert.equal(piece.keeper_user_id, 'user-steward');
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
      fx.database.close();
    }
  });

  it('a signed-in user who is not the steward is refused with 403', async () => {
    const fx = await fixture();
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-other', email: 'other@example.com' };
    try {
      await contest(fx);
      const response = await claimRefusal({
        request: refusalRequest({ publicCode: PUBLIC_CODE }),
        env: fx.env,
      });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { ok: false, error: 'not_steward' });

      // The window is untouched by the rejected attempt.
      const window = fx.database.prepare(
        "SELECT status FROM claim_silence_windows WHERE keeper_piece_id = 'kp-refusal'",
      ).get() as any;
      assert.equal(window.status, 'open');
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
      fx.database.close();
    }
  });

  it('answers 404 no_open_claim when the steward has no open silence window', async () => {
    const fx = await fixture();
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-steward', email: 'steward@example.com' };
    try {
      const response = await claimRefusal({
        request: refusalRequest({ publicCode: PUBLIC_CODE }),
        env: fx.env,
      });
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { ok: false, error: 'no_open_claim' });
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
      fx.database.close();
    }
  });

  it('answers 404 not_registered for a publicCode with no piece row', async () => {
    const fx = await fixture();
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-steward', email: 'steward@example.com' };
    try {
      const response = await claimRefusal({
        request: refusalRequest({ publicCode: 'AR-9ZZZZZZZ' }),
        env: fx.env,
      });
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { ok: false, error: 'not_registered' });
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
      fx.database.close();
    }
  });

  it('a second refusal after a successful one finds nothing left to refuse', async () => {
    const fx = await fixture();
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    CURRENT_AUTH = { userId: 'user-steward', email: 'steward@example.com' };
    try {
      await contest(fx);
      const first = await claimRefusal({
        request: refusalRequest({ publicCode: PUBLIC_CODE }),
        env: fx.env,
      });
      assert.equal(first.status, 200);

      const second = await claimRefusal({
        request: refusalRequest({ publicCode: PUBLIC_CODE }),
        env: fx.env,
      });
      assert.equal(second.status, 404);
      assert.deepEqual(await second.json(), { ok: false, error: 'no_open_claim' });

      // Only one maintenance event was ever raised.
      const review = fx.database.prepare(`
        SELECT COUNT(*) AS count FROM registry_maintenance_events
         WHERE event_type = 'claim_refusal_review'
      `).get() as any;
      assert.equal(review.count, 1);
    } finally {
      CURRENT_AUTH = null;
      LAUNCH_FLAGS.livingLegacy = wasOn;
      fx.database.close();
    }
  });
});
