/**
 * Confirming a pending atlas sale creates a steward record (a fresh
 * keeper_pieces row when none exists yet) and flips the row to 'confirmed'.
 *
 * Same in-memory D1 harness as tests/atlas-sale-pending.test.ts, extended to
 * the full migration chain (001-045) so keeper_pieces carries every trigger
 * and constraint the production database does — a mutation that only looks
 * right against a hand-trimmed schema is not proven.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { onRequest as atlasSalesList } from '../functions/api/admin/atlas-sales.js';
import { onRequest as atlasSalesConfirm } from '../functions/api/admin/atlas-sales/[id].js';
import { confirmPendingAtlasSale } from '../functions/api/_lib/atlasSaleConfirm.js';

const migrationsDir = new URL('../migrations/', import.meta.url);

function allMigrationsSchema(): string {
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  return files.map((name) => readFileSync(new URL(name, migrationsDir), 'utf8')).join('\n');
}

const FULL_SCHEMA = allMigrationsSchema();

function d1(database: DatabaseSync) {
  return {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      return {
        bind(...args: SQLInputValue[]) {
          values = args;
          return this;
        },
        async all() {
          return { results: database.prepare(sql).all(...values) };
        },
        async first() {
          return database.prepare(sql).get(...values) ?? null;
        },
        async run() {
          const info = database.prepare(sql).run(...values);
          return { success: true, meta: { changes: info.changes } };
        },
      };
    },
    async batch(stmts: unknown[]) {
      return Promise.all((stmts as { run: () => Promise<unknown> }[]).map((s) => s.run()));
    },
  };
}

function freshDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(FULL_SCHEMA);
  return database;
}

function seedPendingSale(database: DatabaseSync, overrides: Record<string, unknown> = {}) {
  const row = {
    sale_id: 'cs_test_confirm_1',
    sku: null,
    piece_id: null,
    edition_number: null,
    buyer_email: 'collector@example.com',
    buyer_name: 'A Collector',
    sale_date: new Date().toISOString(),
    price_cents: 42_000,
    currency: 'USD',
    status: 'pending',
    raw_json: '{}',
    ...overrides,
  };
  database
    .prepare(
      `INSERT INTO atlas_sale_events
         (sale_id, sku, piece_id, edition_number, buyer_email, buyer_name,
          sale_date, price_cents, currency, status, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.sale_id, row.sku, row.piece_id, row.edition_number, row.buyer_email,
      row.buyer_name, row.sale_date, row.price_cents, row.currency, row.status,
      row.raw_json,
    );
  return row;
}

function adminEnv(database: DatabaseSync) {
  return { DB: d1(database), ADMIN_EMAILS: 'admin@example.com' };
}

async function adminRequest(url: string, init: RequestInit = {}) {
  // requireAdmin (functions/api/_lib/auth.js) verifies a Better Auth
  // session cookie via createAuth(env).api.getSession — out of reach in a
  // unit test without standing up the whole auth stack. These tests exercise
  // confirmPendingAtlasSale directly (the same function the route calls)
  // for the create/flip behavior, and separately prove the route's
  // authorization boundary refuses an unauthenticated request.
  return new Request(url, init);
}

describe('confirming a pending atlas sale', () => {
  it('creates a fresh keeper_pieces row when none exists, and flips the sale to confirmed', async () => {
    const database = freshDatabase();
    try {
      seedPendingSale(database);
      const env = { DB: d1(database) };

      const result = await confirmPendingAtlasSale(env, {
        saleId: 'cs_test_confirm_1',
        pieceId: 'UL-100',
        editionNumber: 0,
      });

      assert.equal(result.ok, true);
      assert.equal(result.created, true);
      assert.ok(result.recoveryCode, 'a fresh registration returns a one-time recovery code');

      const piece = database
        .prepare('SELECT * FROM keeper_pieces WHERE id = ?')
        .get(result.keeperPieceId) as any;
      assert.ok(piece, 'expected a new keeper_pieces row');
      assert.equal(piece.piece_id, 'UL-100');
      assert.equal(piece.edition_number, 0);
      assert.equal(piece.keeper_user_id, null, 'no identity is bound at confirm time');
      assert.equal(piece.claimed_at, null);
      assert.ok(piece.recovery_code_hash, 'a recovery code hash is stored');
      assert.notEqual(piece.recovery_code_hash, result.recoveryCode, 'the plaintext code is never stored');

      const sale = database
        .prepare('SELECT * FROM atlas_sale_events WHERE sale_id = ?')
        .get('cs_test_confirm_1') as any;
      assert.equal(sale.status, 'confirmed');
      assert.equal(sale.piece_id, 'UL-100');
      assert.equal(sale.edition_number, 0);
      assert.ok(sale.confirmed_at);
    } finally {
      database.close();
    }
  });

  it('reuses an existing keeper_pieces row untouched when the piece is already registered', async () => {
    const database = freshDatabase();
    try {
      seedPendingSale(database, { sale_id: 'cs_test_confirm_2' });
      const now = new Date().toISOString();
      database
        .prepare(
          `INSERT INTO keeper_pieces (id, piece_id, edition_number, recovery_code_hash, registered_at)
           VALUES ('kp-preexisting', 'UL-101', 0, 'deadbeef', ?)`,
        )
        .run(now);
      const env = { DB: d1(database) };

      const result = await confirmPendingAtlasSale(env, {
        saleId: 'cs_test_confirm_2',
        pieceId: 'UL-101',
        editionNumber: 0,
      });

      assert.equal(result.created, false);
      assert.equal(result.keeperPieceId, 'kp-preexisting');
      assert.equal(result.recoveryCode, undefined);

      const piece = database
        .prepare('SELECT recovery_code_hash FROM keeper_pieces WHERE id = ?')
        .get('kp-preexisting') as any;
      assert.equal(piece.recovery_code_hash, 'deadbeef', 'the existing row is untouched');
    } finally {
      database.close();
    }
  });

  it('a second confirm on the same sale is rejected (already resolved)', async () => {
    const database = freshDatabase();
    try {
      seedPendingSale(database, { sale_id: 'cs_test_confirm_3' });
      const env = { DB: d1(database) };
      await confirmPendingAtlasSale(env, { saleId: 'cs_test_confirm_3', pieceId: 'UL-102' });

      await assert.rejects(
        () => confirmPendingAtlasSale(env, { saleId: 'cs_test_confirm_3', pieceId: 'UL-102' }),
        (err: any) => err.code === 'sale_already_resolved',
      );
    } finally {
      database.close();
    }
  });

  it('confirming an unknown sale id fails with sale_not_found', async () => {
    const database = freshDatabase();
    try {
      const env = { DB: d1(database) };
      await assert.rejects(
        () => confirmPendingAtlasSale(env, { saleId: 'cs_does_not_exist', pieceId: 'UL-100' }),
        (err: any) => err.code === 'sale_not_found',
      );
    } finally {
      database.close();
    }
  });
});

describe('the admin atlas-sales routes require an authenticated admin', () => {
  it('GET /api/admin/atlas-sales 401s with no session', async () => {
    const database = freshDatabase();
    try {
      const request = await adminRequest('https://adrianrasmussen.com/api/admin/atlas-sales');
      const response = await atlasSalesList({ request, env: adminEnv(database) } as any);
      assert.equal(response.status, 401);
    } finally {
      database.close();
    }
  });

  it('POST /api/admin/atlas-sales/:id 401s with no session', async () => {
    const database = freshDatabase();
    try {
      seedPendingSale(database, { sale_id: 'cs_test_confirm_4' });
      const request = await adminRequest(
        'https://adrianrasmussen.com/api/admin/atlas-sales/cs_test_confirm_4',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ pieceId: 'UL-100' }),
        },
      );
      const response = await atlasSalesConfirm({
        request,
        env: adminEnv(database),
        params: { id: 'cs_test_confirm_4' },
      } as any);
      assert.equal(response.status, 401);

      const sale = database
        .prepare('SELECT status FROM atlas_sale_events WHERE sale_id = ?')
        .get('cs_test_confirm_4') as any;
      assert.equal(sale.status, 'pending', 'an unauthenticated confirm never touches the row');
    } finally {
      database.close();
    }
  });
});
