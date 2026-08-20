-- Thirty-day silence windows on contested claims (the passing rescue).
-- OWNED BY ADRIAN-WEBSITE. Apply from this checkout:
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only. Prior migrations remain immutable.
--
-- Design (todo/plans/collector-screen-wording.md, "The passing confirmation"):
-- when someone claims a held piece, the registered caretaker is asked to let
-- go. Silence for thirty days, with more than one reminder across it, passes
-- the piece to the claimant, both sides notified. Only an active refusal
-- reaches Adrian. A piece is never orphaned.
--
-- The silence pass NEVER bypasses migration 024's governed-receipt model: it
-- EXECUTES a full governed transfer (intent + parties + lineage event +
-- receipt, committed by the 024 triggers). These tables only carry the
-- schedule that authorizes the app to execute that transfer lazily, on the
-- next touch after the deadline. There is no cron; evaluation happens when
-- anything touches the contested claim (functions/api/_lib/claimSilence.js).
--
-- What SQLite enforces here:
--   * one window per claim request, born 'open', on the claim's own piece;
--   * a stored deadline thirty days after opening;
--   * append-only reminders, at most one of each kind per window;
--   * status moves only along open -> reminded -> passed/refused/withdrawn/
--     superseded (open may also jump straight to a terminal state);
--   * terminal windows are immutable and never deleted;
--   * 'passed' requires passed_at at or after the deadline AND more than one
--     recorded reminder ("thirty days of silence, with more than one
--     reminder" is structural, not just policy).
-- What must stay app-side (claimSilence.js):
--   * the truthfulness of the supplied timestamps (SQLite has no wall clock);
--   * the full day7/day21/day29 reminder schedule and the fail-closed rule
--     that a reminder is recorded only after its email actually sent;
--   * the soak rule that a pass never executes in the same touch that sent
--     the reminders;
--   * the governed transfer itself, which runs through migration 024's
--     receipt gateway and its structural triggers.

CREATE TABLE claim_silence_windows (
  id TEXT PRIMARY KEY CHECK (
    length(id) BETWEEN 5 AND 128 AND id GLOB 'csw-*'
  ),
  claim_request_id TEXT NOT NULL UNIQUE
    REFERENCES artwork_claim_requests(id) ON DELETE RESTRICT,
  keeper_piece_id TEXT NOT NULL
    REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  opened_at TEXT NOT NULL CHECK (
    opened_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(opened_at) IS NOT NULL
  ),
  deadline_at TEXT NOT NULL CHECK (
    deadline_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(deadline_at) IS NOT NULL
  ),
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'reminded', 'passed', 'refused', 'withdrawn', 'superseded')
  ),
  passed_at TEXT CHECK (
    passed_at IS NULL
    OR (passed_at GLOB '????-??-??T??:??:??*Z' AND julianday(passed_at) IS NOT NULL)
  ),
  refused_at TEXT CHECK (
    refused_at IS NULL
    OR (refused_at GLOB '????-??-??T??:??:??*Z' AND julianday(refused_at) IS NOT NULL)
  ),
  refusal_note TEXT CHECK (
    refusal_note IS NULL OR length(refusal_note) BETWEEN 1 AND 500
  ),
  -- The deadline is the opening plus thirty days (float tolerance only).
  CHECK (julianday(deadline_at) - julianday(opened_at) BETWEEN 29.9999 AND 30.0001),
  -- passed_at exactly when passed; refused_at exactly when refused;
  -- a refusal note only ever accompanies a refusal.
  CHECK ((status = 'passed') = (passed_at IS NOT NULL)),
  CHECK ((status = 'refused') = (refused_at IS NOT NULL)),
  CHECK (status = 'refused' OR refusal_note IS NULL)
);

CREATE INDEX idx_claim_silence_windows_piece_status
  ON claim_silence_windows(keeper_piece_id, status, opened_at);

