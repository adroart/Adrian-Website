/**
 * POST /api/admin/records/rebuild's bulk path must page, not walk the whole
 * registry in one request. Before this, an omitted publicCode meant "every
 * piece with a public code, in one go" -- fine at a handful of pieces, but a
 * large registry could run past the platform's request time limit mid-loop
 * and lose the whole summary, with no record of what had already been
 * rebuilt. This file drives the real endpoint against a real (in-memory) D1
 * with more pieces than one page holds, and asserts the paging contract:
 * a capped batch per call, an honest hasMore/nextCursor, no piece skipped or
 * repeated across pages, and a request that mixes the single-piece and
 * cursor arguments is refused rather than doing something ambiguous.
 *
 * The per-piece build/compare/publish work itself (_lib/pieceRecordRefresh.js)
 * is covered in full elsewhere (tests/piece-record-refresh.test.ts); mocking
 * it here keeps this file about the endpoint's own paging logic only.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, before, describe, it, mock } from 'node:test';

const readMigration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);

// Just enough schema for keeper_pieces.public_code to exist; the rebuild
// path itself is mocked below, so nothing downstream of the SELECT needs a
// real record-generation schema.
const MIGRATIONS_THROUGH_PLATE_IDENTITY = [
  '001_init.sql', '003_atlas_legacy.sql', '006_better_auth.sql',
  '008_living_legacy.sql', '009_keeper_register.sql',
  '010_artwork_plate_identity.sql',
].map(readMigration).join('\n');

/**
 * This project's queries bind numbered placeholders (?1, ?2, ...) the way
 * D1 accepts them: positionally, in bind() order. The node:sqlite build in
 * this Node version rejects that exact call shape ("column index out of
 * range") even for a single ?1 bound as stmt.all(value) -- it wants numbered
 * placeholders addressed by an object keyed 1, 2, 3, ... instead. Converting
 * here, rather than changing the production query's placeholder style, is
 * what keeps functions/api/admin/records/rebuild.js's SQL identical to every
 * other D1 query in this codebase while still running locally.
 */
function d1(database: DatabaseSync) {
  const asNamedParams = (values: SQLInputValue[]) => Object.fromEntries(
    values.map((value, index) => [index + 1, value]),
  );
  const prepare = (sql: string) => {
    let values: SQLInputValue[] = [];
    return {
      bind(...next: SQLInputValue[]) { values = next; return this; },
      async first() { return database.prepare(sql).get(asNamedParams(values)) || null; },
      async all() { return { results: database.prepare(sql).all(asNamedParams(values)) }; },
      async run() {
        const result = database.prepare(sql).run(asNamedParams(values));
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
  };
  return { prepare };
}

// A public code alphabet-encoded from an index, so a run of N pieces sorts
// (and pages) in the same order it was created. Same character set as the
// real AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8} shape, but ordered by ASCII
// value (digits 2-9 before letters) to match the plain byte-order ORDER BY
// public_code ASC the endpoint actually runs.
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function codeForIndex(index: number): string {
  let n = index;
  let body = '';
  for (let position = 0; position < 8; position += 1) {
    body = CODE_ALPHABET[n % CODE_ALPHABET.length] + body;
    n = Math.floor(n / CODE_ALPHABET.length);
  }
  return `AR-${body}`;
}

const ADMINISTRATOR = {
  userId: 'admin-user', email: 'artist@example.com',
  user: { id: 'admin-user', email: 'artist@example.com', emailVerified: true },
  session: { id: 'admin-session' },
};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

let refreshCalls: string[] = [];
let failedCodes = new Set<string>();

before(() => {
  mock.module('../functions/api/_lib/admin.js', {
    namedExports: {
      jsonResponse,
      requireDb: (env: Record<string, unknown>) => (env.DB
        ? null : jsonResponse({ ok: false, error: 'db_not_configured' }, 503)),
      requireRegistryUnlock: async () => ADMINISTRATOR,
    },
  });
  mock.module('../functions/api/_lib/pieceRecordRefresh.js', {
    namedExports: {
      refreshPieceRecord: async (_env: unknown, { publicCode }: { publicCode: string }) => {
        refreshCalls.push(publicCode);
        if (failedCodes.has(publicCode)) {
          return { publicCode, status: 'failed', error: 'record_store_failed' };
        }
        return { publicCode, status: 'unchanged', recordHash: 'x'.repeat(64) };
      },
    },
  });
});

after(() => {
  mock.reset();
});

function rebuildRequest(body: Record<string, unknown> = {}) {
  return new Request('https://example.test/api/admin/records/rebuild', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: 'better-auth.session_token=admin-session' },
    body: JSON.stringify(body),
  });
}

