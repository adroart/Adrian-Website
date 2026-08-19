// GET /api/keeper/message (migration 039 + functions/api/_lib/artistMessage.js
// + functions/api/keeper/message.js): the artist's sealed message, met once
// by its piece's steward. Runs against real in-memory SQLite through
// migrations 001-040 so the migration's one-way reveal stamp and the
// one-active-message partial unique index actually govern the endpoint.
//
// Run note: uses node:test's mock.module, so invoke with
// `npx tsx --test --experimental-test-module-mocks tests/keeper-message.test.ts`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, beforeEach, describe, it, mock } from 'node:test';

import { LAUNCH_FLAGS } from '../launchFlags.ts';

let authResult: unknown;

mock.module('../functions/api/_lib/auth.js', {
  namedExports: {
    requireUser: async () => authResult,
  },
});

const { onRequest: messageEndpoint } = await import('../functions/api/keeper/message.js');

const originalFlag = LAUNCH_FLAGS.livingLegacy;

beforeEach(() => {
  LAUNCH_FLAGS.livingLegacy = true;
  authResult = {
    userId: 'user-steward',
    email: 'steward@example.com',
    user: { id: 'user-steward', email: 'steward@example.com', emailVerified: true },
  };
});

after(() => {
  LAUNCH_FLAGS.livingLegacy = originalFlag;
  mock.reset();
});

function request(query = '?publicCode=AR-7KQ9M2WX', method = 'GET') {
  return new Request(`https://adrianrasmussen.com/api/keeper/message${query}`, {
    method,
    headers: { Origin: 'https://adrianrasmussen.com' },
  });
}

const readMigration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);
const migrationsThroughShineRemovals = [
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
  '037_transfer_silence.sql', '038_piece_media.sql',
  '039_artist_messages.sql', '040_collector_shine_removals.sql',
].map(readMigration).join('\n');

const PUBLIC_CODE = 'AR-7KQ9M2WX';
const OTHER_PUBLIC_CODE = 'AR-8KQ9M2WX';

