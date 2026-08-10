-- Permanent private artist records for historical artwork identification,
-- reconnection work, and verified sales. None of these facts enter the public
-- artwork lineage table.

CREATE TABLE artist_reconnection_cases (
  id TEXT PRIMARY KEY,
  recipient_email TEXT NOT NULL CHECK (
    typeof(recipient_email) = 'text'
    AND length(recipient_email) BETWEEN 3 AND 254
    AND recipient_email = lower(trim(recipient_email))
  ),
  recipient_name TEXT CHECK (
    recipient_name IS NULL
    OR (typeof(recipient_name) = 'text' AND length(trim(recipient_name)) BETWEEN 1 AND 200)
  ),
  private_context TEXT CHECK (
    private_context IS NULL
    OR (typeof(private_context) = 'text' AND length(trim(private_context)) BETWEEN 1 AND 4000)
  ),
  status TEXT NOT NULL CHECK (status IN ('open', 'partially_resolved', 'resolved', 'closed')),
  created_by_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (
    typeof(idempotency_key) = 'text' AND length(trim(idempotency_key)) BETWEEN 1 AND 256
  ),
  request_digest TEXT NOT NULL CHECK (
    typeof(request_digest) = 'text'
    AND length(request_digest) = 64
    AND request_digest = lower(request_digest)
    AND request_digest NOT GLOB '*[^0-9a-f]*'
  ),
  created_at TEXT NOT NULL CHECK (
    typeof(created_at) = 'text'
    AND length(created_at) = 24
    AND created_at GLOB '????-??-??T??:??:??.???Z'
    AND replace(replace(replace(replace(replace(
      created_at, '-', ''), ':', ''), 'T', ''), '.', ''), 'Z', '')
      NOT GLOB '*[^0-9]*'
    AND substr(created_at, 12, 2) BETWEEN '00' AND '23'
    AND COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at, 0) = 1
  ),
  updated_at TEXT NOT NULL CHECK (
    typeof(updated_at) = 'text'
    AND length(updated_at) = 24
    AND updated_at GLOB '????-??-??T??:??:??.???Z'
    AND replace(replace(replace(replace(replace(
      updated_at, '-', ''), ':', ''), 'T', ''), '.', ''), 'Z', '')
      NOT GLOB '*[^0-9]*'
    AND substr(updated_at, 12, 2) BETWEEN '00' AND '23'
    AND COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) = updated_at, 0) = 1
  )
);

CREATE TABLE artist_artwork_records (
  id TEXT PRIMARY KEY,
  artwork_id TEXT CHECK (
    artwork_id IS NULL
    OR (typeof(artwork_id) = 'text' AND length(trim(artwork_id)) BETWEEN 1 AND 128)
  ),
  edition_json TEXT CHECK (
    edition_json IS NULL
    OR (
      json_valid(edition_json)
      AND json_type(edition_json) = 'object'
      AND COALESCE(json_remove(edition_json, '$.kind', '$.number', '$.size') = '{}', 0)
      AND COALESCE((
        (json_extract(edition_json, '$.kind') = 'unique'
          AND json_type(edition_json, '$.number') = 'null'
          AND json_type(edition_json, '$.size') = 'null')
        OR (json_extract(edition_json, '$.kind') = 'numbered'
          AND json_type(edition_json, '$.number') = 'integer'
          AND json_extract(edition_json, '$.number') BETWEEN 1 AND 9999
          AND (
            json_type(edition_json, '$.size') = 'null'
            OR (json_type(edition_json, '$.size') = 'integer'
              AND json_extract(edition_json, '$.size')
                BETWEEN json_extract(edition_json, '$.number') AND 9999)
          ))
      ), 0)
    )
  ),
  keeper_piece_id TEXT UNIQUE REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  identification_status TEXT NOT NULL CHECK (
    identification_status IN ('unresolved', 'identified', 'identity_linked')
  ),
  record_version INTEGER NOT NULL DEFAULT 1 CHECK (
    typeof(record_version) = 'integer' AND record_version >= 1
  ),
  last_event_id TEXT
    REFERENCES artist_artwork_record_events(id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  created_by_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL CHECK (
    typeof(created_at) = 'text'
    AND length(created_at) = 24
    AND created_at GLOB '????-??-??T??:??:??.???Z'
    AND replace(replace(replace(replace(replace(
      created_at, '-', ''), ':', ''), 'T', ''), '.', ''), 'Z', '')
      NOT GLOB '*[^0-9]*'
    AND substr(created_at, 12, 2) BETWEEN '00' AND '23'
    AND COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at, 0) = 1
  ),
  updated_at TEXT NOT NULL CHECK (
    typeof(updated_at) = 'text'
    AND length(updated_at) = 24
    AND updated_at GLOB '????-??-??T??:??:??.???Z'
    AND replace(replace(replace(replace(replace(
      updated_at, '-', ''), ':', ''), 'T', ''), '.', ''), 'Z', '')
      NOT GLOB '*[^0-9]*'
    AND substr(updated_at, 12, 2) BETWEEN '00' AND '23'
    AND COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) = updated_at, 0) = 1
  ),
  CHECK (
    (identification_status = 'unresolved'
      AND artwork_id IS NULL AND edition_json IS NULL AND keeper_piece_id IS NULL)
    OR (identification_status = 'identified'
      AND artwork_id IS NOT NULL AND edition_json IS NOT NULL AND keeper_piece_id IS NULL)
    OR (identification_status = 'identity_linked'
      AND artwork_id IS NOT NULL AND edition_json IS NOT NULL AND keeper_piece_id IS NOT NULL)
  ),
  CHECK (
    (record_version = 1 AND last_event_id IS NULL)
    OR (record_version >= 2 AND last_event_id IS NOT NULL)
  )
);

CREATE TABLE artist_artwork_record_events (
  id TEXT PRIMARY KEY,
  artwork_record_id TEXT NOT NULL
    REFERENCES artist_artwork_records(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (
    action IN ('identified', 'identification_corrected', 'identity_linked')
  ),
  before_json TEXT NOT NULL CHECK (
    json_valid(before_json) AND json_type(before_json) = 'object'
  ),
  after_json TEXT NOT NULL CHECK (
    json_valid(after_json) AND json_type(after_json) = 'object'
  ),
  resulting_version INTEGER NOT NULL CHECK (
    typeof(resulting_version) = 'integer' AND resulting_version >= 2
  ),
  actor_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (
    typeof(idempotency_key) = 'text' AND length(trim(idempotency_key)) BETWEEN 1 AND 256
  ),
  request_digest TEXT NOT NULL CHECK (
    typeof(request_digest) = 'text'
    AND length(request_digest) = 64
    AND request_digest = lower(request_digest)
    AND request_digest NOT GLOB '*[^0-9a-f]*'
  ),
  created_at TEXT NOT NULL CHECK (
    typeof(created_at) = 'text'
    AND length(created_at) = 24
    AND created_at GLOB '????-??-??T??:??:??.???Z'
    AND replace(replace(replace(replace(replace(
      created_at, '-', ''), ':', ''), 'T', ''), '.', ''), 'Z', '')
      NOT GLOB '*[^0-9]*'
    AND substr(created_at, 12, 2) BETWEEN '00' AND '23'
    AND COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at, 0) = 1
  ),
  UNIQUE (artwork_record_id, resulting_version)
);

