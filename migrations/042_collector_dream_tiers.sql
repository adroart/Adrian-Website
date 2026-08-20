-- Three-tier dream model: shine / keep / seal (collector-screen-wording.md §6,
-- "Three tiers, and what outlives you", settled 2026-08-10).
-- OWNED BY ADRIAN-WEBSITE. Apply from this checkout:
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only. Prior migrations remain immutable.
--
-- The tiers, named for what they actually do:
--   * shine -- anyone who meets the piece reads it, words with no name. Once
--     it shines it stays shining, always: shine is terminal.
--   * keep  -- travels with the piece; only whoever holds it can open it, and
--     they may choose to let it shine one day.
--   * seal  -- nobody opens it again. Not the next caretaker, not family, not
--     ever. The one absolute: only the writer keeps access to their own words.
--
-- Transition matrix (structural, collector_dreams_tier_transitions):
--   keep -> shine   allowed
--   keep -> seal    allowed (only if the dream has NEVER shone; once words
--                   entered the permanent Piece Record they cannot be sealed,
--                   because once-shone-stays-shone is itself locked)
--   seal -> shine   allowed (the writer changes their mind toward the light)
--   seal -> keep    forbidden
--   shine -> *      forbidden (terminal)
--
-- author_user_id: already present and NOT NULL since migration 029, so no
-- column is added for authorship. "The writer always keeps access to their
-- own words, every tier including seal, even after the piece transfers" is a
-- READ rule on that column and lives in the app layer
-- (functions/api/_lib/collectorDreams.js getCollectorDreamState).
--
-- Un-shining, structural vs app-side (deliberate split -- do not "tighten"):
--   * STRUCTURAL here: the audited 'revoke' mutation is refused on a
--     tier='shine' dream (recreated collector_dream_mutation_exact_application
--     below). A keeper cannot take shone words back down through the normal
--     sharing surface; the app refuses first with 'shine_is_permanent'.
--   * DELIBERATELY NOT STRUCTURAL: the 029 fail-safe closures must keep
--     working on shine rows -- transfer close (collector_dreams_close_on_
--     transfer), profile-removed / became-minor closes, and Ring 4 name-
--     consent withdrawal all set public_revoked_at directly and are safety
--     paths, not editorial un-shining. They leave tier='shine' untouched, so
--     the permanent Piece Record keeps the words (once shone stays shone).
--   * The abuse-management path (migration 040, collector_shine_removals +
--     functions/api/admin/shine-removals.js) never touches collector_dreams
--     rows at all -- it only marks content ineligible for regenerated records.
--     Nothing in this migration constrains it; it keeps working unchanged.

ALTER TABLE collector_dreams ADD COLUMN tier TEXT NOT NULL DEFAULT 'keep'
  CHECK (tier IN ('shine', 'keep', 'seal'));
ALTER TABLE collector_dreams ADD COLUMN heirs_may_share INTEGER NOT NULL DEFAULT 1
  CHECK (heirs_may_share IN (0, 1));

-- Backfill: every dream currently standing in the light is shine-tier. A row
-- whose visibility is still anonymous/attributed with a recorded share is an
-- open (or transfer-archived) publication; rows whose share was later closed
-- to 'private' by revoke or a fail-safe stay 'keep' -- their words remain in
-- the Piece Record via public_shared_at (once shone stays shone), but the
-- live tier reflects that the person withdrew under the pre-tier rules.
-- The two 029 BEFORE UPDATE guards are dropped around the backfill (they
-- would abort a bulk tier stamp -- archived rows no longer have a current-
-- keeper author, and the runtime guard only admits enumerated shapes), then
-- recreated: the keeper guard verbatim, the runtime guard extended below.
DROP TRIGGER collector_dreams_update_current_keeper;
DROP TRIGGER collector_dreams_runtime_update_guard;

UPDATE collector_dreams
   SET tier = 'shine'
 WHERE visibility IN ('anonymous', 'attributed')
   AND public_shared_at IS NOT NULL;

