import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import {
  readCollectorOnboarding,
  saveCollectorBirthProfile,
  skipCollectorBirthProfile,
} from '../functions/api/_lib/collectorOnboarding.js';

function d1(database: DatabaseSync) {
  return {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      return {
        bind(...next: SQLInputValue[]) { values = next; return this; },
        async first() { return database.prepare(sql).get(...values) || null; },
        async run() {
          const result = database.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
    },
  };
}

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auth_user_id TEXT UNIQUE,
      clerk_user_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      stripe_customer_id TEXT UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
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
  `);
  return db;
}

const inputs = {
  date: '1982-01-15',
  time: '23:39',
  place: {
    label: 'Santa Cruz, California, United States',
    lat: 36.9741,
    lng: -122.0308,
    tzId: 'America/Los_Angeles',
  },
};

describe('shared collector birth onboarding', () => {
  it('returns missing without creating a profile or user row', async () => {
    const db = database();
    try {
      assert.deepEqual(await readCollectorOnboarding({ DB: d1(db) }, { userId: 'auth-new' }), {
        status: 'missing',
      });
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users').get()?.count, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM profiles').get()?.count, 0);
    } finally {
      db.close();
    }
  });

  it('returns current shared inputs instead of blank fields', async () => {
    const db = database();
    try {
      db.prepare(
        'INSERT INTO users (auth_user_id, clerk_user_id, email) VALUES (?1, ?1, ?2)',
      ).run('auth-existing', 'collector@example.com');
      db.prepare(`
        INSERT INTO profiles
          (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id,
           computed_json, updated_at)
        VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, '{}', 1700000000)
      `).run(inputs.date, inputs.time, inputs.place.label, inputs.place.lat, inputs.place.lng, inputs.place.tzId);

      const result = await readCollectorOnboarding({ DB: d1(db) }, { userId: 'auth-existing' });
      assert.deepEqual(result, {
        status: 'current',
        inputs,
        updatedAt: '2023-11-14T22:13:20.000Z',
      });
    } finally {
      db.close();
    }
  });

  it('skips without writing and saves verified computed data into the one profile row', async () => {
    const db = database();
    try {
      const env = { DB: d1(db) };
      assert.deepEqual(skipCollectorBirthProfile(), { status: 'skipped' });
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users').get()?.count, 0);

      const saved = await saveCollectorBirthProfile(env, {
        userId: 'auth-collector',
        email: 'collector@example.com',
        inputs,
        savedAt: '2026-08-09T12:00:00.000Z',
      });
      assert.equal(saved.status, 'current');
      assert.deepEqual(saved.inputs, inputs);
      assert.deepEqual(saved.computed, {
        lifesWork: { gate: 61, line: 6 }, evolution: { gate: 62, line: 6 },
        radiance: { gate: 50, line: 2 }, purpose: { gate: 3, line: 2 },
        attraction: { gate: 33, line: 6 }, iq: { gate: 41, line: 3 },
        eq: { gate: 48, line: 4 }, sq: { gate: 5, line: 3 },
        core: { gate: 59, line: 1 }, culture: { gate: 32, line: 2 },
        pearl: { gate: 44, line: 1 },
      });
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM profiles').get()?.count, 1);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sqlite_schema WHERE name LIKE ?1').get('collector%')?.count, 0);
    } finally {
      db.close();
    }
  });

  it('keeps the collector UI skippable and recognizes existing details', () => {
    const source = readFileSync(
      new URL('../components/collector/legacy/PrivacyAndBirth.tsx', import.meta.url),
      'utf8',
    );
    assert.match(source, /details are already here/i);
    assert.match(source, />Update</);
    assert.match(source, />Skip</);
    assert.match(source, /onSkip/);
    assert.match(source, /searchPlaces/);
    assert.match(source, /Public choices stay closed until adulthood is confirmed/);
    assert.match(source, /disabled=\{!canOpenPublicChoices/);
    assert.match(source, /setInputs\([\s\S]*lat:\s*place\.lat[\s\S]*tzId:\s*place\.tzId/);
    assert.match(source, /useEffect\(\(\) => \{[\s\S]*setPerson\([\s\S]*privacy\.ring3[\s\S]*\}, \[privacy\]\)/);
    assert.doesNotMatch(source, /\u2014/);
  });

  it('adapts the existing profile endpoints to the shared verified writer', () => {
    const onboardingEndpoint = readFileSync(
      new URL('../functions/api/collector/onboarding.js', import.meta.url), 'utf8',
    );
    const profilePut = readFileSync(
      new URL('../functions/api/profile/put.js', import.meta.url), 'utf8',
    );
    const profileGet = readFileSync(
      new URL('../functions/api/profile/get.js', import.meta.url), 'utf8',
    );
    const profileDelete = readFileSync(
      new URL('../functions/api/profile/delete.js', import.meta.url), 'utf8',
    );
    assert.match(onboardingEndpoint, /readCollectorOnboarding/);
    assert.match(onboardingEndpoint, /skipCollectorBirthProfile/);
    assert.match(onboardingEndpoint, /saveCollectorBirthProfile/);
    assert.match(profilePut, /saveCollectorBirthProfile/);
    assert.doesNotMatch(profilePut, /validComputed|body\?\.computed/);
    assert.match(profileGet, /readCollectorOnboarding/);
    assert.match(profileDelete, /deleteCollectorBirthProfile/);
  });
});