CREATE TABLE artist_verified_sales (
  id TEXT PRIMARY KEY,
  reconnection_case_id TEXT
    REFERENCES artist_reconnection_cases(id) ON DELETE RESTRICT,
  occurrence_precision TEXT NOT NULL CHECK (
    occurrence_precision IN ('exact', 'month', 'year', 'unknown')
  ),
  occurred_on TEXT,
  buyer_email TEXT CHECK (
    buyer_email IS NULL
    OR (
      typeof(buyer_email) = 'text'
      AND length(buyer_email) BETWEEN 3 AND 254
      AND buyer_email = lower(trim(buyer_email))
    )
  ),
  currency TEXT,
  total_minor INTEGER,
  private_reference TEXT CHECK (
    private_reference IS NULL
    OR (typeof(private_reference) = 'text' AND length(trim(private_reference)) BETWEEN 1 AND 1000)
  ),
  private_notes TEXT CHECK (
    private_notes IS NULL
    OR (typeof(private_notes) = 'text' AND length(trim(private_notes)) BETWEEN 1 AND 8000)
  ),
  verified_by_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (
    typeof(idempotency_key) = 'text' AND length(trim(idempotency_key)) BETWEEN 1 AND 256
  ),
  request_digest TEXT NOT NULL CHECK (
    typeof(request_digest) = 'text'
    AND length(request_digest) = 64
    AND request_digest = lower(request_digest)
    AND request_digest NOT GLOB '*[^0-9a-f]*'
  ),
  recorded_at TEXT NOT NULL CHECK (
    typeof(recorded_at) = 'text'
    AND length(recorded_at) = 24
    AND recorded_at GLOB '????-??-??T??:??:??.???Z'
    AND replace(replace(replace(replace(replace(
      recorded_at, '-', ''), ':', ''), 'T', ''), '.', ''), 'Z', '')
      NOT GLOB '*[^0-9]*'
    AND substr(recorded_at, 12, 2) BETWEEN '00' AND '23'
    AND COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', recorded_at) = recorded_at, 0) = 1
  ),
  CHECK (
    (currency IS NULL AND total_minor IS NULL)
    OR (
      typeof(currency) = 'text' AND length(currency) = 3
      AND currency GLOB '[A-Z][A-Z][A-Z]'
      AND typeof(total_minor) = 'integer' AND total_minor >= 0
    )
  ),
  CHECK (
    (occurrence_precision = 'exact'
      AND typeof(occurred_on) = 'text' AND length(occurred_on) = 10
      AND occurred_on GLOB '????-??-??'
      AND occurred_on NOT GLOB '*[^0-9-]*'
      AND COALESCE(date(occurred_on) = occurred_on, 0) = 1)
    OR (occurrence_precision = 'month'
      AND typeof(occurred_on) = 'text' AND length(occurred_on) = 7
      AND occurred_on GLOB '????-??'
      AND occurred_on NOT GLOB '*[^0-9-]*'
      AND date(occurred_on || '-01') IS NOT NULL
      AND COALESCE(date(occurred_on || '-01') = occurred_on || '-01', 0) = 1)
    OR (occurrence_precision = 'year'
      AND typeof(occurred_on) = 'text' AND length(occurred_on) = 4
      AND occurred_on NOT GLOB '*[^0-9]*'
      AND date(occurred_on || '-01-01') IS NOT NULL
      AND COALESCE(date(occurred_on || '-01-01') = occurred_on || '-01-01', 0) = 1)
    OR (occurrence_precision = 'unknown' AND occurred_on IS NULL)
  )
);

CREATE TABLE artist_verified_sale_events (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES artist_verified_sales(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (typeof(sequence) = 'integer' AND sequence >= 1),
  event_type TEXT NOT NULL CHECK (event_type IN ('corrected', 'shared_message_appended')),
  before_json TEXT NOT NULL CHECK (
    json_valid(before_json) AND json_type(before_json) = 'object'
  ),
  after_json TEXT NOT NULL CHECK (
    json_valid(after_json) AND json_type(after_json) = 'object'
  ),
  actor_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (
    typeof(idempotency_key) = 'text' AND length(trim(idempotency_key)) BETWEEN 1 AND 256
  ),
  request_digest TEXT NOT NULL CHECK (
    typeof(request_digest) = 'text'
    AND length(request_digest) = 64
    AND request_digest = lower(request_digest)
    AND request_digest NOT GLOB '*[^0-9a-f]*'
  ),
  created_at TEXT NOT NULL CHECK (
    typeof(created_at) = 'text'
    AND length(created_at) = 24
    AND created_at GLOB '????-??-??T??:??:??.???Z'
    AND replace(replace(replace(replace(replace(
      created_at, '-', ''), ':', ''), 'T', ''), '.', ''), 'Z', '')
      NOT GLOB '*[^0-9]*'
    AND substr(created_at, 12, 2) BETWEEN '00' AND '23'
    AND COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at, 0) = 1
  ),
  UNIQUE (sale_id, sequence)
);

CREATE TABLE artist_verified_sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES artist_verified_sales(id) ON DELETE RESTRICT,
  artwork_record_id TEXT NOT NULL
    REFERENCES artist_artwork_records(id) ON DELETE RESTRICT,
  amount_minor INTEGER,
  currency TEXT,
  created_at TEXT NOT NULL CHECK (
    typeof(created_at) = 'text'
    AND length(created_at) = 24
    AND created_at GLOB '????-??-??T??:??:??.???Z'
    AND replace(replace(replace(replace(replace(
      created_at, '-', ''), ':', ''), 'T', ''), '.', ''), 'Z', '')
      NOT GLOB '*[^0-9]*'
    AND substr(created_at, 12, 2) BETWEEN '00' AND '23'
    AND COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at, 0) = 1
  ),
  UNIQUE (sale_id, artwork_record_id),
  CHECK (
    (amount_minor IS NULL AND currency IS NULL)
    OR (
      typeof(amount_minor) = 'integer' AND amount_minor >= 0
      AND typeof(currency) = 'text' AND length(currency) = 3
      AND currency GLOB '[A-Z][A-Z][A-Z]'
    )
  )
);

CREATE TABLE artist_artwork_media (
  id TEXT PRIMARY KEY,
  artwork_record_id TEXT NOT NULL
    REFERENCES artist_artwork_records(id) ON DELETE RESTRICT,
  media_role TEXT NOT NULL CHECK (
    media_role IN ('identification_evidence', 'certificate_image')
  ),
  storage_reference TEXT NOT NULL UNIQUE CHECK (
    typeof(storage_reference) = 'text'
    AND length(trim(storage_reference)) BETWEEN 1 AND 1000
  ),
  sha256 TEXT NOT NULL CHECK (
    typeof(sha256) = 'text'
    AND length(sha256) = 64
    AND sha256 = lower(sha256)
    AND sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  content_type TEXT NOT NULL CHECK (
    content_type IN ('image/jpeg', 'image/png', 'image/webp')
  ),
  byte_length INTEGER NOT NULL CHECK (
    typeof(byte_length) = 'integer' AND byte_length BETWEEN 1 AND 15728640
  ),
  uploaded_by_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL CHECK (
    typeof(created_at) = 'text'
    AND length(created_at) = 24
    AND created_at GLOB '????-??-??T??:??:??.???Z'
    AND replace(replace(replace(replace(replace(
      created_at, '-', ''), ':', ''), 'T', ''), '.', ''), 'Z', '')
      NOT GLOB '*[^0-9]*'
    AND substr(created_at, 12, 2) BETWEEN '00' AND '23'
    AND COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at, 0) = 1
  )
);