-- Recreated exactly as migration 029 wrote it.
CREATE TRIGGER collector_dreams_update_current_keeper
BEFORE UPDATE ON collector_dreams
WHEN NEW.archived_at IS OLD.archived_at
BEGIN
  SELECT RAISE(ABORT, 'dream change requires current keeper') WHERE NOT EXISTS (
    SELECT 1 FROM keeper_pieces piece
     WHERE piece.id = OLD.keeper_piece_id
       AND piece.keeper_user_id = OLD.author_user_id
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND piece.plate_status NOT IN ('void', 'superseded')
  ) AND NOT (
    OLD.public_revoked_at IS NULL AND NEW.public_revoked_at IS NOT NULL
    AND NEW.body = OLD.body AND NEW.scope = OLD.scope
    AND NEW.public_shared_at IS OLD.public_shared_at
    AND NEW.fulfilled_at IS OLD.fulfilled_at
    AND NEW.archived_at IS OLD.archived_at
  );
  SELECT RAISE(ABORT, 'public dream requires established adult') WHERE NEW.visibility IN ('anonymous', 'attributed')
    AND NOT EXISTS (
      SELECT 1 FROM users person
      JOIN profiles profile ON profile.user_id = person.id
       WHERE person.auth_user_id = OLD.author_user_id
         AND date(profile.birth_date, '+18 years') <= date(NEW.updated_at)
    )
    AND NOT (
      OLD.public_revoked_at IS NULL AND NEW.public_revoked_at IS NOT NULL
      AND NEW.body = OLD.body AND NEW.scope = OLD.scope
      AND NEW.public_shared_at IS OLD.public_shared_at
    );
  SELECT RAISE(ABORT, 'attributed dream requires name consent') WHERE NEW.visibility = 'attributed'
    AND NOT EXISTS (
      SELECT 1 FROM users person
      JOIN collector_person_privacy privacy ON privacy.user_id = person.id
       WHERE person.auth_user_id = OLD.author_user_id
         AND privacy.share_name = 1
    );
END;

-- The transition matrix, enforced on every UPDATE however it arrives.
CREATE TRIGGER collector_dreams_tier_transitions
BEFORE UPDATE ON collector_dreams
WHEN NEW.tier IS NOT OLD.tier
BEGIN
  SELECT RAISE(ABORT, 'forbidden dream tier transition') WHERE NOT (
    (OLD.tier = 'keep' AND NEW.tier IN ('shine', 'seal'))
    OR (OLD.tier = 'seal' AND NEW.tier = 'shine')
  );
END;

-- Seal coherence on entry: a dream can only be sealed while private and
-- never shone. (Not merely "no open share": a once-shone dream's words are
-- already in the permanent Piece Record, and sealing it would either tear
-- them out -- breaking once-shone-stays-shone -- or leave a "sealed" body on
-- public display, breaking the seal. Neither lie is allowed to exist.)
CREATE TRIGGER collector_dreams_seal_entry_coherence
BEFORE UPDATE ON collector_dreams
WHEN NEW.tier = 'seal' AND OLD.tier IS NOT 'seal'
BEGIN
  SELECT RAISE(ABORT, 'sealing requires a private never-shone dream')
   WHERE NEW.visibility <> 'private' OR NEW.public_shared_at IS NOT NULL;
END;

-- Seal pins heirs_may_share to 0 ("hidden entirely when the tier is Seal it,
-- which already answers the question"). The pin is APPLIED by the AFTER
-- INSERT trigger on collector_dream_tier_changes below; these two guards make
-- it un-bypassable from any other write path.
CREATE TRIGGER collector_dreams_seal_pins_heirs_insert
BEFORE INSERT ON collector_dreams
WHEN NEW.tier = 'seal'
BEGIN
  SELECT RAISE(ABORT, 'a sealed dream pins heirs_may_share to 0')
   WHERE NEW.heirs_may_share <> 0;
  SELECT RAISE(ABORT, 'sealing requires a private never-shone dream')
   WHERE NEW.visibility <> 'private' OR NEW.public_shared_at IS NOT NULL;
END;

CREATE TRIGGER collector_dreams_seal_pins_heirs_update
BEFORE UPDATE ON collector_dreams
WHEN NEW.tier = 'seal' AND NEW.heirs_may_share <> 0
BEGIN
  SELECT RAISE(ABORT, 'a sealed dream pins heirs_may_share to 0');
END;

-- The audited tier-change ledger, mirroring collector_dream_mutations: one
-- append-only row per transition, and the row's insertion is the ONLY thing
-- that performs the tier flip (the extended runtime guard below admits no
-- other tier update). Same shape discipline as 029: exact-application check
-- before, exact apply + verification after.
CREATE TABLE collector_dream_tier_changes (
  id TEXT PRIMARY KEY,
  dream_id TEXT NOT NULL REFERENCES collector_dreams(id) ON DELETE RESTRICT,
  author_user_id TEXT NOT NULL CHECK (length(trim(author_user_id)) BETWEEN 1 AND 128),
  from_tier TEXT NOT NULL,
  to_tier TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 128),
  resulting_version INTEGER NOT NULL CHECK (resulting_version > 1),
  created_at TEXT NOT NULL,
  UNIQUE (author_user_id, idempotency_key),
  CHECK (
    (from_tier = 'keep' AND to_tier IN ('shine', 'seal'))
    OR (from_tier = 'seal' AND to_tier = 'shine')
  )
);
CREATE INDEX collector_dream_tier_changes_dream
  ON collector_dream_tier_changes(dream_id, created_at, id);

