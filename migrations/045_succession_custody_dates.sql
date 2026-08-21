-- Succession page (/admin/succession) follow-up to migration
-- 044_succession_settings.sql. That migration gave Adrian a home for the
-- three blanks the Successor's Handbook leaves for his own handwriting. This
-- one gives him a home for two more facts only he can attest to: when the
-- custody envelope (scripts/custody-envelope.ts) that carries the archive's
-- keys out of Cloudflare was last built, and when the yearly restore drill
-- (docs/registry-custodian-guide.md, "The test drill") was last walked.
--
-- The server cannot see Adrian's local filesystem and cannot watch him run a
-- drill, so neither column is a system check. They are his own typed record
-- of a physical act, same honesty as the other four fields on this table.
-- Nullable text, no default: blank means "not yet recorded", not "unknown".
--
-- Apply via: wrangler d1 migrations apply adrian-website --remote
-- OWNED BY ADRIAN-WEBSITE (succession page). Additive only.

ALTER TABLE succession_settings ADD COLUMN custody_envelope_made_at TEXT;
ALTER TABLE succession_settings ADD COLUMN custody_drill_last_run_at TEXT;
