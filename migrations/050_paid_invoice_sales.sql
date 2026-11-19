-- A verified sale and its source invoice are connected in the same transaction.
CREATE TABLE paid_invoice_sales (
  sale_id TEXT NOT NULL PRIMARY KEY REFERENCES artist_verified_sales(id) ON DELETE RESTRICT,
  invoice_id INTEGER NOT NULL UNIQUE REFERENCES invoices(id) ON DELETE RESTRICT,
  invoice_revision TEXT NOT NULL CHECK (length(invoice_revision) = 64),
  confirmation_digest TEXT NOT NULL CHECK (length(confirmation_digest) = 64)
);