CREATE TRIGGER collector_dream_tier_changes_no_update
BEFORE UPDATE ON collector_dream_tier_changes BEGIN
  SELECT RAISE(ABORT, 'dream tier changes are append-only');
END;
CREATE TRIGGER collector_dream_tier_changes_no_delete
BEFORE DELETE ON collector_dream_tier_changes BEGIN
  SELECT RAISE(ABORT, 'dream tier changes are append-only');
END;

-- A tier change only lands against the live dream it names, authored and
-- currently held by the same person, at the exact next version, and only
-- when the dream's share state is coherent with the destination:
--   * entering shine requires an already-open public share (the app routes
--     keep->shine and seal->shine through the existing 'share' mutation in
--     the same batch, so public reads keep working off public_shared_at);
--   * entering seal requires private and never shone.
CREATE TRIGGER collector_dream_tier_change_exact_application
BEFORE INSERT ON collector_dream_tier_changes
BEGIN
  SELECT RAISE(ABORT, 'dream tier change did not apply exactly') WHERE NOT EXISTS (
    SELECT 1
      FROM collector_dreams dream
      JOIN keeper_pieces piece ON piece.id = dream.keeper_piece_id
     WHERE dream.id = NEW.dream_id
       AND dream.author_user_id = NEW.author_user_id
       AND dream.archived_at IS NULL
       AND dream.tier = NEW.from_tier
       AND dream.record_version + 1 = NEW.resulting_version
       AND piece.keeper_user_id = NEW.author_user_id
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND piece.plate_status NOT IN ('void', 'superseded')
       AND (
         (NEW.to_tier = 'shine'
           AND dream.visibility IN ('anonymous', 'attributed')
           AND dream.public_shared_at IS NOT NULL
           AND dream.public_revoked_at IS NULL)
         OR (NEW.to_tier = 'seal'
           AND dream.visibility = 'private'
           AND dream.public_shared_at IS NULL)
       )
  );
END;

CREATE TRIGGER collector_dream_tier_change_apply_exactly
AFTER INSERT ON collector_dream_tier_changes
BEGIN
  UPDATE collector_dreams
     SET tier = NEW.to_tier,
         heirs_may_share = CASE WHEN NEW.to_tier = 'seal' THEN 0 ELSE heirs_may_share END,
         updated_at = NEW.created_at,
         record_version = record_version + 1
   WHERE id = NEW.dream_id
     AND author_user_id = NEW.author_user_id
     AND archived_at IS NULL
     AND tier = NEW.from_tier
     AND record_version + 1 = NEW.resulting_version;

  SELECT RAISE(ABORT, 'dream tier change did not apply exactly') WHERE NOT EXISTS (
    SELECT 1 FROM collector_dreams dream
     WHERE dream.id = NEW.dream_id
       AND dream.tier = NEW.to_tier
       AND dream.record_version = NEW.resulting_version
       AND dream.updated_at = NEW.created_at
       AND (NEW.to_tier <> 'seal' OR dream.heirs_may_share = 0)
  );
END;