function fixtureEnv(pieceCount: number) {
  const database = new DatabaseSync(':memory:');
  database.exec(MIGRATIONS_THROUGH_PLATE_IDENTITY);
  for (let index = 0; index < pieceCount; index += 1) {
    const code = codeForIndex(index);
    database.exec(`
      INSERT INTO keeper_pieces
        (id, piece_id, edition_number, recovery_code_hash, registered_at, public_code, plate_status)
      VALUES
        ('kp-${index}', 'UL-${index}', 0, '${index.toString().padStart(64, 'a')}',
         '2026-08-01T00:00:00.000Z', '${code}', 'active');
    `);
  }
  return { database, env: { DB: d1(database), ARTWORK_REGISTRY_BACKUP: {} } };
}

describe('POST /api/admin/records/rebuild bulk paging', () => {
  it('caps a bulk rebuild to RECORDS_REBUILD_BATCH_LIMIT pieces per request and says so honestly', async () => {
    refreshCalls = [];
    const { onRequest } = await import('../functions/api/admin/records/rebuild.js');
    const { RECORDS_REBUILD_BATCH_LIMIT } = await import('../functions/api/admin/records/rebuild.js');
    const total = RECORDS_REBUILD_BATCH_LIMIT + 7;
    const { env } = fixtureEnv(total);

    const response = await onRequest({ request: rebuildRequest(), env });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.ok, true);
    assert.equal(data.total, RECORDS_REBUILD_BATCH_LIMIT);
    assert.equal(data.outcomes.length, RECORDS_REBUILD_BATCH_LIMIT);
    assert.equal(data.hasMore, true);
    assert.equal(typeof data.nextCursor, 'string');
    assert.equal(refreshCalls.length, RECORDS_REBUILD_BATCH_LIMIT);
    // Never touches a request-time limit regardless of registry size: the
    // one request that ran only ever asked D1 for one bounded page.
    assert.equal(refreshCalls[0], codeForIndex(0));
    assert.equal(data.nextCursor, codeForIndex(RECORDS_REBUILD_BATCH_LIMIT - 1));
  });

  it('pages through the whole registry with no piece skipped or repeated, and reports hasMore false on the last page', async () => {
    refreshCalls = [];
    const { onRequest, RECORDS_REBUILD_BATCH_LIMIT } = await import('../functions/api/admin/records/rebuild.js');
    const total = RECORDS_REBUILD_BATCH_LIMIT * 2 + 3;
    const { env } = fixtureEnv(total);

    let cursor: string | undefined;
    const seen: string[] = [];
    let pages = 0;
    do {
      // eslint-disable-next-line no-await-in-loop
      const response = await onRequest({ request: rebuildRequest(cursor ? { cursor } : {}), env });
      // eslint-disable-next-line no-await-in-loop
      const data = await response.json();
      pages += 1;
      seen.push(...data.outcomes.map((outcome: { publicCode: string }) => outcome.publicCode));
      cursor = data.hasMore ? data.nextCursor : undefined;
      if (pages > 20) throw new Error('paging did not terminate');
    } while (cursor);

    assert.equal(pages, 3);
    assert.equal(seen.length, total);
    // Every piece exactly once, in ascending public-code order, matching
    // what a single unpaged rebuild would have covered.
    assert.deepEqual(seen, Array.from({ length: total }, (_unused, index) => codeForIndex(index)));
  });

  it('honors a smaller bounded limit and keeps the scanned cursor stable across a failed-page retry', async () => {
    refreshCalls = [];
    failedCodes = new Set([codeForIndex(0)]);
    const { onRequest } = await import('../functions/api/admin/records/rebuild.js');
    const { env } = fixtureEnv(4);

    const first = await onRequest({ request: rebuildRequest({ limit: 2 }), env });
    const firstBody = await first.json();
    assert.equal(first.status, 207);
    assert.equal(firstBody.cursor, null);
    assert.equal(firstBody.nextCursor, codeForIndex(1));
    assert.equal(firstBody.hasMore, true);
    assert.deepEqual(firstBody.outcomes.map((outcome: { status: string }) => outcome.status),
      ['failed', 'unchanged']);

    refreshCalls = [];
    const retry = await onRequest({ request: rebuildRequest({ limit: 2 }), env });
    const retryBody = await retry.json();
    assert.equal(retry.status, 207);
    assert.equal(retryBody.nextCursor, firstBody.nextCursor);
    assert.deepEqual(refreshCalls, [codeForIndex(0), codeForIndex(1)]);
    failedCodes = new Set();
  });

  it('excludes malformed legacy codes before the page boundary so every cursor can continue', async () => {
    refreshCalls = [];
    const { onRequest } = await import('../functions/api/admin/records/rebuild.js');
    const { database, env } = fixtureEnv(3);
    database.exec(`
      INSERT INTO keeper_pieces
        (id, piece_id, edition_number, recovery_code_hash, registered_at, public_code, plate_status)
      VALUES
        ('kp-invalid-boundary', 'UL-invalid', 0, '${'f'.repeat(64)}',
         '2026-08-01T00:00:00.000Z', '${codeForIndex(0)}!', 'active');
    `);

    const first = await onRequest({ request: rebuildRequest({ limit: 1 }), env });
    const firstBody = await first.json();
    assert.equal(firstBody.nextCursor, codeForIndex(0));
    assert.match(firstBody.nextCursor, /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);

    const second = await onRequest({
      request: rebuildRequest({ limit: 1, cursor: firstBody.nextCursor }), env,
    });
    const secondBody = await second.json();
    assert.equal(second.status, 200);
    assert.equal(secondBody.cursor, codeForIndex(0));
    assert.deepEqual(secondBody.outcomes.map((outcome: { publicCode: string }) => outcome.publicCode),
      [codeForIndex(1)]);
    assert.equal(secondBody.nextCursor, codeForIndex(1));
    assert.equal(refreshCalls.includes(`${codeForIndex(0)}!`), false);
  });

  it('a registry smaller than one page reports hasMore false and nextCursor null, same as before paging existed', async () => {
    const { onRequest, RECORDS_REBUILD_BATCH_LIMIT } = await import('../functions/api/admin/records/rebuild.js');
    const total = Math.min(5, RECORDS_REBUILD_BATCH_LIMIT - 1);
    const { env } = fixtureEnv(total);

    const response = await onRequest({ request: rebuildRequest(), env });
    const data = await response.json();
    assert.equal(data.total, total);
    assert.equal(data.hasMore, false);
    assert.equal(data.nextCursor, null);
  });

  it('rejects a request that names both publicCode and cursor rather than guessing which one wins', async () => {
    const { onRequest } = await import('../functions/api/admin/records/rebuild.js');
    const { env } = fixtureEnv(3);
    const response = await onRequest({
      request: rebuildRequest({ publicCode: codeForIndex(0), cursor: codeForIndex(0) }),
      env,
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(data.error, 'cursor_requires_bulk_rebuild');
  });

  it('rejects a blank cursor rather than silently treating it as "start over"', async () => {
    const { onRequest } = await import('../functions/api/admin/records/rebuild.js');
    const { env } = fixtureEnv(3);
    const response = await onRequest({ request: rebuildRequest({ cursor: '' }), env });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(data.error, 'invalid_cursor');
  });

  it('a single publicCode rebuild is untouched: always one outcome, hasMore false', async () => {
    refreshCalls = [];
    const { onRequest } = await import('../functions/api/admin/records/rebuild.js');
    const { env } = fixtureEnv(3);
    const code = codeForIndex(1);
    const response = await onRequest({ request: rebuildRequest({ publicCode: code }), env });
    const data = await response.json();
    assert.equal(data.total, 1);
    assert.equal(data.outcomes[0].publicCode, code);
    assert.equal(data.hasMore, false);
    assert.equal(data.nextCursor, null);
    assert.deepEqual(refreshCalls, [code]);
  });
});
