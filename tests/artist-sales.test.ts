import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import {
  appendArtworkLedgerEntry,
  appendReconnectionEvent,
  appendSharedSaleMessage,
  correctVerifiedSale,
  createReconnectionCase,
  createVerifiedSale,
  getArtistSaleDetail,
  identifyArtworkRecord,
  linkArtworkIdentity,
  listArtistSaleWorkspace,
} from '../functions/api/_lib/artistSales.js';

const readMigration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);

const migrationsThroughArtistSales = [
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
  '032_artist_verified_sales.sql',
].map(readMigration).join('\n');

const now = '2026-08-10T12:00:00.000Z';
const digest = (character: string) => character.repeat(64);
const uniqueEdition = '{"kind":"unique","number":null,"size":null}';
const numberedEdition = (number: number, size: number | null) =>
  JSON.stringify({ kind: 'numbered', number, size });

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    ${migrationsThroughArtistSales}
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES
      ('artist-admin', 'Artist Administrator', 'artist@example.com', 1, 1, 1),
      ('artist-second', 'Second Administrator', 'second@example.com', 1, 1, 1);
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, recovery_code_hash, registered_at)
    VALUES
      ('kp-sale-one', 'UL-100', 1, '${digest('a')}', '${now}'),
      ('kp-sale-two', 'UL-101', 2, '${digest('b')}', '${now}'),
      ('kp-sale-unique', 'SIG-200', 0, '${digest('c')}', '${now}');
  `);
  return db;
}

function columns(db: DatabaseSync, table: string) {
  return db.prepare(`SELECT name FROM pragma_table_info(?) ORDER BY cid`).all(table)
    .map((row) => row.name);
}

function foreignKeys(db: DatabaseSync, table: string) {
  return db.prepare(`
    SELECT "from" AS source, "table" AS target, "to" AS destination,
           on_delete AS onDelete
      FROM pragma_foreign_key_list(?)
     ORDER BY "from", "table"
  `).all(table).map((row) => ({ ...row }));
}

function recordSnapshot(input: {
  artworkId: string | null;
  editionJson: string | null;
  keeperPieceId: string | null;
  identificationStatus: 'unresolved' | 'identified' | 'identity_linked';
  recordVersion: number;
}) {
  return JSON.stringify({
    artworkId: input.artworkId,
    editionJson: input.editionJson === null ? null : JSON.parse(input.editionJson),
    keeperPieceId: input.keeperPieceId,
    identificationStatus: input.identificationStatus,
    recordVersion: input.recordVersion,
  });
}

function saleSnapshot(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    reconnectionCaseId: 'case-one',
    occurrencePrecision: 'exact',
    occurredOn: '2026-08-01',
    buyerEmail: 'collector@example.com',
    currency: 'USD',
    totalMinor: 300000,
    privateReference: 'Studio ledger page 18',
    privateNotes: 'Introduced by a mutual friend.',
    verifiedByUserId: 'artist-admin',
    recordedAt: now,
    ...overrides,
  });
}

function seedCaseAndRecords(db: DatabaseSync) {
  db.exec(`
    INSERT INTO artist_reconnection_cases
      (id, recipient_email, recipient_name, private_context, status,
       created_by_user_id, idempotency_key, request_digest, created_at, updated_at)
    VALUES
      ('case-one', 'collector@example.com', 'A Collector', 'Met in Ubud.', 'open',
       'artist-admin', 'case-one-key', '${digest('1')}', '${now}', '${now}');

    INSERT INTO artist_artwork_records
      (id, artwork_id, edition_json, keeper_piece_id, identification_status,
       created_by_user_id, created_at, updated_at)
    VALUES
      ('record-unresolved', NULL, NULL, NULL, 'unresolved',
       'artist-admin', '${now}', '${now}'),
      ('record-identified', 'UL-102', '${uniqueEdition}', NULL, 'identified',
       'artist-admin', '${now}', '${now}'),
      ('record-linked', 'UL-100', '${numberedEdition(1, 64)}', 'kp-sale-one', 'identity_linked',
       'artist-admin', '${now}', '${now}');
  `);
}

function insertPrimarySale(db: DatabaseSync) {
  db.exec(`
    INSERT INTO artist_verified_sales
      (id, reconnection_case_id, occurrence_precision, occurred_on, buyer_email,
       currency, total_minor, private_reference, private_notes,
       verified_by_user_id, idempotency_key, request_digest, recorded_at)
    VALUES
      ('sale-one', 'case-one', 'exact', '2026-08-01', 'collector@example.com',
       'USD', 300000, 'Studio ledger page 18', 'Introduced by a mutual friend.',
       'artist-admin', 'sale-one-key', '${digest('2')}', '${now}');
    INSERT INTO artist_verified_sale_items
      (id, sale_id, artwork_record_id, amount_minor, currency, created_at)
    VALUES
      ('item-one', 'sale-one', 'record-unresolved', 100000, 'USD', '${now}'),
      ('item-two', 'sale-one', 'record-identified', NULL, NULL, '${now}'),
      ('item-three', 'sale-one', 'record-linked', 200000, 'USD', '${now}');
  `);
}

function count(db: DatabaseSync, table: string) {
  return Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count);
}

function serviceEnvironment(options: { failBatchAt?: number; loseFirstResponse?: boolean } = {}) {
  const db = database();
  let batches = 0;
  const DB = {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...bound: SQLInputValue[]) { values = bound; return statement; },
        first() { return db.prepare(sql).get(...values) ?? null; },
        all() { return { results: db.prepare(sql).all(...values) }; },
        run() {
          const result = db.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
        get sql() { return sql; },
        get values() { return values; },
      };
      return statement;
    },
    async batch(statements: Array<{ sql: string; values: SQLInputValue[] }>) {
      batches += 1;
      db.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map((statement, index) => {
          if (options.failBatchAt === index) throw new Error('simulated batch failure');
          const result = db.prepare(statement.sql).run(...statement.values);
          return { success: true, meta: { changes: Number(result.changes) } };
        });
        db.exec('COMMIT');
        if (options.loseFirstResponse && batches === 1) throw new Error('simulated lost response');
        return results;
      } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { db, env: { DB }, get batches() { return batches; } };
}

const administrator = { userId: 'artist-admin', email: 'artist@example.com' };

function saleInput(overrides: Record<string, unknown> = {}) {
  return {
    occurrence: { precision: 'year', value: '2018' },
    buyerEmail: ' Collector@Example.com ',
    total: { amountMinor: 900000, currency: 'usd' },
    privateReference: ' studio-ledger-2018-4 ',
    privateNotes: null,
    reconnectionCaseId: null,
    artworks: [
      { artworkRecordId: null, artworkId: 'UL-100', edition: { kind: 'numbered', number: 1, size: 64 }, price: { amountMinor: 300000, currency: 'usd' } },
      { artworkRecordId: null, artworkId: 'UL-101', edition: { kind: 'numbered', number: 2, size: 64 }, price: { amountMinor: 250000, currency: 'USD' } },
      { artworkRecordId: null, artworkId: null, edition: null, price: null },
    ],
    idempotencyKey: 'sale-create-2018-4',
    administrator,
    recordedAt: '2026-08-10T01:00:00.000Z',
    ...overrides,
  };
}

describe('artist verified sale records', () => {
  it('applies the full migration chain through 032 with the exact private schema and clean foreign keys', () => {
    const db = database();
    try {
      for (const productionTable of [
        'invoices', 'viewings', 'atlas_piece_content', 'pricing_config',
      ]) {
        assert.ok(db.prepare(`
          SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1
        `).get(productionTable), productionTable);
      }
      const expectedColumns: Record<string, string[]> = {
        artist_reconnection_cases: [
          'id', 'recipient_email', 'recipient_name', 'private_context', 'status',
          'created_by_user_id', 'idempotency_key', 'request_digest', 'created_at', 'updated_at',
        ],
        artist_reconnection_events: [
          'id', 'reconnection_case_id', 'event_type', 'private_note',
          'artwork_record_id', 'actor_user_id', 'idempotency_key',
          'request_digest', 'created_at',
        ],
        artist_artwork_records: [
          'id', 'artwork_id', 'edition_json', 'keeper_piece_id',
          'identification_status', 'record_version', 'last_event_id',
          'created_by_user_id', 'created_at', 'updated_at',
        ],
        artist_artwork_record_events: [
          'id', 'artwork_record_id', 'action', 'before_json', 'after_json',
          'resulting_version', 'actor_user_id', 'idempotency_key',
          'request_digest', 'created_at',
        ],
        artist_verified_sales: [
          'id', 'reconnection_case_id', 'occurrence_precision', 'occurred_on',
          'buyer_email', 'currency', 'total_minor', 'private_reference',
          'private_notes', 'verified_by_user_id', 'idempotency_key',
          'request_digest', 'recorded_at',
        ],
        artist_verified_sale_events: [
          'id', 'sale_id', 'sequence', 'event_type', 'before_json', 'after_json',
          'actor_user_id', 'idempotency_key', 'request_digest', 'created_at',
        ],
        artist_verified_sale_items: [
          'id', 'sale_id', 'artwork_record_id', 'amount_minor', 'currency', 'created_at',
        ],
        artist_artwork_media: [
          'id', 'artwork_record_id', 'media_role', 'storage_reference', 'sha256',
          'content_type', 'byte_length', 'uploaded_by_user_id', 'created_at',
        ],
        artist_artwork_ledger_entries: [
          'id', 'artwork_record_id', 'sale_id', 'message', 'media_id',
          'created_by_user_id', 'idempotency_key', 'request_digest', 'created_at',
        ],
        artist_artwork_price_entries: [
          'id', 'artwork_record_id', 'sale_item_id', 'amount_minor', 'currency',
          'occurred_on', 'occurrence_precision', 'recorded_at',
        ],
      };
      for (const [table, expected] of Object.entries(expectedColumns)) {
        assert.deepEqual(columns(db, table), expected, table);
      }

      const expectedForeignKeys: Record<string, Array<Record<string, string>>> = {
        artist_reconnection_cases: [
          { source: 'created_by_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_reconnection_events: [
          { source: 'actor_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'artwork_record_id', target: 'artist_artwork_records', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'reconnection_case_id', target: 'artist_reconnection_cases', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_artwork_records: [
          { source: 'created_by_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'keeper_piece_id', target: 'keeper_pieces', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'last_event_id', target: 'artist_artwork_record_events', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_artwork_record_events: [
          { source: 'actor_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'artwork_record_id', target: 'artist_artwork_records', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_verified_sales: [
          { source: 'reconnection_case_id', target: 'artist_reconnection_cases', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'verified_by_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_verified_sale_events: [
          { source: 'actor_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'sale_id', target: 'artist_verified_sales', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_verified_sale_items: [
          { source: 'artwork_record_id', target: 'artist_artwork_records', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'sale_id', target: 'artist_verified_sales', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_artwork_media: [
          { source: 'artwork_record_id', target: 'artist_artwork_records', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'uploaded_by_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_artwork_ledger_entries: [
          { source: 'artwork_record_id', target: 'artist_artwork_records', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'created_by_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'media_id', target: 'artist_artwork_media', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'sale_id', target: 'artist_verified_sales', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_artwork_price_entries: [
          { source: 'artwork_record_id', target: 'artist_artwork_records', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'sale_item_id', target: 'artist_verified_sale_items', destination: 'id', onDelete: 'RESTRICT' },
        ],
      };
      for (const [table, expected] of Object.entries(expectedForeignKeys)) {
        assert.deepEqual(foreignKeys(db, table), expected, table);
      }
      assert.equal(db.prepare(`
        SELECT "notnull" AS required
          FROM pragma_table_info('artist_artwork_price_entries')
         WHERE name = 'sale_item_id'
      `).get()?.required, 1);
      const uniqueArtworkRecordIndexes = db.prepare(`
        SELECT name FROM pragma_index_list('artist_artwork_records')
         WHERE "unique" = 1
      `).all().map((row) => String(row.name));
      assert.equal(uniqueArtworkRecordIndexes.some((indexName) =>
        db.prepare('SELECT name FROM pragma_index_info(?)').all(indexName)
          .some((column) => column.name === 'last_event_id')
      ), false);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('records a private three-artwork sale, including an unresolved work and optional prices', () => {
    const db = database();
    try {
      seedCaseAndRecords(db);
      insertPrimarySale(db);
      db.exec(`
        INSERT INTO artist_verified_sales
          (id, occurrence_precision, occurred_on, verified_by_user_id,
           idempotency_key, request_digest, recorded_at)
        VALUES
          ('sale-month', 'month', '2026-07', 'artist-admin',
           'sale-month-key', '${digest('9')}', '${now}'),
          ('sale-year', 'year', '2025', 'artist-admin',
           'sale-year-key', '${digest('a')}', '${now}'),
          ('sale-unknown', 'unknown', NULL, 'artist-admin',
           'sale-unknown-key', '${digest('b')}', '${now}');
        INSERT INTO artist_verified_sale_items
          (id, sale_id, artwork_record_id, amount_minor, currency, created_at)
        VALUES
          ('item-month', 'sale-month', 'record-identified', 125000, 'USD', '${now}'),
          ('item-year', 'sale-year', 'record-identified', 130000, 'USD', '${now}'),
          ('item-unknown', 'sale-unknown', 'record-linked', 200000, 'USD', '${now}');
        INSERT INTO artist_reconnection_events
          (id, reconnection_case_id, event_type, private_note, artwork_record_id,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES
          ('reconnect-note', 'case-one', 'note_added', 'Try the old studio address.', NULL,
           'artist-admin', 'reconnect-note-key', '${digest('3')}', '${now}'),
          ('reconnect-artwork', 'case-one', 'artwork_added', NULL, 'record-unresolved',
           'artist-admin', 'reconnect-artwork-key', '${digest('4')}', '${now}');
        INSERT INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
        VALUES
          ('media-one', 'record-unresolved', 'identification_evidence',
           'artist-sales/record-unresolved/front.webp', '${digest('5')}',
           'image/webp', 2048, 'artist-admin', '${now}');
        INSERT INTO artist_artwork_ledger_entries
          (id, artwork_record_id, sale_id, message, media_id, created_by_user_id,
           idempotency_key, request_digest, created_at)
        VALUES
          ('ledger-message', 'record-unresolved', 'sale-one',
           'Collector remembered a circular walnut frame.', NULL, 'artist-admin',
           'ledger-message-key', '${digest('6')}', '${now}'),
          ('ledger-media', 'record-unresolved', NULL, NULL, 'media-one', 'artist-admin',
           'ledger-media-key', '${digest('7')}', '${now}');
        INSERT INTO artist_artwork_price_entries
          (id, artwork_record_id, sale_item_id, amount_minor, currency,
           occurred_on, occurrence_precision, recorded_at)
        VALUES
          ('price-exact', 'record-unresolved', 'item-one', 100000, 'USD',
           '2026-08-01', 'exact', '${now}'),
          ('price-month', 'record-identified', 'item-month', 125000, 'USD',
           '2026-07', 'month', '${now}'),
          ('price-year', 'record-identified', 'item-year', 130000, 'USD',
           '2025', 'year', '${now}'),
          ('price-unknown', 'record-linked', 'item-unknown', 200000, 'USD',
           NULL, 'unknown', '${now}');
      `);

      const beforeSale = saleSnapshot();
      const afterSale = saleSnapshot({ privateNotes: 'Introduced by a mutual friend. Follow up in September.' });
      db.prepare(`
        INSERT INTO artist_verified_sale_events
          (id, sale_id, sequence, event_type, before_json, after_json,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES
          ('sale-event-one', 'sale-one', 1, 'shared_message_appended', ?1, ?2,
           'artist-admin', 'sale-event-one-key', ?3, ?4)
      `).run(beforeSale, afterSale, digest('8'), now);

      assert.deepEqual({ ...db.prepare(`
        SELECT id, artwork_id, edition_json, keeper_piece_id, identification_status
          FROM artist_artwork_records WHERE id = 'record-unresolved'
      `).get() }, {
        id: 'record-unresolved', artwork_id: null, edition_json: null,
        keeper_piece_id: null, identification_status: 'unresolved',
      });
      assert.equal(db.prepare(`
        SELECT COUNT(*) AS count FROM artist_verified_sale_items WHERE sale_id = 'sale-one'
      `).get()?.count, 3);
      assert.equal(count(db, 'artist_artwork_price_entries'), 4);
      assert.equal(count(db, 'artist_artwork_ledger_entries'), 2);
      assert.equal(count(db, 'artist_artwork_media'), 1);
      assert.equal(count(db, 'artist_verified_sale_events'), 1);
      assert.equal(db.prepare(`
        SELECT private_notes FROM artist_verified_sales WHERE id = 'sale-one'
      `).get()?.private_notes, 'Introduced by a mutual friend.');
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('rejects ledger and price references whose redundant facts belong to another artwork', () => {
    const db = database();
    try {
      db.exec('PRAGMA recursive_triggers = OFF');
      seedCaseAndRecords(db);
      insertPrimarySale(db);
      db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES ('record-outside-sale', NULL, NULL, 'unresolved',
          'artist-admin', '${now}', '${now}');
        INSERT INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
        VALUES ('media-cross-check', 'record-unresolved', 'identification_evidence',
          'artist-sales/cross-check.webp', '${digest('d')}', 'image/webp', 100,
          'artist-admin', '${now}')
      `);
      const before = {
        ledger: count(db, 'artist_artwork_ledger_entries'),
        price: count(db, 'artist_artwork_price_entries'),
        media: { ...db.prepare(`SELECT * FROM artist_artwork_media WHERE id = 'media-cross-check'`).get() },
        item: { ...db.prepare(`SELECT * FROM artist_verified_sale_items WHERE id = 'item-one'`).get() },
      };

      const invalidLedgerSql = [
        `INSERT INTO artist_artwork_ledger_entries
          (id, artwork_record_id, media_id, created_by_user_id,
           idempotency_key, request_digest, created_at)
         VALUES ('ledger-wrong-media', 'record-identified', 'media-cross-check',
           'artist-admin', 'ledger-wrong-media-key', '${digest('e')}', '${now}')`,
        `INSERT INTO artist_artwork_ledger_entries
          (id, artwork_record_id, sale_id, message, created_by_user_id,
           idempotency_key, request_digest, created_at)
         VALUES ('ledger-wrong-sale', 'record-outside-sale', 'sale-one', 'Wrong sale.',
           'artist-admin', 'ledger-wrong-sale-key', '${digest('f')}', '${now}')`,
      ];
      for (const sql of invalidLedgerSql) {
        assert.throws(() => db.exec(sql), /artwork|media|sale/i);
      }

      const invalidPriceValues = [
        ['price-wrong-artwork', 'record-identified', 100000, 'USD', '2026-08-01', 'exact'],
        ['price-wrong-amount', 'record-unresolved', 99999, 'USD', '2026-08-01', 'exact'],
        ['price-wrong-currency', 'record-unresolved', 100000, 'EUR', '2026-08-01', 'exact'],
        ['price-wrong-occurrence', 'record-unresolved', 100000, 'USD', '2026-08-02', 'exact'],
      ] as const;
      for (const values of invalidPriceValues) {
        assert.throws(() => db.prepare(`
          INSERT INTO artist_artwork_price_entries
            (id, artwork_record_id, sale_item_id, amount_minor, currency,
             occurred_on, occurrence_precision, recorded_at)
          VALUES (?1, ?2, 'item-one', ?3, ?4, ?5, ?6, ?7)
        `).run(...values, now), /artwork|price|sale|fact/i, values[0]);
      }
      assert.throws(() => db.exec(`
        INSERT INTO artist_artwork_price_entries
          (id, artwork_record_id, sale_item_id, amount_minor, currency,
           occurred_on, occurrence_precision, recorded_at)
        VALUES ('price-item-without-price', 'record-identified', 'item-two', 1, 'USD',
          '2026-08-01', 'exact', '${now}')
      `), /price|sale|fact/i);

      assert.deepEqual({
        ledger: count(db, 'artist_artwork_ledger_entries'),
        price: count(db, 'artist_artwork_price_entries'),
        media: { ...db.prepare(`SELECT * FROM artist_artwork_media WHERE id = 'media-cross-check'`).get() },
        item: { ...db.prepare(`SELECT * FROM artist_verified_sale_items WHERE id = 'item-one'`).get() },
      }, before);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('normalizes private contact facts and rejects malformed states, JSON, digests, and money pairs', () => {
    const db = database();
    try {
      assert.throws(() => db.exec(`
        INSERT INTO artist_reconnection_cases
          (id, recipient_email, status, created_by_user_id, idempotency_key,
           request_digest, created_at, updated_at)
        VALUES ('bad-email', ' Collector@Example.com ', 'open', 'artist-admin',
          'bad-email-key', '${digest('1')}', '${now}', '${now}')
      `), /constraint/i);
      assert.throws(() => db.exec(`
        INSERT INTO artist_reconnection_cases
          (id, recipient_email, status, created_by_user_id, idempotency_key,
           request_digest, created_at, updated_at)
        VALUES ('bad-digest', 'collector@example.com', 'open', 'artist-admin',
          'bad-digest-key', '${'G'.repeat(64)}', '${now}', '${now}')
      `), /constraint/i);

      for (const values of [
        `'bad-unresolved', 'UL-100', NULL, NULL, 'unresolved'`,
        `'bad-identified', 'UL-100', NULL, NULL, 'identified'`,
        `'bad-linked', 'UL-100', '${numberedEdition(1, 64)}', NULL, 'identity_linked'`,
        `'bad-json', 'UL-100', '{not-json}', NULL, 'identified'`,
        `'bad-json-null', 'UL-100', 'null', NULL, 'identified'`,
      ]) {
        assert.throws(() => db.exec(`
          INSERT INTO artist_artwork_records
            (id, artwork_id, edition_json, keeper_piece_id, identification_status,
             created_by_user_id, created_at, updated_at)
          VALUES (${values}, 'artist-admin', '${now}', '${now}')
        `), /constraint|identity/i);
      }

      assert.throws(() => db.exec(`
        INSERT INTO artist_verified_sales
          (id, occurrence_precision, occurred_on, total_minor,
           verified_by_user_id, idempotency_key, request_digest, recorded_at)
        VALUES ('bad-total', 'unknown', NULL, 100, 'artist-admin',
          'bad-total-key', '${digest('2')}', '${now}')
      `), /constraint/i);

      seedCaseAndRecords(db);
      db.exec(`
        INSERT INTO artist_verified_sales
          (id, occurrence_precision, occurred_on, verified_by_user_id,
           idempotency_key, request_digest, recorded_at)
        VALUES ('sale-for-item', 'unknown', NULL, 'artist-admin',
          'sale-for-item-key', '${digest('3')}', '${now}')
      `);
      assert.throws(() => db.exec(`
        INSERT INTO artist_verified_sale_items
          (id, sale_id, artwork_record_id, amount_minor, created_at)
        VALUES ('bad-item-money', 'sale-for-item', 'record-unresolved', 100, '${now}')
      `), /constraint/i);
      assert.throws(() => db.exec(`
        INSERT INTO artist_artwork_ledger_entries
          (id, artwork_record_id, created_by_user_id, idempotency_key,
           request_digest, created_at)
        VALUES ('empty-ledger', 'record-unresolved', 'artist-admin',
          'empty-ledger-key', '${digest('4')}', '${now}')
      `), /constraint/i);
      assert.throws(() => db.exec(`
        INSERT INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
        VALUES ('bad-media', 'record-unresolved', 'certificate_image', 'media/ref',
          '${'F'.repeat(64)}', 'image/gif', 0, 'artist-admin', '${now}')
      `), /constraint/i);
    } finally {
      db.close();
    }
  });

  it('binds canonical unique and numbered edition identities to the exact keeper piece', () => {
    const db = database();
    try {
      seedCaseAndRecords(db);
      db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, keeper_piece_id, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES ('record-linked-unique', 'SIG-200', '${uniqueEdition}', 'kp-sale-unique',
          'identity_linked', 'artist-admin', '${now}', '${now}')
      `);
      assert.equal(count(db, 'artist_artwork_records'), 4);

      for (const [id, artworkId, editionJson, keeperPieceId] of [
        ['noncanonical-edition', 'SIG-201', '{"editionNumber":0}', null],
        ['mismatched-artwork', 'UL-999', numberedEdition(2, 64), 'kp-sale-two'],
        ['mismatched-numbered-edition', 'UL-101', numberedEdition(1, 64), 'kp-sale-two'],
        ['mismatched-unique-edition', 'SIG-200', numberedEdition(1, 1), 'kp-sale-unique'],
      ] as const) {
        assert.throws(() => db.prepare(`
          INSERT INTO artist_artwork_records
            (id, artwork_id, edition_json, keeper_piece_id, identification_status,
             created_by_user_id, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, 'artist-admin', ?6, ?6)
        `).run(
          id, artworkId, editionJson, keeperPieceId,
          keeperPieceId === null ? 'identified' : 'identity_linked', now,
        ), /constraint|identity|edition|keeper/i, id);
      }
      assert.equal(count(db, 'artist_artwork_records'), 4);

      db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES
          ('record-link-wrong-artwork', 'UL-999', '${numberedEdition(2, 64)}', 'identified',
           'artist-admin', '${now}', '${now}'),
          ('record-link-wrong-edition', 'UL-101', '${numberedEdition(1, 64)}', 'identified',
           'artist-admin', '${now}', '${now}')
      `);
      for (const [id, artworkRecordId, artworkId, editionJson] of [
        ['event-link-wrong-artwork', 'record-link-wrong-artwork', 'UL-999', numberedEdition(2, 64)],
        ['event-link-wrong-edition', 'record-link-wrong-edition', 'UL-101', numberedEdition(1, 64)],
      ] as const) {
        assert.throws(() => db.prepare(`
          INSERT INTO artist_artwork_record_events
            (id, artwork_record_id, action, before_json, after_json,
             resulting_version, actor_user_id, idempotency_key, request_digest, created_at)
          VALUES (?1, ?2, 'identity_linked', ?3, ?4, 2,
            'artist-admin', ?5, ?6, ?7)
        `).run(
          id,
          artworkRecordId,
          recordSnapshot({
            artworkId, editionJson, keeperPieceId: null,
            identificationStatus: 'identified', recordVersion: 1,
          }),
          recordSnapshot({
            artworkId, editionJson, keeperPieceId: 'kp-sale-two',
            identificationStatus: 'identity_linked', recordVersion: 2,
          }),
          `${id}-key`, digest('0'), now,
        ), /snapshot|identity|edition|keeper/i, id);
      }
      assert.equal(count(db, 'artist_artwork_record_events'), 0);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('rejects noncanonical exact, month, year, and unknown occurrence dates', () => {
    const db = database();
    try {
      const invalid = [
        ['exact', '2026-02-30'], ['exact', '2026-8-01'],
        ['exact', '2026-08-32'],
        ['month', '2026-13'], ['month', '2026-8'],
        ['year', '26'], ['year', '2026-01'],
        ['unknown', '2026-08-01'],
      ];
      for (const [index, [precision, occurredOn]] of invalid.entries()) {
        assert.throws(() => db.prepare(`
          INSERT INTO artist_verified_sales
            (id, occurrence_precision, occurred_on, verified_by_user_id,
             idempotency_key, request_digest, recorded_at)
          VALUES (?1, ?2, ?3, 'artist-admin', ?4, ?5, ?6)
        `).run(
          `invalid-date-${index}`, precision, occurredOn,
          `invalid-date-key-${index}`, digest('5'), now,
        ), /constraint/i, `${precision}:${occurredOn}`);
      }
      assert.equal(count(db, 'artist_verified_sales'), 0);
      seedCaseAndRecords(db);
      db.exec(`
        INSERT INTO artist_verified_sales
          (id, occurrence_precision, occurred_on, verified_by_user_id,
           idempotency_key, request_digest, recorded_at)
        VALUES ('sale-invalid-price', 'unknown', NULL, 'artist-admin',
          'sale-invalid-price-key', '${digest('6')}', '${now}');
        INSERT INTO artist_verified_sale_items
          (id, sale_id, artwork_record_id, amount_minor, currency, created_at)
        VALUES ('item-invalid-price', 'sale-invalid-price', 'record-unresolved',
          100, 'USD', '${now}');
      `);
      for (const [index, [precision, occurredOn]] of invalid.entries()) {
        assert.throws(() => db.prepare(`
          INSERT INTO artist_artwork_price_entries
            (id, artwork_record_id, sale_item_id, amount_minor, currency, occurred_on,
             occurrence_precision, recorded_at)
          VALUES (?1, 'record-unresolved', 'item-invalid-price', 100, 'USD', ?2, ?3, ?4)
        `).run(`invalid-price-date-${index}`, occurredOn, precision, now), /constraint|sale facts/i);
      }
      assert.equal(count(db, 'artist_artwork_price_entries'), 0);
    } finally {
      db.close();
    }
  });

  it('requires canonical UTC millisecond timestamps on every permanent private record', () => {
    const db = database();
    try {
      const invalidTimestamps = [
        '2026-02-30T12:00:00.000Z',
        '2026-08-32T12:00:00.000Z',
        '2026-13-10T12:00:00.000Z',
        '2026-08-10T24:00:00.000Z',
        ' 2026-08-10T12:00:00.000Z',
        '2026-08-10T12:00:00.000Z ',
        '2026-08-10T12:00:00Z',
        '2026-08-10T12:00:00.000+00:00',
        '2025-02-29T12:00:00.000Z',
      ];
      for (const [index, timestamp] of invalidTimestamps.entries()) {
        assert.throws(() => db.prepare(`
          INSERT INTO artist_reconnection_cases
            (id, recipient_email, status, created_by_user_id, idempotency_key,
             request_digest, created_at, updated_at)
          VALUES (?1, 'timestamp@example.com', 'open', 'artist-admin', ?2, ?3, ?4, ?5)
        `).run(`bad-timestamp-${index}`, `bad-timestamp-key-${index}`,
          digest('1'), timestamp, now), /constraint/i, timestamp);
      }
      assert.equal(count(db, 'artist_reconnection_cases'), 0);

      seedCaseAndRecords(db);
      insertPrimarySale(db);
      db.exec(`
        INSERT INTO artist_artwork_records
          (id, identification_status, created_by_user_id, created_at, updated_at)
        VALUES ('record-timestamp', 'unresolved', 'artist-admin', '${now}', '${now}')
      `);
      const outOfRangeTimestamp = '2026-13-10T12:00:00.000Z';
      const invalidSql = [
        `INSERT INTO artist_reconnection_cases
          (id, recipient_email, status, created_by_user_id, idempotency_key,
           request_digest, created_at, updated_at)
         VALUES ('bad-updated-at', 'updated@example.com', 'open', 'artist-admin',
           'bad-updated-at-key', '${digest('2')}', '${now}', '${outOfRangeTimestamp}')`,
        `INSERT INTO artist_artwork_records
          (id, identification_status, created_by_user_id, created_at, updated_at)
         VALUES ('bad-record-created-at', 'unresolved', 'artist-admin',
           '${outOfRangeTimestamp}', '${now}')`,
        `INSERT INTO artist_artwork_records
          (id, identification_status, created_by_user_id, created_at, updated_at)
         VALUES ('bad-record-updated-at', 'unresolved', 'artist-admin',
           '${now}', '${outOfRangeTimestamp}')`,
        `INSERT INTO artist_verified_sales
          (id, occurrence_precision, verified_by_user_id, idempotency_key,
           request_digest, recorded_at)
         VALUES ('bad-sale-recorded-at', 'unknown', 'artist-admin',
           'bad-sale-recorded-at-key', '${digest('3')}', '${outOfRangeTimestamp}')`,
        `INSERT INTO artist_verified_sale_items
          (id, sale_id, artwork_record_id, created_at)
         VALUES ('bad-item-created-at', 'sale-one', 'record-timestamp', '${outOfRangeTimestamp}')`,
        `INSERT INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
         VALUES ('bad-media-created-at', 'record-unresolved', 'certificate_image',
           'artist-sales/bad-timestamp.jpg', '${digest('4')}', 'image/jpeg', 10,
           'artist-admin', '${outOfRangeTimestamp}')`,
        `INSERT INTO artist_artwork_ledger_entries
          (id, artwork_record_id, message, created_by_user_id,
           idempotency_key, request_digest, created_at)
         VALUES ('bad-ledger-created-at', 'record-unresolved', 'Timestamp check.',
           'artist-admin', 'bad-ledger-created-at-key', '${digest('5')}', '${outOfRangeTimestamp}')`,
        `INSERT INTO artist_artwork_price_entries
          (id, artwork_record_id, sale_item_id, amount_minor, currency,
           occurred_on, occurrence_precision, recorded_at)
         VALUES ('bad-price-recorded-at', 'record-unresolved', 'item-one', 100000, 'USD',
           '2026-08-01', 'exact', '${outOfRangeTimestamp}')`,
        `INSERT INTO artist_reconnection_events
          (id, reconnection_case_id, event_type, private_note, actor_user_id,
           idempotency_key, request_digest, created_at)
         VALUES ('bad-reconnect-created-at', 'case-one', 'note_added', 'Timestamp check.',
           'artist-admin', 'bad-reconnect-created-at-key', '${digest('6')}', '${outOfRangeTimestamp}')`,
      ];
      for (const sql of invalidSql) {
        assert.throws(() => db.exec(sql), /constraint/i);
      }

      const beforeRecord = recordSnapshot({
        artworkId: null, editionJson: null, keeperPieceId: null,
        identificationStatus: 'unresolved', recordVersion: 1,
      });
      const afterRecord = recordSnapshot({
        artworkId: 'SIG-201', editionJson: uniqueEdition, keeperPieceId: null,
        identificationStatus: 'identified', recordVersion: 2,
      });
      assert.throws(() => db.prepare(`
        INSERT INTO artist_artwork_record_events
          (id, artwork_record_id, action, before_json, after_json, resulting_version,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('bad-record-event-created-at', 'record-unresolved', 'identified', ?1, ?2, 2,
          'artist-admin', 'bad-record-event-created-at-key', ?3, ?4)
      `).run(beforeRecord, afterRecord, digest('7'), outOfRangeTimestamp), /constraint/i);
      assert.throws(() => db.prepare(`
        INSERT INTO artist_verified_sale_events
          (id, sale_id, sequence, event_type, before_json, after_json,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('bad-sale-event-created-at', 'sale-one', 1, 'corrected', ?1, ?2,
          'artist-admin', 'bad-sale-event-created-at-key', ?3, ?4)
      `).run(
        saleSnapshot(), saleSnapshot({ totalMinor: 300001 }), digest('8'), outOfRangeTimestamp,
      ), /constraint/i);

      for (const id of [
        'bad-updated-at', 'bad-record-created-at', 'bad-record-updated-at',
        'bad-sale-recorded-at', 'bad-item-created-at', 'bad-media-created-at',
        'bad-ledger-created-at', 'bad-price-recorded-at', 'bad-reconnect-created-at',
        'bad-record-event-created-at', 'bad-sale-event-created-at',
      ]) {
        assert.equal(db.prepare(`
          SELECT id FROM (
            SELECT id FROM artist_reconnection_cases
            UNION ALL SELECT id FROM artist_artwork_records
            UNION ALL SELECT id FROM artist_artwork_record_events
            UNION ALL SELECT id FROM artist_verified_sales
            UNION ALL SELECT id FROM artist_verified_sale_events
            UNION ALL SELECT id FROM artist_verified_sale_items
            UNION ALL SELECT id FROM artist_artwork_media
            UNION ALL SELECT id FROM artist_artwork_ledger_entries
            UNION ALL SELECT id FROM artist_artwork_price_entries
            UNION ALL SELECT id FROM artist_reconnection_events
          ) WHERE id = ?1
        `).get(id), undefined, id);
      }

      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('rejects corrected sale snapshots whose date functions normalize to NULL', () => {
    const db = database();
    try {
      seedCaseAndRecords(db);
      insertPrimarySale(db);
      for (const [id, overrides] of [
        ['bad-correction-date', { occurredOn: '2026-08-32', totalMinor: 300001 }],
        ['bad-correction-month', {
          occurrencePrecision: 'month', occurredOn: '2026-13', totalMinor: 300001,
        }],
        ['bad-correction-timestamp', {
          recordedAt: '2026-13-10T12:00:00.000Z', totalMinor: 300001,
        }],
      ] as const) {
        assert.throws(() => db.prepare(`
          INSERT INTO artist_verified_sale_events
            (id, sale_id, sequence, event_type, before_json, after_json,
             actor_user_id, idempotency_key, request_digest, created_at)
          VALUES (?1, 'sale-one', 1, 'corrected', ?2, ?3,
            'artist-admin', ?4, ?5, ?6)
        `).run(
          id, saleSnapshot(), saleSnapshot(overrides), `${id}-key`, digest('9'), now,
        ), /snapshot|date|invalid/i, id);
      }
      assert.equal(count(db, 'artist_verified_sale_events'), 0);

      const monthSnapshot = saleSnapshot({
        occurrencePrecision: 'month', occurredOn: '2026-08', totalMinor: 300001,
      });
      const yearSnapshot = saleSnapshot({
        occurrencePrecision: 'year', occurredOn: '2026', totalMinor: 300002,
      });
      const unknownSnapshot = saleSnapshot({
        occurrencePrecision: 'unknown', occurredOn: null, totalMinor: 300003,
      });
      for (const [id, sequence, before, after] of [
        ['valid-correction-month', 1, saleSnapshot(), monthSnapshot],
        ['valid-correction-year', 2, monthSnapshot, yearSnapshot],
        ['valid-correction-unknown', 3, yearSnapshot, unknownSnapshot],
      ] as const) {
        db.prepare(`
          INSERT INTO artist_verified_sale_events
            (id, sale_id, sequence, event_type, before_json, after_json,
             actor_user_id, idempotency_key, request_digest, created_at)
          VALUES (?1, 'sale-one', ?2, 'corrected', ?3, ?4,
            'artist-admin', ?5, ?6, ?7)
        `).run(id, sequence, before, after, `${id}-key`, digest('a'), now);
      }
      assert.equal(count(db, 'artist_verified_sale_events'), 3);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('permits artwork identification changes only through an exact preinserted event', () => {
    const db = database();
    try {
      seedCaseAndRecords(db);
      assert.throws(() => db.exec(`
        UPDATE artist_artwork_records
           SET artwork_id = 'UL-103', edition_json = '${uniqueEdition}',
               identification_status = 'identified', record_version = 2,
               updated_at = '${now}'
         WHERE id = 'record-unresolved'
      `), /authorized|event/i);

      const before = recordSnapshot({
        artworkId: null, editionJson: null, keeperPieceId: null,
        identificationStatus: 'unresolved', recordVersion: 1,
      });
      const after = recordSnapshot({
        artworkId: 'UL-103', editionJson: uniqueEdition, keeperPieceId: null,
        identificationStatus: 'identified', recordVersion: 2,
      });
      db.prepare(`
        INSERT INTO artist_artwork_record_events
          (id, artwork_record_id, action, before_json, after_json,
           resulting_version, actor_user_id, idempotency_key, request_digest, created_at)
        VALUES
          ('record-event-one', 'record-unresolved', 'identified', ?1, ?2,
           2, 'artist-admin', 'record-event-one-key', ?3, ?4)
      `).run(before, after, digest('6'), now);
      db.exec(`
        UPDATE artist_artwork_records
           SET artwork_id = 'UL-103', edition_json = '${uniqueEdition}',
               keeper_piece_id = NULL, identification_status = 'identified',
               record_version = 2, last_event_id = 'record-event-one',
               updated_at = '${now}'
         WHERE id = 'record-unresolved'
      `);
      assert.deepEqual({ ...db.prepare(`
        SELECT artwork_id, keeper_piece_id, identification_status,
               record_version, last_event_id
          FROM artist_artwork_records WHERE id = 'record-unresolved'
      `).get() }, {
        artwork_id: 'UL-103', keeper_piece_id: null,
        identification_status: 'identified', record_version: 2,
        last_event_id: 'record-event-one',
      });

      assert.throws(() => db.prepare(`
        INSERT INTO artist_artwork_record_events
          (id, artwork_record_id, action, before_json, after_json,
           resulting_version, actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('bad-version-event', 'record-identified', 'identification_corrected',
          ?1, ?2, 7, 'artist-admin', 'bad-version-event-key', ?3, ?4)
      `).run(
        recordSnapshot({
          artworkId: 'UL-102', editionJson: uniqueEdition, keeperPieceId: null,
          identificationStatus: 'identified', recordVersion: 1,
        }),
        recordSnapshot({
          artworkId: 'UL-104', editionJson: uniqueEdition, keeperPieceId: null,
          identificationStatus: 'identified', recordVersion: 7,
        }), digest('7'), now,
      ), /snapshot|version|event/i);

      assert.throws(() => db.prepare(`
        INSERT INTO artist_artwork_record_events
          (id, artwork_record_id, action, before_json, after_json,
           resulting_version, actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('bad-action-event', 'record-identified', 'identity_linked',
          ?1, ?2, 2, 'artist-admin', 'bad-action-event-key', ?3, ?4)
      `).run(
        recordSnapshot({
          artworkId: 'UL-102', editionJson: uniqueEdition, keeperPieceId: null,
          identificationStatus: 'identified', recordVersion: 1,
        }),
        recordSnapshot({
          artworkId: 'UL-104', editionJson: uniqueEdition, keeperPieceId: null,
          identificationStatus: 'identified', recordVersion: 2,
        }), digest('8'), now,
      ), /snapshot|action|event/i);

      const pendingAfter = recordSnapshot({
        artworkId: 'UL-101', editionJson: numberedEdition(2, 64), keeperPieceId: null,
        identificationStatus: 'identified', recordVersion: 2,
      });
      db.prepare(`
        INSERT INTO artist_artwork_record_events
          (id, artwork_record_id, action, before_json, after_json,
           resulting_version, actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('pending-record-event', 'record-identified', 'identification_corrected',
          ?1, ?2, 2, 'artist-admin', 'pending-record-event-key', ?3, ?4)
      `).run(
        recordSnapshot({
          artworkId: 'UL-102', editionJson: uniqueEdition, keeperPieceId: null,
          identificationStatus: 'identified', recordVersion: 1,
        }), pendingAfter, digest('9'), now,
      );
      assert.throws(() => db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, keeper_piece_id, identification_status,
           record_version, last_event_id, created_by_user_id, created_at, updated_at)
        VALUES ('forged-version', 'UL-101', '${numberedEdition(2, 64)}', NULL, 'identified',
          2, 'pending-record-event', 'artist-admin', '${now}', '${now}')
      `), /initial|version|event/i);

      db.exec(`
        UPDATE artist_artwork_records
           SET artwork_id = 'UL-101', edition_json = '${numberedEdition(2, 64)}',
               keeper_piece_id = NULL, identification_status = 'identified',
               record_version = 2, last_event_id = 'pending-record-event',
               updated_at = '${now}'
         WHERE id = 'record-identified'
      `);
      const linkBefore = recordSnapshot({
        artworkId: 'UL-101', editionJson: numberedEdition(2, 64), keeperPieceId: null,
        identificationStatus: 'identified', recordVersion: 2,
      });
      const linkAfter = recordSnapshot({
        artworkId: 'UL-101', editionJson: numberedEdition(2, 64), keeperPieceId: 'kp-sale-two',
        identificationStatus: 'identity_linked', recordVersion: 3,
      });
      db.prepare(`
        INSERT INTO artist_artwork_record_events
          (id, artwork_record_id, action, before_json, after_json,
           resulting_version, actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('link-record-event', 'record-identified', 'identity_linked',
          ?1, ?2, 3, 'artist-admin', 'link-record-event-key', ?3, ?4)
      `).run(linkBefore, linkAfter, digest('a'), now);
      db.exec(`
        UPDATE artist_artwork_records
           SET keeper_piece_id = 'kp-sale-two', identification_status = 'identity_linked',
               record_version = 3, last_event_id = 'link-record-event',
               updated_at = '${now}'
         WHERE id = 'record-identified'
      `);
      assert.equal(db.prepare(`
        SELECT identification_status FROM artist_artwork_records
         WHERE id = 'record-identified'
      `).get()?.identification_status, 'identity_linked');

      assert.throws(
        () => db.exec(`UPDATE artist_artwork_record_events SET id = id WHERE id = 'record-event-one'`),
        /append-only/i,
      );
      assert.throws(
        () => db.exec(`DELETE FROM artist_artwork_record_events WHERE id = 'record-event-one'`),
        /append-only/i,
      );
    } finally {
      db.close();
    }
  });

  it('rejects UPDATE OR REPLACE when a pending identity event targets another artwork record keeper', () => {
    const db = database();
    try {
      db.exec('PRAGMA recursive_triggers = OFF');
      seedCaseAndRecords(db);
      db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES ('record-link-target', 'UL-101', '${numberedEdition(2, 64)}', 'identified',
          'artist-admin', '${now}', '${now}')
      `);
      const before = recordSnapshot({
        artworkId: 'UL-101', editionJson: numberedEdition(2, 64), keeperPieceId: null,
        identificationStatus: 'identified', recordVersion: 1,
      });
      const after = recordSnapshot({
        artworkId: 'UL-101', editionJson: numberedEdition(2, 64), keeperPieceId: 'kp-sale-two',
        identificationStatus: 'identity_linked', recordVersion: 2,
      });
      db.prepare(`
        INSERT INTO artist_artwork_record_events
          (id, artwork_record_id, action, before_json, after_json,
           resulting_version, actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('pending-link-event', 'record-link-target', 'identity_linked',
          ?1, ?2, 2, 'artist-admin', 'pending-link-event-key', ?3, ?4)
      `).run(before, after, digest('b'), now);
      db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, keeper_piece_id, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES ('record-later-owner', 'UL-101', '${numberedEdition(2, 64)}', 'kp-sale-two',
          'identity_linked', 'artist-admin', '${now}', '${now}')
      `);

      const stateBefore = {
        records: db.prepare(`
          SELECT id, artwork_id, edition_json, keeper_piece_id,
                 identification_status, record_version, last_event_id,
                 created_by_user_id, created_at, updated_at
            FROM artist_artwork_records
           WHERE id IN ('record-link-target', 'record-later-owner') ORDER BY id
        `).all().map((row) => ({ ...row })),
        events: db.prepare(`
          SELECT * FROM artist_artwork_record_events
           WHERE id = 'pending-link-event'
        `).all().map((row) => ({ ...row })),
      };

      assert.throws(() => db.exec(`
        UPDATE OR REPLACE artist_artwork_records
           SET keeper_piece_id = 'kp-sale-two',
               identification_status = 'identity_linked',
               record_version = 2,
               last_event_id = 'pending-link-event',
               updated_at = '${now}'
         WHERE id = 'record-link-target'
      `), /collision|keeper|identity/i);

      assert.deepEqual({
        records: db.prepare(`
          SELECT id, artwork_id, edition_json, keeper_piece_id,
                 identification_status, record_version, last_event_id,
                 created_by_user_id, created_at, updated_at
            FROM artist_artwork_records
           WHERE id IN ('record-link-target', 'record-later-owner') ORDER BY id
        `).all().map((row) => ({ ...row })),
        events: db.prepare(`
          SELECT * FROM artist_artwork_record_events
           WHERE id = 'pending-link-event'
        `).all().map((row) => ({ ...row })),
      }, stateBefore);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('prevents one keeper identity from linking to two private artwork records', () => {
    const db = database();
    try {
      seedCaseAndRecords(db);
      assert.throws(() => db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, keeper_piece_id, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES ('duplicate-link', 'UL-100', '${numberedEdition(1, 64)}', 'kp-sale-one',
          'identity_linked', 'artist-admin', '${now}', '${now}')
      `), /unique|constraint|collision/i);
      assert.equal(count(db, 'artist_artwork_records'), 3);
    } finally {
      db.close();
    }
  });

  it('keeps every permanent private record append-only and leaves base sales unchanged by corrections', () => {
    const db = database();
    try {
      seedCaseAndRecords(db);
      insertPrimarySale(db);
      const beforeSale = saleSnapshot();
      const afterSale = saleSnapshot({ totalMinor: 310000 });
      assert.throws(() => db.prepare(`
        INSERT INTO artist_verified_sale_events
          (id, sale_id, sequence, event_type, before_json, after_json,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('invalid-sale-event', 'sale-one', 1, 'corrected', ?1, ?2,
          'artist-admin', 'invalid-sale-event-key', ?3, ?4)
      `).run(
        beforeSale,
        saleSnapshot({ reconnectionCaseId: 'missing-case', verifiedByUserId: 'missing-user' }),
        digest('2'), now,
      ), /snapshot|foreign|reference/i);
      db.prepare(`
        INSERT INTO artist_verified_sale_events
          (id, sale_id, sequence, event_type, before_json, after_json,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('sale-event-one', 'sale-one', 1, 'corrected', ?1, ?2,
          'artist-admin', 'sale-event-one-key', ?3, ?4)
      `).run(beforeSale, afterSale, digest('3'), now);
      db.exec(`
        INSERT INTO artist_reconnection_events
          (id, reconnection_case_id, event_type, private_note, actor_user_id,
           idempotency_key, request_digest, created_at)
        VALUES ('reconnect-event-one', 'case-one', 'note_added', 'Call next week.',
          'artist-admin', 'reconnect-event-one-key', '${digest('4')}', '${now}');
        INSERT INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
        VALUES ('media-one', 'record-unresolved', 'certificate_image',
          'artist-sales/certificate-one.jpg', '${digest('5')}', 'image/jpeg', 100,
          'artist-admin', '${now}');
        INSERT INTO artist_artwork_ledger_entries
          (id, artwork_record_id, sale_id, message, created_by_user_id,
           idempotency_key, request_digest, created_at)
        VALUES ('ledger-one', 'record-unresolved', 'sale-one', 'Archived receipt found.',
          'artist-admin', 'ledger-one-key', '${digest('6')}', '${now}');
        INSERT INTO artist_artwork_price_entries
          (id, artwork_record_id, sale_item_id, amount_minor, currency,
           occurred_on, occurrence_precision, recorded_at)
        VALUES ('price-one', 'record-unresolved', 'item-one', 100000, 'USD',
          '2026-08-01', 'exact', '${now}');
      `);

      const immutableRows = [
        ['artist_reconnection_cases', 'case-one'],
        ['artist_reconnection_events', 'reconnect-event-one'],
        ['artist_verified_sales', 'sale-one'],
        ['artist_verified_sale_events', 'sale-event-one'],
        ['artist_verified_sale_items', 'item-one'],
        ['artist_artwork_media', 'media-one'],
        ['artist_artwork_ledger_entries', 'ledger-one'],
        ['artist_artwork_price_entries', 'price-one'],
      ];
      for (const [table, id] of immutableRows) {
        assert.throws(
          () => db.exec(`UPDATE ${table} SET id = id || '-changed' WHERE id = '${id}'`),
          /append-only|permanent|immutable/i, `${table} update`,
        );
        assert.throws(
          () => db.exec(`DELETE FROM ${table} WHERE id = '${id}'`),
          /append-only|permanent|immutable/i, `${table} delete`,
        );
      }
      assert.throws(
        () => db.exec(`DELETE FROM artist_artwork_records WHERE id = 'record-unresolved'`),
        /permanent|delete/i,
      );
      assert.equal(db.prepare(`
        SELECT total_minor FROM artist_verified_sales WHERE id = 'sale-one'
      `).get()?.total_minor, 300000);
      assert.equal(count(db, 'artist_verified_sale_events'), 1);
    } finally {
      db.close();
    }
  });

  it('rejects INSERT OR REPLACE collisions without changing permanent rows or dependents', () => {
    const db = database();
    try {
      db.exec('PRAGMA recursive_triggers = OFF');
      seedCaseAndRecords(db);
      insertPrimarySale(db);
      db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES ('record-standalone', NULL, NULL, 'unresolved',
          'artist-admin', '${now}', '${now}');
        INSERT INTO artist_reconnection_events
          (id, reconnection_case_id, event_type, private_note, actor_user_id,
           idempotency_key, request_digest, created_at)
        VALUES ('reconnect-event-one', 'case-one', 'note_added', 'Original note.',
          'artist-admin', 'reconnect-event-one-key', '${digest('3')}', '${now}');
        INSERT INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
        VALUES ('media-one', 'record-unresolved', 'identification_evidence',
          'artist-sales/original.webp', '${digest('4')}', 'image/webp', 100,
          'artist-admin', '${now}');
        INSERT INTO artist_artwork_ledger_entries
          (id, artwork_record_id, sale_id, message, media_id, created_by_user_id,
           idempotency_key, request_digest, created_at)
        VALUES ('ledger-one', 'record-unresolved', 'sale-one', 'Original ledger note.',
          'media-one', 'artist-admin', 'ledger-one-key', '${digest('5')}', '${now}');
        INSERT INTO artist_artwork_price_entries
          (id, artwork_record_id, sale_item_id, amount_minor, currency,
           occurred_on, occurrence_precision, recorded_at)
        VALUES ('price-one', 'record-unresolved', 'item-one', 100000, 'USD',
          '2026-08-01', 'exact', '${now}');
      `);
      db.prepare(`
        INSERT INTO artist_verified_sale_events
          (id, sale_id, sequence, event_type, before_json, after_json,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('sale-event-one', 'sale-one', 1, 'corrected', ?1, ?2,
          'artist-admin', 'sale-event-one-key', ?3, ?4)
      `).run(saleSnapshot(), saleSnapshot({ totalMinor: 310000 }), digest('6'), now);

      const permanentTables = [
        'artist_reconnection_cases', 'artist_reconnection_events',
        'artist_artwork_records', 'artist_artwork_record_events',
        'artist_verified_sales', 'artist_verified_sale_events',
        'artist_verified_sale_items', 'artist_artwork_media',
        'artist_artwork_ledger_entries', 'artist_artwork_price_entries',
      ];
      const countsBefore = Object.fromEntries(
        permanentTables.map((table) => [table, count(db, table)]),
      );
      const originals = {
        case: { ...db.prepare(`SELECT * FROM artist_reconnection_cases WHERE id = 'case-one'`).get() },
        record: { ...db.prepare(`SELECT * FROM artist_artwork_records WHERE id = 'record-standalone'`).get() },
        sale: { ...db.prepare(`SELECT * FROM artist_verified_sales WHERE id = 'sale-one'`).get() },
        event: { ...db.prepare(`SELECT * FROM artist_verified_sale_events WHERE id = 'sale-event-one'`).get() },
        media: { ...db.prepare(`SELECT * FROM artist_artwork_media WHERE id = 'media-one'`).get() },
        ledger: { ...db.prepare(`SELECT * FROM artist_artwork_ledger_entries WHERE id = 'ledger-one'`).get() },
        price: { ...db.prepare(`SELECT * FROM artist_artwork_price_entries WHERE id = 'price-one'`).get() },
      };

      const replacementSql = [
        `INSERT OR REPLACE INTO artist_reconnection_cases
          (id, recipient_email, status, created_by_user_id, idempotency_key,
           request_digest, created_at, updated_at)
         VALUES ('case-one', 'attacker@example.com', 'closed', 'artist-second',
           'attacker-case-key', '${digest('7')}', '${now}', '${now}')`,
        `INSERT OR REPLACE INTO artist_artwork_records
          (id, artwork_id, edition_json, keeper_piece_id, identification_status,
           created_by_user_id, created_at, updated_at)
         VALUES ('record-standalone', 'UL-101', '${numberedEdition(2, 64)}', 'kp-sale-two',
           'identity_linked', 'artist-second', '${now}', '${now}')`,
        `INSERT OR REPLACE INTO artist_verified_sales
          (id, occurrence_precision, occurred_on, buyer_email, verified_by_user_id,
           idempotency_key, request_digest, recorded_at)
         VALUES ('sale-one', 'unknown', NULL, 'attacker@example.com', 'artist-second',
           'attacker-sale-key', '${digest('8')}', '${now}')`,
        `INSERT OR REPLACE INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
         VALUES ('media-one', 'record-unresolved', 'certificate_image',
           'artist-sales/replaced.png', '${digest('9')}', 'image/png', 200,
           'artist-second', '${now}')`,
        `INSERT OR REPLACE INTO artist_artwork_ledger_entries
          (id, artwork_record_id, message, created_by_user_id,
           idempotency_key, request_digest, created_at)
         VALUES ('ledger-one', 'record-unresolved', 'Replacement ledger note.',
           'artist-second', 'attacker-ledger-key', '${digest('a')}', '${now}')`,
        `INSERT OR REPLACE INTO artist_artwork_price_entries
          (id, artwork_record_id, sale_item_id, amount_minor, currency,
           occurred_on, occurrence_precision, recorded_at)
         VALUES ('price-one', 'record-unresolved', 'item-one', 100000, 'USD',
           '2026-08-01', 'exact', '${now}')`,
      ];
      for (const sql of replacementSql) {
        assert.throws(() => db.exec(sql), /collision/i);
      }
      assert.throws(() => db.prepare(`
        INSERT OR REPLACE INTO artist_verified_sale_events
          (id, sale_id, sequence, event_type, before_json, after_json,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('sale-event-one', 'sale-one', 1, 'corrected', ?1, ?2,
          'artist-second', 'replacement-event-key', ?3, ?4)
      `).run(
        saleSnapshot(), saleSnapshot({ totalMinor: 320000 }), digest('b'), now,
      ), /collision/i);

      assert.throws(() => db.exec(`
        INSERT OR REPLACE INTO artist_reconnection_cases
          (id, recipient_email, status, created_by_user_id, idempotency_key,
           request_digest, created_at, updated_at)
        VALUES ('case-reused-key', 'other@example.com', 'open', 'artist-admin',
          'case-one-key', '${digest('c')}', '${now}', '${now}')
      `), /collision/i);
      assert.throws(() => db.exec(`
        INSERT OR REPLACE INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
        VALUES ('media-reused-reference', 'record-unresolved', 'certificate_image',
          'artist-sales/original.webp', '${digest('d')}', 'image/webp', 100,
          'artist-admin', '${now}')
      `), /collision/i);

      assert.deepEqual(Object.fromEntries(
        permanentTables.map((table) => [table, count(db, table)]),
      ), countsBefore);
      assert.deepEqual({
        case: { ...db.prepare(`SELECT * FROM artist_reconnection_cases WHERE id = 'case-one'`).get() },
        record: { ...db.prepare(`SELECT * FROM artist_artwork_records WHERE id = 'record-standalone'`).get() },
        sale: { ...db.prepare(`SELECT * FROM artist_verified_sales WHERE id = 'sale-one'`).get() },
        event: { ...db.prepare(`SELECT * FROM artist_verified_sale_events WHERE id = 'sale-event-one'`).get() },
        media: { ...db.prepare(`SELECT * FROM artist_artwork_media WHERE id = 'media-one'`).get() },
        ledger: { ...db.prepare(`SELECT * FROM artist_artwork_ledger_entries WHERE id = 'ledger-one'`).get() },
        price: { ...db.prepare(`SELECT * FROM artist_artwork_price_entries WHERE id = 'price-one'`).get() },
      }, originals);
    } finally {
      db.close();
    }
  });

  it('preserves every legitimate lineage payload shape while rejecting private payload keys and values', () => {
    const db = database();
    try {
      const legitimatePayloads: Array<[string, Record<string, unknown>]> = [
        ['issued', {}],
        ['issued', { publicCode: 'AR-ABCDEFGH' }],
        ['issued', { pieceId: 'UL-100', editionNumber: 1, publicCode: 'AR-ABCDEFGH' }],
        ['activated', {}],
        ['activated', { plateStatus: 'active' }],
        ['fulfillment_assign', {}],
        ['fulfillment_correct', {}],
        ['fulfillment_correction_out', {}],
        ['fulfillment_correction_in', {}],
        ['fulfillment_ship', {}],
        ['first_bound', {}],
        ['first_bound', { pieceId: 'UL-100', editionNumber: 1 }],
        ['migration_baseline', {}],
        ['link_corrected', { pieceId: 'UL-100', editionNumber: 1 }],
        ['voided', { plateStatus: 'void' }],
        ['superseded', { plateStatus: 'superseded' }],
        ['transferred', {
          fromRef: 'tp-00000000-0000-4000-8000-000000000001',
          toRef: 'tp-00000000-0000-4000-8000-000000000002',
          transferKind: 'gift',
        }],
      ];
      for (const [index, [eventType, payload]] of legitimatePayloads.entries()) {
        db.prepare(`
          INSERT INTO keeper_pieces
            (id, piece_id, edition_number, recovery_code_hash, registered_at)
          VALUES (?1, ?2, 0, ?3, ?4)
        `).run(
          `kp-lineage-positive-${index}`, `UL-${String(200 + index).padStart(3, '0')}`,
          index.toString(16).padStart(64, '0'), now,
        );
        db.prepare(`
          INSERT INTO artwork_lineage_events
            (id, keeper_piece_id, sequence, event_type, event_at,
             previous_hash, event_hash, public_payload_json)
          VALUES (?1, ?2, 1, ?3, ?4, NULL, ?5, ?6)
        `).run(
          `lineage-positive-${index}`, `kp-lineage-positive-${index}`,
          eventType, now, `lineage-positive-hash-${index}`, JSON.stringify(payload),
        );
      }
      const before = count(db, 'artwork_lineage_events');
      db.exec('PRAGMA recursive_triggers = OFF');
      assert.throws(() => db.exec(`
        INSERT OR REPLACE INTO artwork_lineage_events
          (id, keeper_piece_id, sequence, event_type, event_at,
           previous_hash, event_hash, public_payload_json)
        VALUES ('lineage-positive-0', 'kp-lineage-positive-0', 1, 'issued',
          '${now}', NULL, 'replacement-public-hash', '{}')
      `), /collision/i);
      assert.equal(count(db, 'artwork_lineage_events'), before);

      const privatePayloads = [
        { buyerEmail: 'collector@example.com' },
        { amount_minor: 100000, currency: 'USD' },
        { details: { privateNotes: 'Do not publish this.' } },
        { storage_reference: 'artist-sales/private/front.webp' },
        { artistArtworkRecordId: 'record-unresolved' },
        { creatorMessage: 'The collector asked for discretion.' },
        { pieceId: 'collector@example.com' },
        { publicCode: 'artist-sales/private/front.webp' },
      ];
      for (const [index, payload] of privatePayloads.entries()) {
        db.prepare(`
          INSERT INTO keeper_pieces
            (id, piece_id, edition_number, recovery_code_hash, registered_at)
          VALUES (?1, ?2, 0, ?3, ?4)
        `).run(
          `kp-lineage-private-${index}`, `UL-${String(300 + index).padStart(3, '0')}`,
          (100 + index).toString(16).padStart(64, '0'), now,
        );
        assert.throws(() => db.prepare(`
          INSERT INTO artwork_lineage_events
            (id, keeper_piece_id, sequence, event_type, event_at,
             previous_hash, event_hash, public_payload_json)
          VALUES (?1, ?2, 1, 'first_bound', ?3, NULL, ?4, ?5)
        `).run(
          `lineage-private-${index}`, `kp-lineage-private-${index}`, now,
          `lineage-private-hash-${index}`, JSON.stringify(payload),
        ), /private|payload|lineage/i, JSON.stringify(payload));
      }
      assert.equal(count(db, 'artwork_lineage_events'), before);

      assert.throws(() => db.exec(`
        INSERT INTO artwork_lineage_events
          (id, keeper_piece_id, sequence, event_type, event_at,
           previous_hash, event_hash, public_payload_json, buyer_email,
           price_minor, private_record_id, private_note, storage_reference)
        VALUES ('public-private', 'kp-sale-one', 2, 'issued', '${now}',
          '${digest('c')}', '${digest('d')}', '{}', 'collector@example.com',
          10000, 'record-unresolved', 'Private note', 'private/image.webp')
      `), /no column|has no column/i);
      assert.equal(count(db, 'artwork_lineage_events'), before);
      assert.deepEqual(columns(db, 'artwork_lineage_events'), [
        'id', 'keeper_piece_id', 'sequence', 'event_type', 'event_at',
        'previous_hash', 'event_hash', 'public_payload_json',
      ]);
    } finally {
      db.close();
    }
  });

  it('rolls back a partially invalid three-artwork sale transaction without residue', () => {
    const db = database();
    const privateTables = [
      'artist_reconnection_cases', 'artist_reconnection_events',
      'artist_artwork_records', 'artist_artwork_record_events',
      'artist_verified_sales', 'artist_verified_sale_events',
      'artist_verified_sale_items', 'artist_artwork_media',
      'artist_artwork_ledger_entries', 'artist_artwork_price_entries',
    ];
    try {
      const beforeCounts = Object.fromEntries(
        privateTables.map((table) => [table, count(db, table)]),
      );
      assert.equal(Object.keys(beforeCounts).length, 10);
      db.exec('BEGIN IMMEDIATE');
      try {
        seedCaseAndRecords(db);
        db.exec(`
          INSERT INTO artist_verified_sales
            (id, reconnection_case_id, occurrence_precision, occurred_on,
             buyer_email, verified_by_user_id, idempotency_key,
             request_digest, recorded_at)
          VALUES ('sale-rollback', 'case-one', 'year', '2024',
            'collector@example.com', 'artist-admin', 'sale-rollback-key',
            '${digest('e')}', '${now}');
          INSERT INTO artist_verified_sale_items
            (id, sale_id, artwork_record_id, amount_minor, currency, created_at)
          VALUES
            ('rollback-item-one', 'sale-rollback', 'record-unresolved', 100, 'USD', '${now}'),
            ('rollback-item-two', 'sale-rollback', 'record-identified', 200, 'USD', '${now}');
          INSERT INTO artist_verified_sale_items
            (id, sale_id, artwork_record_id, amount_minor, created_at)
          VALUES
            ('rollback-item-three', 'sale-rollback', 'record-linked', 300, '${now}');
        `);
        assert.fail('invalid third sale item unexpectedly committed');
      } catch (error) {
        db.exec('ROLLBACK');
        assert.match(String(error), /constraint/i);
      }
      assert.deepEqual(Object.fromEntries(
        privateTables.map((table) => [table, count(db, table)]),
      ), beforeCounts);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('creates a canonical multi-artwork sale atomically and exactly replays it', async () => {
    const fixture = serviceEnvironment();
    try {
      const created = await createVerifiedSale(fixture.env, saleInput());
      assert.equal(created.replayed, false);
      assert.equal(created.artworkRecordIds.length, 3);
      assert.equal(new Set(created.artworkRecordIds).size, 3);
      assert.equal(count(fixture.db, 'artist_verified_sales'), 1);
      assert.equal(count(fixture.db, 'artist_verified_sale_items'), 3);
      assert.equal(count(fixture.db, 'artist_artwork_records'), 3);
      assert.equal(count(fixture.db, 'artist_artwork_price_entries'), 2);
      assert.deepEqual({ ...fixture.db.prepare(`
        SELECT buyer_email, currency, total_minor, private_reference
          FROM artist_verified_sales WHERE id = ?1
      `).get(created.saleId) }, {
        buyer_email: 'collector@example.com', currency: 'USD', total_minor: 900000,
        private_reference: 'studio-ledger-2018-4',
      });
      assert.equal(fixture.db.prepare(`
        SELECT identification_status FROM artist_artwork_records WHERE id = ?1
      `).get(created.artworkRecordIds[2])?.identification_status, 'unresolved');

      const replay = await createVerifiedSale(fixture.env, saleInput());
      assert.deepEqual(replay, { ...created, replayed: true });
      await assert.rejects(
        createVerifiedSale(fixture.env, saleInput({ buyerEmail: 'changed@example.com' })),
        (error: Error & { code?: string }) => error.code === 'idempotency_conflict',
      );
      assert.equal(count(fixture.db, 'artist_verified_sales'), 1);
    } finally {
      fixture.db.close();
    }
  });

  it('recovers an exact sale replay after a committed response is lost and rolls back every forced failure', async () => {
    const lost = serviceEnvironment();
    try {
      await assert.rejects((async () => {
        await createVerifiedSale(lost.env, saleInput());
        throw new Error('simulated lost response');
      })(), /lost response/);
      const replay = await createVerifiedSale(lost.env, saleInput());
      assert.equal(replay.replayed, true);
      assert.equal(count(lost.db, 'artist_verified_sales'), 1);
    } finally {
      lost.db.close();
    }

    for (const failBatchAt of [1, 4, 8]) {
      const failed = serviceEnvironment({ failBatchAt });
      try {
        await assert.rejects(createVerifiedSale(failed.env, saleInput()), /batch failure/);
        for (const table of [
          'artist_verified_sales', 'artist_verified_sale_items',
          'artist_artwork_records', 'artist_artwork_price_entries',
        ]) assert.equal(count(failed.db, table), 0, `${table} at ${failBatchAt}`);
      } finally {
        failed.db.close();
      }
    }
  });

  it('rejects unknown authority and resolves racing sale creates without partial rows', async () => {
    const fixture = serviceEnvironment();
    try {
      await assert.rejects(createVerifiedSale(fixture.env, {
        ...saleInput(), elevatedRole: 'owner',
      }), (error: Error & { code?: string }) => error.code === 'invalid_request');
      await assert.rejects(createVerifiedSale(fixture.env, saleInput({
        artworks: [{
          artworkRecordId: null, artworkId: null, edition: null, price: null,
          fabricatedKeeperPieceId: 'kp-sale-one',
        }],
      })), (error: Error & { code?: string }) => error.code === 'invalid_request');

      const outcomes = await Promise.allSettled([
        createVerifiedSale(fixture.env, saleInput()),
        createVerifiedSale(fixture.env, saleInput({
          administrator: { userId: 'artist-second', email: 'second@example.com' },
        })),
      ]);
      assert.deepEqual(outcomes.map((result) => result.status).sort(), ['fulfilled', 'rejected']);
      const rejected = outcomes.find((result) => result.status === 'rejected') as PromiseRejectedResult;
      assert.equal(rejected.reason.code, 'idempotency_conflict');
      assert.equal(count(fixture.db, 'artist_verified_sales'), 1);
      assert.equal(count(fixture.db, 'artist_verified_sale_items'), 3);
      assert.equal(count(fixture.db, 'artist_artwork_records'), 3);
    } finally {
      fixture.db.close();
    }
  });

  it('keeps email-only reconnection cases open and records manual progress exactly', async () => {
    const fixture = serviceEnvironment();
    try {
      const created = await createReconnectionCase(fixture.env, {
        recipientEmail: ' Collector@Example.com ', recipientName: null,
        privateContext: ' Old address book. ', idempotencyKey: 'reconnect-email-only',
        administrator, createdAt: now,
      });
      assert.equal(created.status, 'open');
      assert.equal(created.replayed, false);
      assert.equal(count(fixture.db, 'artist_artwork_records'), 0);
      assert.deepEqual(await createReconnectionCase(fixture.env, {
        recipientEmail: 'collector@example.com', recipientName: null,
        privateContext: 'Old address book.', idempotencyKey: 'reconnect-email-only',
        administrator, createdAt: now,
      }), { ...created, replayed: true });

      const note = await appendReconnectionEvent(fixture.env, {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'note_added',
        privateNote: ' Try the gallery. ', artworkRecordId: null, newStatus: null,
        idempotencyKey: 'reconnect-note', administrator, createdAt: now,
      });
      const progressed = await appendReconnectionEvent(fixture.env, {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'status_changed',
        privateNote: null, artworkRecordId: null, newStatus: 'partially_resolved',
        idempotencyKey: 'reconnect-progress', administrator, createdAt: now,
      });
      assert.equal(note.eventType, 'note_added');
      assert.equal(progressed.status, 'partially_resolved');
      assert.equal((await listArtistSaleWorkspace(fixture.env, {})).reconnectionCases[0].status,
        'partially_resolved');
      await assert.rejects(appendReconnectionEvent(fixture.env, {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'status_changed',
        privateNote: null, artworkRecordId: null, newStatus: 'open',
        idempotencyKey: 'reconnect-backwards', administrator, createdAt: now,
      }), (error: Error & { code?: string }) => error.code === 'invalid_request');

      const attachedSale = await createVerifiedSale(fixture.env, saleInput({
        idempotencyKey: 'sale-attached-case', reconnectionCaseId: created.reconnectionCaseId,
      }));
      assert.equal(attachedSale.artworkRecordIds.length, 3);
      assert.equal(fixture.db.prepare(`
        SELECT COUNT(*) AS count FROM artist_reconnection_events
         WHERE reconnection_case_id = ?1 AND event_type = 'artwork_added'
      `).get(created.reconnectionCaseId)?.count, 3);
    } finally {
      fixture.db.close();
    }
  });

  it('identifies records with event-gated optimistic versions and links only exact keeper identities', async () => {
    const fixture = serviceEnvironment();
    try {
      const sale = await createVerifiedSale(fixture.env, saleInput());
      const unresolvedId = sale.artworkRecordIds[2];
      await assert.rejects(identifyArtworkRecord(fixture.env, {
        artworkRecordId: unresolvedId, artworkId: 'ZZ-999', edition: { kind: 'unique' },
        expectedVersion: 1, idempotencyKey: 'identify-unknown', administrator, identifiedAt: now,
      }), (error: Error & { code?: string }) => error.code === 'artwork_not_found');

      const identified = await identifyArtworkRecord(fixture.env, {
        artworkRecordId: unresolvedId, artworkId: 'UL-100',
        edition: { kind: 'numbered', number: 1, size: 64 }, expectedVersion: 1,
        idempotencyKey: 'identify-record', administrator, identifiedAt: now,
      });
      assert.deepEqual(identified, {
        artworkRecordId: unresolvedId, identificationStatus: 'identified', artworkId: 'UL-100',
        edition: { kind: 'numbered', number: 1, size: 64 }, keeperPieceId: null,
        recordVersion: 2, replayed: false,
      });
      assert.deepEqual(await identifyArtworkRecord(fixture.env, {
        artworkRecordId: unresolvedId, artworkId: 'UL-100',
        edition: { kind: 'numbered', number: 1, size: 64 }, expectedVersion: 1,
        idempotencyKey: 'identify-record', administrator, identifiedAt: now,
      }), { ...identified, replayed: true });
      await assert.rejects(identifyArtworkRecord(fixture.env, {
        artworkRecordId: unresolvedId, artworkId: 'UL-101',
        edition: { kind: 'numbered', number: 2, size: 64 }, expectedVersion: 1,
        idempotencyKey: 'identify-stale', administrator, identifiedAt: now,
      }), (error: Error & { code?: string }) => error.code === 'version_conflict');

      await assert.rejects(linkArtworkIdentity(fixture.env, {
        artworkRecordId: unresolvedId, keeperPieceId: 'missing', expectedVersion: 2,
        idempotencyKey: 'link-missing', administrator, linkedAt: now,
      }), (error: Error & { code?: string }) => error.code === 'keeper_identity_not_found');
      await assert.rejects(linkArtworkIdentity(fixture.env, {
        artworkRecordId: unresolvedId, keeperPieceId: 'kp-sale-two', expectedVersion: 2,
        idempotencyKey: 'link-mismatch', administrator, linkedAt: now,
      }), (error: Error & { code?: string }) => error.code === 'artwork_identity_mismatch');
      fixture.db.exec(`
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, registered_at)
        VALUES ('kp-sale-wrong-edition', 'UL-100', 2, '${digest('f')}', '${now}')
      `);
      await assert.rejects(linkArtworkIdentity(fixture.env, {
        artworkRecordId: unresolvedId, keeperPieceId: 'kp-sale-wrong-edition', expectedVersion: 2,
        idempotencyKey: 'link-number-mismatch', administrator, linkedAt: now,
      }), (error: Error & { code?: string }) => error.code === 'artwork_identity_mismatch');
      const linked = await linkArtworkIdentity(fixture.env, {
        artworkRecordId: unresolvedId, keeperPieceId: 'kp-sale-one', expectedVersion: 2,
        idempotencyKey: 'link-match', administrator, linkedAt: now,
      });
      assert.equal(linked.identificationStatus, 'identity_linked');
      assert.equal(linked.recordVersion, 3);
      assert.equal(linked.keeperPieceId, 'kp-sale-one');
      await assert.rejects(linkArtworkIdentity(fixture.env, {
        artworkRecordId: sale.artworkRecordIds[0], keeperPieceId: 'kp-sale-one', expectedVersion: 1,
        idempotencyKey: 'link-duplicate-keeper', administrator, linkedAt: now,
      }), (error: Error & { code?: string }) => error.code === 'artwork_identity_mismatch');
      assert.equal(count(fixture.db, 'artwork_lineage_events'), 0);
    } finally {
      fixture.db.close();
    }
  });

  it('appends exact ledger and shared sale messages only to sale artworks', async () => {
    const fixture = serviceEnvironment();
    try {
      const sale = await createVerifiedSale(fixture.env, saleInput());
      const one = await appendArtworkLedgerEntry(fixture.env, {
        artworkRecordId: sale.artworkRecordIds[0], saleId: sale.saleId,
        message: ' Creator note. ', mediaId: null, idempotencyKey: 'ledger-one',
        administrator, createdAt: now,
      });
      assert.equal(one.replayed, false);
      const shared = await appendSharedSaleMessage(fixture.env, {
        saleId: sale.saleId, artworkRecordIds: sale.artworkRecordIds.slice(0, 2),
        message: ' Thank you for keeping this work. ', expectedSequence: 0,
        idempotencyKey: 'shared-message', administrator, createdAt: now,
      });
      assert.equal(shared.entries.length, 2);
      assert.equal(new Set(shared.entries.map((entry: any) => entry.ledgerEntryId)).size, 2);
      assert.deepEqual(await appendSharedSaleMessage(fixture.env, {
        saleId: sale.saleId, artworkRecordIds: sale.artworkRecordIds.slice(0, 2),
        message: 'Thank you for keeping this work.', expectedSequence: 0,
        idempotencyKey: 'shared-message', administrator, createdAt: now,
      }), { ...shared, replayed: true });
      await assert.rejects(appendSharedSaleMessage(fixture.env, {
        saleId: sale.saleId, artworkRecordIds: sale.artworkRecordIds.slice(1),
        message: 'Thank you for keeping this work.', expectedSequence: 0,
        idempotencyKey: 'shared-message', administrator, createdAt: now,
      }), (error: Error & { code?: string }) => error.code === 'idempotency_conflict');
      assert.equal(count(fixture.db, 'artist_verified_sale_events'), 1);
      assert.equal(count(fixture.db, 'artwork_lineage_events'), 0);
    } finally {
      fixture.db.close();
    }
  });

  it('rolls back every shared-message child and its event on a final batch failure', async () => {
    const options: { failBatchAt?: number } = {};
    const fixture = serviceEnvironment(options);
    try {
      const sale = await createVerifiedSale(fixture.env, saleInput());
      options.failBatchAt = 2;
      await assert.rejects(appendSharedSaleMessage(fixture.env, {
        saleId: sale.saleId, artworkRecordIds: sale.artworkRecordIds,
        message: 'This response must roll back.', expectedSequence: 0,
        idempotencyKey: 'shared-rollback', administrator, createdAt: now,
      }));
      assert.equal(count(fixture.db, 'artist_artwork_ledger_entries'), 0);
      assert.equal(count(fixture.db, 'artist_verified_sale_events'), 0);
    } finally {
      fixture.db.close();
    }
  });

  it('overlays complete sale corrections without changing base sales or price history', async () => {
    const fixture = serviceEnvironment();
    try {
      const sale = await createVerifiedSale(fixture.env, saleInput());
      const base = { ...fixture.db.prepare(`SELECT * FROM artist_verified_sales WHERE id = ?1`).get(sale.saleId) };
      const prices = fixture.db.prepare(`SELECT * FROM artist_artwork_price_entries ORDER BY id`).all();
      const corrected = await correctVerifiedSale(fixture.env, {
        saleId: sale.saleId, expectedSequence: 0,
        replacement: {
          reconnectionCaseId: null, occurrence: { precision: 'year', value: '2019' },
          buyerEmail: 'new@example.com', total: { amountMinor: 910000, currency: 'USD' },
          privateReference: 'Corrected ledger reference', privateNotes: 'Corrected note.',
        },
        reason: 'Transcription correction.', idempotencyKey: 'correct-sale',
        administrator, correctedAt: now,
      });
      assert.equal(corrected.sequence, 1);
      const detail = await getArtistSaleDetail(fixture.env, sale.saleId);
      assert.equal(detail.sale.occurrence.value, '2019');
      assert.equal(detail.sale.buyerEmail, 'new@example.com');
      assert.equal(detail.sale.privateNotes, 'Corrected note.');
      assert.deepEqual({ ...fixture.db.prepare(`SELECT * FROM artist_verified_sales WHERE id = ?1`).get(sale.saleId) }, base);
      assert.deepEqual(fixture.db.prepare(`SELECT * FROM artist_artwork_price_entries ORDER BY id`).all(), prices);
      await assert.rejects(correctVerifiedSale(fixture.env, {
        saleId: sale.saleId, expectedSequence: 0,
        replacement: {
          reconnectionCaseId: null, occurrence: { precision: 'year', value: '2020' },
          buyerEmail: null, total: null, privateReference: null, privateNotes: null,
        },
        reason: 'Stale.', idempotencyKey: 'correct-stale', administrator, correctedAt: now,
      }), (error: Error & { code?: string }) => error.code === 'version_conflict');
    } finally {
      fixture.db.close();
    }
  });

  it('returns deterministic side-effect-free private projections and safe missing failures', async () => {
    const fixture = serviceEnvironment();
    try {
      const sale = await createVerifiedSale(fixture.env, saleInput());
      const before = Object.fromEntries([
        'artist_verified_sales', 'artist_verified_sale_events', 'artist_artwork_ledger_entries',
      ].map((table) => [table, count(fixture.db, table)]));
      const first = await listArtistSaleWorkspace(fixture.env, { search: 'collector' });
      const second = await listArtistSaleWorkspace(fixture.env, { search: 'collector' });
      assert.deepEqual(second, first);
      assert.equal(first.sales[0].saleId, sale.saleId);
      assert.deepEqual(Object.fromEntries(Object.keys(before).map((table) => [table, count(fixture.db, table)])), before);
      await assert.rejects(getArtistSaleDetail(fixture.env, 'missing-sale'),
        (error: Error & { code?: string }) => error.code === 'sale_not_found');
    } finally {
      fixture.db.close();
    }
  });
});