function fixture() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    PRAGMA foreign_keys = ON;
    ${migrationsThroughShineRemovals}
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES
      ('user-steward', 'Registered Steward', 'steward@example.com', 1, 1, 1),
      ('user-other', 'Someone Else', 'other@example.com', 1, 1, 1);
    INSERT INTO users (auth_user_id, clerk_user_id, email)
    VALUES
      ('user-steward', 'user-steward', 'steward@example.com'),
      ('user-other', 'user-other', 'other@example.com');
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       public_code, claimed_at, registered_at)
    VALUES
      ('kp-steward', 'UL-100', 1, 'user-steward', '${'a'.repeat(64)}',
       '${PUBLIC_CODE}', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
      ('kp-other', 'UL-101', 1, 'user-other', '${'b'.repeat(64)}',
       '${OTHER_PUBLIC_CODE}', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');
  `);
  let prepares = 0;
  const DB = {
    prepare(sql: string) {
      prepares += 1;
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...bound: SQLInputValue[]) { values = bound; return statement; },
        first() { return database.prepare(sql).get(...values) ?? null; },
        all() { return { results: database.prepare(sql).all(...values) }; },
        run() {
          const result = database.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
      return statement;
    },
  };
  return { database, env: { DB }, prepares: () => prepares };
}

describe('GET /api/keeper/message — the sealed artist message', () => {
  it('stays invisible before any work while the launch flag is off', async () => {
    LAUNCH_FLAGS.livingLegacy = false;
    const DB = { prepare: () => assert.fail('database work before launch guard') };
    const response = await messageEndpoint({ request: request(), env: { DB } });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { ok: false, error: 'not_found' });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  });

  it('reveals the body on the steward\'s first read, then answers the same body with firstReveal:false', async () => {
    const target = fixture();
    try {
      target.database.prepare(`
        INSERT INTO artist_messages (id, keeper_piece_id, body, created_at)
        VALUES ('am-test-one', 'kp-steward',
          'What you hold carries the years I spent making it.',
          '2026-08-10T00:00:00.000Z')
      `).run();

      const first = await messageEndpoint({ request: request(), env: target.env });
      assert.equal(first.status, 200);
      const firstBody = await first.json() as any;
      assert.equal(firstBody.ok, true);
      assert.equal(firstBody.message.body, 'What you hold carries the years I spent making it.');
      assert.equal(firstBody.message.sealedAt, '2026-08-10T00:00:00.000Z');
      assert.equal(typeof firstBody.message.revealedAt, 'string');
      assert.equal(firstBody.message.firstReveal, true);

      const revealedAtFirst = firstBody.message.revealedAt;
      const row = target.database.prepare(
        `SELECT revealed_at FROM artist_messages WHERE keeper_piece_id = 'kp-steward'`,
      ).get() as { revealed_at: string };
      assert.equal(row.revealed_at, revealedAtFirst);

      const second = await messageEndpoint({ request: request(), env: target.env });
      assert.equal(second.status, 200);
      const secondBody = await second.json() as any;
      assert.equal(secondBody.ok, true);
      assert.equal(secondBody.message.body, firstBody.message.body);
      assert.equal(secondBody.message.revealedAt, revealedAtFirst);
      assert.equal(secondBody.message.firstReveal, false);

      // The stamp is immutable: still exactly the first-reveal instant.
      const rowAfter = target.database.prepare(
        `SELECT revealed_at FROM artist_messages WHERE keeper_piece_id = 'kp-steward'`,
      ).get() as { revealed_at: string };
      assert.equal(rowAfter.revealed_at, revealedAtFirst);
    } finally {
      target.database.close();
    }
  });

  it('answers no message with a null payload rather than an error', async () => {
    const target = fixture();
    try {
      const response = await messageEndpoint({ request: request(), env: target.env });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true, message: null });
    } finally {
      target.database.close();
    }
  });

  it('never surfaces a body to a signed-in user who is not this piece\'s steward', async () => {
    const target = fixture();
    try {
      target.database.prepare(`
        INSERT INTO artist_messages (id, keeper_piece_id, body, created_at)
        VALUES ('am-test-two', 'kp-steward', 'A private word for its own steward.',
          '2026-08-10T00:00:00.000Z')
      `).run();

      authResult = {
        userId: 'user-other',
        email: 'other@example.com',
        user: { id: 'user-other', email: 'other@example.com', emailVerified: true },
      };
      const response = await messageEndpoint({
        request: request(`?publicCode=${PUBLIC_CODE}`), env: target.env,
      });
      assert.equal(response.status, 404);
      const body = await response.json() as any;
      assert.deepEqual(body, { ok: false, error: 'not_found' });
      assert.doesNotMatch(JSON.stringify(body), /private word/);

      // And the piece's own steward untouched by the other user's read:
      // still answers firstReveal:true on the actual steward's first look.
      authResult = {
        userId: 'user-steward',
        email: 'steward@example.com',
        user: { id: 'user-steward', email: 'steward@example.com', emailVerified: true },
      };
      const stewardRead = await messageEndpoint({
        request: request(`?publicCode=${PUBLIC_CODE}`), env: target.env,
      });
      const stewardBody = await stewardRead.json() as any;
      assert.equal(stewardBody.message.firstReveal, true);
    } finally {
      target.database.close();
    }
  });

  it('rejects guests, unverified email, and unsynced accounts before any piece lookup', async () => {
    const target = fixture();
    try {
      authResult = new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
      const before = target.prepares();
      const guest = await messageEndpoint({ request: request(), env: target.env });
      assert.equal(guest.status, 401);
      assert.equal(target.prepares(), before);

      authResult = {
        userId: 'user-steward', email: 'steward@example.com',
        user: { id: 'user-steward', email: 'steward@example.com', emailVerified: false },
      };
      const unverified = await messageEndpoint({ request: request(), env: target.env });
      assert.equal(unverified.status, 403);
      assert.deepEqual(await unverified.json(), { ok: false, error: 'verified_email_required' });
      assert.equal(target.prepares(), before);

      authResult = {
        userId: 'user-unsynced', email: 'unsynced@example.com',
        user: { id: 'user-unsynced', email: 'unsynced@example.com', emailVerified: true },
      };
      const unsynced = await messageEndpoint({ request: request(), env: target.env });
      assert.equal(unsynced.status, 409);
      assert.deepEqual(await unsynced.json(), { ok: false, error: 'account_not_synced' });
    } finally {
      target.database.close();
    }
  });

  it('rejects a malformed publicCode and any method beyond GET', async () => {
    const target = fixture();
    try {
      const badCode = await messageEndpoint({ request: request('?publicCode=not-a-code'), env: target.env });
      assert.equal(badCode.status, 400);
      assert.deepEqual(await badCode.json(), { ok: false, error: 'valid publicCode is required' });

      const wrongMethod = await messageEndpoint({
        request: request(`?publicCode=${PUBLIC_CODE}`, 'POST'), env: target.env,
      });
      assert.equal(wrongMethod.status, 405);
      assert.deepEqual(await wrongMethod.json(), { ok: false, error: 'method_not_allowed' });
    } finally {
      target.database.close();
    }
  });
});