CREATE TABLE claim_silence_reminders (
  id TEXT PRIMARY KEY CHECK (
    length(id) BETWEEN 5 AND 128 AND id GLOB 'csr-*'
  ),
  window_id TEXT NOT NULL
    REFERENCES claim_silence_windows(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('day7', 'day21', 'day29')),
  sent_at TEXT NOT NULL CHECK (
    sent_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(sent_at) IS NOT NULL
  ),
  UNIQUE (window_id, kind)
);

CREATE INDEX idx_claim_silence_reminders_window
  ON claim_silence_reminders(window_id, sent_at);

-- Windows are born open, on a pending claim, for that claim's own piece.
CREATE TRIGGER claim_silence_windows_insert_guard
BEFORE INSERT ON claim_silence_windows
BEGIN
  SELECT CASE WHEN NEW.status <> 'open' THEN
    RAISE(ABORT, 'silence windows are born open') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM artwork_claim_requests claim
     WHERE claim.id = NEW.claim_request_id
       AND claim.keeper_piece_id = NEW.keeper_piece_id
       AND claim.status = 'pending'
  ) THEN RAISE(ABORT, 'silence window requires a pending claim on the same piece') END;
END;

-- Windows are never deleted: the schedule is part of the record.
CREATE TRIGGER claim_silence_windows_no_delete
BEFORE DELETE ON claim_silence_windows
BEGIN
  SELECT RAISE(ABORT, 'silence windows are never deleted');
END;

-- Updates move only along the legal transitions; identity is immutable;
-- terminal states are immutable; 'passed' is structurally gated.
CREATE TRIGGER claim_silence_windows_transition_guard
BEFORE UPDATE ON claim_silence_windows
BEGIN
  SELECT CASE WHEN NEW.id <> OLD.id
    OR NEW.claim_request_id <> OLD.claim_request_id
    OR NEW.keeper_piece_id <> OLD.keeper_piece_id
    OR NEW.opened_at <> OLD.opened_at
    OR NEW.deadline_at <> OLD.deadline_at
  THEN RAISE(ABORT, 'silence window identity is immutable') END;
  SELECT CASE WHEN OLD.status IN ('passed', 'refused', 'withdrawn', 'superseded')
  THEN RAISE(ABORT, 'terminal silence window is immutable') END;
  SELECT CASE WHEN NOT (
    (OLD.status = 'open'
      AND NEW.status IN ('reminded', 'passed', 'refused', 'withdrawn', 'superseded'))
    OR (OLD.status = 'reminded'
      AND NEW.status IN ('passed', 'refused', 'withdrawn', 'superseded'))
  ) THEN RAISE(ABORT, 'illegal silence window transition') END;
  -- The pass only after the stored deadline (against the supplied passed_at;
  -- wall-clock truthfulness stays app-side) and never without more than one
  -- recorded reminder. The table CHECKs already force passed_at/refused_at
  -- presence to match the status.
  SELECT CASE WHEN NEW.status = 'passed'
    AND julianday(NEW.passed_at) < julianday(OLD.deadline_at)
  THEN RAISE(ABORT, 'silence pass requires the deadline to have lapsed') END;
  SELECT CASE WHEN NEW.status = 'passed' AND (
    SELECT COUNT(*) FROM claim_silence_reminders reminder
     WHERE reminder.window_id = OLD.id
  ) < 2 THEN RAISE(ABORT, 'silence pass requires more than one reminder') END;
END;

-- Reminders are append-only and only land on a still-active window.
CREATE TRIGGER claim_silence_reminders_active_window_guard
BEFORE INSERT ON claim_silence_reminders
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM claim_silence_windows window
     WHERE window.id = NEW.window_id
       AND window.status IN ('open', 'reminded')
  ) THEN RAISE(ABORT, 'reminders require an active silence window') END;
END;

CREATE TRIGGER claim_silence_reminders_no_update
BEFORE UPDATE ON claim_silence_reminders
BEGIN
  SELECT RAISE(ABORT, 'silence reminders are append-only');
END;

CREATE TRIGGER claim_silence_reminders_no_delete
BEFORE DELETE ON claim_silence_reminders
BEGIN
  SELECT RAISE(ABORT, 'silence reminders are append-only');
END;

PRAGMA foreign_key_check;
