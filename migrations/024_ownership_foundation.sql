-- Canonical contested claims and structurally authorized steward transfers.

-- Fail before installing the ownership boundary when legacy reset damage or a
-- half-bound keeper row would remain bearer-bindable or become unrepairable.
-- IF NOT EXISTS plus DELETE keeps a manually retried SQLite migration safe
-- after operators repair a database that failed this guard.
CREATE TABLE IF NOT EXISTS ownership_foundation_preflight_guard (
  conflict_count INTEGER NOT NULL
    CONSTRAINT ownership_foundation_preflight_failed CHECK (conflict_count = 0)
);
DELETE FROM ownership_foundation_preflight_guard;
INSERT INTO ownership_foundation_preflight_guard (conflict_count)
SELECT COUNT(*)
  FROM keeper_pieces piece
 WHERE (piece.keeper_user_id IS NULL) <> (piece.claimed_at IS NULL)
    OR (
      piece.keeper_user_id IS NULL
      AND piece.claimed_at IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM artwork_lineage_events lineage
           WHERE lineage.keeper_piece_id = piece.id
             AND lineage.event_type = 'first_bound'
        )
        OR EXISTS (
          SELECT 1 FROM registry_maintenance_events maintenance
           WHERE maintenance.keeper_piece_id = piece.id
             AND (
               (json_valid(maintenance.before_json)
                 AND COALESCE(
                   json_extract(maintenance.before_json, '$.keeperUserId'),
                   json_extract(maintenance.before_json, '$.keeper_user_id')
                 ) IS NOT NULL)
               OR (json_valid(maintenance.after_json)
                 AND COALESCE(
                   json_extract(maintenance.after_json, '$.keeperUserId'),
                   json_extract(maintenance.after_json, '$.keeper_user_id')
                 ) IS NOT NULL)
             )
        )
      )
    );
DROP TABLE ownership_foundation_preflight_guard;