CREATE TABLE artist_artwork_ledger_entries (
  id TEXT PRIMARY KEY,
  artwork_record_id TEXT NOT NULL
    REFERENCES artist_artwork_records(id) ON DELETE RESTRICT,
  sale_id TEXT REFERENCES artist_verified_sales(id) ON DELETE RESTRICT,
  message TEXT CHECK (
    message IS NULL
    OR (typeof(message) = 'text' AND length(trim(message)) BETWEEN 1 AND 8000)
  ),
  media_id TEXT REFERENCES artist_artwork_media(id) ON DELETE RESTRICT,
  created_by_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (
    typeof(idempotency_key) = 'text' AND length(trim(idempotency_key)) BETWEEN 1 AND 256
  ),
  request_digest TEXT NOT NULL CHECK (
    typeof(request_digest) = 'text'
    AND length(request_digest) = 64
    AND request_digest = lower(request_digest)
    AND request_digest NOT GLOB '*[^0-9a-f]*'
  ),
  created_at TEXT NOT NULL CHECK (
    typeof(created_at) = 'text'
    AND length(created_at) = 24
    AND created_at GLOB '????-??-??T??:??:??.???Z'
    AND replace(replace(replace(replace(replace(
      created_at, '-', ''), ':', ''), 'T', ''), '.', ''), 'Z', '')
      NOT GLOB '*[^0-9]*'
    AND substr(created_at, 12, 2) BETWEEN '00' AND '23'
    AND COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at, 0) = 1
  ),
  CHECK (message IS NOT NULL OR media_id IS NOT NULL)
);

CREATE TABLE artist_artwork_price_entries (
  id TEXT PRIMARY KEY,
  artwork_record_id TEXT NOT NULL
    REFERENCES artist_artwork_records(id) ON DELETE RESTRICT,
  sale_item_id TEXT NOT NULL UNIQUE
    REFERENCES artist_verified_sale_items(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL CHECK (
    typeof(amount_minor) = 'integer' AND amount_minor >= 0
  ),
  currency TEXT NOT NULL CHECK (
    typeof(currency) = 'text' AND length(currency) = 3
    AND currency GLOB '[A-Z][A-Z][A-Z]'
  ),
  occurred_on TEXT,
  occurrence_precision TEXT NOT NULL CHECK (
    occurrence_precision IN ('exact', 'month', 'year', 'unknown')
  ),
  recorded_at TEXT NOT NULL CHECK (
    typeof(recorded_at) = 'text'
    AND length(recorded_at) = 24
    AND recorded_at GLOB '????-??-??T??:??:??.???Z'
    AND replace(replace(replace(replace(replace(
      recorded_at, '-', ''), ':', ''), 'T', ''), '.', ''), 'Z', '')
      NOT GLOB '*[^0-9]*'
    AND substr(recorded_at, 12, 2) BETWEEN '00' AND '23'
    AND COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', recorded_at) = recorded_at, 0) = 1
  ),
  CHECK (
    (occurrence_precision = 'exact'
      AND typeof(occurred_on) = 'text' AND length(occurred_on) = 10
      AND occurred_on GLOB '????-??-??'
      AND occurred_on NOT GLOB '*[^0-9-]*'
      AND COALESCE(date(occurred_on) = occurred_on, 0) = 1)
    OR (occurrence_precision = 'month'
      AND typeof(occurred_on) = 'text' AND length(occurred_on) = 7
      AND occurred_on GLOB '????-??'
      AND occurred_on NOT GLOB '*[^0-9-]*'
      AND date(occurred_on || '-01') IS NOT NULL
      AND COALESCE(date(occurred_on || '-01') = occurred_on || '-01', 0) = 1)
    OR (occurrence_precision = 'year'
      AND typeof(occurred_on) = 'text' AND length(occurred_on) = 4
      AND occurred_on NOT GLOB '*[^0-9]*'
      AND date(occurred_on || '-01-01') IS NOT NULL
      AND COALESCE(date(occurred_on || '-01-01') = occurred_on || '-01-01', 0) = 1)
    OR (occurrence_precision = 'unknown' AND occurred_on IS NULL)
  )
);

CREATE TABLE artist_reconnection_events (
  id TEXT PRIMARY KEY,
  reconnection_case_id TEXT NOT NULL
    REFERENCES artist_reconnection_cases(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('note_added', 'email_sent', 'artwork_added', 'status_changed')
  ),
  private_note TEXT CHECK (
    private_note IS NULL
    OR (typeof(private_note) = 'text' AND length(trim(private_note)) BETWEEN 1 AND 8000)
  ),
  artwork_record_id TEXT
    REFERENCES artist_artwork_records(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (
    typeof(idempotency_key) = 'text' AND length(trim(idempotency_key)) BETWEEN 1 AND 256
  ),
  request_digest TEXT NOT NULL CHECK (
    typeof(request_digest) = 'text'
    AND length(request_digest) = 64
    AND request_digest = lower(request_digest)
    AND request_digest NOT GLOB '*[^0-9a-f]*'
  ),
  created_at TEXT NOT NULL CHECK (
    typeof(created_at) = 'text'
    AND length(created_at) = 24
    AND created_at GLOB '????-??-??T??:??:??.???Z'
    AND replace(replace(replace(replace(replace(
      created_at, '-', ''), ':', ''), 'T', ''), '.', ''), 'Z', '')
      NOT GLOB '*[^0-9]*'
    AND substr(created_at, 12, 2) BETWEEN '00' AND '23'
    AND COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at, 0) = 1
  )
);

CREATE INDEX idx_artist_reconnection_events_case_time
  ON artist_reconnection_events(reconnection_case_id, created_at, id);
CREATE INDEX idx_artist_artwork_record_events_record_version
  ON artist_artwork_record_events(artwork_record_id, resulting_version);
CREATE INDEX idx_artist_verified_sales_case_time
  ON artist_verified_sales(reconnection_case_id, recorded_at, id);
CREATE INDEX idx_artist_verified_sale_items_sale
  ON artist_verified_sale_items(sale_id, created_at, id);
CREATE INDEX idx_artist_artwork_media_record_time
  ON artist_artwork_media(artwork_record_id, created_at, id);
CREATE INDEX idx_artist_artwork_ledger_record_time
  ON artist_artwork_ledger_entries(artwork_record_id, created_at, id);
CREATE INDEX idx_artist_artwork_price_record_time
  ON artist_artwork_price_entries(artwork_record_id, recorded_at, id);

CREATE TRIGGER artist_artwork_records_initial_version
BEFORE INSERT ON artist_artwork_records
WHEN NEW.record_version <> 1 OR NEW.last_event_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'artist artwork records require initial version one without an event');
END;

CREATE TRIGGER artist_artwork_records_initial_identity_match
BEFORE INSERT ON artist_artwork_records
WHEN NEW.identification_status = 'identity_linked' AND NOT EXISTS (
  SELECT 1 FROM keeper_pieces piece
   WHERE piece.id = NEW.keeper_piece_id
     AND piece.piece_id = NEW.artwork_id
     AND (
       (json_extract(NEW.edition_json, '$.kind') = 'unique'
         AND piece.edition_number = 0)
       OR (json_extract(NEW.edition_json, '$.kind') = 'numbered'
         AND piece.edition_number = json_extract(NEW.edition_json, '$.number'))
     )
)
BEGIN
  SELECT RAISE(ABORT, 'artist artwork record identity must match its keeper piece');
END;

