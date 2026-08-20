import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, describe, it, mock } from 'node:test';

import {
  createCollectorDream,
  getCollectorDreamState,
  getPublicCollectorDream,
  getYearlyRitualEligibility,
  setCollectorDreamSharing,
  setCollectorDreamTier,
  updateCollectorDream,
} from '../functions/api/_lib/collectorDreams.js';
import { buildLineageEvent } from '../functions/api/_lib/lineage.js';
import { buildPieceRecord } from '../functions/api/_lib/pieceRecord.js';
import { ensureCatalogSnapshot } from '../functions/api/_lib/catalogSnapshot.js';
import { LAUNCH_FLAGS } from '../launchFlags.ts';

mock.module('../functions/api/_lib/auth.js', {
  namedExports: {
    requireUser: async () => ({ userId: 'auth-adult' }),
    jsonResponse: (body: unknown, init: ResponseInit = {}) => new Response(
      JSON.stringify(body),
      { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } },
    ),
  },
});

const { onRequest: collectorDreamRequest } = await import('../functions/api/collector/dreams.js');

after(() => mock.reset());

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

/** Every migration numbered 001 through 042 (collector_dream_tiers), applied in file order. */
function migrationsThrough042() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{3}_.*\.sql$/.test(name) && Number(name.slice(0, 3)) <= 42)
    .sort()
    .map((name) => readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8'))
    .join('\n');
}

