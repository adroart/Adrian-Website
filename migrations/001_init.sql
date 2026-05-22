-- Adrian Rasmussen Art — D1 schema, v1
-- Apply via: wrangler d1 migrations apply adrian-website --remote
-- See todo/oracle-accounts-implementation.md for the full provisioning checklist.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  birth_date TEXT NOT NULL,                   -- YYYY-MM-DD local
  birth_time TEXT NOT NULL,                   -- HH:MM local 24h
  birth_place_label TEXT NOT NULL,            -- "Denpasar, Bali, Indonesia"
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  tz_id TEXT NOT NULL,                        -- IANA zone, e.g. "Asia/Denpasar"
  computed_json TEXT NOT NULL,                -- HologeneticProfile JSON
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  stripe_session_id TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id TEXT,
  email TEXT NOT NULL,                        -- so guest orders can be claimed later
  status TEXT NOT NULL,                       -- "paid" | "pending" | "failed" | "refunded"
  amount_total INTEGER NOT NULL,              -- in smallest currency unit (cents)
  currency TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL,
  amount_subtotal INTEGER NOT NULL,
  configurator_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS cart_items (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  configurator_json TEXT NOT NULL DEFAULT '',
  added_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, product_id, configurator_json)
);

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                         -- 'card' | 'artwork' | 'product'
  ref TEXT NOT NULL,                          -- card number or product id (string for uniformity)
  added_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (collection_id, kind, ref)
);
