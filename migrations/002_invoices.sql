-- Adrian Rasmussen Art — invoice creator schema, v1
-- Apply via: wrangler d1 migrations apply adrian-website --remote

CREATE TABLE IF NOT EXISTS payment_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  method TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  instructions TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_payment_presets_active ON payment_presets(is_active, is_default);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  public_token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL DEFAULT '',
  client_location TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL,
  job_description TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  shipping_text TEXT NOT NULL DEFAULT '',
  total_cents INTEGER NOT NULL DEFAULT 0,
  due_today_cents INTEGER NOT NULL DEFAULT 0,
  current_step_index INTEGER NOT NULL DEFAULT 0,
  payment_preset_id INTEGER REFERENCES payment_presets(id) ON DELETE SET NULL,
  payment_preset_ids_json TEXT NOT NULL DEFAULT '[]',
  payment_snapshot_json TEXT NOT NULL DEFAULT '{}',
  payment_options_json TEXT NOT NULL DEFAULT '[]',
  line_items_json TEXT NOT NULL DEFAULT '[]',
  payment_schedule_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  sent_at INTEGER,
  paid_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_invoices_status_created ON invoices(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_client_email ON invoices(client_email);
CREATE INDEX IF NOT EXISTS idx_invoices_public_token ON invoices(public_token);
