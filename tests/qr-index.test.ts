import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

type SessionData = {
  session: { id: string };
  user: { id: string; email: string; emailVerified: boolean };
} | null;

let sessionData: SessionData = null;

before(() => {
  mock.module('../lib/account/auth.server.js', {
    namedExports: {
      createAuth: () => ({
        api: { getSession: async () => sessionData },
      }),
    },
  });
});

beforeEach(() => {
  sessionData = null;
});

after(() => mock.reset());

const ORIGIN = 'https://adrianrasmussen.com';

function signIn(email = 'artist@example.com') {
  sessionData = {
    session: { id: 'session-1' },
    user: { id: 'user-1', email, emailVerified: true },
  };
}

function request(path: string, method = 'GET') {
  const headers = new Headers({ Cookie: 'better-auth.session_token=test-session' });
  if (method !== 'GET') headers.set('Origin', ORIGIN);
  return new Request(`${ORIGIN}${path}`, { method, headers });
}

const migrationsDir = new URL('../migrations/', import.meta.url);
const migrationsSql = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(new URL(name, migrationsDir), 'utf8'))
  .join('\n');

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
  return { prepare };
}

function freshDb() {
  const database = new DatabaseSync(':memory:');
  database.exec(migrationsSql);
  return database;
}

describe('GET /api/admin/qr-index', () => {
  it('requires an admin session before touching the database', async () => {
    const { onRequest } = await import('../functions/api/admin/qr-index.js');
    const database = freshDb();
    const env = { DB: d1(database), ADMIN_EMAILS: 'artist@example.com' };

    const guest = await onRequest({ request: request('/api/admin/qr-index'), env });
    assert.equal(guest.status, 401);
    assert.equal(guest.headers.get('Cache-Control'), 'no-store');

    signIn('collector@example.com');
    const nonAdmin = await onRequest({ request: request('/api/admin/qr-index'), env });
    assert.equal(nonAdmin.status, 403);
  });

  it('merges the legacy static entries with live AR- rows from keeper_pieces, sorted legacy first', async () => {
    const database = freshDb();
    const secretHash = 'f'.repeat(64);
    database.prepare(
      `INSERT INTO keeper_pieces
         (id, piece_id, recovery_code_hash, public_code, plate_status,
          registration_status, registered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'kp-live-1', 'UL-201', secretHash, 'AR-2026-001', 'active', null,
      '2026-08-01T00:00:00.000Z',
    );
    database.prepare(
      `INSERT INTO keeper_pieces
         (id, piece_id, recovery_code_hash, public_code, plate_status,
          registration_status, registered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'kp-live-2', 'UL-202', 'e'.repeat(64), 'AR-2026-002', 'generated', null,
      '2026-08-05T00:00:00.000Z',
    );
    // A legacy row that predates public codes: no public_code, so it must not
    // be reported as a live artwork identity.
    database.prepare(
      `INSERT INTO keeper_pieces (id, piece_id, recovery_code_hash, plate_status)
       VALUES (?, ?, ?, ?)`,
    ).run('kp-legacy', 'UL-050', 'a'.repeat(64), 'legacy');

    const { onRequest } = await import('../functions/api/admin/qr-index.js');
    const env = { DB: d1(database), ADMIN_EMAILS: 'artist@example.com' };
    signIn();
    const response = await onRequest({ request: request('/api/admin/qr-index'), env });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');

    const body = await response.json() as { ok: boolean; entries: Array<Record<string, unknown>> };
    assert.equal(body.ok, true);

    const legacyEntries = body.entries.filter((e) => e.source === 'legacy');
    const registryEntries = body.entries.filter((e) => e.source === 'registry');

    // Legacy entries come first, exactly the 64 oracle cards plus the deck home.
    assert.equal(legacyEntries.length, 65);
    assert.equal(body.entries[0].source, 'legacy');
    assert.equal(body.entries[64].source, 'legacy');
    assert.equal(body.entries[65].source, 'registry');

    // Only the two AR- coded rows are reported; the pre-public-code legacy
    // keeper row is excluded.
    assert.equal(registryEntries.length, 2);
    assert.deepEqual(registryEntries.map((e) => e.code), ['AR-2026-001', 'AR-2026-002']);
    assert.deepEqual(registryEntries.map((e) => e.pieceId), ['UL-201', 'UL-202']);
    assert.deepEqual(registryEntries.map((e) => e.plateStatus), ['active', 'generated']);

    // No secret-shaped fields (recovery code hashes, ownership ciphertext, etc.)
    // ever leave the endpoint.
    const raw = JSON.stringify(body);
    assert.doesNotMatch(raw, /[0-9a-f]{64}/);
    for (const entry of body.entries) {
      assert.equal('recoveryCodeHash' in entry, false);
      assert.equal('recovery_code_hash' in entry, false);
    }
  });

  it('rejects non-GET methods', async () => {
    const { onRequest } = await import('../functions/api/admin/qr-index.js');
    const database = freshDb();
    const env = { DB: d1(database), ADMIN_EMAILS: 'artist@example.com' };
    signIn();
    const response = await onRequest({ request: request('/api/admin/qr-index', 'POST'), env });
    assert.equal(response.status, 405);
    assert.deepEqual(await response.json(), { ok: false, error: 'method_not_allowed' });
  });
});

describe('data/qrRegistry.ts scope', () => {
  const source = readFileSync(new URL('../data/qrRegistry.ts', import.meta.url), 'utf8');

  it('no longer lists the UL-100 worked example or any recovery code hash', async () => {
    assert.doesNotMatch(source, /UL-100/);
    assert.doesNotMatch(source, /recoveryCodeHash:\s*\n?\s*'[0-9a-f]{64,65}'/);
    assert.doesNotMatch(source, /[0-9a-f]{64}/);

    const { QR_REGISTRY } = await import('../data/qrRegistry.ts');
    assert.equal(QR_REGISTRY.some((entry: { code: string }) => entry.code === 'UL-100'), false);
    assert.equal(
      QR_REGISTRY.some((entry: { recoveryCodeHash?: string }) => Boolean(entry.recoveryCodeHash)),
      false,
    );
    // Only the legacy oracle codes (1..64 and 'oracle') remain.
    assert.equal(QR_REGISTRY.length, 65);
    assert.equal(QR_REGISTRY.every((entry: { type: string }) => entry.type === 'oracle'), true);
  });

  it('keeps the QR encoding rulebook header exactly as printed/engraved QRs depend on it', () => {
    const headerMatch = source.match(/\/\*\*[\s\S]*?\*\//);
    assert.ok(headerMatch, 'expected a leading /** ... */ header comment');
    assert.equal(
      headerMatch![0],
      `/**
 * QR Registry — the single source of truth for every QR code
 * Adrian has issued, engraved, or printed.
 *
 * RULES (do not change — printed/engraved QRs depend on them):
 *   Domain:     adrianrasmussen.com
 *   Base path:  /qr/:code
 *   Max code:   11 characters → QR Version 3 (29x29), the minimum
 *               achievable with this domain length.
 *   Charset:    A-Z, 0-9, hyphen. No lowercase (keeps codes readable
 *               when engraved small).
 *
 * HOW IT WORKS:
 *   /qr/:code  →  Cloudflare Function (functions/qr/[number].js)
 *                  routes by pattern:
 *                    • numbers 1-64  →  mandalacodes.com oracle card
 *                    • "oracle"      →  mandalacodes.com oracle home
 *                    • everything else → /works/:code on this site
 *
 *   /works/:id →  Permanent artwork record page (WorksPage.tsx).
 *                 Looks up the piece in FULL_ARCHIVE by id.
 *
 *   /qr        →  Private index page (QRIndex.tsx). Lists every
 *                  registered code, its destination, and these rules.
 */`,
    );
  });

  it('keeps the QREntry type and QR_RULES export intact', async () => {
    assert.match(source, /export interface QREntry \{/);
    assert.match(source, /export const QR_RULES = \{/);
    const { QR_RULES } = await import('../data/qrRegistry.ts');
    assert.deepEqual(QR_RULES, {
      maxCodeLength: 11,
      domain: 'adrianrasmussen.com',
      basePath: '/qr/',
      qrVersion: 3,
      gridSize: '29x29',
      errorCorrection: 'M',
      charset: 'A-Z 0-9 hyphen',
      fixedOverhead: 31,
    });
  });
});
