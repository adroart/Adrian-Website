-- Durable plate retirement and replacement lifecycle.
-- Historical public codes and issuance keys remain permanently unique. Only
-- non-retired rows occupy an artwork/edition identity.

CREATE TABLE keeper_piece_lifecycle_existing_guard (
  conflict_count INTEGER NOT NULL
    CONSTRAINT keeper_piece_lifecycle_existing_conflict CHECK (conflict_count = 0)
);
INSERT INTO keeper_piece_lifecycle_existing_guard (conflict_count)
SELECT COUNT(*) FROM (
  SELECT piece_id, edition_number
    FROM keeper_pieces
   WHERE plate_status IN ('legacy', 'generated', 'active')
   GROUP BY piece_id, edition_number
  HAVING COUNT(*) > 1
);
DROP TABLE keeper_piece_lifecycle_existing_guard;

CREATE TABLE keeper_pieces_new (
  id TEXT PRIMARY KEY,
  piece_id TEXT NOT NULL,
  edition_number INTEGER NOT NULL DEFAULT 0,
  keeper_user_id TEXT,
  recovery_code_hash TEXT NOT NULL UNIQUE,
  current_display_location TEXT,
  registered_at TEXT,
  claimed_at TEXT,
  released_at TEXT,
  public_code TEXT,
  issuance_key TEXT,
  plate_status TEXT NOT NULL DEFAULT 'legacy'
    CHECK (plate_status IN ('legacy', 'generated', 'active', 'void', 'superseded')),
  plate_generated_at TEXT,
  plate_activated_at TEXT,
  front_svg_sha256 TEXT,
  back_svg_sha256 TEXT,
  ownership_code_ciphertext TEXT,
  ownership_code_nonce TEXT,
  ownership_code_key_version INTEGER,
  backup_status TEXT,
  backup_reference TEXT,
  backup_at TEXT,
  lineage_head_hash TEXT,
  lineage_event_count INTEGER NOT NULL DEFAULT 0 CHECK (lineage_event_count >= 0),
  record_version INTEGER NOT NULL DEFAULT 0
    CHECK (typeof(record_version) = 'integer' AND record_version >= 0),
  steward_version INTEGER NOT NULL DEFAULT 0
    CHECK (typeof(steward_version) = 'integer' AND steward_version >= 0),
  supersedes_keeper_piece_id TEXT
    REFERENCES keeper_pieces_new(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  superseded_by_keeper_piece_id TEXT
    REFERENCES keeper_pieces_new(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  physical_disposition TEXT CHECK (
    physical_disposition IS NULL
    OR (typeof(physical_disposition) = 'text'
      AND length(trim(physical_disposition)) BETWEEN 1 AND 1000)
  ),
  replaced_at TEXT CHECK (
    replaced_at IS NULL
    OR (typeof(replaced_at) = 'text' AND length(trim(replaced_at)) BETWEEN 1 AND 40)
  ),
  CHECK (supersedes_keeper_piece_id IS NULL OR supersedes_keeper_piece_id <> id),
  CHECK (superseded_by_keeper_piece_id IS NULL OR superseded_by_keeper_piece_id <> id),
  CHECK (
    (plate_status = 'void' AND physical_disposition IS NOT NULL)
    OR plate_status <> 'void'
  ),
  CHECK (
    (plate_status = 'superseded'
      AND superseded_by_keeper_piece_id IS NOT NULL
      AND physical_disposition IS NOT NULL
      AND replaced_at IS NOT NULL)
    OR plate_status <> 'superseded'
  ),
  CHECK (
    supersedes_keeper_piece_id IS NULL
    OR plate_status <> 'legacy'
  )
);

INSERT INTO keeper_pieces_new (
  id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
  current_display_location, registered_at, claimed_at, released_at,
  public_code, issuance_key, plate_status, plate_generated_at,
  plate_activated_at, front_svg_sha256, back_svg_sha256,
  ownership_code_ciphertext, ownership_code_nonce, ownership_code_key_version,
  backup_status, backup_reference, backup_at, lineage_head_hash,
  lineage_event_count, record_version, steward_version,
  supersedes_keeper_piece_id, superseded_by_keeper_piece_id,
  physical_disposition, replaced_at
)
SELECT
  id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
  current_display_location, registered_at, claimed_at, released_at,
  public_code, issuance_key, plate_status, plate_generated_at,
  plate_activated_at, front_svg_sha256, back_svg_sha256,
  ownership_code_ciphertext, ownership_code_nonce, ownership_code_key_version,
  backup_status, backup_reference, backup_at, lineage_head_hash,
  lineage_event_count, record_version, steward_version,
  NULL, NULL, NULL, NULL
FROM keeper_pieces;

CREATE TABLE ownership_code_audit_new (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces_new(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  request_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO ownership_code_audit_new
SELECT id, keeper_piece_id, action, request_id, outcome, created_at
FROM ownership_code_audit;

CREATE TABLE piece_fulfillments_new (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL UNIQUE REFERENCES keeper_pieces_new(id) ON DELETE RESTRICT,
  order_item_id INTEGER UNIQUE REFERENCES order_items(id) ON DELETE RESTRICT,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('stripe_order', 'manual')),
  intended_recipient_reference TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  shipped_at TEXT,
  claimed_at TEXT,
  corrected_at TEXT,
  correction_reason TEXT,
  CHECK (
    (assignment_type = 'stripe_order' AND order_item_id IS NOT NULL)
    OR (assignment_type = 'manual' AND order_item_id IS NULL)
  ),
  CHECK (
    (corrected_at IS NULL AND correction_reason IS NULL)
    OR (corrected_at IS NOT NULL AND correction_reason IS NOT NULL)
  )
);
INSERT INTO piece_fulfillments_new
SELECT id, keeper_piece_id, order_item_id, assignment_type,
       intended_recipient_reference, assigned_at, shipped_at, claimed_at,
       corrected_at, correction_reason
FROM piece_fulfillments;

CREATE TABLE artwork_claim_evidence_new (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces_new(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL,
  verified_email TEXT NOT NULL CHECK (length(verified_email) BETWEEN 1 AND 254),
  ip_address TEXT CHECK (ip_address IS NULL OR length(ip_address) <= 64),
  user_agent TEXT CHECK (user_agent IS NULL OR length(user_agent) <= 512),
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO artwork_claim_evidence_new
SELECT id, keeper_piece_id, actor_user_id, verified_email, ip_address,
       user_agent, outcome, created_at
FROM artwork_claim_evidence;

CREATE TABLE artwork_lineage_events_new (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces_new(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'issued', 'activated', 'fulfillment_assign', 'fulfillment_correct',
    'fulfillment_correction_out', 'fulfillment_correction_in',
    'fulfillment_ship', 'first_bound', 'migration_baseline',
    'link_corrected', 'voided', 'superseded'
  )),
  event_at TEXT NOT NULL,
  previous_hash TEXT,
  event_hash TEXT NOT NULL,
  public_payload_json TEXT NOT NULL,
  CHECK ((sequence = 1 AND previous_hash IS NULL) OR (sequence > 1 AND previous_hash IS NOT NULL)),
  UNIQUE (keeper_piece_id, sequence),
  UNIQUE (keeper_piece_id, previous_hash),
  UNIQUE (event_hash)
);
INSERT INTO artwork_lineage_events_new
SELECT id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json
FROM artwork_lineage_events;

CREATE TABLE artwork_acquisitions_new (
  id ANY PRIMARY KEY CHECK (typeof(id) = 'text' AND length(trim(id)) BETWEEN 1 AND 128),
  keeper_piece_id ANY NOT NULL REFERENCES keeper_pieces_new(id) ON DELETE RESTRICT CHECK (
    typeof(keeper_piece_id) = 'text' AND length(trim(keeper_piece_id)) BETWEEN 1 AND 128
  ),
  acquisition_type ANY NOT NULL CHECK (
    typeof(acquisition_type) = 'text'
    AND acquisition_type IN ('sale', 'gift', 'retained', 'loan', 'consignment', 'inheritance', 'other')
  ),
  acquired_at ANY CHECK (
    acquired_at IS NULL
    OR (typeof(acquired_at) = 'text' AND length(trim(acquired_at)) BETWEEN 1 AND 40)
  ),
  amount_minor INTEGER CHECK (
    amount_minor IS NULL OR (typeof(amount_minor) = 'integer' AND amount_minor >= 0)
  ),
  currency ANY CHECK (currency IS NULL OR typeof(currency) = 'text'),
  acquirer_reference ANY CHECK (
    acquirer_reference IS NULL
    OR (typeof(acquirer_reference) = 'text' AND length(acquirer_reference) <= 200)
  ),
  private_notes ANY CHECK (
    private_notes IS NULL
    OR (typeof(private_notes) = 'text' AND length(private_notes) <= 5000)
  ),
  document_reference ANY CHECK (
    document_reference IS NULL
    OR (typeof(document_reference) = 'text' AND length(document_reference) <= 1000)
  ),
  public_provenance ANY CHECK (
    public_provenance IS NULL
    OR (typeof(public_provenance) = 'text' AND length(public_provenance) <= 2000)
  ),
  record_version INTEGER NOT NULL DEFAULT 1 CHECK (
    typeof(record_version) = 'integer' AND record_version >= 1
  ),
  created_at ANY NOT NULL CHECK (
    typeof(created_at) = 'text' AND length(trim(created_at)) BETWEEN 1 AND 40
  ),
  updated_at ANY NOT NULL CHECK (
    typeof(updated_at) = 'text' AND length(trim(updated_at)) BETWEEN 1 AND 40
  ),
  CHECK (
    (amount_minor IS NULL AND currency IS NULL)
    OR (amount_minor IS NOT NULL AND typeof(currency) = 'text'
      AND length(currency) = 3 AND currency GLOB '[A-Z][A-Z][A-Z]')
  )
) STRICT;
INSERT INTO artwork_acquisitions_new
SELECT id, keeper_piece_id, acquisition_type, acquired_at, amount_minor,
       currency, acquirer_reference, private_notes, document_reference,
       public_provenance, record_version, created_at, updated_at
FROM artwork_acquisitions;

CREATE TABLE registry_maintenance_events_new (
  id ANY PRIMARY KEY CHECK (typeof(id) = 'text' AND length(trim(id)) BETWEEN 1 AND 128),
  idempotency_key ANY NOT NULL UNIQUE CHECK (
    typeof(idempotency_key) = 'text' AND length(trim(idempotency_key)) BETWEEN 1 AND 128
  ),
  event_type ANY NOT NULL CHECK (
    typeof(event_type) = 'text' AND length(trim(event_type)) BETWEEN 1 AND 80
  ),
  keeper_piece_id ANY REFERENCES keeper_pieces_new(id) ON DELETE RESTRICT CHECK (
    keeper_piece_id IS NULL
    OR (typeof(keeper_piece_id) = 'text' AND length(trim(keeper_piece_id)) BETWEEN 1 AND 128)
  ),
  artwork_id ANY CHECK (
    artwork_id IS NULL
    OR (typeof(artwork_id) = 'text' AND length(trim(artwork_id)) BETWEEN 1 AND 80)
  ),
  administrator_user_id ANY NOT NULL CHECK (
    typeof(administrator_user_id) = 'text' AND length(trim(administrator_user_id)) BETWEEN 1 AND 128
  ),
  administrator_email ANY NOT NULL CHECK (
    typeof(administrator_email) = 'text' AND length(trim(administrator_email)) BETWEEN 1 AND 254
  ),
  reason ANY NOT NULL CHECK (
    typeof(reason) = 'text' AND length(trim(reason)) BETWEEN 1 AND 500
  ),
  before_json ANY NOT NULL CHECK (typeof(before_json) = 'text' AND json_valid(before_json)),
  after_json ANY NOT NULL CHECK (typeof(after_json) = 'text' AND json_valid(after_json)),
  outcome ANY NOT NULL CHECK (
    typeof(outcome) = 'text' AND outcome IN ('succeeded', 'failed')
  ),
  related_record_id ANY CHECK (
    related_record_id IS NULL
    OR (typeof(related_record_id) = 'text' AND length(trim(related_record_id)) BETWEEN 1 AND 128)
  ),
  mutation_fingerprint ANY NOT NULL CHECK (
    typeof(mutation_fingerprint) = 'text' AND length(mutation_fingerprint) = 64
    AND mutation_fingerprint NOT GLOB '*[^0-9a-f]*'
  ),
  created_at ANY NOT NULL CHECK (
    typeof(created_at) = 'text' AND length(trim(created_at)) BETWEEN 1 AND 40
  )
) STRICT;
INSERT INTO registry_maintenance_events_new
SELECT id, idempotency_key, event_type, keeper_piece_id, artwork_id,
       administrator_user_id, administrator_email, reason, before_json,
       after_json, outcome, related_record_id, mutation_fingerprint, created_at
FROM registry_maintenance_events;

DROP TABLE registry_maintenance_events;
DROP TABLE artwork_acquisitions;
DROP TABLE artwork_lineage_events;
DROP TABLE artwork_claim_evidence;
DROP TABLE piece_fulfillments;
DROP TABLE ownership_code_audit;
DROP TABLE keeper_pieces;

ALTER TABLE keeper_pieces_new RENAME TO keeper_pieces;
ALTER TABLE ownership_code_audit_new RENAME TO ownership_code_audit;
ALTER TABLE piece_fulfillments_new RENAME TO piece_fulfillments;
ALTER TABLE artwork_claim_evidence_new RENAME TO artwork_claim_evidence;
ALTER TABLE artwork_lineage_events_new RENAME TO artwork_lineage_events;
ALTER TABLE artwork_acquisitions_new RENAME TO artwork_acquisitions;
ALTER TABLE registry_maintenance_events_new RENAME TO registry_maintenance_events;

CREATE INDEX idx_keeper_pieces_keeper ON keeper_pieces(keeper_user_id);
CREATE INDEX idx_keeper_pieces_piece ON keeper_pieces(piece_id, edition_number);
CREATE UNIQUE INDEX uniq_keeper_pieces_current_identity
  ON keeper_pieces(piece_id, edition_number)
  WHERE plate_status NOT IN ('void', 'superseded');
CREATE UNIQUE INDEX uniq_keeper_pieces_public_code
  ON keeper_pieces(public_code) WHERE public_code IS NOT NULL;
CREATE UNIQUE INDEX uniq_keeper_pieces_issuance_key
  ON keeper_pieces(issuance_key) WHERE issuance_key IS NOT NULL;
CREATE INDEX idx_keeper_pieces_plate_status ON keeper_pieces(plate_status);
CREATE INDEX idx_keeper_pieces_supersedes ON keeper_pieces(supersedes_keeper_piece_id);
CREATE INDEX idx_keeper_pieces_superseded_by ON keeper_pieces(superseded_by_keeper_piece_id);
CREATE UNIQUE INDEX uniq_keeper_pieces_supersedes
  ON keeper_pieces(supersedes_keeper_piece_id)
  WHERE supersedes_keeper_piece_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_keeper_pieces_superseded_by
  ON keeper_pieces(superseded_by_keeper_piece_id)
  WHERE superseded_by_keeper_piece_id IS NOT NULL;

CREATE INDEX idx_ownership_code_audit_piece_created
  ON ownership_code_audit(keeper_piece_id, created_at DESC);
CREATE INDEX idx_ownership_code_audit_request ON ownership_code_audit(request_id);
CREATE INDEX idx_piece_fulfillments_assignment
  ON piece_fulfillments(assignment_type, assigned_at DESC);
CREATE INDEX idx_piece_fulfillments_shipped ON piece_fulfillments(shipped_at);
CREATE UNIQUE INDEX uniq_piece_fulfillments_manual_reference
  ON piece_fulfillments(intended_recipient_reference) WHERE assignment_type = 'manual';
CREATE INDEX idx_claim_evidence_piece_created
  ON artwork_claim_evidence(keeper_piece_id, created_at DESC);
CREATE INDEX idx_lineage_piece_sequence
  ON artwork_lineage_events(keeper_piece_id, sequence);
CREATE INDEX idx_artwork_acquisitions_piece_acquired
  ON artwork_acquisitions(keeper_piece_id, acquired_at DESC);
CREATE INDEX idx_registry_maintenance_piece_created
  ON registry_maintenance_events(keeper_piece_id, created_at DESC);
CREATE INDEX idx_registry_maintenance_type_created
  ON registry_maintenance_events(event_type, created_at DESC);

CREATE TRIGGER keeper_piece_edition_range_guard_insert
BEFORE INSERT ON keeper_pieces
WHEN typeof(NEW.edition_number) <> 'integer'
  OR NEW.edition_number < 0 OR NEW.edition_number > 9999
BEGIN
  SELECT RAISE(ABORT, 'keeper_piece_edition_range_violation');
END;

CREATE TRIGGER keeper_piece_edition_range_guard_update
BEFORE UPDATE ON keeper_pieces
WHEN typeof(NEW.edition_number) <> 'integer'
  OR NEW.edition_number < 0 OR NEW.edition_number > 9999
BEGIN
  SELECT RAISE(ABORT, 'keeper_piece_edition_range_violation');
END;

CREATE TRIGGER keeper_piece_edition_kind_guard_insert
BEFORE INSERT ON keeper_pieces
WHEN NEW.plate_status NOT IN ('void', 'superseded') AND ((
  NEW.edition_number = 0 AND EXISTS (
    SELECT 1 FROM keeper_pieces
     WHERE piece_id = NEW.piece_id AND edition_number > 0
       AND plate_status NOT IN ('void', 'superseded')
  )
) OR (
  NEW.edition_number > 0 AND EXISTS (
    SELECT 1 FROM keeper_pieces
     WHERE piece_id = NEW.piece_id AND edition_number = 0
       AND plate_status NOT IN ('void', 'superseded')
  )
))
BEGIN
  SELECT RAISE(ABORT, 'keeper_piece_edition_kind_conflict');
END;

CREATE TRIGGER keeper_piece_edition_kind_guard_update
BEFORE UPDATE OF piece_id, edition_number, plate_status ON keeper_pieces
WHEN NEW.plate_status NOT IN ('void', 'superseded') AND ((
  NEW.edition_number = 0 AND EXISTS (
    SELECT 1 FROM keeper_pieces
     WHERE piece_id = NEW.piece_id AND edition_number > 0 AND id <> OLD.id
       AND plate_status NOT IN ('void', 'superseded')
  )
) OR (
  NEW.edition_number > 0 AND EXISTS (
    SELECT 1 FROM keeper_pieces
     WHERE piece_id = NEW.piece_id AND edition_number = 0 AND id <> OLD.id
       AND plate_status NOT IN ('void', 'superseded')
  )
))
BEGIN
  SELECT RAISE(ABORT, 'keeper_piece_edition_kind_conflict');
END;

CREATE TRIGGER keeper_pieces_record_version_auto_increment
AFTER UPDATE OF
  piece_id, edition_number, recovery_code_hash, registered_at,
  public_code, issuance_key, plate_status, plate_generated_at,
  plate_activated_at, front_svg_sha256, back_svg_sha256,
  ownership_code_ciphertext, ownership_code_nonce, ownership_code_key_version,
  backup_status, backup_reference, backup_at, supersedes_keeper_piece_id,
  superseded_by_keeper_piece_id, physical_disposition, replaced_at
ON keeper_pieces
WHEN NEW.record_version = OLD.record_version AND (
  NEW.piece_id IS NOT OLD.piece_id
  OR NEW.edition_number IS NOT OLD.edition_number
  OR NEW.recovery_code_hash IS NOT OLD.recovery_code_hash
  OR NEW.registered_at IS NOT OLD.registered_at
  OR NEW.public_code IS NOT OLD.public_code
  OR NEW.issuance_key IS NOT OLD.issuance_key
  OR NEW.plate_status IS NOT OLD.plate_status
  OR NEW.plate_generated_at IS NOT OLD.plate_generated_at
  OR NEW.plate_activated_at IS NOT OLD.plate_activated_at
  OR NEW.front_svg_sha256 IS NOT OLD.front_svg_sha256
  OR NEW.back_svg_sha256 IS NOT OLD.back_svg_sha256
  OR NEW.ownership_code_ciphertext IS NOT OLD.ownership_code_ciphertext
  OR NEW.ownership_code_nonce IS NOT OLD.ownership_code_nonce
  OR NEW.ownership_code_key_version IS NOT OLD.ownership_code_key_version
  OR NEW.backup_status IS NOT OLD.backup_status
  OR NEW.backup_reference IS NOT OLD.backup_reference
  OR NEW.backup_at IS NOT OLD.backup_at
  OR NEW.supersedes_keeper_piece_id IS NOT OLD.supersedes_keeper_piece_id
  OR NEW.superseded_by_keeper_piece_id IS NOT OLD.superseded_by_keeper_piece_id
  OR NEW.physical_disposition IS NOT OLD.physical_disposition
  OR NEW.replaced_at IS NOT OLD.replaced_at
)
BEGIN
  UPDATE keeper_pieces SET record_version = record_version + 1 WHERE id = NEW.id;
END;

CREATE TRIGGER keeper_pieces_steward_version_auto_increment
AFTER UPDATE OF keeper_user_id, claimed_at, released_at, current_display_location
ON keeper_pieces
WHEN NEW.steward_version = OLD.steward_version AND (
  NEW.keeper_user_id IS NOT OLD.keeper_user_id
  OR NEW.claimed_at IS NOT OLD.claimed_at
  OR NEW.released_at IS NOT OLD.released_at
  OR NEW.current_display_location IS NOT OLD.current_display_location
)
BEGIN
  UPDATE keeper_pieces SET steward_version = steward_version + 1 WHERE id = NEW.id;
END;

CREATE TRIGGER artwork_lineage_no_update
BEFORE UPDATE ON artwork_lineage_events
BEGIN
  SELECT RAISE(ABORT, 'artwork lineage is append-only');
END;
CREATE TRIGGER artwork_lineage_no_delete
BEFORE DELETE ON artwork_lineage_events
BEGIN
  SELECT RAISE(ABORT, 'artwork lineage is append-only');
END;
CREATE TRIGGER registry_maintenance_events_no_update
BEFORE UPDATE ON registry_maintenance_events
BEGIN
  SELECT RAISE(ABORT, 'registry maintenance history is append-only');
END;
CREATE TRIGGER registry_maintenance_events_no_delete
BEFORE DELETE ON registry_maintenance_events
BEGIN
  SELECT RAISE(ABORT, 'registry maintenance history is append-only');
END;

CREATE TABLE keeper_piece_lifecycle_fk_guard (
  violation_count INTEGER NOT NULL
    CONSTRAINT keeper_piece_lifecycle_foreign_key_conflict CHECK (violation_count = 0)
);
INSERT INTO keeper_piece_lifecycle_fk_guard (violation_count)
SELECT COUNT(*) FROM pragma_foreign_key_check;
DROP TABLE keeper_piece_lifecycle_fk_guard;
