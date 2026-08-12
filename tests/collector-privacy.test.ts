import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import {
  getCollectorPrivacy,
  listCollectorCuratedCities,
  projectPublicCollectorVisibility,
  updateCollectorPrivacy,
} from '../functions/api/_lib/collectorPrivacy.js';

const migration = readFileSync(
  new URL('../migrations/028_collector_privacy.sql', import.meta.url),
  'utf8',
);

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auth_user_id TEXT UNIQUE,
      clerk_user_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL
    );
    CREATE TABLE profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      birth_date TEXT NOT NULL,
      birth_time TEXT NOT NULL,
      birth_place_label TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      tz_id TEXT NOT NULL,
      computed_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE keeper_pieces (
      id TEXT PRIMARY KEY,
      keeper_user_id TEXT
    );
  `);
  db.exec(migration);
  db.prepare(
    'INSERT INTO users (auth_user_id, clerk_user_id, email) VALUES (?1, ?1, ?2)',
  ).run('auth-adult', 'adult@example.com');
  db.prepare(
    'INSERT INTO users (auth_user_id, clerk_user_id, email) VALUES (?1, ?1, ?2)',
  ).run('auth-minor', 'minor@example.com');
  db.prepare('INSERT INTO keeper_pieces (id, keeper_user_id) VALUES (?1, ?2)')
    .run('kp-adult-piece', 'auth-adult');
  db.prepare(`
    INSERT INTO profiles
      (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id, computed_json)
    VALUES
      (1, '1982-01-15', '23:39', 'Santa Cruz, California, United States',
        36.9741, -122.0308, 'America/Los_Angeles', '{}'),
      (2, '2012-01-01', '12:00', 'Denpasar, Bali, Indonesia', -8.67, 115.21,
        'Asia/Makassar', '{}')
  `).run();
  return db;
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

const allOff = {
  ring1: { privateRecord: true },
  ring2: { shareCity: false, cityId: null },
  ring3: { shareDerivedChart: false },
  ring4: {
    shareFace: false,
    shareName: false,
    shareIntention: false,
    shareBusiness: false,
    shareMission: false,
  },
  policyVersion: null,
};

describe('collector privacy rings', () => {
  it('defaults every optional choice off while Ring 1 remains invariant', async () => {
    const db = database();
    try {
      assert.deepEqual(await getCollectorPrivacy(
        { DB: d1(db) },
        { userId: 'auth-adult', keeperPieceId: 'kp-adult-piece' },
      ), allOff);

      await assert.rejects(updateCollectorPrivacy({ DB: d1(db) }, {
        userId: 'auth-adult',
        policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
        ring1: { privateRecord: false },
      }), /ring1_invariant/);
      await assert.rejects(updateCollectorPrivacy({ DB: d1(db) }, {
        userId: 'auth-adult',
        policyVersion: 'legacy-policy-v0',
        changedAt: '2026-08-09T12:00:00.000Z',
        person: {
          shareDerivedChart: false, shareFace: false, shareName: false,
          shareIntention: false, shareBusiness: false, shareMission: false,
        },
      }), /invalid_policy_version/);
    } finally {
      db.close();
    }
  });

  it('accepts only a curated, population-qualified city ID and keeps it independent of identity', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      await assert.rejects(updateCollectorPrivacy(env, {
        userId: 'auth-adult', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
        piece: { keeperPieceId: 'kp-adult-piece', shareCity: true, cityId: 'free text city' },
      }), /city_not_curated/);

      db.prepare(`
        INSERT INTO collector_curated_cities (id, label, population, active)
        VALUES ('denpasar-id', 'Denpasar, Bali, Indonesia', 725314, 1)
      `).run();
      db.prepare(`
        INSERT INTO collector_curated_cities (id, label, population, active)
        VALUES ('retired-city', 'Retired city', 50000, 0)
      `).run();
      assert.deepEqual(await listCollectorCuratedCities(env), [
        { id: 'denpasar-id', label: 'Denpasar, Bali, Indonesia' },
      ]);
      db.prepare(
        'INSERT INTO users (auth_user_id, clerk_user_id, email) VALUES (?1, ?1, ?2)',
      ).run('auth-other-adult', 'other@example.com');
      assert.throws(() => db.prepare(`
        INSERT INTO collector_piece_privacy
          (keeper_piece_id, user_id, share_city, city_id, policy_version, updated_at)
        VALUES ('kp-adult-piece', 3, 1, 'denpasar-id', 'collector-privacy-v1',
          '2026-08-09T12:00:00.000Z')
      `).run(), /current keeper/);
      const result = await updateCollectorPrivacy(env, {
        userId: 'auth-adult', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
        piece: { keeperPieceId: 'kp-adult-piece', shareCity: true, cityId: 'denpasar-id' },
      });
      assert.equal(result.ring2.shareCity, true);
      assert.equal(result.ring2.cityId, 'denpasar-id');
      assert.equal(result.ring4.shareName, false);
    } finally {
      db.close();
    }
  });

  it('writes safe append-only policy history and revokes from projection immediately', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      const base = {
        userId: 'auth-adult', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
      } as const;
      const visible = await updateCollectorPrivacy(env, {
        ...base,
        person: {
          shareDerivedChart: true, shareFace: false, shareName: true,
          shareIntention: false, shareBusiness: true, shareMission: false,
        },
      });
      assert.deepEqual(projectPublicCollectorVisibility({
        privacy: visible,
        content: {
          subjectIsAdult: true,
          birthDate: '1982-01-15', email: 'private@example.com',
          derivedChart: {
            lifesWork: { gate: 61, line: 6, birthDate: '1982-01-15' },
            birthTime: '23:39',
          },
          name: 'A Collector', business: 'A Studio', face: 'private-face.jpg',
        },
      }), {
        derivedChart: { lifesWork: { gate: 61, line: 6 } },
        name: 'A Collector',
        business: 'A Studio',
      });

      const revoked = await updateCollectorPrivacy(env, {
        ...base,
        changedAt: '2026-08-09T12:01:00.000Z',
        person: {
          shareDerivedChart: false, shareFace: false, shareName: false,
          shareIntention: false, shareBusiness: false, shareMission: false,
        },
      });
      assert.deepEqual(projectPublicCollectorVisibility({
        privacy: revoked,
        content: {
          subjectIsAdult: true,
          derivedChart: { lifesWork: { gate: 61, line: 6 } },
          name: 'A Collector',
        },
      }), {});

      const rows = db.prepare(
        'SELECT before_json, after_json, policy_version FROM collector_consent_history ORDER BY changed_at',
      ).all();
      assert.equal(rows.length, 2);
      assert.equal(rows.every((row) => row.policy_version === 'collector-privacy-v1'), true);
      const history = JSON.stringify(rows);
      assert.doesNotMatch(history, /1982|private@example|A Collector|A Studio|birth|email/i);
      assert.throws(() => db.prepare(`
        INSERT INTO collector_consent_history
          (id, user_id, scope, target_ref, before_json, after_json, policy_version, changed_at)
        VALUES (?1, 1, 'person', 'person', ?2, ?3, 'collector-privacy-v1',
          '2026-08-09T12:02:00.000Z')
      `).run(
        `consent-${'a'.repeat(32)}`,
        JSON.stringify({ ...allOff.ring4, shareDerivedChart: false, birthDate: '1982-01-15' }),
        JSON.stringify({ ...allOff.ring4, shareDerivedChart: true, birthDate: '1982-01-15' }),
      ), /safe snapshots/);
      assert.throws(() => db.prepare(`
        INSERT INTO collector_consent_history
          (id, user_id, scope, target_ref, before_json, after_json, policy_version, changed_at)
        VALUES (?1, 1, 'piece', 'collector@example.com', ?2, ?3,
          'collector-privacy-v1', '2026-08-09T12:02:00.000Z')
      `).run(
        `consent-${'b'.repeat(32)}`,
        JSON.stringify({ shareCity: false, cityId: null }),
        JSON.stringify({ shareCity: true, cityId: 'collector-home' }),
      ), /safe snapshots/);
      assert.throws(() => db.exec('DELETE FROM collector_consent_history'), /append-only/);
    } finally {
      db.close();
    }
  });

  it('prevents public projection for minors and never projects private or lineage-shaped input', async () => {
    const db = database();
    try {
      await assert.rejects(updateCollectorPrivacy({ DB: d1(db) }, {
        userId: 'auth-minor', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
        person: {
          shareDerivedChart: true, shareFace: true, shareName: true,
          shareIntention: true, shareBusiness: true, shareMission: true,
        },
      }), /minor_publicity_forbidden/);
      db.prepare('INSERT INTO keeper_pieces (id, keeper_user_id) VALUES (?1, ?2)')
        .run('kp-minor-piece', 'auth-minor');
      db.prepare(`
        INSERT INTO collector_curated_cities (id, label, population, active)
        VALUES ('denpasar-id', 'Denpasar, Bali, Indonesia', 725314, 1)
      `).run();
      await assert.rejects(updateCollectorPrivacy({ DB: d1(db) }, {
        userId: 'auth-minor', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
        piece: { keeperPieceId: 'kp-minor-piece', shareCity: true, cityId: 'denpasar-id' },
      }), /minor_publicity_forbidden/);

      assert.deepEqual(projectPublicCollectorVisibility({
        privacy: {
          ...allOff,
          ring3: { shareDerivedChart: true },
          ring4: { shareFace: true, shareName: true, shareIntention: true,
            shareBusiness: true, shareMission: true },
        },
        content: {
          subjectIsAdult: false,
          name: 'Child', face: 'face.jpg', intention: 'Private thought',
          business: 'Business', mission: 'Mission', derivedChart: { pearl: { gate: 1, line: 1 } },
          birthDate: '2012-01-01', invitationToken: 'secret', lineage: ['never'],
        },
      }), {});

      assert.deepEqual(projectPublicCollectorVisibility({
        privacy: {
          ...allOff,
          ring4: { ...allOff.ring4, shareName: true },
        },
        content: { name: 'Age unknown' },
      }), {});
    } finally {
      db.close();
    }
  });

  it('keeps every public choice closed until adulthood is positively established', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      db.prepare(
        'INSERT INTO users (auth_user_id, clerk_user_id, email) VALUES (?1, ?1, ?2)',
      ).run('auth-unknown-age', 'unknown@example.com');
      db.prepare('INSERT INTO keeper_pieces (id, keeper_user_id) VALUES (?1, ?2)')
        .run('kp-unknown-age', 'auth-unknown-age');
      db.prepare(`
        INSERT INTO collector_curated_cities (id, label, population, active)
        VALUES ('denpasar-id', 'Denpasar, Bali, Indonesia', 725314, 1)
      `).run();

      await assert.rejects(updateCollectorPrivacy(env, {
        userId: 'auth-unknown-age', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
        person: {
          shareDerivedChart: false, shareFace: false, shareName: true,
          shareIntention: false, shareBusiness: false, shareMission: false,
        },
      }), /adult_status_required/);
      await assert.rejects(updateCollectorPrivacy(env, {
        userId: 'auth-unknown-age', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
        piece: { keeperPieceId: 'kp-unknown-age', shareCity: true, cityId: 'denpasar-id' },
      }), /adult_status_required/);

      const closed = await updateCollectorPrivacy(env, {
        userId: 'auth-unknown-age', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
        person: {
          shareDerivedChart: false, shareFace: false, shareName: false,
          shareIntention: false, shareBusiness: false, shareMission: false,
        },
      });
      assert.deepEqual(closed, allOff);
      assert.equal(db.prepare(
        'SELECT COUNT(*) AS count FROM collector_consent_history WHERE user_id = 3',
      ).get()?.count, 0);

      assert.throws(() => db.prepare(`
        INSERT INTO collector_person_privacy
          (user_id, share_name, policy_version, updated_at)
        VALUES (3, 1, 'collector-privacy-v1', '2026-08-09T12:00:00.000Z')
      `).run(), /adult status/);
    } finally {
      db.close();
    }
  });

  it('revokes existing public choices when a later shared profile establishes minor status', async () => {
    const db = database();
    try {
      await updateCollectorPrivacy({ DB: d1(db) }, {
        userId: 'auth-adult', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
        person: {
          shareDerivedChart: false, shareFace: false, shareName: true,
          shareIntention: false, shareBusiness: false, shareMission: false,
        },
      });
      db.prepare(`
        INSERT INTO collector_curated_cities (id, label, population, active)
        VALUES ('denpasar-id', 'Denpasar, Bali, Indonesia', 725314, 1)
      `).run();
      await updateCollectorPrivacy({ DB: d1(db) }, {
        userId: 'auth-adult', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:30.000Z',
        piece: { keeperPieceId: 'kp-adult-piece', shareCity: true, cityId: 'denpasar-id' },
      });
      db.prepare(`
        UPDATE profiles
           SET birth_date = '2012-01-01',
               birth_time = '12:00',
               birth_place_label = 'Denpasar, Bali, Indonesia',
               lat = -8.67,
               lng = 115.21,
               tz_id = 'Asia/Makassar',
               computed_json = '{}',
               updated_at = 1786276860
         WHERE user_id = 1
      `).run();
      const state = await getCollectorPrivacy({ DB: d1(db) }, { userId: 'auth-adult' });
      assert.equal(state.ring4.shareName, false);
      const pieceState = await getCollectorPrivacy(
        { DB: d1(db) }, { userId: 'auth-adult', keeperPieceId: 'kp-adult-piece' },
      );
      assert.equal(pieceState.ring2.shareCity, false);
      const history = db.prepare(
        "SELECT before_json, after_json FROM collector_consent_history WHERE scope = 'person' ORDER BY changed_at",
      ).all();
      assert.equal(history.length, 2);
      assert.equal(JSON.parse(String(history[1].before_json)).shareName, true);
      assert.equal(JSON.parse(String(history[1].after_json)).shareName, false);
    } finally {
      db.close();
    }
  });

  it('revokes every public choice when adulthood evidence becomes malformed', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      db.prepare(`
        INSERT INTO collector_curated_cities (id, label, population, active)
        VALUES ('denpasar-id', 'Denpasar, Bali, Indonesia', 725314, 1)
      `).run();
      await updateCollectorPrivacy(env, {
        userId: 'auth-adult', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
        person: {
          shareDerivedChart: true, shareFace: false, shareName: true,
          shareIntention: false, shareBusiness: false, shareMission: false,
        },
        piece: { keeperPieceId: 'kp-adult-piece', shareCity: true, cityId: 'denpasar-id' },
      });

      db.prepare(`
        UPDATE profiles
           SET birth_date = 'not-a-date',
               updated_at = 1786276860
         WHERE user_id = 1
      `).run();

      const state = await getCollectorPrivacy(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-adult-piece',
      });
      assert.equal(state.ring2.shareCity, false);
      assert.equal(state.ring3.shareDerivedChart, false);
      assert.equal(state.ring4.shareName, false);

      const history = db.prepare(`
        SELECT scope, before_json, after_json
          FROM collector_consent_history
         WHERE user_id = 1
         ORDER BY changed_at, scope
      `).all();
      assert.equal(history.length, 4);
      assert.deepEqual(history.map((row) => row.scope), ['person', 'piece', 'person', 'piece']);
      assert.doesNotMatch(JSON.stringify(history), /not-a-date|birth/i);
      assert.deepEqual(JSON.parse(String(history[2].after_json)), {
        shareDerivedChart: false,
        shareFace: false,
        shareName: false,
        shareIntention: false,
        shareBusiness: false,
        shareMission: false,
      });
      assert.deepEqual(JSON.parse(String(history[3].after_json)), {
        shareCity: false,
        cityId: null,
      });
    } finally {
      db.close();
    }
  });

  it('revokes every public choice when the birth date is not a real calendar date', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      db.prepare(`
        INSERT INTO collector_curated_cities (id, label, population, active)
        VALUES ('denpasar-id', 'Denpasar, Bali, Indonesia', 725314, 1)
      `).run();
      await updateCollectorPrivacy(env, {
        userId: 'auth-adult', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
        person: {
          shareDerivedChart: false, shareFace: false, shareName: true,
          shareIntention: false, shareBusiness: false, shareMission: false,
        },
        piece: { keeperPieceId: 'kp-adult-piece', shareCity: true, cityId: 'denpasar-id' },
      });

      db.prepare(`
        UPDATE profiles
           SET birth_date = '1980-02-31',
               updated_at = 1786276860
         WHERE user_id = 1
      `).run();

      const state = await getCollectorPrivacy(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-adult-piece',
      });
      assert.equal(state.ring2.shareCity, false);
      assert.equal(state.ring4.shareName, false);
      assert.equal(db.prepare(
        'SELECT COUNT(*) AS count FROM collector_consent_history WHERE user_id = 1',
      ).get()?.count, 4);
      await assert.rejects(updateCollectorPrivacy(env, {
        userId: 'auth-adult', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:02:00.000Z',
        person: {
          shareDerivedChart: false, shareFace: false, shareName: true,
          shareIntention: false, shareBusiness: false, shareMission: false,
        },
      }), /minor_publicity_forbidden/);
    } finally {
      db.close();
    }
  });

  it('revokes existing public choices when adult-status evidence is deleted', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      db.prepare(`
        INSERT INTO collector_curated_cities (id, label, population, active)
        VALUES ('denpasar-id', 'Denpasar, Bali, Indonesia', 725314, 1)
      `).run();
      await updateCollectorPrivacy(env, {
        userId: 'auth-adult', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
        person: {
          shareDerivedChart: false, shareFace: false, shareName: true,
          shareIntention: false, shareBusiness: false, shareMission: false,
        },
        piece: { keeperPieceId: 'kp-adult-piece', shareCity: true, cityId: 'denpasar-id' },
      });

      db.prepare('DELETE FROM profiles WHERE user_id = 1').run();

      const state = await getCollectorPrivacy(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-adult-piece',
      });
      assert.equal(state.ring2.shareCity, false);
      assert.equal(state.ring4.shareName, false);
      assert.equal(db.prepare(
        'SELECT COUNT(*) AS count FROM collector_consent_history WHERE user_id = 1',
      ).get()?.count, 4);
    } finally {
      db.close();
    }
  });

  it('revokes piece-city consent immediately when stewardship transfers', async () => {
    const db = database();
    try {
      db.prepare(`
        INSERT INTO collector_curated_cities (id, label, population, active)
        VALUES ('denpasar-id', 'Denpasar, Bali, Indonesia', 725314, 1)
      `).run();
      await updateCollectorPrivacy({ DB: d1(db) }, {
        userId: 'auth-adult', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
        piece: { keeperPieceId: 'kp-adult-piece', shareCity: true, cityId: 'denpasar-id' },
      });
      db.prepare("UPDATE keeper_pieces SET keeper_user_id = 'auth-minor' WHERE id = 'kp-adult-piece'").run();
      const current = db.prepare(`
        SELECT share_city, city_id FROM collector_piece_privacy
         WHERE keeper_piece_id = 'kp-adult-piece'
      `).get();
      assert.deepEqual({ ...current }, { share_city: 0, city_id: null });
      assert.equal(db.prepare(
        "SELECT COUNT(*) AS count FROM collector_consent_history WHERE scope = 'piece'",
      ).get()?.count, 2);
    } finally {
      db.close();
    }
  });

  it('records an explicit city-consent revocation and closes its projection immediately', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      db.prepare(`
        INSERT INTO collector_curated_cities (id, label, population, active)
        VALUES ('denpasar-id', 'Denpasar, Bali, Indonesia', 725314, 1)
      `).run();
      await updateCollectorPrivacy(env, {
        userId: 'auth-adult', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
        piece: { keeperPieceId: 'kp-adult-piece', shareCity: true, cityId: 'denpasar-id' },
      });

      const revoked = await updateCollectorPrivacy(env, {
        userId: 'auth-adult', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:01:00.000Z',
        piece: { keeperPieceId: 'kp-adult-piece', shareCity: false, cityId: null },
      });

      assert.deepEqual(revoked.ring2, { shareCity: false, cityId: null });
      assert.deepEqual({ ...db.prepare(`
        SELECT share_city, city_id FROM collector_piece_privacy
         WHERE keeper_piece_id = 'kp-adult-piece'
      `).get() }, { share_city: 0, city_id: null });
      const history = db.prepare(`
        SELECT before_json, after_json
          FROM collector_consent_history
         WHERE scope = 'piece' AND target_ref = 'kp-adult-piece'
         ORDER BY changed_at
      `).all();
      assert.equal(history.length, 2);
      assert.deepEqual(JSON.parse(String(history[1].before_json)), {
        shareCity: true, cityId: 'denpasar-id',
      });
      assert.deepEqual(JSON.parse(String(history[1].after_json)), {
        shareCity: false, cityId: null,
      });
      assert.deepEqual(projectPublicCollectorVisibility({
        privacy: revoked,
        content: { subjectIsAdult: true },
      }), {});
    } finally {
      db.close();
    }
  });

  it('retires a curated city by atomically closing visibility without blocking transfer', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      db.prepare(`
        INSERT INTO collector_curated_cities (id, label, population, active)
        VALUES ('denpasar-id', 'Denpasar, Bali, Indonesia', 725314, 1)
      `).run();
      await updateCollectorPrivacy(env, {
        userId: 'auth-adult', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:00:00.000Z',
        piece: { keeperPieceId: 'kp-adult-piece', shareCity: true, cityId: 'denpasar-id' },
      });

      db.prepare(
        "UPDATE collector_curated_cities SET active = 0 WHERE id = 'denpasar-id'",
      ).run();

      const state = await getCollectorPrivacy(env, {
        userId: 'auth-adult', keeperPieceId: 'kp-adult-piece',
      });
      assert.deepEqual(state.ring2, { shareCity: false, cityId: null });
      assert.deepEqual(projectPublicCollectorVisibility({
        privacy: state,
        content: { subjectIsAdult: true },
      }), {});
      const history = db.prepare(`
        SELECT before_json, after_json
          FROM collector_consent_history
         WHERE scope = 'piece' AND target_ref = 'kp-adult-piece'
         ORDER BY rowid
      `).all();
      assert.equal(history.length, 2);
      assert.deepEqual(JSON.parse(String(history[1].before_json)), {
        shareCity: true, cityId: 'denpasar-id',
      });
      assert.deepEqual(JSON.parse(String(history[1].after_json)), {
        shareCity: false, cityId: null,
      });

      await assert.rejects(updateCollectorPrivacy(env, {
        userId: 'auth-adult', policyVersion: 'collector-privacy-v1',
        changedAt: '2026-08-09T12:01:00.000Z',
        piece: { keeperPieceId: 'kp-adult-piece', shareCity: true, cityId: 'denpasar-id' },
      }), /city_not_curated/);
      assert.throws(() => db.prepare(`
        UPDATE collector_piece_privacy
           SET share_city = 1, city_id = 'denpasar-id'
         WHERE keeper_piece_id = 'kp-adult-piece'
      `).run(), /active curated city/);
      assert.doesNotThrow(() => db.prepare(
        "UPDATE keeper_pieces SET keeper_user_id = 'auth-minor' WHERE id = 'kp-adult-piece'",
      ).run());
      assert.equal(db.prepare(`
        SELECT COUNT(*) AS count
          FROM collector_consent_history
         WHERE scope = 'piece' AND target_ref = 'kp-adult-piece'
      `).get()?.count, 2);
    } finally {
      db.close();
    }
  });

  it('keeps privacy behind authenticated collector adapters with no public-data joins', () => {
    const endpoint = readFileSync(
      new URL('../functions/api/collector/privacy.js', import.meta.url), 'utf8',
    );
    const client = readFileSync(
      new URL('../utils/collectorPrivacy.ts', import.meta.url), 'utf8',
    );
    assert.match(endpoint, /requireUser/);
    assert.match(endpoint, /getCollectorPrivacy/);
    assert.match(endpoint, /updateCollectorPrivacy/);
    assert.match(client, /credentials:\s*'include'/);
    assert.doesNotMatch(endpoint, /invitation|lineage|birth_date|birth_time/i);
  });
});
