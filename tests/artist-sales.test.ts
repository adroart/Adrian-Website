import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

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
    } finally {
      db.close();
    }
  });

  it('requires canonical UTC millisecond timestamps on every permanent private record', () => {
    const db = database();
    try {
      const invalidTimestamps = [
        '2026-02-30T12:00:00.000Z',
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

      seedCaseAndRecords(db);
      insertPrimarySale(db);
      db.exec(`
        INSERT INTO artist_artwork_records
          (id, identification_status, created_by_user_id, created_at, updated_at)
        VALUES ('record-timestamp', 'unresolved', 'artist-admin', '${now}', '${now}')
      `);
      const shortTimestamp = '2026-08-10T12:00:00Z';
      const invalidSql = [
        `INSERT INTO artist_reconnection_cases
          (id, recipient_email, status, created_by_user_id, idempotency_key,
           request_digest, created_at, updated_at)
         VALUES ('bad-updated-at', 'updated@example.com', 'open', 'artist-admin',
           'bad-updated-at-key', '${digest('2')}', '${now}', '${shortTimestamp}')`,
        `INSERT INTO artist_artwork_records
          (id, identification_status, created_by_user_id, created_at, updated_at)
         VALUES ('bad-record-created-at', 'unresolved', 'artist-admin',
           '${shortTimestamp}', '${now}')`,
        `INSERT INTO artist_artwork_records
          (id, identification_status, created_by_user_id, created_at, updated_at)
         VALUES ('bad-record-updated-at', 'unresolved', 'artist-admin',
           '${now}', '${shortTimestamp}')`,
        `INSERT INTO artist_verified_sales
          (id, occurrence_precision, verified_by_user_id, idempotency_key,
           request_digest, recorded_at)
         VALUES ('bad-sale-recorded-at', 'unknown', 'artist-admin',
           'bad-sale-recorded-at-key', '${digest('3')}', '${shortTimestamp}')`,
        `INSERT INTO artist_verified_sale_items
          (id, sale_id, artwork_record_id, created_at)
         VALUES ('bad-item-created-at', 'sale-one', 'record-timestamp', '${shortTimestamp}')`,
        `INSERT INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
         VALUES ('bad-media-created-at', 'record-unresolved', 'certificate_image',
           'artist-sales/bad-timestamp.jpg', '${digest('4')}', 'image/jpeg', 10,
           'artist-admin', '${shortTimestamp}')`,
        `INSERT INTO artist_artwork_ledger_entries
          (id, artwork_record_id, message, created_by_user_id,
           idempotency_key, request_digest, created_at)
         VALUES ('bad-ledger-created-at', 'record-unresolved', 'Timestamp check.',
           'artist-admin', 'bad-ledger-created-at-key', '${digest('5')}', '${shortTimestamp}')`,
        `INSERT INTO artist_artwork_price_entries
          (id, artwork_record_id, sale_item_id, amount_minor, currency,
           occurred_on, occurrence_precision, recorded_at)
         VALUES ('bad-price-recorded-at', 'record-unresolved', 'item-one', 100000, 'USD',
           '2026-08-01', 'exact', '${shortTimestamp}')`,
        `INSERT INTO artist_reconnection_events
          (id, reconnection_case_id, event_type, private_note, actor_user_id,
           idempotency_key, request_digest, created_at)
         VALUES ('bad-reconnect-created-at', 'case-one', 'note_added', 'Timestamp check.',
           'artist-admin', 'bad-reconnect-created-at-key', '${digest('6')}', '${shortTimestamp}')`,
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
      `).run(beforeRecord, afterRecord, digest('7'), shortTimestamp), /constraint/i);
      assert.throws(() => db.prepare(`
        INSERT INTO artist_verified_sale_events
          (id, sale_id, sequence, event_type, before_json, after_json,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('bad-sale-event-created-at', 'sale-one', 1, 'corrected', ?1, ?2,
          'artist-admin', 'bad-sale-event-created-at-key', ?3, ?4)
      `).run(
        saleSnapshot(), saleSnapshot({ totalMinor: 300001 }), digest('8'), shortTimestamp,
      ), /constraint/i);

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
});
