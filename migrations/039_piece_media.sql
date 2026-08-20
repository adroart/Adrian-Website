-- Time-capsule media layer: per-piece photos, forever videos, and artist
-- message audio, stored content-addressed in the existing registry R2 bucket
-- (binding ARTWORK_REGISTRY_BACKUP) and referenced from the self-contained
-- Piece Record via relative link ../media/{sha256}.{ext}
-- (docs/piece-record-format.md).
-- OWNED BY ADRIAN-WEBSITE. Apply from this checkout:
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only. Prior migrations remain immutable.
--
-- Every row attaches to exactly one thing: a specific physical instance
-- (keeper_piece_id) or the artwork generally (artwork_id), never both and
-- never neither. Storage address is pinned by trigger to
-- media/{sha256}.{extension}, mirroring the backup-reference pinning of
-- migration 021 and the record address pinning of migration 036. Rows are
-- permanent: no DELETE, ever. The only permitted UPDATE is a one-way soft
-- removal (removed_at/removed_reason set once, from NULL) for abuse
-- management; everything else, including clearing a removal, is immutable.

CREATE TABLE piece_media (
  id TEXT PRIMARY KEY CHECK (
    typeof(id) = 'text'
    AND substr(id, 1, 3) = 'pm-'
    AND length(trim(id)) BETWEEN 4 AND 128
  ),
  keeper_piece_id TEXT REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  artwork_id TEXT CHECK (
    artwork_id IS NULL
    OR (
      typeof(artwork_id) = 'text'
      AND artwork_id GLOB '[A-Z][A-Z]*-[0-9][0-9][0-9]'
      AND length(artwork_id) BETWEEN 6 AND 7
    )
  ),
  kind TEXT NOT NULL CHECK (kind IN ('photo', 'video', 'artist_message_audio')),
  storage_reference TEXT NOT NULL CHECK (
    typeof(storage_reference) = 'text'
    AND length(trim(storage_reference)) BETWEEN 1 AND 1000
  ),
  sha256 TEXT NOT NULL UNIQUE CHECK (
    typeof(sha256) = 'text'
    AND length(sha256) = 64
    AND sha256 = lower(sha256)
    AND sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  byte_length INTEGER NOT NULL CHECK (
    typeof(byte_length) = 'integer' AND byte_length > 0
  ),
  content_type TEXT NOT NULL CHECK (content_type IN (
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'audio/mpeg', 'audio/mp4'
  )),
  created_at TEXT NOT NULL CHECK (
    created_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(created_at) IS NOT NULL
  ),
  removed_at TEXT CHECK (
    removed_at IS NULL
    OR (
      removed_at GLOB '????-??-??T??:??:??*Z'
      AND julianday(removed_at) IS NOT NULL
    )
  ),
  removed_reason TEXT CHECK (
    (removed_reason IS NULL) = (removed_at IS NULL)
    AND (
      removed_reason IS NULL
      OR length(trim(removed_reason)) BETWEEN 1 AND 1000
    )
  ),
  -- Media attaches to a specific physical instance OR to the artwork
  -- generally. Never both, never neither.
  CHECK ((keeper_piece_id IS NULL) <> (artwork_id IS NULL)),
  -- Content type must belong to its declared kind, and byte length must not
  -- exceed the cap for that kind: photo 10MB, video 200MB, audio 20MB.
  CHECK (
    (kind = 'photo'
      AND content_type IN ('image/jpeg', 'image/png', 'image/webp')
      AND byte_length <= 10485760)
    OR (kind = 'video'
      AND content_type = 'video/mp4'
      AND byte_length <= 209715200)
    OR (kind = 'artist_message_audio'
      AND content_type IN ('audio/mpeg', 'audio/mp4')
      AND byte_length <= 20971520)
  )
);

CREATE INDEX idx_piece_media_keeper_piece_time
  ON piece_media(keeper_piece_id, created_at, id);
CREATE INDEX idx_piece_media_artwork_time
  ON piece_media(artwork_id, created_at, id);

-- Content-addressed storage: the R2 key a row claims must be exactly
-- media/{sha256}.{extension}, with the extension determined solely by the
-- declared content type. No row can ever point anywhere else.
CREATE TRIGGER piece_media_storage_reference_pin_insert
BEFORE INSERT ON piece_media
WHEN NEW.storage_reference <> 'media/' || NEW.sha256 || '.' || (
  CASE NEW.content_type
    WHEN 'image/jpeg' THEN 'jpg'
    WHEN 'image/png' THEN 'png'
    WHEN 'image/webp' THEN 'webp'
    WHEN 'video/mp4' THEN 'mp4'
    WHEN 'audio/mpeg' THEN 'mp3'
    WHEN 'audio/mp4' THEN 'm4a'
  END
)
BEGIN
  SELECT RAISE(ABORT, 'piece_media_storage_reference_address_mismatch');
END;

-- The only authorized UPDATE is the first soft removal: removed_at and
-- removed_reason move from NULL to a value, together, and nothing else on
-- the row changes. A row that already carries a removal accepts no further
-- UPDATE at all, so a removal can never be cleared or replaced.
CREATE TRIGGER piece_media_removal_only_update
BEFORE UPDATE ON piece_media
BEGIN
  SELECT RAISE(ABORT, 'piece_media_update_must_be_a_first_soft_removal')
   WHERE NEW.id IS NOT OLD.id
    OR NEW.keeper_piece_id IS NOT OLD.keeper_piece_id
    OR NEW.artwork_id IS NOT OLD.artwork_id
    OR NEW.kind IS NOT OLD.kind
    OR NEW.storage_reference IS NOT OLD.storage_reference
    OR NEW.sha256 IS NOT OLD.sha256
    OR NEW.byte_length IS NOT OLD.byte_length
    OR NEW.content_type IS NOT OLD.content_type
    OR NEW.created_at IS NOT OLD.created_at
    OR OLD.removed_at IS NOT NULL
    OR NEW.removed_at IS NULL
    OR NEW.removed_reason IS NULL;
END;

CREATE TRIGGER piece_media_no_delete
BEFORE DELETE ON piece_media
BEGIN
  SELECT RAISE(ABORT, 'piece media is permanent, never deleted');
END;

PRAGMA foreign_key_check;
