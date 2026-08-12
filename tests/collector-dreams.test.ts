import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, describe, it, mock } from 'node:test';

import {
  appendCollectorDreamMarker,
  completeYearlyRitual,
  createCollectorDream,
  getCollectorDreamState,
  getPublicCollectorDream,
  getYearlyRitualEligibility,
  setCollectorDreamSharing,
  updateCollectorDream,
} from '../functions/api/_lib/collectorDreams.js';
import { onRequest as publicDreamRequest } from '../functions/api/collector/dreams/public/[publicCode].js';
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

const readMigration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);
const migrationsThroughDreams = [
  '001_init.sql', '003_atlas_legacy.sql', '006_better_auth.sql',
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
].map(readMigration).join('\n');

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    ${migrationsThroughDreams}
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES
      ('auth-adult', 'Adult Keeper', 'adult@example.com', 1, 1, 1),
      ('auth-minor', 'Minor Keeper', 'minor@example.com', 1, 1, 1),
      ('auth-next', 'Next Keeper', 'next@example.com', 1, 1, 1);
    INSERT INTO users (auth_user_id, clerk_user_id, email)
    VALUES
      ('auth-adult', 'auth-adult', 'adult@example.com'),
      ('auth-minor', 'auth-minor', 'minor@example.com'),
      ('auth-next', 'auth-next', 'next@example.com');
    INSERT INTO profiles
      (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id, computed_json)
    VALUES
      (1, '1982-01-15', '23:39', 'Santa Cruz', 36.9741, -122.0308,
        'America/Los_Angeles', '{}'),
      (2, '2012-01-15', '12:00', 'Denpasar', -8.67, 115.21,
        'Asia/Makassar', '{}'),
      (3, '1990-01-15', '12:00', 'Denpasar', -8.67, 115.21,
        'Asia/Makassar', '{}');
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       claimed_at, registered_at)
    VALUES
      ('kp-one', 'UL-100', 0, 'auth-adult', '${'a'.repeat(64)}',
        '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
      ('kp-minor', 'UL-101', 0, 'auth-minor', '${'b'.repeat(64)}',
        '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
      ('kp-next', 'UL-102', 0, 'auth-next', '${'c'.repeat(64)}',
        '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');
  `);
  return db;
}

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

function registerPublicCode(db: DatabaseSync, keeperPieceId: string, publicCode: string) {
  const backupHash = '9'.repeat(64);
  db.prepare(`
    UPDATE keeper_pieces
       SET public_code = ?1,
           issuance_key = ?2,
           ownership_code_ciphertext = 'ciphertext',
           ownership_code_nonce = 'nonce',
           ownership_code_key_version = 1,
           registration_status = 'registered',
           registered_by_user_id = 'artist-admin',
           identity_backup_status = 'verified',
           identity_backup_reference = ?3,
           identity_backup_sha256 = ?4,
           identity_backup_at = registered_at
     WHERE id = ?5
  `).run(
    publicCode,
    `issuance-${keeperPieceId}`,
    `identities/${publicCode}/${backupHash}.json`,
    backupHash,
    keeperPieceId,
  );
}

function grantNameConsent(db: DatabaseSync, userId = 1) {
  db.prepare(`
    INSERT INTO collector_person_privacy
      (user_id, share_name, policy_version, updated_at)
    VALUES (?1, 1, 'collector-privacy-v1', '2026-08-09T12:00:30.000Z')
  `).run(userId);
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

describe('collector dreams', () => {
  it('projects a signed-out public dream by registered public code without private fields', async (t) => {
    const priorFlag = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    t.after(() => { LAUNCH_FLAGS.livingLegacy = priorFlag; });
    const db = database();
    try {
      const env = { DB: d1(db) };
      registerPublicCode(db, 'kp-one', 'AR-ABCDEFGH');
      await createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one',
        body: 'May every neighbor find a place at the table.', scope: 'community',
        idempotencyKey: 'public-endpoint-dream', now: '2026-08-09T12:00:00.000Z',
      });
      await setCollectorDreamSharing(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', visibility: 'anonymous',
        idempotencyKey: 'public-endpoint-share', now: '2026-08-09T12:01:00.000Z',
      });
      const response = await publicDreamRequest({
        request: new Request(
          'https://adrianrasmussen.com/api/collector/dreams/public/AR-ABCDEFGH',
        ),
        env,
        params: { publicCode: 'AR-ABCDEFGH' },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      const payload = await response.json() as any;
      assert.deepEqual(payload, {
        dream: {
          body: 'May every neighbor find a place at the table.',
          scope: 'community', visibility: 'anonymous', attribution: null,
          sharedAt: '2026-08-09T12:01:00.000Z',
        },
      });
      assert.deepEqual(Object.keys(payload.dream).sort(), [
        'attribution', 'body', 'scope', 'sharedAt', 'visibility',
      ]);
      assert.doesNotMatch(
        JSON.stringify(payload),
        /keeper|dreamId|auth-|example\.com|birth|marker|history|version|revoked|archived/i,
      );
    } finally {
      db.close();
    }
  });

  it('keeps the public dream endpoint read-only and projects closed states as null', async (t) => {
    const priorFlag = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    t.after(() => { LAUNCH_FLAGS.livingLegacy = priorFlag; });
    const db = database();
    try {
      const env = { DB: d1(db) };
      const post = await publicDreamRequest({
        request: new Request(
          'https://adrianrasmussen.com/api/collector/dreams/public/AR-ABCDEFGH',
          { method: 'POST' },
        ),
        env,
        params: { publicCode: 'AR-ABCDEFGH' },
      });
      assert.equal(post.status, 405);
      assert.equal(post.headers.get('Allow'), 'GET');

      const unknown = await publicDreamRequest({
        request: new Request(
          'https://adrianrasmussen.com/api/collector/dreams/public/AR-ZZZZZZZZ',
        ),
        env,
        params: { publicCode: 'AR-ZZZZZZZZ' },
      });
      assert.deepEqual(await unknown.json(), { dream: null });

      db.prepare("UPDATE keeper_pieces SET public_code = 'AR-BCDEFGHJ' WHERE id = 'kp-one'").run();
      const unregistered = await publicDreamRequest({
        request: new Request(
          'https://adrianrasmussen.com/api/collector/dreams/public/AR-BCDEFGHJ',
        ),
        env,
        params: { publicCode: 'AR-BCDEFGHJ' },
      });
      assert.deepEqual(await unregistered.json(), { dream: null });

      registerPublicCode(db, 'kp-next', 'AR-CDEFGHJK');
      await createCollectorDream(env, {
        userId: 'auth-next', keeperPieceId: 'kp-next', body: 'A malformed-age dream.',
        scope: 'planet', idempotencyKey: 'malformed-public-dream',
        now: '2026-08-09T12:00:00.000Z',
      });
      await setCollectorDreamSharing(env, {
        userId: 'auth-next', keeperPieceId: 'kp-next', visibility: 'anonymous',
        idempotencyKey: 'malformed-public-share', now: '2026-08-09T12:01:00.000Z',
      });
      db.prepare("UPDATE profiles SET birth_date = '1990-02-31' WHERE user_id = 3").run();
      const malformed = await publicDreamRequest({
        request: new Request(
          'https://adrianrasmussen.com/api/collector/dreams/public/AR-CDEFGHJK',
        ),
        env,
        params: { publicCode: 'AR-CDEFGHJK' },
      });
      assert.deepEqual(await malformed.json(), { dream: null });
    } finally {
      db.close();
    }
  });

  it('keeps share and revoke request meanings exact', async (t) => {
    const priorFlag = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    t.after(() => { LAUNCH_FLAGS.livingLegacy = priorFlag; });
    const env = {
      DB: {
        prepare: () => ({
          bind() { return this; },
          async first() { return null; },
        }),
      },
    };
    const call = async (action: string, visibility: string) => {
      const request = new Request('https://adrianrasmussen.com/api/collector/dreams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action, keeperPieceId: 'kp-one', visibility,
          idempotencyKey: 'exact-sharing-action',
        }),
      });
      const response = await collectorDreamRequest({ request, env });
      return { response, body: await response.json() };
    };
    const falseShare = await call('share', 'private');
    assert.equal(falseShare.response.status, 400);
    assert.deepEqual(falseShare.body, { error: 'invalid_visibility' });
    const falseRevoke = await call('revoke', 'anonymous');
    assert.equal(falseRevoke.response.status, 400);
    assert.deepEqual(falseRevoke.body, { error: 'invalid_visibility' });
  });

  it('lets the current keeper create exactly one current dream at one of the four true scopes', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      const created = await createCollectorDream(env, {
        userId: 'auth-adult',
        keeperPieceId: 'kp-one',
        body: 'May this home become a place of welcome.',
        scope: 'self',
        idempotencyKey: 'dream-create-one',
        now: '2026-08-09T12:00:00.000Z',
      });
      assert.equal(created.current?.body, 'May this home become a place of welcome.');
      assert.equal(created.current?.scope, 'self');
      assert.equal(created.current?.visibility, 'private');

      await assert.rejects(createCollectorDream(env, {
        userId: 'auth-adult',
        keeperPieceId: 'kp-one',
        body: 'A second current dream must not appear.',
        scope: 'family',
        idempotencyKey: 'dream-create-two',
        now: '2026-08-09T12:01:00.000Z',
      }), /current_dream_exists/);
      assert.equal(db.prepare(
        'SELECT COUNT(*) AS count FROM collector_dreams WHERE archived_at IS NULL',
      ).get()?.count, 1);
      for (const scope of ['self', 'family', 'community', 'planet']) {
        assert.doesNotThrow(() => db.prepare(`
          INSERT INTO collector_dreams
            (id, keeper_piece_id, author_user_id, body, scope, idempotency_key,
             created_at, updated_at, archived_at)
          VALUES (?1, 'kp-next', 'auth-next', 'A scoped dream.', ?2, ?3,
            '2026-08-09T12:02:00.000Z', '2026-08-09T12:02:00.000Z',
            '2026-08-09T12:02:01.000Z')
        `).run(`scope-${scope}`, scope, `scope-key-${scope}`));
      }
      for (const wrongScope of ['private', 'piece', 'anonymous-public', 'attributed-public']) {
        assert.throws(() => db.prepare(`
          INSERT INTO collector_dreams
            (id, keeper_piece_id, author_user_id, body, scope, idempotency_key,
             created_at, updated_at, archived_at)
          VALUES (?1, 'kp-next', 'auth-next', 'A wrongly scoped dream.', ?2, ?3,
            '2026-08-09T12:03:00.000Z', '2026-08-09T12:03:00.000Z',
            '2026-08-09T12:03:01.000Z')
        `).run(`wrong-scope-${wrongScope}`, wrongScope, `wrong-key-${wrongScope}`));
      }
    } finally {
      db.close();
    }
  });

  it('replays one create and rejects non-holder races without duplicating state', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      const input = {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'A durable welcome.',
        scope: 'family', idempotencyKey: 'dream-replay-key',
        now: '2026-08-09T12:00:00.000Z',
      } as const;
      const [first, replay] = await Promise.all([
        createCollectorDream(env, input), createCollectorDream(env, input),
      ]);
      assert.equal(first.current?.id, replay.current?.id);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM collector_dreams').get()?.count, 1);
      await assert.rejects(createCollectorDream(env, {
        ...input, userId: 'auth-next', idempotencyKey: 'dream-wrong-holder',
      }), /piece_not_held/);
    } finally {
      db.close();
    }
  });

  it('binds a create idempotency key to the exact dream request', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      const input = {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'A durable welcome.',
        scope: 'family', idempotencyKey: 'dream-create-exact',
        now: '2026-08-09T12:00:00.000Z',
      } as const;
      await createCollectorDream(env, input);
      await assert.rejects(createCollectorDream(env, {
        ...input, body: 'A changed meaning.',
      }), /idempotency_conflict/);
      await assert.rejects(createCollectorDream(env, {
        ...input, scope: 'planet',
      }), /idempotency_conflict/);
    } finally {
      db.close();
    }
  });

  it('keeps public sharing explicit and revocable while failing closed for minors and unknown ages', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      const minorPrivate = await createCollectorDream(env, {
        userId: 'auth-minor', keeperPieceId: 'kp-minor', body: 'A public wish.',
        scope: 'planet', idempotencyKey: 'minor-public-dream',
        now: '2026-08-09T12:00:00.000Z',
      });
      assert.equal(minorPrivate.current?.visibility, 'private');
      await assert.rejects(setCollectorDreamSharing(env, {
        userId: 'auth-minor', keeperPieceId: 'kp-minor', visibility: 'anonymous',
        idempotencyKey: 'minor-public-share', now: '2026-08-09T12:00:01.000Z',
      }), /minor_publicity_forbidden/);
      db.prepare('DELETE FROM profiles WHERE user_id = 3').run();
      await createCollectorDream(env, {
        userId: 'auth-next', keeperPieceId: 'kp-next', body: 'A public wish.',
        scope: 'community', idempotencyKey: 'unknown-public-dream',
        now: '2026-08-09T12:00:00.000Z',
      });
      await assert.rejects(setCollectorDreamSharing(env, {
        userId: 'auth-next', keeperPieceId: 'kp-next', visibility: 'attributed',
        idempotencyKey: 'unknown-public-share', now: '2026-08-09T12:00:01.000Z',
      }), /adult_status_required/);

      const created = await createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'May neighbors know one another.',
        scope: 'community', idempotencyKey: 'adult-public-dream',
        now: '2026-08-09T12:00:00.000Z',
      });
      assert.equal(created.current?.sharedAt, null);
      assert.equal(await getPublicCollectorDream(env, { keeperPieceId: 'kp-one' }), null);
      const shared = await setCollectorDreamSharing(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', visibility: 'anonymous',
        idempotencyKey: 'share-public-dream', now: '2026-08-09T12:01:00.000Z',
      });
      assert.equal(shared.current?.sharedAt, '2026-08-09T12:01:00.000Z');
      assert.deepEqual(await getPublicCollectorDream(env, { keeperPieceId: 'kp-one' }), {
        keeperPieceId: 'kp-one', dreamId: shared.current?.id,
        body: 'May neighbors know one another.', scope: 'community',
        visibility: 'anonymous',
        attribution: null, sharedAt: '2026-08-09T12:01:00.000Z',
      });
      const revoked = await setCollectorDreamSharing(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', visibility: 'private',
        idempotencyKey: 'revoke-public-dream', now: '2026-08-09T12:02:00.000Z',
      });
      assert.equal(revoked.current?.body, 'May neighbors know one another.');
      assert.equal(revoked.current?.revokedAt, '2026-08-09T12:02:00.000Z');
      assert.equal(await getPublicCollectorDream(env, { keeperPieceId: 'kp-one' }), null);

      await setCollectorDreamSharing(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', visibility: 'anonymous',
        idempotencyKey: 'reshare-public-dream', now: '2026-08-09T12:03:00.000Z',
      });
      db.prepare("UPDATE profiles SET birth_date = '2012-01-15' WHERE user_id = 1").run();
      assert.equal(await getPublicCollectorDream(env, { keeperPieceId: 'kp-one' }), null);
      assert.equal(db.prepare(
        "SELECT body FROM collector_dreams WHERE keeper_piece_id = 'kp-one'",
      ).get()?.body, 'May neighbors know one another.');
      assert.throws(() => db.prepare(`
        INSERT INTO collector_dream_mutations
          (id, dream_id, author_user_id, action, idempotency_key,
           request_json, resulting_version, created_at)
        SELECT 'minor-direct-share', id, 'auth-minor', 'share',
               'minor-direct-share-key', '{"visibility":"anonymous"}',
               record_version + 1, '2026-08-09T12:06:00.000Z'
          FROM collector_dreams WHERE keeper_piece_id = 'kp-minor'
      `).run(), /established adult/);
    } finally {
      db.close();
    }
  });

  it('keeps publicity closed until the keeper is an adult in their profile timezone', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      db.prepare(`
        UPDATE profiles
           SET birth_date = '2008-01-15', tz_id = 'America/Los_Angeles'
         WHERE user_id = 2
      `).run();
      await createCollectorDream(env, {
        userId: 'auth-minor', keeperPieceId: 'kp-minor', body: 'A boundary dream.',
        scope: 'self', idempotencyKey: 'timezone-boundary-dream',
        now: '2026-01-15T02:00:00.000Z',
      });
      await assert.rejects(setCollectorDreamSharing(env, {
        userId: 'auth-minor', keeperPieceId: 'kp-minor', visibility: 'anonymous',
        idempotencyKey: 'timezone-too-early', now: '2026-01-15T02:00:00.000Z',
      }), /minor_publicity_forbidden/);
      const adult = await setCollectorDreamSharing(env, {
        userId: 'auth-minor', keeperPieceId: 'kp-minor', visibility: 'anonymous',
        idempotencyKey: 'timezone-now-adult', now: '2026-01-15T20:00:00.000Z',
      });
      assert.equal(adult.current?.visibility, 'anonymous');
    } finally {
      db.close();
    }
  });

  it('allows current-dream edits and concrete append-only markers without engagement counters', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      const created = await createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'Make room for music.',
        scope: 'self', idempotencyKey: 'editable-dream', now: '2026-08-09T12:00:00.000Z',
      });
      const updated = await updateCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one',
        body: 'Make room for music and shared meals.', scope: 'family',
        expectedVersion: created.current?.version, idempotencyKey: 'edit-current-dream',
        now: '2026-08-09T12:01:00.000Z',
      });
      assert.equal(updated.current?.body, 'Make room for music and shared meals.');
      await assert.rejects(appendCollectorDreamMarker(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', kind: 'milestone', body: '   ',
        idempotencyKey: 'blank-marker-event', now: '2026-08-09T12:02:00.000Z',
      }), /invalid_marker_body/);
      const marked = await appendCollectorDreamMarker(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', kind: 'milestone',
        body: 'The first neighborhood supper happened tonight.',
        idempotencyKey: 'first-marker-event', now: '2026-08-09T12:02:00.000Z',
      });
      assert.deepEqual(marked.markers.map((marker) => marker.kind), ['milestone']);
      assert.throws(() => db.prepare(
        "UPDATE collector_dream_markers SET body = 'Rewritten'",
      ).run(), /append-only/);
      const columns = db.prepare('PRAGMA table_info(collector_dream_markers)').all()
        .map((column) => String(column.name));
      assert.equal(columns.some((column) => /count|like|support|view/i.test(column)), false);
    } finally {
      db.close();
    }
  });

  it('rolls a stale edit and its audit back together', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      await createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'Before the race.',
        scope: 'self', idempotencyKey: 'stale-edit-dream',
        now: '2026-08-09T12:00:00.000Z',
      });
      await updateCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'The racing winner.',
        scope: 'self', expectedVersion: 1, idempotencyKey: 'winning-edit-attempt',
        now: '2026-08-09T12:00:30.000Z',
      });
      await assert.rejects(updateCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'After the stale write.',
        scope: 'family', expectedVersion: 1, idempotencyKey: 'stale-edit-attempt',
        now: '2026-08-09T12:01:00.000Z',
      }), /version_conflict|dream mutation did not apply/);
      assert.equal(db.prepare(
        "SELECT COUNT(*) AS count FROM collector_dream_mutations WHERE idempotency_key = 'stale-edit-attempt'",
      ).get()?.count, 0);
      assert.equal(db.prepare(
        "SELECT body FROM collector_dreams WHERE keeper_piece_id = 'kp-one'",
      ).get()?.body, 'The racing winner.');
    } finally {
      db.close();
    }
  });

  it('rejects an edit audit that hides a change to an unrelated dream field', () => {
    const db = database();
    try {
      db.prepare(`
        INSERT INTO collector_dreams
          (id, keeper_piece_id, author_user_id, body, scope, idempotency_key,
           created_at, updated_at)
        VALUES ('combined-dream', 'kp-one', 'auth-adult', 'Before.', 'self',
          'combined-create-key', '2026-08-09T12:00:00.000Z',
          '2026-08-09T12:00:00.000Z')
      `).run();
      assert.throws(() => {
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare(`
            UPDATE collector_dreams
               SET body = 'After.', scope = 'family',
                   fulfilled_at = '2026-08-09T12:01:00.000Z',
                   updated_at = '2026-08-09T12:01:00.000Z', record_version = 2,
                   last_mutation_id = 'combined-hidden-mutation'
             WHERE id = 'combined-dream'
          `).run();
          db.prepare(`
            INSERT INTO collector_dream_mutations
              (id, dream_id, author_user_id, action, idempotency_key,
               request_json, resulting_version, created_at)
            VALUES ('combined-hidden-mutation', 'combined-dream', 'auth-adult',
              'edit', 'combined-hidden-key',
              '{"body":"After.","scope":"family","expectedVersion":1}',
              2, '2026-08-09T12:01:00.000Z')
          `).run();
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      }, /dream mutation did not apply exactly|dream update requires exact authorization/);
      const restored = db.prepare(`
        SELECT body, scope, fulfilled_at, record_version
          FROM collector_dreams WHERE id = 'combined-dream'
      `).get();
      assert.deepEqual({ ...restored }, {
        body: 'Before.', scope: 'self', fulfilled_at: null, record_version: 1,
      });
    } finally {
      db.close();
    }
  });

  it('rejects a body change smuggled under a valid share audit', () => {
    const db = database();
    try {
      db.prepare(`
        INSERT INTO collector_dreams
          (id, keeper_piece_id, author_user_id, body, scope, idempotency_key,
           created_at, updated_at)
        VALUES ('share-smuggle-dream', 'kp-one', 'auth-adult', 'Before.', 'self',
          'share-smuggle-create', '2026-08-09T12:00:00.000Z',
          '2026-08-09T12:00:00.000Z')
      `).run();
      assert.throws(() => {
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare("UPDATE collector_dreams SET body = 'Smuggled.' WHERE id = 'share-smuggle-dream'").run();
          db.prepare(`
            INSERT INTO collector_dream_mutations
              (id, dream_id, author_user_id, action, idempotency_key,
               request_json, resulting_version, created_at)
            VALUES ('share-smuggle-mutation', 'share-smuggle-dream', 'auth-adult',
              'share', 'share-smuggle-key', '{"visibility":"anonymous"}',
              2, '2026-08-09T12:01:00.000Z')
          `).run();
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      }, /dream update requires exact authorization/);
      assert.equal(db.prepare(
        "SELECT body FROM collector_dreams WHERE id = 'share-smuggle-dream'",
      ).get()?.body, 'Before.');
    } finally {
      db.close();
    }
  });

  it('rejects fulfillment and visibility smuggled under a valid edit audit', () => {
    const db = database();
    try {
      db.prepare(`
        INSERT INTO collector_dreams
          (id, keeper_piece_id, author_user_id, body, scope, idempotency_key,
           created_at, updated_at)
        VALUES ('edit-smuggle-dream', 'kp-one', 'auth-adult', 'Before.', 'self',
          'edit-smuggle-create', '2026-08-09T12:00:00.000Z',
          '2026-08-09T12:00:00.000Z')
      `).run();
      assert.throws(() => {
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare(`
            UPDATE collector_dreams
               SET fulfilled_at = '2026-08-09T12:00:30.000Z',
                   visibility = 'anonymous'
             WHERE id = 'edit-smuggle-dream'
          `).run();
          db.prepare(`
            INSERT INTO collector_dream_mutations
              (id, dream_id, author_user_id, action, idempotency_key,
               request_json, resulting_version, created_at)
            VALUES ('edit-smuggle-mutation', 'edit-smuggle-dream', 'auth-adult',
              'edit', 'edit-smuggle-key',
              '{"body":"After.","scope":"family","expectedVersion":1}',
              2, '2026-08-09T12:01:00.000Z')
          `).run();
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      }, /dream update requires exact authorization/);
      const restored = db.prepare(`
        SELECT fulfilled_at, visibility
          FROM collector_dreams WHERE id = 'edit-smuggle-dream'
      `).get();
      assert.deepEqual({ ...restored }, { fulfilled_at: null, visibility: 'private' });
    } finally {
      db.close();
    }
  });

  it('binds edit and share idempotency keys to their exact semantic requests', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      const created = await createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'Original meaning.',
        scope: 'self', idempotencyKey: 'semantic-dream-create',
        now: '2026-08-09T12:00:00.000Z',
      });
      const edit = {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'Edited meaning.',
        scope: 'family', expectedVersion: created.current?.version,
        idempotencyKey: 'semantic-edit-key', now: '2026-08-09T12:01:00.000Z',
      } as const;
      await updateCollectorDream(env, edit);
      await assert.rejects(updateCollectorDream(env, {
        ...edit, body: 'A different edit.',
      }), /idempotency_conflict/);

      const share = {
        userId: 'auth-adult', keeperPieceId: 'kp-one', visibility: 'anonymous',
        idempotencyKey: 'semantic-share-key', now: '2026-08-09T12:02:00.000Z',
      } as const;
      await setCollectorDreamSharing(env, share);
      grantNameConsent(db);
      await assert.rejects(setCollectorDreamSharing(env, {
        ...share, visibility: 'attributed',
      }), /idempotency_conflict/);
    } finally {
      db.close();
    }
  });

  it('requires an active non-retired keeper relationship in application and database guards', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      db.prepare("UPDATE keeper_pieces SET released_at = '2026-08-09T12:00:00.000Z' WHERE id = 'kp-one'").run();
      await assert.rejects(createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'Not actively held.',
        scope: 'self', idempotencyKey: 'released-piece-dream',
        now: '2026-08-09T12:01:00.000Z',
      }), /piece_not_held/);
      assert.throws(() => db.prepare(`
        INSERT INTO collector_dreams
          (id, keeper_piece_id, author_user_id, body, scope, idempotency_key,
           created_at, updated_at)
        VALUES ('inactive-direct-dream', 'kp-one', 'auth-adult', 'Bypassed app.',
          'self', 'inactive-direct-key', '2026-08-09T12:01:00.000Z',
          '2026-08-09T12:01:00.000Z')
      `).run(), /current keeper/);

      db.prepare(`
        UPDATE keeper_pieces
           SET released_at = NULL, plate_status = 'void',
               physical_disposition = 'Retired test plate.'
         WHERE id = 'kp-one'
      `).run();
      await assert.rejects(createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'Retired identity.',
        scope: 'self', idempotencyKey: 'retired-piece-dream',
        now: '2026-08-09T12:02:00.000Z',
      }), /piece_not_held/);
      assert.throws(() => db.prepare(`
        INSERT INTO collector_dreams
          (id, keeper_piece_id, author_user_id, body, scope, idempotency_key,
           created_at, updated_at)
        VALUES ('retired-direct-dream', 'kp-one', 'auth-adult', 'Bypassed app.',
          'self', 'retired-direct-key', '2026-08-09T12:02:00.000Z',
          '2026-08-09T12:02:00.000Z')
      `).run(), /current keeper/);
    } finally {
      db.close();
    }
  });

  it('projects attributed sharing as the verified name without private account fields', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      await createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'A generous public table.',
        scope: 'community', idempotencyKey: 'attributed-dream',
        now: '2026-08-09T12:00:00.000Z',
      });
      grantNameConsent(db);
      await setCollectorDreamSharing(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', visibility: 'attributed',
        idempotencyKey: 'attributed-share', now: '2026-08-09T12:01:00.000Z',
      });
      const projected = await getPublicCollectorDream(env, { keeperPieceId: 'kp-one' });
      assert.equal(projected?.attribution, 'Adult Keeper');
      assert.doesNotMatch(JSON.stringify(projected), /adult@example|auth-adult|birth/i);
    } finally {
      db.close();
    }
  });

  it('requires current Ring 4 name consent for attribution and closes it on revocation', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      await createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'Consent follows the name.',
        scope: 'community', idempotencyKey: 'consent-dream',
        now: '2026-08-09T12:00:00.000Z',
      });
      assert.throws(() => db.prepare(`
        INSERT INTO collector_dream_mutations
          (id, dream_id, author_user_id, action, idempotency_key,
           request_json, resulting_version, created_at)
        SELECT 'name-direct-share', id, 'auth-adult', 'share',
               'name-direct-share-key', '{"visibility":"attributed"}',
               record_version + 1, '2026-08-09T12:00:30.000Z'
          FROM collector_dreams WHERE keeper_piece_id = 'kp-one'
      `).run(), /name consent/);
      await assert.rejects(setCollectorDreamSharing(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', visibility: 'attributed',
        idempotencyKey: 'attribution-without-name', now: '2026-08-09T12:01:00.000Z',
      }), /name_consent_required/);

      grantNameConsent(db);
      await setCollectorDreamSharing(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', visibility: 'attributed',
        idempotencyKey: 'attribution-with-name', now: '2026-08-09T12:02:00.000Z',
      });
      assert.equal((await getPublicCollectorDream(env, {
        keeperPieceId: 'kp-one', now: '2026-08-09T12:03:00.000Z',
      }))?.attribution, 'Adult Keeper');

      db.prepare(`
        UPDATE collector_person_privacy
           SET share_name = 0, updated_at = '2026-08-09T12:04:00.000Z'
         WHERE user_id = 1
      `).run();
      assert.equal(await getPublicCollectorDream(env, {
        keeperPieceId: 'kp-one', now: '2026-08-09T12:05:00.000Z',
      }), null);

      await setCollectorDreamSharing(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', visibility: 'anonymous',
        idempotencyKey: 'anonymous-without-name', now: '2026-08-09T12:06:00.000Z',
      });
      assert.equal((await getPublicCollectorDream(env, {
        keeperPieceId: 'kp-one', now: '2026-08-09T12:07:00.000Z',
      }))?.visibility, 'anonymous');
    } finally {
      db.close();
    }
  });

  it('never lets identity retirement block an attributed-name revocation', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      await createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'A revocable name.',
        scope: 'self', idempotencyKey: 'retired-consent-dream',
        now: '2026-08-09T12:00:00.000Z',
      });
      grantNameConsent(db);
      await setCollectorDreamSharing(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', visibility: 'attributed',
        idempotencyKey: 'retired-consent-share', now: '2026-08-09T12:01:00.000Z',
      });
      db.prepare(`
        UPDATE keeper_pieces
           SET plate_status = 'void', physical_disposition = 'Retired test plate.'
         WHERE id = 'kp-one'
      `).run();
      assert.doesNotThrow(() => db.prepare(`
        UPDATE collector_person_privacy
           SET share_name = 0, updated_at = '2026-08-09T12:02:00.000Z'
         WHERE user_id = 1
      `).run());
      assert.equal(db.prepare(`
        SELECT visibility FROM collector_dreams WHERE keeper_piece_id = 'kp-one'
      `).get()?.visibility, 'private');
    } finally {
      db.close();
    }
  });

  it('archives and closes sharing on transfer while keeping the prior author powerless', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      await createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'A shared garden.',
        scope: 'planet', idempotencyKey: 'travel-dream',
        now: '2026-08-09T12:00:00.000Z',
      });
      await setCollectorDreamSharing(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', visibility: 'anonymous',
        idempotencyKey: 'travel-share', now: '2026-08-09T12:01:00.000Z',
      });
      canonicalTransfer(db);
      assert.equal(await getPublicCollectorDream(env, { keeperPieceId: 'kp-one' }), null);
      await assert.rejects(updateCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'Old author rewrite.',
        scope: 'self', expectedVersion: 3, idempotencyKey: 'old-author-edit',
        now: '2026-08-10T01:00:00.000Z',
      }), /piece_not_held/);
      const inherited = await getCollectorDreamState(env, {
        userId: 'auth-next', keeperPieceId: 'kp-one',
      });
      assert.equal(inherited.current, null);
      assert.equal(inherited.history[0]?.body, 'A shared garden.');
      assert.equal(inherited.history[0]?.revokedAt, '2026-08-10T00:00:00.000Z');
    } finally {
      db.close();
    }
  });

  it('offers one nonblank birthday ritual with exactly three actions', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      await createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'Keep the table open.',
        scope: 'self', idempotencyKey: 'ritual-current-dream',
        now: '2026-01-01T00:00:00.000Z',
      });
      const due = await getYearlyRitualEligibility(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', now: '2026-01-15T12:00:00.000Z',
      });
      assert.equal(due.eligible, true);
      assert.deepEqual(due.actions, ['reinforce', 'plant-new', 'fulfilled']);
      assert.equal(due.currentDream?.body, 'Keep the table open.');
      const complete = await completeYearlyRitual(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', action: 'reinforce',
        idempotencyKey: 'ritual-reinforce-2026', now: '2026-01-15T12:01:00.000Z',
      });
      assert.equal(complete.eligibility.eligible, false);
      assert.equal(complete.state.current?.body, 'Keep the table open.');
      const replay = await completeYearlyRitual(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', action: 'reinforce',
        idempotencyKey: 'ritual-reinforce-2026', now: '2026-01-15T12:02:00.000Z',
      });
      assert.equal(replay.ritual.id, complete.ritual.id);
      await assert.rejects(completeYearlyRitual(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', action: 'fulfilled',
        idempotencyKey: 'ritual-second-2026', now: '2026-01-15T12:03:00.000Z',
      }), /ritual_already_completed/);
    } finally {
      db.close();
    }
  });

  it('plants a new dream atomically and rejects a blank replacement', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      await createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'The first chapter.',
        scope: 'self', idempotencyKey: 'plant-prior-dream',
        now: '2025-01-01T00:00:00.000Z',
      });
      await assert.rejects(completeYearlyRitual(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', action: 'plant-new', body: ' ',
        scope: 'self', idempotencyKey: 'blank-plant-ritual',
        now: '2026-01-15T12:00:00.000Z',
      }), /invalid_dream_body/);
      const planted = await completeYearlyRitual(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', action: 'plant-new',
        body: 'The next chapter.', scope: 'planet',
        idempotencyKey: 'plant-ritual-2026', now: '2026-01-15T12:01:00.000Z',
      });
      assert.equal(planted.state.current?.body, 'The next chapter.');
      assert.equal(planted.state.current?.sharedAt, null);
      assert.equal(planted.state.history[0]?.body, 'The first chapter.');

      await assert.rejects(completeYearlyRitual(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', action: 'plant-new',
        body: 'A changed replay.', scope: 'community',
        idempotencyKey: 'plant-ritual-2026', now: '2026-01-15T12:02:00.000Z',
      }), /idempotency_conflict/);

      const fulfilled = await completeYearlyRitual(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', action: 'fulfilled',
        idempotencyKey: 'fulfilled-ritual-2027', now: '2027-01-15T12:01:00.000Z',
      });
      assert.equal(fulfilled.state.current?.fulfilledAt, '2027-01-15T12:01:00.000Z');
    } finally {
      db.close();
    }
  });

  it('returns ineligible without a current birth profile or outside the birthday window', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      await createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'A resting dream.',
        scope: 'self', idempotencyKey: 'ineligible-dream',
        now: '2026-02-01T00:00:00.000Z',
      });
      assert.equal((await getYearlyRitualEligibility(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', now: '2026-08-09T12:00:00.000Z',
      })).eligible, false);
      db.prepare("UPDATE profiles SET birth_date = '1982-02-31' WHERE user_id = 1").run();
      assert.deepEqual(await getYearlyRitualEligibility(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', now: '2026-02-28T12:00:00.000Z',
      }), {
        eligible: false, reason: 'birth_profile_invalid', birthdayYear: null,
        actions: [], currentDream: null,
      });
      db.prepare('DELETE FROM profiles WHERE user_id = 1').run();
      const missing = await getYearlyRitualEligibility(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', now: '2026-01-15T12:00:00.000Z',
      });
      assert.deepEqual(missing, {
        eligible: false, reason: 'birth_profile_missing', birthdayYear: null,
        actions: [], currentDream: null,
      });
    } finally {
      db.close();
    }
  });

  it('lets only one of two simultaneous yearly choices complete for a birthday year', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      await createCollectorDream(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-one', body: 'One current dream.',
        scope: 'self', idempotencyKey: 'ritual-race-dream',
        now: '2026-01-01T00:00:00.000Z',
      });
      const results = await Promise.allSettled([
        completeYearlyRitual(env, {
          userId: 'auth-adult', keeperPieceId: 'kp-one', action: 'reinforce',
          idempotencyKey: 'ritual-race-one', now: '2026-01-15T12:00:00.000Z',
        }),
        completeYearlyRitual(env, {
          userId: 'auth-adult', keeperPieceId: 'kp-one', action: 'reinforce',
          idempotencyKey: 'ritual-race-two', now: '2026-01-15T12:00:00.000Z',
        }),
      ]);
      assert.deepEqual(results.map((result) => result.status).sort(), ['fulfilled', 'rejected']);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM collector_dream_rituals').get()?.count, 1);
      assert.throws(() => db.prepare('DELETE FROM collector_dream_rituals').run(), /append-only/);
    } finally {
      db.close();
    }
  });

  it('keeps all dream words outside permanent lineage and hash payloads', () => {
    const implementation = readFileSync(
      new URL('../functions/api/_lib/collectorDreams.js', import.meta.url), 'utf8',
    );
    const schema = readMigration('029_collector_dreams.sql');
    assert.doesNotMatch(`${implementation}\n${schema}`, /artwork_lineage|public_payload|R2/i);
    assert.doesNotMatch(`${implementation}\n${schema}`, /support_count|view_count|like_count/i);
  });
});