-- Migration 029's mutation exact-application guard, recreated with one added
-- condition: the 'revoke' action no longer applies to a shine-tier dream.
-- Once it shines it stays shining; the only remaining paths off display are
-- the 029 fail-safe closures (which do not use this mutation machinery) and
-- the audited abuse removal (migration 040, which does not touch the row).
DROP TRIGGER collector_dream_mutation_exact_application;
CREATE TRIGGER collector_dream_mutation_exact_application
BEFORE INSERT ON collector_dream_mutations
BEGIN
  SELECT RAISE(ABORT, 'dream mutation did not apply exactly') WHERE NEW.request_json IS NULL
    OR json_valid(NEW.request_json) = 0
    OR json_type(NEW.request_json) <> 'object'
    OR NOT EXISTS (
      SELECT 1
        FROM collector_dreams dream
        JOIN keeper_pieces piece ON piece.id = dream.keeper_piece_id
       WHERE dream.id = NEW.dream_id
         AND dream.author_user_id = NEW.author_user_id
         AND dream.archived_at IS NULL
         AND dream.record_version + 1 = NEW.resulting_version
         AND piece.keeper_user_id = NEW.author_user_id
         AND piece.claimed_at IS NOT NULL
         AND piece.released_at IS NULL
         AND piece.plate_status NOT IN ('void', 'superseded')
         AND (
           (
             NEW.action = 'edit'
             AND json_remove(
               NEW.request_json, '$.body', '$.scope', '$.expectedVersion'
             ) = '{}'
             AND json_type(NEW.request_json, '$.body') = 'text'
             AND json_type(NEW.request_json, '$.scope') = 'text'
             AND json_type(NEW.request_json, '$.expectedVersion') = 'integer'
             AND dream.record_version =
               json_extract(NEW.request_json, '$.expectedVersion')
           )
           OR (
             NEW.action = 'share'
             AND json_remove(NEW.request_json, '$.visibility') = '{}'
             AND json_extract(NEW.request_json, '$.visibility')
               IN ('anonymous', 'attributed')
           )
           OR (
             NEW.action = 'revoke'
             AND json_remove(NEW.request_json, '$.visibility') = '{}'
             AND json_extract(NEW.request_json, '$.visibility') = 'private'
             AND dream.public_shared_at IS NOT NULL
             AND dream.tier <> 'shine'
           )
         )
    );
END;

