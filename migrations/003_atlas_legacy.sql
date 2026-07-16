-- Atlas living-legacy schema, v3 (M3 + M4 of todo/plans/living-art-legacy.md).
-- OWNED BY ADRIAN-WEBSITE: copy this file into that repo's migrations/ and
-- apply from THAT checkout (it owns the shared `adrian-website` D1 schema):
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only — D1 has no down-migrations.
--
-- Two tables, both consumed by mandalacodes Functions via the shared `DB`
-- binding:
--
--   atlas_inscriptions  — Ring 1 legacy entries (M3). The mutable, erasable
--                         content side of the chain's `inscribed` events.
--                         The chain holds only {inscriptionId, contentHash,
--                         inscriptionKind}; the body + salt live here so a
--                         legal erasure (body + salt deleted, erased_at set)
--                         makes the chain commitment unlinkable without
--                         touching a single hash.
--
--   atlas_sale_events   — the sale → ledger bridge queue (consumed in M4).
--                         Raw sale payloads from adrianrasmussen.com land
--                         here pending admin confirmation; price and buyer
--                         identity are D1-only, never chain, never public.

CREATE TABLE IF NOT EXISTS atlas_inscriptions (
  id TEXT PRIMARY KEY,                        -- opaque, referenced by the chain's inscriptionId
  piece_id TEXT NOT NULL,
  edition_number INTEGER NOT NULL DEFAULT 0,  -- ledger chain-key convention: editionNumber ?? 0
  author_clerk_id TEXT,                       -- opaque Clerk userId; nullable (author account may be gone)
  kind TEXT NOT NULL CHECK (kind IN ('intention', 'story', 'dedication')),
  body TEXT,                                  -- NULL after legal erasure
  body_hash TEXT NOT NULL,                    -- SHA-256(salt || body) hex — must equal the chain event's contentHash
  content_salt TEXT,                          -- random 16-byte hex; deleted WITH body on erasure (unlinkability)
  sealed_until TEXT,                          -- NULL = open; ISO date = time capsule; 'transfer' = sealed until the next transferred event
  created_at TEXT NOT NULL,                   -- ISO timestamp (authoring time; may predate the chain event for migrated entries)
  erased_at TEXT,                             -- ISO timestamp of legal erasure; row becomes a tombstone
  erase_reason TEXT                           -- admin-only audit note for the legal erasure; never returned to stewards
);

CREATE INDEX IF NOT EXISTS idx_atlas_inscriptions_piece
  ON atlas_inscriptions(piece_id, edition_number);

CREATE TABLE IF NOT EXISTS atlas_sale_events (
  sale_id TEXT PRIMARY KEY,                   -- idempotency key (INSERT OR IGNORE on webhook receipt)
  sku TEXT,
  piece_id TEXT,
  edition_number INTEGER,
  buyer_email TEXT NOT NULL,                  -- seeds the steward record only — NEVER the chain
  buyer_name TEXT,
  sale_date TEXT NOT NULL,                    -- ISO
  price_cents INTEGER,                        -- D1-only; visible to admin + the piece's current steward (ratified)
  currency TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  received_at INTEGER NOT NULL DEFAULT (unixepoch()),
  confirmed_at INTEGER,                       -- resolution time for BOTH confirm and dismiss
  dismissed_reason TEXT,                      -- admin's note when a pending sale is dismissed
  raw_json TEXT                               -- full verified webhook payload for dispute evidence
);

CREATE INDEX IF NOT EXISTS idx_atlas_sale_events_status
  ON atlas_sale_events(status);