const migrations = migrationsThrough042();

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    ${migrations}
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES
      ('auth-adult', 'Adult Keeper', 'adult@example.com', 1, 1, 1),
      ('auth-next', 'Next Keeper', 'next@example.com', 1, 1, 1),
      ('auth-plain', 'Plain Keeper', 'plain@example.com', 1, 1, 1),
      ('auth-outsider', 'Outsider', 'outsider@example.com', 1, 1, 1);
    INSERT INTO users (auth_user_id, clerk_user_id, email)
    VALUES
      ('auth-adult', 'auth-adult', 'adult@example.com'),
      ('auth-next', 'auth-next', 'next@example.com'),
      ('auth-plain', 'auth-plain', 'plain@example.com'),
      ('auth-outsider', 'auth-outsider', 'outsider@example.com');
    INSERT INTO profiles
      (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id, computed_json)
    VALUES
      (1, '1982-01-15', '23:39', 'Santa Cruz', 36.9741, -122.0308,
        'America/Los_Angeles', '{}'),
      (2, '1990-01-15', '12:00', 'Denpasar', -8.67, 115.21,
        'Asia/Makassar', '{}');
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       claimed_at, registered_at)
    VALUES
      ('kp-one', 'UL-100', 0, 'auth-adult', '${'a'.repeat(64)}',
        '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
      ('kp-next', 'UL-102', 0, 'auth-next', '${'b'.repeat(64)}',
        '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
      ('kp-quiet', 'UL-103', 0, 'auth-plain', '${'c'.repeat(64)}',
        '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');
  `);
  return db;
}

/** The canonical governed transfer of kp-one from auth-adult to auth-next
 * (collector-dreams.test.ts shape, unchanged). */
function canonicalTransfer(db: DatabaseSync) {
  const transferAt = '2026-08-10T00:00:00.000Z';
  const eventHash = 'd'.repeat(64);
  db.exec(`
    INSERT INTO registry_maintenance_events
      (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
       administrator_user_id, administrator_email, reason, before_json,
       after_json, outcome, related_record_id, mutation_fingerprint, created_at)
    VALUES
      ('rme-dream-transfer', 'rme-dream-transfer', 'steward_transferred',
       'kp-one', 'UL-100', 'admin', 'admin@example.com',
       'Transfer stewardship safely.',
       '{"keeperUserId":"auth-adult","claimedAt":"2026-08-01T00:00:00.000Z","releasedAt":null,"currentDisplayLocation":null,"stewardVersion":0}',
       '{"keeperUserId":"auth-next","claimedAt":"${transferAt}","releasedAt":null,"currentDisplayLocation":null,"stewardVersion":1}',
       'succeeded', 'kp-one', '${'e'.repeat(64)}', '${transferAt}');
    INSERT INTO artwork_transfer_intents
      (id, keeper_piece_id, expected_from_user_id, target_user_id,
       target_email_commitment, expected_steward_version, expected_lineage_count,
       expected_lineage_hash, transfer_kind, maintenance_event_id,
       lineage_event_id, created_at)
    VALUES
      ('dream-transfer', 'kp-one', 'auth-adult', 'auth-next', '${'f'.repeat(64)}',
       0, 0, NULL, 'gift', 'rme-dream-transfer', 'dream-transfer-lineage',
       '${transferAt}');
    INSERT INTO artwork_transfer_parties
      (id, transfer_intent_id, party_role, user_id, public_ref, created_at)
    VALUES
      ('dream-party-from', 'dream-transfer', 'from', 'auth-adult',
       'tp-00000000-0000-4000-8000-000000000001', '${transferAt}'),
      ('dream-party-to', 'dream-transfer', 'to', 'auth-next',
       'tp-00000000-0000-4000-8000-000000000002', '${transferAt}');
    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json)
    VALUES
      ('dream-transfer-lineage', 'kp-one', 1, 'transferred', '${transferAt}',
       NULL, '${eventHash}',
       '{"fromRef":"tp-00000000-0000-4000-8000-000000000001","toRef":"tp-00000000-0000-4000-8000-000000000002","transferKind":"gift"}');
    INSERT INTO artwork_transfer_receipts (id, transfer_intent_id, committed_at)
    VALUES ('dream-transfer-receipt', 'dream-transfer', '${transferAt}');
    UPDATE keeper_pieces
       SET keeper_user_id = 'auth-next', claimed_at = '${transferAt}',
           released_at = NULL, current_display_location = NULL,
           steward_version = 1, lineage_event_count = 1,
           lineage_head_hash = '${eventHash}', last_transfer_id = 'dream-transfer'
     WHERE id = 'kp-one';
  `);
}

function d1(database: DatabaseSync) {
  const prepare = (sql: string) => {
    let values: SQLInputValue[] = [];
    return {
      bind(...next: SQLInputValue[]) { values = next; return this; },
      async first() { return database.prepare(sql).get(...values) || null; },
      async all() { return { results: database.prepare(sql).all(...values) }; },
      async run() {
        const result = database.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
  };
  return {
    prepare,
    async batch(statements: Array<ReturnType<typeof prepare>>) {
      database.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

async function plantKeepDream(env: object, userId: string, keeperPieceId: string, extra = {}) {
  return createCollectorDream(env, {
    userId,
    keeperPieceId,
    body: 'May this house stay warm.',
    scope: 'family',
    idempotencyKey: `plant-${keeperPieceId}-${userId}`,
    now: '2026-08-02T00:00:00.000Z',
    ...extra,
  });
}

describe('collector dream tiers (migration 042)', () => {
  it('plants keep by default and walks only the allowed transitions', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      const planted = await plantKeepDream(env, 'auth-adult', 'kp-one');
      assert.equal(planted.current?.tier, 'keep');
      assert.equal(planted.current?.heirsMayShare, true);
      assert.equal(planted.current?.sealed, false);

      const shone = await setCollectorDreamTier(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', tier: 'shine',
        idempotencyKey: 'tier-shine-one', now: '2026-08-03T00:00:00.000Z',
      });
      assert.equal(shone.current?.tier, 'shine');
      assert.equal(shone.current?.visibility, 'anonymous');
      assert.equal(shone.current?.sharedAt, '2026-08-03T00:00:00.000Z');
      const projected = await getPublicCollectorDream(env, {
        keeperPieceId: 'kp-one', now: '2026-08-03T01:00:00.000Z',
      });
      assert.equal(projected?.body, 'May this house stay warm.');

      // shine is terminal: no app path down, no direct path down.
      await assert.rejects(setCollectorDreamTier(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', tier: 'seal',
        idempotencyKey: 'tier-shine-to-seal', now: '2026-08-04T00:00:00.000Z',
      }), /shine_is_permanent/);
      for (const downgrade of ['keep', 'seal']) {
        assert.throws(() => db.prepare(
          `UPDATE collector_dreams SET tier = '${downgrade}' WHERE keeper_piece_id = 'kp-one'`,
        ).run(), /forbidden dream tier transition|exact authorization/);
      }
      // keep is never a destination through the app either.
      await assert.rejects(setCollectorDreamTier(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', tier: 'keep',
        idempotencyKey: 'tier-shine-to-keep', now: '2026-08-04T00:00:00.000Z',
      }), /forbidden_tier_transition/);
    } finally {
      db.close();
    }
  });

  it('seals a keep dream, pins heirs to 0, forbids seal -> keep, allows seal -> shine', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      await plantKeepDream(env, 'auth-next', 'kp-next');
      const sealed = await setCollectorDreamTier(env, {
        userId: 'auth-next', keeperPieceId: 'kp-next', tier: 'seal',
        idempotencyKey: 'tier-keep-to-seal', now: '2026-08-03T00:00:00.000Z',
      });
      assert.equal(sealed.current?.tier, 'seal');
      assert.equal(sealed.current?.sealed, true);
      assert.equal(sealed.current?.heirsMayShare, false);
      assert.equal(db.prepare(
        "SELECT heirs_may_share FROM collector_dreams WHERE keeper_piece_id = 'kp-next'",
      ).get()?.heirs_may_share, 0);

      // seal -> keep forbidden at every level.
      assert.throws(() => db.prepare(
        "UPDATE collector_dreams SET tier = 'keep' WHERE keeper_piece_id = 'kp-next'",
      ).run(), /forbidden dream tier transition|exact authorization/);
      assert.throws(() => db.prepare(`
        INSERT INTO collector_dream_tier_changes
          (id, dream_id, author_user_id, from_tier, to_tier, idempotency_key,
           resulting_version, created_at)
        SELECT 'dream-tier-illegal', id, 'auth-next', 'seal', 'keep',
               'illegal-tier-key', record_version + 1, '2026-08-04T00:00:00.000Z'
          FROM collector_dreams WHERE keeper_piece_id = 'kp-next'
      `).run(), /CHECK constraint failed|dream tier change did not apply exactly/);
      // heirs stay pinned however the write arrives.
      assert.throws(() => db.prepare(
        "UPDATE collector_dreams SET heirs_may_share = 1 WHERE keeper_piece_id = 'kp-next'",
      ).run(), /pins heirs_may_share|exact authorization/);
      // a plain share cannot open a sealed dream.
      await assert.rejects(setCollectorDreamSharing(env, {
        userId: 'auth-next', keeperPieceId: 'kp-next', visibility: 'anonymous',
        idempotencyKey: 'seal-plain-share', now: '2026-08-04T00:00:00.000Z',
      }), /dream_sealed/);

      // seal -> shine is the writer's own deliberate act, and it works.
      const shone = await setCollectorDreamTier(env, {
        userId: 'auth-next', keeperPieceId: 'kp-next', tier: 'shine',
        idempotencyKey: 'tier-seal-to-shine', now: '2026-08-05T00:00:00.000Z',
      });
      assert.equal(shone.current?.tier, 'shine');
      assert.equal((await getPublicCollectorDream(env, {
        keeperPieceId: 'kp-next', now: '2026-08-05T01:00:00.000Z',
      }))?.body, 'May this house stay warm.');
    } finally {
      db.close();
    }
  });

  it('creates directly at seal (heirs pinned) and directly at shine (words with no name)', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      const sealed = await plantKeepDream(env, 'auth-next', 'kp-next', {
        tier: 'seal', heirsMayShare: true, idempotencyKey: 'create-sealed',
      });
      assert.equal(sealed.current?.tier, 'seal');
      assert.equal(sealed.current?.heirsMayShare, false);

      const shining = await createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one',
        body: 'May every guest read this and smile.', scope: 'community',
        tier: 'shine', idempotencyKey: 'create-shining',
        now: '2026-08-02T00:00:00.000Z',
      });
      assert.equal(shining.current?.tier, 'shine');
      assert.equal(shining.current?.visibility, 'anonymous');
      assert.equal(shining.current?.sharedAt, '2026-08-02T00:00:00.000Z');
      const projected = await getPublicCollectorDream(env, {
        keeperPieceId: 'kp-one', now: '2026-08-02T01:00:00.000Z',
      });
      assert.equal(projected?.body, 'May every guest read this and smile.');
      assert.equal(projected?.attribution, null);
    } finally {
      db.close();
    }
  });

  it('refuses un-shining: shine_is_permanent in the app, aborted revoke in the database', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      await plantKeepDream(env, 'auth-adult', 'kp-one');
      // Sharing IS shining: the legacy share path flips keep -> shine.
      const shared = await setCollectorDreamSharing(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', visibility: 'anonymous',
        idempotencyKey: 'share-flips-tier', now: '2026-08-03T00:00:00.000Z',
      });
      assert.equal(shared.current?.tier, 'shine');

      await assert.rejects(setCollectorDreamSharing(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', visibility: 'private',
        idempotencyKey: 'unshine-attempt', now: '2026-08-04T00:00:00.000Z',
      }), /shine_is_permanent/);
      assert.throws(() => db.prepare(`
        INSERT INTO collector_dream_mutations
          (id, dream_id, author_user_id, action, idempotency_key,
           request_json, resulting_version, created_at)
        SELECT 'direct-unshine', id, 'auth-adult', 'revoke', 'direct-unshine-key',
               '{"visibility":"private"}', record_version + 1,
               '2026-08-04T00:00:00.000Z'
          FROM collector_dreams WHERE keeper_piece_id = 'kp-one'
      `).run(), /dream mutation did not apply exactly/);

      // The 029 fail-safe closures still work on a shine row: the words come
      // off live display without touching the tier (the record keeps them).
      db.prepare("UPDATE profiles SET birth_date = '2012-01-15' WHERE user_id = 1").run();
      const row = db.prepare(
        "SELECT tier, public_revoked_at FROM collector_dreams WHERE keeper_piece_id = 'kp-one'",
      ).get();
      assert.equal(row?.tier, 'shine');
      assert.ok(row?.public_revoked_at);
      assert.equal(await getPublicCollectorDream(env, {
        keeperPieceId: 'kp-one', now: '2026-08-05T00:00:00.000Z',
      }), null);
    } finally {
      db.close();
    }
  });

  it('keeps the writer inside their sealed words forever, and everyone else out', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      await plantKeepDream(env, 'auth-adult', 'kp-one', {
        tier: 'seal', idempotencyKey: 'sealed-before-transfer',
        body: 'Only I will ever read this again.',
      });
      canonicalTransfer(db);

      // The writer, no longer the keeper, still reads their own sealed body.
      const authorView = await getCollectorDreamState(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one',
      });
      assert.equal(authorView.current, null);
      assert.equal(authorView.history.length, 1);
      assert.equal(authorView.history[0]?.tier, 'seal');
      assert.equal(authorView.history[0]?.sealed, true);
      assert.equal(authorView.history[0]?.body, 'Only I will ever read this again.');

      // The new keeper holds the piece and still cannot open the seal.
      const keeperView = await getCollectorDreamState(env, {
        userId: 'auth-next', keeperPieceId: 'kp-one',
      });
      assert.equal(keeperView.history.length, 1);
      assert.equal(keeperView.history[0]?.sealed, true);
      assert.equal(keeperView.history[0]?.body, null);
      assert.ok(!JSON.stringify(keeperView).includes('Only I will ever read this again.'));

      // An account with no relationship to the piece stays outside entirely.
      await assert.rejects(getCollectorDreamState(env, {
        userId: 'auth-outsider', keeperPieceId: 'kp-one',
      }), /piece_not_held/);
    } finally {
      db.close();
    }
  });

  it('opens keep words to the current holder only, and hides the new current dream from past writers', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      await plantKeepDream(env, 'auth-adult', 'kp-one', {
        body: 'Kept words travel with the piece.',
      });
      canonicalTransfer(db);

      // keep travels: the current holder opens the previous keeper's words.
      const keeperView = await getCollectorDreamState(env, {
        userId: 'auth-next', keeperPieceId: 'kp-one',
      });
      assert.equal(keeperView.history[0]?.tier, 'keep');
      assert.equal(keeperView.history[0]?.body, 'Kept words travel with the piece.');

      // The writer still reads their own words after letting the piece go.
      const authorView = await getCollectorDreamState(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one',
      });
      assert.equal(authorView.history[0]?.body, 'Kept words travel with the piece.');

      // The new keeper plants their own dream; the past writer neither reads
      // it nor learns it exists.
      await createCollectorDream(env, {
        userId: 'auth-next', keeperPieceId: 'kp-one',
        body: 'A new chapter the old keeper cannot read.', scope: 'self',
        idempotencyKey: 'next-keeper-dream', now: '2026-08-11T00:00:00.000Z',
      });
      const afterNewDream = await getCollectorDreamState(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one',
      });
      assert.equal(afterNewDream.current, null);
      assert.ok(!JSON.stringify(afterNewDream).includes('A new chapter'));

      // An outsider has no way in at all.
      await assert.rejects(getCollectorDreamState(env, {
        userId: 'auth-outsider', keeperPieceId: 'kp-one',
      }), /piece_not_held/);
    } finally {
      db.close();
    }
  });

  it('locks body edits to the birthday window; planting and tier changes stay ungated', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      // First placement is ungated: nowhere near the January birthday.
      const planted = await plantKeepDream(env, 'auth-adult', 'kp-one', {
        now: '2026-06-01T00:00:00.000Z', idempotencyKey: 'lock-plant',
      });

      // Editing the standing words outside the window is refused.
      await assert.rejects(updateCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one',
        body: 'An out-of-season rewrite.', scope: 'family',
        expectedVersion: planted.current?.version,
        idempotencyKey: 'lock-edit-outside', now: '2026-06-02T00:00:00.000Z',
      }), /outside_birthday_window/);

      // Tier changes are not gated by the window.
      const sealed = await setCollectorDreamTier(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', tier: 'seal',
        idempotencyKey: 'lock-tier-any-day', now: '2026-06-03T00:00:00.000Z',
      });
      assert.equal(sealed.current?.tier, 'seal');

      // Inside the window (birthday 15 January) the edit lands.
      const edited = await updateCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one',
        body: 'The year turned, and the words with it.', scope: 'family',
        expectedVersion: sealed.current?.version,
        idempotencyKey: 'lock-edit-inside', now: '2027-01-10T12:00:00.000Z',
      });
      assert.equal(edited.current?.body, 'The year turned, and the words with it.');
    } finally {
      db.close();
    }
  });

  it('falls back to the claim anniversary without a birth profile, and never says so', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      // auth-plain has no profiles row. kp-quiet was claimed 2026-08-01.
      await plantKeepDream(env, 'auth-plain', 'kp-quiet', {
        now: '2026-09-01T00:00:00.000Z', idempotencyKey: 'fallback-plant',
      });
      await plantKeepDream(env, 'auth-adult', 'kp-one', {
        now: '2026-09-01T00:00:00.000Z', idempotencyKey: 'profile-plant',
      });

      const fallbackDue = await getYearlyRitualEligibility(env, {
        userId: 'auth-plain', keeperPieceId: 'kp-quiet',
        now: '2027-08-05T12:00:00.000Z',
      });
      assert.equal(fallbackDue.eligible, true);
      assert.equal(fallbackDue.birthdayYear, 2027);
      assert.deepEqual(fallbackDue.actions, ['reinforce', 'plant-new', 'fulfilled']);

      const fallbackNotDue = await getYearlyRitualEligibility(env, {
        userId: 'auth-plain', keeperPieceId: 'kp-quiet',
        now: '2027-03-01T12:00:00.000Z',
      });
      assert.equal(fallbackNotDue.eligible, false);
      assert.equal(fallbackNotDue.reason, 'outside_birthday_window');

      // Same shape and vocabulary as the profile-anchored answers: nothing
      // in the payload reveals which anchor was used.
      const profileDue = await getYearlyRitualEligibility(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one',
        now: '2027-01-15T12:00:00.000Z',
      });
      const profileNotDue = await getYearlyRitualEligibility(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one',
        now: '2027-03-01T12:00:00.000Z',
      });
      assert.deepEqual(Object.keys(fallbackDue).sort(), Object.keys(profileDue).sort());
      assert.deepEqual(Object.keys(fallbackNotDue).sort(), Object.keys(profileNotDue).sort());
      assert.equal(fallbackNotDue.reason, profileNotDue.reason);
      // birthdayYear / outside_birthday_window are the shared vocabulary both
      // anchors answer with; nothing anchor-specific may appear.
      assert.doesNotMatch(
        JSON.stringify([fallbackDue, fallbackNotDue]),
        /claimed|anniversary|anchor|fallback|birth_profile|profile/i,
      );

      // The edit lock rides the same silent anchor.
      const state = await getCollectorDreamState(env, {
        userId: 'auth-plain', keeperPieceId: 'kp-quiet',
      });
      await assert.rejects(updateCollectorDream(env, {
        userId: 'auth-plain', keeperPieceId: 'kp-quiet',
        body: 'Too far from the anniversary.', scope: 'family',
        expectedVersion: state.current?.version,
        idempotencyKey: 'fallback-edit-outside', now: '2027-03-01T12:00:00.000Z',
      }), /outside_birthday_window/);
      const edited = await updateCollectorDream(env, {
        userId: 'auth-plain', keeperPieceId: 'kp-quiet',
        body: 'A year with the piece.', scope: 'family',
        expectedVersion: state.current?.version,
        idempotencyKey: 'fallback-edit-inside', now: '2027-08-05T12:00:00.000Z',
      });
      assert.equal(edited.current?.body, 'A year with the piece.');
    } finally {
      db.close();
    }
  });

  it('serves the tier actions over the endpoint with exact field sets and proper codes', async (t) => {
    const priorFlag = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    t.after(() => { LAUNCH_FLAGS.livingLegacy = priorFlag; });
    const db = database();
    try {
      const env = { DB: d1(db) };
      const post = async (payload: Record<string, unknown>) => {
        const request = new Request('https://adrianrasmussen.com/api/collector/dreams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const response = await collectorDreamRequest({ request, env });
        return { status: response.status, body: await response.json() as any };
      };

      // create still accepts the pre-tier shape, and the tiered one.
      const legacy = await post({
        action: 'create', keeperPieceId: 'kp-one',
        body: 'Planted over the wire.', scope: 'self',
        idempotencyKey: 'wire-create-legacy',
      });
      assert.equal(legacy.status, 200);
      assert.equal(legacy.body.current?.tier, 'keep');

      const tierMove = await post({
        action: 'tier', keeperPieceId: 'kp-one', tier: 'seal',
        idempotencyKey: 'wire-tier-seal',
      });
      assert.equal(tierMove.status, 200);
      assert.equal(tierMove.body.current?.tier, 'seal');
      assert.equal(tierMove.body.current?.heirsMayShare, false);

      // Unknown fields are refused exactly as before.
      const smuggled = await post({
        action: 'tier', keeperPieceId: 'kp-one', tier: 'shine',
        idempotencyKey: 'wire-tier-extra', extra: true,
      });
      assert.equal(smuggled.status, 400);
      assert.deepEqual(smuggled.body, { error: 'invalid_input' });

      // Documented conflict codes surface with 409.
      const unchanged = await post({
        action: 'tier', keeperPieceId: 'kp-one', tier: 'seal',
        idempotencyKey: 'wire-tier-repeat',
      });
      assert.equal(unchanged.status, 409);
      assert.deepEqual(unchanged.body, { error: 'tier_unchanged' });

      const lockedEdit = await post({
        action: 'update', keeperPieceId: 'kp-one',
        body: 'Rewritten off-season.', scope: 'self',
        expectedVersion: tierMove.body.current?.version,
        idempotencyKey: 'wire-edit-locked',
      });
      assert.equal(lockedEdit.status, 409);
      assert.deepEqual(lockedEdit.body, { error: 'outside_birthday_window' });
    } finally {
      db.close();
    }
  });

  it('composes with migration 041: sealed words never reach the record, shone words stay until an abuse removal', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      const publicCode = 'AR-ABCDEFGH';
      db.prepare(`
        UPDATE keeper_pieces SET public_code = ?1, plate_status = 'active'
         WHERE id = 'kp-one'
      `).run(publicCode);
      const eventDefinitions = [
        {
          eventType: 'issued',
          eventAt: '2026-08-01T00:00:00.000Z',
          publicPayload: { pieceId: 'UL-100', editionNumber: 0, publicCode },
        },
        {
          eventType: 'activated',
          eventAt: '2026-08-01T01:00:00.000Z',
          publicPayload: { plateStatus: 'active' },
        },
        {
          eventType: 'first_bound',
          eventAt: '2026-08-01T02:00:00.000Z',
          publicPayload: {},
        },
      ];
      let previousHash: string | null = null;
      for (let index = 0; index < eventDefinitions.length; index += 1) {
        const event = await buildLineageEvent({
          keeperPieceId: 'kp-one',
          sequence: index + 1,
          previousHash,
          ...eventDefinitions[index],
        });
        db.prepare(`
          INSERT INTO artwork_lineage_events
            (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
             event_hash, public_payload_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          event.id, event.keeperPieceId, event.sequence, event.eventType,
          event.eventAt, event.previousHash, event.eventHash, event.publicPayloadJson,
        );
        previousHash = event.eventHash;
      }
      db.prepare(`
        UPDATE keeper_pieces SET lineage_head_hash = ?, lineage_event_count = ?
         WHERE id = 'kp-one'
      `).run(previousHash, eventDefinitions.length);
      await ensureCatalogSnapshot(env, {
        id: 'UL-100',
        title: 'Earth Record',
        series: 'Universal Language',
        category: 'Multidimensional Art',
        year: '2024',
        dimensions: '24 in diameter',
        material: 'Carved teak',
        description: 'A breathing mandala carved from a single round of teak.',
        editionSize: 12,
      }, { source: 'mockData', createdAt: '2026-08-10T00:00:00.000Z' });
      const buildOptions = {
        publicCode,
        trigger: 'on_demand',
        generatedAt: '2026-08-19T00:00:00.000Z',
        includeLegacySections: true,
      } as const;

      // A shone dream enters the record.
      await plantKeepDream(env, 'auth-adult', 'kp-one', {
        body: 'May this wood remember our gratitude.', idempotencyKey: 'record-dream',
      });
      await setCollectorDreamTier(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', tier: 'shine',
        idempotencyKey: 'record-shine', now: '2026-08-05T00:00:00.000Z',
      });
      const before = await buildPieceRecord(env, { ...buildOptions });
      assert.equal(before.record.shines.entries.length, 1);
      assert.equal(before.record.shines.entries[0].words, 'May this wood remember our gratitude.');

      // The audited abuse removal (040) is the one path off the record.
      const dreamRow = db.prepare(
        "SELECT id FROM collector_dreams WHERE keeper_piece_id = 'kp-one'",
      ).get();
      db.prepare(`
        INSERT INTO collector_shine_removals
          (id, content_id, keeper_piece_id, removed_reason, removed_by_user_id,
           idempotency_key, removed_at)
        VALUES ('csr-record-test', ?1, 'kp-one', 'Abusive content reported.',
                'admin', 'csr-record-key', '2026-08-18T00:00:00.000Z')
      `).run(String(dreamRow?.id));
      const after = await buildPieceRecord(env, { ...buildOptions });
      assert.deepEqual(after.record.shines.entries, []);

      // A sealed row cannot even be inserted wearing share columns: the 041
      // insert guard refuses the shape outright.
      assert.throws(() => db.exec(`
        INSERT INTO collector_dreams
          (id, keeper_piece_id, author_user_id, body, scope, visibility,
           idempotency_key, record_version, created_at, updated_at,
           public_shared_at, tier, heirs_may_share, archived_at)
        VALUES
          ('dream-forged-seal', 'kp-one', 'auth-adult',
           'A sealed body that must never surface.', 'self', 'anonymous',
           'forged-seal-key', 1, '2026-08-06T00:00:00.000Z',
           '2026-08-06T00:00:00.000Z', '2026-08-06T00:00:00.000Z', 'seal', 0,
           '2026-08-07T00:00:00.000Z');
      `), /private never-shone/);

      // Defense in depth: a sealed dream walked halfway toward the light
      // (the share landed, the tier flip did not) reaches neither the
      // regenerated record nor the public read while it is still sealed.
      db.prepare(`
        UPDATE collector_dreams
           SET archived_at = '2026-08-19T01:00:00.000Z',
               public_revoked_at = '2026-08-19T01:00:00.000Z',
               updated_at = '2026-08-19T01:00:00.000Z',
               record_version = record_version + 1
         WHERE keeper_piece_id = 'kp-one' AND archived_at IS NULL
      `).run();
      await plantKeepDream(env, 'auth-adult', 'kp-one', {
        tier: 'seal', idempotencyKey: 'sealed-current-record',
        body: 'A sealed body that must never surface.',
        now: '2026-08-19T02:00:00.000Z',
      });
      db.prepare(`
        INSERT INTO collector_dream_mutations
          (id, dream_id, author_user_id, action, idempotency_key,
           request_json, resulting_version, created_at)
        SELECT 'halfway-share', id, 'auth-adult', 'share', 'halfway-share-key',
               '{"visibility":"anonymous"}', record_version + 1,
               '2026-08-19T03:00:00.000Z'
          FROM collector_dreams
         WHERE keeper_piece_id = 'kp-one' AND archived_at IS NULL
      `).run();
      const halfway = db.prepare(`
        SELECT tier, visibility, public_shared_at FROM collector_dreams
         WHERE keeper_piece_id = 'kp-one' AND archived_at IS NULL
      `).get();
      assert.equal(halfway?.tier, 'seal');
      assert.equal(halfway?.visibility, 'anonymous');
      assert.ok(halfway?.public_shared_at);
      const withHalfway = await buildPieceRecord(env, { ...buildOptions });
      assert.ok(!withHalfway.canonicalJson.includes('A sealed body that must never surface.'));
      assert.equal(await getPublicCollectorDream(env, {
        keeperPieceId: 'kp-one', now: '2026-08-19T04:00:00.000Z',
      }), null);
    } finally {
      db.close();
    }
  });
});
