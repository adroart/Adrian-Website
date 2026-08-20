import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, describe, it, mock } from 'node:test';

import {
  generateCollectorLetters,
  getCollectorLetters,
  runCollectorLetterEvents,
  syncFirstBindCollectorLetters,
} from '../functions/api/_lib/collectorLetters.js';
import {
  parseCollectorLetters,
} from '../utils/collectorLetters.ts';
import { LAUNCH_FLAGS } from '../launchFlags.ts';

mock.module('../functions/api/_lib/auth.js', {
  namedExports: {
    requireUser: async (request: Request) => {
      const userId = request.headers.get('X-Test-User');
      return userId
        ? { userId }
        : new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
    },
    jsonResponse: (body: unknown, init: ResponseInit = {}) => new Response(
      JSON.stringify(body),
      {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...(init.headers ?? {}),
        },
      },
    ),
  },
});

after(() => mock.reset());

const readMigration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);

const migrationsThroughLetters = [
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
  '030_collector_field.sql', '031_collector_letters.sql',
  '035_city_floor_removal.sql',
].map(readMigration).join('\n');

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

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    ${migrationsThroughLetters}
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES
      ('auth-source', 'Source Keeper', 'source@example.com', 1, 1, 1),
      ('auth-recipient', 'Recipient Keeper', 'recipient@example.com', 1, 1, 1),
      ('auth-sibling', 'Sibling Keeper', 'sibling@example.com', 1, 1, 1),
      ('auth-private', 'Private Keeper', 'private@example.com', 1, 1, 1),
      ('auth-next', 'Next Keeper', 'next@example.com', 1, 1, 1),
      ('auth-current', 'Current Keeper', 'current@example.com', 1, 1, 1);
    INSERT INTO users (auth_user_id, clerk_user_id, email)
    VALUES
      ('auth-source', 'auth-source', 'source@example.com'),
      ('auth-recipient', 'auth-recipient', 'recipient@example.com'),
      ('auth-sibling', 'auth-sibling', 'sibling@example.com'),
      ('auth-private', 'auth-private', 'private@example.com'),
      ('auth-next', 'auth-next', 'next@example.com'),
      ('auth-current', 'auth-current', 'current@example.com');
    INSERT INTO profiles
      (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id, computed_json)
    SELECT id, '1980-01-15', '12:00', 'Private birthplace', 0, 0, 'UTC', '{}'
      FROM users;
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       claimed_at, registered_at)
    VALUES
      ('kp-source', 'UL-100', 1, 'auth-source', '${'a'.repeat(64)}',
       '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
      ('kp-source-private', 'UL-102', 0, 'auth-source', '${'b'.repeat(64)}',
       '2026-08-02T00:00:00.000Z', '2026-08-02T00:00:00.000Z'),
      ('kp-recipient', 'UL-110', 0, 'auth-recipient', '${'c'.repeat(64)}',
       '2025-08-01T00:00:00.000Z', '2025-08-01T00:00:00.000Z'),
      ('kp-sibling', 'UL-100', 2, 'auth-sibling', '${'d'.repeat(64)}',
       '2025-08-01T00:00:00.000Z', '2025-08-01T00:00:00.000Z'),
      ('kp-private', 'UL-107', 0, 'auth-private', '${'e'.repeat(64)}',
       '2025-08-01T00:00:00.000Z', '2025-08-01T00:00:00.000Z'),
      ('kp-anniversary', 'SIG-200', 0, 'auth-source', '${'f'.repeat(64)}',
       '2024-08-10T00:00:00.000Z', '2024-08-10T00:00:00.000Z'),
      ('kp-transfer', 'SIG-201', 0, 'auth-source', '${'1'.repeat(64)}',
       '2024-08-10T00:00:00.000Z', '2024-08-10T00:00:00.000Z');
    INSERT INTO collector_curated_cities (id, label, population, active)
    VALUES ('denpasar-id', 'Denpasar, Indonesia', 725000, 1);
    INSERT INTO collector_piece_privacy
      (keeper_piece_id, user_id, share_city, city_id, policy_version, updated_at)
    VALUES
      ('kp-source', 1, 1, 'denpasar-id', 'collector-privacy-v1', '2026-08-09T00:00:00.000Z'),
      ('kp-anniversary', 1, 1, 'denpasar-id', 'collector-privacy-v1', '2026-08-09T00:00:00.000Z');
    INSERT INTO collector_person_privacy
      (user_id, share_derived_chart, share_face, share_name, share_intention,
       share_business, share_mission, policy_version, updated_at)
    VALUES
      (2, 1, 0, 0, 0, 0, 0, 'collector-privacy-v1', '2026-08-09T00:00:00.000Z'),
      (3, 1, 0, 0, 0, 0, 0, 'collector-privacy-v1', '2026-08-09T00:00:00.000Z'),
      (4, 0, 0, 0, 0, 0, 0, 'collector-privacy-v1', '2026-08-09T00:00:00.000Z');
    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json)
    VALUES
      ('source-first-bound', 'kp-source', 1, 'first_bound', '2026-08-01T00:00:00.000Z',
       NULL, '${'2'.repeat(64)}', '{"editionNumber":1,"pieceId":"UL-100"}'),
      ('source-private-first-bound', 'kp-source-private', 1, 'first_bound', '2026-08-02T00:00:00.000Z',
       NULL, '${'3'.repeat(64)}', '{"editionNumber":0,"pieceId":"UL-102"}');
  `);
  return db;
}

function seedTransfer(db: DatabaseSync, details: {
  id: string;
  sequence: number;
  from: string;
  to: string;
  at: string;
  hash: string;
  previousHash: string | null;
}) {
  const fromRef = `tp-00000000-0000-4000-8000-${String(details.sequence * 2 - 1).padStart(12, '0')}`;
  const toRef = `tp-00000000-0000-4000-8000-${String(details.sequence * 2).padStart(12, '0')}`;
  const beforeJson = JSON.stringify({
    keeperUserId: details.from,
    claimedAt: details.sequence === 1
      ? '2024-08-10T00:00:00.000Z'
      : '2025-08-10T00:00:00.000Z',
    releasedAt: null,
    currentDisplayLocation: null,
    stewardVersion: details.sequence - 1,
  });
  const afterJson = JSON.stringify({
    keeperUserId: details.to,
    claimedAt: details.at,
    releasedAt: null,
    currentDisplayLocation: null,
    stewardVersion: details.sequence,
  });
  db.prepare(`
    INSERT INTO registry_maintenance_events
      (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
       administrator_user_id, administrator_email, reason, before_json,
       after_json, outcome, related_record_id, mutation_fingerprint, created_at)
    VALUES (?1, ?1, 'steward_transferred', 'kp-transfer', 'SIG-201',
      'admin', 'admin@example.com', 'Transfer stewardship safely.', ?2, ?3,
      'succeeded', 'kp-transfer', ?4, ?5)
  `).run(`maintenance-${details.id}`, beforeJson, afterJson, '8'.repeat(64), details.at);
  db.prepare(`
    INSERT INTO artwork_transfer_intents
      (id, keeper_piece_id, expected_from_user_id, target_user_id,
       target_email_commitment, expected_steward_version, expected_lineage_count,
       expected_lineage_hash, transfer_kind, maintenance_event_id,
       lineage_event_id, created_at)
    VALUES (?1, 'kp-transfer', ?2, ?3, ?4, ?5, ?6, ?7, 'gift', ?8, ?9, ?10)
  `).run(
    details.id, details.from, details.to, '4'.repeat(64),
    details.sequence - 1, details.sequence - 1, details.previousHash,
    `maintenance-${details.id}`, `lineage-${details.id}`, details.at,
  );
  db.prepare(`
    INSERT INTO artwork_transfer_parties
      (id, transfer_intent_id, party_role, user_id, public_ref, created_at)
    VALUES
      (?1, ?2, 'from', ?3, ?4, ?5),
      (?6, ?2, 'to', ?7, ?8, ?5)
  `).run(
    `party-from-${details.id}`, details.id, details.from, fromRef, details.at,
    `party-to-${details.id}`, details.to, toRef,
  );
  db.prepare(`
    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json)
    VALUES (?1, 'kp-transfer', ?2, 'transferred', ?3, ?4, ?5, ?6)
  `).run(
    `lineage-${details.id}`, details.sequence, details.at, details.previousHash,
    details.hash, JSON.stringify({ fromRef, toRef, transferKind: 'gift' }),
  );
  db.prepare(`
    INSERT INTO artwork_transfer_receipts (id, transfer_intent_id, committed_at)
    VALUES (?1, ?2, ?3)
  `).run(`receipt-${details.id}`, details.id, details.at);
}

describe('collector letters', () => {
  it('applies every migration through 031 plus 035 on real SQLite', () => {
    const db = database();
    try {
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
      assert.ok(db.prepare(`
        SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'collector_letters'
      `).get());
    } finally {
      db.close();
    }
  });

  it('writes one deterministic kin letter only to a different consented physical piece', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      const input = {
        kind: 'kin-claim', keeperPieceId: 'kp-source',
        now: '2026-08-10T00:00:00.000Z',
      };
      const first = await generateCollectorLetters(env, input);
      const replay = await generateCollectorLetters(env, input);

      assert.deepEqual(replay, first);
      assert.equal(first.length, 1);
      assert.match(first[0].body, /Thunder trigram/);
      assert.match(first[0].body, /Denpasar, Indonesia/);
      assert.match(first[0].body, /Founding Light 1/);
      assert.doesNotMatch(first[0].body, /auth-|kp-|@|example\.com|Source Keeper|Recipient Keeper/);
      const stored = db.prepare(`
        SELECT keeper_piece_id, kind FROM collector_letters ORDER BY keeper_piece_id
      `).all();
      assert.deepEqual(stored.map((row) => ({ ...row })), [
        { keeper_piece_id: 'kp-recipient', kind: 'kin-claim' },
      ]);
      assert.equal(db.prepare(
        `SELECT COUNT(*) AS count FROM artwork_lineage_events`,
      ).get()?.count, 2);
    } finally {
      db.close();
    }
  });

  it('uses current Ring 2 source visibility and current Ring 3 recipient consent', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      const input = {
        kind: 'kin-claim', keeperPieceId: 'kp-source-private',
        now: '2026-08-10T00:00:00.000Z',
      };
      assert.deepEqual(await generateCollectorLetters(env, input), []);

      db.exec(`
        INSERT INTO collector_piece_privacy
          (keeper_piece_id, user_id, share_city, city_id, policy_version, updated_at)
        VALUES ('kp-source-private', 1, 1, 'denpasar-id',
          'collector-privacy-v1', '2026-08-10T00:01:00.000Z');
        UPDATE collector_person_privacy
           SET share_derived_chart = 0, updated_at = '2026-08-10T00:01:00.000Z'
         WHERE user_id IN (2, 3);
      `);
      assert.deepEqual(await generateCollectorLetters(env, input), []);

      db.exec(`
        UPDATE collector_person_privacy
           SET share_derived_chart = 1, updated_at = '2026-08-10T00:02:00.000Z'
         WHERE user_id = 2;
      `);
      const visible = await generateCollectorLetters(env, input);
      assert.equal(visible.length, 1);
      assert.match(visible[0].body, /Denpasar, Indonesia/);
    } finally {
      db.close();
    }
  });

  it('uses only an active pinned city and positive current adult evidence', async () => {
    const publishSource = (db: DatabaseSync) => db.exec(`
      INSERT INTO collector_piece_privacy
        (keeper_piece_id, user_id, share_city, city_id, policy_version, updated_at)
      VALUES ('kp-source-private', 1, 1, 'denpasar-id',
        'collector-privacy-v1', '2026-08-10T00:00:00.000Z');
      UPDATE collector_person_privacy
         SET share_derived_chart = 0, updated_at = '2026-08-10T00:00:00.000Z'
       WHERE user_id = 3;
    `);

    const drifted = database();
    try {
      publishSource(drifted);
      drifted.exec(`
        UPDATE collector_curated_cities
           SET label = 'Mutable database label'
         WHERE id = 'denpasar-id';
      `);
      const letters = await generateCollectorLetters({ DB: d1(drifted) }, {
        kind: 'kin-claim', keeperPieceId: 'kp-source-private',
        now: '2026-08-10T00:00:00.000Z',
      });
      assert.equal(letters.length, 1);
      assert.match(letters[0].body, /Denpasar, Indonesia/);
      assert.doesNotMatch(letters[0].body, /Mutable database label/);
    } finally {
      drifted.close();
    }

    // Population no longer gates anything (floor removed 2026-08-20): a small
    // curated city still produces kin letters.
    const lowPopulation = database();
    try {
      publishSource(lowPopulation);
      lowPopulation.exec(`
        UPDATE collector_curated_cities
           SET population = 49999
         WHERE id = 'denpasar-id';
      `);
      const lowPopulationLetters = await generateCollectorLetters({ DB: d1(lowPopulation) }, {
        kind: 'kin-claim', keeperPieceId: 'kp-source-private',
        now: '2026-08-10T00:00:00.000Z',
      });
      assert.equal(lowPopulationLetters.length, 1);
      assert.match(lowPopulationLetters[0].body, /Denpasar, Indonesia/);
    } finally {
      lowPopulation.close();
    }

    const noAdultEvidence = database();
    try {
      publishSource(noAdultEvidence);
      noAdultEvidence.exec(`
        UPDATE profiles SET birth_date = '2012-01-15' WHERE user_id = 2;
        DROP TRIGGER collector_adult_person_privacy_update_guard;
        UPDATE collector_person_privacy
           SET share_derived_chart = 1
         WHERE user_id = 2;
      `);
      assert.deepEqual(await generateCollectorLetters({ DB: d1(noAdultEvidence) }, {
        kind: 'kin-claim', keeperPieceId: 'kp-source-private',
        now: '2026-08-10T00:00:00.000Z',
      }), []);
    } finally {
      noAdultEvidence.close();
    }

    const noAdultSource = database();
    try {
      publishSource(noAdultSource);
      noAdultSource.exec(`
        UPDATE profiles SET birth_date = '2012-01-15' WHERE user_id = 1;
        DROP TRIGGER collector_adult_piece_privacy_update_guard;
        UPDATE collector_piece_privacy
           SET share_city = 1, city_id = 'denpasar-id'
         WHERE keeper_piece_id = 'kp-source-private';
      `);
      assert.deepEqual(await generateCollectorLetters({ DB: d1(noAdultSource) }, {
        kind: 'kin-claim', keeperPieceId: 'kp-source-private',
        now: '2026-08-10T00:00:00.000Z',
      }), []);
    } finally {
      noAdultSource.close();
    }
  });

  it('includes an anniversary city only while Ring 2 is currently public', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      const first = await generateCollectorLetters(env, {
        kind: 'anniversary', keeperPieceId: 'kp-anniversary',
        now: '2025-08-10T00:00:00.000Z',
      });
      assert.equal(first.length, 1);
      assert.match(first[0].body, /Denpasar, Indonesia/);
      assert.deepEqual(await generateCollectorLetters(env, {
        kind: 'anniversary', keeperPieceId: 'kp-anniversary',
        now: '2025-08-10T12:00:00.000Z',
      }), first);

      db.exec(`
        UPDATE collector_piece_privacy
           SET share_city = 0, city_id = NULL,
               updated_at = '2026-08-10T00:00:00.000Z'
         WHERE keeper_piece_id = 'kp-anniversary';
      `);
      const second = await generateCollectorLetters(env, {
        kind: 'anniversary', keeperPieceId: 'kp-anniversary',
        now: '2026-08-10T00:00:00.000Z',
      });
      assert.equal(second.length, 1);
      assert.doesNotMatch(second[0].body, /Denpasar|Indonesia/);

      db.exec(`
        UPDATE keeper_pieces
           SET released_at = '2026-08-11T00:00:00.000Z'
         WHERE id = 'kp-anniversary';
      `);
      await assert.rejects(generateCollectorLetters(env, {
        kind: 'anniversary', keeperPieceId: 'kp-anniversary',
        now: '2027-08-10T00:00:00.000Z',
      }), /piece_not_active/);
    } finally {
      db.close();
    }
  });

  it('keeps generic transfer letters across the piece transfer history', async () => {
    const db = database();
    try {
      seedTransfer(db, {
        id: 'transfer-one', sequence: 1, from: 'auth-source', to: 'auth-next',
        at: '2025-08-10T00:00:00.000Z', hash: '5'.repeat(64), previousHash: null,
      });
      seedTransfer(db, {
        id: 'transfer-two', sequence: 2, from: 'auth-next', to: 'auth-current',
        at: '2026-08-09T00:00:00.000Z', hash: '6'.repeat(64), previousHash: '5'.repeat(64),
      });
      const env = { DB: d1(db) };
      const first = await generateCollectorLetters(env, {
        kind: 'transfer', transferIntentId: 'transfer-one',
        now: '2025-08-10T00:00:00.000Z',
      });
      const second = await generateCollectorLetters(env, {
        kind: 'transfer', transferIntentId: 'transfer-two',
        now: '2026-08-09T00:00:00.000Z',
      });
      assert.equal(first.length, 1);
      assert.equal(second.length, 1);
      for (const letter of [...first, ...second]) {
        assert.doesNotMatch(letter.body, /auth-|kp-|transfer-|@|Denpasar|Source|Next|Current/);
      }

      const current = await getCollectorLetters(env, {
        userId: 'auth-current', keeperPieceId: 'kp-transfer',
      });
      assert.equal(current.length, 2);
      await assert.rejects(getCollectorLetters(env, {
        userId: 'auth-next', keeperPieceId: 'kp-transfer',
      }), /piece_not_held/);
      db.exec(`
        UPDATE keeper_pieces
           SET keeper_user_id = 'auth-current',
               released_at = '2026-08-10T00:00:00.000Z'
         WHERE id = 'kp-transfer';
      `);
      await assert.rejects(getCollectorLetters(env, {
        userId: 'auth-current', keeperPieceId: 'kp-transfer',
      }), /piece_not_held/);
    } finally {
      db.close();
    }
  });

  it('keeps bodies append-only, rejects unsafe direct bodies, and exposes only safe fields', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      await generateCollectorLetters(env, {
        kind: 'anniversary', keeperPieceId: 'kp-anniversary',
        now: '2025-08-10T00:00:00.000Z',
      });
      assert.throws(() => db.exec(
        `UPDATE collector_letters SET body = 'Changed.'`,
      ), /append-only/);
      assert.throws(() => db.exec(
        `DELETE FROM collector_letters`,
      ), /append-only/);
      assert.throws(() => db.prepare(`
        INSERT INTO collector_letters
          (id, keeper_piece_id, kind, body, created_at, event_key)
        VALUES (?1, 'kp-anniversary', 'anniversary', ?2,
          '2026-08-10T00:00:00.000Z', 'anniversary:tamper')
      `).run(`letter-${'7'.repeat(64)}`, 'Write to person@example.com about auth-secret.'), /constraint/i);

      const letters = await getCollectorLetters(env, {
        userId: 'auth-source', keeperPieceId: 'kp-anniversary',
      });
      assert.deepEqual(Object.keys(letters[0]).sort(), ['body', 'createdAt', 'id', 'kind']);
      assert.deepEqual(parseCollectorLetters({ letters }), letters);
      assert.throws(() => parseCollectorLetters({
        letters: [{ ...letters[0], keeperPieceId: 'kp-anniversary' }],
      }), /collector_letters_invalid/);
    } finally {
      db.close();
    }
  });

  it('keeps GET side-effect-free and private, with a separately authenticated POST service seam', async (t) => {
    const priorFlag = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    t.after(() => { LAUNCH_FLAGS.livingLegacy = priorFlag; });
    const routeModule = await import('../functions/api/collector/letters.js').catch(() => null);
    assert.ok(routeModule);
    if (!routeModule) return;
    const db = database();
    try {
      const env = {
        DB: d1(db),
        COLLECTOR_LETTERS_SERVICE_KEY: 'letters-service-secret',
      };
      await generateCollectorLetters(env, {
        kind: 'anniversary', keeperPieceId: 'kp-anniversary',
        now: '2025-08-10T00:00:00.000Z',
      });
      const countBefore = db.prepare(
        'SELECT COUNT(*) AS count FROM collector_letters',
      ).get()?.count;
      const getResponse = await routeModule.onRequest({
        request: new Request(
          'https://adrianrasmussen.com/api/collector/letters?piece=kp-anniversary',
          { headers: { 'X-Test-User': 'auth-source' } },
        ),
        env,
      });
      assert.equal(getResponse.status, 200);
      assert.equal(getResponse.headers.get('Cache-Control'), 'no-store');
      const getBody = await getResponse.json();
      assert.equal(getBody.letters.length, 1);
      assert.deepEqual(Object.keys(getBody.letters[0]).sort(), ['body', 'createdAt', 'id', 'kind']);
      assert.equal(db.prepare(
        'SELECT COUNT(*) AS count FROM collector_letters',
      ).get()?.count, countBefore);

      const formerResponse = await routeModule.onRequest({
        request: new Request(
          'https://adrianrasmussen.com/api/collector/letters?piece=kp-anniversary',
          { headers: { 'X-Test-User': 'auth-next' } },
        ),
        env,
      });
      assert.equal(formerResponse.status, 404);

      const deniedPost = await routeModule.onRequest({
        request: new Request('https://adrianrasmussen.com/api/collector/letters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'kin-claim', keeperPieceId: 'kp-source' }),
        }),
        env,
      });
      assert.equal(deniedPost.status, 401);

      const postResponse = await routeModule.onRequest({
        request: new Request('https://adrianrasmussen.com/api/collector/letters', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Collector-Letters-Key': 'letters-service-secret',
          },
          body: JSON.stringify({ kind: 'kin-claim', keeperPieceId: 'kp-source' }),
        }),
        env,
      });
      assert.equal(postResponse.status, 200);
      const postBody = await postResponse.json();
      assert.equal(postBody.letters.length, 1);
      assert.deepEqual(Object.keys(postBody.letters[0]).sort(), ['body', 'createdAt', 'id', 'kind']);

      const unsafePost = await routeModule.onRequest({
        request: new Request('https://adrianrasmussen.com/api/collector/letters', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Collector-Letters-Key': 'letters-service-secret',
          },
          body: JSON.stringify({
            kind: 'kin-claim', keeperPieceId: 'kp-source', body: 'Private free text.',
          }),
        }),
        env,
      });
      assert.equal(unsafePost.status, 400);
    } finally {
      db.close();
    }
  });

  it('sweeps committed first binds, transfers, and due anniversaries replay-safely', async () => {
    const db = database();
    try {
      seedTransfer(db, {
        id: 'runner-transfer', sequence: 1, from: 'auth-source', to: 'auth-next',
        at: '2025-08-10T00:00:00.000Z', hash: '9'.repeat(64), previousHash: null,
      });
      const env = { DB: d1(db) };
      const first = await runCollectorLetterEvents(env, {
        now: '2026-08-10T00:00:00.000Z',
      });
      const countAfterFirst = Number(db.prepare(
        'SELECT COUNT(*) AS count FROM collector_letters',
      ).get()?.count);
      const replay = await runCollectorLetterEvents(env, {
        now: '2026-08-10T12:00:00.000Z',
      });
      const countAfterReplay = Number(db.prepare(
        'SELECT COUNT(*) AS count FROM collector_letters',
      ).get()?.count);

      assert.ok(first.created > 0);
      assert.equal(replay.created, 0);
      assert.equal(countAfterReplay, countAfterFirst);
      assert.equal(db.prepare(
        "SELECT COUNT(*) AS count FROM collector_letters WHERE kind = 'kin-claim'",
      ).get()?.count, 1);
      assert.equal(db.prepare(
        "SELECT COUNT(*) AS count FROM collector_letters WHERE kind = 'transfer'",
      ).get()?.count, 1);
      assert.ok(Number(db.prepare(
        "SELECT COUNT(*) AS count FROM collector_letters WHERE kind = 'anniversary'",
      ).get()?.count) >= 1);
      const serialized = JSON.stringify(db.prepare(
        'SELECT body FROM collector_letters ORDER BY id',
      ).all());
      assert.doesNotMatch(serialized, /auth-|kp-|transfer-|@|example\.com/i);
    } finally {
      db.close();
    }
  });

  it('runs the due-letter sweep only through the closed service runner', async (t) => {
    const priorFlag = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    t.after(() => { LAUNCH_FLAGS.livingLegacy = priorFlag; });
    const routeModule = await import(
      '../functions/api/collector/letters-runner.js'
    ).catch(() => null);
    assert.ok(routeModule);
    if (!routeModule) return;
    const db = database();
    try {
      const env = {
        DB: d1(db),
        COLLECTOR_LETTERS_SERVICE_KEY: 'letters-service-secret',
      };
      const denied = await routeModule.onRequest({
        request: new Request(
          'https://adrianrasmussen.com/api/collector/letters-runner',
          { method: 'POST' },
        ),
        env,
      });
      assert.equal(denied.status, 401);

      const allowed = await routeModule.onRequest({
        request: new Request(
          'https://adrianrasmussen.com/api/collector/letters-runner',
          {
            method: 'POST',
            headers: { 'X-Collector-Letters-Key': 'letters-service-secret' },
          },
        ),
        env,
      });
      assert.equal(allowed.status, 200);
      assert.equal(allowed.headers.get('Cache-Control'), 'no-store');
      const body = await allowed.json();
      assert.equal(body.ok, true);
      assert.ok(body.run.checked > 0);
      assert.ok(body.run.created > 0);
      assert.equal(Object.hasOwn(body, 'now'), false);
    } finally {
      db.close();
    }
  });

  it('keeps first-bind ownership definitive when optional letter sync is unavailable', async () => {
    const result = await syncFirstBindCollectorLetters({
      DB: {
        prepare() { throw new Error('letters unavailable'); },
      },
    }, {
      keeperPieceId: 'kp-source', now: '2026-08-10T00:00:00.000Z',
    });
    assert.deepEqual(result, { ok: false, created: 0 });

    const keeperClaimSource = readFileSync(
      new URL('../functions/api/_lib/keeperClaim.js', import.meta.url), 'utf8',
    );
    const directBindSource = readFileSync(
      new URL('../functions/api/keeper/bind.js', import.meta.url), 'utf8',
    );
    const invitationSource = readFileSync(
      new URL('../functions/api/_lib/artworkInvitations.js', import.meta.url), 'utf8',
    );
    assert.match(keeperClaimSource, /afterCommit:\s*\(\)\s*=>\s*syncFirstBindCollectorLetters/);
    assert.match(directBindSource, /await prepared\.afterCommit\(\);[\s\S]*return json\(\{ ok: true/);
    assert.match(invitationSource, /await prepared\.afterCommit\(\);[\s\S]*return prepared\.result/);
  });
});
