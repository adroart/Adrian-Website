-- Marks whether a generated Piece Record (docs/piece-record-format.md,
-- migration 037) carried its lineage and shines sections, or was built as a
-- placeholder because the livingLegacy launch flag (launchFlags.ts) was off
-- at generation time.
-- OWNED BY ADRIAN-WEBSITE. Apply from this checkout:
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only. Prior migrations remain immutable.
--
-- Why this exists: _lib/pieceRecord.js's buildPieceRecord takes an
-- includeLegacySections argument and, when it is false, prints "The living
-- record of this piece is not yet published" in place of the lineage and
-- shines sections. Nothing in the stored piece_records row said which kind
-- of record a given hash actually is, so a placeholder was indistinguishable
-- from a full record without opening the file and reading its prose.
--
-- DEFAULT 0 on the backfill is a TRUTHFUL statement about history, not a
-- structural invariant this schema enforces: it is correct only because the
-- livingLegacy flag has never been true in any environment that has written
-- to this table, so every row inserted before this migration applied was, in
-- fact, built with includeLegacySections: false. If that history turns out
-- to be wrong (a canary environment, a manual flag flip, a direct D1 write
-- this migration's author did not know about) the backfilled 0 would be a
-- lie stored as a fact, and there is no way for this ALTER TABLE to detect
-- that from here. The publish path (_lib/pieceRecord.js publishPieceRecord)
-- now binds this column from the same includeLegacySections argument the
-- caller already passes to buildPieceRecord, so every record generated after
-- this migration applies records the truth about itself going forward.
--
-- Migration 037's piece_records_no_update / piece_records_no_delete triggers
-- are BEFORE UPDATE and BEFORE DELETE row triggers: they fire per affected
-- row on an UPDATE or DELETE statement against piece_records, not on DDL.
-- SQLite's ALTER TABLE ADD COLUMN is schema-only (it rewrites sqlite_master,
-- not the table's rows in a way that raises UPDATE/DELETE events), so this
-- statement is not blocked by either trigger.

ALTER TABLE piece_records ADD COLUMN legacy_sections INTEGER NOT NULL DEFAULT 0
  CHECK (legacy_sections IN (0, 1));

PRAGMA foreign_key_check;