-- A record event is valid only when both snapshots are complete identity
-- snapshots, the before snapshot exactly describes the current record, and
-- the action describes one permitted state transition.
CREATE TRIGGER artist_artwork_record_events_exact_snapshot
BEFORE INSERT ON artist_artwork_record_events
BEGIN
  SELECT CASE WHEN
    (SELECT COUNT(*) FROM json_each(NEW.before_json)) <> 5
    OR json_remove(
      NEW.before_json, '$.artworkId', '$.editionJson', '$.keeperPieceId',
      '$.identificationStatus', '$.recordVersion'
    ) <> '{}'
    OR (SELECT COUNT(*) FROM json_each(NEW.after_json)) <> 5
    OR json_remove(
      NEW.after_json, '$.artworkId', '$.editionJson', '$.keeperPieceId',
      '$.identificationStatus', '$.recordVersion'
    ) <> '{}'
    OR json_type(NEW.before_json, '$.recordVersion') <> 'integer'
    OR json_type(NEW.after_json, '$.recordVersion') <> 'integer'
    OR json_type(NEW.before_json, '$.identificationStatus') <> 'text'
    OR json_type(NEW.after_json, '$.identificationStatus') <> 'text'
  THEN RAISE(ABORT, 'artwork record event requires complete snapshots') END;

  SELECT CASE WHEN NOT (
    json_type(NEW.after_json, '$.editionJson') = 'object'
    AND (SELECT COUNT(*)
           FROM json_each(json_extract(NEW.after_json, '$.editionJson'))) = 3
    AND NOT EXISTS (
      SELECT 1 FROM json_each(json_extract(NEW.after_json, '$.editionJson')) member
       WHERE member.key NOT IN ('kind', 'number', 'size')
    )
    AND COALESCE((
      (json_extract(NEW.after_json, '$.editionJson.kind') = 'unique'
        AND json_type(NEW.after_json, '$.editionJson.number') = 'null'
        AND json_type(NEW.after_json, '$.editionJson.size') = 'null')
      OR (json_extract(NEW.after_json, '$.editionJson.kind') = 'numbered'
        AND json_type(NEW.after_json, '$.editionJson.number') = 'integer'
        AND json_extract(NEW.after_json, '$.editionJson.number') BETWEEN 1 AND 9999
        AND (
          json_type(NEW.after_json, '$.editionJson.size') = 'null'
          OR (json_type(NEW.after_json, '$.editionJson.size') = 'integer'
            AND json_extract(NEW.after_json, '$.editionJson.size') BETWEEN
              json_extract(NEW.after_json, '$.editionJson.number') AND 9999)
        ))
    ), 0)
  ) THEN RAISE(ABORT, 'artwork record event requires canonical edition identity') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM artist_artwork_records record
     WHERE record.id = NEW.artwork_record_id
       AND json_extract(NEW.before_json, '$.artworkId') IS record.artwork_id
       AND (
         (record.edition_json IS NULL
           AND json_type(NEW.before_json, '$.editionJson') = 'null')
         OR (record.edition_json IS NOT NULL
           AND json_quote(json_extract(NEW.before_json, '$.editionJson')) = json(record.edition_json))
       )
       AND json_extract(NEW.before_json, '$.keeperPieceId') IS record.keeper_piece_id
       AND json_extract(NEW.before_json, '$.identificationStatus') = record.identification_status
       AND json_extract(NEW.before_json, '$.recordVersion') = record.record_version
       AND NEW.resulting_version = record.record_version + 1
       AND json_extract(NEW.after_json, '$.recordVersion') = NEW.resulting_version
       AND (
         (
           NEW.action = 'identified'
           AND record.identification_status = 'unresolved'
           AND json_extract(NEW.after_json, '$.identificationStatus') = 'identified'
           AND json_type(NEW.after_json, '$.artworkId') = 'text'
           AND length(trim(json_extract(NEW.after_json, '$.artworkId'))) BETWEEN 1 AND 128
           AND json_type(NEW.after_json, '$.editionJson') <> 'null'
           AND json_type(NEW.after_json, '$.keeperPieceId') = 'null'
         )
         OR (
           NEW.action = 'identification_corrected'
           AND record.identification_status = 'identified'
           AND json_extract(NEW.after_json, '$.identificationStatus') = 'identified'
           AND json_type(NEW.after_json, '$.artworkId') = 'text'
           AND length(trim(json_extract(NEW.after_json, '$.artworkId'))) BETWEEN 1 AND 128
           AND json_type(NEW.after_json, '$.editionJson') <> 'null'
           AND json_type(NEW.after_json, '$.keeperPieceId') = 'null'
           AND (
             json_extract(NEW.after_json, '$.artworkId') IS NOT record.artwork_id
             OR json_quote(json_extract(NEW.after_json, '$.editionJson')) <> json(record.edition_json)
           )
         )
         OR (
           NEW.action = 'identity_linked'
           AND record.identification_status = 'identified'
           AND json_extract(NEW.after_json, '$.identificationStatus') = 'identity_linked'
           AND json_extract(NEW.after_json, '$.artworkId') = record.artwork_id
           AND json_quote(json_extract(NEW.after_json, '$.editionJson')) = json(record.edition_json)
           AND json_type(NEW.after_json, '$.keeperPieceId') = 'text'
           AND EXISTS (
             SELECT 1 FROM keeper_pieces piece
              WHERE piece.id = json_extract(NEW.after_json, '$.keeperPieceId')
                AND piece.piece_id = json_extract(NEW.after_json, '$.artworkId')
                AND (
                  (json_extract(NEW.after_json, '$.editionJson.kind') = 'unique'
                    AND piece.edition_number = 0)
                  OR (json_extract(NEW.after_json, '$.editionJson.kind') = 'numbered'
                    AND piece.edition_number =
                      json_extract(NEW.after_json, '$.editionJson.number'))
                )
           )
           AND NOT EXISTS (
             SELECT 1 FROM artist_artwork_records linked
              WHERE linked.keeper_piece_id = json_extract(NEW.after_json, '$.keeperPieceId')
           )
         )
       )
  ) THEN RAISE(ABORT, 'artwork record event snapshot, action, or version mismatch') END;
END;

-- Callers first insert the exact event above, then update only the identity
-- projection to its after snapshot. No other record mutation is authorized.
CREATE TRIGGER artist_artwork_records_guarded_update
BEFORE UPDATE ON artist_artwork_records
BEGIN
  SELECT CASE WHEN
    NEW.id IS NOT OLD.id
    OR NEW.created_by_user_id IS NOT OLD.created_by_user_id
    OR NEW.created_at IS NOT OLD.created_at
    OR NEW.record_version <> OLD.record_version + 1
    OR NEW.last_event_id IS NULL
    OR NEW.last_event_id IS OLD.last_event_id
    OR NOT EXISTS (
      SELECT 1 FROM artist_artwork_record_events event
       WHERE event.id = NEW.last_event_id
         AND event.artwork_record_id = OLD.id
         AND event.resulting_version = NEW.record_version
         AND event.created_at = NEW.updated_at
         AND json_extract(event.before_json, '$.artworkId') IS OLD.artwork_id
         AND (
           (OLD.edition_json IS NULL
             AND json_type(event.before_json, '$.editionJson') = 'null')
           OR (OLD.edition_json IS NOT NULL
             AND json_quote(json_extract(event.before_json, '$.editionJson')) = json(OLD.edition_json))
         )
         AND json_extract(event.before_json, '$.keeperPieceId') IS OLD.keeper_piece_id
         AND json_extract(event.before_json, '$.identificationStatus') = OLD.identification_status
         AND json_extract(event.before_json, '$.recordVersion') = OLD.record_version
         AND json_extract(event.after_json, '$.artworkId') IS NEW.artwork_id
         AND (
           (NEW.edition_json IS NULL
             AND json_type(event.after_json, '$.editionJson') = 'null')
           OR (NEW.edition_json IS NOT NULL
             AND json_quote(json_extract(event.after_json, '$.editionJson')) = json(NEW.edition_json))
         )
         AND json_extract(event.after_json, '$.keeperPieceId') IS NEW.keeper_piece_id
         AND json_extract(event.after_json, '$.identificationStatus') = NEW.identification_status
         AND json_extract(event.after_json, '$.recordVersion') = NEW.record_version
    )
  THEN RAISE(ABORT, 'artwork record update is not authorized by an exact event') END;
END;

CREATE TRIGGER artist_artwork_records_update_identity_collision
BEFORE UPDATE ON artist_artwork_records
WHEN NEW.keeper_piece_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM artist_artwork_records other
   WHERE other.keeper_piece_id = NEW.keeper_piece_id
     AND other.id <> OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'artist artwork record keeper identity collision');
END;

CREATE TRIGGER artist_artwork_records_no_delete
BEFORE DELETE ON artist_artwork_records
BEGIN
  SELECT RAISE(ABORT, 'artist artwork records are permanent');