CREATE TABLE artwork_claim_requests (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  requester_user_id TEXT NOT NULL CHECK (length(trim(requester_user_id)) BETWEEN 1 AND 128),
  requester_email TEXT NOT NULL CHECK (length(trim(requester_email)) BETWEEN 3 AND 254),
  note TEXT CHECK (note IS NULL OR length(note) BETWEEN 1 AND 500),
  routed_to_user_id TEXT NOT NULL CHECK (length(trim(routed_to_user_id)) BETWEEN 1 AND 128),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by_user_id TEXT,
  CHECK (
    (status = 'pending' AND resolved_at IS NULL AND resolved_by_user_id IS NULL)
    OR (status IN ('approved', 'declined') AND resolved_at IS NOT NULL AND resolved_by_user_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX artwork_claim_requests_one_pending
  ON artwork_claim_requests(keeper_piece_id, requester_user_id) WHERE status = 'pending';
CREATE INDEX artwork_claim_requests_requester_pending
  ON artwork_claim_requests(requester_user_id, status, created_at);
CREATE INDEX artwork_claim_requests_email_pending
  ON artwork_claim_requests(lower(requester_email), status, created_at);
CREATE INDEX artwork_claim_requests_holder_pending
  ON artwork_claim_requests(routed_to_user_id, status, created_at);

CREATE TABLE artwork_transfer_intents (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  expected_from_user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  target_email_commitment TEXT NOT NULL CHECK (
    typeof(target_email_commitment) = 'text'
    AND length(target_email_commitment) = 64
    AND target_email_commitment = lower(target_email_commitment)
    AND target_email_commitment NOT GLOB '*[^0-9a-f]*'
  ),
  expected_steward_version INTEGER NOT NULL CHECK (expected_steward_version >= 0),
  expected_lineage_count INTEGER NOT NULL CHECK (expected_lineage_count >= 0),
  expected_lineage_hash TEXT,
  transfer_kind TEXT NOT NULL CHECK (transfer_kind IN ('sale', 'gift', 'inheritance', 'artist-rebind')),
  maintenance_event_id TEXT NOT NULL UNIQUE,
  lineage_event_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  CHECK (expected_from_user_id <> target_user_id)
);

CREATE TABLE artwork_transfer_parties (
  id TEXT PRIMARY KEY,
  transfer_intent_id TEXT NOT NULL REFERENCES artwork_transfer_intents(id) ON DELETE RESTRICT,
  party_role TEXT NOT NULL CHECK (party_role IN ('from', 'to')),
  user_id TEXT NOT NULL,
  public_ref TEXT NOT NULL UNIQUE CHECK (
    length(public_ref) = 39
    AND substr(public_ref, 1, 3) = 'tp-'
    AND substr(public_ref, 12, 1) = '-'
    AND substr(public_ref, 17, 1) = '-'
    AND substr(public_ref, 18, 1) = '4'
    AND substr(public_ref, 22, 1) = '-'
    AND substr(public_ref, 23, 1) IN ('8', '9', 'a', 'b')
    AND substr(public_ref, 27, 1) = '-'
    AND substr(public_ref, 4) NOT GLOB '*[^0-9a-f-]*'
  ),
  created_at TEXT NOT NULL,
  UNIQUE (transfer_intent_id, party_role)
);

CREATE TABLE artwork_transfer_receipts (
  id TEXT PRIMARY KEY,
  transfer_intent_id TEXT NOT NULL UNIQUE REFERENCES artwork_transfer_intents(id) ON DELETE RESTRICT,
  committed_at TEXT NOT NULL
);

ALTER TABLE keeper_pieces
  ADD COLUMN last_transfer_id TEXT
  REFERENCES artwork_transfer_intents(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE TRIGGER artwork_claim_requests_no_delete
BEFORE DELETE ON artwork_claim_requests BEGIN
  SELECT RAISE(ABORT, 'claim requests may not be deleted');
END;
CREATE TRIGGER artwork_transfer_intents_no_update
BEFORE UPDATE ON artwork_transfer_intents BEGIN
  SELECT RAISE(ABORT, 'transfer intents are append-only');
END;
CREATE TRIGGER artwork_transfer_intents_no_delete
BEFORE DELETE ON artwork_transfer_intents BEGIN
  SELECT RAISE(ABORT, 'transfer intents are append-only');
END;
CREATE TRIGGER artwork_transfer_parties_no_update
BEFORE UPDATE ON artwork_transfer_parties BEGIN
  SELECT RAISE(ABORT, 'transfer parties are append-only');
END;
CREATE TRIGGER artwork_transfer_parties_no_delete
BEFORE DELETE ON artwork_transfer_parties BEGIN
  SELECT RAISE(ABORT, 'transfer parties are append-only');
END;
CREATE TRIGGER artwork_transfer_receipts_no_update
BEFORE UPDATE ON artwork_transfer_receipts BEGIN
  SELECT RAISE(ABORT, 'transfer receipts are append-only');
END;
CREATE TRIGGER artwork_transfer_receipts_no_delete
BEFORE DELETE ON artwork_transfer_receipts BEGIN
  SELECT RAISE(ABORT, 'transfer receipts are append-only');
END;

-- Rebuild the public chain allowlist to add the canonical transfer event.
CREATE TABLE artwork_lineage_events_ownership_foundation (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'issued', 'activated', 'fulfillment_assign', 'fulfillment_correct',
    'fulfillment_correction_out', 'fulfillment_correction_in',
    'fulfillment_ship', 'first_bound', 'migration_baseline',
    'link_corrected', 'voided', 'superseded', 'transferred'
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
INSERT INTO artwork_lineage_events_ownership_foundation
SELECT * FROM artwork_lineage_events;
DROP TABLE artwork_lineage_events;
ALTER TABLE artwork_lineage_events_ownership_foundation RENAME TO artwork_lineage_events;
CREATE INDEX idx_lineage_piece_sequence ON artwork_lineage_events(keeper_piece_id, sequence);
CREATE TRIGGER artwork_lineage_no_update
BEFORE UPDATE ON artwork_lineage_events BEGIN
  SELECT RAISE(ABORT, 'artwork lineage is append-only');
END;
CREATE TRIGGER artwork_lineage_no_delete
BEFORE DELETE ON artwork_lineage_events BEGIN
  SELECT RAISE(ABORT, 'artwork lineage is append-only');
END;

CREATE TRIGGER keeper_pieces_governed_steward_update
BEFORE UPDATE OF keeper_user_id, claimed_at, last_transfer_id ON keeper_pieces
WHEN OLD.claimed_at IS NOT NULL OR OLD.keeper_user_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'claimed artwork remains governed') WHERE NEW.claimed_at IS NULL OR NEW.keeper_user_id IS NULL;
  SELECT RAISE(ABORT, 'transfer marker requires steward transfer') WHERE NEW.last_transfer_id IS NOT OLD.last_transfer_id
    AND NEW.keeper_user_id IS OLD.keeper_user_id;
  SELECT RAISE(ABORT, 'steward transfer is not authorized') WHERE NEW.last_transfer_id IS OLD.last_transfer_id
    AND (NEW.keeper_user_id IS NOT OLD.keeper_user_id
      OR NEW.claimed_at IS NOT OLD.claimed_at);
  SELECT RAISE(ABORT, 'steward transfer is not authorized') WHERE NEW.keeper_user_id IS NOT OLD.keeper_user_id AND (
    NEW.last_transfer_id IS OLD.last_transfer_id OR NOT EXISTS (
      SELECT 1
        FROM artwork_transfer_receipts receipt
        JOIN artwork_transfer_intents intent ON intent.id = receipt.transfer_intent_id
        JOIN artwork_lineage_events lineage ON lineage.id = intent.lineage_event_id
       WHERE intent.id = NEW.last_transfer_id
         AND intent.keeper_piece_id = OLD.id
         AND intent.expected_from_user_id = OLD.keeper_user_id
         AND intent.target_user_id = NEW.keeper_user_id
         AND intent.expected_steward_version = OLD.steward_version
         AND NEW.steward_version = intent.expected_steward_version + 1
         AND intent.created_at = NEW.claimed_at
         AND NEW.released_at IS NULL
         AND NEW.current_display_location IS NULL
         AND intent.expected_lineage_count = OLD.lineage_event_count
         AND intent.expected_lineage_hash IS OLD.lineage_head_hash
         AND NEW.lineage_event_count = intent.expected_lineage_count + 1
         AND NEW.lineage_head_hash = lineage.event_hash
    )
  );
END;

CREATE TRIGGER artwork_transfer_receipt_complete
BEFORE INSERT ON artwork_transfer_receipts
BEGIN
  SELECT RAISE(ABORT, 'incomplete steward transfer') WHERE NOT EXISTS (
    SELECT 1
      FROM artwork_transfer_intents intent
      JOIN keeper_pieces piece ON piece.id = intent.keeper_piece_id
      JOIN registry_maintenance_events maintenance ON maintenance.id = intent.maintenance_event_id
      JOIN artwork_lineage_events lineage ON lineage.id = intent.lineage_event_id
      JOIN artwork_transfer_parties from_party
        ON from_party.transfer_intent_id = intent.id AND from_party.party_role = 'from'
      JOIN artwork_transfer_parties to_party
        ON to_party.transfer_intent_id = intent.id AND to_party.party_role = 'to'
     WHERE intent.id = NEW.transfer_intent_id
       AND (
         (piece.keeper_user_id = intent.expected_from_user_id
           AND piece.claimed_at IS NOT NULL
           AND piece.steward_version = intent.expected_steward_version
           AND piece.lineage_event_count = intent.expected_lineage_count
           AND piece.lineage_head_hash IS intent.expected_lineage_hash)
         OR
         (piece.keeper_user_id = intent.target_user_id
           AND piece.claimed_at = intent.created_at
           AND piece.steward_version = intent.expected_steward_version + 1
           AND piece.lineage_event_count = intent.expected_lineage_count + 1
           AND piece.lineage_head_hash = lineage.event_hash
           AND piece.last_transfer_id = intent.id)
       )
       AND maintenance.event_type = 'steward_transferred'
       AND maintenance.keeper_piece_id = intent.keeper_piece_id
       AND maintenance.outcome = 'succeeded'
       AND json_extract(maintenance.before_json, '$.keeperUserId') = intent.expected_from_user_id
       AND json_extract(maintenance.after_json, '$.keeperUserId') = intent.target_user_id
       AND json_extract(maintenance.after_json, '$.claimedAt') = intent.created_at
       AND json_extract(maintenance.after_json, '$.releasedAt') IS NULL
       AND json_extract(maintenance.after_json, '$.currentDisplayLocation') IS NULL
       AND json_extract(maintenance.after_json, '$.stewardVersion') = intent.expected_steward_version + 1
       AND lineage.keeper_piece_id = intent.keeper_piece_id
       AND lineage.sequence = intent.expected_lineage_count + 1
       AND lineage.previous_hash IS intent.expected_lineage_hash
       AND lineage.event_type = 'transferred'
       AND json_valid(lineage.public_payload_json)
       AND json_type(lineage.public_payload_json) = 'object'
       AND (SELECT COUNT(*) FROM json_each(lineage.public_payload_json)) = 3
       AND json_type(lineage.public_payload_json, '$.fromRef') = 'text'
       AND json_type(lineage.public_payload_json, '$.toRef') = 'text'
       AND json_type(lineage.public_payload_json, '$.transferKind') = 'text'
       AND json_extract(lineage.public_payload_json, '$.fromRef') = from_party.public_ref
       AND json_extract(lineage.public_payload_json, '$.toRef') = to_party.public_ref
       AND json_extract(lineage.public_payload_json, '$.transferKind') = intent.transfer_kind
       AND from_party.user_id = intent.expected_from_user_id
       AND to_party.user_id = intent.target_user_id
  );
END;

CREATE TRIGGER artwork_transfer_receipt_commit
AFTER INSERT ON artwork_transfer_receipts
BEGIN
  UPDATE keeper_pieces
     SET keeper_user_id = (
           SELECT target_user_id FROM artwork_transfer_intents WHERE id = NEW.transfer_intent_id
         ),
         claimed_at = (
           SELECT created_at FROM artwork_transfer_intents WHERE id = NEW.transfer_intent_id
         ),
         released_at = NULL,
         current_display_location = NULL,
         steward_version = steward_version + 1,
         lineage_event_count = (
           SELECT expected_lineage_count + 1
             FROM artwork_transfer_intents WHERE id = NEW.transfer_intent_id
         ),
         lineage_head_hash = (
           SELECT lineage.event_hash
             FROM artwork_transfer_intents intent
             JOIN artwork_lineage_events lineage ON lineage.id = intent.lineage_event_id
            WHERE intent.id = NEW.transfer_intent_id
         ),
         last_transfer_id = NEW.transfer_intent_id
   WHERE id = (
           SELECT keeper_piece_id FROM artwork_transfer_intents WHERE id = NEW.transfer_intent_id
         )
     AND keeper_user_id = (
           SELECT expected_from_user_id FROM artwork_transfer_intents WHERE id = NEW.transfer_intent_id
         )
     AND claimed_at IS NOT NULL
     AND steward_version = (
           SELECT expected_steward_version FROM artwork_transfer_intents
            WHERE id = NEW.transfer_intent_id
         )
     AND lineage_event_count = (
           SELECT expected_lineage_count FROM artwork_transfer_intents
            WHERE id = NEW.transfer_intent_id
         )
     AND lineage_head_hash IS (
           SELECT expected_lineage_hash FROM artwork_transfer_intents
            WHERE id = NEW.transfer_intent_id
         );

  SELECT RAISE(ABORT, 'steward transfer commit failed') WHERE NOT EXISTS (
    SELECT 1
      FROM artwork_transfer_intents intent
      JOIN artwork_lineage_events lineage ON lineage.id = intent.lineage_event_id
      JOIN keeper_pieces piece ON piece.id = intent.keeper_piece_id
     WHERE intent.id = NEW.transfer_intent_id
       AND piece.keeper_user_id = intent.target_user_id
       AND piece.claimed_at = intent.created_at
       AND piece.released_at IS NULL
       AND piece.current_display_location IS NULL
       AND piece.steward_version = intent.expected_steward_version + 1
       AND piece.lineage_event_count = intent.expected_lineage_count + 1
       AND piece.lineage_head_hash = lineage.event_hash
       AND piece.last_transfer_id = intent.id
  );
END;
