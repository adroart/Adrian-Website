-- Reusable certificate facts and wording, with artwork-level inheritance controls.

CREATE TABLE certificate_templates (
  id TEXT PRIMARY KEY CHECK (length(trim(id)) BETWEEN 1 AND 128),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  content_json TEXT NOT NULL CHECK (
    json_valid(content_json)
    AND json_type(content_json) = 'object'
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by_user_id TEXT NOT NULL CHECK (length(trim(created_by_user_id)) BETWEEN 1 AND 128),
  created_by_email TEXT NOT NULL CHECK (length(trim(created_by_email)) BETWEEN 3 AND 254),
  created_at TEXT NOT NULL CHECK (julianday(created_at) IS NOT NULL),
  updated_at TEXT NOT NULL CHECK (julianday(updated_at) IS NOT NULL)
);

CREATE TABLE certificate_assignment_operations (
  idempotency_key TEXT PRIMARY KEY CHECK (length(trim(idempotency_key)) BETWEEN 1 AND 128),
  request_digest TEXT NOT NULL CHECK (
    length(request_digest) = 64
    AND request_digest = lower(request_digest)
    AND request_digest NOT GLOB '*[^0-9a-f]*'
  ),
  template_id TEXT NOT NULL REFERENCES certificate_templates(id) ON DELETE RESTRICT,
  artwork_ids_json TEXT NOT NULL CHECK (
    json_valid(artwork_ids_json)
    AND json_type(artwork_ids_json) = 'array'
  ),
  assigned_by_user_id TEXT NOT NULL CHECK (length(trim(assigned_by_user_id)) BETWEEN 1 AND 128),
  assigned_by_email TEXT NOT NULL CHECK (length(trim(assigned_by_email)) BETWEEN 3 AND 254),
  assigned_at TEXT NOT NULL CHECK (julianday(assigned_at) IS NOT NULL)
);

CREATE TABLE certificate_artwork_assignments (
  artwork_id TEXT PRIMARY KEY CHECK (length(trim(artwork_id)) BETWEEN 1 AND 80),
  template_id TEXT NOT NULL REFERENCES certificate_templates(id) ON DELETE RESTRICT,
  assignment_operation_key TEXT NOT NULL
    REFERENCES certificate_assignment_operations(idempotency_key) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  assigned_at TEXT NOT NULL CHECK (julianday(assigned_at) IS NOT NULL)
);

CREATE INDEX certificate_artwork_assignments_template
  ON certificate_artwork_assignments(template_id, artwork_id);

CREATE TABLE certificate_artwork_overrides (
  artwork_id TEXT NOT NULL CHECK (length(trim(artwork_id)) BETWEEN 1 AND 80),
  field TEXT NOT NULL CHECK (field IN (
    'materials', 'makers', 'origin', 'techniques', 'yearWording',
    'editionWording', 'certificateWording', 'openingWording'
  )),
  mode TEXT NOT NULL CHECK (mode IN ('inherit', 'override', 'suppress')),
  value_json TEXT CHECK (
    (mode = 'override' AND value_json IS NOT NULL AND json_valid(value_json)
      AND (
        (field IN ('materials', 'makers', 'techniques')
          AND json_type(value_json) = 'array'
          AND json_array_length(value_json) > 0)
        OR
        (field NOT IN ('materials', 'makers', 'techniques')
          AND json_type(value_json) = 'text'
          AND length(trim(json_extract(value_json, '$'))) > 0)
      ))
    OR (mode <> 'override' AND value_json IS NULL)
  ),
  version INTEGER NOT NULL CHECK (version >= 1),
  updated_by_user_id TEXT NOT NULL CHECK (length(trim(updated_by_user_id)) BETWEEN 1 AND 128),
  updated_by_email TEXT NOT NULL CHECK (length(trim(updated_by_email)) BETWEEN 3 AND 254),
  updated_at TEXT NOT NULL CHECK (julianday(updated_at) IS NOT NULL),
  PRIMARY KEY (artwork_id, field)
);

CREATE TABLE certificate_override_history (
  id TEXT PRIMARY KEY CHECK (length(trim(id)) BETWEEN 1 AND 128),
  artwork_id TEXT NOT NULL CHECK (length(trim(artwork_id)) BETWEEN 1 AND 80),
  field TEXT NOT NULL,
  before_json TEXT CHECK (before_json IS NULL OR json_valid(before_json)),
  after_json TEXT NOT NULL CHECK (json_valid(after_json)),
  version INTEGER NOT NULL CHECK (version >= 1),
  changed_by_user_id TEXT NOT NULL CHECK (length(trim(changed_by_user_id)) BETWEEN 1 AND 128),
  changed_by_email TEXT NOT NULL CHECK (length(trim(changed_by_email)) BETWEEN 3 AND 254),
  changed_at TEXT NOT NULL CHECK (julianday(changed_at) IS NOT NULL)
);

CREATE INDEX certificate_override_history_artwork
  ON certificate_override_history(artwork_id, field, version);

CREATE TRIGGER certificate_override_history_after_insert
AFTER INSERT ON certificate_artwork_overrides
BEGIN
  INSERT INTO certificate_override_history
    (id, artwork_id, field, before_json, after_json, version,
     changed_by_user_id, changed_by_email, changed_at)
  VALUES (
    NEW.artwork_id || ':' || NEW.field || ':' || NEW.version,
    NEW.artwork_id,
    NEW.field,
    NULL,
    json_object(
      'mode', NEW.mode,
      'value', CASE WHEN NEW.value_json IS NULL THEN NULL ELSE json(NEW.value_json) END,
      'version', NEW.version
    ),
    NEW.version,
    NEW.updated_by_user_id,
    NEW.updated_by_email,
    NEW.updated_at
  );
END;

CREATE TRIGGER certificate_override_history_after_update
AFTER UPDATE ON certificate_artwork_overrides
BEGIN
  INSERT INTO certificate_override_history
    (id, artwork_id, field, before_json, after_json, version,
     changed_by_user_id, changed_by_email, changed_at)
  VALUES (
    NEW.artwork_id || ':' || NEW.field || ':' || NEW.version,
    NEW.artwork_id,
    NEW.field,
    json_object(
      'mode', OLD.mode,
      'value', CASE WHEN OLD.value_json IS NULL THEN NULL ELSE json(OLD.value_json) END,
      'version', OLD.version
    ),
    json_object(
      'mode', NEW.mode,
      'value', CASE WHEN NEW.value_json IS NULL THEN NULL ELSE json(NEW.value_json) END,
      'version', NEW.version
    ),
    NEW.version,
    NEW.updated_by_user_id,
    NEW.updated_by_email,
    NEW.updated_at
  );
END;

CREATE TRIGGER certificate_override_history_no_update
BEFORE UPDATE ON certificate_override_history
BEGIN
  SELECT RAISE(ABORT, 'certificate override history is append-only');
END;

CREATE TRIGGER certificate_override_history_no_delete
BEFORE DELETE ON certificate_override_history
BEGIN
  SELECT RAISE(ABORT, 'certificate override history is append-only');
END;

PRAGMA foreign_key_check;