END;

-- Sale-event snapshots contain every correctable private sale fact. The first
-- event starts from the immutable base sale; later events form a contiguous
-- replacement-snapshot chain.
CREATE TRIGGER artist_verified_sale_events_exact_snapshot
BEFORE INSERT ON artist_verified_sale_events
BEGIN
  SELECT CASE WHEN
    (SELECT COUNT(*) FROM json_each(NEW.before_json)) <> 10
    OR json_remove(
      NEW.before_json, '$.reconnectionCaseId', '$.occurrencePrecision',
      '$.occurredOn', '$.buyerEmail', '$.currency', '$.totalMinor',
      '$.privateReference', '$.privateNotes', '$.verifiedByUserId', '$.recordedAt'
    ) <> '{}'
    OR (SELECT COUNT(*) FROM json_each(NEW.after_json)) <> 10
    OR json_remove(
      NEW.after_json, '$.reconnectionCaseId', '$.occurrencePrecision',
      '$.occurredOn', '$.buyerEmail', '$.currency', '$.totalMinor',
      '$.privateReference', '$.privateNotes', '$.verifiedByUserId', '$.recordedAt'
    ) <> '{}'
    OR json_type(NEW.before_json, '$.occurrencePrecision') <> 'text'
    OR json_type(NEW.after_json, '$.occurrencePrecision') <> 'text'
  THEN RAISE(ABORT, 'sale event requires complete replacement snapshots') END;

  SELECT CASE WHEN COALESCE((
    json_extract(NEW.before_json, '$.occurrencePrecision') IN
      ('exact', 'month', 'year', 'unknown')
    AND (
      (json_extract(NEW.before_json, '$.occurrencePrecision') = 'exact'
        AND json_type(NEW.before_json, '$.occurredOn') = 'text'
        AND length(json_extract(NEW.before_json, '$.occurredOn')) = 10
        AND json_extract(NEW.before_json, '$.occurredOn') GLOB '????-??-??'
        AND json_extract(NEW.before_json, '$.occurredOn') NOT GLOB '*[^0-9-]*'
        AND COALESCE(
          date(json_extract(NEW.before_json, '$.occurredOn')) =
            json_extract(NEW.before_json, '$.occurredOn'),
          0
        ) = 1)
      OR (json_extract(NEW.before_json, '$.occurrencePrecision') = 'month'
        AND json_type(NEW.before_json, '$.occurredOn') = 'text'
        AND length(json_extract(NEW.before_json, '$.occurredOn')) = 7
        AND json_extract(NEW.before_json, '$.occurredOn') GLOB '????-??'
        AND json_extract(NEW.before_json, '$.occurredOn') NOT GLOB '*[^0-9-]*'
        AND COALESCE(
          date(json_extract(NEW.before_json, '$.occurredOn') || '-01') =
            json_extract(NEW.before_json, '$.occurredOn') || '-01',
          0
        ) = 1)
      OR (json_extract(NEW.before_json, '$.occurrencePrecision') = 'year'
        AND json_type(NEW.before_json, '$.occurredOn') = 'text'
        AND length(json_extract(NEW.before_json, '$.occurredOn')) = 4
        AND json_extract(NEW.before_json, '$.occurredOn') NOT GLOB '*[^0-9]*'
        AND COALESCE(
          date(json_extract(NEW.before_json, '$.occurredOn') || '-01-01') =
            json_extract(NEW.before_json, '$.occurredOn') || '-01-01',
          0
        ) = 1)
      OR (json_extract(NEW.before_json, '$.occurrencePrecision') = 'unknown'
        AND json_type(NEW.before_json, '$.occurredOn') = 'null')
    )
    AND json_type(NEW.before_json, '$.recordedAt') = 'text'
    AND length(json_extract(NEW.before_json, '$.recordedAt')) = 24
    AND json_extract(NEW.before_json, '$.recordedAt') GLOB '????-??-??T??:??:??.???Z'
    AND replace(replace(replace(replace(replace(
      json_extract(NEW.before_json, '$.recordedAt'), '-', ''), ':', ''),
      'T', ''), '.', ''), 'Z', '') NOT GLOB '*[^0-9]*'
    AND substr(json_extract(NEW.before_json, '$.recordedAt'), 12, 2) BETWEEN '00' AND '23'
    AND COALESCE(
      strftime(
        '%Y-%m-%dT%H:%M:%fZ', json_extract(NEW.before_json, '$.recordedAt')
      ) = json_extract(NEW.before_json, '$.recordedAt'),
      0
    ) = 1
  ), 0) <> 1 THEN RAISE(ABORT, 'sale event before snapshot date is invalid') END;

  SELECT CASE WHEN COALESCE((
    json_extract(NEW.after_json, '$.occurrencePrecision') IN ('exact', 'month', 'year', 'unknown')
    AND (
      (json_extract(NEW.after_json, '$.occurrencePrecision') = 'exact'
        AND json_type(NEW.after_json, '$.occurredOn') = 'text'
        AND length(json_extract(NEW.after_json, '$.occurredOn')) = 10
        AND json_extract(NEW.after_json, '$.occurredOn') GLOB '????-??-??'
        AND json_extract(NEW.after_json, '$.occurredOn') NOT GLOB '*[^0-9-]*'
        AND date(json_extract(NEW.after_json, '$.occurredOn')) IS NOT NULL
        AND COALESCE(
          date(json_extract(NEW.after_json, '$.occurredOn')) =
            json_extract(NEW.after_json, '$.occurredOn'),
          0
        ) = 1)
      OR (json_extract(NEW.after_json, '$.occurrencePrecision') = 'month'
        AND json_type(NEW.after_json, '$.occurredOn') = 'text'
        AND length(json_extract(NEW.after_json, '$.occurredOn')) = 7
        AND json_extract(NEW.after_json, '$.occurredOn') GLOB '????-??'
        AND json_extract(NEW.after_json, '$.occurredOn') NOT GLOB '*[^0-9-]*'
        AND date(json_extract(NEW.after_json, '$.occurredOn') || '-01') IS NOT NULL
        AND COALESCE(
          date(json_extract(NEW.after_json, '$.occurredOn') || '-01') =
            json_extract(NEW.after_json, '$.occurredOn') || '-01',
          0
        ) = 1)
      OR (json_extract(NEW.after_json, '$.occurrencePrecision') = 'year'
        AND json_type(NEW.after_json, '$.occurredOn') = 'text'
        AND length(json_extract(NEW.after_json, '$.occurredOn')) = 4
        AND json_extract(NEW.after_json, '$.occurredOn') NOT GLOB '*[^0-9]*'
        AND date(json_extract(NEW.after_json, '$.occurredOn') || '-01-01') IS NOT NULL
        AND COALESCE(
          date(json_extract(NEW.after_json, '$.occurredOn') || '-01-01') =
            json_extract(NEW.after_json, '$.occurredOn') || '-01-01',
          0
        ) = 1)
      OR (json_extract(NEW.after_json, '$.occurrencePrecision') = 'unknown'
        AND json_type(NEW.after_json, '$.occurredOn') = 'null')
    )
    AND (
      json_type(NEW.after_json, '$.reconnectionCaseId') = 'null'
      OR (json_type(NEW.after_json, '$.reconnectionCaseId') = 'text'
        AND EXISTS (
          SELECT 1 FROM artist_reconnection_cases reconnect
           WHERE reconnect.id = json_extract(NEW.after_json, '$.reconnectionCaseId')
        ))
    )
    AND (
      (json_type(NEW.after_json, '$.buyerEmail') = 'null')
      OR (json_type(NEW.after_json, '$.buyerEmail') = 'text'
        AND length(json_extract(NEW.after_json, '$.buyerEmail')) BETWEEN 3 AND 254
        AND json_extract(NEW.after_json, '$.buyerEmail') =
          lower(trim(json_extract(NEW.after_json, '$.buyerEmail'))))
    )
    AND (
      (json_type(NEW.after_json, '$.currency') = 'null'
        AND json_type(NEW.after_json, '$.totalMinor') = 'null')
      OR (json_type(NEW.after_json, '$.currency') = 'text'
        AND length(json_extract(NEW.after_json, '$.currency')) = 3
        AND json_extract(NEW.after_json, '$.currency') GLOB '[A-Z][A-Z][A-Z]'
        AND json_type(NEW.after_json, '$.totalMinor') = 'integer'
        AND json_extract(NEW.after_json, '$.totalMinor') >= 0)
    )
    AND (
      json_type(NEW.after_json, '$.privateReference') = 'null'
      OR (json_type(NEW.after_json, '$.privateReference') = 'text'
        AND length(trim(json_extract(NEW.after_json, '$.privateReference'))) BETWEEN 1 AND 1000)
    )
    AND (
      json_type(NEW.after_json, '$.privateNotes') = 'null'
      OR (json_type(NEW.after_json, '$.privateNotes') = 'text'
        AND length(trim(json_extract(NEW.after_json, '$.privateNotes'))) BETWEEN 1 AND 8000)
    )
    AND json_type(NEW.after_json, '$.verifiedByUserId') = 'text'
    AND EXISTS (
      SELECT 1 FROM user actor
       WHERE actor.id = json_extract(NEW.after_json, '$.verifiedByUserId')
    )
    AND json_type(NEW.after_json, '$.recordedAt') = 'text'
    AND length(json_extract(NEW.after_json, '$.recordedAt')) = 24
    AND json_extract(NEW.after_json, '$.recordedAt') GLOB '????-??-??T??:??:??.???Z'
    AND replace(replace(replace(replace(replace(
      json_extract(NEW.after_json, '$.recordedAt'), '-', ''), ':', ''),
      'T', ''), '.', ''), 'Z', '') NOT GLOB '*[^0-9]*'
    AND substr(json_extract(NEW.after_json, '$.recordedAt'), 12, 2) BETWEEN '00' AND '23'
    AND COALESCE(
      strftime(
        '%Y-%m-%dT%H:%M:%fZ', json_extract(NEW.after_json, '$.recordedAt')
      ) = json_extract(NEW.after_json, '$.recordedAt'),
      0
    ) = 1
  ), 0) <> 1 THEN RAISE(ABORT, 'sale event replacement snapshot is invalid') END;

  SELECT CASE WHEN NEW.sequence = 1 AND NOT EXISTS (
    SELECT 1 FROM artist_verified_sales sale
     WHERE sale.id = NEW.sale_id
       AND json_extract(NEW.before_json, '$.reconnectionCaseId') IS sale.reconnection_case_id
       AND json_extract(NEW.before_json, '$.occurrencePrecision') = sale.occurrence_precision
       AND json_extract(NEW.before_json, '$.occurredOn') IS sale.occurred_on
       AND json_extract(NEW.before_json, '$.buyerEmail') IS sale.buyer_email
       AND json_extract(NEW.before_json, '$.currency') IS sale.currency
       AND json_extract(NEW.before_json, '$.totalMinor') IS sale.total_minor
       AND json_extract(NEW.before_json, '$.privateReference') IS sale.private_reference
       AND json_extract(NEW.before_json, '$.privateNotes') IS sale.private_notes
       AND json_extract(NEW.before_json, '$.verifiedByUserId') = sale.verified_by_user_id
       AND json_extract(NEW.before_json, '$.recordedAt') = sale.recorded_at
  ) THEN RAISE(ABORT, 'sale event before snapshot does not match base sale') END;

  SELECT CASE WHEN NEW.sequence > 1 AND NOT EXISTS (
    SELECT 1 FROM artist_verified_sale_events prior
     WHERE prior.sale_id = NEW.sale_id
       AND prior.sequence = NEW.sequence - 1
       AND json_extract(prior.after_json, '$.reconnectionCaseId') IS json_extract(NEW.before_json, '$.reconnectionCaseId')
       AND json_extract(prior.after_json, '$.occurrencePrecision') IS json_extract(NEW.before_json, '$.occurrencePrecision')
       AND json_extract(prior.after_json, '$.occurredOn') IS json_extract(NEW.before_json, '$.occurredOn')
       AND json_extract(prior.after_json, '$.buyerEmail') IS json_extract(NEW.before_json, '$.buyerEmail')
       AND json_extract(prior.after_json, '$.currency') IS json_extract(NEW.before_json, '$.currency')
       AND json_extract(prior.after_json, '$.totalMinor') IS json_extract(NEW.before_json, '$.totalMinor')
       AND json_extract(prior.after_json, '$.privateReference') IS json_extract(NEW.before_json, '$.privateReference')
       AND json_extract(prior.after_json, '$.privateNotes') IS json_extract(NEW.before_json, '$.privateNotes')
       AND json_extract(prior.after_json, '$.verifiedByUserId') IS json_extract(NEW.before_json, '$.verifiedByUserId')
       AND json_extract(prior.after_json, '$.recordedAt') IS json_extract(NEW.before_json, '$.recordedAt')
  ) THEN RAISE(ABORT, 'sale event before snapshot does not continue prior event') END;

  SELECT CASE WHEN NEW.event_type = 'corrected'
    AND json(NEW.before_json) = json(NEW.after_json)
  THEN RAISE(ABORT, 'sale correction must replace the snapshot') END;

  SELECT CASE WHEN NEW.event_type = 'shared_message_appended' AND NOT (
    json_extract(NEW.before_json, '$.reconnectionCaseId') IS json_extract(NEW.after_json, '$.reconnectionCaseId')
    AND json_extract(NEW.before_json, '$.occurrencePrecision') IS json_extract(NEW.after_json, '$.occurrencePrecision')
    AND json_extract(NEW.before_json, '$.occurredOn') IS json_extract(NEW.after_json, '$.occurredOn')
    AND json_extract(NEW.before_json, '$.buyerEmail') IS json_extract(NEW.after_json, '$.buyerEmail')
    AND json_extract(NEW.before_json, '$.currency') IS json_extract(NEW.after_json, '$.currency')
    AND json_extract(NEW.before_json, '$.totalMinor') IS json_extract(NEW.after_json, '$.totalMinor')
    AND json_extract(NEW.before_json, '$.privateReference') IS json_extract(NEW.after_json, '$.privateReference')
    AND json_extract(NEW.before_json, '$.verifiedByUserId') IS json_extract(NEW.after_json, '$.verifiedByUserId')
    AND json_extract(NEW.before_json, '$.recordedAt') IS json_extract(NEW.after_json, '$.recordedAt')
    AND json_type(NEW.after_json, '$.privateNotes') = 'text'
    AND json_extract(NEW.after_json, '$.privateNotes') IS NOT json_extract(NEW.before_json, '$.privateNotes')
  ) THEN RAISE(ABORT, 'shared message event may change only private notes') END;
