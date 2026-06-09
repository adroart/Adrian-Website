-- Adrian Rasmussen Art — private art viewings ("The Viewing") schema, v1
-- Apply via: wrangler d1 migrations apply adrian-website --remote
--
-- A viewing is a curated, link-shared art lookbook for one collector. The
-- assembled artifact (the ViewingData the client page renders) is stored whole
-- as data_json, so the public page reads exactly what the desk composed. The
-- chart input is kept separately so a viewing can be recomputed/edited later.

CREATE TABLE IF NOT EXISTS viewings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',   -- draft | sent | viewed | requested
  recipient_name TEXT NOT NULL,
  client_email TEXT NOT NULL DEFAULT '',
  intention TEXT NOT NULL DEFAULT '',
  chart_json TEXT NOT NULL DEFAULT '{}',  -- the engine input (the 11 spheres)
  data_json TEXT NOT NULL DEFAULT '{}',   -- the assembled ViewingData (artifact)
  invoice_token TEXT,                     -- set once a request becomes an invoice
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  sent_at INTEGER,
  requested_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_viewings_status_created ON viewings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_viewings_public_token ON viewings(public_token);
