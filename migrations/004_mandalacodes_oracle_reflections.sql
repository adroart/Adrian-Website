PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS oracle_reflection_sessions (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  hexagram_number INTEGER NOT NULL CHECK (hexagram_number BETWEEN 1 AND 64),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_oracle_reflection_sessions_owner_hexagram ON oracle_reflection_sessions(owner_user_id, hexagram_number, created_at DESC);

CREATE TABLE IF NOT EXISTS oracle_reflection_segments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES oracle_reflection_sessions(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  recorded_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms > 0 AND duration_ms <= 1200000),
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  object_key TEXT NOT NULL UNIQUE,
  transcript TEXT NOT NULL DEFAULT '',
  transcription_status TEXT NOT NULL CHECK (transcription_status IN ('uploading','transcription_pending','transcribing','transcribed','failed')),
  transcription_error TEXT,
  transcription_started_at TEXT,
  provider_metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(session_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_oracle_reflection_segments_session_sequence ON oracle_reflection_segments(session_id, sequence);
CREATE INDEX IF NOT EXISTS idx_oracle_reflection_segments_retry ON oracle_reflection_segments(owner_user_id, transcription_status, updated_at);