END;

-- SQLite's REPLACE conflict handler deletes the conflicting row before
-- inserting its replacement. BEFORE INSERT collision guards preserve every
-- permanent identity even when recursive_triggers is disabled.
CREATE TRIGGER artist_reconnection_cases_insert_collision
BEFORE INSERT ON artist_reconnection_cases
WHEN EXISTS (
  SELECT 1 FROM artist_reconnection_cases prior
   WHERE prior.id = NEW.id OR prior.idempotency_key = NEW.idempotency_key
)
BEGIN
  SELECT RAISE(ABORT, 'artist reconnection case identity collision');
END;

CREATE TRIGGER artist_artwork_records_insert_collision
BEFORE INSERT ON artist_artwork_records
WHEN EXISTS (
  SELECT 1 FROM artist_artwork_records prior
   WHERE prior.id = NEW.id
      OR (NEW.keeper_piece_id IS NOT NULL AND prior.keeper_piece_id = NEW.keeper_piece_id)
)
BEGIN
  SELECT RAISE(ABORT, 'artist artwork record identity collision');
END;

CREATE TRIGGER artist_artwork_record_events_insert_collision
BEFORE INSERT ON artist_artwork_record_events
WHEN EXISTS (
  SELECT 1 FROM artist_artwork_record_events prior
   WHERE prior.id = NEW.id
      OR prior.idempotency_key = NEW.idempotency_key
      OR (
        prior.artwork_record_id = NEW.artwork_record_id
        AND prior.resulting_version = NEW.resulting_version
      )
)
BEGIN
  SELECT RAISE(ABORT, 'artist artwork record event identity collision');
