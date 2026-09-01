PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS oracle_invocation_drafts (
  id TEXT PRIMARY KEY,
  hexagram_number INTEGER NOT NULL CHECK (hexagram_number BETWEEN 1 AND 64),
  session_id TEXT NOT NULL REFERENCES oracle_reflection_sessions(id) ON DELETE CASCADE,
  admin_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  markdown_body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(hexagram_number, admin_user_id)
);
CREATE TABLE IF NOT EXISTS oracle_invocation_blocks (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES oracle_invocation_drafts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('segment', 'prose')),
  segment_id TEXT REFERENCES oracle_reflection_segments(id) ON DELETE SET NULL,
  markdown TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((kind = 'segment' AND segment_id IS NOT NULL) OR (kind = 'prose' AND segment_id IS NULL)),
  UNIQUE(draft_id, segment_id), UNIQUE(draft_id, sort_order)
);
CREATE TABLE IF NOT EXISTS oracle_invocation_versions (
  id TEXT PRIMARY KEY,
  hexagram_number INTEGER NOT NULL CHECK (hexagram_number BETWEEN 1 AND 64),
  draft_id TEXT NOT NULL REFERENCES oracle_invocation_drafts(id),
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  markdown_body TEXT NOT NULL,
  rendered_json TEXT NOT NULL,
  artifact_key TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(hexagram_number, version_number), UNIQUE(artifact_key), UNIQUE(hexagram_number, author_user_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS oracle_invocation_live (
  hexagram_number INTEGER PRIMARY KEY CHECK (hexagram_number BETWEEN 1 AND 64),
  version_id TEXT NOT NULL UNIQUE REFERENCES oracle_invocation_versions(id),
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oracle_invocation_blocks_draft_order ON oracle_invocation_blocks(draft_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_oracle_invocation_versions_hexagram_version ON oracle_invocation_versions(hexagram_number, version_number DESC);