-- Migration 029's runtime update guard, recreated with:
--   * every previously-admitted shape now also required to leave tier and
--     heirs_may_share untouched (a caller cannot smuggle a tier flip under a
--     valid edit/share/revoke audit, a ritual fulfillment, or a fail-safe);
--   * one new admitted shape: the exact effect of a collector_dream_tier_
--     changes row already inserted in this transaction.
CREATE TRIGGER collector_dreams_runtime_update_guard
BEFORE UPDATE ON collector_dreams
BEGIN
  SELECT RAISE(ABORT, 'dream update requires exact authorization') WHERE NOT (
    EXISTS (
      SELECT 1 FROM collector_dream_mutations mutation
       WHERE mutation.id = NEW.last_mutation_id
         AND mutation.dream_id = OLD.id
         AND mutation.author_user_id = OLD.author_user_id
         AND mutation.resulting_version = OLD.record_version + 1
         AND NEW.record_version = mutation.resulting_version
         AND NEW.updated_at = mutation.created_at
         AND NEW.keeper_piece_id = OLD.keeper_piece_id
         AND NEW.author_user_id = OLD.author_user_id
         AND NEW.idempotency_key = OLD.idempotency_key
         AND NEW.created_at = OLD.created_at
         AND NEW.tier = OLD.tier
         AND NEW.heirs_may_share = OLD.heirs_may_share
         AND (
           (mutation.action = 'edit'
             AND NEW.body = json_extract(mutation.request_json, '$.body')
             AND NEW.scope = json_extract(mutation.request_json, '$.scope')
             AND NEW.visibility = OLD.visibility
             AND NEW.public_shared_at IS OLD.public_shared_at
             AND NEW.public_revoked_at IS OLD.public_revoked_at
             AND NEW.fulfilled_at IS OLD.fulfilled_at
             AND NEW.archived_at IS OLD.archived_at)
           OR (mutation.action = 'share'
             AND NEW.body = OLD.body AND NEW.scope = OLD.scope
             AND NEW.visibility = json_extract(mutation.request_json, '$.visibility')
             AND NEW.public_shared_at = mutation.created_at
             AND NEW.public_revoked_at IS NULL
             AND NEW.fulfilled_at IS OLD.fulfilled_at
             AND NEW.archived_at IS OLD.archived_at)
           OR (mutation.action = 'revoke'
             AND NEW.body = OLD.body AND NEW.scope = OLD.scope
             AND NEW.visibility = 'private'
             AND NEW.public_shared_at IS OLD.public_shared_at
             AND NEW.public_revoked_at = mutation.created_at
             AND NEW.fulfilled_at IS OLD.fulfilled_at
             AND NEW.archived_at IS OLD.archived_at)
         )
    )
    OR EXISTS (
      SELECT 1 FROM collector_dream_tier_changes change
       WHERE change.dream_id = OLD.id
         AND change.author_user_id = OLD.author_user_id
         AND change.from_tier = OLD.tier
         AND change.to_tier = NEW.tier
         AND change.resulting_version = OLD.record_version + 1
         AND NEW.record_version = change.resulting_version
         AND NEW.updated_at = change.created_at
         AND NEW.heirs_may_share = CASE
           WHEN change.to_tier = 'seal' THEN 0 ELSE OLD.heirs_may_share END
         AND NEW.body = OLD.body AND NEW.scope = OLD.scope
         AND NEW.visibility = OLD.visibility
         AND NEW.public_shared_at IS OLD.public_shared_at
         AND NEW.public_revoked_at IS OLD.public_revoked_at
         AND NEW.fulfilled_at IS OLD.fulfilled_at
         AND NEW.archived_at IS OLD.archived_at
         AND NEW.keeper_piece_id = OLD.keeper_piece_id
         AND NEW.author_user_id = OLD.author_user_id
         AND NEW.idempotency_key = OLD.idempotency_key
         AND NEW.created_at = OLD.created_at
         AND NEW.last_mutation_id IS OLD.last_mutation_id
    )
    OR EXISTS (
      SELECT 1 FROM collector_dream_rituals ritual
       WHERE ritual.action = 'fulfilled'
         AND ritual.prior_dream_id = OLD.id
         AND ritual.resulting_dream_id = OLD.id
         AND ritual.completed_at = NEW.fulfilled_at
         AND OLD.fulfilled_at IS NULL
         AND NEW.body = OLD.body AND NEW.scope = OLD.scope
         AND NEW.visibility = OLD.visibility
         AND NEW.public_shared_at IS OLD.public_shared_at
         AND NEW.public_revoked_at IS OLD.public_revoked_at
         AND NEW.archived_at IS OLD.archived_at
         AND NEW.keeper_piece_id = OLD.keeper_piece_id
         AND NEW.author_user_id = OLD.author_user_id
         AND NEW.idempotency_key = OLD.idempotency_key
         AND NEW.created_at = OLD.created_at
         AND NEW.last_mutation_id IS OLD.last_mutation_id
         AND NEW.updated_at = ritual.completed_at
         AND NEW.record_version = OLD.record_version + 1
         AND NEW.tier = OLD.tier
         AND NEW.heirs_may_share = OLD.heirs_may_share
    )
    OR (
      OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL
      AND NEW.updated_at = NEW.archived_at
      AND NEW.record_version = OLD.record_version + 1
      AND NEW.body = OLD.body AND NEW.scope = OLD.scope
      AND NEW.visibility = OLD.visibility
      AND NEW.public_shared_at IS OLD.public_shared_at
      AND NEW.public_revoked_at IS (
        CASE WHEN OLD.public_shared_at IS NOT NULL
          THEN NEW.archived_at ELSE OLD.public_revoked_at END)
      AND NEW.fulfilled_at IS OLD.fulfilled_at
      AND NEW.keeper_piece_id = OLD.keeper_piece_id
      AND NEW.author_user_id = OLD.author_user_id
      AND NEW.idempotency_key = OLD.idempotency_key
      AND NEW.created_at = OLD.created_at
      AND NEW.last_mutation_id IS OLD.last_mutation_id
      AND NEW.tier = OLD.tier
      AND NEW.heirs_may_share = OLD.heirs_may_share
    )
    OR (
      OLD.public_revoked_at IS NULL AND NEW.public_revoked_at IS NOT NULL
      AND NEW.updated_at = NEW.public_revoked_at
      AND NEW.record_version = OLD.record_version + 1
      AND NEW.body = OLD.body AND NEW.scope = OLD.scope
      AND NEW.visibility IN (OLD.visibility, 'private')
      AND NEW.public_shared_at IS OLD.public_shared_at
      AND NEW.fulfilled_at IS OLD.fulfilled_at
      AND NEW.archived_at IS OLD.archived_at
      AND NEW.keeper_piece_id = OLD.keeper_piece_id
      AND NEW.author_user_id = OLD.author_user_id
      AND NEW.idempotency_key = OLD.idempotency_key
      AND NEW.created_at = OLD.created_at
      AND NEW.last_mutation_id IS OLD.last_mutation_id
      AND NEW.tier = OLD.tier
      AND NEW.heirs_may_share = OLD.heirs_may_share
    )
  );
END;

PRAGMA foreign_key_check;