END;

CREATE TRIGGER artist_verified_sales_insert_collision
BEFORE INSERT ON artist_verified_sales
WHEN EXISTS (
  SELECT 1 FROM artist_verified_sales prior
   WHERE prior.id = NEW.id OR prior.idempotency_key = NEW.idempotency_key
)
BEGIN
  SELECT RAISE(ABORT, 'artist verified sale identity collision');
END;

CREATE TRIGGER artist_verified_sale_events_insert_collision
BEFORE INSERT ON artist_verified_sale_events
WHEN EXISTS (
  SELECT 1 FROM artist_verified_sale_events prior
   WHERE prior.id = NEW.id
      OR prior.idempotency_key = NEW.idempotency_key
      OR (prior.sale_id = NEW.sale_id AND prior.sequence = NEW.sequence)
)
BEGIN
  SELECT RAISE(ABORT, 'artist verified sale event identity collision');
END;

CREATE TRIGGER artist_verified_sale_items_insert_collision
BEFORE INSERT ON artist_verified_sale_items
WHEN EXISTS (
  SELECT 1 FROM artist_verified_sale_items prior
   WHERE prior.id = NEW.id
      OR (
        prior.sale_id = NEW.sale_id
        AND prior.artwork_record_id = NEW.artwork_record_id
      )
)
BEGIN
  SELECT RAISE(ABORT, 'artist verified sale item identity collision');
END;

CREATE TRIGGER artist_artwork_media_insert_collision
BEFORE INSERT ON artist_artwork_media
WHEN EXISTS (
  SELECT 1 FROM artist_artwork_media prior
   WHERE prior.id = NEW.id OR prior.storage_reference = NEW.storage_reference
)
BEGIN
  SELECT RAISE(ABORT, 'artist artwork media identity collision');
END;

CREATE TRIGGER artist_artwork_ledger_entries_insert_collision
BEFORE INSERT ON artist_artwork_ledger_entries
WHEN EXISTS (
  SELECT 1 FROM artist_artwork_ledger_entries prior
   WHERE prior.id = NEW.id OR prior.idempotency_key = NEW.idempotency_key
)
BEGIN
  SELECT RAISE(ABORT, 'artist artwork ledger identity collision');
END;

CREATE TRIGGER artist_artwork_ledger_entries_reference_match
BEFORE INSERT ON artist_artwork_ledger_entries
WHEN (
  NEW.media_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM artist_artwork_media media
     WHERE media.id = NEW.media_id
       AND media.artwork_record_id = NEW.artwork_record_id
  )
) OR (
  NEW.sale_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM artist_verified_sale_items item
     WHERE item.sale_id = NEW.sale_id
       AND item.artwork_record_id = NEW.artwork_record_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'artist artwork ledger references must belong to the same artwork');
END;

CREATE TRIGGER artist_artwork_price_entries_insert_collision
BEFORE INSERT ON artist_artwork_price_entries
WHEN EXISTS (
  SELECT 1 FROM artist_artwork_price_entries prior
   WHERE prior.id = NEW.id OR prior.sale_item_id = NEW.sale_item_id
)
BEGIN
  SELECT RAISE(ABORT, 'artist artwork price identity collision');
END;

CREATE TRIGGER artist_artwork_price_entries_exact_sale_facts
BEFORE INSERT ON artist_artwork_price_entries
WHEN NOT EXISTS (
  SELECT 1
    FROM artist_verified_sale_items item
    JOIN artist_verified_sales sale ON sale.id = item.sale_id
   WHERE item.id = NEW.sale_item_id
     AND item.artwork_record_id = NEW.artwork_record_id
     AND item.amount_minor IS NOT NULL
     AND item.currency IS NOT NULL
     AND item.amount_minor = NEW.amount_minor
     AND item.currency = NEW.currency
     AND sale.occurred_on IS NEW.occurred_on
     AND sale.occurrence_precision = NEW.occurrence_precision
)
BEGIN
  SELECT RAISE(ABORT, 'artist artwork price must match its sale item and immutable base sale facts');
END;

CREATE TRIGGER artist_reconnection_events_insert_collision
BEFORE INSERT ON artist_reconnection_events
WHEN EXISTS (
  SELECT 1 FROM artist_reconnection_events prior
   WHERE prior.id = NEW.id OR prior.idempotency_key = NEW.idempotency_key
)
BEGIN
  SELECT RAISE(ABORT, 'artist reconnection event identity collision');
END;

-- Public lineage payloads use a deliberately tiny, flat vocabulary. The
-- vocabulary admits every canonical payload and the safe grandfathered
-- subsets restored by older archives, while recursively rejecting private
-- aliases and private-looking values before they can enter the public chain.
CREATE TRIGGER artwork_lineage_public_payload_privacy
BEFORE INSERT ON artwork_lineage_events
BEGIN
  SELECT CASE WHEN json_valid(NEW.public_payload_json) = 0
  THEN RAISE(ABORT, 'public lineage payload must be valid JSON') END;

  SELECT CASE WHEN json_type(NEW.public_payload_json) <> 'object'
  THEN RAISE(ABORT, 'public lineage payload must be an object') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1
      FROM json_tree(NEW.public_payload_json) node
     WHERE node.fullkey <> '$'
       AND node.type IN ('array', 'object')
  ) THEN RAISE(ABORT, 'public lineage payload must remain flat') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1
      FROM json_tree(NEW.public_payload_json) node
     WHERE node.key IS NOT NULL
       AND lower(replace(replace(replace(CAST(node.key AS TEXT), '_', ''), '-', ''), ' ', ''))
         NOT IN (
           'pieceid', 'editionnumber', 'publiccode', 'platestatus',
           'fromref', 'toref', 'transferkind'
         )
  ) THEN RAISE(ABORT, 'private lineage payload key is forbidden') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1
      FROM json_tree(NEW.public_payload_json) node
     WHERE node.atom IS NOT NULL
       AND typeof(node.atom) = 'text'
       AND (
         CAST(node.atom AS TEXT) GLOB '*@*'
         OR CAST(node.atom AS TEXT) GLOB '*/*'
         OR lower(CAST(node.atom AS TEXT)) GLOB 'record-*'
         OR lower(CAST(node.atom AS TEXT)) GLOB 'sale-*'
         OR lower(CAST(node.atom AS TEXT)) GLOB 'item-*'
         OR lower(CAST(node.atom AS TEXT)) GLOB 'media-*'
         OR lower(CAST(node.atom AS TEXT)) GLOB 'ledger-*'
         OR lower(CAST(node.atom AS TEXT)) GLOB 'price-*'
         OR lower(CAST(node.atom AS TEXT)) GLOB 'case-*'
       )
  ) THEN RAISE(ABORT, 'private lineage payload value is forbidden') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1
      FROM json_tree(NEW.public_payload_json) node
     WHERE lower(replace(replace(replace(CAST(node.key AS TEXT), '_', ''), '-', ''), ' ', '')) = 'pieceid'
       AND NOT (
         node.type = 'text'
         AND length(CAST(node.atom AS TEXT)) BETWEEN 6 AND 7
         AND CAST(node.atom AS TEXT) GLOB '[A-Z][A-Z]*-[0-9][0-9][0-9]'
       )
  ) THEN RAISE(ABORT, 'invalid public lineage piece id') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1
      FROM json_tree(NEW.public_payload_json) node
     WHERE lower(replace(replace(replace(CAST(node.key AS TEXT), '_', ''), '-', ''), ' ', '')) = 'editionnumber'
       AND NOT (node.type = 'integer' AND CAST(node.atom AS INTEGER) >= 0)
  ) THEN RAISE(ABORT, 'invalid public lineage edition number') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1
      FROM json_tree(NEW.public_payload_json) node
     WHERE lower(replace(replace(replace(CAST(node.key AS TEXT), '_', ''), '-', ''), ' ', '')) = 'publiccode'
       AND NOT (
         node.type = 'text'
         AND length(CAST(node.atom AS TEXT)) = 11
         AND substr(CAST(node.atom AS TEXT), 1, 3) = 'AR-'
         AND substr(CAST(node.atom AS TEXT), 4) NOT GLOB '*[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]*'
       )
  ) THEN RAISE(ABORT, 'invalid public lineage public code') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1
      FROM json_tree(NEW.public_payload_json) node
     WHERE lower(replace(replace(replace(CAST(node.key AS TEXT), '_', ''), '-', ''), ' ', '')) = 'platestatus'
       AND NOT (node.type = 'text' AND node.atom IN ('active', 'void', 'superseded'))
  ) THEN RAISE(ABORT, 'invalid public lineage plate status') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1
      FROM json_tree(NEW.public_payload_json) node
     WHERE lower(replace(replace(replace(CAST(node.key AS TEXT), '_', ''), '-', ''), ' ', ''))
         IN ('fromref', 'toref')
       AND NOT (
         node.type = 'text'
         AND length(CAST(node.atom AS TEXT)) = 39
         AND substr(CAST(node.atom AS TEXT), 1, 3) = 'tp-'
         AND substr(CAST(node.atom AS TEXT), 12, 1) = '-'
         AND substr(CAST(node.atom AS TEXT), 17, 1) = '-'
         AND substr(CAST(node.atom AS TEXT), 18, 1) = '4'
         AND substr(CAST(node.atom AS TEXT), 22, 1) = '-'
         AND substr(CAST(node.atom AS TEXT), 23, 1) IN ('8', '9', 'a', 'b')
         AND substr(CAST(node.atom AS TEXT), 27, 1) = '-'
         AND substr(CAST(node.atom AS TEXT), 4) NOT GLOB '*[^0-9a-f-]*'
       )
  ) THEN RAISE(ABORT, 'invalid public lineage transfer reference') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1
      FROM json_tree(NEW.public_payload_json) node
     WHERE lower(replace(replace(replace(CAST(node.key AS TEXT), '_', ''), '-', ''), ' ', '')) = 'transferkind'
       AND NOT (
         node.type = 'text'
         AND node.atom IN ('sale', 'gift', 'inheritance', 'artist-rebind')
       )
  ) THEN RAISE(ABORT, 'invalid public lineage transfer kind') END;
END;

CREATE TRIGGER artwork_lineage_events_insert_collision
BEFORE INSERT ON artwork_lineage_events
WHEN EXISTS (
  SELECT 1 FROM artwork_lineage_events prior
   WHERE prior.id = NEW.id
      OR prior.event_hash = NEW.event_hash
      OR (
        prior.keeper_piece_id = NEW.keeper_piece_id
        AND prior.sequence = NEW.sequence
      )
      OR (
        NEW.previous_hash IS NOT NULL
        AND prior.keeper_piece_id = NEW.keeper_piece_id
        AND prior.previous_hash = NEW.previous_hash
      )
)
BEGIN
  SELECT RAISE(ABORT, 'artwork lineage event identity collision');
END;

CREATE TRIGGER artist_reconnection_cases_no_update
BEFORE UPDATE ON artist_reconnection_cases BEGIN
  SELECT RAISE(ABORT, 'artist reconnection cases are append-only');
END;
CREATE TRIGGER artist_reconnection_cases_no_delete
BEFORE DELETE ON artist_reconnection_cases BEGIN
  SELECT RAISE(ABORT, 'artist reconnection cases are append-only');
END;
CREATE TRIGGER artist_reconnection_events_no_update
BEFORE UPDATE ON artist_reconnection_events BEGIN
  SELECT RAISE(ABORT, 'artist reconnection events are append-only');
END;
CREATE TRIGGER artist_reconnection_events_no_delete
BEFORE DELETE ON artist_reconnection_events BEGIN
  SELECT RAISE(ABORT, 'artist reconnection events are append-only');
END;
CREATE TRIGGER artist_artwork_record_events_no_update
BEFORE UPDATE ON artist_artwork_record_events BEGIN
  SELECT RAISE(ABORT, 'artist artwork record events are append-only');
END;
CREATE TRIGGER artist_artwork_record_events_no_delete
BEFORE DELETE ON artist_artwork_record_events BEGIN
  SELECT RAISE(ABORT, 'artist artwork record events are append-only');
END;
CREATE TRIGGER artist_verified_sales_no_update
BEFORE UPDATE ON artist_verified_sales BEGIN
  SELECT RAISE(ABORT, 'artist verified sales are append-only');
END;
CREATE TRIGGER artist_verified_sales_no_delete
BEFORE DELETE ON artist_verified_sales BEGIN
  SELECT RAISE(ABORT, 'artist verified sales are append-only');
END;
CREATE TRIGGER artist_verified_sale_events_no_update
BEFORE UPDATE ON artist_verified_sale_events BEGIN
  SELECT RAISE(ABORT, 'artist verified sale events are append-only');
END;
CREATE TRIGGER artist_verified_sale_events_no_delete
BEFORE DELETE ON artist_verified_sale_events BEGIN
  SELECT RAISE(ABORT, 'artist verified sale events are append-only');
END;
CREATE TRIGGER artist_verified_sale_items_no_update
BEFORE UPDATE ON artist_verified_sale_items BEGIN
  SELECT RAISE(ABORT, 'artist verified sale items are append-only');
END;
CREATE TRIGGER artist_verified_sale_items_no_delete
BEFORE DELETE ON artist_verified_sale_items BEGIN
  SELECT RAISE(ABORT, 'artist verified sale items are append-only');
END;
CREATE TRIGGER artist_artwork_media_no_update
BEFORE UPDATE ON artist_artwork_media BEGIN
  SELECT RAISE(ABORT, 'artist artwork media are append-only');
END;
CREATE TRIGGER artist_artwork_media_no_delete
BEFORE DELETE ON artist_artwork_media BEGIN
  SELECT RAISE(ABORT, 'artist artwork media are append-only');
END;
CREATE TRIGGER artist_artwork_ledger_entries_no_update
BEFORE UPDATE ON artist_artwork_ledger_entries BEGIN
  SELECT RAISE(ABORT, 'artist artwork ledger entries are append-only');
END;
CREATE TRIGGER artist_artwork_ledger_entries_no_delete
BEFORE DELETE ON artist_artwork_ledger_entries BEGIN
  SELECT RAISE(ABORT, 'artist artwork ledger entries are append-only');
END;
CREATE TRIGGER artist_artwork_price_entries_no_update
BEFORE UPDATE ON artist_artwork_price_entries BEGIN
  SELECT RAISE(ABORT, 'artist artwork price entries are append-only');
END;
CREATE TRIGGER artist_artwork_price_entries_no_delete
BEFORE DELETE ON artist_artwork_price_entries BEGIN
  SELECT RAISE(ABORT, 'artist artwork price entries are append-only');
END;

PRAGMA foreign_key_check;
